---
title: "方案 r06：platform"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 4，drop 0，weaken 1。读失败保留已生效托管设置；损坏机器列表拒绝写回；重叠写入串行且保留 etag；代理登录在窗口关闭时结束；过期 cwd 返回已提交路径。"
---

hold 4，drop 0，weaken 1。

# 怎么改

## r06-1 高

问题类：已经加载的企业托管设置，在随后一次读失败或解析失败时被换成空对象，限制键缺省后不再限制。

不变量：

- `FileOperationResult.FILE_NOT_FOUND` 时，`_rawManagedSettings` 与 `_managedSettings` 仍变为 `{}`；与上一份不等时照旧触发对应的 change 事件。
- `generation !== this._refreshGeneration` 或 `_store.isDisposed` 时，`refresh` 直接返回，两份缓存保持调用中的值。
- `readFile` 成功且 `JSON.parse` 得到对象时，仍把该对象交给 `normalizeManagedSettings` 后写入两份缓存。
- 其余失败保持失败前的两份缓存：`FILE_TOO_LARGE`、其它读错误、`JSON.parse` 抛错、以及解析结果通过 `isObject` 却不是对象（`fileManagedSettingsService.ts` 第 97–100 行，与 `catch` 第 109–110 行是同一对赋值）。此前从未加载成功时，缓存维持构造时的 `{}`。
- 失败路径不另加定时重试。文件再次变化仍由现有的 `scheduleRefresh` 触发下一次 `refresh`。

要动的符号或文件：`FileManagedSettingsService.refresh`（`src/vs/platform/policy/common/fileManagedSettingsService.ts` 第 97–110 行）。`catch` 里仅 `FILE_NOT_FOUND` 执行清空；其它错误只打现有的 error 日志。第 97–100 行的非对象分支改为留下 `previousRaw` / `previous`，警告日志保留。

明确不改什么：

- `MANAGED_SETTINGS_MAX_FILE_SIZE`（1MB）以及超限抛出 `FILE_TOO_LARGE` 的读限制。文件头第 19–22 行已写明超限走读失败。
- `normalizeManagedSettings`，以及缺省即不限制的契约：`copilotManagedSettings.ts` 第 37–41 行对 `strictKnownMarketplaces`、`allowedMcpServers` 的说明；`checkMcpServerAllowed`（`allowedMcpServers.ts` 第 85–92 行）在 allowlist 为 `undefined` 时返回允许；`getStrictKnownMarketplaces`（`strictKnownMarketplaces.ts` 第 34–36 行）在值不是数组时返回 `undefined`。
- `FileManagedSettingsChannelClient` 的快照与事件代次。

怎样本地验证：保留并通过 `reads managed-settings.json on startup`、`returns empty object when file does not exist`、`fires event when file changes`、`returns empty object when the file is malformed JSON`、`returns empty object when the file is not a JSON object`、`clears managed settings and fires when the file is deleted`。后两个「空对象」用例是文件从一开始就不可用、缓存本来就是 `{}`，期望维持为空。新增断言意图：先写入合法对象并等到 `managedSettings` 里出现已加载的键，再分别换成残缺 JSON、让 `readFile` 以 `FileOperationResult.FILE_TOO_LARGE` 拒绝、以及写成 JSON 数组；这三次之后 `rawManagedSettings` 与 `managedSettings` 仍是上一份，且不会再发一次把这些键清空的 change。命令：`scripts/test.sh --run src/vs/platform/policy/test/common/fileManagedSettingsService.test.ts --grep FileManagedSettingsService`。

## r06-2 高

问题类：机器同步内容不是合法 JSON 时被收成当前版本的空列表，随后的添加或启用会把这份空列表写回服务器。

不变量：

- `userData.content === null` 时，`parse` 仍返回 `{ version: UserDataSyncMachinesService.VERSION, machines: [] }`。
- `JSON.parse` 抛错时，`parse` 把错误抛出（日志可保留）。`readMachinesData` 因此不能把 `{ version: 1, machines: [] }` 交给写入方。`addCurrentMachine`、`removeCurrentMachine`、`renameMachine`、`setEnablements` 都不会调用 `writeMachinesData`。
- `machinesData.version !== UserDataSyncMachinesService.VERSION` 时，仍抛现有的 incompatible 错误（第 175–177 行）。
- 解析成功且版本匹配时，`addCurrentMachine` 仍只在当前机器不在列表里时写入（第 112–114 行）；`removeCurrentMachine` 与 `renameMachine` 仍只在名单真有变化时写入。`setEnablements` 在循环之后无条件 `writeMachinesData`（第 149 行）只适用于这次读到的是合法数据；合法的空列表被原样写回不在本条范围内。

要动的符号或文件：`UserDataSyncMachinesService.parse`（`src/vs/platform/userDataSync/common/userDataSyncMachines.ts` 第 211–222 行）。`catch` 里去掉返回当前版本空列表的那条路径，改为抛出解析错误。

明确不改什么：

- `content === null` 的空列表，以及 `readMachinesData` 的版本比较文案。
- `writeMachinesData` 的代次与 `writeResource` 的 `If-Match`（见 r06-3）。
- `getMachines` 对合法空列表的映射。

怎样本地验证：`src/vs/platform/userDataSync/test` 下没有 `UserDataSyncMachinesService` 的单测。`userDataAutoSyncService.test.ts` 里的 `setEnablements` 与 `removeCurrentMachine` 调用的是合法数据，保持原样。新增断言意图：`content` 为残缺 JSON 时，`getMachines`、`addCurrentMachine`、`setEnablements` 均拒绝，且 fake 的 `writeResource` 调用次数为 0。`content === null` 时 `getMachines` 得到空列表，且这次读取本身不调用 `writeResource`。断言放在 `src/vs/platform/userDataSync/test/common/` 的新测试文件里，用 `scripts/test.sh --run <该文件>` 执行。

## r06-3 降为低

反证：`writeMachinesData` 第 184 行把 `this.userData?.ref` 传进 `UserDataSyncStoreService.writeResource`。`userDataSyncStoreService.ts` 第 393–395 行在 `ref` 为真时设置 `If-Match`；第 658–659 行对 HTTP 412 抛出 `UserDataSyncErrorCode.PreconditionFailed`。`writeMachinesData` 没有 `catch`。两次重叠写入捕获的是同一个 ref 时，后返回的那次在 412 上抛错，不会把旧机器列表写成服务器上的最终内容，也走不到第 185–186 行。`readResource` 第 370–371 行在响应没有 etag 时抛错，因此一次成功的读取之后，写入都会带上 ref。发现稿里「旧写入后完成、服务器落到旧列表、本地仍留着更新那次的 ref」在这条路径上不成立。

仍成立的部分：代次在 `await writeResource` 之后才比较（第 183–186 行）。先被服务器接受的那次若返回时代次已过期，新 etag 不会写入 `this.userData`。后发的那次以 412 抛出，函数不重读。本地 ref 停在写之前的值，下一次写入继续使用旧的 `If-Match`。

问题类：重叠的机器列表写入不会在发出前按代次取消；If-Match 会拒绝后到的请求，但先成功的那次若代次已过期会丢掉新 etag。

不变量：

- 同一时刻至多一次 `writeResource` 在飞。尚未调用 `writeResource` 时，若 `generation !== this.writeMachinesGeneration` 或已 dispose，这次内容不上载。
- 同一次同步调用里先后进入两次 `writeMachinesData` 时，先进入、尚未发出的那次不上载，发出的是后一次的 `content`。
- 已经发出的那次成功返回后，只要未 dispose，就把返回的 etag 与这次 `content` 写入 `this.userData` 并触发 `onDidChange`，供下一次排队写入用作 `If-Match`。
- `writeResource` 抛错（含 412）时错误仍传给调用方；队列继续，后面的写入不会停在这次拒绝上。本条不在 412 上重读或合并。
- dispose 之后不改 `this.userData`，不触发 `onDidChange`。

要动的符号或文件：`UserDataSyncMachinesService.writeMachinesData` 与 `writeMachinesGeneration`（`userDataSyncMachines.ts` 第 181–189 行）。用一条串行队列把「代次检查」放到调用 `writeResource` 之前；成功返回后写入 etag 的赋值放在 dispose 检查之后，不再放在「代次已过期则 return」里。队列上的拒绝要与调用方看到的拒绝分开，避免一次失败把后续写入永久挂起。

明确不改什么：

- `parse`、`readMachinesData` 的版本检查、`addCurrentMachine` / `setEnablements` 的写入条件。
- `UserDataSyncStoreService.writeResource` 的 `If-Match` 与 412 抛错。
- 其它客户端改过同一资源时的冲突合并。

怎样本地验证：现有测试没有覆盖 `writeMachinesGeneration`。新增断言意图：fake `writeResource` 在第一次调用返回前允许第二次公开写入（`setEnablements` 每次都会写）。两次若在第一次进入 `writeResource` 之前就都已排队，则 `writeResource` 只被调用一次，请求体是后一次的机器列表。第一次若已经发出，则它完成后第二次的 `If-Match` 等于第一次返回的 etag，服务记录的 ref 等于第二次返回的 etag，最后一次请求体是后一次的列表。断言放在 `src/vs/platform/userDataSync/test/common/` 的新测试文件里，用 `scripts/test.sh --run <该文件>` 执行。

## r06-4 中

问题类：代理登录对话框的凭据 Promise 只在 ipc 回复里结束；窗口关掉、没有 `webContents` 或对话框没有送出时，它留在 `currentDialog` 上，后面的登录不再出现。

不变量：

- `getFocusedWindow() || getLastActiveWindow()` 为空时，仍在 `auth.ts` 第 176–179 行返回 `undefined`，不进入等待。
- 收到 `channel === payload.replyChannel` 的 ipc 时，仍按第 202–230 行：有 `reply` 则保存或删除凭据并 resolve 凭据；无 `reply` 则把 hash 放入 `cancelledAuthInfoHashes` 并 resolve `undefined`。
- `window.win` 为空、`BrowserWindow` 已销毁、`webContents` 已销毁，或 `IBaseWindow.onDidClose`（`window.ts` 第 24 行；`windowImpl.ts` 第 203–204 行在 `closed` 时触发）先于回复发生时，这次等待 resolve `undefined`。这三条路径不写入 `cancelledAuthInfoHashes`。
- 等待结束后，`doResolveProxyCredentials` 里已有的清理仍生效：`state.currentDialog === currentDialog` 时把它设为 `undefined`（`proxyAuthResolveCredentials.ts` 第 119–120 行）。下一次需要对话框的解析会再次调用 `showProxyCredentialsDialog`，而不是停在 `await previousDialog`（第 117 行）。
- `attempt === 1` 且代理 URL、session 或已存凭据可用时，仍不打开对话框。

要动的符号或文件：`ProxyAuthService.showProxyCredentialsDialog`（`src/vs/platform/native/electron-main/auth.ts` 第 192–235 行）。先订阅 `window.onDidClose` 与 `webContents` 的 `ipc-message`，再调用 `sendWhenReady`。调用前或调用后若没有可用的 `webContents`，直接 resolve `undefined` 并卸下监听。窗口关闭时同样 resolve `undefined` 并卸下监听。`CodeWindow.send`（`windowImpl.ts` 第 1627–1631 行）在窗口已销毁时直接返回，这里不修改它；发送前的销毁检查放在 `showProxyCredentialsDialog`。

明确不改什么：

- `CodeWindow.send` / `sendWhenReady` 的签名与销毁早退。
- `onLogin` 的 `preventDefault` 与 `callback`。
- `BrowserSession.isBrowserViewWebContents` 的提前返回。
- `pendingProxyResolves` 按 hash 合并。
- `doResolveProxyCredentials` 里 `await previousDialog` 的串行顺序，以及 `extensionTestsLocationURI` 短路。
- 用户在对话框里取消时写入 `cancelledAuthInfoHashes` 的行为（第 166–169 行与第 227–229 行）。

怎样本地验证：保留并通过 `attempt 1 returns config credentials from proxy URL without opening dialog`、`attempt 2 falls through to dialog and returns dialog credentials`。这两条不覆盖挂起。新增断言意图：把等待收成不导入 `electron.app` 的函数，注入 `onDidClose`、`webContents` 与发送函数。没有 `webContents` 时返回的 Promise 在当前回合结束后已完成，值为 `undefined`，且「记为用户取消」的回调次数为 0。订阅关闭之后触发 `onDidClose`，Promise 同样以 `undefined` 完成，取消回调次数为 0。该函数完成后，再调用一次 `doResolveProxyCredentials`（`attempt` 大于 1、没有可用的已存凭据），`showProxyCredentialsDialog` 被再次调用。命令：`scripts/test.sh --run src/vs/platform/native/test/node/proxyAuthResolveCredentials.test.ts --grep doResolveProxyCredentials`。

## r06-5 中

问题类：重叠的工作目录查询里，代次已经过期的那次仍把本次读到的旧路径返回给调用方。

不变量：

- `this._process` 缺失时，`getCwd` 仍返回空字符串。
- `await this._process.getCwd()` 之后代次仍等于 `this._cwdGeneration` 时：路径与 `_cwd` 不同才 `onDidChangeCwd.fire`，然后把 `_cwd` 设为该路径并返回 `_cwd`。
- 代次已过期时：不 fire，不改 `_cwd`，返回当时的 `_cwd`。更新一代尚未提交时，这个值是本次重叠查询开始前的 `_cwd`（初始为空字符串）。更新一代已经写过 `_cwd` 时，过期的那次返回这份已提交路径。两种情况下返回值都是 `_cwd`，不是这次的 `newCwd`。
- `TerminalInstance.getSpeculativeCwd`（`terminalInstance.ts` 第 2434–2435 行）与 `terminalActions.ts` 第 119–120 行的 `inherited` 继续使用该返回值。

要动的符号或文件：`NaiveCwdDetectionCapability.getCwd`（`src/vs/platform/terminal/common/capabilities/naiveCwdDetectionCapability.ts` 第 23–26 行）。代次不一致时 `return this._cwd`。

明确不改什么：

- `onDidChangeCwd` 的事件类型与最新一代的 fire 条件（第 28–31 行）。
- `TerminalProcessManager` 里 `NaiveCwdDetectionCapability` 的注册。
- `getInitialCwd`，以及带 `CwdDetection` 时 `getSpeculativeCwd` 走精确能力的分支（第 2432–2433 行）。

怎样本地验证：`src/vs/platform/terminal/test` 与 `terminalCapabilityStore.test.ts` 都没有覆盖 `_cwdGeneration`；后者只把该能力放进 store。新增断言意图：伪造 `_process.getCwd`，让先发出的调用在第二次 `getCwd` 开始之后才 resolve。先发出的 Promise 解析为当时已提交的 `_cwd`，`onDidChangeCwd` 不带那条旧路径。后发出且代次仍最新的那次解析为新路径，并只 fire 一次。若后发出的那次先 resolve，先发出的 Promise 解析为这份新路径，fire 仍只有一次。断言放在 `src/vs/platform/terminal/test/common/capabilities/` 的新测试文件里，用 `scripts/test.sh --run <该文件>` 执行。
