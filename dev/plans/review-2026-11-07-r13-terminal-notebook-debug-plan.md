---
title: "十六路审查 2026-11-07 r13：终端、笔记本、调试与测试方案"
type: plan
status: accepted
phase: N/A
updated: 2026-11-07
summary: "hold 1、weaken 1、drop 1；隐藏聊天终端入口持焦时被隐藏或随标签树移出（含关掉标签与鼠标移开），把焦点交给标签列表或活动终端；终端与调试样式表里仓库自加的过渡收到 100ms 以内，并在减弱动效下关闭。2026-11-07 已经规则 16 只读审查并改稿；同日已实施（未编译、未跑测试），代码审查可接受。"
---

# 十六路审查 2026-11-07 r13：终端、笔记本、调试与测试方案

状态：执行中。负责：agent:opus。
签收：签。签收人：agent:opus，依据用户 2026-11-07 在会话中说的「需要的做一下 不编译」，日期：2026-11-07。
覆盖需求：无（两条都修上游配套设施：终端标签栏里隐藏聊天终端入口的焦点交还，以及终端与调试样式表在减弱动效下的过渡。产品需求里键盘可达那一条只要求四钮键位、F6 区域循环和 Conversation 内的焦点，见 `docs/product/requirements.md` 298–311 行；视觉语言那一条只约束产品自有表面，并写明文件管理器与代码编辑器保留上游原样，见 470–502 行，尤其 486、491 行。两条都没有覆盖终端标签栏和调试视图，也没有关于减弱动效的验收）。

只改 r13-1 与 r13-3 两条。r13-1 停在 `TerminalTabbedView` 里会让入口隐藏或脱离的刷新路径和它的浏览器测试；r13-3 停在仓库 2026-09-28 两次提交（`07671981dd61`、`a854de8c4ae6`）在 terminal、terminalContrib、debug 样式表里加的 34 条过渡规则，以及两份新的 node 样式测试。笔记本、交互窗口与测试视图样式表里同源的过渡不在本稿，去处见「实施前提与步骤」第 5 步。

核对对象是 [发现稿](review-2026-11-07-r13-terminal-notebook-debug.md)，基准是 HEAD `841ea38816d` 加上工作区的未提交改动。七个范围目录（terminal、terminalContrib、notebook、interactive、replNotebook、debug、testing）都没有未提交改动，审查之后重新核对时仍然如此。`docs/architecture/cross-cutting/ui-design-principles.md` 有别人的未提交改动，只改了 frontmatter 的 `updated` 和 §10 表格里的一行，不碰第 128 行的过渡约定；`docs/product/requirements.md` 与 `dev/plans/INDEX.md` 后来也出现了别人的未提交改动，前者不改上面引用的行号，后者见实施步骤第 4 步。发现稿所引行号都与工作区一致。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r13-1 | weaken | 中→低 | 行为成立。垃圾桶的键盘处理（`terminalTabsChatEntry.ts` 86–93）经 `_deleteAllHiddenTerminals`（99–121）逐个 `safeDisposeTerminal`。`terminalChatService.ts` 135–141 在终端销毁时删掉工具会话映射并更新「有隐藏聊天终端」上下文键，标签视图的监听（`terminalTabbedView.ts` 140–155）随即刷新，`update()`（127–137）把入口设成 `display: none`；标签树因 `_shouldShowTabs()` 转假被移出分栏时（200–215），入口还会随标签容器一起脱离 DOM。配置监听（125–139）和 `mouseleave`（377–381）把标签树移出时也是这样。这几处都不交还焦点。测试、`docs/` 和已签收方案都没有把这一行为定为预期；2026-10-06 r13 方案的 r13-2 只管入口显隐后的重排，r13-3 只管 `TerminalGroup._removeInstance` 抢焦点，都不承接本条。降级理由是可达性。入口只在有隐藏聊天终端时显示，往工具会话表登记终端的只有三处，都由上游聊天驱动：`RunInTerminalTool._initTerminal`（`runInTerminalTool.ts` 2762、2781，终端由 `toolTerminalCreator.ts` 211 以 `hideFromUser: true` 创建）；Agent Host 的 `_doReviveTerminal`（`agentHostTerminalService.ts` 397、409）；`TerminalChatService._tryAdoptRestoredMapping`（`terminalChatService.ts` 354–375）按工作区存储里的旧映射认领重连的终端，它只在 `getTerminalInstanceByToolSessionId`（164–189）里被调用，调用方只有上游聊天的 `ChatTerminalToolProgressPart`（`chatTerminalToolProgressPart.ts` 660、673、1081、1216）。产品的 Conversation 与引擎终端都不登记，`contrib/conversation` 不引用 `ITerminalChatService`，也不渲染这个进度部件。默认编辑器窗口里的 Chat 视图只作对照，不是产品对话（`docs/product/requirements.md` 98 行；INV-NO-COPILOT 见 `dev/decisions/006-shell-invariants.md` 40 行）。入口点开的 View Hidden Chat Terminals 也只在 Agents 窗口启用（`terminalChatActions.ts` 39、344，测试 `default Code window hides Terminal Inline Chat from Command Palette and context menu`）。入口本身没有窗口门闩，所以对照用的 Chat 在默认窗口跑过终端工具之后，这条路径仍能走到。 |
| r13-2 | drop | 低 | 不成立。代数逻辑与稿中引文一致（`cellComments.ts` 43–51、96–107、124–133、184–192），但「读取还在进行时开关底部面板」这个触发走不到。`_updateThread` 的读取是 `CommentService.getNotebookComments`（`commentService.ts` 499–510），它只把各控制器的结果交给 `Promise.all`；唯一的实现 `MainThreadCommentController.getNotebookComments`（`mainThreadComments.ts` 246、482–506）在主线程扫已缓存的线程表，没有 `await`，也不发扩展主机请求。建部件时，`CommentThreadWidget.display` 与 `updateCommentThread`（`commentThreadWidget.ts` 204–245）只在评论处于编辑模式时多等一次评论编辑器模型（`commentThreadBody.ts` 113–118、233–243），解析它的 `CommentsInputContentProvider.provideTextContent`（`commentsInputContentProvider.ts` 49–52）是同步的。所以一次 `_updateThread` 在发起它的那个任务的微任务里就跑完了。开关面板或改窗口尺寸引起的行释放与重新分配是之后的任务，那时部件已经建好；`unrenderCell` 只加代数、清 `cellDisposables`（`cellComments.ts` 189–192，`cellPart.ts` 44–47），不销毁 `_commentThreadWidgets`，同一单元格回到同一行时部件还在。另外，笔记本单元格的评论线程要由扩展注册的评论控制器提供，产品内置的只有 Copilot 代码审查（`extensions/copilot/src/platform/review/vscode/reviewServiceImpl.ts` 31），默认窗口不把 Copilot 当产品入口。 |
| r13-3 | hold | 低 | 见下文。仓库 `1dc991f93c7` 的提交说明把 debug、terminal 列进「减弱动效下关闭过渡」，实际只给这两处补了 `:focus-visible`。terminal、terminalContrib、debug 的样式表里没有 `monaco-reduce-motion` 或 `prefers-reduced-motion`，只有 `terminal.css` 620 行上游拖放覆盖层挂在 `.monaco-enable-motion` 下；全局兜底 `productAccessibility.css` 78–114 只覆盖状态栏、Conversation、Sources 和设置编辑器。测试与文档都没有锁定这些过渡。终端面板的标签行、行内动作、单标签按钮、输出链接和命令装饰，以及按 F5 启动调试后的工具条、悬停、断点部件与异常部件，在默认编辑器窗口可达（`product.json` 57 行内置 js-debug，F5 键位 `debugCommands.ts` 768–772 没有窗口门闩）。Debug Console 只在 Agents 窗口启用（`debug.contribution.ts` 436、456，测试 `Debug Console panel is gated to Agents Window`），Run and Debug 视图要打开 `workbench.activityBar.visibleViewlets.debug`（测试 `Run and Debug sidebar views respect optional Activity setting`），隐藏聊天终端入口的可达性同 r13-1；这几处随同一批样式表一起改，不单独作产品验收。另有 5 条同源规则发现稿没有列，一并纳入。 |

### r13-1

问题类：隐藏聊天终端入口在自己持有键盘焦点时被隐藏，或随标签树一起移出 DOM（隐藏终端清空、关掉标签或改 `hideCondition`、鼠标移开后暂留的标签树被移走），焦点没有交出去，落到页面 body 上。

不变量：

- 一次外层刷新开始时，焦点在入口内（入口本身或垃圾桶按钮），入口可见并且在文档里；刷新结束时入口变成 `display: none` 或已不在文档里。这时焦点交给标签列表（`_shouldShowTabs()` 仍为真时）或组服务的活动终端（`_shouldShowTabs()` 为假且有活动终端时），不留在 body。
- 外层刷新包括：实例、分组、工具会话与「有隐藏聊天终端」上下文键的三组监听；配置监听里 `TabsEnabled` 与 `TabsHideCondition` 那一支；`mouseleave`；以及单独被调用时经 `_updateHasText` 走到的入口更新。
- 刷新开始时焦点不在入口内，这次刷新不调用任何聚焦方法，不从编辑器、对话或其他视图抢焦点。
- 刷新之后入口仍然可见并在文档里（还剩隐藏终端，比如 `confirmOnKill` 否决了其中一个；或者鼠标还停在标签上，标签树暂留），焦点留在原处。
- 一次外层刷新至多交还一次。由它带起的内层调用（`_updateChatTerminalsEntry` 引起的 `layout()` 重入、`_addTabTree()` 触发的分栏布局回调）不交还。
- 既没有要显示的标签树、也没有活动终端时，不移动焦点，也不为了接焦点新建终端。
- 鼠标点击垃圾桶时按钮同样先拿到焦点，走同一条交还路径。

要动的符号：`TerminalTabbedView` 构造函数里的配置监听（125–139，只动 125–128 的 `TabsEnabled` / `TabsHideCondition` 分支）和三组监听（140–143 组服务的 `onDidChangeInstances` 与 `onDidChangeGroups`，145–148 工具会话注册与终端服务的实例变化、实例销毁，150–155 `ChatHasHiddenTerminals` 上下文键）、`_attachEventListeners` 里的 `mouseleave`（377–381）、`_updateHasText`（352–360，359 行调 `_updateChatTerminalsEntry`）、`_updateChatTerminalsEntry`（217–222）、`focusTabs`（614–624）、`_focus`（662–664）。新增一个私有的守卫方法和它用的嵌套层数字段、一个私有的统一刷新方法、一个私有的交还焦点方法。文件：`src/vs/workbench/contrib/terminal/browser/terminalTabbedView.ts`。`TerminalTabsChatEntry` 不改。

改法：

1. 新增私有守卫方法，接收一段要执行的刷新。它维护嵌套层数：层数为 0 的那次是外层，进入时记下两件事，一是焦点是否在入口内（`dom.isAncestorOfActiveElement(this._chatEntry.element)`），二是入口是否可见且在文档里（`isConnected` 为真，`style.display` 不是 `none`）；然后执行刷新；退出时如果原先持焦、原先可见，而现在入口不可见或已脱离，调用交还焦点方法。层数大于 0 的内层调用只执行刷新，不记录、不交还。层数在 `finally` 里减回，刷新抛错也不会卡住。记录必须在刷新开始之前做：`_refreshShowTabs()` 可能把整个标签容器移出分栏，移出之后再查，焦点已经不在入口里了。
2. 三组监听里相同的两句 `_refreshShowTabs()`、`_updateChatTerminalsEntry()` 收进一个私有的统一刷新方法，方法体整个交给守卫执行。配置监听的 `TabsEnabled` / `TabsHideCondition` 分支和 `mouseleave` 原来只调 `_refreshShowTabs()`，改为把这一句交给守卫执行，不额外加 `_updateChatTerminalsEntry()`；`mouseleave` 仍先把 `tabsMouse` 上下文键置假，最后 `stopPropagation`。`_updateHasText` 对 `_updateChatTerminalsEntry()` 的调用也交给守卫执行：它在 `layout()` 或分栏布局回调里被外层刷新带起时是内层，被 `layout`、`rerenderTabs` 或分栏布局回调单独调用时是外层。
3. 交还焦点方法按顺序选目标：`_shouldShowTabs()` 为真时调用 `focusTabs()`，它会置标签焦点上下文键、`_tabList.domFocus()`，并把列表焦点设到当前选择；否则组服务有 `activeInstance` 时调用 `_focus()`；两者都不满足就直接返回。标签被关掉（`tabs.enabled` 为假）时 `_shouldShowTabs()` 为假，焦点交给活动终端。标签树只因鼠标停在上面暂时留下（`_refreshShowTabs` 209 行的鼠标条件）而 `_shouldShowTabs()` 已为假时，按不显示处理，把焦点交给活动终端，免得随后的 `mouseleave` 把标签树连同焦点一起移掉。不要调用 `TerminalViewPane.focus()`，它在没有终端时会新建一个（`terminalView.ts` 334–342）。
4. 交还只在入口隐藏或脱离的那次外层刷新里做一次。之后入口重新出现，不把焦点拉回入口。

明确不改什么：

- `TerminalTabsChatEntry` 的点击与键盘处理、`_deleteAllHiddenTerminals`（遥测、`safeDisposeTerminal`、`Promise.all`）、`update()` 的显隐规则和返回值。打开隐藏终端的 `executeCommand` 单级 catch 链保持原样，测试 `tabs chat entry executeCommand leftover void is single-catch` 与 `tabbed view _handleContainerDrop leftover void is single-catch` 继续通过。
- `_refreshShowTabs` 的显隐规则和鼠标停留条件；`mouseleave` 与 `mouseenter` 对 `tabsMouse` 上下文键的设置和 `stopPropagation`；配置监听里 `TabsLocation` 换边那一支；右键菜单的 Move Tabs、Hide Tabs 动作（`_getTabActions`，591–605）。
- 构造函数末尾那次 `_updateChatTerminalsEntry()`（169 行）不经守卫，建视图时入口不可能持焦；`dispose()` 清空并移除标签容器（512–523）也不经守卫，视图销毁时不交还焦点。
- 显隐变化后的重排，测试 `should adjust tabList layout height when chat entry visibility changes and preserve panel height`；宽窄分界，测试 `should unify has-text and hasText at MidpointViewWidth (63) and snap in _updateListWidth` 与 `layout width >= 63 sets hasText=true, < 63 sets hasText=false`。这几条用例的 `parent` 不挂进文档，入口的 `isConnected` 为假，守卫不会交还。
- `terminal.css` 里垃圾桶的 `:focus-within` 显示和 `:focus-visible` 样式，测试 `ordinary delete focus uses toolbar hover feedback while HC keeps a contrast ring` 与 `ordinary entry focus uses toolbar hover feedback while HC keeps a contrast ring`。
- View Hidden Chat Terminals 的窗口门闩，测试 `default Code window hides Terminal Inline Chat from Command Palette and context menu`。
- `TerminalGroup._removeInstance` 的聚焦，那是 2026-10-06 r13 方案 r13-3 的范围。

本地验证：

- 在 `src/vs/workbench/contrib/terminal/test/browser/terminalTabbedView.test.ts` 的 `TerminalTabbedView` 套件新增五条。`setupTabbedView` 加一个可选的 `hideCondition` 参数，并把平台配置服务的测试桩（`TestConfigurationService`）一起返回。新用例把 `parent`（以及第三条的 `input`）挂到 `document.body` 上，否则元素拿不到焦点；挂上之后立刻用 `store.add(toDisposable(...))` 登记移除，断言失败时也会清理。`activeInstance` 用只给 `focusWhenReady` 计数的桩，不持有可销毁资源。组服务的 `instances` 保持为空：标签列表渲染的是 `instances`，放进桩实例会让列表去读桩上没有的字段。
- 第一条：`hideCondition: 'never'`，`layout(300, 500)` 之后让 `hiddenInstances` 含一个实例并调用 `fireRegisterInstance`，聚焦入口里的 `.terminal-tabs-chat-entry-delete`，再清空 `hiddenInstances` 并调用 `fireDisposeInstance`。断言入口的 `display` 为 `none`，`document.activeElement` 在 `_tabList.getHTMLElement()` 之内，不是 `document.body`。
- 第二条：`hideCondition: 'singleTerminal'`，`activeInstance` 设为计数桩，同样先 `layout(300, 500)`，让入口隐藏时经 `layout()` 重入，其余步骤同第一条。断言标签树已移出分栏（`_splitView.length` 为 1），`focusWhenReady` 恰好被调用一次。
- 第三条：`hideCondition: 'never'`，`activeInstance` 设为计数桩；先聚焦挂在 body 上的一个 `input`，再让入口出现、消失。断言焦点仍在这个 `input` 上，`focusWhenReady` 没有被调用，`_tabList.getHTMLElement()` 之内没有焦点。
- 第四条（关掉标签）：`hideCondition: 'never'`，`activeInstance` 设为计数桩，入口出现后聚焦入口本身；用 `setConfig` 把 `tabs.enabled` 改为假，再用平台配置测试桩的 `onDidChangeConfigurationEmitter` 发一个只对 `TerminalSettingId.TabsEnabled` 返回真的变化事件。断言标签树已移出分栏，入口的 `isConnected` 为假，`focusWhenReady` 恰好被调用一次。
- 第五条（鼠标移开）：同第四条，但改配置之前先在 `_tabContainer` 上派发 `mouseenter`。改配置之后断言标签树仍在、焦点仍在入口上、`focusWhenReady` 没有被调用；再派发 `mouseleave`，断言标签树已移出分栏，`focusWhenReady` 恰好被调用一次。
- 先编译，再用 `scripts/test.sh --run src/vs/workbench/contrib/terminal/test/browser/terminalTabbedView.test.ts --run src/vs/workbench/contrib/terminal/test/node/terminalLeftoverPromiseCatchScan.test.ts --run src/vs/workbench/contrib/terminal/test/node/terminalTabsChatEntryCss.test.ts --run src/vs/workbench/contrib/terminal/test/node/terminalTabsChatEntryFocusCss.test.ts --run src/vs/workbench/contrib/terminalContrib/chat/test/browser/terminalChatActions.test.ts` 跑新用例和上面列出的既有用例，最后跑 `npm run eslint`。完整顺序见「实施前提与步骤」第 3 步。

### r13-3

问题类：仓库 2026-09-28 两次提交在 terminal、terminalContrib、debug 样式表里加的按压与悬停过渡，不随 `workbench.reduceMotion` 和系统减弱动效关闭，其中 120ms 的还超出 100ms 上限。

不变量：

- 工作台根上有 `.monaco-reduce-motion` 时，下面 34 条规则命中的元素 `transition` 为 `none`。
- 系统 `prefers-reduced-motion: reduce` 生效且根上没有 `.monaco-enable-motion` 时，同样为 `none`；用户把 `workbench.reduceMotion` 设为 `off`（根上是 `.monaco-enable-motion`）时，媒体查询不覆盖。
- 这 34 条规则的基础过渡时长不超过 100ms，过渡属性仍只有现在的 `background-color` 或 `opacity`。
- `:active` 底色、普通主题与高对比主题的 `:focus-visible` 规则都不变。

要动的文件与规则（行号是现在 `transition` 所在的行）：

- `src/vs/workbench/contrib/terminal/browser/media/terminal.css`：146 `.monaco-workbench .terminal-editor .xterm a:not(.xterm-invalid-link)` 与 `.monaco-workbench .pane-body.integrated-terminal .xterm a:not(.xterm-invalid-link)`（80ms）；369 `.monaco-workbench .pane-body.integrated-terminal .terminal-tabs-chat-entry`（120ms）；435 `.monaco-workbench .pane-body.integrated-terminal .terminal-tabs-chat-entry .terminal-tabs-chat-entry-delete`（透明度与底色各 120ms）；474 `.monaco-workbench .pane-body.integrated-terminal .tabs-list .monaco-list-row`（120ms）；535 `.monaco-workbench .pane-body.integrated-terminal .tabs-list .actions .action-label`（120ms）；563 `.monaco-action-bar .action-item .single-terminal-tab`（120ms）；637 `.monaco-workbench .terminal .terminal-command-decoration:not(.default)`（80ms）。
- 发现稿没有列、同属那两次提交的 5 条（路径相对 `src/vs/workbench/contrib/`）：`terminal/browser/media/xterm.css` 263 `.xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-scra`（80ms）；`terminal/browser/media/widgets.css` 37 `.monaco-workbench .terminal-env-var-info`（120ms）；`terminal/browser/media/terminalVoice.css` 29 `.terminal-voice.recording.codicon.codicon-mic-filled`（80ms）；`terminalContrib/stickyScroll/browser/media/stickyScroll.css` 49 `.terminal-sticky-scroll .hover-overlay`（120ms）；`terminalContrib/inlineHint/browser/media/terminalInitialHint.css` 41 `.monaco-workbench .terminal-initial-hint a`（80ms）。
- 调试一侧的八份样式表都在 `src/vs/workbench/contrib/debug/browser/media/` 下。`debugToolBar.css`：57 `.monaco-workbench .debug-toolbar .monaco-action-bar .action-item .action-label`（120ms）。
- `callStackWidget.css`：75 `.multiCallStackFrame .collapse-button a`、95 `.multiCallStackFrame .title[role="link"]`、115 `.monaco-editor .call-stack-go-to-file-link`（都是 120ms）。
- `breakpointWidget.css`：77 `.monaco-editor .zone-widget .zone-widget-container.breakpoint-widget .select-breakpoint-container .monaco-button`（120ms）。
- `exceptionWidget.css`：60 `.monaco-editor .zone-widget .zone-widget-container.exception-widget .title .actions .action-label`、80 `.monaco-editor .zone-widget .zone-widget-container.exception-widget .stack-trace a`（都是 120ms）。
- `debugHover.css`：78 `.monaco-editor .debug-hover-widget .debug-hover-tree .monaco-list-row`（120ms）。
- `debugViewlet.css`：55 `.monaco-workbench .part > .title > .title-actions .start-debug-action-item .codicon-debug-start`（120ms）；87 `.monaco-workbench .monaco-action-bar .start-debug-action-item .configuration .monaco-dropdown > .dropdown-label`（120ms）；170 `.debug-pane .debug-call-stack .thread`、`.session`、`.stack-frame` 三支（80ms）；222 `.debug-pane .monaco-list-row .monaco-action-bar .action-label`（120ms）；290 `.debug-pane .debug-call-stack .load-all` 与 `.show-more` 两支（120ms）；316 `.debug-pane .monaco-list-row .expression`（80ms）；387 `.debug-pane .debug-breakpoints .breakpoint`（80ms）；403 `.debug-pane .debug-breakpoints .breakpoint .monaco-custom-toggle`（80ms）。
- `debug.contribution.css`：8 `.codicon-debug-hint`（120ms）；81 `.monaco-editor .inline-breakpoint-widget`（80ms）；138 `.monaco-workbench .monaco-list-row .expression .value a.link.pointer`（80ms）。
- `repl.css`：22 `.monaco-workbench .repl .repl-tree .monaco-tl-contents`；38 `.monaco-workbench .repl .repl-tree .monaco-tl-contents .expression .lazy-button`；117 `.monaco-workbench .repl .repl-tree .output.expression.value-and-source .source` 与 `.monaco-workbench .repl .repl-tree .group .source` 两支（都是 80ms）。

改法：

1. 每条规则在同一文件里、紧跟它的基础规则之后加两条覆盖，形状与 `src/vs/workbench/browser/parts/sidebar/media/sidebarpart.css` 24–32 相同：一条是 `.monaco-workbench.monaco-reduce-motion <选择器> { transition: none; }`，一条写在 `@media (prefers-reduced-motion: reduce)` 里，是 `.monaco-workbench:not(.monaco-enable-motion) <选择器> { transition: none; }`。
2. 原选择器以 `.monaco-workbench` 开头的，把类并进这一节，写成 `.monaco-workbench.monaco-reduce-motion .pane-body…` 这种形状，不要在前面再加一个 `.monaco-workbench`，否则永远匹配不到；不以它开头的，在前面加 `.monaco-workbench.monaco-reduce-motion ` 或 `.monaco-workbench:not(.monaco-enable-motion) `。逗号分组的规则（`terminal.css` 141–142，`debugViewlet.css` 165–167、285–286，`repl.css` 101–102）每一支都要写。`debugToolBar.css` 48 行原文在 `.monaco-workbench` 后面有两个空格，覆盖规则按一个空格写。
3. 把 20 行里的 `0.12s` 改成 `100ms`：`terminal.css` 369、435（两处时长）、474、535、563，`widgets.css` 37，`stickyScroll.css` 49，`breakpointWidget.css` 77，`callStackWidget.css` 75、95、115，`debug.contribution.css` 8，`debugHover.css` 78，`debugToolBar.css` 57，`debugViewlet.css` 55、87、222、290，`exceptionWidget.css` 60、80。其余 14 条的 `0.08s` 不动。
4. 覆盖规则不加 `!important`，靠多出的类压过基础规则。不写全局通配，也不往 `productAccessibility.css` 的 `:where(...)` 名单里加面板或 `.monaco-editor`：那会把上游编辑器和面板里与本条无关的过渡一起改掉。这样做会扩大上游样式表的差异面：14 份上游样式表共加 34 条类覆盖和 34 条媒体查询覆盖，另改 20 行时长。它们都是那两次提交已经改过的文件，覆盖规则紧挨仓库自加的规则；理由是这些过渡本身是仓库加的，`ui-design-principles.md` 128 行要求减弱动效下去掉过渡，`1dc991f93c7` 也对这两个目录宣告过同一合同。这不算 ADR-007 意义上的最小上游改动。另一种写法是把过渡挪进 `.monaco-workbench.monaco-enable-motion <选择器>`（上游在 `terminal.css` 620–622 的写法），加的规则更少，但与 `1dc991f93c7` 在 `sidebarpart.css` 等处留下的覆盖写法和测试不一致，本稿不用。

明确不改什么：

- 上游自带的动效：`terminal.css` 620–622 的拖放覆盖层（已挂在 `.monaco-enable-motion` 下）、`xterm.css` 276 与 287 的滚动条淡出、`terminalResizeDimensionsOverlay.css` 19、`terminalVoice.css` 里的 `ani-terminal-speech` 动画。
- `:active` 底色和 `:focus-visible` 规则。下列套件里的既有用例继续通过：`Terminal tabs toolbar`、`Terminal tab actions`、`Single terminal tab`、`Terminal hidden chat entry chrome`、`Terminal hidden chat entry focus chrome`、`Debug toolbar`、`Debug tree actions`、`Debug start configuration`、`Debug call stack widget`、`Debug call stack collapse`、`Debug call stack file links`、`Breakpoint widget actions`、`Exception widget actions`、`Exception stack trace links`、`Debug expression links`、`Debug REPL lazy actions`、`Debug REPL source links`。
- `productAccessibility.css` 的全局兜底范围。
- 笔记本、交互窗口与测试视图里同两次提交加的 45 条过渡同样没有减弱动效覆盖：`testing/browser/media/testing.css` 13 条、`testing/browser/testResultsView/testResultsViewContent.css` 2 条、`interactive/browser/media/interactive.css` 1 条，其余 29 条分布在 `notebook/browser` 下 16 份样式表。发现稿没有列，本条不扩到它们，去处见「实施前提与步骤」第 5 步。

本地验证：

- 新增 `src/vs/workbench/contrib/terminal/test/node/terminalReducedMotionCss.test.ts`（终端一侧 12 条规则、六份文件）和 `src/vs/workbench/contrib/debug/test/node/debugReducedMotionCss.test.ts`（调试一侧 22 条规则、八份文件），逐条做下面四类断言。
- 基础规则的过渡逐条正向断言为改后的原文。改法 3 列出的 20 条是把 `0.12s` 换成 `100ms` 之后的原文，其中 `terminal.css` 435 行是 `transition: opacity 100ms ease, background-color 100ms ease;`，两个时长都要断言。其余 14 条断言 `0.08s` 原文不变：`terminal.css` 146、637，`xterm.css` 263，`terminalVoice.css` 29，`terminalInitialHint.css` 41，`debugViewlet.css` 170、316、387、403，`debug.contribution.css` 81、138，`repl.css` 22、38、117。另断言两侧共 14 份样式表都不再含 `0.12s`。
- 每条规则都有两条覆盖：`.monaco-workbench.monaco-reduce-motion <选择器>` 的规则体是 `transition: none`；`@media (prefers-reduced-motion: reduce)` 里 `.monaco-workbench:not(.monaco-enable-motion) <选择器>` 的规则体也是 `transition: none`。逗号分组的规则逐支断言：`terminal.css` 141–142 两支、`debugViewlet.css` 165–167 三支与 285–286 两支、`repl.css` 101–102 两支，每一支都要在两条覆盖里出现。
- 对应的按压规则仍在、声明不变：`terminal.css` 150–151（`opacity: 0.8`）、372、438、478、538、566、644，`xterm.css` 266，`widgets.css` 40，`terminalVoice.css` 32，`stickyScroll.css` 52，`terminalInitialHint.css` 45；`debugToolBar.css` 60，`callStackWidget.css` 78、98、118，`breakpointWidget.css` 80，`exceptionWidget.css` 63、83，`debugHover.css` 81，`debugViewlet.css` 58、90、173–175（`list.activeSelectionBackground`）、225、297–298、319、390、406，`debug.contribution.css` 11、84、142，`repl.css` 25、41、120–121。除注明的两处，其余都是 `toolbar.activeBackground` 底色。
- 上游动效不动：`terminal.css` 仍有 `.monaco-workbench.monaco-enable-motion .pane-body.integrated-terminal .terminal-drop-overlay` 及其原过渡，`xterm.css` 276、287 与 `terminalVoice.css` 的 `ani-terminal-speech` 原样保留。
- 先编译，再用 `scripts/test.sh --run src/vs/workbench/contrib/terminal/test/node/terminalReducedMotionCss.test.ts --run src/vs/workbench/contrib/debug/test/node/debugReducedMotionCss.test.ts` 跑新测试，用 `scripts/test.sh --runGlob "vs/workbench/contrib/{terminal,debug}/test/node/*Css.test.js"` 跑上面列出的既有样式测试，最后跑 `npm run eslint`。

## 实施前提与步骤

1. 实施前对照当时的 HEAD 重新定位。本稿行号取自 `841ea38816d` 加 2026-11-07 的工作区，别的会话还在改同一工作区，按符号与选择器定位，行号只作参考。
2. r13-1 与 r13-3 互不依赖，可以分开提交。每次只暂存本条改动的文件，不用 `git add -A`。
3. 本地验证顺序：先 `npm run compile`（只动 TypeScript 与 CSS 时可先用 `npm run compile-client`），因为 `scripts/test.sh --run` 加载的是 `out/` 下的编译产物；再跑各条列出的 `scripts/test.sh` 命令；再跑 `npm run eslint`；第 4、5 步改了文档，提交前再跑 `python3 scripts/check-docs-health.py` 和 `python3 scripts/wiki/wiki.py check --root .`。
4. 提交时把本稿登记进 `dev/plans/INDEX.md` 十六路审查方案那一段：链接、届时的状态、hold / weaken / drop 计数。该文件现在有别人的未提交改动，只暂存本稿这一行，不带上别人的改动。
5. 提交 r13-3 时，把笔记本、交互窗口与测试视图里那 45 条同源过渡登记进 `dev/progress/deferred-gaps.md`：编号在登记时按表取下一个；Gap 写文件与条数；Exit Condition 写按本稿 r13-3 的改法补齐覆盖规则、超过 100ms 的收到 100ms，并有对应的 node 样式测试。如果届时已有别的方案承接它们，就在那份方案里写明，不重复登记。
6. 提交前跑 `python3 scripts/wiki/wiki.py remind --root .`，按提示更新文档，或在提交说明最后一段写 `Docs-Reviewed:`。

## 审查

2026-11-07 只读审查的结论是须改稿（小改），没有 Critical。两条 Important 都属实，已改。r13-1：配置监听（125–128）和 `mouseleave`（377–381）原先只调 `_refreshShowTabs()`，绕开了统一刷新方法；入口在 `_tabContainer` 里，右键入口时若标签列表没有焦点项，菜单带 Hide Tabs（454–467、601–603），关掉标签会把标签树连同持焦的入口移出分栏（`SplitView.removeView` 销毁视图项时移除容器，`splitview.ts` 710、1130）。现在这两处也经同一个守卫，问题类、不变量、要动的符号、改法、明确不改什么都已调整，本地验证新增关掉标签和鼠标移开两条用例。r13-3：本地验证改为逐条正向断言 34 条基础规则的过渡原文（20 条 `100ms`，14 条 `0.08s`，`terminal.css` 435 行的两个时长都断言），并断言每条规则对应的按压规则仍在、声明不变。Minor 都已顺手改：守卫只在最外层交还，`layout()` 重入不会交两次，第二条用例断言只调用一次；浏览器测试改用 `--run`；逗号分组的每一支都写进断言；r13-1 的判定理由补上 `_tryAdoptRestoredMapping` 这第三条登记路径，它也只由上游聊天的 `ChatTerminalToolProgressPart` 驱动，判定和严重度不变；45 条同源过渡的去处写进实施步骤第 5 步；改法 4 删掉「与最小上游改动一致」的说法，如实写出差异面；新用例用套件的销毁存放清理挂到 body 上的节点。另按共性意见改了覆盖需求的理由和本地验证顺序（先编译，再跑测试，再跑 eslint，改了文档再跑 docs-health），并补了提交时登记 `dev/plans/INDEX.md` 的步骤。

## 实施记录（2026-11-07）

用户同意实施并要求不编译。本轮按本稿落了 r13-1 与 r13-3；r13-2 判定为 drop，不做。没有编译，没有跑 `scripts/test.sh`、`scripts/run-unit-custom.sh`、eslint 和 docs-health，新增和改动的测试都还没跑过。动手前重新核对过：HEAD 仍是 `841ea38816d`，要改的文件都没有别人的未提交改动，改动按符号和选择器定位。

r13-1，已实施：

- `src/vs/workbench/contrib/terminal/browser/terminalTabbedView.ts`：新增字段 `_chatEntryFocusGuardDepth`，新增私有方法 `_refreshTabsAndChatEntry`、`_runPreservingChatEntryFocus`、`_focusAfterChatEntryHidden`。三组实例、分组、工具会话与上下文键监听改调 `_refreshTabsAndChatEntry`；配置监听的 `TabsEnabled` / `TabsHideCondition` 分支、`mouseleave`，以及 `_updateHasText` 对入口的更新，都改为经守卫执行。构造函数末尾那次 `_updateChatTerminalsEntry()` 和 `dispose()` 没动，`TerminalTabsChatEntry` 没动。
- `src/vs/workbench/contrib/terminal/test/browser/terminalTabbedView.test.ts`：按本地验证新增五条用例：`moves focus to the tab list when the focused hidden chat entry hides`、`moves focus to the active terminal once when the focused hidden chat entry leaves with the tab tree`、`leaves focus alone when the hidden chat entry hides without holding focus`、`moves focus to the active terminal when disabling tabs detaches the focused hidden chat entry`、`moves focus to the active terminal on mouseleave after the pointer kept the disabled tab tree`。辅助函数有 `setTabsConfig`、`attachToDocument`、`stubActiveInstance`、`showHiddenChatEntry`、`hideHiddenChatEntry`、`disableTabs`、`focusDeleteButton`；挂到 body 上的节点都用 `store.add(toDisposable(...))` 登记移除。
- 与方案的出入：
  1. `setupTabbedView` 加了可选的 `hideCondition` 参数，但返回值仍是视图本身。平台配置测试桩改存在套件级变量 `configurationService` 里，与同一套件的 `terminalService`、`chatService`、`groupService` 写法一致，既有两条用例的调用不用改。
  2. 原先 `setConfig` 用 `as any` 的字面量，换成按 `ITerminalConfiguration['tabs']` 类型写的 `setTabsConfig`，取值不变。
  3. 关掉标签用的是字段齐全的 `IConfigurationChangeEvent`，只对 `terminal.integrated.tabs.enabled` 返回真。若对 `terminal.integrated` 也返回真，`TerminalConfigurationService` 会从空的测试配置重载，冲掉 `setConfig` 的取值。
  4. 第二条用例（`singleTerminal`）先让入口出现，再做第一次 `layout(300, 500)`，然后聚焦、隐藏。若先布局再出现，标签树会在 `SplitView.addView` 的布局回调里加进来；入口在回调里变成可见，经 `layout()` 调到 `resizeView`，而 SplitView 此时还处于 Busy，会抛 `Cant modify splitview`。这是 2026-10-06 重排修复（`_updateChatTerminalsEntry` 在显隐变化时调 `layout`）留下的既有问题，与本条无关，本稿不修。这条用例锁不住「只在最外层交还」：它隐藏时走的是脱离路径，`layout()` 经 `_updateHasText` 重入时入口已不在文档里，`wasShown` 为假，就算去掉 `_chatEntryFocusGuardDepth`，内层也不会再交还一次。只交还一次由 `wasShown` 这个前置条件和嵌套层数共同保证；层数防的是重入调用本身把入口隐藏的少见情形，目前没有用例单独锁它。
- 新发现，不在本稿范围：第 4 点的抛错在产品里同样会发生。默认 `hideCondition` 是 `singleTerminal`，只有一个终端、面板已经布局过时，第一个隐藏聊天终端登记就会走到这条路径。错误被事件分发捕获并记为未预期错误，`_refreshShowTabs` 的后半段（拖动条监听、按上次宽度调整、`rerenderTabs`）被跳过。可达性与 r13-1 相同，只经上游聊天的对照路径。建议另立条目。

r13-3，已实施：

- 14 份样式表按改法 1 到 3 改完：`terminal/browser/media/` 下的 `terminal.css`、`xterm.css`、`widgets.css`、`terminalVoice.css`，`terminalContrib/stickyScroll/browser/media/stickyScroll.css`，`terminalContrib/inlineHint/browser/media/terminalInitialHint.css`，以及 `debug/browser/media/` 下的 `debugToolBar.css`、`callStackWidget.css`、`breakpointWidget.css`、`exceptionWidget.css`、`debugHover.css`、`debugViewlet.css`、`debug.contribution.css`、`repl.css`（路径都相对 `src/vs/workbench/contrib/`）。34 条规则各加一条类覆盖和一条媒体查询覆盖，逗号分组每一支都写；20 行 `0.12s` 改为 `100ms`，14 条 `0.08s` 不动，这 14 份文件里不再有 `0.12s`。上游的拖放覆盖层、xterm 滚动条淡出、尺寸浮层和语音动画没动。
- 新增 `src/vs/workbench/contrib/terminal/test/node/terminalReducedMotionCss.test.ts`（套件 `Terminal reduced motion chrome`，四条用例）与 `src/vs/workbench/contrib/debug/test/node/debugReducedMotionCss.test.ts`（套件 `Debug reduced motion chrome`，三条用例），按本地验证的四类断言写。没有另起共享辅助模块，两份文件各带一份同样的小工具函数。
- 与方案的出入：无。因为不编译，实施后用一段不落盘的 Node 脚本，照测试里的正则逐条核对了 34 条规则、14 份文件和三处上游动效，全部对得上。这只是正则自检，不能代替测试运行。

没做的部分：

- r13-2 是 drop，不做。
- 实施步骤第 4、5 步要改的 `dev/plans/INDEX.md` 和 `dev/progress/deferred-gaps.md` 由父 agent 统一登记，本轮没改。
- 依赖：`dev/plans/INDEX.md` 与 `docs/product/requirements.md` 现有别人的未提交改动，提交时只暂存本主题的块。本轮改的生产代码、样式与测试不依赖别的会话先提交。

之后要跑的本地验证，按顺序：

1. `npm run compile`，或先用 `npm run compile-client`。
2. `scripts/test.sh --run src/vs/workbench/contrib/terminal/test/browser/terminalTabbedView.test.ts --run src/vs/workbench/contrib/terminal/test/node/terminalLeftoverPromiseCatchScan.test.ts --run src/vs/workbench/contrib/terminal/test/node/terminalTabsChatEntryCss.test.ts --run src/vs/workbench/contrib/terminal/test/node/terminalTabsChatEntryFocusCss.test.ts --run src/vs/workbench/contrib/terminalContrib/chat/test/browser/terminalChatActions.test.ts`
3. `scripts/test.sh --run src/vs/workbench/contrib/terminal/test/node/terminalReducedMotionCss.test.ts --run src/vs/workbench/contrib/debug/test/node/debugReducedMotionCss.test.ts`
4. `scripts/test.sh --runGlob "vs/workbench/contrib/{terminal,debug}/test/node/*Css.test.js"`
5. `npm run eslint`
6. 登记表改完后，提交前跑 `python3 scripts/check-docs-health.py` 和 `python3 scripts/wiki/wiki.py check --root .`。

代码审查（2026-11-07）：只读代码审查的结论是可接受，只有 Minor，处理如下。第一条，用例二锁不住「只在最外层交还」，属实：已改上面「与方案的出入」第 4 点的说法，如实写明只交还一次靠 `wasShown` 前置条件和层数共同保证，层数单独防的情形目前没有用例；代码不改。第二条，已补用例 `does not move focus when neither the tab tree nor an active terminal can take it`：`hideCondition` 为 `singleTerminal`，不设 `activeInstance`，入口持焦后隐藏，断言标签树已移出分栏、焦点停在 body 上；测试里的终端服务桩没有 `createTerminal`，若代码为接焦点去建终端会直接报错。`TerminalTabbedView` 套件的新增用例因此是六条。第三条，已放宽两份 node 测试的媒体查询断言：改为逐支检查，同一个 `@media (prefers-reduced-motion: reduce)` 块里可以有别的规则，选择器也可以与别的选择器并列，但匹配不会越过另一个 at-rule，也不会把只出现在后代选择器里的写法算进去。放宽后的正则仍用不落盘的 Node 脚本对 39 支选择器（34 条规则加逗号分组多出的 5 支）核对过，全部对得上；这同样只是正则自检，没有编译、没有跑测试。
