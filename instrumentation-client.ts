import * as Sentry from "@sentry/nextjs";

/**
 * Scrub PII / health data from an event before it leaves the browser.
 * - Redacts query strings and URL fragments (may contain search terms /
 *   herb/symptom slugs that are health-related).
 * - Removes request bodies, query-string fields, and breadcrumb data that
 *   could echo user health input.
 * Drops the event if it cannot be scrubbed safely.
 */
type ScrubbableEvent = {
  request?: any;
  breadcrumbs?: any;
  contexts?: any;
  transaction?: string;
};

/**
 * Best available non-concrete route: the Next.js router template when present,
 * otherwise a "[param]" template recovered from the transaction name.
 */
function routeTemplate(event: ScrubbableEvent): string | undefined {
  const fromContext = (
    event.contexts?.nextjs as Record<string, unknown> | undefined
  )?.router_path;
  if (typeof fromContext === "string" && fromContext.startsWith("/"))
    return fromContext;
  if (typeof event.transaction === "string") {
    const match = event.transaction.match(/(\/\S*\[[^\]]+\]\S*)$/);
    if (match) return match[1];
  }
  return undefined;
}

function scrubEvent<T extends ScrubbableEvent>(event: T): T | null {
  try {
    if (event.request) {
      // Bodies, query strings, credentials and IP hints must never leave the app.
      delete event.request.data;
      delete event.request.query_string;
      delete event.request.headers;
      delete event.request.cookies;
      delete event.request.env;

      if (event.request.url) {
        try {
          const u = new URL(event.request.url);
          // The concrete path is health data here (/herbs/[slug],
          // /symptoms/[symptom], /interactions/[herb]/[drug]). Keep only the
          // origin plus the route template.
          const template = routeTemplate(event);
          event.request.url = template
            ? u.origin + template
            : u.origin + "/[redacted-path]";
        } catch {
          event.request.url = "[redacted]";
        }
      }
    }

    // Next.js sets the full concrete path here; keep the template only.
    const nextjsContext = event.contexts?.nextjs as
      Record<string, unknown> | undefined;
    if (nextjsContext && typeof nextjsContext.request_path === "string") {
      nextjsContext.request_path = "[redacted]";
    }
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((b: any) => ({
        ...b,
        data: { redacted: true },
      }));
    }
  } catch {
    // Drop events we cannot safely scrub.
    return null;
  }
  return event;
}

Sentry.init({
  // Client must be gated on the PUBLIC env var — SENTRY_DSN is server-only and
  // is NOT inlined into the client bundle, so the old gate disabled client-side
  // Sentry entirely in production.
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Tag by deployment. NEXT_PUBLIC_VERCEL_ENV is inlined at build time, so a
  // local production build is reported as "local" rather than "production".
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    (typeof window !== "undefined" && window.location.hostname === "localhost"
      ? "local"
      : "production"),
  // Health app: never send default PII (IP, cookies, user agent fingerprint).
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.05,
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  beforeSend: scrubEvent,
  // Sampled transactions do NOT run beforeSend; scrub them with the same hook.
  beforeSendTransaction: scrubEvent,
  ignoreErrors: [
    // Unactionable rejections injected by embedded Chromium (CEF/.NET) clients
    // and browser extensions — e.g.
    // "Object Not Found Matching Id:2, MethodName:update, ParamCount:4".
    // These originate outside our app code (no client-side realtime/supabase),
    // so drop them instead of alerting.
    /Object Not Found Matching Id:/,
    /MethodName:\w+,\s*ParamCount:/,
  ],
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
