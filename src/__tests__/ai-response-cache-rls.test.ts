import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The AI response cache is keyed by a hash of the full prompt and contains
 * shared medical answers. It must not be readable with the public anon key:
 * the policy XML/Anon key ships in the browser. The server reads and writes it
 * with the service role only.
 *
 * This guards the migration that closes the public SELECT policy (without
 * deleting the cached rows) and revokes the table grants as defense in depth.
 */
const MIGRATION = path.join(
  process.cwd(),
  "supabase/migrations/00064_revoke_public_ai_response_cache_read.sql"
);

describe("ai_response_cache public-read lockdown migration", () => {
  it("exists", () => {
    expect(existsSync(MIGRATION)).toBe(true);
  });

  it("drops the public SELECT policy without deleting cached data", () => {
    const sql = readFileSync(MIGRATION, "utf8");

    expect(sql).toMatch(
      /DROP\s+POLICY\s+IF\s+EXISTS\s+"ai_response_cache is publicly readable"\s+ON\s+public\.ai_response_cache\s*;/i
    );
    // The cache is valuable and regenerative; closing reads must not wipe it.
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDROP\s+TABLE\b/i);
  });

  it("revokes table privileges from PUBLIC, anon and authenticated", () => {
    const sql = readFileSync(MIGRATION, "utf8");

    const revokes = [...sql.matchAll(/REVOKE[\s\S]*?;/gi)].map((m) =>
      m[0].replace(/\s+/g, " ").toLowerCase()
    );

    expect(revokes).toContain(
      "revoke all privileges on table public.ai_response_cache from public, anon, authenticated;"
    );
  });

  it("explicitly grants server cache read and insert", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    expect(sql).toMatch(
      /GRANT\s+SELECT\s*,\s*INSERT\s+ON\s+TABLE\s+public\.ai_response_cache\s+TO\s+service_role\s*;/i
    );
  });

  it("does not recreate a public read policy", () => {
    const sql = readFileSync(MIGRATION, "utf8");
    expect(sql).not.toMatch(
      /CREATE\s+POLICY[\s\S]*?FOR\s+SELECT[\s\S]*?USING\s*\(\s*true\s*\)/i
    );
  });
});
