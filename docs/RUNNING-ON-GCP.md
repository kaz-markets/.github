---
type: reference
title: "Running on GCP"
description: "How to run, deploy and store things on Google Cloud for KAZ: the free-tier rule, Cloud Run and domain mappings, IAP, Workload Identity Federation, and where captures live."
owner: dan
tags: [gcp, cloud-run, deploy, free-tier, artifacts]
timestamp: 2026-10-05T00:05:00Z
code: []
---

# Running on GCP

This is the operator's page. `docs/HOSTING.md` says where each piece runs and why it is free;
`docs/DOMAINS.md` says how a hostname reaches a service. This page says how to actually run
things, and it is the one place the artifact rules live.

Read `AGENTS.md` first. The constraints there are rules, not advice. The three that matter
most here:

- **No paid SKU without the owner's decision, in writing.** Free tier means Always Free SKUs,
  never the $300 trial credit.
- **Deploy with Workload Identity Federation, never a service-account key.**
- **Captures and galleries are never committed.** They live in the CDN.

## What runs where

The full mapping is in `HOSTING.md`. The short version:

| Workload | Where | Rule |
|---|---|---|
| Builds, images, cron, batch | GitHub Actions, GHCR | Free, and GitHub pauses rather than bills |
| Request-billed services | Cloud Run, `min-instances=0` | Scale to zero; the free tier covers a project this size |
| Anything with a public hostname | Cloud Run domain mapping | Free; a load balancer bills while idle and is banned |
| The socket | Always Free `e2-micro` | The one always-on carve-out; it holds a long-lived connection |
| Captures and galleries | Cloudflare R2, `assets.kaz.markets` | Never in git |
| Build output and reports | Releases / Actions artifacts, or the CDN | Never in git |

## Run a service

```bash
SERVICE=my-service
gcloud run deploy "$SERVICE" \
  --project=kaz-markets-prod --region=us-east4 \
  --min-instances=0 --max-instances=2 --port=8080
```

`--min-instances=0` is what keeps it in the free tier. `--max-instances` is a cap, not a
target: it bounds a spike so it cannot scale without limit. Do not set `min-instances` above
zero; if a workload seems to need it, that is a decision to bring to the owner, not a flag to
flip.

Map a hostname with a Cloud Run domain mapping, then add the record it prints in Cloudflare as
DNS only (grey cloud). `DOMAINS.md` has the exact sequence, including the apex exception and
the fact that a mapping is created once from a verified account.

## Gate a service with IAP

IAP is the login wall and needs no load balancer:

```bash
gcloud beta run services update "$SERVICE" --iap \
  --project=kaz-markets-prod --region=us-east4

gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run --service="$SERVICE" --region=us-east4 \
  --member='domain:kaz.markets' --role='roles/iap.httpsResourceAccessor' \
  --project=kaz-markets-prod
```

The default posture is IAP-gated. A public service is the exception and needs the owner's say;
under Domain Restricted Sharing the only supported way to make one public is
`--no-invoker-iam-check`, which is a demo posture, not the norm.

## Deploy from CI

Workflows authenticate with Workload Identity Federation. The repository variables are
`GCP_PROJECT_ID`, `GCP_REGION`, `WIF_PROVIDER` and `WIF_SERVICE_ACCOUNT`; a repository deploys
by calling the shared deploy action in `kaz-control`. No key file is ever written, and no
service-account key is stored.

## Where captures live

Screenshots, QA sweeps and archives are **not** committed. They are served from a Cloudflare
R2 bucket, `kaz-assets`, published at `assets.kaz.markets`. Keys mirror the repository path:
`kaz-control/app/screens/<file>.png`.

Each repository that used to hold captures lists the moved directories in its `.gitignore`
and keeps a marker `README.md` in each one pointing at the CDN. To add captures:

```bash
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... \
  node scripts/migrate-captures.mjs --repo=<name> --root=<path>
```

The upload runs through Cloudflare's own Wrangler CLI with a Cloudflare token held as GitHub
secrets (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`), never committed. No AWS tooling,
SDK or credential is used; R2 is S3-compatible and Wrangler is the client (see `AGENTS.md`,
"No AWS").

Why R2 and not GCS: R2 has no egress charge and a 10 GB free tier, and Cloudflare is already
in the stack for DNS. GCS in `us-east4` is a small paid SKU, which the free-tier rule treats as
a decision to bring to the owner.

## Troubleshooting quick checks

- A service is billed while idle: it has `min-instances` above zero. Take it to zero.
- A domain will not resolve: the record is proxied (orange cloud). A mapping needs DNS only.
- A deploy fails on the domain step: the mapping must exist once from a verified account.
- `--allow-unauthenticated` "succeeds" but the service stays private: Domain Restricted
  Sharing, expected. Use the invoker-IAM-check disable, not `allUsers`.
