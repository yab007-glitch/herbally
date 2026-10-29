import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { AdConsent } from "../ad-consent";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/components/i18n/localized-link", () => ({
  LocalizedLink: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

/** Production shape: the launch gate is closed. Nothing may render or fetch. */
describe("AdConsent — launch gate off (production)", () => {
  beforeEach(() => {
    document.cookie = "herbally-ads-consent=; Max-Age=0; Path=/";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders nothing and makes no region request", async () => {
    const { container } = render(<AdConsent />);
    await Promise.resolve();

    expect(container).toBeEmptyDOMElement();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stays hidden even when a stored choice exists", () => {
    document.cookie = "herbally-ads-consent=v1:granted; Path=/";
    const { container } = render(<AdConsent />);

    expect(container).toBeEmptyDOMElement();
    expect(fetch).not.toHaveBeenCalled();
  });
});
