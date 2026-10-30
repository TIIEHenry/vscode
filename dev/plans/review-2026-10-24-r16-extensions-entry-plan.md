---
title: "方案 r16：extensions-entry"
type: plan
status: implemented
phase: N/A
updated: 2026-10-24
summary: "3 hold 已实施；nonce 失败拒绝登录 Promise，身份核对失败不交出会话且只删明确 401，IPC 注销删除注册键。"
---
# 方案 r16：extensions-entry

状态：已完成。
覆盖需求：无（正文未引用需求编号）。


## 核对

- r16-1 hold：`/signin` 在 nonce 不符时写完错误重定向后没有返回，紧接着的第二次 `writeHead` 仍会抛未捕获的 `ERR_HTTP_HEADERS_SENT`，`waitForOAuthResponse` 不会 reject。
- r16-2 hold：钥匙串会话没有 `account` 时，`getUserInfo` 除消息恰好为 `Unauthorized` 外失败仍会带回 `<unknown>` 账户和原 access token。
- r16-3 hold：`registerHandler` 用 `` `/${name}` `` 注册，dispose 却 `delete(name)`，`/askpass` 与 `/git-editor` 还在表里。

## r16-1 hold

- 问题类：回环登录校验失败后响应已经结束，这次登录的 Promise 却继续挂起。
- 不变量：`LoopbackAuthServer` 持有 OAuth 结果 Promise。nonce 不符时这一次 HTTP 响应只能结束一次，并且该 Promise 必须拒绝；成功跳转不得再发出。
- 要动的符号或文件：`extensions/github-authentication/src/node/authServer.ts` 里 `LoopbackAuthServer` 构造函数的 `/signin` 分支。nonce 不符时保留现有的错误页 `writeHead` 与 `end`，接着 `deferred.reject(new Error('Nonce does not match.'))`，然后 `return`。拒绝必须打在构造 `_resultPromise` 的那个 `deferred` 上。只 `return` 会让 `_resultPromise` 继续挂起。在 `end` 之后 `throw` 会变成 HTTP 回调里的未捕获异常，同样不会 reject 这个 Promise。
- 不改：`extensions/github-authentication/src/flows.ts` 里与 `waitForOAuthResponse`、5 分钟超时、用户取消放在一起的 `Promise.race`；`/callback` 分支；nonce 相符时跳到 `_startingRedirect` 的路径。
- 本地验证：在 `extensions/github-authentication/src/test/node/authServer.test.ts` 的 `LoopbackAuthServer` 套件增加断言：`/signin` 携带与 `server.nonce` 不同的 nonce 时，响应是 302 且 Location 指向错误页，`waitForOAuthResponse()` reject，且没有未捕获的 `ERR_HTTP_HEADERS_SENT`。已有 `should redirect to starting redirect on /signin` 继续覆盖 nonce 相符。

## r16-2 hold

- 问题类：没有账户的钥匙串会话在身份核对失败后仍被当成已登录会话交出，并可能以 `<unknown>` 写回钥匙串。
- 不变量：没有 `account` 的钥匙串记录本身没有身份。身份只来自 `GitHubAuthenticationProvider.readSessions` 里 `_githubServer.getUserInfo` 的成功结果。核对失败的记录不得出现在本次返回值里，也不得以账户 id 或标签 `<unknown>` 写入钥匙串。钥匙串删除只表示“这个 token 已被服务端明确拒绝”，不能由网络失败、超时、5xx 或响应解析失败推导出来。
- 要动的符号或文件：
  - `extensions/github-authentication/src/common/gitHubAccount.ts` 的 `fetchUserInfo`。HTTP 非成功时保留状态码事实：401 抛出可识别的认证拒绝（例如带 `status: 401` 的专用错误，消息仍保留服务端文案）；网络失败继续抛 `NETWORK_ERROR`，其他 HTTP 失败保留原状态码。不要把所有拒绝压成同一种不可区分的 `Error`。
  - `extensions/github-authentication/src/github.ts` 的 `GitHubAuthenticationProvider.readSessions`。`if (!session.account)` 的 `catch` 里一律 `return undefined`，让执行流到不了后面的 `<unknown>` 组装；该条因此不进 `verifiedSessions`。同时记录本次是否有“未核对成功”的会话，以及其中是否有明确的 401。
  - 钥匙串写回：只有本次所有无 `account` 会话都成功核对、或失败项全部是明确 401 时，才允许调用 `storeSessions`。存在网络 / 超时 / 5xx / 解析失败等未核对项时，本次不重写钥匙串；这些记录只从返回值排除，原 token 留在钥匙串，等下一次读取再核对。`seenNumberAccountId` 的数字 id 迁移因此延后到没有未核对项的那一次，不能用一次网络失败顺带删掉迁移前记录。
- 不改：`getUserInfo` 成功时只在内存里补全账户、不因这次补全写钥匙串；`storeSessions` 先写钥匙串、成功后再替换 `_persistedSessionsPromise`；`fetchUserInfo` 对 401 以外的文案；`checkForUpdates` 的 added / removed 事件形状。
- 本地验证：`extensions/github-authentication/src/test/github.test.ts` 套件 `GitHub session persistence`。已有 `does not loop when Codespaces secret storage drops hydrated account data` 仍须保持不写钥匙串。新增断言：
  - `getUserInfo` 拒绝 `Error('network error')` 时，`readSessions` 不含该会话，返回值和任何钥匙串写入都不含 `<unknown>`，且 `setToken` / `deleteToken` 均未被调用；同一份存储会话在下一次成功核对后仍能返回。
  - `getUserInfo` 以明确 401 拒绝时，该会话从 `readSessions` 返回值排除，并且只删除这一条；其余会话保留。
  - 同时存在“数字 id 迁移”和“网络失败会话”时，本次不调用 `storeSessions`；网络恢复后的下一次读取才完成迁移。
  - 全部会话都核对失败时，不写入空列表。

## r16-3 hold

- 问题类：注销 IPC handler 时删除的键和注册键不一致，路由仍指向已经 dispose 的对象。
- 不变量：`IPCServer.handlers` 是路由表。`registerHandler` 放入的键必须是 `` `/${name}` ``。`IPCClient` 把 path 设成这个字符串，`onRequest` 用 `req.url` 查找。返回的 disposable 必须删除这同一个键。`Askpass.dispose` 与 `GitEditor.dispose` 之后，`/askpass` 和 `/git-editor` 不能再解析到这两个对象。
- 要动的符号或文件：`extensions/git/src/ipc/ipcServer.ts` 的 `IPCServer.registerHandler`。把 disposable 里的 `this.handlers.delete(name)` 改成 `` this.handlers.delete(`/${name}`) ``。
- 不改：`extensions/git/src/ipc/ipcClient.ts` 的 `` path: `/${this.handlerName}` ``；`Askpass.dispose` 与 `GitEditor.dispose`；`extensions/git/src/main.ts` 里 `ipcServer` 不进入 disposables；`IPCServer.dispose` 已有的 `handlers.clear()` 与 `server.close()`；`TerminalEnvironmentManager.dispose`。
- 本地验证：仓库里没有覆盖这条注销的测试。新增断言：路由仍注册时，带合法 JSON body 的 POST `/askpass` 会调用 `handler.handle`；`registerHandler('askpass', handler)` 的 disposable dispose 之后，同样的请求不会调用 `handler.handle`。`git-editor` 同样。空 body 会在 `JSON.parse` 处先抛，到不了 `handle`，不能用来证明键已删掉。

## 落地

- 2026-10-24 实施 r16-1：`/signin` 的 nonce 不符分支在错误页 `end()` 之后 `deferred.reject` 并 `return`，成功跳转不再发出。
- 2026-10-24 实施 r16-2：`fetchUserInfo` 的非成功响应改抛 `GitHubUserInfoError`，保留 HTTP 状态与文案；`readSessions` 对无 `account` 会话的核对失败一律从本次返回值排除，只有失败项全是明确 401 时才重写钥匙串。网络 / 超时 / 5xx / 解析失败不写钥匙串，数字 id 迁移延后；这些记录原样留在钥匙串，后续登录或登出写回时也不会被顺带抹掉。
- 2026-10-24 实施 r16-3：`registerHandler` 的 disposable 删除 `` `/${name}` ``。
- 验证：`github-authentication` 全套 67 passing；`git` 全套 76 passing，`smoke.test.ts` 一条既有失败（仓库数断言 2 !== 1）与本轮无关。新增用例覆盖 nonce 拒绝、网络失败不写钥匙串且不返回 `<unknown>`、明确 401 只删该条、迁移延后、全部未核对不写空列表、登录写回保留未核对 token，以及 `/askpass`、`/git-editor` 注销。
