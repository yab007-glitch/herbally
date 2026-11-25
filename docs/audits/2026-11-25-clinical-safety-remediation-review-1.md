# Clinical-safety remediation — review blockers round 1

**Verdict:** NOT ACCEPTABLE / DO NOT DEPLOY. Fix every Critical and Important item below, add real migration integration coverage, and re-review before commit/deploy.

## Critical

1. **`00102` herb trigger is broken and revision insert is unauthorized.**
   - Uses `NEW.reviewed_at`/`OLD.reviewed_at`; herbs has `last_reviewed`.
   - Trigger is SECURITY INVOKER and inserts into RLS-protected `clinical_content_revisions` with no INSERT policy while authenticated INSERT is revoked; authenticated admin updates will fail.
   - Fix with correct columns and a tightly scoped SECURITY DEFINER function (`SET search_path=public,pg_temp`, revoke public execute) or an intentional safe policy. Audit the analogous `00101` interaction revision trigger. Add disposable-Postgres update test as authenticated role.

2. **Pediatric dosage remains publicly retrievable outside React.**
   - Base herbs table grants public SELECT including `dosage_child`/translations.
   - Public SECURITY DEFINER `herb_page_bundle` returns `to_jsonb(v_herb)`.
   - Page bundle primary path and `/api/herbs/search` do not apply complete redaction.
   - `HerbSchema` serializes `dosage_adult` containing pediatric prose.
   - Fix at data boundary: public view/RPC/serializer strips `dosage_child` and pediatric dosage text, sanitize bundle before caching/returning, use redacted herb in JSON-LD and search, bump cache key. Add REST/RPC/search/JSON-LD tests.

3. **Poisoning/emergency guidance can be suppressed by AI guards.**
   - Dangerous-herb pre-LLM refusal omits Poison Control/emergency instruction.
   - Pediatric hard-block can replace a correct “call Poison Control” warning with a generic refusal.
   - Add emergency guidance for exposure/ingestion verbs and dangerous/pediatric cases; distinguish warnings from dosing instructions; test acute ingestion and negated/warning forms in EN/FR.

4. **Pediatric pre-LLM guard misses common boundaries and turns.**
   - Numeric months only 0–17; misses 18 months.
   - Missing “under 18”, teen/teenager.
   - Scans only last user message, so prior-turn child context bypasses.
   - Fix phrase/month ranges, scan relevant conversation history, and test 18 months, under-18, teen, and multi-turn.

5. **Pediatric sentence stripping deletes valid adult doses and genuine poisoning warnings.**
   - “Adults and adolescents…” is treated as pediatric and removed.
   - “Children who ingest 5 g may develop liver failure” can be removed despite being a warning.
   - Retain adult-inclusive portions, require explicit dosing instruction for dose removal, and preserve warning/emergency sentences. Add fennel/laxative/hazard regression fixtures.

## Important

6. **Interaction publication contract is not wired.** Pair loader/page hardcode legacy/unverified and ignore governance columns; pages/sitemap do not gate on publication status; gate functions are unused; DB has no publication trigger/constraint. Add pre-migration fallback read of governance fields, real UI values, `robots`/sitemap publication gating, validator/DB enforcement, and publish-one-row tests.
7. **Health-data consent is not explicit and consent ledger is unused.** Saves reject only `false`; UI omits flag; updates/dosage saves bypass; consent table unused; docs overclaim. Require server-verified explicit consent for new health/patient/dosage data, record scope/version/time, correct docs, test absent/false/revoked paths.
8. **Reviewer attribution remains blanket and editorial/clinical not separated.** 00079 bulk-marked thousands as human-reviewed; page treats all as reviewed; JSON-LD emits reviewedBy even without clinical review; Dawn PubMed path can still assert reviewed. Make attribution depend on per-row registry/evidence and role; omit clinical `reviewedBy` when not clinically reviewed; test all cases.
9. **Adult doses are erased for calculator-blocked-but-dosable herbs.** Redaction keys off calculator-blocked set (calendula, cayenne, senna, etc.), not dangerous-only. Retain adult/public reference text unless a dedicated no-public-dose class applies. Test senna/calendula.
10. **Legacy scaling remains visible/writable.** Quarantine/logic only covers fried_rule, not Clark/Young/BSA; DB permits them; server action checks dangerous herb only in notes, not herb_id. Quarantine every non-adult-reference formula; DB constrain active rows; resolve herb_id server-side; test direct PostgREST and crafted actions.
11. **Revision triggers miss clinical fields and retain review status.** Include translations/source/drug identity/evidence/preparation/citations/provenance; reset reviewer/due date/provenance; audit insert/delete too; do not cascade-delete history. Add real trigger tests.
12. **False/stale scaling/clinical-authority copy remains.** EN/FR server/marketing/herbs dictionaries and FAQ schema mention Clark/Young/BSA, weight-scaled safe doses. Replace with adult-reference wording; expand semantic copy tests.
13. **Stack checker green safe icon remains when all pairs are unrecorded.** Use neutral/info indicator and surface publication/review status; never green on absence.
14. **Migration tests are grep-only and miss real failures.** Add disposable-Postgres CI applying migrations with required Supabase roles/schema and run RLS/trigger/constraint/post-condition tests. Do not claim migration validation from a file-count script.
15. **New code writes `formula_used='adult_reference'` before `00100` exists.** Current production save path will fail. Make rollout order explicit and code backward-safe/gated until migration verification, or ensure deploy applies migrations before app switch.
16. **Child profiles are still solicited/stored.** Either remove/reject child profiles or explicitly document record-only non-dosing purpose; server tests.
17. **Pediatric filter drops adult-inclusive doses and whole monograph safety.** Split populations, retain adult portion, filter only doses not safety/claims. Fix NPN and AI context.

## Minor

- `00100` enum addition reversibility and CHECK `NOT VALID`/lock behavior.
- Missing indexes and updated_at trigger in governance tables.
- Over-broad full-row revision snapshots on every edit; index revision/incident query paths.
- Reviewer policy doesn't require verified/licensed status; claim citations expose reviewer_id; missing source_licence field.
- Claim citation role check needed; identify dead governance/matching helpers.
- Safety-incident audit insert result must be checked/transactional; add PHI warning.
- Profile saves pounds as kg.
- Print footer not print-only.
- Remaining “dosage calculator” copy where it is now adult-reference checker.
- Remediation report/plan overstate fixed/reversible/redacted/consent/publication gates; correct every false statement.
- Pre-existing schema drift: evidence_note referenced without ADD COLUMN; reconcile in migration or explicitly block replay.

## Deployment requirements

- New migrations `00100`–`00103` must be applied before new app code that depends on them.
- Add a fail-closed migration runner and deployment workflow step: database backup → apply each migration in its own transaction with ON_ERROR_STOP → verify required columns/functions/policies/constraints → only then build/switch app.
- Do not leave `BEGIN` without matching `COMMIT` in migration files.
- Add preflight/postflight assertions and stop deployment if migration verification fails.
- Validate `00097`–`00103` rollout order and backward compatibility. Do not deploy automatically until CI migration integration tests pass.
- Preserve rollback: app image rollback does not roll back DB; document/guard the incompatible window.

## Method / guardrails

- Strict failing-first TDD for behavior; real ephemeral Postgres integration tests for migration/RLS/trigger. Docker server is unavailable locally, so implement a GitHub-hosted CI job with disposable Supabase/Postgres; do not connect to production.
- Do not edit clinical content/evidence/reviewer facts. Do not merge collisions.
- No git mutation, commit, push, deployment, live DB/migration application, external secrets/settings, or files outside repo.
- Preserve pre-existing artifacts and port-3000 dev server.
- Update the remediation report and plan truthfully; write `docs/audits/2026-11-25-clinical-safety-remediation-round-2.md` with exact Fixed/Blocked/Rejected status and evidence.
- Run full local gates. Target calculator browser flows; coordinator will run full E2E.
