---
title: "Fork diff 足迹（vs 基线 pin）"
type: reference
status: accepted
phase: M0
updated: 2026-09-02
summary: "相对 fork main pin 004a1fbb 的文件数与 LOC；M0 拓扑已合入 b5631393；PRD-009 Diff owner 见 ADR-004 draft"
---

# Diff footprint

> **基线 pin**：`004a1fbb1658e61048b29d76e2ce380adfa18680`（fork `main`；外仓 spike §6 登记）。  
> **测量 HEAD**：`b5631393`（`loop/C` / `loop/merge`；A+B 合入：Conversation 中心 + End 列 Editor/Sources + titlebar 四钮）。  
> **测量工位**：`/home/clarence/Projects/Agents/vscode-WorkTrees/C`  
> **测量命令**（本页数字来源）：

```bash
git diff --stat 004a1fbb1658e61048b29d76e2ce380adfa18680...HEAD
git diff --shortstat 004a1fbb1658e61048b29d76e2ce380adfa18680...HEAD
```

## 全树（含文档与 dev/）

```
101 files changed, 8217 insertions(+), 103 deletions(-)
```

| 指标 | 值 |
|------|-----|
| 变更文件数 | **101** |
| 插入行 | **8217** |
| 删除行 | **103** |
| 净增 LOC | **+8114** |

首波 diff 主体是 `docs/` + `dev/` 文档/bootstrap 与 M0 拓扑相关的 `src/vs/workbench/` 改动。

## 源码子集（`src/` only）

M0 拓扑手术的直接代码面：

```
13 files changed, 921 insertions(+), 101 deletions(-)
```

| 文件 | 角色 |
|------|------|
| `browser/layout.ts` | grid 描述符、End 列 Editor+Sources、`enforceAgentShellVisible`、neighbor、maximize |
| `browser/parts/conversation/conversationPart.ts` | 中心 Part 三槽宿主；产品面在 `contrib/conversation` 透镜 |
| `browser/parts/conversation/media/conversationPart.css` | 中心 Part chrome |
| `browser/parts/sources/sourcesPart.ts` | End 下格 Sources Part 宿主 |
| `browser/parts/sources/media/sourcesPart.css` | Sources Part chrome |
| `contrib/conversation/browser/*` | M1+ 透镜（SessionBar / stub 时间线 / 本地 dock）；**不在** M0 `b5631393` 统计内 |
| `contrib/sources/browser/*` | M1+ Files 列表投影；**不在** M0 `b5631393` 统计内 |
| `services/layout/browser/layoutService.ts` | `Parts.CONVERSATION_PART` / `SOURCES_PART`；`forceShownAgentShellPart` |
| `browser/actions/layoutActions.ts` · `navigationActions.ts` | toggle / 四钮 `LayoutControlMenu` 注册 |
| `browser/contextkeys.ts` · `common/contextkeys.ts` | 上下文键（含 Sources 可见性） |
| `browser/workbench.ts` · `workbench.common.main.ts` | Part 注册 |
| `layout/test/browser/layoutService.test.ts` | 布局服务单测（含 agent shell 互斥） |

**仍 deferred**（不在 footprint 内）：`npm run compile`、启动 T1–T3 演示、EH 探针冒烟 → [deferred-gaps](../../../dev/progress/deferred-gaps.md) D3–D5。

> **M1+ 不重测（D6 已闭）**：上表数字仍锚 M0 `b5631393`；`contrib/conversation` 透镜与 `contrib/sources` Files 列表见 [agent-ui](../../systems/chat/agent-ui.md) · [parts-and-grid](../../systems/workbench/parts-and-grid.md)。本波 **不** 重跑 `git diff --stat`。

## Diff owner（PRD-009 / R6）

HEAD 产品 Diff 深查看仍走 End 列 `EDITOR_PART`（`openSourcesChangeEntry` → `ISCMResource.open` / `MultiDiffEditor`）。对照合同要 `PANEL_PART`。

Owner 裁决草案：[ADR-004](../../../dev/decisions/004-diff-owner.md)（`draft`）**推荐 B** — 底部 Panel 专用容器；否决 A（维持编辑器区）与 C（Sources Changes 内嵌）。签收前 **不**改绑打开路径，本页 **不**因此重测 footprint。

## 相关文档

- [spike-t1-t3-code-facts](spike-t1-t3-code-facts.md) · [m0-topology-surgery](../../../dev/plans/m0-topology-surgery.md)
- [worktree-pool](../../../dev/progress/worktree-pool.md) · [deferred-gaps](../../../dev/progress/deferred-gaps.md)
- [ADR-004 Diff owner](../../../dev/decisions/004-diff-owner.md) · [R6](../../../dev/progress/research-queue.md)
