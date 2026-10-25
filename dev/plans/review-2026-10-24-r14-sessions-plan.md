---
title: "方案 r14：sessions"
type: plan
status: implemented
phase: N/A
updated: 2026-10-25
summary: "4 hold 已实施；追问框绑定自身会话，断连时已读拒绝，分组成员随正式 id 替换，变更审阅按编辑器会话写入。"
---

## 判定

- r14-1 hold：`NewChatInSessionWidget._session` 仍读全局 `activeSession`，草稿键在构造时钉死；`NewChatView` 不覆盖 `setChat`，窗格传入的会话被丢掉。
- r14-2 hold：断连时 `setSessionReadState` 仍先改 `cached.isRead` 并广播，没有连接就不发 `SessionIsReadChanged`。
- r14-3 hold：`onDidReplaceSession` 只搬 `_inFlightSessionGroups`，已写入的 `_membership` 留在旧 id 上。
- r14-4 hold：审阅和资源操作仍读全局 `activeSessionChangesetObs` / `activeSessionChangesObs`；编辑器在会话对不上时继续显示自己的上一份列表。

## r14-1 hold

- 问题类：并排窗格里的追问框用全局当前会话发送，草稿键却停在创建时的会话上。
- 不变量：每个窗格的 `SessionView` / `ChatGroupView` 持有该窗格的会话。追问框的发送目标、背景里的 `openNewChatInSession`、上下文目录和草稿键必须一直是这个会话。全局 `activeSession` 切走之后，这个窗格里已打开的追问框不得改投到新的当前会话。
- 要动的符号或文件：
  - `ChatGroupView` 创建 `newChatInSession` 视图时（`chatGroupView.ts`），把该分组的 `context.session` 交给 `NewChatView` / `NewChatInSessionWidget`。
  - `NewChatInSessionWidget._session` 改为这个窗格会话，不再 `derived` 自 `sessionsService.activeSession`。`_send`、`_getContextFolderUri`、`canSendRequest` 都读它。
  - `draftStorageKey` 用该会话的 `sessionId`（`inSessionDraftStorageKey`）。同一控件上的窗格会话 id 变了时，先按旧键 `saveState`，再换键。
  - `NewChatView.setChat`：仅 `kind === 'newChatInSession'` 时把传入的 `session` 写进上述绑定。没有 chat、因而不会调用 `setChat` 时，仍以创建时的 `context.session` 为准。
- 不改：`ChatGroupsView.setSession` 在会话对象相同时直接返回；欢迎页 `NewChatWidget`；`AbstractChatView.setChat` 对其余子类仍是空实现；欢迎草稿与追问草稿继续分键。
- 本地验证：保留 `keeps a follow-up draft off the welcome composer key`、`follow-up composer writes its draft on storage flush and when the view is torn down`。新增断言：控件绑定会话 A、全局 `activeSession` 换成 B 后，`_send` 调用的 `sendRequest` 与背景 `openNewChatInSession` 的会话仍是 A，草稿写入 `inSessionDraftStorageKey(A)`。

## r14-2 hold

- 问题类：远程宿主已断开、缓存会话仍在列表里时，标已读会先把本地未读清掉，宿主侧动作不发出。
- 不变量：已读事实在宿主的 `IsRead`。`cached.isRead` 只有在 `SessionIsReadChanged` 已经交给当前 `connection` 时才能改，并才能广播。没有 `connection` 时，列表上的未读必须保持，调用方必须看到这次失败。不得把记不下来的变更持久进会话缓存。
- 要动的符号或文件：
  - `BaseAgentHostSessionsProvider.setSessionReadState`：与 `_setSessionArchived` 一样，`!cached || !rawId || !connection` 时不 `set`、不 `fire`。有连接时才改 `cached.isRead`、广播，并 `dispatch` `SessionIsReadChanged`。
  - `SessionsManagementService.setSessionReadState`：这次没有真正发出时抛错，形态对齐 `archiveSession` 在 provider 返回 false 时的失败。
  - `MarkSessionReadAction` / `MarkSessionUnreadAction`：`await` 并用 `dialogService.error` 显示失败，与归档命令相同。
  - `sessionsService` 里「当前会话未读就 `markRead`」以及列表里不等待的 `markRead`：断连时只保持未读，不把拒绝变成未处理的拒绝，也不弹归档那种错误框。
- 不改：`_setSessionArchived` 的断连拒绝；`clearConnection` 保留缓存、`unpublishCachedSessions` 隐藏列表；本地宿主始终有 `connection` 的成功路径。
- 本地验证：没有断连已读测试。新增断言：`connection` 为 `undefined` 时 `cached.isRead` 不变、`onDidChangeSessions` 不因此 `fire`、管理服务的 `setSessionReadState` 拒绝。有连接时仍更新 `isRead` 并 `dispatch` `SessionIsReadChanged`。

## r14-3 hold

- 问题类：骨架会话已经进了自定义分组之后，正式会话换了 `sessionId`，成员记录留在旧 id 上。
- 不变量：`SessionGroupsService._membership` 持有「这个会话属于哪个分组」。`onDidReplaceSession` 里 `from.sessionId !== to.sessionId` 时，旧 id 上的成员关系就是新 id 的成员关系。旧 id 不得继续留在分组里，新 id 不得因为查不到成员而掉出分组。
- 要动的符号或文件：
  - `SessionGroupsService` 的 `onDidReplaceSession` 处理：在现有在途表搬迁之外，若 `_membership` 有 `from.sessionId`，删掉旧 id；目标分组还在则把 `to.sessionId` 记入同一 `groupId`（`setMembership`），`membershipChanged` 带上两个 id，并 `save`。分组已不在则只丢掉旧成员，不给新 id 另找分组。
- 不改：`onWillSendRequest` / `onDidStartSession` 的在途分组跟随；`from.sessionId === to.sessionId` 时直接返回；`addToGroup` 的即时写入。
- 本地验证：保留 `pending group follows the draft as it graduates to a committed id`。新增断言：对骨架 id `addToGroup` 之后再 `onDidReplaceSession` 到新 id（不走 `setPendingNewSessionGroup`），`getGroupOfSession(新 id)` 为该分组，`getGroupOfSession(旧 id)` 为 `undefined`。

## r14-4 hold

- 问题类：变更编辑器还显示上一会话的文件时，审阅和资源操作写进全局当前会话的变更集。
- 不变量：变更编辑器输入上的 multi-diff source 持有这份 diff 的会话（`SessionChangesService.getSessionResource`）。审阅和资源级操作只能写这个会话里、确实包含该行的变更集。编辑器会话不是全局当前会话时，不得调用当前会话的 `setChangesetFilesReviewState` 或 `invokeOperation`。工作区路径相同不是「这行属于当前会话」的证据。
- 要动的符号或文件：
  - `ChangesetReviewAction.run`：从当前 `SessionChangesEditor` 的输入（或 changes scheme 的 multi-diff source）取出编辑器会话，在该会话的 `changesets` 里用 `findSessionFileChange` 定位变更集，只对那个变更集 `setReviewState`。编辑器会话与 `activeSessionResourceObs` 不一致时，禁止落到 `activeSessionChangesetObs`。
  - `SessionChangesUIElementFactory.handleHeaderMiddleClick`：成员资格改对工厂拿到的 `changesObs`（即编辑器的 `_scopedChangesObs`）。审阅能力看编辑器会话的变更集，不再用 `activeSessionChangesetObs` / `activeSessionChangesObs` 放行。
  - `changesActions.ts` 里资源级 `changesetOperation` 的 `run`：同样只 `invokeOperation` 编辑器会话上含该资源的变更集。列表动作若带了会话参数，也不得再改读 `activeSessionChangesetObs` 当作写入目标。
- 不改：`ChangesMultiDiffSourceResolver` 与 `_scopedChangesObs` 在会话不一致时退回 `lastValue` 的显示；没有编辑器会话的调用仍可按当前变更集处理（现有直接 `run(resource)` 的路径）。
- 本地验证：保留 `ignores a resource that is not part of the active changeset`、`toggles the review state for a resource in the active changeset`（编辑器会话就是当前会话时仍翻转）。新增断言：编辑器绑定会话 A 且仍含资源 R，全局当前会话 B 的变更集也含 R；审阅与资源操作不得调用 B 的 `setReviewState` / `invokeOperation`，只写 A 里含 R 的变更集。中键在 `changesObs` 不含 R、仅当前会话含 R 时不得发审阅命令。

## 落地

- 2026-10-25 实施 r14-1：`NewChatInSessionWidget` 持有窗格自己的 `IActiveSession`，发送与草稿键都用它；全局活动会话变化不再改绑追问框。`NewChatInput.setDraftStorageKey` 换键前先 flush 旧草稿，再恢复新键。
- 2026-10-25 实施 r14-2：远程宿主断开时，标已读在本地清未读之前拒绝，不再出现宿主动作未发出但本地已读。
- 2026-10-25 实施 r14-3：骨架会话转正后，自定义分组的成员记录从临时 id 替换为正式 `sessionId`，不再留在旧 id 上。
- 2026-10-25 实施 r14-4：审阅与资源操作从编辑器输入解析所属会话，只写该会话的变更集；中键成员资格按工厂的 `changesObs` 判断，不落到全局当前会话。
- 验证：`sessionGroupsService.test.ts`、`changesetReviewActions.test.ts`、`newChatInput.test.ts`、`remoteAgentHostSessionsProvider.test.ts` 合计 125 passing。
- 既有失败：无。
