---
type: reference
title: "Running on GCP"
description: "European GCP deployments, live-operation cutovers, authentication, regional storage and secret bindings."
owner: dan
tags: [gcp, cloud-run, deploy, europe, artifacts]
timestamp: 2026-10-29T00:00:00Z
code: []
---

# Running on GCP

Read `AGENTS.md` and `HOSTING.md` first. KAZ keeps GCP, with Europe as the long-term
location requirement. The project is not regional; inspect each resource's location.

## Before deploying

- Inventory the current image digest, runtime identity, environment variable names, secret
  references, storage, networking and callers without printing secret values.
- Choose a European region supported by the workload. Stockholm (`europe-north2`) is a
  candidate for venue execution, subject to verified venue and account requirements.
- Signing and submission have no North American fallback. Their keys, credentials,
  execution ledger, queues, sensitive logs and backups must remain in Europe too.
- Verify external signing-provider residency separately. A European API client does not
  relocate a provider's signing infrastructure.
- Use an existing approved runtime identity with least-privilege secret access and
  authenticated service-to-service invocation. Do not create service-account key files.
- Disclose costs for new resources. European location takes precedence over a North
  American free tier; new paid resource types and commitments need an owner decision.

## Deployment and cutover

Use a digest-pinned image in a European Artifact Registry repository. Deploy the European
service without modifying Montreal traffic, then verify its configuration and authenticated
read-only health endpoints. Keep the approved live provider configuration; do not substitute
mock providers or introduce demo-only flags.

A stateless HTTP service may scale to zero. Persistent venue subscriptions and background
reconciliation need suitable CPU allocation and instance lifetime, which can incur idle
charges. Do not change running minimum instances as an unsolicited cost optimization.

Before changing callers, verify durable idempotency, in-flight order reconciliation,
execution ownership and every signing/submission route. Cloud Run instance limits alone do
not prevent overlapping revisions or duplicate venue execution. Never retry an uncertain
submission as a new intent. Do not delete or disable Montreal services as a default cutover
step, and do not route signing back there as a rollback.

A live-ready verification is not permission for an agent to place a real order or move funds.
Those actions need explicit authorization. Missing partner credentials or an unimplemented
payment adapter are named blockers, not something a live flag can repair.

## Regional dependencies

Inspect Secret Manager replication policies; automatic global replication is not proof of
European residency. Bind pinned secret versions, not raw values in arguments or source.
A secret's location does not establish the location of the database named inside it.

Inspect database and queue locations, log buckets, retention, backups, build storage and
image registry locations separately. Moving a Cloud Run service does not move these.
Document external stores and any residency blockers before cutover.

## CI and access

Deploy from CI using Workload Identity Federation, never a service-account key. Keep
`GCP_PROJECT_ID`, `GCP_REGION`, `WIF_PROVIDER` and `WIF_SERVICE_ACCOUNT` consistent with the
European target. Keep internal execution endpoints authenticated; live operation does not
mean anonymous order submission. Hostname and access mechanisms are documented in
`DOMAINS.md`; verify their regional support rather than copying a legacy US command.

## Captures and galleries

Screenshots and galleries remain outside git. The existing CDN is Cloudflare R2,
`assets.kaz.markets`. Public captures must not contain credentials or real user/payment
data. Sensitive logs and execution evidence require verified European storage, not an
unverified global bucket. Use Cloudflare tooling for R2, never AWS credentials or SDKs.
