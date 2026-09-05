---
title: "持续审查 · 写文档（15m loop）"
type: progress
status: active
phase: M7
updated: 2026-09-03
summary: "15 分钟循环：对照 HEAD 扫文档漂移与未闭缺口；本文件是审查日志，不升 PRD"
---

# 持续审查 · 写文档

> 读路径：[status.md](status.md) → 本文件 → [deferred-gaps.md](deferred-gaps.md)。  
> 循环：本地 `AGENT_LOOP_TICK_review-docs`，间隔 15 分钟。停：杀该 PID，勿再武装。

## Tick 0 · 2026-09-03 20:44

`check-docs-health.py`：**0 error / 0 warning**（197 文件）。无代码硬阻塞。

### 当轮已改（知识层漂移）

| 文件 | 过时说法 | 现对齐 |
|------|----------|--------|
| [engine-catalog](../../docs/systems/workbench/engine-catalog.md) | 「四节 + M7 未实施」；Plugins/MCP Runtime「未接」；plan 标 `review` | 九节壳已挂；Runtime / Plugins / Model 只读已落；plan `accepted`；Provider/Rules/Hooks 仍 unsupported |
| [engine-protocol-surface §1/§5](../../docs/reference/universe-agent/engine-protocol-surface.md) | 无 Actor 回路；fork catalog 仍写「纯 fixture」 | `openChatStream` 常驻；`drainIntents` / `frameAck` / `overlayDeltaJoin`；live tree → tool catalog |
| [engine-preferences-completion](../plans/engine-preferences-completion.md) | 现状仍写「只挂四节」 | 改为 E2 代码已落、验证未做 |
| [session-windows §3](../../docs/systems/conversation/session-windows.md) | 「活数据依赖 PRD-008」一笔带过 | `syncSubAgentsFromLiveTree` + 本地 Fork |
| [composer-and-inbox](../../docs/systems/conversation/composer-and-inbox.md) | Send = `appendUserTurn` | `post(submitInput)` + Composer 只读填表 |
| [stub-and-fixtures](../../docs/systems/conversation/stub-and-fixtures.md) | 生产注册仍写 StubService；「全量重投影」 | `ConversationEngineRosterService`；`onDidApplyFrame` |
| [conversation INDEX](../../docs/systems/conversation/INDEX.md) / [platform overview](../../docs/modules/platform/overview.md) | 数据「今天来自 stub」；缺 SessionView | roster / lease / capability 键补全 |

### 仍 open（下轮只记变化）

| ID | 问题 | 不做什么 |
|----|------|----------|
| G2 / G3 | visualize typed arm / DetailRef 全文未闭合 | 不升 PRD-008 / PRD-014 |
| D8 | `valid-layers-check` 环境红（豁免门禁） | 不当 blocker |
| D16 | conversation 单测基线红（Lens / identity / stub fixture 数） | 不冻结 UI |
| D15 / D20 | Web 冒烟、Settings 300px 活窗目视欠 | 代码完成线已记 |
| D12 / D17 / D18 | 产品身份、验证债、三平台打包 | 发布方 / V 槽 |
| 未提交 WIP | `agent-ide` 工作区大量 Actor 回路与 UI 改动未 commit | 本循环不代提交 |

**不做：** 改业务代码、升 PRD、为全绿冻结 UI、发明引擎 RPC。

## Tick 1 · 2026-09-03 20:59

工作区相对 Tick 0 **无新业务合入**（WIP 集合同前）。`check-docs-health.py` 仍 0/0。

补 Tick 0 漏网：

| 文件 | 过时说法 | 现对齐 |
|------|----------|--------|
| [conversation overview](../../docs/systems/conversation/overview.md) | 「今天 stub」；PRD-017 `proposed` / 重启即丢 | EngineRoster + stub 帧源；D13 已落；PRD-017 `accepted` 未升 implemented |
| [lens-assembly §4 Send](../../docs/reference/code-oss-b2/conversation-lens-assembly.md) | `appendUserTurn` | `post(submitInput)` |

仍 open 表无新增行。G2/G3、D8/D16/D15/D20、未提交 WIP 不变。

## Tick 2 · 2026-09-03 21:14

新 WIP（不改合同）：Overview 能力行容忍缺 `capabilities[key]`；`openUaPaneReplacingClientSettings` 只是拆出 `IEditorGroupsService`。`check-docs-health.py` 仍 0/0。

补残留口吻：

| 文件 | 过时说法 | 现对齐 |
|------|----------|--------|
| [lens-and-trajectory](../../docs/systems/conversation/lens-and-trajectory.md) | 透镜 id 是「唯一」持久化 | 另有 `conversation.roster.v1` / `conversation.drafts.v1` |
| [navigator-tabs-access](../../docs/reference/code-oss-b2/navigator-tabs-access.md) | 表头「数据仍 stub / 本地」 | 各行已写引擎 data source；表头不再一刀切 |
| [universe-agent INDEX](../../docs/reference/universe-agent/INDEX.md) | 「R5 草案」 | m6 已 `accepted`，R5 已闭 |

仍 open 表无新增行。

## Tick 3 · 2026-09-03 21:29

新出现两份方案（`dev/plans/INDEX.md` 已挂，正文 `review`，规则 16 **待起审**）：

| 方案 | 问题 | 本循环 |
|------|------|--------|
| [session-view-frame-fanout](../plans/session-view-frame-fanout.md) | ProxyChannel 全窗广播 + 跨进程首帧 baseline 必丢；`takeIntents` 靠 `post→drain` 不变量 | 知识层标明「拟改、未实施」 |
| [m7-gap-closeout](../plans/m7-gap-closeout.md) | GC-1–6：hubDevice profile、设备动作 / 设备码、Test 探到 `GetAuthNonce`、catalog 跟树、Team / Inspect stale、Overview 模型摘要 | 降调 Tick 0 把 live catalog 写成已落地 |

知识层已改：[session-windows §3](../../docs/systems/conversation/session-windows.md)、[protocol-surface §5](../../docs/reference/universe-agent/engine-protocol-surface.md)。

仍 open：G2/G3、D8/D16/D15/D20；外加 GC-1–6 / fanout（`review`）。**不**代做规则 16、不实施。

## Tick 4 · 2026-09-03 21:44

两份方案仍 `review`，文末仍「待起审」。无新方案、无新 D 项。`status.md` 已由他处补了两方案摘要。

补知识层：

| 文件 | 过时说法 | 现对齐 |
|------|----------|--------|
| [settings-ua-access §7](../../docs/reference/code-oss-b2/settings-ua-access.md) | Test Connection 只写无 profile 空态 | 有 active profile 时 HEAD 只回显 phase，不探 `GetAuthNonce`（GC-3） |

仍 open 表同 Tick 3。
