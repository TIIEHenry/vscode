---
title: "审查 r06：platform"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "托管设置读失败会卸掉企业限制；同步机器列表可能被空数据或过期写入覆盖；代理登录会挂起，过期 cwd 会返回给调用方。"
---

## r06-1 高
- 症状：已经加载过的企业托管设置，在随后一次读取或解析失败时被整表清空，MCP / hooks / 旁路权限等限制随之失效。
- 位置：`src/vs/platform/policy/common/fileManagedSettingsService.ts` 第 102–110 行
- 引用：`catch` 里除了过期的刷新代次，无论是 `FILE_NOT_FOUND` 以外的读错误还是 `JSON.parse` 抛错，都执行 `_rawManagedSettings = {}` 与 `_managedSettings = {}`。
- 为什么是问题：清空后这些键变为缺省。同目录 `copilotManagedSettings.ts` 写明 `strictKnownMarketplaces`、`allowedMcpServers` 缺省即不限制（第 37–40 行）。文件超过 1MB（`FILE_TOO_LARGE`）、暂时读不到或写到一半，都会把上一份已经生效的限制卸掉，并且失败路径没有重试。文件不存在才应该视为没有策略。
- 方向：非「文件确定不存在」的失败保留上一份已生效设置，或按限制项 fail-closed，不要换成空对象。

## r06-2 高
- 症状：机器同步数据不是合法 JSON 时被当成空列表，随后的添加或启用写入会把服务器上的机器列表盖成空的。
- 位置：`src/vs/platform/userDataSync/common/userDataSyncMachines.ts` 第 211–222 行
- 引用：`parse` 在 `JSON.parse` 失败时只打日志，然后返回 `{ version: VERSION, machines: [] }`。`addCurrentMachine`（第 112–114 行）发现当前机器不在列表里就会 `writeMachinesData`；`setEnablements`（第 141–149 行）改完后无条件写回。
- 为什么是问题：空列表的 `version` 等于当前版本，`readMachinesData` 的版本检查不会拒绝它。损坏内容因此被当成一份合法的空数据写回 `machines` 资源，其它机器的名称和禁用状态丢失。`content === null` 的首次同步可以是空列表，解析失败不应该走同一条写回路径。
- 方向：解析失败要抛错或拒绝写回，不要把损坏内容收成当前版本的空机器列表。

## r06-3 中
- 症状：两次机器列表写入重叠时，先发出的旧内容仍会落到服务器上，后完成的那次反而可能成为最终数据。
- 位置：`src/vs/platform/userDataSync/common/userDataSyncMachines.ts` 第 181–189 行
- 引用：`writeMachinesGeneration` 在 `writeResource` 之前递增，但比较发生在 `await writeResource(...)` 之后；代次已过期时只是 `return`，不再更新本地 `userData`。
- 为什么是问题：旧写入已经上传。它若后完成，服务器落到旧的机器列表，本地仍留着更新那次的 `ref`。重命名、禁用或删除会被盖回。代次只丢掉了本地缓存更新，没有挡住这次上传。
- 方向：写之前若代次已过期就不要调用 `writeResource`，或按资源版本拒绝过期写入。

## r06-4 中
- 症状：代理登录对话框所在窗口关掉或此时没有 `webContents` 时，凭据 Promise 永远不结束，后面的代理登录一起停住。
- 位置：`src/vs/platform/native/electron-main/auth.ts` 第 195–235 行
- 引用：`await new Promise` 只在 `ipc-message` 回调里 `resolve`；监听用 `window.win?.webContents.on(...)`。`proxyAuthResolveCredentials.ts` 第 116–117 行每次都 `await previousDialog` 再弹下一个对话框。
- 为什么是问题：`windowImpl.ts` 的 `send`（第 1628–1631 行）在窗口已销毁时直接返回，不会回调这条 channel。没有窗口关闭、超时或 `win` 为空时的 `resolve`。第一条对话框挂起后，`currentDialog` 链上的后续代理认证都不会再出现。
- 方向：窗口关闭、`webContents` 不存在或发送失败时结束这次 Promise，不要让它留在 `currentDialog` 上。

## r06-5 中
- 症状：重叠的工作目录查询里，先发出的那次会把已经过期的路径返回给调用方。
- 位置：`src/vs/platform/terminal/common/capabilities/naiveCwdDetectionCapability.ts` 第 23–26 行
- 引用：`const generation = ++this._cwdGeneration` 之后 `await this._process.getCwd()`；若 `generation !== this._cwdGeneration` 则 `return newCwd`。
- 为什么是问题：代次不一致说明这次结果已经过期，缓存 `_cwd` 也不会被它改写，但返回值仍是这次旧查询。调用方拿到的路径不是后一次查询确认的当前目录，终端工作目录会显示或使用到旧路径。
- 方向：过期的那次不要返回旧的 `newCwd`，应丢掉或改返回已经记下的更新结果。
