---
title: "审查 r16：extensions-entry"
type: reference
status: draft
phase: N/A
updated: 2026-10-24
summary: "3 条；回环登录校验失败会未捕获抛错且登录等待不结束，无账户会话在身份核对失败时仍被交出，Git IPC 注销删错路由键。"
---
# 审查 r16：extensions-entry

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r16-1 中
- 症状：GitHub 回环登录遇到不匹配的 nonce 时，错误页重定向发出后再次 `writeHead`，扩展宿主收到未捕获的 `ERR_HTTP_HEADERS_SENT`，这次登录的 Promise 继续挂起。
- 位置：`extensions/github-authentication/src/node/authServer.ts` 第 105–113 行
- 引用：
```105:113:extensions/github-authentication/src/node/authServer.ts
					const receivedNonce = (reqUrl.searchParams.get('nonce') ?? '').replace(/ /g, '+');
					if (receivedNonce !== this.nonce) {
						res.writeHead(302, { location: `/?error=${encodeURIComponent('Nonce does not match.')}${appNameQueryParam}` });
						res.end();
					}
					res.writeHead(302, { location: this._startingRedirect.toString() });
					res.end();
					break;
```
- 为什么是问题：nonce 不符时响应已经 `end()`。紧接着的第二次 `writeHead` 会抛 `ERR_HTTP_HEADERS_SENT`。这个异常出在 HTTP 回调里，到不了 `deferred.reject`，`waitForOAuthResponse` 因此一直不结束。同一段两次 `writeHead` 的行为是：客户端拿到的 Location 仍是错误页，进程同时出现 uncaught `ERR_HTTP_HEADERS_SENT`。`flows.ts` 第 363–365 行把这次等待和 5 分钟超时放在一起赛跑，登录进度会一直留到超时或用户取消。
- 方向：nonce 不符时结束这次响应，并让登录 Promise 失败。

## r16-2 中
- 症状：钥匙串里没有 `account` 的会话，向 GitHub 核对身份失败之后，仍作为账户 `<unknown>` 的已登录会话交出去。
- 位置：`extensions/github-authentication/src/github.ts` 第 640–679 行
- 引用：
```640:679:extensions/github-authentication/src/github.ts
			if (!session.account) {
				try {
					userInfo = await this._githubServer.getUserInfo(session.accessToken);
					this._logger.info(`Verified session with the following scopes: ${scopesStr}`);
				} catch (e) {
					if (e.message === 'Unauthorized') {
						return undefined;
					}
				}
			}

			this._logger.trace(`Read the following session from the keychain with the following scopes: ${scopesStr}`);
			scopesSeen.add(scopesStr);

			let accountId: string;
			if (session.account?.id) {
				if (typeof session.account.id === 'number') {
					seenNumberAccountId = true;
				}
				accountId = `${session.account.id}`;
			} else {
				accountId = userInfo?.id ?? '<unknown>';
			}
			const icon = session.account?.icon
				? vscode.Uri.from(session.account.icon)
				: userInfo?.avatarUrl ? vscode.Uri.parse(userInfo.avatarUrl) : undefined;
			return {
				id: session.id,
				account: {
					label: session.account
						? session.account.label ?? session.account.displayName ?? '<unknown>'
						: (userInfo?.accountName ?? '<unknown>'),
					id: accountId,
					icon,
				},
				scopes: session.scopes,
				accessToken: session.accessToken
			};
```
- 为什么是问题：`getUserInfo` 走到 `fetchUserInfo`。网络失败时抛出的是 `Error('network error')`（`extensions/github-authentication/src/common/gitHubAccount.ts` 第 40–43 行，`errors.ts` 第 10 行）；HTTP 非成功时抛出的是 `Error(json.message || statusText)`（同文件第 57–67 行）。上面只在消息恰好为 `Unauthorized` 时丢掉会话。其余失败会继续组装会话，账户 id 和标签都落成 `<unknown>`，原 access token 原样返回。`Promise.allSettled` 保留这条 fulfilled 结果。同一轮若另有会话被去掉，第 689–691 行还会把这份带 `<unknown>` 的列表写回钥匙串。
- 方向：身份核对失败时从本次结果里拿掉该会话，并避免把 `<unknown>` 账户写回钥匙串。只有服务端明确 401 才删除该条；网络、超时、5xx 或解析失败只从本次返回值排除，保留钥匙串原记录等下次核对。

## r16-3 低
- 症状：Git 的 askpass 与提交说明编辑器执行 dispose 后，IPC 路由仍指向它们。
- 位置：`extensions/git/src/ipc/ipcServer.ts` 第 78–80 行
- 引用：
```78:80:extensions/git/src/ipc/ipcServer.ts
	registerHandler(name: string, handler: IIPCHandler): Disposable {
		this.handlers.set(`/${name}`, handler);
		return toDisposable(() => this.handlers.delete(name));
```
- 为什么是问题：注册键是 `` `/${name}` ``，注销删的是不带斜杠的 `name`，表项还在。`Askpass.dispose` 与 `GitEditor.dispose` 释放的就是这个 disposable。`extensions/git/src/main.ts` 第 67–80 行创建了 IPC 服务器，并只把 askpass、git editor 放进 disposable，服务器对象本身不在其中。扩展停用后进程若还在，环回上的 `/askpass`、`/git-editor` 仍会进入已经 dispose 的对象。
- 方向：注销时删除注册所用的同一个键。
