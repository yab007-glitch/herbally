import type { Locale } from "@/lib/i18n/config";

type SymptomMeta = {
  title: string;
  description: string;
  keywords: string[];
  dbKeyword: string;
  frKeyword: string;
  /**
   * Additional `herbs.symptom_keywords` values this hub matches.
   *
   * The stored taxonomy uses plain words ("blood pressure", "diabetes"), while
   * `dbKeyword` also doubles as the readable match-reason line and keeps its
   * hyphenated display form. Without this list the blood-pressure and
   * blood-sugar hubs matched nothing despite hundreds of tagged herbs.
   */
  queryKeywords?: string[];
};

/**
 * Single source of truth for the symptom hubs.
 *
 * Both `/symptoms` (the index) and `/symptoms/[symptom]` read from here, and
 * the sitemap derives its URLs from `SYMPTOM_SLUGS`. One map means the index
 * can never link to a slug the route does not serve, and a slug can never be
 * added to one without the other.
 */
export const symptomMeta: Record<string, SymptomMeta> = {
  anxiety: {
    title: "Herbs for Anxiety & Stress",
    description:
      "Evidence-based herbs for anxiety and stress relief. Compare effectiveness, safety, and drug interactions for herbs like Ashwagandha, Valerian, and Lavender.",
    keywords: [
      "anxiety herbs",
      "natural anxiety relief",
      "herbs for stress",
      "calming herbs",
      "adaptogens for anxiety",
    ],
    dbKeyword: "anxiety",
    frKeyword: "anxiété",
  },
  depression: {
    title: "Herbs for Depression & Mood",
    description:
      "Evidence-based herbs for depression and mood support. Compare effectiveness, safety, and drug interactions for St. John's Wort, Saffron, and more.",
    keywords: [
      "herbs for depression",
      "natural mood support",
      "st johns wort depression",
      "herbal antidepressants",
    ],
    dbKeyword: "depression",
    frKeyword: "dépression",
  },
  sleep: {
    title: "Herbs for Sleep & Insomnia",
    description:
      "Evidence-based herbs for better sleep. Compare effectiveness, safety, and drug interactions for Valerian, Chamomile, and Melatonin.",
    keywords: [
      "sleep herbs",
      "natural sleep aids",
      "herbs for insomnia",
      "calming herbs for sleep",
      "valerian for sleep",
    ],
    dbKeyword: "sleep",
    frKeyword: "sommeil",
  },
  focus: {
    title: "Herbs for Focus & Memory",
    description:
      "Evidence-based herbs for cognitive enhancement and focus. Compare effectiveness and safety for Ginkgo, Bacopa, Rhodiola, and more.",
    keywords: [
      "herbs for focus",
      "nootropic herbs",
      "cognitive enhancement herbs",
      "bacopa for memory",
      "ginkgo for focus",
    ],
    dbKeyword: "focus",
    frKeyword: "concentration",
  },
  inflammation: {
    title: "Herbs for Inflammation",
    description:
      "Evidence-based anti-inflammatory herbs. Compare effectiveness, safety, and drug interactions for Turmeric, Ginger, Boswellia, and more.",
    keywords: [
      "anti-inflammatory herbs",
      "herbs for inflammation",
      "natural inflammation relief",
      "turmeric benefits",
      "ginger for inflammation",
    ],
    dbKeyword: "inflammation",
    frKeyword: "inflammation",
  },
  joint: {
    title: "Herbs for Joint & Muscle Pain",
    description:
      "Evidence-based herbs for joint pain, arthritis, and muscle soreness. Compare effectiveness and safety for Turmeric, Boswellia, Devil's Claw, and more.",
    keywords: [
      "herbs for joint pain",
      "natural arthritis relief",
      "turmeric for joints",
      "boswellia for arthritis",
      "herbs for muscle pain",
    ],
    dbKeyword: "joint",
    frKeyword: "articulations",
  },
  headache: {
    title: "Herbs for Headaches & Migraines",
    description:
      "Evidence-based herbs for headache and migraine relief. Compare effectiveness and safety for Feverfew, Butterbur, Peppermint, and more.",
    keywords: [
      "herbs for headaches",
      "natural migraine relief",
      "feverfew for migraines",
      "herbal headache remedies",
    ],
    dbKeyword: "headache",
    frKeyword: "maux de tête",
  },
  digestion: {
    title: "Herbs for Digestive Health",
    description:
      "Evidence-based herbs for digestive issues including bloating, nausea, and IBS. Compare effectiveness and safety for Peppermint, Ginger, Fennel, and more.",
    keywords: [
      "herbs for digestion",
      "natural digestive remedies",
      "peppermint for IBS",
      "ginger for nausea",
      "herbs for bloating",
    ],
    dbKeyword: "digestion",
    frKeyword: "digestion",
  },
  liver: {
    title: "Herbs for Liver Health",
    description:
      "Evidence-based herbs for liver support and detoxification. Compare effectiveness and safety for Milk Thistle, Dandelion Root, Turmeric, and more.",
    keywords: [
      "herbs for liver",
      "milk thistle benefits",
      "natural liver detox",
      "liver support herbs",
      "dandelion root for liver",
    ],
    dbKeyword: "liver",
    frKeyword: "foie",
  },
  bloodPressure: {
    title: "Herbs for Blood Pressure",
    description:
      "Evidence-based herbs for blood pressure management. Compare effectiveness and safety for Garlic, Hibiscus, Hawthorn, and more.",
    keywords: [
      "herbs for blood pressure",
      "natural blood pressure remedies",
      "garlic for hypertension",
      "hibiscus for blood pressure",
    ],
    dbKeyword: "blood-pressure",
    queryKeywords: ["blood pressure"],
    frKeyword: "tension artérielle",
  },
  cholesterol: {
    title: "Herbs for Cholesterol",
    description:
      "Evidence-based herbs for cholesterol management. Compare effectiveness and safety for Garlic, Red Yeast Rice, Artichoke, and more.",
    keywords: [
      "herbs for cholesterol",
      "natural cholesterol remedies",
      "garlic for cholesterol",
      "red yeast rice benefits",
    ],
    dbKeyword: "cholesterol",
    frKeyword: "cholestérol",
  },
  circulation: {
    title: "Herbs for Circulation",
    description:
      "Evidence-based herbs for circulation and cardiovascular health. Compare effectiveness and safety for Ginkgo, Cayenne, Horse Chestnut, and more.",
    keywords: [
      "herbs for circulation",
      "ginkgo for circulation",
      "natural circulation remedies",
      "herbs for cardiovascular health",
    ],
    dbKeyword: "circulation",
    frKeyword: "circulation",
  },
  immune: {
    title: "Herbs for Immune Support",
    description:
      "Evidence-based herbs for immune system support. Compare effectiveness and safety for Echinacea, Elderberry, Astragalus, and more.",
    keywords: [
      "herbs for immunity",
      "natural immune support",
      "echinacea benefits",
      "elderberry for colds",
      "adaptogen immune support",
    ],
    dbKeyword: "immune",
    frKeyword: "immunité",
  },
  cold: {
    title: "Herbs for Colds & Flu",
    description:
      "Evidence-based herbs for cold and flu relief. Compare effectiveness and safety for Echinacea, Elderberry, Andrographis, and more.",
    keywords: [
      "herbs for colds",
      "natural flu remedies",
      "echinacea for colds",
      "elderberry for flu",
      "herbs for immunity",
    ],
    dbKeyword: "cold",
    frKeyword: "rhume",
  },
  allergy: {
    title: "Herbs for Allergies",
    description:
      "Evidence-based herbs for allergy relief. Compare effectiveness and safety for Butterbur, Quercetin, Stinging Nettle, and more.",
    keywords: [
      "herbs for allergies",
      "natural allergy relief",
      "butterbur for allergies",
      "quercetin for allergies",
    ],
    dbKeyword: "allergy",
    frKeyword: "allergies",
  },
  menstrual: {
    title: "Herbs for Menstrual Health",
    description:
      "Evidence-based herbs for menstrual cramps, PMS, and cycle support. Compare effectiveness and safety for Vitex, Cramp Bark, Ginger, and more.",
    keywords: [
      "herbs for menstrual cramps",
      "natural PMS relief",
      "vitex for hormones",
      "herbs for period pain",
    ],
    dbKeyword: "menstrual",
    frKeyword: "menstruations",
  },
  menopause: {
    title: "Herbs for Menopause",
    description:
      "Evidence-based herbs for menopause symptom relief. Compare effectiveness and safety for Black Cohosh, Red Clover, Dong Quai, and more.",
    keywords: [
      "herbs for menopause",
      "black cohosh benefits",
      "natural menopause relief",
      "red clover for hot flashes",
    ],
    dbKeyword: "menopause",
    frKeyword: "ménopause",
  },
  hormonal: {
    title: "Herbs for Hormonal Balance",
    description:
      "Evidence-based herbs for hormonal balance and endocrine support. Compare effectiveness and safety for Vitex, Maca, Ashwagandha, and more.",
    keywords: [
      "herbs for hormones",
      "natural hormonal balance",
      "vitex for hormones",
      "maca for hormone balance",
    ],
    dbKeyword: "hormonal",
    queryKeywords: ["hormonal"],
    frKeyword: "hormones",
  },
  skin: {
    title: "Herbs for Skin Health",
    description:
      "Evidence-based herbs for skin conditions including acne, eczema, and wound healing. Compare effectiveness and safety for Tea Tree, Aloe, Calendula, and more.",
    keywords: [
      "herbs for skin",
      "natural skin remedies",
      "tea tree for acne",
      "aloe for skin",
      "calendula for eczema",
    ],
    dbKeyword: "skin",
    frKeyword: "peau",
  },
  wound: {
    title: "Herbs for Wound Healing",
    description:
      "Evidence-based herbs for wound healing and tissue repair. Compare effectiveness and safety for Calendula, Comfrey, Aloe, and more.",
    keywords: [
      "herbs for wounds",
      "natural wound healing",
      "calendula for wounds",
      "comfrey for healing",
    ],
    dbKeyword: "wound",
    frKeyword: "plaies",
  },
  acne: {
    title: "Herbs for Acne",
    description:
      "Evidence-based herbs for acne treatment and prevention. Compare effectiveness and safety for Tea Tree, Zinc, Burdock, and more.",
    keywords: [
      "herbs for acne",
      "natural acne remedies",
      "tea tree for acne",
      "burdock for skin",
    ],
    dbKeyword: "acne",
    frKeyword: "acné",
  },
  nerve: {
    title: "Herbs for Nerve Health",
    description:
      "Evidence-based herbs for nerve health and neuropathy support. Compare effectiveness and safety for St. John's Wort, Lion's Mane, and more.",
    keywords: [
      "herbs for nerves",
      "natural nerve support",
      "lions mane for nerves",
      "st johns wort for neuropathy",
    ],
    dbKeyword: "nerve",
    frKeyword: "nerfs",
  },
  prostate: {
    title: "Herbs for Prostate Health",
    description:
      "Evidence-based herbs for prostate support. Compare effectiveness and safety for Saw Palmetto, Pygeum, Stinging Nettle Root, and more.",
    keywords: [
      "herbs for prostate",
      "saw palmetto for prostate",
      "natural prostate support",
      "pygeum benefits",
    ],
    dbKeyword: "prostate",
    queryKeywords: ["prostate"],
    frKeyword: "prostate",
  },
  diabetes: {
    title: "Herbs for Blood Sugar",
    description:
      "Evidence-based herbs for blood sugar management. Compare effectiveness and safety for Gymnema, Fenugreek, Bitter Melon, and more.",
    keywords: [
      "herbs for diabetes",
      "natural blood sugar support",
      "gymnema for blood sugar",
      "fenugreek for glucose",
    ],
    dbKeyword: "blood-sugar",
    queryKeywords: ["blood sugar", "diabetes"],
    frKeyword: "glycémie",
  },
  constipation: {
    title: "Herbs for Constipation",
    description:
      "Evidence-based herbs for constipation relief. Compare effectiveness and safety for Senna, Cascara, Psyllium, and more.",
    keywords: [
      "herbs for constipation",
      "natural laxatives",
      "senna for constipation",
      "psyllium for digestion",
    ],
    dbKeyword: "constipation",
    frKeyword: "constipation",
  },
  nausea: {
    title: "Herbs for Nausea",
    description:
      "Evidence-based herbs for nausea and upset stomach. Compare effectiveness and safety for Ginger, Peppermint, Fennel, and more.",
    keywords: [
      "herbs for nausea",
      "natural nausea relief",
      "ginger for nausea",
      "peppermint for stomach",
    ],
    dbKeyword: "nausea",
    frKeyword: "nausées",
  },
};

/**
 * Canonical list of symptom route slugs. The sitemap and generateStaticParams
 * derive from this, so the route can never list a slug the page does not serve
 * (the old sitemap emitted `blood-pressure`/`cough`, which 404'd because the
 * real route keys are camelCase and `cough` was never a symptom).
 */
export const SYMPTOM_SLUGS = Object.keys(symptomMeta);

export type { SymptomMeta };

/** Every stored keyword a hub matches: the display key plus its synonyms. */
export function symptomQueryKeywords(slug: string): string[] {
  const meta = symptomMeta[slug];
  if (!meta) return [];
  return [meta.dbKeyword, ...(meta.queryKeywords ?? [])];
}

/** Locale-aware href for a symptom hub (`/symptoms/x` or `/fr/symptoms/x`). */
export function symptomHref(slug: string, locale: Locale): string {
  return locale === "fr" ? `/fr/symptoms/${slug}` : `/symptoms/${slug}`;
}

/**
 * Keyword to display in the symptom hub's match-reason line. The line used to
 * render `dbKeyword` directly, so French pages showed the English database
 * keyword and English pages showed a slug shape for the hyphenated ones
 * ("blood-pressure", "blood-sugar"). `dbKeyword` keeps that display spelling;
 * the query matches on `symptomQueryKeywords()`, which also knows the stored
 * plain-word synonyms.
 */
export function symptomMatchKeyword(slug: string, locale: Locale): string {
  const meta = symptomMeta[slug];
  if (!meta) return slug;
  return locale === "fr" ? meta.frKeyword : meta.dbKeyword.replace(/-/g, " ");
}
