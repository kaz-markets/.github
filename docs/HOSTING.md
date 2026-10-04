---
type: reference
title: "Hosting and the free tier"
description: "Where each piece runs, what it costs nothing to run, and what cannot leave GCP."
owner: dan
tags: [hosting, gcp, github, free-tier, cost]
timestamp: 2026-10-02T05:57:00Z
code: []
---

# Hosting and the free tier

Two providers, one rule: GCP **Always Free SKUs**, and GitHub where GitHub is free. The rule
itself is in `AGENTS.md`; this is the mapping.

The split is worth stating plainly because it is not "GCP is the cloud". Most of what a
platform normally pays a cloud provider for is free on GitHub, and only two things are not.

## Where each piece runs

| Job | Where | Free because |
|---|---|---|
| Build a container image | GitHub Actions | 2,000 minutes a month private, unlimited public. Free plan does not overage-bill, it pauses |
| Store the image | Artifact Registry (in-region), or GHCR | Artifact Registry pulls with the project identity; GHCR is free only for public images. See "Where the images live" |
| Any cron | Actions `schedule` | Free, but best-effort: runs can be delayed, and a schedule is disabled after 60 days of repository inactivity. Maintenance only, never anything time-critical |
| Batch work | Actions runners | 2 vCPU, 7GB, 6 hour cap. Simulators, scrapers, migrations, smoke tests |
| Build output, reports | Releases, or Actions artifacts | Artifacts: 500MB, 90 days. Releases: 100MB per file |
| Captures and galleries | Cloudflare R2, `assets.kaz.markets` | 10 GB free, no egress charge. Screenshots and QA sweeps are never committed; see `RUNNING-ON-GCP.md` |
| Static hosting | GitHub Pages | **Public repositories only** on the Free plan. Private repositories need Pro |
| Tickets, roadmap | Issues, Projects | Free |
| The socket | GCP, Always Free `e2-micro` | One per month, `us-central1` / `us-west1` / `us-east1`, 30GB disk, 1GB egress |
| A request-billed service | GCP Cloud Run | 2M requests and 180k vCPU-seconds a month, scale to zero with minimum instances 0 |
| Database, cache, warehouse | GCP | Firestore and BigQuery have real free quotas. Cloud SQL and Memorystore have none |
| Secrets at deploy | GCP Secret Manager | 6 active versions, 10k access operations a month |

## The two things that cannot move to GitHub

- **The socket.** It holds a long-lived upstream connection and needs a stable inbound
  endpoint. An Actions job is capped at 6 hours, has no fixed address, and cannot accept
  inbound. This is the one workload that genuinely needs a host, and it is why the Always
  Free `e2-micro` is carved out in `AGENTS.md`.
- **Persistence.** GitHub has no database. Everything that has to outlive a job stays on GCP.

The private front ends are a third, softer one: Pages needs a public repository on the Free
plan, so a private app cannot be served from GitHub without Pro.

## Two GCP traps

**The trial credit is not the free tier.** The $300 / 90-day credit funds any SKU, including
paid ones. Use it for a paid resource and the bill arrives on day 91, and billing is now
enabled on the project. `AGENTS.md` treats it as absent.

**Hourly resources bill while idle.** A global external load balancer, Cloud SQL and a NAT
gateway all charge whether or not anyone is using them. All three are banned by the rule. A
custom domain on Cloud Run is the one place to check before committing, because some domain
mapping paths sit behind a load balancer.

## Where the images live

Artifact Registry, in the same project and region as the service:
`$GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/<repository>/<image>`. Cloud Run pulls it with the
project identity, so the image stays private and no registry credential is stored. GHCR was
the alternative, but a private GHCR package cannot be pulled by Cloud Run without a
credential; GHCR only helps once an image is public, which is the wrong default for a private
front end.

Artifact Registry's Always Free storage (0.5 GB) covers `us-central1`, `us-east1` and
`us-west1`. The services run in `us-east4`, so image storage there is a small paid SKU. Every
repository carries a cleanup policy so it stays bounded. The policy file is
`infra/artifact-registry-cleanup-policy.json` beside this bundle:

- keep the 5 most recent versions of each package,
- delete untagged versions older than 7 days (the per-build attestation manifests),
- delete anything older than 30 days.

Apply or re-apply it, once per repository:

```bash
gcloud artifacts repositories set-cleanup-policies <repo> \
  --location=us-east4 --project=kaz-markets-prod \
  --policy=infra/artifact-registry-cleanup-policy.json
```

A Keep policy overrides a matching Delete policy, so the recent versions survive the age rules.
The policy is server-side and is not created by Terraform or a workflow; recreating a
repository means re-applying it.

Quota figures move. Confirm them against the current pricing pages before relying on them.
