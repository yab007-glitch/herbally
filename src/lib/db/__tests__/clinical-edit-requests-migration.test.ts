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
    expect(sql).not.toMatch(/\(\?<[=!]/);
  });
});
