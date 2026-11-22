// Top herb monographs with hand-written deep clinical content
// All other herbs get auto-generated monographs via generate-monograph.ts

export type { Monograph } from "./monographs/types";
import type { Monograph } from "./monographs/types";
import { monographsPart1 } from "./monographs/part1";
import { monographsPart2 } from "./monographs/part2";

export const monographs: Record<string, Monograph> = {
  ...monographsPart1,
  ...monographsPart2,
};

export function getMonograph(slug: string): Monograph | null {
  return monographs[slug] || null;
}

/**
 * True when this herb has a hand-written (human-authored) monograph in this
 * file — i.e. content that is NOT AI-generated. Used to gate the herb page:
 * only hand-written monographs show the rich narrative; every other herb
 * renders the government-sourced view (government sources + PubMed citations)
 * instead of AI-generated text.
 */
export function hasManualMonograph(slug: string): boolean {
  return getMonograph(slug) != null;
}
