---
title: "方案 r02：agent-host-node"
type: plan
status: implemented
phase: N/A
updated: 2026-10-11
summary: "hold 3，drop 0，weaken 0。r02-1 到 r02-3 三项缺陷（status 失败保留目录、销毁时清理多聊天数据目录、无 HEAD 才回退空树）已随提交 8fa74ccdaa326f2bd898459f868bd62c2daf8524 落地合入，单测全绿。"
---

hold 3，drop 0，weaken 0。

## r02-1（hold，高）
### 问题类
归档 worktree 时，`git status` 失败被当成工作区干净，随后 `git worktree remove --force` 删掉仍有未提交内容的目录。

### 不变量
只有 status 明确成功且工作区干净，或未提交内容已经提交成功，才允许删除 worktree。status 超时、锁或其它非 0 必须留下目录。

### 要动的符号或文件
- `AgentHostGitService.hasUncommittedChanges`（`src/vs/platform/agentHost/node/agentHostGitService.ts` 第 367–370 行）现在调用 `_runGitStatus`（第 1052–1054 行，不传 `throwOnError`）。`_runGit` 在失败时 `resolve(undefined)`（第 1089–1093 行），`!!undefined` 得到 false。
- 改为这次 status 使用 `throwOnError: true`（`_runGitStatus` 转发该选项，或在 `hasUncommittedChanges` 内直接 `_runGit(['status', '--porcelain'], …)`，并保留 `GIT_OPTIONAL_LOCKS: '0'`）。空 stdout 仍返回 false；有 porcelain 输出仍返回 true；失败必须拒绝，不得把 `undefined` 收成 false。
- `WorktreeIsolation._cleanupWorktreeOnArchive`（`src/vs/platform/agentHost/node/shared/worktreeIsolation.ts` 第 894–906 行）去掉 `.catch(() => true)`。探测拒绝时按同函数里提交失败的路径打警告并 return。得到 true 才 `commitAll`；得到 false 才 `removeWorktree(..., { force: true })`。

### 明确不改
- `_runGit` 对其它调用方默认吞掉非 0 的行为。
- 分支不存在时提前 return，以及 `commitAll` 失败时 return、不删除。
- `removeWorktree` 在已确认干净或提交成功之后仍使用 `{ force: true }`。
- `agentHostCommitOperationHandler`、`agentHostMergeOperationHandler`、`agentHostPullRequestOperationHandler` 的成功路径。它们没有把 `hasUncommittedChanges` 的拒绝收成 false，探测改为抛错后这些操作会中止。

### 本地验证
- 已有：`agentHostGitService.integrationTest.ts` 的 `hasUncommittedChanges flips with untracked and committed work`；`worktreeIsolation.test.ts` 的 `cleanup on archive removes a clean worktree and unarchive recreates it`。
- 新增：status 超时或非 0 时 `hasUncommittedChanges` 拒绝，且 `cleanupWorktreeOnArchive` 不调用 `removeWorktree`、工作区目录仍在。干净工作区且 status 成功时，现有归档删除行为保持。

## r02-2（hold，中）
### 问题类
删除会话只删会话 URI 对应的一个数据目录，附加聊天自己的库（含 `file_edits` 的修改前后内容）还留在 `agentSessionData` 下。

### 不变量
会话销毁后，默认聊天与每个附加聊天的持久化目录都要删掉。只删掉其中一个聊天时，只删该聊天自己的存储目录，会话目录及其余聊天目录还在。

### 要动的符号或文件
- 存储键已在 `SessionDataService._dataKey`（`src/vs/platform/agentHost/node/sessionDataService.ts` 第 95–98 行）：有 authority 时为 `${authority}-${AgentSession.id(uri)}`，再经 `_sanitizedSessionKey` 替换非法字符。聊天通道是 `ahp-chat://<chatId>/<base64(sessionUri)>`，`AgentSession.id` 取的是这段 path，不是会话 raw id。目录与会话目录并列在 `agentSessionData` 下。`deleteSessionData`（第 113–140 行）只删传入 URI 的那一棵，这个函数保持「只删这一个目录」。
- 非默认聊天的持久化 URI 是聊天通道本身：`createAgentChatContext` 第 42 行 `resource: isDefaultChatUri(chatKey) ? sessionUri : toUri(chat)`。Claude 在 `claudeAgentSession.materialize` 用 `ctx.resource` 打开库；Copilot 在 `CopilotAgentSession` 用 `context.resource` 作为 `_storageUri` 打开库并交给 `FileEditTracker`。`storeFileEdit` 把 `before_content` / `after_content` 写进该库。
- `AgentService._doDisposeSession`（`agentService.ts` 第 3926 行）目前只 `deleteSessionData(session)`。`disposeChat`（第 3112–3129 行）不删数据目录。
- 删会话：用与 `_getSessionChatsForDisposal` 相同的聊天集合（含内存目录缺失时的持久化 catalog），经 `chatStorageUri` 得到存储 URI，去重后逐个 `deleteSessionData`，并传入已经解析好的同一份 `workingDirectories`。默认聊天的 `chatStorageUri` 就是会话 URI，覆盖现有那一次删除。
- 删单个附加聊天：`disposeChat` 在目录项移除时，若 `chatStorageUri(chat)` 不是会话 URI，再 `deleteSessionData` 该 URI。

### 明确不改
- `_dataKey` 的并列规则，以及 `file_edits` 表结构。
- 默认聊天继续写在会话 URI 的目录里。不要对默认聊天 URI 再删一次 `default-…` 目录来代替会话目录。
- 检查点 ref 仍以会话存储 URI 那一次 `onWillDeleteSessionData` 为准。`AgentHostCheckpointService` 按事件里的 URI 打开库；附加聊天库没有这批 ref 时，那一次删除是空操作。

### 本地验证
- 已有：`sessionDataService.test.ts` 的 `getSessionDataDir gives each peer chat of a session its own directory`、`deleteSessionData removes directory`；`agentService.test.ts` 的 `deletes session data before removing the worktree`、`disposeChat removes the chat from the persisted catalog`。
- 新增：会话与 `buildChatUri` 的附加聊天各有一个目录，附加聊天库里有一条带 before/after 的 `file_edits`。`disposeSession` 之后两个目录都不存在。`disposeChat` 只去掉该附加聊天目录，会话目录还在。只对会话 URI 调用 `deleteSessionData` 时，附加聊天目录仍在（锁住「单目录删除」本身）。

## r02-3（hold，中）
### 问题类
`git read-tree HEAD` 只要失败就改用空树，检查点或带未跟踪文件的分支 diff 会把未改动文件显示成删除。

### 不变量
只有确认仓库没有 HEAD 时，才允许用空树做临时 index。其它 `read-tree` 失败必须放弃这次树或 diff，调用方得到 `undefined`。

### 要动的符号或文件
- `AgentHostGitService.captureWorkingTreeAsTree`（`agentHostGitService.ts` 第 760–770 行）和 `_runWithTempIndex`（第 549–558 行）。两处都是 `read-tree HEAD` 得到 `undefined` 就 `read-tree` 空树，且不检查空树那次的结果。`_runGit` 未设 `throwOnError` 时，超时、锁和其它非 0 都是 `undefined`，和无 HEAD 相同。
- 在这两处：先用 `throwOnError: true` 的 `rev-parse --verify --quiet HEAD`（或等价命令）区分失败原因。超时、被信号杀死，以及任何不是「HEAD 不存在」的失败，直接返回 `undefined`，不 `read-tree` 空树，也不 `write-tree` / `diff --cached`。只有明确没有 HEAD 才 `read-tree` `EMPTY_TREE_OBJECT`；这次结果若仍是 `undefined`，同样返回 `undefined`。
- 不要用现有 `revParse()`（第 807–809 行）。它同样把非 0 收成 `undefined`，无法区分无 HEAD 和命令失败。

### 明确不改
- `_runGit` 的默认吞错。
- `overlayPathIntoTree`：它已经在 `read-tree` 失败时返回 `undefined`。
- 空仓库、确实没有 HEAD 时退回空树的行为。
- `captureWorkingTreeAsTree` / `_runWithTempIndex` 的调用方（检查点、`computeSessionFileDiffs`、review、repo telemetry）对 `undefined` 的处理：它们已经把 `undefined` 当成这次结果不可用。

### 本地验证
- 已有：`agentHostGitService.integrationTest.ts` 的 `captureWorkingTreeAsTree stages scoped rename source and untracked paths`、`captureWorkingTreeAsTree returns undefined when staging fails`。
- 新增：仓库已有 HEAD 时，若 `read-tree HEAD` 失败，`captureWorkingTreeAsTree` 返回 `undefined`，且不产生只含变更路径的树。有未跟踪文件时，`_runWithTempIndex` 同样返回 `undefined`，diff 里不出现未改动文件的删除。新建的无 HEAD 仓库仍可以用空树做出「全部为新增」的结果。现有 `chmod` 夹具做不到「已有 HEAD 时 `read-tree HEAD` 失败」，实施时要写明注入手段。`throwOnError: true` 抛出的是 `new Error(…, { cause })`，区分「无 HEAD」要读 `cause` 的退出码和 `killed`。

## 审查备注

2026-10-11 Sonnet 第 1 路，Minor，不改变 hold：

- r02-1：`hasUncommittedChanges` 改为失败时抛错，会改变 `agentHostCommitOperationHandler.ts`、`agentHostMergeOperationHandler.ts`、`agentHostPullRequestOperationHandler.ts` 里现在不 `catch` 的调用。抛出的是普通 `Error`，不是 `ProtocolError`。`common/agentHostGitService.ts` 第 264 行的接口注释要一起改。这是行为变化，不要写进「明确不改」。
- r02-2：`src/vs/platform/agentHost/test/node/AGENTS.md` 要求触及 `SessionDatabase` 的测试用 `:memory:`。新增「附加聊天库里有 `file_edits`」要用内存文件服务加 `getDbPath`，不要直接落真实目录。
- r02-3：见上面本地验证补的注入和 `cause`。
