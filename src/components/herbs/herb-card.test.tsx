import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

vi.mock("next/link", () => ({
  default: ({
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

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
vi.mock("@/components/herbs/HerbImage", () => ({
  HerbImage: () => <span data-testid="herb-image" />,
}));
vi.mock("@/components/herbs/evidence-grade", () => ({
  EvidenceGradeBadge: () => null,
}));
vi.mock("@/components/herbs/provenance-badge", () => ({
  ProvenanceBadge: () => null,
}));

// The garden helpers POST to the server in the background.
vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue(new Response("{}", { status: 200 }))
);

import { HerbCard } from "./herb-card";
import { isInGarden } from "@/lib/garden/local-garden";

const herb = {
  id: "h1",
  name: "Ginger",
  scientific_name: "Zingiber officinale",
  slug: "ginger",
  description: "Warming root",
  pregnancy_safe: null,
  nursing_safe: null,
};

beforeEach(() => {
  localStorage.clear();
});

describe("HerbCard garden toggle", () => {
  it("reads and toggles the saved state through the external store", () => {
    // Guards the external-store read (useSyncExternalStore) that replaced the
    // mount effect rejected by react-hooks/set-state-in-effect.
    const { unmount } = render(<HerbCard herb={herb} />);

    const saveButton = screen.getByRole("button", { name: "garden.save" });
    expect(saveButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(saveButton);

    // The store emits, so the same mounted card flips without a manual setState.
    const removeButton = screen.getByRole("button", { name: "garden.remove" });
    expect(removeButton).toHaveAttribute("aria-pressed", "true");
    expect(isInGarden("ginger")).toBe(true);

    unmount();

    // A fresh mount picks the saved state up immediately.
    render(<HerbCard herb={herb} />);
    expect(
      screen.getByRole("button", { name: "garden.remove" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("removes the herb when the saved heart is clicked again", () => {
    render(<HerbCard herb={herb} />);
    fireEvent.click(screen.getByRole("button", { name: "garden.save" }));
    fireEvent.click(screen.getByRole("button", { name: "garden.remove" }));

    expect(screen.getByRole("button", { name: "garden.save" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(isInGarden("ginger")).toBe(false);
  });

  it("keeps two cards for the same herb in sync", () => {
    // Only the external-store subscription makes this possible: with the old
    // per-card useState the second card kept showing "save" after the first
    // was clicked, so the list contradicted itself.
    render(
      <>
        <HerbCard herb={herb} />
        <HerbCard herb={herb} />
      </>
    );

    const saveButtons = screen.getAllByRole("button", { name: "garden.save" });
    expect(saveButtons).toHaveLength(2);

    fireEvent.click(saveButtons[0]);

    expect(
      screen.getAllByRole("button", { name: "garden.remove" })
    ).toHaveLength(2);
    expect(
      screen.queryAllByRole("button", { name: "garden.save" })
    ).toHaveLength(0);
  });
});
