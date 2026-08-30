---
title: "Loop Deferred Gaps"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-08-30
summary: "P2/P3 延期缺口 SSOT；含 M0 compile/演示/EH/footprint 刷新"
---

# Deferred Gaps

> **SSOT**：当轮无法完成、但不阻塞当前目标的缺口写入本表。  
> 读路径：`dev/progress/status.md` → 本文件 → [research-queue.md](research-queue.md)。

| ID | Priority | Gap | Why Deferred | Exit Condition | Track | Status |
|:---|:---------|:----|:-------------|:---------------|:------|:-------|
| D1 | P3 | 套件 `dev/loop/overview.md` 引用的 `docs/guides/multi-agent-design-workflow.md` 缺失 | 门禁仅 warning 不阻塞 | 指南落盘且 `check-docs-health` 0 warning | docs | open |
| D2 | P2 | 工位池基线未编译验绿 | 编译耗时长；建槽时未跑 | M0 集成编译绿后在 `worktree-pool.md` 标注基线已验 | infra | open |
| D3 | P2 | **M0 compile 验证**（`npm run compile` + `valid-layers-check`） | slot A/B 并行；本 tick 禁止 compile | merge 槽集成后编译与分层检查绿 | M0 | open |
| D4 | P2 | **启动 T1–T3 演示**（目视：Conversation 中心、End Editor、互斥） | 无 compile/启动冒烟；Sources/四钮未齐 | 集成 HEAD 启动通过 T1–T3 勾选于 [m0-topology-surgery](../plans/m0-topology-surgery.md) | M0 | open |
| D5 | P2 | **EH 探针冒烟**（LSP + layout 类扩展） | 无 running EH probes；矩阵全为推定/待实测 | [eh-surface-matrix](../../docs/reference/code-oss-b2/eh-surface-matrix.md) 关键行标已实测 | M0 | open |
| D6 | P3 | **Diff footprint 刷新**（slot A Sources/四钮合入后） | 当前 [diff-footprint](../../docs/reference/code-oss-b2/diff-footprint.md) 仅 ConversationPart 基线 | merge 后重跑 `git diff --stat 004a1fbb...HEAD` 并更新 footprint 页 | docs | open |

## 维护规则

1. **新增**：分配下一 `D<n>` ID；须有可验证 Exit Condition。
2. **闭合**：`Status` → `closed`；并在 `status.md` 记摘要。
3. **与 Research Queue 分工**：本表 = 已知怎么做但优先级/环境不够；Research Queue = 先搞清再干。
