"use client";

import { useEffect } from "react";

/** Slugs already sent in this tab's lifetime — survives React StrictMode's
 * double-invoked effects and client-side navigations. */
const sentThisTab = new Set<string>();

/**
 * Records one herb view per visitor, slug and UTC day.
 *
 * The previous implementation incremented from the server in `after()`, so
 * every dynamic render (crawlers, prefetches, repeat views) wrote a row. On the
 * free-tier Nano instance that was the single largest Disk IO consumer. The
 * beacon only runs in a real browser, waits briefly so bounces don't count,
 * and dedupes via localStorage before calling the API.
 */
export function ViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug || sentThisTab.has(slug)) return;

    const day = new Date().toISOString().slice(0, 10);
    const storageKey = `herb-view:${slug}`;

    try {
      if (window.localStorage.getItem(storageKey) === day) return;
    } catch {
      // Storage can be unavailable (private mode, blocked); fall through and
      // let the server-side rate limit bound repeat sends.
    }

    const timer = window.setTimeout(() => {
      sentThisTab.add(slug);
      try {
        window.localStorage.setItem(storageKey, day);
      } catch {
        // Non-critical: tracking must never break the page.
      }
      void fetch("/api/herbs/view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
        keepalive: true,
      }).catch(() => {
        // View tracking is non-critical.
      });
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [slug]);

  return null;
}
