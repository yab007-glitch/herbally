import type { CopyLocale } from "@/lib/i18n/herb-page-copy";

export interface HerbJumpNavProps {
  locale: CopyLocale;
  hasInteractions: boolean;
}

const LABELS = {
  en: {
    aria: "On this page",
    overview: "Overview",
    interactions: "Interactions",
    dosageSafety: "Dosage & Safety",
    sources: "Sources",
    faq: "FAQ",
  },
  fr: {
    aria: "Sur cette page",
    overview: "Aperçu",
    interactions: "Interactions",
    dosageSafety: "Posologie et sécurité",
    sources: "Sources",
    faq: "FAQ",
  },
} as const;

export function HerbJumpNav({ locale, hasInteractions }: HerbJumpNavProps) {
  const copy = LABELS[locale];
  const links = [
    { href: "#overview", label: copy.overview },
    ...(hasInteractions
      ? [{ href: "#interactions", label: copy.interactions }]
      : []),
    { href: "#dosage-safety", label: copy.dosageSafety },
    { href: "#sources", label: copy.sources },
    { href: "#faq", label: copy.faq },
  ];

  return (
    <nav
      aria-label={copy.aria}
      className="sticky top-12 z-20 -mx-4 flex items-center gap-1.5 overflow-x-auto border-b border-border/80 bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 no-print"
    >
      {links.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/60 hover:text-foreground"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
