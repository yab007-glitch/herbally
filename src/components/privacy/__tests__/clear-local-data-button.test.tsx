import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

import { ClearLocalDataButton } from "../clear-local-data-button";

describe("ClearLocalDataButton", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("removes HerbAlly keys from both localStorage and sessionStorage", () => {
    window.localStorage.setItem("herbally-garden", '["ginger"]');
    window.localStorage.setItem("herbally-recent-searches", '["turmeric"]');
    window.localStorage.setItem("herbally-chat-session-id", "abc-123");
    window.localStorage.setItem("herbally-viewed-ginger", "2026-11-20");
    window.localStorage.setItem("unrelated-key", "keep-me");
    window.sessionStorage.setItem(
      "herbally-my-stack-v1",
      JSON.stringify({ herbs: ["Ginger"], drugs: ["Warfarin"] })
    );

    render(<ClearLocalDataButton />);

    fireEvent.click(screen.getByRole("button", { name: "clearButton" }));

    expect(window.localStorage.getItem("herbally-garden")).toBeNull();
    expect(window.localStorage.getItem("herbally-recent-searches")).toBeNull();
    expect(window.localStorage.getItem("herbally-chat-session-id")).toBeNull();
    expect(window.localStorage.getItem("herbally-viewed-ginger")).toBeNull();
    expect(window.localStorage.getItem("unrelated-key")).toBe("keep-me");
    expect(window.sessionStorage.getItem("herbally-my-stack-v1")).toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
