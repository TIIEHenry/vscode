---
title: "Fork diff 足迹（vs 基线 pin）"
type: reference
status: accepted
phase: M0
updated: 2026-08-30
summary: "相对 fork main pin 004a1fbb 的文件数与 LOC；ConversationPart 基线；Sources/四钮合入后须刷新"
---

# Diff footprint

> **基线 pin**：`004a1fbb1658e61048b29d76e2ce380adfa18680`（fork `main`；外仓 spike §6 登记）。  
> **测量 HEAD**：`fc6089a3`（`loop/B` / `agent-ide`；T1–T3 Conversation+Editor 拓扑已落，Sources 占位与四钮 **未** 合入）。  
> **测量工位**：`/home/clarence/Projects/Agents/vscode-WorkTrees/B`  
> **测量命令**（本页数字来源）：

```bash
git diff --stat 004a1fbb1658e61048b29d76e2ce380adfa18680...HEAD
git diff --shortstat 004a1fbb1658e61048b29d76e2ce380adfa18680...HEAD
```

## 全树（含文档与 dev/）

```
97 files changed, 7539 insertions(+), 99 deletions(-)
```

| 指标 | 值 |
|------|-----|
| 变更文件数 | **97** |
| 插入行 | **7539** |
| 删除行 | **99** |
| 净增 LOC | **+7440** |

首波 diff 主体是 `docs/` + `dev/` 文档/bootstrap 与 M0 拓扑相关的 `src/vs/workbench/` 改动。

## 源码子集（`src/` only）

ConversationPart 拓扑手术的直接代码面：

```
11 files changed, 418 insertions(+), 97 deletions(-)
```

| 文件 | 角色 |
|------|------|
| `browser/layout.ts` | grid 描述符、互斥、neighbor、maximize |
| `browser/parts/conversation/conversationPart.ts` | 新中心 Part（M0 占位） |
| `browser/parts/conversation/media/conversationPart.css` | 占位样式 |
| `services/layout/browser/layoutService.ts` | `Parts.CONVERSATION_PART` 枚举 |
| `browser/actions/layoutActions.ts` · `navigationActions.ts` | toggle / 导航 |
| `browser/contextkeys.ts` · `common/contextkeys.ts` | 上下文键 |
| `browser/workbench.ts` · `workbench.common.main.ts` | Part 注册 |
| `layout/test/browser/layoutService.test.ts` | 布局服务单测 |

**未含**（slot A 并行实现中）：Sources 占位 Part、titlebar layout controls 四钮 wiring。

## TBD@merge

**slot A** 正在并行添加 Sources 占位 Part + titlebar 四钮相关文件。  
**merge 槽** 在 A 合入后 **必须** 重新跑上述 `git diff` 命令并刷新本页数字——当前 footprint 是 **ConversationPart-only 基线**，不能代表 M0 完成态。

| 待刷新项 | 原因 |
|--------|------|
| `src/` 文件数与 LOC | Sources Part + 四钮 actions/CSS |
| 全树 LOC | 文档与 A 侧 commit 可能追加 |
| rebase 冲突面 | 仅量化、不判 acceptable；merge 时对照 pin → 集成 HEAD |

## 相关文档

- [spike-t1-t3-code-facts](spike-t1-t3-code-facts.md) · [m0-topology-surgery](../../../dev/plans/m0-topology-surgery.md)
- [worktree-pool](../../../dev/progress/worktree-pool.md) · [deferred-gaps](../../../dev/progress/deferred-gaps.md)（D6 footprint refresh）
