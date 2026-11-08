---
title: "十六路审查 2026-11-07 r05：sessions 方案"
type: plan
status: accepted
phase: N/A
updated: 2026-11-07
summary: "hold 0、weaken 2、drop 0；恢复管理远程主机选择器的返回按钮与菜单命令（菜单命令的 promise 补一层 catch），并让运行会话删除成功后无论历史区是否已销毁都删除运行记录。两条只影响 Agents 窗口。已过规则 16 只读审查并改稿；2026-11-07 已实施（未编译、未跑测试），代码审查可接受。"
---

# 十六路审查 2026-11-07 r05：sessions 方案

状态：执行中。负责：agent:opus。
签收：签。签收人：agent:opus，依据用户 2026-11-07 在会话中说的「需要的做一下 不编译」，日期：2026-11-07。
覆盖需求：无（两条都只在 Agents 窗口 `src/vs/sessions/` 里可达；[产品愿景](../../docs/product/vision.md) 35 行把该窗口排除在本项目的产品使用、UI 审查与交付验收之外，[产品需求](../../docs/product/requirements.md) 里没有自动化或远程主机管理的条目，Agents 窗口只留在「Agents Window 对照记录（非本项目使用范围）」一节作上游对照）。

只改 r05-1 与 r05-2 两条，范围停在 `src/vs/sessions/contrib/providers/remoteAgentHost/browser/manageRemoteAgentHosts.ts`、`src/vs/sessions/contrib/sessions/browser/views/automationsView.ts` 和它们的测试文件。两条只影响 Agents 窗口：这两份代码只经 `sessions.desktop.main.ts` 与 `sessions.web.main.ts` 加载，默认编辑器窗口不受益，只靠单测验证。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r05-1 | weaken | 中→低 | 成立，行为与发现稿一致，行号没有漂移。降级理由：只影响 Agents 窗口，在 1111 行导入 `manageRemoteAgentHosts.ts` 的 `remoteAgentHost.contribution.ts` 只由 `sessions.desktop.main.ts` 236 行和 `sessions.web.main.ts` 180 行加载；还要用户自己添加过至少一台远程主机（`manageRemoteAgentHosts.ts` 66–70 行只列出有 `remoteAddress` 且不属于主机组的提供方）。后果是返回按钮把选择器关掉，不改任何状态，重新运行命令就能回到列表。菜单分支在命令面板路径下没有条目，三个条目都要求 `sessionWorkspacePickerGroup == remote`。没有把它定为预期的依据：D1328（`dev/progress/deferred-gaps.md` 1285 行）写明只改错误收口，不改变 back 回退。 |
| r05-2 | weaken | 低→提示 | 成立，行为与发现稿一致，行号没有漂移。降级理由：只影响 Agents 窗口，且要打开默认关闭的实验设置 `chat.automations.enabled`（`automations.contribution.ts` 39–47 行）。agent host 声明了自动化能力、旧账本迁移完以后，运行历史归宿主所有，`AgentHostAutomationStore.deleteRun`（`agentHostAutomationStore.ts` 413–418 行）一律抛错，这类运行有没有这道检查都删不掉；本条只影响仍由旧账本持有的运行。用户看到的运行历史里这一项照样消失（`automationsView.ts` 644–650 行按会话是否存在过滤）。删除入口只对已完成或出错的会话开放（`automationsView.ts` 1388–1394、1448–1454 行），残留不会被当成进行中的运行挡住后续运行，只多占每个自动化 50 条配额中的一条。 |

### r05-1

问题类：`Manage Remote Agent Hosts...` 选择器在 `onDidAccept` 里先调用 `picker.hide()`，隐藏会同步释放外层 `store`，之后对 `store.isDisposed` 的检查恒为真，于是主机选项里的返回按钮不再回到列表，菜单项的命令也不再执行。顺带收口一处相邻问题：菜单分支 `executeCommand` 返回的 promise 一直没有接住（26e7f43c0f8 之前就是这样）。只影响 Agents 窗口。

不变量：

- 接受远程主机项后，主机选项选择器以 `'back'` 结束时，`showManagePicker()` 恰好执行一次，新的管理列表可见。
- 主机选项选择器以 `undefined` 结束时（按 Escape 关闭，或选了某个选项并执行完），不重新打开管理列表。
- 接受菜单项时，`commandService.executeCommand(selected.action.id, 回退回调)` 恰好执行一次；命令调用这个回退回调时，管理列表重新打开一次。
- 菜单分支 `executeCommand` 返回的 promise 挂一层 `.catch(onUnexpectedError)`：命令抛错时错误交给 `onUnexpectedError`，不留下未处理的拒绝。
- 外层选择器隐藏时，外层 `store` 照常释放；重新打开的列表使用新建的 `store` 与 `picker`。
- 远程分支的 promise 仍以 `void` 起头，只挂一层 `.catch(onUnexpectedError)`；整个文件没有双层 catch。

要动的符号：匿名 `Action2` 子类 `run` 方法里的局部函数 `showManagePicker`（114–184 行），具体是 `picker.onDidAccept` 的回调（155–180 行）。文件：`src/vs/sessions/contrib/providers/remoteAgentHost/browser/manageRemoteAgentHosts.ts`。

改法：

1. 远程分支（161–169 行）：删掉 `.then` 回调开头对外层 `store.isDisposed` 的提前返回（163–165 行），恢复为 `result === 'back'` 时调用 `showManagePicker()`。
2. 菜单分支（170–179 行）：删掉执行命令之前的 `store.isDisposed` 提前返回（171–173 行）；传给 `executeCommand` 的回退回调直接调用 `showManagePicker()`，去掉其中对外层 `store` 的判断（174–178 行）。这次调用前加 `void`，返回的 promise 挂一层 `.catch(onUnexpectedError)`，不 await。
3. 不换成别的存活判断。外层 `store` 和这一次的 `picker` 在 `hide()` 返回时都已释放，以它们为对象的任何检查都恒为真。返回按钮和命令的回退回调都表示用户明确要回到列表。
4. 没有选中项时仍在 `hide()` 之后直接返回（158–160 行），不变。

明确不改什么：

- `picker.hide()` 在回调开头的位置，以及 `picker.onDidHide(() => store.dispose())`（182 行）。
- `showRemoteHostOptions` 与它的返回按钮（`remoteHostOptions.ts` 487–509 行）。
- 远程分支的单层 `.catch(onUnexpectedError)`。保持 `manageRemoteAgentHostsCatchScanD1328.test.ts` 的 `remote host options promise catches unexpected errors` 通过：它的否定断言匹配的是没有 catch、以 `});` 收尾的旧写法，删掉检查后源码以 `}).catch(onUnexpectedError);` 收尾，不会命中；改法第 2 步新加的也是单层 catch，`countDoubleChains(source)` 仍为 0，其余断言只看远程分支的调用文本。
- 菜单分支不 await `executeCommand`。
- 行内移除按钮 `onDidTriggerItemButton`（148–153 行）与列表刷新。
- 26e7f43c0f8 在其它文件里加的销毁检查不在本条范围；同类排查见「核查记录」。

本地验证：

- 这条命令目前没有行为测试。新增 `src/vs/sessions/contrib/providers/remoteAgentHost/test/browser/manageRemoteAgentHosts.test.ts`，以 `workbenchInstantiationService`（`src/vs/workbench/test/browser/workbenchTestServices.ts`）为底。它已提供 `IContextKeyService`（`MockContextKeyService`）、`IMenuService`（`TestMenuService`，`getMenuActions` 返回 `[]`）、`IProductService`、`IProgressService`、`IDialogService`、`INotificationService`、`IEditorService`、`IConfigurationService`。再 stub `IQuickInputService`、`ISessionsProvidersService`、`IRemoteAgentHostService`、`ICommandService`、`IClipboardService`、`IPreferencesService`、`ISSHRemoteAgentHostService`；非 web 环境下 `showRemoteHostOptions` 还会取 `IRemoteAgentHostLocationPreferenceService`，也要 stub。
- 导入 `../../browser/manageRemoteAgentHosts.js` 让命令注册，用 `CommandsRegistry.getCommand(RemoteAgentHostCommandIds.manageRemoteAgentHosts)?.handler` 取处理函数，经 `instantiationService.invokeFunction` 调用。
- 假 `IQuickInputService` 提供 `backButton`。`createQuickPick` 每创建一个假选择器就记下来，并完成对应序号的 `DeferredPromise`；测试等「第 N 次创建」时把这个 `DeferredPromise` 与 `timeout` 做 race，修复前落到断言失败，而不是挂到 mocha 超时。假选择器的 `hide()` 先把可见状态置为假，再同步触发 `onDidHide`，与 `QuickInputController.hide` 在返回前同步调用 `didHide` 的顺序一致。
- `ISessionsProvidersService` 给一个提供方：id 以 `agenthost-` 开头（`isAgentHostProvider` 只认 `local-agent-host` 和这个前缀，`agentHostSessionsProvider.ts` 270–288 行），有 `remoteAddress`，没有 `hostGroup`。
- 新增断言（返回）：接受远程主机项，第二个选择器（主机选项）触发 `backButton` 后，第 3 次创建在 race 里完成，`createQuickPick` 共被调用三次，第三个选择器的 `title` 是 "Manage Remote Agent Hosts" 且已调用 `show()`。
- 新增断言（不返回）：第二个选择器直接隐藏、不按返回时，第 3 次创建的 `DeferredPromise` 与短 `timeout` race 后仍未完成，`createQuickPick` 只被调用两次。
- 新增断言（菜单项）：把 `IMenuService` 换成 `getMenuActions` 返回一个真实 `MenuItemAction` 的桩（`buildItems` 用 `instanceof MenuItemAction` 过滤，`manageRemoteAgentHosts.ts` 90 行）。接受它后，`ICommandService.executeCommand` 恰好收到一次该命令 id 与一个回调；调用这个回调后再新建一个管理列表。
- 新增断言（不泄漏）：`executeCommand` 返回被拒绝的 promise。照 `automationsView.test.ts` 里 `does not leak unhandled rejection when card delete confirm rejects` 的写法，监听 `process` 的 `unhandledRejection`，并用 `setUnexpectedErrorHandler` 临时换成收集错误的处理函数；`await timeout(0)` 后未处理拒绝为空，错误交到了替换的处理函数。
- 每条测试结束前隐藏最后一个选择器，让 `ensureNoDisposablesAreLeakedInTestSuite` 不报泄漏。
- 运行顺序：`scripts/test.sh --run` 加载的是 `out/` 下的编译产物（`test/unit/electron/renderer.js` 114–115 行），所以先 `npm run compile`（只改这几份 TypeScript 时可按 `dev/progress/health-gates.md` 56 行改用 `npm run compile-client`）；再 `./scripts/test.sh --run src/vs/sessions/contrib/providers/remoteAgentHost/test/browser/manageRemoteAgentHosts.test.ts` 和 `./scripts/test.sh --run src/vs/sessions/contrib/providers/remoteAgentHost/test/node/manageRemoteAgentHostsCatchScanD1328.test.ts`；最后 `npm run eslint`。`scripts/run-unit-custom.sh` 只跑 conversation、sources、universeAgent 三个域（`health-gates.md` 45 行，脚本 139–144 行），不覆盖 `src/vs/sessions`，本条不用它。

### r05-2

问题类：在 Automations 历史区确认删除运行会话后，如果历史区在 `deleteSession` 返回之前被销毁，`confirmDeleteRunSession` 跳过 `deleteRun`，仍由旧账本持有的运行记录留在持久化账本里。只影响 Agents 窗口。

不变量：

- `deleteSession` 成功返回后，`automationService.deleteRun(run.id)` 恰好调用一次，不论历史区此时是否已销毁。
- 历史区已销毁时，不写 `pendingFocusRunId` 与 `shouldRestoreFocus`，不调用 `restoreFocusAfterRender()`，不发 `status(...)`，不弹 `dialogService.error`。
- `deleteRun` 抛错时一律写 `logService.error`，沿用现有消息 `[AutomationsCards] Failed to remove deleted automation run from history`；历史区未销毁时，另外沿用现有的焦点恢复与 `automationRunHistoryDeleteFailed` 对话框。
- `deleteSession` 失败时不调用 `deleteRun`。
- 确认框返回时历史区已销毁，整次删除放弃，会话与运行都不动。

要动的符号：`AutomationHistorySection.confirmDeleteRunSession`（989–1040 行），改动落在 1015–1021 行与 1029–1039 行。文件：`src/vs/sessions/contrib/sessions/browser/views/automationsView.ts`。

改法：

1. 删掉 1015–1017 行在 `deleteRun` 之前的销毁提前返回。1018–1021 行写 `pendingFocusRunId` 与 `shouldRestoreFocus` 的分支改为只在历史区未销毁时执行。
2. `deleteRun` 仍在本方法里 `await`，由现有 try/catch 收口；不要改成 `void ... .catch(onUnexpectedError)` 甩出方法。
3. `deleteRun` 成功后的销毁检查（1024–1026 行）保持：已销毁就返回，不恢复焦点，不发状态提示。
4. `deleteRun` 的 catch（1029–1039 行）先写日志，再判断销毁：已销毁就返回；未销毁时依次调用 `restoreFocusAfterRender()` 并弹现有错误对话框。
5. 边界：宿主已接管运行历史时，`deleteRun` 会抛 "Automation run history is owned by the Agent Host."。改后销毁路径只多一条错误日志，不弹框。

明确不改什么：

- 确认框返回后的检查（997–999 行）。保留的理由：这时还没有任何写入，放弃后会话与运行都还在，状态一致，用户重新打开 Automations 视图仍能看到这一项并重试；确认框是模态对话框，确认期间历史区只会被外部事件销毁（例如别处移除了当前会话，回退会话打开时隐藏了自定义视图）；同文件的创建、编辑对话框也是在返回后、写入之前这样放弃（见下一条），只改 997 行会让三处不一致。本条要修的是 1015 行把已经提交了第一步的两步操作截成一半。保持 `canceling run session deletion keeps the session`。
- `AutomationCardsSection.openCreateDialog`（505、508 行）与 `openEditDialog`（535、538 行）在对话框返回后的销毁检查。理由同上：对话框是 `base/browser/ui/dialog` 的 `Dialog`（`automationDialogService.ts` 132 行），放弃发生在任何写入之前。
- `deleteSession` 失败分支（1003–1014 行）：已销毁时直接返回，未销毁时清焦点、记日志、弹错。保持 `keeps run history when session deletion fails`。
- 未销毁路径的现有行为。保持 `deleting a run session confirms the permanent deletion without opening it`、`history context menu deletion uses the run-only deletion flow`、`deleting the focused run moves focus to the next run`。
- 被删的当前会话由回退会话接替，以及打开会话时隐藏自定义视图（`sessionsService.ts` 647–654、714–717 行）。
- 不新增在 `onDidDeleteSession` 上清理运行的订阅；不改 `ProviderAutomationService.deleteRun`、`ReconnectableAgentHostAutomationStore.deleteRun`、`AgentHostAutomationStore.deleteRun`。宿主已接管运行历史时，未销毁路径会弹 "The session was deleted, but its run history item could not be removed."，这是上游 33e6a5d6f34 起的现状，本条不改。
- 历史区与无障碍视图按会话是否存在过滤运行（`automationsView.ts` 644–650 行，`automationsAccessibility.ts` 62–66 行）。
- `automationsView.ts` 里的 `.catch(onUnexpectedError)` 仍是 6 处。保持 `automationsViewCatchScan.test.ts` 的 `automationsView leftover voids single-catch onUnexpectedError (D603)`。

本地验证：

- 测试文件 `src/vs/sessions/contrib/sessions/test/browser/automationsView.test.ts`，套件 `AutomationsCardsWidget`。
- 钩子：给 `FakeSessionsManagementService.deleteSession`（测试文件 462–469 行）加一个可选钩子，放在 `deletedSessionResources.add(...)` 之后、`sessionDeletedEmitter.fire(session)` 之前。这与生产顺序一致：提供方在 `deleteSessions` 返回之前就发出移除事件（`baseAgentHostSessionsProvider.ts` 4374–4380 行），历史区在这时被销毁；`onDidDeleteSession` 要等 `provider.deleteSessions` 返回后才由 `SessionsManagementService.deleteSession` 发出（`sessionsManagementService.ts` 1248–1252 行）。测试里让钩子调用 `widget.dispose()`。`AutomationsCardsWidget.dispose()`（`automationsView.ts` 182–189 行）先看 `this._store.isDisposed`，`disposables` 收尾时再释放一次不会出错。
- 错误注入：给 `FakeAutomationService.deleteRun`（测试文件 225–229 行）加一个可注入的错误，设了就在 `deleteRunCalls++` 之后抛出，不完成 `deleteRunCompleted`。
- 新增断言（销毁后成功）：加钩子，确认删除后把 `automationService.deleteRunCompleted.p` 与 `timeout` 做 race，修复前落到断言失败，而不是挂到 mocha 超时。断言 `deleteSessionCalls` 为 1，`deleteRunCalls` 为 1，`dialogService.errors` 为空。
- 新增断言（未销毁时失败）：不加钩子，注入错误（例如 `new Error('run delete failed')`），确认删除后等 `dialogService.errorCalled.p`。断言 `dialogService.errors` 等于 `[{ message: 'The session was deleted, but its run history item could not be removed.', detail: 'run delete failed' }]`，`logService.errors.map(entry => entry.message)` 含 `[AutomationsCards] Failed to remove deleted automation run from history`，`deleteRunCalls` 为 1。改法第 4 步调整了日志与销毁检查的先后，这条锁住未销毁路径仍记日志、仍弹框。
- 新增断言（销毁后失败）：加钩子并注入错误。日志写入另等：照 `FakeDialogService.errorCalled` 的写法，给 `TestLogService` 加一个在 `error` 里完成的 `DeferredPromise`，同样与 `timeout` 做 race。断言 `deleteRunCalls` 为 1，`dialogService.errors` 为空，`logService.errors` 里有同一条消息。
- 运行顺序：先 `npm run compile`（或按 `health-gates.md` 56 行用 `npm run compile-client`）；再 `./scripts/test.sh --run src/vs/sessions/contrib/sessions/test/browser/automationsView.test.ts`（整个文件，含上面列出的既有测试名）和 `./scripts/test.sh --run src/vs/sessions/contrib/sessions/test/node/automationsViewCatchScan.test.ts`；最后 `npm run eslint`。`scripts/run-unit-custom.sh` 不覆盖 `src/vs/sessions`，本条不用它。

## 实施前提与步骤

1. 实施前提：本稿签收，签收不在本轮。签收前不开实施切片（[DOCUMENTATION.md](../../docs/DOCUMENTATION.md) 规则 16 第 4 条）。方案提交与实施提交分开（规则 13）。
2. 方案提交：只暂存本稿与发现稿 `review-2026-11-07-r05-sessions.md`。两份稿在 `dev/plans/INDEX.md` 的方案表里已经登记（另一会话批量加的，未提交）：提交时按块暂存，只带上这两行，不要重复添加，也不要整份暂存 `INDEX.md`；不得为此 restore / stash 别人的改动（规则 3b）。状态列由 `python3 scripts/generate-docs-status.py` 维护（规则 3c）。提交前跑 docs-health：`python3 scripts/check-docs-health.py`、`python3 scripts/wiki/wiki.py check --root .`，以及 `health-gates.md` 44 行同列的 `python3 scripts/generate-docs-status.py --check`。
3. 实施提交：r05-1 与 r05-2 的源码和测试互不相交，可以分两次提交，也可以合成一次。每次都按两条「本地验证」里的顺序，先 compile，再 `scripts/test.sh --run`，最后 eslint。实施提交前按规则 3、3a 更新 `dev/progress/status.md`、本稿状态与 `INDEX.md` 摘要；`status.md` 目前也有别的会话未提交的改动，只暂存自己的那几行。改了文档再跑一遍 docs-health。

## 核查记录（2026-11-07）

只读核对到 HEAD `841ea38816d`。`src/vs/sessions/` 下没有未提交改动，发现稿所引 `src/vs/platform/quickinput/browser/` 的两个文件也没有。发现稿引用的行号都没有漂移。没有编译，没有跑测试。

同日改稿时复核：HEAD 仍是 `841ea38816d`，`src/vs/sessions/` 与 `src/vs/platform/quickinput/browser/` 仍没有未提交改动，代码行号没有漂移。`dev/plans/INDEX.md`、`dev/progress/status.md`、`docs/product/requirements.md` 有别的会话未提交的改动；本稿引用的 `status.md` 37 行、`deferred-gaps.md` 1285 行在当前工作区里没有变。

r05-1：

- 可达性。命令带 `f1: true`，前置条件 `chat.remoteAgentHostsEnabled` 在 Agents 窗口默认为真（`remoteAgentHost.contribution.ts` 999–1005 行）。隐藏是同步的：`QuickInput.hide()`（`quickInput.ts` 366–371 行）调用 `ui.hide`，也就是 `QuickInputController.hide()`（`quickInputController.ts` 461 行、824–857 行）；后者在返回前调用 `controller.didHide(reason)`（856 行），`QuickInput.didHide`（`quickInput.ts` 373–377 行）同步触发 `onDidHide`，`manageRemoteAgentHosts.ts` 182 行的监听随即执行 `store.dispose()`。所以该文件 161 行往下 `store.isDisposed` 恒为真。返回按钮在 `remoteHostOptions.ts` 490–495 行让 promise 以 `'back'` 结束，507–509 行把 `'back'` 交回调用方。26e7f43c0f8 之前，远程分支直接按 `result === 'back'` 重开列表，菜单分支直接执行命令。
- 有意如此的依据：没有，反而有相反的依据。`manageRemoteAgentHostsCatchScanD1328.test.ts` 只断言 catch 链的源码文本，不涉及 `isDisposed`；D1328（`deferred-gaps.md` 1285 行）的范围栏写明「只改远端选项对话框的错误收口，不改变 back 回退、主机管理或命令语义」。`remoteHostOptions.test.ts` 没有返回按钮用例。`docs/`、`docs/decisions/`，以及 `src/vs/sessions/` 下的 `LAYERS.md`、`SESSIONS.md`、`REMOTE_AGENT_HOST_SESSIONS_PROVIDER.md` 都没有相关条目。`dev/progress/status.md` 37 行只把 26e7f43c0f8 记为 catch 去重与销毁守卫。
- 重复：没有。`dev/plans/review-2026-*.md`（11-07 其它路除外）、其它方案、`deferred-gaps.md`、`archive/`、`dev/archive/` 里没有承接这两处检查的方案；`deferred-gaps.md` 里与 `manageRemoteAgentHosts.ts` 有关的只有 D1328，它管的是 catch。

r05-2：

- 可达性。删除链按发现稿逐段核对成立。`BaseAgentHostSessionsProvider.deleteSessions` 在 `finally` 里用普通 `Emitter` 发出移除事件（`baseAgentHostSessionsProvider.ts` 4374–4380 行），`SessionsManagementService` 同步转发（`sessionsManagementService.ts` 199 行）。被删的是当前会话时，`SessionsService._onDidChangeSessions` 经 `removeMany`（`visibleSessions.ts` 709–743 行）选出网格里的相邻会话，并调用 `openSession`（`sessionsService.ts` 650 行）。`openSession` 在第一个 await 之前调用 `_startOpenSession()`（`sessionsService.ts` 871 行），后者调用 `hideCustomView()`（同文件 717 行）。`Workbench` 的 autorun（`src/vs/sessions/browser/workbench.ts` 1458–1460 行）随即调用 `setView(undefined)`，`CustomViewGridPart._renderView` 在 `customViewGridPart.ts` 90 行执行 `_node.clear()`，自定义视图、卡片部件和历史区依次释放。这些都发生在 `deleteSession` 的 await 恢复之前。打开 Automations 视图只调用 `showCustomView`（`sessionsViewActions.ts` 1368 行），当前会话不变。没有回退会话时走 `openNewSession()`，当前会话为空时它不隐藏视图（`sessionsService.ts` 1104–1106 行），这时 `deleteRun` 照常执行。所以触发要求被删会话是当前会话、网格里还开着别的会话，或者用户在请求返回之前自己打开了别的会话。
- 后果的边界。`IAutomationService` 的实现是 `ProviderAutomationService`（`automations.contribution.ts` 29 行），它把 `deleteRun` 交给持有该运行的存储（`providerAutomationService.ts` 123–126 行、253–255 行）。agent host 声明自动化能力时，提供方的存储是 `AgentHostAutomationStore`（`reconnectableAgentHostAutomationStore.ts` 93–97 行建立，180–182 行与 257–259 行转交 `deleteRun`），旧账本迁移完以后它的 `deleteRun` 一律抛错（`agentHostAutomationStore.ts` 413–418 行）。只有仍由旧账本持有的运行会因为这道检查留下残留：目标没有 `providerId` 的自动化留在全局旧账本；宿主没有声明自动化能力或迁移未完成时，运行留在提供方的旧账本。旧账本按每个自动化 50 条裁剪（`automationService.ts` 40、482 行）。运行会话不进主会话列表（`src/vs/sessions/SESSIONS_LIST.md` 27 行，`sessionsList.ts` 3613 行），删除入口基本只有历史区。
- 有意如此的依据：没有。`automationsView.test.ts` 的删除用例都不覆盖删除期间历史区被销毁；`automationsViewCatchScan.test.ts` 只锁 catch 链。`AGENT_HOST_SESSIONS_PROVIDER.md` 只说明迁移后运行历史归宿主，不涉及旧账本里的运行。`docs/`、`docs/decisions/`、`LAYERS.md`、`SESSIONS.md` 都没有相关条目。
- 重复：没有。上述范围内没有承接 `confirmDeleteRunSession` 或 `deleteRun` 的方案；`deferred-gaps.md` 的 D474、D603 只管 `automationsView.ts` 的 catch 链。

同类排查（改稿时补，回应审查里「这一类问题是否已经收口」）：

- 范围：d47c382192d、a88702714f1、26e7f43c0f8 在 `src/vs/sessions` 的 `browser`、`electron-browser` 目录新增的全部 `isDisposed` 行，分别是 57、76、80 行（含字段声明与赋值）。
- 检查对象是局部 store、会被 `hide()` 同步释放的：只有 `manageRemoteAgentHosts.ts` 的三处，由 r05-1 承接。另一个不看 `this._store` 的是 `sessionGitHubInfo.ts` 自己的 `_isDisposed` 标志，只在 `dispose()` 里置位，与隐藏无关。`ModePicker`、`PermissionPicker`、`MobileChatInputConfigPicker` 新加的检查看的是选择器对象自己的 `_store`，关闭操作面板或底部面板不会释放它。
- 检查之前十行内有 await、之后十行内还有服务调用的：除 `automationsView.ts` 997、1015 行外，还有同文件 `openCreateDialog` 的 505、508 行与 `openEditDialog` 的 535、538 行，`sessionsWindowNotifier.ts` 140、146 行，`sessionBrowsersControl.ts` 172 行，`sessionsSetUpService.ts` 221、227 行。其中只有 1015 行位于「第一步写入已提交、第二步写入之前」，由 r05-2 承接。997、505、508、535、538 行都在模态对话框返回后、任何写入之前放弃，状态一致，本稿不改（理由见 r05-2「明确不改什么」）。`sessionsWindowNotifier.ts` 与 `sessionBrowsersControl.ts` 的检查只跳过界面跳转（点通知后打开会话、打开浏览器标签），不涉及持久化写入。`sessionsSetUpService.ts` 的两处是登录状态事件的响应，前一步只是读取，服务随窗口释放。
- 结论：按这个口径，「隐藏后检查自己的 store」与「已提交一步、截断下一步」两类各只有一例，都由本稿承接。筛查按行距取窗口，await 与写入相隔超过十行的写法可能漏掉。

## 审查

2026-11-07 只读审查的结论是须改稿，只差验证。Critical 无。Important 两条都已改：I1 在两条的「本地验证」里写明先 `npm run compile`（或按 `health-gates.md` 56 行用 `npm run compile-client`），再跑 `scripts/test.sh --run`，最后 `npm run eslint`，并写明 `scripts/run-unit-custom.sh` 只跑 conversation、sources、universeAgent，不覆盖 `src/vs/sessions`（`health-gates.md` 45 行，脚本 139–144 行）；I2 在 r05-2 补了「未销毁时 `deleteRun` 失败」的用例，`deleteRun` 可注入错误，断言对话框等于 `[{ message: 'The session was deleted, but its run history item could not be removed.', detail }]`，日志里有 `[AutomationsCards] Failed to remove deleted automation run from history`。Minor 五条都已改：保留 997 行的理由写进 r05-2「明确不改什么」；同类排查的证据写进「核查记录」；r05-1 用例改以 `workbenchInstantiationService` 为底，写明 `IContextKeyService`、`getMenuActions` 返回 `[]`、提供方 id 以 `agenthost-` 开头、按第 N 次创建的 `DeferredPromise` 等待；r05-2 的回归用例与 `timeout` 做 race，钩子改到 `sessionDeletedEmitter.fire(session)` 之前，并按生产顺序写明理由；菜单分支没接住的 `executeCommand` 采纳为改法第 2 步的单层 `.catch(onUnexpectedError)`，补了不泄漏未处理拒绝的用例；按 D1328 扫描测试的断言文本，新增的单层 catch 不会让它失败（本轮没有跑测试）。另按共性意见：「覆盖需求」改写为实质理由，新增「实施前提与步骤」一节（含提交时登记 `dev/plans/INDEX.md` 与 docs-health）。两条的判定与严重度不变。签收不在本轮。

## 实施记录（2026-11-07）

用户同意实施，并要求不编译。r05-1 与 r05-2 都已按本稿实施。没有编译，没有跑测试，也没有跑 eslint 与 docs-health；下面的判断只来自读代码，以及用两份扫描测试的断言文本对改后源码做的字符串比对。

r05-1（已实施）：

- `src/vs/sessions/contrib/providers/remoteAgentHost/browser/manageRemoteAgentHosts.ts`：`showManagePicker` 的 `onDidAccept` 回调删掉三处对外层 `store.isDisposed` 的判断。远程分支在 `result === 'back'` 时直接调用 `showManagePicker()`；菜单分支改为在 `executeCommand` 前加 `void`，回退回调直接调用 `showManagePicker()`，返回的 promise 挂一层 `.catch(onUnexpectedError)`。
- 新增 `src/vs/sessions/contrib/providers/remoteAgentHost/test/browser/manageRemoteAgentHosts.test.ts`，套件 `Manage Remote Agent Hosts command`，四条用例：`Back in the host options reopens the manage list`、`closing the host options without Back does not reopen the manage list`、`a menu action runs its command and its back callback reopens the manage list`、`a failing menu command reaches onUnexpectedError instead of leaking an unhandled rejection`。
- 与方案的出入：「第 N 次创建与 `timeout` 做 race」用的是 `base/common/async.ts` 的 `raceTimeout`，它先完成时清掉计时器、超时返回 `undefined`，不会像取消 `timeout()` 那样留下被拒绝的 promise。假选择器 `FakeQuickPick` 不带泛型，`createQuickPick` 照 `mcpElicitationService.test.ts` 的重载写法建它后转成 `IQuickPick<T>`。每个假选择器也登记进测试的 `DisposableStore`，它的 `dispose()` 先 `hide()`，用例中途失败时也会触发生产代码的清理。
- 按 `manageRemoteAgentHostsCatchScanD1328.test.ts` 的断言文本逐条比对了改后的源码：远程分支的调用仍只出现一次，`}).catch(onUnexpectedError);` 仍在，双层 catch 为 0，没有命中否定断言里的旧写法。

r05-2（已实施）：

- `src/vs/sessions/contrib/sessions/browser/views/automationsView.ts`：`AutomationHistorySection.confirmDeleteRunSession` 删掉 `deleteRun` 之前的销毁提前返回；焦点记录改为 `hadFocus` 且历史区未销毁时才写；`deleteRun` 的 catch 先记日志，再判断销毁，未销毁时仍恢复焦点并弹 `automationRunHistoryDeleteFailed`。加了一行注释，说明视图销毁后为什么仍要删运行记录。
- `src/vs/sessions/contrib/sessions/test/browser/automationsView.test.ts`：导入加 `raceTimeout`；`FakeAutomationService` 加可注入的 `deleteRunError`；`TestLogService` 加 `errorLogged`；`FakeSessionsManagementService` 加 `onSessionRemoved` 钩子，位置在 `deletedSessionResources.add(...)` 之后、`sessionDeletedEmitter.fire(session)` 之前。新增三条用例：`reports a run history removal failure after the session is deleted`、`removes the run even when the history is disposed before session deletion returns`、`logs a run history removal failure without a dialog when the history is already disposed`。
- 与方案的出入：日志断言按消息过滤后计数（等于 1），没有要求整份日志列表相等，免得无关日志让用例变脆；等待也用 `raceTimeout`。
- `automationsView.ts` 里的 `.catch(onUnexpectedError)` 仍是 6 处，按 `automationsViewCatchScan.test.ts` 的断言文本比对通过。

依赖与没做的部分：

- 改动的三个已有文件在实施前都没有别的会话未提交的改动，新测试文件是新建的，没有提交顺序上的依赖。
- 「实施前提与步骤」里的签收由用户本轮同意实施代替；本稿状态行与 frontmatter 按派工留给父 agent 统一改。
- `dev/plans/INDEX.md` 里两份 r05 稿已由另一会话登记（未提交），提交时按块暂存这两行；`dev/progress/status.md` 的更新属于共享登记表，按派工交给父 agent，本轮没有改。

之后要跑的本地验证，按顺序：

1. `npm run compile`（只改这几份 TypeScript 时可用 `npm run compile-client`）。
2. `./scripts/test.sh --run src/vs/sessions/contrib/providers/remoteAgentHost/test/browser/manageRemoteAgentHosts.test.ts`
3. `./scripts/test.sh --run src/vs/sessions/contrib/providers/remoteAgentHost/test/node/manageRemoteAgentHostsCatchScanD1328.test.ts`
4. `./scripts/test.sh --run src/vs/sessions/contrib/sessions/test/browser/automationsView.test.ts`
5. `./scripts/test.sh --run src/vs/sessions/contrib/sessions/test/node/automationsViewCatchScan.test.ts`
6. `npm run eslint`
7. docs-health：`python3 scripts/check-docs-health.py`、`python3 scripts/wiki/wiki.py check --root .`、`python3 scripts/generate-docs-status.py --check`。

`scripts/run-unit-custom.sh` 不覆盖 `src/vs/sessions`，不用它验证本稿。

代码审查（2026-11-07）：只读代码审查的结论是可接受，只有 Minor，三条都已处理。

- `automationsView.test.ts` 第三条新用例原先等的 `errorLogged` 会被任意一条错误日志放行：`TestLogService` 改为按消息等待，新加 `whenErrorLogged(message)`，只有记下同一条消息时才完成，该用例改等 `[AutomationsCards] Failed to remove deleted automation run from history`。
- `automationsView.ts` 里说明「视图可能已销毁、运行记录仍要删」的注释，从焦点分支上方挪到 `deleteRun` 的 `try` 前面。
- 「实施前提与步骤」第 2 步改为：两份 r05 稿已在 `dev/plans/INDEX.md` 登记，提交时按块暂存只带上这两行，不重复添加，也不整份暂存。

改动后仍未编译、未跑测试。
