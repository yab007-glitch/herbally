import { beforeEach, describe, expect, it } from "vitest";
import {
  CONSENT_MODE_DEFAULT_SCRIPT,
  GOOGLE_CMP_HOST,
  consentModeDefault,
  googleCmpLoaderId,
  googleCmpLoaderUrl,
  loadGoogleConsentMessage,
  readGoogleConsent,
  updateConsentMode,
} from "@/lib/ads/cmp";

const CLIENT = "ca-pub-1901058826905247";
const LOADER_ID = "pub-1901058826905247";

function resetCmpGlobals() {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  delete window.googlefc;
  delete window.dataLayer;
  delete window.gtag;
}

describe("googleCmpLoaderId", () => {
  it("converts an AdSense client into a Funding Choices loader id", () => {
    expect(googleCmpLoaderId(CLIENT)).toBe(LOADER_ID);
  });

  it("returns null for anything that is not a ca-pub client", () => {
    for (const value of [
      null,
      undefined,
      "",
      LOADER_ID,
      "pub-1901058826905247",
      "ca-pub-",
      "ca-pub-abc",
      "ca-publisher-1901058826905247",
      "ca-pub-1901058826905247/evil",
    ]) {
      expect(googleCmpLoaderId(value), String(value)).toBeNull();
    }
  });
});

describe("googleCmpLoaderUrl", () => {
  it("builds the documented loader URL", () => {
    expect(googleCmpLoaderUrl(CLIENT)).toBe(
      `${GOOGLE_CMP_HOST}/i/${LOADER_ID}?ers=1`
    );
    expect(GOOGLE_CMP_HOST).toBe("https://fundingchoicesmessages.google.com");
  });

  it("returns null when the client is unusable", () => {
    expect(googleCmpLoaderUrl(null)).toBeNull();
    expect(googleCmpLoaderUrl("nope")).toBeNull();
  });
});

describe("consentModeDefault", () => {
  it("denies every optional signal and keeps security storage granted", () => {
    expect(consentModeDefault()).toEqual({
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      functionality_storage: "denied",
      personalization_storage: "denied",
      security_storage: "granted",
      wait_for_update: 500,
    });
  });
});

describe("CONSENT_MODE_DEFAULT_SCRIPT", () => {
  it("is built from consentModeDefault(), so the two cannot drift", () => {
    expect(CONSENT_MODE_DEFAULT_SCRIPT).toContain(
      JSON.stringify(consentModeDefault())
    );
    expect(CONSENT_MODE_DEFAULT_SCRIPT).toContain("gtag('consent','default',");
  });

  it("defines dataLayer and gtag before pushing the default", () => {
    expect(CONSENT_MODE_DEFAULT_SCRIPT).toContain(
      "window.dataLayer=window.dataLayer||[]"
    );
    expect(CONSENT_MODE_DEFAULT_SCRIPT).toContain("function gtag()");
    // Every ad signal starts denied.
    for (const signal of [
      "ad_storage",
      "ad_user_data",
      "ad_personalization",
      "analytics_storage",
    ]) {
      expect(CONSENT_MODE_DEFAULT_SCRIPT).toContain(`"${signal}":"denied"`);
    }
  });

  it("actually queues the consent default when executed", () => {
    // The body must be self-contained: running it without any prior script
    // still creates dataLayer and records the default call.
    new Function(CONSENT_MODE_DEFAULT_SCRIPT)();

    const layer = window.dataLayer;
    expect(layer).toHaveLength(1);
    const call = layer?.[0] as ArrayLike<unknown>;
    expect(call[0]).toBe("consent");
    expect(call[1]).toBe("default");
    expect(call[2]).toEqual(consentModeDefault());
  });
});

describe("loadGoogleConsentMessage", () => {
  beforeEach(resetCmpGlobals);

  it("injects one async loader and one present-iframe", () => {
    loadGoogleConsentMessage(CLIENT);

    const scripts =
      document.querySelectorAll<HTMLScriptElement>("#googlefc-js");
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe(googleCmpLoaderUrl(CLIENT));
    expect(scripts[0].async).toBe(true);

    const iframes = document.querySelectorAll<HTMLIFrameElement>(
      'iframe[name="googlefcPresent"]'
    );
    expect(iframes).toHaveLength(1);
    expect(iframes[0].style.display).toBe("none");
    expect(window.googlefc?.callbackQueue).toEqual([]);
  });

  it("is idempotent across repeated calls", () => {
    loadGoogleConsentMessage(CLIENT);
    loadGoogleConsentMessage(CLIENT);
    loadGoogleConsentMessage(CLIENT);

    expect(document.querySelectorAll("#googlefc-js")).toHaveLength(1);
    expect(
      document.querySelectorAll('iframe[name="googlefcPresent"]')
    ).toHaveLength(1);
  });

  it("does nothing when the client cannot produce a loader URL", () => {
    loadGoogleConsentMessage(null);
    loadGoogleConsentMessage("not-a-client");

    expect(document.querySelector("#googlefc-js")).toBeNull();
    expect(document.querySelector('iframe[name="googlefcPresent"]')).toBeNull();
  });
});

describe("readGoogleConsent", () => {
  beforeEach(resetCmpGlobals);

  it("grants only when both ad signals are explicitly true", async () => {
    window.googlefc = {
      getConsentData: () => ({
        adStorageAllowed: true,
        adUserDataAllowed: true,
      }),
    };

    await expect(readGoogleConsent(200)).resolves.toBe("granted");
  });

  it("denies when either ad signal is explicitly false", async () => {
    window.googlefc = {
      getConsentData: () => ({
        adStorageAllowed: true,
        adUserDataAllowed: false,
      }),
    };
    await expect(readGoogleConsent(200)).resolves.toBe("denied");

    window.googlefc = {
      getConsentData: () => ({
        adStorageAllowed: false,
        adUserDataAllowed: true,
      }),
    };
    await expect(readGoogleConsent(200)).resolves.toBe("denied");
  });

  it("resolves unknown when the CMP never produces data", async () => {
    await expect(readGoogleConsent(10)).resolves.toBe("unknown");

    window.googlefc = { getConsentData: () => ({}) };
    await expect(readGoogleConsent(10)).resolves.toBe("unknown");
  });

  it("picks up an answer that arrives after the first read", async () => {
    let reads = 0;
    window.googlefc = {
      getConsentData: () => {
        reads += 1;
        return reads > 1
          ? { adStorageAllowed: true, adUserDataAllowed: true }
          : null;
      },
    };

    await expect(readGoogleConsent(500)).resolves.toBe("granted");
  });
});

describe("updateConsentMode", () => {
  beforeEach(resetCmpGlobals);

  it("pushes one consent update carrying the choice", () => {
    updateConsentMode("denied");

    const layer = window.dataLayer;
    expect(layer).toHaveLength(1);
    const call = layer?.[0] as ArrayLike<unknown>;
    expect(call[0]).toBe("consent");
    expect(call[1]).toBe("update");
    expect(call[2]).toEqual({
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
    });
  });
});
