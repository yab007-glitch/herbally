import type * as SentryType from "@sentry/nextjs";
import { CLIENT_IGNORE_ERRORS, scrubEvent } from "./scrub-event";

let sentryMod: typeof SentryType | null = null;
let initPromise: Promise<typeof SentryType | null> | null = null;

/**
 * Dynamically loads `@sentry/nextjs` and initializes the browser client once.
 * Keeping the import dynamic keeps the ~120 KB transfer Sentry SDK out of the
 * initial critical-path JS bundle.
 */
export async function initSentryClient(): Promise<typeof SentryType | null> {
  if (sentryMod) return sentryMod;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const mod = await import("@sentry/nextjs");
      mod.init({
        // Client must be gated on the PUBLIC env var — SENTRY_DSN is
        // server-only and is NOT inlined into the client bundle.
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        // Tag by deployment. NEXT_PUBLIC_VERCEL_ENV is inlined at build time,
        // so a local production build is reported as "local" rather than
        // "production".
        environment:
          process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
          process.env.NEXT_PUBLIC_VERCEL_ENV ??
          (typeof window !== "undefined" &&
          window.location.hostname === "localhost"
            ? "local"
            : "production"),
        // Health app: never send default PII (IP, cookies, user agent fingerprint).
        sendDefaultPii: false,
        tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.05,
        enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
        beforeSend: scrubEvent,
        // Sampled transactions do NOT run beforeSend; scrub them with the same hook.
        beforeSendTransaction: scrubEvent,
        ignoreErrors: CLIENT_IGNORE_ERRORS,
      });
      sentryMod = mod;
      return mod;
    } catch {
      initPromise = null;
      return null;
    }
  })();

  return initPromise;
}

export function getLoadedSentryClient(): typeof SentryType | null {
  return sentryMod;
}

export async function captureClientException(error: unknown): Promise<void> {
  const mod = await initSentryClient();
  if (mod) {
    mod.captureException(error);
  }
}
