"use client";

/**
 * Coarse region lookup used by the consent UI and the ad gate.
 *
 * Deliberately a lazy, same-origin request rather than a geo cookie set on
 * every page: the site's herb pages are ISR-cached and must not start carrying
 * per-visitor Set-Cookie headers. The endpoint returns only `row` / `eea` /
 * `unknown`, never the country itself. Failures and unknown hosts resolve to
 * `unknown`, which blocks ads.
 */

import type { AdRegion } from "./policy";

let cached: Promise<AdRegion> | null = null;

function coerce(value: unknown): AdRegion {
  return value === "row" || value === "eea" ? value : "unknown";
}

export function getAdRegion(): Promise<AdRegion> {
  if (cached) return cached;
  cached = fetch("/api/ads/region", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  })
    .then(async (response) => {
      if (!response.ok) return "unknown" as AdRegion;
      const body = (await response.json()) as { region?: unknown };
      return coerce(body.region);
    })
    .catch(() => "unknown" as AdRegion);
  return cached;
}

export function __resetAdRegionForTests(): void {
  cached = null;
}
