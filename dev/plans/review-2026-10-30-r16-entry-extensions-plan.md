---
title: "十六路审查 r16：入口与其余扩展方案"
type: plan
status: draft
phase: N/A
updated: 2026-10-30
summary: "核对后 hold 4 条、weaken 1 条、drop 0 条。"
---

# 十六路审查 r16：入口与其余扩展方案
状态：草案。
覆盖需求：无（核查只写修法，不占需求编号）。

| 编号 | 判定 | 严重度 |
| --- | --- | --- |
| r16-1 | hold | 高 |
| r16-2 | hold | 中 |
| r16-3 | hold | 中 |
| r16-4 | weaken | 低 |
| r16-5 | hold | 中 |

### r16-1

问题类：重叠的 GitHub 登录或注销里，后完成的 `setToken` 用旧快照整表覆盖钥匙串，先写入的令牌会丢，或刚注销的会话被写回去。

不变量：同一进程里重叠的 `storeSessions`（含 `readSessions` 自己的写回）按一条队列重合并。后完成的写入用当时最新的 `_persistedSessionsPromise`，不提交进入 `setToken` 之前的旧快照。另一窗口的写入不改变本进程这份 promise，除非本进程自己跑 `checkForUpdates`。跨窗口钥匙串覆盖不在本条里。`storeSessions` 仍把这次读未能验证的记录原样带上。微软经纪换来的会话仍只活在本进程，不进钥匙串。

要动的符号或文件：`extensions/github-authentication/src/github.ts` 里的 `GitHubAuthenticationProvider.createSession`（非 Microsoft 分支）、`removeSession`、`copyPersistedSessionsForWrite`、`storeSessions`，以及 `readSessions` 里调用 `storeSessions` 的那次迁移或拒绝写回。`readSessions` 的这次写回也进同一条队列。

做法：网络登录和向 GitHub 注销留在临界区外面。临界区是一条不会交错的队列，里面重新跟上当前的 `_persistedSessionsPromise`，只在这份最新副本上添加或删除这一次的会话，再调用 `storeSessions`。`setToken` 还没返回时如果这份 promise 又被换掉，用新列表再合并一次。这只覆盖本进程把 promise 换掉的情况。

保持不动：`createMicrosoftSession` 与 `_transientSessions`。`Keychain.setToken` 仍是整表写入，合并放在调用方。`extHostAuthentication.ts` 里按 provider id 排队的 `_providerOperations` 不动。它已经串起同一窗口的 `$createSession`。`checkForUpdates` 不进这条队列。不把「写入时钥匙串里已有、且不是这次注销的会话都会留下」写成跨窗口都能成立的结果。

怎样本地验证：`extensions/github-authentication/src/test/github.test.ts` 里已有 `persists a new login alongside sessions added while authorization was in flight` 和 `removeSession does not restore tokens another window removed while awaiting persisted sessions`，两则继续通过。新增断言只覆盖本进程：两份写入在 `copyPersistedSessionsForWrite` 已经返回同一份旧列表之后重叠，后完成的 `setToken` 仍同时保留两份变更。不要把这条写成跨窗口钥匙串也会合并。跑法：`npm run test-extension -- -l github-authentication`。

### r16-2

问题类：另一个窗口从秘密存储去掉某个 Microsoft client id 后，这个窗口的 `_handleSecretStorageChange` 只打日志，`_pcas` 仍留着该 Public Client，之后的保存会把这个 id 写回去。

不变量：处理结束后，这次读到的存储里没有的 clientId 不在 `_pcas` 里，对应的 `_pcaDisposables` 已释放。存储里仍有的 id 留着。存储里新出现的 id 仍经 `_doCreatePublicClientApplication` 建出来。`get` 得到 `undefined` 时仍清空全部内存客户端。接下来任何一次 `_storePublicClientApplications` 都不含已删除的 id。空数组 `[]` 同样表示一个都不留，处理完后内存也是空的。

要动的符号或文件：`extensions/microsoft-authentication/src/node/publicClientCache.ts` 的 `CachedPublicClientApplicationManager._handleSecretStorageChange`。先收集缺席的 id，`dispose` 并从 `_pcas`、`_pcaDisposables` 移除，再经 `_doCreatePublicClientApplication` 建出存储里新出现、内存里还没有的 id，最后才调用一次 `_storePublicClientApplications`。不要在建新 id 之前写回：那时 `_pcas.keys()` 还没有这些新 id，会把秘密存储里刚出现的 clientId 抹掉。`get` 得到 `"[]"` 时返回空数组，这是真值，不会走进 `undefined` 的清空分支；空数组要单独清空内存。

保持不动：`getOrCreate` 的缓存命中路径。`initialize` 里「账号为空就丢掉 PCA」的逻辑。`PublicClientApplicationsSecretStorage` 的键名、`get` / `store` 和旧数据迁移。

怎样本地验证：`flows.test.ts`、`scopeData.test.ts`、`loopbackClientAndOpener.test.ts` 都不覆盖这条。在 `src/node/test/` 用与 `flows.test.ts` 相同的 mocha `suite` / `test` 新增断言：存储从两个 clientId 变为只剩一个后，缺的那个已释放且不在 `_pcas`；存储里新出现、内存里还没有的 id 仍被建出来，随后写回的列表含新 id、不含被删 id；`get` 得到 `undefined` 或 `[]` 时内存客户端被清空。跑法：`npm run test-extension -- -l microsoft-authentication`。该扩展测试编到 `extensions/microsoft-authentication/out/**/*.test.js`。不要改用 git 套件的 `--extensionTestsPath`。

### r16-3

问题类：`argv.json` 还没有 `enable-crash-reporter` 时，`updateCrashReporterEnablement` 删掉最后两个字符再拼接。以 `}\r\n` 结尾时闭合括号还在，拼出来的文本不能被现有 JSONC `parse` 解析。

不变量：补写后的文本能被 `src/vs/base/common/jsonc.ts` 的 `parse` 解析。原有键还在，并写入 `enable-crash-reporter` 与 `crash-reporter-id`。下面三种输入都要成功：以 `}\n` 结尾的 LF 文件；`src/main.ts` 里 `createDefaultArgvConfigSync` 用 `join('\n')` 写出、最后一个字符是 `}` 的默认内容；以 `}\r\n` 结尾的文件，以及只把默认内容的 `\n` 换成 `\r\n`、仍然以 `}` 结束的文件。已有 `enable-crash-reporter` 的文件仍走后面的替换。原文件 `parse` 失败时仍只记日志并走现有的 argv 警告，不写文件。新文本若 `parse` 失败，不调用 `writeFile`。

要动的符号或文件：`src/vs/code/electron-main/app.ts` 的 `CodeApplication.updateCrashReporterEnablement`。把「按最后两个字符裁切」换成按根对象闭合括号插入两个字段的纯函数，放在同目录、不引用 Electron 的模块里，由这个方法调用。方法签名保持 `private async updateCrashReporterEnablement(): Promise<void>`。

保持不动：`src/main.ts` 的 `createDefaultArgvConfigSync`。已有该键时的 `replace` 正则。`enableCrashReporter` 与遥测等级的关系，以及 `generateUuid`。`src/vs/code/test/node/codeElectronMainFurtherLeftoverPromiseCatchScan.test.ts` 和 `codeElectronMainRemainingLeftoverPromiseCatchScan.test.ts` 只检查上述方法签名字符串，签名保持后这两则仍能通过。

怎样本地验证：新增 `src/vs/code/test/node/` 下的单元测试，直接调用纯函数。断言覆盖上一节三种输入，`parse` 成功且同时含原键与两个新键；再给一份已经含 `enable-crash-reporter` 的文本，确认插入函数不被误用（该分支仍留在 `updateCrashReporterEnablement` 的后续路径）。用 `scripts/test.sh` 跑到这个新测试。用仓库里的 `parse` 对 `}\r\n` 样本复现过失败：裁切结果在闭合括号后还有逗号和新的 `}`，`parse` 报 Unexpected non-whitespace character after JSON。默认 LF 样本裁切后 `parse` 成功。

### r16-4

问题类：Git IPC 在 `listen` 之后没有把套接字收成仅所有者可写。能连上的进程可以调用 askpass，HTTP 响应体就是用户输入的口令或凭据提供方返回的口令。

反证：`getIPCHandlePath` 在非 macOS 且存在 `XDG_RUNTIME_DIR` 时把套接字放进该目录。本机这个目录是 `0700`，其他用户不能进入。本机 umask 是 `002`；用与 `createIPCServer` 相同的 `http.Server.listen(路径)` 得到的套接字模式是 `0775`。连接需要写权限，other 只有读和执行，主组是用户私有组，其他本地用户不在这个组里。发现稿写组写或更宽权限就足以让其他本地用户连上；组写本身不够，还要该组里有别的用户，或者 other 也有写（例如 umask `000` 得到 `0777`）。代码里确实没有 `chmod`，也没有对端校验。`extensions/git/src/main.ts` 把 `context.storagePath` 传入 `createIPCServer`，套接字名是这段路径哈希的前 10 位。没有 `XDG_RUNTIME_DIR` 的非 macOS，以及 macOS，路径在 `os.tmpdir()`。`Askpass.handle` 返回口令，`IPCServer.onRequest` 把它写进响应。

降级后的严重度：低。

不变量：非 Windows 上 `createIPCServer` 在把服务器交给调用方之前，套接字模式是仅所有者可读写（`0o600`）。askpass 仍把口令返回给已经连上的客户端。Windows 命名管道、`XDG_RUNTIME_DIR` 与 `os.tmpdir()` 的选择规则不变。

要动的符号或文件：`extensions/git/src/ipc/ipcServer.ts` 的 `createIPCServer`。现在 `server.listen` 之后立刻 resolve。把 `chmod` 放在 `listening` 回调里，完成后再构造 `IPCServer`。

保持不动：`Askpass` 的返回值，`ipcClient.ts` 的请求方式，`getIPCHandlePath` 的目录选择，Windows 管道。这次没有读到管道 ACL，不在这里改。

怎样本地验证：`extensions/git/src/test/ipcServer.test.ts` 已有 `unregisters the askpass route when its registration is disposed` 和 `unregisters the git-editor route when its registration is disposed`。这两则用 `127.0.0.1` 的 TCP，继续通过。新增断言：非 Windows 上调用 `createIPCServer` 后，套接字 `stat.mode & 0o777` 等于 `0o600`。`stat.mode` 含文件类型位，本机 umask `002` 下 `listen` 得到的是 `0o140775`，不能和 `0o600` 直接相等。入口是 `extensions/git/src/test/index.ts`。跑法：`npm run test-extension -- -l git`。

### r16-5

问题类：连续允许两个 Microsoft 账号时，`setAllowedAccess` 按当时的 `this.value` 整表写入，且不更新 `this.value`。后一次若赶在 `update` 赋值之前，会用旧数组盖掉前一个 `homeAccountId`。经纪登录随后用这份列表过滤，被盖掉的账号不再视为已允许。

不变量：两次成功的 `setAllowedAccess(account, true)` 之后，两个 `homeAccountId` 都在秘密存储里，也都在 `this.value` 里。`setAllowedAccess(account, false)` 只去掉这一个 id。已经在列表里的 id 再次允许时直接返回，不再写一次。本地写入成功且内容相对写入前有变化时，要发出 `onDidAccountAccessChange`，或直接走经纪刷新。不能只把 `this.value` 设成刚写入的数组再交给 `update` 做差集：差集为空时经纪刷新听不到这次允许。外部存储变化仍经 `update` 刷新 `this.value`，内容变了才发事件。经纪路径仍用 `isAllowedAccess` 过滤，过滤条件本身不变。

要动的符号或文件：`extensions/microsoft-authentication/src/common/accountAccess.ts` 的 `ScopedAccountAccess.setAllowedAccess` 与 `update`。用一条串行队列包住读改写。`store` 成功后把 `this.value` 设成刚写入的那份数组，内容变了就发 `onDidAccountAccessChange`，然后才返回。与这次写入交错的 `update` 不得用一次更早开始的 `get` 盖掉刚写成功的列表。

保持不动：`CachedPublicClientApplication` 的 `_sequencer`，以及 `_update` 里 `isBrokerAvailable` 时对 `isAllowedAccess` 的过滤（`extensions/microsoft-authentication/src/node/cachedPublicClientApplication.ts`）。`AccountAccessSecretStorage` 的迁移。`MainThreadSecretState` 按扩展 id 排队存储读写；那条队列不合并扩展侧已经算好的数组。

怎样本地验证：没有现成测试名。在 `extensions/microsoft-authentication/src/common/test/` 新增 mocha 测试。断言：第一次 `setAllowedAccess(true)` 的 `store` 已经返回，而 `update` 还没执行到 `this.value = ...` 时，第二次允许另一个 `homeAccountId`，存储和 `this.value` 同时含两个 id，并且 `onDidAccountAccessChange` 在内容变化时发出；再对其中一个 `setAllowedAccess(false)`，只去掉那个 id。跑法与 r16-2 相同：`npm run test-extension -- -l microsoft-authentication`。

## 审查

2026-10-30 只读审查的结论是须改稿。Critical 已改：r16-1 的队列只覆盖本进程，`readSessions` 的写回进同一条队列，跨窗口钥匙串不在本条；r16-2 在建出新 clientId 之后才 `_storePublicClientApplications`；r16-5 本地写入内容变化时要发 `onDidAccountAccessChange`，不能只靠 `update` 的空差集。套接字断言改为 `stat.mode & 0o777`。微软认证的跑法是 `npm run test-extension -- -l microsoft-authentication`。
