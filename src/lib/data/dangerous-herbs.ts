/**
 * Safety-first guard for the dangerous long tail of the herb database.
 *
 * HerbAlly indexes 2,700+ herbs — including plants that are outright lethal
 * (abrin-containing rosary pea, unprocessed aconite, etc.). A templated
 * "Benefits, Dosage & Safety" card on those pages implies a supplement
 * relationship that does not exist, so every surface that renders a herb
 * card or hero checks this registry first.
 *
 * Matching is by herb slug. Keep entries conservative: only plants with
 * well-documented severe/lethal toxicity from regulated sources ( Poison
 * Control, FDA, EMA). Slugs verified against the live database.
 */

export interface DangerousHerb {
  /** Human reason shown in warnings, EN. */
  reason: string;
  /** French variant. */
  reasonFr: string;
  /** Which parts / forms are dangerous, e.g. "seeds". */
  parts: string;
}

const DANGEROUS_HERBS: Record<string, DangerousHerb> = {
  "abrus-precatorius": {
    reason:
      "Seeds contain abrin — one of the most toxic substances known. Ingestion can be fatal. Not an herbal medicine.",
    reasonFr:
      "Les graines contiennent de l'abrine — parmi les substances les plus toxiques connues. L'ingestion peut être mortelle. Ce n'est pas un remède à base de plantes.",
    parts: "seeds (whole plant is hazardous)",
  },
  "aconite-processed": {
    reason:
      "Aconite contains aconitine, a deadly cardiotoxin. Even processed forms have caused fatal poisonings. Do not consume.",
    reasonFr:
      "L'aconit contient de l'aconitine, un cardiotoxin mortel. Même les formes traitées ont causé des empoisonnements mortels. Ne pas consommer.",
    parts: "root (all forms)",
  },
  acokanthera: {
    reason:
      "Contains cardiac glycosides similar to ouabain. All parts are highly toxic; traditionally used as a poison arrow ingredient.",
    reasonFr:
      "Contient des hétérosides cardiotoniques proches de l'ouabaïne. Toutes les parties sont très toxiques ; utilisée traditionnellement pour empoisonner les flèches.",
    parts: "all parts",
  },
  "aristolochia-clematitis": {
    reason:
      "Contains aristolochic acids, a Group 1 human carcinogen and severe nephrotoxin linked to permanent kidney failure and urothelial cancer. Banned by Health Canada, FDA, and EMA.",
    reasonFr:
      "Contient des acides aristolochiques, cancérogènes humains de groupe 1 et néphrotoxines sévères causant une insuffisance rénale irréversible et des cancers urothéliaux. Interdite par Santé Canada, la FDA et l'EMA.",
    parts: "all plant parts (root, stem, leaf)",
  },
  "aristolochia-debilis": {
    reason:
      "Contains aristolochic acids causing irreversible kidney failure and urothelial carcinoma. Prohibited in herbal products in Canada, the US, and the EU.",
    reasonFr:
      "Contient des acides aristolochiques provoquant une insuffisance rénale irréversible et un carcinome urothélial. Interdite dans les produits à base de plantes au Canada, aux États-Unis et dans l'UE.",
    parts: "root, fruit, and aerial parts",
  },
  "aristolochia-indica": {
    reason:
      "Contains aristolochic acids — potent nephrotoxins and Group 1 carcinogens. Do not consume under any circumstances.",
    reasonFr:
      "Contient des acides aristolochiques — néphrotoxines puissantes et cancérogènes de groupe 1. Ne consommer en aucun cas.",
    parts: "root and aerial parts",
  },
  "aristolochia-mollissima": {
    reason:
      "Contains aristolochic acids causing permanent kidney damage and urinary tract cancer. Despite historical records, Aristolochia species are unsafe and banned by major regulators.",
    reasonFr:
      "Contient des acides aristolochiques causant des lésions rénales irréversibles et des cancers des voies urinaires. Malgré d'anciens dossiers, les espèces d'Aristolochia sont dangereuses et interdites par les principaux organismes réglementaires.",
    parts: "aerial parts and rhizome",
  },
  "cipo-mil-homens": {
    reason:
      "An Aristolochia species containing aristolochic acids — a known human carcinogen and cause of end-stage kidney disease. Do not ingest.",
    reasonFr:
      "Espèce d'Aristolochia contenant des acides aristolochiques — cancérogène humain reconnu et cause d'insuffisance rénale terminale. Ne pas ingérer.",
    parts: "vine, stem, and root",
  },
  "ma-dou-ling": {
    reason:
      "Aristolochia fruit containing nephrotoxic and carcinogenic aristolochic acids. Banned in licensed medicines in Canada, the US, and Europe.",
    reasonFr:
      "Fruit d'Aristolochia contenant des acides aristolochiques néphrotoxiques et cancérogènes. Interdit dans les médicaments homologués au Canada, aux États-Unis et en Europe.",
    parts: "fruit and seeds",
  },
  "cao-wu-analgesic": {
    reason:
      "Contains aconitine-type alkaloids — rapid-acting cardiotoxins and neurotoxins. Even small processing errors have caused fatal arrhythmias. Do not self-administer.",
    reasonFr:
      "Contient des alcaloïdes de type aconitine — cardiotoxines et neurotoxines à action rapide. Même une erreur mineure de préparation peut causer des arythmies mortelles. Ne pas s'automédiquer.",
    parts: "tuber/root (all forms)",
  },
  "chuan-wu-analgesic": {
    reason:
      "Aconitum carmichaelii mother root contains lethal cardiotoxic and neurotoxic alkaloids (aconitine). Processing mistakes are potentially fatal. Do not self-administer.",
    reasonFr:
      "La racine mère d'Aconitum carmichaelii contient des alcaloïdes cardiotoxiques et neurotoxiques mortels (aconitine). Toute erreur de préparation peut être fatale. Ne pas s'automédiquer.",
    parts: "root (all forms)",
  },
  monkshood: {
    reason:
      "All parts of Aconitum napellus contain lethal aconitine, capable of causing fatal ventricular arrhythmias and respiratory paralysis. Never ingest.",
    reasonFr:
      "Toutes les parties d'Aconitum napellus contiennent de l'aconitine mortelle, pouvant provoquer des arythmies ventriculaires fatales et une paralysie respiratoire. Ne jamais ingérer.",
    parts: "all parts (especially roots and seeds)",
  },
  "yellow-monkshood": {
    reason:
      "Aconitum lycoctonum contains potent diterpene alkaloids causing severe neurotoxicity and cardiac arrest. Do not ingest or handle damaged plant sap.",
    reasonFr:
      "Aconitum lycoctonum contient des alcaloïdes diterpéniques puissants provoquant une neurotoxicité grave et un arrêt cardiaque. Ne pas ingérer ni manipuler la sève.",
    parts: "all parts",
  },
  "lamiaceae-pennyroyal": {
    reason:
      "Pennyroyal (Mentha pulegium) contains pulegone, a severe hepatotoxin and abortifacient. Pennyroyal essential oil and concentrated extracts have caused fatal liver and multiorgan failure.",
    reasonFr:
      "La menthe pouliot (Mentha pulegium) contient de la pulégone, une hépatotoxine grave et un abortif. L'huile essentielle et les extraits concentrés ont causé des insuffisances hépatiques et multiviscérales mortelles.",
    parts: "essential oil and aerial parts (do not ingest)",
  },
  "pennyroyal-american": {
    reason:
      "Contains high levels of hepatotoxic and abortifacient pulegone; internal use has caused fatal liver necrosis, seizures, and miscarriage. Do not take internally.",
    reasonFr:
      "Contient des niveaux élevés de pulégone hépatotoxique et abortive ; l'usage interne a provoqué une nécrose hépatique mortelle, des convulsions et des fausses couches. Ne pas prendre par voie interne.",
    parts: "essential oil and aerial parts (do not ingest)",
  },
};

export function getDangerousHerb(slug: string): DangerousHerb | undefined {
  return DANGEROUS_HERBS[slug];
}

export function isDangerousHerb(slug: string): boolean {
  return slug in DANGEROUS_HERBS;
}
