---
title: "方案 r04：entrypoint"
type: plan
status: accepted
phase: N/A
updated: 2026-09-30
summary: "2026-09-30 用户签收。未实施。修正连接令牌 cookie 覆盖、未鉴权的 delay-shutdown、许可证环境变量、Web UI 绑定地址日志和 IPv6 桥接 URL。"
---

# 方案 r04：entrypoint

核对发现稿时，r04-1、r04-2、r04-4、r04-5 的引用行仍是所述行为。r04-3 的解析代码仍在，但当前产品配置进不了退出分支，降级后仍改。

## r04-1（hold）

- 问题类：根路径在查询串恰好有一个 `tkn` 时，不与服务器令牌比较就把该值写成 `vscode-tkn` cookie。
- 不变量：已经通过 cookie 鉴权的请求，不得把校验失败的查询令牌写成新 cookie。查询令牌与服务器令牌一致时，仍 302 到去掉 `tkn` 的地址，并按现有 `sameSite: 'lax'`、一周 `maxAge` 续写 cookie。
- 要动的符号或文件：`WebClientServer._handleRoot`（`src/vs/server/node/webClientServer.ts`）。在 `cookie.serialize` 之前用 `this._connectionToken.validate(queryConnectionToken)` 判断。校验失败时仍删除查询参数并 302，这次响应不带 `Set-Cookie`。
- 明确不改什么：不改 `requestHasValidConnectionToken` 的「查询失败再看 cookie」顺序；不改 `None` 令牌恒通过的语义；不改多个 `tkn` 时跳过该分支的条件；不改随后 HTML 响应里用服务器令牌续期 cookie 的那段。
- 怎样本地验证：现有 `src/vs/server/test/node/serverConnectionToken.test.ts` 的 `falls back to a cookie`、`rejects repeated query parameters` 保持通过。在 `src/vs/server/test/node/webClientServer.test.ts` 新增断言：Mandatory 令牌下，有效 cookie 加单个错误 `tkn` 的根路径响应是 302，且 `Set-Cookie` 不含该错误值；查询令牌等于服务器令牌时仍写入 cookie 并去掉 `tkn`。用 `scripts/test.sh --grep "WebClientServer|requestHasValidConnectionToken"` 跑。

## r04-2（hold）

- 问题类：`GET /delay-shutdown` 写在连接令牌校验之前，无令牌也会调用 `delay()` 并返回 200。
- 不变量：只有带有效连接令牌的 GET 才能重置 5 分钟空闲倒计时，或在退出承诺已存在时把 `_shutdownGeneration` 增加、从而在 join 结束后中止 `process.exit` 并重新排程。无令牌请求得到 403，且不调用 `delay()`。
- 要动的符号或文件：`RemoteExtensionHostAgentServer.handleRequest`（`src/vs/server/node/remoteExtensionHostAgentServer.ts`）。把 `pathname === '/delay-shutdown'` 整段移到 `httpRequestHasValidConnectionToken` 失败并返回 403 之后。成功时仍 `writeHead(200)` 并 `end('OK')`。
- 明确不改什么：不改 `/version` 仍在令牌校验之前；不改 `ServerLifetimeService.delay`、`SHUTDOWN_TIMEOUT` 和 `serverServices.ts` 里 `enableAutoShutdown` 的开关；不改 CLI 的 `--enable-remote-auto-shutdown` 传参。仓内没有这个路径的调用方，不另做一套鉴权。
- 怎样本地验证：现有 `src/vs/server/test/node/serverLifetimeService.test.ts` 的 `does not exit when shutdown is delayed during a join` 保持通过。`RemoteExtensionHostAgentServer` 未导出，该用例只打 `ServerLifetimeService.delay()`。抽出一层不导入 `serverServices.ts` 的路由函数并导出，或导出该类。断言使用 `MandatoryServerConnectionToken`：无 cookie 且无匹配 `tkn` 为 403 且 `delay` 未被调用；有效 cookie 或匹配 `tkn` 为 200 且 `delay` 调用一次。`NoneServerConnectionToken.validate` 恒为 true，不要把「无令牌即 403」做成与令牌类型无关的新规则。用 `scripts/test.sh --grep "delay-shutdown|ServerLifetimeService"` 跑。

## r04-3（weaken）

反证：`product.json` 第 12–13 行 `serverLicense` 是空数组，`serverLicensePrompt` 是空字符串。`src/server-main.ts` 第 68 行要求 `serverLicense` 非空，第 70 行要求 `serverLicensePrompt` 为真。两条在当前产品里都不成立，非交互启动不会打印必须使用 `--accept-server-license-terms`，也不会以退出码 1 结束。第 32–38 行仍只用 `replace('-', '_')` 生成 `VSCODE_SERVER_ACCEPT_SERVER-LICENSE-TERMS`，并把环境变量原文字符串赋给参数；第 70 行仍用 `!== true`。全下划线变量名读不到，字符串 `"true"` 也过不了比较。这是当前进不去的解析缺陷，不是当前产品的启动失败。

- 问题类：许可证接受开关从环境变量读入时，变量名少替换了连字符，读到的字符串也不会变成布尔值 `true`。
- 不变量：命令行 `--accept-server-license-terms` 仍由 minimist 变成布尔值 `true` 并视为已接受。`VSCODE_SERVER_HOST` 与 `VSCODE_SERVER_PORT` 仍按字符串写入。只有环境变量值恰好是 `true` 时，许可证键才变成布尔值 `true`。
- 要动的符号或文件：把 `src/server-main.ts` 第 32–38 行的环境变量覆盖抽成纯函数，放进新的叶模块，由 `server-main.ts` 在现有位置调用。该模块只含这个函数，不导入 `server.main.ts`、`remoteExtensionHostAgentServer.ts`、`serverServices.ts` 或 `product.ts`。环境变量覆盖在 `bootstrapESM()` 之前执行；上述现有模块在求值时会 `parseArgs`、删桥接令牌或建目录，不能在第 32 行被静态导入。「导入时不会 listen」挡不住这些副作用。变量名用全局替换把每个 `-` 换成 `_`。只对 `accept-server-license-terms` 把字符串 `true` 写成布尔值 `true`。第 70 行的 `!== true` 保持不动。
- 明确不改什么：不往 `product.json` 填许可证正文或提示语；不把 `host`、`port` 收成布尔值；不把 `"1"`、`"yes"` 当成已接受；不改交互式 `prompt()`。
- 怎样本地验证：不要在测试里导入 `src/server-main.ts`。对纯函数新增断言：`VSCODE_SERVER_ACCEPT_SERVER_LICENSE_TERMS=true` 得到布尔值 `true`；带连字符的变量名不被读取；`VSCODE_SERVER_PORT` 仍是字符串。用 `scripts/test.sh --grep` 加上该新测试名跑。

## r04-4（hold）

- 问题类：带 Web 客户端时，Web UI 日志把地址写成 `http://localhost`，与 `--host` 绑到的非回环单播地址不一致。
- 不变量：通配绑定（`0.0.0.0`、`::`）的 Web UI 地址仍使用本机可打开的回环名 `localhost`。具体单播地址按 `server.address()` 的 `address` 打印；IPv6 字面量加方括号。端口 80 继续省略端口。有连接令牌时仍附上现有 `tkn` 查询串。
- 要动的符号或文件：`createServer` 里 `hasWebClient` 条件下的那条 `console.log`（`src/vs/server/node/remoteExtensionHostAgentServer.ts`）。把主机名格式化抽成纯函数再给这行日志用。
- 明确不改什么：不改 `src/server-main.ts` 的 `server.listen`，也不改「Extension host agent listening on」那一行（启动方靠这行认端口）。不改同一段里已经打印真实绑定地址的「Server bound to」。
- 怎样本地验证：对纯函数新增断言：`192.168.1.5` 与端口 `8080` 得到 `http://192.168.1.5:8080`；`0.0.0.0` 与 `::` 得到 `http://localhost:<端口>`；`::1` 得到 `http://[::1]:<端口>`；端口 `80` 不写端口。用 `scripts/test.sh --grep` 加上该新测试名跑。

## r04-5（hold）

- 问题类：TCP 桥接把未加方括号的 IPv6 字面量拼进 `ws://host:port`，`new URL` 会拒绝该字符串，上游 WebSocket 拨号失败。
- 不变量：IPv4 与主机名仍是 `ws://host:port`。已带方括号的主机不再套一层。连接令牌仍作为 `tkn` 查询参数并做 `encodeURIComponent`。`socketPath` 仍走 `net.createConnection`，不改成 TCP URL 拨号。
- 要动的符号或文件：从 `WebSocketUpstreamConnection._buildUrl`（`src/vs/server/node/agentHostChannel.ts`）抽出并导出纯函数，`_buildUrl` 只调用它。主机含 `:` 且尚未被 `[]` 包住时，拼 URL 前加上方括号。`serverServices.ts` 继续把 `agent-host-bridge-host` 或 `host` 原样放进 endpoint。`WebSocketUpstreamConnection` 未导出，现有测试经 `FakeUpstream` 注入，不会执行 `_buildUrl`。
- 明确不改什么：不改 CLI `dial_host`（`::` 仍映射到 `127.0.0.1`，`::1` 仍原样传出）；不改 `AgentHostChannel` 的 IPC 与 `FakeUpstream` 测试注入；不改日志里的 `host:port` 文本。
- 怎样本地验证：现有 `src/vs/server/test/node/agentHostChannel.test.ts` 的 `does not log the upstream connection token` 保持通过，`FakeUpstream` 注入不动。新断言直接调用抽出的纯函数：主机 `::1`、端口 `12345` 得到 `ws://[::1]:12345`，且 `new URL` 不抛错；`localhost` 仍是 `ws://localhost:12345`；已经是 `[::1]` 时不变成双重方括号。用 `scripts/test.sh --grep "AgentHostChannel"` 跑。CLI 自己的 `ws://{dial_host}:{port}` 不在本方案触发点内。

## 审查

2026-09-30 只读审查后改稿。无 Critical。Important：r04-3 放进不导入服务器启动模块的新叶模块。Minor：r04-2、r04-5 补可调用缝，已写入正文。CLI 自己的 `ws://{dial_host}:{port}` 不在本方案触发点内。

2026-09-30 第二轮只读审查。无新的 Critical / Important。

2026-09-30 用户签收。`accepted`。未实施。
