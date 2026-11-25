# AGY round-2 independent re-verification — 2026-11-24

The reviewer confirmed both original Critical findings and most Important/Minor findings fixed. Acceptance remains blocked on exactly one Critical and three Important follow-ups. Keep this round focused; do not reopen items already verified fixed.

## Critical — homepage stale/racing clinical results

**File:** `src/app/[locale]/(marketing)/home-search-client.tsx:188-235,298-301,346-349`

`handleCheck` unconditionally applies completed responses. Neither input edit clears `checkResult`; pending responses can arrive after edits and overlapping checks can resolve out of order. The new collision UI inherits the same defect.

Required:

- Add a monotonically increasing check-generation ref and AbortController handling.
- Clear result/error on both herb and medication edits and at each new check; abort superseded requests.
- Gate result/error/checking updates on current generation, including catch/finally. Abort alone is insufficient.
- Preserve the intentional router navigation when only one field is present.
- Add deferred-response tests for edit-after-complete, edit-while-pending, and older/newer response reversal, including a collision response. Do not weaken or remove tests.

## Important 1 — newsletter post-send timestamp failure permits immediate duplicate mail

**File:** `src/lib/newsletter/subscribe.ts:191-228`

A successful send followed by `last_confirmation_sent_at` update failure is only logged. The next request can immediately send again. Existing tests do not cover stamp failure.

Required:

- Use an atomic per-address resend lease/reservation that exists before sending, is released on send failure, and expires safely after a crash.
- A post-send stamp failure must not permit a second immediate email. Keep the external response uniform and do not expose subscription state.
- Preserve confirmed/unsubscribed/resubscribe behavior and the already-authored `00098` migration. Add a migration only if the chosen lease design genuinely requires it.
- Add stamp-error → immediate retry proof that no second email is sent, plus send-failure release and lease-expiry tests.

## Important 2 — five known collisions lack reviewed change fingerprints

**File:** `src/lib/db/verify-rules.ts:101-199`

Only sage has exact signatures. The other five inventories check path and row count only, so name/severity changes remain green contrary to the fail-on-change contract.

Read-only public PostgREST verification on 2026-11-24 produced these exact `drugName|severity` signatures; use them, without changing the underlying clinical records:

- `rhodiola/antidepressants`
  - `Antidepressants (SSRIs)|moderate`
  - `Antidepressants (MAOIs, SSRIs, SNRIs)|moderate`
- `astragalus/immunosuppressants`
  - `Immunosuppressants|moderate`
  - `Immunosuppressants (Cyclosporine, Tacrolimus, Prednisone)|severe`
- `cats-claw/immunosuppressants`
  - `Immunosuppressants|moderate`
  - `Immunosuppressants (Cyclosporine, Tacrolimus)|severe`
- `cordyceps/immunosuppressants`
  - `Immunosuppressants|moderate`
  - `Immunosuppressants (Cyclosporine, Prednisone)|moderate`
- `evening-primrose/phenothiazines`
  - `Phenothiazines (Chlorpromazine, Fluphenazine)|severe`
  - `Phenothiazines (Chlorpromazine)|severe`

Add expected signatures for all five and a non-sage name/severity mutation test proving CI classification blocks the changed collision. This is change detection, not clinical endorsement.

## Important 3 — recovery instructions still discard failure evidence and can leave services stopped

**File:** `docs/database-backup-strategy.md:35-112`

- The drill deletes `TMP_DUMP` on every exit and drops the test DB on failure. Preserve the restrictive temporary artifact and test DB on failure, print their paths, and clean them only after successful verification/inspection. Preserve the original exit status.
- The emergency restore can exit after `auth rest app` are stopped without a documented recovery path. Add an explicit failure trap/procedure that attempts to restart those services and validates health, while retaining the original failure and explaining that manual intervention is required if restart/health checks fail. Do not run either procedure.
- Keep corrected `/srv/herbally/deploy` paths and strict mode.

## Additional investigation — recurring mocked-chat E2E failures

**File:** `e2e/chat.spec.ts:22-100` and the current chat interface/submission path.

Evidence across the latest isolated production-build run:

- Chromium: soft-warning and hard-refusal tests were flaky and passed on retry.
- Firefox: the PMID-link test failed all three attempts; the remaining 39 non-skipped tests passed.
- The failed snapshots show the user text in the textarea but no assistant reply; the Send button can remain disabled. The route is mocked, so this is not a real AI-provider failure. No chat renderer was intentionally changed by remediation.

Investigate root cause before changing anything. Check hydration timing, keyboard/form submission, button enabled state, and route interception. Do not hide this with a longer timeout, retry-only acceptance, removed test, or weakened assertion. If it is a test-harness race, make the synchronization explicit and document the evidence; if users can lose a pre-hydration submission, fix the actual interaction. A focused deterministic regression is required. Targeted `e2e/chat.spec.ts` runs are permitted on isolated port 3100, but never touch the existing port-3000 server.

## Verification expectations

- Focused failing-first tests for each code change; then related suites.
- Final format, typecheck, lint, coverage, build, migration-only validation, and secret scan.
- Do not run the full Playwright suite; the coordinator owns full browser verification. Only targeted chat E2E is permitted for the investigation above, using isolated port 3100.
- Update the plan and existing reports without erasing prior history. Write `docs/audits/2026-11-24-agy-remediation-round-3.md` with per-item proof and exact verification.
- No git mutations, deployment, production writes, external configuration, `.env.local` edits, medical-content changes, ads/consent/analytics changes, or files outside the repo. Preserve all pre-existing dirty artifacts and the port-3000 development server.
