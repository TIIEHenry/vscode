---
title: "方案 r13：platform"
type: plan
status: accepted
phase: N/A
updated: 2026-09-30
summary: "2026-09-30 用户签收。未实施。非空损坏的 state 与可解析密文的解密失败不再覆盖原数据；热退出备份改名失败保留原条目；代理配置账号失败后仍进入登录对话框。"
---

# 怎么改

## r13-1 降为中

反证：`src/vs/platform/state/test/node/state.test.ts` 的 `Basics (delayed strategy)`、`Basics (immediate strategy)` 用 `writeFileSync(storageFile, '')` 作为初始文件。空字符串 `JSON.parse` 会抛错，随后 `setItem` 与 `close` 必须把新键写回磁盘，下一轮 `init` 还要读得到。`Used before init` 也从空文件开始，并依赖解析失败时不把已写入内存的键清掉。因此「只要不是合法 JSON 就禁止覆盖」会打断现有空白文件路径。仍要修的是去空白后仍非空、且 `JSON.parse` 失败的原文。

问题类：非空且无法解析的 state 文件会在下一次保存时被内存库覆盖。

不变量：读到的内容去掉空白后长度为 0，或读文件得到 `FileOperationResult.FILE_NOT_FOUND` 时，之后的 `setItem` / `setItems` / `close` 仍把内存库写成新文件。内容非空且 `JSON.parse` 失败时，本次进程里的 `doSave` 与 `close` 不调用 `writeFile`，磁盘原字节保持不变；解析失败也不替换 `doInit` 之前已经放进 `storage` 的键。

要动的符号或文件：`FileStorage.doInit`、`FileStorage.doSave`（`src/vs/platform/state/node/stateService.ts`）。先把读到的字符串留在局部变量，`JSON.parse` 成功后再赋给 `this.storage` 和 `this.lastSavedStorageContents`。解析抛错且内容去空白后非空时，置一个仅供这两处使用的阻止落盘标记，`doSave` 见到该标记立即返回。

保持不动：`SaveStrategy` 的延迟、`writeFile` 的 `atomic.postfix` `.vsctmp`、`setItem` / `setItems` 的相等短路、`doSave` 在 `initializing` 尚未建立时直接返回、`close` 在未 `init` 时不写文件。空白文件与缺失文件继续允许落盘。

本地验证：保留并通过 `Basics (delayed strategy)`、`Basics (immediate strategy)`、`Used before init`、`Closed before init`、`Used after close`。新增断言：写入非空残缺 JSON（例如包含标记串的 `{"windows":`），`init` 之后 `setItem` 并 `close`，磁盘内容仍含该标记串，且没有被只含新键的 JSON 替换。命令：`scripts/test.sh --run src/vs/platform/state/test/node/state.test.ts --grep StateService`。

## r13-2 降为中

反证：`BaseSecretStorageService.initialize` 在 `isEncryptionAvailable()` 为假时把 `_type` 设为 `in-memory`，并改用新的 `InMemoryStorageService`。这条路径的 `get` 不调用 `decrypt`，也不对应用存储执行 `remove`。`NativeSecretStorageService` 对密钥环不可用走 `notifyOfNoEncryption`；`reinitialize()` 只出现在用户改用弱加密之后。因此「密钥环暂时锁住就删掉已存密文，恢复后只能读到 undefined」在本仓这条初始化路径上不发生。仍要修的是：已经选定 persisted、且存储值是可解析密文信封时，`decrypt` 抛错仍会 `removeValueFromStorage`。

问题类：persisted 模式下，可解析密文信封的解密失败会被当成坏密文删掉。

不变量：存储值不是 JSON，或解析后没有 `data` 时，`get` 仍删除该键并返回 `undefined`。存储值是带 `data` 的 JSON、随后 `decrypt` 抛错时，应用存储里的原值还在，`get` 把该错误抛出。`_type === 'in-memory'` 时仍不解密、不删除应用存储。

要动的符号或文件：`BaseSecretStorageService.get`（`src/vs/platform/secrets/common/secrets.ts`）。在 persisted 的 `catch` 里先看存储串：信封不合法则维持 `removeValueFromStorage` 并返回 `undefined`；信封合法则不要调用 `removeValueFromStorage`，把 `decrypt` 的错误抛出。

保持不动：`EncryptionMainService.decrypt` 继续把 `JSON.parse` 与 `safeStorage.decryptString` 的失败原样抛出。`initialize` 的内存回退、`NativeSecretStorageService.notifyOfNoEncryption`、`set` 失败时的重抛、`delete` 与 `keys`。

本地验证：保留 `get removes stale persisted secret when decryption fails`（夹具 `encrypted+my-secret-value` 不是信封，仍删除，`decryptCalls` 仍为 1，第二次 `get` 不再解密）。新增断言：存入 `{"type":"Buffer","data":[1]}` 这类带 `data` 的 JSON，`decrypt` 拒绝时键仍在，`get` 拒绝，再次 `get` 会再次调用 `decrypt`。命令：`scripts/test.sh --run src/vs/platform/secrets/test/common/secrets.test.ts --grep secrets`。

## r13-3

问题类：热退出备份在目标缺失且目录改名失败时，元数据不再指向仍留在原目录的备份。

不变量：`convertToEmptyWindowBackup` 返回 `true` 时，该工作区或文件夹离开原列表，并出现在 `emptyWindows`。返回 `false` 时，原条目留在 `workspaces` 或 `folders`，`emptyWindows` 不增加这一条，备份文件仍在改名前的目录；随后 `initialize` 写回的 `backupWorkspaces` 仍包含该条目。

要动的符号或文件：`BackupMainService.validateWorkspaces`、`BackupMainService.validateFolders`（`src/vs/platform/backup/electron-main/backupMainService.ts`）。两处调用 `convertToEmptyWindowBackup` 后读取返回值；为 `false` 时把原来的 `workspaceInfo` 或 `folderInfo` 推入结果。

保持不动：`convertToEmptyWindowBackup` 的改名、失败时 `return false`、成功时 `emptyWindows.push`。`moveBackupFolder`、`deleteStaleBackup`、`validateEmptyWorkspaces`、`getWorkspaceBackups` / `getFolderBackups` 在 `onExitAndWindowClose` 下返回空数组。

本地验证：保持 `service validates backup workspaces on startup and cleans up (folder workspaces)` 与 `service validates backup workspaces on startup and cleans up (root workspaces)` 的第 4 步：目标缺失且改名成功时，原列表长度为 0，`getEmptyWindowBackups()` 长度为 1。新增断言的目录形状与第 4 步相同：子目录里有文件（`doHasBackups` 只在子目录里还有文件时返回 true；备份根上直接放一个文件时结果是 false，随后走 `deleteStaleBackup`，不会调用 `convertToEmptyWindowBackup`）。目标路径不存在，且 `fs.promises.rename` 以带 `code: 'EACCES'` 的错误拒绝时，工作区与文件夹各自的原列表长度仍为 1，空窗口列表长度仍为 0，原路径上的备份文件还在，`backupWorkspaces` 状态仍指向原条目。列表用测试类已有的 `testGetWorkspaceBackups` / `testGetFolderBackups`。打桩只包住这次 `initialize`。命令：`scripts/test.sh --run src/vs/platform/backup/test/electron-main/backupMainService.test.ts --grep BackupMainService`。

## r13-5

问题类：代理地址带用户名密码时，第二次认证在配置账号分支直接返回空凭据，登录对话框不会出现。

不变量：`http.proxy` 或 `https_proxy` / `HTTPS_PROXY` / `http_proxy` / `HTTP_PROXY` 的 authority 含 `@` 且 `authInfo.attempt === 1` 时，仍返回该用户信息里的用户名和密码，不打开对话框。`attempt > 1` 时不再返回这组配置凭据，函数继续执行到 `showProxyCredentialsDialog`；`onLogin` 的 `callback` 拿到的是对话框结果，而不是这一分支造成的空用户名和空密码。`attempt === 1` 才采用 session 凭据和已存凭据；对话框预填仍用已存的用户名和密码。

要动的符号或文件：`ProxyAuthService.doResolveProxyCredentials`（`src/vs/platform/native/electron-main/auth.ts`）。authority 含 `@` 且 `attempt === 1` 时才解析并返回配置或环境变量中的账号。`attempt > 1` 时留下 trace 后离开该分支，落到后面的对话框。

保持不动：`onLogin` 的 `preventDefault` 与 `callback` 调用形式、浏览器视图 `webContents` 的提前返回、`extensionTestsLocationURI` 测试短路、`attempt === 1` 的 session / 已存凭据判断、`showProxyCredentialsDialog` 在无窗口或先前已取消时返回 `undefined`、`pendingProxyResolves` 的合并。

本地验证：现有测试没有覆盖这条。本仓没有提供 `electron.app` 的主进程单测入口，`npm run test-node` 也不跑 electron-main。验收只做一件事：把对话框收成注入函数，被测函数不导入 `electron.app`。`attempt === 1` 且代理为 `http://user:wrong@proxy.example:8080` 时返回配置中的用户名和密码，且不调用注入的对话框；`attempt > 1` 调用该函数并返回它的结果。用 `scripts/test.sh --run` 跑这个不碰 `app` 的文件。完整 `doResolveProxyCredentials` 的 `sendWhenReady` 时序若另写，不作为本条通过条件。

## 审查

2026-09-30 只读审查后改稿。无 Critical。Important：r13-5 不在 `scripts/test.sh` 的渲染进程入口里 `new ProxyAuthService`。Minor：r13-3 夹具沿用第 4 步的子目录结构。均已写入正文。r13-4 保持 drop。

2026-09-30 第二轮。无 Critical。Important：r13-5 的验收收成注入对话框的函数，用 `scripts/test.sh --run` 跑不导入 `electron.app` 的文件。本仓没有主进程单测入口，不再把「另找主进程命令」和渲染进程断言写在同一条通过条件里。均已写入正文。

2026-09-30 用户签收。`accepted`。未实施。
