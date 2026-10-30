---
title: "方案 r05：sessions"
type: plan
status: accepted
phase: N/A
updated: 2026-10-08
summary: "2026-10-08 用户签收。hold 4，drop 0，weaken 0。多聊天删除成功后才改缓存，窄桌面不夹掉记住的侧栏宽度。不升 implemented，不升 PRD。"
---
# 方案 r05：sessions

状态：执行中。
覆盖需求：无（正文未引用需求编号）。


hold 4，drop 0，weaken 0。

## r05-1（hold，中）

问题类：多聊天里删除一条已提交聊天时，后端删除失败之前本地缓存已经拿掉，列表按缓存重建就看不到它。

不变量：`deleteChat` 在 `_deleteAgentSessions` 拒绝时，`_sessionCache`、`_sessionGroupCache`、分组缓存和 `_newSessions` 与调用前一致，模型里这条会话还在，`onDidChangeSessions` 与 `onDidGroupMembershipChange` 都不发出，`getSessions()` 仍含这条聊天。删除成功之后才改这些缓存、销毁对应草稿，并按现在的成功路径发变更。没有底层 agent session 的未提交草稿仍只清本地，不调用 `_deleteAgentSessions`。

要动的符号或文件：`CopilotChatSessionsProvider.deleteChat`（`src/vs/sessions/contrib/providers/copilotChatSessions/browser/copilotChatSessionsProvider.ts`）。现在第 2131–2143 行在 `await this._deleteAgentSessions`（第 2146 行）之前就 `this._sessionCache.delete`、`_invalidateGroupingCaches`、`_newSessions.deleteAndDispose`、`_sessionGroupCache.delete`。

怎么改：确认对话框和「只剩一条则走 `deleteSession`」保持在前。存在 `agentSession` 且组里还有其它聊天时，先 `await this._deleteAgentSessions([agentSession])`。这个 await 成功返回之后，再删两份会话缓存、作废分组缓存、销毁命中的 `_newSessions`、删 `_sessionGroupCache`，然后发组成员变更和会话变更。拒绝时函数在改缓存之前结束，不补发事件，也不靠事后 `_refreshSessionCache` 把条目塞回去。

明确不改：`deleteSession` 里先 `_deleteAgentSessions` 再 `_refreshSessionCache` 的顺序；`chatIds.length <= 1` 整段交给 `deleteSession`；取消确认时返回 `false`；不支持多聊天时抛错；找不到 `chatId` 时返回 `false`；`getSessions` 只读 `_sessionCache` 的分组方式；`agentSessionsService.model.onDidChangeSessions` 触发的全量刷新。

怎样本地验证：`src/vs/sessions/contrib/providers/copilotChatSessions/test/browser/copilotChatSessionsProvider.test.ts` 里现有 `deleteChat with committed child chat in multi-chat cleans up cache and updates parent session`、`deleteChat with committed root chat in multi-chat removes root group`、`deleteChat with uncommitted draft chat does not delete parent session history`、`deleteChat with single chat delegates to deleteSession` 仍通过。同一文件新增：多聊天组里两条已提交聊天，`IChatService.removeHistoryEntry` 拒绝且不从模型移除（默认 mock 的 `providerType` 是 `AgentSessionProviders.Background`，走这条而不是 CLI 命令）。`deleteChat(..., { skipConfirmation: true })` 拒绝后，`getSessions()` 仍是删除前的两条聊天，模型条数不变，`onDidChangeSessions` 次数为 0。CLI 分支（`providerType === CopilotCLISessionType.id`，命令 `agents.github.copilot.cli.deleteSessions` 拒绝且不移除模型）同样保持缓存。拒绝的 stub 不能先 `model.removeSession`，否则 `onDidChangeSessions` 会 `_refreshSessionCache` 把现象盖掉。

```bash
scripts/test.sh --grep "deleteChat with committed"
```

## r05-2（hold，中）

问题类：窄桌面里打开过侧栏抽屉再回到宽布局时，侧栏宽度变成最小宽度，打开前的宽度丢失。

不变量：进入窄桌面前，侧栏在网格里记下的可见宽度在抽屉打开、关闭、再离开窄桌面之后仍然是这个宽度。抽屉打开期间网格槽宽可以为 0，以免挤主列。此期间以及抽屉已关、仍在窄桌面时，`_savePartSizes` 写入的 `sidebar` 是进入前记下的宽度。`partVisibility.sidebar` 在窄桌面期间保持进入前的值。

要动的符号或文件：`openCompactDesktopNavDrawer`、`closeCompactDesktopNavDrawer`、`_applyCompactDesktopGridVisibility`、`_savePartSizes`（`src/vs/sessions/browser/workbench.ts`）。打开时第 1083 行先 `_setSideBarOverlayGridSlotCollapsed(true)`，第 1085 行再 `setViewVisible(..., true)`。关闭时第 1103 行先 `setViewVisible(..., false)`，第 1108 行再把槽放开。`SidebarPart.maximumWidth`（`src/vs/sessions/browser/parts/sidebarPart.ts` 第 80–82 行）在槽收起时为 0。`SplitView` 的 `ViewItem.setVisible`（`src/vs/base/browser/ui/splitview/splitview.ts`）在变为可见时把缓存宽度夹进当前 minimum/maximum，并清掉缓存；变为隐藏时把当时的 `size` 写成缓存。`_savePartSizes` 第 894 行按 `partVisibility.sidebar` 调用 `_persistedGridViewSize`（第 1526–1528 行）：可见则读当前槽宽。每次 `layout()` 在窄桌面都会再进 `_applyCompactDesktopGridVisibility`（第 1996–1997 行），顺序同样是先收槽再 `setViewVisible`。

怎么改：进入窄桌面、槽尚未收成 0 时，侧栏已经隐藏，网格里仍有隐藏前的宽度。在第一次把 `maximumWidth` 收成 0 之前，工作台自己记下这个宽度。抽屉打开期间允许槽为 0、视图保持可见，让 CSS overlay 画出来。关闭抽屉或离开窄桌面、要按原宽度再显示之前，先 `_setSideBarOverlayGridSlotCollapsed(false)`，让 minimum/maximum 回到 `SESSIONS_LIST_MINIMUM_WIDTH` 和无穷大，再按工作台记下的宽度显示。不要在 `maximumWidth` 仍为 0 时 `setViewVisible(false)`，那会把网格缓存写成 0；也不要在已经夹成 0 之后只靠 `setViewVisible(true)`，那只会落到最小宽度。`_applyCompactDesktopGridVisibility` 在抽屉开着时走同一套记下的宽度，避免随后的 `layout()` 再夹一次。`_savePartSizes` 在窄桌面期间写 `sidebar` 时用记下的宽度，不用当前槽宽。

明确不改：`ViewItem.setVisible` 的通用夹紧；手机抽屉 `openMobileSidebarDrawer` / `closeMobileSidebarDrawer`；`compactDesktopShell.css` 的 overlay 几何；`_onCompactDesktopLayoutChanged` 恢复的 `partVisibility` 字段集合；`_partVisibilityPersistenceSuppression`；编辑器、辅助栏、面板在 `_savePartSizes` 里的算法。

怎样本地验证：`src/vs/sessions/test/browser/workbench.test.ts` 的 harness 在 `maximumWidth === 0` 时只用 0 去加减会话列宽度，不把侧栏 `viewSizes` 写成 0，也没有 `cachedVisibleSize`，按现状调用真实方法会看不见这条回归。新增断言前，让该 harness 的 `setViewVisible` 具备与 `ViewItem.setVisible` 相同的缓存夹紧，或改用真实 `Grid`。然后：侧栏以大于 `SESSIONS_LIST_MINIMUM_WIDTH` 的宽度可见，进入 compact、打开抽屉、关闭抽屉、离开 compact 后，再次可见的宽度仍是进入前的宽度。抽屉打开时调用 `_savePartSizes`，存下的 `sidebar` 仍是该宽度。现有 `_savePartSizes uses the cached hidden Editor width in classic layout`、`_savePartSizes persists the editor width without reading the docked aux bar from the grid (single-pane)`、`_savePartSizes preserves the last valid editor width after the detail-only node closes (single-pane)`、`compact desktop hides side-pane parts without treating host as phone` 仍通过。

```bash
scripts/test.sh --grep "Sessions - Workbench"
```

## r05-3（hold，中）

问题类：同一 `owner/repo@branch` 的 PR 号查询失败一次后就留在缓存里，之后同一分支不再查询，徽章和编号不出现。

不变量：`_pullRequestNumberCache` 只保留解析出具体编号的 observable。同步抛错、Promise 拒绝、以及解析为 `undefined`，都在该次 lookup 落定后删掉这个 key。下一次 git 状态重算会再调 `findPullRequestNumberByHeadBranch`。已经解析出编号的条目在只取消订阅再订阅、git 输入不变时仍只查询一次。进行中的那次 observable 仍交给当前读者，不在返回前删掉 key。

要动的符号或文件：`AgentHostSessionAdapter._pullRequestNumberForBranch`（`src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts` 第 734–754 行）。第 751 行 `if (!isRejected && pullRequestNumber === undefined && ...)` 在 `isRejected` 时留下缓存。`pullRequestNumberFromBranch`（第 1020–1026 行）按 `owner/repo@branch` 命中这份缓存。

怎么改：lookup 落定后，结果不是具体编号时，若 map 里仍是这次 observable，就 `delete`。拒绝与「没有 PR」走同一条删除。成功得到编号时继续留在 map 里。

明确不改：`base.pullRequest` 已有时 `pullRequestNumberFromBranch` 直接返回 `undefined`、不再按分支查询；`observableFromPromise` 的用法；`findPullRequestNumberByHeadBranch` 的服务实现；成功编号在 gitHubInfo 重新订阅时不二次查询。

怎样本地验证：`src/vs/sessions/contrib/providers/agentHost/test/browser/localAgentHostSessionsProvider.test.ts` 中 `preserves PR cache entry when findPullRequestNumberByHeadBranch rejects or throws to avoid duplicate requests` 要改期望：同分支后续 `setSessionState`（测试里已有 `commit: 'c2'`）再次 lookup，第二次成功时 `pullRequest.number` 为 42。`clears PR cache entry when findPullRequestNumberByHeadBranch resolves to undefined to allow reprobing` 与 `keeps a resolved PR number sticky across gitHubInfo recomputes (no re-lookup / icon flap)` 仍通过，后者 `lookupCalls` 仍为 1。

```bash
scripts/test.sh --grep "PR cache entry"
scripts/test.sh --grep "resolved PR number sticky"
```

## r05-4（hold，低）

问题类：窄桌面 overlay 样式扫描里禁止 `top: 0` 的正则末尾是退格符，断言对写回 `top: 0` 也会通过。

不变量：`.part.sidebar.compact-desktop-overlay-sidebar` 的规则正文里，`top` 的值是 `0`（空白可变，后面是分号、`!important` 或声明结束）时测试失败。当前生产 CSS 的 `top: var(--compact-desktop-nav-height, 40px)` 且不含值为 `0` 的 `top` 时测试通过。同一条测试仍要求正文包含 `--compact-desktop-nav-height`，nav host 为 `position: relative`，且 nav host 的 z-index 高于 overlay。

要动的符号或文件：`src/vs/sessions/test/node/compactDesktopShellCssScan.test.ts` 第 53 行。源码字节在 `0` 与 `/.test` 之间是 `0x08`，正则是 `top` 后接空白、冒号、空白、`0`、退格，匹配不到样式里的 `top: 0`，取反后恒为真。

怎么改：换成匹配 `top` 属性值为 `0` 的判断。用测试内的字符串样本覆盖「仍包含 `--compact-desktop-nav-height`，同时写有 `top: 0`」：该样本必须让这条断言失败。生产文件继续当正例。

明确不改：`src/vs/sessions/browser/parts/compactDesktop/compactDesktopShell.css`；同测试里变量、`position`、z-index 三条断言的期望。

怎样本地验证：现有 `compact desktop shell overlay uses nav height variable and nav host has higher z-index`（套件 `Compact desktop shell CSS scan`）对当前 CSS 通过。同测试增加样本断言：正文同时含 `--compact-desktop-nav-height` 与 `top: 0` 时，`top` 值为 `0` 的检查失败。

```bash
scripts/test.sh --grep "Compact desktop shell CSS scan"
```
