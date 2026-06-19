import * as Sentry from "@sentry/nextjs";

/**
 * Scrub PII / health data from an event before it leaves the browser.
 * - Redacts query strings and URL fragments (may contain search terms /
 *   herb/symptom slugs that are health-related).
 * - Masks long breadcrumb/request bodies that could echo user health input.
 * Returns null to drop the event if no usable payload remains.
 */
function scrubEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
  try {
    if (event.request?.url) {
      try {
        const u = new URL(event.request.url);
        u.search = "";
        u.hash = "";
        event.request.url = u.toString();
      } catch {
        event.request.url = "[redacted]";
      }
    }
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((b) => ({
        ...b,
        data: { redacted: true },
      }));
    }
  } catch {
    // Never let scrubbing itself throw away the event silently.
  }
  return event;
}

Sentry.init({
  // Client must be gated on the PUBLIC env var — SENTRY_DSN is server-only and
  // is NOT inlined into the client bundle, so the old gate disabled client-side
  // Sentry entirely in production.
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Health app: never send default PII (IP, cookies, user agent fingerprint).
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  beforeSend: scrubEvent,
  integrations: [
    // Mask all text and block media in Session Replay — on-screen health
    // content (herb queries, symptoms, chat messages) must not be captured.
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
      maskAllInputs: true,
    }),
  ],
});

// Hook into App Router navigation transitions
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
