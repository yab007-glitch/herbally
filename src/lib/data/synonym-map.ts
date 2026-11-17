import { stripAccents } from "@/lib/search/normalize-query";

/**
 * Centralized symptom keyword synonym map.
 * Maps common user search terms (EN + FR) → DB symptom_keywords.
 * Single source of truth — imported by both server actions and API routes.
 */
export const SYNONYM_MAP: Record<string, string[]> = {
  anxiety: ["anxiety", "stress", "calm", "relax", "nervous"],
  anxiete: ["anxiety", "stress", "calm", "relax", "nervous"],
  stress: ["stress", "anxiety", "adaptogen", "calm"],
  depression: ["depression", "mood", "anxiety"],
  sleep: ["sleep", "insomnia", "calm", "relax", "sedative"],
  sommeil: ["sleep", "insomnia", "calm", "relax", "sedative"],
  dormir: ["sleep", "insomnia", "calm", "relax", "sedative"],
  // Bidirectional with sleep: previously only sleep -> insomnia existed,
  // so an AI-normalised "insomnia" query never matched sleep-tagged herbs.
  // sedative/nervine are the same pattern: they only appeared as expansion
  // targets, never as keys, so a query using them matched nothing.
  insomnia: ["insomnia", "sleep", "calm", "relax", "sedative"],
  insomnie: ["insomnia", "sleep", "calm", "relax", "sedative"],
  sedative: ["sedative", "sleep", "insomnia", "calm", "relax"],
  sedatif: ["sedative", "sleep", "insomnia", "calm", "relax"],
  nervine: ["nervine", "calm", "anxiety", "relax", "sleep"],
  calm: ["calm", "anxiety", "relax", "sleep", "nervine"],
  calme: ["calm", "anxiety", "relax", "sleep", "nervine"],
  relax: ["relax", "calm", "sleep", "anxiety", "muscle"],
  focus: ["focus", "cognitive", "memory", "concentration", "brain"],
  memoire: ["memory", "cognitive", "focus", "concentration", "brain"],
  concentration: ["concentration", "focus", "cognitive", "memory", "brain"],
  energy: ["energy", "stimulant", "adaptogen", "fatigue"],
  energie: ["energy", "stimulant", "adaptogen", "fatigue"],
  fatigue: ["fatigue", "energy", "adaptogen", "stimulant"],
  pain: ["pain", "analgesic", "anti-inflammatory", "inflammation"],
  douleur: ["pain", "analgesic", "anti-inflammatory", "inflammation"],
  douleurs: ["pain", "analgesic", "anti-inflammatory", "inflammation"],
  articulations: ["pain", "inflammation", "anti-inflammatory", "arthritis"],
  arthrite: ["inflammation", "pain", "anti-inflammatory", "arthritis"],
  headache: ["headache", "migraine", "pain"],
  migraine: ["migraine", "headache", "pain"],
  inflammation: ["inflammation", "anti-inflammatory", "pain", "swelling"],
  digestion: ["digestion", "digestive", "stomach", "gut", "nausea", "bloating"],
  stomach: ["digestion", "stomach", "nausea", "digestive"],
  estomac: ["digestion", "stomach", "nausea", "digestive"],
  nausea: ["nausea", "digestion", "digestive", "stomach"],
  nausee: ["nausea", "digestion", "digestive", "stomach"],
  nausees: ["nausea", "digestion", "digestive", "stomach"],
  constipation: ["constipation", "digestion", "laxative", "digestive"],
  ibs: ["ibs", "digestion", "digestive", "stomach", "bloating"],
  crohns: ["crohns", "digestion", "digestive", "inflammatory-bowel"],
  ulcerative: ["colitis", "digestion", "inflammatory-bowel"],
  colitis: ["colitis", "digestion", "inflammatory-bowel"],
  liver: ["liver", "hepatoprotective", "detox"],
  foie: ["liver", "hepatoprotective", "detox"],
  blood_pressure: ["blood-pressure", "cardiovascular", "heart"],
  bloodpressure: ["blood-pressure", "cardiovascular", "heart"],
  hypertension: ["blood-pressure", "cardiovascular", "heart"],
  tension: ["blood-pressure", "cardiovascular", "heart"],
  cholesterol: ["cholesterol", "cardiovascular", "lipid"],
  heart: ["cardiovascular", "heart", "blood-pressure", "circulation"],
  coeur: ["cardiovascular", "heart", "blood-pressure", "circulation"],
  circulation: ["circulation", "cardiovascular", "heart"],
  thyroid: ["thyroid", "hormonal", "endocrine"],
  thyroide: ["thyroid", "hormonal", "endocrine"],
  adrenal: ["adrenal", "hormonal", "stress", "fatigue"],
  surrenales: ["adrenal", "hormonal", "stress", "fatigue"],
  immune: ["immune", "antiviral", "antibacterial", "infection"],
  immunite: ["immune", "antiviral", "antibacterial", "infection"],
  cold: ["cold", "immune", "antiviral", "respiratory", "cough"],
  rhume: ["cold", "immune", "antiviral", "respiratory", "cough"],
  flu: ["flu", "immune", "antiviral", "respiratory"],
  grippe: ["flu", "immune", "antiviral", "respiratory"],
  cough: ["cough", "respiratory", "cold", "throat"],
  toux: ["cough", "respiratory", "cold", "throat"],
  allergy: ["allergy", "antihistamine", "immune"],
  allergie: ["allergy", "antihistamine", "immune"],
  allergies: ["allergy", "antihistamine", "immune"],
  anemia: ["anemia", "blood", "iron", "fatigue"],
  anemie: ["anemia", "blood", "iron", "fatigue"],
  iron: ["iron", "anemia", "blood", "fatigue"],
  fer: ["iron", "anemia", "blood", "fatigue"],
  menstrual: ["menstrual", "hormonal", "cramps", "pms"],
  regles: ["menstrual", "hormonal", "cramps", "pms"],
  menstruations: ["menstrual", "hormonal", "cramps", "pms"],
  menopause: ["menopause", "hormonal", "hot flashes"],
  hormonal: ["hormonal", "menstrual", "menopause", "endocrine"],
  acne: ["skin", "acne", "anti-inflammatory"],
  skin: ["skin", "wound", "anti-inflammatory", "antimicrobial"],
  peau: ["skin", "wound", "anti-inflammatory", "antimicrobial"],
  wound: ["wound", "skin", "healing", "antimicrobial"],
  plaie: ["wound", "skin", "healing", "antimicrobial"],
  cicatrisation: ["wound", "skin", "healing", "antimicrobial"],
  prostate: ["prostate", "saw-palmetto", "urinary"],
  testosterone: ["testosterone", "mens", "energy", "libido"],
  weight: ["weight", "metabolic", "digestion"],
  poids: ["weight", "metabolic", "digestion"],
  diabetes: ["blood-sugar", "diabetes", "metabolic", "glucose"],
  diabete: ["blood-sugar", "diabetes", "metabolic", "glucose"],
  glycemie: ["blood-sugar", "diabetes", "metabolic", "glucose"],
  blood_sugar: ["blood-sugar", "diabetes", "metabolic", "glucose"],
  detox: ["liver", "detox", "cleansing"],
};

/**
 * Expand a user query into DB-friendly symptom keywords using synonym mapping.
 */
export function expandQueryToKeywords(query: string): string[] {
  const words = query
    .toLowerCase()
    .split(/[\s'’]+/)
    .filter(Boolean);
  const keywords = new Set<string>();
  for (const word of words) {
    const folded = stripAccents(word);
    for (const key of [word, folded]) {
      if (SYNONYM_MAP[key]) {
        SYNONYM_MAP[key].forEach((k) => keywords.add(k));
      }
      keywords.add(key);
      keywords.add(key.replace(/[_-]/g, " "));
    }
  }
  return Array.from(keywords);
}
