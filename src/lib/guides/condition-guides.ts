import type { Guide } from "./types";
import {
  EMA_HERBAL,
  HC_NHP,
  LIVERTOX_COMFREY,
  LIVERTOX_HOME,
  LIVERTOX_KAVA,
  NCCIH_GLANCE,
  NCCIH_GREEN_TEA,
  NCCIH_KAVA,
  NCCIH_SJW,
  NCCIH_WISE,
  PUBMED,
} from "./shared-sources";

export const CONDITION_GUIDES: Guide[] = [
  {
    slug: "st-johns-wort-and-medications",
    status: "published",
    updated: "2026-11-18",
    reviewedBy: "yasser-bheekun",
    reviewedOn: "2026-11-18",
    en: {
      title:
        "St. John's wort and prescription medications: why it interacts with so many drugs",
      metaTitle:
        "St. John's Wort Drug Interactions: CYP3A4, SSRIs & Medications",
      metaDescription:
        "Why St. John's wort (Hypericum perforatum) triggers more critical drug interactions than almost any other herb: CYP450/P-gp enzyme induction plus serotonin syndrome risk.",
      intro:
        "No single medicinal plant causes as many clinically significant prescription failures and toxicities as St. John's wort (Hypericum perforatum). Unlike herbs that carry one mild effect, St. John's wort acts through two entirely different mechanisms at once — lowering blood levels of vital medications while over-activating serotonin pathways with antidepressants.",
      sections: [
        {
          heading:
            "Mechanism 1: Enzyme and transporter induction (making drugs fail)",
          paragraphs: [
            "The constituent hyperforin activates the pregnane X receptor (PXR), switching on liver and intestinal enzymes — notably CYP3A4, CYP2C9, and CYP2C19 — as well as the drug efflux pump P-glycoprotein (P-gp).",
            "When those enzymes work faster, medications break down and exit the body too quickly. Documented clinical failures include organ transplant rejection from falling cyclosporine or tacrolimus levels, unintended pregnancy with oral or hormonal contraceptives, loss of warfarin anticoagulation, and subtherapeutic blood levels of HIV antiretrovirals (indinavir, nevirapine), certain targeted oncology drugs (imatinib, irinotecan), and digoxin.",
          ],
        },
        {
          heading: "Mechanism 2: Serotonin excess (risk of serotonin syndrome)",
          paragraphs: [
            "Combined with selective serotonin reuptake inhibitors (SSRIs such as sertraline, fluoxetine, citalopram, paroxetine), SNRIs, MAOIs, triptans, or serotonergic opioids (tramadol), St. John's wort adds serotonergic activity.",
            "Excess serotonin can trigger agitation, sweating, rapid heart rate, tremor, muscle rigidity, fever, or confusion — symptoms that require urgent medical assessment.",
          ],
        },
        {
          heading: "Why stopping St. John's wort also needs supervision",
          paragraphs: [
            "If someone stabilized a warfarin or transplant-drug dose while taking St. John's wort and then stops the herb abruptly, enzyme induction wears off over one to two weeks. Drug levels can rebound sharply into the toxic range unless a prescriber monitors and adjusts the dose during washout.",
          ],
        },
      ],
      sources: [NCCIH_SJW, EMA_HERBAL, HC_NHP, PUBMED],
    },
    fr: {
      title:
        "Millepertuis et médicaments : pourquoi cette plante interagit avec tant d’ordonnances",
      metaTitle:
        "Interactions du millepertuis : CYP3A4, antidépresseurs et contraceptifs",
      metaDescription:
        "Pourquoi le millepertuis (Hypericum perforatum) provoque plus d’interactions graves que presque toute autre plante : induction CYP450 / P-gp et risque de syndrome sérotoninergique.",
      intro:
        "Aucune plante médicinale courante n’entraîne autant d’échecs thérapeutiques et de réactions sévères que le millepertuis (Hypericum perforatum). Son danger vient de deux mécanismes opposés : il accélère l’élimination de dizaines de médicaments essentiels et additionne ses effets sérotoninergiques à ceux des antidépresseurs.",
      sections: [
        {
          heading:
            "Mécanisme 1 : induction enzymatique (perte d’efficacité des médicaments)",
          paragraphs: [
            "L’hyperforine active le récepteur nucléaire PXR, ce qui augmente nettement l’activité des cytochromes hépatiques et intestinaux — surtout CYP3A4, CYP2C9 et CYP2C19 — ainsi que du transporteur d’efflux glycoprotéine P (P-gp).",
            "Résultat : plusieurs médicaments sont éliminés trop vite et deviennent inefficaces. La littérature rapporte des rejets de greffe par chute des taux de ciclosporine ou de tacrolimus, des grossesses non désirées sous contraceptifs hormonaux, une baisse d’efficacité de la warfarine, ainsi que la perte d’activité d’antirétroviraux, d’anticancéreux ciblés ou de la digoxine.",
          ],
        },
        {
          heading:
            "Mécanisme 2 : excès de sérotonine (syndrome sérotoninergique)",
          paragraphs: [
            "Pris avec un antidépresseur ISRS (sertraline, fluoxétine, citalopram, paroxétine), un IRSN, un IMAO, un triptan antimigraineux ou un opioïde sérotoninergique comme le tramadol, le millepertuis élève le risque d’intoxication sérotoninergique.",
            "Agitation, sueurs abondantes, tachycardie, tremblements, raideur musculaire, fièvre ou confusion imposent une évaluation médicale urgente.",
          ],
        },
        {
          heading: "Pourquoi même l’arrêt demande un suivi médical",
          paragraphs: [
            "Chez une personne dont la dose de warfarine, d’antiépileptique ou d’immunosuppresseur a été ajustée pendant la prise de millepertuis, l’arrêt brutal lève l’induction enzymatique en une à deux semaines : les taux sanguins du médicament peuvent alors grimper vers la toxicité sans réajustement médical.",
          ],
        },
      ],
      sources: [NCCIH_SJW, EMA_HERBAL, HC_NHP, PUBMED],
    },
    related: [
      {
        href: "/herbs/st-johns-wort",
        en: "St. John's Wort monograph",
        fr: "Fiche du millepertuis",
      },
      {
        href: "/interactions/st-johns-wort/warfarin",
        en: "St. John's Wort + Warfarin",
        fr: "Millepertuis + Warfarine",
      },
      {
        href: "/herb-drug-interactions",
        en: "Check your medication stack",
        fr: "Vérifier toute votre liste",
      },
    ],
  },
  {
    slug: "liver-safety-and-herbal-supplements",
    status: "published",
    updated: "2026-11-18",
    reviewedBy: "yasser-bheekun",
    reviewedOn: "2026-11-18",
    en: {
      title:
        "Herbal supplements and liver safety: reading LiverTox ratings honestly",
      metaTitle: "Herbs and Liver Safety: Understanding HILI & LiverTox Grades",
      metaDescription:
        "How NIH LiverTox classifies herbal liver injury risk from Category A to E, which herbs carry documented risks (comfrey, germander, concentrated green tea extract, kava, Garcinia), and early warning signs.",
      intro:
        "Herb-induced liver injury (HILI) now accounts for a measurable share of drug-induced liver injury cases tracked in hospital registries. Most culinary herbs are safe on the liver; trouble clusters around specific compounds, high-concentration weight-loss or bodybuilding extracts, pyrrolizidine alkaloids, and contaminated multi-ingredient blends.",
      sections: [
        {
          heading: "How NIH LiverTox scores herbal liver risk",
          paragraphs: [
            "The NIH LiverTox reference ranks substances from Category A (well-established cause — more than 50 published cases) and Category B (likely cause — 12 to 50 cases) through C (probable rare cause), D (possible very rare cause), and E (unlikely/unproven).",
            "Knowing the difference matters: a single isolated case report on an otherwise well-tolerated herb is very different from a known direct toxin whose active alkaloids damage hepatic sinusoids.",
          ],
        },
        {
          heading: "Compounds and extracts with established concerns",
          paragraphs: [
            "Oral comfrey (Symphytum officinale), coltsfoot, and borage plant parts containing unsaturated pyrrolizidine alkaloids (PAs) can trigger veno-occlusive / sinusoidal obstruction syndrome and should not be taken internally. Germander (Teucrium chamaedrys), chaparral, fo-ti (Polygonum multiflorum), and greater celandine carry high LiverTox scores (A or B).",
            "Concentrated green tea extract capsules (high-dose EGCG taken fasting for weight loss), kava (Piper methysticum), Garcinia cambogia, black cohosh, and multi-ingredient fitness blends have also been linked to idiosyncratic hepatocellular or cholestatic liver injury. Brewed beverage green tea does not carry the same risk as concentrated extract pills.",
          ],
        },
        {
          heading: "Symptoms that mean stop and get checked",
          paragraphs: [
            "Discontinue the supplement immediately and see a clinician for liver enzyme testing (ALT, AST, bilirubin, alkaline phosphatase) if you notice unexplained fatigue, right-upper abdominal discomfort, nausea, dark urine, pale stools, itching, or yellowing of the eyes or skin (jaundice).",
            "If you already take medications metabolized or flagged for hepatotoxicity — including high-dose acetaminophen, methotrexate, isoniazid, valproate, or statins — avoid adding concentrated botanical weight-loss blends or unverified imported teas.",
          ],
        },
      ],
      sources: [
        LIVERTOX_HOME,
        LIVERTOX_KAVA,
        LIVERTOX_COMFREY,
        NCCIH_KAVA,
        NCCIH_GREEN_TEA,
      ],
    },
    fr: {
      title:
        "Plantes médicinales et sécurité du foie : comprendre les cotes LiverTox",
      metaTitle: "Plantes et toxicité hépatique : lire les cotes NIH LiverTox",
      metaDescription:
        "Comment la base NIH LiverTox classe le risque hépatique des plantes (catégories A à E), les extraits les plus concernés (consoude, germandrée, thé vert concentré, kava, garcinia) et les signes d’alerte.",
      intro:
        "Les atteintes hépatiques induites par les plantes et suppléments (HILI) représentent une part réelle des hépatites toxiques recensées dans les registres hospitaliers. Si les plantes alimentaires habituelles sont généralement bien tolérées par le foie, les problèmes se concentrent autour de quelques alcaloïdes toxiques et d’extraits amincissants ou sportifs concentrés.",
      sections: [
        {
          heading: "Comment NIH LiverTox évalue le risque hépatique",
          paragraphs: [
            "La référence américaine NIH LiverTox classe chaque substance de la catégorie A (cause bien établie, plus de 50 cas publiés) et B (cause probable, 12 à 50 cas) jusqu’aux catégories C (rare probable), D (très rare possible) et E (improbable).",
            "Distinguer ces niveaux évite deux erreurs : banaliser une plante contenant de vrais hépatotoxiques, ou paniquer devant un cas isolé non confirmé sur une infusion courante.",
          ],
        },
        {
          heading: "Plantes et extraits à surveiller de près",
          paragraphs: [
            "Par voie orale, la consoude (Symphytum officinale), le tussilage et certaines borraginacées renferment des alcaloïdes pyrrolizidiniques capables de provoquer une maladie veino-occlusive hépatique grave. La germandrée petit-chêne (Teucrium chamaedrys), le chaparral, le fo-ti (Polygonum multiflorum) et la grande chélidoine affichent également des scores LiverTox élevés (A ou B).",
            "Les extraits concentrés de thé vert riches en EGCG (en gélules amincissantes à jeun), le kava, le garcinia cambogia, l’actée à grappes noires et certains complexes brûleurs de graisse ont aussi été associés à des hépatites idiosyncrasiques. Le thé vert infusé en tasse ne présente pas le même profil que les extraits hyperconcentrés.",
          ],
        },
        {
          heading: "Signes qui imposent l’arrêt et un bilan sanguin",
          paragraphs: [
            "Arrêtez immédiatement tout supplément suspect et consultez un médecin pour un dosage hépatique (ALT, AST, bilirubine, phosphatases alcalines) en cas de fatigue nouvelle, douleur sous les côtes à droite, nausées, urines foncées, démangeaisons ou jaunisse.",
            "En cas de maladie du foie ou de prise régulière de médicaments hépatotoxiques (acétaminophène à forte dose, méthotrexate, valproate, isoniazide), évitez particulièrement les mélanges végétaux amaigrissants ou toniques non vérifiés.",
          ],
        },
      ],
      sources: [
        LIVERTOX_HOME,
        LIVERTOX_KAVA,
        LIVERTOX_COMFREY,
        NCCIH_KAVA,
        NCCIH_GREEN_TEA,
      ],
    },
    related: [
      { href: "/herbs/kava", en: "Kava profile", fr: "Fiche du kava" },
      {
        href: "/herbs/comfrey",
        en: "Comfrey safety record",
        fr: "Sécurité de la consoude",
      },
      {
        href: "/herbs/milk-thistle",
        en: "Milk Thistle profile",
        fr: "Fiche du chardon-Marie",
      },
    ],
  },
  {
    slug: "pregnancy-and-herbal-teas",
    status: "published",
    updated: "2026-11-18",
    reviewedBy: "yasser-bheekun",
    reviewedOn: "2026-11-18",
    en: {
      title:
        "Pregnancy and herbal teas: separating studied herbs from guesswork",
      metaTitle: "Pregnancy & Herbal Teas: What Clinical Sources Say",
      metaDescription:
        "How Health Canada separates culinary teas from concentrated herbal extracts in pregnancy, evidence for ginger, and herbs to avoid.",
      intro:
        "The label 'herbal tea' covers everything from a weak culinary chamomile bag to medicinal root decoctions capable of stimulating uterine contractions, altering fetal hormone signaling, or injuring a developing liver. Because rigorous trials in pregnant volunteers are rare, separating established food use from unsafe medicinal herbs takes clear thresholds.",
      sections: [
        {
          heading: "Culinary cup vs concentrated extract",
          paragraphs: [
            "Dose and plant part make the difference. Cooking garlic, ginger, or cinnamon in everyday meals is not equivalent to swallowing standardized capsules delivering grams of concentrated extract every day. Health Canada Natural Health Product monographs frequently approve lower dietary exposures while placing 'Do not use if you are pregnant or breastfeeding' warnings once daily dried-herb equivalents pass therapeutic thresholds.",
            "Avoid multi-herb 'detox', 'slimming', or unlabelled loose-leaf blends during pregnancy and breastfeeding: one contraindicated ingredient hidden in a five-herb bag negates the mildness of the other four.",
          ],
        },
        {
          heading: "Where modest clinical evidence exists",
          paragraphs: [
            "Ginger (Zingiber officinale) at moderate studied intakes has randomized-trial support for pregnancy-related nausea and vomiting, though obstetric guidelines still advise checking with a prenatal clinician first and watching total daily amount.",
            "Occasional culinary cups of peppermint leaf (for mild nausea or bloating) or lemon balm are generally regarded cautiously as low-risk food exposures in non-concentrated tea form, while evidence for raspberry leaf in late pregnancy remains limited and should be cleared with your midwife or obstetrician before daily use.",
          ],
        },
        {
          heading: "Herbs clearly unsafe or contraindicated in pregnancy",
          paragraphs: [
            "Avoid internal use of uterine-stimulating, hormone-active, teratogenic, or toxic herbs throughout pregnancy: blue cohosh, black cohosh, pennyroyal (pulegone), mugwort/wormwood (thujone), rue, goldenseal, senna/cascara anthraquinone stimulant laxatives, medicinal sage or parsley oils, licorice root extracts (glycyrrhizin linked to hypertension and prematurity risks), comfrey, and ephedra.",
            "Always confirm teas, prenatal supplements, and NPN bottles directly with your obstetrician, midwife, or pharmacist.",
          ],
        },
      ],
      sources: [NCCIH_WISE, NCCIH_GLANCE, HC_NHP, EMA_HERBAL],
    },
    fr: {
      title:
        "Grossesse et tisanes : démêler les plantes étudiées des idées reçues",
      metaTitle: "Grossesse et tisanes : ce que disent les sources cliniques",
      metaDescription:
        "Pourquoi Santé Canada distingue tisanes culinaires et extraits pendant la grossesse, données sur le gingembre et plantes à éviter.",
      intro:
        "Sous l’étiquette « tisane », on trouve autant une simple infusion alimentaire qu’une décoction de plantes capables de déclencher des contractions utérines, de perturber l’équilibre hormonal ou d’atteindre le foie fœtal. Comme les essais contrôlés chez la femme enceinte restent limités, la règle de base est la prudence proportionnée.",
      sections: [
        {
          heading: "Infusion alimentaire vs extrait thérapeutique concentré",
          paragraphs: [
            "La dose et la partie de la plante changent tout. Cuisiner avec de l’ail, du gingembre ou de la cannelle n’équivaut pas à prendre des gélules standardisées contenant des grammes d’extrait chaque jour. Les monographies de Santé Canada imposent souvent la mention « Ne pas utiliser si vous êtes enceinte ou si vous allaitez » dès qu’un produit dépasse le seuil médicinal.",
            "Évitez surtout les tisanes « détox », « minceur » ou mélanges en vrac sans liste précise : une seule plante contre-indiquée parmi cinq rend toute la tasse à risque.",
          ],
        },
        {
          heading: "Ce que soutiennent les données cliniques",
          paragraphs: [
            "Le gingembre (Zingiber officinale), utilisé à doses modérées documentées, possède le meilleur niveau de preuve clinique contre les nausées de début de grossesse — toujours avec l’accord de votre médecin ou sage-femme pour confirmer la forme et la quantité.",
            "Une tasse occasionnelle de menthe poivrée ou de mélisse en infusion légère est habituellement considérée comme à faible risque alimentaire, alors que l’efficacité des feuilles de framboisier en fin de grossesse reste limitée et doit être validée en suivi prénatal.",
          ],
        },
        {
          heading: "Plantes contre-indiquées pendant la grossesse",
          paragraphs: [
            "Évitez par voie interne les plantes utérotoniques, toxiques ou fortement actives : actée à grappes bleue ou noire, menthe pouliot (pulégone), armoise et grande absinthe (thuyone), rue, hydraste du Canada, laxatifs stimulants à anthraquinones (séné, cascara), huiles essentielles de sauge ou persil, extraits de réglisse (glycyrrhizine liée à l’hypertension), consoude et éphédra.",
            "Faites toujours vérifier vos tisanes et numéros NPN par votre pharmacien, votre médecin ou votre sage-femme.",
          ],
        },
      ],
      sources: [NCCIH_WISE, NCCIH_GLANCE, HC_NHP, EMA_HERBAL],
    },
    related: [
      {
        href: "/herbs/ginger",
        en: "Ginger safety record",
        fr: "Sécurité du gingembre",
      },
      {
        href: "/herbs/peppermint",
        en: "Peppermint profile",
        fr: "Fiche de la menthe poivrée",
      },
      {
        href: "/npn-checker",
        en: "Health Canada NPN Decoder",
        fr: "Décodeur NPN Santé Canada",
      },
    ],
  },
  {
    slug: "herbs-and-antidepressants",
    status: "published",
    updated: "2026-11-20",
    reviewedBy: "yasser-bheekun",
    reviewedOn: "2026-11-20",
    en: {
      title:
        "Herbs and Antidepressants: Serotonin Syndrome & CYP Interactions Explained",
      metaTitle: "Herbs & Antidepressants: SSRI, SNRI & MAOI Interaction Risks",
      metaDescription:
        "Which herbs interfere with SSRIs, SNRIs, and MAOIs—covering St. John's Wort CYP induction, serotonin syndrome signals, saffron, rhodiola, and what to check.",
      intro:
        "Mood-targeted supplements are frequently marketed for stress or low mood—often the very symptoms treated by SSRIs, SNRIs, and MAOIs. Combining serotonergic or liver-enzyme-inducing botanicals with antidepressants can cause dangerously low antidepressant blood levels, unexpected serotonin excess, or delayed withdrawal recovery.",
      sections: [
        {
          heading: "Why St. John's Wort is a major hazard with antidepressants",
          paragraphs: [
            "St. John's Wort (Hypericum perforatum) triggers two simultaneous problems: hyperforin strongly induces CYP3A4, CYP2C19, and P-glycoprotein drug transporters, while its overall extract inhibits serotonin reuptake.",
            "Combining St. John's Wort with SSRIs (sertraline, fluoxetine, citalopram), SNRIs (venlafaxine, duloxetine), or MAOIs raises the risk of serotonin toxicity—marked by sweating, tremor, hyperreflexia, agitation, or confusion—while unpredictably altering drug levels.",
          ],
        },
        {
          heading: "Other mood herbs clinicians watch closely",
          paragraphs: [
            "Saffron, Rhodiola rosea, kava, and passionflower carry lower enzyme-induction profiles than St. John's Wort, yet case reports and pharmacological studies still advise pharmacist screening before stacking them alongside prescription psychiatric medications.",
            "Sedating botanicals such as kava or high-dose valerian can also compound daytime drowsiness or dizziness when paired with mirtazapine, trazodone, or tricyclic antidepressants.",
          ],
        },
        {
          heading: "How to review changes safely",
          paragraphs: [
            "Never stop an antidepressant abruptly in order to substitute an over-the-counter herb; SSRI and SNRI discontinuation requires clinician-guided tapering over weeks.",
            "Screen each botanical with HerbAlly's Medication Directory and review the exact brand, extract strength, and timing with your prescribing clinician or pharmacist.",
          ],
        },
      ],
      sources: [NCCIH_SJW, NCCIH_WISE, HC_NHP, PUBMED],
    },
    fr: {
      title:
        "Plantes et antidépresseurs : syndrome sérotoninergique et enzymes CYP450",
      metaTitle: "Plantes et antidépresseurs (ISRS, IRSN, IMAO) : risques clés",
      metaDescription:
        "Quelles plantes interfèrent avec les ISRS, IRSN et IMAO : millepertuis, syndrome sérotoninergique, safran, rhodiole et conduite pratique à tenir.",
      intro:
        "De nombreux suppléments ciblent l'anxiété ou la baisse de moral — précisément les symptômes pour lesquels les médecins prescrivent des antidépresseurs. Associer certaines plantes sérotoninergiques ou inductrices enzymatiques à un traitement expose à une toxicité sérotoninergique ou à une perte d'efficacité du médicament.",
      sections: [
        {
          heading: "Pourquoi le millepertuis pose un double problème majeur",
          paragraphs: [
            "Le millepertuis (Hypericum perforatum) agit à la fois en induisant fortement le CYP3A4, le CYP2C19 et la glycoprotéine P, et en modulant la recapture de la sérotonine.",
            "L'associer à un ISRS (sertraline, fluoxétine, citalopram), un IRSN (venlafaxine) ou un IMAO augmente le risque de syndrome sérotoninergique (sueurs, tremblements, agitation, rigidité) et perturbe l'équilibre thérapeutique.",
          ],
        },
        {
          heading: "Autres plantes pour l'humeur ou le sommeil à surveiller",
          paragraphs: [
            "Le safran, la rhodiole (Rhodiola rosea), le kava et la passiflore induisent beaucoup moins les enzymes CYP que le millepertuis, mais justifient tout de même une vérification pharmacologique avant toute association.",
            "Les plantes sédatives (valériane, kava) peuvent accentuer la somnolence ou les étourdissements avec la trazodone, la mirtazapine ou les tricycliques.",
          ],
        },
        {
          heading: "Règle de prudence",
          paragraphs: [
            "N'interrompez jamais brutalement un antidépresseur pour le remplacer par un produit naturel : l'arrêt nécessite un sevrage médical encadré.",
            "Consultez toujours notre répertoire par médicament et faites valider l'étiquette exacte par votre pharmacien.",
          ],
        },
      ],
      sources: [NCCIH_SJW, NCCIH_WISE, HC_NHP, PUBMED],
    },
    related: [
      {
        href: "/medications/sertraline",
        en: "Sertraline (Zoloft) interactions",
        fr: "Interactions de la sertraline",
      },
      {
        href: "/interactions/st-johns-wort/fluoxetine",
        en: "St. John's Wort + Fluoxetine",
        fr: "Millepertuis + Fluoxétine",
      },
      {
        href: "/medications",
        en: "Browse Medications A–Z",
        fr: "Répertoire des médicaments A–Z",
      },
    ],
  },
  {
    slug: "herbs-and-diabetes-medications",
    status: "published",
    updated: "2026-11-20",
    reviewedBy: "yasser-bheekun",
    reviewedOn: "2026-11-20",
    en: {
      title:
        "Herbs and Diabetes Medications: Avoiding Hypoglycemia with Metformin & Insulin",
      metaTitle:
        "Herbs & Diabetes Drugs: Berberine, Fenugreek & Insulin Overlap",
      metaDescription:
        "How glucose-lowering herbs (berberine, fenugreek, gymnema, cinnamon, bitter melon, ginseng) interact with metformin, sulfonylureas, and insulin.",
      intro:
        "Many supplements promoted for metabolic or blood-sugar balance contain active compounds that lower fasting and post-meal glucose on their own. Taken unmonitored alongside insulin, sulfonylureas, or metformin, additive glucose lowering can trigger symptomatic hypoglycemia or mask medication adjustments.",
      sections: [
        {
          heading: "Additive blood-sugar lowering (pharmacodynamic overlap)",
          paragraphs: [
            "Berberine exhibits AMPK activation similar in pathway direction to metformin, while fenugreek soluble fiber and saponins slow intestinal carbohydrate absorption and gymnema modulates sweet taste receptors and glucose uptake.",
            "Paired with insulin, glipizide, glyburide, or metformin, these herbs can push blood glucose lower than expected—causing shakiness, diaphoresis, dizziness, or confusion.",
          ],
        },
        {
          heading: "Other hidden variables in blood-sugar products",
          paragraphs: [
            "Concentrated Cassia cinnamon bark contains coumarin at much higher concentrations than Ceylon cinnamon (Cinnamomum verum), creating an avoidable liver burden when swallowed in gram-level daily capsules.",
            "Fenugreek seed mucilage taken in the same swallow as oral tablets can also physically bind or delay absorption of co-administered drugs unless spaced by 2 hours.",
          ],
        },
        {
          heading: "Monitoring checklist before combining",
          paragraphs: [
            "Do not adjust your prescribed insulin or oral diabetes dose on your own to 'make room' for a supplement.",
            "Bring exact product NPN numbers or ingredient labels to your pharmacist or diabetes educator and monitor fingerstick readings more closely if cleared to start anything new.",
          ],
        },
      ],
      sources: [NCCIH_GLANCE, HC_NHP, EMA_HERBAL, PUBMED],
    },
    fr: {
      title:
        "Plantes et médicaments contre le diabète : éviter l'hypoglycémie avec metformine et insuline",
      metaTitle:
        "Plantes et diabète : berbérine, fenugrec, metformine et insuline",
      metaDescription:
        "Comment berbérine, fenugrec, gymnema, cannelle et ginseng interagissent avec metformine, sulfonylurées et insuline (risque d'hypoglycémie et d'absorption).",
      intro:
        "Plusieurs plantes dites « glycémiques » abaissent déjà la glycémie par elles-mêmes. Prises sans suivi avec la metformine, l'insuline ou une sulfonylurée, elles peuvent provoquer une hypoglycémie additive.",
      sections: [
        {
          heading: "Effet hypoglycémiant additif",
          paragraphs: [
            "La berbérine active l'AMPK de façon comparable dans sa direction d'action à la metformine, tandis que le fenugrec ralentit l'absorption glucidique et que le gymnema agit sur l'absorption intestinale du glucose.",
            "Associées à l'insuline ou aux sulfonylurées, ces plantes peuvent abaisser la glycémie au-delà de l'objectif (tremblements, sueurs froides, malaise).",
          ],
        },
        {
          heading: "Précautions supplémentaires : foie et espacement",
          paragraphs: [
            "La cannelle de Chine (Cinnamomum cassia) en gélules fortement dosées apporte de la coumarine pouvant irriter le foie comparativement à la vraie cannelle de Ceylan.",
            "Les fibres mucilagineuses du fenugrec ou du psyllium doivent être espacées d'au moins 2 heures de vos comprimés pour ne pas freiner leur absorption.",
          ],
        },
        {
          heading: "Réflexes de surveillance",
          paragraphs: [
            "Ne réduisez jamais vos doses d'insuline ou de metformine sans consigne médicale.",
            "Faites vérifier vos flacons (NPN) par votre pharmacien ou votre infirmière en diabète avant de commencer.",
          ],
        },
      ],
      sources: [NCCIH_GLANCE, HC_NHP, EMA_HERBAL, PUBMED],
    },
    related: [
      {
        href: "/medications/metformin",
        en: "Metformin herb interactions",
        fr: "Interactions de la metformine",
      },
      {
        href: "/symptoms/blood-sugar",
        en: "Blood-sugar herbs database",
        fr: "Plantes pour la glycémie",
      },
      {
        href: "/medications",
        en: "Browse Medications A–Z",
        fr: "Répertoire des médicaments A–Z",
      },
    ],
  },
  {
    slug: "herbs-and-blood-pressure-medications",
    status: "published",
    updated: "2026-11-20",
    reviewedBy: "yasser-bheekun",
    reviewedOn: "2026-11-20",
    en: {
      title:
        "Herbs and Blood Pressure Medications: Hidden Hypertensive & Hypotensive Risks",
      metaTitle:
        "Herbs & Blood Pressure Drugs: Licorice, Hawthorn, Garlic & Electrolytes",
      metaDescription:
        "How licorice root raises blood pressure and lowers potassium, why hawthorn, garlic, and hibiscus can add to hypotension, and CYP interactions with calcium channel blockers.",
      intro:
        "Herbs affect cardiovascular prescriptions in opposite directions: some (notably whole licorice root) directly counteract blood-pressure drugs and deplete potassium, while others (hawthorn, hibiscus, concentrated garlic) can push blood pressure too low or alter calcium-channel blocker metabolism.",
      sections: [
        {
          heading: "Herbs that raise blood pressure or counter diuretics",
          paragraphs: [
            "Whole licorice root (Glycyrrhiza glabra containing glycyrrhizin—unlike deglycyrrhizinated DGL extracts) inhibits renal 11-beta-hydroxysteroid dehydrogenase, mimicking aldosterone excess: sodium retention, hypertension, edema, and dangerous hypokalemia alongside thiazide or loop diuretics like furosemide.",
            "Sympathomimetic stimulants such as bitter orange (synephrine) and concentrated caffeine-rich botanicals (guarana, yerba mate) can also blunt beta-blocker and ACE-inhibitor control.",
          ],
        },
        {
          heading: "Additive blood-pressure lowering & CYP3A4 shifts",
          paragraphs: [
            "Hibiscus sabdariffa, hawthorn, and aged garlic extracts demonstrate mild vasodilatory or ACE-inhibiting properties in trials; added on top of lisinopril, amlodipine, or metoprolol, monitor for orthostatic dizziness upon standing.",
            "Potassium-sparing diuretics (spironolactone) and ACE inhibitors require caution with potassium-rich supplements and renal-acting herbs, while grapefruit, St. John's Wort, or concentrated CYP modulators shift nifedipine/amlodipine exposure.",
          ],
        },
      ],
      sources: [NCCIH_WISE, NCCIH_GLANCE, HC_NHP, EMA_HERBAL],
    },
    fr: {
      title:
        "Plantes et médicaments pour la tension : effets opposés, potassium et hypotension",
      metaTitle:
        "Plantes et antihypertenseurs : réglisse, aubépine, ail et diurétiques",
      metaDescription:
        "Pourquoi la réglisse entière bloque les antihypertenseurs et baisse le potassium, et comment aubépine, hibiscus ou ail s'ajoutent aux traitements.",
      intro:
        "Les plantes agissent parfois à l'opposé sur les traitements de la tension artérielle : la réglisse entière freine directement l'effet des antihypertenseurs, alors que l'aubépine, l'ail ou l'hibiscus peuvent accentuer une chute de tension.",
      sections: [
        {
          heading:
            "Plantes qui augmentent la tension ou abaissent le potassium",
          paragraphs: [
            "La racine de réglisse entière riche en glycyrrhizine (contrairement aux extraits DGL) favorise la rétention d'eau et de sodium tout en augmentant la perte de potassium — un risque majeur avec les diurétiques (furosémide, hydrochlorothiazide).",
            "Les stimulants comme l'orange amère (synéphrine) ou le guarana peuvent également contrer l'effet des bêtabloquants et des IEC.",
          ],
        },
        {
          heading: "Hypotension additive et métabolisme CYP3A4",
          paragraphs: [
            "L'hibiscus, l'aubépine et l'extrait d'ail vieilli peuvent accentuer la vasodilatation avec le lisinopril ou les inhibiteurs calciques : surveillez les étourdissements au lever.",
            "Des plantes modulant fortement le CYP3A4 modifient aussi les taux de nifédipine ou d'amlodipine ; validez toujours auprès de votre pharmacien.",
          ],
        },
      ],
      sources: [NCCIH_WISE, NCCIH_GLANCE, HC_NHP, EMA_HERBAL],
    },
    related: [
      {
        href: "/medications/antihypertensives",
        en: "Antihypertensive herb interactions",
        fr: "Interactions des antihypertenseurs",
      },
      {
        href: "/medications/furosemide",
        en: "Furosemide interactions",
        fr: "Interactions du furosémide",
      },
      {
        href: "/symptoms/blood-pressure",
        en: "Blood-pressure herbs overview",
        fr: "Plantes et pression artérielle",
      },
    ],
  },
  {
    slug: "herbs-and-thyroid-medications",
    status: "published",
    updated: "2026-11-20",
    reviewedBy: "yasser-bheekun",
    reviewedOn: "2026-11-20",
    en: {
      title:
        "Herbs and Thyroid Medications: Timing Levothyroxine Around Iodine & Botanicals",
      metaTitle:
        "Herbs & Levothyroxine (Synthroid): Absorption, Kelp & Ashwagandha Risks",
      metaDescription:
        "How kelp iodine, soy/fiber supplements, bugleweed, lemon balm, and ashwagandha interact with levothyroxine—and exact spacing habits pharmacists check.",
      intro:
        "Levothyroxine has a narrow therapeutic window: small drops in gut absorption from mineral-rich algae or high-fiber powders—or direct thyroid-axis stimulation from seaweeds and adaptogens—can noticeably shift TSH values.",
      sections: [
        {
          heading:
            "Absorption blockers that keep levothyroxine out of the bloodstream",
          paragraphs: [
            "Bulk mucilage fibers (psyllium, glucomannan, slippery elm), calcium/iron-rich herbs, soy isoflavones, and coffee taken close to levothyroxine bind the hormone in the stomach or slow dissolution.",
            "Pharmacists routinely recommend taking levothyroxine with plain water on an empty stomach and separating herbal capsules or fiber drinks by at least 4 hours.",
          ],
        },
        {
          heading: "Iodine-rich seaweeds & thyroid-axis botanicals",
          paragraphs: [
            "Kelp, bladderwrack (Fucus vesiculosus), and dulse vary dramatically in iodine content; excessive dietary or supplemental iodine can paradoxically suppress thyroid hormone synthesis (Wolff-Chaikoff effect) or trigger hyperthyroidism in nodular thyroids.",
            "Clinical case reports also document occasional reversible thyrotoxicosis flares with ashwagandha supplements, while lemon balm (Melissa) and bugleweed (Lycopus) show anti-thyroid activity in preclinical/historical references—meaning any thyroid symptom shift or lab change warrants immediate pharmacist/endocrinologist review.",
          ],
        },
      ],
      sources: [NCCIH_WISE, NCCIH_GLANCE, HC_NHP, PUBMED],
    },
    fr: {
      title:
        "Plantes et médicaments thyroïdiens : espacer la lévothyroxine et éviter les variations d'iode",
      metaTitle:
        "Plantes et lévothyroxine (Synthroid) : algues, fibres et ashwagandha",
      metaDescription:
        "Comment le varech (iode), les fibres, le psyllium, l'ashwagandha et la mélisse influencent l'absorption et la TSH sous lévothyroxine.",
      intro:
        "La lévothyroxine possède une marge thérapeutique étroite : de petites pertes d'absorption digestive ou des variations d'apport en iode via des suppléments marins suffisent à déstabiliser la TSH.",
      sections: [
        {
          heading: "Fibres et minéraux qui bloquent l'absorption intestinale",
          paragraphs: [
            "Le psyllium, l'orme rouge, le soja, le calcium, le fer et même le café pris trop près du comprimé réduisent l'absorption de la lévothyroxine.",
            "Prenez la lévothyroxine à jeun avec de l'eau et espacez les suppléments de plantes ou de fibres d'au moins 4 heures selon l'avis de votre pharmacien.",
          ],
        },
        {
          heading: "Algues iodées et plantes actives sur l'axe thyroïdien",
          paragraphs: [
            "Le varech (kelp) et les algues brunes ont une teneur en iode très variable qui peut perturber l'équilibre thyroïdien.",
            "Quelques cas cliniques ont aussi associé l'ashwagandha à une hyperthyroïdie transitoire, tandis que la mélisse et le lycope présentent une activité antithyroïdienne expérimentale : signalez tout complément à votre médecin et pharmacien avant vos bilans TSH.",
          ],
        },
      ],
      sources: [NCCIH_WISE, NCCIH_GLANCE, HC_NHP, PUBMED],
    },
    related: [
      {
        href: "/medications/levothyroxine",
        en: "Levothyroxine interactions",
        fr: "Interactions de la lévothyroxine",
      },
      {
        href: "/herbs/ashwagandha",
        en: "Ashwagandha safety monograph",
        fr: "Monographie de l'ashwagandha",
      },
      {
        href: "/guides/how-to-check-an-interaction",
        en: "How to check an interaction",
        fr: "Comment vérifier une interaction",
      },
    ],
  },
];
