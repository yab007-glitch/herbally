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

/**
 * Prerendering at build time is not the same workload as serving a request.
 * A build has no user waiting, no platform timeout to ride into, and it fans
 * out over the whole route table at once — so a 15s ceiling that protects a
 * request just trips over itself here. The longer ceiling gives one slow query
 * room to land instead of failing the deploy.
 */
export const DEFAULT_BUILD_FETCH_TIMEOUT_MS = 30_000;

/**
 * True while Next prerenders the route table at build time. Read once: the
 * phase cannot change inside a process.
 *
 * The build must not inherit the runtime breaker. The breaker exists to stop a
 * warm instance burning memory while a user waits; a build that trips it turns
 * one slow minute on the database into a failed deploy of every unrelated
 * change behind it. Guarding here also means the retry in getHerbBySlug gets a
 * real attempt instead of an instant rejection.
 */
const IS_PRODUCTION_BUILD = process.env.NEXT_PHASE === "phase-production-build";

export function getSupabaseFetchTimeoutMs(): number {
  const raw = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return IS_PRODUCTION_BUILD
    ? DEFAULT_BUILD_FETCH_TIMEOUT_MS
    : DEFAULT_SUPABASE_FETCH_TIMEOUT_MS;
}

/**
 * Fail-fast breaker.
 *
 * A single outage used to make every request in every warm Fluid instance wait
 * out the full 15s timeout, which is what burned the Vercel provisioned-memory
 * allowance. After three consecutive timeouts this instance rejects Supabase
 * requests immediately for 30s. The next success closes it again.
 *
 * This is deliberately per-instance and in-memory: it is a cost/latency guard,
 * not a shared health system, and it must never add its own network call.
 */
const FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_MS = 30_000;
let consecutiveTimeouts = 0;
let circuitOpenUntil = 0;

/**
 * `fetch` with a hard ceiling. Callers that supply their own signal keep it —
 * whichever fires first aborts the request.
 */
export function boundedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  if (!IS_PRODUCTION_BUILD && Date.now() < circuitOpenUntil) {
    return Promise.reject(new Error("Supabase circuit breaker is open"));
  }

  const timeout = AbortSignal.timeout(getSupabaseFetchTimeoutMs());
  let timedOut = false;
  timeout.addEventListener("abort", () => {
    timedOut = true;
  });

  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;

  return fetch(input, { ...init, signal }).then(
    (response) => {
      consecutiveTimeouts = 0;
      return response;
    },
    (error: unknown) => {
      // Counting timeouts at build time would let three slow pages shut the
      // gate on every remaining prerender in the worker.
      if (timedOut && !IS_PRODUCTION_BUILD) {
        consecutiveTimeouts += 1;
        if (consecutiveTimeouts >= FAILURE_THRESHOLD) {
          circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
          consecutiveTimeouts = 0;
        }
      }
      throw error;
    }
  );
}
