import { buildPageMetadata } from "@/lib/i18n/metadata";
import Link from "next/link";
import {
  Stethoscope,
  MessageCircle,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getLocaleFromRequest } from "@/lib/i18n/server-locale";
import { FaqSearch } from "./faq-search";

export const generateMetadata = () =>
  buildPageMetadata({ titleKey: "faq", path: "/faq" });

const categoryKeys = [
  "aboutHerbAlly",
  "herbSafety",
  "drugInteractions",
  "dosageUsage",
  "virtualHerbalist",
  "sourcesEvidence",
] as const;

const questionMap: Record<string, string[]> = {
  aboutHerbAlly: ["free", "herbCount", "reviewed", "trustAI"],
  herbSafety: ["meds", "pregnancy", "children", "grades"],
  drugInteractions: ["dangerous", "accuracy"],
  dosageUsage: ["calculator", "multiple"],
  virtualHerbalist: ["how", "notAsk"],
  sourcesEvidence: ["what", "update"],
};

// Map category key to the sub-key in faqContent
const categorySubKey: Record<string, string> = {
  aboutHerbAlly: "general",
  herbSafety: "safety",
  drugInteractions: "interactions",
  dosageUsage: "dosage",
  virtualHerbalist: "herbalistCat",
  sourcesEvidence: "sources",
};

export default async function FAQPage() {
  const locale = await getLocaleFromRequest();
  const t = await getTranslations({ locale });

  const faqCategories = categoryKeys.map((catKey) => ({
    title: t(`faqContent.${catKey}`),
    catKey,
    questions: questionMap[catKey].map((qKey) => ({
      q: t(`faqContent.${categorySubKey[catKey]}.${qKey}.q`),
      a: t(`faqContent.${categorySubKey[catKey]}.${qKey}.a`),
    })),
  }));

  // Build FAQ schema for SEO
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqCategories.flatMap((cat) =>
      cat.questions.map((q) => ({
        "@type": "Question",
        name: q.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: q.a,
        },
      }))
    ),
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          {t("faqContent.title")}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          {t("faqContent.subtitle")}
        </p>
      </div>

      <div className="space-y-10">
        <FaqSearch categories={faqCategories} />
      </div>

      <div className="mt-12 rounded-lg border bg-muted/50 p-6 text-center">
        <h2 className="text-xl font-bold text-foreground">
          {t("faqContent.stillHaveQuestions")}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {t("faqContent.askVirtualHerbalist")}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <MessageCircle className="size-4" />
            {t("faqContent.askHerbalistBtn")}
          </Link>
          <Link
            href="/symptoms"
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Stethoscope className="size-4" />
            {t("faqContent.findHerbsBtn")}
          </Link>
        </div>
      </div>
    </div>
  );
}
