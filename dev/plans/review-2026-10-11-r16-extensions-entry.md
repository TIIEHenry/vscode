---
title: "审查 r16：extensions-entry"
type: reference
status: draft
phase: N/A
updated: 2026-10-11
summary: "4 条；屏幕采集回调不核对请求方就把整屏交给调用者。"
---
# 审查 r16：extensions-entry

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r16-1 高
- 症状：网页或 webview 调用 `getDisplayMedia` 时，主进程不看请求来自哪个 frame，直接把一块屏幕画面交出去。
- 位置：`src/vs/code/electron-main/app.ts` 第 316–357 行
- 引用：

```316:319:src/vs/code/electron-main/app.ts
		session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
			try {
				const frame = request.frame;
				const win = frame ? BrowserWindow.getAllWindows().find(w => w.webContents.mainFrame === frame) : undefined;
```

```347:357:src/vs/code/electron-main/app.ts
				const chosen = match ?? cachedScreenSources[0];
				if (!chosen) {
					// No screen sources available (permission denied or transient failure).
					callback({});
					return;
				}
				callback({ video: chosen });
			} catch {
				callback({});
			}
		});
```

同一函数里，webview 允许的权限只有指针锁定、通知和剪贴板，核心窗口另加 `media` 与 `local-fonts`，两边都没有 `display-capture`（第 266–282 行）。屏幕采集不走那两份名单。`request.frame` 只用来猜离哪块显示器近；对不上主窗口（webview、子 frame，或根本没有 frame）时仍然用 `displays[0]`，只要系统能列出屏幕就 `callback({ video: chosen })`。
- 为什么是问题：这是越权。扩展 webview 和主窗口共用 `session.defaultSession`，页面里一次 `getDisplayMedia` 就能拿到整屏，没有系统选择器，也没有和上面权限名单对齐的拒绝。
- 方向：只有主窗口 frame 才授予屏幕源，其余请求 `callback({})`。

## r16-2 高
- 症状：用户只用 Microsoft 确认过一次 GitHub 身份之后，后续任意 scope 的 `getSessions` 会静默换出对应令牌。
- 位置：`extensions/github-authentication/src/github.ts` 第 304–370 行
- 引用：

```304:319:extensions/github-authentication/src/github.ts
	 * Nothing about scopes is remembered, because nothing needs to be: the exchange mints whatever
	 * it is asked for. So a restore asks for exactly what this caller wants, and a caller that wants
	 * no scopes in particular gets a session labelled with whatever GitHub grants.
	 */
	private async restore(
		scopes: readonly string[],
		account: vscode.AuthenticationSessionAccountInformation | undefined,
		already: readonly vscode.AuthenticationSession[]
	): Promise<vscode.AuthenticationSession[]> {
		// A row whose account already answered this request needs nothing minting for it. The check
		// is per account rather than across all of them, so one account having a session does not
		// keep a second linked account signed out.
		const missing = this._accountLinks.linkedAccounts().filter(link =>
			(!account || link.gitHubAccountLabel === account.label)
			&& !already.some(session => session.account.label === link.gitHubAccountLabel)
			&& !this._restoresTried.has(this.restoreKey(link, scopes)));
```

```365:368:extensions/github-authentication/src/github.ts
			renewed = await this._githubServer.renewWithMicrosoft({
				// No scopes means the caller did not care which, so neither do we.
				scopes: scopes.length ? scopes : undefined,
				gitHubAccountId: link.gitHubAccountId,
```

`getSessions` 在第 291 行把调用方传入的 scope 交给 `restore`。账户链接（`extensions/github-authentication/src/common/accountLinks.ts` 第 13–27 行）只记两边的标签和 GitHub 用户 id，不记当时同意的 scope。确认弹窗（`entraTokenExchange.ts` 第 354–362 行）也只展示 `@账号`。`renew` 自己写明 “Shows nothing at all”（`entraTokenExchange.ts` 第 223–247 行），然后按传入 scope 去换票。scope 为空时连 scope 参数都不带，会话标签用 GitHub 返回的授权范围。
- 为什么是问题：`getSessions` 本该只交回已经存在的会话。这里会造出新令牌并 `fire({ added })`。已有会话的 scope 列表只要不完全相同，就挡不住下一次换票，因此 `repo`、`workflow` 这类范围可以在没有再次确认的情况下发出去。
- 方向：`getSessions` 不要换票；新 scope 走带确认的 `createSession`，链接里记下已经同意的 scope。

## r16-3 中
- 症状：本机其他用户在能看见套接字的目录里连上 git IPC 后，可以取走刚缓存的 Git 密码，或让当前窗口打开任意文件。
- 位置：`extensions/git/src/ipc/ipcServer.ts` 第 15–56 行
- 引用：

```15:25:extensions/git/src/ipc/ipcServer.ts
function getIPCHandlePath(id: string): string {
	if (process.platform === 'win32') {
		return `\\\\.\\pipe\\vscode-git-${id}-sock`;
	}

	if (process.platform !== 'darwin' && process.env['XDG_RUNTIME_DIR']) {
		return path.join(process.env['XDG_RUNTIME_DIR'] as string, `vscode-git-${id}.sock`);
	}

	return path.join(os.tmpdir(), `vscode-git-${id}.sock`);
}
```

```52:56:extensions/git/src/ipc/ipcServer.ts
	return new Promise((c, e) => {
		try {
			server.on('error', err => e(err));
			server.listen(ipcHandlePath);
			c(new IPCServer(server, ipcHandlePath));
```

`listen` 之后没有 `chmod`。请求处理（第 83–101 行）不核对对端用户，路径对上就把 JSON 交给 handler。Askpass 在密码已缓存时直接返回（`extensions/git/src/askpass.ts` 第 81–86 行）。Git 编辑器则按请求里的路径 `workspace.openTextDocument`（`extensions/git/src/gitEditor.ts` 第 37–41 行）。没有 `XDG_RUNTIME_DIR` 时套接字落在 `os.tmpdir()`，目录可被其他用户列出。
- 为什么是问题：套接字名能从目录里看到。连上之后可以抢在真正的 git 进程之前把缓存的密码读走，或让用户在以为是自己的 Git 提问时把口令交出去。
- 方向：套接字建在仅本人可进入的目录里并收成 `0600`，处理请求前核对对端 uid。

## r16-4 中
- 症状：GitHub 登录把会话写入机密存储失败后，仍把内存里的列表当成已保存，并继续报登录成功。
- 位置：`extensions/github-authentication/src/github.ts` 第 696–700 行
- 引用：

```696:700:extensions/github-authentication/src/github.ts
	private async storeSessions(sessions: vscode.AuthenticationSession[]): Promise<void> {
		this._logger.info(`Storing ${sessions.length} sessions...`);
		this._persistedSessionsPromise = Promise.resolve(sessions);
		await this._keychain.setToken(JSON.stringify(sessions));
		this._logger.info(`Stored ${sessions.length} sessions!`);
	}
```

```16:22:extensions/github-authentication/src/common/keychain.ts
	async setToken(token: string): Promise<void> {
		try {
			return await this.context.secrets.store(this.serviceId, token);
		} catch (e) {
			// Ignore
			this.Logger.error(`Setting token failed: ${e}`);
		}
	}
```

`createSession` 在 `storeSessions` 返回后触发 `added` 并写 “Login success!”（第 766–770 行）。`setToken` 把存储失败吃掉，不向外抛。
- 为什么是问题：当前窗口按已登录继续用内存里的令牌，重启后密钥链仍是旧数据，这次登录丢失。之后任意一次 `secrets.onDidChange` 会走 `checkForUpdates`，用密钥链里的旧列表把刚加上的会话报成 removed。
- 方向：存储失败要抛出去，并且只有写入成功之后才替换 `_persistedSessionsPromise` 和对外宣布登录成功。
