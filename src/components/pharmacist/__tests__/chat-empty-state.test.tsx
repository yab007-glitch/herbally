import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatEmptyStateV2 } from "../chat-empty-state-v2";

// Passthrough translator: assertions target keys, not copy that may change.
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

describe("ChatEmptyStateV2", () => {
  it("opens with the greeting and one question", () => {
    render(<ChatEmptyStateV2 onSendMessage={vi.fn()} />);

    expect(screen.getByText("herbalistPage.greeting.intro")).toBeTruthy();
    expect(screen.getByText("herbalistPage.greeting.question")).toBeTruthy();
  });

  it("offers three ways in, each sending its own localized prompt", () => {
    const onSendMessage = vi.fn();
    render(<ChatEmptyStateV2 onSendMessage={onSendMessage} />);

    fireEvent.click(screen.getByText("herbalistPage.greeting.quickCheckHerb"));
    expect(onSendMessage).toHaveBeenCalledWith(
      "herbalistPage.greeting.quickCheckHerbPrompt"
    );

    fireEvent.click(
      screen.getByText("herbalistPage.greeting.quickInteractions")
    );
    expect(onSendMessage).toHaveBeenCalledWith(
      "herbalistPage.greeting.quickInteractionsPrompt"
    );

    fireEvent.click(
      screen.getByText("herbalistPage.greeting.quickCapabilities")
    );
    expect(onSendMessage).toHaveBeenCalledWith(
      "herbalistPage.greeting.quickCapabilitiesPrompt"
    );

    expect(onSendMessage).toHaveBeenCalledTimes(3);
  });

  it("keeps the catalogue and calculator links as escape hatches", () => {
    render(<ChatEmptyStateV2 onSendMessage={vi.fn()} />);

    expect(
      screen
        .getByText("herbalistPage.browseHerbs")
        .closest("a")
        ?.getAttribute("href")
    ).toBe("/herbs");
    expect(
      screen.getByText("nav.calculator").closest("a")?.getAttribute("href")
    ).toBe("/calculator");
  });
});
