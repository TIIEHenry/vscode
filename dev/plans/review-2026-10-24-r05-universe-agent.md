---
title: "审查 r05：universe-agent"
type: reference
status: draft
phase: N/A
updated: 2026-10-24
summary: "4 条；提问与客户端工具回复被画成已完成但未发给引擎，换链后的旧结果还会改写当前连接。"
---
# 审查 r05：universe-agent

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r05-1 高
- 症状：用户回答提问或交回客户端工具结果后，待办被清掉、时间线写成已回答，`post` 返回已接受，引擎没有收到这次回复。
- 位置：`src/vs/platform/universeAgent/node/sessionCore/session-actor-local-fact.ts` 第 360–422 行
- 引用：
```360:364:src/vs/platform/universeAgent/node/sessionCore/session-actor-local-fact.ts
	;(SessionActor.prototype as unknown as SessionActorFold).onClientToolRespond = function (this: SessionActorFold,
		fact: Extract<NormalizedLocalFact, { kind: 'clientToolRespond' }>,
	): void {
		this.applyCleanupPatches(this.clientToolRespondCleanupPatches(fact))
	}
```
```387:389:src/vs/platform/universeAgent/node/sessionCore/session-actor-local-fact.ts
	;(SessionActor.prototype as unknown as SessionActorFold).onQuestionRespond = function (this: SessionActorFold, fact: Extract<NormalizedLocalFact, { kind: 'questionRespond' }>): void {
		this.applyCleanupPatches(this.questionRespondCleanupPatches(fact))
	}
```
- 为什么是问题：`SessionViewHost.post`（第 497–508 行）把 `questionRespond` / `clientToolRespond` 直接折成 localFact 并在折叠成功时返回 `accepted: true`。上面两个处理立刻清掉 pending，并在能对上时间线时写成已回答。同文件注释写明这两类是 unary 成功后的清理，且 0 次 `chatStreamWrite`。写路径没有调用 `respondQuestion`（`universeAgentConnectionService.ts` 第 1575–1576 行）或 `sendClientToolResponse`（第 1663–1664 行）。`encodeChatRequest` 对 `questionRespond` 直接抛错（`grpcSessionAttachWire.ts` 第 770–774 行），提问也不能从 Chat 流补出去。回答停留在本地视图里。
- 方向：提问和客户端工具的已完成态只在对应 unary 成功之后落地，失败保留原来的待办。

## r05-2 中
- 症状：换到新连接之后，旧链路上的 Agent 树探测仍会把当前能力快照改成不支持，或把旧树写进当前会话。
- 位置：`src/vs/platform/universeAgent/node/universeAgentConnectionService.ts` 第 769–790 行
- 引用：
```777:790:src/vs/platform/universeAgent/node/universeAgentConnectionService.ts
		} catch (error) {
			if (error instanceof UniverseAgentTransportError && error.code === GrpcStatusCode.UNIMPLEMENTED) {
				this._agentTreeProbeUnsupported = true;
				this._setAgentTreeFetchFailed(false);
				this._capabilities = {
					...this._capabilities,
					agentTree: { support: 'UNSUPPORTED', reason: 'UNIMPLEMENTED' },
				};
				this._fireSnapshotChanged();
			} else {
				this._setAgentTreeFetchFailed(true);
			}
			throw error;
		}
```
- 为什么是问题：`_withTransport` 在传输对象已经换成另一条链路时，成功结果原样返回（第 2459–2460 行），错误则重新抛出且不再改连接状态（第 2477–2478 行）。`fetchAgentTree` 的 catch 不看这次调用绑的是哪条传输，旧链路的 `UNIMPLEMENTED` 会把新连接的 `agentTree` 写成 `UNSUPPORTED`，并把 `_agentTreeProbeUnsupported` 留到下次提交连接。其它错误会把新连接标成拉取失败。成功返回的旧树还会被 `AgentTreeCoordinator.doFetch` 在 await 之后无条件 `onBound`（`agentTreeCoordinator.ts` 第 125–130 行），写进当前会话。同文件 `fetchToolDetail` 第 819–822 行在 `UNIMPLEMENTED` 时同样不核对传输对象就置 `_fetchToolDetailUnsupported`。
- 方向：探测返回时传输对象已换，就丢掉这次状态码和树，不要写进当前连接。

## r05-3 中
- 症状：握手用 `Service.*` 广告整组方法时，能力快照可以是已支持，保存技能和工具详情仍按未广告关掉。
- 位置：`src/vs/platform/universeAgent/node/universeAgentConnectionService.ts` 第 3117–3119 行
- 引用：
```3117:3119:src/vs/platform/universeAgent/node/universeAgentConnectionService.ts
	private async _probeSaveSkill(transport: IUniverseAgentGrpcTransport, methods: readonly string[]): Promise<boolean> {
		if (!methods.includes(UniverseAgentSaveSkillContentMethodKey)) {
			return false;
```
- 为什么是问题：`isAdvertisedMethod`（`grpcCapabilityProbe.ts` 第 168–177 行）把 `ToolService.*` / `AgentService.*` 当成该服务每个方法都已广告，能力探测因此可以把 List 类标成 `SUPPORTED`。保存技能的键是 `ToolService.SaveSkillContent`，工具详情的键是 `AgentService.FetchToolDetail`。`_probeSaveSkill` 和 `fetchToolDetail`（第 805 行）只用 `includes` 做全字符串相等。通配广告下保存技能不会绑定，工具详情直接返回 `unavailable`，和同一份方法清单上的能力快照不一致。
- 方向：保存技能和工具详情的广告判断与能力探测一样承认服务级通配。

## r05-4 中
- 症状：Chat 双向流在本地关掉之后，迟到的错误帧仍会清掉当前会话的待发消息和 overlay，并写入一条失败。
- 位置：`src/vs/platform/universeAgent/node/grpc/grpcClientCalls.ts` 第 320–354 行
- 引用：
```320:331:src/vs/platform/universeAgent/node/grpc/grpcClientCalls.ts
		const gate = createStreamCloseGate(onClosed);
		call.on('data', (data: TResponse) => onResponse(data));
		call.on('error', (error: grpc.ServiceError) => {
			if (gate.closed) {
				return;
			}
			const message = typeof error?.message === 'string' && error.message ? error.message : 'stream error';
			gate.finish({ kind: 'error', message });
		});
		call.on('end', () => {
			gate.finish({ kind: 'remote' });
		});
```
- 为什么是问题：`dispose` 先 `closeLocal` 再 `cancel`（第 346–353 行），关闭门已经关上。`data` 监听不读这扇门，帧仍交给 `onResponse`。`openResidentChat` 的响应回调只调用 `noteChatRunFailed`（`sessionViewHost.ts` 第 1736 行），不看这条流自己的 `disposed`。`noteChatRunFailed` 只在整个 host 已销毁时返回（第 1802–1810 行）。折进 actor 后，`onChatRunFailed` 会删掉当前全部待发、清掉 overlay，并插入失败行（`session-actor-local-fact.ts` 第 583–630 行）。换链路时 `releasePublishedLink` 会关掉这些 Chat 流（`sessionViewHost.ts` 第 682–685 行），同一个 actor 继续接待新连接，旧错误帧写进的是换链之后的会话状态。
- 方向：本地关闭之后，这条双向流上的 data 帧不再进入会话折叠。
