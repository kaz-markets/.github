---
type: reference
title: "European hosting and bounded cost"
description: "European placement for KAZ cloud services, signing, execution state and secrets, with bounded operating costs."
owner: dan
tags: [hosting, gcp, github, europe, cost]
timestamp: 2026-10-29T00:00:00Z
code: ["AGENTS.md"]
---

# European hosting and bounded cost

Europe is the long-term requirement for KAZ cloud servers. Keep GCP and use European
regions; the existing Infomaniak servers in Switzerland are also European infrastructure.
The owner authorized live integrations and European hosting on 2026-10-29. The previous
US-only Always Free VM exception and blanket demo-only rules no longer apply.

## Placement

A GCP project is not regional. Check the location of each deployed resource, including its
storage and backups. A European Cloud Run service does not relocate its database, image
registry, Secret Manager replicas or log bucket.

| Workload | Required placement |
| --- | --- |
| Signing and venue submission | European runtime, no North American fallback |
| Signing keys and venue credentials | European secret storage and processing |
| Execution ledger, idempotency, queues and reconciliation | European storage and runtime |
| Sensitive logs and backups | European regional storage; redact credentials and private keys |
| Container images and deployment resources | European regional resources |
| External wallet signing provider | Verify provider processing and key residency separately |

Stockholm (`europe-north2`) is a candidate for the execution relay. Confirm availability,
venue permission and networking for the actual deployment before selecting it. Switzerland
is geographically European but is not an EU jurisdiction; EU-only residency would be a
separate requirement. Server location never overrides customer eligibility or venue rules.

## Existing resources and cutover

Montreal resources are migration sources, not approved signing destinations. Inventory
services and their dependencies before changing traffic. Preserve in-flight orders, use
shared durable idempotency where appropriate, and ensure only the intended executor owns
submission. Do not disable or delete a running service as a default migration step.

A deployment is not live-ready merely because it starts: verify the credential bindings,
ledger location, authenticated caller, signing provider and venue connectivity. Do not
submit a real order or move funds as an agent verification step without explicit approval.

## Cost and execution lifecycle

Prefer bounded, request-billed services when appropriate. Persistent venue WebSockets and
background reconciliation require a runtime with CPU and instance lifetime appropriate to
that workload; scaling a subscriber to zero is not a general cost fix.

European hosting can incur regional compute, image storage, networking, log and secret
charges. Disclose the resource choices and costs. New paid resource types and commitments
need the owner's decision. Trial credit is not an ongoing free tier, and a North American
free resource is not an acceptable substitute for European placement.

## Images and secrets

Use regional Artifact Registry repositories in the same project and European region as the
service: `$GCP_REGION-docker.pkg.dev/$GCP_PROJECT_ID/<repository>/<image>`. Bound image
retention with a reviewed cleanup policy. Do not delete existing images during cutover.

Deploy from CI with Workload Identity Federation, not service-account key files. Configure
secrets using secret-manager references and least-privilege runtime identities. Never put
secret values in source, logs, chat or command arguments. Automatic global replication is
not proof of European residency; inspect the actual replication policy before binding a
secret to a European service.
