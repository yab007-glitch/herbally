/**
 * Shared fallback FAQ builder for herb pages, used by BOTH the visible
 * <HerbFaqSection> and the <HerbFAQSchema> JSON-LD so the two can never
 * drift (Google ignores FAQPage markup that doesn't match visible text).
 *
 * `t` is any translator for the `herbFaq` namespace: the client section
 * passes next-intl's useTranslations("herbFaq"), the server page passes
 * getTranslations({ locale, namespace: "herbFaq" }).
 */
export interface HerbFallbackFaqInput {
  herbName: string;
  scientificName: string;
  uses: string[];
  safetyNotes: string;
  pregnancyCategory: string;
  drugInteractions: number;
  commonNames?: string[];
  isDangerous?: boolean;
  showCalculator?: boolean;
}

export interface HerbFallbackFaq {
  question: string;
  answer: string;
}

export function buildHerbFallbackFaqs(
  input: HerbFallbackFaqInput,
  t: (key: string, params?: Record<string, string | number>) => string
): HerbFallbackFaq[] {
  const {
    herbName,
    scientificName,
    uses,
    safetyNotes,
    pregnancyCategory,
    drugInteractions,
    commonNames = [],
    isDangerous = false,
    showCalculator = true,
  } = input;
  const topUses = uses.slice(0, 3).map((u) => u.toLowerCase());
  const usesText = topUses.length > 0 ? topUses.join(", ") : t("usesFallback");

  const pregnancyText = (() => {
    if (isDangerous) return t("pregUnsafe", { name: herbName });
    switch (pregnancyCategory) {
      case "safe":
        return t("pregSafe", { name: herbName });
      case "caution":
        return t("pregCaution", { name: herbName });
      case "unsafe":
        return t("pregUnsafe", { name: herbName });
      default:
        return t("pregUnknown", { name: herbName });
    }
  })();

  return [
    ...(commonNames.length > 0
      ? [
          {
            question: t("whatIs", { name: herbName }),
            answer: t("knownAs", {
              name: herbName,
              scientific: scientificName,
              commons: commonNames.slice(0, 3).join(", "),
              uses: usesText,
            }),
          },
        ]
      : [
          {
            question: t("usedFor", {
              name: herbName,
              scientific: scientificName,
            }),
            answer: t("usedForAnswer", {
              name: herbName,
              scientific: scientificName,
              uses: usesText,
            }),
          },
        ]),
    {
      question: t("pregQuestion", { name: herbName }),
      answer: pregnancyText,
    },
    {
      question: t("interactQuestion", { name: herbName }),
      answer:
        drugInteractions > 0
          ? t("interactSome", {
              name: herbName,
              count: drugInteractions,
              notes: safetyNotes || t("interactFallbackNotes"),
            })
          : t("interactNone", { name: herbName }),
    },
    {
      question: t("sideEffects", { name: herbName }),
      answer: isDangerous
        ? t("sideEffectsDangerous", { name: herbName })
        : safetyNotes || t("sideEffectsFallback", { name: herbName }),
    },
    ...(!isDangerous && showCalculator
      ? [
          {
            question: t("doseQuestion", { name: herbName }),
            answer: t("doseAnswer", { name: herbName }),
          },
        ]
      : []),
  ];
}
