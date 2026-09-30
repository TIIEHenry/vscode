---
title: "审查 r11：agent-codex"
type: reference
status: draft
phase: N/A
updated: 2026-09-30
summary: "回放丢掉同一回合里较早的用户消息；带附件的中途插入对不上原文；steer 与 fork 之后截断对不上 turn id；失败的动态工具被记成成功。"
---

# 发现

## r11-1 中
- 症状：同一条 Codex turn 里如果有多条用户消息（中途 steer 会在原 turn 上再追加一条 `userMessage`），重新打开会话后只剩最后一条用户文本，较早的提示消失，steer 前后的助手内容和工具结果挤在同一个回合里。
- 位置：`src/vs/platform/agentHost/node/codex/codexReplayMapper.ts` 第 140–149 行
- 引用：
```
140|		if (item.type === 'userMessage') {
141|			const collected: string[] = [];
142|			for (const c of item.content) {
143|				if (c.type === 'text') {
144|					collected.push(c.text);
145|				}
146|			}
147|			if (collected.length > 0) {
148|				userText = collected.join('\n\n');
149|			}
```
- 为什么是问题：`replayTurnToTurn` 把整个 Codex turn 收成一个 host turn，后一条 `userMessage` 直接覆盖 `userText`（第 212–220 行用这份文本作为回合的 `message.text`）。实时路径在 `_beginSteeringTurn`（`codexAgent.ts` 第 2954–2966 行）会把 steer 拆成新的 host 回合，但 Codex 仍把两条用户消息留在同一个 app-server turn 里。下次 `getMessages` 走 `replayThreadToTurns` 时，原提示不再出现。
- 方向：回放时按每条 `userMessage` 切开回合，而不是只保留最后一份文本。

## r11-2 中
- 症状：回合进行中插入一条带文件、选区或其它会拼进正文的附件的消息时，这条消息不会变成可见回合；回合结束后面板上的待发送气泡也被清掉，用户看不到自己刚发的内容。
- 位置：`src/vs/platform/agentHost/node/codex/codexAgent.ts` 第 2936–2943 行
- 引用：
```
2936|	private _takeMatchingPendingSteering(session: ICodexSession, text: string): PendingMessage | undefined {
2937|		for (const [id, msg] of session.pendingSteeringFlips) {
2938|			if (msg.message.text === text) {
2939|				session.pendingSteeringFlips.delete(id);
2940|				return msg;
2941|			}
2942|		}
2943|		return undefined;
```
- 为什么是问题：`setPendingMessages` 缓冲的是原始 `message`（第 5692 行），发给 Codex 的却是 `resolveCodexInput` 的结果（第 5688 行）。解析器会把资源路径、文本附件和 `modelRepresentation` 用空行拼进唯一的 text 项（`codexPromptResolver.ts` 第 134–137 行）。回声的 `userMessage` 因此不等于 `msg.message.text`，`_handleSteeredUserMessage` 直接返回空（第 2924–2925 行）。回合结束时 `_drainPendingSteering`（第 2984–2992 行）再发 `steering_consumed`，气泡消失，这条插入从未进转录。
- 方向：用实际发给 `turn/steer` 的文本做匹配，或按待发送 id 而不是正文相等来认领回声。

## r11-3 中
- 症状：同一回合里 steer 之后，再从 steer 之前那条消息编辑或截断，Codex 线程不会回滚；界面上删掉的内容在下次读取历史时整段回来。
- 位置：`src/vs/platform/agentHost/node/codex/codexAgent.ts` 第 2870–2883 行
- 引用：
```
2870|		const appTurnId = params.turn.id;
2871|		const hostTurnId = this._hostTurnId(session, appTurnId);
2872|		const out = mapTurnCompleted(session.mapState, this._withHostTurn(session, params), this._clearTurnStopWatch(session));
2873|		// Remember which codex (app-server) turn each workbench turn maps to so
2874|		// truncateChat can translate a host turn id to a thread rollback even
2875|		// after the live correlation below is cleared.
2876|		session.codexTurnIdByHostTurnId.set(hostTurnId, appTurnId);
2877|		// Codex reports app-server turn ids, while the workbench owns host turn ids.
2878|		// Clear the correlation after completion so later turns cannot reuse stale ids.
2879|		if (session.currentAppTurnId === appTurnId || session.currentTurnId === hostTurnId) {
2880|			session.currentTurnId = undefined;
2881|			session.currentAppTurnId = undefined;
2882|		}
2883|		session.hostTurnIdByAppTurnId.delete(appTurnId);
```
- 为什么是问题：`_beginSteeringTurn` 会先把这个 app turn 改挂到新的 host id（第 2962–2966 行），并结束旧的 host 回合，但不会把 `previousHostTurnId` 写进 `codexTurnIdByHostTurnId`。完成时第 2871–2876 行只记下 steer 之后的 host id。`truncateChat` 用旧 host id 查表落空后，把 host uuid 当成 Codex turn id（第 5984–5988 行），找不到就直接 return，不调用 `thread/rollback`。
- 方向：steer 拆回合时把被结束的 host id 和随后的 host id 都记到同一个 Codex turn 上，截断时按这个映射回滚。

## r11-4 中
- 症状：从本进程里已经跑完回合的会话 fork 出去之后，再编辑或截断 fork 继承的历史，`thread/rollback` 被跳过，删掉的回合仍留在 fork 线程里。
- 位置：`src/vs/platform/agentHost/node/codex/codexAgent.ts` 第 4977–4985 行
- 引用：
```
4977|				const entries = planForkedTurnIdMap(
4978|					sourceTurns.map(t => t.id),
4979|					forkedTurns.map(t => t.id),
4980|					keepThroughIndex,
4981|					sourceSession?.hostTurnIdByAppTurnId,
4982|					fork.turnIdMapping,
4983|				);
4984|				for (const [hostTurnId, forkedCodexTurnId] of entries) {
4985|					session.codexTurnIdByHostTurnId.set(hostTurnId, forkedCodexTurnId);
```
- 为什么是问题：`planForkedTurnIdMap` 用传入表把源 Codex turn id 反查旧 host id（`codexForkPlan.ts` 第 81–83 行）。传入的 `hostTurnIdByAppTurnId` 在回合完成时已被删掉（第 2883 行），查不到就退回源 Codex id。调用方的 `turnIdMapping` 键是工作台 host id，对不上，种进 fork 的键仍是旧 Codex id。之后 `truncateChat`（第 5984–5988 行）用新的 host id 查找，找不到就跳过回滚。跨重启后回放直接用 Codex turn id 当回合 id，这条只发生在本进程仍持有独立 host id 的会话上。
- 方向：用回合完成后仍保留的 `codexTurnIdByHostTurnId` 反查 host id，再套 `turnIdMapping`。

## r11-5 中
- 症状：动态工具调用已经结束且 `success` 为 false 时，聊天里仍显示调用成功，不带失败原因；若这次调用曾被用户拒绝，也不会标成拒绝。
- 位置：`src/vs/platform/agentHost/node/codex/codexMapAppServerEvents.ts` 第 1153–1167 行
- 引用：
```
1153|	if (params.item.type === 'dynamicToolCall') {
1154|		const success = params.item.success === true || params.item.status === 'completed';
1155|		const output = dynamicToolOutput(params.item.contentItems) || entry.output;
1156|		const content = output ? [{ type: ToolResultContentType.Text as const, text: output }] : undefined;
1157|		const serverDisplay = success ? getServerToolDisplay(entry.toolName, params.item.arguments, { text: output, success }) : undefined;
1158|		return [{
1159|			type: ActionType.ChatToolCallComplete,
1160|			turnId: entry.turnId,
1161|			toolCallId: entry.toolCallId,
1162|			result: {
1163|				success,
1164|				pastTenseMessage: serverDisplay?.pastTenseMessage ?? serverDisplay?.invocationMessage ?? (success ? `Called ${entry.toolName}` : `Failed to call ${entry.toolName}`),
1165|				content,
1166|				...(success ? {} : { error: { message: `Dynamic tool ${params.item.status}`, ...(declined ? { code: 'denied' } : {}) } }),
1167|			},
```
- 为什么是问题：`ThreadItem` 的 `dynamicToolCall` 同时带独立的 `status`（`inProgress` | `completed` | `failed`）和 `success: boolean | null`。`status === 'completed'` 会把 `success === false` 盖成成功，于是错误分支（含 `declined` 时的 `code: 'denied'`）不会发出。同目录 `getCodexThreadCoordinationCall`（`codexThreadCoordination.ts` 第 35–36 行）把 `success === false` 和 `status !== 'completed'` 分开判断，说明「已完成但工具失败」是实际会出现的组合。
- 方向：以 `success === false` 或 `status === 'failed'` 判失败，不要把 `completed` 单独当成成功。
