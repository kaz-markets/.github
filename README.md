# kaz-markets/.github

The organization layer: the profile page, the agent rules, and the shared OKF checks.

Knowledge is decentralized. Each repository owns its own bundle under `docs/`, and this
repository owns the rules and the checks that every bundle is held to.

## What is here

| Path | What it is |
|---|---|
| `profile/README.md` | The organization page on GitHub |
| `AGENTS.md` | The canonical agent rules. Each repository carries a copy |
| `PULL_REQUEST_TEMPLATE.md` | Inherited by every repository that does not define its own |
| `scripts/okf.mjs` | Check and generate a knowledge bundle |
| `scripts/frontend-guard.sh` | Flag a diff that changes the front end |
| `scripts/sync.mjs` | Developer machine tool: copies the rules and the caller workflow into a repository |
| `scripts/migrate-captures.mjs` | Upload capture directories to the CDN (Cloudflare R2); captures are not committed |
| `.cursor/mcp.json` | The Cloudflare MCP servers; `sync.mjs` copies it into every repository, so all users get them |
| `sync/repos.json` | The manifest `sync.mjs` reads: which repositories, whose they are, which paths are front end |
| `actions/okf-check/` | Composite action wrapping `okf.mjs` |
| `actions/frontend-guard/` | Composite action wrapping `frontend-guard.sh` |
| `.github/workflows/okf.yml` | Reusable: frontmatter, index parity, doc freshness |
| `.github/workflows/frontend-guard.yml` | Reusable: flags a front-end diff |
| `.github/workflows/agents-guard.yml` | Reusable: fails when a repository's `AGENTS.md` drifts from the canonical copy |

There are only three workflows here, and none needs a secret. Anything that would need one
does not belong in this repository.

## Adopting it in a repository

Add one file, `.github/workflows/okf.yml`:

```yaml
name: okf

on:
  pull_request:
  schedule:
    - cron: "0 6 * * *"

jobs:
  okf:
    uses: kaz-markets/.github/.github/workflows/okf.yml@main

  frontend:
    uses: kaz-markets/.github/.github/workflows/frontend-guard.yml@main

  agents:
    uses: kaz-markets/.github/.github/workflows/agents-guard.yml@main
```

To do it by hand, copy three files: `AGENTS.md`, `scripts/okf.mjs` and `.github/CODEOWNERS`,
then add the caller above at `.github/workflows/okf.yml`. `scripts/sync.mjs` is the same thing
automated for a developer machine:

```bash
GH_TOKEN=<token> node scripts/sync.mjs --dry-run
```

The token is passed in the environment and never stored. That is the trade: no stored secret,
so onboarding a repository is a deliberate act rather than a scheduled job.

## The bundle

- `docs/INDEX.md` is the entry point. Its table lives between `<!-- okf:index:start -->` and
  `<!-- okf:index:end -->` and is written, not hand-edited:
  `node scripts/okf.mjs --write`
- Every other file in `docs/` carries frontmatter with `type`, `title`, `description`,
  `owner`, `tags`, `timestamp` and `code`. `code` is what the freshness check compares.
- `okf.mjs --check --base <ref>` fails a pull request when a diff touches code a doc covers
  and that doc is not in the same diff.

## Secrets

**None.** Nothing in this repository needs a secret. The workflows run on the `GITHUB_TOKEN`
that GitHub issues to every workflow run, scoped to the repository the run is in, or (the
agents guard) a plain HTTPS fetch of the public canonical `AGENTS.md`. That covers everything
a repository does to itself, which is all any check does.

The only automation that cannot use `GITHUB_TOKEN` is one that acts on *another* repository,
because that token cannot push to it or read it when it is private. Both such workflows were
removed: `sync.mjs` runs from a developer machine with a token passed in the environment
instead, and the org-wide index is a job for the GCP service when that exists, not a stored
PAT here.

## Variables for GCP

Organization settings > Secrets and variables > Actions. Variables, not secrets: none of
these is sensitive.

| Name | Meaning |
|---|---|
| `GCP_PROJECT_ID` | The GCP project |
| `GCP_REGION` | The region |
| `WIF_PROVIDER` | The Workload Identity Federation provider |
| `WIF_SERVICE_ACCOUNT` | The deploying service account |
| `VITE_PUBLIC_BASE_URL` | The published base URL for a built front end |

The names match what `kaz-control`'s deploy workflow already reads, so moving them from the
repository to the organization needs no workflow change. They can be set at the organization
level once the GCP project exists, and read per repository with `vars.NAME`.

## Cloud

The platform runs on GCP, **Always Free SKUs only**. That is a narrower thing than the free
tier: the $300 / 90-day trial credit funds any SKU and leaves a bill behind, so it does not
count. The constraint is in `AGENTS.md`; the short version is scale-to-zero, request-billed,
nothing that bills while idle, and exactly one always-on exception, the Always Free
`e2-micro` for the socket.

When a workflow needs to deploy, it authenticates with Workload Identity Federation, never a
service account key.

Builds and images do not need GCP: GitHub Actions is free, and GHCR is free for public images,
which keeps Artifact Registry and Cloud Build out of the picture.

