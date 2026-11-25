# Owner Action Register — Blocked, Credentialed, Legal & Production Items

> Generated 2026-11-25 during clinical-safety remediation. Items listed here **cannot** be completed autonomously inside the repository because they require licensed clinical sign-off, production database / credential access, legal counsel, or external vendor accounts.

## 1. Clinical & Editorial Decisions (Requires Qualified Health Professionals)

1. **Pediatric monograph prose (`src/lib/data/monographs/part1.ts` Chamomile & `part2.ts` Cranberry)**
   - Blocked: Preserved untouched per safety boundary. Require licensed pediatric clinician / pharmacist review before modifying or publishing pediatric wording.
2. **Six unresolved URL collision pairs (`KNOWN_UNRESOLVED_PAIR_COLLISIONS`)**
   - Paths: `/interactions/sage/anticonvulsants`, `/interactions/rhodiola/antidepressants`, `/interactions/astragalus/immunosuppressants`, `/interactions/cats-claw/immunosuppressants`, `/interactions/cordyceps/immunosuppressants`, `/interactions/evening-primrose/phenothiazines`.
   - Blocked: Clinical disambiguation/merging/severity resolution requires qualified clinical reviewer sign-off; software keeps them fail-safe and unmerged.
3. **Interaction database expansion freeze & legacy row clinical review**
   - Migration `00101` sets existing interaction rows to `publication_status = 'legacy_unreviewed'` and `clinical_action_status = 'unreviewed_blocked'`, and `scripts/interactions/import.ts` hard-stops `--apply` without `HERBALLY_ALLOW_INTERACTION_EXPANSION=true`.
   - Owner + licensed pharmacist/physician must execute claim-linked citation audits and populate `clinical_reviewer_id`, `verified_at`, `pair_specific_clinical_action`, and `next_review_due_at`.
4. **Reviewer attribution & Advisory Board seating (`src/lib/data/reviewers.ts`, `docs/governance/ADVISORY_BOARD_CHARTER_TEMPLATE.md`)**
   - `dawn-wong` and unconsented clinical profiles fail closed publicly until written consent, active licence verification, and reviewed herb scope are recorded.

## 2. Production Database Migrations (Authored, NOT Applied)

Apply ALL seven pending sequential migrations (`00097`–`00103`) via `scripts/apply-pending-migrations.sh` (which requires a pre-migration database backup via `$BACKUP_SCRIPT`, validates balanced `BEGIN;`/`COMMIT;` blocks, runs `psql -v ON_ERROR_STOP=1`, verifies SQL postconditions, and aborts deploy before app cutover on failure). Until `00100` is applied, adult reference calculation saves return a controlled unavailability error rather than failing silently on enum value `'adult_reference'`.

1. `supabase/migrations/00097_...` through `00099_...` (pre-existing unapplied security/perf migrations on this branch).
2. `supabase/migrations/00100_pediatric_containment_dosage_calculations.sql` (adult-only 18..120 constraint, anon insert revocation, legacy & non-`adult_reference` quarantine, `herbs.dosage_child` column-privilege isolation & `herbs_public` view, bundle/search RPC redaction, `patient_profiles.adult_dosing_eligible`).
3. `supabase/migrations/00101_interaction_publication_contract.sql` (`drug_entities`, `drug_aliases`, `drug_interaction_citations`, `drug_interaction_revisions`, `evidence_note` reconciliation, SECURITY DEFINER publication/reset triggers, class-vs-RxCUI constraint).
4. `supabase/migrations/00102_scientific_governance_and_incidents.sql` (`reviewer_registry`, `claim_citations`, `public_claim_citations`, `herb_clinical_revisions` + `last_reviewed` edit-reset trigger, `safety_incidents`, atomic `create_safety_incident_with_audit` RPC, audit log, `public_corrections_log`).
5. `supabase/migrations/00103_privacy_minimization_controls.sql` (`user_privacy_consents` with `'dosage_history'` scope, `retention_expires_at` metadata).
6. CI disposable-Postgres execution (`scripts/test-migrations-postgres.sh` + `supabase/tests/clinical-safety-integration.sql` in `.github/workflows/ci.yml`) must pass before deploy; local host lacks `psql`/Docker daemon.
7. Run read-only quality baseline once production snapshots are exported: `npx tsx scripts/content-quality-baseline.ts --fixture <snapshot.json>`.

## 3. Legal, Privacy & External Vendor Governance (Requires Counsel / Owner Account)

1. **Quebec Law 25 / PIPEDA formal EFVP & counsel sign-off** (`docs/governance/LAW25_PIPEDA_READINESS_CHECKLIST.md`).
2. **Third-party Data Processing Agreements (DPAs) & zero-retention verification** with Supabase hosting, Vercel, and Ollama Cloud AI inference providers (confirm no log/prompt retention outside documented scope).
3. **SOP / Charter formal approval** (`docs/governance/CLINICAL_REVIEW_SOP.md`, `ADVISORY_BOARD_CHARTER_TEMPLATE.md`, `SAFETY_INCIDENT_AND_CORRECTIONS_SOP.md`).
4. **Indexation / Risk-Tier policy sign-off**: Default settings fail conservatively (`tier_2_clinical_review_required` -> `noindex_until_reviewed`); owner must formally confirm rollout timing alongside clinical review staffing before advertising unreviewed pages.
