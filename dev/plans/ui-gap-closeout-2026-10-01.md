---
title: "UI 缺口收口 2026-10-01"
type: plan
status: draft
phase: M7
updated: 2026-10-02
summary: "把 UI 缺口审查里已复现的 Critical / Important 收成可并行切片。提问座位必填单选为空白时，提交不再静默。不升 PRD。父代理已核验并改入锚点。"
---

# UI 缺口收口 2026-10-01

> 发现稿：[ui-gap-review-2026-10-01](../progress/ui-gap-review-2026-10-01.md)。本稿 `draft`。不改 PRD 状态，不登记 D 编号。
> 相关方案只链不抄：[m7-gap-closeout](m7-gap-closeout.md) GC-1b、[prd-008-engine-e2e](prd-008-engine-e2e.md)、[accessibility-responsive-ui](accessibility-responsive-ui.md) T1、[sources-architecture](sources-architecture.md) P4、[settings-two-surfaces](settings-two-surfaces.md)、[connection-hub-client](connection-hub-client.md)。

## 1. 背景与范围

审查列出 C1–C3、I1–I19 与 Minor。带 ✔ 的锚点沿用父代理核对；其余已在 HEAD 打开源码。未复现或与既有合同冲突的条目见 §8，不进切片。

范围是 Sessions / Conversation 上用户能看见或能点到的诚实性与键盘环。GC-1b 的配对回路已经接上 `confirmPairing` / `cancelPairing`。C3 是那之后的残留：确认框不出现。

## 2. 不变量

| 合同 | 保持 |
|------|------|
| leftover 写闸 | pairing / loading 期可以留着上次的列表与分支名（`changesViewService.ts` `derivedObservableWithCache` 在 loading 时 `return lastValue`，约 356–359 行）。写钮必须卸下或 disabled。`invokeOperation` 在 pairingHold 下 0 次 `invokeChangesetOperation` |
| D312 / D315 | `isConversationPairingHold`（`conversationSessionStatus.ts` 55–59 行）语义不动。Sources 的 Stage / Commit / Accept 闸不在本稿重写 |
| D85 | promote 仍 close-first。本稿不改 `conversationSessionChatService` |
| Inbox 焦点环 | `workbench/browser/parts/conversation/media/ua-common.css` 不在此条。Inbox 环在 `conversationLens.css` 2675–2687 行：`:focus` 为 `outline: none !important`，`:focus-visible` 为 `1px solid var(--vscode-focusBorder) !important` 且 `outline-offset: -1px`。新环照这个写，含 `!important`，否则打不过 workbench 钮与选中 tab 的 `outline: none !important` |
| GC-1b | `confirmSas` 仍是用户确认门。Connect 路径保持「页内不画 SAS」（`assertNoInPanePairingDialog`）。取消不写 trust |
| PRD-008 | 升档只由 [prd-008-engine-e2e](prd-008-engine-e2e.md) 全 PASS 决定。本稿合入也不升档 |
| 引擎 RPC | 不新增 RPC，不改引擎仓。`SaveSkillContent` 维持现状 |
| 分层 | `sessions/contrib` 可依赖 `workbench/contrib` 与 `platform`（`LAYERS.md`、`eslint.config.js` 2311 行一带）。`sessions/contrib/changes` 不新增对 `contrib/providers` 的 import |
| T1 | `src/vs/workbench/browser/parts/conversation/media/ua-common.css` 110–119 行只服务已挂 `.ua-motion` 的节点。Engine / Connection 无动画节点，不挂空 class。Sessions 窗不 import 该文件，Sessions 侧的 reduce 写在 `sessions/browser/media/workbench.css` |

## 3. 切片

| Slice | 缺口 | 独占文件 | 依赖 |
|:------|:-----|:---------|:-----|
| S-A | C1 I9 I11 I12 | Changes 视图 / changeset / `files.contribution.ts` | — |
| S-B | C2 I14 I15 | 五份 CSS | — |
| S-C | C3 | `universeAgentMainService.ts` | — |
| S-D | I1 I2 I4 I5 | 四组互不重叠的 ts，可内部换人 | — |
| S-E | I8；I10 取舍为不注册。I7 不改能力位 | GitHub FS + Add Context | — |
| S-F | I6；I16 只写证据口径 | `workbench.ts` | — |
| S-G1 | I18 | Sessions customizations 三文件 | — |
| S-G2 | I19 | Triggers / Clipboard / Context 三节 | — |
| S-H | I13 | `workbench.css` + 尚未被 reduce / `monaco-enable-motion` 盖住的动画 CSS | 不改 S-B 的五份 CSS |

S-D / S-G 拆开是因为文件不交叠，可以并行。S-A 必须同一人：写闸、失败文案、ARIA 都在 Changes 视图。

## 4. 切片详述

### S-A 写面诚实

- **目标：** loading 或 pairingHold 时 Create PR / Merge 不可用，失败与空成功分开，写失败有通知，行名带路径。
- **文件：**
  - `src/vs/sessions/contrib/changes/browser/changesView.ts` 398–400、440–443、819–824、1007–1008、1524–1525
  - `src/vs/sessions/contrib/changes/browser/changesViewService.ts` 221–227、356–359
  - `src/vs/sessions/contrib/providers/agentHost/browser/agentHostSessionChangesets.ts` 276–277、293–294、356–393
  - `src/vs/sessions/contrib/changes/browser/changesViewRenderer.ts` `IChangesFileItem`（70–79 行）
  - `src/vs/sessions/services/sessions/common/session.ts` `ISessionChangeset`（434 行起）
  - `src/vs/sessions/contrib/files/browser/files.contribution.ts` 120–124
- **改法：**
  - `ChangesViewService` 构造函数末尾追加 `@IUniverseAgentConnection`。`writesHeldObs` 是 `derived`：`activeSessionLoadingObs` 或 pairing observable 为真。判定用 `isChangesWritePairingHold`（`changesWriteHold.ts`）：快照 `pairingPending === true`。不单用 `isConversationPairingHold`——配对开始时 phase 是 `connecting` 且 `pairingPending`，该谓词为假，写仍会发出。订阅 `onDidChangeConnection` 后再读快照。`lastValue` 冻结保留，只冻展示。`createHarness` 多传 stub，并给出可手动 fire 的 `onDidChangeConnection`。既有用例默认不处于 pairingHold。**已落。**
  - `ChangesWorkbenchButtonBarWidget` 的 autorun（440 行）：`writesHeldObs` 为真时先 `buttonBar.update([], [])` 再 return。禁止在清钮之前 return。1076–1078 行树的 loading return 不动。
  - `AbstractAgentHostChangeset` 注入 `IUniverseAgentConnection`（`INotificationService` 已在）。两个子类在 `@IDialogService` 后传入 `super`。`getConnection` 返回的 `IAgentConnection` 没有 `pairingPending`。闸用 `changesetInvokeBlock({ pairingHold: isChangesWritePairingHold(ua), hasConnection: !!connection })`，位于 `confirm` 与 `invokeChangesetOperation` 之前。无连接仍通知并抛错。pairing 通知后 return，不调用 invoke。**已落。**
  - `ISessionChangeset` 增加可选 `changesLoadFailed?: IObservable<boolean>`。仅 `changesetState instanceof Error` 时为 true（293–294 行今日把 Error 收成 `[]`，loading 在 276–277 行落下）。`null` 与空 files 仍是空成功。欢迎句仍是 824 行那句；失败另写一句，1008 行按失败 / 空成功切换。
  - `getAriaLabel` 改为 `changesFileAriaLabel`：相对路径（`labelService.getUriLabel(..., { relative: true })`）+ `changeType` + 删除标记。根节点仍用 `element.name`。
  - `files.contribution.ts` 的 `git.sync`：`try/catch/finally`，失败 `INotificationService.error`，`finally` 里仍 `set(false)`。
- **不变量：** 接通且非 pairing 时 Create PR / Merge 仍可点。不改 D312 Sources 写闸。不新增 provider import。
- **验收（C1）：** stub 在 `onDidChangeConnection` 后进入 pairingHold，或 loading 为真时，`writesHeldObs` 为 true。`changesView.ts` 该分支先 `buttonBar.update([], [])`，标题栏不再留着可执行的 `create-pr` / `merge`（id 已出现在 `hides the Agent Host merge operation when the base branch is protected`）。`changesetInvokeBlock` 为 pairing 时 `invokeChangesetOperation` 不被调用；源码顺序锁住该函数位于 `confirm` 之前。
- **测试：**
  - `changesViewService.test.ts` 新增 `writes held while loading or pairing hold`：fire `onDidChangeConnection` 后 observable 为 true；同文件 `readFileSync` `changesView.ts`，断言 `buttonBar.update([], [])` 出现在 writesHeld 的 return 之前。
  - `agentHostSessionChangesets.test.ts` 新增 `invokeOperation pairing hold does not call invokeChangesetOperation`：断言纯函数，并用 `readFileSync` 断言 `invokeOperation` 里 `changesetInvokeBlock` 出现在 `this._dialogService.confirm` 与 `invokeChangesetOperation` 之前。
  - `src/vs/sessions/contrib/changes/test/browser/changesViewRenderer.test.ts` 新增 `changes file aria label includes relative path and change type`。
  - `files/` 下无既有 `*.test.ts`。在 `files.contribution.ts` 同目录新增 `test/browser/filesSyncAction.test.ts`，用例 `git sync failure notifies and clears the running flag`。风格对照 `sessionInputBanners.test.ts` 里用 `NullLogService` / `mock` 的写法。
- **命令：** `scripts/test.sh --grep "writes held while loading|invokeOperation pairing hold|changes file aria label|git sync failure"`，然后对该目录 `npm run eslint`。
- **非目标：** 不改 `changesActions.ts` 的菜单注册。资源行按钮若仍在，点击进同一个 `invokeOperation` 闸。
- **风险：** 清钮若写在读 operations 之前，loading 结束要靠 autorun 再跑一次把钮画回来。回滚：还原上述文件，冻结用的 `lastValue` 不要单独回滚。

### S-B 焦点环

- **目标：** 键盘焦点能看见 `focusBorder` 环，鼠标点击不留环。
- **文件：**
  - `src/vs/workbench/contrib/conversation/browser/media/conversationLens.css` 86–88 行（透镜 tab），91–97 行（`[aria-selected="true"]` 无条件 `outline: none !important`），以及 181–185 行（session bar / session-controls / window-nav 的 `:focus { outline: none !important }`，其后没有对等的 `:focus-visible`）
  - `src/vs/workbench/browser/parts/conversation/media/conversationPart.css` 140–147 行
  - `src/vs/sessions/browser/media/style.css` 117–121 行（含 `.monaco-inputbox.synthetic-focus`）
  - `src/vs/sessions/contrib/sessions/browser/media/sessionsTitleBarWidget.css` 62–65 行
  - `src/vs/sessions/contrib/chat/browser/media/chatInput.css` 367–368、376–378、395–407 行
- **改法：** `:focus` 保持 `outline: none`。`:focus-visible` 画 `1px solid var(--vscode-focusBorder) !important` + `outline-offset: -1px`（与 Inbox 2682–2687 行同一写法）。键盘焦点同时匹配两条，所以画环规则必须写在同选择器的 `outline: none !important` **之后**，特异性不低于它。
  - 91–97 行选中 tab 的 `outline: none !important` 会盖掉 86–88 的新环（同特异性、后写获胜）。给 `[aria-selected="true"]:focus-visible` 另写一条环，放在 97 行之后。
  - 181–185 行覆盖的三个钮（含只出现在这里的 `.conversation-lens-session-controls`）在该规则后补 `:focus-visible`。只改 86–88 与 part css 140–147 盖不住这条后写的 `:focus`。
  - `style.css`：原生 `input`/`textarea` 的 `:focus` 仍 none；`:focus-visible` 画环。`.monaco-inputbox.synthetic-focus` 是 Monaco 输入的键盘焦点，同样画环，不要留在 `outline: none` 那条里。
  - 标题栏 `:focus` 后补 `:focus-visible`。
  - 发送钮 wrapper 的 width/height 在 367–368 行，内钮 width/height/`min-width` 在 376–378 行，五处 `22px` 改为 `24px`。395–397 行注释里的 22×22 改成 24。366 行是 `position: relative`，不要改。398–400 行 wrapper 改为画环。404–407 行内钮保持 `outline: none`。
- **不变量：** Inbox、session title（160–166 行）、select（678–684 行）已有环，不改。高对比度 HC 规则不删。
- **验收（C2）：** 透镜 tab（含 `[aria-selected="true"]`）、session bar、session-controls、window-nav 的 `:focus-visible` 规则体含 `var(--vscode-focusBorder)`，且该规则排在对应 `outline: none !important` 之后。`.monaco-inputbox.synthetic-focus` 不再是 `outline: none`。
- **测试：**
  - `src/vs/workbench/contrib/conversation/test/node/conversationLensCssScan.test.ts` 新增 `lens tab and session bar button keep a focus-visible focusBorder ring`（已有 `collectCssRules`）。断言 181–185 行那组选择器、以及 `[aria-selected="true"]:focus-visible` 也有后写的环。
  - 新增 `src/vs/sessions/test/node/sessionsFocusRingScan.test.ts`，用例 `sessions inputs titlebar and send button keep focus-visible rings`。断言 `synthetic-focus` 画环，发送钮 `min-width` 为 `24px`。
- **命令：** `scripts/test.sh --grep "focus-visible focusBorder ring|sessions inputs titlebar"`。
- **非目标：** 不扫 Minor 里其余 `outline: none`。不改 conversation composer 的 28px 发送钮（`conversationLensCssScan.test.ts` 已有 `28px send control`）。
- **风险：** `!important` 漏写会被 workbench 钮样式盖掉。回滚单文件 CSS。

### S-C 配对框

- **目标：** 主进程 SAS / recover 框挂到当前 `BrowserWindow`，用户能看见并点 Verified on Engine。
- **文件：** `src/vs/platform/universeAgent/electron-main/universeAgentMainService.ts` 50–58 行。`IWindowsMainService.getFocusedWindow` / `getLastActiveWindow` 在 `windows.ts` 53–54 行。`ICodeWindow.win` 在 `window.ts` 27 行。`dialogMainService.showMessageBox(options, window?)` 在 `dialogMainService.ts` 150–158 行。
- **挂载点（已核）：** `connectionPreferencesPane.ts` 的 `pairingConfirmHost` 在 422、744–746 行创建并 `display: none`，1000–1005 行会滚动并聚焦已有按钮。`connectProfileWithPairing`（1690–1720 行）只 `await confirmPairing()`。`promptSasConfirmInPane` 生产无调用。`promptSasConfirmDialog` 只在 `connectionPreferencesPaneSas.ts` 168 行定义，生产调用为 0。`confirmPairing`（`universeAgentConnectionService.ts` 1209–1231 行）内部 `confirmSas` → `confirmPairingSasWithMainDialog` → `askPairingMainDialog`（500–508 行）。无 dialog 时返回 false。
- **改法：** 构造函数注入 `IWindowsMainService`。`showMessageBox` 第二参为当前窗：`const codeWindow = windows.getFocusedWindow() ?? windows.getLastActiveWindow(); const win = codeWindow?.win; dialogMainService.showMessageBox(options, win && !win.isDestroyed() ? win : undefined)`。第一参字段保持今日的 type / message / detail / buttons / defaultId / cancelId。桌面 renderer 的 `confirmPairing` 走 channel client（`universeAgentConnectionChannelClient.ts` 107–109 行）到该 main 服务；browser stub（`browser/universeAgentConnectionService.ts` 154–156 行）仍是 `WEB_UNSUPPORTED`，不改。
- **不变量：** 不调用 `promptSasConfirmInPane`。不把 `confirmSas` 改成恒 true。页内宿主保持 `display: none`，除非已有活对话框（今日没有生产路径会点亮它）。`connectionPreferencesPane.test.ts` 里 `assertNoInPanePairingDialog` 的用例保持，尤其 `pairing confirm completes inside Preferences modal block` 与 `connectProfileWithPairing writes diagnostics before pairing prompt resolves`。
- **验收（C3）：** 源码里 `dialogMainService.showMessageBox` 带第二参。活窗验收属于 prd-008-engine-e2e，不在本切片宣称 PASS，也不升 PRD-008。
- **测试：** 新增 `src/vs/platform/universeAgent/test/node/universeAgentMainDialogWindowScan.test.ts`，用例 `pairing showMessageBox passes the focused or last active window`。用与 `universeAgentLeftoverCatchScan.test.ts` 相同的 `readFileSync`。
- **命令：** `scripts/test.sh --grep "pairing showMessageBox passes"`；pane 回归 `scripts/test.sh --grep "pairing confirm completes inside Preferences modal block"`。`run-unit-custom.sh` 把不在 17–32 行名单里的 `test/node` 放进 Electron 的 `UA_FILES`（66–76 行），`universeAgentNode` 只跑名单内文件（115–116 行）。本扫描走 Electron 的 universeAgent 收集，不写进 universeAgentNode。
- **非目标：** 不改 `pairingOrchestrator.ts` 的 S1–S7。不改 pane 的 Connect 顺序。
- **风险：** 焦点窗与最后活动窗都没有时，第二参为 `undefined`，行为与今日无窗队列相同。回滚只还原 main service。

### S-D Conversation 诚实态

四个文件组互不重叠，可分人，合入顺序随意。

| 缺口 | 改法 | 测试 |
|------|------|------|
| I1 | `conversationVisualizeCard.ts` 51 行失败标题、75–83 行无 title 时的 `Stub: diagram` / `Stub: comparison` 改为 Diagram / Comparison / Error。有 title 时仍用 title | `conversationVisualizeCard.test.ts` 的 `collapsing the header hides card body` 今日断言 `Visualize · Stub: diagram`（195 行），改成新文案。`invalid payload renders in-card error without throwing` 断言错误卡不含 `Stub: error` |
| I2 | `conversationQuestionSeat.ts` 80–82 行：`!canSubmit` 且无 `payload` 时不要直接 return。画「无法作答」，正文继续用已有 `options.message` | `conversationQuestionSeat.test.ts` 新增 `invalid answer keys and no payload show an honest empty state` |
| I4 | `sessionsPolicyBlocked.ts` 不要 `overlay.focus()`。有可操作控件时聚焦 card 内第一个 `button` / `a[href]` / `[role="button"]`（Monaco Button 是无 href 的 `a[role=button]`）。Loading 无此类控件时给 card `tabIndex=0` 并聚焦 card。67–73 行「目标不在 card 则 preventDefault」保留。**已落。** | `sessionsPolicyBlocked.test.ts`：`initial focus is inside the card`（AccountPolicyGate）与 `loading focus is the card` |
| I5 | `sessionInputBanners.ts` 无 widget 时除日志外 `INotificationService.error`。等待聊天模型超时（按钮实际走的路径）同样通知，避免 `_fixChecks` 根本没被调用。`agentFeedbackService.ts` `submitFeedback` 无 widget 同样。Changes 菜单 `FixCIChecksAction` 同一句。主按钮复原已在 `sessionInputBannerWidget.ts` 的 `finally`，保持。**已落。** 聊天 `acceptInput` 结束时仍未调用 `onRequestAccepted`，或发送抛错：再报一句，评论保持 Accepted。已经 `onRequestAccepted` 的排队成功不报这句。 | `sessionInputBanners.test.ts`：`fix CI without a widget notifies`、`fix CI while the chat model never loads notifies`。`agentFeedbackService.test.ts`：`submitFeedback without a widget notifies and returns false`、`keeps feedback accepted when the request is not accepted by the widget`、`submitFeedback notifies when sending the request throws`。`checksActions.test.ts`：`fix CI command notifies when the chat widget is missing` |

- **不变量：** 答案 key 有效时提问座位行为不动。焦点已在 card 内时不新做一整圈 trap。D85 promote 不碰。
- **命令：** `scripts/test.sh --grep "honest empty state|Stub: diagram|initial focus is inside the card|without a widget notifies"`。
- **非目标：** 不改 sideChat pill（I3）。
- **风险：** Loading 的 card `tabIndex` 若漏设，焦点仍会停在被吞键的 overlay。回滚按上表文件。

### S-E GitHub 预览

- **目标：** GitHub 树被 API 截断时，Add Context 能看见「未列全」。
- **文件：** `githubFileSystemProvider.ts` 42–46、200–237 行。消费步行在 `newChatContextAttachments.ts` 321 行。`fileTreeView.contribution.ts` 13–14、32–36 行只注册 FS。
- **I7 不改能力位：** 80–83 行已是 `Readonly | FileReadWrite | PathCaseSensitive`。`filesConfigurationService.ts` 213–214 行对带 Readonly 的 provider 直接 `isReadonly`。`writeFile` 328–329 行已抛 `NoPermissions`。`fileService.ts` 159–166 行的 `withReadProvider` 在没有 `FileReadWrite` / `FileReadStream` / `FileOpenReadWriteClose` 时抛错，`readFile` 走这条。去掉 `FileReadWrite` 会让打开文件失败，树还在、内容读不出。编辑器只读今天已经成立。
- **改法：** capabilities 三件套不动。`ITreeCacheEntry` 记下 `truncated`。导出查询函数。`_collectFilePicksViaFileService` 在 `truncated` 时追加一条不可选的「未列全」。
- **I10 取舍：** 不注册 auxiliary Files 视图。Sources Files 已是 [sources-architecture](sources-architecture.md) P4 的搜索投影。contribution 注释写明此取舍。
- **不变量：** 不改 P4 的 `fileSearch` / `limitHit`。不改 capabilities。不发明写 GitHub 的 RPC。
- **测试：** 目录无 `*.test.ts`。新增 `src/vs/sessions/contrib/fileTreeView/test/browser/githubFileSystemProvider.test.ts`，用例 `truncated tree is remembered` 与 `capabilities keep FileReadWrite beside Readonly`。picker 无对口测试时，只测查询函数；`_collectFilePicksViaFileService` 调用它。
- **命令：** `scripts/test.sh --grep "truncated tree is remembered|capabilities keep FileReadWrite"`。
- **非目标：** 不打开完整插件市场，不把截断树伪装成完整树。
- **风险：** 缓存多一个布尔，旧缓存条目在进程内重建即可。回滚缓存字段与 picker 那一条。

### S-F Sessions 壳

- **目标：** F6 / 焦点进入 Sessions Part 时落到当前会话视图。
- **文件：** `src/vs/sessions/browser/workbench.ts` 2035–2037 行。`ISessionsPartService.focusSession(session: IActiveSession | undefined)` 在 `src/vs/sessions/services/sessions/browser/sessionsPartService.ts` 59 行（**browser，不是 common**）。转发：`src/vs/sessions/browser/parts/sessionsParts.ts` 68–70 行把 `session?.sessionId` 交给 `src/vs/sessions/browser/parts/sessionsPart.ts` 289–295 行，再 `src/vs/sessions/browser/parts/sessionView.ts` 272–274 行 `focus()`。同文件已有调用点 980、2579 行：`this.sessionsPartService.focusSession(this.sessionsService.activeSession.get())`。
- **改法：** `Parts.SESSIONS_PART` 分支复用上述调用。`focusSession` 在无 slot 时是 no-op（`sessionsPart.ts` 291–292 行）。无 slot 时再 `getContainer()?.focus()`。删掉 TODO。不要把 `IActiveSession` 传给 `sessionsPart.focusSession`（它要的是 `sessionId: string | undefined`）。
- **不变量：** 不改 `SessionView.focus` 的 standalone / groups 分支。无 slot 时仍聚焦容器。接口注释写 chat input，实现是 `view.focus()`；本稿不扩写焦点链。
- **I16：** `screenshots/` 与 `tactile_*` / `live_*` 不是键盘、axe 或 Web 证据。`live_workbench_batch85.png` 体量约 4.6KB，不能当通过。D17 仍 open。本切片不关 PRD-018，不删截图。
- **测试：** 新增 `src/vs/sessions/test/node/sessionsFocusPartScan.test.ts`，用例 `SESSIONS_PART focus delegates to focusSession when a view exists`。`sessionView.test.ts` 无 focus 用例，不改。
- **命令：** `scripts/test.sh --grep "SESSIONS_PART focus delegates"`。
- **非目标：** I17 发行标识不在本稿。
- **风险：** `focusSession(undefined)` 会聚焦 placeholder 槽。新会话因此进 placeholder，而不是空容器。这是接口既有语义，与 980 行一致。回滚该 case。

### S-G1 Customizations

- **目标：** Sessions 左 nav 与默认窗五节一致，去掉 Copilot 营销文案与 `~/.copilot` 强制覆盖。
- **文件：**
  - Sessions：`aiCustomizationWorkspaceService.ts` 97–107、111–113 行。今日含 Plugins / Tools / Automations / HarnessSettings，`showGettingStartedBanner: true`
  - Donor 五节（只读对照，不改）：`workbench/contrib/chat/browser/aiCustomization/aiCustomizationWorkspaceService.ts` 49–55 行：Agents、Skills、Instructions、Hooks、McpServers；60 行 banner false
  - `configuration.contribution.ts` 41 行 `'chat.customizationsMenu.userStoragePath': '~/.copilot'`
  - `aiCustomizationListWidget.ts` 1024、1905 行（仅 `isDonorWindow === false` 分支）
  - 火花标题的渲染条件在 `aiCustomizationWelcomePagePromptLaunchers.ts` 189 行，flag 为 false 时不进入。不改该文件
- **改法：** Sessions `managementSections` 改成与 donor 相同的五个枚举，顺序一致。`showGettingStartedBanner: false`。删 `userStoragePath` 那一行。同对象里 `github.copilot.chat.claudeCode.enabled` 保留。两处 Copilot 英文改为不点名 Copilot 的技能 / 说明空态。
- **不变量：** 不改 donor 服务。不重开 `ua.customizations` pane（[settings-two-surfaces](settings-two-surfaces.md)）。不删 `AICustomizationManagementSection` 枚举。
- **测试：** `aiCustomizationListWidget.test.ts` 新增 `sessions skills and instructions copy does not say Copilot`。同文件用 `readFileSync` 断言 Sessions 数组为五节且 banner 为 false，并断言 `configuration.contribution.ts` 不含 `~/.copilot`、仍含 `claudeCode.enabled`。
- **命令：** `scripts/test.sh --grep "does not say Copilot"`。
- **非目标：** 不发明新的用户目录。扩展自身的默认路径不在本稿改。
- **风险：** 去掉 nav 后，旧命令仍可能打开 Plugins 等节。见开放问题。回滚三文件。

### S-G2 Engine 行

- **目标：** Triggers / Clipboard / Context Variables 的行可聚焦，读屏能读到现有标签。
- **文件：** `engineTriggersSection.ts` 319–327 行；`engineClipboardSection.ts` 288–296 行；`engineContextVariableSection.ts` 233–237 行。三处 `listHost` 已是 `role=list`（102、96、76 行）。十二节名单在 `enginePreferencesTypes.ts` 30–43 行，没有 History。History 文案在 `conversationLensSessionBarStrings.ts` 25 行。
- **改法：** 行设 `tabIndex=0`、`aria-selected`。标签用现有 `formatEngineTriggerListLabel` / `formatEngineClipboardListLabel` / `formatEngineContextVariableListLabel`。方向键移动 `.selected`，`preventDefault`。Enter 不调用 Fire / Write / Read。
- **不变量：** D311 / D314 / D316 的 pairingHold 写闸与「行仍在」不动。不把 History 加进十二节。
- **测试：** 在已有 `engineTriggersSection.test.ts`、`engineClipboardSection.test.ts`、`engineContextVariableSection.test.ts` 各加 `row is focusable and arrow keys do not fire`。既有 `leftover-looks-live` 用例保持。
- **命令：** `scripts/test.sh --grep "row is focusable and arrow keys"`。conversation 域可再跑 `scripts/run-unit-custom.sh` 里对应 glob。
- **非目标：** 不改列表的 unary 门。
- **风险：** `role=listitem` 加上 `tabIndex` 后读屏会把每一行当停靠点。回滚三节的 `paintList`。

### S-H 动效

- **目标：** Sessions 在 `prefers-reduced-motion: reduce` 时停掉已登记的动画，而不是给 71 个文件同时加 class。
- **现状（已数）：** 71 个 css 含 `@keyframes` / `animation:` / `transition:`；9 个已有 `prefers-reduced-motion`；`.ua-motion` 为 0。`sessionsList.css` 19 处，但 69–74 行的 pulse 已在 reduce 媒体查询里 `animation: none`。`chatInput.css` 16 处里，221–224 与 574–579 行的 `animation` 写在 `.monaco-enable-motion` 下；`accessibilityService.ts` 87 行在 reduce 时去掉该类。Sessions 不 import `ua-common.css`（`workbench.ts` 7–9 行 import `style.css`、`workbench.css`、`phoneLayout.css`）。`workbench.css` 366–374 行已有 reduce 媒体查询。
- **改法：**
  1. 在 `workbench.css` 该媒体查询内加 `.agent-sessions-workbench .ua-motion { transition: none; animation: none; }`。不改 S-B 的五份 CSS。
  2. 第一批：`chatWidget.css` 35、50 行 welcome fade 与 394 行 picker spin（无 reduce，也不在 `monaco-enable-motion` 下）。**必须在 DOM 上加 class**：`newChatInput.ts` 560 行创建 `.new-chat-input-container` 时加 `ua-motion`；picker slot（`branchPicker.ts` 146 行、`sessionTypePicker.ts` 363 行等）在 `loading` 时给 slot 加 `ua-motion`。只改 CSS 选择器、节点没有该类，则 `workbench.css` 的 reduce 规则匹配不到。不挂 `sessionsList.css`。
  3. 不再改 `chatInput.css`。它的动画已经被 `monaco-enable-motion` 关掉。
  4. 下一批只处理仍有裸 `animation:` / `@keyframes`、且不在 reduce 媒体查询或 `.monaco-enable-motion` 里的文件。跳过 `aquarium.css` 与已经盖住的 9 个文件。纯 hover 变色不挂。
- **理由：** 盲改 71 个文件会重复包装已停的动画，并和 S-B 抢 CSS。T1 要停的是还在跑的 shimmer / 位移。
- **不变量：** 不把 `.ua-motion` 挂到没有动画的 Engine / Connection 节点。不改 `conversationUaMotionContract.test.ts` 锁的 chevron。
- **测试：** 新增 `src/vs/sessions/test/node/sessionsReducedMotion.test.ts`，用例 `sessions workbench reduced-motion zeroes .ua-motion` 与 `chat widget animations hang .ua-motion`。断言 CSS 选择器带 `.ua-motion`，且 `newChatInput.ts` 创建节点时含该类。断言 `sessionsList.css` 与 `chatInput.css` 未被本批改成再包一层。
- **命令：** `scripts/test.sh --grep "sessions workbench reduced-motion|chat widget animations hang"`。
- **非目标：** 不要求 71 个文件同一 PR 挂完。
- **风险：** 媒体查询选择器漏了 `.agent-sessions-workbench` 前缀会影响到别的窗。回滚 `workbench.css` 与当批 css。

## 5. 顺序

S-A、S-B、S-C、S-D、S-E、S-F、S-G1、S-G2、S-H 可同时开工。S-H 不改 `chatInput.css`。S-C 不阻塞 prd-008 的 harness 起草，但活窗「框出现」的证据仍走那份方案，不在本稿收集。

## 6. 验证

每切片先 `scripts/test.sh --grep "<上表用例名>"`。改到的 ts 再 `npx eslint <路径>`。跨 `contrib/conversation` 或 `platform/universeAgent` 的切片可跑 `scripts/run-unit-custom.sh`（universeAgent 的 Electron 不可加载名单以该脚本为准）。文档合入前 `python3 scripts/check-docs-health.py`。编译用 `npm run compile`；只动浏览器 ts 时可按 copilot 说明先 `npm run compile-client`。

`npm run valid-layers-check` 在 D8 修好前不是合入门禁。失败的普通单测记 D17，不冻结其它切片，也不删测试。

## 7. 风险与不做

| 项 | 处置 |
|----|------|
| I3 sideChat pill | 不实施。D465 写的是先修订 §3.3b，此前不画 pill |
| I17 发行标识 | 不实施。`product.json` 28–30 行仍是开发期 id。第一次面向用户打包前由发布方填写。换 id 不迁 secret |
| U2、H6、完整插件市场、fixture 冒充 Engine、为全绿冻结 UI、引擎仓新增 RPC | 与 [status](../progress/status.md)「不做」一致，不进切片 |
| Minor | 提问 Submit 空选项已补：必填单选为空白时，Submit、自定义框 Enter、点选即提交都会写出 “Can't submit — a required choice is empty.”，不调用 `onRespond`；改到非空选项后提示消失。`writesEnabled: false` 仍不解释、不提交。其余不进切片：`branchChatSessionAction` 的 `when:false`、`aria-live` 空态、`applyChangesToParentRepo` 菜单恒 false、`changesView.ts` 82 行对 provider 的 eslint TODO、硬编码字号与色、65 处 `outline: none` 的其余文件 |
| 双确认 | S-C 若再挂页内 SAS，会在 `confirmSas` 之外再问一次，并打红 `assertNoInPanePairingDialog` |
| 回滚 | 按切片文件还原。不要为了回滚去改 D312 的 Sources 测试 |

## 8. 核验后的取舍

| 条目 | 结论 |
|------|------|
| C3「宿主从未挂上」 | 未按字面复现。宿主已在 744–746 行挂上且默认隐藏。生产 Connect 不填充它。方案改为只绑窗 |
| I9 欢迎句 | 复现，文案是 “Changed files and other session artifacts will appear here.”（824 行），不是发现稿的短句。失败分支在 changeset 的 `instanceof Error` |
| I7 | 建议改法不采纳。Readonly 已让编辑器只读；去掉 `FileReadWrite` 会让 `withReadProvider` 拒绝 `readFile`。capabilities 保持不动 |
| I10 | 复现「视图未注册、FS 已挂」。取舍为继续不注册，避免和第二套 Sources Files 并存 |
| I5「按钮复原」 | 复现的是无错误文案。复原逻辑已在 banner widget 的 `finally`，不是按钮卡住 |
| I15 | 复现。注释写 wrapper 画环，398–400 行实际 `outline: none` |
| I18 路径 | launcher 与 list widget 在 `workbench/contrib/chat/.../aiCustomization/`，不在 `sessions/contrib/chat`。`configuration.contribution.ts` 在 `sessions/contrib/configuration` |
| I6 | 复现。`focusSession` 最终调用 `SessionView.focus()`，不是发现稿字面上的「直接把焦点送进输入框」 |
| I13 计数 | 复现：71 / 9 / 0。`sessionsList.css` 与 `chatInput.css` 的动画多数已被 reduce 或 `monaco-enable-motion` 盖住，第一批改 `chatWidget.css` |
| I1–I2、I8、I11–I12、I14、I19 | 复现，锚点见 §4。I4 初始焦点已落。I11 的无连接 return 在 `agentHostSessionChangesets.ts` 358–359 行；`changesView.ts` 398–400 行是无 catch 的调用点 |
| I3、I17 | 不进切片，见 §7 |

## 9. 开放问题

1. 绑窗之后，若 Preferences 仍盖住原生框（例如 Wayland 上无父窗才失败、有父窗仍不可见），再单独立项改为页内确认，并改 `assertNoInPanePairingDialog`。本稿不预做。
2. 去掉 Sessions 的 `userStoragePath` 覆盖后，扩展默认是否仍是 `~/.copilot`。本稿不新设目录。
3. 左 nav 去掉 Plugins / Automations 等之后，已有命令是否仍能打开这些节。
4. `focusSession` 是否需要再走进聊天输入。今日停在 `SessionView.focus()`。
5. `git.sync` 的 Action 失败是否已有工作台级通知。若已有，S-A 只保留一处通知，避免双弹。

只读审查已改入（Grok 起草 + 父代理 2026-10-01 核验）：S-E 保留 `FileReadWrite`；S-B 补 181–185、选中 tab 91–97、Inbox 同款 `!important`；S-A 写明 pairingHold 源是 `IUniverseAgentConnection` 不是 `IAgentConnection`；S-F 路径改为 `sessionsPartService` 的 browser 实现，调用对齐 980/2579；S-H 必须在 DOM 挂 `.ua-motion`；S-C 绑窗并跳过 `isDestroyed()`，桌面走 channel client。状态仍是 `draft`。
