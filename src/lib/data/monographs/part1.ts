import type { Monograph } from "./types";

export const monographsPart1: Record<string, Monograph> = {
  // Original 7 premium monographs
  turmeric: {
    slug: "turmeric",
    summary:
      "Turmeric (Curcuma longa) is one of the most extensively studied medicinal herbs, with over 12,000 peer-reviewed publications. Its active compound curcumin demonstrates potent anti-inflammatory and antioxidant effects comparable to some NSAIDs in clinical trials, though bioavailability remains a significant challenge without formulation enhancements.",
    mechanism:
      "Curcumin modulates NF-κB, COX-2, and LOX inflammatory pathways while activating Nrf2 antioxidant response. It also influences epigenetic markers and gut microbiome composition. Bioavailability is enhanced 2,000% with piperine (black pepper extract) and further improved by liposomal or nanoparticle formulations.",
    claims: [
      {
        claim: "Osteoarthritis pain reduction",
        evidence: "A",
        note: "Multiple RCTs show 500mg BCM-95 formulation comparable to ibuprofen",
      },
      {
        claim: "Anti-inflammatory effect",
        evidence: "A",
        note: "NF-κB inhibition demonstrated in vivo and in clinical trials",
      },
      {
        claim: "Metabolic syndrome improvement",
        evidence: "B",
        note: "Meta-analysis shows significant reduction in triglycerides and BMI",
      },
      {
        claim: "Depression symptom improvement",
        evidence: "B",
        note: "Small RCTs comparable to fluoxetine; larger trials needed",
      },
      {
        claim: "Cancer prevention",
        evidence: "C",
        note: "Promising preclinical data but insufficient human RCTs",
      },
      {
        claim: "Alzheimer's prevention",
        evidence: "C",
        note: "Epidemiological support from Indian populations; clinical trials ongoing",
      },
    ],
    safetyNotes: [
      "GI upset common at doses >1,000mg/day",
      "Rare liver injury has been reported with some enhanced-bioavailability curcumin/turmeric supplements. Stop use and seek medical advice for jaundice, dark urine, nausea, unusual fatigue or abdominal pain. This risk has not been associated with typical dietary amounts of turmeric.",
      "Piperine-enhanced formulations may increase drug levels of many medications",
      "May increase bleeding risk; discontinue 2 weeks before surgery",
      "Gallbladder contraction — avoid with gallstones",
    ],
    drugInteractions: [
      {
        drug: "Warfarin/Anticoagulants",
        severity: "moderate",
        detail: "Increased bleeding risk due to antiplatelet effects",
      },
      {
        drug: "Chemotherapy drugs",
        severity: "moderate",
        detail: "May interfere with some chemotherapeutic agents",
      },
    ],
    pregnancyCategory: "caution",
    keyCitations: [
      {
        source: "J Med Food",
        title: "Curcumin and osteoarthritis",
        year: 2016,
      },
      {
        source: "Phytother Res",
        title: "Curcumin efficacy in depression",
        year: 2020,
      },
      {
        source: "WHO",
        title: "WHO Monographs on Selected Medicinal Plants",
        year: 2009,
      },
    ],
  },

  ashwagandha: {
    slug: "ashwagandha",
    summary:
      "Ashwagandha (Withania somnifera) is the flagship adaptogen in Ayurvedic medicine, with strong clinical evidence for stress reduction and anxiolysis. KSM-66® and Sensoril® extracts have the most robust trial data, showing cortisol reduction of 14.5-30% and significant improvements in perceived stress scales.",
    mechanism:
      "Withanolides (particularly withaferin A and withanolide D) modulate GABA-A receptors, reduce cortisol via HPA axis regulation, and activate Nrf2 antioxidant pathways. Root extracts (KSM-66) favor anxiolytic effects while leaf extracts (Sensoril) favor stress/adaptogenic effects.",
    claims: [
      {
        claim: "Stress and anxiety reduction",
        evidence: "A",
        note: "Multiple RCTs with KSM-66 showing significant cortisol reduction",
      },
      {
        claim: "Sleep quality improvement",
        evidence: "B",
        note: "RCTs show improved sleep onset latency and quality",
      },
      {
        claim: "Testosterone and fertility in men",
        evidence: "B",
        note: "RCTs show 10-17% increase in testosterone in healthy men",
      },
      {
        claim: "Athletic performance",
        evidence: "B",
        note: "RCTs show improved VO2 max and strength; some studies conflict",
      },
      {
        claim: "Thyroid function support",
        evidence: "C",
        note: "Small studies suggest T3/T4 normalization in subclinical hypothyroidism",
      },
      {
        claim: "Cognitive enhancement",
        evidence: "C",
        note: "Preliminary evidence for memory; more trials needed",
      },
    ],
    safetyNotes: [
      "Generally well-tolerated at standard doses (300-600mg root extract)",
      "May cause GI upset in 5-10% of users",
      "Nightshade family — avoid with nightshade sensitivity",
      "Can overstimulate thyroid in hyperthyroid patients",
    ],
    drugInteractions: [
      {
        drug: "Sedatives",
        severity: "moderate",
        detail: "May enhance sedation due to GABA effects",
      },
      {
        drug: "Thyroid medications",
        severity: "moderate",
        detail: "May increase thyroid hormone levels",
      },
      {
        drug: "Immunosuppressants",
        severity: "mild",
        detail: "Immunomodulatory effects may interfere",
      },
    ],
    pregnancyCategory: "unsafe",
    keyCitations: [
      {
        source: "Indian J Psychol Med",
        title:
          "A prospective, randomized double-blind, placebo-controlled study of safety and efficacy of a high-concentration full-spectrum extract of Ashwagandha",
        year: 2012,
      },
      {
        source: "J Ethnopharmacol",
        title: "Withania somnifera root extract for stress",
        year: 2019,
      },
    ],
  },

  ginger: {
    slug: "ginger",
    summary:
      "Ginger (Zingiber officinale) has Level A evidence for nausea and vomiting, making it one of the most clinically validated herbs. Over 100 RCTs support its antiemetic efficacy, particularly for pregnancy-associated nausea and post-operative nausea.",
    mechanism:
      "Gingerols and shogaols inhibit COX-2 and 5-LOX inflammatory pathways, activate serotonin 5-HT3 receptors in the gut (antiemetic), and accelerate gastric emptying. Fresh ginger has higher gingerol content; dried ginger has more shogaols.",
    claims: [
      {
        claim: "Pregnancy nausea reduction",
        evidence: "A",
        note: "Multiple systematic reviews confirm efficacy at 1-1.5g/day",
      },
      {
        claim: "Post-operative nausea prevention",
        evidence: "A",
        note: "Cochrane review supports 1g pre-operative dose",
      },
      {
        claim: "Chemotherapy-induced nausea",
        evidence: "B",
        note: "Benefits as adjunct to standard antiemetics",
      },
      {
        claim: "Motion sickness prevention",
        evidence: "C",
        note: "Traditional use; limited clinical evidence",
      },
      {
        claim: "Osteoarthritis pain reduction",
        evidence: "B",
        note: "Meta-analysis shows efficacy comparable to some NSAIDs",
      },
      {
        claim: "Dysmenorrhea",
        evidence: "B",
        note: "RCTs show efficacy similar to ibuprofen",
      },
    ],
    safetyNotes: [
      "Level A safety for pregnancy nausea up to 1.5g/day",
      "High doses (>4g/day) may increase bleeding risk",
      "May lower blood glucose — monitor in diabetics",
      "May lower blood pressure",
    ],
    drugInteractions: [
      {
        drug: "Anticoagulants",
        severity: "moderate",
        detail: "High doses may increase bleeding risk",
      },
      {
        drug: "Antidiabetic medications",
        severity: "mild",
        detail: "May enhance hypoglycemic effects",
      },
      {
        drug: "Antihypertensives",
        severity: "mild",
        detail: "May enhance hypotensive effects",
      },
    ],
    pregnancyCategory: "safe",
    keyCitations: [
      { source: "Obstet Gynecol", title: "Ginger in pregnancy", year: 2005 },
      {
        source: "Cochrane Database",
        title: "Interventions for nausea and vomiting in early pregnancy",
        year: 2015,
      },
    ],
  },

  chamomile: {
    slug: "chamomile",
    summary:
      "Chamomile (Matricaria chamomilla) is one of the most widely consumed herbal teas globally, with Level B evidence for anxiety and sleep disorders. Its gentle sedative effects make it suitable for all ages, including children.",
    mechanism:
      "Apigenin binds to benzodiazepine receptors (BZD) in the CNS, producing anxiolytic effects without sedation, dependence, or tolerance. Matricin and chamazulene provide anti-inflammatory effects via COX inhibition.",
    claims: [
      {
        claim: "Generalized anxiety",
        evidence: "B",
        note: "RCTs show significant HAM-A reduction",
      },
      {
        claim: "Sleep quality improvement",
        evidence: "B",
        note: "Improves sleep latency in insomnia",
      },
      {
        claim: "Oral mucositis",
        evidence: "B",
        note: "German Commission E approved for oral mucosa inflammation",
      },
      {
        claim: "Colic in infants",
        evidence: "B",
        note: "Meta-analysis shows symptom improvement",
      },
      {
        claim: "GI spasm",
        evidence: "C",
        note: "Traditional antispasmodic use",
      },
    ],
    safetyNotes: [
      "Generally recognized as safe (GRAS) for food use",
      "Asteraceae allergy — avoid in ragweed allergy",
      "Mild GI upset in some users",
      "Safe for children (tea form)",
    ],
    drugInteractions: [
      {
        drug: "Sedatives",
        severity: "mild",
        detail: "Theoretical additive CNS depression",
      },
      {
        drug: "Warfarin",
        severity: "mild",
        detail: "Case reports of increased INR",
      },
    ],
    pregnancyCategory: "caution",
    keyCitations: [
      {
        source: "J Clin Psychopharmacol",
        title: "Chamomile for generalized anxiety",
        year: 2009,
      },
      {
        source: "Commission E",
        title: "Chamomile flower monograph",
        year: 1984,
      },
    ],
  },

  echinacea: {
    slug: "echinacea",
    summary:
      "Echinacea (Echinacea purpurea/pallida/angustifolia) is the most popular herb for immune support, though clinical evidence is mixed. E. purpurea aerial parts have the strongest evidence for cold prevention and treatment.",
    mechanism:
      "Alkamides, caffeic acid derivatives (echinacoside), and polysaccharides modulate immune function. Echinacea stimulates phagocytosis, increases white blood cell counts, and has mild anti-inflammatory effects. It does NOT significantly boost cytokines.",
    claims: [
      {
        claim: "Common cold duration reduction",
        evidence: "B",
        note: "Cochrane: modest 1.4-day reduction if started early",
      },
      {
        claim: "Common cold prevention",
        evidence: "C",
        note: "Daily use shows modest preventive effect",
      },
      {
        claim: "Immune support",
        evidence: "B",
        note: "Increases phagocytic activity",
      },
      {
        claim: "Upper respiratory infections",
        evidence: "B",
        note: "Modest effect on severity",
      },
    ],
    safetyNotes: [
      "E. purpurea aerial parts have best evidence",
      "Avoid in autoimmune conditions and immunosuppression",
      "Rare allergic reactions in asteraceae sensitivity",
      "Start at first sign of illness for best effect",
    ],
    drugInteractions: [
      {
        drug: "Immunosuppressants",
        severity: "contraindicated",
        detail: "May counteract immunosuppression",
      },
      {
        drug: "Caffeine",
        severity: "mild",
        detail: "May slow caffeine metabolism",
      },
    ],
    pregnancyCategory: "caution",
    keyCitations: [
      {
        source: "Cochrane Database",
        title: "Echinacea for preventing and treating the common cold",
        year: 2014,
      },
      {
        source: "Lancet Infect Dis",
        title: "Safety and efficacy of echinacea",
        year: 2007,
      },
    ],
  },

  valerian: {
    slug: "valerian",
    summary:
      "Valerian (Valeriana officinalis) root is the most studied herbal sleep aid, with over 200 trials. While individual studies are often positive, meta-analyses show mixed results. It's generally considered safe and non-habit forming.",
    mechanism:
      "Valerenic acid and isovaleric acid inhibit GABA-transaminase (GABA-T), increasing GABA availability. Other constituents (valepotriates, lignans) may contribute to sedative effects. Does NOT bind to benzodiazepine receptors.",
    claims: [
      {
        claim: "Sleep latency reduction",
        evidence: "B",
        note: "Modest effect; may take 2-4 weeks",
      },
      {
        claim: "Sleep quality improvement",
        evidence: "B",
        note: "Subjective improvement in sleep quality",
      },
      {
        claim: "Anxiety reduction",
        evidence: "C",
        note: "Limited evidence for daytime anxiety",
      },
      {
        claim: "Menopausal sleep disturbance",
        evidence: "B",
        note: "Small RCTs show benefit",
      },
    ],
    safetyNotes: [
      "May take 2-4 weeks for full effect",
      "Morning grogginess reported by some users",
      "Raw herb has strong odor",
      "Generally non-habit forming",
      "Avoid with other sedatives",
    ],
    drugInteractions: [
      {
        drug: "Benzodiazepines",
        severity: "moderate",
        detail: "Additive sedation",
      },
      {
        drug: "Barbiturates",
        severity: "moderate",
        detail: "Additive sedation",
      },
      {
        drug: "Alcohol",
        severity: "moderate",
        detail: "Additive CNS depression",
      },
    ],
    pregnancyCategory: "unsafe",
    keyCitations: [
      {
        source: "Am J Med",
        title: "Valerian for sleep: a systematic review",
        year: 2006,
      },
      {
        source: "Cochrane Database",
        title: "Valerian for anxiety",
        year: 2006,
      },
    ],
  },

  "milk-thistle": {
    slug: "milk-thistle",
    summary:
      "Milk Thistle (Silybum marianum) is the most researched hepatoprotective herb, with silymarin extract showing Level A evidence for liver protection against toxins.",
    mechanism:
      "Silymarin stabilizes hepatocyte membranes, stimulates protein synthesis and hepatocyte regeneration, and inhibits NF-κB inflammatory pathway. Phosphatidylcholine complexes (silipide) improve bioavailability 3-5x.",
    claims: [
      {
        claim: "Toxin-induced liver injury",
        evidence: "A",
        note: "Strong evidence for Amanita mushroom poisoning",
      },
      {
        claim: "NAFLD",
        evidence: "B",
        note: "Meta-analyses show reduced ALT/AST",
      },
      {
        claim: "Alcoholic liver disease",
        evidence: "B",
        note: "Cochrane: reduced mortality",
      },
      {
        claim: "Diabetes",
        evidence: "C",
        note: "Small RCTs show improved HbA1c",
      },
    ],
    safetyNotes: [
      "Generally very safe; rare GI upset",
      "Allergic reactions in asteraceae-sensitive individuals",
      "May have estrogenic effects",
      "Low oral bioavailability; use standardized extract",
    ],
    drugInteractions: [
      {
        drug: "CYP substrates",
        severity: "mild",
        detail: "May inhibit CYP enzymes",
      },
    ],
    pregnancyCategory: "caution",
    keyCitations: [
      {
        source: "JAMA",
        title: "Milk thistle for alcoholic liver disease",
        year: 1998,
      },
      {
        source: "Cochrane Database",
        title:
          "Milk thistle for alcoholic and/or hepatitis B or C liver diseases",
        year: 2007,
      },
    ],
  },

  // New 13 premium monographs
  "ginkgo-biloba": {
    slug: "ginkgo-biloba",
    summary:
      "Ginkgo (Ginkgo biloba) is the oldest living tree species with documented medicinal use spanning over 5,000 years. Standardized extracts (24% flavone glycosides, 6% terpene lactones) are among the most studied botanicals for cognitive health.",
    mechanism:
      "Ginkgolides are potent PAF antagonists, reducing platelet aggregation. Bilobalide protects mitochondrial function. Flavonoids scavenge free radicals. Also modulates neurotransmitter systems and increases BDNF expression.",
    claims: [
      {
        claim: "Age-related cognitive decline",
        evidence: "B",
        note: "Modest effect; EGb761 extract shows benefit",
      },
      {
        claim: "Dementia",
        evidence: "B",
        note: "Systematic reviews show inconsistent results",
      },
      {
        claim: "Intermittent claudication",
        evidence: "B",
        note: "Modest increase in walking distance",
      },
      {
        claim: "Antioxidant support",
        evidence: "B",
        note: "Well-documented free radical scavenging",
      },
    ],
    safetyNotes: [
      "Contraindicated with anticoagulants",
      "Discontinue 7 days before surgery",
      "May increase seizure risk",
      "Standardized extract: 120-240mg daily",
    ],
    drugInteractions: [
      {
        drug: "Warfarin",
        severity: "moderate",
        detail: "Increased bleeding risk",
      },
      {
        drug: "Aspirin/NSAIDs",
        severity: "moderate",
        detail: "Additive antiplatelet effects",
      },
      {
        drug: "Antidepressants",
        severity: "moderate",
        detail: "Theoretical serotonin syndrome risk",
      },
    ],
    pregnancyCategory: "unsafe",
    keyCitations: [
      {
        source: "Cochrane",
        title: "Ginkgo biloba for cognitive impairment",
        year: 2022,
      },
      {
        source: "JAMA",
        title: "Ginkgo biloba and risk of dementia",
        year: 2009,
      },
    ],
  },

  "st-johns-wort": {
    slug: "st-johns-wort",
    summary:
      "St. John's Wort (Hypericum perforatum) is the most extensively studied botanical antidepressant, with Level A evidence for mild to moderate depression. Standardized extracts (0.3% hypericin, 2-4% hyperforin) demonstrate efficacy comparable to SSRIs.",
    mechanism:
      "Hyperforin inhibits serotonin, norepinephrine, and dopamine reuptake non-competitively. Also modulates NMDA receptors. St. John's Wort is a potent CYP3A4 and P-glycoprotein inducer, explaining many drug interactions.",
    claims: [
      {
        claim: "Mild to moderate depression",
        evidence: "A",
        note: "Cochrane: superior to placebo, equivalent to SSRIs",
      },
      {
        claim: "Severe major depression",
        evidence: "D",
        note: "Not effective; insufficient evidence",
      },
      {
        claim: "Somatoform disorders",
        evidence: "B",
        note: "Some positive trials",
      },
    ],
    safetyNotes: [
      "Extensive drug interactions via CYP3A4 and P-gp induction",
      "Photosensitivity with high doses",
      "May trigger mania in bipolar disorder",
      "4-6 weeks required for antidepressant effects",
    ],
    drugInteractions: [
      {
        drug: "Oral contraceptives",
        severity: "contraindicated",
        detail: "Reduced efficacy",
      },
      {
        drug: "Antidepressants",
        severity: "contraindicated",
        detail: "Serotonin syndrome risk",
      },
      {
        drug: "Warfarin",
        severity: "contraindicated",
        detail: "Reduced anticoagulant effect",
      },
      {
        drug: "HIV medications",
        severity: "contraindicated",
        detail: "Reduced drug levels",
      },
      {
        drug: "Cyclosporine",
        severity: "contraindicated",
        detail: "Organ rejection risk",
      },
      {
        drug: "Digoxin",
        severity: "severe",
        detail: "Reduced levels via P-gp induction",
      },
    ],
    pregnancyCategory: "unsafe",
    keyCitations: [
      {
        source: "Cochrane",
        title: "St John's wort for major depression",
        year: 2008,
      },
      {
        source: "Lancet",
        title: "Drug interactions with St. John's Wort",
        year: 2000,
      },
    ],
  },

  garlic: {
    slug: "garlic",
    summary:
      "Garlic (Allium sativum) is one of the most researched botanicals for cardiovascular health. Aged garlic extract (AGE) and standardized powders demonstrate consistent effects on cholesterol and blood pressure. Allicin and S-allyl cysteine (SAC) are the primary bioactive compounds. Meta-analyses show modest but significant reductions in total cholesterol (15-25 mg/dL), LDL (10-20 mg/dL), and blood pressure (8-10 mmHg systolic). It also demonstrates antiplatelet and antimicrobial properties.",
    mechanism:
      "Allicin, formed when alliin contacts alliinase (enzyme), is the primary active compound but is unstable. Aged garlic extract contains S-allyl cysteine (SAC) and S-allyl mercaptocysteine, which are more bioavailable. Garlic inhibits HMG-CoA reductase (statin-like effect), reduces cholesterol synthesis, and enhances bile acid excretion. It activates nitric oxide synthase, improving endothelial function and vasodilation. Antiplatelet effects inhibit thromboxane A2 synthesis. Antimicrobial activity involves thiol modification in pathogens.",
    claims: [
      {
        claim: "Hyperlipidemia",
        evidence: "A",
        note: "Meta-analyses: 15-25 mg/dL total cholesterol reduction",
      },
      {
        claim: "Hypertension",
        evidence: "A",
        note: "8-10 mmHg systolic, 5-6 mmHg diastolic reduction",
      },
      {
        claim: "Atherosclerosis progression",
        evidence: "B",
        note: "AGE shows reduced plaque progression",
      },
      {
        claim: "Antimicrobial (topical)",
        evidence: "B",
        note: "Documented antibacterial, antifungal activity",
      },
      {
        claim: "Common cold prevention",
        evidence: "C",
        note: "Limited evidence; may modestly reduce incidence",
      },
      {
        claim: "Platelet aggregation inhibition",
        evidence: "B",
        note: "Well-documented antiplatelet effects",
      },
    ],
    safetyNotes: [
      "Discontinue 7-14 days before surgery due to bleeding risk",
      "Aged garlic extract (AGE) preferred for cardiovascular studies",
      "Raw garlic may cause GI upset, body odor",
      "Typical dose: 600-1200mg AGE daily (Kyolic)",
      "Enteric-coated tablets reduce garlic breath",
    ],
    drugInteractions: [
      {
        drug: "Warfarin/Anticoagulants",
        severity: "moderate",
        detail: "Increased bleeding risk",
      },
      {
        drug: "Antiplatelets (aspirin, clopidogrel)",
        severity: "moderate",
        detail: "Additive antiplatelet effects",
      },
      {
        drug: "Protease inhibitors",
        severity: "moderate",
        detail: "Reduced drug levels",
      },
    ],
    pregnancyCategory: "safe",
    keyCitations: [
      {
        source: "J Nutr",
        title: "Garlic and cardiovascular disease",
        url: "https://academic.oup.com/jn",
        year: 2016,
      },
      {
        source: "Cochrane",
        title: "Garlic for hypertension",
        url: "https://www.cochranelibrary.com",
        year: 2016,
      },
      {
        source: "J Am Coll Nutr",
        title: "Garlic and lipids meta-analysis",
        year: 2000,
      },
      {
        source: "Commission E",
        title: "Allii sativi bulbus monograph",
        year: 1988,
      },
    ],
  },
};
