---
title: "审查 r04：platform"
type: reference
status: draft
phase: N/A
updated: 2026-10-11
summary: "4 条；设置文件读失败会被当成空设置，远端未变时把删除同步到云端。"
---
# 审查 r04：platform

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r04-1 高

- 症状：`settings.json` 一旦读失败，设置同步就把它当成 `{}`。上次同步内容与远端一致时，合并认定本地删掉了全部非忽略设置，且没有冲突，随后把这份空设置写回远端。
- 位置：`src/vs/platform/userDataSync/common/abstractSynchronizer.ts` 第 809–814 行；`src/vs/platform/userDataSync/common/settingsSync.ts` 第 100–108 行、第 243–250 行
- 引用：

```809:814:src/vs/platform/userDataSync/common/abstractSynchronizer.ts
	protected async getLocalFileContent(): Promise<IFileContent | null> {
		try {
			return await this.fileService.readFile(this.file);
		} catch (error) {
			return null;
		}
	}
```

```100:108:src/vs/platform/userDataSync/common/settingsSync.ts
		if (remoteSettingsSyncContent) {
			let localContent: string = fileContent ? fileContent.value.toString().trim() : '{}';
			localContent = localContent || '{}';
			this.validateContent(localContent);
			this.logService.trace(`${this.syncResourceLogLabel}: Merging remote settings with local settings...`);
			const result = merge(localContent, remoteSettingsSyncContent.settings, lastSettingsSyncContent ? lastSettingsSyncContent.settings : null, ignoredSettings, [], formattingOptions);
			mergedContent = result.localContent || result.remoteContent;
			hasLocalChanged = result.localContent !== null;
			hasRemoteChanged = result.remoteContent !== null;
```

```115:117:src/vs/platform/userDataSync/common/settingsMerge.ts
	/* local has changed and remote has not */
	if (localForwarded && !remoteForwarded) {
		return { conflictsSettings: [], localContent: null, remoteContent: localContentWithoutIgnoredSettings, hasConflicts: false };
```

```243:250:src/vs/platform/userDataSync/common/settingsSync.ts
		if (remoteChange !== Change.None) {
			const formatUtils = await this.getFormattingOptions();
			// Update ignored settings from remote
			const remoteSettingsSyncContent = this.getSettingsSyncContent(remoteUserData);
			const ignoredSettings = await this.getIgnoredSettings(content);
			content = updateIgnoredSettings(content, remoteSettingsSyncContent ? remoteSettingsSyncContent.settings : '{}', ignoredSettings, formatUtils);
			this.logService.trace(`${this.syncResourceLogLabel}: Updating remote settings...`);
			remoteUserData = await this.updateRemoteUserData(JSON.stringify(this.toSettingsSyncContent(content)), force ? null : remoteUserData.ref);
```

- 为什么是问题：`getLocalFileContent` 吞掉每一次读错误，文件不存在和权限、过大、IO 失败都变成 `null`。`generateSyncPreview` 把 `null` 换成 `'{}'`。远端等于上次同步内容时，`merge` 看到本地相对基线变了、远端没变，于是 `hasConflicts` 为假、`remoteContent` 为去掉非忽略项之后的空对象。预览无冲突会被自动接受，`applyResult` 在 `remoteChange !== Change.None` 时调用 `updateRemoteUserData`。同一空内容也进入 `hasRemoteChanged`（第 156–161 行），会把这次失败读当成本地变更并触发同步。本地文件这次可以不写，云端副本先被删掉。
- 方向：只有确认文件不存在时才按空设置合并，其它读错误应中止这次同步。

## r04-2 中

- 症状：一次发送被接受后，返回给调用方的 correlation 对不上同一帧里「正在发送」行的 `send:` id。
- 位置：`src/vs/platform/universeAgent/node/sessionViewHost.ts` 第 477–486 行；`src/vs/platform/universeAgent/node/sessionCore/session-core.ts` 第 112–115 行、第 162 行
- 引用：

```477:486:src/vs/platform/universeAgent/node/sessionViewHost.ts
		const fact = writeMessageToCoreFact(msg, binding.leaseId, this.ids.nextWriteId() as unknown as CorrelationRef);
		this.postingLeaseId = msg.kind === 'submitInput' ? String(binding.leaseId) : undefined;
		let outcome: PostOutcome;
		try {
			outcome = this.postAndDrain(binding.sessionId as SessionId, { t: 'localFact', fact });
		} finally {
			this.postingLeaseId = undefined;
		}
		if (outcome.accepted) {
			return { accepted: true as const, correlation: { id: String(outcome.correlation) } };
```

```112:115:src/vs/platform/universeAgent/node/sessionCore/session-core.ts
	const nextCorrelation = (): CorrelationRef => {
		correlationSeq += 1
		return `c:${correlationSeq}` as CorrelationRef
	}
```

```162:162:src/vs/platform/universeAgent/node/sessionCore/session-core.ts
			return { accepted: true, correlation: nextCorrelation() }
```

```122:123:src/vs/platform/universeAgent/node/sessionCore/local-pending-sends.ts
	return {
		operationId: String(correlation) as OperationId,
```

```2207:2208:src/vs/platform/universeAgent/node/sessionViewHost.ts
		case 'upsertLocalSend':
			return `send:${String(patch.send.operationId)}`;
```

- 为什么是问题：`submitInput` 先用 `IdPort.nextWriteId()` 生成 `write:N`，写进 fact 的 `correlation`。Actor 用这个值做 `upsertLocalSend` 的 `operationId`，帧变更 id 是 `send:write:N`。`core.post` 接受时另发一个与 fact 无关的 `c:N`，host 把这个 `c:N` 当作接受结果返回，`UniverseAgentSessionViewService.post` 再把该结果交给调用方。返回的 id 不会出现在这次提交的发送行上。
- 方向：接受结果应返回写进 fact、并成为 `operationId` 的那个 correlation。

## r04-3 中

- 症状：再次添加同一 Hub 设备时，会把另一个账号或已经撤销、停用的 profile 当成添加成功返回，不会为当前账号新建待配对记录。
- 位置：`src/vs/platform/universeAgent/node/universeAgentHubService.ts` 第 456–468 行
- 引用：

```456:468:src/vs/platform/universeAgent/node/universeAgentHubService.ts
		const accountId = this._hubSessionStore.getAccountIdForHub(hubBaseUrl, this._nowMs());
		if (!accountId) {
			return { ok: false, code: 'hub_session_required', reason: 'hub account id unavailable' };
		}
		const activeKey = hubBaseUrlIdentityKey(hubBaseUrl);
		const existing = this._connectionProfileStore.list().find(profile =>
			profile.target.kind === 'hubDevice'
			&& hubBaseUrlIdentityKey(profile.target.hubBaseUrl) === activeKey
			&& profile.target.hubDeviceId === hubDeviceId
		);
		if (existing) {
			return { ok: true, profileId: existing.profileId };
		}
```

- 为什么是问题：当前 `accountId` 已经取到，后面新建草稿也会把它写入 `target`。查找却只比较 Hub URL 和 `hubDeviceId`，不比较 `accountId`，也不看 `state`。`revoked` 与 `disabled` 同样直接 `{ ok: true }`。`_markHubDeviceProfilesRevoked` 用同一组 URL 加设备键把记录标成 `revoked`，因此这条旧记录会挡住当前账号重新添加。
- 方向：按当前 `accountId` 匹配；已撤销或停用的记录不要当作添加成功。

## r04-4 低

- 症状：SAS 确认在签名器不可用或创建签名器抛错时，已经建好的传输不会关闭。
- 位置：`src/vs/platform/universeAgent/node/pairingOrchestrator.ts` 第 375–387 行；关闭位于第 447–448 行
- 引用：

```375:387:src/vs/platform/universeAgent/node/pairingOrchestrator.ts
		const transport = this.deps.createPinnedTransport({
			endpoint: formalEndpoint,
			tls: tlsPlanFromTrust(candidateTrust),
		});

		const signer = await this.deps.clientIdentityStore.createSigner();
		if (!this.isCurrentConfirmSas(context, generation)) {
			transport.close();
			return staleConfirmSas();
		}
		if (!signer) {
			return { ok: false, code: 'signer_unavailable', reason: 'device auth signer unavailable' };
		}
```

```447:448:src/vs/platform/universeAgent/node/pairingOrchestrator.ts
		} finally {
			transport.close();
```

- 为什么是问题：`transport` 在 `try` 之前创建。代际过期会 `close`，签名器为空则直接返回，进不了第 447 行的 `finally`。`createSigner()` 抛错同样在 `try` 之外，传输留在调用栈外面。
- 方向：创建传输后立刻进入 `try/finally`，失败返回也要 `close`。
