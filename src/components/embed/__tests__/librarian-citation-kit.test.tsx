import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
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

import { LibrarianCitationKit } from "../librarian-citation-kit";

describe("LibrarianCitationKit", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("switches copyable citation blurb and HTML link between English and French", async () => {
    render(<LibrarianCitationKit />);

    expect(screen.getByText(/Free, ad-free, bilingual/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "Français" }));

    expect(
      screen.getByText(/Outil éducatif gratuit et sans compte/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "copyBlurb" }));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("/fr/herb-drug-interactions")
      );
      expect(screen.getByText("copied")).toBeInTheDocument();
    });
  });
});
