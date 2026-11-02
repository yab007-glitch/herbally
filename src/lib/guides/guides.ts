/**
 * Guides hub content (SEO brief, Workstream F).
 *
 * Every guide here is a **draft**: nothing has been reviewed by a human, so the
 * detail page renders `noindex` and a draft banner, and nothing but the hub goes
 * into the sitemap. Publishing is a human decision made by flipping `status`
 * after a real review — see `docs/review-priority.md` for what a review means.
 *
 * Content rule: these are evidence overviews, not recommendations. They explain
 * how to read the site and what the limits of the evidence are. They do not tell
 * anyone to take anything, and they do not name a dose.
 */

export type GuideStatus = "draft" | "published";

export interface GuideSection {
  heading: string;
  paragraphs: string[];
}

export interface GuideCopy {
  title: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  sections: GuideSection[];
  sources: { label: string; url: string }[];
}

export interface Guide {
  slug: string;
  status: GuideStatus;
  /** ISO date of the last edit to this guide. */
  updated: string;
  en: GuideCopy;
  fr: GuideCopy;
  /** Internal pages this guide should hand off to. */
  related: { href: string; en: string; fr: string }[];
}

const NCCIH_GLANCE = {
  label: "NCCIH — Herbs at a Glance",
  url: "https://www.nccih.nih.gov/health/herbsataglance",
};
const NCCIH_WISE = {
  label: "NCCIH — Using dietary supplements wisely",
  url: "https://www.nccih.nih.gov/health/using-dietary-supplements-wisely",
};
const FDA_SUPPLEMENTS = {
  label: "FDA — Dietary supplements",
  url: "https://www.fda.gov/food/dietary-supplements",
};
const EMA_HERBAL = {
  label: "EMA — Herbal medicinal products",
  url: "https://www.ema.europa.eu/en/human-regulatory-overview/herbal-medicinal-products",
};
const PUBMED = { label: "PubMed", url: "https://pubmed.ncbi.nlm.nih.gov/" };

export const GUIDES: Guide[] = [
  {
    slug: "how-to-check-an-interaction",
    status: "draft",
    updated: "2026-11-02",
    en: {
      title: "How to check a herb–drug interaction safely",
      metaTitle: "How to Check a Herb–Drug Interaction",
      metaDescription:
        "A practical walkthrough of checking a herb against your medication: what the result means, what it does not mean, and what to do with it.",
      intro:
        "A checker gives you a starting point, not an answer. This guide walks through how to use one without over-trusting it, and what to bring to a pharmacist so the conversation is worth having.",
      sections: [
        {
          heading: "Start with the exact product, not the plant",
          paragraphs: [
            "Two products made from the same plant are not interchangeable. A dried leaf in a tea, a concentrated extract in a capsule and a tincture can differ by an order of magnitude in how much of a given compound you actually take, and the interaction risk follows the amount.",
            "Write down what the label says — the plant, the part used, the form, and the amount per serving — not what the bottle is marketed as. If the label does not state the strength, that is already useful information: it is a product you cannot reason about.",
          ],
        },
        {
          heading: "Check the pair, then check around the pair",
          paragraphs: [
            "When you check one herb against one medicine, you learn about that pair. You do not learn about the other four things you take. Run each herb separately against each medicine, and pay attention to repeated mechanisms: two different herbs that both thin the blood are not two independent mild risks.",
            "A result of “no recorded interaction” means the pair is not in the curated table. It does not mean the combination has been studied and cleared.",
          ],
        },
        {
          heading: "Read the severity, then read the source",
          paragraphs: [
            "Severity labels are only as good as the evidence behind them. Open the citation for the pair you care about. If it is a single case report, treat the finding as a signal worth asking about, not as a measured risk. If it is a pharmacokinetic study with numbers, that is a different kind of claim.",
            "This site records the source for each pair for exactly this reason: the label is a summary, and the source is the evidence.",
          ],
        },
        {
          heading: "Take the question to a pharmacist",
          paragraphs: [
            "A pharmacist can see your actual prescriptions, doses and history, and can check interactions against the products you really bought. That is the step that turns a database result into a decision.",
            "Bring the list — plant, form, amount, timing — and say what you are trying to achieve. “Is this safe with my warfarin, and does the timing matter?” is a question a pharmacist can answer; “is turmeric safe?” is not.",
          ],
        },
      ],
      sources: [NCCIH_GLANCE, NCCIH_WISE, FDA_SUPPLEMENTS],
    },
    fr: {
      title:
        "Comment vérifier une interaction plante-médicament sans se tromper",
      metaTitle: "Vérifier une interaction plante-médicament",
      metaDescription:
        "Comment vérifier une plante contre vos médicaments : ce que le résultat veut dire, ce qu’il ne veut pas dire, et quoi faire ensuite.",
      intro:
        "Un vérificateur donne un point de départ, pas une réponse. Ce guide explique comment s’en servir sans lui faire trop confiance, et quoi apporter à un pharmacien pour que la conversation serve à quelque chose.",
      sections: [
        {
          heading: "Partez du produit exact, pas de la plante",
          paragraphs: [
            "Deux produits tirés de la même plante ne sont pas interchangeables. Une feuille séchée en infusion, un extrait concentré en gélule et une teinture peuvent varier d’un ordre de grandeur sur la quantité de composé réellement absorbée — et le risque d’interaction suit la quantité.",
            "Notez ce que dit l’étiquette : la plante, la partie utilisée, la forme et la quantité par portion — pas le nom commercial. Si l’étiquette n’indique pas la concentration, c’est déjà une information utile : c’est un produit sur lequel on ne peut pas raisonner.",
          ],
        },
        {
          heading: "Vérifiez la paire, puis ce qu’il y a autour",
          paragraphs: [
            "Vérifier une plante contre un médicament renseigne sur cette paire. Pas sur les quatre autres produits que vous prenez. Faites chaque plante séparément contre chaque médicament, et surveillez les mécanismes qui se répètent : deux plantes différentes qui fluidifient le sang ne sont pas deux risques légers indépendants.",
            "Un résultat « aucune interaction répertoriée » signifie que la paire n’est pas dans la table. Pas que l’association a été étudiée et jugée sans danger.",
          ],
        },
        {
          heading: "Lisez la gravité, puis lisez la source",
          paragraphs: [
            "Une étiquette de gravité vaut ce que valent les preuves derrière. Ouvrez la citation de la paire qui vous concerne. S’il s’agit d’un seul cas rapporté, prenez-le comme un signal à vérifier, pas comme un risque mesuré. S’il s’agit d’une étude pharmacocinétique avec des chiffres, ce n’est pas la même affirmation.",
            "Ce site conserve la source de chaque paire précisément pour cela : l’étiquette est un résumé, la source est la preuve.",
          ],
        },
        {
          heading: "Posez la question à un pharmacien",
          paragraphs: [
            "Un pharmacien voit vos ordonnances, vos doses et votre dossier, et peut vérifier les interactions contre les produits que vous avez réellement achetés. C’est l’étape qui transforme un résultat de base de données en décision.",
            "Apportez la liste — plante, forme, quantité, heure — et dites ce que vous cherchez à obtenir. « Est-ce compatible avec ma warfarine, et l’heure de prise change-t-elle quelque chose ? » est une question à laquelle un pharmacien peut répondre ; « le curcuma est-il sûr ? » ne l’est pas.",
          ],
        },
      ],
      sources: [NCCIH_GLANCE, NCCIH_WISE, FDA_SUPPLEMENTS],
    },
    related: [
      {
        href: "/herb-drug-interactions",
        en: "Interaction library",
        fr: "Bibliothèque d’interactions",
      },
      { href: "/methodology", en: "Methodology", fr: "Méthodologie" },
      {
        href: "/herbs",
        en: "Herb database",
        fr: "Base de données des plantes",
      },
    ],
  },
  {
    slug: "how-to-read-herb-evidence",
    status: "draft",
    updated: "2026-11-02",
    en: {
      title: "How to read herb evidence: traditional use vs clinical evidence",
      metaTitle: "Reading Herb Evidence: Traditional Use vs Clinical Evidence",
      metaDescription:
        "What the evidence grades on HerbAlly mean, how a single case report differs from a trial, and why “not studied” is not the same as “safe”.",
      intro:
        "The same sentence — “this herb helps with sleep” — can rest on a 2,000-person trial or on a book from 1930. Evidence grades exist to tell those apart before you decide how much weight to give the claim.",
      sections: [
        {
          heading: "Four grades, and what each one is worth",
          paragraphs: [
            "Primary source: the claim traces to a specific study or an official monograph, and the citation is on the page. This is the strongest thing the site records — and still only as good as the study.",
            "Clinical evidence: human trials exist, but they are limited, small, or disagree with each other. Real evidence, mixed signal.",
            "Traditional use: the use is documented historically and has not been tested clinically. That is not zero — long use sometimes reflects something real — but it is not a measured effect either.",
            "Unknown — not enough data: the honest answer when nobody has looked. It appears on this site rather than being filled with a plausible sentence.",
          ],
        },
        {
          heading: "A case report is not a trial",
          paragraphs: [
            "Much of what is published about herb–drug interactions is a single case report: one patient, one outcome, often with confounders nobody controlled. Case reports are how rare harms get noticed at all, so they matter — but they cannot tell you how likely something is.",
            "When a page cites one case, read it as “this has happened”, not as “this will happen to you” or “this happens to 1 in 100”.",
          ],
        },
        {
          heading: "“Not studied” is not “safe”",
          paragraphs: [
            "An absent warning is the most misread signal on any health site. Most herb–drug combinations have never been studied in anyone. The absence of a recorded interaction reflects the state of the literature, not the safety of the combination.",
            "That is why this site distinguishes an unrecorded pair from a studied, benign one — and why the interaction checker says “not recorded” rather than “no interaction”.",
          ],
        },
        {
          heading: "How to use a grade when you are the reader",
          paragraphs: [
            "Match your decision to the strength of the evidence. A traditional-use claim about a tea is a reasonable thing to read about; it is not a reasonable basis for changing a prescription. For anything that interacts with a medicine you take, the grade that matters is the one on the interaction, and the source behind it.",
          ],
        },
      ],
      sources: [NCCIH_GLANCE, EMA_HERBAL, PUBMED],
    },
    fr: {
      title:
        "Comment lire les preuves sur les plantes : usage traditionnel et preuves cliniques",
      metaTitle: "Lire les preuves : usage traditionnel ou preuves cliniques",
      metaDescription:
        "Ce que signifient les niveaux de preuve sur HerbAlly, la différence entre un cas rapporté et un essai, et pourquoi « non étudié » n’est pas « sans danger ».",
      intro:
        "La même phrase — « cette plante aide à dormir » — peut reposer sur un essai de 2 000 personnes ou sur un livre de 1930. Les niveaux de preuve servent à faire la différence avant de décider quel poids donner à l’affirmation.",
      sections: [
        {
          heading: "Quatre niveaux, et ce que chacun vaut",
          paragraphs: [
            "Source primaire : l’énoncé renvoie à une étude précise ou à une monographie officielle, et la citation figure sur la page. C’est le niveau le plus fort enregistré par le site — et il vaut encore ce que vaut l’étude.",
            "Preuves cliniques : des essais chez l’humain existent, mais ils sont limités, petits ou se contredisent. De vraies données, un signal mitigé.",
            "Usage traditionnel : l’usage est documenté historiquement et n’a pas été testé cliniquement. Ce n’est pas zéro — un usage long reflète parfois quelque chose de réel — mais ce n’est pas un effet mesuré non plus.",
            "Inconnu — données insuffisantes : la réponse honnête quand personne n’a regardé. Elle apparaît sur ce site au lieu d’être remplacée par une phrase plausible.",
          ],
        },
        {
          heading: "Un cas rapporté n’est pas un essai",
          paragraphs: [
            "Une bonne partie de ce qui est publié sur les interactions plante-médicament tient à un seul cas : un patient, un résultat, souvent avec des facteurs que personne n’a contrôlés. Les cas rapportés sont la façon dont les effets rares se font remarquer, donc ils comptent — mais ils ne disent pas quelle est la probabilité.",
            "Quand une page cite un cas unique, lisez « cela est arrivé », pas « cela vous arrivera » ni « une personne sur 100 ».",
          ],
        },
        {
          heading: "« Non étudié » n’est pas « sans danger »",
          paragraphs: [
            "L’absence d’avertissement est le signal le plus mal lu sur un site de santé. La plupart des combinaisons plante-médicament n’ont jamais été étudiées chez quiconque. L’absence d’interaction répertoriée reflète l’état de la littérature, pas l’innocuité de l’association.",
            "C’est pourquoi ce site distingue une paire non répertoriée d’une paire étudiée et bénigne — et pourquoi le vérificateur écrit « non répertorié » plutôt que « aucune interaction ».",
          ],
        },
        {
          heading: "Utiliser un niveau de preuve quand on est le lecteur",
          paragraphs: [
            "Alignez votre décision sur la force des preuves. Une affirmation d’usage traditionnel à propos d’une infusion est raisonnable à lire ; ce n’est pas une base raisonnable pour changer une ordonnance. Pour tout ce qui interagit avec un médicament que vous prenez, le niveau qui compte est celui de l’interaction, et la source derrière.",
          ],
        },
      ],
      sources: [NCCIH_GLANCE, EMA_HERBAL, PUBMED],
    },
    related: [
      { href: "/methodology", en: "Methodology", fr: "Méthodologie" },
      {
        href: "/herbs",
        en: "Herb database",
        fr: "Base de données des plantes",
      },
      { href: "/faq", en: "Common questions", fr: "Questions fréquentes" },
    ],
  },
  {
    slug: "how-the-dosage-calculator-works",
    status: "draft",
    updated: "2026-11-02",
    en: {
      title: "How the herbal dosage calculator works — and its limits",
      metaTitle: "How the Herbal Dosage Calculator Works",
      metaDescription:
        "What the calculator computes, which formulas it uses, what it cannot know about you, and why a reference dose is not a prescription.",
      intro:
        "The calculator turns a published adult dose range and your weight into a number. That is arithmetic, not judgement — and the difference matters more here than anywhere else on the site.",
      sections: [
        {
          heading: "What it actually computes",
          paragraphs: [
            "It takes a reference adult dose recorded for that herb and, where a weight-based formula applies, scales it. The formulas are named on the page rather than hidden, so you can see which one produced the number.",
            "It does not decide whether the herb is appropriate for you, and it cannot adjust for kidney or liver function, pregnancy, breastfeeding, age beyond the adult range, or the other medicines you take.",
          ],
        },
        {
          heading: "Reference dose is not a recommendation",
          paragraphs: [
            "A dose range in a monograph is a description of what has been used and studied — not a target. Products differ in strength, and a dose that is reasonable in a clinical trial may be inappropriate for a product whose extract ratio is unknown.",
            "If you cannot tell what strength the product is, the calculator cannot help you: the number it produces cannot be applied to an unknown concentration.",
          ],
        },
        {
          heading: "Children, pregnancy and breastfeeding",
          paragraphs: [
            "The calculator is an adult tool. Paediatric dosing of herbal products is not a matter of scaling an adult dose by weight — it needs a clinician who knows the child, and often it is simply not established. The same caution applies in pregnancy and breastfeeding, where the honest answer for many herbs is that the data are not there.",
          ],
        },
        {
          heading: "What to do with the number",
          paragraphs: [
            "Use it to understand the order of magnitude and to ask a better question. “The monograph range is this; the capsule I bought is that — how do they compare?” is a pharmacist question with a real answer. The calculator gets you to the question; it does not answer it for you.",
          ],
        },
      ],
      sources: [NCCIH_WISE, EMA_HERBAL],
    },
    fr: {
      title: "Comment fonctionne le calculateur de posologie — et ses limites",
      metaTitle: "Comment fonctionne le calculateur de posologie",
      metaDescription:
        "Ce que le calculateur calcule, quelles formules il utilise, ce qu’il ne peut pas savoir de vous, et pourquoi une dose de référence n’est pas une ordonnance.",
      intro:
        "Le calculateur transforme une fourchette de dose adulte publiée et votre poids en un chiffre. C’est de l’arithmétique, pas du jugement — et la différence compte ici plus qu’ailleurs sur le site.",
      sections: [
        {
          heading: "Ce qu’il calcule réellement",
          paragraphs: [
            "Il prend une dose adulte de référence enregistrée pour cette plante et, lorsqu’une formule basée sur le poids s’applique, la met à l’échelle. Les formules sont nommées sur la page plutôt que cachées, pour que vous puissiez voir laquelle a produit le chiffre.",
            "Il ne décide pas si la plante vous convient, et il ne peut pas tenir compte de la fonction rénale ou hépatique, de la grossesse, de l’allaitement, d’un âge hors adulte, ni des autres médicaments que vous prenez.",
          ],
        },
        {
          heading: "Une dose de référence n’est pas une recommandation",
          paragraphs: [
            "Une fourchette de dose dans une monographie décrit ce qui a été utilisé et étudié — ce n’est pas une cible. Les produits diffèrent en concentration, et une dose raisonnable dans un essai peut être inadaptée pour un produit dont le ratio d’extrait est inconnu.",
            "Si vous ne pouvez pas savoir quelle est la concentration du produit, le calculateur ne peut pas vous aider : le chiffre obtenu ne s’applique pas à une concentration inconnue.",
          ],
        },
        {
          heading: "Enfants, grossesse et allaitement",
          paragraphs: [
            "Le calculateur est un outil pour adultes. La posologie pédiatrique des produits de plantes ne s’obtient pas en réduisant une dose adulte au prorata du poids — elle demande un clinicien qui connaît l’enfant, et souvent elle n’est simplement pas établie. La même prudence vaut en grossesse et en allaitement, où la réponse honnête pour beaucoup de plantes est que les données n’existent pas.",
          ],
        },
        {
          heading: "Que faire du chiffre",
          paragraphs: [
            "Servez-vous-en pour comprendre l’ordre de grandeur et poser une meilleure question. « La monographie indique cette fourchette ; ma gélule contient ceci — comment ça se compare ? » est une question de pharmacien qui a une vraie réponse. Le calculateur vous amène à la question ; il n’y répond pas à votre place.",
          ],
        },
      ],
      sources: [NCCIH_WISE, EMA_HERBAL],
    },
    related: [
      {
        href: "/calculator",
        en: "Dosage calculator",
        fr: "Calculateur de posologie",
      },
      { href: "/methodology", en: "Methodology", fr: "Méthodologie" },
      {
        href: "/herbs",
        en: "Herb database",
        fr: "Base de données des plantes",
      },
    ],
  },
  {
    slug: "herbs-and-blood-thinners",
    status: "draft",
    updated: "2026-11-02",
    en: {
      title: "Herbs and blood thinners: why the interactions matter",
      metaTitle: "Herbs and Blood Thinners: Why Interactions Matter",
      metaDescription:
        "An educational overview of how herbs can interfere with anticoagulants and antiplatelet medicines, and why the risk is not always visible.",
      intro:
        "Blood thinners have a narrow margin between “protects you” and “bleeds you”. Anything that nudges clotting, platelet function or how the drug is metabolised can move you across that line without any obvious symptom at first.",
      sections: [
        {
          heading: "Three ways a herb can interfere",
          paragraphs: [
            "Pharmacodynamic: the herb does something similar to the drug. Herbs that affect platelet function or clotting, taken alongside an anticoagulant, can add to the effect rather than balance it.",
            "Pharmacokinetic: the herb changes how much drug is in your blood, by altering the enzymes that break it down or the transporters that move it. The patient feels nothing; the blood level changes.",
            "Displacement and absorption: some herbs and supplements bind or slow absorption, changing how much of a dose actually arrives.",
          ],
        },
        {
          heading: "Why “I feel fine” is not the test",
          paragraphs: [
            "Anticoagulation is measured in the blood, not in how you feel. A meaningful shift in clotting tendency can be present with no symptoms until the day it is not — a bruise that will not settle, a nosebleed that keeps going, blood in stool or urine.",
            "That is the argument for checking before you combine, rather than after something happens.",
          ],
        },
        {
          heading: "What this site can and cannot tell you",
          paragraphs: [
            "HerbAlly records curated pairs with a severity and a source. That is enough to know a combination is worth asking about, and to know which pairs the literature actually describes. It is not a measurement of your clotting status, and the absence of a pair is not clearance.",
            "If you take an anticoagulant or an antiplatelet medicine, the useful move is to list every herb and supplement you use — including teas and “natural” products — and have them checked against your prescriptions.",
          ],
        },
      ],
      sources: [NCCIH_GLANCE, FDA_SUPPLEMENTS, PUBMED],
    },
    fr: {
      title: "Plantes et anticoagulants : pourquoi les interactions comptent",
      metaTitle:
        "Plantes et anticoagulants : pourquoi les interactions comptent",
      metaDescription:
        "Aperçu éducatif sur la façon dont les plantes peuvent interférer avec les anticoagulants et les antiplaquettaires, et pourquoi le risque reste parfois invisible.",
      intro:
        "Les anticoagulants ont une marge étroite entre « vous protège » et « vous fait saigner ». Tout ce qui touche la coagulation, la fonction plaquettaire ou le métabolisme du médicament peut vous faire franchir cette ligne sans symptôme évident au début.",
      sections: [
        {
          heading: "Trois façons d’interférer",
          paragraphs: [
            "Pharmacodynamique : la plante fait quelque chose de semblable au médicament. Les plantes qui agissent sur les plaquettes ou la coagulation, prises avec un anticoagulant, peuvent s’additionner à l’effet plutôt que l’équilibrer.",
            "Pharmacocinétique : la plante modifie la quantité de médicament dans le sang, en altérant les enzymes qui le décomposent ou les transporteurs qui le déplacent. La personne ne ressent rien ; le taux sanguin change.",
            "Déplacement et absorption : certaines plantes et certains suppléments se lient au médicament ou ralentissent son absorption, ce qui change la quantité réellement disponible.",
          ],
        },
        {
          heading: "Pourquoi « je me sens bien » ne suffit pas",
          paragraphs: [
            "La coagulation se mesure dans le sang, pas dans le ressenti. Un changement notable de la tendance à coaguler peut être présent sans symptôme jusqu’au jour où il ne l’est plus — un bleu qui ne se résorbe pas, un saignement de nez qui continue, du sang dans les selles ou les urines.",
            "C’est l’argument pour vérifier avant de combiner, plutôt qu’après coup.",
          ],
        },
        {
          heading: "Ce que ce site peut dire, et ce qu’il ne peut pas",
          paragraphs: [
            "HerbAlly consigne des paires répertoriées avec une gravité et une source. C’est assez pour savoir qu’une association mérite une question, et pour savoir quelles paires la littérature décrit vraiment. Ce n’est pas une mesure de votre coagulation, et l’absence d’une paire n’est pas une autorisation.",
            "Si vous prenez un anticoagulant ou un antiplaquettaire, la démarche utile est de lister toutes les plantes et tous les suppléments que vous utilisez — infusions et produits « naturels » compris — et de les faire vérifier contre vos ordonnances.",
          ],
        },
      ],
      sources: [NCCIH_GLANCE, FDA_SUPPLEMENTS, PUBMED],
    },
    related: [
      {
        href: "/herb-drug-interactions",
        en: "Interaction library",
        fr: "Bibliothèque d’interactions",
      },
      {
        href: "/herbs/turmeric",
        en: "Turmeric profile",
        fr: "Fiche du curcuma",
      },
      { href: "/methodology", en: "Methodology", fr: "Méthodologie" },
    ],
  },
  {
    slug: "herbs-for-sleep-and-anxiety",
    status: "draft",
    updated: "2026-11-02",
    en: {
      title: "Herbs for sleep and anxiety: what the evidence says",
      metaTitle: "Herbs for Sleep and Anxiety: What the Evidence Says",
      metaDescription:
        "What is actually established about common calming herbs, where the evidence is thin, and why sedation plus other medicines is the risk to watch.",
      intro:
        "Sleep and anxiety are the two reasons people most often reach for a herb — and the two areas where the gap between “traditionally used” and “shown to work” is widest. Here is how to read that gap honestly.",
      sections: [
        {
          heading: "The evidence is uneven, not absent",
          paragraphs: [
            "Some calming herbs have small randomised trials behind them; many have only traditional use. Small trials in this area are frequently short, industry-funded, and inconsistent between studies, which is why the same herb can look promising in one review and unimpressive in the next.",
            "On this site that difference shows up as an evidence grade per herb, and as a citation list you can open. A herb graded “traditional use” is not a herb we are calling ineffective — it is one where nobody has produced the trial.",
          ],
        },
        {
          heading: "The interaction that actually matters",
          paragraphs: [
            "Sedation adds up. Calming herbs taken with alcohol, benzodiazepines, sleeping tablets, opioids or antihistamines can produce more sedation than either would alone — and that is a driving and falls risk, not a theoretical one.",
            "A second pattern worth knowing: some calming herbs affect the same liver enzymes that clear other medicines, which changes drug levels without changing how you feel.",
          ],
        },
        {
          heading: "What this guide is not",
          paragraphs: [
            "It is not a recommendation to take anything, and it does not name a dose. Persistent insomnia and anxiety are treatable conditions, and the treatments with the strongest evidence are not herbs. If sleep has been poor for weeks, that is a conversation with a clinician, not a supplement decision.",
          ],
        },
      ],
      sources: [NCCIH_GLANCE, NCCIH_WISE, PUBMED],
    },
    fr: {
      title: "Plantes pour le sommeil et l’anxiété : ce que disent les preuves",
      metaTitle: "Plantes pour le sommeil et l’anxiété : les preuves",
      metaDescription:
        "Ce qui est réellement établi sur les plantes calmantes courantes, où les preuves sont minces, et pourquoi la sédation cumulée est le risque à surveiller.",
      intro:
        "Le sommeil et l’anxiété sont les deux raisons pour lesquelles on se tourne le plus souvent vers une plante — et les deux domaines où l’écart entre « traditionnellement utilisé » et « démontré » est le plus large. Voici comment lire cet écart honnêtement.",
      sections: [
        {
          heading: "Les preuves sont inégales, pas absentes",
          paragraphs: [
            "Certaines plantes calmantes ont derrière elles de petits essais randomisés ; beaucoup n’ont qu’un usage traditionnel. Les petits essais dans ce domaine sont souvent courts, financés par l’industrie et incohérents d’une étude à l’autre, ce qui explique qu’une même plante paraisse prometteuse dans une revue et décevante dans la suivante.",
            "Sur ce site, cette différence apparaît sous forme d’un niveau de preuve par plante et d’une liste de citations que vous pouvez ouvrir. Une plante classée « usage traditionnel » n’est pas une plante déclarée inefficace — c’est une plante pour laquelle personne n’a produit l’essai.",
          ],
        },
        {
          heading: "L’interaction qui compte vraiment",
          paragraphs: [
            "La sédation s’additionne. Des plantes calmantes prises avec de l’alcool, des benzodiazépines, des somnifères, des opioïdes ou des antihistaminiques peuvent produire plus de sédation que chacun séparément — et c’est un risque de chute et de conduite, pas une théorie.",
            "Un second mécanisme à connaître : certaines plantes calmantes agissent sur les mêmes enzymes du foie qui éliminent d’autres médicaments, ce qui change les taux sanguins sans changer le ressenti.",
          ],
        },
        {
          heading: "Ce que ce guide n’est pas",
          paragraphs: [
            "Ce n’est pas une recommandation de prendre quoi que ce soit, et il ne nomme aucune dose. L’insomnie et l’anxiété persistantes sont des conditions traitables, et les traitements les mieux étayés ne sont pas des plantes. Si le sommeil est mauvais depuis des semaines, c’est une conversation avec un clinicien, pas une décision de supplément.",
          ],
        },
      ],
      sources: [NCCIH_GLANCE, NCCIH_WISE, PUBMED],
    },
    related: [
      {
        href: "/symptoms/anxiety",
        en: "Herbs by symptom: anxiety",
        fr: "Plantes par symptôme : anxiété",
      },
      {
        href: "/herbs/valerian",
        en: "Valerian profile",
        fr: "Fiche de la valériane",
      },
      {
        href: "/herb-drug-interactions",
        en: "Interaction library",
        fr: "Bibliothèque d’interactions",
      },
    ],
  },
];

export function listGuides(): Guide[] {
  return GUIDES;
}

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

/** Only reviewed guides may be indexed and listed in the sitemap. */
export function publishedGuides(): Guide[] {
  return GUIDES.filter((g) => g.status === "published");
}
