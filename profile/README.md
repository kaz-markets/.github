# KAZ

**kaz.markets** is a B2B operator platform. One system runs the sportsbook, the
casino, the wallet, bonuses and rewards, affiliates, CRM, customer service and
the back office. Operators are the customers, and each one is configuration on
the same platform rather than a fork of it.

## Infrastructure

| | |
|---|---|
| **Domain** | [kaz.markets](https://kaz.markets) |
| **DNS and hosting** | Cloudflare |
| **Email and identity** | Google Workspace |
| **Back office** | [admin.kaz.markets](https://admin.kaz.markets) |

### admin.kaz.markets

The operator back office. The trading desk, book controls, the ledger, bonuses,
affiliates, CRM and customer service — one tenant per operator, on the same
platform and the same database.

## Repositories

| Repository | What it is |
|---|---|

connections and publishes changes, and the app consumes them. The socket is
never hosted inside the app, and the app never holds a provider connection.

## Getting started

Each repository's own README covers its build and run instructions.

## Sensitive state

Secrets and local state are never committed. No `.env*` file, no
`CREDENTIALS.md`, no local database (`.data-*`), no cache, no `node_modules`,
and no native build output belongs in any repository here. Each repository
carries its own `.gitignore`.
