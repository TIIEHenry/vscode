---
title: "十六路审查 r12：产品贡献面方案"
type: plan
status: draft
phase: N/A
updated: 2026-10-30
summary: "hold 2 条、weaken 1 条：取消信任被写成永久拒绝，URL elicitation 完成监听被提前拆掉，活连接上的资源监视结束未退订。"
---

# 十六路审查 r12：产品贡献面方案

状态：草案。
覆盖需求：无（正文未引用需求编号）。

| 编号 | 判定 | 严重度 |
|------|------|--------|
| r12-1 | hold | 中 |
| r12-2 | hold | 中 |
| r12-3 | weaken | 提示 |

### r12-1

- 问题类：TrustedOnNonce 信任对话框被关掉时，取消被收成明确拒绝并写入 `__vscode_not_trusted`。
- 不变量：关闭对话框或 Quick Pick 被 hide（`_promptForTrustOpenDialog` 得到 `undefined`）时，`trustedAtNonce` 保持调用前的值。点 “Do not trust”、多选确认后的空列表、或不包含该服务器 id 的列表，才写成 `__vscode_not_trusted`。点 Trust 写成 `definition.cacheNonce`。`promptType` 默认仍是 `only-new`；只有 nonce 已经是 `__vscode_not_trusted` 时，`only-new` 才跳过询问。
- 要动的符号或文件：`McpRegistry._promptForTrust`（`src/vs/workbench/contrib/mcp/common/mcpRegistry.ts`）。返回类型从 `Promise<boolean>` 改为 `Promise<boolean | undefined>`。`trustedDefinitionIds` 为 `undefined` 时返回 `undefined`，不要用 `!!trustedDefinitionIds?.includes(...)` 收成 `false`。`_checkTrust` 里已有的 `didTrust === undefined` 分支保持原样：直接 `return undefined`，不写 `notTrustedNonce`。
- 明确不改什么：不改 `notTrustedNonce` 常量、`McpServer.trustedAtNonce` setter、`McpServerMetadataCache.store` / `onWillSaveState` 的 `mcpToolCache` 落盘。不改显式拒绝时写入 `__vscode_not_trusted`。不改 `all-untrusted` 在 nonce 已是 `__vscode_not_trusted` 时仍会再问（`_checkTrust` 254–259 行），也不改 Start / Restart / `callOn` 传入 `all-untrusted` 的调用点。
- 怎样本地验证：`scripts/test.sh --grep "user cancelling trust dialog|nonce-based trust denies"`，文件 `src/vs/workbench/contrib/mcp/test/common/mcpRegistry.test.ts`，套件 `Workbench - MCP - Registry` / `Trust Flow`。给 `user cancelling trust dialog returns undefined for all pending connections` 补上断言：取消后两个 bearer 的 `trustedAtNonce` 仍是进入前的值，不是 `__vscode_not_trusted`。另加单服务器取消：`nextDefinitionIdsToTrust = undefined`，连接为 `undefined`，nonce 保持原值。`nonce-based trust denies connection when user rejects` 仍断言空列表写成 `__vscode_not_trusted`。

### r12-2

- 问题类：连接上的 URL elicitation 在把 `accept` 交回服务器之前拆掉完成通知监听，授权卡片不收起，`wait` 不结束。
- 不变量：用户打开链接后，`elicitation/create` 的响应是 `{ action: 'accept' }`，并且在 `notifications/elicitation/complete` 到达之前就返回。完成监听保留到 `wait` 落定（完成通知、token 取消，或连接不再处于 Running）。匹配 `elicitationId` 的完成通知让 `wait` resolve，聊天里的 `ChatElicitationRequestPart.hide()` 随后执行。decline、cancel、form 模式仍在把结果交回后立刻 `dispose`。
- 要动的符号或文件：`McpServer.start` 里的 `elicitationRequestHandler`（`src/vs/workbench/contrib/mcp/common/mcpServer.ts`，现为 `elicit` 之后立刻 `r.dispose()` 再 `return r.value`）。URL 且 `action === 'accept'` 时先返回 `r.value`，在 `r.wait` 落定后再 `dispose`。不要在 `return` 之前 `await r.wait`。这是有意不照发现稿「先等 `wait` 再 `dispose`」：那会把 `elicitation/create` 的响应握在完成通知之前。仓内合同只定义了响应和带外完成通知，没有写服务器必须先收到响应才发完成通知。`wait` 在 token 取消或连接不再 Running 时会 reject；`wait.finally` 要把这个 rejection 接住，避免变成 `unhandledRejection`。`void completePromise.catch` 接不住 handler 上新挂的 `wait.finally`。
- 明确不改什么：不改 `McpElicitationService._elicitUrl` 里把监听挂在 `promiseStore`、把 `part.hide()` 挂在 `completePromise` 的写法。不改 `_handleElicitationErr`（`mcpServer.ts` 1465–1469 行）先 `await elicitResult.wait` 再 `dispose`。不改 form 的空 `dispose`。
- 怎样本地验证：现有 `url elicit chat card cancels with the token` 直接调用 `service.elicit`，不经过 `mcpServer.ts` 的 handler，盖不住提前 `dispose`。新断言要走 `elicitationRequestHandler`：URL accept 的 Promise 在完成通知之前 resolve 为 `accept`，此时完成监听还在；随后完成通知使 `wait` resolve，并且 `ChatElicitationRequestPart.hide` 被调用；decline 仍立刻 `dispose`；token 取消时没有 `unhandledRejection`。`scripts/test.sh --grep` 跑这条新测试名。

### r12-3

- 问题类：同一条活着的 MCP 连接上，资源监视结束后没有发 `resources/unsubscribe`。
- 不变量：`watch` 返回的 disposable 被 dispose 时，若对应 `subscribe` 已成功且该 handler 仍能发请求，就对 `subscribe` 实际发送的 `resourceURI` 调用一次 `unsubscribe`。autorun 换 handler 时 `callCts.value?.dispose(true)` 会取消 token，这次不发 `unsubscribe`。`DisposableStore` 被 dispose 时，`MutableDisposable.dispose` 调用的是不带参数的 `dispose()`，`CancellationTokenSource` 默认不取消。因此 store dispose 不会靠取消 token 挡住迟到的成功回调；回调若在 watch 已经 dispose 之后才成功，要补一次 `unsubscribe`。`subscribe` 失败时不发 `unsubscribe`。本地 `onDidUpdateResource` 仍在 dispose 时卸下。
- 要动的符号或文件：`McpResourceFilesystem.watch`（`src/vs/workbench/contrib/mcp/common/mcpResourceFilesystem.ts`）。记下已成功的 `(handler, uri)`。store dispose 时，handler 未 dispose 则调用已有的 `McpServerRequestHandler.unsubscribe`。autorun 换 handler 时，只有旧 handler 仍能 `sendRequest` 才退订；已 dispose 的跳过。
- 明确不改什么：不改 `unsubscribe` / `subscribe` 的请求形状。不改没有 `ResourcesSubscribe` 能力时直接 `Disposable.None`。不引入同一 URI 多个 `watch` 的引用计数。不改 `McpServer._connection` 的 `disposableObservableValue` 换连接顺序。
- 怎样本地验证：`scripts/test.sh --grep "watch file emits change events|watch dispose unsubscribes"`，套件 `Workbench - MCP - ResourceFilesystem`（`src/vs/workbench/contrib/mcp/test/common/mcpResourceFilesystem.test.ts`）。保留 `watch file emits change events`。新增断言：handler 仍在跑时 `watchDisposable.dispose()` 之后，传输层收到该 URI 的 `resources/unsubscribe`。另一条：handler 先 dispose 再 dispose watch 时，`unsubscribe` 因 `CancellationError` 失败可以，dispose 本身不抛出。
- 反证与降级后的严重度：发现稿把「handler 换代」也写成服务器侧订阅会累积。`McpServer._connection` 是 `disposableObservableValue`，换值时先 `dispose` 旧连接（`observableValue.ts` 的 `_setValue`）。`McpServerConnection.dispose` 会 dispose handler；已 dispose 的 handler 在 `sendRequest` 里看到 `_store.isDisposed` 就拒绝 `CancellationError`，`unsubscribe` 送不出去。旧 launch 随连接一起拆掉，新会话上的 `subscribe` 是新的。换代本身不会把旧进程的订阅叠到新连接上。还在的核心是：同一条活连接上，`watch` 成功 `subscribe` 之后 dispose 不发 `resources/unsubscribe`。store dispose 默认不取消进行中的 subscribe。严重度由低降为提示。`observableValue.ts` 的路径是 `src/vs/base/common/observableInternal/observables/observableValue.ts`。测试传输的 `initialize` 没有 `resources.subscribe`；等 handler 就绪后再 `watch` 会因能力不含 `ResourcesSubscribe` 直接返回 `Disposable.None`。新断言要在 `watch` 当时让能力含 `ResourcesSubscribe`。

## 审查

2026-10-30 只读审查的结论是须改稿，Critical 无。Important 已改：r12-2 不再把「服务器必须先收到响应才发完成通知」写成合同，`wait.finally` 要接住 rejection，新测试走 handler；r12-3 不再把 store dispose 写成会取消 subscribe token，迟到的成功回调要补 `unsubscribe`。
