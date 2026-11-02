import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import en from "@/lib/i18n/dictionaries/en.json";
import fr from "@/lib/i18n/dictionaries/fr.json";

const { localeState, buildPageMetadataMock } = vi.hoisted(() => ({
  localeState: { value: "en" as "en" | "fr" },
  buildPageMetadataMock: vi.fn(),
}));

vi.mock("@/lib/i18n/page-locale", () => ({
  getLocale: async () => localeState.value,
}));

vi.mock("@/lib/i18n/metadata", () => ({
  buildPageMetadata: buildPageMetadataMock,
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale }: { locale?: "en" | "fr" } = {}) => {
    const dictionary = locale === "fr" ? fr : en;

    return (key: string) => {
      const value = key
        .split(".")
        .reduce<unknown>(
          (node, segment) =>
            node && typeof node === "object" && segment in node
              ? (node as Record<string, unknown>)[segment]
              : undefined,
          dictionary
        );

      return typeof value === "string" ? value : key;
    };
  },
}));

import SponsorsPage, { generateMetadata } from "./page";

async function renderPage(locale: "en" | "fr") {
  localeState.value = locale;
  const ui = await SponsorsPage();
  return render(ui);
}

describe("Sponsorship page", () => {
  beforeEach(() => {
    localeState.value = "en";
    buildPageMetadataMock.mockReset();
  });

  it("shows the honest empty state and full support policy in English", async () => {
    const { container } = await renderPage("en");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: en.sponsorship.title,
      })
    ).toBeInTheDocument();
    expect(screen.getAllByText(en.sponsorship.status).length).toBeGreaterThan(
      0
    );
    expect(
      screen.getByRole("heading", {
        level: 3,
        name: en.sponsorship.current.emptyTitle,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(en.sponsorship.current.emptyDescription)
    ).toBeInTheDocument();
    expect(
      screen.getByText(en.sponsorship.current.emptyNote)
    ).toBeInTheDocument();

    for (const key of ["hosting", "ai", "database", "domain"] as const) {
      expect(
        screen.getByRole("heading", {
          level: 3,
          name: en.sponsorship.costs.items[key].label,
        })
      ).toBeInTheDocument();
    }

    expect(
      screen.getByText(en.sponsorship.independence.items.medical.description)
    ).toBeInTheDocument();
    expect(
      screen.getByText(en.sponsorship.independence.items.privacy.description)
    ).toBeInTheDocument();
    expect(
      screen.getByText(en.sponsorship.independence.items.traffic.description)
    ).toBeInTheDocument();
    expect(screen.getByText(en.sponsorship.costs.terms)).toBeInTheDocument();

    expect(
      screen.getByText(en.sponsorship.types.donation.title)
    ).toBeInTheDocument();
    expect(
      screen.getByText(en.sponsorship.types.inKind.title)
    ).toBeInTheDocument();
    expect(
      screen.getByText(en.sponsorship.types.sponsorship.title)
    ).toBeInTheDocument();

    expect(screen.getByText(en.sponsorship.pageNote)).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/gmail|yahoo|hotmail/i);

    const mailtoLinks = screen
      .getAllByRole("link")
      .filter((link) =>
        link.getAttribute("href")?.startsWith("mailto:info@herbally.app")
      );
    expect(mailtoLinks.length).toBeGreaterThan(0);

    expect(
      screen.getByRole("link", { name: en.sponsorship.links.donate })
    ).toHaveAttribute("href", "/donate");
    expect(
      screen.getByRole("link", { name: en.sponsorship.links.privacy })
    ).toHaveAttribute("href", "/privacy");
    expect(
      screen.getByRole("link", { name: en.sponsorship.links.methodology })
    ).toHaveAttribute("href", "/methodology");

    for (const section of container.querySelectorAll(
      "section[aria-labelledby]"
    )) {
      const id = section.getAttribute("aria-labelledby");
      expect(id).toBeTruthy();
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it("renders the French page and keeps internal links in the French locale", async () => {
    await renderPage("fr");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: fr.sponsorship.title,
      })
    ).toBeInTheDocument();
    expect(screen.getAllByText(fr.sponsorship.status).length).toBeGreaterThan(
      0
    );
    expect(
      screen.getByText(fr.sponsorship.current.emptyDescription)
    ).toBeInTheDocument();
    expect(
      screen.getByText(fr.sponsorship.independence.items.privacy.description)
    ).toBeInTheDocument();
    expect(
      screen.getByText(fr.sponsorship.types.inKind.title)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: fr.sponsorship.links.donate })
    ).toHaveAttribute("href", "/fr/donate");
    expect(
      screen.getByRole("link", { name: fr.sponsorship.links.privacy })
    ).toHaveAttribute("href", "/fr/privacy");
    expect(
      screen.getByRole("link", { name: fr.sponsorship.links.methodology })
    ).toHaveAttribute("href", "/fr/methodology");
  });

  it("registers locale-aware metadata for /sponsors", async () => {
    await generateMetadata();

    expect(buildPageMetadataMock).toHaveBeenCalledWith({
      titleKey: "sponsorship",
      descKey: "sponsorshipDesc",
      path: "/sponsors",
    });
  });
});
