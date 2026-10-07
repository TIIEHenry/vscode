---
title: "方案 r15：entrypoint"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 3，drop 0，weaken 2。Windows 写入、监听失败和 base path 前缀成立；转发端口只在第一个冒号不是端口时切错；崩溃放弃重启只在 AgentHost token 是最后一个 consumer 时成立。"
---

hold 3，drop 0，weaken 2。

## r15-1（hold，高）

- 问题类：Windows 上 `--file-write` 先把目标截成空文件再写，写入失败时原字节和刚加上的写权限都留不回来。
- 不变量：Windows 策略仍是先 `truncateSync(target, 0)` 再 `writeFileSync(target, data, { flag: 'r+' })`（`cli.ts` 第 206–207 行；`writeFileSync` 来自 `pfs.ts` 第 450 行）。成功时目标内容等于源文件，并且仅当 `restoreMode` 为真时把 mode 设回第 190 行读到的 `targetMode`（第 213–215 行）。失败时：若已经执行过截断，在重新抛出前用同一套截断加 `r+` 写回截断前读到的字节；若第 189–194 行因为 `--file-chmod` 加上了 owner 写位，写回字节之后再 `chmodSync(target, targetMode)`。写回或 chmod 本身再抛错时，仍然抛出原来的写入错误，消息前缀保持第 217 行的 `` `Error using --file-write: ${error.message}` ``。截断尚未发生时只恢复 mode，不改字节。
- 要动的符号或文件：`src/vs/code/node/cli.ts` 第 184–218 行，`--file-write` 的 try。把这段抽成导出函数，由 `main` 调用。函数接收是否走 Windows 策略的布尔值，生产调用传入 `isWindows`。测试传入 `true`，从而在非 Windows 上覆盖截断后的失败路径。
- 明确不改什么：保持第 208–209 行非 Windows 的单次 `writeFileSync(target, data)`。保持第 150–182 行的参数校验、第 166–171 行的 UNC allowlist，以及隐藏文件 / ADS 所依赖的成功路径顺序。
- 怎样本地验证：没有覆盖 `--file-write` 的现有测试。新增断言：Windows 策略下，截断之后的 `r+` 写入抛错时，目标文件字节与调用前一致；文件原 mode 不含 `0o200` 且打开 `--file-chmod` 时，失败后的 mode 回到调用前的 `targetMode`。成功时内容等于源数据，`restoreMode` 为真时 mode 回到 `targetMode`。截断本身抛错时字节不变，已加上的写位仍回到 `targetMode`。用 `scripts/test.sh --grep "file-write"` 跑，新断言的标题须能被这个 grep 选中。

## r15-2（hold，中）

- 问题类：端口占用使 `listen` 失败时，进程不带非零状态结束，并在 `address` 仍为 null 时执行 `createServer`。
- 不变量：`listen` 的成功回调（`src/server-main.ts` 第 113 行）尚未把第 84 行的 `address` 写成 `server.address()`（第 127 行）时，`error` 事件只把错误打到 stderr，并以 `process.exit(1)` 结束。此路径不调用 `getRemoteExtensionHostAgentServer()`，因此不执行第 54 行的 `createServer(address)`。`address` 已经是字符串或 `AddressInfo` 时，仍走第 103–104 行：交给 `handleServerError`（`remoteExtensionHostAgentServer.ts` 第 250–253 行）记日志，不在这里退出。
- 要动的符号或文件：`src/server-main.ts` 第 102–105 行的 `server.on('error')`。判断本身做成无 `server.listen` 副作用的函数，放在 `src/vs/server/node/`，由第 102–105 行调用。`src/server-main.ts` 顶层会监听端口，测试不 import 它。
- 明确不改什么：保持第 113–141 行成功回调里的绑定日志和 `Extension host agent listening` 行。保持 `handleServerError` 只记日志的函数体。保持 `createServer` 在地址为空时跳过 Web UI 地址日志的第 741 行。
- 怎样本地验证：没有这条监听失败路径的现有测试。新增断言：地址为 null 时得到退出码 1，且不调用创建服务的回调；地址为 `{ address, port, family }` 或套接字路径字符串时调用 `handleServerError` 的回调，且不调用退出。用 `scripts/test.sh --grep "listen failure"` 跑，新断言的标题须能被这个 grep 选中。

## r15-3（weaken，中 → 低）

发现稿标中。降为低。

反证：`replacePort`（`webClientServer.ts` 第 340–347 行）用 `host.indexOf(':')` 截断后再拼 `:${port}`。`127.0.0.1:8080` 和 `localhost:8080` 的第一个冒号就是端口分隔符，转发端口 `443` 时结果是 `127.0.0.1:443` 和 `localhost:443`。没有冒号的 `example.com` 得到 `example.com:443`。这三例不是错误 authority。会切错的是第一个冒号不在端口边界的主机：`[::1]:8080` 的 `indexOf(':')` 为 1，`substring(0, 1)` 得到 `[`，再拼 `:${port}` 成为 `[:443`；`[::1]` 同样成为 `[:443`；无括号的 `::1` 在下标 0 被截成空串，结果是 `:443`。`x-forwarded-port` 存在时第 358–361 行把这个值写进 `remoteAuthority`，第 419 行放进 `workbenchWebConfiguration.remoteAuthority`。

- 问题类：带 `x-forwarded-port` 时，方括号 IPv6 和无括号 `::1` 被第一个冒号截成错误的 `remoteAuthority`；普通 `host:port` 替换是对的。
- 不变量：只把末尾的 `:数字` 当作已有端口。`127.0.0.1:8080` 加转发端口 `443` 仍是 `127.0.0.1:443`；`localhost:8080` 仍是 `localhost:443`；`example.com` 仍是 `example.com:443`。`[::1]:8080` 得到 `[::1]:443`，`[::1]` 得到 `[::1]:443`。无括号的 `::1` 得到 `::1:443`，不自动补上方括号。该字符串仍经第 419 行进入 workbench 配置。
- 要动的符号或文件：`src/vs/server/node/webClientServer.ts` 第 340–347 行的 `replacePort`，以及第 358–361 行对它的调用。把 `replacePort` 提成可单测的导出函数。
- 明确不改什么：保持第 350–354 行 `x-original-host`、`x-forwarded-host`、`host` 的取值顺序。保持第 388 行 workspace URI、第 481 行 CSP 继续使用同一个 `remoteAuthority` 变量。保持无 `x-forwarded-port` 时不改主机。
- 怎样本地验证：`WebClientServer` suite 里的 `round-trips the workbench configuration through attribute encoding` 使用固定的 `remoteAuthority: 'localhost:3000'`，不经过 `replacePort`。在该 suite 新增断言：根请求带 `x-forwarded-port: 443` 时，渲染出的 `WORKBENCH_WEB_CONFIGURATION.remoteAuthority` 对 `[::1]:8080` 为 `[::1]:443`，对 `[::1]` 为 `[::1]:443`，对 `::1` 为 `::1:443`，对 `127.0.0.1:8080` 为 `127.0.0.1:443`，对 `localhost:8080` 为 `localhost:443`。无该头时 `127.0.0.1:8080` 保持原样。用 `scripts/test.sh --grep "WebClientServer"` 跑。

## r15-4（weaken，中 → 低）

发现稿标中。降为低。

反证：`_lifetimeToken` 只在 `_hasActiveSessions || _connectionCount > 0` 时由 `_updateLifetimeToken`（`serverAgentHostManager.ts` 第 267–272 行）持有 `active('AgentHost')`。没有会话、也没有独立 WebSocket 客户端时，第 193 行 `clear()` 不 dispose 任何 consumer，计数不变，`ensureStarted`（第 209 行）不会因为 `_shuttingDown` 被拒绝。`active()` 的 dispose（`serverLifetimeService.ts` 第 116–118 行）只在 `_totalCount === 0` 时调用 `_scheduleShutdown(false)`。还有别的 consumer 时，释放 AgentHost token 不会进入第 133–135 行的立即关闭。两个 flag 的接线在 `serverServices.ts` 第 241–244 行；`shutdownWithoutDelay && !initial` 时第 133–135 行同步调用 `_tryShutdown`，`onWillShutdown` 在第 84–86 行把 `_shuttingDown` 设为 true，第 99–100 行因此拒绝。这条链只在 token 正被持有、且它是最后一个 consumer 时成立。`serverAgentHostManager.test.ts` 的 `MockServerLifetimeService.active` 在 dispose 时只减计数，不触发 `onWillShutdown`，所以现有崩溃测试不会走到拒绝重启。

- 问题类：无延迟自动关闭下，AgentHost 的 lifetime token 若是最后一个 consumer，崩溃时会先把它释放，重启被 `_shuttingDown` 拒绝，进程按空闲退出。
- 不变量：`_restartCount < MaxRestarts` 时，`_handleUnexpectedExit` 在 `ensureStarted` 的 promise 结束之前不调用 `_lifetimeToken.clear()`。promise 结束后，仅当 `_hasActiveSessions` 与 `_connectionCount` 仍都为 0 时才释放；期间若新进程上报了会话或连接，token 继续持有。重试预算已用尽的分支立即释放，让空闲关闭按原策略发生。token 本来就没有持有时，崩溃仍调用 `ensureStarted`，不额外占用 lifetime。其他 consumer 使 `_totalCount > 0` 时，服务器不因这次崩溃退出。
- 要动的符号或文件：`src/vs/server/node/serverAgentHostManager.ts` 的 `_handleUnexpectedExit`（第 191–214 行）。把第 193 行的 `clear()` 从 `willRestart` 为真的路径挪到 `ensureStarted` 结束之后；第 210–214 行放弃重启的分支仍立即 `clear()`。
- 明确不改什么：保持 `ServerLifetimeService._scheduleShutdown` 在 `shutdownWithoutDelay && !initial` 时同步 `_tryShutdown`（第 133–135 行），以及 `initial === true` 时使用 `SHUTDOWN_TIMEOUT`（第 136–141 行）。保持 `serverServices.ts` 第 241–244 行的 flag 接线。保持第 99–100 行在 `_shuttingDown` 时拒绝。保持第 84–86 行对真正 `onWillShutdown` 的处理。
- 怎样本地验证：`process exit resets both signals and clears token` 现在在 `fireProcessExit` 之后同步要求 `hasActiveConsumers === false`。该断言改为：还有重试预算时，等这次 `ensureStarted` 结束且会话数和连接数仍为 0，token 才释放。新增断言：用 `ServerLifetimeService`，`enableAutoShutdown` 与 `shutdownWithoutDelay` 都为 true，退出函数由测试注入；先让会话数大于 0，使 AgentHost token 成为唯一 consumer，再触发意外退出。注入的退出函数在新的 `start` 发生之前不被调用，`start` 次数增加。预算用尽的那次退出立即释放 token，并允许随后的退出函数被调用。没有 token 时（现有 `no lifetime token initially` 的前置）崩溃仍会再 `start`。现有 `restarts after a lazy agent host crash`、`stops after five restarts and disposes every exited connection`、`allows a new explicit start after exhausting crash restarts` 保持通过。用 `scripts/test.sh --grep "ServerAgentHostManager"` 跑。

## r15-5（hold，低）

- 问题类：`--server-base-path` 与某条路由只是字符串前缀时，不带 base 的请求会被剥掉。
- 不变量：`_serverBasePath` 有定义时，仅当 `pathname.length === this._serverBasePath.length`，或下一个字符是 `CharCode.Slash`，才 `substring`。截完为空时仍用 `'/'`（第 145 行的 `|| '/'`）。base 为 `/vscode` 时，`/vscode` 与 `/vscode/foo` 分别得到 `/` 与 `/foo`；`/vscode-remote-resource` 保持原样，从而仍能命中第 168 行。第 148–149 行的产品路径继续要求下一个字符是 `/`。
- 要动的符号或文件：`src/vs/server/node/remoteExtensionHostAgentServer.ts` 第 144–146 行。把判断抽成导出函数，`handleRequest` 调用它。边界用已经在第 148 行使用的 `CharCode.Slash`。
- 明确不改什么：保持第 105–108 行去掉 base path 末尾斜杠。保持第 147–149 行产品路径的剥离条件。保持第 143 行对 `'/'` 与 base path 都提供服务：精确等于 base path 时仍然落到 `'/'`。
- 怎样本地验证：`src/vs/server/test/node/remoteExtensionHostAgentServerRequest.test.ts` 的 `delay-shutdown` suite 只覆盖 `routeDelayShutdown`，不覆盖这段剥离。新增断言：base `/vscode` 时 `/vscode` → `/`，`/vscode/` → `/`，`/vscode/foo` → `/foo`，`/vscode-remote-resource` 不变；base 为 `undefined` 时路径不变。用 `scripts/test.sh --grep "server base path"` 跑，新断言的标题须能被这个 grep 选中。
