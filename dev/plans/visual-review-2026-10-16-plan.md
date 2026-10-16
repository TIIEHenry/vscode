---
title: "视觉审查 2026-10-16：字重、发丝线、只读分支、零值统计"
type: plan
status: draft
phase: M7
updated: 2026-10-16
summary: "过程折、确认控件与复选框的 500 字重改为 400，发丝线改为 8%，只读分支芯片去掉手型与悬停，零值统计用弱化色。V1 归目录列表切片。V5–V7 未决。未实施。不升 PRD-028。"
---

# 视觉审查 2026-10-16：字重、发丝线、只读分支、零值统计

> **触发：** [视觉设计只读审查 2026-10-16](../progress/visual-review-2026-10-16.md) V2、V3、V4、V8。
> **规范：** [UI 设计原则](../../docs/architecture/cross-cutting/ui-design-principles.md)。字重只用 400 / 600。低对比描边 8%。
> 不升 PRD-028。

## 1. 字重（V2）

`conversationLens.css` 里这四处是 `font-weight: 500`：

- `:1778` 过程折工具名 `.conversation-process-fold-tool-name`
- `:2635` `.conversation-lens-confirmation-message`
- `:2659` 确认动作按钮 `.conversation-lens-confirmation-actions .monaco-button`
- `:4581` `.conversation-lens-checkbox-label`

**改法：** 这四处改为 `400`。`:2628` 的 600 与 `:4587` 选中标签的 600 保持。

**验证：** `conversationLensCssScan.test.ts` 若锁了 `font-weight: 500`，改成锁 `400`，并断言这四个选择器不再出现 `500`。

## 2. 发丝线（V3）

过程折文件卡描边是 `color-mix(in srgb, var(--vscode-foreground) 10%, transparent)`（`conversationLens.css:1791`）。错误回合描边是同一混合的 `12%`（`:4131`）。

**改法：** 两处都改为 `8%`。内边距、圆角、错误标题的 `errorForeground` 不动。

**验证：** CSS 扫描断言这两条规则的混合比例是 `8%`。

## 3. 只读分支芯片（V4）

引擎工作根下 `paintBranch(..., false)` 去掉 `aria-haspopup`，读屏名是 `Git branch: {0}`（`conversationIdentityStrip.ts:308-310`）。元素仍是 `button`。共用规则 `button.conversation-identity-chip` 设了 `cursor: pointer`（`conversationIdentityStrip.css:95-98`），`:hover` 铺 `list-hoverBackground`（`:107-109`）。`onBranchChipClick` 在 `branchMenuEnabled` 为 false 时已经返回。

**改法：** 同一个 `branchChip` 在 `branchMenuEnabled` 为 false 时带上 `conversation-identity-chip-branch--readonly`，为 true 时去掉该类。该类覆盖 `cursor: default`，并在 `:hover` 与 `:active` 上把背景保持透明。读屏名保持现在的只读句。不打开菜单。

**明确不改：** 可切换的本地分支芯片仍用手型、悬停和菜单。

**验证：** `conversationIdentityStrip.test.ts`。引擎工作根下的分支芯片带只读类，没有 `aria-haspopup`，点击不调用菜单。本地工作根下的芯片没有只读类，点击仍打开列表。

## 4. 零值统计（V8）

`fillProcessFoldDiffStats` 把 `+N` 放进 `.conversation-diff-stat-add`，把 `−M` 放进 `.conversation-diff-stat-del`（`conversationProcessFold.ts:539-551`）。过程折在 `:656` 调用，时间线工具行在 `conversationTimelineRenderer.ts:733` 调用。增删色在 `conversationLens.css:4463` 与 `:4467`。`+0` 与 `−0` 也会上色。

**改法：** 数字为 `0` 的那一段不加增删类。弱化色来自统计容器 `.conversation-process-fold-tool-diff-stats` 与 `.conversation-lens-turn-diff-stats` 已有的 `descriptionForeground`（`:4455-4460`）。没有单独的 `.conversation-diff-stat`。非零的一段仍用原来的类。字符串仍是 `+N −M`。

**验证：** `+0 −3` 时加号一段没有 add 类，减号一段有 del 类。`+2 −0` 相反。`+1 −2` 两段都有色类。过程折容器与时间线 `.conversation-lens-turn-diff-stats` 都走这一函数。

## 5. 不在本切片

- V1 Tools 双行归 [cursor-visual-alignment](cursor-visual-alignment.md) S9。
- V5 文件夹芯片的菜单与读屏名、V6 Triggers 按钮组合、V7 错误卡与 file_edit 卡的左缘对齐，都未决。本稿不选。
- 不改 `ui-design-principles.md`。本切片落在已写明的 400/600 与 8% 上。
- 不新增 `transform` 或 `filter`。
