import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
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

import { SuggestHerbEditSheet } from "../suggest-herb-edit-sheet";

describe("SuggestHerbEditSheet", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/herbs/ginger");
  });

  it("renders Suggest an edit trigger button and opens LinkedIn SSO flow targeting the current herb", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          configured: true,
          authenticated: false,
          reviewer: null,
        }),
        { status: 200 }
      )
    );

    render(<SuggestHerbEditSheet herbSlug="ginger" herbName="Ginger" />);

    const trigger = screen.getByRole("button", { name: /Suggest an edit/i });
    expect(trigger).toBeInTheDocument();

    fireEvent.click(trigger);

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /Continue with LinkedIn SSO/i })
      ).toHaveAttribute(
        "href",
        "/api/auth/linkedin/start?next=%2Fherbs%2Fginger%3FsuggestEdit%3D1"
      );
    });
  });

  it("renders signed-in herb suggestion form when LinkedIn session is active", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            configured: true,
            authenticated: true,
            reviewer: {
              name: "Alex Taylor",
              email: "alex@example.org",
              emailVerified: true,
            },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authenticated: true,
            requests: [],
          }),
          { status: 200 }
        )
      );

    render(<SuggestHerbEditSheet herbSlug="ginger" herbName="Ginger" />);
    fireEvent.click(screen.getByRole("button", { name: /Suggest an edit/i }));

    await waitFor(() => {
      expect(screen.getByText("Alex Taylor")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Submit edit suggestion/i })
      ).toBeInTheDocument();
    });
  });
});
