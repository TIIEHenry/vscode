---
title: "Composer popup Escape focus verification"
type: reference
status: completed
phase: M7
updated: 2026-10-28
summary: "Scoped Add/More/Tools Escape owner restoration: red 1/8, green9, actual normal/narrow focus return; isolated fixture only."
---

# Composer popup Escape focus — 2026-10-27 / closeout 2026-10-28

Scope: default editor Add context / More / shared Tools Esc only. PRD-018验收4、Composer系统规格与方案§17先更新并规则16预审C0/I0/M0；不改CSS、引擎、权限或onHide。

## Actual change

`conversationContextViewEvent.ts` adds one local standard-keyboard Esc listener; close synchronously, compare captured bound session, focus usable actual anchor or same-host textarea. Usable means connected, layout rect present, visibility not hidden/collapse, not native/ARIA disabled. Add/Tools capture passed anchor, so narrow More children return More. Menu actions, outside dismissal and Preferences retain their original paths; no onHide focus manager.

## Evidence

[Results/source hashes](20261027-popup-escape-results.json), [probe](20261027-popup-escape-probe.cjs). Local artifact root `/home/clarence/Projects/Agents/vscode/.build/ui-popup-escape-20261027/`: `theme-only.diff`, `red.log`, `green.log`, `lint.log`, `types.log`, source/before/after JSON. Outputs were refreshed under `/tmp/vscode-compile.lock` only for these modules and test. Runtime-fetched 3 module hashes match outputs and current source transforms. Not a full compile.

- Browser real production renderers with disposable context-view service: original **1 passing / 8 failing**; final current `test/browser/conversationComposerPopup.test.ts` **9 passing**. Assert focus actually enters filter/item before Escape. Covers Add filter/item, More item, More→Add handoff, Tools child + Preferences destination, hidden/detached/disabled owner fallback, changed session no old owner. Tools catalog is a unit test stub only, not injected production engine data.
- Isolated real Electron default editor: Light1440/752 leaf and Dark1024/375.5 leaf; empty seed and engine-home, zoom/devicePixelRatio1, engine disconnected. Before filter Esc and More item Esc → BODY. After real input→Tab→Add item→Esc returns Add (normal) / More (narrow); More item Esc also returns More. Theme geometry/layout intentionally fixed from prior probe, not claimed default startup allocation.
- Before: [normal](/home/clarence/Projects/Agents/vscode/.build/ui-popup-escape-20261027/before-light-normal-returned.png), [narrow](/home/clarence/Projects/Agents/vscode/.build/ui-popup-escape-20261027/before-dark-narrow-returned.png). After: [normal](/home/clarence/Projects/Agents/vscode/.build/ui-popup-escape-20261027/after-light-normal-returned.png), [narrow](/home/clarence/Projects/Agents/vscode/.build/ui-popup-escape-20261027/after-dark-narrow-returned.png). `*-inside.png` shows actual popup focus first. Final narrow image inspected: focus outline visibly on More.
- Targeted TypeScript semantic/syntax diagnostics0 with repository options plus Node ambient for test assert; no full project claim. ESLint3 existing Chrome querySelector/HTMLSelectElement warnings, corresponding original baseline lines312/313/813; no new helper/test warning. No CSS scan rerun because this slice changes no CSS.

## Boundaries

No engine tasks, real registered Tools/Preferences flow or external screen reader E2E. Preferences handoff covered by production click handler + unit destination spy. No broad visual matrix or global focus contract expansion. Production and unrelated WIP preserved; no commit. Final review/cleanup recorded in results and plan§17.3.

Final independent read-only review C0/I0/M0. docs-health0 errors/37 existing warnings; scoped diff-check passed; status182 lines. Owned Electron1250410 and Xvfb1239847 were command-identity checked, terminated and confirmed absent.
