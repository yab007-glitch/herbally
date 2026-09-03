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
  const topUses = uses.slice(0, 3).map((u) => u.toLowerCase());
  const usesText =
    topUses.length > 0
      ? topUses.join(", ")
      : "various traditional and modern applications";

  const pregnancyText = (() => {
    switch (pregnancyCategory) {
      case "safe":
        return `${herbName} is generally considered safe during pregnancy, but always consult your healthcare provider.`;
      case "caution":
        return `${herbName} should be used with caution during pregnancy. Consult your healthcare provider before use.`;
      case "unsafe":
        return `${herbName} is not recommended during pregnancy. Consult your healthcare provider for alternatives.`;
      default:
        return `The safety of ${herbName} during pregnancy has not been conclusively established. Consult your healthcare provider before use.`;
    }
  })();

  const fallbackFaqs: FaqItem[] = [
    ...(commonNames.length > 0
      ? [
          {
            question: `What is ${herbName} in English?`,
            answer: `${herbName} (${scientificName}) is known in English as ${commonNames.slice(0, 3).join(", ")}. It is traditionally used for ${usesText}.`,
          },
        ]
      : [
          {
            question: `What is ${herbName} (${scientificName}) used for?`,
            answer: `${herbName} (${scientificName}) is traditionally used for ${usesText}. Always consult a healthcare professional before use.`,
          },
        ]),
    {
      question: `Is ${herbName} safe during pregnancy?`,
      answer: pregnancyText,
    },
    {
      question: `Does ${herbName} interact with medications?`,
      answer:
        drugInteractions > 0
          ? `Yes, ${herbName} has ${drugInteractions} known drug interaction${drugInteractions > 1 ? "s" : ""}. ${safetyNotes || "Consult your healthcare provider or pharmacist about potential interactions with your medications."}`
          : `${herbName} has no well-documented major drug interactions in our database, but always inform your healthcare provider about all supplements you take.`,
    },
    {
      question: `What are the side effects of ${herbName}?`,
      answer:
        safetyNotes ||
        `Side effects of ${herbName} are generally mild at recommended doses. Use our free dose calculator to stay within the evidence-based range, and consult your healthcare provider for personalized advice.`,
    },
    {
      question: `How do I calculate a safe dose of ${herbName}?`,
      answer: `Use HerbAlly's free herbal dosage calculator — enter the adult reference dose for ${herbName}, plus age and weight, to get a Clark's / Young's rule pediatric estimate. Never exceed the adult dose.`,
    },
  ];

  const faqs: FaqItem[] =
    preGeneratedFaqs && preGeneratedFaqs.length > 0
      ? preGeneratedFaqs.map((f) => ({
          question: f.question,
          answer: f.answer,
        }))
      : fallbackFaqs;

  return (
    <section aria-labelledby="herb-faq-heading" className="pt-4">
      <h2
        id="herb-faq-heading"
        className="mb-3 text-xl font-semibold text-foreground"
      >
        Frequently asked questions
      </h2>
      <div className="divide-y rounded-2xl border">
        {faqs.map((faq) => (
          <details key={faq.question} className="group px-4 py-3">
            <summary className="cursor-pointer font-medium text-foreground">
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
