# HerbAlly Round-4 Final Newsletter-Only Remediation Report (2026-11-24)

**Executor:** Antigravity CLI (AGY)  
**Re-Verification Spec:** `docs/audits/2026-11-24-agy-round-3-reverification.md`  
**Prior Reports (preserved):** `docs/audits/2026-11-24-agy-remediation.md`, `docs/audits/2026-11-24-agy-remediation-round-2.md`, `docs/audits/2026-11-24-agy-remediation-round-3.md`  
**Implementation Plan:** `docs/superpowers/plans/2026-11-24-review-remediation.md`

> **Hard Guardrails Honored:** Zero `git add`/`commit`/branch/reset/push/worktree mutations, zero deployments or live DB/SMTP/external calls, zero `.env.local` edits, zero changes to `ADS_LAUNCH_GATE`/ads/consent/analytics/editorial content, zero new dependencies, and zero files written outside `/Users/yasser/herbally`. Previously accepted Round-1/2/3 areas (homepage, chat, collision fingerprints, backup/recovery docs), pre-existing dirty artifacts (`artifacts/adsense-watch.json`, `artifacts/expand-import-report.json`, `artifacts/ads-consent-salvage-20261116/`, `artifacts/fr-monograph-pilot-20261117/`, `ours-1.json`, `ours-1.png`, `ours-2.json`, `ours-2.png`), and the pre-existing `next dev` process on port `3000` (PID `59238`) were left completely untouched. No full Playwright run was executed.

---

## 1. Status of Round-4 Newsletter Findings (2 Important)

| Item                                                                               | Status           | Technical Evidence & Proof                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Important 1** — Local lease can suppress a legitimate lifecycle transition       | **Fixed**        | `src/lib/newsletter/subscribe.ts` now queries `newsletter_subscribers` before claiming a local lease, never letting a stale pending local lease short-circuit an `unsubscribed -> pending` transition (`installLocalLease()` atomically replaces any superseded local entry after the DB `unsubscribed -> pending` CAS succeeds, and `claimLocalLease()` allows replacing a local entry whose `confirmToken` differs from the new lifecycle token). `LocalSendLease` carries `{ id, expiresAt, rowId, confirmToken, leaseUntilIso }`, and exported `invalidateNewsletterSendLease()` requires `leaseId`/`rowId`/`confirmToken` identity guards so delayed requests cannot delete newer leases. `src/app/api/newsletter/confirm/route.ts` and `src/app/api/newsletter/unsubscribe/route.ts` select `id, email, confirm_token` from their existing updates and call `invalidateNewsletterSendLease()` without logging emails or altering uniform external responses.                                                                                                                                                                                                                             |
| **Important 2** — Lease expiry does not bound active SMTP send & unfenced stamping | **Fixed (Code)** | `00098_newsletter_confirmation_sent_at.sql` and `00099_newsletter_send_lease.sql` are preserved untouched; **no new migration (`00100`) is needed** because `(id/email, status = 'pending', confirm_token = token, confirmation_send_lease_until = leaseUntilIso)` provides complete DB fencing. `src/lib/email/mailer.ts` exports explicit phase timeouts (`SMTP_DNS_TIMEOUT_MS=10000`, `SMTP_CONNECTION_TIMEOUT_MS=15000`, `SMTP_GREETING_TIMEOUT_MS=15000`, `SMTP_SOCKET_TIMEOUT_MS=20000`, `SMTP_SOCKET_CLOSE_TIMEOUT_MS=2000`, `SMTP_SEND_DEADLINE_MS=45000`, all `< SEND_LEASE_MS = 120000`) and passes an `AbortController` `signal` directly into `tx.sendMail(...)` (no `Promise.race`) so timeouts tear down the underlying socket. `src/lib/newsletter/subscribe.ts` bounds `sendMail` with `SEND_DEADLINE_MS` (`45000ms`), treats aborts/timeouts as failed sends, and fences both `releaseDbLease()` and post-send `last_confirmation_sent_at` stamping by `id`/`email` + `status = "pending"` + `confirm_token` + `confirmation_send_lease_until = leaseUntilIso` (plus local lease-ID ownership in `finally`). _(Applying `00098`/`00099` live before deploy remains pending.)_ |

---

## 2. Round-4 TDD Red → Green Ledger

| Suite / Command                                                                                        | Observed Red Failure Before Fix                                                                                                                                                                                                                                                                                                      | Observed Green Result After Fix                                                                                                                      |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx vitest run src/app/api/newsletter/__tests__/lifecycle.test.ts`                                    | **3/4 failed:** in-flight send → confirm → unsubscribe → immediate resubscribe failed at `expect(sendMailMock).toHaveBeenCalledTimes(2)` (got `1`); cross-replica retained local lease short-circuited `unsubscribed -> pending`; stale invalidation test failed (`invalidateNewsletterSendLease` missing & `sendMailMock` got `1`). | **Passed (`4/4`):** `24/24` across `lifecycle.test.ts`, `route.test.ts`, and `subscribe.test.ts`.                                                    |
| `npx vitest run src/lib/email/__tests__/mailer.test.ts src/lib/newsletter/__tests__/subscribe.test.ts` | **5/5 new tests failed (19 existing passed):** `mailer.test.ts` failed `3/3` (`undefined` timeout constants; both `127.0.0.1` blackhole TCP socket tests timed out at `5000ms`); `subscribe.test.ts` failed `2/3` new tests (`SEND_DEADLINE_MS` `undefined`; expired A cleared B's `confirmation_send_lease_until` to `null`).       | **Passed (`30/30` across 4 suites):** `mailer.test.ts` (`3/3`), `subscribe.test.ts` (`21/21`), `lifecycle.test.ts` (`4/4`), `route.test.ts` (`2/2`). |

---

## 3. Final Verification Command Results

| Command                                                     | Result   | Exact Observed Outcome                                                                                                               |
| ----------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run format:check`                                      | **PASS** | `All matched files use Prettier code style!`                                                                                         |
| `npm run typecheck`                                         | **PASS** | `tsc --noEmit` exited `0`.                                                                                                           |
| `npm run lint`                                              | **PASS** | `eslint` exited `0` (`0` errors, `0` warnings).                                                                                      |
| `npm run test:coverage`                                     | **PASS** | `166` test files passed, `1,361` tests passed. Coverage: `55.76%` statements, `45.41%` branches, `49.41%` functions, `57.04%` lines. |
| `npm run build`                                             | **PASS** | Next.js `16.4.6` (Turbopack) build succeeded; `186/186` static pages generated.                                                      |
| `npx tsx scripts/verify-herb-database.ts --migrations-only` | **PASS** | `Checking 99 migration files...` exited `0` (`00097`, `00098`, and `00099` preserved & verified).                                    |
| `./scripts/detect-secrets.sh --all`                         | **PASS** | `✓ No secrets detected` (exited `0`).                                                                                                |

---

## 4. Round-4 Changed & Added Files (Preserving Accepted Areas & Dirty Artifacts)

### Modified Files

- `docs/audits/2026-11-24-agy-remediation-round-3.md` (added Round-4 cross-reference header line; Round-3 history preserved)
- `docs/audits/2026-11-24-agy-round-3-reverification.md` (Prettier formatting normalization only; zero content edits)
- `docs/superpowers/plans/2026-11-24-review-remediation.md` (appended Section 7; Sections 1–6 preserved)
- `src/app/api/newsletter/__tests__/lifecycle.test.ts`
- `src/app/api/newsletter/confirm/route.ts`
- `src/app/api/newsletter/unsubscribe/route.ts`
- `src/lib/email/mailer.ts`
- `src/lib/newsletter/__tests__/subscribe.test.ts`
- `src/lib/newsletter/subscribe.ts`

### Added Files

- `docs/audits/2026-11-24-agy-remediation-round-4.md`
- `src/lib/email/__tests__/mailer.test.ts`

---

## 5. Remaining Owner, Runtime & Editorial Actions (Unchanged from Round 3)

1. **Apply Pending SQL Migrations Before App Deploy (`00097`, `00098`, `00099`):** Back up `herbally-db` via `/srv/herbally/deploy/backup-local.sh`, apply `00097_admin_aal2_rls.sql`, `00098_newsletter_confirmation_sent_at.sql`, and `00099_newsletter_send_lease.sql`, and verify live AAL1 vs AAL2 PostgREST REST access.
2. **Editorial Resolution of 6 Known Collisions:** Reconcile the 6 colliding `drug_interactions` pairs (`sage/anticonvulsants`, `rhodiola/antidepressants`, `astragalus/immunosuppressants`, `cats-claw/immunosuppressants`, `cordyceps/immunosuppressants`, `evening-primrose/phenothiazines`), then prune `KNOWN_UNRESOLVED_PAIR_COLLISIONS`.
3. **CI / Secrets / Runtime / Backup Operations:** Configure GitHub Secrets `VERIFY_DB_SUPABASE_URL`, `VERIFY_DB_SUPABASE_ANON_KEY`, and `REQUIRE_LIVE_VERIFY_DB=true`; verify `RATE_LIMIT_HASH_SECRET` / `RATE_LIMIT_BACKEND=upstash` and Cloudflare/PostgREST edge limits; fix Mac `launchd` off-site pull exit code `1` and run the hardened Section 3 restore drill.
4. **Full Cross-Browser E2E (Coordinator):** Coordinator owns final cross-browser Playwright verification.
