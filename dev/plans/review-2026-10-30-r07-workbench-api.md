---
title: "十六路审查 r07：workbench api 发现"
type: reference
status: draft
phase: N/A
updated: 2026-10-30
summary: "抽样 workbench api 的扩展主机边界、命令、文档、权限与销毁，证实 5 条。"
---
# 十六路审查 r07：workbench api 发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。


抽样范围是 `src/vs/workbench/api` 下的扩展主机边界、命令、文档、权限、销毁和被吞掉的错误。下面 5 条都来自本次读到的源码。

### r07-1

- 严重度：高
- 症状：动态认证的 URL Handler 流程会收下任意同路径回调里的授权码，并拿本次登录的 `code_verifier` 去换 token。注释写了用 nonce 防 CSRF，回调侧没有核对。

```680:682:src/vs/workbench/api/common/extHostAuthentication.ts
		// Generate a random state value to prevent CSRF
		const nonce = this.generateRandomString(32);
		const callbackUri = URI.parse(`${this._initData.environment.appUriScheme}://dynamicauthprovider/${this.authorizationServer.authority}/authorize?nonce=${nonce}`);
```

```694:694:src/vs/workbench/api/common/extHostAuthentication.ts
		authorizationUrl.searchParams.append('state', state.toString());
```

```711:711:src/vs/workbench/api/common/extHostAuthentication.ts
		const promise = this.waitForAuthorizationCode(callbackUri);
```

```765:775:src/vs/workbench/api/common/extHostAuthentication.ts
	private async waitForAuthorizationCode(expectedState: URI): Promise<{ code: string }> {
		const result = await this._proxy.$waitForUriHandler(expectedState);
		// Extract the code parameter directly from the query string. NOTE, URLSearchParams does not work here because
		// it will decode the query string and we need to keep it encoded.
		const codeMatch = /[?&]code=([^&]+)/.exec(result.query || '');
		if (!codeMatch || codeMatch.length < 2) {
			// No code parameter found in the query string
			throw new Error('Authentication failed: No authorization code received');
		}
		return { code: codeMatch[1] };
	}
```

```301:312:src/vs/workbench/api/browser/mainThreadAuthentication.ts
	async $waitForUriHandler(expectedUri: UriComponents): Promise<UriComponents> {
		const deferredPromise = new DeferredPromise<UriComponents>();
		const disposable = this.urlService.registerHandler({
			handleURL: async (uri: URI) => {
				if (uri.scheme !== expectedUri.scheme || uri.authority !== expectedUri.authority || uri.path !== expectedUri.path) {
					return false;
				}
				deferredPromise.complete(uri);
				disposable.dispose();
				return true;
			}
		});
```

本地非远程的 Node 扩展宿主会先走 loopback，那边在 `loopbackServer.ts` 里比较了 `state`。URL Handler 仍是远程环境的主流程，也是 loopback 失败后的下一条（`node/extHostAuthentication.ts` 把 loopback `unshift` 到 `_createFlows` 前面）。这条流程把 nonce 放在 query 里，主线程只比较 scheme、authority、path，扩展宿主只从 query 里抠 `code`。同一路径上带上攻击者自己的 `code` 就会被换进当前客户端。

- 方向：回调到达时核对 `state` 或 nonce，不一致就拒绝并注销 handler。

### r07-2

- 严重度：中
- 症状：访问令牌进入到期前 5 分钟的刷新窗口后，刷新请求一旦抛错，这份仍可能有效的令牌会从会话和持久化存储里删掉，用户需要重新登录。

```561:580:src/vs/workbench/api/common/extHostAuthentication.ts
					if (now > token.created_at + expiresInMS - (5 * 60 * 1000)) {
						this._logger.info(`Token for session ${session.id} is about to expire, refreshing...`);
						removedTokens.push(token);
						if (!token.refresh_token) {
							// No refresh token available, cannot refresh
							this._logger.warn(`No refresh token available for scopes ${session.scopes.join(' ')}. Throwing away token.`);
							continue;
						}
						try {
							const newToken = await this.exchangeRefreshTokenForToken(token.refresh_token, options.silent !== true);
							// TODO@TylerLeonhardt: When the core scope handling doesn't care about order, this check should be
							// updated to not care about order
							if (newToken.scope !== scopeStr) {
								this._logger.warn(`Token scopes '${newToken.scope}' do not match requested scopes '${scopeStr}'. Overwriting token with what was requested...`);
								newToken.scope = scopeStr;
							}
							this._logger.info(`Successfully created a new token for scopes ${session.scopes.join(' ')}.`);
							newTokens.push(newToken);
						} catch (err) {
							this._logger.error(`Failed to refresh token: ${err}`);
```

```586:587:src/vs/workbench/api/common/extHostAuthentication.ts
			if (newTokens.length || removedTokens.length) {
				this._tokenStore.update({ added: newTokens, removed: removedTokens });
```

`removedTokens.push` 发生在 `try` 之前。`exchangeRefreshTokenForToken` 在网络失败或响应无法解析时会抛错（同文件 `exchangeRefreshTokenForToken`）。`catch` 只打日志，没有把原 token 放回 `newTokens`。随后 `TokenStore.update` 会删掉它并调用 `_persistence.set`。一次瞬时失败就会清掉尚未过期的会话。

- 方向：刷新抛错时保留原 token，只在明确的永久失败里删除。

### r07-3

- 严重度：中
- 症状：等待 OAuth 回调的 URL handler 在超时，或调用方已经不再等待之后，仍然注册着。之后同路径 URI 仍被它接受并返回 true，授权码进入已经没人等待的 Promise。

```313:317:src/vs/workbench/api/browser/mainThreadAuthentication.ts
		const result = await raceTimeout(deferredPromise.p, 5 * 60 * 1000); // 5 minutes
		if (!result) {
			throw new Error('Timed out waiting for URI handler');
		}
		return await deferredPromise.p;
```

超时分支没有 `disposable.dispose()`。`handleURL` 在匹配后返回 `true`。`$waitForUriHandler` 也没有取消参数。URL Handler 流程用 `raceCancellationError` 结束等待（`extHostAuthentication.ts` 第 727 行）时，主线程上的 handler 继续挂着。loopback 流程是 `void this._proxy.$waitForUriHandler(appUri)`（`node/extHostAuthentication.ts` 第 133 行），`finally` 里只 `server.stop()`，不结束这个 handler。匹配又不看 query，后一次同 scheme、authority、path 的回调仍会进旧 handler。

- 方向：超时、取消和流程结束时注销该 handler。

### r07-4

- 严重度：中
- 症状：`onWillSaveTextDocument` 的工作区编辑没有应用时，扩展宿主仍向主线程报告成功，保存继续，这次保存里就不会有这些编辑。

```170:171:src/vs/workbench/api/common/extHostDocumentSaveParticipant.ts
			if (version === document.version) {
				return this._mainThreadBulkEdits.$tryApplyWorkspaceEdit(new SerializableObjectWithBuffers(dto));
```

```82:84:src/vs/workbench/api/common/extHostDocumentSaveParticipant.ts
		return this._deliverEventAsync(extension, listener, thisArg, stubEvent).then(() => {
			// don't send result across the wire
			return true;
```

```33:36:src/vs/workbench/api/browser/mainThreadBulkEdits.ts
		return this._bulkEditService.apply(edits, { undoRedoGroupId, respectAutoSaveConfig: isRefactoring }).then((res) => res.isApplied, err => {
			this._logService.warn(`IGNORING workspace edit: ${err}`);
			return false;
		});
```

```39:42:src/vs/workbench/api/browser/mainThreadSaveParticipant.ts
			this._proxy.$participateInSave(editorModel.resource, context.reason).then(values => {
				if (!values.every(success => success)) {
					return Promise.reject(new Error('listener failed'));
				}
```

`$tryApplyWorkspaceEdit` 在应用失败或抛错时解析为 `false`。扩展宿主的 `then` 丢掉这个布尔值，固定返回 `true`。主线程只在结果里出现 `false` 时才拒绝保存。编辑被丢掉，保存仍按成功参与继续。

- 方向：应用结果为 false 时向主线程返回失败。

### r07-5

- 严重度：中
- 症状：保存参与在主线程等待 1750ms 后被放弃，扩展宿主仍按每个 listener 最多 1500ms 继续跑，并在主线程已经拒绝之后把编辑应用到文档上。

```35:39:src/vs/workbench/api/browser/mainThreadSaveParticipant.ts
			setTimeout(
				() => reject(new Error(localize('timeout.onWillSave', "Aborted onWillSaveTextDocument-event after 1750ms"))),
				1750
			);
			this._proxy.$participateInSave(editorModel.resource, context.reason).then(values => {
```

```31:31:src/vs/workbench/api/common/extHostDocumentSaveParticipant.ts
		private readonly _thresholds: { timeout: number; errors: number } = { timeout: 1500, errors: 3 }
```

```51:67:src/vs/workbench/api/common/extHostDocumentSaveParticipant.ts
	async $participateInSave(data: UriComponents, reason: SaveReason): Promise<boolean[]> {
		const resource = URI.revive(data);

		let didTimeout = false;
		const didTimeoutHandle = setTimeout(() => didTimeout = true, this._thresholds.timeout);

		const results: boolean[] = [];
		try {
			for (const listener of [...this._callbacks]) { // copy to prevent concurrent modifications
				if (didTimeout) {
					// timeout - no more listeners
					break;
				}
				const document = this._documents.getDocument(resource);

				const success = await this._deliverEventAsyncAndBlameBadListeners(listener, { document, reason: TextDocumentSaveReason.to(reason) });
				results.push(success);
```

`$participateInSave` 没有取消令牌。每个 listener 内部还有一次 1500ms 超时（同文件第 134 行），总时间可以超过 1750ms。主线程的 `setTimeout` 拒绝自己的 Promise 之后，扩展宿主的循环和 `$tryApplyWorkspaceEdit` 仍会执行。编辑会落在主线程已经放弃这次保存参与之后。

- 方向：把取消传到 `$participateInSave`，主线程放弃后停止后续 listener。

## 实际打开的文件

- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/browser/mainThreadAuthentication.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/common/extHostAuthentication.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/node/extHostAuthentication.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/node/loopbackServer.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/browser/mainThreadSaveParticipant.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/common/extHostDocumentSaveParticipant.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/browser/mainThreadBulkEdits.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/browser/mainThreadDocuments.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/common/extHostDocuments.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/common/extHostDocumentData.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/browser/mainThreadCommands.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/common/extHostCommands.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/browser/mainThreadSecretState.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/common/extHostSecrets.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/browser/mainThreadFileSystem.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/browser/mainThreadUrls.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/common/extHostUrls.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/common/extHost.api.impl.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/browser/mainThreadWebviews.ts`
- `/home/clarence/Projects/Agents/vscode/src/vs/workbench/api/node/extHostTask.ts`
