import * as Sentry from "@sentry/nextjs";

/**
 * Scrub PII / health data from a server-side event before upload.
 * - Redacts URL query strings and fragments (search terms, herb/symptom slugs).
 * - Truncates breadcrumb data and request bodies that may echo user health
 *   input from the chat API or chat-persist server actions.
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
    if (event.request?.data && typeof event.request.data === "string") {
      event.request.data =
        event.request.data.length > 200 ? "[redacted]" : event.request.data;
    }
    if (event.breadcrumbs) {
      // Breadcrumb `data` is an object map — redact it wholesale so user
      // health input captured in fetch/query breadcrumbs never leaves the app.
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
  // Health app: never send default PII (IP, cookies, user body).
  sendDefaultPii: false,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enabled: !!process.env.SENTRY_DSN,
  includeLocalVariables: true,
  enableLogs: true,
  beforeSend: scrubEvent,
});
