---
title: "审查 r15：entrypoint"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "入口在 Windows 保存、监听失败、反向代理主机、base path 前缀和 agent host 崩溃重启上会丢数据或走错。"
---
# 审查 r15：entrypoint

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r15-1 高
- 症状：Windows 上 `--file-write` 写入失败时，目标文件被截成空文件，原内容回不来。
- 位置：`src/vs/code/node/cli.ts` 第 199–218 行
- 引用：`truncateSync(target, 0);` 之后才 `writeFileSync(target, data, { flag: 'r+' })`，catch 只改 `error.message` 再抛出。
- 为什么是问题：截断已经落盘。随后的写入若抛错（磁盘满、共享冲突），catch 不把旧字节写回；`--file-chmod` 刚加上的写权限也不会恢复。目标文件上的原内容丢失。
- 方向：写入前留下旧内容，失败时写回。

## r15-2 中
- 症状：端口被占用时进程不退出，并在 `address` 仍为 null 时拉起整套服务。
- 位置：`src/server-main.ts` 第 102–105 行
- 引用：`server.on('error', …)` 里 `await getRemoteExtensionHostAgentServer()`，再 `handleServerError(err)`。
- 为什么是问题：`listen` 失败不会走到第 113 行回调，第 84 行的 `address` 保持 null，第 54 行仍 `createServer(address)`。`handleServerError`（`src/vs/server/node/remoteExtensionHostAgentServer.ts` 第 250–253 行）只记日志，不 `process.exit`。调用方等不到非零退出，后台服务却已起来。
- 方向：监听失败时打印错误并以非零状态退出，不要用 null address 创建服务。

## r15-3 中
- 症状：带 `X-Forwarded-Port` 时，IPv6 或已含端口的主机被切成错误的 remote authority，Web 工作台连错地址。
- 位置：`src/vs/server/node/webClientServer.ts` 第 340–361 行
- 引用：`replacePort` 用 `host.indexOf(':')` 截断，再拼 `:${port}`；`x-forwarded-port` 存在时替换 `remoteAuthority`。
- 为什么是问题：`[::1]:8080` 的第一个冒号在地址内部，结果会变成 `[:443` 这类主机。该值写入 workbench 的 `remoteAuthority`，页面按错误地址回连。
- 方向：只替换末尾端口，IPv6 按方括号整体保留。

## r15-4 中
- 症状：无延迟自动关闭打开时，agent host 崩溃会放弃重启，服务器直接退出。
- 位置：`src/vs/server/node/serverAgentHostManager.ts` 第 191–209 行
- 引用：`_handleUnexpectedExit` 先 `_lifetimeToken.clear()`，再 `void this.ensureStarted().catch(() => undefined)`。
- 为什么是问题：`clear()` 同步把消费者计数降到 0。若同时有 `--enable-remote-auto-shutdown` 和 `--remote-auto-shutdown-without-delay`（`src/vs/server/node/serverServices.ts` 第 241–244 行），`ServerLifetimeService._scheduleShutdown`（第 133–135 行）立刻触发 `onWillShutdown`，把 `_shuttingDown` 设为 true（第 84–86 行）。接着 `ensureStarted`（第 99–100 行）直接拒绝，错误被吞掉，重启不会发生，进程按空闲退出。
- 方向：崩溃重试期间保持 lifetime，直到新进程起来或重试预算用尽。

## r15-5 低
- 症状：`--server-base-path` 若是某条路由的字符串前缀，不带 base 的请求会被错误剥掉。
- 位置：`src/vs/server/node/remoteExtensionHostAgentServer.ts` 第 143–146 行
- 引用：`pathname.startsWith(this._serverBasePath)` 为真就 `substring`，没有检查下一个字符是不是 `/`。
- 为什么是问题：注释要求 `/` 和 base path 都能访问。base 为 `/vscode` 时，`/vscode-remote-resource` 被剥成 `-remote-resource`，资源请求对不上。紧接着的产品路径（第 147–149 行）要求后面必须是 `/`，base path 没有这条边界。
- 方向：仅当 base path 后是 `/` 或已经到字符串末尾时才剥离。
