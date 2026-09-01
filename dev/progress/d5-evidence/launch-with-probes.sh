#!/usr/bin/env bash
# D5 EH probes: launch Code OSS with YAML + Todo Tree from /tmp/d5-probe-ext-vsix.
# js-debug uses product builtin (VSIX install rejected).
set -euo pipefail

PROBE_EXT="${PROBE_EXT:-/tmp/d5-probe-ext-vsix}"
REPO="${REPO:-/home/clarence/Projects/Agents/vscode-WorkTrees/merge}"
LAUNCH="$REPO/.agents/skills/launch/scripts/launch.sh"

if [[ ! -d "$PROBE_EXT/redhat.vscode-yaml-"* ]] 2>/dev/null; then
	echo "Missing probe extensions in $PROBE_EXT — run code-cli.sh install first." >&2
	exit 1
fi

SEED_UDD=$(mktemp -d /tmp/d5-seed-udd-XXXXXX)
mkdir -p "$SEED_UDD/User"
rsync -a "$PROBE_EXT/" "$SEED_UDD/extensions/"

trap 'rm -rf "$SEED_UDD"' EXIT

exec "$LAUNCH" \
	--repo "$REPO" \
	--source-user-data-dir "$SEED_UDD" \
	--clone-extensions \
	--disable-workspace-trust \
	--skip-prelaunch \
	"$@"
