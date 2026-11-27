import Link from "next/link";

interface ToxicQuarantineShellProps {
  slug: string;
  locale: "en" | "fr";
  children?: React.ReactNode;
}

/**
 * Isolated pure-server shell for permanently quarantined poisonous or lethal
 * botanicals. Strips global consumer navigation, FAQ/editorial/herbalist/dose
 * links, ads, newsletters, and floating chat so a toxic plant entry cannot
 * inherit consumer supplement chrome.
 */
export function ToxicQuarantineShell({
  slug,
  locale,
  children,
}: ToxicQuarantineShellProps) {
  const fr = locale === "fr";
  const homeHref = fr ? "/fr" : "/";
  const directoryHref = fr ? "/fr/herbs" : "/herbs";
  const switchLocaleHref = fr ? `/herbs/${slug}` : `/fr/herbs/${slug}`;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-destructive/30 bg-background">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href={homeHref}
              className="text-base font-bold tracking-tight text-foreground hover:underline"
            >
              HerbAlly
            </Link>
            <Link
              href={directoryHref}
              className="inline-flex min-h-9 items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {fr ? "← Retour au répertoire" : "← Back to Herb Directory"}
            </Link>
          </div>
          <nav
            aria-label={
              fr ? "Navigation de langue" : "Quarantine language navigation"
            }
          >
            <Link
              href={switchLocaleHref}
              className="inline-flex min-h-9 items-center rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-muted"
            >
              {fr ? "English" : "Français"}
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      <footer className="border-t border-destructive/20 bg-muted/30 py-6 text-xs text-muted-foreground">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="font-medium text-foreground">
            {fr
              ? "Quarantaine botanique toxique permanente · Centre antipoison (Canada) : 1-844-764-7669 · Poison Control (É.-U.) : 1-800-222-1222 · Urgence : 911 · © HerbAlly"
              : "Permanent Toxic Botanical Quarantine · Poison Control (US): 1-800-222-1222 · Poison Control (Canada): 1-844-764-7669 · Emergency: 911 · © HerbAlly"}
          </p>
        </div>
      </footer>
    </div>
  );
}
