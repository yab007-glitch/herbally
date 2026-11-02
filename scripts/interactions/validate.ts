/**
 * Pure validation rules for herb↔drug interaction seed files, plus a CLI that
 * checks a seed directory against the published herb list and the existing
 * pairs (read-only, anonymous key only).
 *
 * Why the rules live in a pure function: the same checks drive the validator
 * CLI, the importer's planner, and unit tests. Nothing here reads the network,
 * the filesystem, or environment variables, so it is safe to import anywhere.
 */
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { drugSlug } from "../../src/lib/interactions/pair-url";
import { loadEnvLocal, loadSeedDir, type SeedPair } from "./seed";

/** Severity values accepted by public.interaction_severity. */
export const SEVERITIES = [
  "mild",
  "moderate",
  "severe",
  "contraindicated",
] as const;

/** Evidence levels allowed in curated interaction rows. */
export const EVIDENCE_LEVELS = [
  "well-documented",
  "moderate-evidence",
  "limited-evidence",
] as const;

/**
 * Hosts whose content may be cited. A host matches itself or any subdomain.
 * See docs/data-source-licences.md for the licence register behind each host.
 * Hosts on this list are not automatically usable: a source value and licence
 * must also pass the gate in validatePair.
 */
export const SOURCE_HOST_ALLOWLIST = [
  "ods.od.nih.gov",
  "nccih.nih.gov",
  "ncbi.nlm.nih.gov",
  "pubmed.ncbi.nlm.nih.gov",
  "livertox.nlm.nih.gov",
  "canada.ca",
  "ema.europa.eu",
  "who.int",
  "cochrane.org",
] as const;

/**
 * The only source names new seed data may declare. Each maps to the one host
 * its citation has to use (SOURCE_HOSTS). Older rows may carry other values
 * ("Natural Medicines Database", "Clinical Studies", "WHO Monographs"); those
 * are legacy data and are not precedents. docs/data-source-licences.md is the
 * register that justifies this list.
 */
export const SOURCE_VALUES = [
  "EMA HMPC",
  "NIH ODS",
  "NCCIH",
  "LiverTox",
] as const;

export type SourceValue = (typeof SOURCE_VALUES)[number];

/** Licence identifiers a seed pair may declare in `source_licence`. */
export const SOURCE_LICENCES = [
  "ema-legal-notice",
  "us-federal-public-domain",
  "canada-ogl",
  "who-cc-by-nc-sa",
  "cochrane-abstract-licence",
] as const;

export type SourceLicence = (typeof SOURCE_LICENCES)[number];

/** The host each allowed source must cite (itself or a subdomain). */
export const SOURCE_HOSTS: Readonly<Record<SourceValue, string>> = {
  "EMA HMPC": "ema.europa.eu",
  "NIH ODS": "ods.od.nih.gov",
  NCCIH: "nccih.nih.gov",
  LiverTox: "livertox.nlm.nih.gov",
};

/**
 * Licence of every host on the technical allowlist. Typed against the
 * allowlist, so adding a host without deciding its licence fails typecheck.
 */
export const HOST_LICENCES: Readonly<
  Record<(typeof SOURCE_HOST_ALLOWLIST)[number], SourceLicence>
> = {
  "ema.europa.eu": "ema-legal-notice",
  "ods.od.nih.gov": "us-federal-public-domain",
  "nccih.nih.gov": "us-federal-public-domain",
  "ncbi.nlm.nih.gov": "us-federal-public-domain",
  "pubmed.ncbi.nlm.nih.gov": "us-federal-public-domain",
  "livertox.nlm.nih.gov": "us-federal-public-domain",
  "canada.ca": "canada-ogl",
  "who.int": "who-cc-by-nc-sa",
  "cochrane.org": "cochrane-abstract-licence",
};

/**
 * Licences that forbid commercial use. HerbAlly carries advertising, so a row
 * under one of these may never be imported — no matter how good the source is.
 */
export const NON_COMMERCIAL_LICENCES = [
  "who-cc-by-nc-sa",
  "cochrane-abstract-licence",
] as const;

export const DRUG_NAME_MIN_LENGTH = 2;
export const DRUG_NAME_MAX_LENGTH = 80;
export const DESCRIPTION_MIN_LENGTH = 40;
export const MECHANISM_MIN_LENGTH = 20;

/** One code per rule, so CLI output and tests can assert exactly one reason. */
export type RejectionCode =
  | "HERB_SLUG_MISSING"
  | "HERB_NOT_PUBLISHED"
  | "DRUG_NAME_TOO_SHORT"
  | "DRUG_NAME_TOO_LONG"
  | "DRUG_NAME_MARKDOWN"
  | "SEVERITY_INVALID"
  | "DESCRIPTION_TOO_SHORT"
  | "MECHANISM_MISSING"
  | "MECHANISM_TOO_SHORT"
  | "EVIDENCE_LEVEL_INVALID"
  | "SOURCE_MISSING"
  | "SOURCE_NOT_ALLOWED"
  | "SOURCE_LICENCE_MISSING"
  | "SOURCE_LICENCE_INVALID"
  | "SOURCE_LICENCE_MISMATCH"
  | "LICENCE_NOT_COMMERCIAL_USE"
  | "SOURCE_URL_MISSING"
  | "SOURCE_URL_INVALID"
  | "SOURCE_URL_NOT_HTTPS"
  | "SOURCE_HOST_NOT_ALLOWED"
  | "DUPLICATE_PAIR"
  | "DRUG_SLUG_COLLISION";

export interface ExistingPair {
  drugName: string;
  drugSlug: string;
}

export interface ValidateContext {
  herbSlug: string;
  publishedHerbSlugs: ReadonlySet<string>;
  acceptedPairKeys: ReadonlySet<string>;
  existingPairs?: readonly ExistingPair[];
}

export type ValidationResult =
  | { ok: true; pairKey: string; drugSlug: string }
  | { ok: false; code: RejectionCode; message: string };

/** Characters that turn a drug name into rich text. Parentheses stay legal. */
const MARKDOWN_CHARACTERS = /[*_`[\]|#]/;
const MARKDOWN_LINK = /!?\[[^\]]*\]\([^)]*\)/;

function reject(code: RejectionCode, message: string): ValidationResult {
  return { ok: false, code, message };
}

/**
 * Canonical identity of a pair within one herb: herb slug + generic-name slug.
 * Two seed rows with this key are the same page and must not both import.
 */
export function pairKey(herbSlug: string, drugName: string): string {
  return `${herbSlug}/${drugSlug(drugName)}`;
}

function hostMatches(hostname: string, host: string): boolean {
  return hostname === host || hostname.endsWith(`.${host}`);
}

/**
 * The most specific allowlist entry a hostname falls under. Longest match
 * wins so `pubmed.ncbi.nlm.nih.gov` is itself, not `ncbi.nlm.nih.gov`.
 */
function allowlistHostFor(
  hostname: string
): (typeof SOURCE_HOST_ALLOWLIST)[number] | undefined {
  return [...SOURCE_HOST_ALLOWLIST]
    .filter((allowed) => hostMatches(hostname, allowed))
    .sort((left, right) => right.length - left.length)[0];
}

/**
 * Check one pair without mutating it or filling in defaults.
 *
 * The URL is intentionally required: a curated interaction must point at the
 * specific page it came from, never at a homepage or a search result.
 */
export function validatePair(
  pair: SeedPair,
  context: ValidateContext
): ValidationResult {
  const herbSlug = context.herbSlug.trim();
  if (herbSlug === "") {
    return reject("HERB_SLUG_MISSING", "herb_slug is required");
  }
  if (!context.publishedHerbSlugs.has(herbSlug)) {
    return reject(
      "HERB_NOT_PUBLISHED",
      `herb "${herbSlug}" is not published; publish it before adding pairs`
    );
  }

  const drugName = pair.drug_name.trim();
  if (drugName.length < DRUG_NAME_MIN_LENGTH) {
    return reject(
      "DRUG_NAME_TOO_SHORT",
      `drug_name must be at least ${DRUG_NAME_MIN_LENGTH} characters`
    );
  }
  if (drugName.length > DRUG_NAME_MAX_LENGTH) {
    return reject(
      "DRUG_NAME_TOO_LONG",
      `drug_name must be at most ${DRUG_NAME_MAX_LENGTH} characters`
    );
  }
  if (
    MARKDOWN_CHARACTERS.test(drugName) ||
    MARKDOWN_LINK.test(drugName) ||
    // A link pattern always contains brackets, but keep the explicit check so
    // the rule reads the same as the policy even if the character set changes.
    /\[[^\]]*\]\([^)]*\)/.test(drugName)
  ) {
    return reject(
      "DRUG_NAME_MARKDOWN",
      "drug_name must be plain text (no *, _, `, [ ], |, #, or markdown links)"
    );
  }

  if (!(SEVERITIES as readonly string[]).includes(pair.severity)) {
    return reject(
      "SEVERITY_INVALID",
      `severity must be one of: ${SEVERITIES.join(", ")}`
    );
  }

  const description = pair.description.trim();
  if (description.length < DESCRIPTION_MIN_LENGTH) {
    return reject(
      "DESCRIPTION_TOO_SHORT",
      `description must be at least ${DESCRIPTION_MIN_LENGTH} characters`
    );
  }

  const mechanism = pair.mechanism.trim();
  if (mechanism === "") {
    return reject("MECHANISM_MISSING", "mechanism is required");
  }
  if (mechanism.length < MECHANISM_MIN_LENGTH) {
    return reject(
      "MECHANISM_TOO_SHORT",
      `mechanism must be at least ${MECHANISM_MIN_LENGTH} characters`
    );
  }

  if (!(EVIDENCE_LEVELS as readonly string[]).includes(pair.evidence_level)) {
    return reject(
      "EVIDENCE_LEVEL_INVALID",
      `evidence_level must be one of: ${EVIDENCE_LEVELS.join(", ")}`
    );
  }

  const source = pair.source.trim();
  if (source === "") {
    return reject("SOURCE_MISSING", "source is required");
  }
  if (!(SOURCE_VALUES as readonly string[]).includes(source)) {
    return reject(
      "SOURCE_NOT_ALLOWED",
      `source "${source}" is not allowed; use one of: ${SOURCE_VALUES.join(", ")} (docs/data-source-licences.md)`
    );
  }
  const declaredSource = source as SourceValue;

  // The licence gate runs before the pair can be accepted. A licence is never
  // inferred from the host: the seed has to declare it, so the reviewer and the
  // register agree on why the row may exist.
  const declaredLicence = (pair.source_licence ?? "").trim();
  if (declaredLicence === "") {
    return reject(
      "SOURCE_LICENCE_MISSING",
      "source_licence is required; record the source's licence (docs/data-source-licences.md)"
    );
  }
  if (!(SOURCE_LICENCES as readonly string[]).includes(declaredLicence)) {
    return reject(
      "SOURCE_LICENCE_INVALID",
      `source_licence "${declaredLicence}" is not one of: ${SOURCE_LICENCES.join(", ")}`
    );
  }
  if (
    (NON_COMMERCIAL_LICENCES as readonly string[]).includes(declaredLicence)
  ) {
    return reject(
      "LICENCE_NOT_COMMERCIAL_USE",
      `source_licence "${declaredLicence}" permits non-commercial use only; HerbAlly carries advertising, so this content can never be imported`
    );
  }

  // Source URLs are never defaulted: a missing citation is a rejection, not a
  // row that quietly ships without provenance.
  if (typeof pair.source_url !== "string" || pair.source_url.trim() === "") {
    return reject(
      "SOURCE_URL_MISSING",
      "source_url is required; cite the specific page the pair came from"
    );
  }
  const sourceUrl = pair.source_url.trim();

  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    return reject(
      "SOURCE_URL_INVALID",
      "source_url must be an absolute URL with an https scheme"
    );
  }

  if (parsed.protocol !== "https:") {
    return reject("SOURCE_URL_NOT_HTTPS", "source_url must use https://");
  }
  if (parsed.username !== "" || parsed.password !== "") {
    return reject(
      "SOURCE_URL_INVALID",
      "source_url must not carry a username or password"
    );
  }
  if (parsed.port !== "") {
    return reject(
      "SOURCE_URL_INVALID",
      "source_url must not specify a non-default port"
    );
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  const allowlistedHost = allowlistHostFor(hostname);
  if (!allowlistedHost) {
    return reject(
      "SOURCE_HOST_NOT_ALLOWED",
      `source_url host "${hostname}" is not on the allowlist (docs/data-source-licences.md)`
    );
  }

  // Both halves of provenance must agree with the host: the source value decides
  // which host may be cited, and the declared licence must be that host's
  // licence. Either disagreement is a mismatch, never a warning.
  const requiredHost = SOURCE_HOSTS[declaredSource];
  if (!hostMatches(hostname, requiredHost)) {
    return reject(
      "SOURCE_LICENCE_MISMATCH",
      `source "${declaredSource}" must cite ${requiredHost}, but source_url is on ${hostname}`
    );
  }
  const hostLicence = HOST_LICENCES[allowlistedHost];
  if (declaredLicence !== hostLicence) {
    return reject(
      "SOURCE_LICENCE_MISMATCH",
      `source_licence "${declaredLicence}" does not match "${hostLicence}" for host ${hostname}`
    );
  }

  const key = pairKey(herbSlug, drugName);
  if (context.acceptedPairKeys.has(key)) {
    return reject("DUPLICATE_PAIR", `pair ${key} already appears in this seed`);
  }

  const collision = (context.existingPairs ?? []).find(
    (existing) =>
      existing.drugSlug === drugSlug(drugName) && existing.drugName !== drugName
  );
  if (collision) {
    return reject(
      "DRUG_SLUG_COLLISION",
      `drug ${drugName} maps to slug "${drugSlug(drugName)}", already used by ${collision.drugName}`
    );
  }

  return { ok: true, pairKey: key, drugSlug: drugSlug(drugName) };
}

// ─── CLI ────────────────────────────────────────────────────────────

interface CliOptions {
  dir: string;
  json: boolean;
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
  existingByHerb: Map<string, ExistingPair[]>;
}

/**
 * Supabase caps a single response at 1,000 rows regardless of `.limit()`, so
 * the snapshot has to page. Without paging, a large herb catalogue silently
 * hides published slugs and the validator reports a false HERB_NOT_PUBLISHED.
 */
const SNAPSHOT_PAGE_SIZE = 1000;

function parseArgs(argv: readonly string[]): CliOptions {
  let dir = "data/interactions";
  let json = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dir") {
      dir = argv[index + 1] ?? dir;
      index += 1;
    } else if (arg.startsWith("--dir=")) {
      dir = arg.slice("--dir=".length);
    } else if (arg === "--json") {
      json = true;
    }
  }

  return { dir, json };
}

function isDirectory(target: string): boolean {
  return existsSync(target) && statSync(target).isDirectory();
}

/**
 * Read published herb slugs and existing pair identities with the anonymous
 * client. Read-only by construction — this script never loads a service key.
 */
async function loadSnapshot(
  supabase: SupabaseClient
): Promise<Snapshot | null> {
  const herbRows: HerbRow[] = [];
  for (let from = 0; ; from += SNAPSHOT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("herbs")
      .select("id,slug,is_published")
      .order("id")
      .range(from, from + SNAPSHOT_PAGE_SIZE - 1);
    if (error) {
      console.error(`Failed to load herbs: ${error.message}`);
      return null;
    }
    const page = (data ?? []) as HerbRow[];
    herbRows.push(...page);
    if (page.length < SNAPSHOT_PAGE_SIZE) break;
  }

  const slugById = new Map<string, string>();
  const publishedHerbSlugs = new Set<string>();
  for (const row of herbRows) {
    slugById.set(row.id, row.slug);
    if (row.is_published) publishedHerbSlugs.add(row.slug);
  }

  const pairRows: PairRow[] = [];
  for (let from = 0; ; from += SNAPSHOT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("drug_interactions")
      .select("herb_id,drug_name")
      .order("id")
      .range(from, from + SNAPSHOT_PAGE_SIZE - 1);
    if (error) {
      console.error(`Failed to load existing pairs: ${error.message}`);
      return null;
    }
    const page = (data ?? []) as PairRow[];
    pairRows.push(...page);
    if (page.length < SNAPSHOT_PAGE_SIZE) break;
  }

  const existingByHerb = new Map<string, ExistingPair[]>();
  for (const row of pairRows) {
    const herbSlug = slugById.get(row.herb_id);
    if (!herbSlug) continue;
    const list = existingByHerb.get(herbSlug) ?? [];
    list.push({ drugName: row.drug_name, drugSlug: drugSlug(row.drug_name) });
    existingByHerb.set(herbSlug, list);
  }

  return { publishedHerbSlugs, existingByHerb };
}

async function runCli(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  loadEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
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

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const snapshot = await loadSnapshot(supabase);
  if (!snapshot) return 2;

  const entries = loadSeedDir(options.dir);
  const acceptedPairKeys = new Set<string>();
  const sourceCounts = new Map<string, number>();
  const licenceCounts = new Map<string, number>();
  const results: Array<{
    file: string;
    herbSlug: string;
    drugName: string;
    ok: boolean;
    pairKey?: string;
    source?: string;
    sourceLicence?: string;
    code?: RejectionCode;
    message?: string;
  }> = [];

  let accepted = 0;
  let rejected = 0;
  let fileErrors = 0;
  let pairCount = 0;

  for (const entry of entries) {
    if (entry.parseError) {
      fileErrors += 1;
      if (!options.json) {
        console.error(`FILE ERROR ${entry.path}: ${entry.parseError}`);
      }
      results.push({
        file: entry.path,
        herbSlug: entry.herbSlug,
        drugName: "",
        ok: false,
        code: undefined,
        message: entry.parseError,
      });
      continue;
    }

    const herbSlug = entry.herbSlug;
    for (const pair of entry.pairs) {
      pairCount += 1;
      const result = validatePair(pair, {
        herbSlug,
        publishedHerbSlugs: snapshot.publishedHerbSlugs,
        acceptedPairKeys,
        existingPairs: snapshot.existingByHerb.get(herbSlug) ?? [],
      });

      if (result.ok) {
        accepted += 1;
        acceptedPairKeys.add(result.pairKey);
        const source = pair.source.trim();
        const sourceLicence = pair.source_licence.trim();
        sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
        licenceCounts.set(
          sourceLicence,
          (licenceCounts.get(sourceLicence) ?? 0) + 1
        );
        results.push({
          file: entry.path,
          herbSlug,
          drugName: pair.drug_name.trim(),
          ok: true,
          pairKey: result.pairKey,
          source,
          sourceLicence,
        });
        if (!options.json) {
          console.log(
            `ACCEPT ${result.pairKey} [${source} / ${sourceLicence}]`
          );
        }
      } else {
        rejected += 1;
        results.push({
          file: entry.path,
          herbSlug,
          drugName: pair.drug_name.trim(),
          ok: false,
          code: result.code,
          message: result.message,
        });
        if (!options.json) {
          console.log(
            `REJECT ${result.code} ${herbSlug}/${drugSlug(pair.drug_name)} with ${result.message}`
          );
        }
      }
    }
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          files: entries.length,
          pairs: pairCount,
          accepted,
          rejected,
          fileErrors,
          results,
        },
        null,
        2
      )
    );
  } else {
    console.log(`files: ${entries.length}`);
    console.log(`accepted: ${accepted}`);
    console.log(`rejected: ${rejected}`);
    console.log(`file errors: ${fileErrors}`);
    console.log("accepted by source:");
    for (const [source, count] of [...sourceCounts].sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      console.log(`  ${source}: ${count}`);
    }
    console.log("accepted by licence:");
    for (const [licence, count] of [...licenceCounts].sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      console.log(`  ${licence}: ${count}`);
    }
  }

  return rejected > 0 || fileErrors > 0 ? 1 : 0;
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
        `validate: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exitCode = 2;
    });
}
