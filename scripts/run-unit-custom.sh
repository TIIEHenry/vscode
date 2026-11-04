#!/usr/bin/env bash
# Run agent-ide unit-custom domains, then compare fresh JUnit to the baseline list.
# Sources browser and Node tests use their official runners and distinct JUnit domains.
# universeAgent is collected once: the Electron-unloadable test/node files (D17) are excluded;
# other test/node files stay in the same --tfs universeAgent invocation so the XML is not overwritten.
# Those files then run under the Node runner as domain universeAgentNode — they load and pass there,
# so excluding them from Electron must not mean excluding them from the gate.
# See dev/plans/test-baseline-ci.md §5 and D17 「三域基线红」.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
export GITHUB_WORKSPACE="${GITHUB_WORKSPACE:-$REPO_ROOT}"

# Electron ESM cannot load these universeAgent test/node basenames (D17).
# Single source: test/unit/electron/d17-ua-node-unloadable.json
# (renderer.js builds D17_UA_NODE_UNLOADABLE from the same file).
# Basename match applies only under test/node/ so
# browser/universeAgentConnection.test.ts stays in the run.
if ! ua_node_unloadable_lines="$(node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).forEach(name => console.log(name))' "$REPO_ROOT/test/unit/electron/d17-ua-node-unloadable.json")"; then
	echo "error: failed to read test/unit/electron/d17-ua-node-unloadable.json" >&2
	exit 1
fi
mapfile -t UA_NODE_UNLOADABLE <<< "$ua_node_unloadable_lines"
unset ua_node_unloadable_lines

UA_FILES=()
UA_NODE_FILES=()

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
	UA_NODE_FILES=()

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
			UA_NODE_FILES+=("$rel")
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
	if ((${#UA_NODE_FILES[@]} != ${#UA_NODE_UNLOADABLE[@]})); then
		echo "error: expected ${#UA_NODE_UNLOADABLE[@]} Electron-unloadable file(s), collected ${#UA_NODE_FILES[@]}" >&2
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

if [[ "${1:-}" == "--print-universeagent-node" ]]; then
	printf '%s\n' "${UA_NODE_FILES[@]}"
	exit 0
fi

UA_NODE_RUN_ARGS=()
for rel in "${UA_NODE_FILES[@]}"; do
	UA_NODE_RUN_ARGS+=(--run "$rel")
done

SOURCES_NODE_FILES=(
	'src/vs/workbench/contrib/sources/test/node/sourcesLeftoverCatchScan.test.ts'
	'src/vs/workbench/contrib/sources/test/node/sourcesWiringScan.test.ts'
)
SOURCES_NODE_RUN_ARGS=()
for rel in "${SOURCES_NODE_FILES[@]}"; do
	if [[ ! -f "$REPO_ROOT/$rel" ]]; then
		echo "error: listed Sources Node test missing: $rel" >&2
		exit 1
	fi
	SOURCES_NODE_RUN_ARGS+=(--run "$rel")
done
while IFS= read -r -d '' source_test; do
	case "$source_test" in
		"$REPO_ROOT"/src/vs/workbench/contrib/sources/test/browser/*) ;;
		"$REPO_ROOT/${SOURCES_NODE_FILES[0]}"|"$REPO_ROOT/${SOURCES_NODE_FILES[1]}") ;;
		*)
			echo "error: Sources test has no runner route: $source_test" >&2
			exit 1
			;;
	esac
done < <(find "$REPO_ROOT/src/vs/workbench/contrib/sources/test" -type f -name '*.test.ts' -print0)

# Match the official reporters' result-root precedence. Only remove our five files;
# a runner that fails before writing XML must never inherit a previous green result.
RESULT_ROOT="${BUILD_ARTIFACTSTAGINGDIRECTORY:-$GITHUB_WORKSPACE}"
for report in conversation sources sourcesnode universeagent universeagentnode; do
	if ! rm -f -- "$RESULT_ROOT/test-results/linux-x64-${report}-results.xml"; then
		echo "error: cannot remove previous JUnit result for $report" >&2
		exit 1
	fi
done

set +e
./scripts/test.sh --glob '**/vs/workbench/contrib/conversation/test/**/*.test.js' --tfs conversation
./scripts/test.sh --glob '**/vs/workbench/contrib/sources/test/browser/**/*.test.js' --tfs sources
node test/unit/node/index.js --tfs sourcesNode "${SOURCES_NODE_RUN_ARGS[@]}"
sources_node_exit=$?
./scripts/test.sh --tfs universeAgent "${UA_FILES[@]}"
node test/unit/node/index.js --tfs universeAgentNode "${UA_NODE_RUN_ARGS[@]}"
./scripts/check-test-baseline.sh
baseline_exit=$?
set -e

if ((sources_node_exit != 0)); then
	echo "error: Sources Node runner exited $sources_node_exit" >&2
	exit "$sources_node_exit"
fi
exit "$baseline_exit"
