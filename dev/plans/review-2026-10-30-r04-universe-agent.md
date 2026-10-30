---
title: "十六路审查 r04：universeAgent 发现"
type: reference
status: draft
phase: N/A
updated: 2026-10-30
summary: "审查 universeAgent 连接、鉴权、地址与重连状态机，证实 4 条问题。"
---
# 十六路审查 r04：universeAgent 发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。


范围是 `src/vs/platform/universeAgent` 里连接、鉴权、地址/端口、重连和错误状态机的当前源码。下面 4 条都能在这次读到的行上对上。

### r04-1

**严重度：** 高

**症状：** 已经钉过证书的配置，在正式握手得到 `pairing_pending` 之后，会在新的配对仪式完成之前把 `trust` 持久化成 `null`。`startPairing` 失败，或这次拨号被更新的 epoch 作废时，旧锚不会写回去。下次解析只能走 `pairing_required`，不能再用原来的 pin。

**代码：**

```1148:1161:src/vs/platform/universeAgent/node/universeAgentConnectionService.ts
			if (handshake.kind === 'pairing_pending') {
				const cleared: ConnectionProfile = profile
					? { ...profile, trust: null, state: 'pairingPending' }
					: {
						profileId,
						displayName: profileId,
						target: { kind: 'directAddress', host: endpoint.resolvedIp, port: endpoint.port },
						trust: null,
						state: 'pairingPending',
						allowPrivateNetwork: false,
					};
				this._connectionProfileStore?.put(cleared);
				this._abandonCaptured(captured);
				return this._startProfilePairing(profileId, cleared, reconnect, epoch);
			}
```

```3261:3280:src/vs/platform/universeAgent/node/universeAgentConnectionService.ts
		} catch (error) {
			if (!this._canMutateDial(epoch) || this._liveConnectedPublished()) {
				return this._staleDial();
			}
			const reason = error instanceof Error ? error.message : String(error);
			this._pairingPending = false;
			this._connectionPhase = { kind: 'failed', code: 'transport_failed', reason };
			this._fireSnapshotChanged();
			return { ok: false, code: 'transport_failed', reason };
		}
		if (!this._canMutateDial(epoch) || this._liveConnectedPublished()) {
			return this._staleDial();
		}
		if (!startResult.ok) {
			const code = this._mapPairingFailureCode(startResult.code);
			this._pairingPending = false;
			this._connectionPhase = { kind: 'failed', code, reason: startResult.reason };
			this._fireSnapshotChanged();
			return { ok: false, code, reason: startResult.reason };
		}
```

```381:387:src/vs/platform/universeAgent/node/connectionResolver.ts
		if (!profile.trust && !forPairing) {
			return {
				ok: false,
				code: 'pairing_required',
				reason: 'direct address dial requires pairing orchestrator when trust is missing',
				allowRelayFallback: false,
			};
		}
```

**为什么是问题：** `put(cleared)` 发生在 `startPairing` 返回之前。后面的失败分支和 `dial superseded` 分支都只改阶段或直接返回，没有把原来的 `trust` 写回。配置上的证书锚就此丢失，后续直连不再按旧 pin 校验。

**方向：** 等 `startPairing` 进入可确认状态再持久化 `trust: null`；失败或拨号作废时写回清空前的 trust。

### r04-2

**严重度：** 中

**症状：** 一次配对拨号已经把 `_pairingPending` 设为 true 并在等 `startPairing` 时，若另一次 `connectProfile` 抬高了 epoch，这次配对以 `dial superseded` 返回，标志仍为 true。快照继续报配对中，但 `_pairingContextProfileId` 已被清掉，确认对不上；自动重连也因为这个标志不再排队。

**代码：**

```3246:3248:src/vs/platform/universeAgent/node/universeAgentConnectionService.ts
		this._pairingContextProfileId = profileId;
		this._pairingPending = true;
		this._cancelReconnectTimer();
```

```3262:3264:src/vs/platform/universeAgent/node/universeAgentConnectionService.ts
			if (!this._canMutateDial(epoch) || this._liveConnectedPublished()) {
				return this._staleDial();
			}
```

```3272:3273:src/vs/platform/universeAgent/node/universeAgentConnectionService.ts
		if (!this._canMutateDial(epoch) || this._liveConnectedPublished()) {
			return this._staleDial();
		}
```

```2966:2968:src/vs/platform/universeAgent/node/universeAgentConnectionService.ts
	private _bumpConnectEpoch(): void {
		this._connectEpoch++;
		this._pairingContextProfileId = undefined;
	}
```

```2552:2558:src/vs/platform/universeAgent/node/universeAgentConnectionService.ts
	private _canScheduleReconnect(): boolean {
		return !this._reconnectDisposed
			&& !this._userDisconnecting
			&& !this._userDialInFlight
			&& !this._pairingPending
			&& !!this._activeProfileId
			&& this._reconnectTimer === undefined;
	}
```

**为什么是问题：** 同一函数里，配对失败会把 `_pairingPending` 置回 false，作废返回不会。用户拨号只递增 epoch 并清掉配对上下文，不清这个标志。后一次拨号若在提交成功前失败，`_writeDialFailure` 也不清它。于是阶段已是失败，快照仍是 `pairingPending`，`confirmPairing` 因上下文为空直接拒绝，`_scheduleReconnect` 被 `_pairingPending` 挡住。

**方向：** 作废返回时若这次拨号曾置上 `_pairingPending`，应清掉该标志，或只在本 epoch 仍有效时保留它。

### r04-3

**严重度：** 中

**症状：** 对同一 Hub 先发起登出，在 `logoutHub` 尚未返回时又登录成功，登出收尾仍会 `clear` 掉刚写入的会话。用户会看到登录立刻失效，刷新令牌也被删掉。

**代码：**

```199:207:src/vs/platform/universeAgent/node/universeAgentHubService.ts
	async logout(): Promise<void> {
		this._directoryGeneration++;
		const hubBaseUrl = this._activeHubBaseUrl;
		if (hubBaseUrl) {
			const token = this._hubSessionStore.getAccessTokenForHub(hubBaseUrl, this._nowMs());
			if (token) {
				await logoutHub({ hubBaseUrl, accessToken: token }, this._http).catch(() => undefined);
			}
			await this._hubSessionStore.clear(hubBaseUrl);
		}
```

```190:193:src/vs/platform/universeAgent/node/universeAgentHubService.ts
		this._directoryGeneration++;
		this._activeHubBaseUrl = canonical;
		this._directoryAuthExpired = false;
		await this._hubSessionStore.applyAuthSession(canonical, result.session, this._nowMs(), result.refreshToken);
```

```315:319:src/vs/platform/universeAgent/node/hubSessionStore.ts
	async clear(hubBaseUrl: string): Promise<void> {
		const key = hubBaseUrlIdentityKey(hubBaseUrl);
		this.buckets.delete(key);
		this.applicationStorage.remove(secretStorageKey(hubBaseUrl), StorageScope.APPLICATION);
		this.bumpSessionGeneration(hubBaseUrl);
	}
```

**为什么是问题：** `clear` 不看调用前的会话代际。`logoutHub` 的 await 期间，同 Hub 的 `login` 可以已经 `applyAuthSession`。登出继续执行时无条件删掉当前桶和持久化的 refresh secret，把新登录一起清掉。

**方向：** `await logoutHub` 之后只在 Hub 会话代际仍是登出开始时的那一代才 `clear`。

### r04-4

**严重度：** 低

**症状：** 本地自动发现走无 token 的 skip-auth 时，某个 RPC 以 `DEADLINE_EXCEEDED` 失败后会安排下一次发现，但旧 gRPC 通道不关闭。新链接提交时直接盖住 `this._transport`，旧通道变成无法再关闭的连接。

**代码：**

```429:431:src/vs/platform/universeAgent/node/grpc/grpcTransport.ts
export function isTransportFailureCode(code: number): boolean {
	return code === GrpcStatusCode.UNAVAILABLE
		|| code === GrpcStatusCode.DEADLINE_EXCEEDED;
}
```

```1164:1174:src/vs/platform/universeAgent/node/grpc/grpcClient.ts
	private _reportLinkStatus(path: string, attachedToken: boolean, code: number): void {
		if (HANDSHAKE_STATUS_EXEMPT_PATHS.has(path)) {
			return;
		}
		if (code === GrpcStatusCode.UNAVAILABLE) {
			this._onDidObserveUnavailableEmitter.fire();
			return;
		}
		if (code === GrpcStatusCode.UNAUTHENTICATED && attachedToken) {
			this._onDidRejectSessionTokenEmitter.fire();
		}
	}
```

```2523:2534:src/vs/platform/universeAgent/node/universeAgentConnectionService.ts
	private _markTransportFailed(error: unknown): void {
		if (error instanceof UniverseAgentTransportError && isTransportFailureCode(error.code)) {
			this._transportState = 'failed';
			if (this._activeProfileId) {
				this._connectionPhase = { kind: 'connecting', reason: 'transport_lost' };
				this._scheduleReconnect();
			} else if (this._loopbackSkipAuth) {
				this._loopbackSkipAuth = false;
				this._sessionToken = undefined;
				this._connectionPhase = { kind: 'disconnected' };
				this._localEngineDiscoveryAttempt += 1;
				this._scheduleLocalEngineDiscovery(this._computeReconnectDelay(this._localEngineDiscoveryAttempt));
			} else if (this._connectionPhase.kind === 'connecting') {
```

```2673:2688:src/vs/platform/universeAgent/node/universeAgentConnectionService.ts
			this._applyConnectedCommit({
				epoch,
				transport,
				profileId: undefined,
				token: result.sessionToken ?? '',
				skipAuth: !result.sessionToken,
				workDir: result.workDir,
				methods: result.methods,
				capabilities,
				sessionList,
				gitWrite,
				conversationEntry,
				listFiles,
				saveSkill,
				path: 'loopback',
			});
```

```3125:3127:src/vs/platform/universeAgent/node/universeAgentConnectionService.ts
		this._transport = input.transport;
		this._sessionToken = input.token;
		this._loopbackSkipAuth = input.skipAuth;
```

**为什么是问题：** `UNAVAILABLE` 会先走链路收尾并 `close`。`DEADLINE_EXCEEDED` 也算传输失败，但拦截器不把它当成链路作废，skip-auth 分支只改状态并预约发现，不关闭当前通道。`_connectLocalSkipAuth` 成功时 `_applyConnectedCommit` 只替换 `this._transport`，没有 `close` 前一个客户端。

**方向：** 在 skip-auth 失败分支或提交新本地传输之前关闭仍被引用的旧通道。

## 打开过的文件

- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/universeAgentConnectionService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/connectionResolver.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/deviceAuthHandshake.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/pairingOrchestrator.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/localEngineDiscovery.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/universeAgentHubService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/hubSessionStore.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/hubAuthAccess.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/hub/hub-auth-client.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/hub/hub-relay-ticket-client.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/hub/host-normalize.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/grpc/grpcClient.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/grpc/grpcTransport.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/grpc/grpcHandshakeWire.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/universeAgentChannel.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/connectionProfileStore.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/clientIdentityStore.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/engineTrustStore.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/node/deviceGrant/observe-candidate-leaf.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/platform/universeAgent/electron-main/universeAgentMainService.ts`
