#!/usr/bin/env bash
# Does this diff touch the front end?
#
#   PROTECTED="app/ admin/ mobile/ site/ bet105-concept/" \
#   MODE=warn BASE=<sha> AUTHOR=<login> ALLOW="jacob" \
#     scripts/frontend-guard.sh
#
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

git fetch --quiet --no-tags origin "$BASE" 2>/dev/null || true

if ! changed="$(git diff --name-only "$BASE"...HEAD 2>/dev/null)"; then
  changed="$(git diff --name-only "$BASE" HEAD 2>/dev/null || true)"
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
