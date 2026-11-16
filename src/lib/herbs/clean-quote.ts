/**
 * Make an imported regulator/product quotation readable when the importer cut
 * it mid-word.
 *
 * Several upstream harvests stored text with a hard `slice(0, 280|300)`, so
 * live pages ended in fragments like "…high blood pressure, or a ki" with no
 * ellipsis (188 safety cards, 151 regulator quotes). The stored value is kept
 * intact; this only closes the quotation honestly:
 *
 * - whitespace is collapsed;
 * - a dangling regulator section number ("… constipation. 4.2.") is removed;
 * - an incomplete cross-reference ("… (see section 4.4.") is removed;
 * - text that already ends in terminal punctuation is returned unchanged;
 * - otherwise it is cut back to the last complete sentence, or failing that
 *   to the last whole word, and an ellipsis is appended.
 */
const TERMINAL = /[.!?…]["'”’)\]]*$/;

function closeWithEllipsis(text: string): string {
  // Remove dangling connectors first, then punctuation they leave behind
  // ("…, or a" → "…"). Repeat: removing "a" can expose another connector.
  let trimmed = text;
  for (let i = 0; i < 4; i += 1) {
    const next = trimmed
      .replace(/\s+(?:and|or|with|for|of|the|a|an|to|in|on|at|by)$/i, "")
      .replace(/[\s,;:.–—&-]+$/, "");
    if (next === trimmed) break;
    trimmed = next;
  }
  return `${trimmed}…`;
}

export function cleanQuotedText(raw: string): string {
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text) return text;

  // "… (see section 4.4." — an unresolved cross-reference. Run this before
  // the section-number rule below, which would otherwise consume the "4.4."
  // and leave a dangling "(see section". Removing it leaves a complete
  // phrase, so only the ellipsis is needed.
  if (/\s*\(see section [\d.]+\.?\s*$/i.test(text)) {
    return closeWithEllipsis(
      text.replace(/\s*\(see section [\d.]+\.?\s*$/i, "")
    );
  }

  // "occasional constipation. 4.2." — a section number the source carried,
  // not part of the sentence.
  text = text.replace(/\s+\d+\.\d+\.$/, "").trim();

  if (TERMINAL.test(text)) return text;

  const lastSentence = Math.max(
    text.lastIndexOf(". "),
    text.lastIndexOf("! "),
    text.lastIndexOf("? ")
  );
  if (lastSentence > text.length * 0.5) {
    return text.slice(0, lastSentence + 1);
  }

  const lastSpace = text.lastIndexOf(" ");
  const cut = lastSpace > text.length * 0.5 ? text.slice(0, lastSpace) : text;
  return closeWithEllipsis(cut);
}
