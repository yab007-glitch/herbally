import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { FloatingChatButton } from "../floating-chat-button";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

const push = vi.fn();
let pathname = "/";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

const TEASER = "herbalistPage.greeting.bubbleText";

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("FloatingChatButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    pathname = "/";
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits before speaking, then greets the visitor on the homepage", () => {
    render(<FloatingChatButton />);

    expect(screen.queryByText(TEASER)).toBeNull();

    advance(2_500);
    expect(screen.getByText(TEASER)).toBeTruthy();
  });

  it("stays silent on interior pages", () => {
    pathname = "/herbs";
    render(<FloatingChatButton />);

    advance(10_000);
    expect(screen.queryByText(TEASER)).toBeNull();
  });

  it("does not greet twice in one visit", () => {
    const first = render(<FloatingChatButton />);
    advance(2_500);
    first.unmount();

    render(<FloatingChatButton />);
    advance(10_000);
    expect(screen.queryByText(TEASER)).toBeNull();
  });

  it("goes quiet for a week once dismissed", () => {
    const first = render(<FloatingChatButton />);
    advance(2_500);
    fireEvent.click(
      screen.getAllByText("herbalistPage.greeting.bubbleDismiss")[0]
    );
    first.unmount();

    expect(
      window.localStorage.getItem("herbally.chat.teaser.dismissedAt")
    ).not.toBeNull();

    render(<FloatingChatButton />);
    advance(10_000);
    expect(screen.queryByText(TEASER)).toBeNull();
  });

  it("opens the chat from the bubble instead of navigating away", () => {
    render(<FloatingChatButton />);
    advance(2_500);

    fireEvent.click(screen.getByText("herbalistPage.greeting.bubbleOpen"));

    expect(screen.getByText("herbalistPage.title")).toBeTruthy();
    expect(screen.queryByText(TEASER)).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("stops showing the bubble if nobody engages", () => {
    render(<FloatingChatButton />);
    advance(2_500);
    expect(screen.getByText(TEASER)).toBeTruthy();

    advance(15_000);
    expect(screen.queryByText(TEASER)).toBeNull();
  });
});
