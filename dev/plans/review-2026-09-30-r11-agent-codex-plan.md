---
title: "方案 r11：agent-codex"
type: plan
status: accepted
phase: N/A
updated: 2026-10-01
summary: "2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。回放按 userMessage 切开；附件 steer 按发出文本认领；截断与 fork 用完成后仍在的 host→codex 映射；动态工具以 success 与 failed 判失败。"
---

# 方案

五条均为 hold。不占决策记录编号。

## r11-1

- 问题类：一次 Codex turn 里的多条 `userMessage` 在回放时被收成一个 host turn，后一条文本覆盖前一条。
- 不变量：`replayThreadToTurns` 仍按 `thread.turns` 的顺序走。只有第二条及以后带非空文本的 `userMessage` 才结束当前 host turn 并打开下一条；封口前的 `responseParts`（含第一条 `userMessage` 之前的 rollout coordination）留在当前这条。第一条不另开没有用户文本的前导回合。每开一条 host turn 把 `agentMessageCount` 清零，后一条的第一条助手正文不以 `\n\n` 开头。第一条带文本的 `userMessage` 所在 host turn 的 `id` 仍是 `codexTurn.id`。后续条的 `id` 只由该 Codex turn id 和该 `userMessage` 的 item id 组成，跨 `thread/read` 不变；与 Codex turn id 相同时不要撞成同一个 id。`truncateChat`（约第 5984 行）和 fork 边界（约第 4831 行）在 `codexTurnIdByHostTurnId` 未命中时，若 id 是该派生值，先解回 Codex turn id 再查找。第一条 id 仍等于 Codex turn id，现有 `?? turnId` 对它仍然成立。同一 Codex turn 上已有的 `model` 原样抄到每个切开的 host turn。turn 级 `failed` 错误只挂在最后一条切开的 host turn 上。`thread/rollback` 不能去掉一条 Codex turn 内部的后缀；切开后该 turn 里的第二条用户文本在下次 `thread/read` 仍会被读出来（见 r11-3）。
- 要动的符号或文件：`replayTurnToTurn`、`replayThreadToTurns`（`src/vs/platform/agentHost/node/codex/codexReplayMapper.ts`）。现在第 140–149 行把文本写入同一个 `userText`，第 212–220 行用这一份文本做唯一的 `message.text`。派生 id 能否解回 Codex turn id 做成纯函数，replay、`truncateChat`（约第 5984 行）和 fork 边界（约第 4831 行）共用。
- 明确不改什么：不改实时 steer 拆回合（`_beginSteeringTurn`）。不改「一条 Codex turn 只有一条用户文本」时的 turn id，现有 `multi-turn thread preserves order` 仍要求 `t1`、`t2`。不改无文本的 `userMessage`（图片等）被跳过、以及认不出的 item 被丢掉的行为。`contextCompaction` 在还没有用户文本时写入 `/compact` 的分支保留。
- 本地验证：`scripts/test.sh --grep "a codex turn with two user messages replays as two host turns"`。在 `src/vs/platform/agentHost/test/node/codex/codexReplayMapper.test.ts` 新增该测试：同一 Codex turn 的 items 为用户文本 `first`、一条 `agentMessage`、用户文本 `second`。断言得到两个 host turn；第一条 `message.text` 为 `first` 且 `id` 为该 Codex turn id，中间的助手正文在第一条；第二条 `message.text` 为 `second`。在 `second` 后再放一条 `agentMessage`，断言它的正文在第二条 host turn 上，且不以 `\n\n` 开头。另用带 `threadCoordinationByTurnId` 的单 `userMessage` 回放，断言仍然只有一个 host turn，且 coordination 工具 part 在这条上。回放拆分断言留在 `codexReplayMapper.test.ts`。空映射下的 `truncateChat` 与 `fork.turnId` 放进能驱动 `CodexAgent` 的测试（`codexCreateChat.test.ts`）：对第二条 replay id 做 `truncateChat`，且该 Codex turn 后面还有 turn 时发出 `thread/rollback`；`fork.turnId` 为这条 replay id 时边界能命中该 Codex turn。`codexReplayMapper.test.ts` 调不到这两个方法。已有 `multi-turn thread preserves order` 与 `uses the source codex id as the host id for a restored source` 保持通过。

## r11-2

- 问题类：中途插入的消息带会拼进正文的附件时，回声对不上缓冲的原文，回合结束时气泡被清掉。
- 不变量：`turn/steer` 仍发送 `resolveCodexInput` 的 `input`。认领回声时比较的是这份已发出的 text，不是 `PendingMessage.message.text`。认领成功后 `ChatTurnStarted.message` 仍是原来的 `steering.message`（面板上是用户原文）。多条不同正文的 steer 同时在飞时，仍按发出文本匹配，不改成纯 FIFO。认领、steer 被拒绝、以及 `_drainPendingSteering` 都要删掉这份对照文本。
- 要动的符号或文件：`setPendingMessages`、`_takeMatchingPendingSteering`、`_drainPendingSteering`，以及 steer 请求失败时删除缓冲的那一段（`src/vs/platform/agentHost/node/codex/codexAgent.ts`）。在已经算出的 `input` 上取出第一条 `type: 'text'` 的 `text`，按 steering id 记在会话侧。不要把该字段写进协议类型 `PendingMessage`。`_handleSteeredUserMessage` 继续用 `extractUserInputText` 得到回声。
- 明确不改什么：不改 `resolveCodexInput` 的拼接规则（`codexPromptResolver.ts` 第 134–137 行）。不传 `clientUserMessageId`，也不靠 `userMessage.clientId` 认领。正文未被附件改写时（纯文本、只附加图片），对照文本等于原文，现有相等匹配仍然成立。Codex 从未回声的 steer 仍由 `_drainPendingSteering` 发 `steering_consumed`。
- 本地验证：`scripts/test.sh --grep "steering echo matches resolved attachment text"`。在能驱动 `setPendingMessages` 和 `userMessage` item 的 Codex agent 测试里新增该断言（`src/vs/platform/agentHost/test/node/codex/codexCreateChat.test.ts` 的夹具若推不到这条通知，就在同目录新测试里做）。Resource 附件使 `turn/steer` 的 text 含 `@` 路径；回声等于该 text 时发出 `ChatTurnStarted`，且 `queuedMessageId` 为这条 steering id。回声只等于原始 `message.text` 时不认领，条目仍留在 `pendingSteeringFlips`。

## r11-3

- 问题类：steer 拆开的前一个 host turn 没有写进完成后仍保留的映射，按它截断时不会 `thread/rollback`。
- 不变量：一次 steer 之后，被 `ChatTurnComplete` 结束的 `previousHostTurnId` 和随后的 `newHostTurnId` 都映射到同一个 `appTurnId`，并留在 `codexTurnIdByHostTurnId` 里。`thread/rollback` 丢掉的是锚点 Codex turn 之后的 turn；该 turn 已是最后一条时（`numTurns` 为 0）直接 return，不会发请求，也去不掉仍留在这条 turn 里的 steer 正文。因此本条只验收：两个 host id 都指向该 `appTurnId`；`thread/read` 在该 turn 之后还有 turn 时，对前一个 host id 调用 `truncateChat` 发出 `thread/rollback`，`numTurns` 等于后面的条数，日志不是 `turnId ... not found`。末回合不要求发请求。映射和回滚都做完后，该 Codex turn 里的第二条用户文本仍会被 r11-1 读出来。找不到时仍直接 return，不把 host uuid 当成一次成功的回滚。`appTurnId` 还不存在时不写映射。不要把「插入正文从线程里消失」留在本条不变量里。
- 要动的符号或文件：`_beginSteeringTurn`（在结束 `previousHostTurnId` 且已有 `appTurnId` 时写入 `session.codexTurnIdByHostTurnId`）。`_handleTurnCompletedNotification` 第 2876 行继续写下当时的 host id（steer 之后这是新 id）。派生 id 能否解回做成与 r11-1 共用的纯函数。`truncateChat` 第 5984–5988 行在表未命中时先解回再查找；解回之后仍是查找，找不到就 return。解不开的 id 不发 rollback。
- 明确不改什么：不改回合完成时删除 `hostTurnIdByAppTurnId`（第 2883 行），那是在途关联。不改 steer 仍挂在同一个 app-server turn 上这件事。`?? turnId` 只保留给解不开的 id（第一条切开的 host id 仍等于 Codex turn id）。r11-1 的派生 id 在内存表未命中时先解回再查找，不把解不开的 host uuid 当成 Codex turn id 去发回滚。
- 本地验证：`scripts/test.sh --grep "truncateChat rolls back the codex turn for the host id closed by steering"`。在 `src/vs/platform/agentHost/test/node/codex/codexCreateChat.test.ts` 新增该测试：宿主 turn id 与 app turn id 不同，steer 把同一 app turn 改挂到新 host id，完成通知之后 `codexTurnIdByHostTurnId` 里两个 host id 都指向该 app turn id。该 Codex turn 之后还有 turn 时，对前一个 host id 调用 `truncateChat` 发出 `thread/rollback`，且不会停在 `turnId ... not found`。该 turn 已是最后一条时不要求发请求。已有 `truncateChat rolls back the thread of the addressed chat` 保持通过。

## r11-4

- 问题类：本进程里已经跑完的回合 fork 之后，种进子线程的键仍是源 Codex turn id，截断时用新 host id 查不到。
- 不变量：种映射时，已完成回合的 Codex id → host id 来自 `codexTurnIdByHostTurnId` 的反查，不再来自已经在完成时删空的 `hostTurnIdByAppTurnId`。反查得到的 host id 再套 `fork.turnIdMapping`，写入子会话的 `codexTurnIdByHostTurnId`。同一源 Codex turn 上若有多个 host id（与 r11-3 同一张表），每个能被 `turnIdMapping` 命中的 host id 都映射到同一个 forked Codex turn id；`planForkedTurnIdMap` 每个下标仍只出一行，其余 host id 在调用方补 `set`。在途回合若仍留在 `hostTurnIdByAppTurnId`，覆盖该 Codex id 的主键。durable 反查为空时，键等于源 Codex id 的条目仍把源 Codex id 当作 host id。`turnIdMapping` 里凡能按 r11-1 解回该源 Codex turn id 的键，其新 host id 都要指到同一个 forked turn id。空表回退不得只处理键等于源 Codex id 的那一条。
- 要动的符号或文件：`_forkChatBacking` 里调用 `planForkedTurnIdMap` 的实参（`codexAgent.ts` 第 4977–4985 行）。反查做成 `codexForkPlan.ts` 里的纯函数，输入是 `codexTurnIdByHostTurnId` 与可选的在途 `hostTurnIdByAppTurnId`，输出仍是 `planForkedTurnIdMap` 要的 Codex id → 一个 host id，另给出需要一并种下的其余 host id。`planForkedTurnIdMap` 第 81–83 行的 `get ?? sourceCodexId` 保留。
- 明确不改什么：不改 `resolveForkBoundary` 在表命中之后的形状。第 4831 行在表未命中时先按 r11-1 的派生式解回 Codex turn id，再查找；解不开的 id 仍走现有 `?? turnId`。不改恢复后的会话：durable 映射为空、`turnIdMapping` 的键就是源 Codex id 时，结果仍是新 host id → forked Codex id。同一 Codex turn 上多个 host id 哪一个当 `planForkedTurnIdMap` 的主键，只要最终键满足下面的断言即可。
- 本地验证：`scripts/test.sh --grep "planForkedTurnIdMap|fork seeds completed host turn ids"`。`src/vs/platform/agentHost/test/node/codex/codexForkPlan.test.ts` 已有 `maps new host ids to the forked thread's (regenerated) codex ids for a live source` 与 `uses the source codex id as the host id for a restored source (no host map)` 必须保持通过。新增断言：durable 表为 `{ hostUuid → c0 }`、在途表为空、`turnIdMapping` 为 `{ hostUuid → newHost }` 时，种下的键是 `newHost` 而不是 `c0`。再断言同一 `c0` 上的两个 host id 都在 `turnIdMapping` 里时，两个新 host id 都指向同一个 forked turn id。再断言恢复后内存表为空、`turnIdMapping` 的两个键分别是源 Codex turn id 和按 r11-1 派生的第二条 replay id 时，两个新 host id 都指向同一个 forked turn id。

## r11-5

- 问题类：动态工具 `success === false` 会在 `status === 'completed'` 时被记成成功，失败原因和拒绝码都不会带上。
- 不变量：`success === false` 或 `status === 'failed'` 都是失败。`status === 'completed'` 且 `success !== false`（`true` 或 `null`）仍是成功。失败时沿用现有错误对象：`message` 为 `` `Dynamic tool ${status}` ``；`declinedToolCalls` 里有该 `toolCallId` 时带 `code: 'denied'`。`pastTenseMessage` 在失败且没有 server display 时用 `` `Failed to call ${toolName}` ``。
- 要动的符号或文件：`mapItemCompleted` 里 `dynamicToolCall` 分支的 `success` 计算（`src/vs/platform/agentHost/node/codex/codexMapAppServerEvents.ts` 第 1154 行）。不要把 `params.item.status === 'completed'` 单独并进成功。
- 明确不改什么：不改 `getCodexThreadCoordinationCall`（它已经把 `success === false` 和 `status !== 'completed'` 分开）。不改 `commandExecution`、`fileChange`、`mcpToolCall`、`collabAgentToolCall` 的成功条件。不改 `declinedToolCalls.delete` 的位置，只让失败分支用上这个标志。
- 本地验证：`scripts/test.sh --grep "dynamicToolCall"`。`src/vs/platform/agentHost/test/node/codex/codexMapAppServerEvents.test.ts` 已有 `dynamicToolCall item maps to tool call lifecycle`（`status: 'completed'` 且 `success: true`）必须仍为成功。新增三条断言：`completed` + `success: false` 时 `result.success` 为 false 且带 `error`；同一形状且 `declinedToolCalls` 含该 `toolCallId` 时 `error.code` 为 `denied`；`status: 'failed'` 且 `success: true` 时仍为失败。`success` 为 null 时现有 `success === true || status === 'completed'` 已经判失败，不能拿它当这条回归。

## 审查

2026-09-30 只读审查后改稿。无 Critical。Important：`thread/rollback` 去不掉同一 Codex turn 内部的后缀用户文本；切开后的 host id 在映射表为空时先解回 Codex turn id。Minor：coordination parts 不另开前导回合；切开后 `agentMessageCount` 清零。均已写入正文。

2026-09-30 第二轮。无 Critical。Important：解回做成 replay、`truncateChat`、fork 边界共用的纯函数；空映射的截断和 fork 断言改到能驱动 `CodexAgent` 的测试。重启后凡能解回源 Codex turn id 的 `turnIdMapping` 键都种到同一个 forked turn。Minor：r11-5 的失败断言改为 `status: 'failed'` 且 `success: true`。均已写入正文。

2026-09-30 用户签收。`accepted`。未实施。
