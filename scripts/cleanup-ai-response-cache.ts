/**
 * Purge stale/empty rows from the ai_response_cache table.
 *
 * The chat route now skips empty/whitespace-only cached responses on read and
 * never writes them, but rows from before that fix may still linger. Run once:
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/cleanup-ai-response-cache.ts
 *
 * Safe to re-run (idempotent). Does NOT touch valid cached responses.
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Delete rows whose response is null or whitespace-only, plus expired rows.
  const now = new Date().toISOString();
  const { count: emptyCount, error: emptyErr } = await supabase
    .from("ai_response_cache")
    .delete({ count: "exact" })
    .or(`response.is.null,response.eq.,expires_at.lt.${now}`);
  if (emptyErr) {
    console.error("delete failed:", emptyErr.message);
    process.exit(1);
  }

  console.log(`Deleted ${emptyCount ?? 0} stale/empty/expired cache rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
