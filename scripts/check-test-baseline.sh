#!/usr/bin/env bash
# Compare unit-custom JUnit output against dev/progress/test-baseline-failures.txt.
# See dev/plans/test-baseline-ci.md §5.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE="${GITHUB_WORKSPACE:-$REPO_ROOT}"
LIST_FILE="$REPO_ROOT/dev/progress/test-baseline-failures.txt"

declare -A RESULT_XML=(
	[conversation]="linux-x64-conversation-results.xml"
	[sources]="linux-x64-sources-results.xml"
	[universeAgent]="linux-x64-universeagent-results.xml"
)

missing=()
for domain in conversation sources universeAgent; do
	xml="$WORKSPACE/test-results/${RESULT_XML[$domain]}"
	if [[ ! -f "$xml" ]]; then
		missing+=("$xml")
	fi
done

if ((${#missing[@]} > 0)); then
	echo "error: missing JUnit result file(s):" >&2
	printf '  %s\n' "${missing[@]}" >&2
	exit 1
fi

if [[ ! -f "$LIST_FILE" ]]; then
	echo "note: dev/progress/test-baseline-failures.txt not found; baseline comparison skipped (slice 3 owns the list)" >&2
	exit 0
fi

export WORKSPACE LIST_FILE
for domain in conversation sources universeAgent; do
	export "XML_${domain}=$WORKSPACE/test-results/${RESULT_XML[$domain]}"
done

python3 <<'PY'
import os
import re
import sys
import xml.etree.ElementTree as ET

workspace = os.environ["WORKSPACE"]
list_file = os.environ["LIST_FILE"]
domains = ("conversation", "sources", "universeAgent")
xml_paths = {d: os.environ[f"XML_{d}"] for d in domains}

min_cases: dict[str, int] = {}
max_skipped: dict[str, int] = {}
listed_failures: set[str] = set()

with open(list_file, encoding="utf-8") as f:
    for raw in f:
        line = raw.strip()
        if not line or line.startswith("#"):
            if line.startswith("# min_cases:"):
                for part in line.split(":", 1)[1].strip().split():
                    key, val = part.split("=", 1)
                    min_cases[key] = int(val)
            elif line.startswith("# max_skipped:"):
                for part in line.split(":", 1)[1].strip().split():
                    key, val = part.split("=", 1)
                    max_skipped[key] = int(val)
            continue
        if "::" not in line:
            print(f"error: invalid baseline list line (expected classname::name): {line}", file=sys.stderr)
            sys.exit(1)
        listed_failures.add(line)

actual_failures: set[str] = set()

for domain in domains:
    tree = ET.parse(xml_paths[domain])
    root = tree.getroot()
    testcases = root.iter("testcase")
    case_count = 0
    skipped_count = 0
    for tc in testcases:
        case_count += 1
        classname = tc.get("classname") or ""
        name = tc.get("name") or ""
        key = f"{classname}::{name}"
        if tc.find("skipped") is not None:
            skipped_count += 1
        if tc.find("failure") is not None or tc.find("error") is not None:
            actual_failures.add(key)

    if domain in min_cases and case_count < min_cases[domain]:
        print(
            f"error: {domain} has {case_count} testcase(s), below min_cases={min_cases[domain]}",
            file=sys.stderr,
        )
        sys.exit(1)

    if domain in max_skipped and skipped_count > max_skipped[domain]:
        print(
            f"error: {domain} has {skipped_count} skipped testcase(s), above max_skipped={max_skipped[domain]}",
            file=sys.stderr,
        )
        sys.exit(1)

new_failures = sorted(actual_failures - listed_failures)
if new_failures:
    print("error: new failing test(s) not in baseline list:", file=sys.stderr)
    for item in new_failures:
        print(f"  {item}", file=sys.stderr)
    print("Register in D17 or fix before merging to agent-ide.", file=sys.stderr)
    sys.exit(1)

stale_entries = sorted(listed_failures - actual_failures)
if stale_entries:
    print("error: baseline list contains passing test(s); remove stale line(s):", file=sys.stderr)
    for item in stale_entries:
        print(f"  {item}", file=sys.stderr)
    sys.exit(1)

print("baseline check passed")
PY
