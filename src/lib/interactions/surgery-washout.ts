export type WashoutCategory =
  "bleeding" | "sedation" | "metabolism" | "cardiovascular" | "glycemic";

export interface SurgeryHerbRule {
  slug: string;
  enName: string;
  frName: string;
  daysBefore: 14 | 7;
  category: WashoutCategory;
  aliases: string[];
  enRationale: string;
  frRationale: string;
}

export const SURGERY_HERB_RULES: SurgeryHerbRule[] = [
  {
    slug: "garlic",
    enName: "Garlic",
    frName: "Ail",
    daysBefore: 7,
    category: "bleeding",
    aliases: ["garlic", "allium sativum", "ail"],
    enRationale:
      "Inhibits platelet aggregation irreversibly via ajoene and allicin derivatives; perioperative clinical guidance commonly advises reviewing concentrated garlic supplements at least 7 days pre-op.",
    frRationale:
      "Inhibe l'agrégation plaquettaire de manière prolongée (ajoène/allicine) ; il est généralement conseillé d'arrêter les suppléments concentrés au moins 7 jours avant l'opération.",
  },
  {
    slug: "ginkgo-biloba",
    enName: "Ginkgo Biloba",
    frName: "Ginkgo biloba",
    daysBefore: 14,
    category: "bleeding",
    aliases: ["ginkgo", "ginkgo biloba", "ginkgo-biloba"],
    enRationale:
      "Ginkgolide B antagonizes platelet-activating factor (PAF), increasing peri-operative bleeding and hematoma risk alongside neuraxial anesthesia.",
    frRationale:
      "Le ginkgolide B inhibe le facteur d'activation plaquettaire (PAF), augmentant le risque de saignement peropératoire et d'hématome.",
  },
  {
    slug: "ginseng",
    enName: "Asian Ginseng",
    frName: "Ginseng asiatique",
    daysBefore: 7,
    category: "glycemic",
    aliases: [
      "ginseng",
      "panax ginseng",
      "american ginseng",
      "american-ginseng",
    ],
    enRationale:
      "Ginsenosides can lower peri-operative blood glucose, interfere with warfarin/coagulation pathways, and cause perioperative hypertension or insomnia.",
    frRationale:
      "Les ginsénosides peuvent abaisser la glycémie pendant le jeûne opératoire, modifier la coagulation et influencer la tension artérielle.",
  },
  {
    slug: "ginger",
    enName: "Ginger (concentrated extract)",
    frName: "Gingembre (extrait concentré)",
    daysBefore: 14,
    category: "bleeding",
    aliases: ["ginger", "zingiber officinale", "gingembre"],
    enRationale:
      "Concentrated extracts inhibit thromboxane synthetase and may prolong bleeding time (culinary tea/cooking amounts differ — confirm exact dose with your surgical team).",
    frRationale:
      "Les extraits concentrés inhibent la thromboxane synthétase et peuvent prolonger le temps de saignement (confirmez la forme exacte avec le chirurgien).",
  },
  {
    slug: "turmeric",
    enName: "Turmeric / Curcumin",
    frName: "Curcuma / Curcumine",
    daysBefore: 14,
    category: "bleeding",
    aliases: ["turmeric", "curcumin", "curcuma", "curcumine"],
    enRationale:
      "High-dose curcumin extracts exhibit antiplatelet activity and CYP450/UGT modulation that can complicate surgical hemostasis and anesthetic clearance.",
    frRationale:
      "La curcumine concentrée possède un effet antiplaquettaire et module les enzymes hépatiques impliquées dans l'élimination des anesthésiques.",
  },
  {
    slug: "st-johns-wort",
    enName: "St. John's Wort",
    frName: "Millepertuis",
    daysBefore: 14,
    category: "metabolism",
    aliases: [
      "st. john's wort",
      "st johns wort",
      "st-johns-wort",
      "hypericum",
      "millepertuis",
    ],
    enRationale:
      "Potent CYP3A4, CYP2C9, CYP2C19, and P-gp inducer: accelerates clearance of midazolam, fentanyl, opioids, anticoagulants, and vasopressors (perioperative literature highlights high interaction risk).",
    frRationale:
      "Puissant inducteur du CYP3A4 et de la P-gp : réduit l'efficacité de nombreux anesthésiques, opioïdes et anticoagulants périopératoires.",
  },
  {
    slug: "kava",
    enName: "Kava",
    frName: "Kava",
    daysBefore: 14,
    category: "sedation",
    aliases: ["kava", "kava kava", "piper methysticum"],
    enRationale:
      "Potentiates GABA-mediated CNS depression from general anesthetics and benzodiazepines, prolonging emergence sedation and adding hepatotoxicity risk.",
    frRationale:
      "Potentialise les anesthésiques généraux et benzodiazépines (sédation prolongée) et expose à une toxicité hépatique additive.",
  },
  {
    slug: "valerian",
    enName: "Valerian",
    frName: "Valériane",
    daysBefore: 14,
    category: "sedation",
    aliases: ["valerian", "valeriana officinalis", "valeriane", "valériane"],
    enRationale:
      "Enhances sedative effects of anesthetics; importantly, chronic heavy users risk benzodiazepine-like withdrawal if stopped abruptly—ask your anesthesiologist about tapering.",
    frRationale:
      "Augmente la sédation anesthésique ; un usage prolongé nécessite un avis médical pour décider d'une diminution progressive plutôt qu'un arrêt brutal.",
  },
  {
    slug: "feverfew",
    enName: "Feverfew",
    frName: "Grande camomille",
    daysBefore: 14,
    category: "bleeding",
    aliases: ["feverfew", "tanacetum parthenium", "grande camomille"],
    enRationale:
      "Parthenolide inhibits platelet granule secretion and aggregation, elevating surgical bleeding risk.",
    frRationale:
      "Le parthénolide freine l'agrégation plaquettaire, augmentant le risque hémorragique opératoire.",
  },
  {
    slug: "saw-palmetto",
    enName: "Saw Palmetto",
    frName: "Palmier nain (Serenoa)",
    daysBefore: 14,
    category: "bleeding",
    aliases: ["saw palmetto", "serenoa repens", "saw-palmetto", "palmier nain"],
    enRationale:
      "Case reports link high-dose saw palmetto extracts to cyclooxygenase inhibition and intraoperative bleeding (especially during urological procedures).",
    frRationale:
      "Des observations cliniques associent cet extrait à des saignements peropératoires accrus (notamment en chirurgie urologique).",
  },
  {
    slug: "dong-quai",
    enName: "Dong Quai (Angelica sinensis)",
    frName: "Dong quai (Angelica sinensis)",
    daysBefore: 14,
    category: "bleeding",
    aliases: ["dong quai", "angelica sinensis", "dang gui"],
    enRationale:
      "Contains natural coumarins and ferulic acid with antiplatelet and PT/INR-prolonging activity.",
    frRationale:
      "Renferme des coumarines et de l'acide férulique susceptibles de prolonger le temps de saignement.",
  },
  {
    slug: "echinacea",
    enName: "Echinacea",
    frName: "Échinacée",
    daysBefore: 14,
    category: "metabolism",
    aliases: ["echinacea", "échinacée", "echinacea purpurea"],
    enRationale:
      "May trigger allergic reactions, modestly inhibit CYP3A4/immunomodulate transplant/immunosuppressive protocols, or stress healing in prolonged courses.",
    frRationale:
      "Peut moduler l'immunité et le CYP3A4 hépatique en période périopératoire (particulièrement important en contexte de greffe ou d'immunosuppression).",
  },
  {
    slug: "licorice-root",
    enName: "Licorice Root",
    frName: "Réglisse (racine)",
    daysBefore: 14,
    category: "cardiovascular",
    aliases: [
      "licorice",
      "licorice root",
      "glycyrrhiza",
      "réglisse",
      "reglisse",
    ],
    enRationale:
      "Whole glycyrrhizin (non-DGL) causes sodium/water retention, hypertension, and hypokalemia—raising arrhythmia risk under anesthesia.",
    frRationale:
      "La glycyrrhizine (hors forme DGL) favorise hypertension et hypokaliémie, ce qui augmente le risque d'arythmie sous anesthésie.",
  },
  {
    slug: "passionflower",
    enName: "Passionflower",
    frName: "Passiflore",
    daysBefore: 14,
    category: "sedation",
    aliases: ["passionflower", "passiflora", "passiflore"],
    enRationale:
      "Additive GABAergic CNS depression may deepen sedation or delay recovery after general anesthesia.",
    frRationale:
      "Peut majorer la sédation des agents anesthésiques généraux et ralentir le réveil postopératoire.",
  },
  {
    slug: "berberine",
    enName: "Berberine",
    frName: "Berbérine",
    daysBefore: 14,
    category: "glycemic",
    aliases: ["berberine", "berbérine", "goldenseal", "hydraste"],
    enRationale:
      "Lowers blood glucose during preoperative NPO fasting and inhibits CYP3A4/CYP2D6 drug clearance.",
    frRationale:
      "Abaisse la glycémie pendant le jeûne préopératoire et inhibe plusieurs enzymes hépatiques (CYP3A4, CYP2D6).",
  },
  {
    slug: "omega3-cardiovasc",
    enName: "Fish Oil / High-Dose Omega-3",
    frName: "Huile de poisson / Oméga-3",
    daysBefore: 14,
    category: "bleeding",
    aliases: ["fish oil", "omega-3", "omega 3", "oméga-3", "epa", "dha"],
    enRationale:
      "High supplemental doses reduce platelet aggregation; discuss continuation vs temporary pause directly with your surgeon (cardiac patients may differ).",
    frRationale:
      "À forte dose, diminue l'agrégation plaquettaire — demandez à votre chirurgien ou cardiologue s'il faut suspendre ou poursuivre.",
  },
  {
    slug: "bitter-orange",
    enName: "Bitter Orange / Ephedra-class stimulants",
    frName: "Orange amère / stimulants",
    daysBefore: 14,
    category: "cardiovascular",
    aliases: [
      "bitter orange",
      "citrus aurantium",
      "ephedra",
      "synephrine",
      "orange amère",
    ],
    enRationale:
      "Sympathomimetic amines raise heart rate and blood pressure and can provoke arrhythmias with volatile anesthetics.",
    frRationale:
      "Les amines sympathomimétiques augmentent le rythme cardiaque et la pression artérielle sous anesthésie.",
  },
];

export interface PlannedWashoutItem {
  rule: SurgeryHerbRule;
  stopDateIso: string; // YYYY-MM-DD
  alreadyPastWindow: boolean;
}

/** Match user free-text herb list against perioperative anesthesia/surgical review rules. */
export function matchSurgeryHerb(input: string): SurgeryHerbRule | null {
  const norm = input.trim().toLowerCase();
  if (!norm) return null;
  for (const rule of SURGERY_HERB_RULES) {
    if (
      rule.slug === norm ||
      rule.aliases.some(
        (a) => norm === a || norm.includes(a) || a.includes(norm)
      )
    ) {
      return rule;
    }
  }
  return null;
}

export function buildSurgeryWashoutPlan(
  surgeryDateIso: string,
  herbInputs: ReadonlyArray<string>,
  referenceTodayIso?: string
): {
  matched: PlannedWashoutItem[];
  unmatched: string[];
  daysUntilSurgery: number;
} | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(surgeryDateIso)) return null;
  const surgeryMs = Date.parse(`${surgeryDateIso}T12:00:00Z`);
  if (!Number.isFinite(surgeryMs)) return null;

  const todayStr =
    referenceTodayIso && /^\d{4}-\d{2}-\d{2}$/.test(referenceTodayIso)
      ? referenceTodayIso
      : new Date().toISOString().slice(0, 10);
  const todayMs = Date.parse(`${todayStr}T12:00:00Z`);
  const daysUntilSurgery = Math.round((surgeryMs - todayMs) / 86_400_000);

  const matched: PlannedWashoutItem[] = [];
  const unmatched: string[] = [];
  const seenSlugs = new Set<string>();

  for (const raw of herbInputs) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const rule = matchSurgeryHerb(trimmed);
    if (!rule) {
      unmatched.push(trimmed);
      continue;
    }
    if (seenSlugs.has(rule.slug)) continue;
    seenSlugs.add(rule.slug);

    const stopMs = surgeryMs - rule.daysBefore * 86_400_000;
    const stopDateIso = new Date(stopMs).toISOString().slice(0, 10);
    const alreadyPastWindow = stopMs <= todayMs;
    matched.push({ rule, stopDateIso, alreadyPastWindow });
  }

  matched.sort((a, b) => b.rule.daysBefore - a.rule.daysBefore);
  return { matched, unmatched, daysUntilSurgery };
}
