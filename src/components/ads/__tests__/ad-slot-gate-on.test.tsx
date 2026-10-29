import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AdSlot } from "../ad-slot";
import { __setAdDocumentStateForTests } from "@/lib/ads/document-state";
import { __resetAdRegionForTests } from "@/lib/ads/region-client";
import { AD_CONSENT_EVENT } from "@/lib/ads/policy";

const nav = vi.hoisted(() => ({ pathname: "/herbs/ginger" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

/**
 * What would happen if the owner flipped the gate. The gate is mocked True
 * here only so the downstream guards can be exercised; production value is
 * asserted as `false` in policy.test.ts and ad-slot.test.tsx.
 */
vi.mock("@/lib/ads/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ads/policy")>();
  return { ...actual, ADS_LAUNCH_GATE: true };
});

const CLIENT = "ca-pub-1901058826905247";

function stubLocation() {
  const reload = vi.fn();
  Object.defineProperty(window, "location", {
    value: {
      href: "https://herbally.app/herbs/ginger",
      pathname: "/herbs/ginger",
      protocol: "https:",
      reload,
    },
    writable: true,
    configurable: true,
  });
  return reload;
}

function stubRegion(region: "row" | "eea" | "unknown") {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ region }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function scriptElements() {
  return document.querySelectorAll('script[src*="googlesyndication"]');
}

async function waitForProviderScript() {
  // The <script> is created in the effect that also marks the document as
  // ad-bearing; assert on it directly instead of on the <ins>, which can be
  // observed a microtask before the effect runs.
  await waitFor(() => expect(scriptElements()).toHaveLength(1));
}

function grantConsent() {
  document.cookie = "herbally-ads-consent=v1:granted; Path=/";
}

function denyConsent() {
  document.cookie = "herbally-ads-consent=v1:denied; Path=/";
}

describe("AdSlot — launch gate on", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", CLIENT);
    delete (window as { adsbygoogle?: unknown }).adsbygoogle;
    document.head.innerHTML = "";
    document.cookie = "herbally-ads-consent=; Max-Age=0; Path=/";
    window.sessionStorage.clear();
    __resetAdRegionForTests();
    nav.pathname = "/herbs/ginger";
    __setAdDocumentStateForTests({
      bootPathname: "/herbs/ginger",
      adScriptActive: false,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    document.cookie = "herbally-ads-consent=; Max-Age=0; Path=/";
    __setAdDocumentStateForTests({
      bootPathname: null,
      adScriptActive: false,
    });
  });

  it("makes no request before an explicit opt-in", async () => {
    const fetchMock = stubRegion("row");
    const { container } = render(<AdSlot slot="1234567890" />);
    await Promise.resolve();

    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      document.querySelector('script[src*="googlesyndication"]')
    ).toBeNull();
  });

  it("makes no request after an explicit reject", async () => {
    denyConsent();
    const fetchMock = stubRegion("row");
    const { container } = render(<AdSlot slot="1234567890" />);
    await Promise.resolve();

    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      document.querySelector('script[src*="googlesyndication"]')
    ).toBeNull();
  });

  it("loads one labelled provider script after opt-in in a known region", async () => {
    grantConsent();
    stubRegion("row");
    const { container } = render(<AdSlot slot="1234567890" />);

    await waitForProviderScript();
    await waitFor(() => {
      expect(container.querySelector("ins.adsbygoogle")).not.toBeNull();
    });

    const scripts = scriptElements();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].getAttribute("src")).toContain(CLIENT);

    const ins = container.querySelector("ins.adsbygoogle");
    expect(ins?.getAttribute("data-ad-client")).toBe(CLIENT);
    expect(ins?.getAttribute("data-ad-slot")).toBe("1234567890");
    expect(screen.getByText("Advertisements")).toBeInTheDocument();
    expect(window.adsbygoogle?.requestNonPersonalizedAds).toBe(1);
    expect(window.adsbygoogle).toHaveLength(1);
  });

  it("never injects into a document that was born on a health tool", async () => {
    // Client-side navigation /herbalist → /herbs/ginger. The DOM already ran
    // tool code, so the ad must not appear until a real document load.
    grantConsent();
    stubRegion("row");
    __setAdDocumentStateForTests({ bootPathname: "/herbalist" });

    const { container } = render(<AdSlot slot="1234567890" />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    expect(container).toBeEmptyDOMElement();
    expect(
      document.querySelector('script[src*="googlesyndication"]')
    ).toBeNull();
    expect(window.adsbygoogle).toBeUndefined();
  });

  it("never injects on a non-ad-eligible page", async () => {
    grantConsent();
    stubRegion("row");
    nav.pathname = "/herbalist";
    __setAdDocumentStateForTests({ bootPathname: "/herbalist" });

    const { container } = render(<AdSlot slot="1234567890" />);
    await Promise.resolve();

    expect(container).toBeEmptyDOMElement();
    expect(
      document.querySelector('script[src*="googlesyndication"]')
    ).toBeNull();
  });

  it("blocks ads in an EEA/UK/CH region even with consent", async () => {
    grantConsent();
    stubRegion("eea");
    const { container } = render(<AdSlot slot="1234567890" />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(
      document.querySelector('script[src*="googlesyndication"]')
    ).toBeNull();
  });

  it("blocks ads when the region cannot be established", async () => {
    grantConsent();
    stubRegion("unknown");
    const { container } = render(<AdSlot slot="1234567890" />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("reloads the document when consent is revoked after the script loaded", async () => {
    grantConsent();
    stubRegion("row");
    const reload = stubLocation();

    const { container } = render(<AdSlot slot="1234567890" />);
    await waitForProviderScript();

    denyConsent();
    window.dispatchEvent(new CustomEvent(AD_CONSENT_EVENT));

    await waitFor(() => expect(reload).toHaveBeenCalled());
    // Markup is gone too, but the reload is what actually unloads the script.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("does not reload on revoke when no script had loaded", async () => {
    denyConsent();
    stubRegion("row");
    const reload = stubLocation();

    render(<AdSlot slot="1234567890" />);
    window.dispatchEvent(new CustomEvent(AD_CONSENT_EVENT));
    await Promise.resolve();

    expect(reload).not.toHaveBeenCalled();
  });
});
