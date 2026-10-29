/**
 * Ad policy — the single source of truth for whether an ad may exist, where,
 * and after which consent.
 *
 * This module is intentionally dependency-free and safe to import from both
 * the server (proxy, route handlers, CSP) and the browser (components).
 *
 * ── The hard gate ─────────────────────────────────────────────────────────
 * `ADS_LAUNCH_GATE` is `false` and must stay `false` until every prerequisite
 * in `docs/ADS_LAUNCH_CHECKLIST.md` is met and the owner explicitly authorizes
 * activation. It is deliberately a code constant, not an environment
 * variable: a deploy cannot switch ads on by accident, and the test suite
 * asserts that production builds with publisher identifiers configured still
 * render no ad markup and make no ad-network requests.
 *
 * The gate is necessary but not sufficient. Even with it on, an ad is only
 * allowed when ALL of the following hold:
 *   1. publisher client + ad-unit slot are configured;
 *   2. the current URL is an ad-eligible public herb reference page;
 *   3. the *document* was originally loaded at an ad-eligible URL (so an ad
 *      script can never survive a client-side navigation from another page);
 *   4. the reader granted ad consent (explicit opt-in, not implied);
 *   5. the reader's region is not EEA/UK/CH and is positively known.
 *
 * ── What this does NOT solve ──────────────────────────────────────────────
 * A script running in a document still runs with the origin's privileges.
 * While ads are off this is moot. Before launch, the owner must decide how to
 * handle the fact that AdSense code executing on herbally.app could read the
 * app's non-HttpOnly Supabase auth cookies and the localStorage garden/notes
 * data. Document isolation alone does not isolate origin storage. See the
 * checklist.
 */

/**
 * HARD LAUNCH GATE. Do not flip without a separately authorized launch task.
 * Typed as boolean (not the literal `false`) so the gating branches stay
 * type-checkable and testable; the value itself is deliberately hard-coded.
 */
export const ADS_LAUNCH_GATE: boolean = false;

/** First-party cookie holding the reader's ad choice. */
export const AD_CONSENT_COOKIE = "herbally-ads-consent";

/** Bump to invalidate every stored choice (forces a fresh decision). */
export const AD_CONSENT_VERSION = 1;

/** Six months. Short enough to re-ask, long enough not to nag. */
export const AD_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

/** Custom event fired in the tab that changes the choice. */
export const AD_CONSENT_EVENT = "herbally:ads-consent";

/**
 * AdSense hosts. Kept in one place so the CSP can grant them *only* to
 * ad-eligible documents and tests can assert they never appear anywhere else.
 */
export const AD_PROVIDER_HOSTS = [
  "https://pagead2.googlesyndication.com",
  "https://*.googlesyndication.com",
  "https://*.doubleclick.net",
  "https://adservice.google.com",
  "https://www.google.com",
] as const;

export type AdConsent = "granted" | "denied" | null;

/** `row` = ads may be offered (with explicit opt-in). `eea` = blocked. */
export type AdRegion = "row" | "eea" | "unknown";

export type AdPageClass = "ad-eligible" | "sensitive" | "neutral";

export type AdBlockReason =
  | "gate-off"
  | "not-configured"
  | "page-not-ad-eligible"
  | "document-not-ad-eligible"
  | "consent-missing"
  | "consent-denied"
  | "region-restricted"
  | "region-unknown"
  | "allowed";

export type AdGateDecision = {
  allowed: boolean;
  reason: AdBlockReason;
};

/**
 * EU member states + EEA (Iceland, Liechtenstein, Norway) + UK + Switzerland.
 *
 * These are the jurisdictions where Google's EU user consent policy applies.
 * HerbAlly blocks ads there entirely until a Google-certified CMP (or Google's
 * own consent message) is integrated — a custom banner is not a certified CMP
 * and must not be presented as one.
 */
const CONSENT_RESTRICTED_COUNTRIES = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  "IS",
  "LI",
  "NO",
  "GB",
  "CH",
]);

/**
 * Strip the locale representation from a public pathname.
 *
 * English is served unprefixed (the proxy rewrites `/herbs/x` to `/en/...`
 * internally); French carries `/fr`. Both the browser's `usePathname()` and
 * the proxy can feed this function, so it normalizes all three shapes.
 */
export function normalizePublicPath(pathname: string): string {
  const withoutQuery = (pathname || "/").split("?")[0].split("#")[0];
  if (!withoutQuery || withoutQuery === "/") return "/";
  const path = withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;

  if (path === "/fr" || path === "/en") return "/";
  if (path.startsWith("/fr/")) return path.slice(3) || "/";
  if (path.startsWith("/en/")) return path.slice(3) || "/";
  return path;
}

/** `/herbs/<slug>` exactly — never the index, never nested paths. */
export function isAdEligiblePath(pathname: string): boolean {
  const path = normalizePublicPath(pathname);
  return /^\/herbs\/[^/]+\/?$/.test(path);
}

/**
 * Routes that handle health input, personal data, or authenticated state.
 * Ads must never render in their documents, and their CSP never lists ad
 * hosts. Kept as prefixes so nested routes (`/interactions/ginger`) inherit.
 */
const SENSITIVE_PREFIXES = [
  "/herbalist",
  "/calculator",
  "/interactions",
  "/symptoms",
  "/compare",
  "/garden",
  "/profile",
  "/admin",
  "/embed",
  "/auth",
  "/login",
  "/register",
  "/reset-password",
  "/forgot-password",
  "/api",
  "/monitoring",
] as const;

export function isSensitivePath(pathname: string): boolean {
  const path = normalizePublicPath(pathname);
  return SENSITIVE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export function classifyPage(pathname: string): AdPageClass {
  if (isAdEligiblePath(pathname)) return "ad-eligible";
  if (isSensitivePath(pathname)) return "sensitive";
  return "neutral";
}

/** Parse the consent cookie. Unknown versions and values fail closed. */
export function parseAdConsent(value: string | null | undefined): AdConsent {
  if (!value) return null;
  const match = /^v(\d+):(granted|denied)$/.exec(value.trim());
  if (!match) return null;
  if (Number(match[1]) !== AD_CONSENT_VERSION) return null;
  return match[2] as "granted" | "denied";
}

export function serializeAdConsent(consent: "granted" | "denied"): string {
  return `v${AD_CONSENT_VERSION}:${consent}`;
}

/**
 * Codes that mean "the geo lookup could not determine a country", not a real
 * jurisdiction. Cloudflare emits `XX` when its lookup fails and `T1` for Tor
 * exits. Mapping either to `row` would turn an unknown visitor into an
 * ad-eligible one — the exact fail-open the region gate exists to prevent.
 */
const UNDETERMINED_COUNTRY_CODES = new Set(["XX", "T1"]);

/**
 * Pseudo-codes some geo services use for "somewhere in the European Union".
 * Not an ISO country, but conservative handling is to restrict it.
 */
const RESTRICTED_PSEUDO_CODES = new Set(["EU"]);

/**
 * Map an ISO-3166-1 alpha-2 country code to a region decision.
 *
 * Unknown or missing country data is treated as `unknown`, which blocks ads.
 * That is the fail-closed default for local development and for any host that
 * does not forward geo headers.
 */
export function regionForCountry(country: string | null | undefined): AdRegion {
  const code = (country ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "unknown";
  if (UNDETERMINED_COUNTRY_CODES.has(code)) return "unknown";
  if (
    RESTRICTED_PSEUDO_CODES.has(code) ||
    CONSENT_RESTRICTED_COUNTRIES.has(code)
  ) {
    return "eea";
  }
  return "row";
}

/**
 * Reconcile every geo signal a proxy layer may have attached.
 *
 * Two headers can disagree: on a host that sits behind both layers, one may
 * be platform-verified while the other is client-supplied, and a request can
 * carry a forged `cf-ipcountry` alongside a real `x-vercel-ip-country`.
 * Rather than pick a winner and hope, any disagreement resolves to `unknown`,
 * which blocks ads. Agreement (or a single present header) decides.
 */
export function resolveAdRegion(
  ...countries: Array<string | null | undefined>
): AdRegion {
  const present = countries
    .map((country) => (country ?? "").trim().toUpperCase())
    .filter((country) => country.length > 0);
  if (present.length === 0) return "unknown";

  const regions = new Set(present.map(regionForCountry));
  if (regions.size !== 1) return "unknown";
  return [...regions][0] as AdRegion;
}

export function isConsentRestrictedRegion(region: AdRegion): boolean {
  return region !== "row";
}

export type AdGateInput = {
  /** ADS_LAUNCH_GATE, passed explicitly so tests can flip it. */
  gate: boolean;
  client?: string | null;
  slot?: string | null;
  /** Current URL pathname (public form, with or without /fr). */
  pathname: string;
  /** Pathname at the moment the current document was created. */
  bootPathname?: string | null;
  consent: AdConsent;
  region: AdRegion;
};

/**
 * Pure decision function. Order is significant: the gate is checked before
 * anything else, so a configured build with the gate off is provably inert.
 */
export function evaluateAdGate(input: AdGateInput): AdGateDecision {
  if (!input.gate) return { allowed: false, reason: "gate-off" };
  if (!input.client || !input.slot) {
    return { allowed: false, reason: "not-configured" };
  }
  if (!isAdEligiblePath(input.pathname)) {
    return { allowed: false, reason: "page-not-ad-eligible" };
  }
  // A document that started anywhere else has already loaded (or could have
  // loaded) other app code and DOM. Refuse to inject an ad script into it.
  if (!input.bootPathname || !isAdEligiblePath(input.bootPathname)) {
    return { allowed: false, reason: "document-not-ad-eligible" };
  }
  if (input.consent === null) {
    return { allowed: false, reason: "consent-missing" };
  }
  if (input.consent === "denied") {
    return { allowed: false, reason: "consent-denied" };
  }
  if (input.region === "eea") {
    return { allowed: false, reason: "region-restricted" };
  }
  if (input.region !== "row") {
    return { allowed: false, reason: "region-unknown" };
  }
  return { allowed: true, reason: "allowed" };
}
