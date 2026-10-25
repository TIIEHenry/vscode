---
title: "方案 r08：sources-navigator"
type: plan
status: implemented
phase: N/A
updated: 2026-10-25
summary: "4 hold 已实施，1 weaken 维持现状；提交按会话校验，Accept 用真实行号，预览按打开组定位，检查器与引擎文件都带会话身份。"
---

## 核查

- r08-1 weaken：活动会话换成 `session-new` 后，Commit 仍对 leftover 的 `session-old` 调用 `WriteGitCommit`，Stage 会拒绝。反证是请求里的 id 仍是行自己的旧会话，接受后的空白状态也会被 no-hook 状态行再画回去，不是持久的已提交。
- r08-2 hold：Accept 仍把差异模型行号当成 `@@` 文件行号，对不上就空返回。
- r08-3 hold：预览 `DiffEditorInput` 仍按 URI 取第一组；index 先于 workingTree。
- r08-4 hold：检查目标仍不带层次节点的 `sessionId`，同一 `agentId` 不算过期。
- r08-5 hold：引擎文件 URI 和正文缓存仍只按路径，过期 `readFile` 仍会写入并打开。

## r08-1 weaken

- 问题类：活动会话已经换掉之后，Commit 仍用快照行上的旧 `sessionId` 调用 `WriteGitCommit`，接受后先清掉状态行；同一列表的 Stage 在会话不一致时拒绝。
- 不变量：这次提交算在活动会话上。快照或 leftover 行的 `sessionId` 与活动会话不一致时，不得发出 `WriteGitCommit`，也不得在接受后把当前列表的失败状态清掉。行上的 `sessionId` 继续表示这些行属于哪个会话，不能改写成新的活动 id。
- 要动的符号或文件：
  - `SourcesChangesList.runCommit`：引擎快照在调用 `runEngineCommit` 之前，用 `isSourcesEngineWriteSessionBlocked('engine', commitSessionId(snapshot), getActiveSessionId())` 做与 Stage 相同的判断。挡住时 `setWriteStatusMessage(sourcesGitSessionChangedMessage())` 并返回。
  - `SourcesChangesList.runEngineCommit`：`isSourcesGitWriteAccepted` 之后，只有活动会话仍等于本次请求的 `sessionId` 才 `setWriteStatusMessage(undefined)`。活动会话已变则保留现有状态行。引擎快照的 `activeRepository` 是 `undefined`，不能用它发现会话切换。
- 不改：
  - `commitSessionId` 与 `sourcesChangesWriteSessionId` 继续读行自己的 `sessionId`。读到的反证：请求 id 是上一会话，不是新活动 id；`scheduleRefresh` 之后若仍是 no-hook leftover，`renderFromSnapshot` 会再画 `sourcesGitReadUnavailableNoHookMessage()`。
  - 同一会话的 no-hook leftover 仍可 `writeGitCommit`。不要把 `no-hook` 加进 `isSourcesChangesWriteClosed`。
  - `landLeftover` 继续保留上一会话的行。
- 本地验证：改 `sourcesChangesList.test.ts` 的 `no-hook commit still calls writeGitCommit with the leftover session`。活动会话变为 `session-new` 后 `commitCalls.length === 0`，状态文案为 `sourcesGitSessionChangedMessage()`。同一会话下 no-hook 提交仍发出 leftover 的 `sessionId`。另断言：请求已经发出之后活动会话再变，接受结果不得清掉当前状态行。

## r08-2 hold

- 问题类：引擎 FileDiff 的 Accept 用 `@@` 文件行号解释差异模型里的光标，对不上就返回，界面没有失败。
- 不变量：光标行属于当前差异模型。模型正文是 `parseSourcesGitUnifiedDiff` 拼出的 hunk 正文，行号从 1 计。选中的 hunk 必须是包含这行正文的那一段。没有这样的 hunk 时必须留下可见失败，不能变成一次未执行的空返回。
- 要动的符号或文件：
  - `sourcesGitHunkPatchAtCursor`：按 `parseSourcesGitUnifiedDiff` 的拼接规则数正文行。`new` 侧数 modified 正文，`old` 侧数 original 正文。`cursorLine` 落在哪一段 hunk 正文，就切出那一段。不再用 `@@` 的 `newStart` / `oldStart` 文件区间比较 `cursorLine`。
  - `ConversationDiffReviewPane.runAccept` 与 `SourcesDiffPanelView.runAccept`：`!patch` 时调用已有的 `showNotice` / `showActionNotice`，不要在现在的空返回处结束。文案用已有的 `sourcesDiffAcceptUnavailableMessage()`。
- 不改：
  - 不把 unified diff 省略的文件正文补进模型。
  - `SOURCES_GIT_APPLY_CACHED_ARGV` 与 `SOURCES_GIT_ACCEPT_FILE_DIFF_INDEX_STATE` 保持。
  - `runAccept` 里已有的 generation、input、`currentRef` 检查保持。
- 本地验证：改 `sourcesGitHunkPatch.test.ts` 的 `keeps the file header and only the hunk under the cursor`、`old side matches the old file line range`、`binary diffs, empty diffs, and a cursor outside every hunk yield no patch`，光标改为拼接后的模型行。第二个 hunk，以及 `@@` 不是从文件第 1 行开始的 hunk，必须选出对应 patch；正文之外仍是 `undefined`。改 `sourcesDiffPanel.test.ts` 的 `Accept click reads Unstaged diff and applies only the cursor hunk`，`pinAcceptCursor` 使用模型行。新增断言：对不上 hunk 时 pane 与 panel 的 notice 可见，且 apply 调用次数为 0。

## r08-3 hold

- 问题类：同一文件同时在 index 和 workingTree 时，从预览 diff 移走会按 URI 命中先出现的 index，随后的暂存或取消暂存作用在索引组。
- 不变量：打开预览时的 SCM 组是这张 diff 的组。移动必须继续使用那一组的 `groupId` 和 `scmResource`。同一 URI 在另一组里命中，不能替换打开时的组。
- 要动的符号或文件：
  - `openSourcesChangeInPreview` 与 `openScmResourceInSlot`：预览编辑器打开之后，把当时的 `groupId` 和 `scmResource` 记在这张 `DiffEditorInput` 上。
  - `resolveSourcesChangeRefFromEditor` 的 `isDiffEditorInput` 分支：先读这份记录，再用 `findScmResourceForUri(scmService, modified, groupId)`。没有记录时才保留现在的单组 URI 查找。
  - `findFirstScmResourceForUri`：同一 URI 出现在多个组且没有打开时的组记录时，不要返回第一组。
- 不改：
  - `ConversationDiffReviewInput` 分支继续走 `resolveSourcesDiffWriteGate`。
  - `findScmResourceForUri` 按 `groupId` 过滤的规则保持。
  - Git 里 merge、index、workingTree、untracked 的注册顺序不改。index 仍在 workingTree 之前，所以不能靠遍历顺序区分这两组。
- 本地验证：在 `sourcesDiffRefHelpers.test.ts` 新增断言。同一 `sourceUri` 同时放进 `index` 和 `workingTree`，从 workingTree 打开的预览 `DiffEditorInput` 经 `moveActiveDiffToConversation` 和 `moveActiveDiffToPanel` 之后，结果的 `groupId` 与 `scmResource` 仍是 workingTree。

## r08-4 hold

- 问题类：切换会话后，检查器仍显示上一会话某个 agent 的状态、轮次和模型，而且不显示“已不在当前树”。
- 不变量：检查目标的会话是它身份的一部分。当前 agents 树所属会话与目标会话不同时，即使 `agentId` 仍在新树里（根是 `root`），上一份 `status`、`turnCount`、`model` 也不是当前项，必须显示已有的 stale 提示。`LiveAgentTreeNodeView` 没有 `sessionId`；会话在层次节点上。
- 要动的符号或文件：
  - `navigatorAgentsView.ts` 里 `hierarchyTree.onDidOpen` 的 `setTarget`，以及 `inspectHierarchyNode`：目标带上层次节点的 `sessionId`。
  - `AgentInspectTarget` 的 agent 分支，以及 `isInspectTargetStale`：已发布的 agents 来源会话与目标会话不一致时，agent 目标返回 true。
  - `refreshFromLease` 发布 `setLiveAgentIds('agents', …)` 时带上 `lease.sessionId`。活动会话已经变、树尚未到达时，已发布会话也不得继续等于旧目标的会话。
- 不改：
  - 不给 `LiveAgentTreeNodeView` 增加引擎折叠字段。
  - live id 为 `undefined`、且没有发布成另一个会话时，仍不算 stale。`isInspectTargetStale treats leftover empty set as stale and undefined as not following` 与 `GC-5d both hidden live-id sources do not mark stale` 保持。
  - stale 为真时继续用 `entriesFromTarget` 和 `.agent-inspect-stale-note`。
  - member、task、activity 的现有 id 判断不改。
- 本地验证：在 `agentInspectPanel.test.ts` 新增断言。目标会话是 `session-old`、`agentId` 为 `root`，agents id 集合含 `root` 但来源会话是 `session-new` 时，`isInspectTargetStale` 为 true，`.agent-inspect-stale-note` 可见。同一会话且 id 在集合里时为 false。live id 为 `undefined` 且未发布新会话时仍为 false。

## r08-5 hold

- 问题类：两个会话列出同一引擎路径时，后返回的读取会改写先打开的正文，编辑器里分不出会话。
- 不变量：引擎文件文档的身份是会话加路径。为某个会话发出的 `readFile`，回来时若已不是当前要打开的那份身份，不得 `putSourcesEngineFileText`，也不得 `openEditor` 写进当前文档。
- 要动的符号或文件：
  - `sourcesEngineFileResource`、`engineFileTextByPath`、`putSourcesEngineFileText`、`provideSourcesEngineFileText`：键带上 `sessionId`。`projectSourcesEngineFileEntry` 用 `source.sessionId` 建 resource。
  - `SourcesFilesList.openEngineFile`：调用 `readFile` 前记下条目的 `engine.sessionId` 和这一代打开序号。回调里活动会话或这一代已经变了，就丢掉结果。
- 不改：
  - `refresh` 里列表使用的 `engineToken` 取消保持。
  - workspace `fileSearch` 路径保持。
  - `resource.scheme !== SOURCES_ENGINE_FILE_SCHEME` 时仍返回空输入或空模型。
- 本地验证：扩展 `sourcesFilesEngineRead.test.ts` 的 `content provider creates the decoded text on the engine resource`。同一路径、两个 `sessionId` 是两个 resource，后写入的会话 A 正文不会出现在会话 B 的模型里。在 `sourcesFilesList.test.ts` 的 `workDir outside every workspace root lists through listFiles and opens read-only text` 旁新增断言：慢的上一会话 `readFile` 在活动会话已变后不得 put，也不得打开。

## 落地

- 2026-10-25 实施 r08-1：Commit 在发出前核对快照行所属会话与当前活动会话，不一致时写会话切换提示并返回；接受后只在会话仍是发起会话时清状态行。
- 2026-10-25 实施 r08-2：引擎 FileDiff 的 Accept 先从补丁定位光标所在 hunk，用真实新旧行号解释差异模型，不再把 `@@` 文件行号当光标行；定位失败时显示不可用提示。
- 2026-10-25 实施 r08-3：预览 diff 打开时记住所属组与 SCM 资源；同一 URI 同时出现在 index 与 workingTree 时按组解析，不命中先出现的 index。
- 2026-10-25 实施 r08-4：检查器目标与实时 agent id 都带 `sessionId`；切换会话后旧会话目标显示为 stale，不再展示上一会话的状态、轮次和模型。
- 2026-10-25 实施 r08-5：引擎文件资源带 `sessionId` 查询，正文缓存键为「会话 + 路径」；慢的上一会话读取在活动会话已变后不再写入或打开。
- 验证：sources / navigator 合计 256 passing；1 条既有失败 `hover new-session is only on the current engine workDir`。
- 既有失败：`navigatorProjectsList.test.ts` 的 `hover new-session is only on the current engine workDir`（HEAD 同样失败）。
