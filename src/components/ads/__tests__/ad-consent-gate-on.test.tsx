import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdConsent } from "../ad-consent";
import { __resetAdRegionForTests } from "@/lib/ads/region-client";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/i18n/localized-link", () => ({
  LocalizedLink: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/ads/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ads/policy")>();
  return { ...actual, ADS_LAUNCH_GATE: true };
});

function stubRegion(region: "row" | "eea" | "unknown") {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ region }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function readConsentCookie(): string | null {
  const match = document.cookie.match(/herbally-ads-consent=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

describe("AdConsent — launch gate on", () => {
  beforeEach(() => {
    document.cookie = "herbally-ads-consent=; Max-Age=0; Path=/";
    __resetAdRegionForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = "herbally-ads-consent=; Max-Age=0; Path=/";
  });

  it("offers an explicit allow / reject choice before any ad request", async () => {
    stubRegion("row");
    render(<AdConsent />);

    expect(await screen.findByText("consentTitle")).toBeInTheDocument();
    expect(screen.getByText("consentBody")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "allow" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "reject" })).toBeInTheDocument();
    // Only the same-origin region lookup happened.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/ads/region",
      expect.objectContaining({ credentials: "same-origin" })
    );
  });

  it("records a reject and does not reload the page", async () => {
    stubRegion("row");
    const reload = vi.fn();
    render(<AdConsent reload={reload} />);

    fireEvent.click(await screen.findByRole("button", { name: "reject" }));

    expect(readConsentCookie()).toBe("v1:denied");
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "settings" })).toBeInTheDocument();
  });

  it("records an allow and closes without reloading", async () => {
    stubRegion("row");
    const reload = vi.fn();
    render(<AdConsent reload={reload} />);

    fireEvent.click(await screen.findByRole("button", { name: "allow" }));

    expect(readConsentCookie()).toBe("v1:granted");
    expect(reload).not.toHaveBeenCalled();
  });

  it("lets the reader reopen the choice and revoke a previous grant", async () => {
    document.cookie = "herbally-ads-consent=v1:granted; Path=/";
    stubRegion("row");
    const reload = vi.fn();
    render(<AdConsent reload={reload} />);

    fireEvent.click(await screen.findByRole("button", { name: "settings" }));
    expect(screen.getByText("statusOn")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "revoke" }));

    expect(readConsentCookie()).toBe("v1:denied");
    // A live provider script cannot be unloaded by unmounting markup.
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("offers nothing in a restricted region, not even a banner", async () => {
    const fetchMock = stubRegion("eea");
    const { container } = render(<AdConsent />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("offers nothing when the region is unknown", async () => {
    const fetchMock = stubRegion("unknown");
    const { container } = render(<AdConsent />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("survives a failed region lookup by offering nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );
    const { container } = render(<AdConsent />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
