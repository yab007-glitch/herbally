"use client";

import Link from "next/link";
import { Leaf, Heart } from "lucide-react";
import { useTranslations } from "next-intl";

export function MarketingFooter() {
  const t = useTranslations();

  return (
    <footer className="border-t border-border/50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="HerbAlly home"
          >
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Leaf className="size-3" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              Herb<span className="gradient-text">Ally</span>
            </span>
          </Link>

          {/* Links */}
          <nav
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-sm text-muted-foreground"
            aria-label={t("common.navFooter")}
          >
            <Link
              href="/herbs"
              prefetch={true}
              className="hover:text-foreground transition-colors"
            >
              {t("nav.herbs")}
            </Link>
            <Link
              href="/herbalist"
              prefetch={true}
              className="hover:text-foreground transition-colors"
            >
              {t("nav.herbalist")}
            </Link>
            <Link
              href="/calculator"
              prefetch={true}
              className="hover:text-foreground transition-colors"
            >
              {t("nav.calculator")}
            </Link>
            <Link
              href="/symptoms"
              prefetch={true}
              className="hover:text-foreground transition-colors"
            >
              {t("footer.symptoms")}
            </Link>
            <Link
              href="/faq"
              prefetch={true}
              className="hover:text-foreground transition-colors"
            >
              {t("footer.faq")}
            </Link>
            <Link
              href="/methodology"
              prefetch={true}
              className="hover:text-foreground transition-colors"
            >
              {t("footer.methodology")}
            </Link>
            <Link
              href="/about"
              prefetch={true}
              className="hover:text-foreground transition-colors"
            >
              {t("nav.about")}
            </Link>
            <Link
              href="/disclaimer"
              className="hover:text-foreground transition-colors"
            >
              {t("footer.disclaimer")}
            </Link>
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors"
            >
              {t("footer.privacy")}
            </Link>
            <Link
              href="/donate"
              className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors"
            >
              <Heart className="size-3" />
              {t("donate.title")}
            </Link>
          </nav>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} HerbAlly. {t("footer.copyright")}
        </p>
      </div>
    </footer>
  );
}
