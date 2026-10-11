---
title: "审查 r03：agent-host-rest"
type: reference
status: draft
phase: N/A
updated: 2026-10-11
summary: "5 条；SSH 连接表在读失败或条目被滤掉之后，会被下一次保存整表覆盖。"
---

## r03-1 高

- 症状：已保存的 SSH 远程主机在下一次连接成功后从列表里消失，原始存储也被换成一份更短的列表。
- 位置：`src/vs/platform/agentHost/common/remoteAgentHostService.ts` 第 525–537 行
- 引用：

```525:537:src/vs/platform/agentHost/common/remoteAgentHostService.ts
export function readSSHRemoteAgentHostEntries(storageService: IStorageService): IRemoteAgentHostEntry[] {
	const raw = storageService.get(SSH_REMOTE_AGENT_HOSTS_STORAGE_KEY, StorageScope.APPLICATION);
	if (!raw) {
		return [];
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed)
			? parsed.filter(isRawRemoteAgentHostEntry).filter(isLegacySshRawEntry).map(entry => SSH_ENTRY_TYPE_CONFIG.fromRaw(entry))
			: [];
	} catch {
		return [];
	}
}
```

- 为什么是问题：`JSON.parse` 失败，或根值不是数组时，读函数返回空列表。单条字段类型不符时，`isRawRemoteAgentHostEntry` 会把整条滤掉。连接建立后 `SSHConnectionFactory.storeEntry`（`src/vs/platform/agentHost/electron-browser/sshRemoteAgentHostServiceImpl.ts` 第 283–284 行）用这次读到的结果做 upsert，再交给 `storeSSHRemoteAgentHostEntries` 整表写回。一次成功的 SSH 连接就会把读丢的主机从存储里抹掉，后面无法再从原 JSON 恢复。
- 方向：读失败时保留原存储；写回时只跳过坏条目，不要用空结果覆盖整表。

## r03-2 中

- 症状：重连之后，本地仍显示已审阅的变更集文件，服务端没有收到这次审阅，整页刷新后标记消失。
- 位置：`src/vs/platform/agentHost/common/state/agentSubscription.ts` 第 1135–1178 行
- 引用：

```1135:1142:src/vs/platform/agentHost/common/state/agentSubscription.ts
	getPendingActions(): IPendingDispatchAction[] {
		const out: IPendingDispatchAction[] = [];
		for (const { sub } of this._subscriptions.values()) {
			if (sub instanceof SessionStateSubscription || sub instanceof ChatStateSubscription || sub instanceof AnnotationsStateSubscription) {
				out.push(...sub.getPendingActions());
			}
		}
		return out;
	}
```

- 为什么是问题：`ChangesetStateSubscription`（同文件第 635–722 行）会把客户端审阅动作放进 `_pendingActions` 并叠到乐观状态上，但没有 `getPendingActions` / `clearPending`。管理器在重连重放、丢掉已回显序号、快照前清空 pending 时只处理会话、聊天和批注。`AgentHostProtocolClient._drainAfterReconnect` 只重发 `getPendingActions()` 的结果，所以断线期间没被服务端回显的审阅动作不会再发出。快照落上之后 `_onSnapshotApplied` 仍会把这些 pending 重新叠回去，界面继续显示已审阅。
- 方向：重连重放、丢弃已回显条目和快照清空都要覆盖变更集订阅，并补上对应的 pending 导出与清空。

## r03-3 中

- 症状：服务端拒绝的变更集审阅或批注删除，会出现在其他客户端的已确认状态里；批注会从界面上消失。
- 位置：`src/vs/platform/agentHost/common/state/agentSubscription.ts` 第 679–693 行
- 引用：

```679:693:src/vs/platform/agentHost/common/state/agentSubscription.ts
	protected override _reconcile(envelope: ActionEnvelope, isOwnAction: boolean): void {
		if (isOwnAction && envelope.origin) {
			const index = this._pendingActions.findIndex(pending => pending.clientSeq === envelope.origin!.clientSeq);
			if (index !== -1) {
				if (!envelope.rejectionReason) {
					this._confirmedApply(envelope.action);
				}
				this._pendingActions.splice(index, 1);
			} else {
				this._confirmedApply(envelope.action);
			}
		} else {
			this._confirmedApply(envelope.action);
		}
		this._recomputeOptimistic();
	}
```

- 为什么是问题：同文件会话订阅（第 319–336 行）写明拒绝信封不能改确认状态，否则广播拒绝会漏进非发起方。变更集在找不到本地 pending，以及动作来自其他客户端时，仍然调用 `_confirmedApply`，`rejectionReason` 不起作用。批注订阅第 790–804 行是同一结构。被拒绝的 `AnnotationsRemoved` 会从其他窗口的确认状态里删掉批注；被拒绝的审阅切换会把文件显示成已审阅。
- 方向：与会话、聊天订阅一样，带 `rejectionReason` 的信封只撤回发起方匹配的乐观动作，不写入确认状态。

## r03-4 中

- 症状：云沙箱会话停在半截回合上，传输仍显示开着，也没有错误。
- 位置：`src/vs/platform/agentHost/browser/webPubSubRelayTransport.ts` 第 261–298 行
- 引用：

```284:298:src/vs/platform/agentHost/browser/webPubSubRelayTransport.ts
	send(message: ProtocolMessage | AhpServerNotification | JsonRpcNotification | JsonRpcResponse | JsonRpcRequest): void {
		if (this._closed || !this._ws) {
			throw new Error('WebPubSubRelayTransport is closed');
		}
		// Logged before chunking, so the transcript carries whole AHP messages rather than the
		// relay frames they were split into.
		this._options.ahpLogger?.log(message, 'c2s', getAhpLogByteLength(JSON.stringify(message)));
		const frames = buildPublish({
			group: this._options.toHostGroup,
			nextAckId: () => ++this._ackId,
			payload: message,
		});
		for (const frame of frames) {
			this._sendRaw(frame);
		}
	}
```

- 为什么是问题：`send` 为每帧申请了 ack id，但没有登记。`_ingestGroupFrame`（第 261–273 行）只在 `result.kind === 'payload'` 时上抛，`success: false` 的 ack 被丢掉。请求因此等不到 JSON-RPC 响应，传输也不关闭，上面的重连不会开始。
- 方向：记下 publish ack，收到失败 ack 时关闭传输，让现有重连把未完成请求失败掉。

## r03-5 中

- 症状：隧道重连还没连上时，原来可用的中继已经被关掉；失败后当前会话断开。
- 位置：`src/vs/platform/agentHost/common/tunnelAgentHostConnector.ts` 第 267–274 行
- 引用：

```267:274:src/vs/platform/agentHost/common/tunnelAgentHostConnector.ts
	async connect(token: string, authProvider: 'github' | 'microsoft', tunnelId: string, clusterId: string): Promise<ITunnelConnectResult> {
		this.closeTunnelConnections(tunnelId, 'reconnecting');
		this._logService.info(`${LOG_PREFIX} Connecting to tunnel ${tunnelId} in cluster ${clusterId}...`);

		const session = await this._relayClientFactory.getTunnel(tunnelId, clusterId, authProvider, token);
		if (!session) {
			throw new TunnelNotFoundError(tunnelId);
		}
```

- 为什么是问题：`closeTunnelConnections` 在 `getTunnel` 之前就把该隧道上现有 relay 拆掉。隧道找不到、令牌失效或后续转发端口失败时，函数抛错，旧连接已经不在 `_connections` 里。用户侧看到的是一次失败的重试把正在用的会话拆掉了。
- 方向：新中继建立成功并登记之后，再关闭同一隧道上的旧连接。
