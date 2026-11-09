---
title: "十六路审查 2026-11-07 r13：终端、笔记本、调试与测试发现"
type: reference
status: draft
phase: N/A
updated: 2026-11-07
summary: "抽查 10-30 以后的引擎终端终态机、去重与销毁守卫、焦点与减弱动效改动，以及仓库自改的终端、笔记本、调试、测试代码，记录 3 条。"
---

# 十六路审查 2026-11-07 r13：终端、笔记本、调试与测试发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。

范围内没有未提交改动。本次先逐个读了 2026-10-30 以后范围内的提交：11-01 引擎终端的启动期限与终态机（`universeAgentPtyTerminal.ts`），11-04 终端、终端贡献、笔记本、交互窗口、REPL 笔记本、调试、测试的去重 catch 与销毁守卫，11-07 调试与终端样式的键盘焦点和减弱动效改动。随后对照上游合并基点 `004a1fbb165`，抽查了仓库改过的 `debugService.ts`、`debugSession.ts`、`callStackView.ts`、`variablesView.ts`、`debugEditorContribution.ts`、`debugHover.ts`、`terminalProcessManager.ts`、`terminalInstance.ts`、`terminalProfileService.ts`、`terminalService.ts`、`localTerminalBackend.ts`、`terminalSandboxService.ts`、`chatTerminalCommandMirror.ts`、`notebookEditorModel.ts`、`notebookMulticursor.ts`、`cellComments.ts`、笔记本执行服务、交互窗口与 REPL 输入、测试服务与输出预览。旧稿已记的重启、运行到光标、测试结果保留与落盘、沙箱确认等不再重复。共 3 条。

### r13-1

- 严重度：中
- 症状：终端标签栏为宽模式时，用键盘 Tab 到「隐藏的聊天终端」入口里的垃圾桶按钮，按 Enter 或空格。全部隐藏终端被关掉后，整个入口随即隐藏，键盘焦点落到页面 body 上：之后键入的字符不进任何终端或编辑器，再按 Tab 要从文档开头的第一个可聚焦元素重新走。
- 代码：`src/vs/workbench/contrib/terminal/browser/terminalTabsChatEntry.ts` 86–93、99–121、127–137；`src/vs/workbench/contrib/terminal/browser/terminalTabbedView.ts` 145–155、217–222；`src/vs/workbench/contrib/terminalContrib/chat/browser/terminalChatService.ts` 135–141；`src/vs/workbench/contrib/terminal/browser/media/terminal.css` 442–445、453–457。

垃圾桶按钮 `tabIndex` 为 0，宽模式下入口获得焦点时靠 `:focus-within` 显示；11-07 还给它补了 `:focus-visible` 样式：

```442:445:src/vs/workbench/contrib/terminal/browser/media/terminal.css
.monaco-workbench .pane-body.integrated-terminal .terminal-tabs-chat-entry:hover .terminal-tabs-chat-entry-delete,
.monaco-workbench .pane-body.integrated-terminal .terminal-tabs-chat-entry:focus-within .terminal-tabs-chat-entry-delete {
	display: flex;
}
```

```86:93:src/vs/workbench/contrib/terminal/browser/terminalTabsChatEntry.ts
		// Delete button keyboard handler
		this._register(dom.addDisposableListener(this._deleteButton, dom.EventType.KEY_DOWN, async (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				e.stopPropagation();
				await this._deleteAllHiddenTerminals();
			}
		}));
```

终端销毁、实例变化和「有隐藏聊天终端」上下文键变化都会让标签视图刷新入口：

```145:155:src/vs/workbench/contrib/terminal/browser/terminalTabbedView.ts
		this._register(Event.any(this._terminalChatService.onDidRegisterTerminalInstanceWithToolSession, this._terminalService.onDidChangeInstances, this._terminalService.onDidDisposeInstance)(() => {
			this._refreshShowTabs();
			this._updateChatTerminalsEntry();
		}));

		this._register(contextKeyService.onDidChangeContext(e => {
			if (e.affectsSome(new Set([TerminalContribContextKeyStrings.ChatHasHiddenTerminals]))) {
				this._refreshShowTabs();
				this._updateChatTerminalsEntry();
			}
		}));
```

数量为 0 时 `update()` 直接把整个入口设成 `display: none`：

```127:137:src/vs/workbench/contrib/terminal/browser/terminalTabsChatEntry.ts
	update(): boolean {
		const prevDisplay = this._entry.style.display;
		const hiddenChatTerminalCount = this._terminalChatService.getToolSessionTerminalInstances(true).length;
		if (hiddenChatTerminalCount <= 0) {
			this._entry.style.display = 'none';
			this._label.textContent = '';
			this._entry.removeAttribute('aria-label');
			this._entry.removeAttribute('title');

			return prevDisplay !== 'none';
		}
```

- 为什么是问题：按下后 `_deleteAllHiddenTerminals` 对每个隐藏终端调用 `safeDisposeTerminal`。终端销毁时 `terminalChatService.ts` 135–141 把它从工具会话表中删掉，并更新「有隐藏聊天终端」上下文键；标签视图随即调用 `_updateChatTerminalsEntry`，`update()` 算出数量为 0，把入口隐藏。拿着焦点的垃圾桶按钮随入口一起不再渲染，浏览器把焦点放回 body。`_updateChatTerminalsEntry`（217–222）和 `update()` 只处理显隐与重排，没有任何地方把焦点交给标签列表或活动终端。入口本身持焦时，最后一个隐藏终端因别的原因结束，也会走同一条路径丢焦点。
- 方向：入口将要隐藏而焦点在入口内时，先把焦点移到终端标签列表或活动终端，再隐藏入口。

### r13-2

- 严重度：低
- 症状：笔记本代码单元格的评论线程还在读取时，若这个单元格被移出渲染区又回到原来那一行（例如在读取返回前开关底部面板，笔记本先变矮再变高），这次读取会被当成过期丢掉，之后也不会重读。单元格不显示它的评论线程；若当时正在创建线程部件，刚建好的部件还会被销毁。要等评论服务下一次发出线程变化事件才恢复。
- 代码：`src/vs/workbench/contrib/notebook/browser/view/cellParts/cellComments.ts` 43–51、96–107、124–133、184–192；`src/vs/workbench/contrib/notebook/browser/view/cellParts/codeCell.ts` 127–131。

行被释放时只把代数加一，不清 `currentElement`：

```184:192:src/vs/workbench/contrib/notebook/browser/view/cellParts/cellComments.ts
	override didRenderCell(element: ICellViewModel): void {
		this.initialize(element);
		this._bindListeners();
	}

	override unrenderCell(element: ICellViewModel): void {
		this._renderGeneration++;
		super.unrenderCell(element);
	}
```

同一个单元格再渲染进同一行时，`initialize` 因为元素相同直接返回，既不加代数，也不再调 `_updateThread`：

```43:51:src/vs/workbench/contrib/notebook/browser/view/cellParts/cellComments.ts
	private async initialize(element: ICellViewModel) {
		if (this.currentElement === element) {
			return;
		}

		this._renderGeneration++;
		this.currentElement = element;
		await this._updateThread();
	}
```

在途的那次读取回来后按代数判过期，在建任何部件之前返回；卡在创建部件时，返回前还会销毁刚放进映射的部件：

```96:107:src/vs/workbench/contrib/notebook/browser/view/cellParts/cellComments.ts
	private async _updateThread() {
		if (!this.currentElement) {
			return;
		}
		const element = this.currentElement;
		const generation = this._renderGeneration;
		const isStale = () => generation !== this._renderGeneration || this.currentElement !== element;

		const infos = await this._getCommentThreadsForCell(element);
		if (isStale()) {
			return;
		}
```

```124:133:src/vs/workbench/contrib/notebook/browser/view/cellParts/cellComments.ts
				} else {
					const threadId = thread.threadId;
					await this._createCommentTheadWidget(info.uniqueOwner, thread, element, generation);
					if (isStale()) {
						if (this._commentThreadWidgets.has(threadId)) {
							this._commentThreadWidgets.deleteAndDispose(threadId);
						}
						return;
					}
				}
```

- 为什么是问题：`CodeCell` 构造时调用 `scheduleRenderCell`，销毁时调用 `unrenderCell`（`codeCell.ts` 127–131），所以单元格每次离开渲染区都会让 `CellComments` 的代数加一。列表行缓存按模板类型后进先出（块外核对 `src/vs/base/browser/ui/list/rowCache.ts` 31–32）：视口变矮时底部几行依次释放，变高时从最下面一行开始重新分配，每个单元格拿回的正是自己原来那一行。这时 `initialize` 看到 `currentElement` 仍是同一个单元格就返回，而在途的 `_updateThread` 已被判为过期并丢弃，结果没有任何一次读取替这个单元格补上线程。这套代数是仓库提交 `0f8358e7394`（2026-09-23，「复用 CellComments 时作废在途评论线程更新」）加的，它处理了同一行换成别的单元格的情况，没有处理卸载后同一个单元格回到同一行的情况。
- 方向：`unrenderCell` 时清掉 `currentElement`，或在同一元素重新渲染而代数已变时重跑 `_updateThread`，让过期只作废旧调用，而不是让这个单元格停在没人读取的状态。

### r13-3

- 严重度：低
- 症状：打开 `workbench.reduceMotion`（或系统减弱动效）后，终端面板的标签行、行内动作、单标签按钮、隐藏聊天终端入口和它的删除按钮，以及调试工具条、调用栈部件、断点部件、异常部件、调试悬停、调试视图和 REPL 里的按压与悬停反馈，仍以 80–120ms 的过渡渐变底色或透明度。
- 代码：`src/vs/workbench/contrib/terminal/browser/media/terminal.css` 146、358–370、423–436、472–476、532–536、559–564、637；`src/vs/workbench/contrib/debug/browser/media/` 下 `debugToolBar.css` 57、`callStackWidget.css` 73–76 与 95、115、`breakpointWidget.css` 77、`exceptionWidget.css` 60、80、`debugHover.css` 78、`debugViewlet.css` 55、87、170、222、290、316、387、403、`debug.contribution.css` 8、81、138、`repl.css` 22、38、117。

```358:370:src/vs/workbench/contrib/terminal/browser/media/terminal.css
.monaco-workbench .pane-body.integrated-terminal .terminal-tabs-chat-entry {
	flex-shrink: 0;
	height: 22px;
	line-height: 22px;
	display: flex;
	align-items: center;
	padding: 0;
	cursor: pointer;
	background-color: transparent;
	color: inherit;
	border-radius: var(--vscode-cornerRadius-small, 4px);
	transition: background-color 0.12s ease;
}
```

```472:476:src/vs/workbench/contrib/terminal/browser/media/terminal.css
.monaco-workbench .pane-body.integrated-terminal .tabs-list .monaco-list-row {
	border-radius: var(--vscode-cornerRadius-small, 4px);
	transition: background-color 0.12s ease;
	box-sizing: border-box;
}
```

```73:76:src/vs/workbench/contrib/debug/browser/media/callStackWidget.css
.multiCallStackFrame .collapse-button a {
	border-radius: var(--vscode-cornerRadius-small, 4px);
	transition: background-color 0.12s ease;
}
```

- 为什么是问题：仓库界面原则写明过渡「时长不超过 100ms；`.monaco-reduce-motion` 下去掉过渡」（`docs/architecture/cross-cutting/ui-design-principles.md` 128）。上面这些过渡都是仓库 2026-09-28 的两次按压与悬停反馈提交（`07671981dd61`、`a854de8c4ae6`）加的。11-07 的提交 `1dc991f93c7` 说明里把 debug 与 terminal 列入「过渡统一为 100ms，monaco-reduce-motion 和 prefers-reduced-motion 下关闭过渡」，但对这两个目录只加了 `:focus-visible` 规则；在 terminal、terminalContrib、debug 的样式表里搜不到 `monaco-reduce-motion` 或 `prefers-reduced-motion`。减弱动效的类只挂在工作台根节点上，`transition` 不继承；工作台的全局兜底（块外核对 `src/vs/workbench/browser/media/productAccessibility.css` 78–88、103–114）只覆盖状态栏、会话、来源和设置编辑器，不覆盖面板里的终端与调试视图。用户打开减弱动效后，这两块照常播放过渡，与设置和仓库约定都不一致。
- 方向：给这些选择器补上 `.monaco-reduce-motion` 与 `@media (prefers-reduced-motion: reduce)` 下的 `transition: none`，同时把时长收到 100ms 以内。

## 打开过的文件

- `src/vs/workbench/contrib/terminal/browser/universeAgentPtyTerminal.ts`
- `src/vs/workbench/contrib/terminal/browser/terminalInstance.ts`
- `src/vs/workbench/contrib/terminal/browser/terminalProcessManager.ts`
- `src/vs/workbench/contrib/terminal/browser/terminalService.ts`
- `src/vs/workbench/contrib/terminal/browser/terminalProfileService.ts`
- `src/vs/workbench/contrib/terminal/browser/terminalProfileResolverService.ts`
- `src/vs/workbench/contrib/terminal/browser/terminalTabbedView.ts`
- `src/vs/workbench/contrib/terminal/browser/terminalTabsChatEntry.ts`
- `src/vs/workbench/contrib/terminal/browser/terminalTabsList.ts`
- `src/vs/workbench/contrib/terminal/browser/terminalView.ts`
- `src/vs/workbench/contrib/terminal/browser/terminalActions.ts`
- `src/vs/workbench/contrib/terminal/browser/terminalMainContribution.ts`
- `src/vs/workbench/contrib/terminal/browser/chatTerminalCommandMirror.ts`
- `src/vs/workbench/contrib/terminal/browser/xtermConstructorCache.ts`
- `src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts`
- `src/vs/workbench/contrib/terminal/browser/xterm/markNavigationAddon.ts`
- `src/vs/workbench/contrib/terminal/browser/media/terminal.css`
- `src/vs/workbench/contrib/terminal/common/environmentVariableService.ts`
- `src/vs/workbench/contrib/terminal/common/localTerminalEnvironment.ts`
- `src/vs/workbench/contrib/terminal/electron-browser/localTerminalBackend.ts`
- `src/vs/workbench/contrib/terminal/electron-browser/terminalNativeContribution.ts`
- `src/vs/workbench/contrib/terminal/test/node/terminalTabsChatEntryCss.test.ts`
- `src/vs/workbench/contrib/terminalContrib/chat/browser/terminalChatService.ts`
- `src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/monitoring/outputMonitor.ts`
- `src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/runInTerminalTool.ts`
- `src/vs/workbench/contrib/terminalContrib/chatAgentTools/common/terminalSandboxService.ts`
- `src/vs/workbench/contrib/terminalContrib/clipboard/browser/terminal.clipboard.contribution.ts`
- `src/vs/workbench/contrib/terminalContrib/find/browser/terminalFindWidget.ts`
- `src/vs/workbench/contrib/terminalContrib/links/browser/terminalLinkQuickpick.ts`
- `src/vs/workbench/contrib/terminalContrib/stickyScroll/browser/terminalStickyScrollOverlay.ts`
- `src/vs/workbench/contrib/terminalContrib/suggest/browser/terminal.suggest.contribution.ts`
- `src/vs/workbench/contrib/terminalContrib/suggest/browser/terminalSuggestAddon.ts`
- `src/vs/workbench/contrib/terminalContrib/voice/browser/terminalVoice.ts`
- `src/vs/workbench/contrib/notebook/browser/notebookEditor.ts`
- `src/vs/workbench/contrib/notebook/browser/notebookEditorWidget.ts`
- `src/vs/workbench/contrib/notebook/browser/notebook.contribution.ts`
- `src/vs/workbench/contrib/notebook/browser/notebookWebviewResolveCache.ts`
- `src/vs/workbench/contrib/notebook/browser/contrib/cellStatusBar/executionStatusBarItemController.ts`
- `src/vs/workbench/contrib/notebook/browser/contrib/find/findModel.ts`
- `src/vs/workbench/contrib/notebook/browser/contrib/find/notebookFindWidget.ts`
- `src/vs/workbench/contrib/notebook/browser/contrib/gettingStarted/notebookGettingStarted.ts`
- `src/vs/workbench/contrib/notebook/browser/contrib/multicursor/notebookMulticursor.ts`
- `src/vs/workbench/contrib/notebook/browser/contrib/outline/notebookOutline.ts`
- `src/vs/workbench/contrib/notebook/browser/contrib/viewportWarmup/viewportWarmup.ts`
- `src/vs/workbench/contrib/notebook/browser/diff/inlineDiff/notebookInlineDiff.ts`
- `src/vs/workbench/contrib/notebook/browser/services/notebookEditorServiceImpl.ts`
- `src/vs/workbench/contrib/notebook/browser/services/notebookExecutionServiceImpl.ts`
- `src/vs/workbench/contrib/notebook/browser/services/notebookExecutionStateServiceImpl.ts`
- `src/vs/workbench/contrib/notebook/browser/services/notebookKeymapServiceImpl.ts`
- `src/vs/workbench/contrib/notebook/browser/services/notebookRendererMessagingServiceImpl.ts`
- `src/vs/workbench/contrib/notebook/browser/services/notebookServiceImpl.ts`
- `src/vs/workbench/contrib/notebook/browser/view/cellPart.ts`
- `src/vs/workbench/contrib/notebook/browser/view/cellParts/cellComments.ts`
- `src/vs/workbench/contrib/notebook/browser/view/cellParts/cellOutput.ts`
- `src/vs/workbench/contrib/notebook/browser/view/cellParts/cellStatusPart.ts`
- `src/vs/workbench/contrib/notebook/browser/view/cellParts/codeCell.ts`
- `src/vs/workbench/contrib/notebook/browser/view/cellParts/markupCell.ts`
- `src/vs/workbench/contrib/notebook/browser/view/notebookCellList.ts`
- `src/vs/workbench/contrib/notebook/browser/view/renderers/backLayerWebView.ts`
- `src/vs/workbench/contrib/notebook/browser/view/renderers/cellRenderer.ts`
- `src/vs/workbench/contrib/notebook/browser/viewModel/baseCellViewModel.ts`
- `src/vs/workbench/contrib/notebook/browser/viewParts/notebookKernelQuickPickStrategy.ts`
- `src/vs/workbench/contrib/notebook/common/model/notebookCellTextModel.ts`
- `src/vs/workbench/contrib/notebook/common/notebookEditorInput.ts`
- `src/vs/workbench/contrib/notebook/common/notebookEditorModel.ts`
- `src/vs/workbench/contrib/interactive/browser/interactive.contribution.ts`
- `src/vs/workbench/contrib/interactive/browser/interactiveEditor.ts`
- `src/vs/workbench/contrib/interactive/browser/interactiveEditorInput.ts`
- `src/vs/workbench/contrib/replNotebook/browser/repl.contribution.ts`
- `src/vs/workbench/contrib/replNotebook/browser/replEditor.ts`
- `src/vs/workbench/contrib/replNotebook/browser/replEditorInput.ts`
- `src/vs/workbench/contrib/debug/browser/breakpointEditorContribution.ts`
- `src/vs/workbench/contrib/debug/browser/breakpointWidget.ts`
- `src/vs/workbench/contrib/debug/browser/breakpointsView.ts`
- `src/vs/workbench/contrib/debug/browser/callStackView.ts`
- `src/vs/workbench/contrib/debug/browser/callStackWidget.ts`
- `src/vs/workbench/contrib/debug/browser/debugActionViewItems.ts`
- `src/vs/workbench/contrib/debug/browser/debugAdapterManager.ts`
- `src/vs/workbench/contrib/debug/browser/debugChatIntegration.ts`
- `src/vs/workbench/contrib/debug/browser/debugCommands.ts`
- `src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts`
- `src/vs/workbench/contrib/debug/browser/debugEditorContribution.ts`
- `src/vs/workbench/contrib/debug/browser/debugHover.ts`
- `src/vs/workbench/contrib/debug/browser/debugService.ts`
- `src/vs/workbench/contrib/debug/browser/debugSession.ts`
- `src/vs/workbench/contrib/debug/browser/disassemblyView.ts`
- `src/vs/workbench/contrib/debug/browser/linkDetector.ts`
- `src/vs/workbench/contrib/debug/browser/repl.ts`
- `src/vs/workbench/contrib/debug/browser/variablesView.ts`
- `src/vs/workbench/contrib/debug/browser/watchExpressionsView.ts`
- `src/vs/workbench/contrib/debug/common/debugModel.ts`
- `src/vs/workbench/contrib/debug/common/debugVisualizerActivation.ts`
- `src/vs/workbench/contrib/debug/browser/media/breakpointWidget.css`
- `src/vs/workbench/contrib/debug/browser/media/callStackWidget.css`
- `src/vs/workbench/contrib/debug/browser/media/debug.contribution.css`
- `src/vs/workbench/contrib/debug/browser/media/debugHover.css`
- `src/vs/workbench/contrib/debug/browser/media/debugToolBar.css`
- `src/vs/workbench/contrib/debug/browser/media/debugViewlet.css`
- `src/vs/workbench/contrib/debug/browser/media/exceptionWidget.css`
- `src/vs/workbench/contrib/debug/browser/media/repl.css`
- `src/vs/workbench/contrib/testing/browser/testCoverageView.ts`
- `src/vs/workbench/contrib/testing/browser/testingDecorations.ts`
- `src/vs/workbench/contrib/testing/browser/testingExplorerFilter.ts`
- `src/vs/workbench/contrib/testing/browser/testingExplorerFilterEmpty.ts`
- `src/vs/workbench/contrib/testing/browser/testingExplorerView.ts`
- `src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts`
- `src/vs/workbench/contrib/testing/browser/testingProgressUiService.ts`
- `src/vs/workbench/contrib/testing/browser/testResultsView/testResultsOutput.ts`
- `src/vs/workbench/contrib/testing/browser/testResultsView/testResultsViewContent.ts`
- `src/vs/workbench/contrib/testing/common/testItemCollection.ts`
- `src/vs/workbench/contrib/testing/common/testingChatAgentTool.ts`
- `src/vs/workbench/contrib/testing/common/testingContentProvider.ts`
- `src/vs/workbench/contrib/testing/common/testingExplorerFilterEmpty.ts`
- `src/vs/workbench/contrib/testing/common/testServiceImpl.ts`
- 块外核对：`src/vs/workbench/browser/media/style.css`、`src/vs/workbench/browser/media/productAccessibility.css`、`src/vs/platform/accessibility/browser/accessibilityService.ts`、`src/vs/base/browser/ui/list/rowCache.ts`、`docs/architecture/cross-cutting/ui-design-principles.md`
