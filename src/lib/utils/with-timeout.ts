/**
 * Bounds a promise so a hung dependency becomes a normal, catchable error
 * instead of stalling the request until the platform kills it.
 *
 * Why this exists: supabase-js sets no request timeout, so when a Supabase
 * instance is unhealthy a query never settles — it neither resolves nor
 * throws. The `try { } catch { }` fallbacks wrapped around those calls
 * therefore never run (a hang is not an exception), and the route blocks
 * until Vercel's `maxDuration` fires a 504 FUNCTION_INVOCATION_TIMEOUT.
 * Racing the call against a timer converts that hang into a TimeoutError the
 * existing fallbacks already know how to handle — e.g. /api/chat degrading to
 * source: "none" and answering from the model anyway.
 */

/** Default bound for DB calls on the chat path. Override: CHAT_DB_TIMEOUT_MS. */
export const DEFAULT_DB_TIMEOUT_MS = 3000;

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

const getDbTimeoutMs = () => {
  const raw = Number(process.env.CHAT_DB_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DB_TIMEOUT_MS;
};

/**
 * Resolve `thenable`, or reject with a TimeoutError after `ms`.
 *
 * The underlying request is abandoned rather than aborted (supabase-js owns
 * the socket), but that is enough: the caller's fallback runs immediately
 * instead of the whole invocation hanging. Handlers are attached to the
 * original promise, so a late rejection from the abandoned call can't surface
 * as an unhandled rejection.
 */
export function withTimeout<T>(
  thenable: PromiseLike<T>,
  label: string,
  ms: number = getDbTimeoutMs()
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    Promise.resolve(thenable).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
