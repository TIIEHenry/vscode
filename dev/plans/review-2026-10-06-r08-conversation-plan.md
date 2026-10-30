---
title: "方案 r08：conversation"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 3，drop 0，weaken 1。"
---
# 方案 r08：conversation

状态：草案。
覆盖需求：无（正文未引用需求编号）。


hold 3，drop 0，weaken 1。

## r08-1 hold

问题类：`listSessions` 成功后，没有视图租约的会话被换成空 `turns`，并写进当前引擎桶。

不变量：

- `doRefreshEngineCatalog` 替换 `engineSessions` 之前，按 session id 留下旧行。新行没有 `getCachedProjection` 时，沿用旧行上已有的 `turns` 副本，不用 `[]` 覆盖。
- `getCachedProjection` 仍只在该会话的租约还在 `leases` 里时返回（`conversationEngineFrameSource.ts` 第 92–104 行）。有租约的会话继续用投影生成落盘 turns；这条内存行可以仍是空数组。
- 旧行上没有 turns、存储里也没有该 id 的 turns 时，新行保持空数组。
- `isConversationPairingHold` 时 `refreshEngineCatalog` 仍直接返回，不发 `listSessions`（第 1851–1853 行、第 1871–1873 行）。

要动的符号或文件：

- `doRefreshEngineCatalog` 里替换 `engineSessions` 的那段（`conversationEngineRosterService.ts` 第 1875–1883 行，`turns: []` 在第 1880 行）。第 1897 行的 `persistEngineAwareRoster()` 继续走 `buildPersistedEngineCache`（第 2059–2063 行）：无投影时用行上的 `session.turns`。

明确不改什么：

- `rememberObservedProjection`（第 1812–1825 行）仍在丢掉观察租约之前把当时的投影抄到行上。
- 有租约时 roster 对象的 `turns` 保持空数组。
- 配对保持期间不额外拉列表，失败分支仍保留上一份 leftover（第 1903–1908 行）。

怎样本地验证：

- 保持 `conversationEngineRosterService.test.ts` 的 `projected engine turns notify roster detail without writing session.turns`：活投影期间该行 `turns.length` 仍为 0。
- 保持同文件 `switching sessions keeps the previous session projected turn count`。
- 在同文件新增断言：某会话行上已有用户/助手 turns，且该 id 没有被持有的租约；再次 `listSessions` 成功并落到存储后，该会话的 turns 仍是这些消息。有租约的当前会话内存行 `turns.length` 仍可为 0。
- `scripts/test.sh --grep "projected engine turns notify roster detail without writing session.turns|switching sessions keeps the previous session projected turn count"`

## r08-2 weaken

问题类：列表刷新和切换会话落盘时，内存行上已有的 `workDir` 没有写进引擎缓存；下次从这份存储恢复就没有这个目录。

反证：换引擎身份时 `adoptSnapshotEngineIdentity` 先调用 `captureEngineCache`（第 1941 行）。`captureEngineCache` 在第 1992–2000 行和第 2008 行写出非空 `workDir`。`setEngineConnected(false)`（第 211–212 行）和 `onUaConnectionChanged` 的断开分支（第 1665 行）也走这条捕获。内存行上还有目录时，活的换桶会把它写回当前桶。删除回滚的快照（第 1591–1592 行）只有 `id`、`title`、`turns`、`source`，`workDir` 在 `persistEngineAwareRoster`（第 1651 行）之前已经不在这行上。

不变量：

- `buildPersistedEngineCache` 在 `session.workDir` 非空时写出该字段，形状与 `captureEngineCache` 的会话对象相同。
- `workDir` 为空或未设置时不写该字段。
- 会话目录在恢复后的行上为空时，审查导航仍用连接上的工作目录（`conversationReviewNavService.ts` 第 106 行）。

要动的符号或文件：

- `buildPersistedEngineCache` 返回的 session 对象（`conversationEngineRosterService.ts` 第 2064–2069 行）。列表成功（第 1897 行）和 `switchSession`（第 364、377 行）都经 `persistEngineAwareRoster` 走到这里。

明确不改什么：

- `captureEngineCache`、`adoptSnapshotEngineIdentity`、断开时的捕获调用。
- 删除快照的字段集合（第 1591–1592 行）。
- `conversationReviewNavService.sessionWorkDir` 为空时回退到 `connectionSnapshot.workDir`。

怎样本地验证：

- 保持 `conversationReviewEntry.test.ts` 的 `blank session workDir falls back to the connection workDir`。
- 保持 `conversationEngineRosterService.test.ts` 的 `engine cache buckets by engine identity and does not apply another engine or the legacy cache`。
- 在 `conversationEngineRosterService.test.ts` 新增断言：内存行带非空 `workDir` 时，列表成功或 `switchSession` 写入的当前桶会话仍带同一 `workDir`；用这份存储新建 roster 后，恢复行也带它。
- `scripts/test.sh --grep "blank session workDir falls back to the connection workDir|engine cache buckets by engine identity"`

## r08-3 hold

问题类：有租约时收进引擎缓存的时间线丢掉提问、错误、未知、系统行，也不保留 `agentId`；真断开后 stub 投影再丢掉这些 kind。

不变量：

- `entriesToLegacyTurns` 保留 `question`、`error`、`unknown`、`system`，并拷贝 `agentId`，以及 `entryToRenderableTurn` 已经转发的诚实字段：`retryable`、`typeName`、`rawContent`、`questionItems`、`answerKeysValid`、`questionRequestId`。
- `pending`、id 以 `overlay:` 开头、以及 `streaming` 且没有 `toolStatus` 的条目仍然跳过（第 1298–1299 行）。
- `reviewNav` 仍然不进 legacy turns。
- `stubTurnsToSnapshot` 为这四种 kind 生成时间线行；`turn.agentId` 有值时写进 attribution。`user`、`assistant`、`thinking`、`tool`、`visualization`、`confirmation` 已有的 attribution 同样带上已有的 `agentId`。
- 真断开后 `acquireSessionView` 仍回到 stub frame source（`conversationEngineRosterService.ts` 第 854 行）。配对保持仍取引擎帧（第 850–853 行）。

要动的符号或文件：

- `entriesToLegacyTurns` 与 `isStubTurnKind`（`conversationSessionView.ts` 第 1293–1324 行）。调用链是 `projectSnapshotToLegacyTurns`（`conversationStubService.ts` 第 511–516 行）。
- `stubTurnsToSnapshot`（`conversationSessionView.ts` 第 187–277 行；default 在第 259–262 行）。stub frame source 的 `project` 用它（`conversationStubFrameSource.ts` 第 79 行）。

明确不改什么：

- `entryToRenderableTurn`（第 1355–1384 行）的活投影映射。
- `canReadCachedEngineProjection`（`conversationEngineRosterService.ts` 第 351–354 行）。
- 无存储服务时 `captureEngineCache` 提前返回、不把活投影抄进行上（第 1978–1980 行）。

怎样本地验证：

- 保持 `conversationReviewEntry.test.ts` 的 `entriesToLegacyTurns drops reviewNav kind`。
- 保持 `conversationSessionView.test.ts` 的 `entryToRenderableTurn forwards optimistic pending and omits it on durable rows`：pending 行仍不进 `entriesToLegacyTurns`。
- 保持 `conversationEngineRosterService.test.ts` 的 `getTurns and getTrajectoryRecords keep leftover cache while pairingPending then true disconnect falls back`。
- 在 `conversationSessionView.test.ts` 新增断言：投影里有 `question`、`error`、`unknown`、`system`，且 user/assistant 带 `agentId`；经 `projectSnapshotToLegacyTurns` 再 `stubTurnsToSnapshot`，再 `projectSnapshotToEntries`，这四种 kind 还在，对应行的 `agentId` 还在。
- `scripts/test.sh --grep "entriesToLegacyTurns drops reviewNav kind|entryToRenderableTurn forwards optimistic pending|getTurns and getTrajectoryRecords keep leftover cache"`

## r08-4 hold

问题类：每次会话名单变化都按当前可见 id 删工作区草稿，换引擎桶或只剩绑定失败占位时，其它桶里的未发送草稿被清掉。

不变量：

- 换引擎身份（`adoptSnapshotEngineIdentity` 第 1941–1949 行把当前桶装回 `engineSessions` 再 `onDidChangeSession`）之后，不在当前 `getSessions()` 里、但草稿键仍对应其它桶会话的条目，留在工作区存储和 `host.drafts`。
- 列表失败后 `getSessions()` 只剩绑定失败占位（第 236–239 行；`markEngineSessionBindFailed` 第 188–203 行）时，连接前写下的草稿同样留下。
- `deleteSession` 返回 true 时，仍只删该会话的草稿（`deleteActiveSession` 第 546 行调用 `deleteComposerDraftsForSession`）。
- 空文本仍由 `storeUaClientComposerDraft` 删掉这一条键（`uaClientComposerDrafts.ts` 第 64–68 行）。

要动的符号或文件：

- `pruneOrphanComposerDrafts`（`conversationLensComposer.ts` 第 510–519 行）的两处调用：`conversationLens.ts` 第 304 行（构造时）和第 329–330 行（每次 `onDidChangeSession`）。这两处不再用当前 `getSessions()` 的 id 去调 `pruneUaClientComposerDrafts`（`uaClientComposerDrafts.ts` 第 86–98 行）。
- 确认删除继续走已有的 `deleteComposerDraftsForSession`。

明确不改什么：

- `deleteActiveSession` 在删除被拒绝时把草稿写回原会话（第 533–538 行）。
- `loadUaClientComposerDraft`、`storeUaClientComposerDraft`、`removeUaClientComposerDraftsForSession`。
- `pruneUaClientComposerDrafts` 的实现可以留在文件里；镜头的构造和 `onDidChangeSession` 不再用当前可见名单调用它。

怎样本地验证：

- 保持 `conversationLens.test.ts` 的 `SessionBar deleteSession false keeps composer draft on the original session`。
- 保持同文件 `SessionBar deleteSession optimistic true then rollback restores composer draft`。
- 在同文件新增断言：工作区里有会话 A、B 的草稿；当前 `getSessions()` 只有 B，或只有绑定失败占位；`onDidChangeSession` 之后 A 的草稿键还在。对 A 的 `deleteSession` 返回 true 之后，A 的草稿被删，B 仍在。
- `scripts/test.sh --grep "SessionBar deleteSession false keeps composer draft|SessionBar deleteSession optimistic true then rollback restores composer draft"`
