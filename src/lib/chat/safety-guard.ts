import { z } from "zod";

export const SafetyVerdictSchema = z.object({
  verdict: z.enum(["ok", "warn", "block"]),
  reasons: z.array(z.string()),
  appended: z.string().optional(),
});

export type SafetyVerdict = z.infer<typeof SafetyVerdictSchema>;

const HARD_BLOCKS_EN: RegExp[] = [
  /\bstop taking (?:your )?(?:medication|medications|insulin|prescription|pills)\b/i,
  /\breplace (?:your )?(?:insulin|chemotherapy|prescription|blood thinner)\b/i,
  /\b(?:this|it) (?:will|can) cure (?:your )?cancer\b/i,
  /\byou don'?t need (?:a|to see a) doctor\b/i,
  /\bignore (?:your )?(?:doctor|physician|prescription)\b/i,
  /\bdouble (?:the|your) dose\b/i,
];

const HARD_BLOCKS_FR: RegExp[] = [
  /\barrêt(?:ez|er) (?:de prendre )?(?:vos médicaments|votre traitement|votre insuline)\b/i,
  /\b(?:ça|cela|ceci) (?:va|peut) (?:guérir|soigner) (?:votre )?cancer\b/i,
  /\bignorez (?:votre )?(?:médecin|traitement)\b/i,
];

const SOFT_WARNS_EN: RegExp[] = [
  /\b(?:i can )?diagnose\b/i,
  /\bdiagnosis\b/i,
  /\bguaranteed (?:to )?(?:cure|heal|fix)\b/i,
  /\binstead of (?:your |a )?(?:prescription|doctor|treatment)\b/i,
];

const SOFT_WARNS_FR: RegExp[] = [
  /\bdiagnostiqu/i,
  /\bgaranti (?:de )?(?:guérir|soigner)\b/i,
  /\bau lieu de (?:votre )?(?:ordonnance|médecin)\b/i,
];

const EN_BLOCK =
  "I can't responsibly answer that. Please consult a qualified healthcare provider before making any changes to your medication or treatment.";
const FR_BLOCK =
  "Je ne peux pas répondre à cela. Consultez un professionnel de santé avant toute modification de votre traitement.";
const EN_WARN =
  "\n\n⚠️ This is educational information only — not medical advice. Always verify with a qualified healthcare provider before acting on it.";
const FR_WARN =
  "\n\n⚠️ Ceci est une information éducative — pas un avis médical. Vérifiez avec un professionnel de santé avant d'agir.";

/**
 * Evaluate the final assistant message text and return a verdict:
 *   - "ok"    — no red flags detected; use the content as-is.
 *   - "warn"  — soft concern (e.g. diagnostic language); append a localised warning.
 *   - "block" — hard red flag (e.g. "stop taking your insulin"); replace with a
 *               localised refusal.
 *
 * Client-side only. Runs after the upstream stream finishes but before the
 * message is persisted. Worst case: a bad message is shown once in the user's
 * own session and is replaced before it lands in the database.
 */
export function evaluateAssistantContent(
  content: string,
  locale: "en" | "fr" = "en"
): SafetyVerdict {
  const hardBlocks =
    locale === "fr" ? [...HARD_BLOCKS_EN, ...HARD_BLOCKS_FR] : HARD_BLOCKS_EN;
  const softWarns =
    locale === "fr" ? [...SOFT_WARNS_EN, ...SOFT_WARNS_FR] : SOFT_WARNS_EN;

  for (const re of hardBlocks) {
    if (re.test(content)) {
      return SafetyVerdictSchema.parse({
        verdict: "block",
        reasons: [`hard-block: ${re.source}`],
        appended: locale === "fr" ? FR_BLOCK : EN_BLOCK,
      });
    }
  }

  const hits = softWarns.filter((re) => re.test(content)).map((r) => r.source);
  if (hits.length > 0) {
    return SafetyVerdictSchema.parse({
      verdict: "warn",
      reasons: hits,
      appended: locale === "fr" ? FR_WARN : EN_WARN,
    });
  }

  return SafetyVerdictSchema.parse({ verdict: "ok", reasons: [] });
}
