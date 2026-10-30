---
title: "十六路审查 r11：conversation 发现"
type: reference
status: draft
phase: N/A
updated: 2026-10-30
summary: "只读审查 contrib/conversation 的连接偏好、名册、MCP、记忆、插件、规则、工具、模型与发送路径，记录 5 条可证实问题。"
---

# 十六路审查 r11：conversation 发现
状态：草案。
覆盖需求：无（正文未引用需求编号）。


范围是 `src/vs/workbench/contrib/conversation` 的当前文件。下面 5 条都来自这次读到的活码。

### r11-1

- 严重度：高
- 症状：对已保存的 `host:port` 直连档再点连接时，旧档会先被忘掉；若该档正是当前连接，引擎会先断开。随后的新建若失败，或这段等待里又点了一次连接，已保存的直连档没有了，当前连接也回不来。
- 代码：`src/vs/workbench/contrib/conversation/browser/connectionPreferencesPane.ts` 1665–1672 与 1684–1701；门禁在 1159–1164，`connectInFlight` 在 1868 才置上。

```1665:1672:src/vs/workbench/contrib/conversation/browser/connectionPreferencesPane.ts
		const ensured = await this.ensureDirectAddressProfileForConnect(host, port, displayName, allowPrivateNetwork);
		if (!ensured.ok) {
			writeStatus(this.directAddressStatus, ensured.reason, 'error');
			return;
		}

		this.activeProfileId = ensured.profileId;
		await this.connectProfileWithPairing(ensured.profileId, { skipEngineSwitchConfirm: true });
```

```1684:1701:src/vs/workbench/contrib/conversation/browser/connectionPreferencesPane.ts
		for (const match of matches) {
			const forgot = await this.hubService.forgetConnectionProfile(match.profileId);
			if (!forgot.ok) {
				return forgot;
			}
			if (match.profileId === this.connectedProfileId) {
				try {
					await this.connectionService.disconnect();
				} catch (error) {
					const reason = error instanceof Error && error.message ? error.message : String(error);
					return { ok: false, reason };
				}
				if (this.connectedProfileId === match.profileId) {
					this.connectedProfileId = undefined;
				}
			}
		}
		return this.hubService.addDirectAddressProfile({ host, port, displayName, allowPrivateNetwork });
```

```1159:1164:src/vs/workbench/contrib/conversation/browser/connectionPreferencesPane.ts
	private isConnectWriteHeld(): boolean {
		return this.connectInFlight
			|| this.engineSwitchPromptOpen
			|| this.isDeviceWritePairingHold()
			|| this.isPairingConfirmHostLive();
	}
```

```1868:1869:src/vs/workbench/contrib/conversation/browser/connectionPreferencesPane.ts
		this.connectInFlight = true;
		this.updateConnectGates();
```

- 为什么是问题：忘掉和断开发生在新档创建之前。`addDirectAddressProfile` 失败会直接把错误写到状态行并返回，被忘掉的档不会恢复。等待期间连接按钮仍可点，第二次进入会再忘掉同一批档。
- 方向：先建成新档并确认可以连接，再忘掉旧档；这段等待要占住连接写入。

### r11-2

- 严重度：中
- 症状：引擎已经列出多个会话后，只要当前会话的视图租约绑定失败，名册会被清空，界面改成「绑定失败」占位，其余已列出的会话也不能再选。
- 代码：`src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts` 2018–2020、1859–1882、216–230。

```2018:2020:src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts
		this.listCompleted = false;
		this.engineSessionBindFailed = false;
		this.engineBoundSessionIds.clear();
```

```1871:1882:src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts
		if (ok) {
			this.engineBoundSessionIds.add(sessionId);
			this.queueBoundLease = lease;
			this.syncQueueReader();
			return;
		}
		if (this.engineBoundSessionIds.size > 0) {
			return;
		}
		this.markEngineSessionBindFailed();
		this._onDidChangeSession.fire(this.getActiveSessionId());
		this.persistEngineAwareRoster();
```

```223:227:src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts
		this.engineSessionBindFailed = true;
		this.engineSessions = [];
		this.engineBoundSessionIds.clear();
		const previous = this.activeEngineSessionId;
		this.activeEngineSessionId = ENGINE_BIND_FAILED_SESSION_ID;
```

- 为什么是问题：目录刷新一开始就把 `engineBoundSessionIds` 清掉，随后只监视当前会话。这次列表里的其他会话还没绑定，`size > 0` 挡不住。绑定失败会把刚列出来的 `engineSessions` 整表丢掉。列表失败的分支在仍有行时不会走这个清空；绑定监视这条会走。
- 方向：单个租约绑定失败时保留已经列出的会话，只标记当前会话不可用。

### r11-3

- 严重度：中
- 症状：连续切换模型时，若前一次 `switchModel` 被后一次盖掉且没有成功，后一次也失败，作曲器会停在那次被拒绝的模型上，下一条消息按这个选项发送。
- 代码：`src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts` 1423–1431、1235–1252、1267–1271；发送侧 `conversationLensComposer.ts` 438。

```1423:1431:src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts
	epoch.generation++;
	epoch.targetIndex = modelIndex;
	epoch.targetModelId = modelId;
	epoch.rollbackIndex = previous;
	epoch.rollbackId = previousId;
	if (host.getBoundSessionId() === sessionId) {
		host.modelSelectedIndex = modelIndex;
		host.modelSelectBox.select(modelIndex);
		updateSendEnabled(host);
	}
```

```1235:1252:src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts
			if (epoch.generation !== sentGeneration) {
				if (!epoch.targetModelId) {
					return;
				}
				// Pairing-hold cannot take a correcting write. Keep the accepted model,
				// not the newer target that was never sent.
				if (!isComposerSessionWriteLive(host)) {
					if (result.resolvedModelId.trim()) {
						epoch.rollbackIndex = sentIndex;
						epoch.rollbackId = sentModelId;
						epoch.confirmedIndex = sentIndex;
						epoch.confirmedId = sentModelId;
						ensureSessionModelProfileIds(host).set(sessionId, sentModelId);
					}
					restoreSessionModelIndex(host, sessionId, epoch.confirmedIndex, epoch.confirmedId);
					return;
				}
				continue;
			}
```

```1267:1271:src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts
			if (!result.resolvedModelId.trim()) {
				restoreSessionModelIndex(host, sessionId, epoch.rollbackIndex, epoch.rollbackId);
				if (host.getBoundSessionId() === sessionId) {
					showGateNotice(host, conversationLensDockModelFailed);
				}
```

`submitDraft` 使用 `host.catalogModelIds?.[host.modelSelectedIndex]`。`restoreSessionModelIndex` 会把回滚到的 id 写进会话模型表。

- 为什么是问题：第二次点击时，`previous` 已经是第一次的乐观选中项，`rollbackIndex` 被改成这次尚未被引擎接受的模型。过期结果在连接仍可写时直接 `continue`，不把回滚点放回上次真正接受的模型。后一次失败就按这个被盖掉的乐观值恢复。抛错分支同样在代数不一致时 `continue`，最后也恢复 `rollbackIndex`。
- 方向：失败时回到引擎上次接受的模型；过期的成功结果先记下接受值，再发送更新的目标。

### r11-4

- 严重度：中
- 症状：编辑模型时把等级留空，对话框写明会保留当前等级，实际保存会把等级写成 0。
- 代码：`src/vs/workbench/contrib/conversation/browser/engineProviderModelSection.ts` 1136、801–811、1165–1169。

```1131:1136:src/vs/workbench/contrib/conversation/browser/engineProviderModelSection.ts
		const result = await this.dialogService.input({
			type: 'question',
			message: model
				? localize('ua.engineModelEditTitle', "Edit model")
				: localize('ua.engineModelAddTitle', "Add model"),
			detail: localize('ua.engineModelDialogDetail', "Level is optional, from 1 to 9. Leave it blank to keep the current level. A blank description, cost, or speed keeps the current value. On add, a blank description, cost, or speed is saved as empty. Changing the provider or model id saves a new registry id and removes the previous row."),
```

```801:811:src/vs/workbench/contrib/conversation/browser/engineProviderModelSection.ts
	const levelText = (values[3] ?? '').trim();
	let level = 0;
	if (levelText) {
		const parsed = Number(levelText);
		if (!Number.isInteger(parsed) || parsed < 1 || parsed > 9) {
			return { ok: false, reason: 'level', message: '' };
		}
		level = parsed;
	}
	// Description, cost, and speed follow level. They are not validated.
	return { ok: true, provider, modelId, type, level };
```

```1165:1169:src/vs/workbench/contrib/conversation/browser/engineProviderModelSection.ts
			await this.connection.upsertModel({
				id,
				type,
				enabled: model?.enabled ?? true,
				level,
```

同一函数里，空白的描述、费用和速度会走 `resolveModelDialogText` 保留原值。等级没有这条分支。

- 为什么是问题：校验允许等级留空。留空时 `parseModelDialog` 固定得到 `0`，`upsertModel` 把这个 `0` 写进注册表，已有的 1–9 等级被覆盖。
- 方向：编辑时等级留空沿用该模型现有等级，新增时才使用默认值。

### r11-5

- 严重度：中
- 症状：删除 MCP 服务器的请求已经返回后，如果期间改选了另一台服务器，成功或失败都不再刷新列表。引擎上已删除的服务器仍留在列表里。
- 代码：`src/vs/workbench/contrib/conversation/browser/engineMcpSection.ts` 554–557、850–868。

```554:557:src/vs/workbench/contrib/conversation/browser/engineMcpSection.ts
	private setSelectedServer(server: UniverseAgentMcpServerSummary | undefined): void {
		if (server?.id !== this.selectedServer?.id) {
			this._removeServerGeneration++;
		}
```

```850:868:src/vs/workbench/contrib/conversation/browser/engineMcpSection.ts
		const generation = ++this._removeServerGeneration;
		const serverId = this.selectedServer.id;
		const link = this.captureWriteLink();
		if (!link) {
			return false;
		}
		const scope = this.selectedServer.origin === 'project' ? 'project' : 'global';
		try {
			const workDir = sessionWorkDir(this.sessionContext);
			const result = await this.connection.removeMcpServer(workDir ? {
				serverId,
				scope,
				workDir,
			} : {
				serverId,
				scope,
			});
			if (generation !== this._removeServerGeneration || !this.sameWriteLink(link) || this.selectedServer?.id !== serverId) {
				return false;
			}
```

- 为什么是问题：改选会增加 `_removeServerGeneration`。返回后的检查在读取 `result.ok` 之前就退出，因此不会 `refresh()`，也不会显示写入失败。删除已经在引擎上生效时，列表仍画出这台服务器。
- 方向：选择变化只取消针对旧行的成功文案；删除请求已经结束时仍按结果刷新列表。

## 打开过的文件

- `src/vs/workbench/contrib/conversation/browser/connectionPreferencesPane.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationLensComposer.ts`
- `src/vs/workbench/contrib/conversation/browser/engineProviderModelSection.ts`
- `src/vs/workbench/contrib/conversation/browser/engineMcpSection.ts`
- `src/vs/workbench/contrib/conversation/browser/engineMemorySection.ts`
- `src/vs/workbench/contrib/conversation/browser/engineRulesSection.ts`
- `src/vs/workbench/contrib/conversation/browser/engineToolsSection.ts`
- `src/vs/workbench/contrib/conversation/browser/enginePluginsSection.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationRosterStorage.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationEngineFrameSource.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationComposerCatalog.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationStubService.ts`
- `src/vs/workbench/contrib/conversation/browser/conversationStubFrameSource.ts`
- `src/vs/workbench/contrib/conversation/browser/connectionDeviceList.ts`
- `src/vs/workbench/contrib/conversation/browser/connectionDevicePair.ts`
- `src/vs/workbench/contrib/conversation/browser/engineMcpSection.test.ts`
- `src/vs/workbench/contrib/conversation/test/browser/conversationEngineRosterService.test.ts`
- `src/vs/workbench/contrib/conversation/test/browser/engineProviderModelSection.test.ts`
