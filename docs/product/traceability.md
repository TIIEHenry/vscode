---
title: "产品需求追踪矩阵"
type: reference
status: accepted
phase: N/A
updated: 2026-09-02
summary: "PRD-001–016 追踪；PRD-012 T5a reveal @ f66c36c9；PRD-016 S1–S6 已落、S3c chrome 待落；D4 已验（rerun-2230）；D5 EH 仍开；E1/PRD-008 blocked"
---

# 产品需求追踪

> 只链接事实来源，不复制 [requirements.md](requirements.md) 或方案正文。没有验证证据的需求标「待验证」，不以产品状态 `accepted` 代替验证结论。  
> **页面接入 precedence：** Settings / roster / 透镜 / Navigator 的结构性决策以 [page-access-schemes.md](../../dev/plans/page-access-schemes.md)（`implemented`；切片 1a–4 代码已落）为准。  
> **透镜组装：** [conversation-lens-assembly.md](../reference/code-oss-b2/conversation-lens-assembly.md)（`accepted`）— PRD-015/016 已落代码。

| PRD-ID | 产品状态 | 系统/架构规格 | 实施方案 | 测试或验证证据 |
|--------|----------|---------------|----------|----------------|
| [PRD-001](requirements.md#prd-001-以-conversation-为中心) | `accepted` | [agent-ui](../systems/chat/agent-ui.md) · [parts-and-grid](../systems/workbench/parts-and-grid.md) | [m0](../../dev/plans/m0-topology-surgery.md) · [m1](../../dev/plans/m1-shell-followon.md) · [m2](../../dev/plans/m2-product-shell.md) | D4 V1–V8 PASS [rerun-2230](../../dev/progress/d4-evidence/rerun-2230/) |
| [PRD-002](requirements.md#prd-002-会话上下文) | `accepted` | [agent-ui](../systems/chat/agent-ui.md) · [session-roster-reuse](../reference/code-oss-b2/session-roster-reuse.md) · [conversation-lens-assembly](../reference/code-oss-b2/conversation-lens-assembly.md) | [m2](../../dev/plans/m2-product-shell.md) · [page-access-schemes](../../dev/plans/page-access-schemes.md) | D4 V5 PASS；roster 单测 |
| [PRD-003](requirements.md#prd-003-时间线与输入) | `accepted` | [conversation-lens-assembly](../reference/code-oss-b2/conversation-lens-assembly.md) · [agent-ui](../systems/chat/agent-ui.md) | [m2](../../dev/plans/m2-product-shell.md) · [conversation-empty-hero](../../dev/plans/conversation-empty-hero.md) | D4 PASS；T1–T6 单测 |
| [PRD-004](requirements.md#prd-004-权限座位) | `accepted` | [agent-ui](../systems/chat/agent-ui.md) · [conversation-lens-assembly](../reference/code-oss-b2/conversation-lens-assembly.md) | [m2](../../dev/plans/m2-product-shell.md) | D4 PASS |
| [PRD-005](requirements.md#prd-005-preview-与-sources-files) | `accepted` | [parts-and-grid](../systems/workbench/parts-and-grid.md) | [m1](../../dev/plans/m1-shell-followon.md) | D4 V8 PASS（Files/Changes/Review tab） |
| [PRD-006](requirements.md#prd-006-默认无-copilot--chat-冒充) | `accepted` | [agent-ui](../systems/chat/agent-ui.md) · [views-and-composites](../systems/workbench/views-and-composites.md) | [m5](../../dev/plans/m5-ui-shell-hardening.md) · [page-access-schemes](../../dev/plans/page-access-schemes.md) · [settings-two-surfaces](../../dev/plans/settings-two-surfaces.md) | D4 V6 PASS；H0–H3 已落 |
| [PRD-007](requirements.md#prd-007-诚实降级) | `accepted` | [agent-ui](../systems/chat/agent-ui.md) | [m2](../../dev/plans/m2-product-shell.md) | D4 PASS |
| [PRD-008](requirements.md#prd-008-引擎与会话权威) | `blocked` | [agent-host](../systems/agent-host/INDEX.md) | 无本仓已接受的引擎实施方案 | 无 |
| [PRD-009](requirements.md#prd-009-changes-与-diff) | `blocked` | [diff-footprint](../reference/code-oss-b2/diff-footprint.md) | FORK 未选 | 无 |
| [PRD-010](requirements.md#prd-010-产品身份) | `proposed` | 无 | 无 | 无 |
| [PRD-011](requirements.md#prd-011-chat-并排比对) | `accepted` | `src/vs/sessions/LAYOUT.md` · [ADR-001](../../dev/decisions/001-chat-compare-form.md) | [chat-compare-split](../../dev/plans/chat-compare-split.md) | D4 PASS |
| [PRD-012](requirements.md#prd-012-conversation-轨迹透镜) | `accepted` | [conversation-lens-assembly](../reference/code-oss-b2/conversation-lens-assembly.md) | [conversation-trajectory-lens](../../dev/plans/conversation-trajectory-lens.md) | D4 PASS；T1–T3 单测；T5a reveal 子集 @ `f66c36c9`（T5 搜索/虚拟化/Overview 仍 Deferred） |
| [PRD-013](requirements.md#prd-013-conversation-过程折) | `accepted` | [conversation-lens-assembly](../reference/code-oss-b2/conversation-lens-assembly.md) | [conversation-process-fold](../../dev/plans/conversation-process-fold.md) | D4 PASS；单测 |
| [PRD-014](requirements.md#prd-014-conversation-图示卡visualize) | `accepted` | [conversation-lens-assembly](../reference/code-oss-b2/conversation-lens-assembly.md) | [thinkrail-visualize-port](../../dev/plans/thinkrail-visualize-port.md) | D4 PASS；单测 |
| [PRD-015](requirements.md#prd-015-conversation-空会话与输入面) | `accepted` | [conversation-lens-assembly](../reference/code-oss-b2/conversation-lens-assembly.md) §4 | [conversation-empty-hero](../../dev/plans/conversation-empty-hero.md) (`implemented`) | T1–T6 单测；D4 PASS |
| [PRD-016](requirements.md#prd-016-conversation-session-窗口与-chat-tab) | `accepted` | [parts-and-grid](../systems/workbench/parts-and-grid.md) · [editor-part-tabs](../systems/workbench/editor-part-tabs.md) · [agent-ui](../systems/chat/agent-ui.md) | [conversation-session-windows](../../dev/plans/conversation-session-windows.md)（S1–S6 `implemented`；S3c chrome 已写）· [ADR-002](../../dev/decisions/002-conversation-session-windows.md) | S1–S6 单测；D4 PASS；S3c chrome 单测 |

## 状态分桶

| 分桶 | PRD / 项 |
|------|----------|
| 代码已落、D4 已验 | PRD-001–PRD-016（除 blocked） |
| EH 探针待验 | D5（YAML / Todo Tree / js-debug） |
| 阻塞 / 未决 | PRD-008、PRD-009、页面接入切片 5、customizations E1 |
| 仅提议 | PRD-010 |
