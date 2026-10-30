---
title: "方案 r15：copilot"
type: plan
status: implemented
phase: N/A
updated: 2026-10-25
summary: "5 hold 已实施；云端提交与建会话按活动或显式仓库，未知文件不自动批准，补丁按 requestId 隔离，基线跟随目标仓库，取消后不再写笔记本编辑。"
---
# 方案 r15：copilot

状态：已完成。
覆盖需求：无（正文未引用需求编号）。


## 核查

- r15-1 hold：`repoInfo` 仍在活动仓库上 `commit({ all: true })`，`invokeRemoteAgent` 仍用选中仓库或 `getRepoId` 的第一项建会话。
- r15-2 hold：解析不出文件时 `handleWritePermission` 仍返回 `approve-once`；`permissionHelpers.spec.ts` 用拒绝桩锁住了这条路径。
- r15-3 hold：`ToolsService` 仍只建一个 `ApplyPatchTool`，`resolveInput` 仍写入实例上的 `_promptContext`，`lastProcessed` 仍只按补丁文本缓存。
- r15-4 hold：`DEFAULT_REPOSITORY_ID` 拆不出 owner/repo，比较仍为真，已传入的 `base_ref` 仍被改成 `default_branch`。
- r15-5 hold：`processFullRewriteNotebook` 仍传入 `CancellationToken.None`，写流前仍不看 `invoke` 的令牌。

## r15-1 hold

- 问题类：同一次云端委托把本地提交和远端会话记到了两个仓库上。
- 不变量：这次会话选定的仓库是唯一事实。确认提交所推的分支、`createSession` 的 `owner`/`repo`/`headRef` 必须是该仓库；访问失败时的文案也必须是这次打开的仓库。
- 要动的符号或文件：
  - `CopilotCloudGitOperationsManager.repoInfo`、`commitAndPushChanges`、`pushBaseRefToRemote`：改为接收本次选定的仓库。`sessionRepositoryMap` 的值是 `org/repo` 时，只打开远程 URL 能对上这个 id 的本地 `Repository`；对不上就失败返回，不得改提交活动仓库。值是 `DEFAULT_REPOSITORY_ID` 或没有选中项时，用 `activeRepository`，并从该仓库的 remote 取 `GithubRepoId`，不得用 `getRepoId()[0]`。
  - `repoInfo` 在 `getRepository` 失败时，错误文案使用这次要打开的 `org/repo`。
  - `CopilotCloudSessionsProvider.handleConfirmationData`、`detectedUncommittedChanges`、`checkBaseBranchPresentOnRemote`：未提交改动、远程是否已有基线、以及随后的 commit/push，都针对上面解析出的同一个本地仓库和同一个 `org/repo`。
  - `invokeRemoteAgent`：`createSession` 的 `owner`/`repo` 使用同一次解析结果。`headRef` 只接受刚刚推到这个远程的分支。
- 不改：`getRepoId` 的多根列表顺序；`performCommit` 的 `commit({ all: true })`、交互式提交、回滚和切回基线；`createSession` 的 prompt、标题、模型和 partner agent。
- 本地验证：`copilotCloudSessionsProvider.spec.ts` 没有覆盖这条路径。新增断言：多根且活动仓库不是 `repositories[0]` 时，未另选则 commit/push 与 `createSession` 都落在活动仓库；选中另一 `org/repo` 时，commit/push 与 `createSession` 都落在该仓库，活动仓库没有新提交。`getRepository` 失败时，错误文案是这次要访问的仓库。

## r15-2 hold

- 问题类：写权限不知道目标文件时被当成已批准。
- 不变量：写权限的批准必须对应一个已解析的文件，或一次用户明确同意。解析不出 URI 时，结果不能是 `approve-once`；用户在确认里拒绝时，`respondToPermission` 必须收到拒绝。
- 要动的符号或文件：
  - `handleWritePermission`：`getFileBeingEdited` 得不到 URI 时，不要进入当前 `!toolParams` 的 `approve-once` 分支。改为调用已有的 `showInteractivePermissionPrompt`，并原样返回它的结果。
  - `getFileEditConfirmationToolParams` 在没有文件时仍返回空。调用方只把「文件已解析且确认文案为空」继续当成不需要确认；不得把「没有文件」和这条混成批准。
- 不改：文件已解析且位于工作区、隔离工作目录或会话目录内的自动批准；工作区外且已有 `fileName` 的确认；`requiresFileEditconfirmation` 及其用例 `returns false when no fileName is provided`；`getAffectedUrisForEditTool` 的工具名集合。
- 本地验证：改 `permissionHelpers.spec.ts` 的 `auto-approves when no file can be determined (no fileName, no toolCall)`。`makeToolsService('no')` 时结果为拒绝，确认工具被调用，结果不是 `approve-once`。

## r15-3 hold

- 问题类：补丁工具把一次调用的上下文和愈合结果放在单例字段上。
- 不变量：每次 `invoke` 的允许编辑 URI、响应流和愈合结果都属于产生它们的那次请求。另一次请求不能改写这些事实，相同补丁文本也不能取走按另一份文件内容愈合的 `commit`。
- 要动的符号或文件：
  - `ApplyPatchTool`：去掉实例字段 `_promptContext` 和 `lastProcessed`。改为按 `IBuildPromptContext.requestId`（与 `options.chatRequestId` 相同）保存该次上下文；愈合缓存的键是该 requestId 加上补丁文本。
  - `resolveInput` 只写入自己的 requestId。`prepareInvocation` 和 `invoke` 只读自己的 `chatRequestId`；没有 id 时不回退到其他请求的条目。
  - `invoke` 在第一次 `await` 之前把该条目读进局部变量，并把这次的上下文传给 `generateUpdateNotebookDocumentEdit` 和后续写流。`await` 之后不再读共享字段。用完后只删除自己的缓存键。
- 不改：`ToolRegistry.registerTool` 和 `ToolsContribution` 仍注册同一个实例；补丁语法、愈合提示词、`healedPatchAffectsSameFiles`；`turnEditedDocuments` 仍放在该次 `IBuildPromptContext` 上。
- 本地验证：`applyPatch.spec.tsx` 现有用例不覆盖交错调用。新增断言：两个不同 `requestId` 的 `resolveInput` 交错后，先一次 `invoke` 仍使用自己的 `allowedEditUris` 和 `stream`；相同补丁文本的另一次请求不会使用上一次按另一份文件内容愈合的 `commit`。

## r15-4 hold

- 问题类：默认仓库哨兵把已经算好的当前分支基线换成了默认分支。
- 不变量：基线分支的事实是「为哪个仓库算出来的」。仓库选择仍是 `DEFAULT_REPOSITORY_ID` 或未选时，已算好的当前分支必须原样进入 `createSession` 的 `baseRef`。只有选中的 `org/repo` 和计算这次 `base_ref` 的仓库不是同一个，才改用选中仓库的默认分支。
- 要动的符号或文件：
  - `CopilotCloudSessionsProvider.delegate`：`base_ref` 非空时保持原值，不再因为哨兵拆不出 owner/repo 就执行 `base_ref = default_branch`。仅当 `base_ref` 为空时，才向 `getRepositoryInfo` 取 `default_branch`。
  - 无确认对话框、直接调用 `delegate` 的那条路径：把 `buildConfirmation` 里 `checkBaseBranchPresentOnRemote` 已经算好的基线传进去。分支在远程上时传当前分支，不在时传当时算好的 `repoDefaultBranch`。
- 不改：用户显式选了另一个 `org/repo` 时，`invokeRemoteAgent` 仍用那个 owner/repo 建会话；`base_ref` 为空且没有已算好的当前分支时，仍用该仓库的 `default_branch`；`pushBaseRefToRemote` 的推送步骤。
- 本地验证：`copilotCloudSessionsProvider.spec.ts` 没有这条断言。新增断言：`selectedRepository` 为 `DEFAULT_REPOSITORY_ID` 且传入的 `base_ref` 是当前分支时，`createSession` 的 `baseRef` 仍是该分支。显式选中的仓库与计算 `base_ref` 的仓库不同时，`baseRef` 改为选中仓库的 `default_branch`。

## r15-5 hold

- 问题类：取消笔记本补丁后，改写结果仍写入响应流。
- 不变量：`invoke` 收到的取消令牌表示这次补丁不再执行。令牌取消后，笔记本改写停止，已经生成的编辑也不能变成响应流上的 `notebookEdit` / `textEdit`。
- 要动的符号或文件：
  - `ApplyPatchTool.generateUpdateNotebookDocumentEdit`：增加 `invoke` 的 `CancellationToken` 参数，把它传给 `processFullRewriteNotebook`，替换 `CancellationToken.None`。
  - `invoke` 在第 400–410 行写入笔记本编辑之前再看一次该令牌。已取消时不调用 `responseStream.notebookEdit` 和 `responseStream.textEdit`，并以取消结束这次 `invoke`，不返回成功的编辑结果。
- 不改：文本文件补丁路径；`alternativeNotebookEditGenerator` 的解析和它在令牌取消时的 `break`；已经把令牌传入的 `buildCommitWithHealing`。
- 本地验证：`applyPatch.spec.tsx` 没有取消用例。新增断言：`invoke` 的令牌在笔记本改写期间取消后，响应流上没有 `notebookEdit` 和 `textEdit`；传入生成器的是这次 `invoke` 的令牌，取消后改写停止。

## 落地

- 2026-10-25 实施 r15-1：`repoInfoFor` 只按显式 `org/repo` 或活动仓库解析，不再取多根仓库列表的第一项；提交、推送与建会话共用同一个目标，跨仓库时不再把本地提交记到另一个仓库。
- 2026-10-25 实施 r15-2：权限预检在无法解析目标文件时返回 `approve-once` 走交互确认，不再把「不知道写哪里」当成已批准。
- 2026-10-25 实施 r15-3：补丁工具的上下文与愈合结果按 `requestId` 隔离，不再放在单例字段上。
- 2026-10-25 实施 r15-4：`resolveCloudBaseRef` 只在基线仓库仍是目标仓库时保留已算好的当前分支；显式换了仓库才改用该仓库默认分支。
- 2026-10-25 实施 r15-5：笔记本补丁把 `invoke` 的取消令牌传给改写；取消后不调用 `responseStream.notebookEdit` / `textEdit`，以取消结束。
- 验证：Copilot vitest 四个文件 105 passing（`copilotCloudSessionsProvider` 40、`copilotCloudGitOperationsManager` 3、`applyPatch` 15、`permissionHelpers` 47）。
- 既有失败：无；vitest 输出有 `file is not a database` 的 SQLite 未处理拒绝噪音，不影响结果。
