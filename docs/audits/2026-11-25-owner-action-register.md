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

## 2. Production Database Migrations (Applied & Verified `2026-11-25`)

Sequential migrations `00097`–`00104` have now been applied to production (`herbally-db`) and verified via `scripts/apply-pending-migrations.sh` and `Deploy` on `herbally-wsl`:

1. `supabase/migrations/00097`–`00099b`: Admin AAL2 RLS, newsletter confirmation lease/timestamps, `adult_reference` enum.
2. `supabase/migrations/00100_pediatric_containment_dosage_calculations.sql`: Adult-only 18..120 constraint, anon insert revocation, legacy quarantine, `herbs_public` view, bundle/search RPC redaction, `patient_profiles.adult_dosing_eligible`.
3. `supabase/migrations/00101_interaction_publication_contract.sql`: `drug_entities`, `drug_aliases`, `drug_interaction_citations`, `drug_interaction_revisions`, publication/reset triggers, class-vs-RxCUI constraint.
4. `supabase/migrations/00102_scientific_governance_and_incidents.sql`: `reviewer_registry`, `claim_citations`, `public_claim_citations`, `herb_clinical_revisions`, `safety_incidents`, atomic `create_safety_incident_with_audit` RPC, audit log, `public_corrections_log`.
5. `supabase/migrations/00103_privacy_minimization_controls.sql`: `user_privacy_consents`, `retention_expires_at` metadata on `chat_sessions` and `dosage_calculations`.
6. `supabase/migrations/00104_pediatric_boundary_contract.sql`: Post-switch adult-only write lockdown and base-table column-privilege isolation (with verified `rollback-00104-contract.sql` rollback guard).

## 3. Legal, Privacy & External Vendor Governance (Requires Counsel / Owner Account)

1. **Quebec Law 25 / PIPEDA formal EFVP & counsel sign-off** (`docs/governance/LAW25_PIPEDA_READINESS_CHECKLIST.md`).
2. **Third-party Data Processing Agreements (DPAs) & zero-retention verification** with Supabase hosting, Vercel, and Ollama Cloud AI inference providers (confirm no log/prompt retention outside documented scope).
3. **SOP / Charter formal approval** (`docs/governance/CLINICAL_REVIEW_SOP.md`, `ADVISORY_BOARD_CHARTER_TEMPLATE.md`, `SAFETY_INCIDENT_AND_CORRECTIONS_SOP.md`).
4. **Indexation / Risk-Tier policy sign-off**: Default settings fail conservatively (`tier_2_clinical_review_required` -> `noindex_until_reviewed`); owner must formally confirm rollout timing alongside clinical review staffing before advertising unreviewed pages.

## 4. LinkedIn OIDC SSO & Sponsors Analytics Operations (Added `2026-11-25`)

1. **Enable LinkedIn OIDC SSO in `/srv/herbally/deploy/app.env`**:
   - In the LinkedIn Developer Portal, create or open your app, add the **"Sign In with LinkedIn using OpenID Connect"** product (`openid`, `profile`, `email`), and register redirect URL `https://herbally.app/api/auth/linkedin/callback`.
   - Set `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` (and optionally `LINKEDIN_SESSION_SECRET` and `CLINICAL_REVIEW_NOTIFY_EMAIL`) in `/srv/herbally/deploy/app.env`, then run `docker compose up -d --force-recreate --no-deps app`.
2. **Sponsors analytics snapshot refresh (`/sponsors`)**:
   - Before sending outbound sponsor pitches, refresh the Oct 2026 30-day visitor/page-view metrics in `src/lib/i18n/dictionaries/{en,fr}/server.json` (`sponsorship.audience.stats` & `.note`) with current verified Cloudflare Web Analytics figures.
