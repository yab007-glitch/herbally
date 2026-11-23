import type { Metadata } from "next";

/**
 * The root layout's title template appends this to every page title, so a page
 * title that "fits" 60 characters on its own renders 61–72 characters and gets
 * truncated in search results at the wrong place.
 */
export const SITE_SUFFIX = " | HerbAlly";

/** The <title> length search engines display. */
export const RENDERED_TITLE_MAX = 60;

type PageTitle = Metadata["title"];

/**
 * Count the length a title string occupies in rendered `<title>` HTML after
 * React's HTML entity escaping (`&` → `&amp;`, `'` → `&#x27;`, etc.).
 * Because `renderedTitleLength(s) >= s.length`, enforcing this bound keeps
 * both the decoded display length and the raw HTML `<title>` within 60 chars.
 */
export function renderedTitleLength(title: string): number {
  let len = 0;
  for (const ch of title) {
    if (ch === "&") len += 5;
    else if (ch === "'" || ch === '"') len += 6;
    else if (ch === "<" || ch === ">") len += 4;
    else len += 1;
  }
  return len;
}

export function fitsWithSuffix(title: string): boolean {
  return renderedTitleLength(title + SITE_SUFFIX) <= RENDERED_TITLE_MAX;
}

function clampTitle(title: string, max: number): string {
  if (renderedTitleLength(title) <= max) return title;
  const trimmed = title.trim();
  const words = trimmed.split(/\s+/);
  let best = "";
  for (const word of words) {
    const next = best ? `${best} ${word}` : word;
    const candidate = `${next.replace(/[\s,:\-–—(]+$/, "")}…`;
    if (renderedTitleLength(candidate) <= max) {
      best = next;
    } else {
      break;
    }
  }
  if (best) {
    return `${best.replace(/[\s,:\-–—(]+$/, "")}…`;
  }
  let chars = "";
  for (const ch of trimmed) {
    if (renderedTitleLength(`${chars}${ch}…`) > max) break;
    chars += ch;
  }
  return `${chars.replace(/[\s,:\-–—(]+$/, "")}…`;
}

/**
 * Pick the richest candidate that stays inside the display limit.
 *
 * Preference order:
 * 1. the first candidate that fits together with the " | HerbAlly" suffix
 *    (keeps the brand);
 * 2. otherwise the first candidate that fits on its own, rendered with
 *    `title.absolute` so the template does not push it over the limit;
 * 3. otherwise the last (shortest) candidate, clamped cleanly on a word
 *    boundary to `RENDERED_TITLE_MAX`, also absolute.
 *
 * Candidates must be ordered longest-to-shortest.
 */
export function fitTitle(candidates: string[]): PageTitle {
  if (candidates.length === 0) {
    throw new Error("fitTitle needs at least one candidate");
  }
  const branded = candidates.find(fitsWithSuffix);
  if (branded) return branded;
  const bare = candidates.find(
    (title) => renderedTitleLength(title) <= RENDERED_TITLE_MAX
  );
  if (bare) return { absolute: bare };
  return {
    absolute: clampTitle(candidates[candidates.length - 1], RENDERED_TITLE_MAX),
  };
}
