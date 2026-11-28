"use client";

import { LocalizedLink as Link } from "@/components/i18n/localized-link";
import { Leaf, Heart } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

export function MarketingFooter() {
  const t = useTranslations();
  const fr = useLocale() === "fr";

  return (
    <footer className="no-print border-t border-border/60 bg-muted/15">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <nav
          aria-label={t("common.navFooter")}
          className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4"
        >
          {/* Column 1: Check Safety */}
          <div className="space-y-3">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-foreground">
              {fr ? "Vérifier la sécurité" : "Check Safety"}
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/herb-drug-interactions"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.herbDrugInteractions")}
                </Link>
              </li>
              <li>
                <Link
                  href="/herb-drug-interactions#stack-checker"
                  className="hover:text-foreground transition-colors"
                >
                  {fr ? "Bilan multi-plantes" : "Full-Stack Checker"}
                </Link>
              </li>
              <li>
                <Link
                  href="/surgery-planner"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.surgeryPlanner")}
                </Link>
              </li>
              <li>
                <Link
                  href="/npn-checker"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.npnChecker")}
                </Link>
              </li>
              <li>
                <Link
                  href="/calculator"
                  className="hover:text-foreground transition-colors"
                >
                  {t("nav.calculator")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Explore */}
          <div className="space-y-3">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-foreground">
              {fr ? "Explorer" : "Explore"}
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/herbs"
                  className="hover:text-foreground transition-colors"
                >
                  {t("nav.herbs")}
                </Link>
              </li>
              <li>
                <Link
                  href="/medications"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.medications")}
                </Link>
              </li>
              <li>
                <Link
                  href="/symptoms"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.symptoms")}
                </Link>
              </li>
              <li>
                <Link
                  href="/herbalist"
                  className="hover:text-foreground transition-colors"
                >
                  {t("nav.herbalist")}
                </Link>
              </li>
              <li>
                <Link
                  href="/guides"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.guides")}
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.faq")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Clinical Review & Governance */}
          <div className="space-y-3">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-foreground">
              {fr ? "Révision & Gouvernance" : "Clinical Review"}
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/clinical-review?intent=signoff"
                  className="font-medium text-primary hover:underline"
                >
                  {t("footer.clinicalReview")}
                </Link>
              </li>
              <li>
                <Link
                  href="/clinical-review?intent=advisory"
                  className="hover:text-foreground transition-colors"
                >
                  {fr ? "Comité consultatif (0/3)" : "Advisory Board (0/3)"}
                </Link>
              </li>
              <li>
                <Link
                  href="/methodology"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.methodology")}
                </Link>
              </li>
              <li>
                <Link
                  href="/editorial-policy"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.editorialPolicy")}
                </Link>
              </li>
              <li>
                <Link
                  href="/trust"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.trust")}
                </Link>
              </li>
              <li>
                <Link
                  href="/widgets"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.widgets")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: About & Support */}
          <div className="space-y-3">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-foreground">
              {fr ? "À propos & Soutien" : "About & Support"}
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/about"
                  className="hover:text-foreground transition-colors"
                >
                  {t("nav.about")}
                </Link>
              </li>
              <li>
                <Link
                  href="/disclaimer"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.disclaimer")}
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.privacy")}
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.contact")}
                </Link>
              </li>
              <li>
                <Link
                  href="/sponsors"
                  className="hover:text-foreground transition-colors"
                >
                  {t("footer.sponsorship")}
                </Link>
              </li>
              <li>
                <Link
                  href="/donate"
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Heart className="size-3" aria-hidden="true" />
                  {t("donate.title")}
                </Link>
              </li>
            </ul>
          </div>
        </nav>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 sm:flex-row">
          <Link
            href="/"
            className="flex items-center gap-2"
            aria-label="HerbAlly home"
          >
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Leaf className="size-3" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              Herb<span className="gradient-text">Ally</span>
            </span>
          </Link>

          <p className="text-center text-xs text-muted-foreground sm:text-right">
            &copy;{" "}
            <span suppressHydrationWarning>{new Date().getFullYear()}</span>{" "}
            HerbAlly. {t("footer.copyright")}
          </p>
        </div>
      </div>
    </footer>
  );
}
