---
title: "Loop Deferred Gaps"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-08-30
summary: "P2/P3 延期缺口 SSOT；格式见套件 subagent-loop-startup；当前无 open 行。"
---

# Deferred Gaps

> **SSOT**：当轮无法完成、但不阻塞当前目标的缺口写入本表。  
> 读路径：`dev/progress/status.md` → 本文件 → [research-queue.md](research-queue.md)。  
> 格式契约：[subagent-loop-startup.md](../loop/agent-playbooks/subagent-loop-startup.md)。

| ID | Priority | Gap | Why Deferred | Exit Condition | Track | Status |
|:---|:---------|:----|:-------------|:---------------|:------|:-------|
| D1 | P3 | 套件 `dev/loop/overview.md` 引用的 `docs/guides/multi-agent-design-workflow.md` 缺失（上游 Desktop 仓同样悬空，非本仓迁移引入） | 门禁仅 warning 不阻塞；指南属套件级内容，应在套件仓或消费仓统一补 | 指南落盘（本仓或套件）且 `check-docs-health` 0 warning | docs | open |
| D2 | P2 | 工位池基线 `7362571a` 未编译验绿（建槽时 `npm ci` 尚在进行） | 编译耗时长；worktrees.md 要求首用槽前验绿 | M0 集成编译绿后在 `worktree-pool.md` 标注基线已验 | infra | open |

## 维护规则

1. **新增**：分配下一 `D<n>` ID；须有可验证 Exit Condition。
2. **闭合**：`Status` → `closed`；并在 `status.md` 记摘要。
3. **与 Research Queue 分工**：本表 = 已知怎么做但优先级/环境不够；Research Queue = 先搞清再干。
