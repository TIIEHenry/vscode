---
title: "十六路审查 r05：platform 其余方案"
type: plan
status: draft
phase: N/A
updated: 2026-10-30
summary: "核对 5 条：hold 3，weaken 1，drop 1。"
---

# 十六路审查 r05：platform 其余方案
状态：草案。
覆盖需求：无（正文未引用需求编号）。


| 编号 | 判定 | 严重度 |
| --- | --- | --- |
| r05-1 | weaken | 低 |
| r05-2 | hold | 高 |
| r05-3 | hold | 中 |
| r05-4 | drop | 中 |
| r05-5 | hold | 低 |

### r05-1

问题类：macOS 上 `checkFileAccess` 用未展开的 `~/` 规则比较绝对路径，预检和沙箱运行时的结果会不一致。

反证：配置里保留 `~/` 是现有合同。`_resolveFileSystemPath` 只在 Linux 调用 `_expandHomePath`。`src/vs/workbench/contrib/terminalContrib/chatAgentTools/test/browser/terminalSandboxService.test.ts` 的 `should not expand home paths in macOS filesystem sandbox config paths` 要求 macOS 配置保留 `~/.custom-write`、`~/.secret`、`~/.custom-readable`、`~/.custom-write/file.txt`，并断言它们不会变成 `/home/user/...`。`should allow Git commands to read the GitHub CLI config on macOS` 要求 `allowRead` 含 `~/.config/gh/config.yml`。`should deny home reads while reallowing writable paths for reads on macOS` 要求 `denyRead` 含绝对路径 `/home/user`。本仓 `package.json` 依赖 `@vscode/sandbox-runtime`。`node_modules/@vscode/sandbox-runtime/dist/sandbox/sandbox-utils.js` 的 `normalizePathForSandbox` 只把 `~` 和 `~/` 前缀展开成 `os.homedir()`，绝对路径不走这段展开。`macos-sandbox-utils.js` 在写 seatbelt 规则前调用它。家目录拒绝读来自引擎 `_userHome` 的绝对路径，不会被这段 `~/` 展开改写。seatbelt 里后写的允许盖过先写的拒绝，只在 `os.homedir()` 的展开结果落在这条绝对路径之下时，拒绝读和 `~/` 允许项才对得上。仓内合同没有写 `_userHome` 与 `os.homedir()` 相同，不把「已经对上」当成事实。产品调用点 `RunInTerminalTool._getDeniedSandboxFileAccess` 只对 `requestFileValidationCheck` 做 `checkFileAccess('write')`。预检把一条 `~/` 拒绝写放行时，命令仍进入沙箱；运行时是否按展开后的拒绝写执行，取决于上面两个家目录是否相同。

降级后的严重度：低。原严重度是高。运行时强制不能说成已经和预检一致；剩下要改的是 macOS 预检比较。

不变量：macOS 写入沙箱 JSON 的 `~/` 路径保持不展开。Linux 在写入前仍展开。macOS 的 `checkFileAccess` 把 `~/` 规则和绝对候选路径按同一家目录比较：同时落在绝对 `allowWrite` 和 `~/` `denyWrite` 下的写返回拒绝；落在家目录 `denyRead` 内、又落在 `~/` `allowRead` 下的读返回允许。

要动的符号或文件：`src/vs/platform/sandbox/common/terminalSandboxEngine.ts` 的 `_hasFileSystemAccess` 与 `_matchesFileSystemPath`。仅当 `_os === OperatingSystem.Macintosh` 时，比较前对候选路径和规则各调用已有的 `_expandHomePath`，用展开后的副本做 `_matchesFileSystemPath`。

明确不改什么：`_resolveFileSystemPath` 里 `this._os === OperatingSystem.Linux ? this._expandHomePath(path) : path` 保持不动。`terminalSandboxReadAllowList.ts` 的 `~/` 字面量、Windows 路径、沙箱 JSON 的序列化内容保持不动。

怎样本地验证：既有 `should not expand home paths in macOS filesystem sandbox config paths`、`should expand home paths in linux filesystem sandbox config paths`、`should allow Git commands to read the GitHub CLI config on macOS` 仍通过。在 `src/vs/platform/sandbox/test/common/terminalSandboxEngine.test.ts` 新增 macOS 断言：`getUserHome` 为 `/home/user`，`getWriteRoots` 为 `/home/user/project`，`denyWrite` 为 `~/project/secret` 时，`checkFileAccess('write', ['/home/user/project/secret/file'])` 返回拒绝，且 `getSandboxConfigPath` 的 JSON 仍含 `~/project/secret`、不含 `/home/user/project/secret`。另加 `allowRead` 为 `~/.ssh` 时，`checkFileAccess('read', ['/home/user/.ssh/config'])` 返回允许。新测试标题必须包含 `checkFileAccess`。用 `scripts/test.sh --grep "should not expand home paths in macOS filesystem sandbox config paths|checkFileAccess"` 跑上述测试。

### r05-2

问题类：运行时信息的完成标记写在 `await` 之前，失败或并发调用会把未完成的初始化当成已完成。

不变量：同一次初始化共享一个 promise。`getRuntimeInfo` 与 `getUserHome` 都成功之后才把 `_appRoot`、`_execPath`、`_userHome` 等字段交给等待者。失败时清掉这个 promise 并保持字段未完成，下一次调用再向宿主要。并发的 `getSandboxConfigPath` / `checkFileAccess` 在字段写完前不得组装 `denyRead`。成功后非 Windows 的 `denyRead` 含家目录路径；`_execPath` 已设置时 `wrapCommand` 不再抛 `Executable path not set to run sandbox commands`。

要动的符号或文件：`TerminalSandboxEngine._resolveRuntimeInfo` 与 `_runtimeResolved`（`src/vs/platform/sandbox/common/terminalSandboxEngine.ts`）。用一个可清空的 `_runtimeInfoPromise` 替换提前置真的布尔标记。两次 `await` 都成功后再写入字段。任一次拒绝则把共享 promise 置回未开始并继续把拒绝传给等待者。

明确不改什么：工作台 `TerminalSandboxService._resolveRuntimeInfo`、`_ensureRemoteEnvRead` 的失败重读，以及 agent host 的 `getRuntimeInfo` 保持不动。Windows 家目录拒绝读的 TODO、`_updateDenyReadPathsWithHome` 的路径算法保持不动。

怎样本地验证：`src/vs/platform/sandbox/test/common/terminalSandboxEngine.test.ts` 目前没有这条覆盖。新增两条断言，测试标题必须包含 `runtime info`。其一：`getRuntimeInfo` 第一次拒绝、第二次成功，第二次 `getSandboxConfigPath` 会再次调用宿主，沙箱配置 JSON 的 `filesystem.denyRead` 含 `/home/user`，`wrapCommand` 不抛 `Executable path not set to run sandbox commands`。其二：`getRuntimeInfo` 用一个未完成的 deferred 挡住，重叠调用 `getSandboxConfigPath` 与 `checkFileAccess`，在 deferred 完成前配置文件不得写完；完成后两边读到的配置 JSON 里 `filesystem.denyRead` 都含家目录。这里说的不是 `checkFileAccess` 的返回值，那个返回值是 `{ allowed, denied }`。用 `scripts/test.sh --grep "runtime info"` 跑这个新测试名。

### r05-3

问题类：本地转发 `listen` 失败时 `error` 不结束等待，后面的端口 0 重试执行不到，`waitForReady` 停住。

不变量：每次 `listen` 使用各自的等待。`listening` 或 `error` 都结束这一次等待，并且进程上仍有 `error` 监听。第一次失败后改 `listen(0)`，第二次使用新的等待，由这次的 `listening` 或 `error` 结束。两次都失败时 `waitForReady` 拒绝，不再读空 `address.port`。

要动的符号或文件：`src/vs/platform/tunnel/node/tunnelService.ts` 的 `NodeRemoteTunnel.waitForReady`、`_errorListener`、`_barrier`。`Barrier.open` 之后 `wait()` 会立即完成，不能在 `error` 上打开同一个 `_barrier` 再靠它等第二次 `listen`。每次 `listen` 新建一个 `Barrier`（或等价的一次性 promise）：`listening` 打开它，`error` 也结束它并记下失败。`address` 为空时再用新的等待去 `listen(0)`。

明确不改什么：`createRemoteTunnel` 里受限端口的三次外层循环、`findFreePortFaster`、`_onConnection` 和套接字镜像保持不动。空 `error` 监听要换成会结束等待的监听，不能摘掉 `error` 监听。

怎样本地验证：`src/vs/platform/tunnel/test/common/tunnelOpenRetry.test.ts` 覆盖的是 `AbstractTunnelService` 的 open 重试，覆盖不到 `NodeRemoteTunnel.listen`。`waitForReady` 在 `listen` 之前先调用 `findFreePortFaster`。起始端口被占用时，它会改试下一个端口；放弃时返回 0，第一次 `listen` 就是 `listen(0)`，到不了 `address` 为空之后再 `listen(0)` 的分支。新断言不要用「起始端口已被占用」触发那条分支。要让第一次 `listen` 发出 `error` 且 `address()` 仍为空，也就是源码注释写的「`findFreePortFaster` 返回的端口在 `listen` 时已被占用」。此后 `waitForReady` 改 `listen(0)` 并完成，`tunnelLocalPort` 是系统分配的端口。第二次 `listen` 也发出 `error` 时 promise 拒绝，而不是停在 `wait()`。测试标题必须包含 `waitForReady`。在 `src/vs/platform/tunnel/test/node/` 新增该断言，用 `scripts/test.sh --grep "waitForReady"` 跑它。

### r05-4

判定：drop。不写改法。

反证：`SharedProcessTunnelService.setAddress` 在表里没有该 id 时直接返回（`src/vs/platform/tunnel/node/sharedProcessTunnelService.ts`）。id 入表发生在 `startTunnel` 创建隧道之后、返回之前。产品调用在 `src/vs/workbench/services/tunnel/electron-browser/tunnelService.ts`：`_createSharedProcessTunnel` 先 `await startTunnel`，返回后才 `createInstance(SharedProcessTunnel)`。构造函数里的 `_updateAddress` 才调用 `setAddress`。此时 id 已经在表里。发现稿要求创建 id 时就把 `TunnelData` 放进表；当前产品顺序用不到这条。

### r05-5

问题类：spdlog 创建失败并返回 `null` 后，日志继续追加到内存数组，且不会再创建 logger。

不变量：创建尚未落定前，已有缓冲行为保持不变；创建成功时把这段缓冲写盘并清空。`createSpdLogLogger` 返回 `null` 之后，`log()` 不再 `buffer.push`。失败不向调用方抛错。不重新创建 logger，也不清掉已经落定的创建 promise。

要动的符号或文件：`src/vs/platform/log/node/spdlogLog.ts` 的 `SpdLogLogger._createSpdLogLogger` 与 `log`。创建结果为 `null` 时记下失败，之后的 `log()` 不再 `buffer.push`。失败前已经进入 `buffer` 的记录留在内存里。这次不新增创建。

明确不改什么：`_loggerCreationPromise` 保持 `private readonly`，构造函数里只赋值一次。`flush` 与 `dispose` 上 `this._loggerCreationPromise.then(...).catch(onUnexpectedError).catch(onUnexpectedError)` 两条保持原样。`src/vs/platform/log/test/node/platformIpcLogLeftoverPromiseCatchScan.test.ts` 把这条 `readonly` 签名和这两条双 catch 钉在源码里，并把六个文件里的双 catch 总数钉成 9。`createSpdLogLogger` 里吞掉加载失败的 `try/catch`、`SpdLogLevel` 映射、日志 pattern、成功路径上的 `setLogLevel` 和缓冲回放保持不动。

怎样本地验证：在 `src/vs/platform/log/test/node/` 新增断言，测试标题必须包含 `spdlog`：创建函数返回 `null` 后，后续 `log()` 不增加 `buffer` 长度。不断言失败后会再次创建。既有 `platformIpcLogLeftoverPromiseCatchScan` 仍通过。用 `scripts/test.sh --grep "spdlog"` 跑。

## 审查

2026-10-30 只读审查的结论是须改稿。Critical 无。已按活码改入：依赖路径改为本仓 `node_modules/@vscode/sandbox-runtime`；不再把家目录拒绝读和 `~/` 允许项写成已经对上；r05-4 补上 drop 反证；r05-3 的验证改为第一次 `listen` 的 `error`，而不是起始端口被占用；r05-5 不再清 `readonly` 的 `_loggerCreationPromise`。Minor 已并入正文：`denyRead` 指配置 JSON，不指 `checkFileAccess` 的返回值；新测试标题必须含对应 `--grep` 片段。
