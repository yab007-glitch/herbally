# Vercel production gate on CI

Status: **NOT ENABLED — dashboard-pending.** The project has no Ignored Build
Step configured today (`commandForIgnoringBuildStep` is currently `null`,
verified through the Vercel API on 2026-10-30). Nothing below is active until
the step is set in the dashboard or via the API.

> Prefer the native option first: this team is on Vercel **Pro**
> (`billing.plan: "pro"`, verified through the API), and Vercel can gate the
> _promotion_ of a production build on GitHub Actions results with **Deployment
> Checks** — no token, no script, and no race with CI. See
> [Native option: Deployment Checks](#native-option-deployment-checks) below.
> The Ignored Build Step below is the fallback for plans without it.

## What the gate does

`scripts/vercel-ignore-build.sh` is a Vercel _Ignored Build Step_: Vercel runs
it before the build, and the exit code decides what happens. **The codes are
inverted relative to a normal script:**

| exit | Vercel behaviour                        |
| ---- | --------------------------------------- |
| 0    | **cancel** the build (state `CANCELED`) |
| 1    | **continue** with the build             |

Everything the script cannot verify exits 0, i.e. cancels. A commit is never
deployed on a check that could not be read.

The script resolves the commit CI actually tested, then asks GitHub for the
newest run of `.github/workflows/ci.yml` on **that** commit:

- `completed` + `success` → exit 1 (build)
- `completed` + anything else → exit 0 (cancel)
- `queued` / `in_progress` / `waiting` / `requested` → poll up to
  `CI_GATE_MAX_POLL_SECONDS`, then exit 0 (fail closed)
- no run found → poll up to `CI_GATE_MAX_POLL_SECONDS`, then exit 0
- missing token, missing SHA, API error, unparsable JSON → exit 0 (fail closed)

It uses the **workflow-runs** endpoint (`/actions/workflows/ci.yml/runs?head_sha=`)
rather than `/commits/{sha}/check-runs` because check-runs are per _job_
(`lint`, `typecheck`, `test-e2e`, …) and carry no workflow name; the workflow-run
object is the thing that can actually be "the CI workflow is green".

## Why the gate resolves the merged PR first

Vercel evaluates the Ignored Build Step **seconds after a push**, but CI on this
repo takes **16–26 minutes** (measured runs: 963s, 944s, 1539s). Querying the
push commit's own workflow run at evaluation time therefore always returns
`queued`/`in_progress`, and a fail-closed gate would cancel **every** production
deploy. That is the race this design removes.

Instead, for the push commit the script asks GitHub which pull request it came
from and gates on the PR **head** commit — the commit CI actually ran against:

```text
GET https://api.github.com/repos/{owner}/{repo}/commits/{sha}/pulls
  -> merged PR returned:  tested commit = .[0].head.sha
  -> no PR (direct push): tested commit = {sha}
```

then:

```text
GET https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow}/runs?head_sha={tested_commit}&per_page=1
```

If the PR lookup fails (API error, unparsable JSON, no merged PR), it falls back
to `{sha}` and carries on. If the tested commit has no run but differs from
`VERCEL_GIT_COMMIT_SHA`, it retries the query once against the push commit
before giving up.

Verified examples on this repo:

| merge commit                               | PR   | PR head (tested commit)                    | `ci.yml` run on the head |
| ------------------------------------------ | ---- | ------------------------------------------ | ------------------------ |
| `bf3d1e9ffaa87c6bb457706814dbae749bc1f6da` | #175 | `f41d6116b2680e7a9302832fc5675e73acbc9145` | `completed:success`      |
| `b2040b7777af6185af987b7ded9ada0e6e4288f7` | #174 | `8b25758e335c73c43876ceab80fb2ee0d5195337` | `completed:failure`      |

In both cases the merge commit's **own** push run was still `queued` when the
gate would have been evaluated.

## Enabling it

1. **Create a GitHub token with read-only Actions access.**
   GitHub → Settings → Developer settings → Fine-grained tokens → Generate new
   token. Repository access: only `yab007-glitch/herbally`. Permissions:
   **Actions: Read-only** (nothing else). Copy the token.

2. **Store it in Vercel** (Project → Settings → Environment Variables):
   name `GITHUB_CHECKS_TOKEN`, environments **Production** (add Preview only if
   you also want preview builds gated), value = the token.

   The repo is private, so the GitHub API returns **404** for unauthenticated
   calls — the token is not optional. **Without `GITHUB_CHECKS_TOKEN` the script
   skips (cancels) every build**, because it cannot verify anything.

3. **Point the project at the script.** Dashboard path:
   **Project → Settings → Build and Deployment → Ignored Build Step →
   _Run command_**, and paste exactly:

   ```bash
   CI_GATE_MAX_POLL_SECONDS=300 bash scripts/vercel-ignore-build.sh
   ```

   (`CI_GATE_MAX_POLL_SECONDS=300` lets the step wait up to five minutes for a
   run that is still finishing; `0` — the script default — means no polling.
   Even at 300 it cannot outwait a full CI run, which is why the merged-PR
   resolution above is the actual fix for the race.)

   Non-interactive equivalent. `vercel api` is the only CLI surface that writes
   project settings (`vercel project` has no `update` subcommand); the team id is
   required because the CLI's default scope is the personal account:

   ```bash
   vercel api -X PATCH \
     "/v9/projects/prj_aGIptlSsD7vwSUwppdWJrL8mIe59?teamId=team_fhA8MfpowyzcXjUE01n2DJhP" \
     -f "commandForIgnoringBuildStep=CI_GATE_MAX_POLL_SECONDS=300 bash scripts/vercel-ignore-build.sh"
   ```

   Use `-f` (raw string), **not** `-F`. `-F` type-parses its value, so
   `-F commandForIgnoringBuildStep=false` is sent as a boolean and silently
   dropped (verified 2026-10-30: the field stayed `null`).

   Read it back:

   ```bash
   vercel api \
     "/v9/projects/prj_aGIptlSsD7vwSUwppdWJrL8mIe59?teamId=team_fhA8MfpowyzcXjUE01n2DJhP" \
     | grep commandForIgnoringBuildStep
   ```

   Roll back to "no step" with a JSON body (an empty `-F`/`-f` value stores `""`,
   not `null`):

   ```bash
   printf '{"commandForIgnoringBuildStep": null}\n' > /tmp/patch-null.json
   vercel api -X PATCH \
     "/v9/projects/prj_aGIptlSsD7vwSUwppdWJrL8mIe59?teamId=team_fhA8MfpowyzcXjUE01n2DJhP" \
     --input /tmp/patch-null.json --silent
   ```

   Verified on 2026-10-30: writing the command above and reading it back
   returned the exact string, and the rollback restored `null`. The project was
   left at `null`; the step is **not** active.

## Native option: Deployment Checks

Vercel holds a production deployment until the required checks pass, then
aliases it to the custom domain. That gates the **release**, not the build, so
the "CI hasn't finished yet" race below does not exist.

1. Project → Settings → **Build and Deployment** → _Deployment Checks_ →
   **Add Checks**.
2. Provider **GitHub** → search for the `CI` workflow's jobs (for example
   `lint`, `typecheck`, `test`, `coverage`, `format`, `test-e2e`, `verify-db`,
   `secrets`) and select the ones that must pass. Vercel reads the commit
   check-runs for the deployment's commit.
3. Keep automatic aliasing enabled (Settings → Environments → Production) so the
   deployment promotes itself once the checks pass.

No token and no extra cost on the current Pro plan; the GitHub App that Vercel
already uses reports the checks. Deployment Checks read job names, so renaming a
CI job means updating the check — worth pinning in the workflow's comments.

## Why it is not enabled yet

**1. CI on `main` is not yet demonstrated green.** Before PR
[#175](https://github.com/yab007-glitch/herbally/pull/175) (`fix/ci-gate-green`),
16 of 20 CI runs failed (job `lint`: 3 `react-hooks/set-state-in-effect` errors;
job `format`: 19 files failing `prettier --check`; job `test-e2e`: calculator and
homepage specs failing against the placeholder Supabase instance). PR #175
merged as `bf3d1e9f` and its own PR-head run (`f41d6116b2`) is
`completed:success`, but the **push** run for the merge commit has been
`queued` since 17:57:30Z and has not produced a conclusion, so "main is green"
is not established yet. A fail-closed gate is only as good as the workflow
behind it.

**2. Dashboard-pending.** The Ignored Build Step is still `null` and no
`GITHUB_CHECKS_TOKEN` has been created/stored, so the gate is inert. Enabling it
before `main` is green (and without the token) would cancel every production
deploy.

The earlier same-commit timing problem is fixed by the merged-PR resolution
described above: the gate reads the CI run for the PR head, which has already
finished by the time the merge lands, instead of the merge commit's own
still-queued run.

## Fallback design if Deployment Checks is unavailable

Invert the trigger: stop Vercel from deploying `main` on push, and deploy _after_
CI passes.

1. Keep the Git integration for preview deployments of pull requests.
2. In the CI workflow, add a final job that runs only on `main` after every
   other job succeeds and calls a **Vercel Deploy Hook** (Project → Settings →
   Git → Deploy Hooks) with `curl -fsS -X POST "$VERCEL_DEPLOY_HOOK_URL"`.
3. Store the hook URL as a repository secret (`gh secret set
VERCEL_DEPLOY_HOOK_URL`). It is a bearer credential — the owner should create
   and store it, not a worker.

That gives a true "merge only deploys when CI is green" gate with no extra
spend, no polling and no token in the build environment. The Ignored Build Step
above remains useful as a second, fail-closed belt once CI is green and deploys
are triggered by the hook (the hook-triggered build runs long after CI finished,
so the synchronous check is accurate).

## Verifying the script by hand

Remember the inverted codes: a green run logs `[ci-gate] BUILD:` and exits
**1**; a red run logs `[ci-gate] SKIP BUILD:` and exits **0**.

```bash
# green CI -> "[ci-gate] BUILD: ...", exit=1
# red CI   -> "[ci-gate] SKIP BUILD: ...", exit=0
VERCEL_GIT_COMMIT_SHA=<sha> GITHUB_CHECKS_TOKEN=$(gh auth token) \
  CI_GATE_MAX_POLL_SECONDS=0 bash scripts/vercel-ignore-build.sh; echo "exit=$?"
```
