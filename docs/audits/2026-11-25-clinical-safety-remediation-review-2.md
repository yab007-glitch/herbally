# Clinical-safety remediation — review blockers round 2

**Verdict:** NO commit/deploy. Four Critical and material Important issues remain. Fix all, run the targeted migration fixture after fixing SQL, and re-review. Do not weaken tests or rewrite status claims without proof.

## Critical

1. **`00100` contains invalid PostgreSQL regex lookbehind.**
   - `00100:254` uses `(?<=[.!?\n;])`; PostgreSQL 16 ARE does not support lookbehind. `strip_pediatric_dosage_text()` will raise `invalid regular expression`.
   - Migration executes it at `00100:820` while redacting bundles, so `00100` aborts and the rest cannot apply.
   - Replace with PostgreSQL-compatible clause splitting (capturing matches or punctuation-delimited split). Add migration-fixture assertion calling the function on real dose text.

2. **Pediatric prose remains publicly retrievable outside `dosage_child`.**
   - `00100` grants public SELECT on `dosage_adult`, `translations`, `preparation_notes`; strips only translations dosage_child, not raw adult/translation prose.
   - `redact_herb_page_bundle` does not sanitize bundle `faqs` or `monograph`; public RPC remains direct.
   - Fix at DB/API boundary: public API must read a sanitized view/RPC or revoke raw columns; sanitize every returned bundle section including FAQs and monograph. Add direct REST and RPC tests using real senna/fennel-like strings.

3. **Migration-first rollout breaks the still-running old image.**
   - Deploy workflow applies 00097–00103 before switching image. `00100` revokes table-level herb SELECT; old image uses `select("*, herb_categories(*)")`, so herb pages/admin break during migration window.
   - Image rollback does not restore schema/grants.
   - Implement expand/contract rollout: additive migrations and explicit-column new code first; app switch; contract revoke/redaction only after new app is healthy, or a tested maintenance/DB rollback sequence. Add old-image/new-schema compatibility test.

4. **Publication gate accepts arbitrary reviewer ID.**
   - `clinical_reviewer_id` has no FK/role/consent/licence validation; integration test publishes with `clinician-1` and no registry.
   - Enforce FK to a consented, verified clinical reviewer with active licence and required role in DB/trigger or publication validation. Add negative test with arbitrary/editorial/unconsented reviewer.

## Important

5. **Consent ledger schema/scopes do not match application and ledger failure is ignored.**
   - App expects status/policy_version/withdrawn_at/created_at; DB has granted/consent_version/revoked_at/updated_at.
   - Scopes differ and research_analytics is disallowed.
   - `requireExplicitHealthConsent` ignores `recordPrivacyConsent` failure. Align schema/app/scopes; fail closed when required consent cannot be recorded; fix profile queries/docs; test absent/false/true/revoked/record-failure.
6. **Atomic incident RPC call passes nonexistent `p_note`.**
   - API gets 42883 and falls back to non-atomic flow. Remove parameter or add to SQL; assert exact payload; test atomic and fallback failure.
7. **JS adult-inclusive dose logic still strips real adult advice.**
   - “Adults and adolescents over 12…” is removed. Apply SQL-equivalent adult-marker/clause preservation in JS; test exact senna/fennel strings.
8. **Warning exemption preserves prescriptive pediatric doses.**
   - “Give a 5-year-old 250 mg; toxic in overdose” survives. Exempt only warning clauses without dosing instructions; split semicolons; test mixed warning+dose.
9. **Mixed-status collision can enter sitemap while pair page remains conflict/noindex.**
   - Group all collision rows before filtering published. If unresolved collision remains, exclude URL. Add mixed published/legacy test.
10. **Reviewer registry unused for public attribution.**
    - Static reviewers only; DB registry can never surface; PubMed review rejects DB reviewer. Resolve from DB registry with consent/role/licence, or synchronize explicitly; test DB row changes page/schema/byline.
11. **Interaction AI/table surfaces still present unreviewed records without status.**
    - AI context, interactions table, herb hub/medication banners need publication status and honest mixed-status display. Filter/label; test mixed lists.
12. **Calculator metadata still advertises Clark/Young/BSA weight scaling.**
    - `en/server.json:522-523` and FR equivalent. Replace with unscaled adult-reference wording; add exact strings to banned-copy tests.
13. **CI Postgres fixture is targeted 00097–00103, not full migration replay.**
    - Label it accurately. Add a separate full-schema replay/job before claiming fresh-install readiness. It must catch invalid regex and real trigger/RLS behavior.
14. **Browser E2E lost key safety coverage.**
    - Add Aconite/dangerous free text, non-dosable herb, age 0, 18 months/under-18/teen, FR block, print/no-dose and JSON-LD no-pediatric-dose assertions. Preserve adult valid case.
15. **ProvenanceBadge still shows blanket 00079 “Human-reviewed.”**
    - Demote bulk rows or make role-aware per review record; do not imply blanket clinical review.
16. **Minor:** `activeCitationCount:1` fabricated in verifier; nullable revision interaction_record_id; enum ADD VALUE transaction runner constraint; 00098/00099 transaction inconsistency; stale docs (`data-flows` says no pediatric bytes persisted while legacy rows are quarantined); report overclaims.

## Deployment / verification

- Fix SQL first, then run `scripts/test-migrations-postgres.sh` locally if possible; Docker unavailable here, so CI disposable fixture is mandatory. Do not call a static file check execution proof.
- Add full migration replay test or clearly mark fresh-install readiness blocked.
- Ensure deploy workflow backup/apply/postconditions fail before app switch and old image remains compatible through expand/contract.
- Rerun format, typecheck, lint, unit coverage, build, static migration check, secret scan, targeted browser, then full coordinator browser.
- Update reports with exact remaining limitations. No commit/deploy in this remediation round.
