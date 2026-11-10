import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FloatingChatButton } from "../floating-chat-button";

const nav = vi.hoisted(() => ({ pathname: "/herbs/ginger" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/ads/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ads/policy")>();
  return { ...actual, ADS_LAUNCH_GATE: true };
});

/**
 * Isolation rule: a document that may carry an ad must not also carry a
 * health-query input. With the gate on, the launcher disappears from every
 * ad-eligible herb page — in both locales — and nowhere else.
 */
describe("FloatingChatButton — launch gate on", () => {
  it.each(["/herbs/ginger", "/fr/herbs/ginger", "/en/herbs/ginger"])(
    "does not render on the ad-eligible page %s",
    (pathname) => {
      nav.pathname = pathname;
      const { container } = render(<FloatingChatButton />);
      expect(container).toBeEmptyDOMElement();
    }
  );

  it.each(["/herbalist", "/calculator", "/", "/herbs", "/privacy"])(
    "still renders on the non-ad page %s",
    (pathname) => {
      nav.pathname = pathname;
      render(<FloatingChatButton />);
      expect(
        screen.getByRole("button", { name: "herbalistPage.widgetOpen" })
      ).toBeInTheDocument();
    }
  );
});
