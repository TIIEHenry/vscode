---
title: "审查 r03：sessions"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "断线删除或归档会清掉分组与置顶；Copilot 权限可绕过企业策略；对等聊天改写隔离记忆；GitHub 文件树固定用第一个账号。"
---
# 审查 r03：sessions

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r03-1 高

- 症状：远程主机已经断线、会话仍留在列表里时，删除或归档不报错，置顶、手动排序、分组和本机反馈被清掉，会话本身还在，重连后这些状态回不来。
- 位置：`src/vs/sessions/services/sessions/browser/sessionsManagementService.ts` 第 1194–1246 行
- 引用：

```ts
await this._getProvider(session)?.archiveSession(session.sessionId);
this._onDidArchiveSession.fire(session);
// ...
await provider.deleteSessions(providerSessions.map(session => session.sessionId));
this._onDidDeleteSession.fire(session);
```

- 为什么是问题：`clearConnection` 会故意留着缓存会话（`remoteAgentHostSessionsProvider.ts` 第 485–490 行），而 `deleteSessions` 在没有连接或 id 不在缓存里时直接 `return`（`baseAgentHostSessionsProvider.ts` 第 4276–4289 行），`_setSessionArchived` 同样在无连接时返回且不改归档标记（第 4244–4249 行）。这两处都正常结束，管理服务仍对整批请求发出 `onDidDeleteSession` / `onDidArchiveSession`。分组会删成员并 `save()`（`sessionGroupsService.ts` 第 175–194 行），列表模型会丢掉置顶和排序（`sessionsListModelService.ts` 第 142–143、360–376 行），最近打开记录、反馈和变更视图状态也会跟着删（`sessionsService.ts` 第 432 行，`agentFeedbackService.ts` 第 435 行，`changesViewService.ts` 第 275–276 行）。删除菜单只在 Promise 拒绝时弹错（`sessionsViewActions.ts` 第 1094–1099 行），所以这条路径看起来像已经删掉。
- 方向：只在 provider 真正删掉或归档之后再发对应事件，跳过的 id 保持置顶和分组。

## r03-2 高

- 症状：企业策略关掉全局自动批准后，Copilot CLI 仍可以用已保存的 AutoApprove 或 Autopilot 把新会话和后续聊天发出去。
- 位置：`src/vs/sessions/contrib/providers/copilotChatSessions/browser/copilotChatSessionsProvider.ts` 第 1865–1878 行
- 引用：

```ts
setPermissionLevel(sessionId: string, chatResource: URI, level: string): void {
	const newSession = this._newSessions.get(sessionId);
	if (newSession) {
		if (isChatPermissionLevel(level)) {
			newSession.setPermissionLevel(level);
		}
		return;
	}
	// ...
	session.setPermissionLevel(level);
}
```

- 为什么是问题：同一文件里，新建会话的默认档在 `chat.tools.global.autoApprove` 的策略值为 `false` 时夹到 Default（第 1698–1709 行），权限选择器也会禁用升高档。`setPermissionLevel` 只检查 `isChatPermissionLevel`。`sessionsManagementService.ts` 第 938–939 行把 `createOptions.permissionLevel` 原样送进 provider，`automationRunner.ts` 第 88–94 行把自动化上保存的档放进这个选项。发送时第 2330–2335 行把它放进 `modeInfo`，第 2442–2443 行写入 `inputModel`。第 2161 行新建对等聊天时再抄父聊天的档。策略生效之后，已有自动化或已升高的会话仍会以升高档开跑。
- 方向：`setPermissionLevel` 在策略限制时把非 Default 档夹回 Default，发送前再夹一次。

## r03-3 中

- 症状：在 Copilot CLI 会话里再开一个聊天时，这次聊天按工作区目录（folder）发送；若之前记住的是 worktree，profile 里的隔离记忆也会被改成 workspace，之后的新会话不再走 worktree。
- 位置：`src/vs/sessions/contrib/providers/copilotChatSessions/browser/copilotChatSessionsProvider.ts` 第 2156–2161 行
- 引用：

```ts
const session = this.instantiationService.createInstance(CopilotCLISession, resource, newWorkspace, this.id);
session.setModelId(chat.modelId.get(), ChatModelSource.CarriedOver);
session.setIsolationMode('workspace');
```

- 为什么是问题：`setIsolationMode` 默认 `persist === true`，模式有变化就写入 `STORAGE_KEY_ISOLATION_MODE`（第 476–483 行）。新的 `CopilotCLISession` 先按这份记忆初始化（第 367–370 行），这里再强制写成 `workspace`。`getAgentHostSessionConfig` 把非 worktree 收成 `folder`（第 564–566 行），对等聊天发送时带上这份配置（第 2472 行）。父会话若是 worktree，这次聊天和之后新建的会话都会落到工作区目录上。
- 方向：对等聊天继承当前会话的隔离；若必须固定为 workspace，调用时传 `persist: false`。

## r03-4 中

- 症状：登录了多个 GitHub 账号时，会话里的 GitHub 文件树始终用会话列表的第一个 token，另一个账号才有权限的仓库会读失败，或读到第一个账号才能看到的内容。
- 位置：`src/vs/sessions/contrib/fileTreeView/browser/githubFileSystemProvider.ts` 第 205–213 行
- 引用：

```ts
let sessions = await this.authenticationService.getSessions('github', [], { silent: true });
// ...
return sessions[0].accessToken ?? '';
```

- 为什么是问题：`getSessions('github', [])` 会返回本机全部 GitHub 登录。URI 只有 owner/repo/ref（第 183–196 行），没有任何账号选择。树和 blob 请求都把这个 token 放进 `Authorization`（第 249、700–708 行）。第一个账号看不到目标仓库时，浏览表现为找不到或不可用；第一个账号能看到而当前操作不该用它时，文件内容来自另一个账号。
- 方向：按仓库所属账号或用户选定的 GitHub 会话取 token，空 token 不要当成已登录发出。
