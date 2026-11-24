import { buildHerbFallbackFaqs } from "@/lib/seo/herb-faq-fallback";
import enHerbs from "@/lib/i18n/dictionaries/en/herbs.json";

interface HerbFAQSchemaProps {
  herbName: string;
  scientificName: string;
  uses: string[];
  safetyNotes: string;
  pregnancyCategory: string;
  drugInteractions: number;
  isDangerous?: boolean;
  showCalculator?: boolean;
  // Optional pre-generated FAQs from database (for Featured Snippets)
  preGeneratedFaqs?: Array<{
    question: string;
    answer: string;
    category?: string;
  }>;
}

export function HerbFAQSchema({
  herbName,
  scientificName,
  uses,
  safetyNotes,
  pregnancyCategory,
  drugInteractions,
  isDangerous = false,
  showCalculator = true,
  preGeneratedFaqs,
  fallbackFaqs,
}: HerbFAQSchemaProps & {
  /**
   * Pre-built localized fallback items (shared builder with the visible
   * section). When absent, falls back to the legacy inline English
   * templates — kept only so older call sites don't break.
   */
  fallbackFaqs?: Array<{ question: string; answer: string }>;
}) {
  // If we have pre-generated FAQs from the database, use those
  if (preGeneratedFaqs && preGeneratedFaqs.length > 0) {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: preGeneratedFaqs.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    };

    return (
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
    );
  }

  // Fallback to template-based FAQs (shared builder with the visible
  // section so schema and content can never drift across locales).
  // The page normally supplies pre-localized fallbackFaqs; the inline EN
  // dictionary lookup below is a last resort for older call sites.
  const faqItems =
    fallbackFaqs ??
    buildHerbFallbackFaqs(
      {
        herbName,
        scientificName,
        uses,
        safetyNotes,
        pregnancyCategory,
        drugInteractions,
        isDangerous,
        showCalculator,
      },
      (key, params) => {
        let template: string =
          (enHerbs.herbFaq as Record<string, string>)[key] ?? key;
        for (const [k, v] of Object.entries(params ?? {})) {
          template = template.replaceAll(`{${k}}`, String(v));
        }
        // Minimal ICU plural support for interactSome ({count, plural, ...}).
        const count = Number(params?.count);
        template = template.replace(
          /\{count, plural, one \{(.*?)\} other \{(.*?)\}\}/g,
          (_, one: string, other: string) =>
            (count === 1 ? one : other).replaceAll("#", String(count))
        );
        return template;
      }
    );

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
      }}
    />
  );
}
