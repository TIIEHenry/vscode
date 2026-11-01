---
title: "Conversation 消息订阅 UI 审查与改进方案：控制流与子代理"
type: plan
status: draft
phase: N/A
updated: 2026-11-01
summary: "审查订阅链路 → 投影 → 时间线 / 过程折 / 子代理显示（基线 6842a293306，复核 6180ee097e7）。三条根因：引擎与宿主的活态都只有每会话一份，子代理的逐字流不进会话流；回合与代理不是视图实体，活态靠多处谓词猜；引擎已发的工具终态、停止原因、子代理活动与 parent_tool_call_id 被丢弃。方案分 U1–U8，先做无合同的渲染层收口，再接宿主解码与 runtime sidecar（显式例外），再加回合 chrome 与子代理卡；多块 overlay 需引擎与 session-core 两处上游。规则 16 审查一轮已改入；D-1 至 D-5 待用户拍板。"
---

# Conversation 消息订阅 UI 审查与改进方案：控制流与子代理

状态：草案。范围：contrib/conversation 时间线、过程折、座位、子代理对话框与 catalog；platform/universeAgent/node 宿主侧解码与 overlay 交接。负责：agent:kiro。
覆盖需求：PRD-003、PRD-004、PRD-007、PRD-012、PRD-013、PRD-016。

> **定位：** 本稿是审查结论加改进方案，不 supersede [conversation-stream-timeline](conversation-stream-timeline.md)（`accepted`）、[conversation-timeline-refactor](conversation-timeline-refactor.md)（`implemented`，[ADR-010](../decisions/010-conversation-timeline-document-flow.md)）、[conversation-ui-closeout](conversation-ui-closeout.md) 与 [conversation-session-windows](conversation-session-windows.md)。对这几稿已拍板句子的修订集中在 [§10](#10-对既有方案与知识页的修订)，签收前不生效。
> **审查基线：** HEAD `6842a293306`（2026-10-31）写稿，`6180ee097e7` 复核；期间 `conversationEngineRosterService.ts` 与 `conversationLensComposerChrome.ts` 有改动，这两个文件的行号以复核时为准。行号写「约」的是函数起点附近，实施前再核一次。
> **路径缩写：** `cb/` = `src/vs/workbench/contrib/conversation/browser/`；`ccm/` = `src/vs/workbench/contrib/conversation/common/`；`uan/` = `src/vs/platform/universeAgent/node/`；`core/` = `uan/sessionCore/`（Desktop session-core 的 vendored 副本，见 `core/SYNC.md`，**不得手改**）。
> **外仓（只读引用）：** 引擎 proto `UniverseAgent/grpc-api/src/main/proto/message_envelope.proto`；引擎 overlay `UniverseAgent/grpc-server/.../grpc/SessionRuntimeOverlayRegistry.kt`；会话流镜像白名单 `UniverseAgent/protocol/.../event/BroadcastQueryEventMirrorAllowlist.kt`。

## 1. 结论

审查覆盖三段：引擎会话流怎么进到宿主和 renderer（订阅链路）；思考、工具、权限、提问、错误等控制流行怎么画（控制流显示）；子代理在父时间线、对话框、catalog 和轨迹里怎么出现（子代理显示）。问题大多能归到三条根因。

1. **活态每会话只有一份，子代理的逐字流不进会话流。** 引擎 `SessionRuntimeOverlayRegistry` 每会话只记一个 `turnId` 与一段正文；宿主 `OverlayDeltaJoin` 与 vendored Actor 也各只有一份。镜像白名单里有 `SubAgentActivity` / `SubAgentCompleted`，没有 `TextDelta` / `ThinkingDelta`，所以工具拉起的子代理大概率不会在父会话流里逐字出现，它的进度只能从 `sub_agent_activity` 拿，而这个事件宿主没有解码。子代理对话框里因此没有活行，只能等 L2 落盘。活工具状态写死 `running`，一块只能有一个工具名。
2. **回合和代理不是视图实体。** 渲染层只有平铺行。「是否在生成」「是否执行中」「能否收起」由至少六处谓词各自推断，结论不一致。子代理页是对同一条会话时间线按 `agentId` 过滤；根页不过滤，把所有代理的思考和工具混在根代理的过程折里。
3. **引擎已经发了的结构化事实被丢弃。** 工具终态与耗时、工具参数流、回合停止原因、子代理阶段 / 当前工具 / 结果、拉起关系（`detached_child_phase`、`parent_tool_call_id`）、overlay 快照里的 `active_tool_calls` 与 `sub_agent_panels`，wire 解码器都没有读。UI 要等 L2 落盘才知道工具结束，从不知道子代理在做什么。

改进方向：先在渲染层收口活态判定与显示模式（不需要合同）；再让宿主解码已有字段，以 vscode 自有的 runtime sidecar 交给 renderer（这是对「vscode 不自研 fold」的显式例外，需拍板）；在此之上加回合 chrome、稳定显示键和父时间线里的子代理卡。多块 overlay 与增量 chunk 需要引擎与 session-core 两处上游。切片见 [§8](#8-切片)，待拍板项见 [§11](#11-待用户拍板)。

## 2. 审查范围与方法

| 段 | 读过的文件 |
|----|------------|
| 订阅链路 | `uan/grpc/grpcSessionAttachWire.ts`（解码注释约452–540、`decodeSessionStreamEvent`、各子消息解码约1006–1194）· `uan/sessionStreamDemux.ts` · `uan/overlayDeltaJoin.ts` · `uan/sessionViewHost.ts`（`openStream`、`handleHostStreamPayload`、attribution hint、`onFrameEnqueued`、重开退避）· `core/session-actor-overlay-fold.ts` · `cb/conversationEngineFrameSource.ts` · `cb/conversationLensSessionBinding.ts` · `cb/conversationTimelineScheduler.ts` · `cb/conversationLensProjection.ts` |
| 投影与控制流 | `cb/conversationSessionView.ts`（`projectSnapshotToEntries`、`projectOverlayEntries`、`timelineItemToEntries`、`entriesToLegacyTurns`）· `cb/conversationProcessFoldModel.ts` · `cb/conversationProcessFold.ts` · `cb/conversationTimelineRenderer.ts` · `cb/conversationTimelineItemHost.ts` · `cb/conversationTimelineHost.ts` · `cb/conversationLensDock.ts` · `cb/conversationLensComposerChrome.ts` |
| 子代理 | `cb/conversationSubAgentOverlay.ts` · `cb/conversationSessionChatService.ts` · `cb/conversationSessionChat.contribution.ts` · `ccm/conversationLiveAgentCatalog.ts` · `cb/conversationTrajectoryModel.ts`（`passesTrajectoryAgentFilter`、`finalizeToolTree`）· `cb/conversationEngineRosterService.ts`（fork / kill / cancel / delete / `lastStreamingAgentId`）· `cb/conversationKillEngine.ts` |
| 合同对照 | [lens-and-trajectory](../../docs/systems/conversation/lens-and-trajectory.md) · [conversation-stream-timeline](conversation-stream-timeline.md) §1 / §3.3 / §6 · [conversation-timeline-refactor](conversation-timeline-refactor.md) D5 / D10 / F10 / §3.6 · [conversation-ui-closeout](conversation-ui-closeout.md) Q4 · PRD-013 / PRD-016 · 引擎 proto 与上表两份 Kotlin 文件 |

只读审查，没有启动窗口做真实会话复现。凡写「会」的行为都由代码路径推出。引擎侧两条事实（overlay 每会话一份、逐字 delta 不镜像）来自读源码，未在运行中的引擎上验证，标为「待引擎确认」。[§9](#9-验收) 要求实施前先写失败断言复现。

## 3. 现状数据路径

```text
引擎 SessionRuntimeOverlayRegistry（每会话一份 overlay）+ BroadcastQueryEventMirrorAllowlist（哪些事件进会话流）
gRPC SessionStreamEvent
  └─ uan/grpcSessionAttachWire.decodeSessionStreamEvent        只解出部分字段（§4.1 S4）
      └─ SessionViewHost.openStream 回调（约1841）
          ├─ handleHostStreamPayload（约906）  agent tree 刷新 / team / topology / 文件变更 / attribution hint
          ├─ demuxSessionStreamPayload          L1 / L2 / L4 / overlay 快照 → Actor arm
          └─ OverlayDeltaJoin.handlePayload     L3 delta 累成全文 → overlayActiveTurn arm
              └─ core SessionActor fold → ViewFrame（timeline[] / overlay.blocks[] / pendingActions / sync / liveAgentTree）
                  └─ onFrameEnqueued（约1270）加 attribution 补丁、算 changedIds → IPC
                      └─ cb SharedEngineHostBinding（每会话一个宿主 lease，根 tab / 子代理对话框 / fork tab 共用）
                          └─ 调度器（rAF / 16ms）→ projectSnapshotToEntries（全量，有缓存；filterAgentId 只在 renderer）
                              └─ entriesToRenderableTurns → projectProcessFoldSpans → 按根协调 → DOM
```

时间线行的来源只有三个数组：`timeline[]`（L2 落盘行）、`localPendingSends[]`（乐观发送）、`overlay.blocks[]`（L3 活态）。三者用 band 排序：timeline、发送、overlay（`cb/conversationSessionView.ts` 约383）。宿主不知道 renderer 在看哪个代理：`filterAgentId` 只存在于 `ConversationLens`。

## 4. 问题清单

严重度：**高** = 用户能看到错误内容或丢内容；**中** = 状态显示不一致或误导；**低** = 维护成本或性能。

### 4.1 订阅链路

| ID | 严重度 | 问题 | 证据 |
|----|--------|------|------|
| S1 | 高（待引擎确认） | **活态每会话一份。** 引擎 overlay 每会话一个 `turnId`，任意代理的 `TurnStart` 都会重置；`contextFor` 给每个 delta 盖的是会话当前 `turnId`，与 `agentId` 无关。宿主 `OverlayDeltaJoin` 每会话一个实例，见到不同 `turn_id` 就清空；Actor 只有一个 `overlayActiveTurnBlockId`。两种后果：① 工具拉起的子代理逐字流不在镜像白名单里，子代理对话框没有活行；② 若两个代理确实同时流式（如直接对子代理发话时根代理也在生成），delta 共用一个 `turnId`，正文拼进同一块，`agentId` 来回跳，过滤页时有时无 | 引擎 `SessionRuntimeOverlayRegistry.kt` 约189–218、约517–528；`BroadcastQueryEventMirrorAllowlist.kt` 约19–49；`uan/overlayDeltaJoin.ts` `applyDelta` 约318–339、`noteAgentId`；`core/session-actor-overlay-fold.ts` 约121–126 |
| S2 | 中 | **活工具状态写死 running，一块只容一个工具。** overlay summary 只要有 `generatingToolName` 就是 `{kind:'tool', status:'running'}`。工具完成、失败、等待权限都要等 L2；并行工具只显示最后一个 | `core/session-actor-overlay-fold.ts` 约141–149 |
| S3 | 低 | **每个 delta 重发全文。** `activeTurnArm` 带累计全文，Actor 每次整块 upsert 新 chunk 数组，主进程到 renderer 的字节数随回合长度平方增长；`overlayJoins` 按 chunk 数组身份缓存，每帧都失效 | `uan/overlayDeltaJoin.ts` `activeTurnArm`；`cb/conversationSessionView.ts` `joinOverlayChunks` |
| S4 | 高 | **引擎已发字段未解码或解码未用。** 见下表 | `uan/grpc/grpcSessionAttachWire.ts` 约456–540 注释、约595–597、约1006–1194 |
| S5 | 中 | **交接的残留缺口。** D5 已按 `turn_id` 关联交接，常态没问题。残留：2s 挂起超时只计诊断，不告诉 UI；`sessionClosed` 直接清 overlay，未落盘的字静默消失；S1 ② 的情形下交接可能配错代理 | `uan/overlayDeltaJoin.ts` `overlayHandoffHoldMs = 2000`、`onHoldTimeout`；`core/session-actor-overlay-fold.ts` `tryFoldL1SyncChromeStreamEvent` |
| S6 | 中 | **排序 band 与回合无关。** overlay 永远排在所有发送之后：生成中再发一句，新句子出现在上一轮正在流的回答上面；该句落盘成 timeline 用户行后仍在 overlay 上面。只在 `pendingActions` 里的座位插在 timeline band 末尾，即活思考 / 工具之前 | `cb/conversationSessionView.ts` band 约383、排序与 splice 约652–658 |
| S7 | 低 | **同一快照每帧投影多遍。** 透镜有缓存的 `projectSnapshotToEntries`；roster `publishRosterDetailIfChanged` 每帧再走无缓存的 `getTurns`；`isPreFirst`、`lastStreamingAgentId` 各再走一遍；轨迹另有一套投影。宿主算的 `changedIds` 在重构 §2 里已明确不用于变化判定 | `cb/conversationEngineRosterService.ts` `getTurns`、`lastStreamingAgentId` 约1620；`cb/conversationTimelineHost.ts:347` `_applied` 未用 |
| S8 | 中 | **attribution 靠 hint 拼，且 hint 只增不减。** 宿主把 envelope、`tool_call_lifecycle`、overlay delta、pendingAction 的 `agent_id` 存进每会话一个数组，按 itemId / toolCallId / compactBranchTurnId 线性 `find`；lifecycle hint 的 itemId 用 `turnId ?? toolCallId`，两种键混在一起；每个 lifecycle 事件（含 args_complete / completed / failed）都 `push` 一条，数组从不裁剪或删除，内存与每次 baseline 的「行 × hint」成本随会话无限增长。renderer 还要按 `${requestId}:` 前缀从 pendingActions 借 agentId | `uan/sessionViewHost.ts` `toolAttributionHints` 约309、`captureToolAttributionHint` 约1047–1068、`findAttributionHint` 约2455；`cb/conversationSessionView.ts` `permissionAgentIdForRow` 约422 |
| S9 | 中 | **流状态不进 UI。** 缺口回填、range replace 拒绝、重开退避、挂起超时只有诊断计数。时间线没有「重连中」或「这一轮在断连时未完成」的标记，只有 SessionBar 徽标 | `uan/sessionViewHost.ts` 重开退避约1960–2023 |

S4 明细（字段号以 proto 为准；`SessionStreamEvent` oneof 30–46）：

| 事件 | 已读并使用 | 已解码未用 | 未解码但引擎在发 | UI 后果 |
|------|------------|------------|------------------|---------|
| `streaming_delta` 30 / `thinking_delta` 31 | `turn_id` `agent_id` `text_delta` | `block_id` `delta_seq` | — | 无法发现丢 delta。`block_id` 只是 `${turnId}:text` / `:thinking`，不带块序 |
| `tool_call_lifecycle` 32 | `turn_id` `tool_call_id` `agent_id` `started.tool_name` | — | `runtime_epoch`、`started.args_json`、`args_complete`、`completed{output,is_error,duration_ms}`、`failed{error_message}`。`completed.metadata_json` 按 UA ADR-395 S5 有意不解码 | 活工具永远 running，无耗时 |
| `tool_call_delta` 33 | — | — | 整个事件未解码 | 工具参数 / 输出不流式 |
| `turn_lifecycle` 37 | `turn_completed.turn_id` `assistant_turn_id`；`turn_started.turn_id` | — | `turn_completed.agent_id` `stop_reason` token 四项 `model_*`；`turn_started.agent_id` `model_*` | 回合没有停止原因、取消 / 截断不可辨 |
| `sub_agent_activity` 35 | 仅「出现过」 | — | `parent_tool_call_id` `sub_agent_id` `depth` `append_entry{thought,tool_invocation}` `set_status{phase,tool_call_id,tool_name,args_json}` `set_live_usage` | 父页不知道子代理在思考还是跑哪个工具。`thought` 条目只有时刻与耗时，没有文字 |
| `sub_agent_completed` 36 | 仅「出现过」 | — | `sub_agent_id` `parent_tool_call_id` `output` `outcome`（含 `RECOVERABLE_ERROR`） | 不知道子代理成功、失败还是被取消 |
| `detached_child_phase` 38 | 仅「出现过」 | — | `tool_call_id` `phase` `child_agent_id` | 拉起工具与子代理的直接连接没用上 |
| `multi_agent_status` 39 | `team_created.team_id` | — | 成员相关 arm、`member_count` | 团队成员状态不可见（本稿不展开） |
| `deep_think_*` 40–43、`conditional_agent` 45 | — | — | 整个事件未解码 | 不在本稿范围，登记待后续 |
| `runtime_overlay_snapshot` 44 | `active_turn` `pending` `tool_runtime_snapshots` | — | `active_tool_calls`（含 lifecycle 与 `child_agent_id`）、`sub_agent_panels`（含 `status_summary` `entries`）、`deep_think`、两项 high-water | 重新挂接后活工具与子代理面板丢失 |
| `permission_request` 50 / `ask_user_question` 51 / `client_tool_call` 52 / pending 快照 | `request_id` `agent_id` 等 | — | `parent_tool_call_id` | 座位无法挂到所属工具 |

### 4.2 控制流显示

| ID | 严重度 | 问题 | 证据 |
|----|--------|------|------|
| C1 | 高 | **没有回合实体。** 不显示回合状态、停止原因、被取消 / 中断、耗时。生成中只能从「有一行 `streaming`」推断：Stop 的判定 `streaming && toolStatus !== 'pending'` 写了三遍，减掉 pending 是在补 C2 的过载 | `cb/conversationLensDock.ts:184`；`cb/conversationLensComposerChrome.ts` 约776–784 |
| C2 | 中 | **`streaming` 一词两义，活态谓词不一致。** 文档说它是「overlay 行还在收 delta」，但落盘的 pending / running 工具也被置 `streaming`。各处判定：`isExecutingTurn` 含流式思考；`countProcessFoldToolStatuses().executing` 只数工具，pending 同时算 waiting 和 executing；`toolStillOpen` 把未知状态当未结束，`isExecutingTurn` 当已结束；宿主 `busy` / `cvVisible` 只看 `streaming`，也不看 `showLiveChrome`。结果之一：只有流式思考的折被锁开、`aria-disabled`，外层却没有转圈 | `cb/conversationSessionView.ts` 约1315；`cb/conversationProcessFold.ts` `isExecutingTurn` 约1042、`resolveProcessFoldHeaderIcon` 约167、`toolStillOpen` 约1157；`cb/conversationProcessFoldModel.ts` 约246；`cb/conversationTimelineHost.ts` 约935–944 |
| C3 | 中 | **overlay → L2 换 id。** `overlay:X` → envelope id、`overlay:X:think` → `<id>:think`、`fold:overlay:…` → `fold:<id>`。DOM 拆掉重建、流式 Markdown 句柄换成完整渲染、用户在生成中展开的思考或工具在落盘瞬间收起。PRD-003.4 要求「用户在流式期间展开或收起的过程折不因新增量而重置」，落盘这一下仍会重置。这是 [closeout Q4](conversation-ui-closeout.md) 定下的合同行为 | `cb/conversationProcessFoldModel.ts` 约38–44 注释；`cb/conversationSessionView.ts` `projectOverlayEntries` 约851 |
| C4 | 中 | **执行中强制展开不写入展开表。** 最后一个工具一结束，折立刻收回默认收起，与 C3 叠加时整段在用户眼前跳两次 | `cb/conversationProcessFold.ts` `outerPaintedOpen` 约226、注释约184 |
| C5 | 中 | **同一 turn 的正文 / 思考 / 工具拆行靠特例分支。** overlay 侧 `toolKeepsBody`、落盘侧 `assistantText` 两套写法，固定按「思考、正文、工具」出行；一封 envelope 里正文与工具调用交错时（先说一句、调工具、再说一句），原有顺序丢失。中间的正文行把思考和工具切成两个折。渲染前还要 `omitToolThinkingAlreadyInReadingRow` 去重。根源是 demux 一封 envelope 只选一个 arm（`BLOCK_PRIORITY`），其余块塞进副字段再拆回来。另：[refactor D10](conversation-timeline-refactor.md) 写「不派生 id」，代码实际派生了 `:think` 与 `:body` | `cb/conversationSessionView.ts` `projectOverlayEntries`、`timelineItemToEntries` 约1185、`omitToolThinkingAlreadyInReadingRow`；`uan/sessionStreamDemux.ts:50` |
| C6 | 中 | **「Stub」与「断连缓存」混为一个开关。** `showLiveChrome` 为假时外层摘要加 `Stub ·`，引擎缓存会话在断连时也被标成 Stub；状态文字（Failed / Cancelled）整段省略，图标却照画，图标又是 `aria-hidden`，读屏在这个模式下听不到失败 | `cb/conversationProcessFoldModel.ts` `formatFoldStepSummary` 约305；`cb/conversationProcessFold.ts` `formatToolSummary` 约1082、`resolveToolStatusIcon` 约1064；`cb/conversationLensReadingColumn.ts` 约209 |
| C7 | 低 | **无障碍细节。** 时间线 `role=log` 里套 `role=feed`；错误行是 `role=group`，新错误不播报，而客户端工具送达失败是 `role=alert`，两处不一致；锁开的标题 `aria-disabled` 仍可聚焦，点了没反应也不说明；`<button>` 上多写 `role=button` | `cb/conversationTimelineHost.ts:123`、`:155`；`cb/conversationTimelineRenderer.ts:898`；`cb/conversationProcessFold.ts:212`、`:569`、`:919`、`:1155` |
| C8 | 低 | **对话页与轨迹页两套模型。** kind 集合、成折白名单、步骤名、思考预览、状态计数各一套；轨迹折头没有 failed / waiting / cancelled | `cb/conversationProcessFoldModel.ts` 约22 与约101、`collectTrajectoryStepNames`、`summarizeTrajectoryProcessSteps` |
| C9 | 低 | **死路径与选项漂移。** 文档流宿主的 `buildHostRoots` 把每个 thinking / tool 行都放进折根，由 ItemHost 自己画，所以 `ConversationTimelineRenderer.renderElement` 的过程折分支和 `renderStandaloneThinkingOrToolRow` 已不可达；`nestThinkingTools` 从不填 `tools`，嵌套工具代码不可达；`defaultOuterExpanded` 传了没人读。两份 `renderProcessFoldSpan` 选项已漂移：ItemHost 不传 `isRespondInFlight`，也不经 `noteClientToolResponse`。目前在途状态来自 `responseState`，所以没有丢功能，只是两套 | `cb/conversationTimelineHost.ts` 约1310–1345；`cb/conversationTimelineRenderer.ts` 约172–221；`cb/conversationTimelineItemHost.ts` 约160–178；`cb/conversationProcessFoldModel.ts` 约20–31 |
| C10 | 已闭合 | **PRD-013.1 旧文字与实现形态不一致。** 已按现行实现修订为「外层过程区下 Thinking 与工具平级；各自正文 / payload 在所属行下缩进」，工具不收进前面的 Thinking。 | `docs/product/requirements.md` PRD-013.1；[lens-and-trajectory §4](../../docs/systems/conversation/lens-and-trajectory.md#4-过程折overlay不是列表身份) |

### 4.3 子代理显示

| ID | 严重度 | 问题 | 证据 |
|----|--------|------|------|
| A1 | 高 | **根页把所有代理混排。** 根 tab 不传 `filterAgentId`，所有代理落盘的思考、工具、正文进同一条流。代理名只在助手正文行首行显示，而且显示的是原始 `agentId`，不是 catalog 里的名字；思考和工具行没有代理标记，子代理的工具会并进根代理的同一个过程折 | `cb/conversationEditorPane.ts:118`；`cb/conversationTimelineRenderer.ts` `readingTurnSourceName` 约99–104；`cb/conversationProcessFoldModel.ts` `projectProcessFoldSpans` 不看 agentId |
| A2 | 高 | **父时间线没有子代理卡。** 拉起子代理的那次工具调用是普通工具行；没有任何代码把工具行的 `toolCallId` 连到 catalog 里的代理（`detached_child_phase` 与 `sub_agent_activity.parent_tool_call_id` 都能给出这条连接，但未解码）；父页看不到子代理的运行状态、进度或结果。只有当助手正文里恰好有 `conversation-chat:` 链接时才出现 pill | `ccm/conversationSessionChat.ts` 条目无 `toolCallId`；`cb/conversationTurnContentAdapter.ts` `decorateConversationLinks` |
| A3 | 中 | **catalog 来自轮询的代理树，丢状态。** 树只在见到某些事件键时去抖后 `fetchAgentTree`；`collectLiveAgentTreeCatalogEntries` 只抄 id / 名字 / 父 / 模型，丢掉 `status` `type` `turnCount` `createdAt`；在 `registerForkChat` 之前就先从树里看到的节点会被建成 `originKind:'tool'`（已登记为 fork 的条目保持 fork）；`liveAgentStatus` 没有消费者 | `ccm/conversationLiveAgentCatalog.ts:22–40`；`cb/conversationSessionChatService.ts` `syncSubAgentsFromLiveTree` 约479–508 |
| A4 | 高 | **结束的子代理从 catalog 消失。** 树里不再列出的 `tool` 行被删除；开着的对话框不关也不标记，面包屑因找不到条目变空，标题停在旧名。界面上从来没有「已完成」「已取消」「失败」 | `cb/conversationSessionChatService.ts` 约512–517、`refreshOpenOverlayBreadcrumb` |
| A5 | 中 | **子代理页是共享时间线的过滤视图，规则有漏。** 没有 attribution 的行直接丢掉，不提示；没有 `agentId` 的用户行在每个子代理页都显示（保留它是因为落盘用户 envelope 可能不带 `agent_id`，G4），结果父代理收到的用户话也出现在子代理对话框里；子代理收到的任务（spawn 参数）不作为首条显示 | `cb/conversationTrajectoryModel.ts` `passesTrajectoryAgentFilter` 约222–233 |
| A6 | 中 | **对话框宿主靠 DOM 探测。** 宿主元素用 `querySelector('.conversation-timeline')` 加递归跳过自身找；`MutationObserver` 监听整扇会话窗口子树变化后 `mountAll`；需要 `reparent` 防自吞。每次 `open()` 都丢掉旧 `ConversationLens` 新建一个，哪怕只是换目标代理（tab 路径已经用 `setFilterAgentId` 原地换） | `cb/conversationSessionChat.contribution.ts` `selectSubAgentOverlayHost`、`watchOverlayHost`；`cb/conversationSubAgentOverlay.ts` `open` 约201–225 |
| A7 | 中 | **写操作的目标代理靠猜。** 不传目标时，cancel generation、fork、kill、delete message 以及另外两处写操作都退到 `lastStreamingAgentId`（每次再全量投影一遍找最后一条流式行的代理），根页混排时 Stop 可能取消错代理；Kill 的会话从焦点元素 DOM 祖先的 `data-session-key` 取；对话框、pill、面包屑上都没有终止按钮；开着的对话框的 `chatId` 不作为默认目标 | `cb/conversationEngineRosterService.ts` 约1098、1192、1255、1408、1434、1458、1620；`cb/conversationKillEngine.ts` 约55–84 |
| A8 | 低 | **tool 与 fork 不对称。** 「上一级」只认 `originKind==='tool'`，Fork tab 有「下一级」没有「上一级」；无父的 Fork 被算作根的孩子 | `cb/conversationSessionChatService.ts` `currentToolChatId`、`listDirectChildAgents` |
| A9 | 低 | **轨迹页没有代理维度。** 没有代理列或按代理分组；`subtool` 深度依赖 `ItemAttribution.parentToolCallId`，宿主没有生产者，envelope 也没有这个字段；角色列一律写 Agent | `cb/conversationTrajectoryModel.ts` `finalizeToolTree` 约753；`platform/universeAgent/common/conversationViewFrame.ts` 约192 |

## 5. 目标形态

### 5.1 原则

1. 能从引擎事实直接投影的，不从文本、id 前缀或「最后一条流式行」推断。
2. 记录身份仍是各行（PRD-013.5、ADR-046 平行 span overlay）。在行之上加两个**只读分组视图**：回合（`turnKey`）与代理（`agentId`）。它们不是新的列表身份，只给 chrome 和分组用。
3. 活态只有一个判定函数，所有 chrome（转圈、锁开、Stop、`aria-busy`、Cancel、写操作默认目标）读它。
4. 显示模式三分：`live`（引擎接通且会话同步）、`cached`（引擎缓存、断连或配对保持）、`stub`（从未接通的本地夹具）。`Stub` 字样只属于 `stub`。
5. renderer 仍不做「同一条」推断（[refactor §3.6](conversation-timeline-refactor.md#36-overlay--l2-交接d5宿主侧)、[stream-timeline §3.3](conversation-stream-timeline.md#33-产品视图模型-projectsnapshottoentriessnapshot-attribution)）。需要对齐的身份由宿主写进 sidecar。
6. 子代理在父时间线以「子代理卡」出现；子代理页是该代理的切片。引擎只有一条会话流，没有每代理一条的协议，所以切片仍是过滤，但过滤规则与缺归属的提示要诚实。

### 5.2 运行态事实从哪来（D-1）

S4 的字段由 vscode 自有的 wire 解码器读出来没有合同障碍。难点是读出来放在哪：`SessionViewSnapshot` 和 overlay fold 是 vendored session-core，加字段要改上游。

| 选项 | 做法 | 优点 | 代价 |
|------|------|------|------|
| A 上游先行 | 请 Desktop session-core：overlay 按代理多块、增量 chunk、块内工具列表带 lifecycle、回合记录带 stop_reason、子代理运行态进快照；vscode 只解码与 demux | 符合 [stream-timeline §1](conversation-stream-timeline.md#1-选定与拒绝本稿裁定)「vscode 不自研 fold」与 Desktop ADR-009 | 依赖外仓排期；Desktop 仓不在本机，上游现状未核 |
| B 宿主 runtime sidecar（显式例外） | 在 `ConversationViewFrame` 上加 vscode 自有 sidecar `runtime`：`turns`（turnKey → 阶段、停止原因、开始 / 结束时刻、`endedWithoutCommit`）、`tools`（toolCallId → lifecycle 阶段、耗时、错误摘要、`childAgentId`）、`agents`（agentId → 阶段、当前工具、结果、输出预览首行、`spawnToolCallId`、depth）。由宿主从 L1 / L3 事件和 overlay 快照写；每会话一份状态，按 lease 拷贝；baseline 全量、patch 增量。上游投影后退场 | 本仓可独立落地；renderer 契约只加不改 | 这是对 L3 事件的有状态折叠，stream-timeline §1 拒绝「vscode 自研 fold」、§6 写「vscode 不得自造」。attribution 是无状态 join，不是合适先例；真正先例是同为宿主侧每会话状态的 `OverlayDeltaJoin`、`FileMutationJoin`、`AgentTreeCoordinator`。须在 ADR-003 登记为例外 |
| C 渲染层继续推断 | 从行和 catalog 拼状态 | 无 | 本稿 §4 的问题来源，拒绝 |

**建议：** B 作为过渡，同时把 A 的条目登记为上游缺口（[§6](#6-合同缺口)）。B 的边界写死：

- 只存显示事实，不参与 timeline / overlay 的行身份与排序，不复制工具结果正文（`tools` 只有状态、耗时、错误摘要，结果仍以 L2 envelope 与 DetailRef 为准）。
- 投影缓存键（`timelineSlotMatches` / `overlaySlotMatches`，`cb/conversationSessionView.ts` 约985）加入 runtime 修订号，否则工具状态不刷新。
- 上游快照出现同义字段时以上游为准，删 sidecar 对应字段。

B 不解决 S1 与 S3，这两条要引擎和 session-core 改（G-UA-1、G-UI-1、G-UI-2）。B 能解决 S2 的显示部分、C1、A2、A3、A4。是否接受这条例外由用户拍板（D-1）。

### 5.3 订阅层（`uan/`，vscode 自有）

- **解码：** `grpcSessionAttachWire.ts` 补读 S4 表里 30–39、44、50–52 的字段。只解码，不改既有 arm 形状。40–43、45 不在本稿。
- **`OverlayDeltaJoin` 按代理分槽：** 引擎同一会话的 delta 共用 `turnId`，所以槽按 `agentId` 分，不按 `(agentId, turnId)`。Actor 每会话只有一块、宿主 lease 每会话共用，宿主看不到哪个视图在看哪个代理，所以只能用会话级规则：**根代理的槽交给 Actor**；其余代理的累计进度只写 `runtime.agents`，不进 overlay。效果：根页的活行不再被别的代理的字插入或替换；子代理对话框在 G-UA-1 与 G-UI-1 落地前没有活行，只显示 `runtime.agents` 的阶段与当前工具。没有 `agent_id` 的 delta 归根代理槽，即现行为。
- **交接诊断进 UI：** 挂起超时、`sessionClosed` 时带着未落盘正文清 overlay，这两种情况在 `runtime.turns` 上记 `endedWithoutCommit`。
- **attribution 索引与回收：** hint 改成按 itemId、toolCallId 两个 Map 存，lifecycle hint 不再把 `turnId ?? toolCallId` 混成一个键；同一 toolCallId 的多次 lifecycle 合并为一条；行被 `removeTimelineItem` 或会话 lease 全部释放时删对应 hint。
- **显示键（D-2）：** 宿主在 attribution sidecar 上写 `displayKey`，renderer 只读不算：
  - 工具行：`tool:${toolCallId}`。overlay 侧用 `generatingToolCallId`，落盘侧用 envelope 的 tool call id。
  - 助手正文与思考：`turn:${agentId}:${assistantTurnId}:body#${n}` / `:think#${n}`。`assistantTurnId` 由宿主把 L3 的运行态 `turn_id` 经 `turn_completed.assistant_turn_id` 映射得到（`fileMutationJoin.ts` 已有同一映射，约214–231）；映射到来之前 overlay 行用运行态 id，得到映射后改写同一 key。`n` 是该回合内第几封助手 envelope。
  - 冲突：同一帧里落盘行与活行 key 相同，落盘行胜，活行不画。
  - 拿不到协议 id 时不写 `displayKey`，renderer 退回记录 id，即现行为。

### 5.4 投影层（`cb/conversationSessionView.ts`）

- **用显示键：** DOM 协调与展开表用 `displayKey ?? id`，记录 id 不变。过程折 id 改为 `fold:${首行 displayKey ?? id}`。
- **代理边界切折：** `agentId` 不同的相邻 thinking / tool 不进同一个折。与显示键同一切片做，让折 id 只变一次。
- **排序：** 引入到达序，仅在下面两种情况改排序，其余维持现 band：
  - 本 binding 在某个 overlay 块活着期间收到的用户行，包括 `localPendingSends` 和随后 patch 进来的 timeline 用户行，排在该 overlay 行之后，直到 overlay 清除。
  - 只在 `pendingActions` 里、带 `agentId` 且该代理有活 overlay 的座位，紧跟该 overlay 行。
  - 到达序由 `SharedEngineHostBinding` 在 apply patch 时记录。baseline、resync、重新挂接帧没有到达信息，退回现 band。stub 与脚本化 lease 维持现 band。roster 的 `getTurns` 本来就不含 overlay，不受影响。
- **`streaming` 收窄：** 只表示「正文或思考还在收 delta」。落盘工具不再置 `streaming`；工具是否执行中只看 `toolStatus` 或 `runtime.tools`。前提是所有依赖旧语义的读者先改读活态函数，见 U1。
- **roster 去重投影：** `publishRosterDetailIfChanged` 与 `isPreFirst` 改读透镜已缓存的条目或快照计数。

### 5.5 控制流显示

- **单一活态函数** `getConversationLivePhase(row, mode)`：返回 `streaming | running | waiting-input | pending | done | failed | cancelled | unknown`。转圈、锁开、Cancel、Respond、宿主 `busy` / `cvVisible`、Stop 都读它；回合级 `getConversationTurnPhase(rows)` 由它聚合。删掉三处 `streaming && toolStatus !== 'pending'`。`lastStreamingAgentId` 改为「回合阶段为生成中、且最后有活行的代理」，同样读它。
- **回合 chrome：** 每个回合最后一个根下画一行弱化页脚，只在有事实时出现：停止原因（正常结束不写；`max_tokens` 写「输出被截断」；取消写「已停止」；失败写原因）、耗时。生成中显示「生成中」与已用时间，读屏只在进入 / 离开时播报一次。`stub` 模式不画。
- **执行展开保留到回合结束：** 执行中自动展开的折，工具结束时不收；该回合结束后回到页默认态。用户在此期间手动点过的，按用户的来。
- **显示模式：** `cached` 模式照写 Failed / Cancelled 文字，不加 `Stub ·`，未完成的回合页脚写「断连时未完成」；`stub` 维持 PRD-013.4。
- **正文 / 思考 / 工具顺序：** `block_id` 不带块序，现阶段维持「思考、正文、工具」。完全去掉 `toolKeepsBody` / `assistantText` 特例与交错顺序问题，要等 demux 一封 envelope 出多 arm（G-UI-4）。
- **无障碍：** 时间线去掉外层 `role=log`，保留 `role=feed`；新错误与回合失败走 `IAccessibilitySignalService` / `status` 播报一次；锁开的标题写明「执行中，结束后可收起」；删多余 `role=button`。
- **清理：** 删 C9 列的不可达分支；两处 `renderProcessFoldSpan` 选项合成一个构造函数。

### 5.6 子代理显示

**数据：** `IConversationSessionChatEntry` 增加 `status`（`running | waiting | completed | failed | cancelled | unknown`）、`phase`、`currentToolName`、`spawnToolCallId`、`depth`、`outcomeSummary`。来源顺序：`runtime.agents`（D-1 B）→ `liveAgentTree` 节点 `status` → `unknown`。`spawnToolCallId` 取 `sub_agent_activity.parent_tool_call_id`，没有时取 `detached_child_phase` 的 `tool_call_id` 与 `child_agent_id`。树里先于 `registerForkChat` 出现的 fork 节点，等 fork 回执登记后改回 `fork`。

**父时间线（D-3）：**

- 拉起子代理的工具行（`toolCallId === spawnToolCallId`）画成子代理卡：代理名、阶段（思考 / 规划 / 运行某工具 / 等待输入）、已用时间；结束后换成结果（成功 / 失败 / 取消 / 可恢复错误）和输出预览首行。点卡按 PRD-016.4 打开对话框。卡仍在过程折里，是工具行的另一种画法，不是新列表身份。
- 子代理落盘的思考、工具、正文默认不在根页逐行出现，由卡代表。根页 SessionBar「下一级」与卡是进入子代理的两个入口。是否保留「显示全部代理」开关见 D-3。
- 拿不到拉起关系的子代理（旧引擎或 Fork）没有锚点，挂在所属回合页脚下的「子代理」一行里。

**子代理页：**

- 过滤规则：先核实引擎给发往子代理的用户 envelope 盖 `agent_id`（组合器已带 `agentId: filterAgentId`，`cb/conversationLensComposer.ts:435`，需确认引擎落盘时保留）。确认后，没有 `agentId` 的用户行不再在每个子代理页全显；未确认前保持现规则。首条画子代理收到的任务（`set_status.args_json` 或拉起工具的参数）。
- 缺 attribution 被过滤掉的行，在页顶写一次「N 条记录无法归到代理，未显示」，可跳到根页轨迹。符合 PRD-007 诚实降级。
- 结束的代理留在 catalog 并带终态；对话框标题旁显示状态；运行中显示「停止」按钮，目标是对话框的 `chatId`。
- 对话框宿主改为会话窗口服务提供的显式槽（`getLeafSlots().subAgentOverlayHost`），去掉 `querySelector`、递归查找和 `MutationObserver`。换目标代理时复用 lens，调 `setFilterAgentId`。
- 活行：G-UA-1 与 G-UI-1 落地前没有逐字活行，页顶显示 `runtime.agents` 的阶段与当前工具，不画假流式。

**轨迹页：** 增加代理列（catalog 名字），可按代理过滤。`sub_agent_activity.parent_tool_call_id` 连的是「代理 → 拉起它的工具」，不是「工具 → 工具」：子代理的工具行以 `runtime.agents[agentId].spawnToolCallId` 为父，`subtool` 才有真实数据。

## 6. 合同缺口

| ID | 缺口 | 归属 | 本稿姿态 |
|----|------|------|----------|
| G-UA-1 | 引擎 overlay 每会话一份，`TurnStart` 跨代理重置；逐字 delta 不在会话流镜像白名单 | UniverseAgent（`SessionRuntimeOverlayRegistry`、`BroadcastQueryEventMirrorAllowlist`） | 先确认行为；需要子代理活行时请引擎按代理分 overlay 并镜像带 `agent_id` 的 delta |
| G-UI-1 | session-core overlay 只有一块，按 turn 替换；需要按代理多块 | Desktop session-core overlay fold | 宿主按代理分槽、根槽进 Actor（§5.3）；子代理活行等上游 |
| G-UI-2 | overlay arm 只收全文；需要 append chunk 补丁 | session-core | 不在 vscode 改 vendored 代码；S3 维持 |
| G-UI-3 | overlay 块内工具没有 lifecycle 与多工具 | session-core | D-1 B：`runtime.tools` 提供显示状态 |
| G-UI-4 | demux 一封 envelope 只出一个 arm，正文 / 思考 / 工具挤在副字段 | session-core `stream-event-to-view-patch` 与 vscode demux 协同 | 维持现行拆行；上游支持后删 C5 特例 |
| G-UI-5 | `PendingSendView` 没有 `orderKey` | session-core | renderer 到达序过渡（§5.4） |
| G-TL-2 | chunk 不自带类别，靠 `:think:` 子串 | session-core（[refactor D10](conversation-timeline-refactor.md) 已登记） | 不变 |
| G4 | 普通行无 agent 归属 | session-core（[stream-timeline §6](conversation-stream-timeline.md#6-契约缺口需上游补vscode-不得自造) 已登记） | 不变 |

S4 表里的字段都是 vscode 自有解码器可以读的，不算上游缺口。

## 7. 不做

- 不改 ADR-010 文档流宿主、`content-visibility` 与历史窗口化。
- 不改发送链三键与 Inbox / MessageQueue 权威。
- 不在 vscode 内手改 `core/` 或 `common/sessionView/` 的 vendored 文件。
- 不给每个子代理开第二条订阅流；协议里没有。
- 不做 deep-think、conditional agent、团队成员的显示。
- 不改 Agents Window（`src/vs/sessions/`）。

## 8. 切片

依赖：U1 无前置；U2 需 D-1；U3 需 U2、D-2；U4 需 U2；U5 需 U2、D-3；U6 需 U5；U7 是上游；U8 需 U2。

| 切片 | 内容 | 主要文件 | 合同 |
|------|------|----------|------|
| U1 渲染层收口 | 单一活态函数，三处 Stop 判定、宿主 `busy` / `cvVisible`、`lastStreamingAgentId` 的六个调用方先改读它（执行中工具算活），之后才收窄 `streaming`；显示模式三分（C6）；执行展开保留到回合结束（回合结束先用「该折所有行已终态」近似）；代理名用 catalog 名字并在折内行加代理标记（A1 最小修正，不改折边界）；无障碍（C7）；删死路径与合并选项（C9） | `cb/conversationProcessFold*.ts`、`cb/conversationTimelineRenderer.ts`、`cb/conversationTimelineItemHost.ts`、`cb/conversationTimelineHost.ts`、`cb/conversationLensDock.ts`、`cb/conversationLensComposerChrome.ts`、`cb/conversationSessionView.ts`、`cb/conversationEngineRosterService.ts` | 无 |
| U2 宿主解码与 runtime sidecar | S4 字段解码；`OverlayDeltaJoin` 按代理分槽、根槽进 Actor；`ConversationViewFrame.runtime` 三张表；投影缓存键加 runtime 修订号；attribution 双索引与回收；交接诊断入 `runtime.turns` | `uan/grpc/grpcSessionAttachWire.ts`、`uan/overlayDeltaJoin.ts`、`uan/sessionViewHost.ts`、`platform/universeAgent/common/conversationViewFrame.ts`、`cb/conversationEngineFrameSource.ts`、`cb/conversationSessionView.ts`、web 空 lease | D-1 |
| U3 显示键、折边界与排序 | 宿主写 `displayKey`；renderer 用它协调与存展开态；代理边界切折；到达序排序与座位跟随 | `uan/sessionViewHost.ts`、`cb/conversationSessionView.ts`、`cb/conversationTimelineReconcile.ts`、`cb/conversationProcessFoldModel.ts`、`cb/conversationEngineFrameSource.ts` | U2、D-2 |
| U4 回合 chrome | 回合页脚；Stop 读回合阶段；断连未完成标记；回合结束改用真实 `turn_completed` | `cb/conversationTimelineHost.ts`、`cb/conversationTimelineRenderer.ts`、`cb/conversationLensDock.ts` | U2 |
| U5 子代理卡与 catalog 状态 | catalog 字段扩展；结束不删；fork 回执后改回 `fork`；父工具行画子代理卡；根页默认不逐行画子代理内容 | `ccm/conversationSessionChat.ts`、`ccm/conversationLiveAgentCatalog.ts`、`cb/conversationSessionChatService.ts`、`cb/conversationProcessFold.ts`、`cb/conversationSessionView.ts` | U2、D-3 |
| U6 子代理页 | 过滤规则（待引擎确认用户 envelope 带 `agent_id`）、任务首卡、缺归属提示、对话框状态与停止按钮、显式宿主槽、lens 复用、写操作默认目标 | `cb/conversationSubAgentOverlay.ts`、`cb/conversationSessionChat.contribution.ts`、`cb/conversationSessionWindowService.ts`、`cb/conversationTrajectoryModel.ts`、`cb/conversationKillEngine.ts` | U5 |
| U7 上游 | 向引擎提 G-UA-1，向 Desktop session-core 提 G-UI-1 至 G-UI-5；同步后删根槽规则和 U2 里被上游覆盖的 sidecar 字段 | `scripts/sync-universe-agent-session-core.ts` 之后的适配 | 外仓 |
| U8 轨迹代理维度 | 代理列与过滤；子代理工具以 `spawnToolCallId` 为父生成 `subtool` | `cb/conversationTrajectory*.ts` | U2 |

每个切片单独提交，提交前过 [health-gates](../progress/health-gates.md) 的本地 compile / eslint / docs-health 与相关单测。

## 9. 验收

实施前先补「复现 before」，写失败断言再改代码。宿主侧场景要从原始 payload 驱动，用 node 测（`src/vs/platform/universeAgent/test/node/` 下的 `overlayDeltaJoin`、`sessionViewHost*` 测试）；renderer 场景用 `src/vs/workbench/contrib/conversation/test/browser/scriptedSessionView.ts` 喂成型帧。

| 场景 | 层 | 现状（预期 before） | 改后 |
|------|----|----------------------|------|
| 同一 `turn_id` 下根代理与另一代理交替发 `streaming_delta` | node | 两段字拼进同一块，`agentId` 来回跳 | 根槽只含根代理的字；另一代理的进度只在 `runtime.agents` |
| `tool_call_lifecycle.failed` 先于 L2 到达 | node + browser | 活行仍 Running | 活行立即 Failed，带错误摘要 |
| 生成中展开某个思考或工具，随后 L2 落盘 | browser | 展开态丢失、DOM 重建 | 展开态保留，同一 DOM 节点（`displayKey` 相同） |
| 生成中再发一句，随后该句落盘 | browser | 新句子在正在流的回答上方 | 在 overlay 清除前一直在其下方 |
| `sub_agent_completed{outcome: CANCELLED}` 且树不再列出 | node + browser | catalog 行消失，对话框面包屑空 | 卡与对话框写「已取消」，面包屑保留 |
| 断连后看引擎缓存会话 | browser | 折头 `Stub · …`，失败无文字 | 无 Stub，Failed 文字在，未完成回合有页脚 |
| 只有流式思考的折 | browser | 锁开但无转圈 | 锁开与转圈一致 |
| `turn_completed.stop_reason = max_tokens` | node + browser | 无显示 | 页脚写「输出被截断」 |
| 根页混排时按 Stop，最后流式行属于子代理 | browser | 取消子代理 | 取消回合阶段为生成中的根代理 |
| 对话框里点停止 | browser | 无按钮；命令目标猜最后流式代理 | 目标是对话框代理 |
| 长会话 1000 次工具调用后 hint 数量 | node | 线性增长 | 每个 toolCallId 至多一条，行删除后回收 |

UI 联调按 AGENTS.md 只在默认编辑器窗口；自动剧本是壳冒烟 `test/scenario/scenarios/editor-shell.cjs`，需补子代理与回合页脚两段。

## 10. 对既有方案与知识页的修订

签收后、对应切片实施时同刀改：

- [conversation-stream-timeline §1](conversation-stream-timeline.md#1-选定与拒绝本稿裁定)「fold 归属」与 §6 姿态：若 D-1 选 B，加一行「宿主 runtime sidecar 是显式例外：只存显示事实，不参与行身份，上游投影后退场」，并在 [ADR-003](../decisions/003-engine-adapter-boundary.md) 记同一例外（U2）。
- [conversation-stream-timeline §3.3](conversation-stream-timeline.md#33-产品视图模型-projectsnapshottoentriessnapshot-attribution)：overlay 行那一格的「UI 不做同一条推断」补「对齐身份由宿主写 `displayKey`」；「过程折 span id `fold:${firstEntryId}`」改为首行显示键；「`localPendingSends` 排在 timeline 之后、overlay 之前」补到达序例外（U3）；「`streaming` → 折内 loading」补「只表示收 delta」（U1）。
- [conversation-timeline-refactor §3.6](conversation-timeline-refactor.md#36-overlay--l2-交接d5宿主侧)：「渲染端不做同一条推断」保留，补「渲染端按宿主写的 `displayKey` 复用节点」；D10「不派生 id」与现代码已派生 `:think` / `:body` 的出入一并写清（U3）。
- [conversation-ui-closeout](conversation-ui-closeout.md) Q4 与 `cb/conversationProcessFoldModel.ts` 注释、[lens-and-trajectory §4](../../docs/systems/conversation/lens-and-trajectory.md#4-过程折overlay不是列表身份)：「L3 与 L2 零关联、overlay 做段首时展开重置是合同行为」改为「宿主按协议 id 写显示键，取不到时仍重置」（U3，D-2）。
- [lens-and-trajectory §3.1](../../docs/systems/conversation/lens-and-trajectory.md#31-数据路径head)「子代理过滤」：引擎确认后改 `role==='user'` 且无 `agentId` 留下这条（U6）。
- [lens-and-trajectory §2](../../docs/systems/conversation/lens-and-trajectory.md#2-对话透镜时间线)「非 default 代理名在首行」：改为 catalog 名字，并覆盖折内行（U1）。
- [conversation-session-windows](conversation-session-windows.md) 子代理对话框章节：加状态、停止按钮、显式宿主槽、无活行时的阶段显示（U6）。
- PRD-013.1：已按既有已签收的 `conversation-process-fold.md` 与 `937b04438b3e`，改成与现行实现相符的「Thinking 与工具平级」可观察陈述。PRD-016 若 D-3 选「根页默认不逐行画子代理内容」，补一条可观察陈述。

## 11. 待用户拍板

| ID | 问题 | 选项 | 建议 |
|----|------|------|------|
| D-1 | 运行态事实放哪 | A 上游先行；B 宿主 runtime sidecar 作为 stream-timeline §1 / §6 的显式例外，同时登记上游缺口 | B，在 ADR-003 写明边界与退场条件 |
| D-2 | 是否修订 [closeout Q4](conversation-ui-closeout.md)「overlay 与 L2 零关联」，由宿主按 toolCallId 与 `assistant_turn_id` 映射写显示键 | 允许（renderer 只读宿主写的键，取不到退回现行）；不允许 | 允许。renderer 仍不推断，与 refactor §3.6 一致 |
| D-3 | 根页是否逐行显示子代理的思考、工具与正文 | 只画子代理卡；默认只画卡并提供「显示全部代理」开关；维持混排 | 默认只画卡并提供开关 |
| D-4 | 回合页脚显示哪些事实 | 停止原因 + 耗时；再加 token；全不显示 | 停止原因 + 耗时；token 留在轨迹与上下文环 |
| D-5 | PRD-013.1「Thinking → 缩进工具行」与现行平铺实现谁为准 | 改 PRD 为平铺；恢复两层缩进 | **已按既有签收决定为平级，并已同步修订 PRD-013.1。** `conversation-process-fold.md`（2026-09-01 用户签收、已实施）与 `937b04438b3e` 已明确「Thinking 与工具各成一行，工具不挂进前面的 Thinking」；外层过程折与行内 payload 的视觉缩进保留。 |

## 12. 风险

| 风险 | 缓解 |
|------|------|
| runtime sidecar 与上游后来的快照字段语义不一致 | sidecar 字段直接对齐 proto 字段名；U7 同步时以上游为准，删 sidecar 对应字段 |
| 引擎实际行为与 S1 的源码推断不同（例如子代理 delta 其实有别的镜像路径） | U2 前先在真实引擎上抓一次子代理会话的原始流，结论写回 S1 与 G-UA-1；分槽规则对两种情况都成立 |
| `assistant_turn_id` 映射晚到，显示键改写一次 | 改写发生在 `turn_completed`，与 D5 交接同一时刻；映射到前 overlay 行用运行态 id，不会与落盘行冲突 |
| 显示键对齐后，落盘行与活行内容不一致导致一帧跳字 | 流式句柄定稿时整段重排一次（D2 已有），只是复用节点 |
| 根页不再逐行显示子代理内容，用户找不到某步 | 子代理卡可展开最近几步；轨迹页有代理列；D-3 的开关 |
| U1 收窄 `streaming` 时漏改某个读者 | U1 先加活态函数并改全部读者，再收窄；补测锁住三处 Stop、`busy`、`lastStreamingAgentId` |
| 改动面跨 platform 与 contrib | 切片按层分开提交；U1 不碰 platform |

## 13. 审查记录

**规则 16 第一轮（2026-11-01）：** 只读 reviewer（general-task-execution 子代理，未改文件），基线复核到 `6180ee097e7`。结论：S / C / A 证据大体准确，S4 表与 A3 有误；3 Critical、8 Important，「尚不能签收」。父 agent 对 Critical 1、2 读了引擎 `SessionRuntimeOverlayRegistry.kt` 与 `BroadcastQueryEventMirrorAllowlist.kt`、本仓 `SharedEngineHostBinding` 后核实，全部采纳：

| 级别 | 意见 | 处理 |
|------|------|------|
| Critical | §5.3 按视图选前台槽不可行：Actor 每会话一块、宿主 lease 每会话共用、`filterAgentId` 只在 renderer；§12 引的 `originLease` 先例只裁剪发送 | 改为会话级「根槽进 Actor」，删按视图选择与 §12 那行 |
| Critical | S1 前提未经引擎核实；引擎 overlay 每会话一份，逐字 delta 不镜像 | §1、S1 改写并标「待引擎确认」；槽按 `agentId` 分；新增 G-UA-1；§9 首个场景改写 |
| Critical | 显示键用了运行态 `turn_id`，与落盘 `assistant_turn_id` 不同源；D-2 理由与 refactor §3.6、stream-timeline §3.3 冲突 | 显示键改由宿主写入 sidecar，经 `assistant_turn_id` 映射，加序号与冲突规则；§10 补两处；U3 依赖 U2 |
| Important | S4 表：`block_id` / `delta_seq` 已解码；漏 33、38、39 成员、40–43、45、`turn_started` 字段；`metadata_json` 有意不解码 | S4 表重写，加「已解码未用」列；删「按 block_id 块序出行」 |
| Important | A3 夸大：已登记的 fork 保持 fork | A3 改写 |
| Important | U1 收窄 `streaming` 会打断 Stop、`busy` / `cvVisible`、`lastStreamingAgentId` 六个调用方 | U1 先改全部读者；A7 补 cancel / delete 等 |
| Important | 到达序定义不全：落盘后行仍跳、baseline 无到达信息、各 lease 不一致 | §5.4 写明适用范围、退回规则与 stub / roster 的情况 |
| Important | 子代理页去掉无 `agentId` 用户行可能藏掉用户自己的话 | 改为先确认引擎落盘带 `agent_id` |
| Important | 脚本化 lease 测不了宿主场景 | §9 分 node / browser 两层 |
| Important | D-1 B 是有状态折叠，attribution 不是合适先例 | §5.2 改写为显式例外，引真正先例，加缓存键要求 |
| Important | attribution hint 只增不减 | 并入 S8、§5.3、U2、§9 |
| Minor | 行号漂移、C2 补 `showLiveChrome`、C5 措辞、Q4 出处、D10 出入、A9 父关系、折 id 变两次、C9 无功能损失、INDEX 未登记 | 全部改入；代理边界切折并入 U3；INDEX 已登记 |
