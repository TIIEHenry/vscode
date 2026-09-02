---
title: "产品需求追踪矩阵"
type: reference
status: accepted
phase: N/A
updated: 2026-09-02
summary: "PRD-001–021 追踪；PRD-008 方案列指 m6-engine-wave（A1/A2 已合入 HEAD，不升 implemented）；PRD-017/020 D13/D10 已实施；系统规格列改指 systems/conversation 与 systems/sources"
---

# 产品需求追踪

> 只链接事实来源，不复制 [requirements.md](requirements.md) 或方案正文。没有验证证据的需求标「待验证」，不以产品状态 `accepted` 代替验证结论。  
> **页面接入 precedence：** Settings / roster / 透镜 / Navigator 的结构性决策以 [page-access-schemes.md](../../dev/plans/page-access-schemes.md)（`implemented`；切片 1a–4 代码已落）为准。  
> **系统规格 SSOT：** 产品 Conversation 见 [systems/conversation](../systems/conversation/INDEX.md)，Sources 见 [systems/sources](../systems/sources/INDEX.md)；[conversation-lens-assembly](../reference/code-oss-b2/conversation-lens-assembly.md) 与 [agent-ui](../systems/chat/agent-ui.md) 退为 donor 对照与 Copilot 边界参考。

| PRD-ID | 产品状态 | 系统/架构规格 | 实施方案 | 测试或验证证据 |
|--------|----------|---------------|----------|----------------|
| [PRD-001](requirements.md#prd-001-以-conversation-为中心) | `accepted` | [conversation overview](../systems/conversation/overview.md) · [parts-and-grid](../systems/workbench/parts-and-grid.md) · [ADR-006](../../dev/decisions/006-shell-invariants.md) | [m0](../../dev/plans/m0-topology-surgery.md) · [m1](../../dev/plans/m1-shell-followon.md) · [m2](../../dev/plans/m2-product-shell.md) | D4 V1–V8 PASS [rerun-2230](../../dev/progress/d4-evidence/rerun-2230/) |
| [PRD-002](requirements.md#prd-002-会话上下文) | `accepted` | [session-windows](../systems/conversation/session-windows.md) · [stub-and-fixtures](../systems/conversation/stub-and-fixtures.md) · [session-roster-reuse](../reference/code-oss-b2/session-roster-reuse.md) | [m2](../../dev/plans/m2-product-shell.md) · [page-access-schemes](../../dev/plans/page-access-schemes.md) | D4 V5 PASS；roster 单测 |
| [PRD-003](requirements.md#prd-003-时间线与输入) | `accepted` | [lens-and-trajectory](../systems/conversation/lens-and-trajectory.md) · [composer-and-inbox](../systems/conversation/composer-and-inbox.md) | [m2](../../dev/plans/m2-product-shell.md) · [conversation-empty-hero](../../dev/plans/conversation-empty-hero.md) · 验收 4–5：[conversation-stream-timeline](../../dev/plans/conversation-stream-timeline.md) S2/S3 | D4 PASS；T1–T6 单测；验收 4–5 待验证 |
| [PRD-004](requirements.md#prd-004-权限座位) | `accepted` | [lens-and-trajectory §2](../systems/conversation/lens-and-trajectory.md) · [stub-and-fixtures §5](../systems/conversation/stub-and-fixtures.md) | [m2](../../dev/plans/m2-product-shell.md) · 验收 4–5：[conversation-stream-timeline](../../dev/plans/conversation-stream-timeline.md) S3/S5 | D4 PASS；验收 4–5 待验证 |
| [PRD-005](requirements.md#prd-005-preview-与-sources) | `accepted` | [sources overview](../systems/sources/overview.md) · [parts-and-grid](../systems/workbench/parts-and-grid.md)；Review 语义见 PRD-023 | [m1](../../dev/plans/m1-shell-followon.md) · [m2](../../dev/plans/m2-product-shell.md)（Changes / Review tab） | D4 V8 PASS（Files/Changes/Review tab）；`contrib/sources/test` 8 文件 |
| [PRD-006](requirements.md#prd-006-默认无-copilot--chat-冒充) | `accepted` | [agent-ui](../systems/chat/agent-ui.md) · [views-and-composites](../systems/workbench/views-and-composites.md) | [m5](../../dev/plans/m5-ui-shell-hardening.md) · [page-access-schemes](../../dev/plans/page-access-schemes.md) · [settings-two-surfaces](../../dev/plans/settings-two-surfaces.md) | D4 V6 PASS；H0–H3 已落 |
| [PRD-007](requirements.md#prd-007-诚实降级) | `accepted` | [composer-and-inbox §7](../systems/conversation/composer-and-inbox.md) · [stub-and-fixtures](../systems/conversation/stub-and-fixtures.md) · [ADR-006](../../dev/decisions/006-shell-invariants.md) | [m2](../../dev/plans/m2-product-shell.md) · 验收 4–5：[conversation-stream-timeline](../../dev/plans/conversation-stream-timeline.md) S3 | D4 PASS；验收 4–5 待验证 |
| [PRD-008](requirements.md#prd-008-引擎与会话权威) | `blocked`（方案已签收，待接通证据） | [agent-host](../systems/agent-host/INDEX.md) · [ADR-003](../../dev/decisions/003-engine-adapter-boundary.md) (`accepted` @2026-09-02) · [engine-protocol-surface §5](../reference/universe-agent/engine-protocol-surface.md) | [m6-engine-wave](../../dev/plans/m6-engine-wave.md)（`accepted`；A1 `platform/universeAgent` + A2 contrib 同 token 已合入 HEAD；M6-B 切片 5 UI / M6-C E1 / M6-D T4 仍待）· [conversation-stream-timeline](../../dev/plans/conversation-stream-timeline.md) S4–S6 | 无；升 `implemented` 须隔离 profile 启动冒烟（接通证据），本回填不升 |
| [PRD-009](requirements.md#prd-009-changes-与-diff) | `accepted` | [parts-and-grid §5](../systems/workbench/parts-and-grid.md) · [editor-part-tabs §4](../systems/workbench/editor-part-tabs.md) · [companion-contribs §5](../systems/workbench/companion-contribs.md) · [sources overview §4](../systems/sources/overview.md) · [session-windows §2](../systems/conversation/session-windows.md) | [ADR-005](../../dev/decisions/005-changes-diff-owner.md)（`accepted`）· [sources-changes-diff](../../dev/plans/sources-changes-diff.md)（F1–F3/F5 `implemented`；F4 冒烟待验） | F1–F3 单测：`conversationEditorRouting.test.ts` · `conversationEditorFence.test.ts` · `conversationSessionChat.test.ts` · `conversationNavigation.test.ts` · `conversationEditorAggregation.test.ts` · `sourcesChangesModel.test.ts` · `sourcesChangesList.test.ts` · `sourcesDiffPanel.test.ts`；D4 式 V-F1–V-F7 待 F4 |
| [PRD-010](requirements.md#prd-010-产品身份) | `proposed` | 无 | 无 | 无 |
| [PRD-011](requirements.md#prd-011-chat-并排比对) | `accepted` | `src/vs/sessions/LAYOUT.md` · [ADR-001](../../dev/decisions/001-chat-compare-form.md) | [chat-compare-split](../../dev/plans/chat-compare-split.md) | D4 PASS |
| [PRD-012](requirements.md#prd-012-conversation-轨迹透镜) | `accepted` | [lens-and-trajectory §3](../systems/conversation/lens-and-trajectory.md) | [conversation-trajectory-lens](../../dev/plans/conversation-trajectory-lens.md) | D4 PASS；T1–T3 单测；T5a reveal 子集 @ `f66c36c9`（T5 搜索/虚拟化/Overview 仍 Deferred） |
| [PRD-013](requirements.md#prd-013-conversation-过程折) | `accepted` | [lens-and-trajectory §4](../systems/conversation/lens-and-trajectory.md) | [conversation-process-fold](../../dev/plans/conversation-process-fold.md) | D4 PASS；单测 |
| [PRD-014](requirements.md#prd-014-conversation-图示卡visualize) | `accepted` | [lens-and-trajectory §5](../systems/conversation/lens-and-trajectory.md) | [thinkrail-visualize-port](../../dev/plans/thinkrail-visualize-port.md) | D4 PASS；单测 |
| [PRD-015](requirements.md#prd-015-conversation-空会话与输入面) | `accepted` | [composer-and-inbox](../systems/conversation/composer-and-inbox.md) | [conversation-empty-hero](../../dev/plans/conversation-empty-hero.md) (`implemented`) | T1–T6 单测；D4 PASS |
| [PRD-016](requirements.md#prd-016-conversation-session-窗口与-chat-tab) | `accepted` | [session-windows](../systems/conversation/session-windows.md) · [editor-part-tabs](../systems/workbench/editor-part-tabs.md) | [conversation-session-windows](../../dev/plans/conversation-session-windows.md)（S1–S6 `implemented`；S3c @ `18b5e8d7`）· [ADR-002](../../dev/decisions/002-conversation-session-windows.md) | S1–S6 单测；D4 PASS；S3c @ `18b5e8d7` 单测 |
| [PRD-017](requirements.md#prd-017-本地会话持久化) | `accepted` | [stub-and-fixtures §4](../systems/conversation/stub-and-fixtures.md) | [m6-engine-wave](../../dev/plans/m6-engine-wave.md) A2 · D13 已实施 | `conversationRosterStorage` + `conversationStubService.test.ts` / `conversationEngineRosterService.test.ts` 持久化单测 |
| [PRD-018](requirements.md#prd-018-键盘可达与辅助功能) | `accepted` | [commands §7](../systems/conversation/commands.md) | D14 四钮默认键位已实施；F6 / 透镜 / 权限座位等待 M6-B 后 | 四钮键位 @ `layoutActions.ts`；[commands §7](../systems/conversation/commands.md) |
| [PRD-019](requirements.md#prd-019-web--远程窗口一致性) | `accepted` | [conversation overview §5](../systems/conversation/overview.md) | [D15](../../dev/progress/deferred-gaps.md)（M6-A2 后 Web 冒烟） | 无 Web 冒烟证据 |
| [PRD-020](requirements.md#prd-020-规模与性能上限) | `accepted` | [lens-and-trajectory §3](../systems/conversation/lens-and-trajectory.md) | D10 轨迹搜索 / 虚拟化已实施；Overview 瀑布条仍随 M6-D | `conversationTrajectory.test.ts` · `conversationTrajectoryUi.test.ts` |
| [PRD-021](requirements.md#prd-021-未知内容与错误的诚实呈现) | `accepted` | [lens-and-trajectory](../systems/conversation/lens-and-trajectory.md) | [conversation-stream-timeline §3.3](../../dev/plans/conversation-stream-timeline.md) | 待验证（S1–S3 单测；活数据随 S4） |
| [PRD-022](requirements.md#prd-022-navigator-引擎段) | `accepted` | [activity-and-sidebar §5](../systems/workbench/activity-and-sidebar.md) · [navigator-tabs-access](../reference/code-oss-b2/navigator-tabs-access.md) · [engine-protocol-surface](../reference/universe-agent/engine-protocol-surface.md)（G-NAV-1 / G-NAV-2 待回填） | [navigator-engine-segments](../../dev/plans/navigator-engine-segments.md)（`accepted` @2026-09-02；N1–N5 全排 M6-A2 后，含其 §9 对 m6 的增量） | 无；HEAD 三段诚实空 |
| [PRD-023](requirements.md#prd-023-sources-review-审阅进度与归因) | `accepted` | [sources overview](../systems/sources/overview.md)（Review 行待 R2 改口）· Desktop ADR-043 作 `source` | [sources-review-progress](../../dev/plans/sources-review-progress.md)（`accepted` @2026-09-02；R1 / R2 / R4a ReadyToImplement；R3 / R4b 随 M6-A2 + S2） | 无；HEAD Review = Changes 同集只读列表 |

## 状态分桶

| 分桶 | PRD / 项 |
|------|----------|
| 代码已落、D4 已验 | PRD-001–PRD-016（除 blocked） |
| EH 探针已验 | D5 closed @ [wave3](../../dev/progress/d5-evidence/smoke-wave3-0001/)（YAML / Todo Tree / js-debug PASS） |
| 阻塞 / 未决 | PRD-008（方案已签收；待 M6-A2 接通证据）、PRD-009 F4 隔离 profile 冒烟（升 `implemented` 须 V-F1–V-F7）、页面接入切片 5（M6-B）、customizations E1（M6-C） |
| 已接受、部分已实施 | PRD-017 / PRD-020（D13 / D10 已闭）；PRD-018 四钮键位已落、其余待 M6-B 后 |
| 已接受、实施延期 | PRD-019（D15 Web 冒烟）；PRD-022（N1–N5 排 M6-A2 后）；PRD-023 R3 / R4b（随 M6-A2 + S2） |
| 已接受、可立即开 | PRD-023 R1 / R2 / R4a（无引擎，`contrib/sources/**`） |
| 仅提议 | PRD-010（已裁决名称，排引擎波后，[D12](../../dev/progress/deferred-gaps.md)） |
