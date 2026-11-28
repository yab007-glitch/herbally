import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClinicalAdvisoryBoardCallout } from "../clinical-advisory-board-callout";

vi.mock("@/components/i18n/localized-link", () => ({
  LocalizedLink: ({
    href,
    children,
    ...props
  }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("ClinicalAdvisoryBoardCallout", () => {
  it("renders all three open founding seats and LinkedIn SSO application link in English", () => {
    render(<ClinicalAdvisoryBoardCallout locale="en" />);
    expect(screen.getByText(/0 \/ 3 seats filled/i)).toBeInTheDocument();
    expect(screen.getByText(/Seat A/i)).toBeInTheDocument();
    expect(screen.getByText(/Seat B/i)).toBeInTheDocument();
    expect(screen.getByText(/Seat C/i)).toBeInTheDocument();
    const applyLink = screen.getByRole("link", {
      name: /Apply for a Board Seat/i,
    });
    expect(applyLink).toHaveAttribute(
      "href",
      "/clinical-review?intent=advisory"
    );
    expect(applyLink).toHaveAttribute("rel", "nofollow");
  });

  it("renders compact French variant without repeating the 3-seat grid", () => {
    render(<ClinicalAdvisoryBoardCallout locale="fr" compact />);
    expect(
      screen.getByText(/Comité consultatif clinique · 0 \/ 3 sièges pourvus/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/Seat A/i)).toBeNull();
    expect(
      screen.getByRole("link", { name: /Postuler via LinkedIn SSO/i })
    ).toHaveAttribute("href", "/clinical-review?intent=advisory");
  });
});
