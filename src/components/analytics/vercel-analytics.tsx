"use client";

import { Analytics } from "@vercel/analytics/next";
import { analyticsAllowed } from "@/lib/analytics";

/**
 * Vercel Web Analytics, installed behind the site's opt-out signals.
 *
 * `beforeSend` runs for page views as well as custom events, so a visitor with
 * Global Privacy Control or Do Not Track enabled sends nothing at all — not
 * just no custom events. Custom events are gated a second time inside
 * `trackEvent()`; this wrapper is what extends the same consent decision to
 * page views.
 */
export function VercelAnalytics() {
  return (
    <Analytics beforeSend={(event) => (analyticsAllowed() ? event : null)} />
  );
}
