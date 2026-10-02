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
| **kaz-control** | The platform and the product: the player web app, the native iPhone app, the platform server (ledger, pricing, trading, casino, bonuses, affiliates, messaging, wallet), the operator back office, the marketing site, and the shared packages. The concept book lives inside it as `bet105-concept/`. |
| **kaz-socket** | The always-on prediction-market feed edge. Holds the upstream provider connections, keeps a live price cache with a TTL, and fans changes out on sequence-numbered rooms. The inbound half of the two-repo stack. |
| **prediction-markets-report** | The published architecture plan and API survey behind `kaz-socket`. Public, at <https://danhamilt.github.io/prediction-markets-report/>. |

A price reaches a page in two halves: `kaz-socket` holds the provider
connections and publishes changes, and the app consumes them. The socket is
never hosted inside the app, and the app never holds a provider connection.

## Getting started

Each repository's own README covers its build and run instructions.

## Sensitive state

Secrets and local state are never committed. No `.env*` file, no
`CREDENTIALS.md`, no local database (`.data-*`), no cache, no `node_modules`,
and no native build output belongs in any repository here. Each repository
carries its own `.gitignore`.
