import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

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

  afterEach(() => {
    vi.restoreAllMocks();
    // @ts-expect-error -- cleanup test global
    delete window.caches;
  });

  it("removes all HerbAlly keys including garden notes/removed/synced and Cache Storage", async () => {
    window.localStorage.setItem("herbally-garden", '["ginger"]');
    window.localStorage.setItem(
      "herbally-garden-notes",
      '{"ginger":"morning tea"}'
    );
    window.localStorage.setItem("herbally-garden-removed", '["turmeric"]');
    window.localStorage.setItem("herbally-garden-synced", '["ginger"]');
    window.localStorage.setItem("herbally-recent-searches", '["turmeric"]');
    window.localStorage.setItem("herbally-chat-session-id", "abc-123");
    window.localStorage.setItem("herbally-viewed-ginger", "2026-11-20");
    window.localStorage.setItem("unrelated-key", "keep-me");
    window.sessionStorage.setItem(
      "herbally-my-stack-v1",
      JSON.stringify({ herbs: ["Ginger"], drugs: ["Warfarin"] })
    );
    window.sessionStorage.setItem("herbally-lang-banner-dismissed", "1");
    window.sessionStorage.setItem(
      "herbally:ad-document-guard",
      "1732450000000"
    );
    window.sessionStorage.setItem(
      "herbally:ads-consent-reload",
      "1732450000000"
    );
    window.sessionStorage.setItem("unrelated-session-key", "keep-me");

    const deleteMock = vi.fn().mockResolvedValue(true);
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: {
        keys: vi.fn().mockResolvedValue(["herbally-public-v7"]),
        delete: deleteMock,
      },
    });

    render(<ClearLocalDataButton />);

    fireEvent.click(screen.getByRole("button", { name: "clearButton" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    expect(window.localStorage.getItem("herbally-garden")).toBeNull();
    expect(window.localStorage.getItem("herbally-garden-notes")).toBeNull();
    expect(window.localStorage.getItem("herbally-garden-removed")).toBeNull();
    expect(window.localStorage.getItem("herbally-garden-synced")).toBeNull();
    expect(window.localStorage.getItem("herbally-recent-searches")).toBeNull();
    expect(window.localStorage.getItem("herbally-chat-session-id")).toBeNull();
    expect(window.localStorage.getItem("herbally-viewed-ginger")).toBeNull();
    expect(window.localStorage.getItem("unrelated-key")).toBe("keep-me");
    expect(window.sessionStorage.getItem("herbally-my-stack-v1")).toBeNull();
    expect(
      window.sessionStorage.getItem("herbally-lang-banner-dismissed")
    ).toBeNull();
    expect(
      window.sessionStorage.getItem("herbally:ad-document-guard")
    ).toBeNull();
    expect(
      window.sessionStorage.getItem("herbally:ads-consent-reload")
    ).toBeNull();
    expect(window.sessionStorage.getItem("unrelated-session-key")).toBe(
      "keep-me"
    );
    expect(deleteMock).toHaveBeenCalledWith("herbally-public-v7");
  });

  it("reports an error alert instead of claiming success if Cache Storage deletion fails", async () => {
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: {
        keys: vi.fn().mockResolvedValue(["herbally-public-v7"]),
        delete: vi.fn().mockResolvedValue(false),
      },
    });

    render(<ClearLocalDataButton />);
    fireEvent.click(screen.getByRole("button", { name: "clearButton" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
