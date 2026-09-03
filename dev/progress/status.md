---
title: "Development Progress"
type: progress
status: active
phase: M7
updated: 2026-09-03
summary: "关仓 P0–P7：本地 MERGE_SHA 5c53e8ba，字母槽 idle；origin 推送被 SSH 拒绝，merge 未 parked；W1/I6/D17–D20 旁路；PRD 仍 accepted"
---

# Development Progress

## Current Session

- **关仓（人类明文「收尾」）：** P0–P7 已跑。本地 `MERGE_SHA` = `5c53e8ba`。人类工位未代对齐。
- **P0 盘点：** merge / A / B / C / D / 人类工位均在 `5c53e8ba`；字母槽与 merge 工作区干净。人类工位仅有未跟踪 `.idea/` / `*.iml`（Excluded）。
- **P1–P2：** 无在途代码；记 `already-committed`。无新 tip 合入。
- **P3 stash：** 三条均保留（不确定 / 像他人 slice，不 drop）：`idx`、`temp: merge loop/A before agent-ide`、`pre loop/D T3 merge`。内容是过时 INDEX / page-access 文档，相对 HEAD 无独有完成线。
- **P4：** `skipped-no-stash-commits`。
- **P5：** `git push origin loop/merge` 失败：`kex_exchange_identification: Connection closed by remote host`（GitHub SSH）。未改 git config / remote。merge **不能**标 `parked`。
- **P6：** 字母槽已在 `$MERGE_SHA`，未 `checkout -B`。
- **P7：** 本文件与看板 / 追踪表按「代码已落 ≠ 已验证」对齐。人类工位请自行确认后对齐 `5c53e8ba`。
- **M7 代码完成线（本地）：** P0–P2b、E2-1–E2-7（含 Web 按 phase/capability 省略桌面控件）、Q1–Q6、CS-1–CS-6、I2–I5 / I3a / I3b、K1 / K2 / T1 / L1。方案与 PRD **保持 `accepted`**。
- **未完 / 旁路：** W1 Web 冒烟（D15）；I6 发行标识等发布方；D17 验证债；D18 安装包未验；D19 余项（无动画节点 / Preferences HC / Connection 不造 Back）；D20 Settings 300px 目视。

## 槽位（与 `git worktree list` 对照）

| 槽 | 路径 | 分支 | HEAD | 状态 |
|----|------|------|------|------|
| merge | `vscode-WorkTrees/merge` | `loop/merge` | `5c53e8ba` | 干净；**未 parked**（远端未到此 SHA） |
| A | `vscode-WorkTrees/A` | `loop/A` | `5c53e8ba` | `idle` |
| B | `vscode-WorkTrees/B` | `loop/B` | `5c53e8ba` | `idle` |
| C | `vscode-WorkTrees/C` | `loop/C` | `5c53e8ba` | `idle` |
| D | `vscode-WorkTrees/D` | `loop/D` | `5c53e8ba` | `idle` |
| edit | `Projects/Agents/vscode` | `agent-ide` | `5c53e8ba` | 人类工位；仅 IDE 垃圾未跟踪 |

## Blockers

- 当前没有阻塞全部 M7 UI 开发的代码项。
- 关仓未完成项：origin 推送被 SSH 拒绝；网络恢复后从 merge 槽推 `loop/merge`。
- 非阻塞账：[D8](deferred-gaps.md) valid-layers、D9 terminal、D15 Web 证据、D16 基线红、D17–D20。

## Next

M7 UI 主线代码已尽；不再发明切片。网络恢复后只推远程。剩余：

| 项 | 说明 |
|----|------|
| W1 / D15 | Web 冒烟，不挡主线 |
| I6 | Darwin/Appx 发行标识等发布方，不编造 |
| V | D16/D17 与各面产品验证；不抢生产文件 |
| D19 / D20 | 源码残留与 Settings 300px 目视 |

**不做：** H6 GUA 自动直连、完整插件/Skill 市场、用 fixture 冒充 Engine、为追求全绿冻结 UI、引擎仓侧新增 RPC、会话级模型策略 UI。
