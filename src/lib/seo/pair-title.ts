/**
 * Title for an herb × drug interaction page.
 *
 * The root layout appends " | HerbAlly" through its title template, and the
 * rendered <title> is what search engines measure — so the budget is the
 * 60-character display limit minus the 12-character suffix. Three candidates
 * are tried longest-to-shortest; the first that fits wins, and the shortest is
 * the fallback for very long botanical or drug names.
 */
import type { Metadata } from "next";
import { SITE_SUFFIX, RENDERED_TITLE_MAX, fitTitle } from "./fit-title";

export const TITLE_SUFFIX = SITE_SUFFIX;
export const TITLE_MAX = RENDERED_TITLE_MAX - TITLE_SUFFIX.length;

function pairTitleCandidates(
  herbName: string,
  drugName: string,
  fr: boolean
): string[] {
  const shortDrug = drugName.replace(/\s*\([^)]*\)\s*/g, "").trim() || drugName;
  const hasParen = shortDrug !== drugName;
  if (fr) {
    return [
      `${herbName} et ${drugName} : interaction, gravité et conseils`,
      `${herbName} et ${drugName} : interaction`,
      `${herbName} et ${drugName}`,
      ...(hasParen
        ? [
            `${herbName} et ${shortDrug} : interaction`,
            `${herbName} et ${shortDrug}`,
          ]
        : []),
    ];
  }
  return [
    `${herbName} and ${drugName}: Interaction, Severity & Safety`,
    `${herbName} & ${drugName}: Interaction & Safety`,
    `${herbName} & ${drugName} Interaction`,
    ...(hasParen
      ? [
          `${herbName} & ${shortDrug}: Interaction & Safety`,
          `${herbName} & ${shortDrug} Interaction`,
          `${herbName} & ${shortDrug}`,
        ]
      : [`${herbName} & ${drugName}`]),
  ];
}

export function pairTitle(
  herbName: string,
  drugName: string,
  fr: boolean,
  max: number = TITLE_MAX
): string {
  const candidates = pairTitleCandidates(herbName, drugName, fr);
  return (
    candidates.find((candidate) => candidate.length <= max) ??
    candidates[candidates.length - 1]
  );
}

/**
 * Fit an interaction pair <title> inside the 60-char rendered SERP budget
 * (falling back to `{ absolute }` or a word-boundary clamp when needed).
 */
export function pairTitleMeta(
  herbName: string,
  drugName: string,
  fr: boolean
): Metadata["title"] {
  return fitTitle(pairTitleCandidates(herbName, drugName, fr));
}
