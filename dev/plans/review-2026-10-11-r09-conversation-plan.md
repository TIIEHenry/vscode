---
title: "方案 r09：conversation"
type: plan
status: draft
phase: N/A
updated: 2026-10-11
summary: "hold 4，drop 0，weaken 0。重叠的权限与模型切换按会话丢掉过期结果，删除事件和空名册缓存等删除生效后再落定。"
---
# 方案 r09：conversation

状态：草案。
覆盖需求：无（正文未引用需求编号）。


hold 4，drop 0，weaken 0。

## r09-1（hold，高）
### 问题类
同一会话里重叠的 `setPermissionMode` 没有代次，过期的成功或失败仍会改本地档，或把旧模式留在引擎上。
### 不变量
同一 `sessionId` 上，界面的 `permissionIndex` 和引擎模式都等于用户最后一次已受理的选择。代次更旧的成功不得在 `result.ok` 后直接返回并把该模式留在引擎上；代次更旧的失败不得调用 `restoreSessionPermissionIndex`。
### 要动的符号或文件
`applySessionPermissionIndex` 与 `restoreSessionPermissionIndex`（`src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts`，现仍在 836–880 行）。代次按 `sessionId` 记在 host 上或模块内，`IConversationLensComposerChromeHost` 上现在没有这个字段。

按会话串行：

1. 新的选择立刻写入 `setSessionConfig` 和下拉框，并记为该会话的最新目标。
2. 该会话已有未结算的 `setPermissionMode` 时，不再并行发第二笔。
3. 结算时若目标已经不是这次发出的下标：不要 `restoreSessionPermissionIndex`。无论这次成功还是失败，都要再发最新目标那一笔。过期失败只写「不 restore」、不再发最新目标，会留下界面是新档、引擎仍是旧档。
4. 结算时若目标仍是这次的下标：成功则停；失败或 `!isComposerSessionWriteLive` 时，才用最后一次引擎已确认的模式回滚，不用在途请求开始时的 `previous` 当基线。

底栏 `onDidSelect`（`conversationLensDock.ts` 206–208 行）和 More 菜单（同文件约 358–362 行）都进这一个函数，调用处不改。
### 明确不改
`SESSION_TOOL_PERMISSION_MODES` 的档位顺序。`isSessionPermissionModeAvailable` 为假时立刻回滚。没有更新选择时，pairing-hold / leftover 仍用 `isComposerSessionWriteLive` 为假回滚这次自己的 `previous`。
### 本地验证
文件：`src/vs/workbench/contrib/conversation/test/browser/conversationLensDisposeGate.test.ts`。

新增：同一会话先选 Permit 再选 Ask，让 Permit 后返回且 `ok`。界面停在 Ask，引擎最后一次 `setPermissionMode` 的 mode 是 Ask。

新增：先发出的请求失败时，不得把后一次选择 `restore` 回这次的 `previous`。

现有 pairing-hold / leftover 的 `applySessionPermissionIndex` 断言保持不变。

## r09-2（hold，中）
### 问题类
同一会话里重叠的 `switchModel` 用共享的 `modelSelectedIndex` 当回滚点，过期失败会盖掉新下标，过期成功只把当时的 `modelId` 写进表。
### 不变量
同一 `sessionId` 上，下拉框下标、`modelProfileIdBySessionId` 里的 id，以及引擎模型，都等于用户最后一次已受理的选择。下标 0 仍是 `composerModelIds` 的空串；只有用户最后停在 0 时，`submitDraft` 才省略 `modelProfileId`。
### 要动的符号或文件
`applySessionModelIndex` 与 `restoreSessionModelIndex`（`conversationLensComposerChrome.ts`，现仍在 926–989 行）。代次与 r09-1 一样按 `sessionId` 串行，两套代次分开。

1. 新的选择在仍绑定该会话时立刻改 `modelSelectedIndex` 和下拉框，并记为最新目标。
2. 已有未结算的 `switchModel` 时不并行发第二笔。
3. 过期失败不得调用 `restoreSessionModelIndex`。过期成功不得把当时的 `modelId` 留在 `modelProfileIdBySessionId`。无论这次成功还是失败，只要最新目标的 `modelId` 非空，都再发最新 `modelId`。过期失败只写「不 restore」、不再发，会让下拉框和引擎模型错开。
4. 仍是最新的失败，或 `!isComposerSessionWriteLive`，或 `resolvedModelId` 为空，才用这次的 `previous` / `previousId` 回滚。
5. 最新目标是下标 0（空 `modelId`）时，仍走现在的本地回滚，不新发 `switchModel`。过期失败不得把下拉框打回 0。

`submitDraft`（`conversationLensComposer.ts` 350–354 行）继续读 `catalogModelIds[modelSelectedIndex]`。底栏 `onDidSelect`（`conversationLensDock.ts` 240–242 行）不改。
### 明确不改
`composerModelIds` 的空串在前。`submitDraft` 对空 `modelProfileId` 的省略。换会话后再失败只回滚发起会话那一格。
### 本地验证
文件：`src/vs/workbench/contrib/conversation/test/browser/conversationLensDisposeGate.test.ts`。

保留：`applySessionModelIndex failure after rebind restores only the originating session cell`。

新增：先发出的 `switchModel` 失败，不得把下拉框打回自己的旧下标。

新增：先发出的 `switchModel` 后成功，且下拉框已经改过时，`modelProfileIdBySessionId` 与引擎最后一次 `modelId` 都等于最后一次选择，不得留下当时的 `modelId`。

新增：最后下标不是 0 时，`submitDraft` 带的 `modelProfileId` 等于该下标。最后下标是 0 时仍省略，与 `src/vs/workbench/contrib/conversation/test/browser/conversationComposerCatalog.test.ts` 里的 `submitDraft omits modelProfileId when the honest empty model is selected` 一致。

## r09-3（hold，中）
### 问题类
远程删除在 `deleteSession` 一元结算前就发出 `onDidDeleteSession`，拒绝之后叶子和子代理对话框已经被拆掉。
### 不变量
与 `IConversationRosterService.onDidDeleteSession` 的注释一致：只在该次删除已经成功后发出。拒绝时只跑 `rollbackEngineSessionDelete`，不调用 `disposeConversationEditorPart`，不调用 `closeSubAgentDialog`。
### 要动的符号或文件
`deleteEngineSession`（`src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts`，事件现仍在 1654 行）。`deleteSession` 的类型是 `Promise<void>`，拒绝是 throw，`dispatchEngineAction`（1015–1028 行）的 recover 才会跑。

`callRemote === true` 时去掉同步的 `_onDidDeleteSession.fire`。把 fire 放进 `uaConnection.deleteSession` resolve 之后的成功后续。throw 时不 fire，仍只调用已有的 `rollbackEngineSessionDelete`。

`callRemote === false` 时，本地缓存删除仍在 `deleteEngineSession` 末尾同步 fire。
### 明确不改
`rollbackEngineSessionDelete`（1658–1678 行）不重建叶子、不重开对话框。`disposeLeafForDeletedSession` / `rollbackHalfAppliedLeaf`（`conversationSessionWindowService.ts` 711–732 行）。`conversationSessionChatService.ts` 73–76 行的监听。`ConversationStubService.deleteSession`（约 504 行）的同步 fire。不为删除增加 `{ ok: false }` 判断。其它 `dispatchEngineAction` 调用的成功语义不改。
### 本地验证
文件：`src/vs/workbench/contrib/conversation/test/browser/conversationEngineRosterService.test.ts`。

保留：`connected deleteSession last entry remote throw rolls back roster and bind-failed empty-state`、`connected deleteSession mid-list remote throw restores row index and active`、`engine rejection of deleteSession re-lists the catalog instead of keeping the row gone`。

新增：远程 `deleteSession` throw 时 `onDidDeleteSession` 不发出；resolve 之后才发出。

`conversationSessionWindowService.test.ts` 里的 `onDidDeleteSession promotes surviving leaf when primary window is deleted` 与 `onDidDeleteSession clears focused leaf when last window is deleted` 保持「事件一旦发出就卸叶子」。拒绝路径的断言是事件未发出，因此不调用 `disposeConversationEditorPart` 和 `closeSubAgentDialog`。

## r09-4（hold，中）
### 问题类
最后一条引擎会话删除生效后，空名册持久化把存储里上一份缓存原样写回。
### 不变量
该次删除的一元已经 resolve，且内存里已经没有这次删掉的会话、`engineSessions.length === 0` 时，当前引擎桶写成 `{ sessions: [] }`。冷启动构造与 `adoptSnapshotEngineIdentity` 走 `restoreEngineCacheFromStorage` 时，不得再装回该会话及其 turns。
### 要动的符号或文件
与 r09-3 同一处删除成功后续。`persistEngineAwareRoster`（`conversationEngineRosterService.ts` 2089 行）已能接收显式 `engineCache`。成功且名册为空时调用 `persistEngineAwareRoster(this.wasEverConnected, { sessions: [] })`，不要让这次写入落到 `buildPersistedEngineCache` 的空列表回退（2110–2113 行的 `selectEngineCache`）。

乐观路径上，远程删除把列表删空时，1653 行的 `persistEngineAwareRoster()` 先不要把旧桶再写一遍。失败仍由 `rollbackEngineSessionDelete` 里 1678 行的 `persistEngineAwareRoster()` 写回恢复后的非空列表。还剩其它会话时，1653 行的乐观持久化可以留下。
### 明确不改
`buildPersistedEngineCache` 在 `engineSessions.length === 0` 时回读 `selectEngineCache`，留给列表失败和 `captureEngineCache`。`markEngineSessionBindFailed`（195–210 行）的内存占位。`restoreEngineCacheFromStorage`（2012–2035 行）在 `sessions.length === 0` 时直接返回。`doRefreshEngineCatalog` 的空列表仍走 `ensureEngineSession`。
### 本地验证
文件：`src/vs/workbench/contrib/conversation/test/browser/conversationEngineRosterService.test.ts`。

保留：`connected deleteSession last entry does not refill stub seeds`。当前进程仍是绑定失败占位，不灌 stub seed。

保留：`connected deleteSession last entry remote throw rolls back roster and bind-failed empty-state`。throw 之后该会话仍在名册里，存储里的该引擎桶仍含该会话。

新增：连上引擎且只剩一条会话时，`deleteSession` resolve 之后，`CONVERSATION_ROSTER_STORAGE_KEY` 里该引擎桶的 `sessions` 为空。用这份 storage 再构造一个 roster，`getSessions` 不含被删 id，也不含它的 turns。`adoptSnapshotEngineIdentity` 换桶再换回时同样不装回。
