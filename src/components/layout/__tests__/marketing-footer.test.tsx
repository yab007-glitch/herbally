import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { AbstractIntlMessages } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { enDict as en, frDict as fr } from "@/lib/i18n/dictionaries";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { MarketingFooter } from "../marketing-footer";

function renderFooter(locale: "en" | "fr") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={(locale === "fr" ? fr : en) as unknown as AbstractIntlMessages}
      timeZone="America/Toronto"
    >
      <MarketingFooter />
    </NextIntlClientProvider>
  );
}

describe("MarketingFooter sponsorship link", () => {
  it("links to the English sponsorship page", () => {
    renderFooter("en");

    const nav = screen.getByRole("navigation", {
      name: en.common.navFooter,
    });
    const link = within(nav).getByRole("link", {
      name: en.footer.sponsorship,
    });

    expect(link).toHaveAttribute("href", "/sponsors");
  });

  it("keeps the sponsorship link on the French site", () => {
    renderFooter("fr");

    const nav = screen.getByRole("navigation", {
      name: fr.common.navFooter,
    });
    const link = within(nav).getByRole("link", {
      name: fr.footer.sponsorship,
    });

    expect(link).toHaveAttribute("href", "/fr/sponsors");
  });
});
