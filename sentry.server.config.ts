import * as Sentry from "@sentry/nextjs";

/**
 * Scrub PII / health data from a server-side event before upload.
 * - Redacts URL query strings and fragments (search terms, herb/symptom slugs).
 * - Removes request bodies and breadcrumb data that may echo user health
 *   input from the chat API or chat-persist server actions.
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
      // Breadcrumb `data` is an object map — redact it wholesale so user
      // health input captured in fetch/query breadcrumbs never leaves the app.
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
  dsn: process.env.SENTRY_DSN,
  // Health app: never send default PII (IP, cookies, user body).
  sendDefaultPii: false,
  // Hobby Fluid CPU is a hard limit: 5% of transactions still gives us
  // latency distributions without paying tracing overhead on every request.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.05,
  enabled: !!process.env.SENTRY_DSN,
  // H-5 (audit 2026-06-22): local-variable capture would send user health
  // data (chat messages, medications, herb/symptom context) held in server
  // stack frames to Sentry on an exception — defeating sendDefaultPii:false
  // for a health app. The scrubEvent hook cannot reach into frame vars, so
  // disable local-variable capture at the source.
  includeLocalVariables: false,
  enableLogs: true,
  beforeSend: scrubEvent,
  // Sampled transactions do NOT run beforeSend; scrub them with the same hook.
  beforeSendTransaction: scrubEvent,
  ignoreErrors: [
    // Unactionable rejections injected by embedded Chromium (CEF/.NET)
    // clients and browser extensions — e.g.
    // "Object Not Found Matching Id:2, MethodName:update, ParamCount:4".
    /Object Not Found Matching Id:/,
    /MethodName:\w+,\s*ParamCount:/,
  ],
});
