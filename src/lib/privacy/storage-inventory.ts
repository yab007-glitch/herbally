"use client";

/**
 * Complete inventory of client-side browser storage keys written by HerbAlly.
 * Keep in sync with local-garden.ts, streaks.ts, stack-checker.tsx,
 * chat-helpers.ts, recent-searches.tsx, floating-chat-button.tsx,
 * view-tracker.tsx, first-visit-banner.tsx, ad-document-guard.tsx, and
 * ad-slot.tsx.
 */
export const HERBALLY_EXACT_STORAGE_KEYS = [
  "herbally-my-stack-v1",
  "herbally-recent-searches",
  "herbally-chat-session-id",
  "herbally-garden",
  "herbally-garden-notes",
  "herbally-garden-removed",
  "herbally-garden-synced",
  "herbally-streak",
  "herbally-last-visit",
  "herbally-explored-herbs",
  "herbally-explored-count",
  "herbally.chat.teaser.dismissedAt",
  "herbally.chat.teaser.seen",
  "herbally-locale",
  "herbally-lang-banner-dismissed",
  "herbally:ad-document-guard",
  "herbally:ads-consent-reload",
] as const;

export const HERBALLY_STORAGE_KEY_PREFIXES = ["herbally-viewed-"] as const;

function wipeStorage(storage: Storage | undefined): boolean {
  if (!storage) return true;
  let ok = true;
  for (const key of HERBALLY_EXACT_STORAGE_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      ok = false;
    }
  }
  try {
    const keysToDelete: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (
        k &&
        HERBALLY_STORAGE_KEY_PREFIXES.some((prefix) => k.startsWith(prefix))
      ) {
        keysToDelete.push(k);
      }
    }
    for (const k of keysToDelete) {
      storage.removeItem(k);
    }
  } catch {
    ok = false;
  }
  return ok;
}

/**
 * Delete all Cache Storage buckets for this origin and notify any active
 * service worker to clear its caches too.
 */
export async function clearBrowserCaches(): Promise<{
  ok: boolean;
  clearedCount: number;
}> {
  if (typeof window === "undefined") {
    return { ok: true, clearedCount: 0 };
  }

  let ok = true;
  let clearedCount = 0;

  if ("caches" in window && window.caches) {
    try {
      const keys = await window.caches.keys();
      const deleted = await Promise.all(
        keys.map((name) => window.caches.delete(name))
      );
      for (const flag of deleted) {
        if (flag) clearedCount += 1;
        else ok = false;
      }
    } catch {
      ok = false;
    }
  }

  try {
    const controller = window.navigator?.serviceWorker?.controller;
    if (controller) {
      controller.postMessage({ type: "CLEAR_CACHES" });
    }
  } catch {
    // Non-fatal if service worker messaging is unavailable
  }

  return { ok, clearedCount };
}

export async function clearAllLocalHerbAllyData(): Promise<{
  ok: boolean;
  failedLayers: Array<"localStorage" | "sessionStorage" | "cacheStorage">;
}> {
  if (typeof window === "undefined") {
    return { ok: true, failedLayers: [] };
  }

  const failedLayers: Array<
    "localStorage" | "sessionStorage" | "cacheStorage"
  > = [];

  if (!wipeStorage(window.localStorage)) {
    failedLayers.push("localStorage");
  }
  if (!wipeStorage(window.sessionStorage)) {
    failedLayers.push("sessionStorage");
  }
  const cacheResult = await clearBrowserCaches();
  if (!cacheResult.ok) {
    failedLayers.push("cacheStorage");
  }

  return {
    ok: failedLayers.length === 0,
    failedLayers,
  };
}
