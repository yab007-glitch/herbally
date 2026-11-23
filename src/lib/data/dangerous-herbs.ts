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
  pokeroot: {
    reason:
      "Phytolacca americana contains phytolaccine saponins and mitogenic lectins causing severe hemorrhagic gastroenteritis, hypotension, convulsions, and pediatric fatality; avoid self-administration.",
    reasonFr:
      "Le raisin d'Amérique (Phytolacca americana) contient des saponines et lectines toxiques provoquant gastro-entérite hémorragique sévère, convulsions et décès pédiatrique.",
    parts: "root, mature berries, stems, leaves",
  },
  sassafras: {
    reason:
      "Sassafras albidum volatile oil is banned from U.S. foods and supplements by the FDA because safrole is hepatotoxic and carcinogenic; as little as 5 mL of sassafras oil has been fatal in adults.",
    reasonFr:
      "Le sassafras contient du safrole, un composé hépatotoxique et cancérogène interdit par la FDA dans les aliments et compléments ; 5 ml d'huile essentielle peuvent être mortels.",
    parts: "root bark and volatile oil",
  },
  "schoenocaulon-officinale": {
    reason:
      "Sabadilla seeds contain veratrine and cevadine neurotoxic-cardiotoxic alkaloids capable of causing severe mucosal burning, hypotension, bradycardia, and fatal cardiorespiratory collapse.",
    reasonFr:
      "La cévadille (Schoenocaulon officinale) contient des alcaloïdes de type vératrine provoquant bradycardie sévère, hypotension et collapsus cardiorespiratoire mortel.",
    parts: "seeds",
  },
  "secale-cornutum": {
    reason:
      "Ergot (Claviceps purpurea) contains toxic ergot alkaloids that cause severe arterial vasospasm (gangrenous ergotism), uterine hypertonus, seizures, and fatal ischemia; CYP3A4 inhibitors magnify toxicity.",
    reasonFr:
      "L'ergot de seigle (Claviceps purpurea) contient des alcaloïdes ergotés provoquant un vasospasme artériel sévère (ergotisme), des convulsions et une ischémie potentiellement mortelle.",
    parts: "fungal sclerotium",
  },
  "scilla-maritima": {
    reason:
      "Squill (Drimia maritima) contains bufadienolide cardiac glycosides (scillaren A, proscillaridin) with a narrow toxic-to-lethal margin causing arrhythmias, hyperkalemia, and fatal cardiac arrest.",
    reasonFr:
      "La scille maritime (Drimia maritima) contient des hétérosides cardiotoniques (bufadiénolides) à marge thérapeutique très étroite pouvant provoquer troubles du rythme mortels.",
    parts: "bulb (all parts)",
  },
  "senecio-aureus": {
    reason:
      "Life root / golden ragwort (Packera aurea) contains hepatotoxic and carcinogenic pyrrolizidine alkaloids (PAs) linked to veno-occlusive liver disease and irreversible cirrhosis; oral use is unsafe.",
    reasonFr:
      "Le séneçon doré (Packera aurea) contient des alcaloïdes pyrrolizidiniques hépatotoxiques et cancérogènes responsables de maladie veino-occlusive du foie.",
    parts: "aerial parts and root (all parts)",
  },
  "citrullus-colocynthis": {
    reason:
      "Bitter apple (Citrullus colocynthis) is banned in OTC cathartics by the FDA; its cucurbitacins cause severe bloody diarrhea, acute kidney injury, liver necrosis, and death near 0.6–1 g.",
    reasonFr:
      "La coloquinte (Citrullus colocynthis) provoque diarrhées sanglantes graves, atteinte rénale et hépatique aiguë dès de faibles doses par ses cucurbitacines.",
    parts: "fruit pulp and seeds",
  },
  "papaver-somniferum": {
    reason:
      "Opium poppy contains scheduled opiate alkaloids (morphine, codeine, thebaine) carrying lethal respiratory depression, overdose, and dependence risks; controlled substance in Canada, the US, and Europe.",
    reasonFr:
      "Le pavot somnifère contient des alcaloïdes opiacés (morphine, codéine) présentant un risque mortel de dépression respiratoire et de dépendance ; plante réglementée.",
    parts: "latex, seed capsules, and stems",
  },
  "ignatia-amara": {
    reason:
      "Ignatia bean (Strychnos ignatii) contains lethal strychnine and brucine neurotoxins causing painful tetanic convulsions and asphyxiation; listed in the FDA Poisonous Plant Database.",
    reasonFr:
      "La fève de Saint-Ignace (Strychnos ignatii) contient de la strychnine et de la brucine, neurotoxines mortelles provoquant des convulsions tétaniques et l'asphyxie.",
    parts: "seeds (all parts)",
  },
  "duboisia-myoporoides": {
    reason:
      "Corkwood contains high concentrations of tropane alkaloids (hyoscine/scopolamine and hyoscyamine) causing severe anticholinergic poisoning, coma, and respiratory arrest if self-administered.",
    reasonFr:
      "Duboisia myoporoides contient de fortes concentrations de scopolamine et d'hyoscyamine provoquant une intoxication anticholinergique grave et un arrêt respiratoire.",
    parts: "leaves (all parts)",
  },
  "daphne-mezereum": {
    reason:
      "Mezereon contains caustic diterpene esters (mezerein, daphnetoxin) causing severe oral ulceration, hemorrhagic gastroenteritis, renal injury, and childhood death from ingesting a few berries.",
    reasonFr:
      "Le bois-joli (Daphne mezereum) contient de la mézéréine caustique provoquant ulcérations, hémorragies digestives et décès même après l'ingestion de quelques baies.",
    parts: "bark, berries, and leaves (all parts)",
  },
  "apocynum-cannabinum": {
    reason:
      "Canadian hemp (Apocynum cannabinum) contains strophanthin-like cardiac glycosides (cymarin, apocannoside) capable of inducing fatal ventricular arrhythmias and hyperkalemia.",
    reasonFr:
      "Le chanvre du Canada (Apocynum cannabinum) contient des hétérosides cardiotoniques (cymarine) pouvant déclencher des arythmies cardiaques mortelles.",
    parts: "root and rhizome (all parts)",
  },
  "pheasants-eye": {
    reason:
      "Pheasant's eye (Adonis vernalis) contains potent cardenolide cardiac glycosides (adonitoxin, cymarin) with high cumulative toxicity and arrhythmia risk; not safe for self-medication.",
    reasonFr:
      "L'adonis de printemps (Adonis vernalis) contient des cardénolides cardiotoniques cumulatifs exposant à des arythmies graves et un arrêt cardiaque.",
    parts: "aerial parts (all parts)",
  },
  "bittersweet-nightshade": {
    reason:
      "Bittersweet nightshade (Solanum dulcamara) contains solanine, solamargine, and dulcamarine glycoalkaloids; oral use is unsafe and EMA restricts use solely to brief external applications on intact skin.",
    reasonFr:
      "La douce-amère (Solanum dulcamara) contient des glycoalcaloïdes toxiques (solanine) rendant l'ingestion dangereuse ; l'EMA limite l'usage traditionnel à la voie cutanée externe.",
    parts: "berries, stems, and leaves",
  },
  "bryonia-alba": {
    reason:
      "White bryony (Bryonia alba) contains caustic cucurbitacin glycosides; ingesting the fresh root or berries causes violent bloody purging, nephritis, paralysis, and death.",
    reasonFr:
      "La bryone blanche (Bryonia alba) contient des cucurbitacines caustiques provoquant gastro-entérite hémorragique, néphrite, paralysie et décès.",
    parts: "root and berries (all parts)",
  },
  "calabar-bean": {
    reason:
      "Calabar bean (Physostigma venenosum) contains physostigmine, an irreversible-range cholinesterase inhibitor causing cholinergic crisis, bronchospasm, seizures, and respiratory failure.",
    reasonFr:
      "La fève de Calabar (Physostigma venenosum) contient de la physostigmine provoquant crise cholinergique, bronchospasme, convulsions et défaillance respiratoire mortelle.",
    parts: "seeds",
  },
  "thapsia-garganica": {
    reason:
      "Deadly carrot (Thapsia garganica) contains thapsigargin, a potent SERCA calcium-pump inhibitor that triggers violent skin vesication and severe mucosal/systemic toxicity.",
    reasonFr:
      "La thapsie (Thapsia garganica) contient de la thapsigargine provoquant vésications caustiques sévères et toxicité systémique grave.",
    parts: "root resin and all plant parts",
  },
  "wahoo-bark": {
    reason:
      "Wahoo (Euonymus atropurpureus) contains cardenolide cardiac glycosides (euonymoside) and irritant resins capable of causing severe purging, digoxin-like arrhythmias, and cardiovascular collapse.",
    reasonFr:
      "Le fusain pourpre (Euonymus atropurpureus) contient des hétérosides cardiotoniques pouvant provoquer arythmies cardiaques et collapsus.",
    parts: "root bark, stem bark, and seeds",
  },
  "sanguinaria-canadensis-herb": {
    reason:
      'Bloodroot contains sanguinarine, an escharotic benzophenanthridine alkaloid; FDA warns against bloodroot "black salve" products due to severe tissue necrosis and scarring, and internal use is unsafe.',
    reasonFr:
      "La sanguinaire du Canada contient de la sanguinarine caustique ; son usage interne est toxique et les pommades escarrotiques (« black salve ») provoquent des nécroses tissulaires graves.",
    parts: "rhizome and root (all parts)",
  },
  "chenopodium-ambrosioides": {
    reason:
      "Epazote / wormseed oil contains 60–80% ascaridole, a neurotoxic and nephrotoxic monoterpene peroxide that has caused fatal poisoning, deafness, seizures, and liver/kidney injury.",
    reasonFr:
      "L'huile essentielle de chénopode vermifuge contient de l'ascaridole neurotoxique et néphrotoxique ayant entraîné convulsions, surdité et décès.",
    parts: "essential oil and seeds",
  },
  khat: {
    reason:
      "Catha edulis contains cathinone and cathine, DEA Schedule I / controlled amphetamine-like stimulants linked to myocardial infarction, acute hepatotoxicity, stroke, and psychiatric psychosis.",
    reasonFr:
      "Le khat (Catha edulis) contient de la cathinone, un stimulant amphétaminique réglementé associé à infarctus, AVC, psychose et hépatite toxique aiguë.",
    parts: "fresh leaves and shoots",
  },
  "cotton-root-bark": {
    reason:
      "Cotton root bark (Gossypium herbaceum) contains gossypol, a toxic polyphenol linked to hypokalemia, irreversible male infertility, pregnancy loss, and systemic toxicity.",
    reasonFr:
      "L'écorce de racine de cotonnier contient du gossypol toxique provoquant hypokaliémie, infertilité masculine et contractions utérines dangereuses.",
    parts: "root bark and seeds",
  },
  "broom-herb": {
    reason:
      "Scotch broom (Cytisus scoparius) contains sparteine and cytisine nicotinic/cardiotoxic alkaloids capable of causing hypertension, arrhythmias, respiratory depression, and uterine stimulation.",
    reasonFr:
      "Le genêt à balai (Cytisus scoparius) contient de la spartéine et de la cytisine provoquant arythmies cardiaques, hypertension et dépression respiratoire.",
    parts: "flowering tops and seeds (all parts)",
  },
  "betel-nut": {
    reason:
      "Areca catechu (betel nut) is classified by IARC as a Group 1 human carcinogen causing oral submucous fibrosis and oral/esophageal cancers; arecoline also triggers severe cholinergic/cardiac toxicity.",
    reasonFr:
      "La noix d'arec (Areca catechu) est classée cancérogène avéré pour l'humain (groupe 1 CIRC) et provoque fibrose sous-muqueuse buccale, cancers et toxicité cardiaque.",
    parts: "seed (nut)",
  },
  "pareira-brava": {
    reason:
      "Chondrodendron tomentosum is a botanical source of tubocurarine (curare neuromuscular blocker); non-standardized internal ingestion risks muscle paralysis and respiratory arrest.",
    reasonFr:
      "Le pareira brava (Chondrodendron tomentosum) contient des alcaloïdes curarisants exposant à une paralysie musculaire et un arrêt respiratoire.",
    parts: "root and stem",
  },
  "wild-ginger": {
    reason:
      "Wild ginger (Asarum canadense) contains aristolochic acids, classified as Group 1 human carcinogens causing irreversible aristolochic acid nephropathy and urothelial carcinoma; banned by FDA/EMA.",
    reasonFr:
      "L'asaret du Canada (Asarum canadense) contient de l'acide aristolochique cancérogène et néphrotoxique, responsable d'insuffisance rénale irréversible et de cancers urothéliaux.",
    parts: "rhizome and root (all parts)",
  },
  "hagenia-abyssinica": {
    reason:
      "Kousso (Hagenia abyssinica) contains phloroglucinol derivatives (kosins) causing severe gastrointestinal necrosis, optic neuropathy/blindness, CNS depression, and fatal shock.",
    reasonFr:
      "Le kousso (Hagenia abyssinica) contient des phloroglucinols toxiques pouvant causer cécité par neuropathie optique, nécrose digestive et collapsus mortel.",
    parts: "female flowers and resin",
  },
  "asclepias-syriaca": {
    reason:
      "Common milkweed contains toxic cardenolide cardiac glycosides (asclepiadin, syriobioside) and irritant latex; medicinal root/latex ingestion risks arrhythmia and severe vomiting.",
    reasonFr:
      "L'asclépiade de Syrie contient des cardénolides cardiotoniques et un latex irritant exposant à troubles du rythme cardiaque et intoxication sévère.",
    parts: "root, latex, stems, and mature pods",
  },
  "piscidia-piscipula": {
    reason:
      "Jamaica dogwood contains rotenone and isoflavonoids known as potent mitochondrial Complex I fish/neurotoxins; internal use lacks human safety data and carries overdose toxicity risk.",
    reasonFr:
      "Le piscidia (Piscidia piscipula) contient de la roténone et des isoflavonoïdes neurotoxiques ; l'usage interne est dangereux sans posologie sûre établie.",
    parts: "root bark",
  },
  "artemisia-maritima": {
    reason:
      "Sea wormwood (Santonica) contains santonin and thujone, which cause yellow vision (xanthopsia), renal injury, convulsions, and fatal CNS depression near adult doses.",
    reasonFr:
      "L'armoise maritime contient de la santonine et de la thuyone provoquant xanthopsie, atteinte rénale, convulsions et intoxication neurologique potentiellement mortelle.",
    parts: "flower heads and aerial parts",
  },
  "cheiranthus-cheiri": {
    reason:
      "Wallflower (Erysimum cheiri) contains cheirotoxin and other cardiac glycosides with narrow-margin digoxin-like cardiotoxicity; crude herb use can trigger lethal arrhythmias.",
    reasonFr:
      "La giroflée des murailles contient de la cheirotoxine, un hétéroside cardiotonique exposant à des arythmies cardiaques graves.",
    parts: "seeds and flowering herb (all parts)",
  },
  "cephalanthus-occidentalis": {
    reason:
      "Buttonbush contains toxic cephalanthin and glycosides linked to gastrointestinal irritation, hemolysis, and CNS paralysis; oral use is unsafe.",
    reasonFr:
      "Le céphalanthe d'Occident contient des hétérosides toxiques (céphalanthine) pouvant provoquer hémolyse, vomissements violents et paralysie.",
    parts: "bark, leaves, and seeds",
  },
  "christmas-rose": {
    reason:
      "Black hellebore (Helleborus niger) contains bufadienolide cardiac glycosides (hellebrin) and protoanemonin causing severe blistering, vomiting, bradycardia, and fatal cardiac arrest.",
    reasonFr:
      "L'hellébore noir (Helleborus niger) contient de l'hellébrine cardiotonique et de la protoanémonine provoquant brûlures digestives, bradycardie et arrêt cardiaque.",
    parts: "rhizome, roots, and all plant parts",
  },
  jaborandi: {
    reason:
      "Jaborandi (Pilocarpus species) contains pilocarpine; non-standardized crude leaf ingestion risks fatal cholinergic crisis (bronchorrhea, pulmonary edema, bradycardia, seizures).",
    reasonFr:
      "Le jaborandi contient de la pilocarpine ; l'ingestion de la plante brute expose à une crise cholinergique potentiellement mortelle.",
    parts: "leaves",
  },
  spigelia: {
    reason:
      "Pinkroot (Spigelia marilandica) contains spigeline alkaloids causing blurred vision, vertigo, dilated pupils, cardiac arrhythmia, respiratory depression, and death in overdose.",
    reasonFr:
      "La spigélie (Spigelia marilandica) contient de la spigéline neurotoxique provoquant vertiges, troubles visuels, convulsions et dépression respiratoire.",
    parts: "root and rhizome (all parts)",
  },
  "tripterygium-wilfordii": {
    reason:
      "Thunder god vine contains triptolide and celastrol with extreme multi-organ toxicity (bone marrow suppression, fatal hepatic/renal failure, arrhythmias, irreversible infertility) unless purified under medical research protocols.",
    reasonFr:
      "Le Tripterygium wilfordii contient du triptolide à toxicité sévère (aplasie médullaire, insuffisance hépatique et rénale, infertilité, arythmies) ; les parties non purifiées sont mortelles.",
    parts: "root bark, leaves, and flowers (all parts)",
  },
  "bitter-almond": {
    reason:
      "Bitter almond (Prunus dulcis var. amara) contains amygdalin, which releases lethal hydrogen cyanide upon ingestion; FDA bans laetrile/amygdalin as a cancer drug and warns against cyanide poisoning.",
    reasonFr:
      "L'amande amère contient de l'amygdaline qui libère du cyanure d'hydrogène mortel après ingestion ; son usage thérapeutique ou anticancéreux est dangereux et sans preuve clinique.",
    parts: "kernels and unrefined oil",
  },
  "cinnamomum-camphora": {
    reason:
      "Camphor ingestion is severely toxic — Health Canada and FDA warn that small ingested amounts cause seizures, liver failure, apnea, and rapid death, especially in young children.",
    reasonFr:
      "Le camphre est gravement toxique par voie orale et chez le nourrisson, provoquant convulsions, hépatotoxicité, apnée et décès rapide même à faible dose.",
    parts: "volatile camphor oil and crystalline camphor",
  },
  "chelidonium-majus": {
    reason:
      "Greater celandine (Chelidonium majus) oral preparations carry well-documented severe idiosyncratic cholestatic hepatotoxicity and acute liver failure; EMA concluded oral benefit-risk is negative.",
    reasonFr:
      "La grande chélidoine orale est associée à une hépatotoxicité grave et une insuffisance hépatique aiguë ; l'EMA juge le rapport bénéfice-risque oral négatif.",
    parts: "aerial parts and root latex",
  },
  kratom: {
    reason:
      "Mitragyna speciosa is unapproved by FDA and Health Canada and linked to fatal overdoses (respiratory depression, seizures, hepatotoxicity), dependence, and heavy-metal/Salmonella contamination.",
    reasonFr:
      "Le kratom n'est approuvé ni par Santé Canada ni par la FDA et est associé à dépendance, hépatotoxicité, convulsions et surdoses mortelles.",
    parts: "leaves and concentrated extracts",
  },
  "blue-cohosh-root": {
    reason:
      "Caulophyllum thalictroides contains N-methylcytisine and caulosaponin; use near term has been linked to neonatal heart failure, perinatal stroke, and severe maternal/fetal vasoconstriction.",
    reasonFr:
      "L'actée bleue contient des alcaloïdes vasoconstricteurs associés à des AVC néonatals et une insuffisance cardiaque fœtale en fin de grossesse.",
    parts: "rhizome and root",
  },
  "lobelia-inflata": {
    reason:
      "Indian tobacco (Lobelia inflata) contains lobeline, a nicotinic alkaloid with a narrow safety margin causing profuse vomiting, hypotension, respiratory depression, coma, and death.",
    reasonFr:
      "La lobélie enflée contient de la lobéline à marge étroite pouvant causer vomissements sévères, hypotension, convulsions et dépression respiratoire.",
    parts: "aerial parts and seeds",
  },
  tansy: {
    reason:
      "Tansy (Tanacetum vulgare) contains neurotoxic/abortifacient thujone; oral ingestion risks hepatic/renal necrosis, uterine hemorrhage, status epilepticus, and death.",
    reasonFr:
      "La tanaisie commune contient de la thuyone neurotoxique et abortive pouvant provoquer convulsions graves, hémorragies et lésions hépatiques ou rénales.",
    parts: "essential oil and flowering herb",
  },
  "rue-herb": {
    reason:
      "Common rue (Ruta graveolens) contains phototoxic furocoumarins and mutagenic/abortifacient alkaloids causing severe blistering phytophotodermatitis, hepatorenal injury, uterine bleeding, and miscarriage.",
    reasonFr:
      "La rue fétide contient des furocoumarines phototoxiques et des alcaloïdes abortifs exposant à brûlures cutanées graves, hépato-néphrotoxicité et fausses couches.",
    parts: "essential oil and aerial parts",
  },
  "gaulteria-wintergreen": {
    reason:
      "Wintergreen oil is ~98% methyl salicylate; swallowing as little as 4–5 mL in a child (or ~10–30 mL in an adult) can cause fatal salicylate poisoning, metabolic acidosis, and pulmonary edema.",
    reasonFr:
      "L'huile essentielle de gaulthérie (~98 % salicylate de méthyle) est mortelle par ingestion dès 4–5 ml chez l'enfant et provoque une intoxication salicylée aiguë.",
    parts: "essential oil and concentrated extracts",
  },
  gobernadora: {
    reason:
      "Chaparral (Larrea tridentata) is subject to FDA/Health Canada warnings due to documented fulminant hepatotoxicity, liver transplantation, renal cystic disease, and renal failure.",
    reasonFr:
      "Le chaparral (Larrea tridentata) fait l'objet d'alertes de la FDA et de Santé Canada pour hépatite fulminante (ayant requis transplantation) et insuffisance rénale.",
    parts: "leaves and twigs",
  },
  "ephedra-sinica": {
    reason:
      "Ephedra (ma huang) is banned in U.S. dietary supplements (FDA 2004) and restricted in Canada because ephedrine alkaloids cause fatal myocardial infarction, stroke, seizures, and arrhythmias even at low doses.",
    reasonFr:
      "L'éphédra (ma huang) est interdit dans les compléments aux États-Unis pour risque d'infarctus du myocarde, AVC, convulsions et arythmies mortelles.",
    parts: "stems and concentrated alkaloids",
  },
  germander: {
    reason:
      "Wall germander (Teucrium chamaedrys) contains furanoditerpenoids banned in France and restricted internationally after causing widespread acute cytolytic hepatitis, cirrhosis, and fatal liver failure.",
    reasonFr:
      "La germandrée petit-chêne provoque des hépatites cytolytiques aiguës graves et des insuffisances hépatiques mortelles ; interdite en phytothérapie orale dans plusieurs pays.",
    parts: "aerial parts",
  },
  "corynanthe-yohimbe": {
    reason:
      "Yohimbe bark (Pausinystalia johimbe) causes severe hypertensive crisis, tachycardia, arrhythmias, mania, and fatal overdose; EFSA prohibits its use in foods/supplements and Health Canada requires Rx status for yohimbine.",
    reasonFr:
      "L'écorce de yohimbé expose à crises hypertensives, tachycardie, arythmies et surdoses mortelles ; interdite dans les compléments alimentaires par l'EFSA.",
    parts: "bark and standardized yohimbine alkaloids",
  },
  cinchona: {
    reason:
      "Cinchona bark contains quinine and quinidine; FDA warns against off-label quinine use for leg cramps due to fatal thrombocytopenia, hemolytic uremic syndrome, hypoglycemia, and QT-prolonging arrhythmias.",
    reasonFr:
      "L'écorce de quinquina contient de la quinine et de la quinidine ; la FDA alerte contre l'usage pour les crampes en raison de thrombopénie mortelle et d'arythmies cardiaques.",
    parts: "bark and total alkaloids",
  },
  "cinchona-calisaya": {
    reason:
      "Yellow cinchona bark contains quinine alkaloids carrying FDA boxed warnings for fatal thrombocytopenia, anaphylaxis, and life-threatening arrhythmias; never self-dose.",
    reasonFr:
      "L'écorce de Cinchona calisaya contient de la quinine associée à des réactions hématologiques et cardiaques potentiellement mortelles ; ne pas s'automédiquer.",
    parts: "bark and total alkaloids",
  },
  "prunus-serotina": {
    reason:
      "Wild cherry bark contains cyanogenic glycosides (prunasin) capable of releasing toxic hydrogen cyanide in high doses, raw bark, or crushed seeds; never use concentrated extracts without professional oversight.",
    reasonFr:
      "L'écorce de cerisier tardif contient de la prunasine cyanogène pouvant libérer du cyanure à forte dose ou dans les parties fraîches/graines.",
    parts: "inner bark, wilted leaves, and seeds",
  },
  soapwort: {
    reason:
      "Soapwort (Saponaria officinalis) contains up to 2–5% toxic saponins (githagenin) causing red blood cell hemolysis, severe mucosal irritation, and gastroenteritis if improperly dosed.",
    reasonFr:
      "La saponaire officinale contient des saponines irritantes et hémolytiques pouvant provoquer une toxicité digestive et générale par voie orale.",
    parts: "root and seeds",
  },
  "annona-muricata": {
    reason:
      "Soursop / graviola contains annonacin acetogenins linked in Caribbean/French epidemiologic studies to irreversible atypical Parkinsonian neurodegeneration; human cancer efficacy is unsubstantiated.",
    reasonFr:
      "Le corossol (Annona muricata) contient de l'annonacine neurotoxique associée à un syndrome parkinsonien atypique irréversible ; aucune preuve clinique humaine contre le cancer.",
    parts: "seeds, roots, bark, and chronic leaf tea",
  },
  "ranunculus-bulbosus": {
    reason:
      "Bulbous buttercup contains ranunculin, which hydrolyzes to caustic blistering protoanemonin causing severe oral/GI ulceration, nephritis, and hematuria if ingested.",
    reasonFr:
      "La renoncule bulbeuse contient de la protoanémonine vésicante et caustique provoquant ulcérations digestives et atteinte rénale en cas d'ingestion.",
    parts: "fresh plant, corms, and juice (all parts)",
  },
  "anagallis-arvensis": {
    reason:
      "Scarlet pimpernel contains toxic cucurbitacin glycosides and saponins capable of causing gastroenteritis, nephritis, CNS depression, and systemic poisoning.",
    reasonFr:
      "Le mouron rouge (Anagallis arvensis) contient des cucurbitacines et saponines toxiques pouvant causer néphrite et intoxication générale.",
    parts: "aerial parts and seeds (all parts)",
  },
  "acalypha-indica": {
    reason:
      "Indian nettle (Acalypha indica) contains cyanogenic/irritant acalyphin glycosides capable of triggering severe hemolysis in G6PD-deficient patients and acute methemoglobinemia.",
    reasonFr:
      "Acalypha indica contient de l'acalyphine et peut déclencher une hémolyse sévère (notamment en cas de déficit en G6PD) et une toxicité digestive.",
    parts: "fresh leaves and whole plant",
  },
  "stillingia-root": {
    reason:
      "Queen's root (Stillingia sylvatica) contains caustic phorbol diterpene esters and acrid resins causing mucosal blistering, violent purging, and collapse in overdose.",
    reasonFr:
      "La racine de stillingia contient des esters diterpéniques caustiques provoquant brûlures muqueuses et vomissements sévères.",
    parts: "fresh root and latex",
  },
  "vinca-major": {
    reason:
      "Greater periwinkle contains cytotoxic/hypotensive Vinca indole alkaloids (vincamine-related) lacking safe self-care standardization; risky with antihypertensives or anticoagulants.",
    reasonFr:
      "La grande pervenche contient des alcaloïdes indoliques (vincamine et apparentés) exposant à une hypotension et une toxicité sans dose sûre établie en automédication.",
    parts: "aerial parts",
  },
  "wild-indigo-root": {
    reason:
      "Wild indigo (Baptisia tinctoria) contains toxic quinolizidine alkaloids (cytisine, anagyrine) capable of causing nausea, vomiting, respiratory stimulation followed by paralysis.",
    reasonFr:
      "Le baptisia (Baptisia tinctoria) contient de la cytisine et des alcaloïdes quinolizidiniques toxiques pouvant causer vomissements et paralysie respiratoire à forte dose.",
    parts: "root and seeds",
  },
  "lycopodium-clavatum": {
    reason:
      "Clubmoss herb contains neurotoxic Lycopodium alkaloids (huperzine-like / lycopodine); internal ingestion of the whole herb (as opposed to inert external spores) is unsafe.",
    reasonFr:
      "La plante entière de lycopode contient des alcaloïdes neurotoxiques (lycopodine) rendant son usage interne non sécuritaire.",
    parts: "aerial herb (distinct from topical spores)",
  },
  "red-poppy-petals": {
    reason:
      "Corn poppy (Papaver rhoeas) contains rhoeadine alkaloids reported in human case series to cause miosis, CNS depression, and generalized seizures; contraindicated in children and pregnancy.",
    reasonFr:
      "Le coquelicot (Papaver rhoeas) contient des alcaloïdes rhoéadiques associés à des cas de dépression du SNC et de convulsions chez l'enfant.",
    parts: "petals and seed capsules",
  },
  "veronica-virginica": {
    reason:
      "Culver's root (Veronicastrum virginicum) is an obsolete violent emetic-cathartic lacking modern human safety data; fresh root causes severe hemorrhagic GI irritation and pregnancy loss.",
    reasonFr:
      "La véronique de Virginie est un émétique et purgatif violent dépourvu de données d'innocuité modernes.",
    parts: "fresh rhizome and root",
  },
  "leptandra-virginica": {
    reason:
      "Culver's root (Leptandra/Veronicastrum virginicum) causes violent GI cramping, vomiting, and bloody diarrhea at crude doses and has no established safe non-homeopathic dose.",
    reasonFr:
      "Leptandra virginica provoque crampes, vomissements et diarrhées graves à l'état brut sans posologie orale sûre établie.",
    parts: "fresh rhizome and root",
  },
  "european-mistletoe": {
    reason:
      "Viscum album berries and crude oral plant parts contain cardiotoxic phoratoxins/viscotoxins and cytotoxic lectins; crude self-administration causes vomiting, seizures, bradycardia, and hepatitis.",
    reasonFr:
      "Le gui (Viscum album) contient des viscotoxines et lectines cytotoxiques ; les baies et préparations orales brutes exposent à convulsions, bradycardie et toxicité hépatique.",
    parts: "berries, leaves, and crude stems",
  },
  "trailing-arbutus": {
    reason:
      "Trailing arbutus (Epigaea repens) contains arbutin/hydroquinone-releasing glycosides with cumulative nephrotoxicity, hepatotoxicity, and oxytocic/abortifacient hazards; lack modern clinical safety data.",
    reasonFr:
      "L'épigée rampante (Epigaea repens) contient de l'arbutine/hydroquinone exposant à une toxicité rénale et hépatique sans données cliniques modernes.",
    parts: "leaves",
  },
  "polygonum-punctatum": {
    reason:
      "Dotted smartweed (Persicaria punctata) is an acrid irritant emmenagogue/abortifacient herb with no modern human safety data or established therapeutic dose.",
    reasonFr:
      "La renouée ponctuée (Persicaria punctata) est irritante et historiquement abortive, sans posologie clinique sûre établie.",
    parts: "aerial parts",
  },
  "aletris-farinosa": {
    reason:
      "True unicorn root (Aletris farinosa) lacks modern safety trials, carries uterine/estrogenic and CNS-stupor risks at non-homeopathic doses, and has no established adult therapeutic dose.",
    reasonFr:
      "L'alétris farineux (Aletris farinosa) est dépourvu de données cliniques sûres et présente des risques digestifs et utérins hors dilutions homéopathiques.",
    parts: "rhizome and root",
  },
  "false-unicorn": {
    reason:
      "False unicorn root (Chamaelirium luteum) is an endangered plant lacking clinical safety trials; it historically caused gastric irritation, uterine stimulation, and kidney irritation at high doses.",
    reasonFr:
      "Le chamaelirium (Chamaelirium luteum) manque d'essais de sécurité cliniques et présente des risques de toxicité digestive, rénale et utérine.",
    parts: "rhizome and root",
  },
  "partridge-berry": {
    reason:
      "Partridge berry (Mitchella repens) has traditionally been misused as an oxytocic/parturient despite total lack of maternal-fetal safety studies; do not self-dose during pregnancy.",
    reasonFr:
      "Le pain-de-perdrix (Mitchella repens) ne dispose d'aucune étude de sécurité obstétricale et ne doit pas être autodossé pendant la grossesse.",
    parts: "aerial parts",
  },
};

/**
 * Herbs whose documented use is strictly external/topical, or whose oral safety/adulteration
 * profile lacks a weight-scalable single adult reference dose (never offer Clark/weight math).
 */
export const TOPICAL_ONLY_OR_NO_ORAL_CALC_SLUGS: ReadonlySet<string> = new Set([
  "comfrey",
  "tea-tree",
  "vetiver",
  "calendula",
  "arnica",
  "gotu-kola",
  "cayenne",
  "myrrh",
  "commiphora-molmol",
  "kava",
  "fo-ti-prepared",
  "guduchi",
  "nutmeg",
  "saffron",
  "boneset",
  "asafoetida",
  "ferula-foetida-herb",
  "ferula-narthex",
  "black-haw",
  "turnera-aphrodisiaca",
  "hyssop-herb",
  "blue-flag",
  "stevia",
  "oregano",
  "illicium-verum",
  "pine-needle",
  "tsuga-canadensis",
  "citrus-limonum",
  "euphrasia-officinalis",
  "iris-pallida",
  "fabiana-imbricata",
  "rhus-aromatica",
  "sumac-bark",
  "prunus-persica-herb",
  "prunus-spinosa-herb",
  "plum-bark",
  "fagus-sylvatica",
  "cuscuta-seed",
  "goat-rue",
  "red-yeast-rice",
  "butterbur",
  "tongkat-ali",
  "wild-lettuce",
  "pomegranate-peel",
  "thuja",
  "melaleuca-cajuputi",
  "quassia-wood",
  "benzoin-resin",
  "buckthorn",
  "aloe-vera-leaf",
  "rhamnus-purshiana",
  "frangula-purshiana",
  "senna-leaf",
  "rheum-officinale",
  "pasque-flower",
  "anemone-pulsatilla",
]);

const NON_DOSABLE_PATTERN =
  /\bdrops?\(s\)|\b(no safe|do not use|absolutely no use|lethal|medical use only|medical supervision only|not recommended|contraindicated|homeopathic|poisonous|toxic|no modern standardized|no labelled dose|pellet|globule|granule|\bunit\b|spray|tube|under (?:strict |direct |medical |professional )?supervision|professional use only|controlled substance|pharmaceutical .* only|narrow therapeutic|carcinogen|cyanide|topical(?:ly)? only|external use only|for external use|for cutaneous use|not for (?:home|oral|internal) use|extremely limited|very (?:low|small) doses? only|low dose only|rinsing or gargling|no established|not established|reference only|short-term use only)\b/i;

export function getDangerousHerb(slug: string): DangerousHerb | undefined {
  return DANGEROUS_HERBS[slug];
}

export function isDangerousHerb(slug: string): boolean {
  return slug in DANGEROUS_HERBS;
}

/**
 * True when an herb slug must NEVER expose an interactive weight-scaled dosage
 * calculator link (covers both lethally toxic/banned plants and topical-only or
 * unquantified herbs).
 */
export function isCalculatorBlockedSlug(slug: string): boolean {
  return isDangerousHerb(slug) || TOPICAL_ONLY_OR_NO_ORAL_CALC_SLUGS.has(slug);
}

/**
 * Gate for offering the interactive dosage calculator on a herb page.
 * Never offer a dosage calculator CTA for toxic/lethal plants, medical-only
 * poisons, topical-only herbs, homeopathic forms, or herbs without a
 * quantitative therapeutic adult dose.
 */
export function canShowDoseCalculator(
  slug: string,
  dosageAdult: string | null | undefined
): boolean {
  if (isCalculatorBlockedSlug(slug)) return false;
  if (!dosageAdult || !dosageAdult.trim()) return false;
  if (NON_DOSABLE_PATTERN.test(dosageAdult)) return false;
  return true;
}
