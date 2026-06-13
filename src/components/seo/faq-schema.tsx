interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSchemaProps {
  items: FAQItem[];
}

export function FAQSchema({ items }: FAQSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
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

// Generate FAQ items for an herb page
export function generateHerbFAQs(herb: {
  name: string;
  scientific_name: string;
  evidence_level: string;
  pregnancy_safe: boolean | null;
  nursing_safe: boolean | null;
  traditional_uses: string[];
  modern_uses: string[];
}): FAQItem[] {
  const faqs: FAQItem[] = [
    {
      question: `Is ${herb.name} safe to take?`,
      answer: `${herb.name} (${herb.scientific_name}) is generally considered safe for most adults at recommended doses. Evidence level: ${herb.evidence_level}. Always consult your healthcare provider before starting any herbal supplement.`,
    },
    {
      question: `What is ${herb.name} used for?`,
      answer: `${herb.name} has traditional uses including ${herb.traditional_uses?.slice(0, 3).join(", ") || "various health applications"}. Modern research supports ${herb.modern_uses?.slice(0, 3).join(", ") || "ongoing investigation of its benefits"}.`,
    },
    {
      question: `Can I take ${herb.name} while pregnant or breastfeeding?`,
      answer:
        herb.pregnancy_safe === false || herb.nursing_safe === false
          ? `${herb.name} is not recommended during pregnancy or breastfeeding. Consult your healthcare provider for alternatives.`
          : `Safety data for ${herb.name} during pregnancy and breastfeeding is ${herb.pregnancy_safe === true ? "generally reassuring" : "limited"}. Consult your healthcare provider before use.`,
    },
    {
      question: `Does ${herb.name} interact with medications?`,
      answer: `${herb.name} may interact with certain medications. Check our drug interaction database or consult your healthcare provider, especially if you take prescription medications.`,
    },
  ];

  return faqs;
}
