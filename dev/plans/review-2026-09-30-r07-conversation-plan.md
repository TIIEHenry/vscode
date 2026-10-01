---
title: "方案 r07：conversation"
type: plan
status: accepted
phase: N/A
updated: 2026-10-01
summary: "2026-09-30 用户签收。切片已落（7cf1474419e），方案仍 accepted，不升 implemented。发送在途只清仍等于已提交文本的草稿；已打开的子代理标签直接激活；MCP 错误启动要结束队列；URL 授权在无请求或取消时收口；部分根搜索失败不当作完整列表。"
---

# 方案

核对：hold 4（r07-1、r07-2、r07-4、r07-5），weaken 1（r07-3），drop 0。

## r07-1 hold

问题类：发送尚未返回时后写的未发送文字，会在成功回调里被写成空草稿。

不变量：

- `submitDraft` 在 `await postBound` 之前捕获的 `text`（已 `trim`）是本次已提交文本。
- 成功且 `accepted` 时，仅当 `readComposerDraft(host, sessionId).trim()` 仍等于该 `text`，才 `writeComposerDraft(host, sessionId, '')`。
- 仍停在该 `sessionId` 时，仅当 `dockTextarea.value.trim()` 仍等于该 `text`，才把输入框设为 `''` 并 `resetInputHistoryBrowse()`。
- 仍停在该会话时，无论输入框是否被清空，都调用 `updateConversationPhase()`。
- 已切到别的会话时，不改当前 `dockTextarea`。

要动的符号或文件：

- `submitDraft`（`src/vs/workbench/contrib/conversation/browser/conversationLensComposer.ts`，成功分支约 351–363 行）
- 比较时用已有的 `readComposerDraft` / `writeComposerDraft`

明确不改什么：

- 保持 `!outcome.accepted` 与 `catch` 只在仍停在原会话时 `showPostFailure`。
- 保持断开且入队成功时的同步清空（约 330–336 行），以及入队失败时把当前输入写回草稿。
- 保持 `submitInFlight`、`turnEdit` / `queueEdit`、`setBoundSessionId` 与输入监听的写入时机。

本地验证：

- 改 `conversationComposerCatalog.test.ts` 里 `submitDraft success after session switch clears captured draft not the new textarea`：先把 A 的草稿写成已提交文本，成功后 A 的草稿为 `''`，B 的输入框仍在。
- 改同文件 `submitDraft success while still on the same session still clears the textarea`：草稿与输入框都仍是已提交文本时，两者都被清空，`resetInputHistoryBrowse` 与 `updateConversationPhase` 仍各调用一次。
- 新增 `submitDraft success keeps a newer same-session draft and still updates phase`：在途把同一会话的草稿和输入框改成另一句后成功，该句仍留在草稿和输入框里，且 `updateConversationPhase` 仍被调用。
- 新增 `submitDraft success after switch keeps a newer draft on the original session`：在途切到 B 且 A 的草稿已是后写句子时，成功后 A 的草稿仍是该句，B 的输入框不变。
- 保持 `submitDraft reject or throw after session switch does not paint B`。
- `scripts/test.sh --grep "submitDraft success|submitDraft reject or throw after session switch"`

## r07-2 hold

问题类：导航点已打开的子代理时，根会话或非工具标签上的点击没有任何跳转。

不变量：

- 子代理对话框没开、且 `findOpenTabForChat` 已有该标签时，`revealNavigatorAgentInConversation` 调用 `openSubAgent`，由它 `activeGroup.openEditor(existingTab)`。
- 子代理对话框开着且已有标签时，仍走 `navigateAgentBreadcrumb`。对话框已经停在同一个 `chatId` 时，`navigateOverlayBreadcrumb` 直接返回。目标是另一个已有标签时，才 `openEditor` 并 `closeSubAgentDialog`。
- 没有已有标签时，仍 `openSubAgent(sessionKey, agentId, title)`。
- 根代理仍走 `navigateAgentBreadcrumb(sessionKey, 'default')`，对话框开着则关掉。

要动的符号或文件：

- `revealNavigatorAgentInConversation`（`src/vs/workbench/contrib/navigator/browser/navigatorReveal.ts`，约 46–49 行）

明确不改什么：

- 保持 `navigateAgentBreadcrumb` 在活动编辑器不是 `ConversationChatInput`、`isDefaultRoot`、或 `originKind !== 'tool'` 时直接返回（会话内面包屑，约 174–176 行与 180–181 行）。
- 保持 `openSubAgent` 对已有标签的 `openEditor`（约 424–429 行）。
- 保持会话未打开时的 `navigatorRevealSessionNotOpenCopy`。

本地验证：

- 把 `navigatorReveal.test.ts` 的 `existing tab on a visible leaf uses the breadcrumb` 改名为 `existing tab on a visible leaf opens the sub-agent`：对话框关闭时，`openCalls` 含该子代理，`breadcrumbCalls` 为空。
- 新增 `existing tab while the sub-agent dialog is open still uses the breadcrumb`：对话框开着且已有标签时，仍只记入 `breadcrumbCalls`，`openCalls` 为空。这一层只断言 reveal 调用了面包屑。
- 保持 `root on a visible leaf uses the breadcrumb and does not open a sub-agent`。
- 保持 `conversationSessionChat.test.ts` 的 `clicking a sub-agent with an existing tab activates the tab instead of opening a dialog`。
- `scripts/test.sh --grep "existing tab on a visible leaf opens the sub-agent|existing tab while the sub-agent dialog is open still uses the breadcrumb|root on a visible leaf uses the breadcrumb|clicking a sub-agent with an existing tab"`

## r07-3 weaken

问题类：非安静启动在连接已是 Error 之后，展示错误的 Promise 不结束，同一服务器排在 `_connectionSequencer` 里的下一次 `start()` 不会执行。

反证：进入 `mcpServer.ts` 约 890–904 行时，`connection.start()` 已经返回 Error。`StartServerAction` 没有旋转 class；`McpConnectionState.canBeStarted` 包含 Error，开始按钮会再次可点。sessions 窗口的 code lens（`mcpLanguageFeatures.ts` 的 `_provideCodeLenses` 在其他窗口直接返回；Error 分支约 288–314 行显示 Error / Restart，`$(loading~spin)` 只在 `Kind.Starting`）同样停在 Error。卡住的是这条不 `resolve` 的 Promise，以及 `StartServerAction.run`（约 813–814 行）因此到不了 `showOutput()`。

不变量：

- 非安静（`_isQuietStart === false`）且读到的连接状态是 Error：调用现有 `showInteractiveError` 后 `resolve` 该错误状态，`McpServer.start` 的 Promise 结束。
- 读到的状态已离开 Error，或当前没有连接：`resolve` 读到的状态；没有连接时 `resolve` 进入该分支时已拿到的 Error 状态。这条 Promise 不能一直 pending。
- 安静启动仍 `reject(new UserInteractionRequiredError('start'))`。
- `resolve` / `reject` 只发生一次。
- 前一次 `start()` 结束后，排在 `_connectionSequencer` 上的下一次 `start()` 会执行。`Sequencer.queue`（`src/vs/base/common/async.ts`）在前一个 Promise 落定后才跑下一项。

要动的符号或文件：

- `McpServer.start` 里 `state.state === McpConnectionState.Kind.Error` 的 autorun（`src/vs/workbench/contrib/mcp/common/mcpServer.ts`，约 890–904 行）

明确不改什么：

- 保持其上 `errorOnUserInteraction` 且 Running 时等待 handler 的分支（约 869–888 行）。
- 保持 `showInteractiveError` 的通知文案与沙箱建议。
- 保持 `stop()` 不进入 `_connectionSequencer`（约 1039–1040 行）。
- 保持 `RestartServer.run` 先 `showOutput()` 再 `stop()` 再 `start()` 的顺序。

本地验证：

- 现无覆盖这段 Error 等待的测试。新增 `non-quiet error start settles and the next queued start runs`：非安静 `start` 在连接进入 Error 后，返回状态为 Error 且 Promise 落定；同一服务器紧接着的第二次 `start` 会执行到连接启动。安静启动仍以 `UserInteractionRequiredError` 拒绝，`reason` 为 `start`，`message` 为 `User interaction required: start`。
- `scripts/test.sh --grep "non-quiet error start settles and the next queued start runs"`

## r07-4 hold

问题类：MCP 要打开 URL 做授权时，会话里没有请求，或调用已取消，等待不会结束，用户也没有通知。

不变量：

- `chatModel instanceof ChatModel` 且 `getRequests().at(-1)` 为空时，与表单授权一样走现有通知（打开 URL / 取消），通知关闭、取消按钮、取消令牌都会 `resolve`。
- 已有请求并插入 `ChatElicitationRequestPart` 时，`token.onCancellationRequested`（含已经取消）把 value `resolve` 为 `{ action: 'cancel' }`，且与接受 / 拒绝按钮只生效一次。
- 没有会话模型时，通知路径保持现状。
- 取消令牌结束的是 elicit 的 value。`completePromise` 在取消时仍可拒绝。已取消令牌的 `onCancellationRequested` 经 `setTimeout(0)` 延后触发（`src/vs/base/common/cancellation.ts` 的 shortcutEvent）。拒绝观察必须在 `completePromise` 赋值之后、`await value` 之前同步挂上，赶在这次宏任务之前。返回的 `wait` 仍是同一个 Promise。用户接受并打开 URL 之后，完成通知仍通过 `wait` 交给调用方。

要动的符号或文件：

- `McpElicitationService._elicitUrl`（`src/vs/workbench/contrib/mcp/browser/mcpElicitationService.ts`：`completePromise` 约 148–163 行，value Promise 约 166–205 行）
- 无请求分支对齐同一文件 `_elicitForm` 在无请求时落到通知的结构（约 90–137 行）

明确不改什么：

- 保持 `_elicitForm` 的 carousel、`_doElicitUrl` 的打开结果，以及 `elicit()` 对 form / url 的分发。
- 保持 `mcpServer.ts` 里 elicitation 处理只取 `r.value` 并 `dispose` 的调用方式。
- 保持 `_handleElicitationErr` 仅在 `action === 'accept'` 且 kind 为 URL 时 `await wait`。

本地验证：

- 现无 elicitation 测试文件。新增 `url elicit with no chat request uses the notification`：ChatModel 且最后一条请求为空时，URL elicit 的 value 在点取消后为 `decline`，通知关闭时为 `cancel`，Promise 落定。新增 `url elicit chat card cancels with the token`：已有请求时，含已经取消的令牌使 value 为 `{ action: 'cancel' }`，且在 value 落定前没有未处理拒绝。无 `chatSessionResource` 时仍出通知。
- `scripts/test.sh --grep "url elicit with no chat request uses the notification|url elicit chat card cancels with the token"`

## r07-5 hold

问题类：多根工作区里只有一部分文件夹搜索失败时，缺根的结果被写成新的完整列表，状态栏不报错。

不变量：

- `collectSourcesFileEntries` 在每个文件夹都 `rejected` 时仍抛第一个失败，调用方继续留住上次结果。
- `0 < failures.length < folders.length` 时不抛错，返回值带上哪些文件夹失败；成功文件夹的条目仍可返回。
- `SourcesFilesList.refresh` 见到部分失败时，不把本次 `entries` 写入 `lastGoodEntries`，不把 `lastOutcome` 当成一次干净成功。已有 `lastGoodEntries` 时继续显示它们，并用 `sourcesFilesListReadFailureMessage` 走 `setStatusMessage(..., true)`。
- 零失败才更新 `lastGoodEntries`、写入 `lastOutcome`、清掉 `lastReadError`。
- 刷新序号变了，或任一文件夹令牌已取消时，仍整轮丢弃，不应用这次结果。

要动的符号或文件：

- `ISourcesFilesCollectOutcome`（`src/vs/workbench/contrib/sources/common/sourcesFilesModel.ts` 23–27 行）与 `collectSourcesFileEntries` 的失败组装（同文件 78–108 行；空文件夹早退在 66–68 行，保持原样）
- `SourcesFilesList.refresh` / `paintCollected`（`src/vs/workbench/contrib/sources/browser/sourcesFilesList.ts`，约 294–301 行与 321 行）

明确不改什么：

- 保持一文件夹一次 `fileSearch`，不改回共享查询。
- 保持 `resolveSourcesFilesCollectResult`：有 `error` 时返回上次条目且 `failed: true`。
- 保持取消轮次与隐藏 Files 页不刷新的现有行为。
- 列表仍是扁平文件列表；不改成树控件。

本地验证：

- 扩展 `sourcesFilesModel.test.ts` 的 `one folder reject keeps the other folder`：成功文件夹的文件仍在，返回值标出失败文件夹。保持 `every folder reject throws so the caller can keep the previous result` 与 `resolveSourcesFilesCollectResult keeps last-good entries after throw`。
- 新增 `partial folder reject keeps leftover rows and paints failure`：先成功列出两个根的文件，再让其中一个 `fileSearch` 拒绝；列表行数与失败根里的文件仍在，状态文案为 `sourcesFilesListReadFailureMessage`。两个根都成功时状态错误被清掉。
- 保持 `all folder rejects paint failure, not empty-workspace success` 与 `success then reject keeps leftover rows`。
- `scripts/test.sh --grep "one folder reject keeps the other folder|every folder reject throws|all folder rejects paint failure|success then reject keeps leftover rows|partial folder reject keeps leftover rows and paints failure"`

## 审查

2026-09-30 只读审查。无 Critical、Important、Minor，可按正文实施。剩余风险：r07-3 要新搭 `McpServer.start` 替身；r07-5 失败文件夹字段的属性名由实现和新增断言一起定。

2026-09-30 第二轮只读审查。无新的 Critical / Important。

2026-09-30 用户签收。`accepted`。未实施。
