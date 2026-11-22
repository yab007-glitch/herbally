import { publishedGuides, type Guide } from "./guides";

export interface GuideMatchInput {
  slug: string;
  interactions: ReadonlyArray<{ drug_name: string }>;
  sources: ReadonlyArray<{ source: string }>;
  pregnancySafe?: boolean | null;
  pregnancySafeOral?: boolean | null;
  symptomKeywords?: ReadonlyArray<string> | null;
  hasRegulatory?: boolean;
}

const BLOOD_THINNER_RE =
  /\b(warfarin|aspirin|clopidogrel|apixaban|rivaroxaban|heparin|anticoagulant|antiplatelet)\b/i;
const ANTIDEPRESSANT_RE =
  /\b(ssri|snri|antidepressant|fluoxetine|sertraline|trazodone|maoi)\b/i;
const DIABETES_RE =
  /\b(metformin|insulin|glipizide|glyburide|sulfonylurea|antidiabetic)\b/i;
const BP_RE =
  /\b(antihypertensive|lisinopril|enalapril|losartan|metoprolol|amlodipine|verapamil|furosemide|hydrochlorothiazide|hctz|diuretic|beta-blocker|calcium channel)\b/i;
const THYROID_RE = /\b(levothyroxine|synthroid|thyroid)\b/i;

/**
 * Select up to 3 published editorial guides relevant to a herb's safety profile,
 * interaction classes, sources, or symptom keywords so guides are linked contextually
 * from herb pages instead of remaining isolated in the sitemap.
 */
export function matchGuidesForHerb(input: GuideMatchInput): Guide[] {
  const all = publishedGuides();
  const bySlug = new Map(all.map((g) => [g.slug, g]));
  const picked: Guide[] = [];
  const push = (slug: string) => {
    if (picked.length >= 3) return;
    const g = bySlug.get(slug);
    if (g && !picked.some((p) => p.slug === slug)) picked.push(g);
  };

  const drugText = input.interactions.map((i) => i.drug_name).join(" | ");
  const hasLiverTox = input.sources.some((s) => s.source === "LiverTox");
  const hasHC =
    Boolean(input.hasRegulatory) ||
    input.sources.some((s) => s.source === "Health Canada");
  const keywords = (input.symptomKeywords ?? []).join(" ").toLowerCase();

  if (input.slug === "st-johns-wort") push("st-johns-wort-and-medications");
  if (BLOOD_THINNER_RE.test(drugText)) {
    push("herbs-and-blood-thinners");
    push("herbs-to-stop-before-surgery");
  }
  if (ANTIDEPRESSANT_RE.test(drugText)) push("herbs-and-antidepressants");
  if (DIABETES_RE.test(drugText)) push("herbs-and-diabetes-medications");
  if (BP_RE.test(drugText)) push("herbs-and-blood-pressure-medications");
  if (THYROID_RE.test(drugText)) push("herbs-and-thyroid-medications");
  if (hasLiverTox) push("liver-safety-and-herbal-supplements");
  if (input.pregnancySafe === false || input.pregnancySafeOral === false) {
    push("pregnancy-and-herbal-teas");
  }
  if (/\b(sleep|insomnia|anxiety|stress|calm|nervine)\b/.test(keywords)) {
    push("herbs-for-sleep-and-anxiety");
  }
  if (hasHC) push("how-to-read-health-canada-npn");

  if (input.interactions.length > 0) push("how-to-check-an-interaction");
  push("how-to-read-herb-evidence");

  return picked.slice(0, 3);
}
