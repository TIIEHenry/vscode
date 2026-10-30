---
title: "方案 r16：extensions-entry"
type: plan
status: draft
phase: N/A
updated: 2026-10-11
summary: "2026-10-11 Sonnet 第 4 路审查后改稿。hold 1，drop 1，weaken 2。静默换票是已写明的设计，不按稿删 restore。git IPC 不对不存在的对端 uid API。"
---
# 方案 r16：extensions-entry

状态：草案。
覆盖需求：无（正文未引用需求编号）。


hold 1，drop 1，weaken 2。2026-10-11 Sonnet 第 4 路只读审查后改过 r16-2、r16-3、r16-4。

## r16-1（weaken，降为低）
### 问题类
`setDisplayMediaRequestHandler` 在请求已经通过之后，仍不区分是不是窗口主 frame，就把屏幕源交出去。
反证：Electron 42.10.0（`.npmrc` 的 `target`）里 `WebContentsPermissionHelper::RequestMediaAccessPermission` 先以 `AUDIO_CAPTURE` 询问权限，JS 侧字符串是 `media`，只有回调允许后才调用 `ChooseDisplayMediaDevice`（即这个 handler）。本仓 `allowedPermissionsInWebview`（`src/vs/code/electron-main/app.ts` 第 266–273 行）没有 `media`，`isUrlFromWebview` 为真时 `setPermissionRequestHandler`（第 284–287 行）直接 `callback(false)`。扩展 webview 的外层 iframe（`src/vs/workbench/contrib/webview/browser/webviewElement.ts` 第 422–428 行）和内容 iframe（`src/vs/workbench/contrib/webview/browser/pre/index.html` 第 1034–1038 行）的 `allow` 都没有 `display-capture`。集成浏览器用独立 session（`src/vs/platform/browserView/electron-main/browserSession.ts` 的 `fromPartition` / `fromPath`），不走 `session.defaultSession` 这个 handler。因此「webview 或网页一次 `getDisplayMedia` 就拿到整屏」不成立。仍成立的是：`isUrlFromWindow` 不看 `isMainFrame`，`vscode-file` 子 frame 一旦通过 `media`，handler（第 316–358 行）仍用 `displays[0]` 并 `callback({ video: chosen })`。
### 不变量
只有某个 `BrowserWindow` 的 `webContents.mainFrame` 才 `callback({ video })`。`request.frame` 为空，或对不上任何窗口主 frame 时，`callback({})`，并且不调用 `desktopCapturer.getSources`。
### 要动的符号或文件
`src/vs/code/electron-main/app.ts` 里 `session.defaultSession.setDisplayMediaRequestHandler`（第 316–358 行）。在现有 `frame` 查找之后，`win` 不存在就拒绝。
### 明确不改
第 266–282 行两份权限名单。webview iframe 的 `sandbox` / `allow`。集成浏览器那套 `BrowserSessionPermissions`。
### 本地验证
`src/vs/code/test/node/codeElectronMainFurtherLeftoverPromiseCatchScan.test.ts` 只断言 handler 字面量还在。应新增断言：`request.frame` 不是任一窗口主 frame 时回调参数是空对象，且没有向 `desktopCapturer.getSources` 要屏幕源；主 frame 对上时才 `callback({ video })`。

## r16-2（drop）
### 问题类
发现稿把「`getSessions` 按调用方 scope 静默换票」写成越权。活码把这写成账号级同意：链接不记 scope，重载后的窗口用调用方要的 scope 重建会话。
### 不变量
不按本稿删掉 `getSessions` 里的 `restore`，也不给 `IAccountLink` 加 scope。`github.ts` 第 296–306 行写明 “Nothing about scopes is remembered, because nothing needs to be”。`accountLinks.ts` 第 30–38 行是同一设计。`github.test.ts` 里 `rebuilds a remembered account in a window that never had the session` 锁住这个行为。
### 要动的符号或文件
没有。旧稿要去掉第 291 行的 `restore`，又说「未记下 scope 才不换票」，两处不一致。它还写 `createSession` 的 Microsoft 路径只在 scope 已记下时才不再确认，但 `entraTokenExchange.ts` 的 `login` 每次都 `confirmAccount`，那条免确认路径是发明的。已有 memento 行没有 scope，加上字段而不迁移会让现有用户失去静默重建。`github.test.ts` 第 363 行起依赖 `getSessions` 触发 `renewals` 的用例也会断。
### 明确不改
`getSessions`、`restore`、`IAccountLink`、`EntraTokenExchange.linkAccounts`。
### 本地验证
不新增断言。现有 `rebuilds a remembered account in a window that never had the session` 保持通过。若以后要改这条设计，先拍板迁移，再重写方案。

## r16-3（weaken，降为低）
### 问题类
git IPC 的套接字在 `listen` 之后没有再收紧模式。用对端 uid 拒绝请求这条做不到。
### 不变量
不在 `onRequest` 里比较对端 uid。`IPCServer` 用的是 Node `http.Server`（`extensions/git/src/ipc/ipcServer.ts` 第 32、83 行），`req.socket` 拿不到 Unix socket 的 `SO_PEERCRED`，Node 核心也没有这个 API。默认 umask 022 下套接字通常是 0755，其他用户没有写权限，`connect()` 过不去；设了 `XDG_RUNTIME_DIR` 时路径还在 0700 目录里（第 20–21 行）。「其他用户能取走缓存密码」在这两条前提下不成立，本稿不把它写成 hold。
### 要动的符号或文件
若仍要收紧落在 `os.tmpdir()` 的套接字：只在 `listen` 成功之后 `chmod 0o600`，并写明 listen 与 chmod 之间有一个窗口。不要加 uid 检查，也不要为它写测不到的测试。
### 明确不改
`extensions/git/src/main.ts` 第 70 行 `createIPCServer(context.storagePath)` 的调用。`Askpass.handleAskpass` 的缓存语义。`GitEditor.handle`。环境变量名 `VSCODE_GIT_IPC_HANDLE`。`onRequest` 的 handler 分发。
### 本地验证
`extensions/git` 下没有 IPC 权限测试。只有在决定做 chmod 时才新增：非 win32 上 `listen` 之后套接字 mode 为 `0600`。不要断言「对端 uid 不是当前用户时不调用 handler」。

## r16-4（hold，中）
### 问题类
密钥链写入失败后，内存里的会话列表仍被换成新列表，登录仍报成功。
### 不变量
`createSession` 这条路径上，`secrets.store` 失败要让这次登录失败。`_persistedSessionsPromise` 只在这次写入成功之后替换。`createSession` 只在 `storeSessions` 成功返回之后才 `fire({ added })` 并写 `Login success!`。

`storeSessions` 还被 `readSessions`（`github.ts` 约第 690 行，不在 try 里）和移除会话路径（约第 910 行）调用。`setToken` 改为抛出时，这两处必须接住。`readSessions` 一旦把 `_persistedSessionsPromise` 变成永久 rejected，之后所有 `getSessions` 都会失败。登出写失败时用户也退不掉，这和 `accountLinks.ts` 对登出落盘失败的处理不一致。本稿只改 `createSession` 的成功语义，不让读和移除变成不可恢复的拒绝。
### 要动的符号或文件
- `Keychain.setToken`（`extensions/github-authentication/src/common/keychain.ts` 第 16–22 行）：去掉吞掉异常的空 `catch`，让失败抛出。
- `GitHubAuthenticationProvider.storeSessions`（`extensions/github-authentication/src/github.ts` 第 696–700 行）：先 `await this._keychain.setToken(...)`，成功后再把 `_persistedSessionsPromise` 设为新列表。
- `createSession` 第 766–770 行的 `fire` 与 `Login success!` 保持在 `await this.storeSessions` 之后，靠上面的抛出自然跳进现有 `catch`。
### 明确不改
`Keychain.getToken` 与 `deleteToken` 的失败处理。`createMicrosoftSession`（第 798–813 行）不写密钥链。`checkForUpdates`（第 575–606 行）的对比规则。
### 本地验证
`extensions/github-authentication/src/test/github.test.ts` 的 `persists a new login alongside sessions added while authorization was in flight` 只覆盖 `setToken` 成功。应新增断言：`setToken` 拒绝时 `createSession` 抛出，不触发 `added`，`_persistedSessionsPromise` 仍是写入前的列表。
