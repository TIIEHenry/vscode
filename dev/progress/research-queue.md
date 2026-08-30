---
title: "Loop Research Queue"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-08-30
summary: "待研究队列 SSOT；格式见套件 subagent-loop-startup；当前无 open 行。"
---

# Research Queue

> **SSOT**：待研究、不能当轮直接编码的项必须写入本表。  
> 读路径：`dev/progress/status.md` → [deferred-gaps.md](deferred-gaps.md) → 本文件。  
> 格式契约：[subagent-loop-startup.md](../loop/agent-playbooks/subagent-loop-startup.md)。

| ID | Topic | Why It Matters | Discovery Needed | Expected Output | Status |
|:---|:------|:---------------|:-----------------|:----------------|:-------|

## 维护规则

1. **新增**：分配下一 `R<n>` ID；`Expected Output` 须写明 plan / ADR / roadmap 之一。
2. **闭合**：产出落档后 `Status` → `closed`；若变为实施项，迁入 roadmap 而非永久留队列。
3. **与 Deferred Gaps 分工**：本表 = 先搞清再干；Deferred Gaps = 已知怎么做但优先级/环境不够。
