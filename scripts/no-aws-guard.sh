#!/usr/bin/env bash
# Fail when AWS appears anywhere in a repository.
#
# AWS is not a kaz vendor (AGENTS.md, "The stack is GCP and Cloudflare. No AWS.").
# R2 is S3-compatible and is reached with Cloudflare Wrangler, never the AWS CLI.
#
# This scans the tracked tree, not a diff, so drift is caught even when a change
# slips past review. Run it from the repository root. Exit 1 on any hit.

set -euo pipefail

# High-signal AWS tokens. Case-sensitive on purpose: the lowercase `aws` command
# and the `AWS_` credential names, not prose that happens to say "AWS".
pattern='boto3|@aws-sdk/|aws-sdk/|"aws-sdk"|awscli|aws-cli|AWS_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|SESSION_TOKEN|SECURITY_TOKEN|PROFILE|REGION|DEFAULT_REGION)|amazonaws\.com|\.aws/credentials|(^|[[:space:]])aws[[:space:]]'

# Files that legitimately name the ban, or are the machinery that enforces it.
exclude='^(AGENTS\.md|[^/]*\.md|.*\.mdx|scripts/no-aws-guard\.sh|actions/no-aws-guard/.*|\.github/workflows/no-aws-guard\.yml|\.cursor/hooks\.json|\.cursor/hooks/no-aws\.sh)$'

hits=0
while IFS= read -r f; do
  [ -f "$f" ] || continue
  printf '%s\n' "$f" | grep -Eq "$exclude" && continue
  if grep -InE "$pattern" "$f" >/dev/null 2>&1; then
    grep -InE "$pattern" "$f" | sed "s|^|  $f:|"
    hits=$((hits + 1))
  fi
done < <(git ls-files)

if [ "$hits" -gt 0 ]; then
  echo "::error::AWS is not a kaz vendor. $hits file(s) use AWS tooling, an SDK, a credential or an endpoint. See AGENTS.md, 'No AWS'."
  exit 1
fi

echo "no-aws-guard: clean"
