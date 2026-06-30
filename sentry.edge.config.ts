import * as Sentry from "@sentry/nextjs";

/**
 * Scrub PII / health data from an edge event before upload (same logic as the
 * server config). Edge runs in the proxy and sees request URLs/headers.
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
    // Never let scrubbing itself throw.
  }
  return event;
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Health app: never send default PII.
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enabled: !!process.env.SENTRY_DSN,
  enableLogs: true,
  beforeSend: scrubEvent,
  ignoreErrors: [
    // Unactionable rejections injected by embedded Chromium (CEF/.NET)
    // clients and browser extensions — e.g.
    // "Object Not Found Matching Id:2, MethodName:update, ParamCount:4".
    /Object Not Found Matching Id:/,
    /MethodName:\w+,\s*ParamCount:/,
  ],
});
