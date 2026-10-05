#!/usr/bin/env bash
# Block AWS usage in kaz and OpenBook work.
#
# AWS is not a vendor in either project (AGENTS.md, "The stack is GCP and Cloudflare.
# No AWS."). R2 is reached with Cloudflare Wrangler, never the AWS CLI.
#
# Event: beforeShellExecution. Reads the hook JSON on stdin and denies a command that
# invokes AWS tooling, an AWS SDK, AWS credentials, or an AWS endpoint.
set -euo pipefail

input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.command // empty' 2>/dev/null || true)"

# High-signal AWS tokens only, so ordinary prose and paths do not trip it.
pattern='(^|[;&|[:space:]])(aws|awscli|sam)([[:space:]]|$)|boto3|@aws-sdk/|aws-sdk/|"aws-sdk"|AWS_(ACCESS_KEY_ID|SECRET_ACCESS_KEY|SESSION_TOKEN|SECURITY_TOKEN|PROFILE|REGION|DEFAULT_REGION)|amazonaws\.com|~/\.aws|\.aws/credentials'

if printf '%s' "$cmd" | grep -Eq "$pattern"; then
  cat <<'JSON'
{
  "permission": "deny",
  "user_message": "Blocked: AWS is not a kaz or OpenBook vendor. See AGENTS.md (No AWS).",
  "agent_message": "AWS is banned in kaz and OpenBook: no AWS CLI, SDK, credential or endpoint. R2 is S3-compatible but is reached with Cloudflare Wrangler, not the AWS CLI. Do not retry with AWS tooling."
}
JSON
  exit 0
fi

echo '{ "permission": "allow" }'
exit 0
