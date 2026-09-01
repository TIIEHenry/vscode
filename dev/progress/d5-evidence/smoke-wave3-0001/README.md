# D5 EH probe smoke wave 3 — 2026-09-02

**Head (loop/A):** see `smoke-results.json` · **Launch REPO:** merge worktree

## Run

```bash
REPO=/home/clarence/Projects/Agents/vscode-WorkTrees/merge
WS=$REPO/dev/progress/d5-evidence/sample-workspace
$REPO/dev/progress/d5-evidence/launch-with-probes.sh -- "$WS"
# Playwright: npx @playwright/cli -s=d5-wave3-<pid> attach --cdp=<port>
```

## Outcome: **PASS** (TODOs activity + js-debug with workspace launch.json)

| Check | Result |
|-------|--------|
| Workbench + sample workspace | PASS |
| Activity **TODOs** → **TODOs: Tree** pane | PASS |
| `d5-probe-debug.js` + F5 **D5 probe debug** | PASS |

Evidence: `smoke-results.json`, `todo-tree.json`, `debug-f5.json`, YAML snapshots (screenshots skipped — playwright-cli path arg quirk).
