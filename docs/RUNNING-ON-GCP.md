---
type: reference
title: "Running on GCP"
description: "European GCP deployments, live-operation cutovers, authentication, regional storage and secret bindings."
owner: dan
tags: [gcp, cloud-run, deploy, europe, artifacts]
timestamp: 2026-11-01T00:00:00Z
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

Builds and deployments running inside Cloud Build use an attached service account and
Google-issued short-lived credentials. They do not depend on a workstation's user login.
External automation uses Workload Identity Federation when an approved identity provider
is available. Neither path uses a downloaded service-account key. Local impersonation
still depends on the source user's login and does not bypass reauthentication policy.

The keyless identities provisioned in `kaz-markets-prod` on 2026-11-01 are:

| Account prefix | Purpose | Access |
| --- | --- | --- |
| `kaz-build-ci` | Pull request and main-branch checks | Log writer only; no production secrets, deployment or runtime impersonation |
| `kaz-build-deploy` | Trusted deployment builds | Log writer, writer on the Stockholm `kaz` image repository, act-as on the three runtime accounts only; service update grants await bootstrap |
| `kaz-feed-runtime` | European catalogue and push feed | No project roles or secret access provisioned yet |
| `kaz-core-runtime` | European quote service | No project roles or secret access provisioned yet |
| `kaz-execution-runtime` | European execution service | No project roles or secret access provisioned yet |

Each prefix expands to `<prefix>@kaz-markets-prod.iam.gserviceaccount.com`. None has a
user-managed key. Grant runtime access only to the specific European secrets and services
that the implemented workload requires, not project-wide Secret Accessor or Editor.

The custom `kazRunDeployer` role permits service updates and service-status reads, not
creation, deletion, invocation or IAM policy administration. It has no project-level
binding. Bootstrap the actual European services using an authorized administrator, then
grant this role directly on each approved service. Do not attach it project-wide. A
Stockholm validation-only create request failed under proposed resource-name conditions;
those ineffective bindings were removed rather than widened. No validation service was
created. The deployment identity cannot act as the default Compute account. Public access
configuration, if required, remains an owner-controlled bootstrap operation.

All 16 existing `<repo>-pr` and `<repo>-main` Cloud Build triggers now use `kaz-build-ci`,
not the default Compute runtime identity. These triggers are checks, not deployment
pipelines. Never attach the privileged deployment identity to an untrusted pull request
trigger or a build configuration controlled by one.

Stockholm build `46240f4d-8908-4509-bf35-d7f58e457180` passed the attached CI identity
and permission checks. Build `cb89829d-703d-4d66-91dd-f503f3f813b9` passed the final
attached deployment identity, three runtime act-as bindings, European artifact upload,
and absence of project deployment, IAM administration and secret-access permissions.
The post-change trigger detector found no trigger using another identity; user-managed
key listings for all five accounts were empty. These smoke checks do not assert that
an application deployment pipeline or runtime secret bindings are complete.

### Migration state

The existing GitHub connection, its regional OAuth secret reference and the 16 repository
triggers are still in `northamerica-northeast1`. No credentials were copied or read to
move them. The Stockholm Artifact Registry repository is
`europe-north2-docker.pkg.dev/kaz-markets-prod/kaz`. New identity smoke builds run in
`europe-north2`; they use Cloud Logging and contain only technical account/permission
results, not user data or secrets. The project's current default log bucket is global;
sensitive production logs require a verified European destination before cutover.

The runtime accounts are prepared for the European deployment, not attached to existing
Montreal services. Existing services, default-account grants, legacy federation bindings
and secret replication policies are unchanged. The current core service token is still
Montreal-replicated. Source-connection migration, European secret/log bindings, trusted
main-branch deployment configuration and production cutover remain part of the approved
market-serving implementation; creating these accounts does not claim those are shipped.

Keep internal execution endpoints authenticated; live operation does not mean anonymous
order submission. Hostname and access mechanisms are documented in `DOMAINS.md`; verify
their regional support rather than copying a legacy US command.

## Captures and galleries

Screenshots and galleries remain outside git. The existing CDN is Cloudflare R2,
`assets.kaz.markets`. Public captures must not contain credentials or real user/payment
data. Sensitive logs and execution evidence require verified European storage, not an
unverified global bucket. Use Cloudflare tooling for R2, never AWS credentials or SDKs.
