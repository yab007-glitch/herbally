/**
 * Trim a meta description to a character budget without cutting a word in half.
 *
 * Google renders roughly 155–160 characters. The herb template used a bare
 * `.slice(0, 158)`, so every French herb page ended mid-word
 * ("…et un calculateur d"). Cutting on the last space below the budget keeps
 * the snippet readable, and the ellipsis signals the truncation honestly.
 */
export function truncateDescription(text: string, max = 158): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;

  // Leave room for the ellipsis itself so the result never exceeds `max`.
  const hard = clean.slice(0, Math.max(1, max - 1));
  const lastSpace = hard.lastIndexOf(" ");
  const cut = lastSpace > hard.length * 0.6 ? hard.slice(0, lastSpace) : hard;

  // Strip punctuation *and* dangling connectors before the ellipsis: a cut
  // that lands right after "&" or "and" otherwise renders "pregnancy safety
  // &…", which is the defect this helper exists to prevent.
  const trimmed = cut
    .replace(/[\s,;:.\u2013\u2014&-]+$/, "")
    .replace(/\s+(?:and|or|with|for|of|the|a|an|to|in|on|at|by)$/i, "");

  return `${trimmed}…`;
}
