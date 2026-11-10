import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdSlot } from "../ad-slot";
import { __setAdDocumentStateForTests } from "@/lib/ads/document-state";

const nav = vi.hoisted(() => ({ pathname: "/herbs/ginger" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
}));

/**
 * Production shape: the hard launch gate is closed. These are the tests that
 * describe what real visitors get today, so they run against the unmocked
 * policy module on purpose.
 */
describe("AdSlot — launch gate off (production)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    delete (window as { adsbygoogle?: unknown }).adsbygoogle;
    document.head.innerHTML = "";
    document.cookie = "herbally-ads-consent=; Max-Age=0; Path=/";
    nav.pathname = "/herbs/ginger";
    __setAdDocumentStateForTests({
      bootPathname: "/herbs/ginger",
      adScriptActive: false,
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("renders nothing when the publisher client is not configured", () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "");
    const { container } = render(<AdSlot slot="1234567890" />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByLabelText("Advertisements")).not.toBeInTheDocument();
  });

  it("renders nothing when no ad-unit slot is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-1901058826905247");
    const { container } = render(<AdSlot slot="" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("fails closed even if both ad identifiers are configured", () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-1901058826905247");
    const { container } = render(<AdSlot slot="1234567890" />);

    expect(container).toBeEmptyDOMElement();
    expect(
      document.querySelector('script[src*="googlesyndication"]')
    ).toBeNull();
    expect(window.adsbygoogle).toBeUndefined();
  });

  it("makes no request at all, not even the region lookup", async () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-1901058826905247");
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_SLOT_HERB", "1234567890");
    render(<AdSlot slot="1234567890" />);
    await Promise.resolve();

    expect(fetch).not.toHaveBeenCalled();
  });

  it("stays inert on a non-ad page with identifiers and consent present", () => {
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT", "ca-pub-1901058826905247");
    document.cookie = "herbally-ads-consent=v1:granted; Path=/";
    nav.pathname = "/herbalist";

    const { container } = render(<AdSlot slot="1234567890" />);

    expect(container).toBeEmptyDOMElement();
    expect(
      document.querySelector('script[src*="googlesyndication"]')
    ).toBeNull();
  });
});
