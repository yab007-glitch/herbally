#!/usr/bin/env npx tsx
/**
 * Translate untranslated English herb common names (`translations.fr.name = name`)
 * into Canadian French using Ollama Cloud (`OLLAMA_CLOUD_API_KEY`, `OLLAMA_CLOUD_URL`,
 * `OLLAMA_CLOUD_MODEL`), with strict validation and rejection logging.
 *
 * Usage:
 *   npx tsx scripts/translate-herb-names-fr.ts \
 *     --input /tmp/task1-herbs-input.json \
 *     --out /tmp/task1-fr-results.json \
 *     --rejects /tmp/task1-fr-rejects.json \
 *     --sql-out /tmp/task1-apply.sql
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({
  path: path.join(process.cwd(), ".env.local"),
  override: false,
});

export interface HerbNameInput {
  slug: string;
  name: string;
  scientific_name: string;
  common_names?: string[] | null;
}

export interface AcceptedTranslation {
  slug: string;
  name: string;
  scientific_name: string;
  fr_name: string;
}

export interface RejectedTranslation {
  slug: string;
  name: string;
  scientific_name: string;
  candidate: string;
  reason:
    | "empty_or_invalid"
    | "identical_to_en"
    | "english_stopword"
    | "different_latin_binomial"
    | "replaced_common_with_latin"
    | "meta_response"
    | "api_error";
  detail?: string;
}

const ENGLISH_STOPWORDS = new Set([
  "the",
  "and",
  "of",
  "for",
  "with",
  "from",
  "herb",
  "herbs",
  "root",
  "roots",
  "leaf",
  "leaves",
  "bark",
  "seed",
  "seeds",
  "berry",
  "berries",
  "flower",
  "flowers",
  "dried",
  "fresh",
  "wild",
  "common",
  "black",
  "white",
  "red",
  "yellow",
  "blue",
  "green",
  "purple",
  "golden",
  "silver",
  "sweet",
  "bitter",
  "indian",
  "chinese",
  "african",
  "american",
  "european",
  "japanese",
  "korean",
  "mexican",
  "persian",
  "mountain",
  "water",
  "giant",
  "dwarf",
  "false",
  "true",
  "extract",
  "powder",
  "wood",
  "vine",
  "tree",
  "bush",
  "grass",
  "moss",
  "fern",
  "mushroom",
  "fungus",
  "oil",
  "tea",
  "butter",
  "gum",
  "resin",
  "complex",
  "formula",
  "patent",
  "oil",
  "plant",
  "weed",
  "wort",
  "thorn",
  "mint",
  "sage",
  "pepper",
  "ginger",
  "bean",
  "pea",
  "plum",
  "apple",
  "cherry",
  "nut",
  "pine",
  "oak",
  "willow",
  "lily",
  "clover",
  "thistle",
  "nettle",
]);

const META_PATTERNS = [
  /no translation/i,
  /unchanged/i,
  /same as/i,
  /not applicable/i,
  /^n\/a$/i,
  /^unknown$/i,
  /in french/i,
  /aucune traduction/i,
  /pas de nom/i,
  /non traduit/i,
];

function normalizeTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/['’"().,:;!?/\\-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function validateFrenchHerbName(
  row: HerbNameInput,
  rawCandidate: unknown
):
  | { ok: true; fr_name: string }
  | {
      ok: false;
      reason: RejectedTranslation["reason"];
      candidate: string;
      detail?: string;
    } {
  if (typeof rawCandidate !== "string") {
    return {
      ok: false,
      reason: "empty_or_invalid",
      candidate: String(rawCandidate ?? ""),
      detail: "non-string",
    };
  }
  const candidate = rawCandidate.replace(/\s+/g, " ").trim();
  if (
    !candidate ||
    candidate.length > 100 ||
    /[`\n\r*#\[\]{}]/.test(candidate)
  ) {
    return {
      ok: false,
      reason: "empty_or_invalid",
      candidate,
      detail: "empty, too long, or contains markup",
    };
  }

  for (const pat of META_PATTERNS) {
    if (pat.test(candidate)) {
      return {
        ok: false,
        reason: "meta_response",
        candidate,
        detail: `matched ${pat.source}`,
      };
    }
  }

  if (candidate.toLowerCase() === row.name.trim().toLowerCase()) {
    return { ok: false, reason: "identical_to_en", candidate };
  }

  const nameLower = row.name.trim().toLowerCase();
  const sciLower = row.scientific_name.trim().toLowerCase();
  const candLower = candidate.toLowerCase();

  // Reject if an English common name was replaced by the Latin scientific_name
  if (
    nameLower !== sciLower &&
    candLower === sciLower &&
    !nameLower.includes("var") &&
    !nameLower.startsWith(sciLower.slice(0, 6))
  ) {
    return {
      ok: false,
      reason: "replaced_common_with_latin",
      candidate,
      detail: `replaced common name "${row.name}" with Latin "${row.scientific_name}"`,
    };
  }

  // Reject if candidate looks like a Latin binomial different from scientific_name
  // (avoids rejecting genuine 2-word French names like "If commun" or "Lupin blanc")
  const latinEpithetRe =
    /(?:us|um|is|ae|ii|orum|arum|ensis|ense|oides|flora|folia|phylla|carpa|sperma|rhiza|stachys|caulis|fera|ferum)$/;
  const candParts = candidate.split(/\s+/);
  const looksLatinBinomial =
    !/[àâäéèêëîïôöùûüç']/i.test(candidate) &&
    candParts.length === 2 &&
    /^[A-Z][a-z]+$/.test(candParts[0]) &&
    /^[a-z]{3,}$/.test(candParts[1]) &&
    latinEpithetRe.test(candParts[1]);
  if (looksLatinBinomial && candLower !== sciLower) {
    return {
      ok: false,
      reason: "different_latin_binomial",
      candidate,
      detail: `expected ${row.scientific_name} or French vernacular`,
    };
  }

  // Allow tokens that appear literally in scientific_name (e.g. "officinalis", "alba")
  // or legitimate French botanical words that overlap? Note: none of ENGLISH_STOPWORDS
  // are standard French words except possibly "pine" (rare, not used as plant name; French is "pin")
  // or "tea" (French is "thé"). Still preserve scientific_name tokens and "var"/"subsp".
  const sciTokens = new Set(normalizeTokens(row.scientific_name));
  const candTokens = normalizeTokens(candidate);
  const badStopword = candTokens.find(
    (tok) => ENGLISH_STOPWORDS.has(tok) && !sciTokens.has(tok)
  );
  if (badStopword) {
    return {
      ok: false,
      reason: "english_stopword",
      candidate,
      detail: `matched "${badStopword}"`,
    };
  }

  return { ok: true, fr_name: candidate };
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return undefined;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function callOllamaBatch(
  batch: HerbNameInput[],
  apiKey: string,
  baseUrl: string,
  model: string,
  attempt = 1
): Promise<Record<string, unknown>> {
  const payload = batch.map((h) => ({
    slug: h.slug,
    name: h.name,
    scientific_name: h.scientific_name,
    common_names: (h.common_names ?? []).slice(0, 4),
  }));

  const prompt = [
    "You are a Canadian French (fr-CA) botanical and medical translator.",
    "Translate each herb's `name` into its standard Canadian French common name.",
    "Strict rules:",
    "1. Return ONLY a single valid JSON object mapping each `slug` to its French name string. No markdown, no fences, no prose.",
    "2. If `name` is an English common name or descriptive name (e.g. 'German Iris', 'Cuban Oregano', 'White Tea', 'Vitis vinifera (grape) seed extract'), translate it into natural Canadian French ('Iris d'Allemagne', 'Origan cubain', 'Thé blanc', 'Extrait de pépins de Vitis vinifera (raisin)'). NEVER replace an English common name with a raw Latin binomial.",
    "3. If `name` is a Latin binomial (e.g. 'Abies alba', 'Physalis peruviana', 'Paeonia officinalis', 'Taxus baccata', 'Lavandula latifolia', 'Mentha longifolia'), provide its well-established Canadian French / French vernacular name when one exists ('Sapin blanc', 'Coqueret du Pérou', 'Pivoine officinale', 'If commun', 'Lavande aspic', 'Menthe à longues feuilles').",
    "4. If a Latin species truly has NO established French common name, OR if `name` is a brand/product/indigenous/Asian loanword used identically in Canadian French (e.g. 'Ashwagandha', 'Maca', 'Ginseng', 'Kava', 'Boswellia', 'Maitake', 'Cordyceps', 'Chaga', 'Tamanu', 'Za'atar', 'Cay Xao Tam Phan'), return the exact original `name` unchanged. NEVER invent a literal French translation of an obscure Latin epithet, and NEVER substitute a different Latin species.",
    "5. Keep names concise (under 80 characters) and never include explanations or notes.",
    "",
    `Items:\n${JSON.stringify(payload)}`,
  ].join("\n");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://herbally.app",
      "X-Title": "HerbAlly Name Translation",
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [{ role: "user", content: prompt }],
      reasoning_effort: "none",
      temperature: 0.1,
    }),
  });

  if ((res.status === 429 || res.status >= 500) && attempt <= 4) {
    const waitMs = res.status === 429 ? 30000 * attempt : 4000 * attempt;
    console.warn(
      `  HTTP ${res.status} on batch of ${batch.length}; retrying in ${waitMs / 1000}s (attempt ${attempt}/4)`
    );
    await sleep(waitMs);
    return callOllamaBatch(batch, apiKey, baseUrl, model, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama Cloud ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const raw = String(json.choices?.[0]?.message?.content ?? "").trim();
  const clean = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(clean);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Response JSON is not an object");
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    if (attempt <= 2) {
      await sleep(2000);
      return callOllamaBatch(batch, apiKey, baseUrl, model, attempt + 1);
    }
    throw new Error(
      `Invalid JSON (${(err as Error).message}): ${clean.slice(0, 250)}`
    );
  }
}

function sqlEscape(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function buildSql(accepted: AcceptedTranslation[]): string {
  if (accepted.length === 0) {
    return "-- No translations accepted.\n";
  }
  const values = accepted
    .map((r) => `  (${sqlEscape(r.slug)}, ${sqlEscape(r.fr_name)})`)
    .join(",\n");
  return [
    "BEGIN;",
    "",
    "WITH updates(slug, fr_name) AS (VALUES",
    values,
    ")",
    "UPDATE public.herbs h",
    "SET translations = jsonb_set(coalesce(h.translations, '{}'::jsonb), '{fr,name}', to_jsonb(u.fr_name), true)",
    "FROM updates u",
    "WHERE h.slug = u.slug",
    "  AND h.is_published = true",
    "  AND h.translations->'fr'->>'name' = h.name;",
    "",
    "COMMIT;",
    "",
  ].join("\n");
}

async function main() {
  const inputPath = getArg("--input") ?? "/tmp/task1-herbs-input.json";
  const outPath = getArg("--out") ?? "/tmp/task1-fr-results.json";
  const rejectsPath = getArg("--rejects") ?? "/tmp/task1-fr-rejects.json";
  const sqlOutPath = getArg("--sql-out") ?? "/tmp/task1-apply.sql";
  const limitArg = getArg("--limit");
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;
  const revalidateOnly = process.argv.includes("--revalidate-only");

  const allRows: HerbNameInput[] = JSON.parse(
    fs.readFileSync(inputPath, "utf8")
  );
  const rows =
    limit && Number.isFinite(limit) ? allRows.slice(0, limit) : allRows;

  if (revalidateOnly) {
    const prev = JSON.parse(fs.readFileSync(outPath, "utf8")) as {
      accepted: AcceptedTranslation[];
    };
    const rowMap = new Map(rows.map((r) => [r.slug, r]));
    const prevRejects: RejectedTranslation[] = fs.existsSync(rejectsPath)
      ? JSON.parse(fs.readFileSync(rejectsPath, "utf8"))
      : [];
    const newAccepted: AcceptedTranslation[] = [];
    const newRejects: RejectedTranslation[] = [...prevRejects];
    for (const item of prev.accepted) {
      const row = rowMap.get(item.slug);
      if (!row) continue;
      const check = validateFrenchHerbName(row, item.fr_name);
      if (check.ok) {
        newAccepted.push({ ...item, fr_name: check.fr_name });
      } else {
        newRejects.push({
          slug: row.slug,
          name: row.name,
          scientific_name: row.scientific_name,
          candidate: check.candidate,
          reason: check.reason,
          detail: check.detail,
        });
      }
    }
    fs.writeFileSync(
      outPath,
      JSON.stringify({ accepted: newAccepted }, null, 2)
    );
    fs.writeFileSync(rejectsPath, JSON.stringify(newRejects, null, 2));
    fs.writeFileSync(sqlOutPath, buildSql(newAccepted));
    console.log(
      `Revalidated: ${newAccepted.length} accepted, ${newRejects.length} rejected`
    );
    return;
  }

  const apiKey = (process.env.OLLAMA_CLOUD_API_KEY ?? "").trim();
  const baseUrl = (
    process.env.OLLAMA_CLOUD_URL ?? "https://ollama.com/v1"
  ).trim();
  const model = (
    process.env.OLLAMA_CLOUD_MODEL ?? "deepseek-v4.1-flash"
  ).trim();

  if (!apiKey) {
    console.error("Missing OLLAMA_CLOUD_API_KEY");
    process.exit(1);
  }

  const acceptedMap = new Map<string, AcceptedTranslation>();
  const rejectedMap = new Map<string, RejectedTranslation>();

  if (fs.existsSync(outPath)) {
    const prev = JSON.parse(fs.readFileSync(outPath, "utf8")) as {
      accepted?: AcceptedTranslation[];
    };
    for (const item of prev.accepted ?? []) {
      acceptedMap.set(item.slug, item);
    }
  }
  if (fs.existsSync(rejectsPath)) {
    const prevR = JSON.parse(
      fs.readFileSync(rejectsPath, "utf8")
    ) as RejectedTranslation[];
    for (const item of prevR) {
      rejectedMap.set(item.slug, item);
    }
  }

  const pending = rows.filter(
    (r) => !acceptedMap.has(r.slug) && !rejectedMap.has(r.slug)
  );
  console.log(
    `Loaded ${rows.length} rows (${acceptedMap.size} accepted, ${rejectedMap.size} rejected, ${pending.length} pending) using model ${model}`
  );

  const BATCH_SIZE = 25;
  const CONCURRENCY = 3;
  const batches: HerbNameInput[][] = [];
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    batches.push(pending.slice(i, i + BATCH_SIZE));
  }

  let nextIdx = 0;
  let completedBatches = 0;

  async function processBatch(batch: HerbNameInput[]): Promise<void> {
    try {
      const result = await callOllamaBatch(batch, apiKey, baseUrl, model);
      for (const row of batch) {
        const check = validateFrenchHerbName(row, result[row.slug]);
        if (check.ok) {
          acceptedMap.set(row.slug, {
            slug: row.slug,
            name: row.name,
            scientific_name: row.scientific_name,
            fr_name: check.fr_name,
          });
        } else {
          rejectedMap.set(row.slug, {
            slug: row.slug,
            name: row.name,
            scientific_name: row.scientific_name,
            candidate: check.candidate,
            reason: check.reason,
            detail: check.detail,
          });
        }
      }
    } catch (err) {
      if (batch.length > 5) {
        console.warn(
          `  Splitting failed batch of ${batch.length}: ${(err as Error).message}`
        );
        for (let i = 0; i < batch.length; i += 5) {
          await processBatch(batch.slice(i, i + 5));
        }
        return;
      }
      for (const row of batch) {
        rejectedMap.set(row.slug, {
          slug: row.slug,
          name: row.name,
          scientific_name: row.scientific_name,
          candidate: "",
          reason: "api_error",
          detail: (err as Error).message.slice(0, 150),
        });
      }
    }
  }

  function flushCheckpoints() {
    const accepted = Array.from(acceptedMap.values());
    const rejected = Array.from(rejectedMap.values());
    fs.writeFileSync(outPath, JSON.stringify({ accepted }, null, 2));
    fs.writeFileSync(rejectsPath, JSON.stringify(rejected, null, 2));
    fs.writeFileSync(sqlOutPath, buildSql(accepted));
  }

  async function worker() {
    while (nextIdx < batches.length) {
      const idx = nextIdx++;
      await processBatch(batches[idx]);
      completedBatches++;
      if (completedBatches % 5 === 0 || completedBatches === batches.length) {
        flushCheckpoints();
        console.log(
          `  Progress: ${completedBatches}/${batches.length} batches | accepted=${acceptedMap.size} rejected=${rejectedMap.size}`
        );
      }
      await sleep(1200);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, () =>
      worker()
    )
  );
  flushCheckpoints();

  const reasonCounts: Record<string, number> = {};
  for (const r of rejectedMap.values()) {
    reasonCounts[r.reason] = (reasonCounts[r.reason] ?? 0) + 1;
  }
  console.log("Done.", {
    total: rows.length,
    accepted: acceptedMap.size,
    rejected: rejectedMap.size,
    reasonCounts,
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
