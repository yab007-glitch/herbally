export type MedicationScope = "molecule" | "class";

const CLASS_PATTERNS: RegExp[] = [
  /\b(?:anticoagulants?|antiplatelets?|anti-?platelet|blood\s+thinners?)\b/i,
  /\b(?:antidepressants?|ssris?|snris?|maois?|tricyclics?|antipsychotics?)\b/i,
  /\b(?:nsaids?|statins?|beta-?blockers?|calcium\s+channel\s+blockers?|ace\s+inhibitors?|arbs?)\b/i,
  /\b(?:benzodiazepines?|sedatives?|hypnotics?|barbiturates?|opioids?|analgesics?)\b/i,
  /\b(?:antidiabetics?|hypoglycemics?|insulin\s+secretagogues?|anticoagulant\s+drugs?)\b/i,
  /\b(?:anticonvulsants?|antiepileptics?|immunosuppressants?|corticosteroids?|steroids?)\b/i,
  /\b(?:antihypertensives?|diuretics?|chemotherapy|antineoplastics?|antiarrhythmics?)\b/i,
  /\b(?:thyroid\s+hormones?|oral\s+contraceptives?|estrogens?|hormone\s+therapy)\b/i,
  /\b(?:cyp\d+[a-z0-9]*\s+(?:substrates?|inhibitors?|inducers?)|p-gp\s+substrates?)\b/i,
  /\b(?:agents?|medications?|drugs?|class)\b/i,
];

export function classifyMedicationScope(drugName: string): MedicationScope {
  const normalized = drugName.trim();
  if (!normalized) return "molecule";
  if (CLASS_PATTERNS.some((re) => re.test(normalized))) {
    return "class";
  }
  return "molecule";
}
