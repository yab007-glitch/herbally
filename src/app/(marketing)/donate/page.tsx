import type { Metadata } from "next";
import Link from "next/link";
import {
  Heart,
  Server,
  Database,
  Bot,
  Globe,
  Leaf,
  CheckCircle,
  XCircle,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import dynamic from "next/dynamic";
const DonationButtons = dynamic(() =>
  import("@/components/donations/donation-buttons").then(
    (mod) => mod.DonationButtons
  )
);
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { type Locale } from "@/lib/i18n/config";

export const metadata: Metadata = {
  title: "Support Us - Keep Herbal Medicine Free",
  description:
    "Help us keep HerbAlly 100% free. Your donation supports hosting, AI costs, and free access for everyone.",
  alternates: {
    canonical: "https://herbally.app/donate",
  },
  openGraph: {
    title: "Support Us - Keep Herbal Medicine Free",
    description:
      "Help us keep HerbAlly 100% free. Your donation supports hosting, AI costs, and free access for everyone.",
    url: "https://herbally.app/donate",
    type: "website",
    siteName: "HerbAlly",
  },
};

const costIcons: Record<string, typeof Server> = {
  hosting: Server,
  database: Database,
  ai: Bot,
  domain: Globe,
};

const costKeys = ["hosting", "database", "ai", "domain"] as const;

export default async function DonatePage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; canceled?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("herbally-locale");
  const locale: Locale = localeCookie?.value === "fr" ? "fr" : "en";
  const t = await getTranslations();

  const costs = costKeys.map((key) => ({
    key,
    icon: costIcons[key],
    label: t(`donateContent.breakdown.${key}.label`),
    description: t(`donateContent.breakdown.${key}.desc`),
    monthly: t(`donateContent.breakdown.${key}.monthly`),
  }));

  const testimonials = [0, 1, 2].map((i) => ({
    quote: t(`donateContent.testimonials.${i}.quote`),
    author: t(`donateContent.testimonials.${i}.author`),
    location: t(`donateContent.testimonials.${i}.location`),
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-12 py-8">
      {/* Success/Canceled Messages */}
      {params.success === "true" && (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20">
          <CardContent className="flex items-center gap-4 py-6">
            <CheckCircle className="size-8 text-emerald-600" />
            <div>
              <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                {t("donateContent.thankYou")}
              </h2>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                {t("donateContent.thankYouDesc")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {params.canceled === "true" && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
          <CardContent className="flex items-center gap-4 py-6">
            <XCircle className="size-8 text-amber-600" />
            <div>
              <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                {t("donateContent.canceled")}
              </h2>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {t("donateContent.canceledDesc")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hero */}
      <div className="text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-600 shadow-xl shadow-pink-500/20">
          <Heart className="h-10 w-10 text-white fill-white" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          {t("donateContent.title")}
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          {t("donateContent.subtitle")}
        </p>

        {/* Quick Stats */}
        <div className="flex flex-wrap justify-center gap-6 pt-4">
          <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm">
            <Leaf className="size-4 text-primary" />
            <span>
              <strong>{t("donateContent.herbsStat")}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm">
            <Sparkles className="size-4 text-primary" />
            <span>{t("donateContent.freeAI")}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm">
            <Heart className="size-4 text-pink-500 fill-pink-500" />
            <span>{t("donateContent.freeForever")}</span>
          </div>
        </div>
      </div>

      {/* Donation Buttons */}
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold">
            {t("donateContent.chooseImpact")}
          </h2>
          <p className="text-muted-foreground mt-1">
            {t("donateContent.everyDonation")}
          </p>
        </div>
        <DonationButtons />
      </div>

      {/* Monthly Costs Breakdown */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-5 text-primary" />
            {t("donateContent.whereMoneyGoes")}
          </CardTitle>
          <CardDescription>
            {t("donateContent.fullTransparency")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {costs.map((cost) => {
              const Icon = cost.icon;
              return (
                <div
                  key={cost.key}
                  className="flex items-start gap-3 rounded-lg border border-border/50 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-foreground">
                        {cost.label}
                      </p>
                      <span className="text-sm font-semibold text-primary">
                        {cost.monthly}/mo
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {cost.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm">
            <span className="font-medium">
              {t("donateContent.estimatedCosts")}
            </span>
            <span className="font-bold text-lg text-primary">
              {t("donateContent.monthlyCost")}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Testimonials */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-center">
          {t("donateContent.loveHerbAlly")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {testimonials.map((testimonial, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="pt-6">
                <p className="text-sm italic text-muted-foreground">
                  &ldquo;{testimonial.quote}&rdquo;
                </p>
                <p className="mt-3 text-sm font-medium">
                  — {testimonial.author}
                </p>
                <p className="text-xs text-muted-foreground">
                  {testimonial.location}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* How We Operate */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="size-5 text-pink-500 fill-pink-500" />
            {t("donateContent.promiseTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <CheckCircle className="size-5 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              <strong className="text-foreground">
                {t("donateContent.noAds")}
              </strong>{" "}
              {t("donateContent.noAdsDesc")}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="size-5 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              <strong className="text-foreground">
                {t("donateContent.noPremium")}
              </strong>{" "}
              {t("donateContent.noPremiumDesc")}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="size-5 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              <strong className="text-foreground">
                {t("donateContent.noDataSelling")}
              </strong>{" "}
              {t("donateContent.noDataSellingDesc")}
            </p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="size-5 text-emerald-600 shrink-0 mt-0.5" />
            <p>
              <strong className="text-foreground">
                {t("donateContent.openCosts")}
              </strong>{" "}
              {t("donateContent.openCostsDesc")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Bottom CTA */}
      <div className="text-center space-y-4 pb-8">
        <p className="text-sm text-muted-foreground">
          {t("donateContent.questions")}{" "}
          <Link href="/about" className="underline hover:text-foreground">
            {t("donateContent.learnMore")}
          </Link>
        </p>
      </div>
    </div>
  );
}
