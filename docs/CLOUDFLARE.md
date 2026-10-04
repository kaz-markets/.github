---
type: reference
title: "Cloudflare agent setup"
description: "The Cloudflare skills and MCP servers for agent work on KAZ: what to install, where the config lives, and how it authenticates."
owner: dan
tags: [cloudflare, mcp, agents, r2, dns]
timestamp: 2026-10-04T18:45:00Z
code: [".cursor/mcp.json"]
---

# Cloudflare agent setup

The Cloudflare agent setup is the skills plus the MCP servers. Skills give an agent the
Cloudflare knowledge; the MCP servers give it scoped, authenticated access to the account
without a long-lived token in a file. `docs/HOSTING.md` and `docs/RUNNING-ON-GCP.md` cover
where things run; this covers the tooling that talks to Cloudflare.

## Install the skills

```bash
npx -y skills add cloudflare/skills --skill '*' --yes --global
```

This installs the Cloudflare skills into `~/.agents/skills` and links them for Cursor. They
cover Workers, R2, D1, Zero Trust, Turnstile and the rest.

## The MCP servers

`.cursor/mcp.json` registers five servers. `sync.mjs` copies that file into every repository,
so everyone working in the project gets the same five.

| Server | What it gives | Auth |
|---|---|---|
| `cloudflare` | the account (R2, DNS, Workers, a broad API surface) | OAuth |
| `cloudflare-bindings` | Workers bindings and resources | OAuth |
| `cloudflare-builds` | Workers Builds | OAuth |
| `cloudflare-observability` | logs and analytics | OAuth |
| `cloudflare-docs` | the public documentation | none |

Every server except `cloudflare-docs` authenticates with OAuth, which triggers in the browser
the first time a Cloudflare tool is used. Restart the agent after adding the config, then
approve the Cloudflare login once.

## Why OAuth rather than an API token

An API token is a long-lived secret that has to be stored, scoped and rotated. The MCP servers
authenticate as the user through OAuth and the grant can be revoked from the Cloudflare
dashboard. Where a token is genuinely needed (R2 uploads from CI, for example), it is a
scoped, short-lived secret held in the platform's secret store, never committed.

## Using R2 from here

Captures live in R2 (`docs/RUNNING-ON-GCP.md`). With the `cloudflare` server authenticated, the
account can be inspected and R2 managed directly, and the bucket and custom domain for
`assets.kaz.markets` are created the same way.

## CLI, optional

Cloudflare's `cf` CLI (`npm install -g cf`) covers the whole API and returns JSON. It is
optional; the MCP servers cover most agent work. If installed, `cf auth login` authorizes it in
the browser.
