---
type: reference
title: "Domains and Cloud Run mappings"
description: "How kaz.markets is wired from Cloudflare DNS into GCP Cloud Run, how to add a service or a static site, and how IAP gates it."
owner: dan
tags: [gcp, cloudflare, dns, cloud-run, hosting]
timestamp: 2026-10-02T05:49:00Z
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

## Public access is off, everywhere

The organization sets Domain Restricted Sharing
(`constraints/iam.allowedPolicyMemberDomains`) with `allowedValues` of the `kaz.markets`
Workspace customer id (`C0146z9gi`). `allUsers` cannot be granted, so **no service can be
made public** and `--allow-unauthenticated` silently fails to apply. This is deliberate. A
service is reached by IAP, not by opening it to the world.

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

- `reports.kaz.markets` -> Cloud Run service `reports`, IAP gated for `domain:kaz.markets`.
- DNS added at Cloudflare: `CNAME reports -> ghs.googlehosted.com`, DNS only, in the
  `Dh@drhamilton.dev's Account` zone.
- The managed certificate is still `CertificateProvisioned: CertificatePending`. Google
  issues it asynchronously once the record resolves; this can take from minutes to hours.
  Nothing else is required on our side.

## What this does not cover

- The apex `kaz.markets` and `www` need A/AAAA records rather than a subdomain CNAME. Add them
  if the root should serve something; nothing is on it today.
- `admin.kaz.markets` (the back office) is a separate decision, not mapped here.
