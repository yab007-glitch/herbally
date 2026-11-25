# Clinical Safety, Interaction Truthfulness, Governance & Privacy Remediation Report (Round 1 Baseline — Superseded by Rounds 2 & 3)

Date: 2026-11-25
Base Commit: `53368e4fdc15eeee8fd1e1c63c997793643ae4b5` (working tree edits authored locally; zero git mutations, zero live DB writes, zero deployments executed; see [docs/audits/2026-11-25-clinical-safety-remediation-round-3.md](2026-11-25-clinical-safety-remediation-round-3.md) for current Round-3 verification, CI Postgres status, and remaining blockers)

---

## Executive Summary

Following the three read-only audits on pediatric safety, interaction validation, and clinical priorities (`2026-11-25`), actionable software, schema (unapplied additive migrations), UI/API, AI chat guard/cache, CI rule, test, and documentation remediations were authored across **Phases A–E** and subsequently corrected in **Correction Round 2** after independent review:

- **Phase A (Pediatric Containment):** Adult-only (`18..120` years) default-deny enforcement across dosage DB/RLS migrations (`00100` — unapplied to production, column-level `SELECT` excluding `dosage_child` added in Round 2), server actions, client calculator UI, dangerous-herb free-text matching with hazard precedence, legacy history & profile redaction, AI pre-LLM refusal / prompt / RAG / guard / cache-key bump (`v6` in Round 2), public serialization & `herb_page_bundle`/LNHPD/PubMed/FAQ/search/compare/print/SW redaction (`public/sw.js` `v8`), and removal of stale `public/dosage-worker.js`.
- **Phase B (Interaction Truthfulness & Publication Contract):** Authored additive schema contract (`00101` — unapplied to production; wrapped in `BEGIN; ... COMMIT;`, `evidence_note` drift reconciled, SECURITY DEFINER triggers, `DEFAULT 'mild'` dropped in Round 2), controlled vocabularies, `drug_interaction_citations`, `drug_interaction_revisions`, class-vs-RxCUI constraint, and reversible `'legacy_unreviewed'` / `'unreviewed_blocked'` defaults; separated Group A from Group B; blocked synthetic clinical actions; removed blanket reviewer credits and `updated_at` as `"Reviewed"`; unified drug matching; enforced publication, sitemap/robots, & expansion-freeze gates (`EXPANSION_FROZEN`) in DB checks & CLI; preserved all six `KNOWN_UNRESOLVED_PAIR_COLLISIONS` unmerged and read-only.
- **Phase C (Scientific Governance & Incident Plumbing):** Authored additive migration `00102` (unapplied to production; fixed `last_reviewed` trigger bug and SECURITY DEFINER privileges, atomic `create_safety_incident_with_audit` RPC, and `public_claim_citations` column isolation in Round 2); fail-closed reviewer attribution (`src/lib/data/reviewers.ts`) and editorial-vs-clinical JSON-LD separation (`HerbSchema` omits `reviewedBy` without clinical review); structured `/api/safety-incidents` intake; deterministic risk-tier config (`src/lib/governance/risk-tiering.ts`); fixture-backed baseline script (`scripts/content-quality-baseline.ts`); and draft governance SOP/charter templates pending owner/qualified approval.
- **Phase D (Privacy & Security Minimization):** Authored additive migration `00103` (unapplied to production; added `'dosage_history'` scope in Round 2); enforced explicit opt-in consent via `user_privacy_consents` across profile, health, medication, and dosage-history writes; excluded `/account` and `/herbalist` in `public/sw.js`; added minimization notices in chat composer and symptom search; documented flows and readiness controls (`DATA_CLASSIFICATION_AND_FLOW_REGISTER.md`, `LAW25_PIPEDA_READINESS_CHECKLIST.md`).
- **Phase E (Documentation & Owner Register):** Reconciled `README.md`, `docs/MD_REVIEWER_OUTREACH.md`, `editorial-policy`, and `methodology` Schema.org metadata; documented all credentialed, clinical, legal, external-account, and production-runtime actions in [docs/audits/2026-11-25-owner-action-register.md](2026-11-25-owner-action-register.md).

> **Correction note:** The initial Round 1 table below captured pre-Round-2 checks and relied on `--migrations-only` static linting rather than real Postgres execution. Round 2 added a disposable-Postgres CI suite (`scripts/test-migrations-postgres.sh` + `supabase/tests/clinical-safety-integration.sql` in `.github/workflows/ci.yml`), fail-closed sequential deployment runner (`scripts/apply-pending-migrations.sh` for `00097`–`00103`), and current verification documented in [docs/audits/2026-11-25-clinical-safety-remediation-round-2.md](2026-11-25-clinical-safety-remediation-round-2.md).

---

## Authored Migrations (NOT Applied to Staging/Production)

All four migrations are additive, reversible where data state is concerned, and awaiting sequential owner/DBA application after database backup:

1. `supabase/migrations/00100_pediatric_containment_dosage_calculations.sql`
2. `supabase/migrations/00101_interaction_publication_contract.sql`
3. `supabase/migrations/00102_scientific_governance_and_incidents.sql`
4. `supabase/migrations/00103_privacy_minimization_controls.sql`

---

## Governance & Audit Artifacts Authored

- `docs/governance/CLINICAL_REVIEW_SOP.md`
- `docs/governance/ADVISORY_BOARD_CHARTER_TEMPLATE.md`
- `docs/governance/SAFETY_INCIDENT_AND_CORRECTIONS_SOP.md`
- `docs/governance/DATA_CLASSIFICATION_AND_FLOW_REGISTER.md`
- `docs/governance/LAW25_PIPEDA_READINESS_CHECKLIST.md`
- `docs/audits/2026-11-25-owner-action-register.md`
- `docs/audits/2026-11-25-clinical-safety-remediation.md` (this report)

---

## Verification Ledger (Observed Results)

| Check                                                          | Outcome                                                              | Observed Details                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| :------------------------------------------------------------- | :------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                                         | Passed (before audit report; re-run below after writing this report) | Clean Prettier formatting across all modified files                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `npm run typecheck`                                            | Passed (exit 0)                                                      | Clean TypeScript typecheck                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `npm run lint`                                                 | Passed (0 errors)                                                    | ESLint clean across workspace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `npm run test:coverage`                                        | Passed (exit 0)                                                      | **193 test files passed**, **1447 tests passed** (`Statements: 60.65%`, `Branches: 49.92%`, `Functions: 54.37%`, `Lines: 62.13%`)                                                                                                                                                                                                                                                                                                                                                                                |
| `npx tsx scripts/verify-herb-database.ts --migrations-only`    | Passed (exit 0)                                                      | `Checking 103 migration files...`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `./scripts/detect-secrets.sh --all`                            | Passed (exit 0)                                                      | `No secrets detected`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `npm run build`                                                | Passed (exit 0)                                                      | Next.js 16.4.6 (Turbopack) compiled in `9.4s`, TypeScript in `8.9s`, generated `187/187` static pages                                                                                                                                                                                                                                                                                                                                                                                                            |
| Isolated Playwright smoke test (port `3100`, production build) | Passed (exit 0)                                                      | Verified `/en/calculator` (age `8` blocked with `"Pediatric dosing is not available"`, zero calculated dose, `0` Save buttons, only unit radios `["mg", "ml", "g", "drops"]`, no months toggle, `"Aconite"` -> `"Blocked: Severe Toxicity Hazard"`), `/fr/calculator` (age `0` -> `"Posologie pédiatrique non disponible"`, no Save button), `/en/herb-drug-interactions` (`200`, no blanket `"Editorially reviewed by Yasser Bheekun"` credit), `/en/editorial-policy` (`200`), and `/dosage-worker.js` (`404`) |

---

## Preserved & Blocked Items (Unchanged by Design)

Per safety and operational boundaries:

- **Zero git mutations**, zero deployments, zero live/hosted/local DB or SMTP writes, zero migration applications, zero external account/secret/DNS/ads/consent edits.
- **Pre-existing dirty workspace artifacts preserved untouched**: `artifacts/adsense-watch.json`, `artifacts/expand-import-report.json`, `artifacts/ads-consent-salvage-20261116/`, `artifacts/fr-monograph-pilot-20261117/`, `ours-1.json`, `ours-1.png`, `ours-2.json`, `ours-2.png`.
- **Untouched clinical content & collision pairs**: Chamomile (`src/lib/data/monographs/part1.ts`), Cranberry (`src/lib/data/monographs/part2.ts`), and all six `KNOWN_UNRESOLVED_PAIR_COLLISIONS` remain unmerged and require qualified clinical review.
- **Full owner action list**: See [docs/audits/2026-11-25-owner-action-register.md](2026-11-25-owner-action-register.md).
