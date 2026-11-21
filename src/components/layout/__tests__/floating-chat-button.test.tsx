import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { FloatingChatButton } from "../floating-chat-button";

const nav = vi.hoisted(() => ({ pathname: "/", push: vi.fn() }));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push }),
}));

const TEASER = "herbalistPage.greeting.bubbleText";

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function scrollPastHero() {
  Object.defineProperty(window, "scrollY", { value: 260, configurable: true });
  fireEvent.scroll(window);
  advance(600);
}

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

describe("FloatingChatButton — teaser", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    nav.pathname = "/";
    window.localStorage.clear();
    window.sessionStorage.clear();
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not overlap hero at scrollY=0, and greets after scrolling past hero", () => {
    render(<FloatingChatButton />);

    advance(10_000);
    expect(screen.queryByText(TEASER)).toBeNull();

    scrollPastHero();
    expect(screen.getByText(TEASER)).toBeTruthy();
  });

  it("stays silent on interior pages", () => {
    nav.pathname = "/herbs";
    render(<FloatingChatButton />);

    scrollPastHero();
    advance(10_000);
    expect(screen.queryByText(TEASER)).toBeNull();
  });

  it("does not greet twice in one visit", () => {
    const first = render(<FloatingChatButton />);
    scrollPastHero();
    expect(screen.getByText(TEASER)).toBeTruthy();
    first.unmount();

    render(<FloatingChatButton />);
    scrollPastHero();
    advance(10_000);
    expect(screen.queryByText(TEASER)).toBeNull();
  });

  it("goes quiet for a day once dismissed", () => {
    const first = render(<FloatingChatButton />);
    scrollPastHero();
    fireEvent.click(
      screen.getAllByText("herbalistPage.greeting.bubbleDismiss")[0]
    );
    first.unmount();

    expect(
      window.localStorage.getItem("herbally.chat.teaser.dismissedAt")
    ).not.toBeNull();

    render(<FloatingChatButton />);
    scrollPastHero();
    advance(10_000);
    expect(screen.queryByText(TEASER)).toBeNull();
  });

  it("opens the chat from the bubble instead of navigating away", () => {
    render(<FloatingChatButton />);
    scrollPastHero();

    fireEvent.click(screen.getByText("herbalistPage.greeting.bubbleOpen"));

    expect(screen.getByText("herbalistPage.title")).toBeTruthy();
    expect(screen.queryByText(TEASER)).toBeNull();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("stops showing the bubble if nobody engages", () => {
    render(<FloatingChatButton />);
    scrollPastHero();
    expect(screen.getByText(TEASER)).toBeTruthy();

    advance(15_000);
    expect(screen.queryByText(TEASER)).toBeNull();
  });
});
