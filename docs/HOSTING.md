---
type: reference
title: "Hosting and the free tier"
description: "Where each piece runs, what it costs nothing to run, and what cannot leave GCP."
owner: dan
tags: [hosting, gcp, github, free-tier, cost]
timestamp: 2026-10-02T05:11:14Z
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
| Store the image | GHCR (`ghcr.io`) | Free and unlimited for public images. Private images count against 500MB storage |
| Any cron | Actions `schedule` | Free, but best-effort: runs can be delayed, and a schedule is disabled after 60 days of repository inactivity. Maintenance only, never anything time-critical |
| Batch work | Actions runners | 2 vCPU, 7GB, 6 hour cap. Simulators, scrapers, migrations, smoke tests |
| Build output, reports | Releases, or Actions artifacts | Artifacts: 500MB, 90 days. Releases: 100MB per file |
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

## What this does not cover

A public container image is free; a private one is not, and Cloud Run cannot pull a private
GHCR image without a registry credential. That trade decides whether an image belongs in GHCR
or Artifact Registry, and it is per image, not a blanket rule.

Quota figures move. Confirm them against the current pricing pages before relying on them.
