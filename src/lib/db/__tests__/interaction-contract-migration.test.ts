import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/00101_interaction_publication_contract.sql"
);

describe("00101_interaction_publication_contract.sql", () => {
  it("defines normalized drug entities/aliases, publication/retraction gates, security-definer revision audit, and matched BEGIN/COMMIT", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf8");

    expect(sql).toMatch(/^\s*BEGIN\s*;/im);
    expect(sql).toMatch(/^\s*COMMIT\s*;/im);

    // Reconciles evidence_note drift & drops 'mild' default
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS\s+evidence_note\s+TEXT/i);
    expect(sql).toMatch(/ALTER COLUMN\s+severity\s+DROP DEFAULT/i);

    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS\s+public\.drug_entities/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS\s+public\.drug_aliases/i);
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS\s+public\.drug_interaction_citations/i
    );
    expect(sql).toMatch(
      /CREATE TABLE IF NOT EXISTS\s+public\.drug_interaction_revisions/i
    );

    // Does not cascade-delete revision history
    expect(sql).toMatch(/ON DELETE SET NULL/i);
    expect(sql).toMatch(/interaction_record_id/i);
    expect(sql).toMatch(/changed_fields/i);

    // Security definer + pinned search_path + revoked execute on trigger functions
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path = public,\s*pg_temp/i);

    // DB-level publication gate & citation retraction hold triggers + unique published index
    expect(sql).toMatch(/reviewer_registry/i);
    expect(sql).toMatch(/drug_interactions_clinical_reviewer_id_fkey/i);
    expect(sql).toMatch(/licence_number_verified/i);
    expect(sql).toMatch(/licence_expires_at/i);
    expect(sql).toMatch(/consent_recorded/i);
    expect(sql).toMatch(/interaction_record_id\s+SET\s+NOT\s+NULL/i);
    expect(sql).toMatch(/trg_drug_interaction_publication_gate/i);
    expect(sql).toMatch(/trg_drug_interaction_citations_gate/i);
    expect(sql).toMatch(/idx_drug_interactions_published_canonical/i);
    expect(sql).toMatch(
      /AFTER INSERT OR UPDATE OR DELETE ON\s+public\.drug_interactions/i
    );

    // Must not insert clinical interaction rows
    expect(sql).not.toMatch(/INSERT INTO\s+public\.drug_interactions/i);
  });

  it("00102 tags bulk 00079 editorial provenance rows without triggering clinical review reset", () => {
    const sql102 = fs.readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/00102_scientific_governance_and_incidents.sql"
      ),
      "utf8"
    );
    expect(sql102).toMatch(/bulk_editorial_import/i);
    expect(sql102).toMatch(/2026-11-18/);
    expect(sql102).toMatch(/Yasser Bheekun/);
  });
});
