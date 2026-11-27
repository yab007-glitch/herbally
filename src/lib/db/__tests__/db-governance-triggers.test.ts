import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase/migrations");

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
}

describe("A7: PostgreSQL fail-closed governance migrations & clinical approval triggers", () => {
  it("enforces AAL2 MFA admin RLS across catalog and clinical tables in 00097", () => {
    const sql = readMigration("00097_admin_aal2_rls.sql");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.is_admin_aal2()");
    expect(sql).toContain("auth.jwt() ->> 'aal') = 'aal2'");
    expect(sql).toContain("ON public.herbs FOR UPDATE");
    expect(sql).toContain("ON public.drug_interactions FOR ALL");
  });

  it("enforces interaction publication contract, retracted citation holds & revision triggers in 00101", () => {
    const sql = readMigration("00101_interaction_publication_contract.sql");
    expect(sql).toContain("CONSTRAINT drug_entities_class_rxcui_check");
    expect(sql).toContain("CREATE TRIGGER trg_drug_interaction_reset_review");
    expect(sql).toContain(
      "CREATE TRIGGER trg_drug_interaction_publication_gate"
    );
    expect(sql).toContain("CREATE TRIGGER trg_drug_interaction_audit_revision");
    expect(sql).toContain("CREATE TRIGGER trg_drug_interaction_citations_gate");
    expect(sql).toContain("publication_status = 'retracted_hold'");
  });

  it("enforces clinical review reset on herb edits, immutable revision logs, and safety SLA tables in 00102", () => {
    const sql = readMigration("00102_scientific_governance_and_incidents.sql");
    expect(sql).toContain("CREATE TRIGGER trg_reset_clinical_review_on_edit");
    expect(sql).toContain("CREATE TRIGGER trg_audit_herb_clinical_revisions");
    expect(sql).toContain(
      "CREATE TABLE IF NOT EXISTS public.public_corrections_log"
    );
    expect(sql).toContain(
      "CREATE TABLE IF NOT EXISTS public.safety_incident_audit_log"
    );
    expect(sql).toContain(
      "CREATE OR REPLACE FUNCTION public.create_safety_incident_with_audit"
    );
  });

  it("enforces privacy consent scopes and retention timestamps in 00103", () => {
    const sql = readMigration("00103_privacy_minimization_controls.sql");
    expect(sql).toContain(
      "CREATE TABLE IF NOT EXISTS public.user_privacy_consents"
    );
    expect(sql).toContain("retention_expires_at");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
  });

  it("enforces adult-only 18+ dosage checks and revokes raw pediatric base columns in 00104", () => {
    const sql = readMigration("00104_pediatric_boundary_contract.sql");
    expect(sql).toContain(
      "ADD CONSTRAINT dosage_calculations_adult_only_check"
    );
    expect(sql).toContain("CREATE TRIGGER trg_dosage_calculations_adult_only");
    expect(sql).toContain(
      "REVOKE SELECT ON public.herbs FROM anon, authenticated"
    );
    expect(sql).toContain(
      "GRANT SELECT ON public.herbs_public TO anon, authenticated, service_role"
    );
  });

  it("enforces fail-closed clinician edit intake, perioperative safety, and citation URL reconciliation in 00105, 00108, and 00109", () => {
    const sql105 = readMigration("00105_clinical_edit_requests.sql");
    const sql108 = readMigration(
      "00108_perioperative_and_toxic_safety_reconciliation.sql"
    );
    const sql109 = readMigration(
      "00109_interaction_source_url_reconciliation.sql"
    );
    expect(sql105).toContain(
      "CREATE TABLE IF NOT EXISTS public.clinical_edit_requests"
    );
    expect(sql105).toContain("no_phi_attested = true");
    expect(sql108).toContain("Perioperative note:");
    expect(sql108).toContain("abrus-precatorius");
    expect(sql109).toContain("https://www.nccih.nih.gov/health/aloe-vera");
    expect(sql109).toContain("https://pubmed.ncbi.nlm.nih.gov/24566323/");
    expect(sql109).toContain(
      "https://www.mskcc.org/cancer-care/integrative-medicine/herbs/holy-basil-01"
    );
  });
});
