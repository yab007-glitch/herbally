/**
 * Purge the ai_response_cache table.
 *
 * Default: delete only null/whitespace-only and expired rows (safe tidy-up).
 * --all:   delete EVERY row (full cache clear). The cache is regenerative
 *          (a miss fetches live and re-caches), so a full clear is safe and
 *          is the right move after changing the model/prompt to drop stale
 *          responses from the previous era.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/cleanup-ai-response-cache.ts [--all]
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const all = process.argv.includes("--all");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const now = new Date().toISOString();

  // PostgREST requires a WHERE on DELETE. Use a filter that matches the
  // target set: all rows (created_at after epoch) or just stale/empty ones.
  let resCount: number | null = null;
  let resErr: { message: string } | null = null;
  if (all) {
    console.log("Clearing ALL ai_response_cache rows...");
    const r = await supabase
      .from("ai_response_cache")
      .delete({ count: "exact" })
      .gt("created_at", "1970-01-01T00:00:00.000Z");
    resCount = r.count;
    resErr = r.error;
  } else {
    console.log("Deleting null/whitespace and expired rows...");
    const r = await supabase
      .from("ai_response_cache")
      .delete({ count: "exact" })
      .or(`response.is.null,response.eq.,expires_at.lt.${now}`);
    resCount = r.count;
    resErr = r.error;
  }
  if (resErr) {
    console.error("delete failed:", resErr.message);
    process.exit(1);
  }
  console.log(`Deleted ${resCount ?? 0} rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
