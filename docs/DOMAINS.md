---
type: reference
title: "Domains and Cloud Run mappings"
description: "How kaz.markets is wired from Cloudflare DNS into GCP Cloud Run, how to add a service or a static site, and how IAP gates it."
owner: dan
tags: [gcp, cloudflare, dns, cloud-run, hosting]
timestamp: 2026-10-02T06:25:00Z
code: []
---

# Domains and Cloud Run mappings

`kaz.markets` is registered and its DNS is hosted at Cloudflare. GCP project
`kaz-markets-prod` serves it. There is no load balancer: each subdomain reaches a Cloud Run
service through a Cloud Run **domain mapping**, which is free and needs exactly one DNS record.

Why not a load balancer: a global external HTTPS load balancer bills while idle, which
`AGENTS.md` bans. A domain mapping has no idle cost and scales to zero with the service.

## The shape

```
Cloudflare DNS                       GCP (kaz-markets-prod, us-east4)
  reports.kaz.markets  -- CNAME -->  Cloud Run domain mapping
    ghs.googlehosted.com               reports.kaz.markets
    DNS only (grey cloud)                -> Cloud Run service "reports"
                                           (min-instances 0, IAP gated)
```

The name before the dot in the domain (`reports`) is the DNS record name Cloudflare wants.
Google serves the certificate; it is provisioned only after the record resolves.

## Public access and Domain Restricted Sharing

The organization sets Domain Restricted Sharing
(`constraints/iam.allowedPolicyMemberDomains`) with `allowedValues` of the `kaz.markets`
Workspace customer id (`C0146z9gi`). `allUsers` cannot be granted, so
`--allow-unauthenticated` silently fails to apply.

The default posture is a private service reached by IAP. Under DRS the one supported way to
make a service public is to disable the Cloud Run Invoker IAM check, which bypasses the IAM
gate entirely:

```bash
gcloud run services update "$SERVICE" \
  --project kaz-markets-prod --region us-east4 --no-invoker-iam-check
```

Current exception: `bracco-app` (the player web app) is public this way for the demo. Treat
that as a demo posture, not the norm; every other service stays IAP-gated.

## The app pipeline

`kaz-control` carries one deploy action, `.github/actions/cloudrun-deploy`, that does the
whole job: build the image, push it, deploy, attach the domains, write the DNS records, and
optionally gate the service with IAP. Each app has a thin caller that names its directory and
its hostnames:

| Workflow | App | Service | Domains | Gate |
|---|---|---|---|---|
| `deploy-app.yml` | `app/` | `bracco-app` | `kaz.markets`, `www.kaz.markets` | public |
| `deploy-admin.yml` | `admin/` | `kaz-admin` | `admin.kaz.markets` | IAP |
| `deploy.yml` | `bet105-concept/` | `bet105-skin` | (none yet) | public |

Adding an app is a caller with three values. An author changes code and pushes; the pipeline
does the rest. DNS is written from the mapping's own `status.resourceRecords`, so the records
always match what Google issued, and the step is idempotent.

The pipeline needs two inputs: the repository secret `CLOUDFLARE_API_TOKEN` (Zone/DNS Edit)
and the repository variable `CF_ZONE_ID`.

## Domain verification is per account

A domain mapping can only be created by an account that has the domain verified. `gcloud
domains verify` verifies it for the *user* who runs it, not for the project, so a mapping
created from a developer's terminal works while the same call from the CI service account
fails with "the provided domain does not appear to be verified for the current account".

Practical consequence: **create each new domain mapping once, from a verified account**, then
let the pipeline maintain it. The pipeline's attach step skips a mapping that already exists
and only writes DNS for it, so it stays green. Adding a brand new hostname is therefore a
one-line operator step, not something an app author does.

## Add a service

```bash
SERVICE=my-service
DOMAIN=my-service.kaz.markets

# 1. Deploy it (image built by CI, or --source for a one-off).
gcloud run deploy "$SERVICE" \
  --project kaz-markets-prod --region us-east4 \
  --min-instances=0 --max-instances=2

# 2. Map the subdomain. Prints the DNS record to add.
gcloud beta run domain-mappings create \
  --service "$SERVICE" --domain "$DOMAIN" \
  --project kaz-markets-prod --region us-east4
```

The command prints one line, for example:

```
NAME       RECORD TYPE  CONTENTS
my-service CNAME        ghs.googlehosted.com.
```

Add that in Cloudflare as a **CNAME, DNS only (grey cloud)**. Proxying (orange cloud) hides
the origin from Google and the managed certificate never issues.

A **root domain** is the exception to the CNAME rule: DNS forbids a CNAME at the apex. Map it
the same way and Google prints four `A` and four `AAAA` records instead of one CNAME. Add all
eight, DNS only. `kaz.markets` itself is mapped this way.

## Add a static site

A static site is a Cloud Run service too: nginx serving a directory, scaled to zero. Put a
`Dockerfile` beside the files and deploy from source:

```dockerfile
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html
```

```nginx
server {
  listen 8080;
  root /usr/share/nginx/html;
  index index.html;
  location / { try_files $uri $uri/ =404; }
}
```

```bash
gcloud run deploy my-site --source . \
  --project kaz-markets-prod --region us-east4 \
  --min-instances=0 --max-instances=2 --port 8080
```

Then map the domain exactly as for a service. A site with several reports is one service with
one directory per report (`/summary/`, `/odds/`).

## Gate a service with IAP

IAP is the login wall. It needs no load balancer and works with a domain mapping.

```bash
gcloud beta run services update "$SERVICE" --iap \
  --project kaz-markets-prod --region us-east4

# who gets in (a Workspace domain, a group, or one account)
gcloud iap web add-iam-policy-binding \
  --resource-type=cloud-run --service="$SERVICE" --region=us-east4 \
  --member='domain:kaz.markets' \
  --role='roles/iap.httpsResourceAccessor' \
  --project kaz-markets-prod
```

Turn the gate off with `--no-iap`. With IAP on, the default `*.run.app` URL returns a `302`
to Google sign-in instead of a `403`.

## HTTPS is enforced by Google, not Cloudflare

A Cloud Run domain mapping serves HTTPS with a Google-managed certificate, and the Google
front end answers plain HTTP with a `302` to the `https://` URL. Verified on
`reports.kaz.markets`:

```
http://reports.kaz.markets  ->  302  ->  https://reports.kaz.markets/
```

So a mapped subdomain is HTTPS-only with no Cloudflare setting involved. Cloudflare's
**Always Use HTTPS** toggle does not apply: it acts on proxied (orange cloud) records only,
and a mapping's record has to stay DNS-only for the certificate to issue. Grey-cloud traffic
never reaches Cloudflare, so that toggle would do nothing here.

Browsers can be told to refuse plain HTTP for the host outright with HSTS. Add it at the app
once the certificate is live, not before: HSTS is cached by the browser for its `max-age`, so
enabling it while issuance is still pending would make the host unreachable if anything failed.

```nginx
add_header Strict-Transport-Security "max-age=31536000" always;
```

## The one-time build grants

`gcloud run deploy --source` builds with the project's default compute service account
(`188573475391-compute@developer.gserviceaccount.com`). It needs two grants, both made once:

```bash
gcloud storage buckets add-iam-policy-binding gs://run-sources-kaz-markets-prod-us-east4 \
  --member='serviceAccount:188573475391-compute@developer.gserviceaccount.com' \
  --role='roles/storage.objectViewer' --project kaz-markets-prod

gcloud artifacts repositories add-iam-policy-binding cloud-run-source-deploy \
  --location us-east4 --project kaz-markets-prod \
  --member='serviceAccount:188573475391-compute@developer.gserviceaccount.com' \
  --role='roles/artifactregistry.writer'
```

A normal CI deploy (GitHub Actions, Workload Identity Federation, image already in Artifact
Registry) does not use these grants. They are only for building inside Cloud Build.

## Cost

A domain mapping is free. The service is Cloud Run Always Free while it stays at
`min-instances=0`: 2M requests, 180k vCPU-seconds and 360k GiB-seconds a month. The one real
ceiling is **1 GiB of egress a month** from North America; an 82 KB page is about 13,000
loads. IAP has no charge. DNS is free at Cloudflare.

## Status

- `kaz.markets` (the apex) -> Cloud Run service `bracco-app`, the player web app from
  `kaz-control/app`. Public for the demo via `--no-invoker-iam-check`, not IAP.
- `www.kaz.markets` -> `bracco-app`, the same service as the apex.
- `admin.kaz.markets` -> Cloud Run service `kaz-admin`, the back office from
  `kaz-control/admin`. IAP gated for `domain:kaz.markets`.
- `reports.kaz.markets` -> Cloud Run service `reports`, IAP gated for `domain:kaz.markets`.
- DNS at Cloudflare, in the `Dh@drhamilton.dev's Account` zone, all DNS only:
  `CNAME www`, `CNAME admin`, `CNAME reports` -> `ghs.googlehosted.com`, and at the apex four
  `A` plus four `AAAA` records pointing at the addresses Google returned for the mapping.
- The managed certificates are still provisioning. Google issues them asynchronously once the
  records resolve; this can take from minutes to hours. Nothing else is required on our side.

## What this does not cover

- `www.kaz.markets` maps to the player app; a separate marketing site would need its own
  service and domain.
- `site/` in `kaz-control` is a local-only portfolio rebuild and must not be deployed.
