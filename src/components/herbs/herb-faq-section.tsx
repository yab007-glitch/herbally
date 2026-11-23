"use client";

import { useTranslations } from "next-intl";
import { buildHerbFallbackFaqs } from "@/lib/seo/herb-faq-fallback";

interface FaqItem {
  question: string;
  answer: string;
}

interface HerbFaqSectionProps {
  herbName?: string;
  scientificName?: string;
  uses?: string[];
  safetyNotes?: string;
  pregnancyCategory?: string;
  drugInteractions?: number;
  commonNames?: string[];
  isDangerous?: boolean;
  showCalculator?: boolean;
  preGeneratedFaqs?: Array<{
    question: string;
    answer: string;
    category?: string;
  }>;
  /** Pre-resolved FAQs passed from the server to keep RSC props minimal. */
  faqs?: FaqItem[];
}

/**
 * Visible FAQ section for herb pages.
 *
 * Google only honors FAQPage schema when the same Q&A is visible on the page.
 * This section renders the exact questions from HerbFAQSchema.
 */
export function HerbFaqSection({
  herbName = "",
  scientificName = "",
  uses = [],
  safetyNotes = "",
  pregnancyCategory = "insufficient",
  drugInteractions = 0,
  commonNames = [],
  isDangerous = false,
  showCalculator = true,
  preGeneratedFaqs,
  faqs: resolvedFaqsProp,
}: HerbFaqSectionProps) {
  const t = useTranslations("herbFaq");

  const faqs: FaqItem[] = resolvedFaqsProp
    ? resolvedFaqsProp
    : preGeneratedFaqs && preGeneratedFaqs.length > 0
      ? preGeneratedFaqs.map((f) => ({
          question: f.question,
          answer: f.answer,
        }))
      : buildHerbFallbackFaqs(
          {
            herbName,
            scientificName,
            uses,
            safetyNotes,
            pregnancyCategory,
            drugInteractions,
            commonNames,
            isDangerous,
            showCalculator,
          },
          (key, params) =>
            t(key as Parameters<typeof t>[0], params as Parameters<typeof t>[1])
        );

  return (
    <section
      id="faq"
      aria-labelledby="herb-faq-heading"
      className="scroll-mt-28 pt-4"
    >
      <h2
        id="herb-faq-heading"
        className="mb-3 text-xl font-semibold text-foreground"
      >
        {t("heading")}
      </h2>
      <div className="divide-y rounded-2xl border">
        {faqs.map((faq) => (
          <details key={faq.question} className="group px-4 py-2">
            <summary className="flex min-h-11 cursor-pointer items-center py-1 font-medium text-foreground">
              {faq.question}
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {faq.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
