import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FloatingChatButton } from "../floating-chat-button";

const nav = vi.hoisted(() => ({ pathname: "/herbs/ginger" }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

/** Production shape: gate closed, so the launcher behaves exactly as before. */
describe("FloatingChatButton — launch gate off (production)", () => {
  it.each(["/herbs/ginger", "/herbalist", "/"])("renders on %s", (pathname) => {
    nav.pathname = pathname;
    render(<FloatingChatButton />);
    expect(
      screen.getByRole("button", { name: "herbalistPage.widgetOpen" })
    ).toBeInTheDocument();
  });
});
