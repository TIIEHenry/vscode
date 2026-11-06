---
title: "方案 r04：agent-host-rest"
type: plan
status: implemented
phase: N/A
updated: 2026-10-25
summary: "4 hold 已实施，1 weaken 维持现状；取消后的发送与迟到批准被拒绝，Claude 旧流按代际隔离，缺完成事件的工具不再记成功。"
---
# 方案 r04：agent-host-rest

状态：已完成。
覆盖需求：无（正文未引用需求编号）。


## 核查

- r04-1 hold：`_send` 在 `_prepareSdkTurn` 之后仍无条件 `session.send`，`resume` 在同一预检之后仍无条件 `sendMessages`。abort 带来的 idle 对仍为 pending 的回合不拆掉，接着的 `user.message` 会清掉 `_dropLateRootTurnEvents` 并 `markRunning`。
- r04-2 weaken：已取消、activeTurn 被 `endTurn` 清掉之后，迟到确认仍会在找不到工具调用时走到 `respondToPermissionRequest(toolCallId, true)`。反证：`pending_confirmation without an active turn still dispatches (does not hang)` 要求回合正常 `ChatTurnComplete` 之后、没有活动回合时，工作区内的 read 仍然自动批准。不能把「找不到活动工具调用」一律改成拒绝。
- r04-3 hold：aborted 的 `onIdle` 在拆回合之前调用 `_resetAbortToken()`。此后进入的权限回调看到的是新 token；沙箱 shell 分支不读 `_dropLateRootTurnEvents`，直接 `approve-once`。`buildSandboxConfigForSdk` 在沙箱开启时设置 `addCurrentWorkingDirectory: true`。
- r04-4 hold：`_processMessages` 抓住的是当时的 `query`，每条消息检查的是可变的 `this._abortController`。`_rebindQuery` 装上未取消的 placeholder，不等旧 warm dispose，再换成新 controller。`this._query !== query` 的安静返回只在迭代结束之后。循环中途 `peekParent()` 已是新队列头时，router 会按新 `turnId` 发信号。
- r04-5 hold：`completionsByCallId` 只在 `tool.execution_complete` 上填写。`appendFallbackToolRequests` 在没有完成记录时用 `{ success: true }` 调用 `makeCompletedToolCallPart`，状态写成 `ToolCallStatus.Completed`，`success` 取该值。

## r04-1 hold

- 问题类：取消发生在 `session.send` 之前时，预检结束后仍会把这次提示交给 SDK。
- 不变量：`_send` / `resume` 在第一次 await 之前抓住的 abort token 代表这次发送。该 token 已取消，或预检期间当前回合已不是这次发送的回合时，不得调用 `session.send` 或 `rpc.sendMessages`。仍为 pending 的这次回合必须丢掉，这样它自己的 `user.message` 不能再清掉 `_dropLateRootTurnEvents` 并 `markRunning`。协议 reducer 在 `endTurn` 清掉 `activeTurn` 之后已经丢掉后续 part；要守住的是 SDK 不再执行。
- 要动的符号或文件：`CopilotAgentSession._send`、`CopilotAgentSession.resume`。在 `_toSdkAttachments` 与 `_prepareSdkTurn` 都返回之后、进入 `withTraceContext` 里的 `session.send` / `sendMessages` 之前，按 `_startFleet` 已有的两道判断处理：当前回合已不是发送开始时的回合则直接返回；抓住的 `abortToken` 已取消则 `discardActiveTurn()` 并返回。`resume` 在入口 `_resetAbortToken()` 之后再抓住 token，用同一判断包住 `_prepareSdkTurn` 之后的 `sendMessages`。
- 不改：`_startFleet` 的预检放弃逻辑；`_sendTurnMessage` 在 1720 与 1724 行的宿主取消检查；`onUserMessage` 对真实新根用户消息清掉隔离标志的行为。
- 本地验证：保留 `copilotAgentSession.test.ts` 的 `an abort during fleet preflight does not start the fleet loop` 与 `an abort during slash-command resolution does not start the fleet loop`。新增：普通发送在 mode/permission 预检的 await 期间 abort 并收到 aborted idle 后，`session.send` 不被调用，`hasActiveTurn` 为 false。新增：`resume` 在 `_prepareSdkTurn` 的 await 期间 abort 后，`sendMessages` 不被调用。

## r04-2 weaken

- 问题类：属于已取消回合的迟到工具确认，在 activeTurn 消失后仍会被自动批准。
- 不变量：`_cancelledTurnIds` 记下的回合所拥有的工具调用，其后续 `pending_confirmation` 必须拒绝，不得变成已执行。回合正常结束后的 hook 续跑没有活动回合时，仍可由 `getAutoApproval` 自动批准；这条路径的批准只属于从未进入已取消回合的工具调用。
- 要动的符号或文件：`AgentSideEffects` 里登记 `ChatTurnCancelled` 的 `onDidEmitEnvelope` 分支，以及 `_handleToolReady`。信封发出时 reducer 已经跑过 `endTurn`，从该 chat 已结束回合的 response parts 记下 `toolCallId`。`_handleToolReady` 在 `respondToPermissionRequest(..., true)` 之前，若 `e.state.toolCallId` 属于这批 id，则删除对应 `_toolCallAgents` / `_managedApprovalToolCalls` 项，`respondToPermissionRequest(..., false)` 并返回。`removeSubagentSessions` 清理 `_cancelledTurnIds` 时一并丢掉这些 id。
- 不改：692–695 行无活动回合仍进入 `_handleToolReady`；无活动回合且工具 id 不属于已取消回合时的自动批准；带 `parentToolCallId` 的失活子代理在 629–630 行的拒绝；`_cancelledTurnIds` 只丢掉 `ChatTurnComplete` 的现有判断。
- 本地验证：`agentSideEffects.test.ts` 的 `pending_confirmation without an active turn still dispatches (does not hang)` 仍断言 `{ requestId: 'tc-orphan', approved: true }`。新增：`ChatTurnCancelled` 之后，对该回合里出现过的 toolCallId 发 `pending_confirmation`，`respondToPermissionRequest` 的 `approved` 为 false。

## r04-3 hold

- 问题类：取消后的 idle 换掉 abort token，随后的默认沙箱 shell 权限仍返回 `approve-once`。
- 不变量：一次 abort 所取消的 token 继续代表那次回合的权限回调，直到这回合的迟到权限回调结束。该 token 仍处于取消，或 `_dropLateRootTurnEvents` 仍为真时，沙箱 shell 不得被批准执行。下一次有意开始的 `send` / `resume` 才换新 token。
- 要动的符号或文件：`CopilotAgentSession` 的 aborted `onIdle`，以及 `_handlePermissionRequest` 中 `await this._isShellSandboxedByDefault()` 之后的 `approve-once` 分支。拆掉 running 回合或 `_resumingTurnAwaitingProviderStart` 的分支不要调用 `_resetAbortToken()`；只在 idle 故意留下 pending 回合的分支换新 token。沙箱分支在 await 之后若 `this._abortToken` 已取消或 `_dropLateRootTurnEvents` 为真，不要 `_pendingPermissions.respond(toolCallId, { kind: 'approve-once' })`，返回 `{ kind: 'reject' }`。
- 不改：`buildSandboxConfigForSdk` 的 `addCurrentWorkingDirectory`；文件范围编辑面、`requestSandboxBypass`、managed approval 已有的排除；`_guarded` 在进入时 token 已取消则直接返回 reject。
- 本地验证：保留 `copilotAgentSession.test.ts` 的 `does not auto-approve a sandboxed shell command for a file-scoped surface`。新增：running 回合 abort 且 idle 的 `aborted` 为真之后，再进入的 shell 权限请求不得到 `approve-once`，`_pendingPermissions` 不以批准结束。

## r04-4 hold

- 问题类：换绑后旧 query 上尚未结束的消息，按新队列头的 turnId 写进新回合。
- 不变量：一次消费循环只派发它启动时绑定的那一代 query。该代的 abort signal 已取消，或 `this._query` 已不是这代 query 时，旧流消息不得再读 `peekParent()`，也不得交给 `ClaudeSdkMessageRouter.handle`。新回合只接收换绑之后那一代 query 的消息。
- 要动的符号或文件：`ClaudeSdkPipeline._processMessages`。在 `const query = this._query` 旁边抓住当时的 `this._abortController.signal`。`for await` 每一条消息先看这代 signal 与 `this._query !== query`；命中则停止派发并离开循环，让现有的循环结束后手交接管新 query。
- 不改：`_rebindQuery` 在 rematerialize 期间用 placeholder 接住并发 abort，以及 abort 命中 placeholder 时 `failAll` 并丢弃新建成对；`_runConsumerLoop` 在旧 pass 结束后按 query 身份交接；`ClaudeSdkMessageRouter.handle` 在 turnId 属于当前代时的映射。
- 本地验证：保留 `claudeSdkPipeline.test.ts` 的 `a rebind hands the consumer loop off to the new query so the post-rebind turn is not lost`。新增：旧 query 在新回合已经入队之后再吐出一条消息，router 不以新 `turnId` 发出该消息的信号；新 query 上的后续消息仍按新 turnId 发出。

## r04-5 hold

- 问题类：历史重建把没有 `tool.execution_complete` 的工具调用写成成功完成。
- 不变量：工具是否成功只来自 `tool.execution_complete` 写进 `completionsByCallId` 的记录。没有该记录时，恢复出的 part 不得是 `ToolCallStatus.Completed` 且 `success === true`。
- 要动的符号或文件：`mapSessionEvents.ts` 的 `appendFallbackToolRequests`。`completionsByCallId` 没有该 `toolCallId` 时，不要用 `{ toolCallId, success: true }` 调用 `makeCompletedToolCallPart`。有真实 completion 时仍把该 completion 交给 `makeCompletedToolCallPart`。
- 不改：第二遍 `tool.execution_complete` 在 `toolInfoByCallId` 仍在时发出完成 part 的路径；`makeCompletedToolCallPart` 对真实 `ToolExecutionCompleteData.success` 的映射；`completion && toolInfoByCallId.has(...)` 时把 part 留给完成事件的跳过。
- 本地验证：保留 `mapSessionEvents.test.ts` 的 `a regular tool still renders as a tool call`。新增：`assistant.message` 带 toolRequests，且没有对应 `tool.execution_complete` 时，恢复出的 response part 不是 `ToolCallStatus.Completed` 且 `success === true`。

## 落地

- 2026-10-25 实施 r04-1：Copilot 的 `send` / `resume` 在预检 await 之后核对发送时捕获的 turn 与 abort token；已取消或已换 turn 时不把提示交给 SDK，取消时丢弃活动 turn。
- 2026-10-25 实施 r04-2 / r04-3：已取消回合的工具调用记入 `_cancelledTurnToolCallIds`，迟到确认一律拒绝；取消后的 idle 不重置 abort token，默认沙箱权限也返回拒绝。
- 2026-10-25 实施 r04-4：Claude 每次 query 捕获自己的 signal 与 query 对象；换绑后旧流消息在派发前停止，不再按新队列头的 turnId 写入。
- 2026-10-25 实施 r04-5：历史重建中，没有 `tool.execution_complete` 的工具请求恢复为未完成 / 取消态，不再伪造成功完成。
- 验证：`agentSideEffects.test.ts`、`claudeSdkPipeline.test.ts`、`copilotAgentSession.test.ts`、`mapSessionEvents.test.ts` 合计 649 passing。
- 既有失败：无。
