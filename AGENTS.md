# Agent rules - KAZ

These rules are the organization default. Every repository in `kaz-markets` carries a copy.
The canonical text lives here. A copy ships in each repository, because an agent reads the
copy that sits beside the code. Do not edit a copy: change this file, then run
`scripts/sync.mjs`. The `agents guard` check fails a repository whose copy has drifted.

## The knowledge bundle comes first

A repository's `docs/` folder is its OKF (Open Knowledge Format) bundle: one Markdown file
per concept, YAML frontmatter on top, everything in Git. It is the authoritative answer for
how that repository works. Chat, tickets and memory are not.

Before you answer a question about the platform, or change anything:

1. Read `docs/INDEX.md`. It is one page: every doc, what it covers, whose it is.
2. Open the one doc that matches. Do not answer from memory.
3. If no doc matches, say so, then write it as part of the change.

## The doc is part of the change

A code change that alters behaviour is not done until the matching doc under `docs/` says the
new thing. Same PR, same commit. The `code` field in a doc's frontmatter lists the paths that
doc covers; if your diff touches one of them, that doc is in scope. The `okf` workflow checks
this and fails the PR when it is skipped.

## Front end is out of bounds

`app/`, `admin/`, `mobile/`, `site/` and `bet105-concept/` are the front end. Do not edit
them unless the owner asks for it in that task. Platform, backend, service and `docs/` work
is the work. When a front-end change looks required, stop and say so instead of making it.

## The base app is the product, branding is applied on top

We build one base application and put branding on it, not one app per brand. The base carries
every integration - the routing services, the front-end API packages, the platform - wired and
working, so it is the product. A brand is a name, a logo, colours, copy and a domain applied
to that base at the end. The white label is built in, not bolted on.

- A brand never lives in a code repository. No brand name, logo, colour, copy or domain in
  source; those live in configuration and assets, applied at deploy or runtime.
- A brand never forks the code. Standing up a brand is wiring and configuration, not a branch.
  When a brand seems to need a code change, the base is missing a seam: add the seam to the
  base, so every brand gets it.
- The base and a brand are developed apart, so two developers, two brands, or a brand and the
  base never affect each other.
- Every integration sits behind an interface with a local mock (see Stack), so a new brand or
  a new venue is configuration rather than a rewrite.

This is the lesson from the brands already shipped: the branding belonged on top of a base,
not inside the application.

## Platform constraints

Hard limits, not preferences. If a task cannot be done inside them, stop and say so. Do not
work around them.

### European hosting and bounded cost

Europe is the long-term location requirement for KAZ cloud services. Keep GCP and deploy
services in European regions; the existing Infomaniak servers in Switzerland are also
European infrastructure. A GCP project is not a region: verify each resource's location.

- All signing and venue submission must execute in Europe, with no North American fallback.
- Signing keys, venue credentials, execution state, queues, databases, sensitive logs and
  backups must stay in Europe. Verify external signing providers separately; a European
  relay does not establish where a provider performs cryptographic signing.
- Existing Montreal resources are migration sources, not approved signing destinations.
  Do not disable, delete or redirect running services without a verified cutover that
  preserves in-flight execution and prevents duplicate submissions.
- Prefer bounded, request-billed services where suitable. Persistent venue subscriptions
  need a runtime that supports background execution; do not scale them to zero blindly.
- Do not select a North American resource to obtain a free tier. European regional costs
  must be disclosed; new paid resource types or commitments need the owner's decision.
- Hosting location never replaces venue eligibility, KYC or jurisdiction enforcement.

### Data is minimised

- Feed data is transient. Cache it with a TTL and bound the change log. No long-term feed
  history, no archive, no replay store beyond the resume window.
- Fixtures, seeds, tests and development use fake players, never copied production data.
- Production may use owner-authorized live providers and the minimum user data required.
  Keep raw card and bank details with the authorized payment provider, not in KAZ logs or code.
- Every external capability stays behind an interface with a local mock. Mocks are for
  offline development, not silent substitutes for live production execution.

### Stack

- Front ends: TypeScript.
- Backends: Python microservices.
- Existing TypeScript services are not rewritten to prove the rule. New backend work is
  Python unless the owner says otherwise for that repository.

### The stack is GCP and Cloudflare. No AWS.

AWS is not a KAZ vendor and never becomes one. Do not add an AWS service, SDK, CLI, package
or credential to any repository, and do not read from or write to an AWS account.

- Do not install or depend on the AWS CLI, the AWS SDKs, `boto3`, `aws-sdk`, or anything else
  branded AWS.
- Do not use an AWS credential, profile (`~/.aws`), or role, for KAZ or for anything a KAZ
  task touches. If a machine happens to have AWS configuration, it is not this project's.
- Cloudflare R2 is S3-compatible, and only the protocol is used, through Cloudflare's own
  tooling (Wrangler) with a Cloudflare-scoped token. The AWS client is not that tooling.
- If a task seems to need AWS, stop and say so; it is the owner's decision, and the default is
  no.

### No third party unless asked

Do not add a vendor, SDK, package, SaaS or external API unless the owner asks for it in that
task. No new dependency for something a few lines will do. When an external capability is
genuinely required, define the interface, ship the local mock, and stop.

### Lean, and horizontally scalable

- Services are stateless behind a shared store. No sticky per-process state that breaks when
  a second instance starts.
- Scale out, not up. Nothing assumes exactly one instance except where the code takes a lease
  and says so.
- Bounded memory, bounded queues, bounded logs. Nothing grows without a limit.

### Durable Objects

Cloudflare Durable Objects are allowed only for owner-approved, recorded exceptions. The
socket clause is one such exception: per-venue feed sockets may run as a `VenueFeedDO` (D3)
instead of an always-on VM. The current recorded owner exceptions are:

- D1: the HTTP router may be a Cloudflare Worker, overriding "existing TypeScript services are
  not rewritten".
- D2: `MarketDO` may store per-market books while `kaz-core` computes quotes statelessly.
- D3: one `VenueFeedDO` per venue may hold a long-lived upstream feed socket.

Loops are spend. Every cron trigger and every Durable Object alarm that re-arms is billed
requests each tick, and a fan-out multiplies it. On 2026-10-15 an every-minute bootstrap cron
plus five-second feed alarms issuing one RPC per market per tick drained the 100,000/day
Durable Object free tier in hours.

- Self-scheduling loops have explicit operational controls and documented cost. Preserve
  approved live settings; do not add an off-by-default gate to a required production loop.
- Alarms re-arm from a single code path with a documented floor interval.
- A pull request that adds or tightens a loop states its steady-state requests per day. A loop
  nobody counted is a blocker.

### Live operation

KAZ is preparing for live operation, not a demo-only platform. Owner-authorized live
integrations may use production credentials and submit real customer-authorized orders.
Do not add demo-only gates, switch providers to mock mode, or disable running capabilities
as a default workflow. Preserve authentication, authorization, venue eligibility, risk
limits, idempotency and reconciliation. Never claim an unimplemented provider works merely
because its live flag is set. Agent verification must not place real orders or move funds
without explicit authorization for those actions.

## Running things on GCP

The platform runs on GCP. European placement, cost controls and where each piece runs are in
`docs/HOSTING.md`; hostname wiring is in `docs/DOMAINS.md`; the day-to-day commands are in
`docs/RUNNING-ON-GCP.md`. Three things are rules, not advice:

- **Europe first, bounded cost.** Use European resources and disclose their costs. New paid
  resource types or commitments need the owner's decision; trial credit is not a free tier.
- **Deploy with Workload Identity Federation, never a service-account key.**
- **Captures and galleries are never committed.** Screenshots, QA sweeps and archives live in
  the CDN (Cloudflare R2, `assets.kaz.markets`); git holds code and runtime assets only. See
  `docs/RUNNING-ON-GCP.md` for the upload path.

## Frontmatter

Every file in `docs/` starts with these fields. Keep them true.

```yaml
---
type: design
title: "Trading"
description: "Odds feed, pricing, watchdog and book controls."
owner: dan
tags: [trading, odds, pricing]
timestamp: 2026-10-01T14:05:00Z
code: ["server/src/trading/**"]
---
```

- `type`: `design`, `runbook`, `plan` or `reference`.
- `owner`: the person who keeps it true.
- `timestamp`: when the doc last changed. Do not bump it without changing the doc.
- `code`: the paths this doc describes. `[]` when the doc is a plan with no code yet.

The generated part of `docs/INDEX.md` lives between `<!-- okf:index:start -->` and
`<!-- okf:index:end -->`. Never hand-edit that block; run `okf:write`.

## Is a doc stale?

Compare when the doc last changed with when the code it covers last changed. Code newer than
the doc means the doc is stale.

```bash
git log -1 --format=%cs -- docs/TRADING.md
git log -1 --format=%cs -- 'server/src/trading'
```

## STATUS.md is the only volatile doc

Where a repository has a `STATUS.md`, it is rewritten every session: what is running, what is
paused, what the owner decided. Never append to it, and never let it go a day without an edit.
Everything else in `docs/` is stable and edited in place.

## Report each session

A session ends with a short report to the owner it was run for. An agent working for Jacob
reports to Jacob. An agent working for Dan reports to Dan. This holds for every assistant,
Claude among them.

The report is short and factual: what changed, what is running, what is blocked, and what
needs a decision. Cite the pull request, the issue or the doc instead of restating a diff.

A report is a doc, or a line in `STATUS.md`, not a message. It never mentions a person, and
it never asks for a review, an approval or a merge. The board and the notification rule are
in `docs/TASKS.md`.

## Devin sessions

Devin (Cognition) is an approved third-party agent. It works from the repos the
Devin GitHub app is scoped to and opens PRs like any contributor.

- Branches start from a freshly fetched `origin/main` and are named
  `devin/<n>-<slug>` when the task comes from an issue, `<n>` being the issue
  number.
- Devin never merges its own pull requests: `main` protection requires Dan's
  review. A Devin PR is a proposal, not a deployment.
- With explicit owner authorization, configure existing secrets and signer bindings through
  the deployment's secret manager. Never print secret values, put them in command arguments,
  commit them, or copy production keys into development. Prefer secret references over raw
  key access. CI workflow changes still require an explicit task request.
- Vercel and Cloudflare deploy on merge — a merged PR is a production event.
  Keep PRs small and say in the PR body when a change is deploy-sensitive.
- The front end bounds, docs-first rule and knowledge-bundle rule in this file
  apply to Devin exactly as to any other agent: read `docs/INDEX.md` first, the
  matching doc next, and update the doc in the same PR.
- Use the Devin PR template (`.github/PULL_REQUEST_TEMPLATE/devin_pr_template.md`)
  so review can tell at a glance what ran, what was tested and what is left.

## Ground rules

- Fake players in fixtures and development. Live providers and accounts are permitted for
  owner-authorized production work, subject to the live-operation and European-hosting rules.
- Never commit `.env*`, any `CREDENTIALS.md`, `.data-*` or native build output.
- No em or en dashes, and no bet or wager wording, in player-facing copy.

## Lint, format and structure are checked

One tool per language, configured once in this repository and synced into every other:

- TypeScript is **Biome** (`biome.json`): lint, formatting and import order in one command.
- Python is **ruff** (`ruff.toml`): `ruff check` and `ruff format`.

New and changed code must pass. The lint check reads only the files a pull request changes,
so the standard lands on what you touch, and no one reformats a legacy tree to go green.

The architecture check reads `.dependency-cruiser.cjs`, which holds two rules from this file
as structure: a service never imports the front end, and the front end never imports a
service. Type checks and tests run through the reusable workflows named below.

## The shared checks

- `kaz-markets/.github/.github/workflows/node-ci.yml` - `npm ci`, type check and test one
  Node workspace. Pass `working-directory` and, when a script is absent, `""`.
- `kaz-markets/.github/.github/workflows/python-ci.yml` - the same for a Python package:
  ruff, then pytest.
- `kaz-markets/.github/.github/workflows/lint.yml` - Biome over the files a pull request
  changes.
- `kaz-markets/.github/.github/workflows/arch.yml` - dependency-cruiser over the structural
  rules, and knip as a report.
- `kaz-markets/.github/.github/workflows/okf.yml` - frontmatter, index parity, doc freshness.
- `kaz-markets/.github/.github/workflows/frontend-guard.yml` - flags a front-end diff.
- `kaz-markets/.github/.github/workflows/agents-guard.yml` - fails when a repository's copy of
  `AGENTS.md` has drifted from the canonical file here.
- `scripts/okf.mjs` in this repository is the one implementation. Each repository carries a
  copy, so `node scripts/okf.mjs --write` works locally. Edit it here, never there.
