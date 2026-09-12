---
title: "Conversation chrome 可见性：Maximize 门控/Stop 与窄宽 SAS"
type: plan
status: accepted
phase: N/A
updated: 2026-09-12
summary: "两则 P1 布局 hide 吞中断铬条：Maximize 藏 fail/Stop（D403）；窄宽 Back 藏已挂 SAS 盒（D404）。方案稿，未实施。"
---

# Conversation chrome 可见性

> **slice_id**：`conversation-chrome-visibility`  
> **冲突域**：D403 = lens dock CSS；D404 = Connection pane 布局。可并行，推荐串行 D403 → D404。  
> **本稿是方案，不是实施**：不改 `src/`。主笔不自宣 Architecture-First Approve。规则 16 + Arch-First must-fix 已改入。  
> **不扩** 2026-09-12 P2/P3 UI 扫描其余项（无 D 行则只留 chat）。

## Problem class

- **症状**：① Maximize 后 Failed Send / 断连 gate 文案与 Stop 消失。② 窄宽 Connection 在 SAS 已挂时点 Back，配对盒消失。
- **类标签**：**布局模式把中断铬条当成可卸 chrome**（祖先 `display:none` 覆盖子树里仍 live 的门控 / 停止 / 配对）。
- **复发机制**：为腾输入区或切窄导航写无例外祖先 hide；测只锁 `hidden=false` 或「不在 inactive-zone 内」，不锁「祖先不被布局 hide」。D42 只修 Trajectory 铺行，留下 dock 两条 hide。`attachPairingConfirmHostToVisibleZone` 只防 zone hide，不防 detail hide。
- **防复发**：布局 hide **不得**盖住仍 live 的中断铬条；测锁 class 合同与「可见祖先」，而不是行号字符串或 `host.style.display`。

## 代码基线（worktree A `858525439a5`）

| 证据 | 事实 |
|:-----|:-----|
| `conversationLens.css` L2268–2274 | Maximize 无条件 `display:none` gate-row；无可见 pending 时 hide 整段 inbox overlay（Stop 在 overlay 右簇） |
| [conversation-empty-hero](conversation-empty-hero.md) §3.4 | 已实施句：「Maximize 输入时隐藏浮层」。本切片**取代**该 hide，使 Stop 仍可见 |
| `conversationLensDisposeGate.test.ts` L2136–2153 | `showPostFailure('failed')` 只锁 `gateRow.hidden === false`，不锁 Maximize |
| `conversationLens.test.ts` L2222–2253 | Maximize 只锁 class toggle，不锁 gate / Stop 可见 |
| `conversationLensCssScan.test.ts` L18–23 | 只锁 D42 trajectory hide，**不**扫 maximize→gate/overlay |
| `connectionPreferencesPane.ts` L490–500 / L706–709 | `pairingConfirmHost` append 到 `scrollBody`；`scrollBody` 在 `.connection-preferences-detail` 内 |
| 同文件 L821–827 / L835–854 / L1372–1373 | `selectZone` 在宽 <600 设 `narrowShowingDetail=true`；`attach…` **先** `selectZone(activeZoneId)`；Back → `showNarrowNav` → 藏 detail |
| `connectionPreferencesPane.css` L136–138 | `.is-narrow:not(.is-showing-detail) .connection-preferences-detail { display: none }` |
| `connectionPreferencesPane.test.ts` L1002–1015 / L234–251 | Back 锁去掉 `is-showing-detail`；SAS 锁 zone 旁可见，**无**窄宽 Back 格 |

## Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A Maximize 不 hide 中断铬条；live host 由 `sync` 按 chrome 旗重挂** | D403：删 L2268–2274。D404：拆 `syncPairingConfirmHostParent()`（只 remount，**永不** `selectZone`）。 | **选定。** 消祖先 hide 覆盖 live 中断；D42 / pairing 产品面不动 |
| B 用更长 `:has` 例外 | 继续祖先 hide，再补选择器 | **拒绝。** 复发机制就是漏写例外 |
| C 中断铬条迁出 dock / 改成 modal | 大搬 DOM | **拒绝。** 超出可见性切片 |
| D 重开 D42 或 Hub pairing 产品 | 当新功能做 | **拒绝。** D42 已闭；本刀不是 pairing 功能 |

## 选定设计与不变量

**D403。** Maximize **只**放大输入区，**不得**有 `.conversation-lens-input-maximized` 规则对 `.conversation-lens-dock-gate-row` 或 `.conversation-lens-inbox-overlay` 写 `display:none`。Gate 空态仍走 `updateGateRow` / `showPostFailure` 的 `hidden`。空 overlay（queue / goal / pending / disabled Stop；HEAD **无** Task chip）露出是本切片接受的 UX；**不用** `:has` 例外。本切片**取代** [conversation-empty-hero](conversation-empty-hero.md) §3.4「Maximize 输入时隐藏浮层」，两份 accepted/implemented 方案不得 silently 冲突。

**D404 remount 所有权。** 拆 `syncPairingConfirmHostParent()`：**只**按当前 chrome 旗 remount，**禁止**调用 `selectZone`。今日 `attachPairingConfirmHostToVisibleZone` 以 `this.selectZone(this.activeZoneId)` 开头（L1372–1373）；宽 <600 时 `selectZone` 会把 `narrowShowingDetail=true` 并再露 detail——若从 Back / `showNarrowNav` 调 attach，会撤销 Back，打红既有 L1002–1015。Connect 起步仍可 `selectZone` **再** `sync`。`sync` 的调用点：`applyNarrowChrome` 与 `selectZone` **在 chrome 旗写完之后**；attach 在可选的 `selectZone` 之后。不变量：host **live**（含 `.connection-pairing-confirm` 或 `style.display !== 'none'`）且窄宽且 `!is-showing-detail` → parent 是 pane 根 / body 子且在 `.connection-preferences-detail` **外**；否则保持 zone sibling（`activeZone.nextElementSibling === host`）。按 host **liveness** remount，不按 `sasCode`。recoverTrust 共用此 host；「不改 recoverTrust」= 不改 confirm / cancel / fingerprint API，**不是**把 host 留在被藏的 detail 里。不改 Connect / Test / pairing 产品流。不需要 ADR。

## 触点 / 非目标 / 验证

| | |
|:--|:--|
| **触点** | D403：`conversationLens.css` L2268–2274；`conversationLensCssScan.test.ts`。D404：新 `syncPairingConfirmHostParent`；`attach…` / `selectZone` / `applyNarrowChrome`；`connectionPreferencesPane.test.ts`（注入与生产相同的窄宽 detail hide）。 |
| **非目标** | pending-chip CSS 重绘；Sessions ViewTitle New chrome；leftover-looks-live 程序；D8/D147；F3/A2/U2；发明 proto；D16 切片 1；引擎仓（D26）；WriteGitUnstage；`requestDetail`/`fillHistory`；`bindLiveTree`/`acquireLease`；Hub Connect/Test/pairing **功能**（只动已挂 host 可见性）；P2/P3 扫描其余项 |
| **验证** | 无窗 mocha。`scripts/test.sh --run` 上述两测。无活窗、无 gulp、不 compile-client。 |

## 切片

| Slice | Goal | Files | Tests | Exit |
|:------|:-----|:------|:------|:-----|
| **D403** | 删 Maximize 对 gate-row / inbox overlay 的 hide | `conversationLens.css`；CssScan | **class 合同**：无 `.conversation-lens-input-maximized` 规则可 `display:none` gate-row 或 inbox-overlay。**不**锁 L2268–2274 字符串。D42 三断言仍绿 | Maximize 不再 CSS-hide fail/Stop |
| **D404** | 窄宽 Back 后 live host 在 detail 外 | `sync` + attach / `selectZone` / `applyNarrowChrome`；pane 测 | 599px + live host + Back：`!detail.contains(host)`（可选 detail computed `display:none`）。**禁止**只断言 `host.style.display !== 'none'`。宽栏 / showing-detail 仍走 `assertSasVisibleBesideActiveZone` | live host 不被窄导航藏 |

## 硬禁

pending-chip CSS restyle · Sessions ViewTitle New chrome · leftover-looks-live 程序 · D8/D147 · F3/A2/U2 · 发明 proto · D16 切片 1 · 引擎仓（D26）· WriteGitUnstage · `requestDetail`/`fillHistory` · `bindLiveTree`/`acquireLease` · Hub Connect/Test/pairing 功能（超出 SAS host 可见性）· 活窗 · gulp · 从 Back 调会 `selectZone` 的 attach

## 开放问题

无阻塞。空 overlay 露出已接受；若日后要藏空 overlay，另开 D 行，本刀不用 `:has`。
