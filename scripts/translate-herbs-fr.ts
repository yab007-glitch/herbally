#!/usr/bin/env npx tsx
/**
 * HerbAlly — French Translation Script (Fast)
 *
 * Translates all herb content, drug interactions, and categories into French
 * using the OpenRouter API, then stores results in the Supabase database.
 *
 * Speed optimizations:
 *   - Batches 5 herbs per API call (5x fewer requests)
 *   - Runs 3 concurrent API requests (3x parallelism)
 *   - Only fetches untranslated items from DB
 *   - ~15x faster than single-herb sequential approach
 *
 * Prerequisites:
 *   Add SUPABASE_SERVICE_ROLE_KEY to your .env.local file.
 *
 * Run:
 *   npx tsx scripts/translate-herbs-fr.ts
 *
 * The script is resumable — herbs already translated are skipped automatically.
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({
  path: path.join(process.cwd(), ".env.local"),
  override: false,
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const OPENROUTER_KEY = (process.env.OPENROUTER_API_KEY ?? "").trim();
const BASE_URL = (
  process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1"
).trim();
const MODEL = (process.env.OPENROUTER_MODEL ?? "openrouter/auto").trim();

// Tuning: 3 concurrent workers × ~3.5s delay = ~51 req/min (under 20/min per-key limit for paid, safe for free)
const HERBS_PER_CALL = 5; // herbs packed into one API call
const CONCURRENCY = 3; // parallel API requests
const CALL_DELAY = 3500; // ms between calls per worker
const IX_PER_CALL = 10; // interactions per API call
const MAX_RETRIES = 3;
const RETRY_WAIT = 65000; // ms to wait on 429

// ── Validation ───────────────────────────────────────────────────────────────

if (!SUPABASE_URL) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL");
  process.exit(1);
}
if (!SERVICE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!OPENROUTER_KEY) {
  console.error("Missing OPENROUTER_API_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// ── AI translation ────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function translateJSON(input: object, attempt = 1): Promise<object> {
  const prompt = [
    "You are a professional medical translator specialising in herbal medicine.",
    "Translate the JSON below from English to French.",
    "Rules:",
    "- Return ONLY valid JSON — no markdown, no code fences, no explanation.",
    "- Keep scientific/Latin names, chemical compound names, and drug names in English.",
    "- Keep dosage numbers and units unchanged (mg, g, ml, drops, etc.).",
    "- Translate all other text naturally into professional French.",
    "- Preserve the exact JSON structure (same keys, same array lengths).",
    "",
    `JSON to translate:\n${JSON.stringify(input, null, 2)}`,
  ].join("\n");

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://herbally.app",
      "X-Title": "HerbAlly Translation",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (response.status === 429 && attempt <= MAX_RETRIES) {
    console.log(
      `    Rate limited — waiting ${RETRY_WAIT / 1000}s (retry ${attempt}/${MAX_RETRIES})`
    );
    await sleep(RETRY_WAIT);
    return translateJSON(input, attempt + 1);
  }

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    throw new Error(`OpenRouter ${response.status}: ${err.slice(0, 200)}`);
  }

  const result = await response.json();
  const raw = (result.choices?.[0]?.message?.content ?? "").trim();
  const clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error(`AI returned invalid JSON: ${clean.slice(0, 300)}`);
  }
}

// ── Concurrency helper ───────────────────────────────────────────────────────

type Task<T> = () => Promise<T>;

async function runConcurrent<T>(
  tasks: Task<T>[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

// ── 1. Categories ─────────────────────────────────────────────────────────────

async function translateCategories() {
  console.log("\n--- Translating herb categories ---");

  const { data: cats, error } = await supabase
    .from("herb_categories")
    .select("id, name, description")
    .is("name_fr", null);

  if (error) {
    console.error("  Error:", error.message);
    return;
  }
  if (!cats?.length) {
    console.log("  All categories already translated");
    return;
  }

  console.log(`  ${cats.length} untranslated categories`);

  for (const cat of cats) {
    try {
      const translated = (await translateJSON({
        name: cat.name,
        description: cat.description ?? "",
      })) as { name: string; description: string };

      await supabase
        .from("herb_categories")
        .update({
          name_fr: translated.name,
          description_fr: translated.description,
        })
        .eq("id", cat.id);

      console.log(`  ${cat.name} -> ${translated.name}`);
      await sleep(CALL_DELAY);
    } catch (e) {
      console.error(`  Error "${cat.name}":`, (e as Error).message);
      await sleep(CALL_DELAY);
    }
  }
}

// ── 2. Herbs (batched + concurrent) ──────────────────────────────────────────

interface HerbRow {
  id: string;
  name: string;
  common_names: string[] | null;
  description: string;
  traditional_uses: string[] | null;
  modern_uses: string[] | null;
  dosage_adult: string | null;
  dosage_child: string | null;
  preparation_notes: string | null;
  contraindications: string[] | null;
  side_effects: string[] | null;
  translations: Record<string, unknown> | null;
}

async function translateHerbs() {
  console.log("\n--- Translating herbs (batched) ---");

  // Fetch ALL herbs with pagination (Supabase default limit is 1000)
  let allHerbs: HerbRow[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("herbs")
      .select(
        "id, name, common_names, description, traditional_uses, modern_uses, dosage_adult, dosage_child, preparation_notes, contraindications, side_effects, translations"
      )
      .eq("is_published", true)
      .order("name")
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("  Fetch error:", error.message);
      return;
    }
    if (!data?.length) break;
    allHerbs = allHerbs.concat(data as HerbRow[]);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  // Filter to untranslated only
  const herbs = (allHerbs as HerbRow[]).filter(
    (h) => !(h.translations as Record<string, unknown> | null)?.fr
  );

  const total = allHerbs.length;
  const skipped = total - herbs.length;
  console.log(
    `  Total: ${total}, already translated: ${skipped}, remaining: ${herbs.length}`
  );

  if (!herbs.length) {
    console.log("  All herbs already translated");
    return;
  }

  // Split into batches of HERBS_PER_CALL
  const batches: HerbRow[][] = [];
  for (let i = 0; i < herbs.length; i += HERBS_PER_CALL) {
    batches.push(herbs.slice(i, i + HERBS_PER_CALL));
  }

  console.log(
    `  ${batches.length} API calls needed (${HERBS_PER_CALL} herbs/call, ${CONCURRENCY} concurrent)`
  );

  let translated = 0;
  let errors = 0;
  const startTime = Date.now();

  // Create tasks for each batch
  const tasks: Task<void>[] = batches.map((batch, batchIdx) => async () => {
    try {
      // Build a keyed object: { "herb_0": {...}, "herb_1": {...} }
      const input: Record<string, object> = {};
      for (let i = 0; i < batch.length; i++) {
        const h = batch[i];
        input[`herb_${i}`] = {
          name: h.name,
          common_names: h.common_names ?? [],
          description: h.description,
          traditional_uses: h.traditional_uses ?? [],
          modern_uses: h.modern_uses ?? [],
          dosage_adult: h.dosage_adult ?? "",
          dosage_child: h.dosage_child ?? "",
          preparation_notes: h.preparation_notes ?? "",
          contraindications: h.contraindications ?? [],
          side_effects: h.side_effects ?? [],
        };
      }

      const result = (await translateJSON(input)) as Record<string, object>;

      // Save each herb's translation
      for (let i = 0; i < batch.length; i++) {
        const herb = batch[i];
        const fr = result[`herb_${i}`];
        if (!fr) {
          console.error(`  Missing herb_${i} in response for "${herb.name}"`);
          errors++;
          continue;
        }

        const existing = herb.translations ?? {};
        const { error: upErr } = await supabase
          .from("herbs")
          .update({ translations: { ...existing, fr } })
          .eq("id", herb.id);

        if (upErr) {
          console.error(`  Error ${herb.name}: ${upErr.message}`);
          errors++;
        } else {
          translated++;
        }
      }

      const pct = Math.round((translated / herbs.length) * 100);
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = translated / (elapsed / 60);
      const remaining = herbs.length - translated - errors;
      const eta = rate > 0 ? Math.round(remaining / rate) : "?";
      console.log(
        `  [${pct}%] ${translated}/${herbs.length} done (batch ${batchIdx + 1}/${batches.length}, ${Math.round(rate)}/min, ~${eta}min left)`
      );

      await sleep(CALL_DELAY);
    } catch (e) {
      const names = batch.map((h) => h.name).join(", ");
      console.error(`  Batch error [${names}]:`, (e as Error).message);
      errors += batch.length;

      // On batch failure, try each herb individually as fallback
      for (const herb of batch) {
        try {
          const singleInput = {
            name: herb.name,
            common_names: herb.common_names ?? [],
            description: herb.description,
            traditional_uses: herb.traditional_uses ?? [],
            modern_uses: herb.modern_uses ?? [],
            dosage_adult: herb.dosage_adult ?? "",
            dosage_child: herb.dosage_child ?? "",
            preparation_notes: herb.preparation_notes ?? "",
            contraindications: herb.contraindications ?? [],
            side_effects: herb.side_effects ?? [],
          };
          const fr = await translateJSON(singleInput);
          const existing = herb.translations ?? {};
          await supabase
            .from("herbs")
            .update({ translations: { ...existing, fr } })
            .eq("id", herb.id);
          translated++;
          errors--; // undo the batch error count
          await sleep(CALL_DELAY);
        } catch (e2) {
          console.error(
            `  Fallback error ${herb.name}:`,
            (e2 as Error).message
          );
          await sleep(CALL_DELAY);
        }
      }
    }
  });

  await runConcurrent(tasks, CONCURRENCY);

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(
    `  Herbs done: ${translated} translated, ${skipped} already done, ${errors} errors (${elapsed}s)`
  );
}

// ── 3. Drug interactions (batched + concurrent) ──────────────────────────────

interface IxRow {
  id: string;
  drug_name: string;
  description: string;
  mechanism: string | null;
  translations: Record<string, unknown> | null;
}

async function translateInteractions() {
  console.log("\n--- Translating drug interactions (batched) ---");

  // Fetch all, filter untranslated in app
  let allIxs: IxRow[] = [];
  let offset = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("drug_interactions")
      .select("id, drug_name, description, mechanism, translations")
      .order("drug_name")
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error("  Fetch error:", error.message);
      break;
    }
    if (!data?.length) break;
    allIxs = allIxs.concat(data as IxRow[]);
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  const ixs = allIxs.filter(
    (ix) => !(ix.translations as Record<string, unknown> | null)?.fr
  );
  const skipped = allIxs.length - ixs.length;
  console.log(
    `  Total: ${allIxs.length}, already translated: ${skipped}, remaining: ${ixs.length}`
  );

  if (!ixs.length) {
    console.log("  All interactions already translated");
    return;
  }

  // Batch interactions
  const batches: IxRow[][] = [];
  for (let i = 0; i < ixs.length; i += IX_PER_CALL) {
    batches.push(ixs.slice(i, i + IX_PER_CALL));
  }

  console.log(
    `  ${batches.length} API calls needed (${IX_PER_CALL} interactions/call, ${CONCURRENCY} concurrent)`
  );

  let translated = 0;
  let errors = 0;
  const startTime = Date.now();

  const tasks: Task<void>[] = batches.map((batch, batchIdx) => async () => {
    try {
      const input: Record<string, object> = {};
      for (let i = 0; i < batch.length; i++) {
        input[`ix_${i}`] = {
          description: batch[i].description,
          mechanism: batch[i].mechanism ?? "",
        };
      }

      const result = (await translateJSON(input)) as Record<string, object>;

      for (let i = 0; i < batch.length; i++) {
        const ix = batch[i];
        const fr = result[`ix_${i}`];
        if (!fr) {
          errors++;
          continue;
        }

        const existing = ix.translations ?? {};
        const { error: upErr } = await supabase
          .from("drug_interactions")
          .update({ translations: { ...existing, fr } })
          .eq("id", ix.id);

        if (upErr) {
          errors++;
        } else {
          translated++;
        }
      }

      if (batchIdx % 5 === 0 || batchIdx === batches.length - 1) {
        const pct = Math.round((translated / ixs.length) * 100);
        console.log(
          `  [${pct}%] ${translated}/${ixs.length} interactions (batch ${batchIdx + 1}/${batches.length})`
        );
      }

      await sleep(CALL_DELAY);
    } catch (e) {
      console.error(`  Batch error:`, (e as Error).message.slice(0, 150));
      errors += batch.length;
      await sleep(CALL_DELAY);
    }
  });

  await runConcurrent(tasks, CONCURRENCY);

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(
    `  Interactions done: ${translated} translated, ${skipped} already done, ${errors} errors (${elapsed}s)`
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("HerbAlly — French Translation Script (Fast)");
  console.log(`  Model     : ${MODEL}`);
  console.log(`  Supabase  : ${SUPABASE_URL}`);
  console.log(
    `  Batch size: ${HERBS_PER_CALL} herbs/call, ${IX_PER_CALL} interactions/call`
  );
  console.log(`  Concurrency: ${CONCURRENCY} parallel requests`);

  await translateCategories();
  await translateHerbs();
  await translateInteractions();

  console.log(
    "\nAll done! Run again anytime to translate newly added content."
  );
}

main().catch((e) => {
  console.error("\nFatal:", e);
  process.exit(1);
});
