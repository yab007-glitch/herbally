/**
 * Plan and (only on explicit request) apply a herb↔drug interaction seed
 * import.
 *
 * `planImport` is pure and network-free: tests, reviewers, and CI can inspect
 * exactly which rows would be inserted or updated without a database. The CLI
 * is a dry run by default; `--apply` additionally requires the service-role key
 * to be present in the environment, and the apply path is never exercised by
 * the read-only tooling.
 *
 * Usage:
 *   npx tsx scripts/interactions/import.ts
 *   npx tsx scripts/interactions/import.ts --dir data/interactions
 *   npx tsx scripts/interactions/import.ts --apply   # owner approval required
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { drugSlug } from "../../src/lib/interactions/pair-url";
import { loadEnvLocal, loadSeedDir, type SeedFileEntry } from "./seed";
import {
  validatePair,
  type ExistingPair,
  type RejectionCode,
} from "./validate";

/** Snake_case row destined for public.drug_interactions. */
export interface PlannedRow {
  herb_id: string;
  drug_name: string;
  rxcui: null;
  severity: string;
  description: string;
  mechanism: string;
  evidence_level: string;
  source: string;
  source_url: string;
  translations: null;
}

export interface AcceptedImport {
  file: string;
  herbSlug: string;
  pairKey: string;
  action: "insert" | "update";
  /** Provenance kept outside the row: public.drug_interactions has no licence column. */
  source: string;
  sourceLicence: string;
  row: PlannedRow;
}

export interface RejectedImport {
  file: string;
  herbSlug: string;
  drugName: string;
  code: RejectionCode;
  message: string;
}

export interface HerbCoverage {
  herbSlug: string;
  existing: number;
  incoming: number;
  accepted: number;
  newPairs: number;
}

export interface ImportPlan {
  accepted: AcceptedImport[];
  rejected: RejectedImport[];
  perHerb: HerbCoverage[];
}

export interface ImportContext {
  publishedHerbSlugs: ReadonlySet<string>;
  existingByHerb: ReadonlyMap<string, readonly ExistingPair[]>;
  /** Optional so planner tests and dry reviews can run without a database. */
  herbIds?: ReadonlyMap<string, string>;
}

function coverageFor(
  coverage: Map<string, HerbCoverage>,
  herbSlug: string,
  existing: number
): HerbCoverage {
  const current = coverage.get(herbSlug);
  if (current) return current;
  const created: HerbCoverage = {
    herbSlug,
    existing,
    incoming: 0,
    accepted: 0,
    newPairs: 0,
  };
  coverage.set(herbSlug, created);
  return created;
}

/**
 * Turn loaded seed files into a deterministic import plan.
 *
 * A pair whose exact drug name already exists is an `update` (idempotent);
 * every other accepted pair is an `insert`. Files with parse errors contribute
 * no pairs here — the CLI reports them separately so the plan stays typed.
 */
export function planImport(
  files: readonly SeedFileEntry[],
  ctx: ImportContext
): ImportPlan {
  const accepted: AcceptedImport[] = [];
  const rejected: RejectedImport[] = [];
  const acceptedPairKeys = new Set<string>();
  const coverage = new Map<string, HerbCoverage>();

  for (const file of files) {
    const herbSlug = file.herbSlug.trim();
    const existing = ctx.existingByHerb.get(herbSlug) ?? [];
    const existingNames = new Set(existing.map((pair) => pair.drugName));
    const bucket = coverageFor(coverage, herbSlug, existing.length);
    bucket.incoming += file.pairs.length;

    for (const pair of file.pairs) {
      const result = validatePair(pair, {
        herbSlug,
        publishedHerbSlugs: ctx.publishedHerbSlugs,
        acceptedPairKeys,
        existingPairs: existing,
      });

      if (!result.ok) {
        rejected.push({
          file: file.path,
          herbSlug,
          drugName: pair.drug_name.trim(),
          code: result.code,
          message: result.message,
        });
        continue;
      }

      acceptedPairKeys.add(result.pairKey);
      const drugName = pair.drug_name.trim();
      const action = existingNames.has(drugName) ? "update" : "insert";
      accepted.push({
        file: file.path,
        herbSlug,
        pairKey: result.pairKey,
        action,
        source: pair.source.trim(),
        sourceLicence: pair.source_licence.trim(),
        row: {
          herb_id: ctx.herbIds?.get(herbSlug) ?? "",
          drug_name: drugName,
          rxcui: null,
          severity: pair.severity,
          description: pair.description.trim(),
          mechanism: pair.mechanism.trim(),
          evidence_level: pair.evidence_level,
          source: pair.source.trim(),
          source_url: pair.source_url?.trim() ?? "",
          translations: null,
        },
      });

      bucket.accepted += 1;
      if (action === "insert") bucket.newPairs += 1;
    }
  }

  return {
    accepted,
    rejected,
    perHerb: [...coverage.values()].sort((left, right) =>
      left.herbSlug.localeCompare(right.herbSlug)
    ),
  };
}

// ─── CLI ────────────────────────────────────────────────────────────

interface CliOptions {
  dir: string;
  apply: boolean;
}

interface HerbRow {
  id: string;
  slug: string;
  is_published: boolean | null;
}

interface PairRow {
  herb_id: string;
  drug_name: string;
}

interface Snapshot {
  publishedHerbSlugs: Set<string>;
  herbIds: Map<string, string>;
  existingByHerb: Map<string, ExistingPair[]>;
}

const BATCH_SIZE = 100;

function parseArgs(argv: readonly string[]): CliOptions {
  let dir = "data/interactions";
  let apply = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dir") {
      dir = argv[index + 1] ?? dir;
      index += 1;
    } else if (arg.startsWith("--dir=")) {
      dir = arg.slice("--dir=".length);
    } else if (arg === "--apply") {
      apply = true;
    }
    // --dry-run is accepted but is already the default.
  }

  return { dir, apply };
}

function isDirectory(target: string): boolean {
  return existsSync(target) && statSync(target).isDirectory();
}

async function loadSnapshot(
  supabase: SupabaseClient
): Promise<Snapshot | null> {
  const herbIds = new Map<string, string>();
  const publishedHerbSlugs = new Set<string>();
  const PAGE_SIZE = 1000;
  let from = 0;
  while (true) {
    const herbs = await supabase
      .from("herbs")
      .select("id,slug,is_published")
      .range(from, from + PAGE_SIZE - 1);
    if (herbs.error) {
      console.error(`Failed to load herbs: ${herbs.error.message}`);
      return null;
    }
    for (const row of (herbs.data ?? []) as HerbRow[]) {
      herbIds.set(row.slug, row.id);
      if (row.is_published) publishedHerbSlugs.add(row.slug);
    }
    if (!herbs.data || herbs.data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const slugById = new Map<string, string>();
  for (const [slug, id] of herbIds) slugById.set(id, slug);

  const existingByHerb = new Map<string, ExistingPair[]>();
  from = 0;
  while (true) {
    const pairs = await supabase
      .from("drug_interactions")
      .select("herb_id,drug_name")
      .range(from, from + PAGE_SIZE - 1);
    if (pairs.error) {
      console.error(`Failed to load existing pairs: ${pairs.error.message}`);
      return null;
    }
    for (const row of (pairs.data ?? []) as PairRow[]) {
      const herbSlug = slugById.get(row.herb_id);
      if (!herbSlug) continue;
      const list = existingByHerb.get(herbSlug) ?? [];
      list.push({ drugName: row.drug_name, drugSlug: drugSlug(row.drug_name) });
      existingByHerb.set(herbSlug, list);
    }
    if (!pairs.data || pairs.data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { publishedHerbSlugs, herbIds, existingByHerb };
}

/** Deterministic value→count pairs, sorted by value. */
function countBy(values: readonly string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts].sort(([left], [right]) => left.localeCompare(right));
}

function printDryRun(
  files: SeedFileEntry[],
  plan: ImportPlan,
  pairCount: number
): void {
  const fileErrors = files.filter((file) => file.parseError);

  console.log(`Seed files: ${files.length}`);
  console.log(`Pairs: ${pairCount}`);
  console.log(`accepted: ${plan.accepted.length}`);
  console.log(`rejected: ${plan.rejected.length}`);
  console.log(`file errors: ${fileErrors.length}`);

  for (const error of fileErrors) {
    console.log(`FILE ERROR ${error.path}: ${error.parseError}`);
  }

  if (plan.rejected.length > 0) {
    console.log("Rejections:");
    for (const rejection of plan.rejected) {
      console.log(`  ${rejection.file} ${rejection.code} ${rejection.message}`);
    }
  }

  console.log("Per-herb coverage:");
  const licencesByHerb = new Map<string, Set<string>>();
  for (const entry of plan.accepted) {
    const licences = licencesByHerb.get(entry.herbSlug) ?? new Set<string>();
    licences.add(entry.sourceLicence);
    licencesByHerb.set(entry.herbSlug, licences);
  }
  const herbWidth = Math.max(
    4,
    ...plan.perHerb.map((entry) => entry.herbSlug.length)
  );
  const licenceLabels = new Map(
    plan.perHerb.map((entry) => [
      entry.herbSlug,
      [...(licencesByHerb.get(entry.herbSlug) ?? [])].sort().join(","),
    ])
  );
  const licenceWidth = Math.max(
    7,
    ...plan.perHerb.map(
      (entry) => (licenceLabels.get(entry.herbSlug) ?? "").length
    )
  );
  console.log(
    `${"herb".padEnd(herbWidth)}  ${"existing".padStart(8)}  ${"new".padStart(
      4
    )}  ${"licence".padEnd(licenceWidth)}`
  );
  for (const entry of plan.perHerb) {
    console.log(
      `${entry.herbSlug.padEnd(herbWidth)}  ${String(entry.existing).padStart(
        8
      )}  ${String(entry.newPairs).padStart(4)}  ${(
        licenceLabels.get(entry.herbSlug) ?? ""
      ).padEnd(licenceWidth)}`
    );
  }

  console.log("Accepted by source:");
  for (const [source, count] of countBy(
    plan.accepted.map((entry) => entry.source)
  )) {
    console.log(`  ${source}: ${count}`);
  }
  console.log("Accepted by licence:");
  for (const [licence, count] of countBy(
    plan.accepted.map((entry) => entry.sourceLicence)
  )) {
    console.log(`  ${licence}: ${count}`);
  }

  console.log("DRY RUN - no database writes.");
}

async function runCli(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  loadEnvLocal();

  if (options.apply && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "Refusing to apply: SUPABASE_SERVICE_ROLE_KEY is not set. " +
        "Put the key in the process environment, or omit --apply for a dry run."
    );
    return 2;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clientKey = options.apply
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !clientKey) {
    console.error(
      options.apply
        ? "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
        : "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
            "Add them to .env.local (values are never printed)."
    );
    return 2;
  }

  if (!isDirectory(options.dir)) {
    console.error(
      `Seed directory not found: ${options.dir}. Pass --dir <path> ` +
        "(default: data/interactions)."
    );
    return 2;
  }

  const supabase = createClient(supabaseUrl, clientKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const snapshot = await loadSnapshot(supabase);
  if (!snapshot) return 2;

  const files = loadSeedDir(options.dir);
  const pairCount = files.reduce((total, file) => total + file.pairs.length, 0);
  const plan = planImport(files, {
    publishedHerbSlugs: snapshot.publishedHerbSlugs,
    existingByHerb: snapshot.existingByHerb,
    herbIds: snapshot.herbIds,
  });

  if (!options.apply) {
    printDryRun(files, plan, pairCount);
    return 0;
  }

  const fileErrors = files.filter((file) => file.parseError);
  if (plan.rejected.length > 0 || fileErrors.length > 0) {
    console.error(
      `Refusing to apply: ${plan.rejected.length} rejected pair(s) and ` +
        `${fileErrors.length} unreadable file(s). Fix the seeds and re-run ` +
        "the dry run."
    );
    for (const rejection of plan.rejected) {
      console.error(
        `  ${rejection.file} ${rejection.code} ${rejection.message}`
      );
    }
    return 2;
  }

  const missingHerbIds = plan.perHerb.filter(
    (entry) => !snapshot.herbIds.has(entry.herbSlug)
  );
  if (missingHerbIds.length > 0) {
    console.error(
      `Refusing to apply: no herb id for ${missingHerbIds
        .map((entry) => entry.herbSlug)
        .join(", ")}`
    );
    return 2;
  }

  const inserts = plan.accepted.filter((entry) => entry.action === "insert");
  const updates = plan.accepted.filter((entry) => entry.action === "update");
  console.log(
    `Applying ${plan.accepted.length} pair(s): ${inserts.length} insert, ${updates.length} update`
  );

  for (let index = 0; index < plan.accepted.length; index += BATCH_SIZE) {
    const batch = plan.accepted
      .slice(index, index + BATCH_SIZE)
      .map((entry) => entry.row);
    const { error } = await supabase
      .from("drug_interactions")
      .upsert(batch, { onConflict: "herb_id,drug_name" });
    if (error) {
      console.error(
        `Apply failed at row ${index}: ${error.message}. ` +
          "Earlier batches are already written; re-run after fixing the error."
      );
      return 1;
    }
  }

  console.log(`Applied ${plan.accepted.length} row(s).`);
  return 0;
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(entry) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  runCli()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(
        `import: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exitCode = 2;
    });
}
