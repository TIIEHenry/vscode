---
title: "产品需求追踪矩阵"
type: reference
status: accepted
phase: N/A
updated: 2026-09-01
summary: "PRD-001–PRD-013 到规格、方案与证据的轻量追踪；轨迹/过程折已签收"
---

# 产品需求追踪

> 只链接事实来源，不复制 [requirements.md](requirements.md) 或方案正文。没有验证证据的需求标「待验证」，不以产品状态 `accepted` 代替验证结论。  
> **页面接入 precedence：** Settings / roster / 透镜 / Navigator 的结构性决策以 [page-access-schemes.md](../../dev/plans/page-access-schemes.md)（`accepted`）为准；知识层四页为细节锚点，冲突见该方案 §12。  
> **轨迹透镜：** 对话 | 轨迹闭集与检查表内容以 [conversation-trajectory-lens.md](../../dev/plans/conversation-trajectory-lens.md)（`accepted`）为准；外仓 ADR-047 只约束宿主闭集，不约束记录表内容。  
> **过程折：** 对话页思考/工具缩进折叠以 [conversation-process-fold.md](../../dev/plans/conversation-process-fold.md)（`accepted`）为准；外仓 ADR-046 约束 span overlay，不约束 ThinkRail 视觉。

| PRD-ID | 产品状态 | 系统/架构规格 | 实施方案 | 测试或验证证据 |
|--------|----------|---------------|----------|----------------|
| [PRD-001](requirements.md#prd-001-以-conversation-为中心) | `accepted` | [agent-ui](../systems/chat/agent-ui.md) · [parts-and-grid](../systems/workbench/parts-and-grid.md) · [desktop-shell-mapping](../reference/code-oss-b2/desktop-shell-mapping.md) | [m0](../../dev/plans/m0-topology-surgery.md) · [m1](../../dev/plans/m1-shell-followon.md) · [m2](../../dev/plans/m2-product-shell.md) | 待验证：D4 启动冒烟未跑。已有单测约束中心不是 Chat 编辑器标签，但单测不是产品启动证据 |
| [PRD-002](requirements.md#prd-002-会话上下文) | `accepted` | [agent-ui](../systems/chat/agent-ui.md) · [session-roster-reuse](../reference/code-oss-b2/session-roster-reuse.md) · [conversation-lens-assembly](../reference/code-oss-b2/conversation-lens-assembly.md) | [m2](../../dev/plans/m2-product-shell.md) · [m3](../../dev/plans/m3-shell-closeout.md) · [page-access-schemes](../../dev/plans/page-access-schemes.md) (`accepted`) | 待验证：D4 / M3 目视未做 |
| [PRD-003](requirements.md#prd-003-时间线与输入) | `accepted` | [conversation-lens-assembly](../reference/code-oss-b2/conversation-lens-assembly.md) · [agent-ui](../systems/chat/agent-ui.md) | [m2](../../dev/plans/m2-product-shell.md) · [page-access-schemes](../../dev/plans/page-access-schemes.md) (`accepted`) | 待验证：D4 未跑 |
| [PRD-004](requirements.md#prd-004-权限座位) | `accepted` | [agent-ui](../systems/chat/agent-ui.md) · [conversation-lens-assembly](../reference/code-oss-b2/conversation-lens-assembly.md) | [m2](../../dev/plans/m2-product-shell.md) | 待验证：D4 未跑 |
| [PRD-005](requirements.md#prd-005-preview-与-sources-files) | `accepted` | [parts-and-grid](../systems/workbench/parts-and-grid.md) · [desktop-shell-mapping](../reference/code-oss-b2/desktop-shell-mapping.md) | [m1](../../dev/plans/m1-shell-followon.md) | 待验证：D4 未跑。Files 列表代码已合入，不等于 Changes/Diff 已齐 |
| [PRD-006](requirements.md#prd-006-默认无-copilot--chat-冒充) | `accepted` | [agent-ui](../systems/chat/agent-ui.md) · [panel-and-auxiliary-bar](../systems/workbench/panel-and-auxiliary-bar.md) · [views-and-composites](../systems/workbench/views-and-composites.md) | [m2](../../dev/plans/m2-product-shell.md) · [m3](../../dev/plans/m3-shell-closeout.md) · [page-access-schemes](../../dev/plans/page-access-schemes.md) (`accepted`) · [m5](../../dev/plans/m5-ui-shell-hardening.md) (`accepted`) | 待验证：D4 / M3 目视未做 |
| [PRD-007](requirements.md#prd-007-诚实降级) | `accepted` | [agent-ui](../systems/chat/agent-ui.md) | [m2](../../dev/plans/m2-product-shell.md) | 待验证：D4 未跑 |
| [PRD-008](requirements.md#prd-008-引擎与会话权威) | `blocked` | [agent-host](../systems/agent-host/INDEX.md) · [agent-ui](../systems/chat/agent-ui.md) | 无本仓已接受的引擎实施方案 | 无。禁止把 stub echo 写成验证证据 |
| [PRD-009](requirements.md#prd-009-changes-与-diff) | `blocked` | [diff-footprint](../reference/code-oss-b2/diff-footprint.md) · [gap-vs-desktop-shell](../reference/code-oss-b2/gap-vs-desktop-shell.md) | [m1](../../dev/plans/m1-shell-followon.md) / [m2](../../dev/plans/m2-product-shell.md) 仅记录 FORK，不实施 | 无。FORK 未选，不是待验证 |
| [PRD-010](requirements.md#prd-010-产品身份) | `proposed` | 无本仓已接受的产品身份规格 | 无。M2 明确不改产品名称与图标 | 无 |
| [PRD-011](requirements.md#prd-011-chat-并排比对) | `accepted` | 就近 SSOT：`src/vs/sessions/LAYOUT.md`（Sessions Part / chat grid）· `src/vs/sessions/SESSIONS.md`（多 chat 能力）· [ADR-001](../../dev/decisions/001-chat-compare-form.md)（承载形态） | [chat-compare-split](../../dev/plans/chat-compare-split.md) (`accepted`) | 待验证：方案未实施 |
| [PRD-012](requirements.md#prd-012-conversation-轨迹透镜) | `accepted` | 待实施后写 [agent-ui](../systems/chat/agent-ui.md) · [conversation-lens-assembly](../reference/code-oss-b2/conversation-lens-assembly.md) | [conversation-trajectory-lens](../../dev/plans/conversation-trajectory-lens.md) (`accepted`) | 待验证：方案未实施 |
| [PRD-013](requirements.md#prd-013-conversation-过程折) | `accepted` | 待实施后写 [conversation-lens-assembly](../reference/code-oss-b2/conversation-lens-assembly.md) · [agent-ui](../systems/chat/agent-ui.md) | [conversation-process-fold](../../dev/plans/conversation-process-fold.md) (`accepted`) | 待验证：方案未实施 |

## 外仓冲突与出处

| 主题 | 外仓历史出处 | 本仓决定 |
|------|--------------|----------|
| Agent IDE 主流程在 Conversation | UniverseAgentDesktop `docs/product/experience-principles.md` §2 | 已迁入 [vision.md](vision.md)；外仓不再是持续权威 |
| 外仓 F1–F11 现行交付表 | UniverseAgentDesktop `docs/product/requirements.md` | **不迁入**。本仓只用 `PRD-001`–`PRD-013` |
| 编辑器窗口作为产品壳 | UniverseAgentDesktop ADR-061 | 壳拓扑已由本仓 M0–M3 落地；产品陈述以本目录为准 |
| Diff 落点 | 外仓合同要底部面板，本仓现状在编辑器区域 | 冲突保留为 PRD-009 `blocked`，表述为「编辑器区域 vs 底部面板」，不静默覆盖 |
| Conversation 轨迹页内容 | Desktop ADR-047：轨迹 = 当前活动/运行监视 | **宿主**对齐闭集 `conversation \| trajectory`；**内容**对齐 DeepSeek harness 检查记录表（注入 / chip / 环境），不把「当前活动监视」当本仓轨迹定义 |
| Conversation 过程折 | Desktop ADR-046：span overlay | **显示优化**：对话/轨迹共用 overlay；对话默认收起、轨迹默认展开；不把折壳当列表键 |

## 状态分桶

| 分桶 | PRD |
|------|-----|
| 已接受、代码已落、启动待验证 | PRD-001–PRD-007 |
| 已接受、方案已立、未实施 | PRD-011、PRD-012、PRD-013；页面接入 / M5 切片 |
| 阻塞 / 未决 | PRD-008、PRD-009 |
| 仅提议 | PRD-010 |
| 明确排除 | 见 [requirements.md](requirements.md)「明确排除」，不进入上表当待办 |
