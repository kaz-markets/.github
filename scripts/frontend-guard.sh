#!/usr/bin/env bash
# Does this diff touch the front end?
#
#   PROTECTED="app/ admin/ mobile/ site/ bet105-concept/" \
#   MODE=warn BASE=<sha> AUTHOR=<login> ALLOW="jacob" \
#     scripts/frontend-guard.sh
#
# On a pull request also pass BASE_REF=<base branch> HEAD_SHA=<pr head sha>;
# the diff is then the PR's commits against the current base branch.
# MODE=fail exits non-zero. The owner login in ALLOW passes untouched.

set -euo pipefail

PROTECTED="${PROTECTED:-app/ admin/ mobile/ site/ bet105-concept/}"
MODE="${MODE:-warn}"
BASE="${BASE:-}"
AUTHOR="${AUTHOR:-}"
ALLOW="${ALLOW:-}"

if [ -n "$ALLOW" ]; then
  IFS=',' read -ra allowed <<<"$ALLOW"
  for entry in "${allowed[@]}"; do
    entry="$(printf '%s' "$entry" | xargs)"
    if [ -n "$entry" ] && [ "$entry" = "$AUTHOR" ]; then
      echo "front-end guard: $AUTHOR owns the front end; nothing to flag"
      exit 0
    fi
  done
fi

if [ -z "$BASE" ] || [ "$BASE" = "0000000000000000000000000000000000000000" ]; then
  echo "front-end guard: no base commit to compare against; skipping"
  exit 0
fi

HEAD_SHA="${HEAD_SHA:-HEAD}"
BASE_REF="${BASE_REF:-}"

# On a pull request, diff the PR's own commits against the base branch as it
# is now. A base sha captured when the PR was opened goes stale as soon as
# another PR lands, and HEAD is GitHub's synthetic merge commit, so a diff
# from that sha would blame this PR for everything merged since.
if [ -n "$BASE_REF" ]; then
  git fetch --quiet --no-tags origin "$BASE_REF" 2>/dev/null || true
  if merge_base="$(git merge-base FETCH_HEAD "$HEAD_SHA" 2>/dev/null)"; then
    BASE="$merge_base"
  fi
fi

git fetch --quiet --no-tags origin "$BASE" 2>/dev/null || true

if ! changed="$(git diff --name-only "$BASE"..."$HEAD_SHA" 2>/dev/null)"; then
  changed="$(git diff --name-only "$BASE" "$HEAD_SHA" 2>/dev/null || true)"
fi

hits=""
for prefix in $PROTECTED; do
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    case "$file" in
      "$prefix"*) hits="${hits}${file}"$'\n' ;;
    esac
  done <<<"$changed"
done

if [ -z "$hits" ]; then
  echo "front-end guard: no front-end paths in this diff"
  exit 0
fi

echo "front-end guard: this diff changes the front end:"
printf '%s' "$hits" | sed '/^$/d' | sed 's/^/  - /'
echo "AGENTS.md: do not edit the front end unless the owner asked in that task."

if [ "$MODE" = "fail" ]; then
  exit 1
fi

printf '::warning title=Front-end change::%s\n' \
  "$(printf '%s' "$hits" | sed '/^$/d' | paste -sd', ' -)"
exit 0
