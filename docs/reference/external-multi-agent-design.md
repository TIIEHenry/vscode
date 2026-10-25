---
title: "外部多 Agent 设计对照：AionUi 与 Orca"
type: reference
status: accepted
phase: N/A
updated: 2026-10-24
summary: "2026-10-24 对 iOfficeAI/AionUi 与 stablyai/orca 的只读源码对照。同日用户签收：编排与邮箱留在引擎，IDE 只消费投影；断开后保留原状态并标明无法确认；「需要你」只加标记、不改排序，且须有引擎的名单级聚合；Stop 不清用户消息队列；diff 评论不回送 agent。不改任何 PRD"
---

# 外部多 Agent 设计对照：AionUi 与 Orca

> 导航：[全局索引](../INDEX.md) · [UniverseAgent 引擎参考](universe-agent/INDEX.md) · [引擎协议面](universe-agent/engine-protocol-surface.md) · [PRD-022](../product/requirements.md#prd-022-navigator-引擎段)。
> 本文记录 2026-10-24 的只读源码对照。本文不新增验收，不改任何 PRD，也不替引擎决定 Team 怎么调度。
> **签收（2026-10-24，用户）**：下面 §3 的结论与 §5 的四条决定生效。借的是交互语义（一句话处在什么状态、断开时还敢不敢下结论）。IDE 不自建邮箱、Team MCP 或编排循环；`TeamService` 已在[协议面](universe-agent/engine-protocol-surface.md)，成员、任务和发消息的事实在引擎（[PRD-008](../product/requirements.md#prd-008-引擎与会话权威)）。

两个仓库都**不在宿主里写编排器**。Leader（AionUi）或协调者（Orca）本身是一个普通 agent，任务怎么拆由模型自己调用工具决定；宿主只提供邮箱、任务板、派发和状态回报这几样基础能力。本仓的宿主是引擎，IDE 只做投影、座位和提醒。

## 1. 取样

| 仓库 | 提交 | 看到的 | 没有看到的 |
|------|------|--------|------------|
| [iOfficeAI/AionUi](https://github.com/iOfficeAI/AionUi) | `11cd2a9`（2026-10-23，浅克隆只有这一个提交） | Electron + React 客户端、后端启动与守护、完整的 REST / WebSocket 客户端契约、渲染层、`docs/prds/` 产品需求 | 后端 `aioncore`（readme 指向 `iOfficeAI/AionCore`，推断是 Rust）。ACP 适配、Team 调度、SQLite、Channel、定时任务都在那里。仓内 `.claude/skills/architecture/` 和 `.aionui/FEATURE_CHANNELS.md` 写的 `process/agent/` 等目录已不存在 |
| [stablyai/orca](https://github.com/stablyai/orca) | `4ed7424`（2026-10-23） | 桌面、终端 daemon、编排 SQLite、hook 服务、移动端、云中继、`skill-guides/orchestration/` 全套 | 云中继线上部署；未实际运行 |

AionUi 一节凡涉及后端内部的，都是从客户端契约和 PRD 反推，标「推断」。

## 2. 两者怎么做

| | AionUi | Orca |
|:--|:--|:--|
| 接 agent | ACP（stdio 上的 JSON-RPC）为主；各 CLI 的差异写进 `agent_metadata` 数据（启动命令、握手缓存、`yolo_id`、`team_capable`） | 多数在 PTY 里跑 CLI；另有 ACP 与 Claude Agent SDK 两条结构化通道 |
| 状态来源 | ACP 事件经单例 WebSocket 推给渲染层 | agent 自带 hook 优先，终端输出里的 OSC 7501 兜底，最后看终端标题 |
| 并行单位 | 成员实例（slot），每个 slot 是一个完整会话，各有 `conversation_id` | 「工作区 + 终端」；worker 默认共用当前 worktree，隔离按需开 |
| 编排 | 给成员注入 Team MCP 工具（如 `team_send_message`），宿主提供邮箱、带依赖的任务板、动态加成员 | 协调者调 `orca orchestration` CLI；SQLite 里是 run / task / dispatch / message / delivery |
| 权限 | 每个会话一个审批座位；权限请求和提问分两个端点 | 由各 CLI 自己的 TUI 处理；worker 有问题必须走 `orchestration ask`，不许用本地弹窗 |
| 远程 | WebUI 反向代理到后端；Telegram、飞书、企业微信等渠道生成普通会话 | SSH 上的 `orcad`、headless `orca serve`、带端到端加密的云中继和移动端 |

### AionUi 要点

- **一个成员就是一个完整会话。** 成员的历史、权限、模型、MCP 复用单聊全套，Team 页按成员会话类型直接复用单聊组件，只把「发送」换成 Team 路由（[`TeamChatView.tsx`](https://github.com/iOfficeAI/AionUi/blob/11cd2a9a20d1e033157636efc570b41384c66d85/packages/desktop/src/renderer/pages/team/components/TeamChatView.tsx)）。
- **调度可观测性分三层**：一次用户发言触发一个 team run，每个成员一个 slot 状态机（`idle / queued / starting / running / paused / blocked`），再到成员的单个回合。打断成员时可选队列里的消息 `retain` 或 `discard`（[`teamTypes.ts`](https://github.com/iOfficeAI/AionUi/blob/11cd2a9a20d1e033157636efc570b41384c66d85/packages/desktop/src/common/types/team/teamTypes.ts)）。代价是 21 种 `team.*` 事件加快照对账，前端逻辑很重。
- **重连恢复待处理确认**：重连后 `GET /confirmations` 重建审批卡，撤卡走事件（[`usePendingConfirmationsRecovery.ts`](https://github.com/iOfficeAI/AionUi/blob/11cd2a9a20d1e033157636efc570b41384c66d85/packages/desktop/src/renderer/pages/conversation/Messages/usePendingConfirmationsRecovery.ts)）。
- **会话级租约**：可见页面每 30 秒续租，空闲 5 分钟释放 CLI 进程，下次发消息再 resume（据 `docs/prds/conversations/acp/session.md`；实现在后端）。
- 弱点：Team 默认共用工作区，没有可见的文件锁或冲突机制；成员之间只靠消息，没有共享记忆；审批只在侧栏聚合角标，成员多时要逐列点。

### Orca 要点

- **持久投递与提醒分开。** 消息先入 SQLite，按批投递，确认前重放同一批；往 agent 键入一句「You have N orchestration messages」只是提醒，且只在 agent 已落定时键入，闸门放在唯一提交点（`src/main/runtime/orchestration/mailbox-pointer-delivery.ts`）。
- **活性只认 `live / unverifiable / exited`**，并且「Absence never authorizes stop, abandon, retry, or release」（[`recovery-and-cleanup.md`](https://github.com/stablyai/orca/blob/4ed7424c85ae3575bf3c17d16bb6f05f6b1d1fb6/skill-guides/orchestration/references/recovery-and-cleanup.md)）。
- **注意力分层**：状态 `working / blocked / waiting / done` 折成 `needs-you > done > working > rest` 四档；done 后 1.5 秒内又开始工作算里程碑、不算完成（[`agent-transitions.ts`](https://github.com/stablyai/orca/blob/4ed7424c85ae3575bf3c17d16bb6f05f6b1d1fb6/src/shared/agent-transitions.ts) 的 `AGENT_DONE_QUIET_MS`）。排序时间戳由拥有该工作区的宿主写，客户端只读。
- **幂等与回执**：变更可带 `--retry-request` 重放；`ensureAgentSession` 明确返回 `created` 或 `adopted`，响应丢失后重试拿回同一个终端（`config/scripts/remote-agent-session-authority-repro.mjs`）。
- **worker 契约写给模型看**：`worker_done` 只发一次、正文三句话、同时带 taskId 与 dispatchId；每 5 分钟心跳；被替换时收到 `consumer_fenced` 立即停（[`worker-contract.md`](https://github.com/stablyai/orca/blob/4ed7424c85ae3575bf3c17d16bb6f05f6b1d1fb6/skill-guides/orchestration/references/worker-contract.md)）。同一任务连续失败三次熔断。
- **三个维度分开记**：Orca 内的父子关系（只用于界面分组）、git 基线、执行宿主各自独立；「A fresh worker means a fresh agent terminal, not a new Git worktree」（[`placement-and-remote.md`](https://github.com/stablyai/orca/blob/4ed7424c85ae3575bf3c17d16bb6f05f6b1d1fb6/skill-guides/orchestration/references/placement-and-remote.md)）。
- **diff 行评论回送 agent**，以及修 CI、处理 PR 评论等一键拉起 agent 的动作（`src/shared/diff-comment-types.ts`、`src/shared/source-control-ai-actions.ts`）。
- 代价：状态要从 hook、OSC、标题拼，逐 agent 归一化代码很多；终端 daemon 的端点所有权协议记了七轮评审、23 个同型竞态（`src/main/daemon/AGENTS.md`）。

## 3. 对本仓的结论

签收于 2026-10-24。现状以 HEAD 文档为准。落成功能时按 [规则 10a](../DOCUMENTATION.md) 先改需求；下表本身不改 PRD。

| # | 外部做法 | 本仓现状 | 签收结论 |
|---|----------|----------|----------|
| 1 | Orca：消息持久入队，确认才算送达；提醒只在 agent 空闲时发 | `TeamService.MessageMember` / `StartMember` / `KillMember` / `TaskUpdate` 已进 catalog，UI 未接；[PRD-022](../product/requirements.md#prd-022-navigator-引擎段) 把指挥类操作排除在外（[协议面](universe-agent/engine-protocol-surface.md)） | 「已入队 / 已送达 / 成员已读」只能等引擎给出对应状态再用。`MessageMember` 返回成功只说明引擎收下了。IDE 不自建这三层 |
| 2 | Orca：三值活性，联系不上不等于结束 | [PRD-007](../product/requirements.md#prd-007-诚实降级) 验收 5、PRD-022 验收 5：断开后保留断开前内容，并标明「显示为断开前快照」 | 成员行保留断开前的状态，旁边标明现在无法确认。不把状态改写成「无法确认」或「已结束」。不改 PRD-022 |
| 3 | Orca：`needs-you > done > working > rest` 四档；done 后 1.5 秒内复工不算完成 | 会话列表按最近访问排序（[PRD-002](../product/requirements.md#prd-002-会话上下文) 验收 5）。[pendingActions](../glossary.md) 只在已打开的会话视图里 | 可以加「需要你」标记，不改组内排序。标记的数据必须是引擎给出的名单级聚合；没有这份聚合就先不做。1.5 秒计时器是为终端标题抖动准备的，本仓状态来自结构化事件，不搬 |
| 4 | Orca：幂等重试与 `created / adopted` 回执 | 引擎面已有 `ChatSync.idempotency_key`、队列的 `op_id` / `client_message_id`；读路径的 [ViewFrame](../glossary.md) 已按帧去重。消费方发送时是否每次填值未核 | 只核写入路径：Composer 发送与 Hub 重连（[PRD-003](../product/requirements.md#prd-003-时间线与输入) 验收 5、[PRD-024](../product/requirements.md#prd-024-远程引擎连接connection-hub)）是否每次带上客户端生成的 id。核实之前不改契约 |
| 5 | AionUi：一个成员就是一个完整会话，复用单聊组件 | [PRD-016](../product/requirements.md#prd-016-conversation-session-窗口与-chat-tab)：子代理对话 id 逐字等于引擎 `agent_id`，在 [子代理对话框](../glossary.md) 或延伸 tab 里打开 | 成员对话继续走同一个 Conversation 与 PRD-022 的 Reveal。不另做 Team 页，也不做 AionUi 那种多列并排；并排上限仍是 PRD-011、PRD-016 |
| 6 | AionUi：重连后拉未决确认重建审批卡 | 基线帧的 `SessionViewSnapshot.pendingActions` 已是座位来源 | [PRD-004](../product/requirements.md#prd-004-权限座位) 验收 5 的验证义务：断开重连后，未处理的权限和提问座位仍在、仍可操作。不是新功能 |
| 7 | AionUi：打断成员时，该成员队列 `retain` / `discard` | [Inbox](../glossary.md) 的 Stop 停的是生成；[MessageQueue](../glossary.md) 是用户还没发出的话，已有暂停和清空 | 两套队列分开。Stop 不清用户队列；用户清空走已有操作。AionUi 的取舍不套到 Inbox，也不为此改 [PRD-015](../product/requirements.md#prd-015-conversation-空会话与输入面) |
| 8 | Orca：父子关系、git 基线、执行宿主三维分开 | [PRD-029](../product/requirements.md#prd-029-会话工作根与-workbench-状态跟随会话) 验收 5：切换子代理不改变 Preview 与 Sources | 以后「在其他工作目录新建会话」沿用这条：子代理的父子关系不隐含它的[会话工作根](../glossary.md) |

## 4. 不借的

- **从 PTY、hook、终端标题猜状态。** 本仓走 gRPC，有结构化事件与 [ViewFrame](../glossary.md)，Orca 这一大块防御代码对本仓没有对应物。
- **在 IDE 里重建调度视图。** AionUi 的 21 种 Team 事件加快照对账是因为它的客户端要自己拼 run / slot / turn。本仓 Team 段是只读投影，状态快照由引擎给。
- **宿主侧的进程租约与空闲回收**（AionUi）和**终端 daemon**（Orca）。这些属于引擎进程管理，不在 IDE。
- **diff 行评论回送 agent、一键修 CI**（Orca）。那会把 Review 从「看过没有」变成「评审意见」，与 [PRD-023](../product/requirements.md#prd-023-sources-review-审阅进度与归因) 冲突。2026-10-24 签收为先不做；真出现审阅来回的负担时再单独立需求。
- **同一工作根上的并发写入。** 隔离边界是会话的[会话工作根](../glossary.md)（PRD-029），不是每个成员一个目录；同会话的子代理共享这个根。归因（[PRD-009](../product/requirements.md#prd-009-changes-与-diff)、PRD-023）负责事后说明谁改了文件。成员间频繁互相覆盖之前，不为 Team 单独做 worktree。
- **Leader 代替成员审批。** 侧栏可以聚合待处理数量。授权仍是用户在该会话的座位上决定（PRD-004）；代审会把授权范围放大。
- **done 后 1.5 秒的静默窗口**（Orca `AGENT_DONE_QUIET_MS`）。本仓没有终端标题那层抖动，不搬这个计时器。

## 5. 签收的决定

2026-10-24 用户签收，对应 §3：

1. 断开后成员行保留断开前的状态，并标明无法确认。不改 PRD-022。
2. 「需要你」可以做标记，不改 PRD-002 的组内排序。引擎没有名单级聚合时不做。
3. Stop 不清除用户的 MessageQueue。
4. diff 评论回送 agent 先不做。
