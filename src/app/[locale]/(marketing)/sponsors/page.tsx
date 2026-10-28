import { buildPageMetadata } from "@/lib/i18n/metadata";
import Link from "next/link";
import {
  BadgeCheck,
  Bot,
  CheckCircle2,
  CircleDashed,
  Database,
  Gift,
  Globe,
  Handshake,
  Heart,
  LockKeyhole,
  Mail,
  MousePointerClick,
  Server,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getTranslations } from "next-intl/server";
import { getLocale } from "@/lib/i18n/page-locale";
import { addLocalePrefix } from "@/lib/i18n/routing";

export const generateMetadata = () =>
  buildPageMetadata({
    titleKey: "sponsorship",
    descKey: "sponsorshipDesc",
    path: "/sponsors",
  });

const costKeys = ["hosting", "ai", "database", "domain"] as const;

const costIcons = {
  hosting: Server,
  ai: Bot,
  database: Database,
  domain: Globe,
} as const;

const independenceItems = [
  { key: "labelled", icon: BadgeCheck },
  { key: "medical", icon: Stethoscope },
  { key: "safety", icon: ShieldCheck },
  { key: "privacy", icon: LockKeyhole },
  { key: "traffic", icon: MousePointerClick },
] as const;

const supportTypes = [
  { key: "donation", icon: Heart },
  { key: "inKind", icon: Gift },
  { key: "sponsorship", icon: Handshake },
] as const;

const SPONSOR_EMAIL = "info@herbally.app";

export default async function SponsorsPage() {
  const locale = await getLocale();
  const t = await getTranslations({ locale });

  const mailtoHref = `mailto:${SPONSOR_EMAIL}?subject=${encodeURIComponent(
    t("sponsorship.contact.emailSubject")
  )}`;
  const donateHref = addLocalePrefix("/donate", locale);
  const methodologyHref = addLocalePrefix("/methodology", locale);
  const privacyHref = addLocalePrefix("/privacy", locale);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
      <header className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-background px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-primary/25 bg-background/70 text-primary"
            >
              <Handshake className="size-3.5" aria-hidden="true" />
              {t("sponsorship.eyebrow")}
            </Badge>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <CircleDashed className="size-3.5" aria-hidden="true" />
              {t("sponsorship.status")}
            </span>
          </div>

          <h1 className="mt-5 max-w-3xl text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {t("sponsorship.title")}
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            {t("sponsorship.subtitle")}
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              href={mailtoHref}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("sponsorship.heroEmail")}
              <Mail className="size-4" aria-hidden="true" />
            </a>
            <Link
              href={donateHref}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {t("sponsorship.heroDonate")}
              <Heart className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <p className="mt-4 max-w-2xl text-xs leading-5 text-muted-foreground">
            {t("sponsorship.heroNote")}
          </p>
        </div>
      </header>

      <section
        className="mt-12 scroll-mt-24"
        aria-labelledby="current-sponsors-heading"
      >
        <h2
          id="current-sponsors-heading"
          className="text-2xl font-bold tracking-tight text-foreground"
        >
          {t("sponsorship.current.title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t("sponsorship.current.description")}
        </p>

        <div className="mt-5 rounded-2xl border border-dashed border-border bg-muted/30 px-5 py-8 text-center sm:px-8 sm:py-10">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border/60">
            <CircleDashed className="size-6" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-foreground">
            {t("sponsorship.current.emptyTitle")}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            {t("sponsorship.current.emptyDescription")}
          </p>
          <p className="mx-auto mt-4 inline-flex max-w-xl items-start gap-2 rounded-xl bg-background/80 px-3 py-2 text-left text-xs leading-5 text-muted-foreground ring-1 ring-border/50">
            <BadgeCheck
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>{t("sponsorship.current.emptyNote")}</span>
          </p>
        </div>
      </section>

      <section className="mt-14" aria-labelledby="support-areas-heading">
        <h2
          id="support-areas-heading"
          className="text-2xl font-bold tracking-tight text-foreground"
        >
          {t("sponsorship.costs.title")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          {t("sponsorship.costs.description")}
        </p>

        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {costKeys.map((key) => {
            const Icon = costIcons[key];

            return (
              <li
                key={key}
                className="rounded-2xl border border-border/60 bg-card p-5 ring-1 ring-foreground/5"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-foreground">
                  {t(`sponsorship.costs.items.${key}.label`)}
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  {t(`sponsorship.costs.items.${key}.description`)}
                </p>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 rounded-xl border border-border/60 bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
          {t("sponsorship.costs.terms")}
        </p>
      </section>

      <section className="mt-14" aria-labelledby="independence-heading">
        <div className="rounded-3xl border border-border/60 bg-card p-5 ring-1 ring-foreground/5 sm:p-8">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="independence-heading"
                className="text-2xl font-bold tracking-tight text-foreground"
              >
                {t("sponsorship.independence.title")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("sponsorship.independence.description")}
              </p>
            </div>
          </div>

          <ul className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {independenceItems.map(({ key, icon: Icon }) => (
              <li key={key} className="flex gap-3">
                <Icon
                  className="mt-0.5 size-5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t(`sponsorship.independence.items.${key}.title`)}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {t(`sponsorship.independence.items.${key}.description`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-14" aria-labelledby="support-types-heading">
        <h2
          id="support-types-heading"
          className="text-2xl font-bold tracking-tight text-foreground"
        >
          {t("sponsorship.types.title")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          {t("sponsorship.types.description")}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {supportTypes.map(({ key, icon: Icon }) => (
            <article
              key={key}
              className="rounded-2xl border border-border/60 bg-card p-5 ring-1 ring-foreground/5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <Badge variant="outline" className="border-border/70">
                  {t(`sponsorship.types.${key}.label`)}
                </Badge>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                {t(`sponsorship.types.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t(`sponsorship.types.${key}.description`)}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="contact"
        className="mt-14 scroll-mt-24"
        aria-labelledby="contact-heading"
      >
        <div className="overflow-hidden rounded-3xl border border-primary/20 bg-primary/5 p-5 sm:p-8">
          <div className="grid gap-6 md:grid-cols-[1.35fr_auto] md:items-center">
            <div>
              <h2
                id="contact-heading"
                className="text-2xl font-bold tracking-tight text-foreground"
              >
                {t("sponsorship.contact.title")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("sponsorship.contact.description")}
              </p>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
                <li className="flex gap-2">
                  <CheckCircle2
                    className="mt-1 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>{t("sponsorship.contact.prompt")}</span>
                </li>
                <li className="flex gap-2">
                  <LockKeyhole
                    className="mt-1 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>{t("sponsorship.contact.privacy")}</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3">
              <a
                href={mailtoHref}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {t("sponsorship.contact.emailLabel")}
                <Mail className="size-4" aria-hidden="true" />
              </a>
              <p className="max-w-xs text-xs leading-5 text-muted-foreground">
                {t("sponsorship.contact.noOffer")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <Link
          href={methodologyHref}
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("sponsorship.links.methodology")}
        </Link>
        <Link
          href={privacyHref}
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("sponsorship.links.privacy")}
        </Link>
        <Link
          href={donateHref}
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("sponsorship.links.donate")}
        </Link>
      </div>

      <p className="mt-8 border-t border-border/60 pt-6 text-xs leading-5 text-muted-foreground">
        {t("sponsorship.pageNote")}
      </p>
    </div>
  );
}
