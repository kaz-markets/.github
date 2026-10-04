#!/usr/bin/env node
// Upload capture directories to the CDN (Cloudflare R2), keyed by repository path.
//
//   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
//     node scripts/migrate-captures.mjs --repo=kaz-control --root=app/screens
//   ... --dry-run
//
// Captures are not committed (see docs/RUNNING-ON-GCP.md). This is the one-time
// move and the repeat path for new captures. It shells out to the AWS CLI, which
// speaks the S3 API R2 exposes, so no SDK is added to the repository.
//
// The key layout mirrors the repository path: <repo>/<path/within/repo>.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const arg = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const repo = arg("repo");
const roots = argv.filter((a) => a.startsWith("--root=")).map((a) => a.slice("--root=".length));
const bucket = process.env.R2_BUCKET ?? "kaz-assets";
const account = process.env.R2_ACCOUNT_ID;
const key = process.env.R2_ACCESS_KEY_ID;
const secret = process.env.R2_SECRET_ACCESS_KEY;

if (!repo || roots.length === 0) {
  console.error("usage: migrate-captures.mjs --repo=<name> --root=<path> [--root=<path>...] [--dry-run]");
  process.exit(2);
}
if (!dryRun && (!account || !key || !secret)) {
  console.error("R2_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required (or pass --dry-run)");
  process.exit(2);
}

const endpoint = `https://${account}.r2.cloudflarestorage.com`;

for (const root of roots) {
  if (!existsSync(root)) {
    console.error(`skip: ${root} does not exist`);
    continue;
  }
  const dest = `s3://${bucket}/${repo}/${root.replace(/\/$/, "")}`;
  const args = [
    "s3", "cp", root, `${dest}/`,
    "--recursive",
    "--exclude", "README.md",
    "--exclude", "*.md",
    "--cache-control", "public, max-age=31536000, immutable",
    ...(dryRun ? ["--dryrun"] : []),
  ];
  if (!dryRun) args.push("--endpoint-url", endpoint);
  console.log(`upload: ${root} -> ${dest}/`);
  const res = spawnSync("aws", args, {
    stdio: "inherit",
    env: { ...process.env, AWS_ACCESS_KEY_ID: key, AWS_SECRET_ACCESS_KEY: secret, AWS_DEFAULT_REGION: "auto" },
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

if (dryRun) console.log("dry run: nothing uploaded");
