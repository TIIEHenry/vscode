---
title: "方案 r13：contrib-rest"
type: plan
status: draft
phase: N/A
updated: 2026-10-11
summary: "hold 5，drop 0，weaken 0。五条引用的行为仍在原位置。"
---

hold 5，drop 0，weaken 0。

## r13-1（hold，高）

### 问题类
同一配置目标下，后启动的 MCP 沙箱带上此前各服务器的工作目录写权限，并覆盖同一份设置文件。

### 不变量
一次 `_updateSandboxConfig` 写入的 `filesystem.allowWrite` 只含该次 `sandboxConfig.filesystem.allowWrite`、固定默认 `~/.npm`，以及这一次的 `launchCwd`。进程内其它启动的工作目录不得出现。同一次进程里，不同启动写出的设置文件路径不得相同。

### 要动的符号或文件
`src/vs/workbench/contrib/mcp/common/mcpSandboxService.ts`：

- `_getDefaultAllowWrite`（第 430–437 行）改为每次返回新数组：`'~/.npm'` 加上本次参数里 trim 后非空的目录。禁止 `push` 到实例字段。
- 删掉 `_defaultAllowWritePaths`（第 85 行）的跨调用累积。`_withDefaultSandboxConfig`（第 401–407 行）仍只合并这一次数组。
- `_updateSandboxConfig`（第 385–397 行）去掉按 `ConfigurationTargetToString` 复用 `_sandboxConfigPerConfigurationTarget`（第 86 行）的分支。每次用 `generateUuid()` 生成新文件名再 `createFile`。该 Map 没有其它读者，一并删除。

### 明确不改
`isEnabled` 在 Windows 上返回 false。`_defaultAllowedDomains`。`applySandboxConfigSuggestion` 与 `_getSandboxConfigSuggestions` 写回用户 MCP 配置。不扫临时目录里的旧设置文件。

### 本地验证
`src/vs/workbench/contrib/mcp/test/common/mcpSandboxService.test.ts` 现有 `converts default cwd URIs for the target operating system` 与 `resolves relative cwd against the target-side default cwd` 只覆盖 cwd 解析。新增断言：同一实例、同一 `ConfigurationTarget`、两个不同 `launchCwd` 各写一次设置；第二次 `allowWrite` 含 `~/.npm`、该次 cwd 和该次自己的 allowWrite，不含第一次的 cwd；两次 `createFile` 的 URI 不同，第一次写入的正文不被第二次覆盖。

## r13-2（hold，高）

### 问题类
已有 MCP 输入密钥解析失败时被换成新密钥，解封失败又把内存密文清掉，下一次保存把空密文写回 `mcpInputs`。

### 不变量
`mcpEncryptionKey` 已有内容但 `JSON.parse` 或 `importKey` 失败时，存储里的密钥字符串保持原样，不生成、不写回新密钥。解封失败时 `IStoredData.secrets` 仍是原密文；`onWillSaveState` 不得把它写成 `undefined`。

不要把「一律抛出」写成已拍板。`_getEncryptionKey` 是 `Lazy`，拒绝会被实例缓存。`_sealSecrets` 在判空之前就 await 这把密钥，`setSecrets({})` 也会拒绝。`mcpRegistry.ts` 的 `_updateStorageWithExpressionInputs` 先 `setPlainText` 再 `setSecrets`，普通输入会一起存不进去。`getMap` 在有密文且解封失败时一直拒绝。除了 `clearAll`，要写一条恢复路径，并说明调用方是接住错误还是改走清空。测试要新建实例，同一实例上 `Lazy` 已经求过值就测不到。

### 要动的符号或文件
`src/vs/workbench/contrib/mcp/common/mcpRegistryInputStorage.ts`：

- `_getEncryptionKey`（第 37–58 行）：`existing` 为真且解析或导入抛错时，不要落到 `generateKey` 和 `_secretStorageService.set`。把该错误抛出。
- `_unsealSecrets`（第 174–179 行）：catch 中不要执行 `this._record.value.secrets = undefined`，不要 `return {}`。把错误抛出。这样 `clear`（第 99–102 行，解封之后才 `_didChange = true`）和 `setSecrets`（第 123–126 行）在解封失败时停住。
- `setPlainText`（第 117–119 行）不调用解封。密文不再被置空后，它置位 `_didChange` 时 `onWillSaveState`（第 78–86 行）仍写出原来的 `secrets`。

### 明确不改
密钥尚不存在时仍 `generateKey` 并写入 `mcpEncryptionKey`。算法名、长度、IV、存储键 `mcpEncryptionKey` / `mcpInputs`。`clearAll` 主动清空。成功路径的加解密。

### 本地验证
`src/vs/workbench/contrib/mcp/test/common/mcpRegistryInputStorage.test.ts` 套件 `Workbench - MCP - RegistryInputStorage`。保留 `setSecrets stores encrypted values that can be retrieved with getMap` 与 `storage persists values across instances`。新增断言：`setSecrets` 之后把 `mcpEncryptionKey` 换成非法 JSON 或无法 `importKey` 的字符串；`getMap`、`setSecrets`、`clear` 拒绝；秘密存储里的密钥字符串不变；随后 `setPlainText` 触发 `onWillSaveState` 后，`mcpInputs.secrets` 仍是原来的密文。

## r13-3（hold，高）

### 问题类
内联聊天读不到修改前内容时，把非新建外部编辑的拒绝基线记成空字符串，拒绝会把文件内容恢复成空。

### 不变量
`editKind !== 'create'` 时，只有成功读到 `beforeContentUri` 才建立 `ChatEditKind.Modified` 条目，并把读到的字符串（含成功读到的空文件）写入 `_initialContents`。没有 `beforeContentUri` 或读取抛错时，不建条目、不写入 `''`。`editKind === 'create'` 仍以 `ChatEditKind.Created` 跟踪，拒绝时删除文件。

### 要动的符号或文件
`src/vs/workbench/contrib/inlineChat/browser/inlineChatEditReviewSession.ts`：

- `_readBeforeContent`（第 270–280 行）把「无 uri / 读取抛错」和「成功读到的字符串」分开。失败不得返回 `''`。
- `_createExternalEditEntry`（第 237–250 行）：非 create 且修改前内容读失败时抛出，不 `set` 空基线，不调用 `_getOrCreateEntry`。create 在无修改前内容时仍用空字符串和 `ChatEditKind.Created`。
- 抛出后由 `_processExternalEditsNow`（第 189–196 行）现有 catch 记录错误并继续其它 part。该 catch 不补建条目，文件保持外部编辑留下的内容。

拒绝侧保持现状：`ChatEditingModifiedDocumentEntry` 用 `initialContent` 建立 `originalModel`（`chatEditingModifiedDocumentEntry.ts` 第 125–128 行），`_doReject`（第 300–301 行）对非新建条目调用 `ChatEditingTextModelChangeService.undo`（第 332–336 行），用 `originalModel` 覆盖当前内容。

### 明确不改
`_getOrCreateExternalEditEntry` 对 `delete`、`rename` 和目标 uri 的提前返回（第 201–203 行）。`_doReject` 里 `createdInRequestId` 命中时的删文件分支。`_processExternalEditsNow` 的 catch 不改成吞掉错误后再建 `Modified`。成功读到空字符串时仍允许 `Modified`。

### 本地验证
`src/vs/workbench/contrib/inlineChat/test/browser/inlineChatEditReviewSession.test.ts`。保留 `creates an entry for an off-target external edit using its before content` 与 `tracks a created off-target file as created so rejecting deletes it`。新增断言：`editKind: 'edit'` 且没有 `beforeContentUri`，或 `beforeContentUri` 读取抛错时，不为该 uri 建条目，`_initialContents` 不含 `''`，随后 `reject` 不把该文件模型写成空。再增一条：修改前内容成功读到空字符串时仍建 `Modified`，`initialContent === ''`。

## r13-4（hold，高）

### 问题类
云端编辑会话删除失败仍记为恢复成功；文件若已回到工作区且不在当前变更列表里，下次自动恢复会再次删除它，且不确认。

### 不变量
`EditSessionsStorageService.delete` 在 `deleteResource` 抛错时向外抛出。`resumeEditSession` 只有删除成功才写 “Deleted” 和 `resumeSucceeded`。本机已经应用过的 ref，下次 `resumeEditSession(undefined, true, ...)` 不得再对它执行 `ChangeType.Deletion` 的 `fileService.del`。

`delete` 改为抛出时，同一改动里要接住现有调用方。`workspaceStateSync.ts` 约第 152 行不 await、不 catch，抛出后是未处理 rejection，`editSessionsLeftoverPromiseCatchScanD778.test.ts` 还按源码文本钉了这行。`editSessionsViews.ts` 约第 135、164 行的用户删除行为也会变。删除失败时若文件已经应用，不要让每次启动都弹 “Failed to resume”。

### 要动的符号或文件
- `EditSessionsStorageService.delete`（`src/vs/workbench/contrib/editSessions/browser/editSessionsStorageService.ts` 第 172–183 行）：catch 里 `logService.error` 之后 `throw ex`。
- `EditSessionsContribution.resumeEditSession`（`editSessions.contribution.ts` 第 561–575 行）：文件循环和 `workspaceStateSynchronizer.apply` 成功后、调用 `delete` 之前，用已注入的 `storageService` 以 `StorageScope.WORKSPACE` 记下该 `ref`。`delete` 成功后再 `remove` 该键，然后才写第 573–575 行的 “Deleted” 与 `resumeSucceeded`。`delete` 抛错时让第 576–578 行的 catch 接住，不写 `resumeSucceeded`，不清除已记下的 ref。
- 再次进入应用循环时，若读到的 `ref` 等于已记下的 ref，跳过第 564–565 行的 `fileService.del`，仍调用 `delete` 重试云端删除。`willChangeLocalContents`（第 662–665 行）在 uri 不在 SCM 变更集时返回 false，确认框挡不住这次重复删除，所以跳过放在删除分支本身。`autoResumeEditSession`（第 198–203 行）继续调用 `resumeEditSession(undefined, true, ...)`，不另开入口。

### 明确不改
首次应用、且 ref 未记下时的 `ChangeType.Addition` 写入和删除。`willChangeLocalContents` 的比较。路径穿越拦截。`registerResetAuthenticationAction` 里用户确认后的 `storeClient?.deleteResource('editSessions', null)`（`editSessionsStorageService.ts` 第 566 行）。不新增 `resumeSucceeded` 以外的 outcome。

### 本地验证
`src/vs/workbench/contrib/editSessions/test/browser/editSessions.test.ts` 套件 `Edit session sync` 现有 `Can apply edit session` 等用例不覆盖删除失败。新增断言：`deleteResource` 抛错时 `delete` 向外抛出；应用了含 `ChangeType.Deletion` 的会话后不出现 `resumeSucceeded`；同一 ref 再次 `resumeEditSession(undefined, true)` 时，已存在且不在 SCM 变更集中的删除目标不再被 `del`；该次 `delete` 成功后才出现 `resumeSucceeded`。首次恢复且删除成功的路径仍上报 `resumeSucceeded`。

## r13-5（hold，中）

### 问题类
Linux 上把密码存储从 gnome / gnome-keyring 迁到 gnome-libsecret 时，迁移标记在 argv 写入完成前落盘，失败后不再重试。

### 不变量
argv 需要迁移时，只有 `jsonEditingService.write` 成功返回之后，才把 `encryption.migratedToGnomeLibsecret` 存为 true。write 拒绝时标记保持未设置，下次调用再写 argv。`password-store` 不是 `gnome` 或 `gnome-keyring` 时不调用 write，仍可写标记。

### 要动的符号或文件
`EncryptionContribution.migrateToGnomeLibsecret`（`src/vs/workbench/contrib/encryption/electron-browser/encryption.contribution.ts` 第 32–45 行）：`await this.jsonEditingService.write(...)`。`storageService.store('encryption.migratedToGnomeLibsecret', true, ...)` 放在该 await 之后，仍在同一 `try` 内。write 拒绝时走现有 catch，只 `console.error`，不写标记。

`JSONEditingService.write`（`src/vs/workbench/services/configuration/common/jsonEditingService.ts` 第 39–41 行）返回的 Promise 在队列里的 `doWriteConfiguration` 结束后才完成。

### 明确不改
第 33–35 行 `!isLinux` 和已有标记的短路。目标值 `gnome-libsecret`。`JSONEditingService.write` 的签名、队列和保存。`registerWorkbenchContribution(..., LifecyclePhase.Eventually)`。

### 本地验证
仓库没有 encryption 贡献测试。`EncryptionContribution` 目前未导出；导出该类供测试构造，注册行保持不动。新增断言：Linux 且 argv 的 `password-store` 为 `gnome` 或 `gnome-keyring` 时，write 拒绝则 `encryption.migratedToGnomeLibsecret` 不为 true，再次调用会再次 write；write 成功后标记为 true，再次调用直接返回且不再 write。非 Linux，或标记已为 true 时，不读 argv。
