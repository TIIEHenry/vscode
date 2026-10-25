---
title: "方案 r06：platform"
type: plan
status: implemented
phase: N/A
updated: 2026-10-25
summary: "3 hold，2 weaken；读失败保留已生效策略，通配符与 URL 用同一目的地，定义更新按返回全集替换，卸载补删目录，网关不再记录参数和正文。"
---

## 核对

- r06-1 hold：`FilePolicyService.read` 失败仍返回空 Map，`refresh` 用它覆盖 `this.policies` 并在 diff 非空时发 `onDidChange`。
- r06-2 hold：带 `*` 的模式仍走 `toNetworkDestinationPattern`，待匹配 URL 走 WHATWG；同一写法的 IPv4-mapped 地址和 `%2e` 主机对不上，拒绝名单未命中且没有允许名单时 `checkMcpServerAllowed` 返回 Allowed。
- r06-3 weaken：`_updatePolicyDefinitions` 仍只 `set` 返回值里的键；已订阅的 `onDidChange` 在值为 null 时会删除，所以不是每一次解除都会留下旧值。
- r06-4 hold：`uninstall` 在 `scanMcpServers` 没有 `servers` 时直接 return，不删 `server.location`，也不 `updateLocal()`。
- r06-5 weaken：工具参数和响应正文仍以 debug 写入；`logLevel: 'always'` 把主进程 logger 钉在 Trace，全局级别改不动它，但该通道自己的级别可以关掉 debug。

## r06-1 hold

- 问题类：设备策略文件还在，但解析或读取失败时，已生效策略被空表替换。
- 不变量：`FilePolicyService` 持有最近一次成功读到的策略表。解析失败、内容不是对象，或其他非「文件不存在」的读取错误之后，这张表和已通知出去的值必须仍是上一份成功结果。
- 要动的符号或文件：`FilePolicyService.read`、`FilePolicyService.refresh`（`src/vs/platform/policy/common/filePolicyService.ts`）。失败结果要和空的成功结果分开。`refresh` 只有在这次读取成功时才替换 `this.policies` 并按 `keysDiff` 发 `onDidChange`。从未成功加载过时，表保持空。
- 不改：`FILE_NOT_FOUND` 仍表示没有策略文件，可以清空。`_refreshGeneration` 和 disposed 检查保留。`FileManagedSettingsService` 的保留逻辑不动。
- 本地验证：没有 `FilePolicyService` 测试。新增断言：成功加载后再遇到非法 JSON、JSON 数组、以及非 `FILE_NOT_FOUND` 的读取错误时，`getPolicyValue` 仍是上一份，且不发 `onDidChange`。

## r06-2 hold

- 问题类：带 `*` 的 MCP URL 规则和待匹配 URL 不是同一套主机事实，拒绝名单会漏。
- 不变量：允许/拒绝规则和待匹配 URL 由同一网络目的地比较。目的地相同的服务器，拒绝名单命中必须是 Denied，不能因为模式另解析主机而变成 Allowed。
- 要动的符号或文件：`matchesUrlPattern`、`toNetworkDestinationPattern`、`toNetworkDestinationUrl`、`buildUrlPatternRegexSource`（`src/vs/platform/mcp/common/allowedMcpServers.ts`）。
  - 先把两侧收成同一连接身份：新增一个共享的 host 规范化函数，把 IPv4-mapped IPv6 还原成内嵌 IPv4，域名去掉结尾的一个根点，端口按 scheme 去掉默认值。`toNetworkDestinationUrl` 对已解析的 URL 调用它；通配符模式也对 authority 里的字面 host 调用它。
  - 不能直接 `new URL(pattern)`。现有测试 `http://*127.0.0.2:*/*`（`src/vs/platform/mcp/common/allowedMcpServers.test.ts:110`）在 authority 里带 `*`，`new URL` 会抛 `Invalid URL`；实测 `new URL('http://*127.0.0.2:*/*')` 直接失败。通配符模式必须继续走 `splitHostAndPort` 的 authority 解析，保留 `*` 和 `:*` 的匹配语义。
  - 对没有 `*` 的 host，可以用一个只含该 host 的临时 URL（例如 `new URL(`${scheme}://${host}/`)`）做 WHATWG 规范化；对含 `*` 的 host，按 `*` 切段，只规范化不含 `*` 的字面段，不能把整段交给 `new URL`。IPv6 字面量仍按 `[...]` 整体处理。
  - `buildUrlPatternRegexSource` 只在规范化后的 pattern 上生成正则，并对规范化后的目的地匹配。`http://[::ffff:127.0.0.1]/*` 应被收成 `http://127.0.0.1/*`，`https://evil.com%2e/mcp` 的目的地应被收成 `https://evil.com/mcp`。
  - 保留 `http://*127.0.0.2:*/*` 这类 host 前缀通配符的现有行为：它仍匹配 `http://127.0.0.2:63366/mcp`，不匹配 `http://127.0.0.1:63365/mcp`。
- 不改：没有 `*` 时两边已经都走 `toNetworkDestinationUrl`。`checkMcpServerAllowed` 仍是拒绝优先；没有允许名单且拒绝未命中才是 Allowed。名字匹配和命令匹配不动。
- 本地验证：在 `src/vs/platform/mcp/test/common/allowedMcpServers.test.ts` 的 `isMcpServerMatched` / `checkMcpServerAllowed` 增加断言。现有 `URL patterns match the fetch destination rather than the raw spelling` 和 `deny blocks even when no allowlist is configured` 不覆盖这两类主机。断言 `http://[::ffff:127.0.0.1]/mcp` 被 `http://[::ffff:127.0.0.1]/*` 和 `http://127.0.0.1/*` 拒绝，`https://evil.com%2e/mcp` 被 `https://evil.com/*` 拒绝，且在只有拒绝名单时结果是 Denied。保留现有 `http://*127.0.0.2:*/*` 用例原样通过；另加断言：含 `*` 的 authority 模式不会因规范化抛错或退化成不匹配，`https://*.example.com/*` 仍匹配 `https://mcp.example.com/api`、不匹配 `https://evil.test/.example.com/tool`。

## r06-3 weaken

- 问题类：渲染侧 `updatePolicyDefinitions` 把服务端返回的全集当成补丁，返回里没有的键会留下。
- 不变量：主进程策略服务持有当前有值的全集。`PolicyChannelClient` 在这次调用返回后，本地表必须等于该全集；本地有、返回里没有的键必须删掉，并通知监听方。监听方之后读到的必须是未设置，不能继续用启动快照。
- 反证：`PolicyChannelClient` 构造函数里的 `onDidChange` 在值为 null 时会 `delete`（`policyIpc.ts` 第 59–67 行）。`PolicyChannel` 用 `getPolicyValue(name) ?? null` 发出解除（第 20–24 行）。`FilePolicyService.refresh` 和 `NativePolicyService._onDidPolicyChange` 会把去掉的键放进事件。客户端已经订上之后，服务端这次发出的解除不会留在表里。留下的是启动快照里有、返回值里没有、且这次没有 null 事件的键。
- 要动的符号或文件：`PolicyChannelClient._updatePolicyDefinitions`（`src/vs/platform/policy/common/policyIpc.ts`）。用返回的全集替换 `this.policies`：返回里没有的键删掉，有变化的键（含删除）通过 `_onDidChange` 发出，让渲染侧 `MultiplexPolicyService` 的监听和 `PolicyConfiguration` 跟着去掉。不要只 `set`。
- 不改：已有的 `onDidChange` null 删除。服务端 `getPolicyValues()` 仍只含当前有值的键。`AccountPolicyService` 自己的重算不动。
- 本地验证：没有 `PolicyChannelClient` 测试。新增断言：客户端先带着某策略值启动，`updatePolicyDefinitions` 的返回全集不含该名时，`getPolicyValue` 变为未设置，且 `onDidChange` 包含该名。另断言值为 null 的 `onDidChange` 仍会删除。

## r06-4 hold

- 问题类：卸载时资源里没有 `servers` 就当作成功返回，内存安装记录和安装目录还在。
- 不变量：`AbstractMcpResourceManagementService` 的 `this.local` 是已安装名单。`uninstall` 成功返回之后，该服务器不能再出现在 `getInstalled()` 里，其 `location` 目录也不能留在磁盘上。资源文件缺失或没有 `servers` 不是「已经卸完」。
- 要动的符号或文件：`AbstractMcpResourceManagementService.uninstall`（`src/vs/platform/mcp/common/mcpManagementService.ts`）。`!currentServers.servers` 时不要 return。有 `server.location` 就递归删除；目录已经不在则继续。然后调用 `updateLocal()`，让扫描结果把该名字从 `this.local` 去掉。文件里有 `servers` 时仍先 `removeMcpServers`，再删目录，再 `updateLocal()`。
- 不改：`McpResourceScannerService.withProfileMcpServers` 在文件不存在时返回空对象。安装路径不动。真正的删除失败仍走现有 catch：发带 error 的 `_onDidUninstallMcpServer` 并抛出。
- 本地验证：`src/vs/platform/mcp/test/common/mcpManagementService.test.ts` 没有覆盖这条。在该文件新增断言：服务器已在 `getInstalled()` 中，资源文件不存在或扫描结果没有 `servers` 时，`uninstall` 成功返回后 `getInstalled()` 不再包含它，且 `location` 目录被删掉。

## r06-5 weaken

- 问题类：MCP 网关把工具参数和响应正文写进默认就会落盘的 debug 日志。
- 不变量：网关日志可以记录工具名、是否出错、内容块数量和 HTTP 状态。工具参数、工具结果正文和 POST 响应正文不是日志事实，不得写入。日志级别过滤必须仍然生效。
- 反证：主进程 `McpGatewayService` 用的是 `LoggerMainService` → `SpdLogLogger`。`SpdLogLogger` 构造时 `super()` 没有打开 `AbstractMessageLogger` 的 `logAlways`。`logLevel: 'always'` 只是在 `AbstractLoggerService.createLogger` 里变成 `LogLevel.Trace` 并记在 logger 信息上，所以全局 `setLogLevel` 不会改它。输出通道「Set Log Level」会调用 `loggerService.setLogLevel(resource, level)`，`SpdLogLogger` 会按这个级别停掉 debug。不是完全关不掉。
- 要动的符号或文件：`McpGatewaySession._handleCallTool`、`McpGatewaySession._handleOutgoingMessage`（`src/vs/platform/mcp/node/mcpGatewaySession.ts`）；`McpGatewayRoute._handlePost`（`src/vs/platform/mcp/node/mcpGatewayService.ts`）。这三处去掉参数 JSON、完整 JSON-RPC 响应和 HTTP body。`McpGatewayService` 创建 `mcpGateway` logger 时不要再用 `logLevel: 'always'`，让它跟随默认级别。
- 不改：会话建立、初始化、SSE 连接数、工具名失败这些不含正文的 info/warn。不要把这个 logger 改成 IPC `Logger` 那种 `logAlways` 旁路。
- 本地验证：`mcpGatewaySession.test.ts` 的 `serves tools/list and tools/call after initialized notification` 不检查日志。扩展该测试或另加断言：`tools/call` 的 debug 文本含工具名，不含 `arguments` 里的值。对 `_handleOutgoingMessage` 和 `_handlePost` 的断言意图相同：响应日志不含结果正文。

## 落地

- 2026-10-25 实施 r06-1：`FilePolicyService` 读取或解析失败时保留上一份已生效策略，不用空表覆盖。
- 2026-10-25 实施 r06-2：MCP 允许 / 拒绝匹配先规范化主机。IPv4-mapped IPv6 折成 IPv4，去掉根点，大小写折叠，通配段按同一规则处理；`*` 规则与待匹配 URL 用同一目的地事实。
- 2026-10-25 实施 r06-3：`updatePolicyDefinitions` 按服务端返回的全集替换，返回里没有的键不再残留。
- 2026-10-25 实施 r06-4：卸载时资源文件缺失或没有 `servers` 也继续删除内存安装记录与安装目录，不再当作成功提前返回。
- 2026-10-25 实施 r06-5：MCP 网关只记录状态、大小与工具名，不记录工具参数或响应正文。
- 验证：`filePolicyService.test.ts`、`policyIpc.test.ts`、`allowedMcpServers.test.ts`、`mcpManagementService.test.ts`、`mcpGatewaySession.test.ts` 合计 85 passing。
- 既有失败：无。
