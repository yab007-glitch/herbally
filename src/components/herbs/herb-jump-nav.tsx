"use client";

import { useEffect, useMemo, useState } from "react";
import type { CopyLocale } from "@/lib/i18n/herb-page-copy";
import { cn } from "@/lib/utils";

export interface HerbJumpNavProps {
  locale: CopyLocale;
  hasInteractions: boolean;
  isDangerous?: boolean;
}

const LABELS = {
  en: {
    aria: "On this page",
    overview: "Overview",
    interactions: "Interactions",
    dosageSafety: "Dosage & Safety",
    toxicologySafety: "Toxicology & Emergency",
    sources: "Sources",
    faq: "FAQ",
  },
  fr: {
    aria: "Sur cette page",
    overview: "Aperçu",
    interactions: "Interactions",
    dosageSafety: "Posologie et sécurité",
    toxicologySafety: "Toxicologie et urgence",
    sources: "Sources",
    faq: "FAQ",
  },
} as const;

export function HerbJumpNav({
  locale,
  hasInteractions,
  isDangerous = false,
}: HerbJumpNavProps) {
  const copy = LABELS[locale];
  const links = useMemo(
    () =>
      isDangerous
        ? [
            { href: "#overview", label: copy.overview },
            ...(hasInteractions
              ? [{ href: "#interactions", label: copy.interactions }]
              : []),
            { href: "#dosage-safety", label: copy.toxicologySafety },
            { href: "#sources", label: copy.sources },
          ]
        : [
            { href: "#overview", label: copy.overview },
            ...(hasInteractions
              ? [{ href: "#interactions", label: copy.interactions }]
              : []),
            { href: "#dosage-safety", label: copy.dosageSafety },
            { href: "#sources", label: copy.sources },
            { href: "#faq", label: copy.faq },
          ],
    [copy, hasInteractions, isDangerous]
  );

  const [activeHref, setActiveHref] = useState<string>("#overview");

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const ids = links.map((l) => l.href.slice(1));
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveHref(`#${visible[0].target.id}`);
        }
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 }
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [links]);

  return (
    <nav
      aria-label={copy.aria}
      className="sticky top-12 z-20 -mx-4 flex items-center gap-1.5 overflow-x-auto border-b border-border/80 bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 no-print"
    >
      <span className="hidden shrink-0 pr-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">
        {copy.aria}:
      </span>
      {links.map((item) => {
        const active = activeHref === item.href;
        return (
          <a
            key={item.href}
            href={item.href}
            onClick={() => setActiveHref(item.href)}
            aria-current={active ? "location" : undefined}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
