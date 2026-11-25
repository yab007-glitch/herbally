# Clinical-safety remediation — review blockers round 4

**Verdict:** With fixes. Fix B1–B4 and minors, rerun local checks, then commit/push for required CI execution.

## Critical

1. **PG16 fixture lacks service_role table privileges.**
   - Fixture creates NOLOGIN BYPASSRLS service_role but grants only anon/authenticated. BYPASSRLS != table privileges.
   - Add default privileges before baseline tables and GRANT ALL ON ALL TABLES/SEQUENCES to service_role after creation in both targeted fixture and full replay; mirror Supabase. Ensure service-role CRUD tests pass.

2. **PostgREST smoke uses wrong incident RPC args.**
   - Smoke sends p_page_url/p_status/p_reporter_type; actual signature p_severity/p_surface_url/p_summary/p_details/p_triage_status/p_sla_due_at/p_actor. Fix exact JSON; assert OK RPC.

3. **SQL sanitizer mishandles bare 18 and 0–18/6–18/under-18.**
   - has_adult matches bare “18 years”, suppressing pediatric classification.
   - Fix has_adult to explicit adult/over-18 markers only; add range detection to has_ped, is_pediatric_only_dose_jsonb, PEDIATRIC_AGE_PATTERN, and chat subject regex. Tests: Children 6-18, Under 18, 0-18 stripped; Adults 18 years and older preserved.

4. **Three public view fields unsanitized.**
   - herb_monographs.drug_interactions raw; FAQ question raw; pubmed content only dosageAndAdministration sanitized.
   - Sanitize monograph drug_interactions, FAQ question EN/FR, all PubMed dose/administration keys; real-string tests.

## Minor

- M1: distinguish quarantined_collision from unreviewed in homepage/stack labels.
- M2: when only matching interactions are retracted_hold, return withheld status instead of generic found:false.
- M3: either add postgrest-and-migrated-e2e to build.needs or correct required wording.
- M4: decide/implement is_published filters for regulatory/source/pubmed public views; do not expose draft/unpublished evidence if unintended.
- M5: update public-columns comment to 00104 actual revokes/exclusions.
- Correct round-4 report overclaims.

## Acceptance / CI

After fixes and local verification, commit intended files only and push to main so CI can run:

1. targeted-migration-fixture green including service-role CRUD/RLS/rollback.
2. full 00001–latest replay green.
3. postgrest-and-migrated-e2e green including incident RPC and cleanup.
4. build green with intended dependencies.
5. deploy workflow applies expand/contract and handles rollback; verify exact SHA.

Do not claim CI evidence before it runs.
