---
type: reference
title: "Overnight update, 1-2 October 2026"
description: "Everything that landed across the KAZ repositories overnight, grouped by layer, for Jacob."
owner: dan
tags: [update, hosting, domains, okf, registry]
timestamp: 2026-10-02T06:02:00Z
code: []
---

# Overnight update

Everything below landed between about 20:40 on 1 October and 02:00 on 2 October 2026. Each
item names the pull request in its repository. Two things matter more than the rest: the
**Always Free rule** now governs all infrastructure, and the **OKF doc check is live**, which
changes how a pull request gets merged.

## Read these two first

**1. Infrastructure is Always Free SKUs only.** `AGENTS.md` pins this down in every
repository: GCP free tier means Always Free SKUs, not the $300 / 90-day trial credit. No
Cloud SQL, no Memorystore, no NAT gateway, no fixed-cost load balancer, no committed use.
Scale to zero. One always-on exception, the Always Free `e2-micro`, and it exists solely for
the socket, which cannot run request-billed. Anything paid needs the owner's decision in
writing first. `.github#4`.

**2. The docs check is on.** Each repository's `docs/` is an OKF bundle and CI verifies it. A
diff that touches code a doc covers must include that doc in the same pull request, or the
check fails. `kaz-control` runs it report-only for now; the org layer runs it for real.
`.github#1`, `kaz-control#15`.

## Org layer (`.github`)

This repository is new as the organization's spine: the profile page, the agent rules, and
the shared checks. No secrets live here, deliberately.

| PR | What |
|---|---|
| [#1](https://github.com/kaz-markets/.github/pull/1) | Central OKF checks, `AGENTS.md` agent rules, and `sync.mjs` |
| [#2](https://github.com/kaz-markets/.github/pull/2) | Platform constraints and the org secrets inventory |
| [#3](https://github.com/kaz-markets/.github/pull/3) | Dropped the two workflows that needed a token |
| [#4](https://github.com/kaz-markets/.github/pull/4) | Pinned free tier to Always Free SKUs, carved out the `e2-micro` |
| [#5](https://github.com/kaz-markets/.github/pull/5) | `docs/HOSTING.md`: what runs where and why |
| [#6](https://github.com/kaz-markets/.github/pull/6) | `docs/TASKS.md`: the board, and the no-mentions notification rule |
| [#7](https://github.com/kaz-markets/.github/pull/7) | Fixed the workflow collision in this repository |
| [#8](https://github.com/kaz-markets/.github/pull/8) | `docs/DOMAINS.md` and `.gitignore` |

## Registry: GHCR then Artifact Registry

The concept image first went to GHCR, then both images moved to **Artifact Registry**
(`kaz-control#13`, then `kaz-control#39`). The reasoning and a cleanup policy are still in
review: [`.github#9`](https://github.com/kaz-markets/.github/pull/9).

## kaz-control

| PR | What |
|---|---|
| [#12](https://github.com/kaz-markets/kaz-control/pull/12) | Recovered the concept deploy workflow; repointed refs at `kaz-markets` |
| [#13](https://github.com/kaz-markets/kaz-control/pull/13) | Concept image to GHCR, superseded by #39 |
| [#14](https://github.com/kaz-markets/kaz-control/pull/14) | Player web app served on Cloud Run from a static nginx image |
| [#15](https://github.com/kaz-markets/kaz-control/pull/15) | Turned the bundle check on, report-only |
| [#35](https://github.com/kaz-markets/kaz-control/pull/35) | Ignore build and test output; untracked two committed artifacts |
| [#36](https://github.com/kaz-markets/kaz-control/pull/36) | buildx builder for the GHA layer cache in both deploy workflows |
| [#37](https://github.com/kaz-markets/kaz-control/pull/37) | Pointed the trading doc at code that exists |
| [#38](https://github.com/kaz-markets/kaz-control/pull/38) | Dropped the removed `future` prop from `BrowserRouter` |
| [#39](https://github.com/kaz-markets/kaz-control/pull/39) | Both images to Artifact Registry |
| [#41](https://github.com/kaz-markets/kaz-control/pull/41) | Public services via `--no-invoker-iam-check`, the DRS-safe flag |

## kaz-socket

| PR | What |
|---|---|
| [#1](https://github.com/kaz-markets/kaz-socket/pull/1) | Served the socket: entrypoint, HTTP/WebSocket surface, demo |
| [#2](https://github.com/kaz-markets/kaz-socket/pull/2) | Report links pointed at their new Pages URL |
| [#3](https://github.com/kaz-markets/kaz-socket/pull/3) | OKF bundle and org checks |
| [#4](https://github.com/kaz-markets/kaz-socket/pull/4) | Synced the platform constraints |
| [#5](https://github.com/kaz-markets/kaz-socket/pull/5) | Synced the org rules |
| [#6](https://github.com/kaz-markets/kaz-socket/pull/6) | Synced the Always Free rule |
| [#7](https://github.com/kaz-markets/kaz-socket/pull/7) | Ignore build, coverage and test output |

## prediction-markets-report

| PR | What |
|---|---|
| [#1](https://github.com/kaz-markets/prediction-markets-report/pull/1) | OKF bundle and org check |
| [#2](https://github.com/kaz-markets/prediction-markets-report/pull/2) | Synced the platform constraints |
| [#3](https://github.com/kaz-markets/prediction-markets-report/pull/3) | Synced the org rules |
| [#4](https://github.com/kaz-markets/prediction-markets-report/pull/4) | Synced the Always Free rule |
| [#5](https://github.com/kaz-markets/prediction-markets-report/pull/5) | Ignore Python tooling, coverage and notebook output |

## Domains and hosting (live infrastructure, not a pull request)

`kaz.markets` now reaches GCP. `docs/DOMAINS.md` is the repeatable playbook.

- **Cloud Run service `reports`** in `kaz-markets-prod`, `us-east4`, `min-instances=0`.
- **`reports.kaz.markets`** domain mapping created, `DomainRoutable`, **IAP on**, access
  granted to `domain:kaz.markets`. Reached through a Google sign-in wall.
- **Cloudflare**: `CNAME reports -> ghs.googlehosted.com`, DNS only. The `kaz.markets` zone
  lives in **`Dh@drhamilton.dev`'s** Cloudflare account, not the `admin@kaz.markets` one.
- **One-time build grants**, needed only for in-Cloud-Build `--source` deploys: the default
  compute service account received `storage.objectViewer` on the run-sources bucket and
  `artifactregistry.writer`. CI deploys with Workload Identity Federation and an image
  already pushed do not use them.
- **Cost**: the mapping is free, and Cloud Run at `min-instances=0` is free tier. The real
  ceiling is **1 GiB of egress a month**, about 13,000 loads of the current 82 KB page.

## Open, and what needs a decision

- **`.github#9` is open**: the Artifact Registry decision and cleanup policy needs a read.
- **The `reports` service has no source repository.** It was built from a staging directory,
  so it runs but cannot be redeployed. A `kaz-markets/reports` repository was the agreed
  direction and is not created yet.
- **The `reports.kaz.markets` certificate is still issuing.** Google provisions managed
  certificates asynchronously; DNS is correct, so nothing is blocked on us.
- **The notification webhook is deliberately not built** (`docs/TASKS.md`). No Google Chat
  space exists yet.
- **Backend domain issues `kaz-control#49` through `#58` are open** (auth, wallet, wagers,
  settlement, prediction markets and the rest). They are the migration phases, seeded on the
  org Project as draft items.

## Rules that changed how we work

- Front end (`app/`, `admin/`, `mobile/`, `site/`, `bet105-concept/`) is out of bounds for
  agent work unless the task says otherwise.
- No new vendor, SDK or SaaS without an explicit ask. Define the interface and ship a local
  mock instead.
- Fake players only. No real user data and no real payment data, ever.
- Linear is not used for these repositories. The board is the org Project.
