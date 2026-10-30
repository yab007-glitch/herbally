#!/usr/bin/env bash
#
# Vercel "Ignored Build Step" — build only when CI is green for this commit.
#
# Vercel semantics: exit 0 = continue with the build, exit 1 = cancel (skip).
# Everything unknown fails CLOSED (skip), so a commit is never deployed on a
# check we could not read.
#
# Required environment (set in Vercel → Project → Settings → Environment
# Variables; see docs/ops/vercel-ci-gate.md):
#   GITHUB_CHECKS_TOKEN  fine-grained PAT, "Actions: Read-only" on the repo
#
# Provided by Vercel automatically:
#   VERCEL_GIT_COMMIT_SHA, VERCEL_GIT_REPO_OWNER, VERCEL_GIT_REPO_SLUG
#
# This script is inert until the project's Ignored Build Step points at it:
#   vercel api -X PATCH /v9/projects/<projectId> \
#     -F commandForIgnoringBuildStep="bash scripts/vercel-ignore-build.sh"
#
set -euo pipefail

WORKFLOW_FILE="${CI_WORKFLOW_FILE:-ci.yml}"
MAX_POLL_SECONDS="${CI_GATE_MAX_POLL_SECONDS:-0}"
POLL_INTERVAL_SECONDS="${CI_GATE_POLL_INTERVAL_SECONDS:-20}"

sha="${VERCEL_GIT_COMMIT_SHA:-}"
owner="${VERCEL_GIT_REPO_OWNER:-yab007-glitch}"
repo="${VERCEL_GIT_REPO_SLUG:-herbally}"
token="${GITHUB_CHECKS_TOKEN:-}"

skip() {
  echo "[ci-gate] SKIP BUILD: $*"
  exit 1
}

proceed() {
  echo "[ci-gate] BUILD: $*"
  exit 0
}

[ -n "$sha" ] || skip "VERCEL_GIT_COMMIT_SHA is not set"
[ -n "$token" ] || skip "GITHUB_CHECKS_TOKEN is not set (fail closed)"

api_url="https://api.github.com/repos/${owner}/${repo}/actions/workflows/${WORKFLOW_FILE}/runs?head_sha=${sha}&per_page=1"

# Prints "<status>:<conclusion>" for the newest run of the workflow on this
# commit, or "missing" when GitHub has no run for it yet.
read_run_state() {
  curl -fsS \
    -H "Authorization: Bearer ${token}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "${api_url}" |
    node -e '
      let raw = "";
      process.stdin.on("data", (c) => (raw += c));
      process.stdin.on("end", () => {
        const runs = JSON.parse(raw).workflow_runs || [];
        if (runs.length === 0) {
          process.stdout.write("missing");
          return;
        }
        process.stdout.write(`${runs[0].status}:${runs[0].conclusion ?? "null"}`);
      });
    '
}

deadline=$(( $(date +%s) + MAX_POLL_SECONDS ))
while :; do
  state="$(read_run_state)" || skip "GitHub API request failed"

  case "$state" in
    completed:success)
      proceed "CI (${WORKFLOW_FILE}) is green for ${sha:0:12}"
      ;;
    completed:*)
      skip "CI (${WORKFLOW_FILE}) finished as '${state#completed:}' for ${sha:0:12}"
      ;;
    missing)
      if [ "$(date +%s)" -ge "$deadline" ]; then
        skip "no CI run found for ${sha:0:12}"
      fi
      ;;
    *)
      # queued / in_progress / waiting / requested
      if [ "$(date +%s)" -ge "$deadline" ]; then
        skip "CI (${WORKFLOW_FILE}) is still '${state%%:*}' for ${sha:0:12}"
      fi
      ;;
  esac

  sleep "$POLL_INTERVAL_SECONDS"
done
