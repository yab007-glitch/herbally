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