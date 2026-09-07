#!/usr/bin/env bash
# Run agent-ide unit-custom three-domain Electron tests, then compare JUnit to the baseline list.
# conversation / sources keep the official single globs (mocha non-zero is ignored until the compare).
# universeAgent is collected once: the 11 Electron-unloadable test/node files (D17) are excluded;
# other test/node files stay in the same --tfs universeAgent invocation so the XML is not overwritten.
# See dev/plans/test-baseline-ci.md §5 and D17 「三域基线红」.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
export GITHUB_WORKSPACE="${GITHUB_WORKSPACE:-$REPO_ROOT}"

# Electron ESM cannot load these 11 (D17). Basename match applies only under test/node/
# so browser/universeAgentConnection.test.ts stays in the run.
UA_NODE_UNLOADABLE=(
	connectionResolver
	deviceAuthHandshake
	deviceGrantCrypto
	hubControlPlane
	hubDirectoryClient
	hubSessionStore
	observeCandidateLeaf
	pairingOrchestrator
	universeAgentChannel
	universeAgentConnection
	universeAgentHubService
)

UA_FILES=()

is_ua_node_unloadable() {
	local rel="$1"
	local prefix="src/vs/platform/universeAgent/test/node/"
	[[ "$rel" == "${prefix}"* ]] || return 1
	[[ "$rel" == *.test.ts ]] || return 1
	local base name
	base="$(basename "$rel" .test.ts)"
	for name in "${UA_NODE_UNLOADABLE[@]}"; do
		if [[ "$base" == "$name" ]]; then
			return 0
		fi
	done
	return 1
}

collect_universeagent_files() {
	local f rel name listed
	local kept_node=0
	UA_FILES=()

	for name in "${UA_NODE_UNLOADABLE[@]}"; do
		listed="$REPO_ROOT/src/vs/platform/universeAgent/test/node/${name}.test.ts"
		if [[ ! -f "$listed" ]]; then
			echo "error: listed Electron-unloadable test missing: $listed" >&2
			return 1
		fi
	done

	while IFS= read -r -d '' f; do
		rel="${f#"$REPO_ROOT/"}"
		if is_ua_node_unloadable "$rel"; then
			continue
		fi
		UA_FILES+=("$rel")
		if [[ "$rel" == src/vs/platform/universeAgent/test/node/* ]]; then
			kept_node=1
		fi
	done < <(find "$REPO_ROOT/src/vs/platform/universeAgent/test" -type f -name '*.test.ts' -print0 | sort -z)

	if ((${#UA_FILES[@]} == 0)); then
		echo "error: universeAgent collection selected 0 test files" >&2
		return 1
	fi
	if ((kept_node == 0)); then
		echo "error: universeAgent collection dropped all test/node files (min_cases would fail)" >&2
		return 1
	fi
	return 0
}

if ! collect_universeagent_files; then
	exit 1
fi

if [[ "${1:-}" == "--print-universeagent" ]]; then
	printf '%s\n' "${UA_FILES[@]}"
	exit 0
fi

set +e
./scripts/test.sh --glob '**/vs/workbench/contrib/conversation/test/**/*.test.js' --tfs conversation
./scripts/test.sh --glob '**/vs/workbench/contrib/sources/test/**/*.test.js' --tfs sources
./scripts/test.sh --tfs universeAgent "${UA_FILES[@]}"
set -e

exec ./scripts/check-test-baseline.sh
