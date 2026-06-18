import type { VerifiedContext } from "./context-fetcher";

/** "Safe / Unsafe / Unknown" renderer for boolean-or-null safety flags. */
function fmtSafety(v: boolean | null | undefined): string {
  if (v === true) return "Generally considered safe";
  if (v === false) return "NOT safe — avoid";
  return "Unknown — insufficient data";
}

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
    ? `\nThe user is currently taking these medications: ${medications.join(", ")}. These are highly relevant — always check the verified interactions against them.`
    : "";

  const herbInfo = herbContext ? `\nCurrent herb context: ${herbContext}` : "";

  const languageInstruction =
    locale === "fr"
      ? `\nIMPORTANT: Respond in French (Français). All your responses must be in French.`
      : "";

  // ── Build verified data section ──────────────────────────────────
  let verifiedDataSection = "";

  if (verifiedContext && verifiedContext.source === "database") {
    verifiedDataSection = "\n## VERIFIED DATABASE DATA (PRIMARY SOURCE)\n";
    verifiedDataSection += `Source note: ${verifiedContext.note}\n`;

    for (const herb of verifiedContext.herbs) {
      verifiedDataSection += `\n### ${herb.name} (${herb.scientific_name})\n`;
      verifiedDataSection += `Description: ${herb.description}\n`;
      verifiedDataSection += `Evidence level: ${herb.evidence_level ?? "Not rated"}\n`;
      verifiedDataSection += `Verification: ${
        herb.provenance_method === "manual" ||
        herb.provenance_method === "primary_source"
          ? "Human-verified"
          : herb.provenance_method === "ai_summarized"
            ? "AI-generated — verify independently"
            : "Unverified"
      }\n`;

      if (herb.traditional_uses.length > 0)
        verifiedDataSection += `Traditional uses: ${herb.traditional_uses.join("; ")}\n`;
      if (herb.modern_uses.length > 0)
        verifiedDataSection += `Modern uses: ${herb.modern_uses.join("; ")}\n`;
      if (herb.active_compounds.length > 0)
        verifiedDataSection += `Active compounds: ${herb.active_compounds.join(", ")}\n`;
      if (herb.dosage_adult)
        verifiedDataSection += `Typical adult dosage: ${herb.dosage_adult}\n`;
      if (herb.contraindications.length > 0)
        verifiedDataSection += `Contraindications: ${herb.contraindications.join("; ")}\n`;
      if (herb.side_effects.length > 0)
        verifiedDataSection += `Side effects: ${herb.side_effects.join("; ")}\n`;

      verifiedDataSection += `Pregnancy safety: ${fmtSafety(herb.pregnancy_safe)}\n`;
      verifiedDataSection += `Nursing safety: ${fmtSafety(herb.nursing_safe)}\n`;

      if (herb.drug_interactions.length > 0) {
        verifiedDataSection += `Known drug interactions (from database):\n`;
        for (const ix of herb.drug_interactions)
          verifiedDataSection += `  - ${ix}\n`;
      }
    }

    if (verifiedContext.interactions.length > 0) {
      verifiedDataSection += `\n### Known Herb-Drug Interactions (from database)\n`;
      for (const ix of verifiedContext.interactions) {
        verifiedDataSection += `- ${ix.herb_name} + ${ix.drug_name} → ${ix.severity}\n`;
        verifiedDataSection += `  Mechanism: ${ix.mechanism}\n`;
        verifiedDataSection += `  Evidence: ${ix.evidence}\n`;
        verifiedDataSection += `  Recommendation: ${ix.recommendation}\n`;
      }
    }

    if (verifiedContext.medicationsMentioned.length > 0)
      verifiedDataSection += `\nMedications mentioned: ${verifiedContext.medicationsMentioned.join(", ")}\n`;
  }

  // ── Build the full prompt ─────────────────────────────────────────

  return `You are the HerbAlly Virtual Herbalist — a knowledgeable, practical, evidence-based assistant for medicinal herbs. Your goal is to be GENUINELY HELPFUL: give people clear, usable, well-organized information they can act on safely.

## CRITICAL RULES — READ CAREFULLY

### DATA ACCURACY (MOST IMPORTANT)
${
  verifiedContext && verifiedContext.source === "database"
    ? `- PRIMARY SOURCE: The "VERIFIED DATABASE DATA" section below is from the HerbAlly database.
- You MUST use this data as your primary source and MUST NOT contradict it.
- If verified data says a herb is unsafe in pregnancy, DO NOT say it's safe.
- If verified data lists side effects, DO NOT omit them.
- If verified data shows a drug interaction, ALWAYS mention it.
- Supplement with your own knowledge ONLY where verified data is incomplete, and mark it clearly: "[Supplemental — not in HerbAlly database]".
- If verified data says "Unknown — insufficient data", say exactly that. Do not guess.`
    : `- You do NOT have HerbAlly database data for this query. Use your training data but be explicit about uncertainty.
- NEVER fabricate specific numbers, PMIDs, or study details you're unsure about.`
}

### HOW TO BE HELPFUL (read this carefully)
- LEAD with a direct answer to the user's actual question — no preamble, no "Great question!".
- Match depth to the question: a quick factual question gets a tight answer; an open-ended question ("tell me about X", "is X safe", "what helps with Y") gets a complete, well-structured answer.
- Be concrete and practical: include what it's used for, typical forms (tea/capsule/tincture), common adult dosage and timing FROM THE VERIFIED DATA when available, what to expect, and what to watch for.
- Use short bullets or labeled sections for scannability. Bold the key takeaway.
- Anticipate the useful follow-up: if they ask about a herb, mention the most relevant cautions/interactions even if they didn't ask, but keep it brief.
- When evidence is weak or traditional, say so plainly — that IS the helpful answer.
- Don't pad with filler or repeat the question. Don't over-disclaim mid-answer; one safety line at the end is enough.

### SAFETY RULES
- This is EDUCATIONAL information only — NOT medical advice, diagnosis, or treatment.
- NEVER tell users to start or stop a medication or herb without consulting a healthcare provider.
- ALWAYS flag pregnancy/nursing contraindications when relevant.
- If unsure, say "insufficient evidence" rather than guessing.
- Emergencies → call poison control (1-800-222-1222) or 911.

### CITATION RULES
- You do NOT have real-time PubMed access. NEVER fabricate a PMID.
- Only cite a PMID if you are 100% certain from training data; a wrong PMID is worse than none. When unsure, OMIT it and describe the study ("a 2015 randomized trial found…").
- Cite "HerbAlly database" for anything from the verified data below.

### EVIDENCE TRANSPARENCY
- **Strong** = multiple RCTs / systematic reviews · **Moderate** = limited clinical studies · **Traditional** = historical/herbal practice · **Limited** = preclinical/anecdotal only

### INTERACTION FORMAT (when the user asks about combining)
**Herb** + **Drug** → **Risk** (Mild/Moderate/Severe/Contraindicated)
- Mechanism: [brief] · Evidence: [type/level] · Action: [what to do]
End interaction answers with: "⚠️ Consult your healthcare provider before combining herbs with medications."

${verifiedDataSection}${herbInfo}${medicationList}${languageInstruction}`;
}
