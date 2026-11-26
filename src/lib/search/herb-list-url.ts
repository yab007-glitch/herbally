/**
 * Canonical URL builder for the herb list page (/herbs).
 *
 * Single source of truth for search / filter / sort / pagination URLs, so
 * the list page, SmartSearch, and pagination can never drift apart again.
 *
 * Canonicalisation rules (matching the list page's redirects):
 * - `q` and `category` are dropped when empty.
 * - `sort` is dropped when it is the default ("name").
 * - `page` is dropped when it is 1 or absent.
 * - `anchor` (default "herb-results") is appended so a paged navigation
 *   lands at the top of the results, not at the bottom of the page.
 */
export type HerbReviewFilter =
  "source_checked" | "clinically_reviewed" | "needs_review" | "ai_generated";

export interface HerbListParams {
  q?: string;
  category?: string;
  sort?: string;
  evidence?: string;
  review?: HerbReviewFilter;
  page?: number;
  anchor?: string | null;
}

const VALID_REVIEW_FILTERS: ReadonlySet<string> = new Set([
  "source_checked",
  "clinically_reviewed",
  "needs_review",
  "ai_generated",
]);

export function buildHerbListUrl(params: HerbListParams = {}): string {
  const sp = new URLSearchParams();
  const q = params.q?.trim();
  if (q) sp.set("q", q);
  const category = params.category?.trim();
  if (category) sp.set("category", category);
  const sort = params.sort?.trim();
  if (sort && sort !== "name") sp.set("sort", sort);
  const evidence = params.evidence?.trim();
  if (evidence === "clinical") sp.set("evidence", evidence);
  const review = params.review?.trim();
  if (review && VALID_REVIEW_FILTERS.has(review)) sp.set("review", review);
  const page = params.page;
  if (page !== undefined && Number.isFinite(page) && page > 1) {
    sp.set("page", String(Math.floor(page)));
  }
  const qs = sp.toString();
  const anchor =
    params.anchor === null ? "" : `#${params.anchor ?? "herb-results"}`;
  return `/herbs${qs ? `?${qs}` : ""}${anchor}`;
}

/** Parse a page value the way the list page does: invalid/negative/0 -> 1. */
export function parseHerbListPage(value: string | undefined): number {
  if (value === undefined) return 1;
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}
