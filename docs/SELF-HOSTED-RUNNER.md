---
type: runbook
title: "Self-hosted runner on kaztools"
description: "The Swiss GitHub Actions runner: why it exists, how it is registered, which repositories may use it, and how a repository opts in."
owner: dan
tags: [ci, runner, infomaniak, security, kaztools]
timestamp: 2026-10-20T06:30:00Z
code: [".github/workflows/runner-smoke.yml", "infra/self-hosted-runner/install-runner.sh"]
---

# Self-hosted runner on kaztools

GitHub-hosted runners execute on GitHub's infrastructure, outside Switzerland. A private
repository's source is checked out there for the length of a job. The kaztools runner keeps
that work on a box KAZ owns, in the Infomaniak Swiss region, with no inbound port and no
dependency on GitHub's queue beyond a long poll.

This is a **runner**, not a CI server. GitHub still schedules the work, holds the secrets and
shows the logs. The box only executes the steps.

## The host

| | |
|---|---|
| Instance | `kaztools`, Infomaniak Public Cloud |
| Address | `37.156.47.23` |
| Size | 1 vCPU / 2 GB / 50 GB (`a1-ram2-disk50-perf1`) |
| OS | Ubuntu 24.04 LTS |
| Already on it | SearXNG, valkey, Caddy (port 80/443), Docker |
| Runner | `/opt/actions-runner`, user `ghrunner`, systemd service |
| Network | Outbound only. No port is opened for the runner; `ufw` is unchanged |

The runner is registered at organization level, so one registration serves every repository
in the group. It is **not** registered per repository.

## Isolation: the runner group is the boundary

The runner joins the organization runner group **`swiss-private`**, restricted to selected
private repositories. The public `kaz-markets/.github` repository is deliberately **not** in
the group.

That is not bookkeeping. A self-hosted runner attached to a public repository will execute a
fork pull request's code on the box, including any secret the workflow exposes. The group is
what prevents that; the default group reaches every repository and must not be used.

Rules that follow from it:

- Add a repository to the group only when it is **private**.
- Never set a workflow in a public repository to `runs-on: kaztools`.
- A repository in the group can run code on the box. Membership is a security decision, not
  a convenience one.

## Registration

One-time, in this order.

1. **Create the group** (organization owner): Org Settings -> Actions -> Runner groups ->
   New runner group, name `swiss-private`, repository access `Selected repositories`, tick the
   private repositories. Leave the public `.github` repository unticked.
2. **Mint a registration token** on the Mac. It needs the `admin:org` scope and is valid for
   one hour:

   ```bash
   gh auth refresh -h github.com -s admin:org
   gh api -X POST /orgs/kaz-markets/actions/runners/registration-token --jq .token
   ```

3. **Install on kaztools**, as root, from the box:

   ```bash
   curl -fsSL -o /tmp/install-runner.sh \
     https://raw.githubusercontent.com/kaz-markets/.github/main/infra/self-hosted-runner/install-runner.sh
   sudo bash /tmp/install-runner.sh
   ```

   The script prompts for the token, so it never enters shell history. It verifies the runner
   tarball's SHA-256, creates the `ghrunner` user, configures the runner into `swiss-private`
   with the `kaztools` label, and installs the systemd unit
   `actions.runner.kaz-markets.kaztools-1.service`.

4. **Verify** in Org Settings -> Actions -> Runners: `kaztools-1`, label `kaztools`, status
   Idle, group `swiss-private`. Then run **Actions -> runner smoke -> Run workflow**. The job
   runs on the box and prints its hostname, memory and tools.

The runner pins `actions/runner` **2.338.0** and its SHA-256 in the script. Bump both together.

## Opting a repository in

Every shared workflow takes a `runner` input, defaulting to `ubuntu-latest`. A repository
opts in by naming the label:

```yaml
jobs:
  ci:
    uses: kaz-markets/.github/.github/workflows/python-ci.yml@main
    with:
      working-directory: kaz-core
      runner: kaztools
```

Pass **one label**. `runs-on` matches a runner that carries every label requested, and
`kaztools` is enough; the default `self-hosted`, `linux` and `x64` labels are still on the
runner.

Nothing else changes. The workflows install Node and Python themselves through
`actions/setup-*`, so the host carries no language toolchain and a toolchain upgrade is a
workflow change, not a box change.

## Capacity

The box is 1 vCPU / 2 GB with a 2 GB swap file, shared with the search stack. The runner
executes **one job at a time**; a second job queues at GitHub.

- `npm ci` is the heaviest step and is the one to watch. If jobs start swapping or timing
  out, resize the instance to `a2-ram4-disk50-perf1` (2 vCPU / 4 GB, the same disk) in
  Horizon: stop, resize, start. Nothing on the box needs reinstalling.
- Keep long or resource-hungry jobs (image builds, end-to-end suites) on `ubuntu-latest`
  until the box is resized.
- Concurrency beyond one runner means a second runner, on a second box. Do not register two
  runners on kaztools.

## What stays off this box

- **kazauth.** Authentik is the identity plane, and the runner executes repository code. A
  compromised job must not sit next to the IdP, so kazauth never hosts a runner.
- **Deploys with cloud credentials.** The Cloud Run deploy stays on `ubuntu-latest` with
  Workload Identity Federation: no service-account key exists to put on a box. Moving it here
  means installing gcloud and accepting that a job can reach the deploy identity; do that
  only with a documented reason.
- **Secrets that outlive the job.** A repository's secrets are readable by its workflows on
  this runner, exactly as on a hosted one. Runner-group membership is the control.

## Lifecycle

- **Update the runner**: stop the service, replace the directory with the new tarball, run
  `./config.sh` against the existing registration, start the service. The service unit name
  does not change.
- **Re-register** (name collision, lost credentials): `sudo RECONFIGURE=1 bash
  /tmp/install-runner.sh` with a fresh token.
- **Remove**: `./svc.sh stop && ./svc.sh uninstall`, then `./config.sh remove --token` with a
  fresh removal token, and delete the runner entry in the GitHub UI.
- **The box is disposable.** Nothing on it is the only copy of anything: the runner is
  reproducible from this doc, and the search stack has its own compose files.

## Verification

- `systemctl status actions.runner.kaz-markets.kaztools-1`
- Org Settings -> Actions -> Runners: Idle
- Actions -> runner smoke: green, with `runner=kaztools-1` in the log
- A private repository with `runner: kaztools` whose CI job logs the same runner name
