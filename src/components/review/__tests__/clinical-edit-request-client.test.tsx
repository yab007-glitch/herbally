import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
