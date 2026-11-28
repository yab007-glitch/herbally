import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ClinicalEditRequestClient } from "../clinical-edit-request-client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

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

const DEFAULT_TARGET = {
  targetType: "herb" as const,
  herbSlug: "turmeric",
  herbName: "Turmeric",
  drugName: "",
  fieldScope: "evidence_grade" as const,
  surfaceUrl: "/herbs/turmeric",
};

describe("ClinicalEditRequestClient", () => {
  it("renders LinkedIn SSO anchor CTA when configured and signed out", () => {
    render(
      <ClinicalEditRequestClient
        locale="en"
        linkedinConfigured
        session={null}
        authError={null}
        initialTarget={DEFAULT_TARGET}
        initialRequests={[]}
      />
    );
    const link = screen.getByRole("link", {
      name: /Continue with LinkedIn SSO/i,
    });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("/api/auth/linkedin/start?next=")
    );
    expect(
      screen.queryByRole("button", { name: /Submit edit request/i })
    ).toBeNull();
  });

  it("renders graceful setup notice and mailto fallback when unconfigured", () => {
    render(
      <ClinicalEditRequestClient
        locale="en"
        linkedinConfigured={false}
        session={null}
        authError="not_configured"
        initialTarget={DEFAULT_TARGET}
        initialRequests={[]}
      />
    );
    expect(screen.getByText(/Active Review Intake Queue/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "info@herbally.app" })
    ).toBeInTheDocument();
  });

  it("renders structured form and submission history when authenticated via LinkedIn SSO", () => {
    render(
      <ClinicalEditRequestClient
        locale="en"
        linkedinConfigured
        session={{
          name: "Dr. Ada Lovelace",
          email: "ada@clinic.org",
          emailVerified: true,
        }}
        authError={null}
        initialTarget={DEFAULT_TARGET}
        initialRequests={[
          {
            id: "req-1",
            target_type: "herb",
            herb_slug: "turmeric",
            drug_name: null,
            field_scope: "evidence_grade",
            summary: "Scope OA evidence to curcumin extract",
            status: "pending",
            admin_notes: null,
            created_at: "2026-11-26T00:00:00Z",
          },
        ]}
      />
    );
    expect(screen.getByText("Dr. Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText(/Validated via LinkedIn SSO/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Submit edit request/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Scope OA evidence to curcumin extract")
    ).toBeInTheDocument();
  });

  it("preserves intent=signoff in LinkedIn SSO redirect when launched in sign-off mode", () => {
    render(
      <ClinicalEditRequestClient
        locale="en"
        linkedinConfigured
        session={null}
        authError={null}
        initialIntent="signoff"
        initialTarget={{
          targetType: "interaction",
          herbSlug: "st-johns-wort",
          herbName: "St. John's Wort",
          drugName: "Rivaroxaban",
          fieldScope: "drug_interaction",
          surfaceUrl: "/interactions/st-johns-wort/rivaroxaban",
        }}
        initialRequests={[]}
      />
    );
    const link = screen.getByRole("link", {
      name: /Continue with LinkedIn SSO/i,
    });
    expect(link.getAttribute("href")).toContain(
      encodeURIComponent("intent=signoff")
    );
    expect(
      screen.getByText(/pre-filled clinician sign-off form/i)
    ).toBeInTheDocument();
  });

  it("prefills clinician sign-off defaults, expands credentials, and toggles cleanly with edit mode", () => {
    render(
      <ClinicalEditRequestClient
        locale="en"
        linkedinConfigured
        session={{
          name: "Dr. Ada Lovelace",
          email: "ada@clinic.org",
          emailVerified: true,
        }}
        authError={null}
        initialIntent="signoff"
        initialTarget={{
          targetType: "interaction",
          herbSlug: "st-johns-wort",
          herbName: "St. John's Wort",
          drugName: "Rivaroxaban",
          fieldScope: "drug_interaction",
          surfaceUrl: "/interactions/st-johns-wort/rivaroxaban",
        }}
        initialRequests={[]}
      />
    );

    expect(
      screen.getByRole("button", { name: /Submit clinical sign-off/i })
    ).toBeInTheDocument();
    expect(
      (screen.getByLabelText(/Role or background/i) as HTMLSelectElement).value
    ).toBe("pharmacist");
    expect(
      (screen.getByLabelText(/Concise change summary/i) as HTMLInputElement)
        .value
    ).toContain("Clinical sign-off: St. John's Wort + Rivaroxaban");
    expect(
      (screen.getByLabelText(/Proposed edit/i) as HTMLTextAreaElement).value
    ).toContain("St. John's Wort + Rivaroxaban");

    fireEvent.click(
      screen.getByRole("button", { name: /Suggest an Edit or Correction/i })
    );
    expect(
      screen.getByRole("button", { name: /Submit edit request/i })
    ).toBeInTheDocument();
  });

  it("supports Clinical Advisory Board application mode (intent=advisory)", () => {
    render(
      <ClinicalEditRequestClient
        locale="en"
        linkedinConfigured
        session={{
          name: "Dr. Ada Lovelace",
          email: "ada@clinic.org",
          emailVerified: true,
        }}
        authError={null}
        initialIntent="advisory"
        initialTarget={DEFAULT_TARGET}
        initialRequests={[]}
      />
    );
    expect(
      screen.getByRole("button", { name: /Submit Advisory Board application/i })
    ).toBeInTheDocument();
    expect(
      (screen.getByLabelText(/Concise change summary/i) as HTMLInputElement)
        .value
    ).toContain("Founding Clinical Advisory Board Application");
  });
});
