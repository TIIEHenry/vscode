---
title: "D9 EH probe smoke — panel / terminal / decoration"
type: progress
status: partial
phase: N/A
updated: 2026-09-02
summary: "D9 PARTIAL — git-panel panel views PASS; errorlens decoration PASS; vscode-terminals xterm blocked in automation"
---

# D9 EH secondary probe smoke — 2026-09-02

**Head (loop/A):** `smoke-results.json` · **Launch REPO:** merge worktree

## Probes selected

| Matrix row | Extension | ID | Install |
|------------|-----------|-----|---------|
| `viewsContainers.panel` / `views`(panel) | Git Panel | `zhangmo8.git-panel` | VSIX → `/tmp/d5-probe-ext-vsix` |
| `terminal` profiles·`onStartup` | Terminals Manager | `fabiospampinato.vscode-terminals` | VSIX + `.vscode/terminals.json` `autorun` |
| 命令 + `editor/decoration` | Error Lens | `usernamehw.errorlens` | VSIX |

Wave3 probes (`redhat.vscode-yaml`, `gruntfuggly.todo-tree`, builtin js-debug) remain in the same `PROBE_EXT` seed.

## Run

```bash
REPO=/home/clarence/Projects/Agents/vscode-WorkTrees/merge
A=/home/clarence/Projects/Agents/vscode-WorkTrees/A
bash "$A/dev/progress/d5-evidence/smoke-d9-0001/run-smoke.sh"
```

## Outcome: **PARTIAL**

| Check | Result | Notes |
|-------|--------|-------|
| git-panel → `PANEL_PART` tabs **Git Panel** / views | **PASS** | Panel height 300; tabs Ports · Git Panel · Inspect |
| vscode-terminals autorun / Run → terminal | **FAIL** | No `xterm` / Terminal tab after Ctrl+` + palette. **Blocker:** Playwright CLI cannot reliably open integrated terminal in Agent shell. Needs human smoke. |
| errorlens + `d5-probe-todo.js` syntax error | **PASS** | squiggleDecorations=1; Error Lens inline; End Preview editor |

Evidence: `smoke-results.json`, `panel-probe.json`, `decoration-probe.json`, YAML snapshots.
