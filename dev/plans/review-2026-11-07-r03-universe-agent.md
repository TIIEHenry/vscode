---
title: "十六路审查 2026-11-07 r03：universeAgent 平台层发现"
type: reference
status: draft
phase: N/A
updated: 2026-11-07
summary: "复核 universeAgent 在 2026-10-30 之后的改动与 11-07 最新提交，证实 1 条：会话视图帧订阅不核对租约所属窗口。"
---

# 十六路审查 2026-11-07 r03：universeAgent 平台层发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。

本次以 2026-10-30 之后的改动为主。逐段读了 11-07 提交「平台层会话信息归属、迟到回复匹配与本机引擎身份」涉及的 `overlayDeltaJoin.ts`、`sessionStreamDemux.ts` 的 orderKey 补零、`SessionViewHost` 的断线广播与 fail-closed 恢复、会话视图 IPC 通道、本机自动连接取引擎身份，以及 `getSessionInfo` 的 owner 参数位；另看了 11-01 到 11-05 的 PTY 通道归属校验、创建恢复按连接归属分域、catalog 与 Memory 写入口的 owner 门、Agent profile 内容校验，以及 Hub 服务、Hub 会话存储和配对编排器的相关路径。共 1 条。核过但不报的有三处。第一，完成事件之后到达的纯工具调用信封会取消 2 秒兜底并保留 overlay，这是 `overlayDeltaJoin.test.ts` 514–538 行锁住的合同，`subscription-stream-and-message-card-fixes.md` 的 S1 也明确要求命中暂存信封时不再起计时。第二，本机自动连接不兼容未实现 `GetAuthNonce` 的旧引擎，协议面文档已经声明。第三，Hub 控制面变更与启动恢复在 await 之后写登录过期标记时不核对当前 Hub，但要在那一两个网络往返之内完成另一次登录才会触发，窗口过窄。

### r03-1

- 严重度：中
- 症状：某个窗口只要拿 `attempt:N` 订阅 `onDynamicDidApplyFrame`，就能收到另一个窗口所领租约的全部会话帧，包括时间线、overlay 正文和待办动作。如果它比持有窗口先订上，宿主为这条租约缓冲的首帧 baseline 只会发给它，持有窗口随后订阅时拿不到这批缓冲帧。
- 代码：`src/vs/platform/universeAgent/electron-main/universeAgentSessionViewChannel.ts` 80–82 行（`listen` 不读 `ctx`）；同文件 42–46 行注释与 53–58 行（`call` 把 `ctx` 当 owner 交给每个命令）；`src/vs/platform/universeAgent/electron-main/universeAgentSessionViewService.ts` 36–38 行（原样转给宿主）；`src/vs/platform/universeAgent/node/sessionViewHost.ts` 372–374 行（只按 leaseId 取 emitter）、376–378 行（租约 id 来自 `nextAttemptId`）、1382–1402 行（首个监听者触发缓冲 flush 并清空）；`src/vs/platform/universeAgent/node/sessionViewHostPorts.ts` 55–66 行（`attempt:` 递增序号）。

```80:82:src/vs/platform/universeAgent/electron-main/universeAgentSessionViewChannel.ts
	listen<T>(_ctx: string, event: string, arg?: any): Event<T> {
		if (event === 'onDynamicDidApplyFrame') {
			return Event.map(this.service.onDynamicDidApplyFrame(String(arg ?? '')), frameEvent => {
```

```53:58:src/vs/platform/universeAgent/electron-main/universeAgentSessionViewChannel.ts
	call<T>(ctx: string, command: string, arg?: any, _cancellationToken?: CancellationToken): Promise<T> {
		const owner = String(ctx);
		const args = Array.isArray(arg) ? arg.map(value => revive(value)) : [];
		if (command === 'acquireLease') {
			return this.service.acquireLeaseFor(owner, String(args[0] ?? '')) as Promise<T>;
		}
```

```372:378:src/vs/platform/universeAgent/node/sessionViewHost.ts
	onDynamicDidApplyFrame(leaseId: string): Event<IUniverseAgentSessionViewFrameEvent> {
		return this.leases.get(leaseId)?.emitter.event ?? Event.None;
	}

	acquireLease(sessionId: string, owner?: string): string {
		this.failClosedSessions.delete(sessionId);
		const leaseId = this.ids.nextAttemptId() as unknown as ViewLeaseId;
```

```1382:1402:src/vs/platform/universeAgent/node/sessionViewHost.ts
		const emitter = new Emitter<IUniverseAgentSessionViewFrameEvent>({
			onDidAddFirstListener: () => {
				binding.hadSubscriber = true;
				if (binding.orphanTimer !== undefined) {
					clearTimeout(binding.orphanTimer);
					binding.orphanTimer = undefined;
				}
				queueMicrotask(() => {
					if (binding.needsBaseline) {
						binding.needsBaseline = false;
						pending.length = 0;
						this.requestResync(String(leaseId));
						return;
					}
					for (const queued of pending) {
						emitter.fire(queued);
					}
					pending.length = 0;
				});
			},
		});
```

```55:66:src/vs/platform/universeAgent/node/sessionViewHostPorts.ts
export function createSessionViewIdPort(seed = 0): IdPort {
	let n = seed;
	const next = (prefix: string): string => {
		n += 1;
		return `${prefix}${n}`;
	};
	return {
		nextChunkId: () => next('chunk:') as TextChunkId,
		nextEffectId: () => next('effect:') as EffectId,
		nextAttemptId: () => next('attempt:') as AttemptId,
		nextWriteId: () => next('write:') as ChatWriteId,
	};
```

- 为什么是问题：`acquireLease` 把 IPC 连接上下文（`window:${id}`）记成租约 owner；`releaseLease`、`post`、`requestResync`、`acknowledge`、`requestDetail` 都把同一个 `ctx` 带进宿主，由 `leaseOwnerMismatch` 拒绝别的窗口，这是 bug-hunt 03 的 BH-03-4 修好的。帧订阅这一路没有跟上。渲染端经 ProxyChannel 调 `onDynamicDidApplyFrame(leaseId)` 时，`ipc.ts` 把它转成 `channel.listen(this.ctx, 'onDynamicDidApplyFrame', leaseId)`，但这里的 `listen` 丢掉 `ctx`，服务和宿主只按 leaseId 查 `this.leases`，查到就返回那条租约的 emitter。租约 id 由进程内计数器生成，形如 `attempt:N`，与流 attempt、写 id 共用同一个递增序号，可以逐个枚举。于是窗口 B 订阅窗口 A 的 `attempt:N` 之后，A 会话的每一帧都会同时发给 B。若 B 是第一个监听者，`onDidAddFirstListener` 会在微任务里把 `pending` 中的 baseline 与缓冲帧发给当时的监听者并清空，同时置 `hadSubscriber`、撤掉孤儿定时器；A 之后订阅时已不是首个监听者，不会再 flush，这批帧对 A 就丢了。bug-hunt 03 方案 S2 明确写了「`listen` 的 `onDynamicDidApplyFrame` 不在本切片」（`dev/plans/bug-hunt-2026-09-24/03-session-view-host.md` 93、105 行），之后没有登记为缺口，各轮审查稿也没有记过。触发需要某个窗口的渲染进程使用不是自己领取的 leaseId，现有渲染端代码不会这样做，所以与同类 BH-03-4 一样定为中。
- 方向：`listen` 把 `ctx` 一路传到宿主，租约 owner 已设置且与 `ctx` 不同时 `onDynamicDidApplyFrame` 返回 `Event.None`。

## 打开过的文件

- `src/vs/platform/universeAgent/node/overlayDeltaJoin.ts`
- `src/vs/platform/universeAgent/node/sessionStreamDemux.ts`
- `src/vs/platform/universeAgent/node/sessionViewHost.ts`
- `src/vs/platform/universeAgent/node/sessionViewHostHistoryFill.ts`
- `src/vs/platform/universeAgent/node/sessionViewHostPorts.ts`
- `src/vs/platform/universeAgent/node/sessionCreateRecover.ts`
- `src/vs/platform/universeAgent/node/fileMutationJoin.ts`
- `src/vs/platform/universeAgent/node/sessionCore/session-core.ts`
- `src/vs/platform/universeAgent/node/sessionCore/session-actor.ts`
- `src/vs/platform/universeAgent/node/sessionCore/session-actor-stream-fold.ts`
- `src/vs/platform/universeAgent/node/sessionCore/session-actor-overlay-fold.ts`
- `src/vs/platform/universeAgent/node/sessionCore/stream-event-to-view-patch.ts`
- `src/vs/platform/universeAgent/node/sessionCore/history-result-to-view-patch.ts`
- `src/vs/platform/universeAgent/node/universeAgentConnectionService.ts`
- `src/vs/platform/universeAgent/node/localEngineDiscovery.ts`
- `src/vs/platform/universeAgent/node/deviceAuthHandshake.ts`
- `src/vs/platform/universeAgent/node/deviceGrant/tls-pin.ts`
- `src/vs/platform/universeAgent/node/pinnedTlsChannel.ts`
- `src/vs/platform/universeAgent/node/pairingOrchestrator.ts`
- `src/vs/platform/universeAgent/node/universeAgentHubService.ts`
- `src/vs/platform/universeAgent/node/hubSessionStore.ts`
- `src/vs/platform/universeAgent/node/hubAuthAccess.ts`
- `src/vs/platform/universeAgent/node/grpc/grpcClientCalls.ts`
- `src/vs/platform/universeAgent/node/grpc/grpcClient.ts`
- `src/vs/platform/universeAgent/node/grpc/grpcSessionAttachWire.ts`
- `src/vs/platform/universeAgent/common/universeAgentConnectionIpcChannel.ts`
- `src/vs/platform/universeAgent/common/universeAgentConnectionChannelClient.ts`
- `src/vs/platform/universeAgent/common/universeAgentHubChannelClient.ts`
- `src/vs/platform/universeAgent/common/universeAgentExpectedOwner.ts`
- `src/vs/platform/universeAgent/common/universeAgentSessionView.ts`
- `src/vs/platform/universeAgent/common/universeAgentPty.ts`
- `src/vs/platform/universeAgent/common/universeAgentAgentProfileContent.ts`
- `src/vs/platform/universeAgent/common/sessionView/overlay-view-helpers.ts`
- `src/vs/platform/universeAgent/browser/universeAgentPtyService.ts`
- `src/vs/platform/universeAgent/electron-browser/universeAgentSessionViewService.ts`
- `src/vs/platform/universeAgent/electron-main/universeAgentSessionViewChannel.ts`
- `src/vs/platform/universeAgent/electron-main/universeAgentSessionViewService.ts`
- `src/vs/platform/universeAgent/electron-main/universeAgentSessionViewMainService.ts`
- `src/vs/platform/universeAgent/electron-main/universeAgentPtyChannel.ts`
- `src/vs/platform/universeAgent/test/node/overlayDeltaJoin.test.ts`
- `src/vs/platform/universeAgent/test/node/universeAgentSessionViewChannel.test.ts`
- `src/vs/base/parts/ipc/common/ipc.ts`（只读核对 ProxyChannel 动态事件与 `ChannelServer` 的 `listen` 传参）
