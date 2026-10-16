---
title: "方案 r04：platform"
type: plan
status: implemented
phase: N/A
updated: 2026-10-16
summary: "hold 4，drop 0，weaken 0。r04-1 到 r04-4 四条平台缺陷均已在生产代码和单测中落地，单测全部通过。"
---

# 方案 r04：platform

> **落地记录（2026-10-16）：** `status: implemented`。r04-1 到 r04-4 四条平台缺陷均已在生产代码和单测中落地，单测全部通过：
> - **r04-1**（`src/vs/platform/userDataSync/common/abstractSynchronizer.ts`）：`getLocalFileContent` 捕获仅在 `FILE_NOT_FOUND` 时返回 `null`，其余错误原样抛出，避免将读取失败误当空设置覆盖远端（单测 `src/vs/platform/userDataSync/test/common/settingsSync.test.ts`）；
> - **r04-2**（`src/vs/platform/universeAgent/node/sessionViewHost.ts`）：`post` 在 `submitInput` 被接受时，返回的 `correlation.id` 等于写进 fact 的 `writeId`（单测 `src/vs/platform/universeAgent/test/node/sessionViewHostIntentOwner.test.ts`、`src/vs/platform/universeAgent/test/node/sessionViewHostChangedIds.test.ts`）；
> - **r04-3**（`src/vs/platform/universeAgent/node/universeAgentHubService.ts`）：`addHubDeviceProfile` 的 `find` 增加了 `accountId`、`profile.state !== 'revoked'` 与 `profile.state !== 'disabled'` 过滤，避免误复用已撤销或已停用 profile（单测 `src/vs/platform/universeAgent/test/node/universeAgentHubService.test.ts`）；
> - **r04-4**（`src/vs/platform/universeAgent/node/pairingOrchestrator.ts`）：`confirmSas` 中 `createPinnedTransport` 之后立刻进入 `try/finally`，确保任何退出分支（签名器不可用、代际过期、握手结束等）均执行 `transport.close()`（单测 `src/vs/platform/universeAgent/test/node/pairingOrchestrator.test.ts`）。

hold 4，drop 0，weaken 0。

## r04-1（hold，高）

### 问题类
设置文件读失败被当成空设置，远端未变时写回云端。

### 不变量
`getLocalFileContent` 只有在 `toFileOperationResult(error) === FileOperationResult.FILE_NOT_FOUND` 时返回 `null`。权限拒绝、文件过大和其它 IO 错误原样抛出。`SettingsSynchroniser.generateSyncPreview` 与 `hasRemoteChanged` 只在得到 `null`（文件不存在）时把本地内容当成 `'{}'`。抛出的读错误在 `updateRemoteUserData` 之前离开本次 `sync`，远端正文保持同步前的内容。

### 要动的符号或文件
`AbstractFileSynchroniser.getLocalFileContent`（`src/vs/platform/userDataSync/common/abstractSynchronizer.ts` 第 809–814 行）：`catch` 里用本文件已有的 `toFileOperationResult`，仅 `FILE_NOT_FOUND` 返回 `null`，其余 `throw error`。

`SettingsSynchroniser.generateSyncPreview`（`src/vs/platform/userDataSync/common/settingsSync.ts` 第 100–102 行）和 `hasRemoteChanged`（第 156–161 行）继续只把 `null` 换成 `'{}'`，不要捕获这次抛出的读错误。`performSync` 对非 `UserDataSyncError` 会在第 353 行 `throw e`，因此走不到 `applyResult` 第 243–250 行的 `updateRemoteUserData`。

### 明确不改
不改 `merge` 在本地相对基线变化、远端未变时返回无冲突 `remoteContent` 的分支（`src/vs/platform/userDataSync/common/settingsMerge.ts` 第 116–117 行）。文件确实不存在时仍按空设置合并。不改 `doGenerateSyncResourcePreview` 对无冲突预览的自动接受。不改 `keybindingsSync` 与 `abstractJsonSynchronizer` 的合并公式；它们共用 `getLocalFileContent`，非缺失读错误同样中止，不要在那些类里把错误再吞成空内容。不改 `SettingsSynchroniser.hasLocalData` 里已有的 `FILE_NOT_FOUND` 判断。

### 本地验证
`src/vs/platform/userDataSync/test/common/settingsSync.test.ts` 套件 `SettingsSync - Auto` 没有读失败用例。新增断言：上次同步内容与远端一致且含非忽略设置时，`readFile` 抛出 `FileOperationResult.FILE_PERMISSION_DENIED` 或 `FILE_TOO_LARGE`，`sync` 拒绝，远端正文仍是同步前的内容。同一夹具下 `FILE_NOT_FOUND` 仍把本地当成 `'{}'` 并按现有合并写远端。

## r04-2（hold，中）

### 问题类
`submitInput` 接受结果的 correlation 对不上发送行的 operationId。

### 不变量
`SessionViewHost.post` 在 `submitInput` 被接受时，返回的 `correlation.id` 等于写进 fact、并成为 `upsertLocalSend.operationId` 的那个 `IdPort.nextWriteId()`（`write:N`）。同一帧 `applied.changedIds` 含 `send:` 加上这个 id。

### 要动的符号或文件
`SessionViewHost.post`（`src/vs/platform/universeAgent/node/sessionViewHost.ts` 第 477–486 行）：先把 `this.ids.nextWriteId()` 存进局部变量，再传给 `writeMessageToCoreFact`。`outcome.accepted` 且 `msg.kind === 'submitInput'` 时，返回 `{ id: String(该变量) }`。

### 明确不改
不改 `createSessionCore` 的 `nextCorrelation`（`src/vs/platform/universeAgent/node/sessionCore/session-core.ts` 第 112–115、162 行），其它 post 仍返回 `c:N`。不改 `pendingSendViewFromSubmit` 用 fact correlation 作 `operationId`（`src/vs/platform/universeAgent/node/sessionCore/local-pending-sends.ts` 第 123 行）。不改 `changedIdFromPatch` 的 `send:` 前缀（`sessionViewHost.ts` 第 2207–2208 行）。不改 `regenerateTurn` 与 `permissionRespond` 的返回 id。

### 本地验证
扩展 `src/vs/platform/universeAgent/test/node/sessionViewHostIntentOwner.test.ts` 的 `submitInput local-send operationId uses IdPort write: correlation`：`outcome.correlation.id` 等于该帧 `upsertLocalSend` 的 `operationId`。扩展 `src/vs/platform/universeAgent/test/node/sessionViewHostChangedIds.test.ts` 的 `local send frames carry send:<operationId> and sync chrome carries sync`：`changedIds` 含 `` `send:${outcome.correlation.id}` ``。

## r04-3（hold，中）

### 问题类
再次添加 Hub 设备时，别的账号或已撤销、已停用的 profile 被当成添加成功。

### 不变量
`addHubDeviceProfile` 只把同时满足当前 `accountId`、同一 Hub URL 身份键、同一 `hubDeviceId`，且 `state` 不是 `revoked` 或 `disabled` 的记录当作已存在。否则新建 `pairingPending` 草稿，`target.accountId` 为当前账号。

### 要动的符号或文件
`UniverseAgentHubService.addHubDeviceProfile`（`src/vs/platform/universeAgent/node/universeAgentHubService.ts` 第 461–468 行）：`find` 增加 `profile.target.accountId === accountId`，以及 `profile.state !== 'revoked' && profile.state !== 'disabled'`。未命中时仍走第 469–475 行的 `createDraft`（`target` 含当前 `accountId`）和 `put`。

### 明确不改
同一账号、同一 Hub、同一设备且 `state` 为 `active` 或 `pairingPending` 时，仍返回已有 `profileId`。不改 `_markHubDeviceProfilesRevoked`（第 533–545 行）把记录标成 `revoked` 的方式。添加路径不删除旧记录。不改 `ConnectionProfileStore.createDraft` 的 `pairingPending`。

### 本地验证
`src/vs/platform/universeAgent/test/node/universeAgentHubService.test.ts` 套件 `UniverseAgentHubService addHubDeviceProfile`。保留 `addHubDeviceProfile creates then reuses a hubDevice profile`：连续两次添加仍是同一个 `pairingPending` profile。新增断言：同 Hub、同设备、`state` 为 `revoked` 或 `disabled` 时返回新的 `profileId`，新记录 `accountId` 为当前账号、`state` 为 `pairingPending`；同 Hub、同设备但 `target.accountId` 不同时同样新建，不返回那条旧 `profileId`。

## r04-4（hold，低）

### 问题类
SAS 确认在签名器失败时不关闭已创建的传输。

### 不变量
`confirmSas` 在 `createPinnedTransport` 成功返回之后，`createSigner` 抛错、返回空、代际过期，以及握手结束，都执行一次 `transport.close()`。

### 要动的符号或文件
`PairingOrchestrator.confirmSas`（`src/vs/platform/universeAgent/node/pairingOrchestrator.ts` 第 375–448 行）：`createPinnedTransport` 之后立刻进入 `try/finally`，把第 380–386 行的 `createSigner`、代际检查和 `signer_unavailable` 返回放进现有 `try`。`finally` 只保留第 448 行的 `transport.close()`。删掉第 382 行代际过期分支里单独的 `transport.close()`。

### 明确不改
`createPinnedTransport` 自己抛错时还没有传输，不调用 `close`。代际过期仍返回 `staleConfirmSas()`。签名器为空仍返回 `signer_unavailable`。不改恢复信任路径里已经包住 `createSigner` 的 `try/finally`（第 619–670 行）。

### 本地验证
`src/vs/platform/universeAgent/test/node/pairingOrchestrator.test.ts` 套件 `pairingOrchestrator H2` 没有「签名器失败仍 close」的用例。新增：`createSigner` 解析为 `undefined` 时结果码为 `signer_unavailable`，且该次 `createPinnedTransport` 返回的传输 `close` 被调用一次；`createSigner` 拒绝时错误继续抛出，`close` 仍被调用一次。

## 审查记录

2026-10-11 Sonnet 第 1 路，Minor，不改变 hold：

2026-10-16：r04-1 到 r04-4 四条缺陷均已在生产代码与单测中落地，测试全部通过，状态置为 `implemented`。


- r04-2：`writeMessageToCoreFact` 里 `regenerateTurn` 同样把 `nextWriteId()` 写进 fact 的 `correlation`，返回的也是 `c:N`。只修 `submitInput` 时要写明 `regenerateTurn` 的 id 没有消费者，或把它一并列入。
- r04-3：`addHubDeviceProfile creates then reuses a hubDevice profile` 在 `universeAgentHubService.test.ts` 的 `runtime refresh` 套件（约第 320 行）。`addHubDeviceProfile` 套件（约第 398 行起）里对应的是 `signedIn creates hubDevice profile with accountId userId and reuses same id`。`canonical hub URL` 套件也依赖同账号同设备复用，改条件时要确认那条预置 profile 仍然命中。
