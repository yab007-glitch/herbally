import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("00105 & 00106 governance/reconciliation migrations", () => {
  it("00105 enforces RLS, service-role isolation, no-PHI check, and balanced BEGIN/COMMIT", () => {
    const sql = fs.readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/00105_clinical_edit_requests.sql"
      ),
      "utf8"
    );
    expect(sql).toMatch(/^\s*BEGIN\s*;/im);
    expect(sql).toMatch(/^\s*COMMIT\s*;/im);
    expect(sql).toMatch(
      /ALTER TABLE public\.clinical_edit_requests ENABLE ROW LEVEL SECURITY/i
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.clinical_edit_request_events ENABLE ROW LEVEL SECURITY/i
    );
    expect(sql).toMatch(
      /REVOKE ALL ON public\.clinical_edit_requests FROM PUBLIC,\s*anon,\s*authenticated/i
    );
    expect(sql).toMatch(
      /no_phi_attested\s+BOOLEAN[^,\n]*CHECK\s*\(no_phi_attested\s*=\s*true\)/i
    );
    expect(sql).not.toMatch(/\(\?<[=!]/);
  });

  it("00106 reconciles Ginger + Warfarin evidence_note cleanly with PG16-safe regex and balanced BEGIN/COMMIT", () => {
    const sql = fs.readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/00106_interaction_evidence_note_reconciliation.sql"
      ),
      "utf8"
    );
    expect(sql).toMatch(/^\s*BEGIN\s*;/im);
    expect(sql).toMatch(/^\s*COMMIT\s*;/im);
    expect(sql).toMatch(/Jiang et al\. \(Br J Clin Pharmacol, 2005/i);
    expect(sql).toMatch(/COALESCE\(/i);
    expect(sql).toMatch(/'null'::jsonb/i);
    expect(sql).not.toMatch(/\(\?<[=!]/);
  });

  it("00107 relaxes optional clinician/rationale columns and adds community_user role safely", () => {
    const sql = fs.readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/00107_open_herb_edit_suggestions.sql"
      ),
      "utf8"
    );
    expect(sql).toMatch(/^\s*BEGIN\s*;/im);
    expect(sql).toMatch(/^\s*COMMIT\s*;/im);
    expect(sql).toMatch(/ALTER COLUMN credentials DROP NOT NULL/i);
    expect(sql).toMatch(/community_user/i);
    expect(sql).toMatch(/clinical_edit_requests_professional_role_check/i);
    expect(sql).not.toMatch(/\(\?<[=!]/);
  });

  it("00108 reconciles blanket perioperative stop orders and abrus-precatorius toxicity cleanly", () => {
    const sql = fs.readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/00108_perioperative_and_toxic_safety_reconciliation.sql"
      ),
      "utf8"
    );
    expect(sql).toMatch(/^\s*BEGIN\s*;/im);
    expect(sql).toMatch(/^\s*COMMIT\s*;/im);
    expect(sql).toMatch(/abrus-precatorius/i);
    expect(sql).toMatch(/Poisonous botanical \(contains lethal abrin\)/i);
    expect(sql).toMatch(/Perioperative note:/i);
    expect(sql).toMatch(/COALESCE\(/i);
    expect(sql).toMatch(/'null'::jsonb/i);
    expect(sql).not.toMatch(/\(\?<[=!]/);
  });
});
