import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  ClinicianSignOffBanner,
  buildSignOffHref,
} from "../clinician-signoff-banner";

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

describe("ClinicianSignOffBanner", () => {
  it("builds prefilled intent=signoff URLs for interaction, herb, medication, and general targets", () => {
    expect(
      buildSignOffHref({
        targetType: "interaction",
        herbSlug: "st-johns-wort",
        drugName: "Rivaroxaban (Xarelto)",
      })
    ).toBe(
      "/clinical-review?intent=signoff&targetType=interaction&slug=st-johns-wort&drug=Rivaroxaban+%28Xarelto%29"
    );

    expect(
      buildSignOffHref({
        targetType: "herb",
        herbSlug: "turmeric",
      })
    ).toBe("/clinical-review?intent=signoff&targetType=herb&slug=turmeric");

    expect(
      buildSignOffHref({
        targetType: "medication",
        drugName: "Warfarin (Coumadin)",
      })
    ).toBe(
      "/clinical-review?intent=signoff&targetType=medication&drug=Warfarin+%28Coumadin%29"
    );

    expect(buildSignOffHref({})).toBe("/clinical-review?intent=signoff");
  });

  it("renders English record-specific sign-off CTA and priority queue link", () => {
    render(
      <ClinicianSignOffBanner
        locale="en"
        targetType="interaction"
        herbSlug="st-johns-wort"
        drugName="Rivaroxaban (Xarelto)"
        recordTitle="St. John's Wort + Rivaroxaban (Xarelto)"
      />
    );

    expect(
      screen.getByText(/Pharmacist, physician, or toxicologist\?/i)
    ).toBeInTheDocument();
    const cta = screen.getByRole("link", {
      name: /Sign off this record \(LinkedIn SSO\)/i,
    });
    expect(cta).toHaveAttribute(
      "href",
      expect.stringContaining("intent=signoff&targetType=interaction")
    );
    expect(cta).toHaveAttribute("rel", "nofollow");
    expect(
      screen.getByRole("link", { name: /Browse priority review queue/i })
    ).toHaveAttribute("href", "/clinical-review?intent=signoff#priority-queue");
  });

  it("renders French localized copy and unreviewed interaction count for medications", () => {
    render(
      <ClinicianSignOffBanner
        locale="fr"
        targetType="medication"
        drugName="Warfarin"
        recordTitle="Warfarine"
        unreviewedCount={12}
      />
    );

    expect(
      screen.getByText(/Validez cliniquement « Warfarine »/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/12 interactions associées à Warfarine/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Signer cette fiche \(SSO LinkedIn\)/i })
    ).toBeInTheDocument();
  });
});
