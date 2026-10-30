# Vercel production gate on CI

Status: **prepared, deliberately not enabled.** The project has no Ignored Build
Step configured today (`commandForIgnoringBuildStep: null`, verified through the
Vercel API on 2026-10-30). Enabling the gate now would stop every production
deploy, for two independent reasons documented at the bottom.

> Prefer the native option first: this team is on Vercel **Pro**
> (`billing.plan: "pro"`, verified through the API), and Vercel can gate the
> _promotion_ of a production build on GitHub Actions results with **Deployment
> Checks** — no token, no script, and no race with CI. See
> [Native option: Deployment Checks](#native-option-deployment-checks) below.
> The Ignored Build Step below is the fallback for plans without it.

## What the gate does

`scripts/vercel-ignore-build.sh` is a Vercel _Ignored Build Step_: Vercel runs
it before the build, and the exit code decides what happens.

| exit | Vercel behaviour                 |
| ---- | -------------------------------- |
| 0    | continue with the build          |
| 1    | cancel the build (no deployment) |

The script reads `VERCEL_GIT_COMMIT_SHA`, asks GitHub for the newest run of
`.github/workflows/ci.yml` on that exact commit, and:

- `completed` + `success` → exit 0 (build)
- `completed` + anything else → exit 1 (skip)
- `queued` / `in_progress` / `waiting` / `requested` → exit 1 (fail closed)
- no run found, API error, missing token or SHA → exit 1 (fail closed)

It uses the **workflow-runs** endpoint (`/actions/workflows/ci.yml/runs?head_sha=`)
rather than `/commits/{sha}/check-runs` because check-runs are per _job_
(`lint`, `typecheck`, `test-e2e`, …) and carry no workflow name; the workflow-run
object is the thing that can actually be "the CI workflow is green".

## Enabling it

1. **Create a GitHub token with read-only Actions access.**
   GitHub → Settings → Developer settings → Fine-grained tokens → Generate new
   token. Repository access: only `yab007-glitch/herbally`. Permissions:
   **Actions: Read-only** (nothing else). Copy the token.
   The repo is private, so the check-runs/workflow APIs return 404 for
   unauthenticated calls — the token is not optional.

2. **Store it in Vercel** (Project → Settings → Environment Variables):
   name `GITHUB_CHECKS_TOKEN`, environments **Production** (add Preview only if
   you also want preview builds gated), value = the token.

3. **Point the project at the script.** Dashboard path:
   Project → Settings → Git → **Ignored Build Step** → _Run command_ →
   `bash scripts/vercel-ignore-build.sh` → Save.

   Non-interactive equivalent (verified field name; `vercel api` is the only
   CLI surface that writes project settings — `vercel project` has no `update`
   subcommand):

   ```bash
   vercel api -X PATCH "/v9/projects/prj_aGIptlSsD7vwSUwppdWJrL8mIe59" \
     -F commandForIgnoringBuildStep="bash scripts/vercel-ignore-build.sh"
   ```

   Read it back:

   ```bash
   vercel api "/v9/projects/prj_aGIptlSsD7vwSUwppdWJrL8mIe59" \
     | grep commandForIgnoringBuildStep
   ```

   Roll back by sending an empty value:

   ```bash
   vercel api -X PATCH "/v9/projects/prj_aGIptlSsD7vwSUwppdWJrL8mIe59" \
     -F commandForIgnoringBuildStep=""
   ```

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

**1. CI is red on `main`.** 16 of the last 20 CI runs failed (last one:
run [41060835073](https://github.com/yab007-glitch/herbally/actions/runs/41060835073),
`failure`, 13:09:00Z → 13:25:03Z). A gate that only promotes on green CI turns
that into "production stops receiving deploys" — including the P0 fixes in this
branch. `main` must be green first; the current failures are pre-existing and
unrelated to this PR: job `lint` (3 `react-hooks/set-state-in-effect` errors in
`herb-card.tsx`, `herb-pagination.tsx`, `smart-search.tsx`), job `format` (19
files fail `prettier --check`), job `test-e2e` (calculator + homepage specs fail
against the placeholder Supabase instance). This is also why the 16/20 figure
matters: the gate is only as good as the workflow behind it.

**2. Same-commit timing (Ignored Build Step only).** Vercel starts the build
seconds after the push; CI for that commit starts at the same moment and takes
~16 minutes (13:09→13:25 above). A synchronous "is CI green _now_" check
therefore sees `in_progress` on essentially every push and skips the build. The
script supports `CI_GATE_MAX_POLL_SECONDS` (0 = off) to wait, but holding a
Vercel build slot for 15+ minutes per push is not a real fix. Deployment Checks
do not have this problem because they gate promotion, not the build.

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

```bash
# should exit 0 for a green run, 1 for a red run
VERCEL_GIT_COMMIT_SHA=<sha> GITHUB_CHECKS_TOKEN=$(gh auth token) \
  CI_GATE_MAX_POLL_SECONDS=0 bash scripts/vercel-ignore-build.sh; echo "exit=$?"
```
