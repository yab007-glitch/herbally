import type { Monograph } from "./types";

export const monographsPart2: Record<string, Monograph> = {
  "saw-palmetto": {
    slug: "saw-palmetto",
    summary:
      "Saw Palmetto (Serenoa repens) is widely used for benign prostatic hyperplasia (BPH), but high-quality clinical trials and the 2023 Cochrane review conclude that saw palmetto provides little or no benefit over placebo for lower urinary tract symptoms.",
    mechanism:
      "Liposterolic extract shows in-vitro 5-alpha-reductase inhibition and anti-inflammatory effects, though clinically meaningful urinary symptom relief has not been confirmed in rigorous trials. Unlike finasteride, it does not lower serum PSA.",
    claims: [
      {
        claim: "BPH urinary symptoms",
        evidence: "D",
        note: "Cochrane 2023 & NCCIH: little or no improvement over placebo",
      },
      {
        claim: "Nocturia",
        evidence: "D",
        note: "High-quality trials show no clinically meaningful difference vs placebo",
      },
      {
        claim: "PSA neutrality",
        evidence: "B",
        note: "Does not mask PSA screening values unlike finasteride",
      },
    ],
    safetyNotes: [
      "Does not replace medical evaluation of urinary symptoms or prostate enlargement",
      "May increase bleeding risk; rare cases of acute pancreatitis and cholestatic liver injury reported",
      "Typical trial dose: 160mg BID liposterolic extract",
      "May increase bleeding risk; disclose use to your surgeon or anesthesiologist before scheduled surgery",
    ],
    drugInteractions: [
      {
        drug: "Finasteride",
        severity: "mild",
        detail: "Avoid redundant anti-androgen use",
      },
      {
        drug: "Warfarin / Aspirin",
        severity: "moderate",
        detail: "Potential increased bleeding/bruising risk; monitor",
      },
    ],
    pregnancyCategory: "unsafe",
    keyCitations: [
      {
        source: "Cochrane",
        title: "Serenoa repens for benign prostatic enlargement (2023 update)",
        year: 2023,
      },
      {
        source: "N Engl J Med",
        title: "STEP trial: Saw palmetto for BPH",
        year: 2006,
      },
      {
        source: "JAMA",
        title: "CAMUS trial: High-dose saw palmetto vs placebo",
        year: 2011,
      },
    ],
  },

  cranberry: {
    slug: "cranberry",
    summary:
      "Cranberry (Vaccinium macrocarpon) has Level A evidence for preventing recurrent UTIs in healthy women, children, and susceptible adults following interventions, but the 2023 Cochrane review found insufficient or no clear benefit in pregnant women, elderly institutionalized adults, or neurogenic bladder. Cranberry does NOT treat active UTIs.",
    mechanism:
      "A-type proanthocyanidins (PACs) are the active constituents, distinct from B-type PACs in other berries. They inhibit P-fimbriae adhesion of uropathogenic E. coli (UPEC) to uroepithelial cells by binding to bacterial adhesins. This anti-adhesion effect is dose-dependent and requires minimum 36mg PACs daily. Cranberry also acidifies urine slightly and may have quorum-sensing inhibition. The effect is bacterial-specific and doesn't significantly alter vaginal or gut microbiome. Antioxidant effects come from flavonols, anthocyanins, and phenolic acids.",
    claims: [
      {
        claim: "UTI prevention (recurrent)",
        evidence: "A",
        note: "Cochrane 2023: reduces UTI recurrence in women with recurrent UTIs; no clear benefit proven in pregnancy or elderly/catheter cohorts",
      },
      {
        claim: "UTI treatment",
        evidence: "D",
        note: "Does NOT treat active UTIs — seek prompt antibiotic care",
      },
      {
        claim: "Bacterial anti-adhesion",
        evidence: "A",
        note: "Well-documented mechanism",
      },
      {
        claim: "Cardiovascular (antioxidant)",
        evidence: "C",
        note: "Preliminary evidence for vascular function",
      },
      {
        claim: "Dental plaque prevention",
        evidence: "C",
        note: "May reduce bacterial adhesion in oral cavity",
      },
    ],
    safetyNotes: [
      "Does NOT treat active UTIs — do not delay or replace prescribed antibiotics",
      "Requires minimum 36mg PACs daily for recurrent-UTI prophylaxis",
      "Concentrated cranberry extracts lack conclusive safety data in pregnancy (Cochrane 2023 found no clear UTI benefit in pregnant women)",
      "High oxalate content — caution with kidney stones",
      "Well-tolerated; GI upset at high doses",
    ],
    drugInteractions: [
      {
        drug: "Warfarin",
        severity: "moderate",
        detail: "Rare case reports of increased INR; monitor",
      },
      {
        drug: "Tacrolimus",
        severity: "moderate",
        detail:
          "Case reports suggest reduced tacrolimus blood levels; monitor closely",
      },
      {
        drug: "H2 blockers/PPIs",
        severity: "mild",
        detail: "May reduce PAC absorption",
      },
    ],
    pregnancyCategory: "caution",
    keyCitations: [
      {
        source: "Cochrane",
        title: "Cranberries for preventing urinary tract infections",
        url: "https://www.cochranelibrary.com",
        year: 2023,
      },
      {
        source: "JAMA",
        title: "Cranberry for UTI prevention in elderly",
        year: 2016,
      },
      {
        source: "Am J Clin Nutr",
        title: "Cranberry PACs and bacterial anti-adhesion",
        year: 2010,
      },
      { source: "NCCIH", title: "Cranberry Fact Sheet", year: 2024 },
    ],
  },

  rhodiola: {
    slug: "rhodiola",
    summary:
      "Rhodiola (Rhodiola rosea) is traditionally used in European herbal medicine for temporary stress and fatigue, though NCCIH notes available clinical trials remain low to moderate in methodological quality and mostly short-term (up to 12 weeks). EMA recommends 144–400 mg/day standardized extract.",
    mechanism:
      "Rhodiola contains rosavins (rosavin, rosin, rosarin—unique to R. rosea) and salidroside (rhodioloside). Rosavins predominate in the root; salidroside is more concentrated in the rhizome. The mechanism involves modulation of the hypothalamic-pituitary-adrenal (HPA) axis, reducing cortisol response to stress. It increases beta-endorphins and monoamines (serotonin, dopamine, norepinephrine). Rhodiola also enhances mitochondrial function and ATP production. MAO-A inhibition may contribute to mood effects. The adaptogenic effect is bidirectional—normalizing both high and low cortisol states.",
    claims: [
      {
        claim: "Stress-related fatigue",
        evidence: "B",
        note: "Improves physical/cognitive fatigue under stress",
      },
      {
        claim: "Physical performance",
        evidence: "B",
        note: "May enhance endurance; mixed evidence for strength",
      },
      {
        claim: "Mild depression",
        evidence: "B",
        note: "Small positive trials; faster onset than SSRIs",
      },
      {
        claim: "Cognitive fatigue",
        evidence: "B",
        note: "Improves mental performance under stress",
      },
      { claim: "Anxiety", evidence: "C", note: "Limited evidence" },
      {
        claim: "Burnout",
        evidence: "B",
        note: "Improves burnout symptoms in healthcare workers",
      },
    ],
    safetyNotes: [
      "EMA posology: 144-400 mg/day; consult a doctor if symptoms persist beyond 2 weeks (NCCIH trial safety data ~6-12 weeks)",
      "Stimulating — take in the morning to minimize insomnia",
      "Avoid in bipolar disorder (may trigger hypomania/mania)",
      "Avoid in pregnancy, breastfeeding, and children under 18 due to lack of data",
      "Generally well tolerated; rare anxiety, dizziness, or insomnia",
    ],
    drugInteractions: [
      {
        drug: "Antidepressants (SSRIs/MAOIs)",
        severity: "moderate",
        detail:
          "Possible serotonin syndrome or additive MAO inhibition — avoid or monitor closely",
      },
      {
        drug: "Warfarin / CYP2C9 substrates",
        severity: "moderate",
        detail:
          "May inhibit CYP2C9 or alter drug levels (e.g., warfarin, losartan); monitor INR",
      },
      {
        drug: "Stimulants",
        severity: "mild",
        detail: "Possible additive CNS stimulation",
      },
      {
        drug: "Hypoglycemics",
        severity: "mild",
        detail: "May lower blood glucose",
      },
    ],
    pregnancyCategory: "unsafe",
    keyCitations: [
      {
        source: "Phytomedicine",
        title: "Rhodiola rosea in stress-induced fatigue",
        url: "https://www.sciencedirect.com",
        year: 2009,
      },
      {
        source: "BMC Complement Med Ther",
        title: "Rhodiola for physical performance",
        year: 2019,
      },
      {
        source: "Nord J Psychiatry",
        title: "Rhodiola for mild to moderate depression",
        year: 2015,
      },
      { source: "NCCIH", title: "Rhodiola rosea Fact Sheet", year: 2024 },
    ],
  },

  "green-tea": {
    slug: "green-tea",
    summary:
      "Green Tea (Camellia sinensis) beverage consumption is associated with cardiovascular and cognitive benefits in observational studies, though NCCIH notes definite clinical conclusions cannot yet be drawn from controlled human trials. Concentrated EGCG extracts require adults-only hepatotoxicity precautions.",
    mechanism:
      "EGCG inhibits COMT, modulates cell signaling pathways, and has antioxidant activity. Caffeine-theanine combination enhances alpha brain wave activity.",
    claims: [
      {
        claim: "Cognitive function",
        evidence: "B",
        note: "NCCIH: suggestive alertness/attention benefits; definite conclusions cannot yet be reached",
      },
      {
        claim: "Cardiovascular risk",
        evidence: "B",
        note: "Observational associations with habitual tea drinking; limited interventional confirmation",
      },
      {
        claim: "Weight management",
        evidence: "C",
        note: "Cochrane: modest, non-clinically significant weight effect",
      },
      {
        claim: "Type 2 diabetes",
        evidence: "B",
        note: "May improve insulin sensitivity",
      },
    ],
    safetyNotes: [
      "Concentrated extracts supplying at or above 800 mg EGCG/day are linked to rare severe hepatotoxicity (EFSA); Health Canada requires adults-only (18+) labeling",
      "Stop use and consult a physician if symptoms of liver trouble develop (yellowing of skin/eyes, dark urine, stomach pain, unusual tiredness)",
      "Do not take concentrated green tea extracts on an empty stomach",
      "Brewed tea caffeine content: ~25-35 mg per cup",
    ],
    drugInteractions: [
      {
        drug: "Atorvastatin",
        severity: "moderate",
        detail:
          "High doses of green tea extracts may reduce blood levels of atorvastatin (NCCIH)",
      },
      {
        drug: "Nadolol",
        severity: "moderate",
        detail:
          "Significantly reduces plasma levels and blood-pressure effect of nadolol via OATP inhibition (NCCIH)",
      },
      {
        drug: "Raloxifene",
        severity: "moderate",
        detail: "May reduce systemic bioavailability",
      },
      {
        drug: "Bortezomib",
        severity: "severe",
        detail:
          "EGCG directly binds and inactivates bortezomib chemotherapy — avoid concurrent green tea extracts",
      },
      {
        drug: "Warfarin",
        severity: "moderate",
        detail:
          "High vitamin K in whole leaf/matcha or high-dose extracts may alter INR",
      },
      {
        drug: "Iron supplements",
        severity: "mild",
        detail: "Catechins reduce non-heme iron absorption",
      },
    ],
    pregnancyCategory: "caution",
    keyCitations: [
      {
        source: "Am J Clin Nutr",
        title: "Green tea and cardiovascular disease",
        year: 2020,
      },
      { source: "Cochrane", title: "Green tea for weight loss", year: 2012 },
    ],
  },

  peppermint: {
    slug: "peppermint",
    summary:
      "Peppermint (Mentha × piperita) is a hybrid of water mint and spearmint with well-established use for digestive complaints. Enteric-coated peppermint oil (ECPO) is the pharmaceutical-grade preparation with Level A evidence for irritable bowel syndrome (IBS). Menthol (40-50% of oil) is the primary active compound. It works via calcium channel blockade, relaxing gastrointestinal smooth muscle. Peppermint is also used for tension headaches, colds, and topical analgesia.",
    mechanism:
      "Menthol (monoterpene) and menthone are the primary constituents (50-80% combined). Menthol is a calcium channel antagonist, relaxing smooth muscle in the GI tract by blocking Ca2+ influx. This reduces gut spasms, bloating, and pain in IBS. Menthol also stimulates cold receptors (TRPM8) in the skin and mucous membranes, producing a cooling sensation. This underlies its use for congestion and topical pain relief. Inhaled menthol may improve alertness and cognitive performance. Pepperment oil increases bile flow (choleretic) and reduces lower esophageal sphincter pressure.",
    claims: [
      {
        claim: "IBS symptoms",
        evidence: "A",
        note: "Enteric-coated oil: 50-80% symptom improvement",
      },
      {
        claim: "Abdominal pain/spasms",
        evidence: "B",
        note: "Antispasmodic effects well-documented",
      },
      {
        claim: "Tension headaches",
        evidence: "B",
        note: "10% topical oil as effective as acetaminophen",
      },
      {
        claim: "Nasal congestion",
        evidence: "C",
        note: "Temporary relief via TRPM8 activation",
      },
      {
        claim: "Nausea",
        evidence: "C",
        note: "Modest effect; weaker than ginger",
      },
      {
        claim: "Indigestion",
        evidence: "B",
        note: "Improves gastric emptying",
      },
    ],
    safetyNotes: [
      "Must be enteric-coated for IBS (otherwise causes heartburn/reflux); swallow whole — NEVER crush or chew enteric capsules",
      "EMA contraindicates peppermint oil under age 8 orally (and under age 2 in all forms due to fatal laryngospasm/apnea risk from menthol)",
      "Monitor cumulative pulegone and menthofuran exposure in essential oil products (EMA limit)",
      "Typical dose: 180-200mg ECPO, 2-3x daily before meals; contraindicated in severe GERD, gallstones, or bile-duct obstruction",
    ],
    drugInteractions: [
      {
        drug: "Antacids/PPIs",
        severity: "mild",
        detail: "May break enteric coating prematurely",
      },
      {
        drug: "Cyclosporine",
        severity: "moderate",
        detail: "May increase levels via CYP inhibition",
      },
      {
        drug: "Iron supplements",
        severity: "mild",
        detail: "May reduce iron absorption",
      },
    ],
    pregnancyCategory: "caution",
    keyCitations: [
      {
        source: "Cochrane",
        title: "Peppermint oil for irritable bowel syndrome",
        url: "https://www.cochranelibrary.com",
        year: 2008,
      },
      {
        source: "Cephalalgia",
        title: "Peppermint oil for tension headache",
        year: 1996,
      },
      {
        source: "J Clin Gastroenterol",
        title: "Meta-analysis: peppermint oil for IBS",
        year: 2014,
      },
      {
        source: "Commission E",
        title: "Menthae piperitae aetheroleum monograph",
        year: 1984,
      },
    ],
  },

  lavender: {
    slug: "lavender",
    summary:
      "Lavender (Lavandula angustifolia) is widely used for anxiety and sleep disorders. Oral standardized lavender oil (Silexan, 80mg) has Level A evidence for generalized anxiety disorder (GAD), with efficacy comparable to lorazepam in some trials. Unlike many botanicals, oral lavender has robust clinical trial data. The anxiolytic effect is mediated by S-lesquel and other constituents interacting with GABA and NMDA receptors. Lavender also has antimicrobial, anti-inflammatory, and analgesic properties.",
    mechanism:
      "Essential oil contains linalool (25-38%) and linalyl acetate (25-45%) as primary actives. Silexan (oral preparation) is standardized to these constituents. Linalool is a competitive NMDA receptor antagonist and potentiates GABAergic transmission, explaining anxiolytic effects. It also inhibits voltage-gated calcium channels. Inhalation of lavender oil activates the limbic system via olfactory pathways, affecting autonomic nervous system tone. Topically, it has antimicrobial and anti-inflammatory effects. Linalool and linalyl acetate are rapidly absorbed through skin and mucous membranes.",
    claims: [
      {
        claim: "Generalized anxiety disorder",
        evidence: "A",
        note: "Silexan: comparable to lorazepam in RCTs",
      },
      {
        claim: "Sleep quality",
        evidence: "B",
        note: "Improves sleep latency and quality",
      },
      {
        claim: "Depression (mild)",
        evidence: "C",
        note: "Preliminary positive trials",
      },
      {
        claim: "Wound healing",
        evidence: "B",
        note: "Antimicrobial, promotes tissue repair",
      },
      {
        claim: "Alopecia areata",
        evidence: "C",
        note: "Topical oil with massage showed hair regrowth",
      },
      {
        claim: "Pain (topical)",
        evidence: "C",
        note: "Analgesic effects via TRPA1 modulation",
      },
    ],
    safetyNotes: [
      "Silexan (80mg oral) is the evidence-based preparation; do NOT ingest unapproved undiluted essential oils",
      "EMA notes lavender oil is NOT recommended under age 12 or during pregnancy and breastfeeding",
      "May impair ability to drive and operate machinery; potentiates CNS depressants",
      "Rare pediatric gynecomastia reported with repeated topical lavender oil products in prepubertal children",
      "Topical: may cause contact dermatitis in sensitive individuals",
    ],
    drugInteractions: [
      {
        drug: "Sedatives (benzodiazepines, etc.)",
        severity: "moderate",
        detail: "Additive CNS depression",
      },
      {
        drug: "Antihypertensives",
        severity: "mild",
        detail: "May enhance hypotensive effects",
      },
    ],
    pregnancyCategory: "caution",
    keyCitations: [
      {
        source: "Int Clin Psychopharmacol",
        title: "Silexan for GAD",
        url: "https://journals.lww.com",
        year: 2010,
      },
      {
        source: "Eur Neuropsychopharmacol",
        title: "Lavender oil vs lorazepam",
        year: 2010,
      },
      {
        source: "Phytomedicine",
        title: "Meta-analysis: lavender for anxiety",
        year: 2019,
      },
      {
        source: "Commission E",
        title: "Lavandulae flos monograph",
        year: 1984,
      },
    ],
  },

  elderberry: {
    slug: "elderberry",
    summary:
      "Elderberry (Sambucus nigra) has gained significant attention for immune support, particularly for respiratory infections. Standardized extracts (Sambucol) demonstrate antiviral effects against influenza A and B, with clinical trials showing symptom reduction by 3-4 days when started within 48 hours of onset. The mechanism involves hemagglutinin inhibition, preventing viral entry into host cells. Elderberry is rich in anthocyanins, providing antioxidant and anti-inflammatory effects.",
    mechanism:
      "Standardized extracts contain flavonoids (quercetin, rutin), anthocyanins (cyanidin-3-glucoside), and lectins. The antiviral effect is primarily due to inhibition of viral hemagglutinin, preventing attachment and entry into host cells. This has been demonstrated for influenza A, B, and some herpes viruses. Elderberry also stimulates cytokine production (IL-1, IL-6, TNF-α, IFN-β), enhancing immune response. The high anthocyanin content provides potent antioxidant activity (ORAC value 14,000+). Lectins have immunomodulatory effects. Berry extracts also demonstrate anti-inflammatory activity via COX inhibition.",
    claims: [
      {
        claim: "Influenza symptom reduction",
        evidence: "B",
        note: "NCCIH notes preliminary evidence from small trials; must not replace antiviral drugs or influenza vaccination",
      },
      {
        claim: "Common cold duration",
        evidence: "B",
        note: "Modest reduction in symptom duration",
      },
      {
        claim: "Immune support",
        evidence: "B",
        note: "Increases cytokine production",
      },
      {
        claim: "Upper respiratory infections",
        evidence: "B",
        note: "Reduces symptoms in air travelers",
      },
      { claim: "Antioxidant", evidence: "B", note: "High anthocyanin content" },
      {
        claim: "COVID-19",
        evidence: "D",
        note: "No clinical evidence; theoretical only",
      },
    ],
    safetyNotes: [
      "Only use commercial preparations—raw berries/seeds toxic",
      "Unripe fruit and seeds contain cyanogenic glycosides",
      "Sambucol/Esberecz are evidence-based preparations",
      "Typical dose: 15ml syrup 4x daily (acute), 1-2x daily (prevention)",
      "Generally well-tolerated; rare GI upset",
    ],
    drugInteractions: [
      {
        drug: "Immunosuppressants",
        severity: "moderate",
        detail: "May counteract immunosuppressive effects",
      },
      {
        drug: "Diuretics",
        severity: "mild",
        detail: "May enhance diuretic effects",
      },
      {
        drug: "Laxatives",
        severity: "mild",
        detail: "May enhance laxative effects",
      },
    ],
    pregnancyCategory: "insufficient",
    keyCitations: [
      {
        source: "J Int Med Res",
        title: "Elderberry for influenza treatment",
        url: "https://journals.sagepub.com",
        year: 2004,
      },
      {
        source: "Nutrients",
        title: "Elderberry supplementation reduces cold duration",
        year: 2016,
      },
      {
        source: "Phytochemistry",
        title: "Antiviral activity of elderberry extract",
        year: 2019,
      },
      { source: "NCCIH", title: "Elderberry Fact Sheet", year: 2024 },
    ],
  },

  "siberian-ginseng": {
    slug: "siberian-ginseng",
    summary:
      "Siberian Ginseng (Eleutherococcus senticosus) is an adaptogen distinct from true ginseng. Level B evidence for stress and physical performance.",
    mechanism:
      "Eleutherosides modulate HPA axis, reduce cortisol response. Enhances immune function and mitochondrial ATP production.",
    claims: [
      {
        claim: "Stress-related fatigue",
        evidence: "B",
        note: "Reduces fatigue under stress",
      },
      {
        claim: "Physical performance",
        evidence: "B",
        note: "Improves endurance",
      },
      {
        claim: "Immune support",
        evidence: "B",
        note: "Enhances T-cell activity",
      },
    ],
    safetyNotes: [
      "Less stimulating than Panax ginseng",
      "Typical dose: 300-1200mg daily",
      "Avoid in hypertension",
      "Generally well-tolerated",
    ],
    drugInteractions: [
      {
        drug: "Digoxin",
        severity: "moderate",
        detail: "May falsely elevate levels",
      },
      {
        drug: "Anticoagulants",
        severity: "mild",
        detail: "Theoretical bleeding risk",
      },
    ],
    pregnancyCategory: "unsafe",
    keyCitations: [
      {
        source: "Phytomedicine",
        title: "Eleutherococcus for stress",
        year: 2005,
      },
      {
        source: "J Ethnopharmacol",
        title: "Immunomodulatory effects",
        year: 2009,
      },
    ],
  },

  hawthorn: {
    slug: "hawthorn",
    summary:
      "Hawthorn (Crataegus spp., primarily leaf with flower Crataegi folium cum flore such as WS 1442 and LI 132 — distinct from berry preparations) has mixed clinical evidence as an adjunct in mild heart failure (NYHA I-II): while older symptom trials showed exercise-tolerance gains, the large SPICE trial showed no reduction in mortality or cardiac morbidity, and NCCIH characterizes the evidence as conflicting.",
    mechanism:
      "Flavonoids (hyperoside, vitexin, rutin), oligomeric procyanidins (OPC), and triterpenes are the primary actives. Multiple cardiac mechanisms: (1) Inhibition of phosphodiesterase-3 (PDE3), increasing cAMP and calcium availability (mild positive inotropy); (2) Coronary vasodilation via NO release; (3) ACE inhibition, reducing afterload; (4) Antioxidant protection of myocardial cells; (5) Antiarrhythmic effects. Unlike digoxin, hawthorn's effects are modest and not associated with toxicity. The multi-component nature creates synergistic cardiac benefits.",
    claims: [
      {
        claim: "Chronic heart failure (NYHA I-II)",
        evidence: "B",
        note: "Conflicting clinical evidence: some symptom/exercise gains, but SPICE trial showed no mortality/morbidity benefit; never replace conventional therapy",
      },
      {
        claim: "Angina pectoris",
        evidence: "B",
        note: "Improves coronary blood flow",
      },
      {
        claim: "Hypertension (mild)",
        evidence: "B",
        note: "Modest blood pressure reduction",
      },
      { claim: "Anxiety", evidence: "C", note: "Mild anxiolytic effects" },
      {
        claim: "Dyslipidemia",
        evidence: "C",
        note: "Preliminary lipid-lowering effects",
      },
    ],
    safetyNotes: [
      "Do NOT replace conventional heart-failure therapy — use only under physician supervision; never use in NYHA III-IV",
      "WS 1442 is leaf with flower (Crataegi folium cum flore), not berry; clinical trial safety data extends up to ~16 weeks",
      "Verify product authenticity: 'Mexican hawthorn' (tejocote root) supplements have been adulterated with lethal yellow oleander (Cascabela thevetia)",
      "Monitor blood pressure and heart rate when initiating alongside cardiac drugs",
      "Generally well-tolerated short term; rare GI upset, dizziness, palpitations",
    ],
    drugInteractions: [
      {
        drug: "Digoxin",
        severity: "contraindicated",
        detail: "May potentiate cardiac effects; requires monitoring",
      },
      {
        drug: "Antihypertensives",
        severity: "moderate",
        detail: "May enhance hypotensive effects",
      },
      {
        drug: "Phosphodiesterase-5 inhibitors",
        severity: "severe",
        detail: "Additive vasodilation; hypotension risk",
      },
      {
        drug: "Nitrates",
        severity: "moderate",
        detail: "Additive vasodilation",
      },
    ],
    pregnancyCategory: "unsafe",
    keyCitations: [
      {
        source: "Cochrane",
        title: "Hawthorn for chronic heart failure",
        url: "https://www.cochranelibrary.com",
        year: 2008,
      },
      {
        source: "JAMA",
        title: "SPICE trial: Hawthorn in heart failure",
        year: 2008,
      },
      {
        source: "Eur J Heart Fail",
        title: "Hawthorn in NYHA II heart failure",
        year: 2001,
      },
      {
        source: "Commission E",
        title: "Crataegi folium cum flore monograph",
        year: 1994,
      },
    ],
  },

  dandelion: {
    slug: "dandelion",
    summary:
      "Dandelion (Taraxacum officinale) is a ubiquitous plant with traditional use for liver support, digestion, and as a diuretic. The root and leaf have different profiles: root is cholagogue and hepatoprotective; leaf is diuretic. While widely used, clinical evidence is limited (Level C). The diuretic effect is comparable to furosemide in animal studies but human data is sparse. It is nutrient-dense (vitamins A, C, K; minerals) and generally very safe.",
    mechanism:
      "Root contains sesquiterpene lactones (taraxacin), triterpenes (taraxasterol), inulin (prebiotic), and phenolic acids. Leaf contains high potassium and flavonoids. Cholagogue effects stimulate bile flow (choleretic and cholagogue). Hepatoprotective effects may involve antioxidant and anti-inflammatory activity. Diuretic effects are via kidney Na+/K+ pump inhibition. Inulin supports gut microbiome. The high potassium content distinguishes it from conventional diuretics (which cause K+ loss). Some constituents demonstrate anti-inflammatory and antimicrobial properties.",
    claims: [
      {
        claim: "Liver support",
        evidence: "C",
        note: "Traditional use; limited clinical evidence",
      },
      {
        claim: "Digestive aid",
        evidence: "C",
        note: "Bitter stimulant; increases bile flow",
      },
      {
        claim: "Diuretic",
        evidence: "C",
        note: "Animal data suggests furosemide-like effect",
      },
      {
        claim: "Detoxification",
        evidence: "D",
        note: "Marketing term; no scientific basis",
      },
      {
        claim: "Nutritional support",
        evidence: "B",
        note: "High in vitamins A, C, K; minerals",
      },
    ],
    safetyNotes: [
      "Root and leaf have distinct uses: EMA lists leaf for minor urinary complaints/flushing and root/herb for mild digestive/appetite loss",
      "Contraindicated in conditions requiring reduced fluid intake (e.g., severe heart failure or renal impairment) and bile duct obstruction/gallstones",
      "Leaf is high in potassium (hyperkalemia caution in renal impairment or K+-sparing diuretics)",
      "MSK About Herbs notes potential estrogenic activity (caution with hormone-sensitive cancers) and possible CYP enzyme inhibition",
      "Asteraceae allergy risk; root contains inulin (FODMAP — may trigger GI bloating)",
    ],
    drugInteractions: [
      {
        drug: "Diuretics",
        severity: "moderate",
        detail: "Additive diuretic effects / electrolyte imbalance",
      },
      {
        drug: "Lithium",
        severity: "moderate",
        detail: "May alter renal lithium clearance; monitor serum lithium",
      },
      {
        drug: "Anticoagulants",
        severity: "mild",
        detail: "High vitamin K in fresh leaves",
      },
      {
        drug: "CYP substrates / Quinolone antibiotics",
        severity: "mild",
        detail:
          "Theoretical absorption/CYP interaction suggested in preclinical/animal models only; not verified in human trials",
      },
    ],
    pregnancyCategory: "insufficient",
    keyCitations: [
      {
        source: "J Ethnopharmacol",
        title: "Diuretic activity of dandelion",
        url: "https://www.sciencedirect.com",
        year: 2009,
      },
      {
        source: "Int J Mol Sci",
        title: "Hepatoprotective effects of dandelion",
        year: 2010,
      },
      { source: "NCCIH", title: "Dandelion Fact Sheet", year: 2024 },
    ],
  },
  ginkgo: {
    slug: "ginkgo",
    summary:
      "Ginkgo (Ginkgo biloba) standardized leaf extract (EGb761: 24% flavone glycosides, 6% terpene lactones) is widely studied for circulation and cognitive support, though major trials (such as NCCIH's GEM trial) found no definitive benefit for preventing cognitive decline or dementia.",
    mechanism:
      "Ginkgo biloba extract (GBE) contains two primary active fractions: flavonoid glycosides (quercetin, kaempferol, isorhamnetin) and terpene lactones (ginkgolides A-C, bilobalide). Ginkgolides are potent PAF antagonists, reducing platelet aggregation and improving microcirculation. Bilobalide protects mitochondrial function and reduces oxidative stress. Flavonoids scavenge free radicals and chelate transition metals. GBE also modulates neurotransmitter systems (acetylcholine, norepinephrine, serotonin) and increases brain-derived neurotrophic factor (BDNF) expression.",
    claims: [
      {
        claim: "Age-related cognitive decline",
        evidence: "C",
        note: "NCCIH notes definitive conclusions cannot be drawn; GEM and Cochrane analyses found inconsistent or null dementia-prevention outcomes",
      },
      {
        claim: "Dementia (Alzheimer's/vascular)",
        evidence: "C",
        note: "Large controlled trials (GEM) failed to show dementia prevention",
      },
      {
        claim: "Intermittent claudication",
        evidence: "B",
        note: "Modest increase in pain-free walking distance",
      },
      {
        claim: "Tinnitus",
        evidence: "C",
        note: "Limited evidence; Cochrane found no convincing benefit for primary tinnitus",
      },
      {
        claim: "Macular degeneration",
        evidence: "C",
        note: "Preliminary evidence only",
      },
      {
        claim: "Antioxidant support",
        evidence: "B",
        note: "Well-documented free radical scavenging",
      },
      {
        claim: "Glaucoma (open-angle)",
        evidence: "C",
        note: "Preliminary ocular blood-flow data",
      },
    ],
    safetyNotes: [
      "Do NOT consume raw or roasted ginkgo seeds — ginkgotoxin causes seizures and coma",
      "Avoid with anticoagulants/antiplatelets due to hemorrhage risk; discuss with your surgeon or anesthesiologist well before scheduled surgery and do not independently stop prescribed medications",
      "May lower seizure threshold in susceptible individuals",
      "Standardized leaf extract: 120-240mg daily under clinician guidance",
    ],
    drugInteractions: [
      {
        drug: "Warfarin/Coumadin",
        severity: "severe",
        detail:
          "Major hemorrhage and INR risk; avoid concurrent use or monitor closely",
      },
      {
        drug: "Aspirin/NSAIDs",
        severity: "moderate",
        detail: "Additive antiplatelet effects",
      },
      {
        drug: "Antidepressants (SSRIs/MAOIs)",
        severity: "moderate",
        detail: "Theoretical serotonin syndrome risk",
      },
      {
        drug: "Anticonvulsants",
        severity: "mild",
        detail: "May lower seizure threshold",
      },
    ],
    pregnancyCategory: "unsafe",
    keyCitations: [
      {
        source: "Cochrane",
        title: "Ginkgo biloba for cognitive impairment and dementia",
        url: "https://www.cochranelibrary.com",
        year: 2022,
      },
      {
        source: "JAMA",
        title: "Ginkgo biloba and risk of dementia",
        url: "https://jamanetwork.com",
        year: 2009,
      },
      {
        source: "Pharmacopsychiatry",
        title: "EGb761 in dementia",
        url: "https://www.thieme-connect.de",
        year: 2021,
      },
      {
        source: "Commission E",
        title: "Ginkgo biloba leaf extract monograph",
        year: 1994,
      },
    ],
  },
};
