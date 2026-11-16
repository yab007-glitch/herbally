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

export function fitsWithSuffix(title: string): boolean {
  return title.length + SITE_SUFFIX.length <= RENDERED_TITLE_MAX;
}

/**
 * Pick the richest candidate that stays inside the display limit.
 *
 * Preference order:
 * 1. the first candidate that fits together with the " | HerbAlly" suffix
 *    (keeps the brand);
 * 2. otherwise the first candidate that fits on its own, rendered with
 *    `title.absolute` so the template does not push it over the limit;
 * 3. otherwise the last (shortest) candidate, also absolute.
 *
 * Candidates must be ordered longest-to-shortest.
 */
export function fitTitle(candidates: string[]): PageTitle {
  if (candidates.length === 0) {
    throw new Error("fitTitle needs at least one candidate");
  }
  const branded = candidates.find(fitsWithSuffix);
  if (branded) return branded;
  const bare = candidates.find((title) => title.length <= RENDERED_TITLE_MAX);
  if (bare) return { absolute: bare };
  return { absolute: candidates[candidates.length - 1] };
}
