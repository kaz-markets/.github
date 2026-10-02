# kaz-markets/.github

The organization layer: the profile page, the agent rules, and the shared OKF checks.

Knowledge is decentralized. Each repository owns its own bundle under `docs/`, and this
repository owns the rules and the checks that every bundle is held to.

## What is here

| Path | What it is |
|---|---|
| `profile/README.md` | The organization page on GitHub |
| `AGENTS.md` | The canonical agent rules. `sync` writes a copy into each repository |
| `PULL_REQUEST_TEMPLATE.md` | Inherited by every repository that does not define its own |
| `scripts/okf.mjs` | Check and generate a knowledge bundle |
| `scripts/frontend-guard.sh` | Flag a diff that changes the front end |
| `scripts/sync.mjs` | Fan the rules and the caller workflow into each repository as a PR |
| `sync/repos.json` | The manifest: which repositories, whose they are, which paths are front end |
| `actions/okf-check/` | Composite action wrapping `okf.mjs` |
| `actions/frontend-guard/` | Composite action wrapping `frontend-guard.sh` |
| `.github/workflows/okf.yml` | Reusable: frontmatter, index parity, doc freshness |
| `.github/workflows/frontend-guard.yml` | Reusable: flags a front-end diff |
| `.github/workflows/org-index.yml` | Daily: collects each `docs/INDEX.md` into `okf/` |
| `.github/workflows/sync.yml` | Dispatch: rolls the above into the repositories |

## Adopting it in a repository

Add one file, `.github/workflows/okf.yml`:

```yaml
name: okf

on:
  pull_request:

jobs:
  okf:
    uses: kaz-markets/.github/.github/workflows/okf.yml@main

  frontend:
    uses: kaz-markets/.github/.github/workflows/frontend-guard.yml@main
```

Or run `workflow_dispatch` on `sync.yml` and let it open the pull request for you.

## The bundle

- `docs/INDEX.md` is the entry point. Its table lives between `<!-- okf:index:start -->` and
  `<!-- okf:index:end -->` and is written, not hand-edited:
  `node scripts/okf.mjs --write`
- Every other file in `docs/` carries frontmatter with `type`, `title`, `description`,
  `owner`, `tags`, `timestamp` and `code`. `code` is what the freshness check compares.
- `okf.mjs --check --base <ref>` fails a pull request when a diff touches code a doc covers
  and that doc is not in the same diff.

## Secrets

`OKF_TOKEN` is a fine-grained PAT with, on the repositories in `sync/repos.json`:
Contents read and write, and Pull requests write. `org-index.yml` reads private bundles with
it; `sync.yml` needs it to push. Without it, private repositories are skipped.
