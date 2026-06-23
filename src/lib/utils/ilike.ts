/**
 * Escape special ILIKE pattern characters so a user-supplied search term is
 * treated as a literal string, not a wildcard pattern.
 *
 * PostgREST parameterizes the value (so this is not SQL injection), but
 * without escaping, a user entering `%` matches every row and `_` matches any
 * single char — bypassing relevance ranking and enabling cheap broad-result
 * DoS on public search. Run EVERY user-supplied value bound for an ILIKE
 * filter through this, whether it goes through the Supabase JS `.ilike()`
 * builder or is interpolated into a PostgREST `.or()` filter string.
 *
 * H-3 (audit 2026-06-22): previously only /api/herbs/search escaped; the
 * server actions in src/lib/actions/herbs.ts and the admin herb list did not.
 */
export function escapeForIlike(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

/**
 * Sanitize a user-supplied value that is interpolated into a PostgREST `.or()`
 * filter STRING (e.g. `name.ilike.%${w}%,scientific_name.ilike.%${w}%`).
 *
 * Two risks there that `.ilike()` builder calls don't have:
 *   1. ILIKE wildcards — `%` matches every row, `_` matches any single char.
 *      (escapeForIlike handles these.)
 *   2. PostgREST filter-syntax metacharacters — `,` separates filter clauses,
 *      `.` separates column.operator.value, and `(` `)` group nested OR/AND. A
 *      value containing any of these lets a caller inject an arbitrary filter
 *      clause (SEC-5). Herb/drug/slug search terms never legitimately contain
 *      `,` or `.`; parens appear only in branded drug names ("Warfarin
 *      (Coumadin)") and are dropped at the cost of a slightly weaker match —
 *      the generic name still matches.
 *
 * Use this for every user-controlled value bound for a hand-built `.or()`
 * string. For the `.ilike()` builder, escapeForIlike alone is enough.
 */
export function sanitizeFilterValue(term: string): string {
  return escapeForIlike(term).replace(/[,.()]/g, "");
}
