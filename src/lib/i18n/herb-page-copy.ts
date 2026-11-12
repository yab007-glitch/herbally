/**
 * Copy for the herb-detail sections that are composed in code rather than
 * stored per herb: the regulator source blocks, the evidence trail and the
 * "records" narrative.
 *
 * These strings used to be English literals inside page.tsx and its components,
 * which is why a French herb page was French at the top and English from the
 * first source block down. They live in one typed map so a missing translation
 * is a type error rather than an English sentence on /fr.
 */
import {
  NARRATIVE_EN,
  NARRATIVE_FR,
  type NarrativeCopy,
} from "@/lib/herbs/narrative";

export type CopyLocale = "en" | "fr";

export interface SourceBlockCopy {
  heading: (herbName: string) => string;
  sourceLabel: string;
  licenceText: string;
  claimsHeading: string;
  safetyHeading: string;
  /**
   * Rendered above the text when the source predates modern medicine. A 1918
   * dispensatory recommends aconite for high blood pressure; without this line
   * the entry reads as advice.
   */
  notice?: string;
}

export interface HerbPageCopy {
  /** Link to /methodology that explains the evidence grades. */
  evidenceLabelsLink: string;
  sources: {
    label: string;
    checkedLabel: string;
    count: (n: number) => string;
    note: string;
  };
  /**
   * Shown on a French page above text that is reproduced in its source
   * language. A quotation is not ours to translate, so it is labelled instead.
   */
  verbatimQuoteNote: string | null;
  /** Label of the <details> that reveals the source-language text. */
  verbatimExpandLabel: string;
  /** "Reproduced verbatim from <source>." */
  reproducedLabel: string;
  liverTox: SourceBlockCopy;
  healthCanada: SourceBlockCopy;
  nccih: SourceBlockCopy;
  /**
   * Public-domain books, keyed by the exact `source` value in
   * herb_monograph_sources. A source with no entry here renders as NCCIH, which
   * would print the wrong heading and the wrong licence, so adding a book to the
   * database means adding it here in both locales.
   */
  historicalSources: Record<string, SourceBlockCopy>;
  narrative: NarrativeCopy;
  severity: Record<string, string>;
  monographEnglishNotice: string | null;
}

const EN: HerbPageCopy = {
  evidenceLabelsLink: "How to read the evidence and review labels",
  sources: {
    label: "Sources checked for this entry",
    checkedLabel: "Last checked",
    count: (n) => `${n} independent source${n === 1 ? "" : "s"}`,
    note: "Cross-checked against these sources; where nothing was found, the page says so rather than filling the gap.",
  },
  verbatimQuoteNote: null,
  verbatimExpandLabel: "Show source text",
  reproducedLabel: "Reproduced verbatim from",
  liverTox: {
    heading: (name) => `What LiverTox says about ${name}`,
    sourceLabel:
      "LiverTox — National Institute of Diabetes and Digestive and Kidney Diseases",
    licenceText:
      "LiverTox is a US government work and the source chapter carries no copyright statement, so this text is reproduced with attribution.",
    claimsHeading: "Background",
    safetyHeading: "Hepatotoxicity and likelihood of liver injury",
  },
  healthCanada: {
    heading: (name) => `What Health Canada says about ${name}`,
    sourceLabel: "Health Canada's Natural Health Products Ingredients Database",
    licenceText:
      "Contains information licensed under the Open Government Licence – Canada.",
    claimsHeading: "Approved uses",
    safetyHeading: "Cautions, contraindications and adverse reactions",
  },
  nccih: {
    heading: (name) => `What the NIH says about ${name}`,
    sourceLabel: "National Center for Complementary and Integrative Health",
    licenceText:
      "US government works are not subject to copyright, so this text is reproduced in full rather than summarised.",
    claimsHeading: "Background and evidence",
    safetyHeading: "Safety, in the NIH's words",
  },
  historicalSources: {
    "US Dispensatory 1918": {
      heading: (name) => `What the 1918 Dispensatory said about ${name}`,
      sourceLabel: "The United States Dispensatory, 20th edition (1918)",
      licenceText:
        "The book was published in 1918 and is in the public domain, so the entry is reproduced in full.",
      claimsHeading: "The entry, as written",
      safetyHeading: "Recorded effects of overdose",
      notice:
        "This records what a pharmacy textbook taught in 1918. Some of it is now known to be wrong, and the doses of that era are not safe. It is not medical advice; the warnings above give current guidance.",
    },
    "Fernie's Herbal Simples 1897": {
      heading: (name) => `What Fernie's Herbal Simples said about ${name}`,
      sourceLabel:
        "Herbal Simples Approved for Modern Uses of Cure, W. T. Fernie (1897)",
      licenceText:
        "The book was published in 1897 and is in the public domain; this text comes from Project Gutenberg.",
      claimsHeading: "The entry, as written",
      safetyHeading: "Recorded effects",
      notice:
        "This records what a Victorian doctor wrote in 1897. Some of it is now known to be wrong, and it is not medical advice; the warnings above give current guidance.",
    },
  },
  narrative: NARRATIVE_EN,
  severity: {
    contraindicated: "Contraindicated",
    severe: "Severe",
    moderate: "Moderate",
    mild: "Mild",
  },
  monographEnglishNotice: null,
};

const FR: HerbPageCopy = {
  evidenceLabelsLink:
    "Comment lire les niveaux de preuve et les mentions de révision",
  sources: {
    label: "Sources vérifiées pour cette fiche",
    checkedLabel: "Dernière vérification",
    count: (n) =>
      `${n} source${n === 1 ? "" : "s"} indépendante${n === 1 ? "" : "s"}`,
    note: "Ces sources ont été recoupées ; lorsque rien n'a été trouvé, la fiche le dit plutôt que de combler le vide.",
  },
  verbatimQuoteNote:
    "Passage reproduit dans sa langue d'origine (anglais), sans traduction : il s'agit d'une citation de la source.",
  verbatimExpandLabel: "Afficher le texte original en anglais",
  reproducedLabel: "Reproduit tel quel depuis",
  liverTox: {
    heading: (name) => `Ce que dit LiverTox à propos de ${name}`,
    sourceLabel:
      "LiverTox — National Institute of Diabetes and Digestive and Kidney Diseases",
    licenceText:
      "LiverTox est une œuvre du gouvernement américain et le chapitre source ne porte aucune mention de droit d'auteur ; ce texte est donc reproduit avec attribution.",
    claimsHeading: "Contexte",
    safetyHeading: "Hépatotoxicité et probabilité d'atteinte hépatique",
  },
  healthCanada: {
    heading: (name) => `Ce que dit Santé Canada à propos de ${name}`,
    sourceLabel:
      "Base de données des ingrédients des produits de santé naturels de Santé Canada",
    licenceText:
      "Contient de l'information visée par la Licence du gouvernement ouvert – Canada.",
    claimsHeading: "Usages approuvés",
    safetyHeading:
      "Mises en garde, contre-indications et réactions indésirables",
  },
  nccih: {
    heading: (name) => `Ce que dit le NIH à propos de ${name}`,
    sourceLabel:
      "National Center for Complementary and Integrative Health (NIH)",
    licenceText:
      "Les œuvres du gouvernement américain ne sont pas assujetties au droit d'auteur ; ce texte est donc reproduit intégralement plutôt que résumé.",
    claimsHeading: "Contexte et données scientifiques",
    safetyHeading: "Sécurité, dans les mots du NIH",
  },
  historicalSources: {
    "US Dispensatory 1918": {
      heading: (name) =>
        `Ce que disait le Dispensaire américain de 1918 à propos de ${name}`,
      sourceLabel: "The United States Dispensatory, 20e édition (1918)",
      licenceText:
        "Cet ouvrage a été publié en 1918 et appartient au domaine public ; l'article est donc reproduit intégralement.",
      claimsHeading: "L'article, tel qu'il a été écrit",
      safetyHeading: "Effets d'un surdosage rapportés à l'époque",
      notice:
        "Ce texte rapporte ce qu'enseignait un manuel de pharmacie en 1918. Une partie est aujourd'hui reconnue fausse, et les doses de l'époque ne sont pas sûres. Il ne s'agit pas d'un avis médical ; les mises en garde ci-dessus donnent les recommandations actuelles.",
    },
    "Fernie's Herbal Simples 1897": {
      heading: (name) =>
        `Ce que disait le Herbal Simples de Fernie à propos de ${name}`,
      sourceLabel:
        "Herbal Simples Approved for Modern Uses of Cure, W. T. Fernie (1897)",
      licenceText:
        "Cet ouvrage a été publié en 1897 et appartient au domaine public ; le texte provient de Project Gutenberg.",
      claimsHeading: "L'article, tel qu'il a été écrit",
      safetyHeading: "Effets rapportés",
      notice:
        "Ce texte rapporte ce qu'un médecin victorien écrivait en 1897. Une partie est aujourd'hui reconnue fausse, et il ne s'agit pas d'un avis médical ; les mises en garde ci-dessus donnent les recommandations actuelles.",
    },
  },
  narrative: NARRATIVE_FR,
  severity: {
    contraindicated: "Contre-indiqué",
    severe: "Sévère",
    moderate: "Modéré",
    mild: "Léger",
  },
  monographEnglishNotice:
    "Le contenu détaillé de cette monographie est rédigé en anglais.",
};

export function herbPageCopy(locale: CopyLocale): HerbPageCopy {
  return locale === "fr" ? FR : EN;
}
