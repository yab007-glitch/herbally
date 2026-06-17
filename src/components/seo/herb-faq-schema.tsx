interface HerbFAQSchemaProps {
  herbName: string;
  scientificName: string;
  uses: string[];
  safetyNotes: string;
  pregnancyCategory: string;
  drugInteractions: number;
  // Optional pre-generated FAQs from database (for Featured Snippets)
  preGeneratedFaqs?: Array<{ question: string; answer: string; category?: string }>;
}

export function HerbFAQSchema({
  herbName,
  scientificName,
  uses,
  safetyNotes,
  pregnancyCategory,
  drugInteractions,
  preGeneratedFaqs,
}: HerbFAQSchemaProps) {
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
      />
    );
  }

  // Fallback to template-based FAQs
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

  const faqItems = [
    {
      question: `What is ${herbName} (${scientificName}) used for?`,
      answer: `${herbName} (${scientificName}) is traditionally used for ${usesText}. Always consult a healthcare professional before use.`,
    },
    {
      question: `Is ${herbName} safe during pregnancy?`,
      answer: pregnancyText,
    },
    ...(drugInteractions > 0
      ? [
          {
            question: `Does ${herbName} interact with medications?`,
            answer: `Yes, ${herbName} has ${drugInteractions} known drug interaction${drugInteractions > 1 ? "s" : ""}. ${safetyNotes || "Consult your healthcare provider or pharmacist about potential interactions with your medications."}`,
          },
        ]
      : [
          {
            question: `Does ${herbName} interact with medications?`,
            answer: `${herbName} has no well-documented major drug interactions in our database, but always inform your healthcare provider about all supplements you take.`,
          },
        ]),
    {
      question: `What are the side effects of ${herbName}?`,
      answer:
        safetyNotes ||
        `Side effects of ${herbName} are generally mild when used at recommended doses. Consult your healthcare provider for personalized advice.`,
    },
  ];

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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
    />
  );
}
