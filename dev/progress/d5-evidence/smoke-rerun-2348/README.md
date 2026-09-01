---
title: "D5 EH probe smoke rerun 2348"
type: progress
status: archived
phase: N/A
updated: 2026-09-01
summary: "D5 rerun FAIL — yaml PASS; todo + debug FAIL (merge compile)"
---

# D5 EH probe smoke rerun — 2026-09-01 23:48 (merge compile)

**Head (loop/A):** `991853eb` · **Compile/Launch REPO:** merge worktree

## Run

- `REPO=/home/clarence/Projects/Agents/vscode-WorkTrees/merge dev/progress/d5-evidence/launch-with-probes.sh -- /tmp/d5-probe-sample.yaml`
- Playwright: `npx @playwright/cli -s=d5-merge-rerun-2348 attach --cdp=...`

## Outcome: **FAIL** (yaml PASS; todo + debug FAIL)

Workbench boot **fixed** vs `smoke-20260901` (stale A `out/`). YAML LSP squiggle observed. Todo Tree activity container not visible; js-debug F5 did not start session.

See `smoke-results.json` for matrix.
