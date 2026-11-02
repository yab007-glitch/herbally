/**
 * Seed-file loading for herb↔drug interaction imports.
 *
 * The seed files are the reviewable source of truth: a human writes one JSON
 * file per herb, a validator checks every pair, and only then does the importer
 * touch the database. Keeping loading here means the validate and import CLIs
 * see exactly the same data, and a malformed file is an error entry rather than
 * a crash that hides the rest of the directory.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** One pair as authored in a seed JSON file. Values are strings on purpose. */
export interface SeedPair {
  drug_name: string;
  severity: string;
  description: string;
  mechanism: string;
  evidence_level: string;
  source: string;
  /**
   * Why this row may exist: the licence the source publishes its content
   * under. Required, and checked against the source host by the validator.
   * A seed that omits it is carried through as an empty string so the
   * rejection is reported per pair (SOURCE_LICENCE_MISSING) rather than
   * failing the whole file with a type error.
   */
  source_licence: string;
  /**
   * Required by the validator, but typed optional here so a missing URL is
   * reported as SOURCE_URL_MISSING against the pair instead of vanishing in
   * a file-level type error.
   */
  source_url?: string;
}

/** Top-level shape of `data/interactions/<herb>.json`. */
export interface SeedFile {
  herb_slug: string;
  pairs: SeedPair[];
}

/** One file's contribution to a run; `parseError` marks an unusable file. */
export interface SeedFileEntry {
  path: string;
  herbSlug: string;
  pairs: SeedPair[];
  parseError?: string;
}

/**
 * Environment variables this toolchain is allowed to load. Everything else in
 * `.env.local` — notably a service-role key — is deliberately ignored so the
 * read-only tools can never pick it up by accident.
 */
const ALLOWED_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

type AllowedEnvKey = (typeof ALLOWED_ENV_KEYS)[number];

export const DEFAULT_ENV_PATHS = [
  ".env.local",
  "/Users/yasser/herbally/.env.local",
] as const;

function isAllowedEnvKey(key: string): key is AllowedEnvKey {
  return (ALLOWED_ENV_KEYS as readonly string[]).includes(key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  where: string
): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`${where}: "${key}" must be a string`);
  }
  return value;
}

/**
 * Narrow one unknown pair to SeedPair. Unknown keys are ignored so seeds can
 * carry review notes without breaking the import.
 */
function parsePair(value: unknown, where: string): SeedPair {
  if (!isRecord(value)) {
    throw new Error(`${where}: pair must be an object`);
  }
  const pair: SeedPair = {
    drug_name: requireString(value, "drug_name", where),
    severity: requireString(value, "severity", where),
    description: requireString(value, "description", where),
    mechanism: requireString(value, "mechanism", where),
    evidence_level: requireString(value, "evidence_level", where),
    source: requireString(value, "source", where),
    // An absent field becomes "" so validatePair can reject it with
    // SOURCE_LICENCE_MISSING instead of the file dying at parse time; a
    // present but non-string value is still a malformed seed.
    source_licence:
      value.source_licence === undefined
        ? ""
        : requireString(value, "source_licence", where),
  };
  if (value.source_url !== undefined) {
    pair.source_url = requireString(value, "source_url", where);
  }
  return pair;
}

function parseSeedFile(value: unknown, filePath: string): SeedFile {
  if (!isRecord(value)) {
    throw new Error(`${filePath}: seed file must be a JSON object`);
  }
  if (typeof value.herb_slug !== "string") {
    throw new Error(`${filePath}: "herb_slug" must be a string`);
  }
  if (!Array.isArray(value.pairs)) {
    throw new Error(`${filePath}: "pairs" must be an array`);
  }
  return {
    herb_slug: value.herb_slug.trim(),
    pairs: value.pairs.map((pair, index) =>
      parsePair(pair, `${filePath} pairs[${index}]`)
    ),
  };
}

/**
 * Read every `.json` file in `dir`, sorted by filename for deterministic
 * output. A broken file becomes an entry with `parseError` instead of killing
 * the whole run, so one typo cannot hide every other seed file.
 */
export function loadSeedDir(dir: string): SeedFileEntry[] {
  const names = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  return names.map((name) => {
    const filePath = path.join(dir, name);
    try {
      const raw = readFileSync(filePath, "utf8");
      const seed = parseSeedFile(JSON.parse(raw), filePath);
      return {
        path: filePath,
        herbSlug: seed.herb_slug,
        pairs: seed.pairs,
      };
    } catch (error) {
      return {
        path: filePath,
        herbSlug: "",
        pairs: [],
        parseError: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

/**
 * Tiny `.env.local` reader for the CLI scripts.
 *
 * Why not dotenv? The project needs a loader that is provably incapable of
 * loading a service-role key into a read-only validation process. Only the two
 * public Supabase variables are copied, existing process values win, and no
 * value is ever printed.
 *
 * Returns the path that supplied values, or null when no candidate exists.
 */
export function loadEnvLocal(
  paths: readonly string[] = DEFAULT_ENV_PATHS
): string | null {
  for (const candidate of paths) {
    if (!existsSync(candidate)) continue;

    let content: string;
    try {
      content = readFileSync(candidate, "utf8");
    } catch {
      continue;
    }

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const withoutExport = line.startsWith("export ")
        ? line.slice("export ".length).trim()
        : line;
      const separator = withoutExport.indexOf("=");
      if (separator <= 0) continue;

      const key = withoutExport.slice(0, separator).trim();
      if (!isAllowedEnvKey(key)) continue;
      // Already-set process values are authoritative.
      if (Object.hasOwn(process.env, key)) continue;

      let value = withoutExport.slice(separator + 1).trim();
      const quoted =
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"));
      if (quoted && value.length >= 2) value = value.slice(1, -1);

      process.env[key] = value;
    }

    return candidate;
  }

  return null;
}
