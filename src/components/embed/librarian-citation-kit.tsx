"use client";

import { useState } from "react";
import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { ArrowRight, BookOpen, Check, Copy, Link2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const RESOURCE_LINKS = [
  { key: "checker", href: "/herb-drug-interactions" },
  { key: "medications", href: "/medications" },
  { key: "surgery", href: "/surgery-planner" },
  { key: "npn", href: "/npn-checker" },
  { key: "methodology", href: "/methodology" },
] as const;

export function LibrarianCitationKit() {
  const t = useTranslations("widgetsPage.citationKit");
  const initialLocale = useLocale() === "fr" ? "fr" : "en";

  const [kitLocale, setKitLocale] = useState<"en" | "fr">(initialLocale);
  const [copiedKey, setCopiedKey] = useState<"blurb" | "html" | null>(null);

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://herbally.app"
  ).replace(/\/$/, "");
  const prefix = kitLocale === "fr" ? "/fr" : "";
  const checkerUrl = `${appUrl}${prefix}/herb-drug-interactions`;
  const methodologyUrl = `${appUrl}${prefix}/methodology`;

  const plainBlurb =
    kitLocale === "fr"
      ? `HerbAlly — Vérificateur d'interactions plantes–médicaments et monographies bilingues (${checkerUrl}). Outil éducatif gratuit et sans compte regroupant 3 122 fiches plantes, 509 paires d'interactions couvrant 142 médicaments et classes, le décodeur NPN Santé Canada et la liste de révision préopératoire des suppléments avec sources réglementaires (BDPSNH de Santé Canada, monographies HMPC de l'EMA, NIH NCCIH et LiverTox). Ne constitue pas un avis médical. Méthodologie et licences : ${methodologyUrl}. Catalogue JSON ouvert : ${appUrl}/open-data/catalog.json.`
      : `HerbAlly — Herb–Drug Interaction Checker & Monograph Reference (${checkerUrl}). Free, ad-free, bilingual (EN/FR) educational reference covering 3,122 herb profiles, 509 interaction pairs across 142 medications/classes, Health Canada NPN decoder, and Pre-Surgery Supplement Review Checklist citing Health Canada LNHPD, EU EMA HMPC, NIH NCCIH, and NIH LiverTox. Not medical advice. Methodology and open-data licences: ${methodologyUrl}. Open JSON catalog: ${appUrl}/open-data/catalog.json.`;

  const htmlSnippet =
    kitLocale === "fr"
      ? `<a href="${checkerUrl}" rel="noopener">HerbAlly — Vérificateur d'interactions plantes–médicaments</a> : outil de référence éducatif gratuit et bilingue appuyé par Santé Canada, l'EMA (HMPC), le NIH NCCIH et LiverTox.`
      : `<a href="${checkerUrl}" rel="noopener">HerbAlly Herb–Drug Interaction Checker</a> — Free, ad-free educational reference tool and herbal monograph directory citing Health Canada LNHPD, EU EMA HMPC, NIH NCCIH, and NIH LiverTox.`;

  async function copyText(key: "blurb" | "html", value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  return (
    <section
      aria-labelledby="librarian-kit-heading"
      className="mt-10 space-y-6 rounded-2xl border border-border bg-card p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
            <BookOpen className="size-4" aria-hidden="true" />
            <span>{t("eyebrow")}</span>
          </div>
          <h2
            id="librarian-kit-heading"
            className="text-xl font-semibold text-foreground sm:text-2xl"
          >
            {t("heading")}
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("intro")}
          </p>
        </div>
        <div className="flex gap-2">
          {(["en", "fr"] as const).map((loc) => (
            <Button
              key={loc}
              type="button"
              size="sm"
              variant={kitLocale === loc ? "default" : "outline"}
              onClick={() => setKitLocale(loc)}
            >
              {loc === "en" ? "English" : "Français"}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t("blurbHeading")}
            </h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => copyText("blurb", plainBlurb)}
            >
              {copiedKey === "blurb" ? (
                <Check className="mr-1.5 size-4 text-emerald-600" />
              ) : (
                <Copy className="mr-1.5 size-4" />
              )}
              {copiedKey === "blurb" ? t("copied") : t("copyBlurb")}
            </Button>
          </div>
          <p className="mt-2.5 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
            {plainBlurb}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t("htmlHeading")}
            </h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => copyText("html", htmlSnippet)}
            >
              {copiedKey === "html" ? (
                <Check className="mr-1.5 size-4 text-emerald-600" />
              ) : (
                <Copy className="mr-1.5 size-4" />
              )}
              {copiedKey === "html" ? t("copied") : t("copyHtml")}
            </Button>
          </div>
          <pre
            tabIndex={0}
            className="mt-2.5 overflow-x-auto rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground"
          >
            <code>{htmlSnippet}</code>
          </pre>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Link2 className="size-4 text-primary" aria-hidden="true" />
          <h3>{t("directLinksHeading")}</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {RESOURCE_LINKS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="group flex flex-col justify-between rounded-xl border border-border bg-background p-3.5 transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <div>
                <p className="text-sm font-medium text-foreground group-hover:text-primary">
                  {t(`links.${item.key}.title`)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t(`links.${item.key}.desc`)}
                </p>
              </div>
              <span className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-primary">
                <span>herbally.app{item.href}</span>
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
