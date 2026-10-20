#!/usr/bin/env bash
# Install the kaztools GitHub Actions runner as a systemd service.
#
# On kaztools, as root:
#
#   curl -fsSL -o /tmp/install-runner.sh \
#     https://raw.githubusercontent.com/kaz-markets/.github/main/infra/self-hosted-runner/install-runner.sh
#   sudo bash /tmp/install-runner.sh
#
# The script prompts for an organization registration token. Mint it on the Mac
# (it needs the admin:org scope) and paste it at the prompt, so it never enters
# shell history:
#
#   gh api -X POST /orgs/kaz-markets/actions/runners/registration-token --jq .token
#
# The token is valid for one hour and is not written to disk by this script.
# The runner keeps its own long-lived credentials in $RUNNER_HOME after config.
#
# The runner is registered into a runner group, not into the default group. The
# default group reaches every repository including the public .github one, and
# a self-hosted runner on a public repository will execute fork pull requests.
# The group is the isolation boundary; it must exist before this script runs.
#
# Environment overrides: RUNNER_VERSION, RUNNER_SHA256, ORG, RUNNER_NAME,
# RUNNER_LABELS, RUNNER_GROUP, RUNNER_HOME, RUNNER_USER, WITH_DOCKER=1.
set -euo pipefail

RUNNER_VERSION="${RUNNER_VERSION:-2.338.0}"
RUNNER_SHA256="${RUNNER_SHA256:-af4b794c1bc41d73d40535e3fe092a39f9679cd8d965954c2aca25a05ca41d32}"
ORG="${ORG:-kaz-markets}"
RUNNER_NAME="${RUNNER_NAME:-kaztools-1}"
RUNNER_LABELS="${RUNNER_LABELS:-kaztools}"
RUNNER_GROUP="${RUNNER_GROUP:-swiss-private}"
RUNNER_HOME="${RUNNER_HOME:-/opt/actions-runner}"
RUNNER_USER="${RUNNER_USER:-ghrunner}"
TARBALL="actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"
URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/${TARBALL}"
UNIT="actions.runner.${ORG}.${RUNNER_NAME}.service"

die() { echo "install-runner: $*" >&2; exit 1; }
say() { echo "==> $*"; }

[ "$(id -u)" -eq 0 ] || die "run as root: sudo bash $0"
command -v curl >/dev/null || die "curl is required"
command -v tar >/dev/null || die "tar is required"

if ! id -u "$RUNNER_USER" >/dev/null 2>&1; then
  say "creating the $RUNNER_USER system user"
  useradd --system --user-group --create-home --home-dir "$RUNNER_HOME" --shell /usr/sbin/nologin "$RUNNER_USER"
fi

if [ -x "$RUNNER_HOME/run.sh" ]; then
  say "runner ${RUNNER_VERSION} already unpacked in $RUNNER_HOME"
else
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  say "downloading ${TARBALL}"
  curl -fsSL -o "$tmp/$TARBALL" "$URL"
  echo "${RUNNER_SHA256}  ${tmp}/${TARBALL}" | sha256sum -c -
  mkdir -p "$RUNNER_HOME"
  tar -xzf "$tmp/$TARBALL" -C "$RUNNER_HOME"
  chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_HOME"
  say "installing the runner's own dependencies"
  ( cd "$RUNNER_HOME" && ./bin/installdependencies.sh )
fi

run_as_runner() {
  ( cd "$RUNNER_HOME" && runuser -u "$RUNNER_USER" -- env HOME="$RUNNER_HOME" "$@" )
}

if [ -f "$RUNNER_HOME/.runner" ]; then
  if [ "${RECONFIGURE:-0}" != "1" ]; then
    say "already registered; reinstalling the service only (set RECONFIGURE=1 to re-register)"
    ( cd "$RUNNER_HOME" && ./svc.sh install "$RUNNER_USER" )
    ( cd "$RUNNER_HOME" && ./svc.sh start )
    systemctl --no-pager --full status "$UNIT" || true
    exit 0
  fi
  say "re-registering: stopping the service"
  ( cd "$RUNNER_HOME" && ./svc.sh stop || true )
  ( cd "$RUNNER_HOME" && ./svc.sh uninstall || true )
  rm -f "$RUNNER_HOME/.runner" "$RUNNER_HOME/.credentials" \
    "$RUNNER_HOME/.credentials_rsaparams" "$RUNNER_HOME/.path" "$RUNNER_HOME/.env"
fi

if [ -z "${RUNNER_TOKEN:-}" ]; then
  [ -t 0 ] || die "RUNNER_TOKEN is unset and there is no terminal to prompt on"
  read -rsp "org registration token: " RUNNER_TOKEN
  echo
fi
[ -n "$RUNNER_TOKEN" ] || die "empty registration token"

say "registering in group '$RUNNER_GROUP' with labels '$RUNNER_LABELS'"
run_as_runner ./config.sh \
  --url "https://github.com/${ORG}" \
  --token "$RUNNER_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels "$RUNNER_LABELS" \
  --runnergroup "$RUNNER_GROUP" \
  --unattended \
  --replace

if [ "${WITH_DOCKER:-0}" = "1" ]; then
  say "adding $RUNNER_USER to the docker group"
  usermod -aG docker "$RUNNER_USER"
fi

say "installing and starting the service"
( cd "$RUNNER_HOME" && ./svc.sh install "$RUNNER_USER" )
( cd "$RUNNER_HOME" && ./svc.sh start )

say "service state"
systemctl --no-pager --full status "$UNIT" || true
say "done. The runner should show as Idle under Org Settings -> Actions -> Runners."
say "smoke test: Actions -> runner smoke -> Run workflow."
