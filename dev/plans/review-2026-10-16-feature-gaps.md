---
title: "功能缺口审查 2026-10-16"
type: reference
status: draft
phase: M7
updated: 2026-10-16
summary: "复查 2026-10-11 引擎联动缺口并补新发现。G3/D1（05a17c38879）、G4/G15/G16（05a17c38879、1a4c4295b45、f342680627e）、G6（2e785907611）、G8（83ef402a254）、G17（4fa4f3eab56）、D2/D3（cc6e17a9d8f）均已实施。发现稿保持 draft，未闭环缺口待后续迭代。"
---

# 功能缺口审查 2026-10-16

> **范围：** 以工作区磁盘为准（含未提交改动）。五路只读复查：Composer 与会话面、Engine 设置与 Connection、连接配对与会话流、Navigator / Sources / Team、PRD 验收与方案落地。上一轮是 2026-10-11 同名审查，其三条 P0 已收成 [engine-gap-queue-send-attachments](engine-gap-queue-send-attachments.md)。
> **核实口径：** 标 ✓ 的条目由父 agent 在代码里复核过；未标的由子代理核实，本稿未逐条复核。
> **性质：** 发现稿，不是方案。不切实施，不改 PRD 状态。托管 CI 已关是既定选择，不列为缺口。

## 1. P0：误导用户或打断引擎联动

| # | 缺口 | 证据 |
|:--|:-----|:-----|
| G1 ✓ | 生成中仍能 Send。`updateSendEnabled` 只看草稿，不看 streaming 行，也不看 `submitInFlight`。引擎在生成中收到第二条 `Chat` 会把当前 turn 打进 error（见 [engine-protocol-surface §5a](../../docs/reference/universe-agent/engine-protocol-surface.md)） | `conversationLensComposerChrome.ts:583-605`；`conversationLensComposer.ts:338` |
| G2 ✓ | 已连接时队列只能写、读不回来。`getMessageQueueState` 返回空，Inbox 仍提供 Enqueue，roster 仍发 `enqueueQueueItem`。Pause / Resume / Clear / Hold 同样打在看不见的队列上，Pause 点了也没有反馈 | `conversationInboxOverlay.ts:294-297`；`conversationEngineRosterService.ts:633-636`、`:1455`、`:676-728` |
| G3 ✓ | MCP **Add** 不带配置调用 `addServer()`，直接返回 false，界面没有配置表单。**Update** 没有编辑表单，只把选中项原样写回 | `engineMcpSection.ts:273`、`:407-409`、`:433-449` |
| G4 ✓ | Triggers **Add** 固定发空 TriggerDto；Clipboard **Write** 固定发空 content。按钮可点 | `engineTriggerList.ts:122-130`；`engineClipboardList.ts:76-85` |
| G5 ✓ | Files 只有一处改用 `getWorkRoot`，其余仍读 `getSessionWorkDir`。会话无 workDir 时 Files 显示窗口 Explorer 树，和 Changes、Navigator 的根不一致。属会话工作根 S2 未提交的半成品 | `sourcesFilesExplorer.ts:230` 对 `:452`；`sourcesFilesList.ts:383`、`:653` |
| G6 ✓ | Composer 的 Agent 下拉选择后立即回滚，不进发送载荷；`switchAgent` 能力恒为 UNSUPPORTED | `conversationLensDock.ts:215-217`；`universeAgentTypes.ts:60-64` |

G1、G2 即 [engine-gap-queue-send-attachments](engine-gap-queue-send-attachments.md) 的 S1 与 Q2，该方案 `accepted`，代码未动。

## 2. P1：缺入口或缺闭环

| # | 缺口 | 证据 |
|:--|:-----|:-----|
| G7 | 会话命令无 UI 入口：`compact`、`getTodo`、`back`、`prune`、`resetAgent`、`branch`；`suspendLoop` / `resumeLoop` / `stopLoop`；`shelveSession` / `unshelveSession` / `purgeSession` / `exportSession` / `switchWorkDir`；`pauseAgent`、`runToolInBackground`、`stopShellTask`、`sendShellSessionClientControl` | `universeAgentConnection.ts:490-730` 有传输，workbench 无调用 |
| G8 ✓ | Kill 只有 F1 命令，子代理浮层与 Navigator 无入口 | `conversationKillActions.contribution.ts:69-77` |
| G9 ✓ | Continue 只在可重试的错误回合上作为 Retry 出现，没有主动续写 | `conversationTimelineRenderer.ts:817-829` |
| G10 | 附件上传与下载都无 UI；`encodeSessionInput` 不写 `attachments`。按方案 A1 暂不开刀 | `grpcSessionAttachWire.ts:823-829`；`universeAgentConnection.ts:1879` |
| G11 | Memory 全族、`GetGlobalUsage`、`writeFile` / `forceWriteFile` / `agentMerge` 无产品面；Review 遇哈希冲突无强写或三方合并入口 | `engine-protocol-surface.md:124-143` |
| G12 | deleteMessage、editMessage、Fork、Kill、队列操作失败只发通知不回滚（goal 有回滚可对照） | `conversationEngineRosterService.ts:1015-1028`、`:1406-1421` 对 `:1066-1075` |
| G13 ✓ | `file_mutation` 缺 path / operation 时静默丢弃，Review 无「未归因变更」提示 | `fileMutationJoin.ts:366-378` |
| G14 | mailbox 溢出且连接未翻转时，`fail_closed` 跳过 reopen，条幅可长期停在 closed（G-CORE-2 的 S5 未签收） | `sessionViewHost.ts:1914-1916`、`:1973-1976` |
| G15 ✓ | FireTrigger 结果一律画 neutral，不看 `status` / `reason` 是否表示被拒 | `engineTriggersSection.ts:503` |
| G16 | Triggers、Clipboard、Context Variables 三节在能力未知时直接拉列表，无能力闸 | `engineTriggersSection.ts:254-261`；Clipboard `:212-219`；CV `:174-181` |
| G17 | 链路 condemn 后重连期间不清 `_capabilities`，可能沿用上一引擎的能力 | `_closeoutAuthenticatedLink` 约 `:3345-3375` |
| G18 | 已连接时 AutoDrive / 任务列表恒空（无 TaskList RPC） | `conversationStubService.ts:268-271` |
| G19 | 会话工作根 S5：显式切换会话时 Preview Code 不换入换出（PRD-029 验收 3–4，等 PRD-027 P3） | [session-work-root](../parallel/active/session-work-root.md) |
| G20 | PRD-027 P3（删类别过滤与临时关组分支）未做；PRD-024 H6（GUA 直连）未做 | [traceability](../../docs/product/traceability.md) |

## 3. P2

- Doctor、Shutdown、`RemoteAgentService.*` 无用户入口（协议面写明只进传输）。
- session token 只靠 `UNAUTHENTICATED` 被动失效，无主动续连。
- Engine Overview 能力八行不含 Triggers / Clipboard / Context Variables / `mcpRuntime` / `providerConfig`（`engineOverviewSection.ts:118-128`）。
- PRD-028 观感：一行 Composer、会话切换菜单（`conversationLensSessionBar.ts:303` 仍是 `SelectBox`）、目录列表、Markdown 预览未做，见 [cursor-visual-alignment](cursor-visual-alignment.md)。

## 4. 有意不做，不算缺口

- Team 写操作：PRD-022 验收 6 禁止，`navigatorTeamSubviews.test.ts:241-253` 负向锁定。
- Providers / Models 凭据写与模型增删：[engine-catalog](../../docs/systems/workbench/engine-catalog.md) 写明只读。
- Rules / Hooks 只读：同上。

上一轮的「Web 端 Connection 页无仅桌面说明」已补（`connectionPreferencesPane.ts:523-526`）。

## 5. 文档与代码偏差

| # | 文档写法 | 代码事实 |
|:--|:---------|:---------|
| D1 ✓ | [engine-catalog](../../docs/systems/workbench/engine-catalog.md) MCP 行写「写工具栏 Add / Update / Remove」，定义 CRUD 已落 | Add 无配置即返回 false，Update 无编辑表单（G3） |
| D2 ✓ | [sources overview](../../docs/systems/sources/overview.md) 「HEAD 已知偏差」写 `sources-git-diff:` 无内容提供者、P1 未实施 | `sourcesDiff.contribution.ts:27` 已注册 |
| D3 ✓ | [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md) 第 246 行写 hunk 暂存方案「未实施」 | `conversationDiffReviewPane.ts:617`、`sourcesDiffPanelView.ts:644` 已调用 `writeGitApplyHunks`；[sources-accept-stage-hunk](sources-accept-stage-hunk.md) 摘要已写 S1 已落 |

## 6. 不属于功能缺口

`status.md` 列为未拍板的 r03-4、r06-3、r06-4、r11-2、r11-3、r13-2、r14-2、r14-5，按 [review-2026-10-11](review-2026-10-11.md) 各路发现稿核对，都是健壮性或丢数据类 bug，不在本稿。

## 7. 方案

发现稿保持 `draft`。条目归宿与落地情况：

- G1、G2、G5、G7、G10、G11、G19、G20、P2 → [feature-gaps-2026-10-16-boundary](feature-gaps-2026-10-16-boundary.md)
- G3、D1 → [engine-mcp-definition-form](engine-mcp-definition-form.md)（已于 `05a17c38879` 实施）
- G4、G15、G16 → [engine-trigger-clipboard-actions](engine-trigger-clipboard-actions.md)（已于 `05a17c38879`、`1a4c4295b45`、`f342680627e` 实施）
- G6 → [composer-agent-picker](composer-agent-picker.md)（已于 `2e785907611` 实施）
- G8、G9、G12、G13、G14、G18 → [conversation-failure-and-mutation](conversation-failure-and-mutation.md)（其中 G8 路径键盘符与 Kill 动作已于 `83ef402a254` 实施；G9、G12、G13、G14、G18 待后续迭代）
- G17 → [architecture-2026-10-16-concrete](architecture-2026-10-16-concrete.md) §1（断链清理能力快照已于 `4fa4f3eab56` 实施）
- D2、D3 → 文档与代码偏差已于 `cc6e17a9d8f` 实施纠正

落地状态总括：G3/D1（`05a17c38879`）、G4/G15/G16（`05a17c38879`、`1a4c4295b45`、`f342680627e`）、G6（`2e785907611`）、G8（`83ef402a254`）、G17（`4fa4f3eab56`）、D2/D3（`cc6e17a9d8f`）均已实施。其余缺口方案推进中。
