---
title: "Development Progress"
type: progress
status: active
phase: M4
updated: 2026-08-31
summary: "M4 D4 启动冒烟阻塞于 compile；产品需求层与页面接入/比对方案已落盘"
---

# Development Progress

## Current Session

- **产品需求层** [product-requirements-layer.md](../plans/product-requirements-layer.md) **`implemented`**：`docs/product/` 已建立；PRD-001–PRD-011 已落；入口、DOCS-SPEC、文体指南、DOCUMENTATION 已同步；M2 仅回链。未改产品代码，未升 PRD-001–007 为 `implemented`（D4 仍待验证）。严格模式基线：`--strict-frontmatter` 退出 0；`--strict-links` 退出 1（`dev/loop/INDEX.md` 两条既有断链，不修）。
- **页面接入方案** [page-access-schemes.md](../plans/page-access-schemes.md) **`draft`**：多方架构评审已收口（综合 Grok → 4 视角 Composer → 审查另一 Grok → 执行方 2 轮；`ReadyToImplement: yes` 限切片 1a）。知识层四页已 Opus 5.0；**父综合稿待 Opus 5.0**（本轮未授权贵价，不派）。签收前须另开会话走 [DOCUMENTATION 规则 16](../../docs/DOCUMENTATION.md)。非正式，**不实施**。R1–R4 已闭。
- **Chat 并排比对** [chat-compare-split.md](../plans/chat-compare-split.md) **`draft`**：[ADR-001](../decisions/001-chat-compare-form.md) 已接受（同 session 多 chat）；方案已经 Opus 5.0。**不实施**。
- **M5** [m5-ui-shell-hardening.md](../plans/m5-ui-shell-hardening.md) **`proposed`**：默认窗 Chat 路由、roster 导航、关键测试、D4/D5 实测收口。未实施。
- **M4 方案** [m4-validation-wave.md](../plans/m4-validation-wave.md) **`in_progress`**：切片 4 **D1** — [multi-agent-design-workflow.md](../../docs/guides/multi-agent-design-workflow.md) 已落盘（`loop/C`）；切片 1 D3 compile/分层/域单测（工位 merge）；切片 2 **D4 启动冒烟（工位 A）— 阻塞**：`launch.sh --skip-prelaunch` 失败，缺 `.build/electron/code-oss` / `out/` / `node_modules`；T1–T3 与 M3 目视未做。详见 [deferred-gaps.md](deferred-gaps.md) D4 记录。基线 `agent-ide` `b6d1b265`。
- **M3 方案** [m3-shell-closeout.md](../plans/m3-shell-closeout.md) **`implemented`**（关仓 `b6d1b265`）。
- **M2 方案** [m2-product-shell.md](../plans/m2-product-shell.md) **`implemented`**（无引擎产品壳完成线；M3 不阻塞）。
- **M1 切片 3 Sources Files**（`156f0fe5`）：只读列表投影，点击开 End Preview。
- **D7 四钮 chrome**（`2dcd5a0a`）：默认窗 `LayoutControlMenu` 只留 Nav / Conversation / Preview / Sources；Panel/Aux 仍在 submenu。
- **文档**（`c386d6bd`）：agent-ui / layout-state 去掉「slot A 未合入」。
- **M1 方案** [m1-shell-followon.md](../plans/m1-shell-followon.md) **`implemented`**（三切片代码已合入）。UA 引擎不进。Diff 深查看落点仍 **FORK**（未选，未叫 fable）。
- M0 [m0-topology-surgery.md](../plans/m0-topology-surgery.md) **`implemented`**。compile/启动/EH → D3–D5。D7 **closed**。
- 工位 **merge** → M4-1 D3（`compile-client` 运行中，独占 `src/**`）；**B/C** 已合入；**A** 排队 D4（等 merge 构建产物）。

## Loop 基础设施（2026-08-30）

- **套件**：`dev/loop/` = AgenticLoopDev submodule。
- **工位池**：`vscode-WorkTrees/` → [worktree-pool.md](worktree-pool.md)。
- **集成分支**：**`agent-ide`**。
- **门禁**：[health-gates.md](health-gates.md)（本轮未跑 compile）。
- **队列**：[deferred-gaps.md](deferred-gaps.md) · [research-queue.md](research-queue.md)。

## Completed

- 文档系统骨架 + B2 分析簇。
- M0 Conversation 中心 `fc6089a3`；Sources+四钮 `b5631393`；D7 chrome `2dcd5a0a`。
- M1 Conversation 透镜 `4f3fef65`；Sources Files 列表 `156f0fe5`。
- M2 透镜 stub 产品面 `7822d430`；Aux hidden `9b34c1b6`。
- M3 ChatEditor 默认路径 `8ca89e3a`；Navigator stub roster `80b3f76c`；合入 `98522c4b`。
- Diff footprint @ `b283fe19`。
- 页面接入：知识层四页 Opus 5.0 已审改；父综合稿 `page-access-schemes.md` draft（MPDR 步骤 5 Approve with changes；**父稿待 Opus**）。

## Blockers

- **D4**：工位 A 无编译产物，无法隔离 profile 启动 Code OSS；待 D3 compile 后重试 T1–T3 + M3 目视。
