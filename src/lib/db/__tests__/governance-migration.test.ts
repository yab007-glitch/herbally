import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIGRATION_PATH = path.join(
  process.cwd(),
  "supabase/migrations/00102_scientific_governance_and_incidents.sql"
);

describe("00102_scientific_governance_and_incidents.sql", () => {
  it("uses last_reviewed (not reviewed_at), SECURITY DEFINER triggers, verified/licensed reviewer policy, atomic incident RPC, and matched BEGIN/COMMIT", () => {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf8");

    expect(sql).toMatch(/^\s*BEGIN\s*;/im);
    expect(sql).toMatch(/^\s*COMMIT\s*;/im);

    // Must reference herbs.last_reviewed and NEVER nonexistent reviewed_at
    expect(sql).toMatch(/last_reviewed/i);
    expect(sql).not.toMatch(/\breviewed_at\b/i);

    // Security definer + pinned search_path
    expect(sql).toMatch(/SECURITY DEFINER/i);
    expect(sql).toMatch(/SET search_path = public,\s*pg_temp/i);

    // Reviewer licence/verified gates and claim_citations source_licence + role validation
    expect(sql).toMatch(/licence_number_verified/i);
    expect(sql).toMatch(/source_licence/i);
    expect(sql).toMatch(/trg_claim_citations_reviewer_role/i);
    expect(sql).toMatch(
      /REVOKE SELECT ON\s+public\.claim_citations\s+FROM\s+anon,\s*authenticated/i
    );

    // Comprehensive herb revision auditing (INSERT/UPDATE/DELETE) & review reset
    expect(sql).toMatch(/CREATE TRIGGER\s+trg_reset_clinical_review_on_edit/i);
    expect(sql).toMatch(/AFTER INSERT OR UPDATE OR DELETE ON\s+public\.herbs/i);
    expect(sql).toMatch(/needs_re_review/i);

    // Atomic safety incident + audit RPC and exact parameter parity with API route & PostgREST smoke
    const fnMatch = sql.match(
      /CREATE OR REPLACE FUNCTION\s+public\.create_safety_incident_with_audit\s*\(([\s\S]*?)\)\s*RETURNS\s+UUID/i
    );
    expect(fnMatch).not.toBeNull();
    const sqlParamNames = (fnMatch?.[1] ?? "")
      .split(",")
      .map((line) => line.trim().split(/\s+/)[0])
      .filter(Boolean);
    expect(sqlParamNames).toEqual([
      "p_category",
      "p_severity",
      "p_surface_url",
      "p_summary",
      "p_details",
      "p_triage_status",
      "p_sla_due_at",
      "p_actor",
    ]);

    const routeSrc = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/safety-incidents/route.ts"),
      "utf8"
    );
    expect(routeSrc).not.toMatch(/p_note\s*:/);
    const routeRpcMatch = routeSrc.match(
      /rpcClient\.rpc\(\s*"create_safety_incident_with_audit"\s*,\s*\{([\s\S]*?)\}\s*\)/
    );
    expect(routeRpcMatch).not.toBeNull();
    const routeParamNames = Array.from(
      (routeRpcMatch?.[1] ?? "").matchAll(/\b(p_[a-z_]+)\s*:/g),
      (m) => m[1]
    );
    expect(routeParamNames).toEqual(sqlParamNames);

    const smokeSrc = fs.readFileSync(
      path.join(process.cwd(), "scripts/test-postgrest-smoke.sh"),
      "utf8"
    );
    const smokePayloads = Array.from(
      smokeSrc.matchAll(
        /-d\s*'(\{"p_category"[^']+\})'\s*\\\s*"\$\{POSTGREST_URL\}\/rpc\/create_safety_incident_with_audit"/g
      ),
      (m) => JSON.parse(m[1]) as Record<string, unknown>
    );
    expect(smokePayloads.length).toBeGreaterThanOrEqual(2);
    for (const payload of smokePayloads) {
      expect(Object.keys(payload)).toEqual(sqlParamNames);
    }

    // Must not fabricate reviewer consent or board members
    expect(sql).not.toMatch(/INSERT INTO\s+public\.herbs/i);
    expect(sql).not.toMatch(/INSERT INTO\s+public\.drug_interactions/i);
  });
});
