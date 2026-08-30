---
title: "B2 Spike T1–T3：对照本仓代码的事实"
type: reference
status: accepted
phase: N/A
updated: 2026-08-30
summary: "S1 三个硬测试点在默认 Layout 与 Sessions 窗口上的已验证事实；纠正「Editor 不可藏」并标出互斥不变量冲突"
---

# Spike T1–T3：代码事实

spike 原文：`code-oss-b2-topology-spike.md` §3.3。本页 **不**代替 Go/Kill，只写当前树能观察到的事实。

## T1 — grid 接受非 editor 的中心 Part

| 窗口 | 事实 | 结论 |
|------|------|------|
| 默认 `Layout.createGridDescriptor` | 中心叶写死 `Parts.EDITOR_PART` | **未通过**。S1 必须改描述符 + `arrangeMiddleSectionNodes` |
| Agents Window | `SESSIONS_PART` 已是非 editor 中心；叶不是 editor group | **存在性已证**：`SerializableGrid` + 自定义 Part **可以**当中心 |
| `Parts` 枚举 | 已有 `SESSIONS_PART` / `CUSTOM_VIEW_GRID_PART` | 加枚举值是已有扩展模式；默认窗口未把它们编进 `createGridDescriptor` |

**Kill-driver 收窄：** 难的不是 Grid 类，是默认 `Layout` 里数十处「中间 = editor」的 focus / neighbor / maximize / 序列化。样例代码在 `src/vs/sessions/browser/`（`sessionsPart.ts`、sessions 自己的 layout host），不能直接 import 进 workbench（反向分层禁止）。

S1 最小证明：默认 Code 窗口启动后，中心 DOM 对应新 Part，文件仍走 `IEditorService.openEditor` 出现在 **End 列 tabs**，且 URI 不是 `ChatEditorInput`。

## T2 — `EditorPart` 可整体隐藏

| 来源 | 事实 |
|------|------|
| `Layout.setEditorHidden` | **已实现**；`EDITOR_HIDDEN` + `setViewVisible(editorPartView, false)` |
| 约束 | 隐藏 editor 且 panel 不可见且 aux 未 maximize → **强制显示 Panel** |
| Zen Mode | 产品上常 **只留 editor**，容易造成「editor 不可藏」的误读 |
| Sessions LAYOUT | Editor **可独立于** Sessions Part 隐藏 |

**结论：** T2 在 API 上 **不是从零**。默认窗口的风险是 **互斥对象错了**（绑 Panel 而非 Conversation/Sources）。四钮「只关 Preview、Sources 也关、Conversation 开」时，现逻辑会把 Panel 顶出来——演示会脏。S1 要改互斥或保证 End 下格 Part 计入「workbench 可见」。

## T3 — 中心 Part 可隐藏 + NO-DUAL-HIDE

| 来源 | 事实 |
|------|------|
| 默认窗口 | 无 ConversationPart；藏中心 = 藏 editor = 触发 T2 互斥 |
| `SessionsPart` | 自有 `_visible` / grid；LAYOUT 写明 Sessions 与 Editor 可独立显隐 |
| `INV-052-NO-DUAL-HIDE` | Desktop：Conversation ∨ Workbench ≥ 1 |
| 本仓默认 | Editor ∨ Panel ≥ 1 |

**结论：** T3 在默认窗口 **尚未有对象**。Sessions 证明「中心非 editor Part 可藏且 editor 仍在」。把该行为搬到默认 `Layout` 时，必须同时换成 Desktop 的 dual-hide 公式，否则会出现「Conversation 关了、Preview 关了、只剩被强制打开的终端 Panel」——语义既不是 pureEditor 也不是文档壳。

## 建议的 spike 验证顺序（与代码硬度一致）

1. 在隔离 fork 改 `createGridDescriptor`：中心叶换新 Part，editor 叶放到 End（T1）。先不要做四钮。
2. 接 `setPartHidden` 到新 Part；改 editor↔panel 互斥为 Conversation∨End（T3 公式）。
3. 再演示 Preview 单独关（T2）与 Conversation 单独关（T3）。
4. EH 冒烟放在拓扑之后（spike 原文：便宜活）。

## 相关文档

- [parts-and-grid](../../systems/workbench/parts-and-grid.md)
- [desktop-shell-mapping](desktop-shell-mapping.md)
