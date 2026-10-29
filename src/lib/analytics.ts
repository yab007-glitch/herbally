import { track } from "@vercel/analytics";
import { DOSAGE_FORMULAS } from "@/lib/constants/dosage-formulas";

/**
 * Consent-safe product analytics.
 *
 * Vercel Web Analytics is first-party and cookieless — no cookies, no
 * localStorage identifier, no cross-site profile — and it is the only
 * analytics on the site. Ads, pixels and sponsor tags are deliberately absent.
 *
 * Every event passes three gates before it can be transmitted:
 *
 *  1. Consent. Global Privacy Control, Do Not Track and an explicit opt-out
 *     all stop the event, and the same check gates page views through
 *     `components/analytics/vercel-analytics.tsx`. If storage access throws we
 *     cannot read an opt-out, so we fail closed and send nothing.
 *  2. Event allowlist. Only the names in `EventSpec` are sent; anything else
 *     is a silent no-op.
 *  3. Property allowlist. Only the keys named in `ALLOWED_PROPERTIES` survive,
 *     and closed-domain values must match `ALLOWED_VALUES`, so raw query text,
 *     herb names, symptom names, ages, weights or doses cannot ride along even
 *     if a caller passes them by mistake.
 *
 * Historical note: this module used to call `window.va.track(...)`.
 * `window.va` is the SDK's *function* queue stub, so `va.track` was always
 * undefined, the call was swallowed by the surrounding try/catch, and no
 * custom event ever reached Vercel — which is why the dashboard showed zero
 * custom events for the life of the project. Use the SDK's `track()` export;
 * do not hand-roll `window.va` calls.
 */

export type FormulaName = keyof typeof DOSAGE_FORMULAS;
export type OutboundTarget = "donation" | "sponsor" | "affiliate" | "external";

export type EventSpec = {
  /** A visitor pressed Calculate and got a numeric dose, or was stopped by the age gate. */
  calculator_used: {
    formula: FormulaName;
    outcome: "computed" | "blocked";
  };
  /** A visitor consulted herb–drug interaction data. */
  interaction_checked: { trigger: "pair_page" | "expand_table" };
  /** A visitor sent a question to the virtual herbalist. Message text is never sent. */
  chat_message_sent: { hasHerbContext: boolean };
  /** A visitor left the site toward a monetisation or external destination. */
  outbound_click: { target: OutboundTarget; host?: string };
  /** The visitor switched language. */
  language_changed: { locale: "en" | "fr"; source?: string };
};

export type EventName = keyof EventSpec;

/**
 * Property allowlist per event.
 *
 * Keep in sync with `EventSpec`. Adding a property here is a privacy decision,
 * not a refactor: if the value can identify a visitor or describe their
 * health, it does not belong on the list.
 */
const ALLOWED_PROPERTIES: {
  [K in EventName]: readonly (keyof EventSpec[K] & string)[];
} = {
  calculator_used: ["formula", "outcome"],
  interaction_checked: ["trigger"],
  chat_message_sent: ["hasHerbContext"],
  outbound_click: ["target", "host"],
  language_changed: ["locale", "source"],
};

/**
 * Closed-domain properties: the only values that may be transmitted.
 *
 * A caller that passes an unexpected string is dropped rather than trusted.
 * This is what stops a future refactor from quietly shipping a herb slug, a
 * drug name or a free-text tag through a property that looks generic.
 */
const ALLOWED_VALUES: Partial<
  Record<EventName, Record<string, readonly string[]>>
> = {
  calculator_used: {
    formula: Object.keys(DOSAGE_FORMULAS),
    outcome: ["computed", "blocked"],
  },
  interaction_checked: { trigger: ["pair_page", "expand_table"] },
  outbound_click: { target: ["donation", "sponsor", "affiliate", "external"] },
  language_changed: {
    locale: ["en", "fr"],
    // Only the switcher surfaces that exist in this codebase.
    source: [
      "hotkey",
      "dropdown",
      "dropdown_suggestion",
      "drawer",
      "drawer_suggestion",
      "first_visit_banner",
    ],
  },
};

/** Longest string we will transmit. Hostnames fit; free text does not. */
const MAX_STRING_LENGTH = 40;

/** Hostnames only: letters, digits, dots and hyphens. */
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9.-]{0,38}[a-z0-9])$/;

/** Set to "1" to opt this browser out of analytics without touching site data. */
export const ANALYTICS_OPT_OUT_KEY = "herbally:analytics-opt-out";

type NavigatorWithGpc = Navigator & { globalPrivacyControl?: boolean };
type WindowWithDnt = Window & { doNotTrack?: string | null };

/**
 * Whether this browser has signalled that it does not want analytics.
 *
 * The result is authoritative for both page views and custom events. Storage
 * failures fail closed: an unreadable opt-out is not proof that none was set.
 */
export function analyticsAllowed(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  try {
    if ((navigator as NavigatorWithGpc).globalPrivacyControl === true) {
      return false;
    }
    const dnt = navigator.doNotTrack ?? (window as WindowWithDnt).doNotTrack;
    if (dnt === "1" || dnt === "yes") {
      return false;
    }
    if (window.localStorage.getItem(ANALYTICS_OPT_OUT_KEY) === "1") {
      return false;
    }
  } catch {
    return false;
  }
  return true;
}

function isAllowedValue(event: EventName, key: string, value: string): boolean {
  const domain = ALLOWED_VALUES[event]?.[key];
  return domain ? domain.includes(value) : true;
}

function sanitizeProperties<K extends EventName>(
  event: K,
  properties: EventSpec[K]
): Record<string, string | number | boolean> {
  const allowed = ALLOWED_PROPERTIES[event] as readonly string[];
  const clean: Record<string, string | number | boolean> = {};
  const source = properties as Record<string, unknown>;

  for (const key of allowed) {
    const value = source[key];

    if (typeof value === "string") {
      if (value.length === 0 || value.length > MAX_STRING_LENGTH) continue;
      if (!isAllowedValue(event, key, value)) continue;
      if (key === "host" && !HOST_PATTERN.test(value)) continue;
      clean[key] = value;
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      clean[key] = value;
      continue;
    }

    if (typeof value === "boolean") {
      clean[key] = value;
    }
  }

  return clean;
}

/**
 * Send one allowlisted custom event. Safe to call from any client component:
 * it no-ops on the server, without consent, or when analytics is blocked.
 */
export function trackEvent<K extends EventName>(
  event: K,
  properties: EventSpec[K]
): void {
  if (!analyticsAllowed()) return;
  try {
    track(event, sanitizeProperties(event, properties));
  } catch {
    // Analytics must never break a health tool.
  }
}
