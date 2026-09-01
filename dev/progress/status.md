---
title: "Development Progress"
type: progress
status: active
phase: M4
updated: 2026-09-01
summary: "PRD-016 session-windows S3（fork tab + 子代理对话框）已落 loop/A；M4 D4 仍阻塞于 compile 产物"
---

# Development Progress

## Current Session

- **Conversation session 窗口与 tab：** [conversation-session-windows.md](../plans/conversation-session-windows.md)（`accepted`）· S1/S1a/S2 已合入 `agent-ide`；**S3 同 session（`loop/A`）**：Fork → `CONVERSATION_GROUP` 延伸 tab；子代理 spawn/对话框/最大化。**S3b（`loop/A`）**：子代理 tab 沿 `origin.chat` 面包屑、点击替换延伸 tab；窗口 chrome「关非根」不 `closeGroup` 根组；单测 §5 项 4–5。**待做：** S4 split、S5 窗口并列。

- **文档卫生：** 删除 `dev/plans/status.md` 与 `dev/plans/traceability.md` —— 二者是 `dev/progress/status.md`（本文件）与 [docs/product/traceability.md](../../docs/product/traceability.md) 的**过期副本**（PRD-016 仍写 `draft`/`proposed`），违反单一事实来源，并让 `check-docs-health.py` 多报 30+ 条相对路径断链。SSOT 位置以 [DOCS-SPEC](../../docs/DOCS-SPEC.md) §3 为准；副本非「过时文档」，不进 `dev/archive/`，git 历史已留存。

- **设置两套主面已签收：** [settings-two-surfaces.md](../plans/settings-two-surfaces.md) · [customizations-host-ui.md](../plans/customizations-host-ui.md) · [customizations-engine.md](../plans/customizations-engine.md) 均为 `accepted`。规则 16 三轮 Grok 4.6（Opus 不可用）。**ReadyToImplement：** C5 + donor H0–H3。**E1 blocked PRD-008**。未改 `src/`。

- **空会话与输入面：** [conversation-empty-hero.md](../plans/conversation-empty-hero.md)（`accepted`）· [PRD-015](../../docs/product/requirements.md#prd-015-conversation-空会话与输入面)（`accepted`）· 视觉快照 [conversation-empty-hero.canvas.tsx](../plans/conversation-empty-hero.canvas.tsx)。PreFirst 居中 Composer、Agent/Route XOR、Inbox 分簇。2026-09-01 用户签收。规则 16 Opus 5.0 slug 不可用（未顶替）。**T1–T6 ReadyToImplement**；未改 `src/`。

- **visualize 卡** [thinkrail-visualize-port.md](../plans/thinkrail-visualize-port.md) **`accepted`**：[PRD-014](../../docs/product/requirements.md#prd-014-conversation-图示卡visualize) 已签收；Grok xhigh 规则 16 审查（Opus 不可用）Approve with changes 已改入。**T1–T3 ReadyToImplement**；未改 `src/`。
- **过程折** [conversation-process-fold.md](../plans/conversation-process-fold.md) **`accepted`**：显示 overlay，对话默认收起、轨迹默认展开（P3t）。**P1–P3/P3t ReadyToImplement**；未改 `src/`。
- **轨迹透镜** [conversation-trajectory-lens.md](../plans/conversation-trajectory-lens.md) **`accepted`**：详细列表 + 强制显示压缩相关项；T3 复用过程折 overlay。**T1–T3 ReadyToImplement**；未改 `src/`。
- **产品需求层** [product-requirements-layer.md](../plans/product-requirements-layer.md) **`implemented`**：`docs/product/` 已建立；PRD-001–PRD-014 已编号；入口、DOCS-SPEC、文体指南、DOCUMENTATION 已同步；M2 仅回链。未改产品代码，未升 PRD-001–007 为 `implemented`（D4 仍待验证）。严格模式基线：`--strict-frontmatter` 退出 0；`--strict-links` 退出 1（`dev/loop/INDEX.md` 两条既有断链，不修）。
- **页面接入方案** [page-access-schemes.md](../plans/page-access-schemes.md) **`accepted`**：并行只读审查后改入 Important（Back 命令链、1a 加载图、pane wait、丢掉 `tocData` `id:chat`、entitlement 三路径、撤回 M5 误拥有 `agentSessionsActions`）。切片 **1a / 1b implemented**（`loop/A`：`openPreferences({ paneId })`、UA TOC 链接、Copilot 剥离、深链 handler、StatusBar → Connection pane）。切片 2+ 未开。知识层四页选定设计仍待 §12。R1–R4 已闭。
- **Chat 并排比对** [chat-compare-split.md](../plans/chat-compare-split.md) **`accepted`**：[ADR-001](../decisions/001-chat-compare-form.md) 已接受；上限复用目标已钉死（`_pickCompareTargetGroup` 两组不等价）。**未实施**。
- **M5** [m5-ui-shell-hardening.md](../plans/m5-ui-shell-hardening.md) **`accepted`**：H7 钉死 `platform/agentHost/common` + eslint 去 `vs/sessions/~`；D4 唯一 closer = M5 切片 4 V1–V8。切片 1–3 ReadyToImplement；4–5 等 compile 产物。**未实施**。
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
- 页面接入 / M5 / Chat 并排 / 轨迹 / 过程折 / visualize / **设置两套主面**：方案 `accepted`（2026-09-01 设置签收）。

## Blockers

- **D4**：工位 A 无编译产物。M4 切片 2 只做环境探测；D4 closer 是 M5 切片 4 V1–V8。
