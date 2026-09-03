import { buildPageMetadata } from "@/lib/i18n/metadata";
import Link from "next/link";
import {
  BookOpen,
  FlaskConical,
  Shield,
  Scale,
  Microscope,
  FileCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { siteUrl } from "@/lib/seo/site-url";
import { BreadcrumbListSchema } from "@/components/seo/breadcrumb-list-schema";

export const generateMetadata = () =>
  buildPageMetadata({ titleKey: "methodology", path: "/methodology" });

const sectionKeys = [
  { key: "evidenceGrading", icon: Scale },
  { key: "sourceHierarchy", icon: BookOpen },
  { key: "safetyAssessment", icon: Shield },
  { key: "monographProcess", icon: Microscope },
  { key: "transparency", icon: FileCheck },
  { key: "activeCompounds", icon: FlaskConical },
] as const;

export default async function MethodologyPage() {
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale });

  const methodologySections = sectionKeys.map(({ key, icon }) => ({
    icon,
    title: t(`methodologyContent.${key}.title`),
    content: t(`methodologyContent.${key}.content`),
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <BreadcrumbListSchema
        items={[
          { name: t("common.breadcrumbHome"), url: "/" },
          { name: t("methodologyContent.title"), url: "/methodology" },
        ]}
      />
      {/* Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "AboutPage",
            name: "HerbAlly Methodology",
            description:
              "How HerbAlly grades evidence, sources citations, and ensures accuracy",
            url: `${siteUrl()}/methodology`,
            publisher: {
              "@type": "Organization",
              name: "HerbAlly",
              url: siteUrl(),
            },
          }).replace(/</g, "\\u003c"),
        }}
      />

      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          {t("methodologyContent.title")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {t("methodologyContent.subtitle")}
        </p>
      </div>

      <div className="space-y-8">
        {methodologySections.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <section.icon className="size-6 text-primary" />
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {section.content.split("\n\n").map((paragraph, i) => {
                  if (paragraph.startsWith("**")) {
                    return (
                      <h3 key={i} className="text-lg font-semibold mt-6 mb-3">
                        {paragraph.replace(/\*\*/g, "")}
                      </h3>
                    );
                  }
                  if (paragraph.startsWith("1. ")) {
                    return (
                      <ol
                        key={i}
                        className="list-decimal list-inside space-y-2 mb-4"
                      >
                        {paragraph.split("\n").map((item, j) => (
                          <li key={j} className="text-muted-foreground">
                            {item.replace(/^\d+\.\s*/, "").replace(/\*\*/g, "")}
                          </li>
                        ))}
                      </ol>
                    );
                  }
                  if (paragraph.startsWith("- ")) {
                    return (
                      <ul
                        key={i}
                        className="list-disc list-inside space-y-2 mb-4"
                      >
                        {paragraph.split("\n").map((item, j) => (
                          <li key={j} className="text-muted-foreground">
                            {item.replace(/^-\s*/, "").replace(/\*\*/g, "")}
                          </li>
                        ))}
                      </ul>
                    );
                  }
                  return (
                    <p key={i} className="text-muted-foreground mb-4">
                      {paragraph.replace(/\*\*/g, "")}
                    </p>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-12 rounded-lg border bg-muted/50 p-8 text-center">
        <h2 className="text-xl font-bold text-foreground">
          {t("methodologyContent.questionsTitle")}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {t("methodologyContent.questionsDesc")}
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link
            href="/faq"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("methodologyContent.viewFaq")}
          </Link>
          <a
            href="mailto:yab007@gmail.com"
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            {t("methodologyContent.contactUs")}
          </a>
        </div>
      </div>
    </div>
  );
}
