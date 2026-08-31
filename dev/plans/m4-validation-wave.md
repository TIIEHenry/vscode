---
title: "M4 验证波：编译、单测与启动冒烟"
type: plan
status: in_progress
phase: M4
updated: 2026-08-31
summary: "闭合 M0 遗留 D3–D5：compile-client、分层检查、M0–M3 域单测、启动 T1–T3 目视"
---

# M4 验证波

> **前置**：M0–M3 均已 `implemented`（`agent-ide` `b6d1b265`）。  
> **不碰**：Diff FORK / Changes tab、引擎、`vs/sessions`、`layout.ts` grid 手术。

**Goal：** 把 [deferred-gaps.md](../progress/deferred-gaps.md) D3–D5 从 open 推到 closed 或记清阻塞。

## 切片 1 — 编译 + 分层 + 域单测（D3）

| 项 | 命令 / 范围 |
|----|-------------|
| 编译 | `npm run compile-client`（全量 `compile` 若 client 绿再跑） |
| 分层 | `npm run valid-layers-check` |
| 单测 | `scripts/test.sh` 聚焦 `contrib/conversation`、`contrib/sources`、`contrib/chat` 下 M3 相关测（含 `chatEditorShellPaths.test.ts`、`conversationLens.test.ts`、`conversationSessionsView.test.ts`、`conversationStubService.test.ts`） |

**可改**：上述失败路径的 `src/**` 修复；`dev/progress/deferred-gaps.md` D3 行；`health-gates.md` / `worktree-pool.md` 基线注记。  
**禁止**：新功能、改 `layout.ts`、动 FORK 域。

## 切片 2 — 启动 T1–T3 冒烟（D4）

| 检查 | 期望 |
|------|------|
| T1 | 默认窗中心 = `CONVERSATION_PART`，非 `ChatEditor` tab |
| T2 | End 列上 Preview（`EDITOR_PART`）+ 下 `SOURCES_PART` |
| T3 | 四钮 Nav/Conv/Preview/Sources；`Conversation ∨ (Editor ∨ Sources)` 互斥 |
| M3 | Command Palette 不开 ChatEditor；Sidebar 有 stub Sessions 列表 |

用 `.agents/skills/launch/SKILL.md` 隔离 profile 启动；结果写入 `deferred-gaps.md` D4 与 `status.md`。  
**禁止**：改产品行为（只验证 + 记 gap）。

## 文件互斥

| 切片 | 独占 |
|------|------|
| 1 compile/tests | `src/**` 修编译/测；`deferred-gaps` D3 |
| 2 launch smoke | `deferred-gaps` D4、`status.md`、可选 `docs/reference/code-oss-b2/` 实测注记 |

## 验收

1. D3：`compile-client` + `valid-layers-check` 绿，域单测绿。
2. D4：T1–T3 目视勾选或记 blocking gap。
3. `check-docs-health.py` 0 error。
