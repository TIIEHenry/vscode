---
title: "多 Agent 方案设计工作流"
type: guide
status: accepted
phase: N/A
updated: 2026-09-01
summary: "方案定稿前的多 agent 探索；写完须只读审查改稿；并行 slice、文件互斥与 worktree 池"
---

# 多 Agent 方案设计工作流

> **定位**：**方案定稿前**的多视角探索与收敛（写 `dev/plans/`、ADR、架构 doc）。**不是** Loop tick 实施自动化——实施阶段见 [dev/loop/overview.md](../../dev/loop/overview.md)。  
> **工位细节 SSOT**：[dev/loop/worktrees.md](../../dev/loop/worktrees.md)

## 何时用本文

| 阶段 | 用本文 | 用 Loop |
|:-----|:-------|:--------|
| 架构抉择、多方案对比、评审质疑清单 | ✓ | 仅辅助起草，不开实施 tick |
| Roadmap checkbox、编码、回归、文档补齐 | — | ✓ |

人类给出方向；父 agent 拆 **冲突域**、派并行探索，合成一份可执行的 plan/ADR 后再进入 Loop。

## 并行 slice（探索与实施通用）

调度单位是 **冲突域 + slice**，不是 roadmap 里逐条 checkbox 或 gap ID。

| 术语 | 含义 |
|:-----|:-----|
| **冲突域** | 合并时高概率同时改动的一组路径（模块目录、主契约文件、共享测试等） |
| **Slice** | 可独立验收的一块工作：有 DoD、验证方式、停止条件 |
| **文件互斥** | 同一 tick 内，**每个冲突域仅 1 个写者**；并行槽的 **文件集两两不交** |

硬规则（与 [parallel-loop-waves.md](../../dev/loop/agent-playbooks/parallel-loop-waves.md) 一致）：

- 同 tick 最多 **3** 个并行 Implementation slice（不同冲突域）。
- **禁止**多槽改同一主文件或同一高冲突目录。
- 父 agent 派工前先输出 **冲突域矩阵**（域 → slice、槽位、任务类、merge 计划 ≤1/域）。

```text
冲突域矩阵（示例）:
  docs-d1-guide     → slice-docs-d1, docs-only, 槽 C, merge 波次末
  src-compile-fix   → slice-m4-d3,   implementation, 槽 merge, 独占 src/**
禁止: 槽 A 与槽 B 同时写 src/vs/workbench/...
```

方案阶段可并行 **读盘 / 调研 / 多视角评审**；**写入**仍遵守上表——例如多 agent 各写候选方案到 **不同临时路径或不同冲突域**，由父 agent 合成进单一 plan 文件，避免多路直接改同一 `dev/plans/*.md`。

## Worktree 池

并行实施（及需要隔离编译的长验证）使用固定 **worktree 池**，不在主工作区（人类 `edit` 工位）占槽。

| 槽位 | 路径 | 职责 |
|:-----|:-----|:-----|
| 主工作区 | 仓库根，`edit` 分支 | 人类 + 协作 agent；**loop 并行不得占用** |
| 合并槽 | `$WT_ROOT/merge` | 对齐 `main`、合入字母槽、集成编译后推 `main` |
| 字母槽 | `$WT_ROOT/A` … `$WT_ROOT/J` | 并行 slice 编码；`loop/<字母>` 分支，用完可复用 |

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
WT_ROOT="$(dirname "$REPO_ROOT")/$(basename "$REPO_ROOT")-WorkTrees"
```

占槽前：基线绿、`git worktree list` 先查后建、字母槽对齐 `origin/main` 后再编码。完整门禁、两边保留合并、禁止 `reset --hard` 丢 WIP → **[worktrees.md](../../dev/loop/worktrees.md)**。

## Merge 槽合入流程

字母槽的提交 **默认不直接 push `main`**；经 merge 槽集成：

```text
loop/A ──┐
loop/B ──┼──→  merge 槽（先 fetch + 对齐 main）──→ main ──→ 集成编译绿
loop/C ──┘
```

1. **merge 槽**先同步最新 `main`。
2. 将已完成 slice 的字母槽分支合入 merge 槽（真三路合并；禁止整文件 `--ours`/`--theirs`）。
3. merge 槽跑集成编译与仓库约定门禁（如 `check-merge-both-sides.sh`）。
4. 在 merge 槽 rebase 到 `main` 并 push；其余字母槽再 `rebase main` 或释放槽位。

**无交叉并行**时日常可单槽合入；**多槽同波**的关仓时机见 [worktree-closeout.md](../../dev/loop/worktree-closeout.md) 转换表——禁止用单槽合入冒充 wave 结束。

## 推荐工作流（方案 → 实施）

1. **探索**：并行 2–4 路（强架构起草 + 质疑清单 + 可选外部 CLI），输出到父 agent 可合成的草稿区。
2. **收敛**：父 agent 写定 `dev/plans/` 或 ADR；冲突域与 slice 队列写入 plan 的 **文件互斥** 表（见 [m4-validation-wave.md](../../dev/plans/m4-validation-wave.md) 示例）。
3. **只读审查**：[DOCUMENTATION 规则 16](../DOCUMENTATION.md)。一篇方案一个只读 reviewer；父 agent 核验后改 Critical / Important。未审不得签收、不得实施。不锁定模型。
4. **实施**：按 [dev/loop/workflow.md](../../dev/loop/workflow.md) 开 Loop tick；每 slice 占字母槽，遵守冲突矩阵与 merge 流程。

## 相关

| 文档 | 说明 |
|:-----|:-----|
| [worktrees.md](../../dev/loop/worktrees.md) | 池初始化、merge 槽、两边保留、违规裁决 |
| [parallel-loop-waves.md](../../dev/loop/agent-playbooks/parallel-loop-waves.md) | Wave 0 冲突矩阵、Multi-Slice ≤3 |
| [worktree-closeout.md](../../dev/loop/worktree-closeout.md) | 波次关仓与合入时机 |
| [overview.md](../../dev/loop/overview.md) | Loop 角色与迭代原则 |
