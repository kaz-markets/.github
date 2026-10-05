---
type: reference
title: "Quality checks"
description: "The shared CI: reusable type-check and test workflows, Biome for TypeScript, ruff for Python, and the architecture rules that hold the AGENTS.md invariants as structure."
owner: dan
tags: [ci, quality, biome, ruff, testing, architecture]
timestamp: 2026-10-05T17:55:00Z
code: [".github/workflows/node-ci.yml", ".github/workflows/python-ci.yml", ".github/workflows/lint.yml", ".github/workflows/arch.yml", "biome.json", "ruff.toml", ".dependency-cruiser.cjs", "scripts/sync.mjs"]
---

# Quality checks

Every repository's checks are reusable workflows in this repository. A repository
does not hand-write steps; it calls the workflow and passes what differs. The rules and
formatter settings are three configuration files synced out by `scripts/sync.mjs`, so the
standard is one place.

## The workflows

| Workflow | What it runs | Call it with |
|---|---|---|
| `node-ci.yml` | `npm ci`, then the workspace's type check and test scripts | `working-directory` |
| `python-ci.yml` | install, `ruff check`, `ruff format --check`, `pytest` | `working-directory` |
| `lint.yml` | Biome over the files a pull request changes | `working-directory` |
| `arch.yml` | dependency-cruiser (blocking) and knip (report) | `working-directory`, `target` |

A caller is three lines:

```yaml
jobs:
  ci:
    uses: kaz-markets/.github/.github/workflows/node-ci.yml@main
    with:
      working-directory: server
```

`node-ci.yml` skips a step whose script name is set to `""`, so the same workflow fits a
service with a suite, a package with only a type check, and a front end with neither.
`npm ci` is the only install path by default; a workspace whose lockfile needs an extra flag
(for example `--legacy-peer-deps`) passes `install-command` instead.

## The standard: one tool per language

- **TypeScript - Biome** (`biome.json`). Lint, formatting and import order in one command.
  Pinned in the workflow at `@biomejs/biome@2.5.15`.
- **Python - ruff** (`ruff.toml`). `ruff check` and `ruff format`. Pinned at `==0.16.10`.

The lint workflow checks **only the files a pull request changes**, against the merge base
(`biome ci --changed --since=<base>`). That is deliberate: the standard lands on new and
changed code, and no pull request has to reformat a legacy tree to go green. Set
`changed-only: false` to check a whole workspace.

## The architecture rules

`.dependency-cruiser.cjs` holds two AGENTS.md invariants as structure, so they hold
regardless of who is editing:

- **service-not-into-front-end** - `server/`, `packages/`, `shared/` must not import
  `app/`, `admin/`, `mobile/`, `site/` or `bet105-concept/`. The front end is out of bounds,
  and the base is the product with branding applied on top.
- **front-end-not-into-service** - the front end talks to a service over its API, never by
  importing it.

It also fails a dependency cycle and reports unresolved imports and orphan modules.

dependency-cruiser parses TypeScript through the project's own compiler, so it must sit
beside it in `node_modules`. The workflow installs it `--no-save --no-package-lock`, which
means no repository gains a dependency and no lockfile changes. Run it the same way locally:

```bash
npm install --no-save --no-package-lock dependency-cruiser@18.5.0
npx --no-install depcruise --config .dependency-cruiser.cjs src
```

knip runs beside it but does not fail the job yet. Its report of dead files, unused exports
and unused dependencies is noisy on a tree that has never been pruned. Tighten it per
repository, then make it blocking there.

## Dependency updates

Dependabot watches the package ecosystems a repository actually has. It is configured per
repository at `.github/dependabot.yml`, because the set of manifests differs.
