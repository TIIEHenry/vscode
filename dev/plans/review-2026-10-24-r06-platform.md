---
title: "审查 r06：platform"
type: reference
status: draft
phase: N/A
updated: 2026-10-24
summary: "5 条；策略文件读失败会卸掉已生效策略，MCP 拒绝名单认不出等价主机。"
---

## r06-1 高
- 症状：`policies.json` 还在，但解析失败、内容不是对象，或读取抛错时，已经生效的设备策略被整表清空，并通知监听方。
- 位置：`src/vs/platform/policy/common/filePolicyService.ts` 第 65–81 行
- 引用：
```65:81:src/vs/platform/policy/common/filePolicyService.ts
		} catch (error) {
			if ((<FileOperationError>error).fileOperationResult !== FileOperationResult.FILE_NOT_FOUND) {
				this.logService.error(`[FilePolicyService] Failed to read policies`, error);
			}
		}

		return policies;
	}

	private async refresh(): Promise<void> {
		const generation = ++this._refreshGeneration;
		const policies = await this.read();
		if (generation !== this._refreshGeneration || this._store.isDisposed) {
			return;
		}
		const diff = keysDiff(this.policies, policies);
		this.policies = policies;
```
- 为什么是问题：`read()` 先建空 Map，失败时原样返回。`refresh()` 用这份空表替换 `this.policies`。键diff非空就发 `onDidChange`。企业限制因此被卸掉，后续读取把“没有策略”当成当前事实。同目录的文件型 managed settings 在读失败时保留上一份。
- 方向：读失败时保留上一份已成功加载的策略，不要用空结果覆盖。

## r06-2 高
- 症状：带 `*` 的 MCP 允许/拒绝规则认不出与待匹配 URL 同一连接目标的主机，拒绝名单上的服务器会被判成允许。
- 位置：`src/vs/platform/mcp/common/allowedMcpServers.ts` 第 112–126 行
- 引用：
```112:126:src/vs/platform/mcp/common/allowedMcpServers.ts
function matchesUrlPattern(pattern: string, url: string): boolean {
	const destination = toNetworkDestinationUrl(url);
	if (destination === undefined) {
		return false;
	}
	if (!pattern.includes('*')) {
		const expected = toNetworkDestinationUrl(pattern);
		return expected !== undefined && expected.toLowerCase() === destination.toLowerCase();
	}
	const normalizedPattern = toNetworkDestinationPattern(pattern);
	if (normalizedPattern === undefined) {
		return false;
	}
	try {
		return new RegExp(buildUrlPatternRegexSource(normalizedPattern), 'i').test(destination);
```
- 为什么是问题：待匹配的 HTTP(S) URL 走 WHATWG（`toNetworkDestinationUrl`，第 135–145 行），通配符模式走手写解析（`toNetworkDestinationPattern`，第 147 行起），两边主机不是同一套事实。`http://[::ffff:127.0.0.1]/mcp` 的目的地是 `http://[::ffff:7f00:1]/mcp`，既匹配不上 `http://127.0.0.1/*`，也匹配不上按同一写法写的 `http://[::ffff:127.0.0.1]/*`，而这个地址连的就是 127.0.0.1。`https://evil.com%2e/mcp` 会被收成主机 `evil.com.`，匹配不上 `https://evil.com/*`。`checkMcpServerAllowed` 在拒绝名单未命中且没有允许名单时返回 Allowed。
- 方向：通配符模式和待匹配 URL 都先收成同一个连接身份（IPv4-mapped 还原、域名尾点归一、默认端口归一），再比较主机。不能直接 `new URL(pattern)`：authority 里的 `*` 会让 WHATWG 解析抛错，必须保留 wildcard-aware 的 authority / port 解析。

## r06-3 中
- 症状：渲染侧策略表在定义更新后留下服务端已经不再下发的旧值，继续按过期策略生效。
- 位置：`src/vs/platform/policy/common/policyIpc.ts` 第 74–78 行
- 引用：
```74:78:src/vs/platform/policy/common/policyIpc.ts
	protected async _updatePolicyDefinitions(policyDefinitions: IStringDictionary<PolicyDefinition>): Promise<void> {
		const result = await this.channel.call<{ [name: PolicyName]: PolicyValue }>('updatePolicyDefinitions', policyDefinitions);
		for (const name in result) {
			this.policies.set(name, result[name]);
		}
```
- 为什么是问题：服务端 `updatePolicyDefinitions` 返回的是当前仍有值的全集。客户端只 `set` 返回里的键，不删除本地有、返回里没有的键。策略被解除或重算后变成未设置时，窗口里仍保留启动快照或上一次写入的值。
- 方向：用服务端返回的全集替换本地策略表，返回里没有的键要删掉。

## r06-4 中
- 症状：卸载 MCP 服务器时，资源文件里没有 `servers` 就直接成功返回，内存里的安装记录和安装目录都还在。
- 位置：`src/vs/platform/mcp/common/mcpManagementService.ts` 第 498–511 行
- 引用：
```498:511:src/vs/platform/mcp/common/mcpManagementService.ts
	async uninstall(server: ILocalMcpServer, options?: Omit<UninstallOptions, 'mcpResource'>): Promise<void> {
		this.logService.trace('MCP Management Service: uninstall', server.name);
		this._onUninstallMcpServer.fire({ name: server.name, mcpResource: this.mcpResource });

		try {
			const currentServers = await this.mcpResourceScannerService.scanMcpServers(this.mcpResource, this.target);
			if (!currentServers.servers) {
				return;
			}
			await this.mcpResourceScannerService.removeMcpServers([server.name], this.mcpResource, this.target);
			if (server.location) {
				await this.fileService.del(URI.revive(server.location), { recursive: true });
			}
			await this.updateLocal();
```
- 为什么是问题：扫描对文件不存在会返回 `{}`（`mcpResourceScannerService.ts` 第 106–128 行），`servers` 为空。这里的 `return` 不抛错，因此调用方得到成功；它跳过 `server.location` 的递归删除，也不调用 `updateLocal()`。`getInstalled()` 仍返回该服务器，安装目录仍留在磁盘上。
- 方向：文件里没有 servers 时仍要删掉安装目录并刷新内存列表，不能把提前 return 当成卸载完成。

## r06-5 中
- 症状：MCP 网关把工具参数和完整响应正文写进无法关掉的日志。
- 位置：`src/vs/platform/mcp/node/mcpGatewaySession.ts` 第 232 行
- 引用：
```232:232:src/vs/platform/mcp/node/mcpGatewaySession.ts
		this._logService.debug(`[McpGateway][session ${this.id}] Calling tool '${params.name}' with args: ${JSON.stringify(argumentsValue)}`);
```
- 为什么是问题：这条会话日志用的是网关 logger。`mcpGatewayService.ts` 第 45 行以 `logLevel: 'always'` 创建它，`AbstractMessageLogger` 因此放行全部级别。同一次调用的响应正文在 `mcpGatewayService.ts` 第 513 行、会话响应在 `mcpGatewaySession.ts` 第 105 行，同样以 debug 整段写入。工具参数和资源内容里的令牌、密钥会落进日志文件。
- 方向：网关日志不要强制 Trace，也不要把工具参数和响应正文写入日志。
