---
title: "B2 Spike T1–T3：对照本仓代码的事实"
type: reference
status: accepted
phase: N/A
updated: 2026-08-31
summary: "S1 三个硬测试点：M1 已落（透镜骨架 + Sources Files/Changes/Review tab strip + D7 四钮）；compile/启动/EH 仍 deferred"
---

# Spike T1–T3：代码事实

spike 原文：`code-oss-b2-topology-spike.md` §3.3。本页 **不**代替 Go/Kill，只写当前树能观察到的事实。

## T1 — grid 接受非 editor 的中心 Part

| 窗口 | 事实 | 结论 |
|------|------|------|
| 默认 `Layout.createGridDescriptor` | 中心叶为 `Parts.CONVERSATION_PART`；End 列为 `EDITOR_PART`（上）+ `SOURCES_PART`（下） | **M0 已落地** |
| Agents Window | `SESSIONS_PART` 已是非 editor 中心；叶不是 editor group | 样例仍有效；默认窗口未 import sessions |
| `Parts` 枚举 | 已有 `CONVERSATION_PART`、`SOURCES_PART` | 默认窗口 `createGridDescriptor` 已编入 |

**Kill-driver 收窄：** 难的不是 Grid 类，是默认 `Layout` 里数十处「中间 = editor」的 focus / neighbor / maximize / 序列化。样例代码在 `src/vs/sessions/browser/`（`sessionsPart.ts`、sessions 自己的 layout host），不能直接 import 进 workbench（反向分层禁止）。

S1 最小证明：默认 Code 窗口启动后，中心 DOM 对应新 Part，文件仍走 `IEditorService.openEditor` 出现在 **End 列 tabs**，且 URI 不是 `ChatEditorInput`。

## T2 — `EditorPart` 可整体隐藏

| 来源 | 事实 |
|------|------|
| `Layout.setEditorHidden` | **已实现**；`EDITOR_HIDDEN` + `setViewVisible(editorPartView, false)` |
| 约束 | 隐藏 editor 且 Conversation 与 Sources 均不可见且 aux 未 maximize → **强制显示 Conversation**（`enforceAgentShellVisible`） |
| Zen Mode | 仍不藏 Conversation；产品语义待后续 |
| Sessions LAYOUT | Editor **可独立于** Sessions Part 隐藏 |

**结论：** T2 在 API 上 **不是从零**。End 列 Part（Editor / Sources）计入 workbench 可见性；互斥已改绑 **Conversation ∨ (Editor ∨ Sources)**。四钮 Preview 走 `LayoutControlMenu` toggle。

## T3 — 中心 Part 可隐藏 + NO-DUAL-HIDE

| 来源 | 事实 |
|------|------|
| 默认窗口 | `ConversationPart` + `setConversationHidden`；命令 `workbench.action.toggleConversation` |
| `SourcesPart` | End 下格；`contrib/sources` **Files \| Changes \| Review** tab strip；`workbench.action.toggleSources` |
| `SessionsPart` | 自有 `_visible` / grid；LAYOUT 写明 Sessions 与 Editor 可独立显隐 |
| `INV-052-NO-DUAL-HIDE` | Desktop：Conversation ∨ Workbench ≥ 1 |
| 本仓默认 | **Conversation ∨ (Editor ∨ Sources) ≥ 1**（`forceShownAgentShellPart`） |

**结论：** T3 公式已改绑。Panel 最大化改为藏 Conversation（中心叶），不再藏 Editor。titlebar 四钮（Nav / Conversation / Preview / Sources）已注册 `LayoutControlMenu`。

## M0 剩余（验证，非代码）

| 项 | HEAD（M1） | 负责 |
|----|-----------------|------|
| Sources **Files \| Changes \| Review** tab strip（End 下格） | **已合入**（M1+） | — |
| titlebar layout controls 四钮（D7） | **已合入**（M1） | — |
| Conversation 透镜骨架 | **已合入**（M1） | — |
| 编译 / 启动 T1–T3 演示 | **未跑** | deferred → [deferred-gaps](../../../dev/progress/deferred-gaps.md) D3–D4 |
| EH 探针冒烟 | **未跑** | deferred → D5；矩阵见 [eh-surface-matrix](eh-surface-matrix.md) |

## 建议的 spike 验证顺序（与代码硬度一致）

**代码面（T1–T3 拓扑 + M1 内容 + D7 四钮）已落地**；下列为 **验证** 顺序，本轮 defer：

1. ~~在隔离 fork 改 `createGridDescriptor`~~ — **已做**（Conversation 中心 + End Editor/Sources）。
2. ~~接 `setPartHidden` + Conversation∨(Editor∨Sources) 互斥~~ — **已做**。
3. ~~Sources tab strip（Files / Changes / Review）+ Conversation 透镜 + titlebar 四钮（D7）~~ — **已做**（M1+）。
4. **待验证**：Preview 单独关、Conversation 单独关（启动演示；compile 未跑）。
5. EH 冒烟放在拓扑稳定之后（[eh-surface-matrix](eh-surface-matrix.md)，全部待实测）。

## 相关文档

- [parts-and-grid](../../systems/workbench/parts-and-grid.md)
- [desktop-shell-mapping](desktop-shell-mapping.md) · [diff-footprint](diff-footprint.md)
