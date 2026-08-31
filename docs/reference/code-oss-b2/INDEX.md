---
title: "Code-OSS B2 分析文档索引"
type: index
status: accepted
phase: N/A
updated: 2026-08-31
summary: "对照 UniverseAgentDesktop B2 方案：本仓 UI 框架、Agent UI、壳映射、页面接入与 spike 硬点的实现真相"
---

# Code-OSS B2 分析

> 本仓 Agent IDE **产品需求权威**在 [`docs/product/`](../../product/INDEX.md)；本簇只写 **本仓实现真相**与对照映射。  
> UniverseAgentDesktop 相关文档只作**历史出处**，不是持续权威。  
> 父选项（历史出处）：`UniverseAgentDesktop/dev/plans/code-oss-base-agent-ide.md`（Q1=是；坚持文档壳；意向 **B2**）。  
> Spike（历史出处）：`UniverseAgentDesktop/dev/plans/code-oss-b2-topology-spike.md`（S1=新增 ConversationPart + EditorPart 挪 End）。  
> 本仓 **不**据此改生产组合根。

## 读顺序（改造前）

1. [缺口总览](gap-vs-desktop-shell.md) — 首波分层文档缺什么、本簇补了什么
2. [Workbench Parts / Grid](../../systems/workbench/parts-and-grid.md) — UI 框架（T1/T2 的代码事实）
3. [Agent UI 清单](../../systems/chat/agent-ui.md) — ChatWidget 宿主、Sessions Part、Copilot 边界
4. [Desktop 壳映射](desktop-shell-mapping.md) — IA / ADR-052 四钮 ↔ 本仓 Parts
5. [Spike T1–T3 代码事实](spike-t1-t3-code-facts.md) — 对照 spike 硬测试点
6. [EH 表面笔记](eh-surface-notes.md) — 贡献点 vs 改壳冲突（矩阵草案，非探针结果）
7. [EH 表面矩阵](eh-surface-matrix.md) — 贡献点 × Part × 承诺分级（推定 / 待实测，无探针）
8. [Diff footprint](diff-footprint.md) — vs pin `004a1fbb` 的文件数与 LOC（ConversationPart 基线）
9. **页面接入（draft，非正式决策）**：[Settings UA](settings-ua-access.md) · [会话列表复用](session-roster-reuse.md) · [透镜组装](conversation-lens-assembly.md) · [Navigator tab](navigator-tabs-access.md) — 行动层父方案 [page-access-schemes](../../../dev/plans/page-access-schemes.md)
10. 零件深潜：[Activity/Sidebar](../../systems/workbench/activity-and-sidebar.md) · [Editor tabs](../../systems/workbench/editor-part-tabs.md) · [Panel/Aux](../../systems/workbench/panel-and-auxiliary-bar.md) · [Widget 零件](../../systems/chat/widget-parts.md) · [Agent Host](../../systems/agent-host/INDEX.md)

## 对照合同（外仓，勿复制正文）

> 外仓 = 同级目录 `../UniverseAgentDesktop`（壳/交互合同与 spike 的历史出处；产品需求权威在 [`docs/product/`](../../product/INDEX.md)；本仓基线 pin `004a1fbb` 已登记于其 spike 文档 §6）。

| 合同 | 外仓路径 |
|------|----------|
| **壳拓扑预览稿（改造 UI 的首要视觉参考）** | `dev/plans/shell-framework-preview.html`（浏览器直接打开；演示 ⊇ 合同，合同以 IA / ADR-052 为准） |
| Agent IDE 语义 | `docs/product/experience-principles.md` §2 |
| 壳区域 | `docs/product/information-architecture.md` |
| 交互/四钮 | `docs/product/ui-interaction-spec.md` · ADR-052 |
| Preview/Sources | ADR-051 |
| 底 Panel / Diff | ADR-047 |

## 相关本仓文档

- [Workbench](../../systems/workbench/INDEX.md) · [Chat](../../systems/chat/INDEX.md) · [Sessions](../../systems/sessions/INDEX.md)
- 页面接入（draft）：[Settings](settings-ua-access.md) · [会话列表](session-roster-reuse.md) · [透镜组装](conversation-lens-assembly.md) · [Navigator tab](navigator-tabs-access.md) · [父方案](../../../dev/plans/page-access-schemes.md)
- Sessions 就近 SSOT：`src/vs/sessions/LAYOUT.md`、`SESSIONS.md`
- Chat 文件夹 SSOT：`src/vs/workbench/contrib/chat/chatCodeOrganization.md`
