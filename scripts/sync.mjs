#!/usr/bin/env node
// Fan the org OKF files into each repository as a pull request.
//
//   GH_TOKEN=<pat> node scripts/sync.mjs
//   GH_TOKEN=<pat> node scripts/sync.mjs --dry-run
//   GH_TOKEN=<pat> node scripts/sync.mjs --repo=kaz-socket
//
// Run from a checkout of kaz-markets/.github. The manifest is sync/repos.json.
// Each repository gets a copy of AGENTS.md, scripts/okf.mjs, a caller workflow,
// a CODEOWNERS, the shared quality configuration (biome.json, ruff.toml,
// .dependency-cruiser.cjs), and (when bootstrap is set) an empty docs/INDEX.md
// to start.

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const only = argv.filter((a) => a.startsWith("--repo=")).map((a) => a.slice("--repo=".length));

const org = process.env.ORG ?? "kaz-markets";
const token = process.env.GH_TOKEN;
if (!token) {
  console.error("sync: GH_TOKEN is required");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync("sync/repos.json", "utf8"));
const agentRules = readFileSync("AGENTS.md", "utf8");
const okfScript = readFileSync("scripts/okf.mjs", "utf8");
// The Cloudflare MCP servers, so every repository gets the same agent tooling.
const cursorMcp = readFileSync(".cursor/mcp.json", "utf8");
// The shell hook that blocks AWS, and its config, so every repository blocks it too.
const cursorHooks = readFileSync(".cursor/hooks.json", "utf8");
const noAwsHook = readFileSync(".cursor/hooks/no-aws.sh", "utf8");
// The shared quality configuration: one linter and formatter for TypeScript,
// one for Python, and the structural rules the architecture check reads.
const biomeConfig = readFileSync("biome.json", "utf8");
const ruffConfig = readFileSync("ruff.toml", "utf8");
const depCruiseConfig = readFileSync(".dependency-cruiser.cjs", "utf8");

const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const branch = `okf/sync-${stamp}`;

// The caller a repository keeps at .github/workflows/okf.yml. Which jobs it
// carries is per repository, so a bundle-less repository gets only the guard:
//   bundle: false     no docs bundle yet, skip the okf job
//   frontend: false   the repository has no front end to protect
//   bundle: "knowledge"  a bundle directory other than docs/
// The agents job is always present; it is the project-wide rule check.
function callerWorkflow(repo) {
  const lines = ["name: okf", "", "on:", "  pull_request:", "", "jobs:"];

  if (repo.bundle !== false) {
    lines.push("  okf:", "    uses: kaz-markets/.github/.github/workflows/okf.yml@main");
    if (repo.bundle && repo.bundle !== "docs") {
      lines.push("    with:", `      bundle: "${repo.bundle}"`, `      index: "${repo.index ?? "docs/INDEX.md"}"`);
    }
    lines.push("");
  }

  if (repo.frontend !== false) {
    lines.push(
      "  frontend:",
      "    uses: kaz-markets/.github/.github/workflows/frontend-guard.yml@main",
      "    with:",
      `      protected: "${repo.protected ?? ""}"`,
      `      allow-authors: "${repo.allowAuthors ?? ""}"`,
      `      mode: "${repo.mode ?? "warn"}"`,
      "",
    );
  }

  lines.push("  noaws:", "    uses: kaz-markets/.github/.github/workflows/no-aws-guard.yml@main", "");
  lines.push("  agents:", "    uses: kaz-markets/.github/.github/workflows/agents-guard.yml@main", "");
  return lines.join("\n");
}

function starterIndex() {
  return `---
type: reference
title: "Docs index"
description: "Every doc in this bundle: what it covers, whose it is, and the code it describes."
owner: dan
tags: [index, knowledge-bundle]
timestamp: ${new Date().toISOString().replace(/\.\d+Z$/, "Z")}
code: []
---

# Docs index

Read this page first, then open the one doc that matches. If a topic is not here, it is not
documented yet.

<!-- okf:index:start -->

<!-- okf:index:end -->
`;
}

function run(cmd, args, cwd, opts = {}) {
  return execFileSync(cmd, args, { cwd, encoding: "utf8", ...opts });
}

function git(args, cwd) {
  return run("git", args, cwd);
}

function writeIfChanged(file, contents) {
  if (existsSync(file) && readFileSync(file, "utf8") === contents) return false;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, contents);
  return true;
}

const selected = manifest.repos.filter((r) => only.length === 0 || only.includes(r.name));
let opened = 0;

for (const repo of selected) {
  const dir = join(tmpdir(), `okf-sync-${repo.name}`);
  rmSync(dir, { recursive: true, force: true });

  console.log(`sync: ${repo.name}`);
  run("git", [
    "clone",
    "--depth",
    "1",
    `https://x-access-token:${token}@github.com/${org}/${repo.name}.git`,
    dir,
  ]);

  git(["config", "user.name", "kaz-markets bot"], dir);
  git(["config", "user.email", "bot@kaz.markets"], dir);
  git(["checkout", "-b", branch], dir);

  const touched = [];
  if (writeIfChanged(join(dir, "AGENTS.md"), agentRules)) touched.push("AGENTS.md");
  if (writeIfChanged(join(dir, "scripts/okf.mjs"), okfScript)) touched.push("scripts/okf.mjs");
  if (writeIfChanged(join(dir, ".cursor/mcp.json"), cursorMcp)) touched.push(".cursor/mcp.json");
  if (writeIfChanged(join(dir, ".cursor/hooks.json"), cursorHooks)) touched.push(".cursor/hooks.json");
  if (writeIfChanged(join(dir, ".cursor/hooks/no-aws.sh"), noAwsHook)) touched.push(".cursor/hooks/no-aws.sh");
  if (writeIfChanged(join(dir, "biome.json"), biomeConfig)) touched.push("biome.json");
  if (writeIfChanged(join(dir, "ruff.toml"), ruffConfig)) touched.push("ruff.toml");
  if (writeIfChanged(join(dir, ".dependency-cruiser.cjs"), depCruiseConfig)) {
    touched.push(".dependency-cruiser.cjs");
  }
  if (writeIfChanged(join(dir, ".github/workflows/okf.yml"), callerWorkflow(repo))) {
    touched.push(".github/workflows/okf.yml");
  }
  if (writeIfChanged(join(dir, ".github/CODEOWNERS"), `* @${repo.owner}\n`)) {
    touched.push(".github/CODEOWNERS");
  }
  const indexPath = repo.index ?? "docs/INDEX.md";
  if (repo.bootstrap && !existsSync(join(dir, indexPath))) {
    if (writeIfChanged(join(dir, indexPath), starterIndex())) touched.push(indexPath);
  }

  if (touched.length === 0) {
    console.log(`sync: ${repo.name} is already current`);
    continue;
  }

  console.log(`sync: ${repo.name}: ${touched.join(", ")}`);
  if (dryRun) continue;

  git(["add", "-A"], dir);
  git(["commit", "-m", "Add the org OKF checks and agent rules"], dir);
  git(["push", "-u", "origin", branch], dir);

  const body = [
    "@danhamilt",
    "",
    "Brings this repository onto the org knowledge bundle:",
    "",
    ...touched.map((t) => `- \`${t}\``),
    "",
    "The checks are the reusable workflows in `kaz-markets/.github`. The rules are the",
    "canonical `AGENTS.md` there; this repository carries a synced copy.",
    "",
    "The front end is out of bounds unless the task says otherwise.",
  ].join("\n");

  try {
    run("gh", [
      "pr",
      "create",
      "-R",
      `${org}/${repo.name}`,
      "--base",
      "main",
      "--head",
      branch,
      "--assignee",
      "danhamilt",
      "--title",
      "Add the org OKF checks and agent rules",
      "--body",
      body,
    ], dir, { stdio: "inherit" });
    opened += 1;
  } catch {
    console.error(`sync: ${repo.name}: could not open a PR (one may already be open)`);
  }
}

console.log(`sync: ${opened} pull request(s) opened`);
