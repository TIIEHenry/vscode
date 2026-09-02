---
title: "Conversation 系统索引"
type: index
status: accepted
phase: N/A
updated: 2026-09-02
summary: "产品中心系统：CONVERSATION_PART + contrib/conversation；session 窗口 / chat tab、透镜与轨迹、Composer 与 Inbox、stub 契约、命令；PRD-001–004、012–016 的系统规格落点"
---

# Conversation

> 返回 [全局索引](../../INDEX.md) · 设计正文见 [系统概览](overview.md) · 需求见 [PRD-001](../../product/requirements.md#prd-001-以-conversation-为中心) 起各条

默认 Code 窗口的中心工作区。它是**独立系统**，不是 Copilot Chat 的一个宿主：`browser/parts/conversation/` 提供 Part 与槽位，`contrib/conversation/` 填产品 chrome，数据今天来自 `IConversationRosterService` 的 stub 实现，引擎接通后由 adapter 替换（[PRD-008](../../product/requirements.md#prd-008-引擎与会话权威)）。

## 涉及分层

- `workbench/browser/parts/conversation/` — `ConversationPart`（`Parts.CONVERSATION_PART`）、`IConversationPartService`、区域 hide 控件；**不 import contrib**
- `workbench/contrib/conversation/` — 会话窗口、Conversation `IEditorPart`、透镜 / 轨迹、Composer / Inbox、Navigator roster、StatusBar 芯片、UA Preferences 面、`universe-agent://` 深链
- `workbench/services/editor/` — `EditorParts.createConversationEditorPart`、`CONVERSATION_GROUP` / `CONVERSATION_SIDE_GROUP`、聚合豁免（[editor-part-tabs §4](../workbench/editor-part-tabs.md)）
- `workbench/browser/layout.ts` — 中心叶与 `Conversation ∨ (Editor ∨ Sources)` 互斥（[parts-and-grid](../workbench/parts-and-grid.md)）
- `contrib/chat/browser/chatShellRouting.ts` — 默认窗把 Chat 编辑器 / Quick Chat 入口转到本 Part（[agent-ui §3](../chat/agent-ui.md)）

## 页面

| 页 | 回答什么 |
|----|----------|
| [overview.md](overview.md) | 系统边界、三层职责、关键符号、与 Chat / Sessions / Agent Host 的关系 |
| [session-windows.md](session-windows.md) | session 窗口叶、嵌套 `IEditorPart`、`ConversationChatInput`、围栏、fork / 子代理 catalog、对话框、面包屑、导航栈、split（PRD-016） |
| [lens-and-trajectory.md](lens-and-trajectory.md) | `ConversationEditorPane` 页 chrome、「对话 \| 轨迹」透镜、时间线树、轨迹记录、过程折、图示卡（PRD-003 / 012 / 013 / 014） |
| [composer-and-inbox.md](composer-and-inbox.md) | PreFirst / Active Composer、身份条、Inbox 分簇、MessageQueue、语音条、输入历史、StatusBar 芯片（PRD-015 / 004 / 007） |
| [stub-and-fixtures.md](stub-and-fixtures.md) | `IConversationRosterService` 契约拆解（产品 vs 夹具）、持久化事实、引擎替换约束、测试清单 |
| [commands.md](commands.md) | 用户可见命令、菜单落点、快捷键现状、设置键 |

## 不变量

INV-TOPO / INV-052-NO-DUAL-HIDE / INV-NO-COPILOT 见 [ADR-006](../../../dev/decisions/006-shell-invariants.md)；本系统所有页面引用它，不复述公式。

## 相关文档

- 分析与 donor 对照：[conversation-lens-assembly](../../reference/code-oss-b2/conversation-lens-assembly.md) · [session-roster-reuse](../../reference/code-oss-b2/session-roster-reuse.md) · [agent-ui](../chat/agent-ui.md)
- 方案：[m2-product-shell](../../../dev/plans/m2-product-shell.md) · [conversation-session-windows](../../../dev/plans/conversation-session-windows.md) · [conversation-trajectory-lens](../../../dev/plans/conversation-trajectory-lens.md) · [conversation-process-fold](../../../dev/plans/conversation-process-fold.md) · [thinkrail-visualize-port](../../../dev/plans/thinkrail-visualize-port.md) · [conversation-empty-hero](../../../dev/plans/conversation-empty-hero.md)
- 决策：[ADR-002](../../../dev/decisions/002-conversation-session-windows.md) session 窗口 · [ADR-003](../../../dev/decisions/003-engine-adapter-boundary.md) 引擎 adapter（accepted @2026-09-02） · [ADR-005](../../../dev/decisions/005-changes-diff-owner.md) Diff 归属（ADR-004 superseded） · [ADR-006](../../../dev/decisions/006-shell-invariants.md) 壳不变量
- 邻接系统：[Workbench](../workbench/INDEX.md) · [Sources](../sources/INDEX.md) · [Chat](../chat/INDEX.md) · [Agent Host](../agent-host/INDEX.md)
