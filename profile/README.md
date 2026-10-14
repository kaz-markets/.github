# KAZ

**kaz.markets** is Web3 liquidity infrastructure: a non-custodial routing
and settlement layer for tokenized assets on Solana. One system aggregates
decentralized venues and routes each order to the venue — or split of
venues — that delivers the best execution. Every transaction is signed and
settled on-chain; we never take custody of funds.

## Infrastructure

| | |
|---|---|
| **Domain** | [kaz.markets](https://kaz.markets) |
| **DNS and edge** | Cloudflare |
| **Production** | Google Cloud (Canada) |
| **Email and identity** | Google Workspace |

## Repositories

| Repository | What it is |
|---|---|
| **kaz-control** | The platform and the product: the web app, the native iPhone app, the platform server, the operator console, the marketing site, and the shared packages. |
| **kaz-socket** | The always-on market-data edge. Holds the upstream venue connections, keeps a live price cache with a TTL, and fans changes out on sequence-numbered rooms. |
| **kaz-routing-service** | The routing engine: venue equivalence, pathfinding, and all-in quote calculation for routed orders. |
| **kaz-shared** | Shared, dependency-light Node utilities for the KAZ services. |

A quote reaches a page in two halves: `kaz-socket` holds the venue
connections and publishes changes, and the app consumes them. The socket
is never hosted inside the app, and the app never holds a venue
connection.

## Getting started

Each repository's own README covers its build and run instructions.

## Sensitive state

Secrets and local state are never committed. No `.env*` file, no
`CREDENTIALS.md`, no local database (`.data-*`), no cache, no
`node_modules`, and no native build output belongs in any repository here.
Each repository carries its own `.gitignore`.
