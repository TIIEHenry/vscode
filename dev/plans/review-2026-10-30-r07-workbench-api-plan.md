---
title: "十六路审查 r07：workbench api 方案"
type: plan
status: draft
phase: N/A
updated: 2026-10-30
summary: "hold 3，weaken 1。"
---

# 十六路审查 r07：workbench api 方案

状态：草案。
覆盖需求：无（正文未引用需求编号）。

发现稿 5 条的引用都在 `src/vs/workbench/api` 内。下表是对照当前源码后的判定。方案只写仍要改的条目。

| 编号 | 判定 | 严重度 |
|---|---|---|
| r07-1 | weaken | 中 |
| r07-2 | hold | 中 |
| r07-3 | hold | 中 |
| r07-4 | hold | 中 |
| r07-5 | hold | 中 |

### r07-1

- 问题类：URL Handler 登录把 nonce 放进回调 URI，回调侧不核对，同路径上任意 `code` 都会拿这次的 `code_verifier` 去换票。
- 不变量：`waitForAuthorizationCode` 只接受 query 里 `nonce` 与本次 `callbackUri` 相同的结果。缺 nonce 或值不同时抛错，不调用 `exchangeCodeForToken`。`code`、`windowId` 等多出来的 query 参数仍允许。PKCE 继续随每次登录生成，换票请求继续带 `code_verifier`。
- 要动的符号或文件：`DynamicAuthProvider.waitForAuthorizationCode`（`src/vs/workbench/api/common/extHostAuthentication.ts`）。`$waitForUriHandler` 返回后，从 `expectedState.query` 和 `result.query` 取出 `nonce` 再比较。比较放在扩展宿主。主线程在 `handleURL` 里已经同时有 `expectedUri` 和回调 URI，并在交回扩展宿主之前结束等待；不是「主线程要等 code 被附上才看得到最终 query」。
- 明确不改什么：不改 `MainThreadAuthentication.$waitForUriHandler` 的 scheme、authority、path 比较。`loopbackServer.test.ts` 的 `href round-trips to the exact app URI` 写明主线程就比这三项。不改 `LoopbackAuthServer` 里对 `state` 的比较，不改 device code 流程，不改 `generateCodeChallenge` / `exchangeCodeForToken` 的 PKCE 参数。
- 怎样本地验证：`src/vs/workbench/api/test/browser/extHostAuthentication.test.ts` 应新增两条。用带 `authorization_endpoint` 的 `DynamicAuthProvider`，`openUri` 返回 true，`$waitForUriHandler` 收到的 `expectedUri` 上带有本次 nonce。返回的 URI 带相同 nonce 和 `code` 时，token 端点会被请求。返回的 URI 只有 `code`、或 nonce 不同时，`fetch` 不被调用，`createSession` 失败，且不写入会话。已有 `does not rotate the client while silently refreshing a token` 仍通过。
- 反证：`_createWithUrlHandler` 始终发送 `code_challenge_method=S256`，`exchangeCodeForToken` 始终附带 `code_verifier`。token 端点非成功或响应不是令牌时抛错，`createSession` 只在拿到令牌之后写入 `TokenStore`。合规授权服务器会拒绝与本次 challenge 无关的 code，攻击者的 code 不会变成当前会话。仍然成立的是：对不上的 code 会进入换票请求；这次等待会被这个 URI 结束。
- 降级后的严重度：中（原为高）。

### r07-2

- 问题类：访问令牌进入到期前 5 分钟的刷新窗口后，刷新一抛错，仍可能有效的令牌连同 refresh token 会从会话和机密存储里删掉。
- 不变量：刷新成功时，用新令牌替换旧令牌。网络失败、JSON 解析失败和其它非授权错误留下原令牌，不调用 `$setSessionsForDynamicAuthProvider` 把它删掉。要删除的授权失败是：`AuthorizationErrorType.InvalidGrant`，以及静默或交互刷新时的 `AuthorizationErrorType.InvalidClient`。没有 `refresh_token` 时仍按现在的路径丢掉该令牌。
- 要动的符号或文件：`DynamicAuthProvider.getSessions` 里 `removedTokens.push(token)` 现放在 `try` 之前。把它挪到刷新成功之后，以及上述授权失败的分支里。`exchangeRefreshTokenForToken` 对 `invalid_grant` 和 `invalid_client` 抛出可识别的错误，不要和网络失败、JSON 解析失败共用一个笼统 `Error`。`getSessions` 的 `catch` 按这个类型决定是否删除。静默 `invalid_client` 仍让 `sessions` 变成 `[]`，以保住 `does not rotate the client while silently refreshing a token`。
- 明确不改什么：不改 5 分钟窗口的条件，不改没有 refresh token 时的丢弃，不改 `TokenStore.update` 的增删规则，不改刷新成功后按 `scope` 覆盖的逻辑。交互刷新里 `invalid_client` 会换 client id 并抛错，这条仍删除旧令牌。
- 怎样本地验证：保持 `extHostAuthentication.test.ts` 的 `does not rotate the client while silently refreshing a token`：静默 `invalid_client` 后 `sessions` 仍为 `[]`，`generateNewClientIdCalls` 仍为 0。应新增：`created_at` 距现在约 1 秒、`expires_in` 为 300 的令牌仍在刷新窗口内且访问令牌未过期；`fetch` 拒绝时 `getSessions` 仍返回原 `access_token`，`$setSessionsForDynamicAuthProvider` 不被调用。同一文件再断言响应体为 `invalid_grant` 时会话被删掉。

### r07-3

- 问题类：等待 OAuth 回调的 URL handler 在超时或调用方不再等待之后仍注册着，之后同路径 URI 被它接受并返回 true。
- 不变量：`$waitForUriHandler` 注册的 handler 在匹配成功、5 分钟超时、传入的 `CancellationToken` 取消，或 `openUri` 返回 false 时注销。`openUri` 返回 false 会抛 `CancellationError`，但不会取消现有 token；进度 `dispose` 默认也不取消。这条路径必须在抛错前取消传进 `$waitForUriHandler` 的令牌，不能干等到 5 分钟。注销之后的 `handleURL` 对同 scheme、authority、path 返回 false。超时仍抛出现有的 `Timed out waiting for URI handler`。用户取消才以 `CancellationError` 结束。
- 要动的符号或文件：`MainThreadAuthentication.$waitForUriHandler`；协议 `MainThreadAuthenticationShape.$waitForUriHandler` 增加 `CancellationToken`。`DynamicAuthProvider._createWithUrlHandler` 把现有的 `token` 传进去。`NodeDynamicAuthProvider._createWithLoopbackServer` 用链接到该 `token` 的 `CancellationTokenSource` 传给同一次调用：用户取消时子令牌跟着取消；函数 `finally` 里与现有 `server.stop()` 一样延迟 5 秒再 `cancel`，给完成页 1 秒后的 `appUri` 跳转留时间。这次 `void` 调用后面保持两层 `catch(onUnexpectedError)`。
- 明确不改什么：不改 scheme、authority、path 的匹配，不把 nonce 核对塞进这条（那是 r07-1）。不改 `LoopbackAuthServer` 的 HTTP `state` 比较，不改 5 分钟超时和 loopback 5 秒停服务的时长，不改 device code 流程。
- 怎样本地验证：`src/vs/workbench/api/test/node/workbenchApiFurtherLeftoverPromiseCatchScan.test.ts` 的 `auth leftover $waitForUriHandler is Promise double-chain; opener $openUri stays skipped` 要改签名断言和 `assertDoubleThen` 的调用文本，使它们对准新的参数列表；双 catch 仍紧跟这次 `void` 调用，`openUri` 仍不带 catch。`loopbackServer.test.ts` 的 `href round-trips to the exact app URI` 仍通过。应新增：取消令牌后 handler 已注销，同路径 `handleURL` 返回 false，等待以 `CancellationError` 结束；超时路径仍是 `Timed out waiting for URI handler`，且 handler 已注销。`MainThreadAuthentication` 构造依赖多，测试用假的 `IURLService.registerHandler` 记下 disposable 即可。

### r07-4

- 问题类：文本保存参与里，扩展宿主把 `$tryApplyWorkspaceEdit` 的失败收成 `true`，主线程因此看不到应用失败。
- 不变量：`ExtHostDocumentSaveParticipant` 把 `$tryApplyWorkspaceEdit` 的布尔结果送回主线程。应用失败时该结果为 `false`，主线程现有的 `values.every(success => success)` 拒绝这次参与。版本已变、不再应用时的现有跳过保持原样。
- 要动的符号或文件：`src/vs/workbench/api/common/extHostDocumentSaveParticipant.ts`。`_deliverEventAsync` 在版本仍匹配时返回 `$tryApplyWorkspaceEdit` 的布尔值，不要固定 `return true`。同目录笔记本扩展宿主已经把这个布尔值返回去。
- 明确不改什么：不改主线程 `mainThreadSaveParticipant.ts` 对 `false` 的拒绝。不改「不把编辑结果以外的数据送过线」的其它字段。
- 怎样本地验证：`extHostDocumentSaveParticipant.test.ts` 新增断言：`$tryApplyWorkspaceEdit` 解析为 `false` 时，这次参与的结果含 `false`。解析为 `true` 时结果仍为成功。

### r07-5

- 问题类：文本保存参与在主线程 1750ms 后停止等待，扩展宿主没有收到取消，后续 listener 和 `$tryApplyWorkspaceEdit` 仍会执行。
- 不变量：主线程停止等待的那一刻，传给 `$participateInSave` 的令牌已取消。扩展宿主在每个 listener 之前、以及 `waitUntil` 结束要调用 `$tryApplyWorkspaceEdit` 之前检查该令牌；已取消则不再跑后续 listener，也不再应用编辑。1750ms 到期时参与 Promise 仍以现有的 `Aborted onWillSaveTextDocument-event after 1750ms` 这个 `Error` 拒绝。调用方传入的保存令牌保持原状。每个 listener 自己的 1500ms 超时和 listener 之间的 `didTimeout` 标志保留。
- 要动的符号或文件：`ExtHostDocumentSaveParticipantShape.$participateInSave` 增加 `CancellationToken`，与笔记本侧的形参位置一致，返回值仍是 `Promise<boolean[]>`。`ExtHostSaveParticipant.participate` 用链接到入参 `token` 的 `CancellationTokenSource` 传给代理；1750ms 回调里 `cancel()` 这个子令牌并 `reject`；RPC 结算时 `clearTimeout`。`ExtHostDocumentSaveParticipant.$participateInSave` 和 `_deliverEventAsync` 在应用编辑前看令牌。该类方法的令牌参数默认 `CancellationToken.None`，现有两参数调用仍可编译。`ExtHostSaveParticipant` 现为文件私有类；要单测就 `export` 它，不改 `SaveParticipant` 里 `addSaveParticipant` 的注册。
- 明确不改什么：不改 1750 和 1500 这两个数。不改 `TextFileSaveParticipant` 和 `TextFileEditorModel.doSaveSequential`。非 `CancellationError` 时文件写入照旧。这条错误的日志在 `textFileSaveParticipant.ts`，`doSaveSequential` 的内层 `catch` 不记它，1750ms 的 `Error` 也到不了外层那条日志。不改笔记本的 `ExtHostNotebookDocumentSaveParticipant.$participateInSave`。不把 1750ms 的拒绝改成 `CancellationError`。
- 怎样本地验证：保持 `src/vs/workbench/api/test/browser/extHostDocumentSaveParticipant.test.ts` 的 `event delivery, overall timeout`、`event delivery, pushEdits sync`、`event delivery, concurrent change`、`event delivery, two listeners -> two document states`。应新增：第一个 listener 的 `waitUntil` 完成时令牌已取消，`$tryApplyWorkspaceEdit` 调用次数为 0，第二个 listener 不运行。未取消且 `waitUntil` 返回 `TextEdit` 时仍会应用。主线程应新增：`$participateInSave` 不返回，等到 1750ms 超时后，代理收到的令牌 `isCancellationRequested` 为 true，参与 Promise 以上述 `Error` 拒绝，调用方传入的令牌仍未取消。RPC 先返回时，到点后子令牌不被取消。

## 审查

2026-10-30 只读审查的结论是须改稿。Critical 已改：r07-4 从 drop 改回 hold。`_deliverEventAsync` 在版本匹配时固定返回 `true`，主线程只在收到 `false` 时拒绝，应用失败因此被吞掉。Important 已改：nonce 比较仍留在扩展宿主，但不再写「主线程看不到最终 query」；删除集合包含交互 `invalid_client`，且这两种授权失败必须是可识别的错误；`openUri` 返回 false 时要取消等待令牌。
