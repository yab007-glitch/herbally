import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

import { SurpriseMeButton } from "./surprise-me-button";

describe("SurpriseMeButton", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("navigates to a random herb-list page within range on click", () => {
    render(<SurpriseMeButton totalHerbs={2700} />);
    fireEvent.click(screen.getByRole("button"));
    expect(pushMock).toHaveBeenCalledTimes(1);
    const url = pushMock.mock.calls[0][0] as string;
    expect(url).toMatch(/^\/herbs\?page=\d+$/);
    const page = Number(new URLSearchParams(url.split("?")[1]).get("page"));
    expect(page).toBeGreaterThanOrEqual(1);
    // 2700 herbs at 20 per page = 135 pages.
    expect(page).toBeLessThanOrEqual(135);
  });

  it("is enabled and not busy before any click", () => {
    render(<SurpriseMeButton totalHerbs={100} />);
    const button = screen.getByRole("button");
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "false");
  });
});
