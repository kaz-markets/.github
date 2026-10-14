// Starts Devin sessions from GitHub issues.
// Usage: node .github/scripts/devin.mjs agent <review> [pr]
// Env: DEVIN_API_KEY, DEVIN_ORG_ID (repo secrets), GH_TOKEN, GITHUB_REPOSITORY.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const API = `https://api.devin.ai/v3/organizations/${process.env.DEVIN_ORG_ID}`;
const REPO = process.env.GITHUB_REPOSITORY;
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" });
const devin = async (path, init = {}) => {
  const r = await fetch(`${API}${path}`, { ...init, headers: { Authorization: `Bearer ${process.env.DEVIN_API_KEY}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`Devin ${path} ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
};

const RULES = `Repository: ${REPO}. Read GEMINI.md first and follow it exactly.
Work on a new branch and open a pull request that says "Closes #ISSUE" in its description. Never push to main.
Keep the change to this one task. Ensure node scripts/okf.mjs is run before finishing.
If something is unclear or blocked, comment on the issue (gh issue comment) instead of guessing.`;

// Standing agents: a scheduled or event-driven Devin session with a fixed playbook (.github/agents/<name>.md).
// Each run opens a tracking issue (labels agent, agent:<name>) so every run is visible and deduped.
const AGENT_TITLES = { review: "First-pass review of PR #" };
async function agent(name, target) {
  if (!AGENT_TITLES[name]) throw new Error(`unknown agent ${name}`);
  const title = name === "review" ? `[Agent] ${AGENT_TITLES.review}${target}` : `[Agent] run ${name}`;
  // Skip if the same run is already open (one review per PR).
  const open = JSON.parse(gh("issue", "list", "--repo", REPO, "--label", `agent:${name}`, "--state", "open", "--json", "number,title", "--limit", "50"));
  if (open.some(i => i.title === title)) { console.log(`${name}: already running (${open.map(i => "#" + i.number).join(", ")})`); return; }
  
  const playbook = readFileSync(new URL(`../agents/${name}.md`, import.meta.url), "utf8").replaceAll("TARGET", String(target ?? ""));
  const url = gh("issue", "create", "--repo", REPO, "--title", title, "--label", "agent", "--label", `agent:${name}`, "--label", "devin:started",
    "--body", `Standing agent run: ${name}${target ? ` (PR #${target})` : ""}. Playbook: .github/agents/${name}.md`).trim();
  const issue = url.split("/").pop();
  const prompt = `${RULES.replaceAll("ISSUE", issue)}

This is a standing agent run, tracked by issue #${issue} (${url}). Only open a pull request if the playbook below asks for one, and never let a PR close the tracking issue; comment your summary on the tracking issue and close it yourself when done.

${playbook}`;
  const s = await devin("/sessions", { method: "POST", body: JSON.stringify({ prompt }) });
  gh("issue", "comment", issue, "--repo", REPO, "--body", `Devin session started: ${s.url}`);
  console.log(`${name} -> #${issue} ${s.url}`);
}

const [cmd, arg, arg2] = process.argv.slice(2);
if (cmd === "agent") await agent(arg, arg2);
else { console.error("usage: agent <name> [pr]"); process.exit(1); }
