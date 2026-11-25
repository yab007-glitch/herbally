import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/00103_privacy_minimization_controls.sql"
);

describe("00103_privacy_minimization_controls.sql", () => {
  it("adds explicit opt-in consent ledger including dosage_history, updated_at trigger, index, and matched BEGIN/COMMIT", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf8");

    expect(sql).toMatch(/^\s*BEGIN\s*;/im);
    expect(sql).toMatch(/^\s*COMMIT\s*;/im);
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS\s+public\.user_privacy_consents/i
    );
    expect(sql).toMatch(/dosage_history/i);
    expect(sql).toMatch(/consent_scope/i);
    expect(sql).toMatch(/granted\s+BOOLEAN/i);
    expect(sql).toMatch(/consent_version/i);
    expect(sql).toMatch(/retention_expires_at/i);
    expect(sql).toMatch(/trg_user_privacy_consents_updated_at/i);
    expect(sql).toMatch(/idx_user_privacy_consents_user_scope_granted/i);
  });
});
