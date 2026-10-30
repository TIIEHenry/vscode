---
title: "十六路审查 r12：产品贡献面发现"
type: reference
status: draft
phase: N/A
updated: 2026-10-30
summary: "抽样 navigator、sources、planning、语音、迁移、MCP、onboarding 与欢迎页，证实 3 条。"
---
# 十六路审查 r12：产品贡献面发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。


### r12-1

- 严重度：中
- 症状：在 TrustedOnNonce 的 MCP 信任对话框里取消（关闭对话框，而不是点 “Do not trust”），该服务器会被写成永久拒绝。默认 `promptType` 为 `only-new`，之后启动不再询问，重启后仍然拒绝。
- 代码：`src/vs/workbench/contrib/mcp/common/mcpRegistry.ts`

```361:361:src/vs/workbench/contrib/mcp/common/mcpRegistry.ts
			return result === undefined ? undefined : (result ? [def.definition.id] : []);
```

```275:284:src/vs/workbench/contrib/mcp/common/mcpRegistry.ts
			const didTrust = await this._promptForTrust(definition, collection, interaction, trustNonceBearer);
			if (didTrust) {
				return true;
			}
			if (didTrust === undefined) {
				return undefined;
			}

			trustNonceBearer.trustedAtNonce = notTrustedNonce;
			return false;
```

```311:317:src/vs/workbench/contrib/mcp/common/mcpRegistry.ts
		if (trustedDefinitionIds) {
			trustNonceBearer.trustedAtNonce = trustedDefinitionIds.includes(definition.id)
				? definition.cacheNonce
				: notTrustedNonce;
		}

		return !!trustedDefinitionIds?.includes(definition.id);
```

持久化：`src/vs/workbench/contrib/mcp/common/mcpServer.ts`

```166:172:src/vs/workbench/contrib/mcp/common/mcpServer.ts
		const storageKey = 'mcpToolCache';
		this._register(storageService.onWillSaveState(() => {
			if (this.didChange) {
				storageService.store(storageKey, {
					extensionServers: [...this.extensionServers],
					serverTools: this.cache.toJSON(),
```

```454:455:src/vs/workbench/contrib/mcp/common/mcpServer.ts
	public set trustedAtNonce(nonce: string | undefined) {
		this._primitiveCache.store(this.definition.id, { trustedAtNonce: nonce });
```

取消时对话框返回 `undefined`，`_promptForTrust` 在 `trustedDefinitionIds` 为空时不写 nonce，但返回值被收成布尔 `false`。`_checkTrust` 里 `didTrust === undefined` 因此走不到，紧接着把 `trustedAtNonce` 写成 `__vscode_not_trusted`。setter 写入 `mcpToolCache`，`onWillSaveState` 落到机器存储。下次 `only-new` 看到这个 nonce 就直接 `return false`（254–262 行）。
- 方向：取消保持原 nonce，只有明确拒绝才写入 `__vscode_not_trusted`。

### r12-2

- 严重度：中
- 症状：服务器在连接上发来 URL elicitation 时，用户点了打开链接之后，授权卡片不会在完成通知到达时收起，完成等待也不会结束。
- 代码：`src/vs/workbench/contrib/mcp/common/mcpServer.ts` 与 `src/vs/workbench/contrib/mcp/browser/mcpElicitationService.ts`

```855:857:src/vs/workbench/contrib/mcp/common/mcpServer.ts
					const r = await this._elicitationService.elicit(this, Iterable.first(this.runningToolCalls), req, token || CancellationToken.None);
					r.dispose();
					return r.value;
```

```148:163:src/vs/workbench/contrib/mcp/browser/mcpElicitationService.ts
		const completePromise = new Promise<void>((resolve, reject) => {
			promiseStore.add(token.onCancellationRequested(() => reject(new CancellationError())));
			promiseStore.add(autorun(reader => {
				const cnx = server.connection.read(reader);
				const handler = cnx?.handler.read(reader);
				if (handler) {
					reader.store.add(handler.onDidReceiveElicitationCompleteNotification(e => {
						if (e.params.elicitationId === elicitation.elicitationId) {
							resolve();
						}
					}));
```

```191:193:src/vs/workbench/contrib/mcp/browser/mcpElicitationService.ts
							const result = await this._doElicitUrl(elicitation, token);
							resolveOnce(result);
							completePromise.then(() => part.hide());
```

```221:226:src/vs/workbench/contrib/mcp/browser/mcpElicitationService.ts
		return {
			kind: ElicitationKind.URL,
			value,
			wait: completePromise,
			dispose: () => promiseStore.dispose(),
		};
```

完成通知的监听挂在 `promiseStore` 上，卡片 `hide()` 只挂在 `completePromise` 上。连接处理函数在把 `accept` 交回服务器之前就 `dispose()`，监听被拆掉，`completePromise` 不再 resolve。同一文件里工具错误路径是先 `await elicitResult.wait` 再 `dispose()`（1465–1469 行）。
- 方向：URL 模式先等 `wait` 结束再 `dispose()`。

### r12-3

- 严重度：低
- 症状：打开 MCP 资源并被监视后，监视结束或连接 handler 换代都不会退订，服务器侧 `resources/subscribe` 会累积。
- 代码：`src/vs/workbench/contrib/mcp/common/mcpResourceFilesystem.ts` 与 `src/vs/workbench/contrib/mcp/common/mcpServerRequestHandler.ts`

```132:145:src/vs/workbench/contrib/mcp/common/mcpResourceFilesystem.ts
			handler.subscribe({ uri: resourceURI.toString() }, token).then(
				() => {
					if (!token.isCancellationRequested) {
						watchListener.value = handler.onDidUpdateResource(e => {
							if (equalsUrlPath(e.params.uri, resourceURI)) {
								this._onDidChangeFile.fire([{ resource: uri, type: FileChangeType.UPDATED }]);
							}
						});
					}
				}, err => {
					handler.logger.warn(`Failed to subscribe to resource changes for ${resourceURI}: ${err}`);
					watchedOnHandler = undefined;
				},
			);
```

```489:490:src/vs/workbench/contrib/mcp/common/mcpServerRequestHandler.ts
	unsubscribe(params: MCP.UnsubscribeRequest['params'], token?: CancellationToken): Promise<MCP.EmptyResult> {
		return this.sendRequest<MCP.UnsubscribeRequest, MCP.EmptyResult>({ method: 'resources/unsubscribe', params }, token);
```

`watch` 返回的 `DisposableStore` 只取消进行中的 token、换掉本地 `onDidUpdateResource`。订阅成功之后 token 取消不会再发 `resources/unsubscribe`，handler 换成另一个时旧订阅同样留着。
- 方向：dispose 和换 handler 时对已成功的订阅调用 `unsubscribe`。

## 打开过的文件

- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/mcp/common/mcpRegistry.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/mcp/common/mcpServer.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/mcp/browser/mcpElicitationService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/mcp/common/mcpResourceFilesystem.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/mcp/common/mcpServerRequestHandler.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/mcp/common/mcpSandboxService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/mcp/common/mcpGatewayToolBrokerChannel.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/mcp/common/mcpRegistryInputStorage.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/mcp/common/mcpSamplingService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/mcp/browser/mcpMigration.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/navigator/browser/navigatorTeamList.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/navigator/browser/navigatorAgentsView.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/navigator/browser/navigatorProjectsList.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/navigator/browser/navigatorSessionLeaseHolder.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/sources/browser/sourcesReviewProgressService.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/planning/browser/planningTodoModel.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/agentsVoice/common/voiceTranscriptStore.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/universeAgentMigration/common/codeOssMigration.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/contrib/welcomeAgentSessions/browser/agentSessionsWelcome.ts`
