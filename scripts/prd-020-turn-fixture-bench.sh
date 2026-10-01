#!/usr/bin/env bash
# PRD-020 turn-fixture bench wrapper. Sets PRD020_BENCH=1, runs the Electron
# bench, and writes the BEGIN_PRD020_BENCH_JSON block into the evidence dir.
# Exit non-zero when the test fails or p50 is over the line. Not a CI job.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PRD020_BENCH=1
short_sha="$(git rev-parse --short HEAD)"
stamp="$(date -u +%Y%m%d-%H%M)"
evidence="$ROOT/dev/progress/prd-020-perf-evidence/${stamp}-${short_sha}"
mkdir -p "$evidence"
export PRD020_EVIDENCE_DIR="$evidence"
export PRD020_BENCH_COMMAND="PRD020_BENCH=1 scripts/test.sh --grep 'PRD-020 turn fixture bench'"

log="$evidence/mocha.log"
set +e
./scripts/test.sh --grep 'PRD-020 turn fixture bench' 2>&1 | tee "$log"
test_status=${PIPESTATUS[0]}
set -e

python3 - "$log" "$evidence/results.json" <<'PY'
import json
import pathlib
import sys

log_path, out_path = sys.argv[1], sys.argv[2]
text = pathlib.Path(log_path).read_text(encoding="utf-8", errors="replace")
begin = "BEGIN_PRD020_BENCH_JSON"
end = "END_PRD020_BENCH_JSON"
start = text.find(begin)
stop = text.find(end, start + len(begin)) if start >= 0 else -1
if start < 0 or stop < 0:
    print("error: bench JSON block missing from mocha log", file=sys.stderr)
    sys.exit(2)
raw = text[start + len(begin):stop].strip()

def unescape_js(value: str) -> str:
    # ELECTRON_ENABLE_LOGGING quotes renderer console.log and escapes the body.
    out = []
    i = 0
    while i < len(value):
        if value[i] == "\\" and i + 1 < len(value):
            n = value[i + 1]
            if n == "n":
                out.append("\n")
            elif n == "r":
                out.append("\r")
            elif n == "t":
                out.append("\t")
            elif n == "u" and i + 5 < len(value):
                out.append(chr(int(value[i + 2:i + 6], 16)))
                i += 6
                continue
            else:
                out.append(n)
            i += 2
        else:
            out.append(value[i])
            i += 1
    return "".join(out)

try:
    payload = json.loads(raw)
except json.JSONDecodeError:
    payload = json.loads(unescape_js(raw))
pathlib.Path(out_path).write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
if payload.get("pass") is not True:
    print(f"error: bench pass is {payload.get('pass')!r} p50={payload.get('p50')!r}", file=sys.stderr)
    sys.exit(1)
PY
extract_status=$?

if [[ "$test_status" -ne 0 ]]; then
	exit "$test_status"
fi
exit "$extract_status"
