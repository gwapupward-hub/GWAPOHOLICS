#!/usr/bin/env bash
set -Eeuo pipefail

# Wait for every reported PR status check, then merge through GitHub's
# protected path. Requires an authenticated `gh` CLI and jq.
PR_NUMBER="${1:-49}"
REPO="${GH_REPO:-}"
INTERVAL_SECONDS="${MERGE_CHECK_INTERVAL_SECONDS:-30}"
TIMEOUT_SECONDS="${MERGE_CHECK_TIMEOUT_SECONDS:-7200}"

usage() {
  cat <<'USAGE'
Usage: scripts/auto-merge-pr.sh [pull-request-number]

Environment overrides:
  GH_REPO                       Repository in owner/name form (default: current repo)
  MERGE_CHECK_INTERVAL_SECONDS  Poll interval (default: 30)
  MERGE_CHECK_TIMEOUT_SECONDS   Maximum wait (default: 7200)
USAGE
}

if [[ "${PR_NUMBER}" == "-h" || "${PR_NUMBER}" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "error: GitHub CLI (gh) is required" >&2
  exit 127
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required" >&2
  exit 127
fi

if [[ -z "${REPO}" ]]; then
  REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
fi

if ! [[ "${PR_NUMBER}" =~ ^[0-9]+$ ]]; then
  echo "error: pull request number must be numeric: ${PR_NUMBER}" >&2
  exit 2
fi
if ! [[ "${INTERVAL_SECONDS}" =~ ^[1-9][0-9]*$ && "${TIMEOUT_SECONDS}" =~ ^[1-9][0-9]*$ ]]; then
  echo "error: polling interval and timeout must be positive integers" >&2
  exit 2
fi

pr_json() {
  gh pr view "${PR_NUMBER}" --repo "${REPO}" \
    --json state,isDraft,baseRefName,headRefName,mergeStateStatus,url
}

checks_json() {
  # gh returns a non-zero status while checks are pending or failing.
  gh pr checks "${PR_NUMBER}" --repo "${REPO}" --json name,state,bucket,link 2>/dev/null || true
}

pr="$(pr_json)"
state="$(jq -r '.state' <<<"${pr}")"
is_draft="$(jq -r '.isDraft' <<<"${pr}")"
base="$(jq -r '.baseRefName' <<<"${pr}")"
head="$(jq -r '.headRefName' <<<"${pr}")"
url="$(jq -r '.url' <<<"${pr}")"

if [[ "${state}" != "OPEN" ]]; then
  echo "error: PR #${PR_NUMBER} is ${state}, not open" >&2
  exit 3
fi
if [[ "${is_draft}" == "true" ]]; then
  echo "error: PR #${PR_NUMBER} is still a draft" >&2
  exit 3
fi
if [[ "${base}" != "main" ]]; then
  echo "error: PR #${PR_NUMBER} targets ${base}, not main" >&2
  exit 3
fi

echo "Waiting for all checks on PR #${PR_NUMBER}: ${head} -> ${base}"
echo "${url}"

started_at="$(date +%s)"
while true; do
  pr="$(pr_json)"
  state="$(jq -r '.state' <<<"${pr}")"
  if [[ "${state}" != "OPEN" ]]; then
    echo "error: PR changed state to ${state}; refusing to merge" >&2
    exit 4
  fi

  checks="$(checks_json)"
  check_count="$(jq 'length' <<<"${checks}")"
  pending_count="$(jq '[.[] | select(.bucket == "pending")] | length' <<<"${checks}")"
  failing_count="$(jq '[.[] | select(.bucket == "fail" or .bucket == "cancel")] | length' <<<"${checks}")"
  passing_count="$(jq '[.[] | select(.bucket == "pass")] | length' <<<"${checks}")"

  printf '[%s] checks=%s passing=%s pending=%s failing=%s\n' \
    "$(date -u +%H:%M:%S)" "${check_count}" "${passing_count}" "${pending_count}" "${failing_count}"

  if (( failing_count > 0 )); then
    echo "error: one or more checks failed or were cancelled; refusing to merge" >&2
    jq -r '.[] | select(.bucket == "fail" or .bucket == "cancel") | "- \(.name): \(.bucket) \(.link // "")"' <<<"${checks}" >&2
    exit 5
  fi
  if (( check_count == 0 )); then
    echo "error: no status checks are reported; refusing to merge" >&2
  elif (( pending_count == 0 && passing_count == check_count )); then
    break
  fi

  now="$(date +%s)"
  if (( now - started_at >= TIMEOUT_SECONDS )); then
    echo "error: timed out after ${TIMEOUT_SECONDS}s waiting for status checks" >&2
    exit 6
  fi
  sleep "${INTERVAL_SECONDS}"
done

# Let GitHub re-evaluate branch protection immediately before the merge.
pr="$(pr_json)"
merge_state="$(jq -r '.mergeStateStatus' <<<"${pr}")"
if [[ "${merge_state}" != "CLEAN" && "${merge_state}" != "UNSTABLE" ]]; then
  echo "error: PR merge state is ${merge_state}; refusing to merge" >&2
  exit 7
fi

echo "All status checks passed; merging PR #${PR_NUMBER} with squash merge."
gh pr merge "${PR_NUMBER}" --repo "${REPO}" --squash --delete-branch=false
