---
title: "SessionBar compact title and focus verification"
type: reference
status: completed
phase: M7
updated: 2026-10-28
summary: "Title focus restored, <300 lens tabs24px icons free title budget; native Arrow/Home/End key fix, scoped evidence."
---

# Actual change

[Plan §19](../../plans/chatgpt-visual-language.md#19-会话列表与sessionbar可见焦点和compact标题预算2026-10-28), [data/source](20261028-sessionbar-results.json), [main probe](20261028-sessionbar-probe.cjs), [compact keyboard probe](20261028-sessionbar-compact-probe.cjs).

Only SessionBar title focus-visible important precedence, compact (<300 leaf) lens tabs24px icon decoration (commentDiscussion/listTree), full title/aria-label + original text, and existing lens keyboard handler's native `event.key` ArrowLeft/Right/Home/End comparison. CSS at >=300 remains text labels, decorated spans hidden. No engine, roster state/color, Provider or global focus changes. Native key fix was independently reviewed before implementation; initial test incorrectly forged normalized keyCode into DOM event, now real key/code regression.

# Runtime

One blank isolated profile/empty engine-home launch with smoke driver; no engine connection. Actual Light normal, Dark375.5/HC375.5, plus Dark/HC292.5 leaf after opening Sessions sidebar. 1024 window does not imply375.5 leaf: with sidebar it becomes292.5. Fixed Part width752 is probe setup, not default allocation. devicePixelRatio1. Only two TS modules/CSS refreshed under compile lock, current source transforms/output/runtime fetch match; no full build claim.

- Before visible title focus-visible=true but outline none. After normal/Dark/HC title has1px focusBorder inner ring.
- Actual compact before title-wrap0 yet button Tab-reachable, mouse intercepted by neighbor; temporary prototype showed budget, then production after confirmed primary title/input91.5px, secondary title65.5px. Actual Enter enters focused input, Esc cancels without write; title center hit-test true. Two tabs24×24, icons16px/aria-hidden; full accessible names/title remain. Physical ArrowRight selects+focusesTrajectory, Left returnsConversation; Home/End covered by native key unit regression. Native tooltip string exists; external screen reader not exercised.
- Before/after images under `/home/clarence/Projects/Agents/vscode/.build/ui-session-detail-20261028/`: `compact-counterexample.png`, `after-dark-compact-title.png`, `after-dark-compact-rename.png`, `after-hc-compact-title.png`, and `before/after-light-normal-title-focus.png`. Precise production-only diff `theme-only.diff`, baselines `baseline.ts`, `baseline.css`, `baseline-projection.ts`. >=300 text layout remains; exact normal title widths differ with restored active editor layout, so no claim of pixel-identical whole-window allocation.
- Roster unchanged:22px rows,22px More with visible focus, title/meta independently ellipsize, selected background+foreground preserved. Pending count text may truncate at narrow sidebar; waiting bell remains visible and managed hover gives full pending count. This round does not reorder roster status information.

# Checks and limits

SessionBar13passing; existing Lens ARIA test with real native keys red0pass1fail→green1pass. CSS scan39pass2 pre-existing failures unchanged (History/Snapshots old wiring and Provider radius). Targeted four-file types0 with repository options + Node ambient for test assert; no full type-build. ESLint SessionBar/test0 diagnostics; Projection/Lens.test has one pre-existing duplicate-import warning in shared WIP, command nonzero; no new production warning. Runtime keyboard is actual disconnected fixture, no real engine/tools or screen-reader E2E. Other WIP and same-file instance ownership work preserved; integration is owned by the parent. Final independent review/cleanup recorded in plan and results.

Final read-only review C0/I0/M0. docs-health0 errors/37 existing warnings; scoped diff-check passed. Owned Electron323987/Xvfb323931 command identity checked and both confirmed exited. No commit by this agent.
