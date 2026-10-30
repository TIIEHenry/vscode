---
title: "方案 r04：agent-host"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 4，drop 0，weaken 1。shell 重定向符号链接、Claude 权限模式竞态、Codex 截断与回滚失败保持；effort 重放降为低。"
---
# 方案 r04：agent-host

状态：草案。
覆盖需求：无（正文未引用需求编号）。


hold 4，drop 0，weaken 1。

## r04-1（hold，高）

- 问题类：shell 写重定向只按字面路径判断是否落在工作目录里，工作区内的符号链接会被自动放行，实际写入跟着链接走到目录外。
- 不变量：写重定向要和写工具一样，字面路径和 `realpath` 之后的路径都要通过 `_checkWriteResource`；`EPERM` / `EACCES` 视为未批准。相对路径仍只相对主工作目录（index 0）做 `path.resolve`。`$`、`` ` ``、`~` 以及 cmd 延迟展开的目标仍然直接要求确认。`date` 这类默认允许命令只有在目标通过上述检查时才可以自动放行。
- 要动的符号或文件：`SessionPermissionManager._isShellWriteDestApproved`、`_resolveShellRedirectResource`（`src/vs/platform/agentHost/node/sessionPermissions.ts`，当前约 549–602 行）。解析复用已有的 `_resolveResourcesForApproval` 和 `_checkWriteResource`。`isWriteDestApproved` 与 `CommandAutoApprover.shouldAutoApprove` 现在是同步的，而 `_realpath` 是异步注入；shell 分支在 `getAutoApproval` 里改成能等待这次解析（谓词返回 Promise，或先取出写目标再异步检查）。
- 明确不改什么：读/写工具已有的符号链接检查；`AgentHostTerminalAutoApproveEnabledConfigKey` 的默认 `true`，以及只有显式 `=== false` 才跳过终端规则（`sessionPermissions.ts` 约 335 行）；命令文法与默认允许表（`commandAutoApprover.ts` 里 `date: true` 等）；`/dev/null` 一类安全汇。
- 怎样本地验证：写工具已有 `requires confirmation when a symlink redirects outside the working directory` 与 `auto-approves when a symlink stays inside the working directory`（`sessionPermissions.test.ts`）。shell 侧应新增断言：工作区内指向目录外的符号链接作为 `date > …` / `echo hi > …` 的目标时，`getAutoApproval` 不返回 `NotNeeded`；解析被拒绝时同样不自动放行；链接目标仍在工作目录内时可以放行。`respects the isWriteDestApproved predicate for write redirections`（`commandAutoApprover.test.ts`）继续只锁谓词结果，不把符号链接放进文法测试。

## r04-2（hold，中）

- 问题类：重叠的 `setPermissionMode` 里，先发起的请求后返回时会把已经换掉的模式写回 SDK 和 `_appliedPermissionMode`。
- 不变量：任一权限更新落地之后，SDK 当前模式与 `_appliedPermissionMode` 等于当时的 `_currentPermissionMode`。后发起的模式不会被更早的 `await` 盖掉。
- 要动的符号或文件：`ClaudeSdkPipeline.setPermissionMode`（`src/vs/platform/agentHost/node/claude/claudeSdkPipeline.ts`，当前 520–525 行）。在这条方法里串行化 SDK 调用，并在 `await` 之后核对 `_currentPermissionMode` 仍是本次请求的值再写 `_appliedPermissionMode`；若 SDK 已被写成旧值，再把当前值推回去。对照同文件 `setModel`（当前 369–372 行）在写回前核对 `_currentModel`。配置监听仍在 `ClaudeAgentSession` 约 684–693 行直接调用 `setInheritedPermissionMode`，串行化放在 pipeline 内即可覆盖这条不等待的调用。
- 明确不改什么：`setModel` 与 `setEffort` 的现有写回；`ClaudeAgentSession.send` 在非重绑分支上预先调用 `setPermissionMode(resolveCurrentPermissionMode(...))`（约 1063–1064 行）；监听里对 session 过滤和失败日志。
- 怎样本地验证：现有 `Test 16 — live permissionMode update forwards via Query.setPermissionMode on the next sendMessage`（`claudeAgent.test.ts`）只覆盖单次转发，保持通过。应新增断言：两次 `setPermissionMode` 重叠，且第一次的 SDK 调用晚于第二次完成时，结束后 Query 上的模式和 `_appliedPermissionMode` 都是第二次的值。

## r04-3（weaken，低）

原级别为中。降级是因为「重绑后旧 effort 仍留在新会话上并导致下一轮 400」只对上了重放跳过，对不上新进程一定带着 `'high'`。

读到的反证：

- 同传输热切换在 `ClaudeAgentSession.setModel`（约 1175–1182 行）已经 `await setEffort(undefined)`。`setEffort`（`claudeSdkPipeline.ts` 约 392–397 行）会发 `applyFlagSettings({ effortLevel: null })`。现有测试 `switching to a model with no effort clears the stale effort via applyFlagSettings({ effortLevel: null })` 锁的是这条活 Query，不是重绑。
- 重绑材料器（`claudeAgentSession.ts` 约 743–768 行）用当前 `_provisionalModel` 建 Options，`buildOptions` 把 `effort` 设为 `resolveClaudeEffort(input.model)`（`claudeSdkOptions.ts` 168 行）。不支持 effort 的模型这里是 `undefined`，新进程的启动选项不带上一个模型的 `'high'`。
- SDK 的 `applyFlagSettings(null)` 只清除当前进程的 flag layer，并回落到更低优先级来源；该类型说明 flag 不写入设置文件。init 说明里，不支持 effort 的模型会把将要发送的 effort 降为空。因此仅凭 `_replayCurrentConfig` 跳过 `undefined`，推不出新会话仍发送 `'high'` 且 API 400。

仍然成立的缺口：`_rebindQuery`（约 644–648 行）把 `_appliedEffort` 清成 `undefined` 后调用 `_replayCurrentConfig`，而 580–582 行在 `_currentEffort === undefined` 时直接跳过，不会发出 `setEffort` 注释所要求的 `effortLevel: null`。若 resume 把会话里的 effort 带进新 Query，这次重放清不掉。

- 问题类：重绑后的配置重放在当前 effort 为 `undefined` 时不发出清除。
- 不变量：重放结束时，新 Query 的 flag layer 与 `_currentEffort` 一致；`_currentEffort === undefined` 时发出 `effortLevel: null`，有具体档位时仍发出该档位。
- 要动的符号或文件：`ClaudeSdkPipeline._replayCurrentConfig`（约 580–582 行）。`_currentEffort === undefined` 时调用 `applyFlagSettings({ effortLevel: null })`，并把 `_appliedEffort` 记为 `undefined`。
- 明确不改什么：活 Query 上 `setEffort(undefined)` 已有的 null 清除；`bufferConfigForRebind` 对有值 effort 的缓冲。现有 `setEffort while awaiting rebind (post-abort) is buffered, not pushed to the dead query, then replayed on rebind` 继续期望重绑后出现 `{ effortLevel: 'low' }`。不把本条的验收写成「请求一定 400」。
- 怎样本地验证：在 `claudeSdkPipeline.test.ts` 的 `setEffort` 套件加断言：种子 effort 为 `'high'`，在重绑前 `setEffort(undefined)`，重绑后的新 Query 收到 `{ effortLevel: null }`。

## r04-4（hold，中）

- 问题类：截断点落在一条 Codex turn 拆出的用户消息上时，`thread/rollback` 只按整条父 turn 丢后面的 turn，父 turn 里更晚的分段会在下次 `thread/read` 回放时再出现。
- 不变量：拆分 host turn 不是父 turn 的最后一条带文本用户消息时，不发送 `thread/rollback`，`truncateChat` 抛出，宿主不保留这条截断（与 r04-5 的失败闸同一条路）。该分段已经是父 turn 的最后一条带文本用户消息时，仍用父 turn 下标计算 `numTurns`，只丢掉后面的整条 turn。用户消息的认定与 `codexReplayMapper.ts` 里第二段及以后调用 `openSegmentAfterSplit` 的规则相同（约 167–176 行）。
- 要动的符号或文件：`CodexAgent.truncateChat`（`src/vs/platform/agentHost/node/codex/codexAgent.ts`，当前约 5996–6021 行）。父 turn 仍用 `resolveCodexTurnIdFromHostTurnId`（`codexReplayTurnIds.ts` 约 35–47 行）定位；再读该 turn 的 items，用拆分 id 里的 user message item id 判断是不是最后一条。
- 明确不改什么：`replayThreadToTurns` 的拆分方式与 `buildCodexReplaySplitHostTurnId` 的编码；fork 路径。现有 `fork resolves a split replay host turn id to the codex turn boundary`（`codexCreateChat.test.ts`）保持。找不到 turn id 时的 warn 后 return 保持。
- 怎样本地验证：现有 `truncateChat resolves a split replay host turn id to the codex turn for rollback` 的夹具只有 turn id、没有 items，锁的是「拆分 id 折回父 turn，再丢掉后续整 turn」。应改成两条断言：父 turn items 里该分段之后还有带文本用户消息时，`truncateChat` 拒绝且不出现 `thread/rollback`；该分段已是最后一条用户消息、后面还有别的 turn 时，仍 rollback，且 `numTurns` 只计后续整 turn。`truncateChat rolls back the thread of the addressed chat` 的整 turn 成功路径保持。

## r04-5（hold，中）

- 问题类：`thread/rollback` 失败被吃掉，宿主的 `ChatTruncated` 已经先改了会话，下次按 `thread/read` 回放会把删掉的回合装回来。
- 不变量：`thread/rollback` 失败时，state manager 里该 chat 的 turns 与这次截断之前相同，失败通过已有的 `rejectClientAction` 让调用方看见。成功时仍然只回滚一次。
- 要动的符号或文件：`CodexAgent.truncateChat` 约 6014–6021 行的 `catch` 改为抛出。`AgentService` 里进入 `_dispatchActionNow` 的同步快路径（约 4424–4426 行）不能再直接提交 `ChatTruncated`；把该动作放进已有的 per-client 队列，先 `await truncateChat`，成功后再 `dispatchClientAction`。队列上已有的失败分支会 `rejectClientAction`（约 4474–4476 行）。`AgentSideEffects` 的 `ChatTruncated` 分支（约 1513–1529 行）去掉对 `truncateChat` 的调用，避免成功路径回滚两次；checkpoint、本地 turn 清理和 `onSessionTruncated` 仍在成功提交之后执行。
- 明确不改什么：`channels-chat/reducer.ts` 里 `ChatTruncated` 的切片规则（约 733–742 行）；Claude / Copilot 截断成功时的结果；Codex 在 `numTurns <= 0` 或 turn id 找不到时不发 rollback 的 return。恢复仍然从 `chats.getMessages` → Codex `_getChatMessages` 的 `thread/read` 取回合（`agentService.ts` 约 5297 行，`codexAgent.ts` 约 6089–6109 行）。
- 怎样本地验证：没有现成的 rollback 失败测试名。应新增断言：`thread/rollback` 拒绝时，`truncateChat` 向外抛出，state manager 中该 chat 的 turns 与截断前相同，并且发出带 `rejectionReason` 的拒绝信封，而不是只打 `thread/rollback failed` 日志。成功路径仍只出现一次 `thread/rollback`。
