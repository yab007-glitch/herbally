import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "fs";

/**
 * One-time sweep: revalidate the page cache for every herb that has a
 * PubMed-compiled sheet, so each sheet shows on the next visit instantly
 * (instead of waiting the 1h TTL). No recompilation — just revalidation pings.
 *
 * Sequential at ~1 ping/sec to stay under the endpoint's 60/min rate limit,
 * and resumable: completed slugs are appended to /tmp/revalidate-done.txt and
 * skipped on re-run, so an interrupted sweep continues where it left off.
 */
const PROGRESS = "/tmp/revalidate-done.txt";
const DELAY_MS = 1050;

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const secret = process.env.REVALIDATE_SECRET;
  const base =
    process.env.REVALIDATE_URL ||
    `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/revalidate-pubmed-sheet`;
  if (!secret) throw new Error("REVALIDATE_SECRET not set in .env.local");
  if (!base) throw new Error("No revalidation URL (set NEXT_PUBLIC_APP_URL)");

  const slugs: string[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from("herb_pubmed_monographs")
      .select("slug")
      .order("slug")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    for (const r of data as { slug: string }[]) slugs.push(r.slug);
    if (data.length < 1000) break;
    from += 1000;
  }

  const done = new Set<string>(
    existsSync(PROGRESS)
      ? readFileSync(PROGRESS, "utf-8").split("\n").filter(Boolean)
      : []
  );
  const todo = slugs.filter((s) => !done.has(s));
  console.log(
    `Sheets: ${slugs.length} · already done: ${done.size} · to ping: ${todo.length}`
  );

  let ok = 0;
  let failed = 0;
  for (let i = 0; i < todo.length; i++) {
    const slug = todo[i];
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, secret }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        ok++;
        appendFileSync(PROGRESS, slug + "\n");
      } else {
        failed++;
        if (res.status === 429) {
          // Rate limited — wait a bit, then retry this slug once.
          await new Promise((r) => setTimeout(r, 5000));
          try {
            const r2 = await fetch(base, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ slug, secret }),
              signal: AbortSignal.timeout(15000),
            });
            if (r2.ok) {
              ok++;
              appendFileSync(PROGRESS, slug + "\n");
              failed--;
            }
          } catch {
            /* keep as failed */
          }
        }
      }
    } catch {
      failed++;
    }
    if ((i + 1) % 50 === 0)
      console.log(`[${i + 1}/${todo.length}] ok=${ok} failed=${failed}`);
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
  console.log(`\nDone: ${ok} revalidated, ${failed} failed of ${todo.length}.`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
