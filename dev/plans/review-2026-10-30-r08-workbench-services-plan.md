---
title: "十六路审查 r08：workbench services 方案"
type: plan
status: draft
phase: N/A
updated: 2026-10-30
summary: "5 条 hold，0 条 weaken。"
---

# 十六路审查 r08：workbench services 方案
状态：草案。
覆盖需求：无（正文未引用需求编号）。

| 编号 | 判定 | 严重度 |
|:-----|:-----|:-------|
| r08-1 | hold | 高 |
| r08-2 | hold | 中 |
| r08-3 | hold | 高 |
| r08-4 | hold | 高 |
| r08-5 | hold | 中 |

### r08-1

- 问题类：`JSONEditingService.getEdits` 在空 `path` 下把 `Edit.length` 设成新文本长度，短于原文时替换区间盖不住文件末尾。
- 不变量：空 `path` 表示替换模型全文。`Edit.length` 是被替换的原文跨度，必须等于 `model.getValue().length`。新文本更短时，落盘后的模型正文只能是这份新 JSON，后面不得留下旧后缀。新文本与旧文某个同长度前缀恰好相同时，也必须整文件替换，不能因为前缀相等就跳过编辑。
- 要动的符号或文件：
  - `JSONEditingService.getEdits`（`src/vs/workbench/services/configuration/common/jsonEditingService.ts`）：空 `path` 分支的 `length` 改为当前模型全文长度，与同目录 `configurationEditing.ts` 里 `getEdits` 的整文件分支一致。`content` 仍用现有的 `JSON.stringify`。
- 不改：
  - `applyEditsToBuffer` 对 `offset` / `length` 的解释。
  - 非空 `path` 继续走 `setProperty`。
  - `configurationEditing.ts` 里已经使用 `modelContent.length` 的整文件分支。
  - 不在这次把 `JSON.stringify` 改成模型的 EOL。仓内现有 `jsonEditingService.write` 调用传入的 `path` 都非空；空 `path` 仍是 `getEdits` 的显式分支，调用方这次不动。
- 本地验证：没有覆盖这条路径的测试。在 `src/vs/workbench/services/configuration/test/browser/jsonEditingService.test.ts` 新增断言：模型原文长于新 JSON 时，`write(resource, [{ path: [], value }], true)` 之后模型正文 `JSON.parse` 等于 `value`，且原文后缀不在结果里。再断言一种原文前缀与新文本完全相同、但原文更长的输入，编辑后仍不得留下后缀。空模型写入非空 JSON 仍然得到该 JSON。用 `scripts/test.sh --grep JSONEditingService` 跑这份新测试。

### r08-2

- 问题类：`IJSONEditingService.write` 的 `save` 未被实现读取，有编辑就 `textFileService.save`；`resolveAndValidate` 的 `checkDirty` 参数未被读取。
- 不变量：`save === false` 只改已解析模型的缓冲，不调用 `textFileService.save`，也不安装短延迟覆盖。`save === true` 且该资源已经脏时，在改缓冲之前拒绝，避免把无关的未保存编辑一起写盘。解析失败仍先于脏检查拒绝。`save === true` 且资源不脏时，编辑后保存。设置编辑器在 `getPositionToReveal` 里对尚未写入的设置传入 `false`，这次调用之后 `settingsModel.getPreference` 仍能读到刚写入缓冲的默认值。
- 要动的符号或文件：
  - `JSONEditingService.write`、`doWriteConfiguration`、`writeToBuffer`、`resolveAndValidate`（`jsonEditingService.ts`）。实现签名带上接口里的 `save`，并传到队列任务里。
  - `save === false` 时：应用 `getEdits` / `applyEditsToBuffer`，不调用 `filesConfigurationService.enableAutoSaveAfterShortDelay`，不调用 `textFileService.save`。立刻落盘来自 `textFileService.save`。`getAutoSaveMode` 在覆盖存在时会返回短延迟（`filesConfigurationService.ts`），但 `editorAutoSave.scheduleAutoSave` 读的是 `getAutoSaveConfiguration().autoSaveDelay`，该配置不看 `autoSaveAfterShortDelayOverrides`。桌面默认自动保存关闭时，内容变化不会因为这份覆盖被排进延迟保存。`writeToBuffer` 的 `finally` 也会当次丢掉覆盖。不要把「覆盖会把内容变化排进保存」写成改动理由；`save === false` 仍不安装覆盖，以免 `getAutoSaveMode` 对外报告短延迟。
  - `save === true` 时：把 `checkDirty` 传为 true。`resolveAndValidate` 仍先看 `hasParseErrors`，解析失败先拒绝。其后 `textFileService.isDirty(resource)` 为真则 `reference.dispose()` 后拒绝，缓冲保持原样。不脏则保持现在的「短延迟覆盖 + 编辑 + `textFileService.save`」。
  - `jsonEditing.ts` 的 `JSONEditingErrorCode` 增加脏文件这一种错误。`toErrorMessage` 在 `jsonEditingService.ts`，不在 `jsonEditing.ts`。现有枚举只有 `ERROR_INVALID_FILE`。
- 不改：
  - `preferencesService.ts` 的 `getPositionToReveal` 继续传 `false`。`SettingsEditorModel` 监听 `onDidChangeContent` 后会丢掉解析缓存，不保存也能让随后的 `getPreference` 看到缓冲里的新键。
  - 其它已经传入 `true` 的调用点不改参数。
  - 不在 `JSONEditingService` 上补 `configurationEditing.ts` 那套脏文件通知和 Save and Retry。
  - 解析错误时仍然拒绝，`hasParseErrors` 的规则不动。
- 本地验证：仓内没有 `jsonEditingService` 测试文件。`preferencesService.test.ts` 用的是 `TestJSONEditingService`。在 `src/vs/workbench/services/configuration/test/browser/jsonEditingService.test.ts` 新增断言三条：`save === false` 时模型含新编辑且 `textFileService.save` 调用次数为 0，原有未保存正文仍只留在模型里；`save === true` 且资源已脏时 promise 拒绝、模型字节不变、`save` 次数为 0；`save === true` 且不脏时 `save` 被调用。用 `scripts/test.sh --grep JSONEditingService` 跑。r08-1 的新断言也放在这个文件。

### r08-3

- 问题类：`migrateExtensionStorage` 在 `fileService.move` 失败后仍把 `extensionStorage.migrate...` 写成 true，并且在移动之前已经清掉源 state。
- 不变量：完成标记只有在文件迁移已经成功、或源目录不存在（`FileSystemProviderErrorCode.FileNotFound`）、或全局存储因小写后路径相同而跳过移动时才写入。其它移动错误只记现在的 info，然后返回。源 `setExtensionState(fromExtensionId, undefined, global)` 发生在移动成功或确认没有文件可搬之后。移动失败时源 state 与源目录都还在，目标 id 下还没有这次迁过去的 state。
- 要动的符号或文件：
  - `migrateExtensionStorage`（`src/vs/workbench/services/extensions/common/extensionStorageMigration.ts`）。路径不相等时先 `fileService.move`。`FileNotFound` 或路径相等（全局目录把 id 转成小写后可能相同，此时不调用 `move`）视为文件侧可以继续。这两条以及 `move` 成功之后，才做 `getExtensionState` / `setExtensionState` 的拷贝和清空，并写入 `storageMigratedKey`。不要把 state 拷贝和完成标记只放进 `move` 的 try 成功分支，否则路径相等时既不迁 state 也不写标记。其它错误码：打现在的 info 日志后 return，不改 state，不写标记。
- 不改：
  - `fromExtensionId === toExtensionId` 的提前返回。
  - 进入条件保持现在的或关系：`storageMigratedKey` 已为 true 就整段不进入；`migrateLowerCaseStorageKey` 有值且该键为 true 时也整段不进入。两个 id 不只是大小写差异时，第二个键是 `undefined`，不能写成「两条都为 true」。
  - 路径相等时不调用 `move`。
  - `setExtensionState` 的存储范围（global 用 `StorageScope.PROFILE`，否则 `WORKSPACE`）和 `ExtensionStorageService` 本体。
  - 现有成功用例的结果：源 state 为空、目标 state 等于原值、源文件不存在、目标文件内容相同、完成标记为 `'true'`。
- 本地验证：改 `src/vs/workbench/services/extensions/test/browser/extensionStorageMigration.test.ts`。保留 `migrate extension storage` 与 `migrate extension storage when does not exist`。新增断言：`fileService.move` 抛出非 `FileNotFound` 时，源 state 仍可 `getExtensionState` 读到，目标 state 为 `undefined`，源文件仍在，`storageMigratedKey` 不是 `'true'`。`FileNotFound` 时完成标记仍为 `'true'`。用 `scripts/test.sh --grep ExtensionStorageMigration` 跑。

### r08-4

- 问题类：扩展授权名单的存储键是 `` `${providerId}-${accountName}` ``，MCP 名单是 `` `mcpserver-${providerId}-${accountName}` ``，两段里的 `-` 会让不同身份读写同一键。
- 不变量：两对不同的 `(providerId, accountName)` 不得读写同一份用户授权记录。`isAccessAllowed` / `isAccessAllowedForUrl` 在用户名单上的允许或拒绝只属于这对身份。`product.json` 的 `trustedExtensionAuthAccess` / `trustedMcpAuthAccess` 仍按 `providerId` 取数组，不经过这条存储键。
- 要动的符号或文件：
  - `AuthenticationAccessService.readAllowedExtensions`、`updateAllowedExtensions`、`removeAllowedExtensions` 里三处 `` `${providerId}-${accountName}` ``。
  - `AuthenticationMcpAccessService.readAllowedMcpServers`、`updateAllowedMcpServers`、`removeAllowedMcpServers` 里三处 `` `mcpserver-${providerId}-${accountName}` ``。
  - 键规则：写入一律用新键。两段各自 `encodeURIComponent`，再把结果里仍留下的 `-` 换成 `%2D`（`encodeURIComponent` 不编码 `-`）。段之间用 `:`。`encodeURIComponent` 会编码 `:`，所以段内不再有未转义的 `:` 或 `-`。扩展键前缀 `authaccess:`，MCP 键前缀 `mcpaccess:`。不含 `-` 的历史拼接只在两段都不含 `-`、且新键没有记录时只读回退；写入不产生旧拼接。含 `-` 的身份不回读旧拼接。不把历史字符串 `authaccess:a-b:c` 解析成新键。这样 `a` / `b-c` 与 `a-b` / `c` 不会共用记录，旧拼接也不会和新键 `authaccess:a%2Db:c` 撞上。
- 不改：
  - `isAccessAllowed` 开头对 `trustedExtensionAuthAccess` 的短路，以及 MCP `_isAccessAllowed` 对 `trustedMcpAuthAccess` 的短路。对象形式仍用 `providerId` 下标。
  - `updateAllowedExtensions` / `updateAllowedMcpServers` 在写入前滤掉 `trusted` 项。
  - `authenticationUsageService.ts` 的 `` `${providerId}-${accountName}-usages` ``，以及 `authenticationExtensionsService.ts` / `authenticationMcpService.ts` 的会话偏好键。它们是另一处拼接，不在本条的读写符号里。
  - `github` 与 `user@example.com` 这类不含 `-` 的历史记录仍能通过只读回退读到，键名仍是 `github-user@example.com`，MCP 仍是 `mcpserver-github-user@example.com`。新的写入不再产生这两条旧拼接。
- 本地验证：在 `authenticationAccessService.test.ts` 新增断言：`providerId = 'a'`、`accountName = 'b-c'` 允许某扩展后，`providerId = 'a-b'`、`accountName = 'c'` 上 `isAccessAllowed` 仍为 `undefined`；反向写入的拒绝也不会出现在第一对身份的 `readAllowedExtensions` 里。在 `authenticationMcpAccessService.test.ts` 用同一对身份对 `isAccessAllowed` 做同样断言。这些用例如果直接读存储，应读新键，不要再断言写入落在旧拼接上。事先写入旧键 `github-user@example.com` 时，`isAccessAllowed` 仍能读到。保留并通过：`handles malformed storage data gracefully`、`does not store trusted extensions - they should only come from product.json`、`filters out trusted extensions before storing`、`removes all extensions from storage`、`does not store trusted servers from product.json`。用 `scripts/test.sh --grep "AuthenticationAccessService|AuthenticationMcpAccessService"` 跑。

### r08-5

- 问题类：`getAssociatedRemoteProfile` 创建远程配置文件后，关联列表追加的是 `currentProfile.id`，不是刚创建的那份 id。
- 不变量：创建分支写入关联列表的 id 是 `createProfile` 返回的 `profile.id`（调用时传入的是 `localProfile.id`）。`getRemoteProfile` 的参数不是当前窗口配置文件时，列表里必须有这份新 id。`cleanUp` 仍只遍历这份列表做改名和「本地已不存在则删除远程」。默认配置文件仍在函数开头直接返回远程默认配置文件，不进入创建分支。
- 要动的符号或文件：
  - `RemoteUserDataProfilesService.getAssociatedRemoteProfile`（`src/vs/workbench/services/userDataProfile/common/remoteUserDataProfiles.ts`）里 `setAssociatedRemoteProfiles` 的那一次追加，把 `this.userDataProfileService.currentProfile.id` 换成本次 `profile.id`。
- 不改：
  - `init` 里对当前配置文件再执行的 `setAssociatedRemoteProfiles(..., remoteProfile.id)`。这次追加只在远程配置文件不是默认时发生。默认配置文件在 `getAssociatedRemoteProfile` 开头直接返回，不进入创建分支。`distinct` 会去掉重复。
  - 已经能按 id 找到远程配置文件时的分支，不补写关联。
  - `onDidChangeLocalProfiles`：本地配置文件被移除时仍按该 id 找远程配置文件并 `removeProfile`，不经过关联列表。
  - `cleanUp` 的循环、默认配置文件的提前返回、`createProfile` 的参数（id、name、`transient`、`useDefaultFlags`）。
- 本地验证：在 `src/vs/workbench/services/userDataProfile/test/common/remoteUserDataProfiles.test.ts` 新增断言。`remoteAuthority` 已设置，当前配置文件是默认 id `default`，另有本地配置文件 id `other`。`getRemoteProfile(other)` 成功后，存储键 `associatedRemoteProfiles` 里该 authority 的数组包含 `other`。现有 `retries creating the remote profile and subscribes to local changes once` 仍要求创建参数 id 为 `other`、且当前配置文件就是这份被创建的配置文件。用 `scripts/test.sh --grep RemoteUserDataProfilesService` 跑。

## 审查

2026-10-30 只读审查的结论是须改稿。Critical 无。已按活码改入：短延迟覆盖不会把内容变化送进 `scheduleAutoSave`；迁移跳过是或关系，路径相等时仍要迁 state 并写标记；授权键不再用「含 `-` 才换新键」加未转义的 `-`。Minor 已并入：`toErrorMessage` 的文件位置、默认远程配置文件的提前返回、解析失败先于脏检查，以及 r08-1 / r08-2 的测试文件路径。
