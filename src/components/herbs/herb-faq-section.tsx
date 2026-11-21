import { useTranslations } from "next-intl";
import { buildHerbFallbackFaqs } from "@/lib/seo/herb-faq-fallback";

interface FaqItem {
  question: string;
  answer: string;
}

interface HerbFaqSectionProps {
  herbName: string;
  scientificName: string;
  uses: string[];
  safetyNotes: string;
  pregnancyCategory: string;
  drugInteractions: number;
  commonNames?: string[];
  preGeneratedFaqs?: Array<{
    question: string;
    answer: string;
    category?: string;
  }>;
}

/**
 * Visible FAQ section for herb pages.
 *
 * Google only honors FAQPage schema when the same Q&A is visible on the page.
 * Search Console (Sep 2026) shows Search Appearance = No data, meaning our
 * FAQPage JSON-LD is currently ignored — there was schema but no matching
 * visible content. This section renders the exact questions from
 * HerbFAQSchema, plus the high-converting intents from Search Console:
 * "X in english", "X vs Y", dosage/calculator.
 */
export function HerbFaqSection({
  herbName,
  scientificName,
  uses,
  safetyNotes,
  pregnancyCategory,
  drugInteractions,
  commonNames = [],
  preGeneratedFaqs,
}: HerbFaqSectionProps) {
  // Localized templates (herbFaq namespace) via the shared builder also
  // used for the JSON-LD schema — visible content and markup match by
  // construction in both languages.
  const t = useTranslations("herbFaq");
  const fallbackFaqs: FaqItem[] = buildHerbFallbackFaqs(
    {
      herbName,
      scientificName,
      uses,
      safetyNotes,
      pregnancyCategory,
      drugInteractions,
      commonNames,
    },
    (key, params) =>
      t(key as Parameters<typeof t>[0], params as Parameters<typeof t>[1])
  );

  const faqs: FaqItem[] =
    preGeneratedFaqs && preGeneratedFaqs.length > 0
      ? preGeneratedFaqs.map((f) => ({
          question: f.question,
          answer: f.answer,
        }))
      : fallbackFaqs;

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
