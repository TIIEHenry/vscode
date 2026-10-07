---
title: "方案 r03：sessions"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 3，drop 0，weaken 1。断线删除仍会在未删掉会话时清掉置顶与分组；归档与反馈条目不在此列。权限、隔离记忆、GitHub 文件树三条照原样成立。"
---

hold 3，drop 0，weaken 1

## r03-1（weaken，中）

原判高。删除路径成立，归档和「本机反馈被清掉」只部分成立，降为中。

反证：归档只摘分组。`sessionGroupsService.ts` 第 186–194 行听 `onDidArchiveSession` 并 `save()`。置顶和手动排序只听 `onDidDeleteSession`（`sessionsListModelService.ts` 第 142–144 行，清理在第 360–376 行）。`agentFeedbackService.ts` 第 435 行调用 `_forgetSession`（第 448–466 行），清的是导航锚点、文件映射和可见已解决 id；同文件注释写明 backend 不动。真正删反馈条目的是 `clearFeedback`（第 960–965 行），这条监听没走到。

仍然成立的是删除。`clearConnection`（`remoteAgentHostSessionsProvider.ts` 第 485–515 行）留下缓存会话。`deleteSessions` 在没有连接或 id 不在缓存时直接 `return`（`baseAgentHostSessionsProvider.ts` 第 4275–4290 行）。`_setSessionArchived` 在无连接时返回且不改 `isArchived`（第 4244–4249 行）。管理服务在这两次正常返回之后仍发事件：`archiveSession` 第 1194–1196 行，`deleteSession` 第 1220–1222 行，`deleteSessions` 第 1243–1246 行。删除因此会丢掉置顶、排序、分组成员（第 175–184 行）、最近打开记录（`sessionsService.ts` 第 432 行）和变更视图状态（`changesViewService.ts` 第 275–276 行，写入在第 314–320 行）。会话还在缓存里。删除菜单只在 Promise 拒绝时弹错（`views/sessionsViewActions.ts` 第 1094–1099 行）。

**问题类：** 远程断线时删除被当成已成功，本地置顶、排序、分组和视图状态被清掉，会话还在。

**不变量：** `onDidDeleteSession` 只发给这次真正从缓存移除的 id。`onDidArchiveSession` 只在 `isArchived` 已经翻转后发出。没被报告的 id 保持置顶、手动排序、分组、最近打开记录和变更视图状态。`clearConnection` 继续保留缓存会话。

**要动的符号或文件：**

- `ISessionsProvider.archiveSession` / `unarchiveSession` 改为返回 `boolean`。`BaseAgentHostSessionsProvider._setSessionArchived` 在 `!cached || !rawId || !connection` 时返回 `false`，翻转并 `dispatch` 之后返回 `true`。`CopilotChatSessionsProvider.archiveSession` / `unarchiveSession` 只有调用了 `setArchived` 才返回 `true`。
- `ISessionsProvider.deleteSessions` 改为返回实际移除的 id。无连接、id 不在缓存、或 Copilot 侧找不到会话时，不要把该 id 放进返回值。
- `SessionsManagementService.archiveSession`、`unarchiveSession`、`deleteSession`、`deleteSessions` 只对返回值里确认过的会话发事件。一次都没完成，或者请求的 id 有缺漏，就 reject。`deleteChat`（第 1257–1261 行）已经是「确认之后再发事件」。
- `views/sessionsViewActions.ts` 里三处直接 `await archiveSession`（约第 636、714、936 行）补上与删除相同的错误对话框。解除归档的直接 `await` 同样处理。

**明确不改什么：** `clearConnection` 保留缓存。分组和列表模型对一次真实删除或归档事件的处理。`_forgetSession` 与反馈 backend。归档不去摘置顶或排序。

**怎样本地验证：** `sessionsManagementService.test.ts` 里已有 `groups sessions by provider and continues when one provider fails (best-effort)`：失败的 provider 仍不发事件，成功的仍发 `s2`。返回值签名跟着改。另加断言：provider 的 `deleteSessions` 在无连接时返回空数组，管理服务 reject，且不发 `onDidDeleteSession`。provider 的 `archiveSession` 返回 `false` 时不发 `onDidArchiveSession`。

## r03-2（hold，高）

**问题类：** 企业策略关掉全局自动批准后，Copilot CLI 仍会把已保存的 AutoApprove 或 Autopilot 送进 CLI，CLI 据此自动批准。

**不变量：** `chat.tools.global.autoApprove` 的 `policyValue === false` 时，Copilot CLI 会话的权限档、对等聊天抄来的档，以及发出去的 `modeInfo.permissionLevel`，都是 `Default`。策略未限制时，已保存的升高档仍可发出。

**要动的符号或文件：**

- `CopilotCLISession.setPermissionLevel`（约第 533 行）和 `CopilotChatSessionsProvider.setPermissionLevel`（第 1865–1878 行）。策略限制时把非 `Default` 档写成 `Default`。判定复用 `isAutoApprovePolicyRestricted` 与 `isAutoApproveValuePolicyRestricted`（`agentHostConfigPolicy.ts`）。第 2161 行是直接调用会话对象的 `setPermissionLevel`，只改 provider 方法盖不住。
- `_sendFirstChat`（第 2330–2335 行）和 `_sendExistingChat`（第 2468 行）在放进 `modeInfo` 之前再夹一次，并把夹后的档写回会话。`_updateChatSessionState`（第 2442–2443 行）继续写入夹过的档。
- 夹完之后，`chatServiceImpl` 第 1725 行和 `extHostTypeConverters` 第 3503 行带出去的 `permissionLevel` 已是 `Default`。CLI 在 `copilotCLIChatSessionsContribution.ts` 第 1972–1973 行把它设到会话上；`copilotcliSession.ts` 第 1304–1307 行才会自动批准。

**明确不改什么：** `_defaultPermissionLevel`（第 1703–1710 行）对新建会话的播种。权限选择器禁用升高档。`chatInputPart.getPermittedPermissionLevel`。`languageModelToolsService.shouldAutoConfirm` 里已有的策略短路。自动化里保存的原始档（`automationRunner.ts` 第 88–94 行仍原样放进 `createOptions`，夹在 provider 边界做）。策略放开时 CLI 的自动批准。

**怎样本地验证：** 已有 `clamps to Default when chat.tools.global.autoApprove policy is false`、`CLI session seeds permission level from chat.permissions.default`、`falls back to Default when chat.permissions.default is unset` 继续通过。已有 `setPermissionLevel reads and writes the targeted chat resource in a group` 和 `createNewChat seeds permission level from the source chat resource` 在未加策略时仍能写入并继承 Autopilot。另加断言：策略为 false 时，`setPermissionLevel(AutoApprove|Autopilot)` 读回 `Default`；父聊天为 Autopilot 时新建对等聊天读回 `Default`；`sendRequest` 的 `modeInfo.permissionLevel` 为 `Default`。

## r03-3（hold，中）

**问题类：** 对等聊天把隔离强制写成 workspace 并写入 profile，记住的 worktree 被盖掉。

**不变量：** 对等聊天的隔离等于来源聊天当时的隔离。这次调用不写 `sessions.isolationPicker.selectedMode`。之后新建的会话仍按这份记忆初始化。

**要动的符号或文件：** `CopilotChatSessionsProvider._createNewSubsequentChat` 第 2156–2161 行。用来源聊天的 `isolationMode`（缓存里的 `CopilotCLISession`）调用 `setIsolationMode(inherited, false)`。`setIsolationMode` 默认 `persist === true`，模式有变化就写入 profile（第 476–483 行）。新会话构造时已经按记忆初始化（第 367–370 行，读取在第 514–516 行），所以必须显式传 `false`，否则来源是 worktree、记忆也是 worktree时这次调用会把记忆写成 workspace。发送仍走 `getAgentHostSessionConfig`（第 564–566 行）和 `_sendExistingChat` 第 2472 行，实例上的隔离是什么就发什么。

**明确不改什么：** 关闭隔离选项时用 `persist: false` 的那条监听（第 375 行）。`_resolveGitRepository` 在没有仓库或空仓库时调用 `setIsolationMode('workspace')`（约第 400–407 行）。`getAgentHostSessionConfig` 把非 worktree 收成 `folder`。

**怎样本地验证：** 已有 `disabling the isolation option keeps a new CLI session in the workspace without forgetting worktree`、`turning the isolation option off switches the open draft to the workspace and back`、`Copilot CLI session maps workspace selection to Agent Host folder config`、`Copilot CLI session maps worktree selection to Agent Host config` 继续通过。另加断言：profile 里存着 `worktree`、来源聊天也是 worktree 时，`createNewChat` 之后新聊天的 `getAgentHostSessionConfig().isolation` 为 `worktree`，同一 key 的 profile 值仍是 `worktree`。来源聊天是 workspace 时，新聊天配置为 `folder`，profile 里原来的 `worktree` 仍在。

## r03-4（hold，中）

**问题类：** 多个 GitHub 账号时，文件树固定用 `getSessions` 返回的第一个 token。

**不变量：** 树、目录、blob 和空树探测使用同一次选定的非空 token。URI 带了 account label 时只用该账号。没带 label 且有多个非空 token 时不取第一个。空 token 不放进 `Authorization`。

**要动的符号或文件：**

- `GitHubFileSystemProvider.getAuthToken`（第 205–213 行）。跳过 `accessToken` 为空的会话。一个可用 token 都没有就抛 `FileSystemProviderErrorCode.Unavailable`。`doFetchTree`（第 253 行）、`emptyTreeForRef`（第 385 行）、`doFetchDirectory`（第 462 行）、`readFile`（第 708 行）都走这个结果。
- 账号放在 URI query `account`（GitHub account label）。`parseUri`（第 183–196 行）继续只解析 path 里的 owner/repo/ref/path，另读这个 query。`getSessions('github', [], { silent: true, account })` 使用 `IAuthenticationGetSessionsOptions.account`。`extensions/github-authentication/src/github.ts` 第 286–288 行在传入 account 时按 `account.label` 过滤；空 scopes 才会返回全部登录。
- 没有 query 时：恰好一个非空 token 就用它；零个走现有的 `createIfNone: true`；多于一个抛 Unavailable，不取 `sessions[0]`。
- `getCacheKey`（第 199–200 行）把 account label 算进去，`treeCache`、`notFoundCache`、`pendingFetches` 共用这把 key。
- 写出 query 的构造点：`_extractRepositoryFromMetadata`（约第 1404–1408 行）、`_browseForRepo`（第 2672 行）、`_browseForGitHubContext`（第 2702 行）。浏览命令 `github.copilot.chat.cloudSessions.openRepository` 今天只返回 `owner/repo` 字符串（`copilotCloudSessionsProvider.ts` 第 582–642 行）。返回值要带上列出该仓库时所用会话的 account label，再写入 query。云会话 metadata 没有账号时不要猜第一个会话：单账号照旧，多账号在读树时失败。

**明确不改什么：** path 分段和 `%2F` ref 的解码。`getGitHubRemoteFileDisplayName`。标题栏用 `sessions[0]` 显示账号（`accountTitleBarState.ts`）。零会话时的登录提示。

**怎样本地验证：** `githubFileSystemProvider.test.ts` 里 `GitHubFileSystemProvider` suite 的现有用例继续通过（桩只有一个 token）。另加断言：两个非空 token 且 URI 没有 `account` 时，`readdir` / `readFile` 拒绝，请求服务看不到第一个 token。`accessToken` 为空时拒绝，且不发出 `Authorization`。query 指定第二个账号时，请求头是第二个 token，缓存不与另一个账号的 404 混用。
