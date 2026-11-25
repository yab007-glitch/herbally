import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATION_00079_PATH = path.resolve(
  process.cwd(),
  "supabase/migrations/00079_audit_upgrades_and_interactions.sql"
);
const ENUM_PATH = path.resolve(
  process.cwd(),
  "supabase/migrations/00099b_formula_type_adult_reference_enum.sql"
);
const MIGRATION_PATH = path.resolve(
  process.cwd(),
  "supabase/migrations/00100_pediatric_containment_dosage_calculations.sql"
);
const CONTRACT_PATH = path.resolve(
  process.cwd(),
  "supabase/migrations/00104_pediatric_boundary_contract.sql"
);
const ROLLBACK_PATH = path.resolve(
  process.cwd(),
  "scripts/rollback-00104-contract.sql"
);
const CI_YML_PATH = path.resolve(process.cwd(), ".github/workflows/ci.yml");

describe("00079 / 00099b / 00100 / 00104 expand-contract pediatric containment migrations", () => {
  it("reconciles drug_interactions.evidence_note idempotently before 00079 inserts it and keeps full replay required in CI", () => {
    const sql79 = fs.readFileSync(MIGRATION_00079_PATH, "utf-8");
    const alterIdx = sql79.search(
      /ALTER\s+TABLE\s+public\.drug_interactions\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+evidence_note\s+TEXT/i
    );
    const insertIdx = sql79.search(
      /INSERT\s+INTO\s+public\.drug_interactions/i
    );
    expect(alterIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(alterIdx);

    const ciYml = fs.readFileSync(CI_YML_PATH, "utf-8");
    const replayBlock =
      ciYml.split("full-migration-replay:")[1]?.split("verify-db:")[0] ?? "";
    expect(replayBlock).not.toMatch(/continue-on-error\s*:\s*true/i);
    expect(ciYml).toMatch(/needs:\s*\[[\s\S]*full-migration-replay[\s\S]*\]/);
    expect(ciYml).toMatch(
      /needs:\s*\[[\s\S]*postgrest-and-migrated-e2e[\s\S]*\]/
    );

    const replaySh = fs.readFileSync(
      path.resolve(process.cwd(), "scripts/test-full-migration-replay.sh"),
      "utf-8"
    );
    expect(replaySh).toMatch(/FROM public\.herbs LIMIT 1/i);
    expect(replaySh).toMatch(/FROM public\.herb_faqs LIMIT 1/i);
    expect(replaySh).toMatch(/FROM public\.herb_monographs LIMIT 1/i);
    expect(replaySh).toMatch(/FROM public\.herb_regulatory_evidence LIMIT 1/i);
    expect(replaySh).toMatch(/FROM public\.herb_monograph_sources LIMIT 1/i);
    expect(replaySh).toMatch(/FROM public\.herb_pubmed_monographs LIMIT 1/i);
    expect(replaySh).toMatch(/needs_re_review/i);
    expect(replaySh).toMatch(/clinical_content_revisions/i);
    expect(replaySh).toMatch(/safety_incident_audit_log/i);
  });

  it("runs formula_type ADD VALUE outside BEGIN/COMMIT in 00099b and keeps 00100 pure transactional", () => {
    expect(fs.existsSync(ENUM_PATH)).toBe(true);
    const enumSql = fs.readFileSync(ENUM_PATH, "utf-8");
    expect(enumSql).toMatch(
      /ALTER TYPE\s+public\.formula_type\s+ADD VALUE IF NOT EXISTS\s+'adult_reference'/i
    );
    expect(enumSql).not.toMatch(/^\s*BEGIN\s*;/im);

    expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");
    expect(sql).toMatch(/^\s*BEGIN\s*;/im);
    expect(sql).toMatch(/^\s*COMMIT\s*;/im);
    expect(sql).not.toMatch(/ALTER TYPE\s+public\.formula_type\s+ADD VALUE/i);

    // PostgreSQL 16 ARE forbids regex lookbehind (?<= / (?<!
    const sqlNoComments = sql
      .replace(/--[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(sqlNoComments).not.toMatch(/\(\?<[=!]/);
  });

  it("keeps old-image reads AND writes compatible during 00100 expand while creating sanitized public views/RPCs", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf-8");

    // Expand phase MUST NOT break running old-image calculator writes before contract
    expect(sql).not.toMatch(
      /DROP POLICY IF EXISTS\s+"Anonymous can insert calculations"\s+ON\s+public\.dosage_calculations/i
    );
    expect(sql).not.toMatch(
      /REVOKE\s+INSERT\s+ON\s+public\.dosage_calculations\s+FROM\s+anon/i
    );
    expect(sql).not.toMatch(
      /ADD CONSTRAINT\s+dosage_calculations_adult_only_check/i
    );
    expect(sql).not.toMatch(
      /CREATE TRIGGER\s+trg_dosage_calculations_adult_only/i
    );
    expect(sql).not.toMatch(/DELETE\s+FROM\s+public\.dosage_calculations/i);
    expect(sql).toMatch(/is_legacy_pediatric_quarantined/i);

    // 00100 expand keeps raw table SELECT readable for rolling deploy while exposing sanitized views
    expect(sql).not.toMatch(
      /REVOKE\s+SELECT\s+ON\s+public\.herbs\s+FROM\s+anon,\s*authenticated/i
    );
    for (const viewName of [
      "herbs_public",
      "herb_faqs_public",
      "herb_monographs_public",
      "herb_regulatory_evidence_public",
      "herb_monograph_sources_public",
      "herb_pubmed_monographs_public",
    ]) {
      expect(sql).toMatch(
        new RegExp(`CREATE OR REPLACE VIEW\\s+public\\.${viewName}`, "i")
      );
    }

    expect(sql).toMatch(/sentence_has_ped_ctx/i);
    expect(sql).toMatch(/has_affirmative_prescriptive_ped_dose/i);
    expect(sql).toMatch(/redact_text_array\(/i);
    expect(sql).toMatch(/redact_text_array_jsonb\(s\.claims\)/i);
    expect(sql).toMatch(/redact_text_array_jsonb\(s\.safety\)/i);
    expect(sql).toMatch(/redact_text_array_jsonb\(r\.purposes\)/i);
    expect(sql).toMatch(/redact_text_array_jsonb\(r\.risks\)/i);
    expect(sql).toMatch(/redact_herb_faqs_jsonb/i);
    expect(sql).toMatch(/redact_text_array_jsonb\(m\.drug_interactions\)/i);
    expect(sql).toMatch(/sanitize_faq_question_text\(f\.question\)/i);
    expect(sql).toMatch(/v_ans\s*=\s*''\s*AND\s*v_fr_ans\s*=\s*''/i);
    expect(sql).toMatch(
      /COALESCE\(public\.strip_pediatric_dosage_text\(f\.translations->'fr'->>'answer'\),\s*''\)\s*<>\s*''/i
    );
    expect(sql).toMatch(/should\\s\+not/i);
    expect(sql).toMatch(/must\\s\+not/i);
    expect(sql).toMatch(/not\\s\+for\\s\+use/i);
    expect(sql).toMatch(/not\\s\+suitable/i);
    expect(sql).toMatch(/v_fr \? 'question'/i);
    expect(sql).toMatch(/redact_pubmed_sheet_object_jsonb/i);
    expect(sql).toMatch(/v_norm_k\s*:=\s*lower/i);
    expect(sql).toMatch(
      /pediatrics\?\|paediatrics\?\|p\[eé\]diatriques\?\|paed\|child\(ren\|hood\)\?\|infants\?\|minors\?\|enfants\?\|nourrissons\?/i
    );
    expect(sql).toMatch(
      /doses\?\|dosages\?\|dosing\|uses\?\|usage\|administration\|posolog\(y\|ie\)\?/i
    );
    expect(sql).toContain("'Safety information'");
    expect(sql).toContain("'Information de sécurité'");
    expect(sql).toMatch(/up\\s\+to\\s\+\(\?:age\\s\+\)\?18/i);
    expect(sql).toMatch(/and\\s\+under\|or\\s\+\(\?:younger\|under\)/i);
    expect(sql).toMatch(/≤\)\\s\*18/i);
    expect(sql).toMatch(
      /JOIN\s+public\.herbs\s+h\s+ON\s+h\.id\s*=\s*m\.herb_id/i
    );
    expect(sql).toMatch(
      /JOIN\s+public\.herbs\s+h\s+ON\s+h\.slug\s*=\s*r\.herb_slug/i
    );
    expect(sql).toMatch(
      /JOIN\s+public\.herbs\s+h\s+ON\s+h\.slug\s*=\s*s\.herb_slug/i
    );
    expect(sql).toMatch(
      /JOIN\s+public\.herbs\s+h\s+ON\s+h\.slug\s*=\s*p\.slug/i
    );
    expect(sql).toMatch(
      /COALESCE\(p\.status,\s*'compiled'\)\s+IN\s*\('compiled',\s*'reviewed'\)/i
    );
    expect(sql).not.toMatch(/has_adult\s*:=\s*part\s*~.*18\\s\+years/i);
    expect(sql).not.toMatch(/18\\\+\\y/);
    expect(sql).toMatch(/redact_herb_monograph_jsonb/i);
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION\s+public\.redact_herb_page_bundle/i
    );
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION\s+public\.search_herbs_by_symptom/i
    );
    expect(sql).not.toMatch(/DROP COLUMN\s+.*dosage_child/i);
  });

  it("closes raw prose/dose/source privileges AND enforces adult-only dosage_calculations in 00104 contract with full rollback", () => {
    expect(fs.existsSync(CONTRACT_PATH)).toBe(true);
    const contractSql = fs.readFileSync(CONTRACT_PATH, "utf-8");

    expect(contractSql).toMatch(
      /DROP POLICY IF EXISTS\s+"Anonymous can insert calculations"\s+ON\s+public\.dosage_calculations/i
    );
    expect(contractSql).toMatch(
      /REVOKE\s+INSERT\s+ON\s+public\.dosage_calculations\s+FROM\s+anon/i
    );
    expect(contractSql).toMatch(/dosage_calculations_adult_only_check/i);
    expect(contractSql).toMatch(
      /VALIDATE CONSTRAINT\s+dosage_calculations_adult_only_check/i
    );
    expect(contractSql).toMatch(
      /CREATE TRIGGER\s+trg_dosage_calculations_adult_only/i
    );

    for (const tbl of [
      "herbs",
      "herb_faqs",
      "herb_monographs",
      "herb_regulatory_evidence",
      "herb_monograph_sources",
      "herb_pubmed_monographs",
    ]) {
      expect(contractSql).toMatch(
        new RegExp(
          `REVOKE\\s+(?:ALL|SELECT)\\s+ON\\s+(?:TABLE\\s+)?public\\.${tbl}\\s+FROM\\s+anon,\\s*authenticated`,
          "i"
        )
      );
    }
    expect(contractSql).toMatch(
      /GRANT\s+SELECT\s*\([^)]*id[^)]*slug[^)]*\)\s*ON\s+public\.herbs\s+TO\s+anon,\s*authenticated/i
    );

    const regGrant =
      contractSql.match(
        /GRANT\s+SELECT\s*\(([^)]+)\)\s*ON\s+public\.herb_regulatory_evidence\s+TO/i
      )?.[1] ?? "";
    expect(regGrant).not.toMatch(/\b(purposes|doses|risks)\b/i);

    const srcGrant =
      contractSql.match(
        /GRANT\s+SELECT\s*\(([^)]+)\)\s*ON\s+public\.herb_monograph_sources\s+TO/i
      )?.[1] ?? "";
    expect(srcGrant).not.toMatch(/\b(claims|safety|doses)\b/i);

    expect(fs.existsSync(ROLLBACK_PATH)).toBe(true);
    const rollbackSql = fs.readFileSync(ROLLBACK_PATH, "utf-8");
    expect(rollbackSql).toMatch(
      /GRANT\s+SELECT\s+ON\s+(?:TABLE\s+)?public\.herbs\s+TO\s+anon,\s*authenticated/i
    );
    expect(rollbackSql).toMatch(
      /DROP TRIGGER IF EXISTS\s+trg_dosage_calculations_adult_only\s+ON\s+public\.dosage_calculations/i
    );
    expect(rollbackSql).toMatch(
      /DROP CONSTRAINT IF EXISTS\s+dosage_calculations_adult_only_check/i
    );
    expect(rollbackSql).toMatch(
      /GRANT\s+INSERT\s+ON\s+(?:TABLE\s+)?public\.dosage_calculations\s+TO\s+anon/i
    );
  });

  it("confirms contraindications and side_effects in migrations contain warnings, not pediatric dosing instructions", () => {
    const migDir = path.resolve(process.cwd(), "supabase/migrations");
    const files = fs
      .readdirSync(migDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    const pedTermRe =
      /\b(child|children|infant|toddler|pediatric|paediatric|adolescent|teen|enfant|enfants|bébé|nourrisson|mineur|pédiatrique)\b/i;
    const doseRe =
      /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|drops?|gouttes?|capsules?|tablets?)\b/i;

    const violations: string[] = [];
    for (const f of files) {
      const txt = fs.readFileSync(path.join(migDir, f), "utf-8");
      const matches = txt.matchAll(
        /"(?:contraindications|side_effects)"\s*:\s*\[([^\]]+)\]/g
      );
      for (const m of matches) {
        const val = m[1] ?? "";
        if (pedTermRe.test(val) && doseRe.test(val)) {
          violations.push(`${f}: ${val.slice(0, 120)}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
