import { logger } from "@/lib/utils/logger";

const RXNORM_BASE =
  process.env.RXNORM_BASE_URL || "https://rxnav.nlm.nih.gov/REST";

// Bound upstream latency so a hung RxNorm request can't stall a serverless
// invocation indefinitely.
const RXNORM_TIMEOUT_MS = 8000;

export type RxNormDrug = {
  rxcui: string;
  name: string;
  synonym: string;
};

/**
 * M11 (audit 2026-06-22): previously every error path `catch { return [] }`
 * with no logging, so real RxNorm bugs (non-2xx, malformed JSON) were silently
 * swallowed and the route's Sentry-capture branch was dead code. Now transient
 * errors (network/timeout/aborted) are logged as a warning and return empty
 * (expected when upstream is unreachable), while NON-transient errors (a 5xx
 * or JSON parse failure) are thrown so the route's `captureException` fires.
 */
function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("enotfound") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    msg.includes("timeout") ||
    msg.includes("abort") ||
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("dns")
  );
}

export async function searchDrugs(term: string): Promise<RxNormDrug[]> {
  try {
    const res = await fetch(
      `${RXNORM_BASE}/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=10`,
      {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(RXNORM_TIMEOUT_MS),
      }
    );

    if (!res.ok) {
      // 404 / no-content = "no matches", an expected empty result.
      if (res.status === 404) return [];
      // Any other non-2xx is a real upstream bug — throw so the route reports it.
      throw new Error(`rxnorm_search_status_${res.status}`);
    }

    const data = await res.json();
    const candidates = data?.approximateGroup?.candidate || [];

    return candidates.map(
      (c: { rxcui: string; name: string; score: string }) => ({
        rxcui: c.rxcui,
        name: c.name,
        synonym: c.name,
      })
    );
  } catch (error) {
    if (isTransientError(error)) {
      logger.warn("rxnorm_search_transient", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
    // Non-transient: rethrow so the route captures it to Sentry.
    logger.error("rxnorm_search_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function getDrugByRxcui(rxcui: string): Promise<string | null> {
  try {
    // Encode rxcui so a malformed/malicious value can't inject path segments.
    const res = await fetch(
      `${RXNORM_BASE}/rxcui/${encodeURIComponent(rxcui)}/properties.json`,
      {
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(RXNORM_TIMEOUT_MS),
      }
    );

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`rxnorm_get_status_${res.status}`);
    }

    const data = await res.json();
    return data?.properties?.name || null;
  } catch (error) {
    if (isTransientError(error)) {
      logger.warn("rxnorm_get_transient", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
    logger.error("rxnorm_get_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function getDrugInteractions(rxcui: string) {
  try {
    const res = await fetch(
      `${RXNORM_BASE}/interaction/interaction.json?rxcui=${encodeURIComponent(rxcui)}`,
      {
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(RXNORM_TIMEOUT_MS),
      }
    );

    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`rxnorm_interactions_status_${res.status}`);
    }

    const data = await res.json();
    return data?.interactionTypeGroup || [];
  } catch (error) {
    if (isTransientError(error)) {
      logger.warn("rxnorm_interactions_transient", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
    logger.error("rxnorm_interactions_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
