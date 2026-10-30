---
title: "十六路审查 r16：入口与其余扩展发现"
type: reference
status: draft
phase: N/A
updated: 2026-10-30
summary: "抽查入口与 git、GitHub、微软登录扩展后，确认 5 条可复现的会话覆盖、权限和 argv 损坏问题。"
---

# 十六路审查 r16：入口与其余扩展发现
状态：草案。
覆盖需求：无（正文未引用需求编号）。


范围是 `src/vs/code`、`src/vs/server`、`src` 根目录的 `*.ts`，以及 `extensions` 里除 copilot 以外的若干扩展。没有读完每一处，只打开了入口、凭据落盘和进程相关函数。下面 5 条都来自这次读到的代码。

### r16-1

严重度：高

症状：重叠的 GitHub 登录或注销里，后完成的那次会整表覆盖钥匙串。先写进去的新令牌会消失，或者刚注销的会话又被写回去。

```793:801:extensions/github-authentication/src/github.ts
			const sessions = await this.copyPersistedSessionsForWrite();
			const sessionIndex = sessions.findIndex(s => s.account.id === session.account.id && arrayEquals([...s.scopes].sort(), sortedScopes));
			const removed = new Array<vscode.AuthenticationSession>();
			if (sessionIndex > -1) {
				removed.push(...sessions.splice(sessionIndex, 1, session));
			} else {
				sessions.push(session);
			}
			await this.storeSessions(sessions);
```

```725:734:extensions/github-authentication/src/github.ts
	private async storeSessions(sessions: vscode.AuthenticationSession[]): Promise<void> {
		const unverified = this._unverifiedSessionData ?? [];
		const records = unverified.length ? [...sessions, ...unverified] : sessions;
		this._logger.info(`Storing ${records.length} sessions...`);
		await this._keychain.setToken(JSON.stringify(records));
		this._persistedSessionsPromise = Promise.resolve(sessions);
```

`removeSession` 同样先 `copyPersistedSessionsForWrite`，再 `storeSessions`（约 939–946 行）。`copyPersistedSessionsForWrite` 只在取出那一瞬间确认 `_persistedSessionsPromise` 没被换成另一次读取。取出之后到 `setToken` 返回之前，另一次登录或注销可以基于同一份旧数组再写一遍。后完成的 `setToken` 整表替换钥匙串，没有和当前列表对账。

方向：把读改写放进不会交错的队列，写入前再读一次当前会话。

### r16-2

严重度：中

症状：另一个窗口从秘密存储里去掉某个 Microsoft 客户端后，这个窗口仍留着对应的 Public Client，并且会在下次保存时把那个 clientId 写回去。用户在另一窗口的删除被撤销，账号仍可继续使用。

```206:212:extensions/microsoft-authentication/src/node/publicClientCache.ts
		const pcaKeysFromStorage = new Set(result);
		// Handle the deleted ones
		for (const pcaKey of this._pcas.keys()) {
			if (!pcaKeysFromStorage.delete(pcaKey)) {
				this._logger.debug(`[_handleSecretStorageChange] PCA was deleted in another window: ${pcaKey}`);
			}
		}
```

```230:232:extensions/microsoft-authentication/src/node/publicClientCache.ts
	private _storePublicClientApplications() {
		return this._pcasSecretStorage.store(Array.from(this._pcas.keys()));
	}
```

循环只打日志，不 `dispose`，也不从 `_pcas` 删除。存储被整表清空时（197–201 行）会清掉内存；只少一个 id 时不会。之后 `getOrCreate` 在缓存未命中时会调用 `_storePublicClientApplications`，把仍然留在 `_pcas` 里的已删除 id 写回秘密存储。

方向：发现存储里已经没有的 clientId 时，从 `_pcas` 移除并释放，再保存。

### r16-3

严重度：中

症状：`argv.json` 以 CRLF 结尾、且还没有 `enable-crash-reporter` 时，第一次补写崩溃报告字段会把文件写成非法 JSON。原有参数和新字段都留在这份无法解析的文件里。

```1872:1886:src/vs/code/electron-main/app.ts
			if (argvJSON['enable-crash-reporter'] === undefined) {
				const additionalArgvContent = [
					'',
					'	// Allows to disable crash reporting.',
					'	// Should restart the app if the value is changed.',
					`	"enable-crash-reporter": ${enableCrashReporter},`,
					'',
					'	// Unique id used for correlating crash reports sent from this instance.',
					'	// Do not edit this value.',
					`	"crash-reporter-id": "${generateUuid()}"`,
					'}'
				];
				const newArgvString = argvString.substring(0, argvString.length - 2).concat(',\n', additionalArgvContent.join('\n'));

				await this.fileService.writeFile(this.environmentMainService.argvResource, VSBuffer.fromString(newArgvString));
```

结尾是 `}\n` 时，删掉最后两个字符刚好去掉闭合括号。结尾是 `}\r\n` 时，最后两个字符是 `\r\n`，闭合括号还在，后面又拼上逗号和新的 `}`。`writeFile` 不检查结果是不是 JSON。

方向：按括号结构插入字段，不要按固定的最后两个字符裁切。

### r16-4

严重度：中

症状：能连上 Git IPC 套接字的本机进程可以调用 askpass，并在 HTTP 响应里拿到用户输入的口令或凭据提供方返回的口令。套接字创建后没有收成仅所有者可连。

```20:24:extensions/git/src/ipc/ipcServer.ts
	if (process.platform !== 'darwin' && process.env['XDG_RUNTIME_DIR']) {
		return path.join(process.env['XDG_RUNTIME_DIR'] as string, `vscode-git-${id}.sock`);
	}

	return path.join(os.tmpdir(), `vscode-git-${id}.sock`);
```

```52:56:extensions/git/src/ipc/ipcServer.ts
		try {
			server.on('error', err => e(err));
			server.listen(ipcHandlePath);
			c(new IPCServer(server, ipcHandlePath));
```

```83:102:extensions/git/src/ipc/ipcServer.ts
	private onRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
		if (!req.url) {
			console.warn(`Request lacks url`);
			return;
		}

		const handler = this.handlers.get(req.url);

		if (!handler) {
			console.warn(`IPC handler for ${req.url} not found`);
			return;
		}

		const chunks: Buffer[] = [];
		req.on('data', d => chunks.push(d));
		req.on('end', () => {
			const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
			handler.handle(request).then(result => {
				res.writeHead(200);
				res.end(JSON.stringify(result));
```

```82:86:extensions/git/src/askpass.ts
		if (cached && password) {
			this.cache.delete(authority);
			clearTimeout(this.cacheEvictionTimers.get(authority));
			this.cacheEvictionTimers.delete(authority);
			return cached.password;
```

`listen` 之后没有 `chmod`。macOS 以及没有 `XDG_RUNTIME_DIR` 时，路径在临时目录。有 `storagePath` 时套接字名是该路径的哈希前缀（`createIPCServer` 35–42 行，`extensions/git/src/main.ts` 第 70 行传入 `context.storagePath`），同一工作区是稳定路径。请求没有对端校验，处理函数把口令当结果返回。设置了 `XDG_RUNTIME_DIR` 的非 macOS 桌面通常靠该目录权限挡住其他用户；套接字落在共享临时目录时，umask 留下的组写或更宽权限就足以让其他本地用户连上。

方向：套接字监听成功后把权限收成仅当前用户，并拒绝没有该权限的连接。

### r16-5

严重度：中

症状：连续允许两个 Microsoft 账号时，后一次写入的允许列表可以按旧的内存数组计算，把前一个账号的 `homeAccountId` 盖掉。经纪登录随后用这份列表过滤账号，被盖掉的账号不再视为已允许。

```58:76:extensions/microsoft-authentication/src/common/accountAccess.ts
	async setAllowedAccess(account: AccountInfo, allowed: boolean): Promise<void> {
		if (allowed) {
			if (this.value.includes(account.homeAccountId)) {
				return;
			}
			await this._accountAccessSecretStorage.store([...this.value, account.homeAccountId]);
			return;
		}
		await this._accountAccessSecretStorage.store(this.value.filter(id => id !== account.homeAccountId));
	}

	private async update() {
		const current = new Set(this.value);
		const value = await this._accountAccessSecretStorage.get();

		this.value = value ?? [];
```

`setAllowedAccess` 不改 `this.value`，只根据当时的数组去 `store`。新值要等 `update` 再次 `get` 之后才进内存，而 `setAllowedAccess` 不等待 `update`。两次调用若在这次赋值之前重叠，第二次用的仍是旧数组，后一次 `store` 整表覆盖秘密存储。

方向：在同一条串行队列里读改写，写入使用的列表以刚写成功的内容为准。

## 实际打开的文件

- `src/vs/code/node/cli.ts`
- `src/vs/code/electron-main/app.ts`
- `src/vs/server/node/server.main.ts`
- `src/vs/server/node/serverConnectionToken.ts`
- `src/vs/server/node/webClientServer.ts`
- `src/vs/server/node/remoteExtensionHostAgentServer.ts`
- `src/vs/server/node/remoteExtensionHostAgentServerRequest.ts`
- `src/vs/server/node/extensionHostConnection.ts`
- `src/vs/server/node/remoteTerminalChannel.ts`
- `extensions/git/src/ipc/ipcServer.ts`
- `extensions/git/src/ipc/ipcClient.ts`
- `extensions/git/src/askpass.ts`
- `extensions/git/src/askpass-main.ts`
- `extensions/git/src/main.ts`
- `extensions/github-authentication/src/github.ts`
- `extensions/github-authentication/src/node/authServer.ts`
- `extensions/github-authentication/src/common/keychain.ts`
- `extensions/microsoft-authentication/src/node/publicClientCache.ts`
- `extensions/microsoft-authentication/src/common/accountAccess.ts`
