import type { VerifiedContext } from "./context-fetcher";

/**
 * Build the system prompt for the AI herbalist.
 *
 * When verifiedContext is available (herbs/interactions fetched from our DB),
 * it becomes the PRIMARY source. The AI MUST use it and MUST NOT contradict it.
 * The AI may only supplement with its own knowledge when the verified data is
 * incomplete, and must clearly mark any supplemental information.
 */
export function getSystemPrompt(
  herbContext?: string | null,
  medications?: string[],
  locale?: string,
  verifiedContext?: VerifiedContext | null
): string {
  const medicationList = medications?.length
    ? `\nThe user is currently taking these medications: ${medications.join(", ")}`
    : "";

  const herbInfo = herbContext
    ? `\nCurrent herb context: ${herbContext}`
    : "";

  const languageInstruction =
    locale === "fr"
      ? `\nIMPORTANT: Respond in French (Français). All your responses must be in French.`
      : "";

  // ── Build verified data section ──────────────────────────────────
  let verifiedDataSection = "";

  if (verifiedContext && verifiedContext.source === "database") {
    verifiedDataSection = "\n## VERIFIED DATABASE DATA (PRIMARY SOURCE)\n";
    verifiedDataSection += `Source note: ${verifiedContext.note}\n`;

    // Herb profiles
    for (const herb of verifiedContext.herbs) {
      verifiedDataSection += `\n### ${herb.name} (${herb.scientific_name})\n`;
      verifiedDataSection += `Description: ${herb.description}\n`;
      verifiedDataSection += `Evidence level: ${herb.evidence_level ?? "Not rated"}\n`;
      verifiedDataSection += `Verification: ${herb.provenance_method === "manual" || herb.provenance_method === "primary_source" ? "Human-verified" : herb.provenance_method === "ai_summarized" ? "AI-generated — verify independently" : "Unverified"}\n`;

      if (herb.traditional_uses.length > 0) {
        verifiedDataSection += `Traditional uses: ${herb.traditional_uses.join("; ")}\n`;
      }
      if (herb.modern_uses.length > 0) {
        verifiedDataSection += `Modern uses: ${herb.modern_uses.join("; ")}\n`;
      }
      if (herb.active_compounds.length > 0) {
        verifiedDataSection += `Active compounds: ${herb.active_compounds.join(", ")}\n`;
      }
      if (herb.dosage_adult) {
        verifiedDataSection += `Typical adult dosage: ${herb.dosage_adult}\n`;
      }
      if (herb.contraindications.length > 0) {
        verifiedDataSection += `Contraindications: ${herb.contraindications.join("; ")}\n`;
      }
      if (herb.side_effects.length > 0) {
        verifiedDataSection += `Side effects: ${herb.side_effects.join("; ")}\n`;
      }
      if (herb.pregnancy_safe_oral !== herb.pregnancy_safe_topical) {
      if (herb.nursing_safe_oral !== herb.nursing_safe_topical) {
        verifiedDataSection += `Nursing safety: Oral=${herb.nursing_safe_oral === true ? "Safe" : herb.nursing_safe_oral === false ? "UNSAFE" : "Unknown"}, Topical=${herb.nursing_safe_topical === true ? "Safe" : herb.nursing_safe_topical === false ? "UNSAFE" : "Unknown"}\n`;
      } else {
        verifiedDataSection += `Nursing safety: ${herb.nursing_safe === true ? "Generally safe" : herb.nursing_safe === false ? "NOT safe — avoid" : "Unknown — insufficient data"}\n`;
      }
      } else {
        verifiedDataSection += `Pregnancy safety: ${herb.pregnancy_safe === true ? "Generally safe" : herb.pregnancy_safe === false ? "NOT safe — avoid" : "Unknown — insufficient data"}\n`;
      }
      verifiedDataSection += `Nursing safety: ${herb.nursing_safe === true ? "Generally safe" : herb.nursing_safe === false ? "NOT safe — avoid" : "Unknown — insufficient data"}\n`;

      if (herb.drug_interactions.length > 0) {
        verifiedDataSection += `Known drug interactions (from database):\n`;
        for (const ix of herb.drug_interactions) {
          verifiedDataSection += `  - ${ix}\n`;
        }
      }
    }

    // Known interactions
    if (verifiedContext.interactions.length > 0) {
      verifiedDataSection += `\n### Known Herb-Drug Interactions (from database)\n`;
      for (const ix of verifiedContext.interactions) {
        verifiedDataSection += `- ${ix.herb_name} + ${ix.drug_name} → ${ix.severity}\n`;
        verifiedDataSection += `  Mechanism: ${ix.mechanism}\n`;
        verifiedDataSection += `  Evidence: ${ix.evidence}\n`;
        verifiedDataSection += `  Recommendation: ${ix.recommendation}\n`;
      }
    }

    if (verifiedContext.medicationsMentioned.length > 0) {
      verifiedDataSection += `\nMedications mentioned: ${verifiedContext.medicationsMentioned.join(", ")}\n`;
    }
  }

  // ── Build the full prompt ─────────────────────────────────────────

  return `You are the HerbAlly Virtual Herbalist — a concise, evidence-based AI assistant for medicinal herbs.

## CRITICAL RULES — READ CAREFULLY

### DATA ACCURACY (MOST IMPORTANT)
${verifiedContext && verifiedContext.source === "database"
  ? `- PRIMARY SOURCE: The "VERIFIED DATABASE DATA" section below contains information from the HerbAlly database.
- You MUST use this data as your primary source. DO NOT contradict it.
- If the verified data says a herb is unsafe during pregnancy, DO NOT say it's safe.
- If the verified data lists specific side effects, DO NOT omit them.
- If the verified data shows a known drug interaction, ALWAYS mention it.
- You may supplement with your own knowledge ONLY when the verified data is incomplete.
- When you supplement, clearly mark it: "[Supplemental — not in HerbAlly database]"
- If the verified data says "Unknown — insufficient data", say exactly that. Do not guess.`
  : `- You do NOT have access to the HerbAlly database for this query.
- Rely on your training data but be explicit about uncertainty.
- NEVER fabricate specific numbers, PMIDs, or study details you're unsure about.`}

### SAFETY RULES
- This is EDUCATIONAL information only — NOT medical advice, diagnosis, or treatment.
- NEVER tell users to start/stop medications or herbs without consulting a healthcare provider.
- ALWAYS flag pregnancy/nursing contraindications when relevant.
- If unsure, say "insufficient evidence" rather than guessing.
- In emergencies, direct users to call poison control (1-800-222-1222) or 911.

### CITATION RULES
- You do NOT have real-time access to PubMed. NEVER fabricate a PMID number.
- Only cite a PMID if you are 100% certain the number is correct from your training data.
- A wrong PMID is worse than no PMID. When in doubt, OMIT the PMID.
- Instead of guessing PMIDs, describe the study: "A 2015 randomized trial found..."
- If the verified data below includes specific information, cite "HerbAlly database" as the source.

### COMMUNICATION STYLE
- Be SHORT and DIRECT. 2-4 sentences for simple questions, bullet points for lists.
- Skip preamble — go straight to the answer.
- Only elaborate when asked.
- One brief disclaimer at the end is enough.

### EVIDENCE TRANSPARENCY
- **Strong evidence** = multiple RCTs or systematic reviews
- **Moderate evidence** = limited clinical studies
- **Traditional use** = historical/herbal medicine practice
- **Limited evidence** = preclinical/anecdotal only

### INTERACTION FORMAT
For interaction checks, format as:
**Herb** + **Drug** → **Risk Level** (Mild/Moderate/Severe/Contraindicated)
- Mechanism: [brief]
- Evidence: [source type + level]
- Action: [what to do]

End every interaction response with: "⚠️ Consult your healthcare provider before combining herbs with medications."

### SAFETY QUESTIONS
Always include:
1. Key contraindications (pregnancy, conditions)
2. Known side effects
3. Evidence quality for claims

${verifiedDataSection}${herbInfo}${medicationList}${languageInstruction}`;
}
