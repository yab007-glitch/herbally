# Clinical-safety remediation — review blockers round 3

**Verdict:** NO commit/deploy. Fix the 4 Critical and 12 Important findings below, plus the observed chat guard-ordering E2E failure. Do not claim CI execution until it runs.

## Critical

1. **Admin herb create/update breaks after 00104.**
   - `admin-herbs.ts:162-163,214-217` uses authenticated client insert/update `.select(PUBLIC_HERB_COLUMNS)`; 00104 revokes raw columns required by RETURNING.
   - Use `createAdminClient()` after `getAdminAccess()` succeeds, or return only granted metadata and fetch view separately. Add post-contract admin CRUD test.

2. **Deployment rollback does not restore 00104 grants.**
   - Failure handler restores app image but not schema grants; old image SELECT* fails after contract.
   - Detect contract-applied state and execute rollback-00104-contract.sql before old image restart; verify raw SELECT* compatibility. Fail loudly if rollback fails.

3. **Full 00001–00104 replay fails at 00079.**
   - 00079 inserts `evidence_note` before 00101 adds column. Add it before 00079 (earlier migration or top of 00079). Full replay must pass, not advisory-red.

4. **Targeted fixture rollback test commits its own grants.**
   - Running rollback script inside outer BEGIN; its inner COMMIT commits outer transaction. Run in separate disposable DB/snapshot or strip transaction wrappers/savepoint-safe version. Integration assertions must run after real rollback.

## Important

5. **No real PostgREST/view/embed smoke.** Verify migrated fixture via actual PostgREST for `herbs_public + herb_categories(*)`, `herbs_public + drug_interactions(*)`, bundle RPC, symptom search RPC, raw column denials, safety-incident RPC. Extend deploy smoke to `/herbs`, `/calculator?herb=…`, `/api/interactions/check`, `/api/herbs/search`, admin CRUD. If embed inference fails, change queries.
6. **Homepage/stack checkers omit interaction publication status.** Add to check payload/type and render status badges/filters in both; never present legacy as confirmed.
7. **Old-image calculator writes fail after 00100.** Defer dosage constraints to contract or implement/document/test a calculator-save freeze during expand. Expand compatibility must include writes.
8. **Monograph `/sources.claims` and `safety` remain raw in views/RPC.** Sanitize these arrays and bundle fields; add senna/fennel source fixture.
9. **Pediatric history detection only scans dosing intent in current message.** Combine subject+intent over rolling recent history; test prior-dose/current-subject and reverse.
10. **Pediatric prohibition exemption can allow follow-on dose clause.** Carry pediatric context across adjacent semicolon clauses; block affirmative dose after pediatric prohibition. Test “Never give children 5 ml; give 10 ml.”
11. **JSON-LD E2E silently skips unavailable herb routes.** Use migrated fixture or fail if route unavailable; run against real DB/view contract.
12. **Deploy postconditions are partial.** Check all public views/grants/bundle/symptom/incident/reviewer/dosage contract markers, or run full idempotent phase verifier. Mirror rollback verification.
13. **Chat deterministic refusal runs after AI-provider check.** `api/chat/route.ts:374` checks Ollama configured before body refusals at 439/458; without key returns 503 and E2E cannot prove guard. Parse body and run emergency/pediatric deterministic refusal before provider-config gate. Test without AI key returns blocked 200.
14. **Minor:** mixed-status copy, fixture labels 00097–00104, sanitize remaining public arrays, verify contraindications/side_effects contain warnings not dosing, update reports without overclaim.

## Required CI evidence

- targeted migration fixture green: expand → old-image reads+writes/freeze compatibility → contract → integration → rollback test.
- full 00001–00104 replay green.
- real PostgREST smoke on migrated fixture.
- admin CRUD post-contract success.
- post-contract browser tests using migrated DB for herbs/calculator/interactions/search/print/JSON-LD.
- E2E with no AI key proves fixed refusal 200.
- All local gates and full Chromium/Firefox.
