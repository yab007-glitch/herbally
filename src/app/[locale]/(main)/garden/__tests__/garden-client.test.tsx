import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const { getGardenMock, mergeServerGardenMock } = vi.hoisted(() => ({
  getGardenMock: vi.fn(),
  mergeServerGardenMock: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));

vi.mock("@/components/i18n/localized-link", () => ({
  LocalizedLink: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/herbs/HerbImage", () => ({
  HerbImage: ({ name }: { name: string }) => <div>{name}</div>,
}));

vi.mock("@/lib/garden/local-garden", () => ({
  getGarden: getGardenMock,
  removeFromGarden: vi.fn(() => []),
  mergeServerGarden: mergeServerGardenMock,
}));

vi.mock("@/lib/garden/streaks", () => ({
  recordVisit: () => ({ current: 1, longest: 1 }),
  getExploredCount: () => 2,
}));

import { GardenClient } from "../garden-client";

describe("GardenClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates displayed herbs after mergeServerGarden even when merged length equals local length", async () => {
    getGardenMock.mockReturnValue([
      {
        slug: "chamomile",
        name: "Chamomile",
        scientific_name: "Matricaria chamomilla",
        savedAt: "2026-11-20T00:00:00.000Z",
      },
    ]);
    mergeServerGardenMock.mockResolvedValueOnce([
      {
        slug: "turmeric",
        name: "Turmeric",
        scientific_name: "Curcuma longa",
        savedAt: "2026-11-24T00:00:00.000Z",
      },
    ]);

    render(<GardenClient />);

    await waitFor(() => {
      expect(screen.getByText("Curcuma longa")).toBeInTheDocument();
    });
    expect(screen.queryByText("Matricaria chamomilla")).not.toBeInTheDocument();

    const removeBtn = screen.getByRole("button", {
      name: /garden\.remove Turmeric/i,
    });
    expect(removeBtn).toHaveAttribute("type", "button");
  });

  it("renders empty state heading as h2 with crawlable links", async () => {
    getGardenMock.mockReturnValue([]);
    mergeServerGardenMock.mockResolvedValueOnce([]);

    render(<GardenClient />);

    const heading = await screen.findByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("garden.emptyTitle");
    expect(
      screen.getByRole("link", { name: /garden\.exploreHerbs/i })
    ).toHaveAttribute("href", "/herbs");
  });
});
