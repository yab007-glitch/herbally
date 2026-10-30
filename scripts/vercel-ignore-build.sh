#!/usr/bin/env bash
#
# Vercel "Ignored Build Step" — build only when CI is green for this commit.
#
# Vercel semantics are INVERTED relative to a normal shell script:
#   exit 0 => Vercel CANCELS the build (deployment state CANCELED)
#   exit 1 => Vercel CONTINUES with the build
# Everything unknown fails CLOSED (exit 0 = cancel), so a commit is never
# deployed on a check we could not read.
#
# The gate deliberately does NOT start from the push commit's own CI run.
# Vercel evaluates this step seconds after a push, while CI on this repo takes
# 16-26 minutes (measured runs: 963s, 944s, 1539s). At evaluation time the push
# commit's run is still queued/in_progress, so a "is CI green now" check would
# cancel every production deploy. Instead the gate resolves the merged pull
# request and gates on the commit CI actually tested:
#
#   GET /repos/{owner}/{repo}/commits/{sha}/pulls
#     -> merged PR found:    tested commit = PR head sha
#     -> none (direct push): tested commit = {sha}
#
#   GET /repos/{owner}/{repo}/actions/workflows/{workflow}/runs?head_sha=...
#
# If the tested commit has no run yet, the query is retried once against the
# push commit before giving up.
#
# Required environment (set in Vercel → Project → Settings → Environment
# Variables; see docs/vercel-ci-gate.md):
#   GITHUB_CHECKS_TOKEN  fine-grained PAT, "Actions: Read-only" on the repo
#                        (the repo is private: without it every API call 404s
#                        and the gate therefore skips every build)
#
# Provided by Vercel automatically:
#   VERCEL_GIT_COMMIT_SHA, VERCEL_GIT_REPO_OWNER, VERCEL_GIT_REPO_SLUG
#
# Optional:
#   CI_WORKFLOW_FILE                default ci.yml
#   CI_GATE_MAX_POLL_SECONDS        default 0 (no polling -> fail closed)
#   CI_GATE_POLL_INTERVAL_SECONDS   default 20
#
# This script is inert until the project's Ignored Build Step points at it:
#   CI_GATE_MAX_POLL_SECONDS=300 bash scripts/vercel-ignore-build.sh
#
set -euo pipefail

WORKFLOW_FILE="${CI_WORKFLOW_FILE:-ci.yml}"

# Keep the arithmetic below immune to junk input: a bad value must fail closed,
# not abort the script with a non-zero (== BUILD) status.
MAX_POLL_SECONDS="${CI_GATE_MAX_POLL_SECONDS:-0}"
case "$MAX_POLL_SECONDS" in
  '' | *[!0-9]*) MAX_POLL_SECONDS=0 ;;
esac
POLL_INTERVAL_SECONDS="${CI_GATE_POLL_INTERVAL_SECONDS:-20}"
case "$POLL_INTERVAL_SECONDS" in
  '' | *[!0-9]*) POLL_INTERVAL_SECONDS=20 ;;
esac

sha="${VERCEL_GIT_COMMIT_SHA:-}"
owner="${VERCEL_GIT_REPO_OWNER:-yab007-glitch}"
repo="${VERCEL_GIT_REPO_SLUG:-herbally}"
token="${GITHUB_CHECKS_TOKEN:-}"

# exit 0 -> Vercel cancels the build; exit 1 -> Vercel builds.
skip() {
  echo "[ci-gate] SKIP BUILD: $*"
  exit 0
}

proceed() {
  echo "[ci-gate] BUILD: $*"
  exit 1
}

[ -n "$sha" ] || skip "VERCEL_GIT_COMMIT_SHA is not set"
[ -n "$token" ] || skip "GITHUB_CHECKS_TOKEN is not set (fail closed)"

# A non-zero exit here must never become the script's exit status, because
# non-zero means BUILD. Every caller guards the call.
github_get() {
  curl -fsS --connect-timeout 10 --max-time 30 \
    -H "Authorization: Bearer ${token}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "$1"
}

# Prints the commit CI actually tested: the head sha of the merged PR the push
# commit came from, or $sha itself for a direct push. Any PR-lookup failure
# (API error, unparsable JSON, no merged PR) falls back to $sha — never aborts.
resolve_tested_commit() {
  local pr_json head_sha
  pr_json="$(github_get "https://api.github.com/repos/${owner}/${repo}/commits/${sha}/pulls" 2>/dev/null)" || pr_json=""
  if [ -z "$pr_json" ]; then
    printf '%s' "$sha"
    return 0
  fi

  head_sha="$(printf '%s' "$pr_json" | node -e '
    let raw = "";
    process.stdin.on("data", (c) => (raw += c));
    process.stdin.on("end", () => {
      const prs = JSON.parse(raw);
      if (!Array.isArray(prs)) return;
      const merged = prs.find((p) => p && p.merged_at && p.head && p.head.sha);
      if (merged) process.stdout.write(String(merged.head.sha));
    });
  ' 2>/dev/null)" || head_sha=""

  if [[ "$head_sha" =~ ^[0-9a-f]{40}$ ]]; then
    printf '%s' "$head_sha"
  else
    printf '%s' "$sha"
  fi
}

# Prints "<status>:<conclusion>" ("missing" when GitHub has no run for the
# commit). Returns non-zero on an API/parse failure; callers fail closed.
read_run_state() {
  local head_sha="$1" raw
  raw="$(github_get "https://api.github.com/repos/${owner}/${repo}/actions/workflows/${WORKFLOW_FILE}/runs?head_sha=${head_sha}&per_page=1" 2>/dev/null)" || return 1
  printf '%s' "$raw" | node -e '
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
  ' || return 1
}

# Newest run state for the tested commit. When that commit has no run yet and
# it differs from the push commit, retry once against the push commit.
state_for() {
  local head_sha="$1" state
  state="$(read_run_state "$head_sha")" || return 1
  if [ "$state" = "missing" ] && [ "$head_sha" != "$sha" ]; then
    state="$(read_run_state "$sha")" || return 1
  fi
  printf '%s' "$state"
}

tested_commit="$(resolve_tested_commit)" || tested_commit="$sha"
[ -n "$tested_commit" ] || tested_commit="$sha"

if [ "$tested_commit" != "$sha" ]; then
  echo "[ci-gate] push ${sha:0:12} resolves to PR head ${tested_commit:0:12} (the commit CI tested)"
fi

deadline=$(( $(date +%s) + MAX_POLL_SECONDS ))
while :; do
  state="$(state_for "$tested_commit")" || skip "GitHub API request failed (fail closed)"

  case "$state" in
    completed:success)
      proceed "CI (${WORKFLOW_FILE}) is green for ${tested_commit:0:12}"
      ;;
    completed:*)
      skip "CI (${WORKFLOW_FILE}) finished as '${state#completed:}' for ${tested_commit:0:12}"
      ;;
    missing)
      if [ "$(date +%s)" -ge "$deadline" ]; then
        skip "no CI run found for ${tested_commit:0:12}"
      fi
      ;;
    *)
      # queued / in_progress / waiting / requested
      if [ "$(date +%s)" -ge "$deadline" ]; then
        skip "CI (${WORKFLOW_FILE}) is still '${state%%:*}' for ${tested_commit:0:12}"
      fi
      ;;
  esac

  sleep "$POLL_INTERVAL_SECONDS"
done
