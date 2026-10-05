#!/usr/bin/env node
// Upload capture directories to the CDN (Cloudflare R2), keyed by repository path.
//
//   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
//     node scripts/migrate-captures.mjs --repo=kaz-control --root=app/screens
//   ... --dry-run
//
// Captures are not committed (see docs/RUNNING-ON-GCP.md). This is the one-time
// move and the repeat path for new captures. It uploads with Cloudflare's own
// Wrangler CLI and a Cloudflare token. No AWS tooling, SDK or credential is used:
// R2 is S3-compatible, and Wrangler is the client (see AGENTS.md, "No AWS").
//
// The key layout mirrors the repository path: <repo>/<path/within/repo>.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const arg = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

const repo = arg("repo");
const roots = argv.filter((a) => a.startsWith("--root=")).map((a) => a.slice("--root=".length));
const bucket = process.env.R2_BUCKET ?? "kaz-assets";
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;

if (!repo || roots.length === 0) {
  console.error("usage: migrate-captures.mjs --repo=<name> --root=<path> [--root=<path>...] [--dry-run]");
  process.exit(2);
}
if (!dryRun && (!account || !token)) {
  console.error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required (or pass --dry-run)");
  process.exit(2);
}

const CACHE = "public, max-age=31536000, immutable";

/** Every file under a directory, recursively. */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

let uploaded = 0;
for (const root of roots) {
  if (!existsSync(root)) {
    console.error(`skip: ${root} does not exist`);
    continue;
  }
  const files = walk(root).filter((f) => !f.endsWith(".md"));
  console.log(`upload: ${files.length} file(s) ${root} -> r2://${bucket}/${repo}/${root.replace(/\/$/, "")}/`);

  for (const file of files) {
    const key = `${repo}/${relative(root, file)}`.replace(/\/+/g, "/");
    const target = `${bucket}/${key}`;
    if (dryRun) {
      console.log(`  dry-run ${target}`);
      uploaded += 1;
      continue;
    }
    const res = spawnSync(
      "npx",
      ["-y", "wrangler", "r2", "object", "put", target, "--file", file, "--cache-control", CACHE, "--remote"],
      { stdio: "inherit", env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: account, CLOUDFLARE_API_TOKEN: token } },
    );
    if (res.status !== 0) {
      console.error(`failed: ${file}`);
      process.exit(res.status ?? 1);
    }
    uploaded += 1;
  }
}

console.log(dryRun ? `dry run: ${uploaded} file(s), nothing uploaded` : `uploaded ${uploaded} file(s)`);
