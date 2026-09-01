# D5 EH probe smoke — 2026-09-01 (slot A)

**Head:** `5e565223` · **Branch:** `loop/A` · **REPO:** worktree A

## Run

- Probe extensions: `/tmp/d5-probe-ext-vsix` (YAML + Todo Tree)
- Launch: `REPO=A merge/dev/progress/d5-evidence/launch-with-probes.sh` with sample `/tmp/d5-probe-sample.yaml`
- Automation: `npx @playwright/cli` from merge worktree, `tab-select 1` for workbench page

## Outcome: **FAIL** (workbench boot)

CDP came up (`launch.json`) but renderer threw:

`IPreferencesEditorPane` missing from compiled `preferencesEditorPaneRegistry.js` — **stale `out/`** relative to source fix `bd2b8872`.

EH/UI probe checks could not run. Extension folders were cloned into the launch profile (see `launch.json` / log paths in `smoke-results.json`).

## Artifacts

| File | Purpose |
|------|---------|
| `launch.json` | Launcher metadata (pid, ports, dirs) |
| `smoke-results.json` | PASS/FAIL matrix |
| `dom-*.json`, `*.json` | Playwright DOM probes (empty workbench) |
| `screenshots/` | Viewport captures (blank shell) |
| `smoke-run*.log` | CLI transcript |

**Matrix:** `eh-surface-matrix.md` not updated (smoke did not pass).
