/**
 * Title for an herb × drug interaction page.
 *
 * The root layout appends " | HerbAlly" through its title template, and the
 * rendered <title> is what search engines measure — so the budget is the
 * 60-character display limit minus the 12-character suffix. Three candidates
 * are tried longest-to-shortest; the first that fits wins, and the shortest is
 * the fallback for very long botanical or drug names.
 */
import { SITE_SUFFIX, RENDERED_TITLE_MAX } from "./fit-title";

export const TITLE_SUFFIX = SITE_SUFFIX;
export const TITLE_MAX = RENDERED_TITLE_MAX - TITLE_SUFFIX.length;

export function pairTitle(
  herbName: string,
  drugName: string,
  fr: boolean,
  max: number = TITLE_MAX
): string {
  const candidates = fr
    ? [
        `${herbName} et ${drugName} : interaction, gravité et conseils`,
        `${herbName} et ${drugName} : interaction`,
        `${herbName} et ${drugName}`,
      ]
    : [
        `${herbName} and ${drugName}: Interaction, Severity & Safety`,
        `${herbName} & ${drugName}: Interaction & Safety`,
        `${herbName} & ${drugName} Interaction`,
      ];
  return (
    candidates.find((candidate) => candidate.length <= max) ??
    candidates[candidates.length - 1]
  );
}
