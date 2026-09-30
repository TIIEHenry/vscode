---
title: "审查 r04：entrypoint"
type: reference
status: draft
phase: N/A
updated: 2026-09-30
summary: "连接令牌、自动退出、许可证环境和监听地址有 5 处会在特定请求或启动条件下出错。"
---

# 发现

## r04-1 中
- 症状：浏览器里已经有有效连接令牌 cookie 时，再打开带单个错误 `tkn` 查询参数的工作台根路径，服务器仍返回 302，并把 cookie 改成这个错误值。随后同一浏览器访问干净 URL 会得到 403，直到用户再次带上正确令牌。其它站点的顶层跳转也会带上 `SameSite=lax` 的 cookie，因此一次指向 `/?tkn=任意值` 的导航就能把会话锁死。
- 位置：`src/vs/server/node/webClientServer.ts` 第 313–335 行
- 引用：

```313:335:src/vs/server/node/webClientServer.ts
		const queryConnectionTokens = parsedUrl.searchParams.getAll(connectionTokenQueryName);
		if (queryConnectionTokens.length === 1) {
			const queryConnectionToken = queryConnectionTokens[0];
			// We got a connection token as a query parameter.
			// We want to have a clean URL, so we strip it
			const responseHeaders: Record<string, string> = Object.create(null);
			responseHeaders['Set-Cookie'] = cookie.serialize(
				connectionTokenCookieName,
				queryConnectionToken,
				{
					sameSite: 'lax',
					maxAge: 60 * 60 * 24 * 7 /* 1 week */
				}
			);

			const newQuery = new URLSearchParams(parsedUrl.searchParams);
			newQuery.delete(connectionTokenQueryName);
			const queryString = newQuery.toString();
			const newLocation = queryString ? `${basePath}?${queryString}` : basePath;
			responseHeaders['Location'] = newLocation;

			res.writeHead(302, responseHeaders);
			return void res.end();
		}
```

- 为什么是问题：根路径处理只在查询串里恰好有一个 `tkn` 时就把该值写入 cookie，没有和服务器令牌比较。请求能否进入这里，由 `requestHasValidConnectionToken` 决定：查询令牌不匹配时仍会接受有效 cookie（`src/vs/server/node/serverConnectionToken.ts` 第 122–131 行）。于是“cookie 合法、查询令牌错误”的请求会通过鉴权，再把错误令牌写成新的 cookie。
- 方向：只有查询令牌与服务器令牌一致时才写入 cookie。

## r04-2 中
- 症状：服务器以 `--enable-remote-auto-shutdown` 启动后，不带连接令牌的 `GET /delay-shutdown` 仍返回 200。空闲倒计时会被重置；若退出已经开始，这次请求会把本次退出作废并重新排程。监听在非回环地址上时，网络上未持有令牌的客户端可以一直让进程不退出。CLI 拉起的服务器会带上该开关（`cli/src/tunnels/code_server.rs` 第 605–607 行，`cli/src/tunnels/agent_host.rs` 第 256–260 行）。
- 位置：`src/vs/server/node/remoteExtensionHostAgentServer.ts` 第 151–166 行
- 引用：

```151:166:src/vs/server/node/remoteExtensionHostAgentServer.ts
		if (pathname === '/version') {
			res.writeHead(200, { 'Content-Type': 'text/plain' });
			return void res.end(this._productService.commit || '');
		}

		// Delay shutdown
		if (pathname === '/delay-shutdown') {
			this._serverLifetimeService.delay();
			res.writeHead(200);
			return void res.end('OK');
		}

		if (!httpRequestHasValidConnectionToken(this._connectionToken, req, parsedUrl.searchParams)) {
			// invalid connection token
			return serveError(req, res, 403, `Forbidden.`);
		}
```

- 为什么是问题：令牌校验写在 `/delay-shutdown` 之后。`delay()` 会先把 `_shutdownGeneration` 加一；倒计时存在时清掉并重排，退出承诺已经存在时靠代数不一致在 `src/vs/server/node/serverLifetimeService.ts` 第 122–130 行与第 161–165 行中止 `process.exit`。自动退出只在 `--enable-remote-auto-shutdown` 时开启（`src/vs/server/node/serverServices.ts` 第 241–243 行）。
- 方向：把 `/delay-shutdown` 放到连接令牌校验之后。

## r04-3 中
- 症状：产品配置了非空 `serverLicense` 和 `serverLicensePrompt` 时，用环境变量非交互启动服务器不会被当成已接受条款。标准输入不是 TTY（systemd、容器）时，进程打印必须使用 `--accept-server-license-terms` 并以退出码 1 结束。命令行显式传入该开关则可以启动。
- 位置：`src/server-main.ts` 第 32–38 行、第 70–73 行
- 引用：

```32:38:src/server-main.ts
['host', 'port', 'accept-server-license-terms'].forEach(e => {
	if (!parsedArgs[e]) {
		const envValue = process.env[`VSCODE_SERVER_${e.toUpperCase().replace('-', '_')}`];
		if (envValue) {
			parsedArgs[e] = envValue;
		}
	}
});
```

```70:73:src/server-main.ts
		if (product.serverLicensePrompt && parsedArgs['accept-server-license-terms'] !== true) {
			if (hasStdinWithoutTty()) {
				console.log('To accept the license terms, start the server with --accept-server-license-terms');
				process.exit(1);
```

- 为什么是问题：`String.prototype.replace` 只替换第一次出现的 `-`，读到的变量名是 `VSCODE_SERVER_ACCEPT_SERVER-LICENSE-TERMS`，普通 shell 无法设置带连字符的变量，全下划线的 `VSCODE_SERVER_ACCEPT_SERVER_LICENSE_TERMS` 不会被读取。即便该键存在，赋给参数的是字符串，而接受判断要求严格等于布尔值 `true`，字符串 `"true"` 仍会走进退出分支。
- 方向：用全局替换生成变量名，并把 `"true"` 转成布尔值再和 `true` 比较。

## r04-4 中
- 症状：用 `--host` 绑到某一块非回环单播地址（例如 `192.168.1.5`）并且带有 Web 客户端时，日志里的 Web UI 地址固定写成 `http://localhost:<端口>`。本机打开该链接连不上，因为进程只监听指定地址。
- 位置：`src/vs/server/node/remoteExtensionHostAgentServer.ts` 第 741–744 行
- 引用：

```741:744:src/vs/server/node/remoteExtensionHostAgentServer.ts
	if (hasWebClient && address && typeof address !== 'string') {
		// ships the web ui!
		const queryPart = (connectionToken.type !== ServerConnectionTokenType.None ? `?${connectionTokenQueryName}=${connectionToken.value}` : '');
		console.log(`Web UI available at http://localhost${address.port === 80 ? '' : `:${address.port}`}${serverBasePath ?? ''}${queryPart}`);
```

- 为什么是问题：`src/server-main.ts` 第 113–117 行把 `--host` 原样交给 `server.listen`。Node 对具体单播地址只绑定该地址，`127.0.0.1` 上没有套接字。打印地址却写死 `localhost`，和实际监听地址不一致。
- 方向：打印时使用实际绑定地址；通配地址再回落到本机可连接的回环地址。

## r04-5 中
- 症状：agent host 桥接主机是 IPv6 字面量（例如 `--host ::1` 或 `--agent-host-bridge-host ::1`，且使用 TCP 端口）时，渲染进程侧的 agent host 代理在拨号时构造出 `ws://::1:<端口>`。该 URL 无效，上游 WebSocket 连接失败，工作台连不上这台 agent host。
- 位置：`src/vs/server/node/agentHostChannel.ts` 第 279–286 行
- 引用：

```279:286:src/vs/server/node/agentHostChannel.ts
	private _buildUrl(): string {
		const host = this._endpoint.host ?? 'localhost';
		const port = this._endpoint.port ?? '0';
		let url = `ws://${host}:${port}`;
		if (this._endpoint.connectionToken) {
			url += `?${connectionTokenQueryName}=${encodeURIComponent(this._endpoint.connectionToken)}`;
		}
		return url;
	}
```

- 为什么是问题：桥接主机来自 `src/vs/server/node/serverServices.ts` 第 293 行的 `args['agent-host-bridge-host'] ?? args.host`，没有加方括号。CLI 的 `dial_host`（`cli/src/commands/agent_host.rs` 第 921–925 行）会把 `::1` 原样交给桥接。IPv6 字面量放进 `ws://host:port` 后无法被 URL 解析，TCP 桥接（未走 `socketPath`）会在连接阶段失败。
- 方向：IPv6 字面量写入 WebSocket URL 时用方括号包起来。
