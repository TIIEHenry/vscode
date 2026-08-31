---
title: "Loop Deferred Gaps"
type: progress
status: accepted
phase: N/A
created: 2026-08-30
updated: 2026-08-31
summary: "P2/P3 延期缺口 SSOT；D7 已闭；D4 启动被 compile 阻塞"
---

# Deferred Gaps

> **SSOT**：当轮无法完成、但不阻塞当前目标的缺口写入本表。  
> 读路径：`dev/progress/status.md` → 本文件 → [research-queue.md](research-queue.md)。

| ID | Priority | Gap | Why Deferred | Exit Condition | Track | Status |
|:---|:---------|:----|:-------------|:---------------|:------|:-------|
| D1 | P3 | 套件 `dev/loop/overview.md` 引用的 `docs/guides/multi-agent-design-workflow.md` 缺失 | 门禁仅 warning 不阻塞 | 指南落盘且 `check-docs-health` 0 warning | docs | open |
| D2 | P2 | 工位池基线未编译验绿 | 编译耗时长；建槽时未跑 | M0 集成编译绿后在 `worktree-pool.md` 标注基线已验 | infra | open |
| D3 | P2 | **M0 compile 验证**（`npm run compile` + `valid-layers-check`） | 并行 slice 进行中；本 tick 禁止 compile | merge 槽集成后编译与分层检查绿 | M0 | open |
| D4 | P2 | **启动 T1–T3 演示**（目视：Conversation 中心、End Editor/Sources、互斥、四钮；M3 无 ChatEditor 默认路径、Sidebar stub Sessions） | **阻塞**：工位 A 无 `out/`、无 `.build/electron/code-oss`、无 `node_modules/`；`launch.sh --skip-prelaunch` 于 2026-08-31 失败（PID 退出，CDP 未起） | `npm run compile`（或 `preLaunch`）绿后隔离 profile 启动；T1–T3 + M3 目视勾选或记 gap | M4 | open |
| D5 | P2 | **EH 探针冒烟**（LSP + layout 类扩展） | 无 running EH probes；矩阵全为推定/待实测 | [eh-surface-matrix](../../docs/reference/code-oss-b2/eh-surface-matrix.md) 关键行标已实测 | M0 | open |
| D6 | P3 | **Diff footprint 刷新** | slot C 已于 `b283fe19` 重测 `b5631393` | 页已更新 | docs | closed |
| D7 | P3 | titlebar LayoutControlMenu 产品四钮与原生 Panel/Aux 共存 | `2dcd5a0a` 已从 LayoutControlMenu 去掉 Panel/Aux；留 submenu | 默认窗只见四钮 | M0 | closed |

## D4 冒烟记录（2026-08-31，工位 A / `loop/A`）

**命令**：`.agents/skills/launch/scripts/launch.sh --repo <A> --source-user-data-dir /tmp/d4-smoke-udd --disable-workspace-trust --skip-prelaunch`（未跑 `npm run compile`，按 M4 切片 2 约束）。

**阻塞**：`code.sh` 立即退出 — `.build/electron/code-oss: 没有那个文件或目录`。工位 A 另缺 `out/`、`node_modules/`；`~/.vscode-oss-dev` 不存在（本次用最小 temp profile 仅验证启动链）。

| 检查 | 结果 |
|------|------|
| T1 中心 = `CONVERSATION_PART`，非 ChatEditor tab | **未验**（未启动） |
| T2 End 上 Preview + 下 `SOURCES_PART` | **未验** |
| T3 四钮 Nav/Conv/Preview/Sources；`Conversation ∨ (Editor ∨ Sources)` | **未验** |
| M3 Command Palette 不开 ChatEditor | **未验** |
| M3 Sidebar stub Sessions 列表 | **未验** |
| 截图 | 无 |

**下一步**：D3 `compile-client` 绿后在本工位重跑 `launch.sh`（可去掉 `--skip-prelaunch` 或先 `npm run compile`），Playwright CDP 目视 + 截图。

## 维护规则

1. **新增**：分配下一 `D<n>` ID；须有可验证 Exit Condition。
2. **闭合**：`Status` → `closed`；并在 `status.md` 记摘要。
3. **与 Research Queue 分工**：本表 = 已知怎么做但优先级/环境不够；Research Queue = 先搞清再干。
