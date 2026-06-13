import type { Metadata } from "next";
import {
  Leaf,
  Search,
  Calculator,
  MessageCircle,
  Heart,
  Shield,
  BookOpen,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { type Locale } from "@/lib/i18n/config";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about HerbAlly, our mission, and how we help you make informed decisions about medicinal herbs.",
  alternates: {
    canonical: "https://herbally.app/about",
  },
  openGraph: {
    title: "About",
    description:
      "Learn about HerbAlly, our mission, and how we help you make informed decisions about medicinal herbs.",
    url: "https://herbally.app/about",
    type: "website",
    siteName: "HerbAlly",
  },
};

export default async function AboutPage() {
  const locale = "en" as Locale;
    const t = await getTranslations();

  const howItWorks = [
    {
      step: 1,
      icon: Search,
      title: t("aboutContent.howItWorks.step1Title"),
      description: t("aboutContent.howItWorks.step1Desc"),
    },
    {
      step: 2,
      icon: Calculator,
      title: t("aboutContent.howItWorks.step2Title"),
      description: t("aboutContent.howItWorks.step2Desc"),
    },
    {
      step: 3,
      icon: MessageCircle,
      title: t("aboutContent.howItWorks.step3Title"),
      description: t("aboutContent.howItWorks.step3Desc"),
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-16 text-center">
        <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Leaf className="size-8" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          {t("aboutContent.header")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          {t("aboutContent.subtitle")}
        </p>
      </div>

      {/* What is HerbAlly */}
      <section className="mb-16">
        <h2 className="mb-4 text-2xl font-bold text-foreground">
          {t("aboutContent.whatIsTitle")}
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <p>{t("aboutContent.whatIsText1")}</p>
          <p>{t("aboutContent.whatIsText2")}</p>
        </div>
      </section>

      {/* Our Mission */}
      <section className="mb-16">
        <h2 className="mb-4 text-2xl font-bold text-foreground">
          {t("aboutContent.mission.title")}
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-2 text-center">
              <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <BookOpen className="size-5" />
              </div>
              <h3 className="font-semibold text-foreground">
                {t("aboutContent.mission.educate")}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("aboutContent.mission.educateDesc")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-2 text-center">
              <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                <Shield className="size-5" />
              </div>
              <h3 className="font-semibold text-foreground">
                {t("aboutContent.mission.protect")}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("aboutContent.mission.protectDesc")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-2 text-center">
              <div className="mb-3 inline-flex size-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                <Heart className="size-5" />
              </div>
              <h3 className="font-semibold text-foreground">
                {t("aboutContent.mission.empower")}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("aboutContent.mission.empowerDesc")}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="mb-16">
        <h2 className="mb-8 text-center text-2xl font-bold text-foreground">
          {t("aboutContent.howItWorks.title")}
        </h2>
        <div className="space-y-8">
          {howItWorks.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.step} className="flex gap-6">
                <div className="flex shrink-0 flex-col items-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                    {item.step}
                  </div>
                  {item.step < howItWorks.length && (
                    <div className="mt-2 h-full w-px bg-border" />
                  )}
                </div>
                <div className="pb-8">
                  <div className="flex items-center gap-2">
                    <Icon className="size-5 text-primary" />
                    <h3 className="text-lg font-semibold text-foreground">
                      {item.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Free & Donation-Supported */}
      <section className="mb-16">
        <h2 className="mb-4 text-2xl font-bold text-foreground">
          {t("aboutContent.freeTitle")}
        </h2>
        <div className="space-y-4 text-muted-foreground">
          <p>{t("aboutContent.freeText1")}</p>
          <p>{t("aboutContent.freeText2")}</p>
          <p>
            {t("aboutContent.freeText3").split("making a donation").length >
              1 || locale === "en" ? (
              <>
                {locale === "en" ? (
                  <>
                    If HerbAlly has been helpful to you, please consider{" "}
                    <a
                      href="/donate"
                      className="font-medium text-primary underline hover:no-underline"
                    >
                      making a donation
                    </a>{" "}
                    to help us keep this resource available for everyone.
                  </>
                ) : (
                  <>
                    {t("aboutContent.freeText3")}{" "}
                    <a
                      href="/donate"
                      className="font-medium text-primary underline hover:no-underline"
                    >
                      {t("aboutContent.freeLink")}
                    </a>
                  </>
                )}
              </>
            ) : (
              <>
                {
                  t("aboutContent.freeText3").split(
                    t("aboutContent.freeLink")
                  )[0]
                }
                <a
                  href="/donate"
                  className="font-medium text-primary underline hover:no-underline"
                >
                  {t("aboutContent.freeLink")}
                </a>
                {
                  t("aboutContent.freeText3").split(
                    t("aboutContent.freeLink")
                  )[1]
                }
              </>
            )}
          </p>
        </div>
      </section>

      {/* Team Section */}
      <section>
        <h2 className="mb-4 text-2xl font-bold text-foreground">
          {t("aboutContent.team.title")}
        </h2>
        <p className="text-muted-foreground">{t("aboutContent.team.text")}</p>
      </section>
    </div>
  );
}
