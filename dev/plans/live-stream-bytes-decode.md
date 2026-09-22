---
title: "活流 bytes 解码、thinking 键与 Create 错绑恢复"
type: plan
status: accepted
phase: M7
updated: 2026-09-22
summary: "2026-09-19 签收。decoder/thinking 已与 SessionStream 波重叠（含 32/46）；Chat 11/13/20 与 Create recover 仍开。不发明字段。不手改 sessionCore。不升 PRD-008。"
---

# 活流 bytes 解码、thinking 键与 Create 错绑恢复

> **slice_id**：`live-stream-bytes-decode`  
> **冲突域**：`src/vs/platform/universeAgent/node/grpc/grpcSessionAttachWire.ts` · `sessionStreamDemux.ts` · `sessionCreateRecover.ts` · `sessionViewHost.ts` · `fileMutationJoin.ts` 及对应 `test/node`  
> **基线：** `agent-ide` HEAD `5c910c59a226`  
> **触发：** 2026-09-18 十六路只读审查。单测大量 JSON 直灌 demux，绕过 decoder，测绿但活窗黑。  
> **2026-09-22 核对：** `decodeSessionStreamEvent` 已解多臂（含 `tool_call_lifecycle`=32 / `tool_runtime_snapshot`=46），`decodeThinkingBlock` 写 `thinking`。这与进度账「SessionStream / L2」合入重叠，不是本方案整份已实施。**仍开：** `encodeChatRequest` 只编 heartbeat_ack=12 与 session_input=30（permission_response=11 / client_tool_response=13 / question_response=20 未与 30 互斥）；`recoverSessionAfterAlreadyExists` 仍 title 优先、否则名册第一行，`clientSessionId` 只在 List 失败或空时 Resume。不升 `implemented`。  
> **禁止发明：** 本仓不存在的 proto 字段号、capability key、引擎 RPC。号只从钉死引擎 `grpc-api/.../message_envelope.proto` / `agent_service.proto` **只读抄**。  
> **不推翻：** [conversation-stream-timeline](conversation-stream-timeline.md)「显示写源 = SessionEventStream L1–L4」；[ADR-003](../decisions/003-engine-adapter-boundary.md)；[giant-file-split](giant-file-split.md) GFS-4 **禁止手改** `node/sessionCore/**`；[session-subscription-lifecycle](session-subscription-lifecycle.md) D405 S4a/S4b / §5 手测仍开，本稿不占。  
> **不升：** [PRD-008](../../docs/product/requirements.md#prd-008-引擎与会话权威)。本稿是接通后显示/绑会话诚实，不是冒烟升档。

## Problem class

- **症状：** Direct Address 接通后 hello / L2 envelope 可能进时间线，但 overlay、权限座、提问、client-tool、活 Sources chip 不出现；推理回合在 bytes 路径消失；Create 撞 `ALREADY_EXISTS` 时可能绑到目录第一行。
- **类标签：** **decoder 子集冒充实合同**（demux/host 已按 L1–L4 写，wire 只解 1/10–13/20–22）+ **夹具键 ≠ 解码键** + **恢复用死 title / 名册序代替 `client_session_id`**。
- **复发机制：** ① 测不走 decoder；② 把「本仓还没抄这个号」写成「产品不吃这臂」；③ recover 测用 `title: 'local-exists'` 锁一条线上发不出的合同。
- **防复发：** 每条新增臂必须有 **bytes → `decodeSessionStreamEvent` → demux** 测；recover 禁止 `sessions[0]` 与 title 优先。

## 0. 一句话结论

按引擎 proto **已有** oneof 号补齐 `SessionStreamEvent` 解码（至少 demux/host/join **已经消费**的臂），thinking 块发出 `thinking`，Create 恢复只 Resume `client_session_id`，Chat 臂把已有 write kind 编进已有 Chat oneof。不发明号。不改 vendored Actor。

## 1. HEAD 事实

下表是 2026-09-19 签收时的基线。2026-09-22 核对见文首：decoder / thinking 已重叠；Chat 臂与 recover 仍与本表后几行一致。

| 事实 | 位置 |
|:-----|:-----|
| `decodeSessionStreamEvent` 只解 field **1**（`session_id`）、**10–13**（hello / heartbeat / health / closed）、**20–22**（envelope_*）。其余 oneof 丢掉 | `grpcSessionAttachWire.ts` `decodeSessionStreamEvent` |
| 合同写明显示写源是 L1–L4 全经 demux | [conversation-stream-timeline](conversation-stream-timeline.md) §2 表「显示写源」 |
| 引擎 `SessionStreamEvent.event` 号（钉死引擎 PIN `748e7698e6` proto，只读）：L1 `10–16`；L2 `20–23`；L3 `30–46`；L4 `50–52`。本仓已解 10–13 / 20–22 | `vscode-debug-engine` `message_envelope.proto` `SessionStreamEvent` |
| demux **已认**：`runtime_overlay_snapshot`、`permission_request`、`ask_user_question`、`client_tool_call`、`session_purged`。join **已认**：`tool_call_lifecycle`、`tool_runtime_snapshot`、顶层夹具 `turn_completed`。OverlayDeltaJoin **已认**：无 snapshot 时的 `streaming_delta` / `thinking_delta` / `generating_tool` 与嵌套 `turn_lifecycle.turn_completed`。demux **不**认 `turn_completed` / 30/31/34 | `sessionStreamDemux.ts`；`overlayDeltaJoin.ts`；`fileMutationJoin.ts` |
| `handleStreamPayload` **不**走 L2 envelope；`handleHistoryPayload` 才 `collectHistoryEnvelopes` | `fileMutationJoin.ts` |
| `decodeBlock` 写 `thinking_block: { text }`；demux `thinkingFromBlock` 只读 `thinking`；测夹具是 `{ thinking: 'considering' }` | `grpcSessionAttachWire.ts` `decodeBlock` field 5；`sessionStreamDemux.ts`；`sessionStreamDemux.test.ts` |
| 引擎 `ThinkingBlock.thinking = 1`（不是 `text`） | 同 proto `ThinkingBlock` |
| `encodeCreateSessionRequest` 只发 model=3、`client_session_id`=4；注释写明 **无 title** | `grpcSessionAttachWire.ts` |
| `recoverSessionAfterAlreadyExists`：title 命中否则 **第一个有 `sessionId` 的行**；`clientSessionId` 只在 List 空/失败时 Resume | `sessionCreateRecover.ts` |
| host `bindEngineSession` 与 `UniverseAgentConnectionService.createSession` 共用该 recover | `sessionViewHost.ts`；`universeAgentConnectionService.ts` |
| `encodeChatRequest` 只编 `heartbeat_ack`=12 与 `session_input`=30；其余 record 整包当 SessionInput | `grpcSessionAttachWire.ts` |
| 引擎 `ChatRequest.payload`：`permission_response=11`、`heartbeat_ack=12`、`client_tool_response=13`、`question_response=20`、`session_input=30` | `agent_service.proto` `ChatRequest` |
| 接通主路权限/提问/client-tool 走 unary，**不双写 Chat 臂** | [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md) |
| host `writeChat` 把 Actor payload 原样 + `messageId` 送给 encode；`kind:'permissionRespond'` 等会进 field 30 | `sessionViewHost.ts` `chatWritePayload` / `writeChat` |
| `ensureEngineSession` 在 `engineBoundForGeneration.has` 时直接 return，**不**读 `connectionGeneration`；断连清 flag 但不取消 inflight | `sessionViewHost.ts` |
| leftover-looks-live 挡 `post` / heartbeat / tree，**不**挡 `ensureEngineSession` / `requestDetail` / `acquireLease` bring-up | 同上 vs `sessionViewHostEngineBind.test.ts` leftover 测 |
| L3 `streaming_delta` 合同：**不累积**，只吃 `runtime_overlay_snapshot`；无 snapshot 时 `OverlayDeltaJoin` | conversation-stream-timeline S4 已落行 |

## 2. 外仓号表（只读抄；实施不得另造）

PIN：`vscode-debug-engine/PIN` **`748e7698e6`**。实施 S1 **第一步**对照该 PIN 的 proto 复核下表。号变了只改本表与 decoder，不发明新臂。**禁止**再写「实施时对照 proto」而不把号抄进本表。

| 层 | proto 名 | field | 本仓 demux/host 是否已消费 | 本稿 |
|:---|:---------|:------|:---------------------------|:-----|
| L1 | `hello` / `heartbeat` / `subscription_health` / `session_closed` | 10–13 | 是 | 保持 |
| L1 | `agent_timeout` / `session_visibility_changed` | 14–15 | demux 无臂 | 可解码成键；无臂则丢；**禁止发明 UI** |
| L1 | `session_purged` | 16 | demux **已有** `sessionPurged` → `closed(reason)` | **必须解**（已签显示写源，不是新产品） |
| L2 | `envelope_*` | 20–22 | 是 | 保持；thinking 键 S2 |
| L2 | `branch_topology_notified` | 23 | host `shouldRefreshAgentTree` 等已认键 | **解码成现有 host 键**；不发明 fold |
| L3 | `runtime_overlay_snapshot` | 44 | 是 | **必须解** |
| L3 | `tool_call_lifecycle` | 32 | **join/host** 认；demux 对该键返回 `[]` | **必须解**（勿写成 demux 已认） |
| L3 | `tool_runtime_snapshot` | 46 | join 是 | **必须解**（PIN oneof **快照根上** `file_mutation_payload=23`，不是嵌套 message `payload`） |
| L3 | `turn_lifecycle` | 37 | OverlayDeltaJoin 读 **嵌套** `turn_lifecycle.turn_completed`；FileMutationJoin 现读**顶层** `turn_completed`（夹具形） | **必须解成 proto 形** `turn_lifecycle: { turn_completed: { turn_id, assistant_turn_id, … } }`（oneof `turn_completed=11`）。S1 同时改 `handleStreamPayload` **兼认嵌套形**。禁止只 assert 有键。demux **不**认这两键——删「demux 已认」 |
| L3 | `streaming_delta` / `thinking_delta` / `generating_tool` | 30 / 31 / 34 | OverlayDeltaJoin（无 snapshot 时） | **必须解、不进 Actor**。「不进 Actor」≠ decoder 丢掉 |
| L3 | `sub_agent_activity` / `sub_agent_completed` / `detached_child_phase` | 35 / 36 / 38 | host tree 认键 | **解码成现有 host 键**（空消息 `{}` 即可）；不发明 fold |
| L3 | `multi_agent_status` | 39 | host 读嵌套 `team_created.team_id` | **必须解内层**（见下表）；presence-only 不够 |
| L3 | `tool_call_delta` / DeepThink 族 / `conditional_agent` | 33 / 40–43 / 45 | 否 | 不解码当产品；禁止发明 UI |
| L4 | `permission_request` | 50 | 是 | **必须解**。见下表子字段 |
| L4 | `ask_user_question` | 51 | 是 | **必须解**。见下表子字段 |
| L4 | `client_tool_call` | 52 | 是 | **必须解**。见下表子字段 |

demux/join/overlay **已经读取**的内层号（PIN `748e7698e6`；空消息 16 解成 `session_purged: {}`）：

| 消息 | 必须解的字段 |
|:-----|:-------------|
| `SessionPurgedEvent` | 空 → `session_purged: {}` |
| `StreamingDeltaEvent` / `SessionStreamThinkingDeltaEvent` | `runtime_epoch=1` `turn_id=2` `text_delta=5`（**不是** 1/2 当 delta） |
| `GeneratingToolEvent` | `runtime_epoch=1` `turn_id=2` `agent_id=3` `tool_name=4` |
| `PermissionRequestEvent` | `request_id=1` `tool_name=2` `description=3` `agent_id=6` |
| `AskUserQuestionEvent` | `request_id=1`；**repeated** `items=2`；`agent_id=3`（`items`/`options`/`questions` 与 pending 同级：`allLengthDelimited` 成数组，禁止 `lastBytes`） |
| `AskUserQuestionItemProto` | `id=1` `header=2` `question=3`；**repeated** `options=4`；`multi_select=5`（varint → JS boolean）`allow_custom=6` |
| `AskUserQuestionOptionProto` | `id=1` `label=2`（无 options 时座仍在、文案空） |
| `SessionStreamClientToolCallEvent` | `request_id=1` `tool_name=3` `arguments_json=4`（S3 **不解析** json） |
| `RuntimeOverlaySnapshotEvent` | `runtime_epoch=1` `active_turn=2`；**repeated** `pending=6` `tool_runtime_snapshots=7`（解码 `allLengthDelimited` 成数组，禁止 `lastBytes`） |
| `PendingActionSnapshotProto` | `request_id=1` `kind=2` `tool_name=3` `description=4` `agent_id=5`；**repeated** `questions=7`；`arguments_json=8` |
| `PendingActionKindProto` | 数值 `UNSPECIFIED=0` `PERMISSION=1` `ASK_USER_QUESTION=2` `CLIENT_TOOL_CALL=3`（HEAD `mapPendingKind` 认 `1` / 全名 `PENDING_ACTION_KIND_PERMISSION` / `'permission'`，**不**认短名 `'PERMISSION'`；bytes 测用 `kind=1`） |
| `ActiveTurnSnapshotProto` | `turn_id=1` `streaming_text=3` `thinking_text=4` `generating_tool_name=5` |
| `ToolCallLifecycleEvent` | `runtime_epoch=1` `turn_id=2` `tool_call_id=3` `agent_id=4` |
| `ToolRuntimeSnapshotProto` | `tool_call_id=2`；oneof **根上** `file_mutation_payload=23`（不是嵌套 message `payload`） |
| `FileMutationToolPayloadProto` | `path=2` `operation=3` `diff_stats=4` |
| `TurnLifecycleEvent` | `runtime_epoch=1`；oneof `turn_started=10` `turn_completed=11` |
| `TurnCompletedChange` | `turn_id=1` `assistant_turn_id=13` |
| `MultiAgentStatusEvent` | `runtime_epoch=1`；oneof `team_created=14` |
| `TeamCreated` | `team_id=1`（int32；HEAD `readTeamCreatedTeamId` 认 number） |

Chat 臂（仅 encode，不改 unary 主路）：

| write kind | Chat oneof | field | 子消息已有字段 |
|:-----------|:-----------|:------|:---------------|
| `heartbeat_ack` | `heartbeat_ack` | 12 | `echo_ts=1`（已落） |
| `submitInput` | `session_input` | 30 | `message_id=1` `text=2` `model_profile_id=5` `operation_id=10`（已落） |
| `permissionRespond` | `permission_response` | 11 | `request_id=1` `decision=2` |
| `clientToolRespond` | `client_tool_response` | 13 | `call_id=1` `is_error=2` `content=3` |
| `questionRespond` | `question_response` | 20 | `question_id=1` `answers=2` `custom_text=3` |

**禁止**为 `interactive_message_response=14` / `conditional_agent_override=15` 接线：host 无对应 write kind。

S6 编码细则（号对了仍会编错）：

HEAD `submitInputWritePayload` **不写** `kind`，只摊 `{ text, originLeaseId, modelProfileId?, agentId }`；`sendHeartbeatAck` 只写 `{ heartbeat_ack: {} }`。今日 `encodeChatRequest` 靠包装键 12 + 其余整包 field 30。分臂写死：

1. 保留 `heartbeat_ack` / `heartbeatAck` 包装键 → field **12**，然后 **return**（HEAD 已如此）
2. `kind==='permissionRespond'` → field **11**：`request_id=1`（camelCase `requestId`）、`decision=2` enum `PERMISSION_ALLOW=0 / DENY=1 / ALWAYS=2`；host `'allow'|'deny'` 映射 0/1，**不是** unary `granted`。编完 **return**，**禁止**再写 field 30
3. `kind==='clientToolRespond'` → field **13**：`call_id=1` `is_error=2` `content=3`。编完 **return**，禁止再写 30
4. `kind==='questionRespond'` → field **20** 未齐则 **failed**（本仓 codec 无 map encoder；PIN `answers=2` 是 `map<string, QuestionAnswer>`，`QuestionAnswer.selected_labels=1` repeated。host 出站 `{ selectedLabels, multiSelect }`，proto **没有** `multiSelect`）。**禁止**把 `map<string,string>` 或 JS object 当齐。本波 20 未齐就 failed，且 **不得再写 30**。编完（或 failed）**禁止**再写 30
5. **无 kind 且非未知 CTA → 仍 field 30 SessionInput**（用户输入主路）。`kind==='submitInput'` **也**编 30，不要当未知 kind failed。
6. **未知 `kind` 才 failed**（不是 submitInput / permissionRespond / clientToolRespond / questionRespond），禁止编空 SessionInput 再 `accepted`

**11/13/20 与 30 互斥。** HEAD `encodeChatRequest` 心跳 `return` 之后无条件 `encodePresentMessageField(30, …)`（`grpcSessionAttachWire.ts` L153–164）。按 HEAD 结构最自然的改法是 push(11) 再 fall-through —— protobuf oneof 后写覆盖，引擎仍看到 30，座能亮、点允许仍当用户输入。禁止这条。S6 测必须含：`{kind:'permissionRespond',...}` **有 11、无 30**；clientTool **有 13、无 30**；`{kind:'questionRespond',...}` **整包 failed**（`encodeChatRequest` **抛**，host `mark('failed')`），**禁止**空 oneof（仅 session_id+agent_id）、**禁止**假 field 20、**禁止**再写 30。HEAD `writeChat`（`sessionViewHost.ts` L1457–1462）在 `resident.write` 成功后无条件 `accepted`；encode 若只跳过 30 不抛，host 仍 accepted。无 kind 的 `{ text, messageId }` 仍含 field 30、不含 11。

防御臂须认 camelCase：`requestId` / `callId` / `isError`（Actor 出站如此）。HEAD Actor `onClientToolRespond` / `onQuestionRespond` **只 cleanup、不** `enqueueOrWriteChat`；编 13/20 对当前出站几乎不可达，是防御编码，**不是**接通 CTA 修复。接通 CTA **仍 unary**。座不出现是 **S1 入站**。

## 3. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 按已消费臂补 decoder + thinking 键 + Resume(client id) + Chat 已有 oneof** | 只解 §2「必须解」；recover 禁止首行；Chat 臂不再假 SessionInput | **选定** |
| B 等引擎改 proto / 等 Desktop 同步 decoder | 本仓继续丢 L3/L4 | **拒绝。** 号已在引擎 proto；本仓 demux 已写好 |
| C 发明本仓没有的 L3 17 臂全量 fold | 把 DeepThink 等做成产品 | **拒绝。** 发明 UI / 发明 fold |
| D recover 用 title 再首行 | 维持现状 | **拒绝。** title 线上发不出 |
| E 手改 vendored Actor 修 CTA 复活 / hello 门控 | 本仓改 `sessionCore/**` | **拒绝。** GFS-4；另走 [cross-repo-protocol](cross-repo-protocol.md) |
| F 接通权限改走 Chat 臂、停 unary | 推翻 engine-protocol-surface | **拒绝。** 本稿只修 Chat 臂假编码，不改主路 |

## 4. 选定设计（A）

1. **S1 解码必须解的臂。** 按 §2 表（含子字段号）。测必须 **bytes → `decodeSessionStreamEvent` → 真正消费端**：
   - L4 座 / snapshot 44 → **demux**（44 的 bytes 测必须含一条 `pending[].kind=1` 的权限座；`pending` / `tool_runtime_snapshots` 是 **repeated**，`lastBytes` 得到对象 → `pending=[]` → 空快照抹座）。另两条 bytes → 真消费端：**32 再 44 内 `tool_runtime_snapshots[]`（根上 field 23）先后进 `handleStreamPayload` 出 mutation record**（44-only 无先前 32 不出 record）；**44 `pending kind=2` 且 `questions` 为数组 → overlay 问句非空**（L4 51 的 `localFactFromQuestionArm` 测绿救不了 overlay pending 内层）
   - L4 `ask_user_question` bytes 测（至少一条 item）必须让 **`localFactFromQuestionArm` 非空**（HEAD demux 无 items 仍出 `arm:'question'`，宿主只在 fact 有值时才 `questionAsked`；`items`/`questions` 若 `lastBytes` 成对象 = 提问座不出现）。`options` 可弱于 items（无 options 座仍在）
   - 无 snapshot 的 30/31/34 → **`OverlayDeltaJoin.handlePayload`** 出 `overlayActiveTurn`，且 **`streamingText` / `thinkingText` / `generatingToolName` 必须等于编进去的 `text_delta=5` / `tool_name=4`**（HEAD `overlayDeltaJoin.ts` L114–150：`turn_id` 合法就出臂，delta 缺或非字符串时正文为空串；只 assert 有臂会假绿）
   - 32/46 → join：PIN oneof 在 **snapshot 根上** field 23。HEAD `onToolRuntimeSnapshot` **只**认夹具 `{ payload: { file_mutation_payload } }`。选定：**join 兼认根上 `file_mutation_payload`**。HEAD 无 lifecycle binding 只入 pending、**不 emit**（`fileMutationJoin.ts` L159–163）。PIN `SessionStreamEvent.event` 是 oneof：32 / 44 / 46 **不能同条 wire**。HEAD `handleStreamPayload` 能在一个 JSON 里同时读两键（L84–96）；decoder 按字段独立 `lastBytes`，单包同编 32+46 会两键都出、**非法夹具仍绿**。S1 测必须是 **两条 `SessionStreamEvent` bytes**（先 32 再 46/44，或先 46/44 再 32）先后进 `handleStreamPayload`，根上 field 23，禁止 `payload` wrapper。**禁止**单包同编 32+44/46。
   - 37 嵌套 `turn_lifecycle.turn_completed` → OverlayDeltaJoin **clear**；**另**一条 bytes → decoder → `handleStreamPayload` **兼认嵌套形** → `onTurnSettle`（或 `assistant_turn_id` 重发）。HEAD join **只**读顶层 `turn_completed`（L99–102）；只测 OverlayDeltaJoin clear 不需要改 join，Sources 回合 settle 仍丢
   - 16 → demux `sessionPurged` → closed
   - 39 → bytes → decoder → **`readTeamCreatedTeamId` 得到 JS number**（或 host `teamIdBound`）。HEAD demux 对 `multi_agent_status` 无臂、落到 `return []`（`sessionStreamDemux.ts` 末），切片禁止把 39 放进 demux 测桶
   禁止只 `Object.hasOwn(payload, 'permission_request')`。测文件点名 `overlayDeltaJoin.test.ts`、`fileMutationJoin.test.ts`（37 **与** 32/46 形）。`turn_lifecycle` 输出 proto 嵌套形。`session_purged=16` 必须解成 `{}`。
2. **S2 thinking 键。** `decodeBlock` 对 ThinkingBlock field 1 发 `thinking`（可同时留 `text` 作别名）。demux 测加一条 **encoded bytes** 路径。
3. **S3 活 L2 `file_mutation`。** `handleStreamPayload` 对已解码的 `envelope_*` 走与 history 相同的 `iterL2EnvelopesFromStreamPayload` / `emitHistoryEnvelopeMutations`。测打 **stream** 入口，不要只复制 `handleHistoryPayload` 测（HEAD history 已能走 `envelope_appended`）。不解析 `arguments_json`（G-REV-1）。不重开 A2 / ApplyHunks。
4. **S4 recover。** `listed.sessions.find(s => s.sessionId === clientSessionId)` 优先；否则 `resumeClientSessionIfKnown`；再失败 **throw**。删除 title 优先与 `sessions[0]`。改掉依赖「列出 eng-listed 就 Resume 它」的测。
5. **S5 host 局部名 `bindGeneration` + pairing 门。** `bindGeneration` 是 host 给 inflight/bound/brought-up 盖戳的**局部名**，必须等于（或拷贝）现有 `this.connectionGeneration`。HEAD：接通时该字段 +1，写入 `{ t: 'connectionUp', connectionGeneration }`；Actor `onConnectionUp(connectionGeneration)` **仍收该参数**；`engineBoundForGeneration` 是 Set、不读代。**禁止**改 Actor 消息字段名；**禁止**第二套与 Actor 脱钩的计数器。D405 S2「重开 post 同代、不 +1」一字不改。await 后对不上不 commit；代变了必须 Resume。`pairingPending` 且 leftover-looks-live 时：即使 `connectionUp===true`，`acquireLease` / `ensureEngineSession` / `requestDetail` **不新 Create/Resume**（已绑定 leftover id 的 detail 仍可读）。**`acquireLease` 仍返回 leaseId**，只挡 bring-up/Create/Resume，不要把 acquire 本身 fail-closed（D405 lease 合同）。leftover 门是在 D378 已闸 `onEngineConnectionChanged` 之上补这三处，不得回退 pairing-first。**与 D405 S4b 同改 `sessionViewHost.ts`：P 槽串行，不占 S4a/S4b 语义。**
6. **S6 Chat 臂 encode。** 见 §2 细则。未知 kind / 未齐的 map **不**当 SessionInput、host `failed`。不转 D24 的 unary `respondPermission` / `respondQuestion` / `sendClientToolResponse` JSON。**Connect bytes 不属于本稿**（[connection-dial-generation](connection-dial-generation.md) S3）。

## 5. 不变量

- 禁止发明 proto 号、capability、RPC、GetQueue。
- 禁止手改 `node/sessionCore/**` / `common/sessionView/**`（除已允许的手维护 barrel）。
- 禁止把 JSON 夹具绿当成 bytes 合同。
- 禁止 recover 回落名册序或 title。
- 禁止 Chat 臂把 permission/question/client-tool 编成空 `SessionInput` 再标 accepted。
- 禁止本波做完就升 PRD-008。
- 不关 D24。不把 unary Respond* / SendClientTool 转 bytes。Connect bytes 只属于 [connection-dial-generation](connection-dial-generation.md)。
- 禁止包整圈 `drainIntents`、发明 heartbeat `client_id`。
- `recoverSessionAfterAlreadyExists` 的 `title` 参数可留但 **禁止再读**；host 测「List 只有 eng-listed 就 Resume 它」改为 Resume(client id) 或 throw。

## 6. 切片

| Slice | Goal | Files | Tests / 本地门禁 | Exit |
|:------|:-----|:------|:-----------------|:-----|
| **S1** 必须解臂 | decoder + OverlayDeltaJoin + join 兼认 37 嵌套与 46 **根上** field 23；16/30/31/34/44/50–52/32/46/39 | `grpcSessionAttachWire.ts` · `overlayDeltaJoin.ts` · `fileMutationJoin.ts` | bytes → decoder → **demux**（座 / 44 含 `pending kind=1` 数组 / purge）且 OverlayDeltaJoin 30/31/34 **正文等于 field 5/4**（及 37 clear）且 **两条 bytes** 先后 `handleStreamPayload` 出 mutation record（先 32 再 46/44，禁单包）且 44 pending kind=2 `questions` 数组 → overlay 问句非空 且 L4 ask_user → **`localFactFromQuestionArm` 非空** 且 39 → **`readTeamCreatedTeamId` 得 number** 且 **嵌套 37 → `handleStreamPayload` `onTurnSettle`** | 禁止只 assert 有臂 / 只测 demux / 单包 32+46 / 只测 overlay 37 |
| **S2** thinking | field 1 → `thinking` | 同上 + `sessionStreamDemux.ts` 若需双认 | bytes thinking 块 → reasoning 臂 | 夹具 `{ text }` 不再是唯一绿路径 |
| **S3** 活 L2 mutation | stream envelope 进 join | `fileMutationJoin.ts` | `fileMutationJoin.test.ts`：打 **`handleStreamPayload`**（不是只复制 history）：stream `envelope_appended`+`file_mutation` 出 record | 不碰 Apply |
| **S4** recover | Resume(client id) 或 throw | `sessionCreateRecover.ts` | 非空 List 无匹配 id → 不绑首行；有匹配 id 才 Resume | title 测删除或改口 |
| **S5** `bindGeneration` + pairing 门 | 断连不提交过期 bind；配对中不新 Create | `sessionViewHost.ts`（与 D405 S4b **串行**） | leftover + `connectionUp===true` 时 acquire/requestDetail 不新 bind；inflight 断连不跳过 Resume | 不占 D405 语义；不改 Actor `connectionUp.connectionGeneration` 字段名 |
| **S6** Chat encode | 按 kind 编 11/13；无 kind 仍 30；未知 kind / `questionRespond` **抛** failed；**11/13/20 与 30 互斥** | `grpcSessionAttachWire.ts` | `{kind:'permissionRespond',...}` **含 11、不含 30**；clientTool **含 13、不含 30**；`questionRespond` **抛**（host `failed`；禁空 oneof / 假 field 20 / 再写 30）；无 kind 的 `{text,messageId}` 含 field 30 不含 11；heartbeat 包装键仍 12 | unary 测不改；不问「座出现」；13/20 防御、非接通 CTA |

验证只走本地 [health-gates](../progress/health-gates.md)：`scripts/test.sh --run` 点名上述测。不跑托管 CI，不建议重开 workflow。

## 7. 不做

- 不升 PRD-008；不关 D8 / D16 / D22 / D24（无号方法）/ D31 / D147 / D405
- 不手改 vendored Actor（权限 CTA 复活 / overlay hello / 旧 hist fill 登记 cross-repo，**不**进本切片）
- 不发明 DeepThink / branch fold 产品
- 不改 Connection 握手（[connection-dial-generation](connection-dial-generation.md)）
- 不改透镜绑定叶（[conversation-bound-session](conversation-bound-session.md)）
- 不改 Sources 已审/闸门（[sources-review-open-identity](sources-review-open-identity.md)）
- 不把 live `envelope_range_replaced` 接进 S3（`iterL2EnvelopesFromStreamPayload` 今日不走该臂；rewind chip 另刀）

## 8. 相关

- [conversation-stream-timeline](conversation-stream-timeline.md) · [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md) · [debug-engine](../../docs/guides/debug-engine.md)
- [session-subscription-lifecycle](session-subscription-lifecycle.md)（D405 仍开）
- [sources-review-progress](sources-review-progress.md) G-REV-1（本稿 S3 只接 **已解码** 的 L2 `file_mutation`，不解析 `arguments_json`）
- 2026-09-18 审查：decoder / recover / thinking / Chat encode / host generation

## 审查记录

| 轮 | Assessment | 处置 |
|:---|:-----------|:-----|
| 2026-09-18 规则 16 | Approve with changes | Critical（37 嵌套形 + join 兼认；16 必须解）与 Important（overlay delta 必须解、S1 走 demux/join、S6 enum/map 与 unary 分家、删 Connect D24 例外、S5 串行 + 改名 `bindGeneration`）已改入。Minor：demux 不认 lifecycle 已改口；title 禁止再读；host recover 测改口。S3 多产 chip 不改 Sources 打开合同（对面方案）。 |
| 2026-09-18 规则 16 第二轮 | Approve with changes | 父核 HEAD 后改入 Important：§2 抄 PIN `748e7698e6` 子字段号（禁「实施时再对照」）；S1 overlay 走 OverlayDeltaJoin 防 demux 假绿；S5 `bindGeneration` = 现有 `this.connectionGeneration` 局部名、不改 Actor 消息字段、不另起计数器；S6 按 `kind` 分臂不是 `permission_response` 包装键。Minor：§1 已拆 demux/join/overlay 认键；S3 打 stream 入口；13/20 标成防御编码。无新 Critical。 |
| 2026-09-18 规则 16 第三轮 | Approve with changes | 父核 HEAD 后改入 Critical：S6 无 kind 仍 field 30（submitInput / heartbeat 包装键）；overlay `pending` 抄 `PendingActionSnapshotProto` 内层号 + bytes 座测。Important：39 `team_created.team_id=1`。Minor：`AskUserQuestionEvent.agent_id=3` 已抄；S3 不做 `envelope_range_replaced`。 |
| 2026-09-18 规则 16 第四轮 | Approve with changes | 无 Critical。父核 HEAD 后改入 Important：32/46 join **兼认**根上 `file_mutation_payload`（PIN oneof 23 不在嵌套 `payload`）；`pending`/`tool_runtime_snapshots` 是 repeated；S1 测打 bytes→`handleStreamPayload` 出 record。Minor：kind 测用数值 1；`kind:'submitInput'` 仍 30；camelCase `callId`/`isError`；acquireLease 仍返回 leaseId。 |
| 2026-09-18 规则 16 第五轮 | Approve with changes | 无 Critical。父核 HEAD 后改入 Important：`AskUserQuestionEvent.items` / Item `options` / pending `questions` 是 repeated；S1 L4 提问测必须 `localFactFromQuestionArm` 非空（只 assert demux question 臂会假绿）。Minor：空 oneof 用 `encodePresentMessageField`；bool 解成 JS boolean；23 只在 46 上。 |
| 2026-09-18 规则 16 第六轮 | Approve with changes | 父核 HEAD 后改入 Critical：S6 11/13/20 与 30 **互斥 return**（HEAD L163 无条件写 30；测必须 permission 有 11 无 30）。Important：层表 46 删「嵌套 payload」、bytes 夹具钉根上 23；39 测走 `readTeamCreatedTeamId` 不走 demux；44 内 snapshots / pending questions 各一条真消费端测。Minor：S1 号列可补 23/35/36/38；测文件名 `.test.ts`。 |
| 2026-09-18 规则 16 第七轮 | Approve with changes | 无 Critical。父核 HEAD 后改入 Important：32/46/44 必须 **两条 bytes** 先后进 join（禁单包；44-only 不出 record）；S6 补 `questionRespond` 无 30 + `QuestionAnswer` 未齐 failed；切片 37 锁 `handleStreamPayload` `onTurnSettle`。Minor：S5 leftover 测须先立 leftover；S6 failed 钉 throw。 |
| 2026-09-18 规则 16 第八轮 | Approve with changes | 无 Critical。父核 HEAD 后改入 Important：30/31/34 bytes 测必须正文等于 field 5/4；`questionRespond` 只接受 encode **抛** + host `failed`（禁空 oneof / 假 20）。Minor：切片 32+46 不得顶掉 44 repeated 测。 |
| 2026-09-18 规则 16 第九轮 | **Approve（无 Critical、无 Important）** | HEAD 与 PIN 对齐。R8 合同仍自洽。可以签收。 |
| 2026-09-19 用户签收 | **accepted** | 无 Critical/Important。转入实施。 |
