---
title: "潜在缺陷：Review 与 Diff"
type: progress
status: draft
phase: M7
updated: 2026-09-24
summary: "Review 打开、Diff 搬家和 Code OSS 迁移里有审错目标、串会话写和覆盖丢设置的路径。"
---

# 潜在缺陷：Review 与 Diff

## 结论

范围内 6 条有用户可观察后果。最重的是 Diff Accept/Stage 跟着切换后的活动会话提交，以及从命令面板迁移时先删掉目标设置再拷贝。Panel 第一次打开对比会被记成失败，Review 已审标记也可能被过期刷新清掉。

## 发现

### BH-16-1

- 严重度：high
- 置信度：高
- 位置：`src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts` 的 `getGitSessionId`（约 298 行）、`runAccept`（约 457 行）、`runStage`（约 407 行）；`src/vs/workbench/contrib/sources/browser/sourcesDiffPanelView.ts` 的 `getGitSessionId`（约 405 行）、`runAccept`（约 574 行）、`runStage`（约 524 行）
- 行为：补丁挂在打开 diff 时的输入上，但 Accept / Stage 在点击时读取 `roster.getActiveSessionId()`，把 `sessionId` 和补丁一起交给 `tryWriteSourcesGitApplyHunks` / `tryWriteSourcesGitStagePaths`。相邻 `sourcesChangesGitWrite.ts` 的 `sourcesGitApplyHunksRequest` 原样把这个 `sessionId` 放进写请求。
- 为何是缺陷：diff 是在会话 A 打开的，用户切到会话 B 后按钮仍在（连接和活动会话变化会 `updateReviewActions` / `updateWriteActions`）。确认后写入落到 B，A 的改动被记到另一个会话。
- 触发：Conversation Diff 或 Diff Panel 已打开并带有 apply-hunks 补丁或可暂存路径，然后切换活动会话再点 Accept 或 Stage。
- 已知：否
- 修复方向：打开 diff 时记下当时的 sessionId，写请求只用这份，会话已变则拒绝并提示。

### BH-16-2

- 严重度：high
- 置信度：高
- 位置：`src/vs/workbench/contrib/universeAgentMigration/common/codeOssMigration.ts` 的 `copyIfExists`（约 94 行）、`migrateCodeOssUserData`（约 116 行）；命令入口 `src/vs/workbench/contrib/universeAgentMigration/electron-browser/universeAgentMigration.contribution.ts` 的 `runMigrateFromCodeOss`（约 33 行）
- 行为：`fileService.copy(source, target, true)` 在覆盖时会先 `del` 目标（目录递归删除）再写入。命令面板里的 Migrate from Code - OSS 不看目标是否已有 `settings.json`，三条允许列表（设置、快捷键、snippets）都会走这条覆盖。
- 为何是缺陷：目标里已有的设置、快捷键或仅存在于目标的 snippets 会先被删掉。拷贝中途失败时，源文件没有回来，目标文件已经没了。
- 触发：当前用户数据目录里已经有设置或 snippets，再执行 Migrate from Code - OSS；或目标文件已存在且拷贝在删除之后失败。
- 已知：否（D393 / D395 / D400 只锁提供条件、路径和允许列表，不覆盖「先删后拷」）
- 修复方向：目标已存在时先确认，拷到临时文件成功后再替换，失败则保留原文件。

### BH-16-3

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/sources/browser/sourcesDiffRefHelpers.ts` 的 `resolveActiveSourcesChangeRef`（约 98 行）以及 `moveActiveDiffToConversation` / `moveActiveDiffToPreview` / `moveActiveDiffToPanel`（约 114–151 行）；菜单在 `src/vs/workbench/contrib/sources/browser/sourcesDiffActions.ts`（约 41–50、96–105 行）
- 行为：Panel 标题上的 Move Diff to Conversation / Open Diff in Preview 与编辑器标题共用同一函数。函数只要活动编辑器能解析成 diff，就用那份 ref，面板上的 `getCurrentRef()` 只在活动编辑器不是 diff 时才用。
- 为何是缺陷：编辑器里开着文件 A 的 diff，面板里是文件 B。在面板上点搬家，被关掉并送到 Conversation 或 Preview 的是 A，B 留在面板。用户审的是另一份文件。
- 触发：同时存在一个普通 diff 编辑器和一份不同文件的 Sources Diff Panel，从面板标题执行搬家。
- 已知：否
- 修复方向：ViewTitle 调用只取面板当前 ref，EditorTitle 才取活动编辑器。

### BH-16-4

- 严重度：medium
- 置信度：高
- 位置：`src/vs/workbench/contrib/sources/browser/sourcesDiffPanelView.ts` 的 `renderRef`（约 288–372 行，正文未挂上时约 303–308 行）；`src/vs/workbench/contrib/sources/browser/sourcesDiffPanelService.ts` 的 `show`（约 39–43 行）。打开方在相邻 `sourcesChangeEntryOpen.ts`（约 56–61 行）等待 `watchSourcesDiffPanelComparison`
- 行为：`show` 先同步发出 `onDidChangeRef`，再 `openView`。视图正文还没有时，`renderRef` 立刻把这次比较 settle 成失败。之后 `renderBody` 虽能画出 diff，watch 已经结束，成功结果被丢掉。生成号被新一次渲染抢走时，旧渲染的 `finally` 同样用 `loadedOk === false` settle 自己的 ref。
- 为何是缺陷：Review 行打开 Panel 会抛出 Unable to load this comparison，状态栏报打开失败，该行不会标成已审，但面板随后可能已经显示出这份 diff。连点两行时，先打开的那行也会被记成加载失败。
- 触发：Diff Panel 视图尚未创建时从 Review 打开一行（`sources.diff.defaultOwner` 为 panel）；或上一份对比还在加载时又打开另一行。
- 已知：否
- 修复方向：正文未就绪不要 settle；被新一代取代的渲染不要把 watch 收成失败。

### BH-16-5

- 严重度：medium
- 置信度：中
- 位置：`src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts` 的 `ensureEntryKeys`（约 434–444 行）和 `refresh`（约 687–772 行）
- 行为：`refresh` 在 `await ensureEntryKeys` 之后才比较 `refreshSeq`。`ensureEntryKeys` 会整表换掉 `entryKeys`，并调用 `pruneMissingKeys` 删掉不在本次集合里的已审记录。后完成的旧刷新检查序号失败后直接 return，不会把列表画回去。
- 为何是缺陷：慢的 git 读取进行中又来了连接或会话刷新时，旧一轮会清掉新一轮已经记下的已审标记。界面上已审圆点消失，进度计数变小，直到用户再次打开或手动标记。
- 触发：Review 列表一次 `refresh` 还停在 `tryLoadGitEntries` 或 `ensureEntryKeys` 时，连接、活动会话或 SCM 又触发一轮刷新，且旧一轮后结束。
- 已知：否
- 修复方向：`ensureEntryKeys` 开始和写回前都核对 `refreshSeq`，过期轮次不得 prune。

### BH-16-6

- 严重度：low
- 置信度：高
- 位置：`src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts` 的 `updatePathFilterBanner`（约 526–539 行）；过滤在 `src/vs/workbench/contrib/sources/common/sourcesReviewListModel.ts` 的 `filterReviewEntries`（约 20–22 行）
- 行为：横幅文案 Showing {0} files from this turn 的数字是路径过滤数组长度，不是与当前变更相交后的行数。列表本身按 URI 交集过滤。
- 为何是缺陷：本回合选了 5 个路径但只有 1 个仍有变更时，横幅写正在显示 5 个文件，列表只有 1 行。用户会以为漏了 4 个待审文件。
- 触发：`sources.review.showForPaths` 传入的路径多于当前 Review 列表里对得上的变更。
- 已知：否
- 修复方向：横幅使用过滤后的可见行数，或改成「选中 N 条路径」。

## 看过但未立条

- `universeAgentMigration.contribution.ts` 的 `maybeOffer` 在用户点 Migrate 之前就把 `universeAgent.migration.offered` 写成 true。这是一次性提议，之后仍可从命令面板迁移，不是丢数据。
- Review / Diff 在 pairing-hold、leftover list-fail 时关掉打开、标记和 Stage/Accept，是有意 fail-closed（D315、D317、D322、D325、D343、D444、D446、D448 已关）。
- `ConversationDiffReviewInput.editorId` 返回的是输入 typeId，面板 id 是 `ConversationDiffReviewEditorId`。活动编辑器上下文用的是 pane id，搬家菜单仍能出现。
- `sourcesDiffPanelView.ts` 的模型引用同时放进 `bodyDisposables` 和 `SourcesDiffEditorModel`。`ReferenceCollection` 的 dispose 是单次调用，不会把引用计数减两次。
- `sourcesReviewAttribution.ts` 在 work_dir 与工作区根不一致时不画 chip，并给出 mismatch 说明，是有意省略归属。
- 归属 chip 的点击把 `toolCallId` 交给 `conversation.revealItem`。该命令接受 `toolCallId` 并在活动会话的 attribution 里解析，与 chip 的分桶一致。

## 未读完

生产范围内文件均已读完（browser 与 common 里文件名含 Review、Diff、conversationDiff 的 ts，加上上述两份迁移文件）。未把 `sourcesChanges/`、`sourcesFiles/`、sessions 和其余 VS Code 原生树当扫描面；只在打开、写请求和 reveal 命令上读过相邻实现以确认后果。
