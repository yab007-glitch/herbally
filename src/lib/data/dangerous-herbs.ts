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
  "atropa-belladonna-herb": {
    reason:
      "Contains potent tropane alkaloids (atropine, scopolamine, hyoscyamine). All parts — especially berries and roots — can cause fatal anticholinergic poisoning, delirium, tachycardia, and respiratory arrest.",
    reasonFr:
      "Contient de puissants alcaloïdes tropaniques (atropine, scopolamine, hyoscyamine). Toutes les parties — surtout les baies et les racines — peuvent causer une intoxication anticholinergique mortelle.",
    parts: "all parts (leaves, roots, and berries)",
  },
  "digitalis-purpurea-herb": {
    reason:
      "Contains potent cardiac glycosides (digitoxin, digoxin) with a dangerously narrow toxic-to-therapeutic ratio. Self-dosing any plant extract can trigger fatal ventricular arrhythmias and cardiac arrest.",
    reasonFr:
      "Contient des hétérosides cardiotoniques puissants (digitoxine, digoxine) à marge thérapeutique très étroite. Toute automédication peut provoquer des arythmies ventriculaires mortelles et un arrêt cardiaque.",
    parts: "leaves, seeds, and flowers",
  },
  "digitalis-lanata-herb": {
    reason:
      "Contains concentrated cardioactive glycosides (lanatoside C, digoxin). Unsafe outside strictly controlled pharmaceutical extraction; ingestion causes fatal arrhythmia and hyperkalemia.",
    reasonFr:
      "Contient des hétérosides cardiotoniques concentrés (lanatoside C, digoxine). Dangereux hors usage pharmaceutique strictement contrôlé ; l'ingestion cause des arythmies mortelles.",
    parts: "leaves and seeds",
  },
  "conium-maculatum-herb": {
    reason:
      "Poison hemlock contains lethal piperidine alkaloids (coniine and gamma-coniceine) that cause ascending neuromuscular paralysis and fatal respiratory failure. There is NO safe medicinal or home use.",
    reasonFr:
      "La grande ciguë contient des alcaloïdes pipéridiniques mortels (coniine) causant une paralysie neuromusculaire ascendante et une défaillance respiratoire fatale. Aucun usage domestique ou médical sûr.",
    parts: "all parts (seeds, root, stem, and leaves)",
  },
  "cicuta-virosa": {
    reason:
      "Water hemlock contains cicutoxin, a rapid-acting convulsant neurotoxin among the most lethal plants in North America and Europe. Even tiny bites can cause fatal status epilepticus.",
    reasonFr:
      "La ciguë vireuse contient de la cicutoxine, une neurotoxine convulsivante parmi les plantes les plus mortelles connues. Même une très faible ingestion peut être fatale.",
    parts: "all parts (especially tuberous roots)",
  },
  "nerium-oleander": {
    reason:
      "All parts of oleander contain oleandrin and other lethal cardiac glycosides capable of causing fatal heart block and ventricular fibrillation. Smoke from burning prunings is also hazardous.",
    reasonFr:
      "Toutes les parties du laurier-rose contiennent de l'oléandrine et d'autres hétérosides cardiotoniques mortels pouvant provoquer un bloc cardiaque et une fibrillation ventriculaire fatale.",
    parts: "all parts (leaves, sap, flowers, seeds, and wood)",
  },
  "mandragora-officinarum-herb": {
    reason:
      "European mandrake contains toxic tropane alkaloids (atropine, scopolamine, mandragorine) causing severe anticholinergic delirium, hyperthermia, seizures, and respiratory depression.",
    reasonFr:
      "La mandragore contient des alcaloïdes tropaniques toxiques (atropine, scopolamine) provoquant délire anticholinergique sévère, convulsions et dépression respiratoire.",
    parts: "roots, seeds, and leaves",
  },
  "ricinus-communis": {
    reason:
      "Castor bean seeds contain ricin, an extremely lethal toxalbumin ribosome-inactivating protein. Chewing even a small number of seeds can cause fatal multiorgan failure.",
    reasonFr:
      "Les graines de ricin contiennent de la ricine, une toxalbumine extrêmement mortelle. Mâcher même quelques graines peut entraîner une défaillance multiviscérale fatale.",
    parts:
      "seeds and seed mash (raw plant — refined USP castor oil removes ricin)",
  },
  "strychnos-nux-vomica": {
    reason:
      "Contains strychnine and brucine, potent glycine-receptor neurotoxins causing violent tetanic convulsions and fatal asphyxia. Do not consume unprocessed or unstandardized preparations.",
    reasonFr:
      "Contient de la strychnine et de la brucine, des neurotoxines convulsivantes mortelles provoquant des spasmes tétaniques et une asphyxie fatale. Ne pas consommer.",
    parts: "seeds and bark",
  },
  "strychnos-ignatii": {
    reason:
      "St. Ignatius bean seeds contain high concentrations of strychnine and brucine, causing fatal spinal hyperexcitability, convulsions, and respiratory arrest.",
    reasonFr:
      "Les fèves de Saint-Ignace contiennent de fortes concentrations de strychnine et de brucine provoquant convulsions graves et arrêt respiratoire mortel.",
    parts: "seeds",
  },
  "taxus-baccata": {
    reason:
      "English yew needles, bark, and seeds contain cardiotoxic taxine alkaloids that cause sudden refractory ventricular arrhythmias and fatal cardiogenic shock.",
    reasonFr:
      "Les aiguilles, l'écorce et les graines de l'if contiennent des alcaloïdes taxines cardiotoxiques provoquant des arythmies ventriculaires réfractaires mortelles.",
    parts:
      "foliage, bark, and seeds (except red fleshy aril surrounding the toxic seed)",
  },
  "taxus-brevifolia": {
    reason:
      "Pacific yew bark and needles contain cardiotoxic taxines alongside cytotoxic paclitaxel precursors. Only prescription chemotherapy derivatives are clinically used.",
    reasonFr:
      "L'écorce et les aiguilles de l'if de l'Ouest contiennent des taxines cardiotoxiques. Seuls les dérivés pharmaceutiques sur ordonnance sont utilisés en clinique.",
    parts: "bark, needles, and seeds",
  },
  "taxus-chinensis": {
    reason:
      "Chinese yew contains cardiotoxic taxine alkaloids and cytotoxic taxanes; non-pharmaceutical ingestion risks fatal arrhythmia and marrow suppression.",
    reasonFr:
      "L'if de Chine contient des taxines cardiotoxiques et des taxanes cytotoxiques ; l'ingestion expose à des arythmies mortelles.",
    parts: "needles, bark, and seeds",
  },
  "colchicum-autumnale-herb": {
    reason:
      "Autumn crocus contains colchicine, a cytotoxic mitotic inhibitor with a very narrow safety margin that causes fatal multiorgan failure, marrow aplasia, and shock.",
    reasonFr:
      "La colchique d'automne contient de la colchicine, un poison cellulaire à marge thérapeutique très étroite provoquant défaillance multiviscérale et aplasie médullaire mortelle.",
    parts: "corm/bulb, seeds, and flowers",
  },
  "colchicum-speciosum": {
    reason:
      "Contains toxic colchicine-type alkaloids capable of causing delayed, refractory gastrointestinal hemorrhage, neuropathy, and fatal bone-marrow suppression.",
    reasonFr:
      "Contient des alcaloïdes toxiques de type colchicine pouvant entraîner hémorragies digestives, défaillance d'organes et aplasie mortelle.",
    parts: "bulb/corm and seeds",
  },
  "datura-stramonium": {
    reason:
      "Jimsonweed contains variable, potentially fatal levels of atropine and scopolamine, causing severe anticholinergic delirium, hallucinations, seizures, and coma.",
    reasonFr:
      "La datura stramoine contient des taux imprévisibles et potentiellement mortels d'atropine et de scopolamine, causant délire, convulsions et coma.",
    parts: "seeds, leaves, flowers, and roots",
  },
  "datura-metel-herb": {
    reason:
      "Contains potent tropane alkaloids (scopolamine, hyoscyamine) risking acute anticholinergic toxicity, hyperthermia, arrhythmias, and respiratory depression.",
    reasonFr:
      "Contient de puissants alcaloïdes tropaniques (scopolamine, hyoscyamine) exposant à une intoxication anticholinergique aiguë potentiellement mortelle.",
    parts: "flowers, seeds, and leaves",
  },
  henbane: {
    reason:
      "Henbane (Hyoscyamus niger) contains toxic tropane alkaloids causing severe anticholinergic delirium, arrhythmias, and coma. All plant parts are poisonous.",
    reasonFr:
      "La jusquiame noire (Hyoscyamus niger) contient des alcaloïdes tropaniques toxiques provoquant délire anticholinergique sévère, arythmies et coma.",
    parts: "seeds, leaves, and roots",
  },
  "convallaria-majalis-herb": {
    reason:
      "Lily of the valley contains over 30 cardiotoxic cardiac glycosides (including convallatoxin) capable of triggering fatal digitalis-like cardiac arrhythmias.",
    reasonFr:
      "Le muguet contient plus de 30 hétérosides cardiotoniques (dont la convallatoxine) pouvant déclencher des arythmies cardiaques mortelles.",
    parts: "all parts (leaves, flowers, red berries, and roots)",
  },
  "strophanthus-gratus-herb": {
    reason:
      "Contains ouabain (strophanthin-G), a rapid-acting intravenous/cardiotoxic cardiac glycoside historically used as an arrow poison. Unsuitable for self-administration.",
    reasonFr:
      "Contient de l'ouabaïne (strophanthine-G), un hétéroside cardiotonique rapide utilisé autrefois comme poison de flèche. Ne pas s'automédiquer.",
    parts: "seeds and bark",
  },
  "strophanthus-hispidus": {
    reason:
      "Seeds contain potent strophanthin cardiac glycosides that rapidly disrupt cardiac conduction and cause fatal ventricular arrhythmias.",
    reasonFr:
      "Les graines contiennent de puissants hétérosides cardiotoniques (strophanthines) perturbant rapidement la conduction cardiaque et pouvant causer un arrêt cardiaque.",
    parts: "seeds",
  },
  "veratrum-album-herb": {
    reason:
      "White hellebore contains neurotoxic and cardiotoxic steroidal alkaloids (protoveratrines) causing severe bradycardia, hypotension, vomiting, and respiratory arrest.",
    reasonFr:
      "Le vératre blanc contient des alcaloïdes stéroïdiens toxiques provoquant bradycardie sévère, hypotension, vomissements incoercibles et arrêt respiratoire.",
    parts: "rhizomes, roots, and leaves",
  },
  "veratrum-viride": {
    reason:
      "American false hellebore contains cardiotoxic Veratrum alkaloids capable of causing profound vagal bradycardia, shock, and cardiac arrest.",
    reasonFr:
      "Le vératre vert contient des alcaloïdes cardiotoxiques pouvant causer bradycardie extrême, état de choc et arrêt cardiaque.",
    parts: "rhizomes, roots, and shoots",
  },
  "veratrum-californicum": {
    reason:
      "California false hellebore contains teratogenic and cardiotoxic steroidal alkaloids (cyclopamine, jervine) causing severe poisoning and fetal malformations.",
    reasonFr:
      "Le vératre de Californie contient des alcaloïdes tératogènes et cardiotoxiques (cyclopamine) provoquant intoxications graves et malformations fœtales.",
    parts: "roots and foliage",
  },
  "gelsemium-elegans": {
    reason:
      "Contains gelsemine and koumine, ultra-potent neurotoxins causing rapid respiratory paralysis, convulsions, and death; among the deadliest toxic herbs known.",
    reasonFr:
      "Contient de la gelsémine et de la koumine, des neurotoxines extrêmement puissantes causant paralysie respiratoire rapide et décès.",
    parts: "all parts (roots and leaves)",
  },
  "gelsemium-sempervirens": {
    reason:
      "Yellow jessamine contains neurotoxic alkaloids (gelsemine, gelsevirine) that depress spinal motor neurons and can cause fatal respiratory failure.",
    reasonFr:
      "Le jasmin de Caroline contient des alcaloïdes neurotoxiques (gelsémine) pouvant provoquer une défaillance respiratoire mortelle.",
    parts: "root/rhizome, stems, and nectar",
  },
  "podophyllum-peltatum-herb": {
    reason:
      "Mayapple contains podophyllotoxin, a cytotoxic tubulin-binding toxin causing severe gastroenteritis, bone-marrow suppression, neuropathy, and coma if ingested.",
    reasonFr:
      "Le podophylle pelté contient de la podophyllotoxine cytotoxique causant gastro-entérite grave, aplasie médullaire, neuropathie et coma en cas d'ingestion.",
    parts: "roots, rhizomes, and unripe fruit (toxic internally)",
  },
  "podophyllum-hexandrum-herb": {
    reason:
      "Himalayan mayapple contains high concentrations of cytotoxic podophyllotoxin; oral ingestion causes severe systemic toxicity, hepatotoxicity, and encephalopathy.",
    reasonFr:
      "Le podophylle de l'Himalaya contient de fortes concentrations de podophyllotoxine ; l'ingestion cause toxicité hépatique, médullaire et encéphalopathie grave.",
    parts: "rhizomes and roots",
  },
  "melanthium-virginicum": {
    reason:
      "Bunchflower contains cardiotoxic and neurotoxic Veratrum-type steroidal alkaloids capable of causing dangerous hypotension, bradycardia, and respiratory depression.",
    reasonFr:
      "Contient des alcaloïdes stéroïdiens cardiotoxiques et neurotoxiques de type vératre pouvant provoquer hypotension sévère, bradycardie et dépression respiratoire.",
    parts: "rhizomes, roots, and aerial parts",
  },
  "amaryllis-belladonna": {
    reason:
      "Belladonna lily (Amaryllidaceae) contains toxic phenanthridine alkaloids including lycorine, causing severe vomiting, diarrhea, tremor, and hypotension if ingested.",
    reasonFr:
      "Le lys belladone (Amaryllidaceae) contient des alcaloïdes toxiques dont la lycorine, provoquant vomissements sévères, tremblements et hypotension en cas d'ingestion.",
    parts: "bulbs and foliage",
  },
};

const NON_DOSABLE_PATTERN =
  /\b(no safe|do not use|absolutely no use|lethal|medical use only|medical supervision only|not recommended|contraindicated|homeopathic only|poisonous|toxic|no modern standardized|no labelled dose)\b/i;

export function getDangerousHerb(slug: string): DangerousHerb | undefined {
  return DANGEROUS_HERBS[slug];
}

export function isDangerousHerb(slug: string): boolean {
  return slug in DANGEROUS_HERBS;
}

/**
 * Gate for offering the interactive dosage calculator on a herb page.
 * Never offer a dosage calculator CTA for toxic/lethal plants, medical-only
 * poisons, or herbs that lack any recorded quantitative therapeutic dose.
 */
export function canShowDoseCalculator(
  slug: string,
  dosageAdult: string | null | undefined
): boolean {
  if (isDangerousHerb(slug)) return false;
  if (!dosageAdult || !dosageAdult.trim()) return false;
  if (NON_DOSABLE_PATTERN.test(dosageAdult)) return false;
  return true;
}
