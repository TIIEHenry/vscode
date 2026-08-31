---
title: "Loop Research Queue"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-08-31
summary: "待研究队列 SSOT；R1–R4 页面接入已闭合为 draft 方案；当前无 open 行。"
---

# Research Queue

> **SSOT**：待研究、不能当轮直接编码的项必须写入本表。  
> 读路径：`dev/progress/status.md` → [deferred-gaps.md](deferred-gaps.md) → 本文件。  
> 格式契约：[subagent-loop-startup.md](../loop/agent-playbooks/subagent-loop-startup.md)。

| ID | Topic | Why It Matters | Discovery Needed | Expected Output | Status |
|:---|:------|:---------------|:-----------------|:----------------|:-------|
| R1 | Settings 接入 UA | 壳映射不覆盖 Preferences 宿主 / 三层键 / Customizations 切分 | 对照 Singularity Settings + `SettingsEditor2` + Customizations | [settings-ua-access](../../docs/reference/code-oss-b2/settings-ua-access.md) · [page-access-schemes](../plans/page-access-schemes.md) | closed |
| R2 | 会话列表复用零件 | ADR-061 只写姿态；stub roster 无「复用哪个类」 | 对照 `ConversationSessionsView` vs `agentSessions` | [session-roster-reuse](../../docs/reference/code-oss-b2/session-roster-reuse.md) | closed |
| R3 | Conversation 透镜组装 | widget-parts 有零件无三槽装法 | 对照 `ConversationLens` vs `ChatWidget` | [conversation-lens-assembly](../../docs/reference/code-oss-b2/conversation-lens-assembly.md) | closed |
| R4 | Navigator tab 子页重设计 | 壳映射只写 stub；Singularity panel 不能原样搬 | 对照五段 ViewContainer vs Explorer/树/列表 | [navigator-tabs-access](../../docs/reference/code-oss-b2/navigator-tabs-access.md) | closed |

## 维护规则

1. **新增**：分配下一 `R<n>` ID；`Expected Output` 须写明 plan / ADR / roadmap 之一。
2. **闭合**：产出落档后 `Status` → `closed`；若变为实施项，迁入 roadmap 而非永久留队列。
3. **与 Deferred Gaps 分工**：本表 = 先搞清再干；Deferred Gaps = 已知怎么做但优先级/环境不够。
