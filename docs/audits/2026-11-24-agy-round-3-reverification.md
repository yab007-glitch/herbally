# AGY round-3 independent verification — final newsletter blockers

The reviewer now rates the overall working tree **With fixes**. Homepage races, chat hydration, collision fingerprints, and recovery docs are confirmed fixed. Do not reopen those areas. Two newsletter issues remain.

## Important 1 — local lease can suppress a legitimate lifecycle transition

**Files:** `src/lib/newsletter/subscribe.ts:128-132,158-183,219-254`; `src/app/api/newsletter/confirm/route.ts:42-52`; `src/app/api/newsletter/unsubscribe/route.ts:46-54`.

`claimLocalLease()` runs before reading the row. Confirm/unsubscribe clear the DB lease but not `activeLeases`. During an active send, confirm → unsubscribe → immediate resubscribe can return accepted before the unsubscribed → pending transition, leaving the row unsubscribed and sending no fresh confirmation.

Required:

- A local pending-send lease must not short-circuit a legitimate unsubscribed-row transition.
- On successful confirm/unsubscribe, invalidate the matching local lease with identity/lease-ID safeguards so an old request cannot delete a newer lease. Obtain the row email through the existing update result; do not expose it in logs.
- Preserve uniform external responses and current token/state behavior.
- Add an in-flight-send → confirm → unsubscribe → immediate resubscribe → confirm regression test. The current lifecycle test misses the active-local-lease case.

## Important 2 — lease expiry does not bound active SMTP send and final stamping is unfenced

**Files:** `src/lib/newsletter/subscribe.ts:179-217,284-357`; `src/lib/email/mailer.ts:52-87`.

A can remain inside `sendMail` beyond the two-minute lease; B can then acquire and send. A can subsequently succeed and deliver a duplicate. A's final update has no acquired-lease predicate and can clear B's lease/overwrite its state.

Required:

- Bound every SMTP phase (connection/greeting/socket and any overall send deadline) below `SEND_LEASE_MS`. A timeout must be treated as failed send; do not merely race a Promise while leaving the underlying SMTP operation able to succeed later.
- Fence post-send stamp and failure release by row identity plus the acquired lease/token (and current pending state where appropriate). Expired/superseded A must not clear or stamp B's newer lease. Preserve local lease-ID ownership checks.
- Add a deterministic test holding A beyond lease expiry, then starting B: no expired A success may produce a second send or alter B's state. Also test release on failure only by the current lease owner.
- Keep `00098`/`00099` additive and update types/migration only if the fencing design truly needs another field. No external mail or DB calls.

## Verification / guardrails

- Strict failing-first tests for both cases, then related newsletter suites.
- Final format, typecheck, lint, coverage, build, migration-only validation, and secret scan.
- No full Playwright run; no git mutations, deployment, live DB/SMTP calls, external settings, `.env.local` edits, ads/consent/analytics/editorial changes, or files outside the repo. Preserve pre-existing dirty artifacts and port 3000.
- Update the plan/reports without erasing history and write `docs/audits/2026-11-24-agy-remediation-round-4.md` with exact red→green and final verification evidence.
