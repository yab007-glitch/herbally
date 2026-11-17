/**
 * Google consent message (Funding Choices) — the CMP for EEA/UK/CH.
 *
 * Google requires a Google-certified consent management platform before ads
 * may be served to readers in the EEA, the UK and Switzerland. Funding Choices
 * is that CMP: it renders the message, records the reader's choice, and
 * exposes the result through `window.googlefc`. Consent Mode v2 signals carry
 * the same decision to every Google tag.
 *
 * This module is client-safe and has no import-time side effects: nothing here
 * touches `window` until a function is called, and every function degrades to
 * a no-op (or `unknown`) during SSR.
 *
 * The loader is not created here by default — `AdCmp` calls
 * `loadGoogleConsentMessage` on ad-eligible pages, and the inline default
 * consent script is rendered by `CmpBootstrap`. Until the CMP answers,
 * `readGoogleConsent` stays `unknown`, which blocks ads.
 */

import type { GoogleCmpConsent } from "./policy";

/** Funding Choices' script origin. Listed in AD_PROVIDER_HOSTS for the CSP. */
export const GOOGLE_CMP_HOST = "https://fundingchoicesmessages.google.com";

const LOADER_SCRIPT_ID = "googlefc-js";
const PRESENT_IFRAME_NAME = "googlefcPresent";
const CONSENT_POLL_INTERVAL_MS = 50;
const CONSENT_READ_TIMEOUT_MS = 1500;

/**
 * AdSense publisher id (`ca-pub-…`) → Funding Choices loader id (`pub-…`).
 * Any other shape returns `null`: a malformed or absent client must not
 * produce a loader URL that silently points somewhere unintended.
 */
export function googleCmpLoaderId(
  client: string | null | undefined
): string | null {
  const match = /^ca-(pub-\d+)$/.exec((client ?? "").trim());
  return match ? match[1] : null;
}

/** The Funding Choices loader URL, or `null` when the client is unusable. */
export function googleCmpLoaderUrl(
  client: string | null | undefined
): string | null {
  const loaderId = googleCmpLoaderId(client);
  if (!loaderId) return null;
  return `${GOOGLE_CMP_HOST}/i/${loaderId}?ers=1`;
}

/** A Consent Mode v2 signal value. */
export type ConsentModeChoice = "granted" | "denied";

/**
 * Consent Mode v2 default state.
 *
 * Everything optional starts denied; only `security_storage` (strictly
 * functional, e.g. security cookies) is granted. `wait_for_update` gives the
 * CMP 500 ms to answer before tags fire, so a consent message is not raced by
 * a measurement hit.
 */
export type ConsentModeDefault = {
  ad_storage: ConsentModeChoice;
  ad_user_data: ConsentModeChoice;
  ad_personalization: ConsentModeChoice;
  analytics_storage: ConsentModeChoice;
  functionality_storage: ConsentModeChoice;
  personalization_storage: ConsentModeChoice;
  security_storage: "granted";
  wait_for_update: number;
};

export function consentModeDefault(): ConsentModeDefault {
  return {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    functionality_storage: "denied",
    personalization_storage: "denied",
    security_storage: "granted",
    wait_for_update: 500,
  };
}

/**
 * Inline script body that establishes `dataLayer`/`gtag` and pushes the default
 * consent state. Rendered by `CmpBootstrap` before any Google tag can run.
 *
 * Built from `consentModeDefault()` rather than a second literal so the script
 * and the exported object can never disagree.
 */
export const CONSENT_MODE_DEFAULT_SCRIPT = `window.dataLayer=window.dataLayer||[];function gtag(){window.dataLayer.push(arguments);}gtag('consent','default',${JSON.stringify(
  consentModeDefault()
)});`;

type GooglefcConsentData = {
  adStorageAllowed?: boolean;
  adUserDataAllowed?: boolean;
  adPersonalizationAllowed?: boolean;
  analyticsStorageAllowed?: boolean;
};

type GooglefcApi = {
  callbackQueue?: unknown[];
  getConsentData?: () => GooglefcConsentData | null;
};

declare global {
  interface Window {
    /** Funding Choices' global API, created before its script loads. */
    googlefc?: GooglefcApi;
    /** Consent Mode command queue, shared with every Google tag. */
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Hidden same-origin-ish frame Funding Choices documents as required. Its
 * presence tells the CMP the page can render its message.
 */
function appendPresentIframe(): void {
  if (document.querySelector(`iframe[name="${PRESENT_IFRAME_NAME}"]`)) return;

  const append = () => {
    if (document.querySelector(`iframe[name="${PRESENT_IFRAME_NAME}"]`)) return;
    const iframe = document.createElement("iframe");
    iframe.name = PRESENT_IFRAME_NAME;
    iframe.style.display = "none";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.zIndex = "-1000";
    iframe.style.left = "-1000px";
    iframe.style.top = "-1000px";
    document.body.appendChild(iframe);
  };

  if (document.body) append();
  else document.addEventListener("DOMContentLoaded", append, { once: true });
}

/**
 * Load the Funding Choices message for this publisher. Idempotent: repeated
 * mounts inject exactly one loader script and one present-iframe.
 */
export function loadGoogleConsentMessage(
  client: string | null | undefined
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const src = googleCmpLoaderUrl(client);
  if (!src) return;

  // Google's snippet defines these before the script so the loader can push
  // its callbacks immediately on execution.
  const googlefc = (window.googlefc = window.googlefc ?? {});
  googlefc.callbackQueue = googlefc.callbackQueue ?? [];

  if (document.getElementById(LOADER_SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = LOADER_SCRIPT_ID;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);

  appendPresentIframe();
}

/**
 * Read the CMP's answer.
 *
 * `getConsentData()` only exists once the message has initialized, so this
 * polls briefly instead of waiting for a callback that may already have fired.
 * Anything short of both ad signals being `true` is not permission:
 * `false` anywhere means denied, and no data before the timeout means
 * `unknown` (which the gate treats as blocked).
 */
export function readGoogleConsent(
  timeoutMs: number = CONSENT_READ_TIMEOUT_MS
): Promise<GoogleCmpConsent> {
  if (typeof window === "undefined") return Promise.resolve("unknown");

  return new Promise<GoogleCmpConsent>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;

    const finish = (value: GoogleCmpConsent) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      if (poll !== null) clearInterval(poll);
      resolve(value);
    };

    const inspect = (): GoogleCmpConsent | null => {
      try {
        const data = window.googlefc?.getConsentData?.();
        if (!data) return null;
        if (data.adStorageAllowed === true && data.adUserDataAllowed === true) {
          return "granted";
        }
        if (
          data.adStorageAllowed === false ||
          data.adUserDataAllowed === false
        ) {
          return "denied";
        }
        return null;
      } catch {
        // A CMP that throws is a CMP that has not answered.
        return null;
      }
    };

    const tick = () => {
      const value = inspect();
      if (value) finish(value);
    };

    tick();
    if (settled) return;

    poll = setInterval(tick, CONSENT_POLL_INTERVAL_MS);
    timer = setTimeout(() => finish("unknown"), Math.max(0, timeoutMs));
  });
}

/**
 * Push a decision into Consent Mode v2. Creates `dataLayer`/`gtag` if the
 * inline default script has not run yet, so an early caller cannot throw.
 */
export function updateConsentMode(choice: ConsentModeChoice): void {
  if (typeof window === "undefined") return;

  const dataLayer = (window.dataLayer = window.dataLayer ?? []);
  if (!window.gtag) {
    window.gtag = (...args: unknown[]) => {
      dataLayer.push(args);
    };
  }

  window.gtag("consent", "update", {
    ad_storage: choice,
    ad_user_data: choice,
    ad_personalization: choice,
    analytics_storage: choice,
  });
}
