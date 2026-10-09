/**
 * Bounds every HTTP request supabase-js makes.
 *
 * supabase-js sets no request timeout of its own. When a Supabase instance is
 * unhealthy it still accepts connections but never answers, so a query neither
 * resolves nor rejects — `await` hangs indefinitely. A hang is not an
 * exception, which makes every `try/catch` fallback wrapped around those calls
 * dead code: the caller (a build worker, a server action, a route) rides the
 * platform timeout into a 504 instead of degrading.
 *
 * Bounding at the fetch layer fixes that whole class of failure in one place
 * instead of at each of the ~300 call sites. It also means a single slow query
 * can no longer hold a build worker — which matters because the build fans out
 * thousands of queries at a Free-tier instance (see the prerender limits in
 * herbs/[slug] and interactions/[herb]/[drug]).
 *
 * Override with SUPABASE_FETCH_TIMEOUT_MS.
 */

/**
 * Generous enough for the slowest legitimate query — the sitemap batches 1000
 * herb rows — while still leaving the 60s platform budget room to recover.
 */
export const DEFAULT_SUPABASE_FETCH_TIMEOUT_MS = 15_000;

export function getSupabaseFetchTimeoutMs(): number {
  const raw = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0
    ? raw
    : DEFAULT_SUPABASE_FETCH_TIMEOUT_MS;
}

/**
 * `fetch` with a hard ceiling. Callers that supply their own signal keep it —
 * whichever fires first aborts the request.
 */
export function boundedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const timeout = AbortSignal.timeout(getSupabaseFetchTimeoutMs());
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;
  return fetch(input, { ...init, signal });
}
