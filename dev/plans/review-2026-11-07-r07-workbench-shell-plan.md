---
title: "十六路审查 2026-11-07 r07：workbench 壳方案"
type: plan
status: accepted
phase: N/A
updated: 2026-11-07
summary: "hold 3、weaken 1、drop 0；修拖放浮层放下即自弃（连同两处树项放下遗漏的清理）、状态栏 focus(false) 多跳一项、显示 Sources 不退出辅助栏最大化，并把已失效的 window.doubleClickIconToClose 标为弃用。2026-11-07 已过规则 16 只读审查并改稿；同日已实施（未编译、未跑测试），代码审查经一轮修改后可接受。"
---

# 十六路审查 2026-11-07 r07：workbench 壳方案

状态：执行中。负责：agent:opus。
签收：签。签收人：agent:opus，依据用户 2026-11-07 在会话中说的「需要的做一下 不编译」，日期：2026-11-07。
覆盖需求：无。四条都不落在现有产品验收标准上：r07-1 是把文件拖进 Preview 内容区或空组打开，PRD-005.1 只写 Files 树内部可以拖放，PRD-027.4 只写把标签拖到类别钮；r07-2 是状态栏条目的键盘导航，PRD-018 的验收 018.1–018.5 不含状态栏；r07-3 是辅助栏最大化与 Sources 显隐的交互，辅助栏不在四钮和任何需求里，最大化形态由审查待定项决定 D17 写定，那是决定记录，不是需求；r07-4 是上游 `window.*` 设置，PRD-026 只管 Client Settings 七组。

只改下面四条。代码范围停在 `editorDropTarget.ts` 的 `DropOverlay.handleDrop`、`multiEditorTabsControl.ts` 的 `MultiEditorTabsControl.onDrop` 树项分支、`statusbarPart.ts` 的 `StatusbarPart.focus`、`layout.ts` 的 `Layout.setSourcesHidden`，以及 `desktop.contribution.ts` 里 `window.doubleClickIconToClose` 的注册；文档只补 `parts-and-grid.md`、`commands.md`、`chrome-title-status.md` 里与这几处行为对应的句子。初稿核对到 HEAD `841ea38816d` 加当时的未提交改动；改稿时 HEAD 未变，`layout.ts` 与 `conversationEditorPart.ts` 已被别的会话继续改动，文中行号按改稿时的工作区重新按符号核对。没有编译，没有跑测试。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r07-1 | hold | 中 | 见下文。核查时另见：树项分支在 `clearData` 之前提前返回，过期的 `DraggedTreeItemsIdentifier` 会让下一次放下误入树项分支。页签栏放下路径 `multiEditorTabsControl.ts` 第 2627–2629 行（2026-11-04 的 `d707ab25a9c`）是同一类问题，并进本条。树视图自己从不清这份传输（`treeView.ts` 的 `onDragEnd` 第 2160–2165 行、`drop` 第 2131–2132 行），按住 Shift 放进文本编辑器的 `dropIntoEditorController.ts` 第 196–208 行也不清；这两处是上游行为，写成实施时登记的缺口。 |
| r07-2 | hold | 中 | 见下文。 |
| r07-3 | weaken | 中→低 | 成立，但触发比稿里窄。产品出厂辅助栏隐藏：`workbench.secondarySideBar.defaultVisibility` 默认 `hidden`（`workbench.contribution.ts` 第 616–619 行；`panel-and-auxiliary-bar.md` 第 64 行的 INV-052-NO-RIGHT-RAIL），辅助栏开关不在四钮里（`layoutControlMenu.test.ts` 的 `Panel and Auxiliary Bar stay on LayoutControlMenuSubmenu only`）。自动进入最大化的入口都要用户另行开启：`workbench.secondarySideBar.forceMaximized` 默认 false（`workbench.contribution.ts` 第 630–632 行，`layout.ts` 第 412–420、496–502 行）；`defaultVisibility` 设为 `maximized` 或 `maximizedInWorkspace` 时，新工作区经 `applyOverrides` 与 `applyAuxiliaryBarMaximizedOverride`（`layout.ts` 第 3583–3592、3614–3632 行）以最大化启动；`chat --maximize` 是命令行参数。最大化标记 `AUXILIARYBAR_WAS_LAST_MAXIMIZED`（第 3369 行）和快照（第 3371 行）按工作区保存，最大化过一次，重开窗口仍是最大化，错位状态也会一起保存；但起点仍是用户显式最大化或改了这项设置。后果是 Sources 按旧快照被重新藏起、焦点移到辅助栏，不丢数据，再按一次 Focus Sources 即可找回。 |
| r07-4 | hold | 低 | 见下文。 |

共同的实施前提与步骤：

1. 只暂存本方案的 hunk。`layout.ts`、`conversationEditorPart.ts`、`docs/systems/workbench/parts-and-grid.md`、`docs/systems/conversation/commands.md`、标题栏几份文件和未跟踪的 `titlebarNavigationContract.test.ts` 里有别的会话尚未提交的改动。实施时按符号定位，不 restore、stash、reset 别人的改动，不用 `git add -A`。各条另有的等待条件写在该条的「实施前提」里。
2. 本地验证顺序：`scripts/test.sh --run` 加载的是 `out/` 下的编译产物，所以先跑 `npm run compile-client`（只需刷新产物时可用 `npm run transpile-client`），再按各条列出的文件跑 `scripts/test.sh --run <测试文件>`，最后跑 `npm run eslint`。改了文档的 r07-3、r07-4 再跑 `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`。这些测试都不在 conversation、sources、universeAgent 三处目录里，`scripts/run-unit-custom.sh` 的 glob 覆盖不到，所以用 `scripts/test.sh --run`。
3. 提交前跑 `python3 scripts/wiki/wiki.py remind --root . --staged`。出现 `[agent]` 时更新对应文档，或在提交说明末段写 `Docs-Reviewed: <名称> <理由>`。
4. 提交时把本方案登记进 `dev/plans/INDEX.md`。
5. 实施 r07-1 时在 `dev/progress/deferred-gaps.md` 登记两条缺口，编号在登记时按该表规则取，本稿不预占。第一条：树视图（`treeView.ts` 的 `onDragEnd` 与 `drop`）和 `dropIntoEditorController.ts` 读过 `DraggedTreeItemsIdentifier` 却不清；取消的树项拖动或树内放下之后，下一次拖进编辑区或页签栏的外部文件会被当成树项处理，这次拖进来的文件打不开。第二条：`dropOrPasteIntoLeftoverPromiseCatchScanD886.test.ts` 仍要求 `editorDropTarget.ts` 第 209 行与 `multiEditorTabsControl.ts` 第 542、1434 行是双层 catch，按源码比对这几行现在都是单层 catch，断言已不成立，而 `deferred-gaps.md` 第 1230 行把 D886 记为 closed。

### r07-1

核查：`editorDropTarget.ts` 第 201–211 行的 `onDrop` 先 `this.dispose()` 再调 `handleDrop`，第 605 行把 `_disposed` 置真；树项分支第 357、361、366、372 行与 URI 分支第 385 行都判断 `this.groupView.disposed || this._disposed`，放下时后者必然为真。这些判断由 2026-11-03 的 `c0e2c6f775c` 加入，同一提交没有加行为测试，`workbenchLeftoverPromiseCatchScanD737.test.ts` 只锁第 376 行 `openEditors(...)` 的单层 catch。主 Preview 部件经 `editorPart.ts` 第 1268 行装上 `EditorDropTarget`，`allowDropIntoGroup` 默认为真，只有会话部件（`conversationEditorPart.ts` 第 141 行）和模态部件（`modalEditorPart.ts` 第 986 行）关掉。Sources 的 Files 页是 `ExplorerView`，拖动经 `explorerViewer.ts` 第 1853 行的 `fillEditorsDragData` 只写资源和 URI 数据，落到 URI 分支。页签栏的放下走 `multiEditorTabsControl.ts` 第 2540–2642 行，只看页签控件自己是否销毁，打开不受影响，所以症状限于非空组的内容区和整个空组；但它的树项分支同样在 `clearData` 之前提前返回（第 2627–2629 行）。旧审查、方案和 deferred-gaps 里没有这一条。

问题类：放下时 `DropOverlay` 先销毁自己再处理，`handleDrop` 的树项与 URI 两支却以浮层已销毁为由放弃，从系统文件管理器、Sources 的 Files 树和扩展树视图拖进编辑区内容部分或空组的文件都不打开；编辑区浮层与页签栏两处树项分支提前返回时，还会把过期的树项传输留给下一次放下。

不变量：

- `DropOverlay.handleDrop` 决定是否继续，只看目标组 `this.groupView.disposed`，不看浮层自身的 `_disposed`。`onDrop` 里先销毁浮层、再处理放下的顺序保留。
- URI 分支在 drop 事件派发的同步段里把 `event` 交给 `ResourcesDropHandler.handleDrop`，在这之前不出现 await。`DataTransfer` 只在事件派发期间可读。
- 编辑区浮层和页签栏两处树项分支，取到 `DraggedTreeItemsIdentifier` 数据之后、第一个 await 之前就清掉这份本地传输。之后无论打开了编辑器、因目标组或页签控件已销毁而放弃，还是等待中抛错，都不会把它留给下一次放下。
- 目标组在树项分支等待期间被销毁时，不调用 `ensureTargetGroup()`，不打开编辑器；页签控件在等待期间被销毁时同样不打开。
- 组拖动与页签拖动两支的行为不变。

要动的符号与文件：

- `src/vs/workbench/browser/parts/editor/editorDropTarget.ts`：`DropOverlay.handleDrop`（第 253–391 行）里第 357、361、366、372、385 行的判断；第 353 行取数据之后插入清理，删去第 380 行的 `this.treeItemsTransfer.clearData(DraggedTreeItemsIdentifier.prototype)`。`DropOverlay._disposed` 与 `disposed` 读取器（第 54–55 行）保留，`EditorDropTarget.overlay`（第 638 行）靠它决定 dragenter 时是否另建浮层。
- `src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts`：`MultiEditorTabsControl.onDrop`（第 2540 行起）的树项分支；第 2616 行取数据之后插入清理，删去第 2634 行的清理。第 2627–2629 行的 `this._store.isDisposed` 判断保留。

改法：

1. 把 `DropOverlay.handleDrop` 树项分支和 URI 分支里五处 `this.groupView.disposed || this._disposed` 改为只判断 `this.groupView.disposed`。第 254–256 行函数入口的组判断保留。
2. 两处树项分支都改成「取到数据就清」：`const data = this.treeItemsTransfer.getData(...)` 之后紧接着 `clearData(...)`，再进入 `if (Array.isArray(data) && data.length > 0)` 与循环；原来分支末尾的那次 `clearData` 删去。这样第 1 步留下的组判断或页签控件的 `_store.isDisposed` 判断提前返回时，以及 `removeDragOperationTransfer`、`extractTreeDropData` 抛错时，传输都已经清掉，不需要 try/finally。
3. 两处入口判断（`handleDrop` 第 254 行、页签栏 `onDrop` 第 2541 行）在进入任何分支之前返回，不在本条范围。真实界面里浮层随组元素一起移出 DOM，页签控件销毁时它的监听也一起移除，放下事件落不到它们上。
4. `onDrop` 的顺序和 `currentDropOperation` 的读取不改。`dispose()` 不清 `currentDropOperation` 这一点保持，否则第 208 行的判断会失效。
5. URI 分支第 388–389 行之前不加任何 await。

明确不改什么：

- 组拖动与页签拖动两支：`editorDropTarget.ts` 第 270–349 行，页签栏 `onDrop` 里对应的两个分支。
- `editorDropTarget.ts` 第 209 行的调用写法与 `handleDrop` 的签名；第 376 行 `openEditors(...).catch(onUnexpectedError)` 保持单层 catch，保持 `workbenchLeftoverPromiseCatchScanD737.test.ts` 的 `editorDropTarget leftover openEditors has single catch` 通过。页签栏第 2631 行的 `openEditors(...).catch(onUnexpectedError)` 不改，保持 `workbenchEditorLeftoverPromiseCatchScan.test.ts` 的 `multiEditorTabsControl leftover openEditors fire-and-forget is Promise single-catch` 通过。`dialogHandlerLeftoverPromiseCatchScanD895.test.ts` 对第 209 行统计的是单层 catch（断言信息 `D886 already-double drifted`），本条不碰这一行，它的结果不变。
- `c0e2c6f775c` 的其余部分：`DropOverlay.dispose()` 的 DOM 清理，`EditorDropTarget` 的 `_isDisposed` 守卫和 `dispose()` 顺序。`d707ab25a9c` 在页签栏加的 `_store.isDisposed` 判断也保留。
- 会话部件（`conversationEditorPart.ts` 第 141 行）与模态部件（`modalEditorPart.ts` 第 986 行）的 `allowDropIntoGroup: false`。
- 树视图与 `dropIntoEditorController.ts` 不清传输的上游行为，本条只登记、不改（共同步骤第 5 条）。
- `dropOrPasteIntoLeftoverPromiseCatchScanD886.test.ts` 对这两个文件的双层 catch 断言按源码比对已不成立；本条不处理，也不拿它作本条的通过判据（共同步骤第 5 条）。

本地验证：

- 新增 `src/vs/workbench/test/browser/parts/editor/editorDropTarget.test.ts`。不能用 `createEditorPart`：它一建好部件就 `create()`，而 `workbenchInstantiationService` 注入的 `IEditorGroupsService` 是 `TestEditorGroupsService`，组的 `element` 为空（`workbenchTestServices.ts` 第 352–353 行），`EditorDropTarget.findTargetGroupView`（`editorDropTarget.ts` 第 721–725 行）找不到目标组，浮层建不起来。搭法如下。
  1. `workbenchInstantiationService` 之后、建部件之前，把 `workbench.editor.splitOnDragAndDrop` 设为 false，让浮层整组覆盖、不分屏。
  2. 用 `instantiationService.createInstance(TestEditorParts)` 手工建部件，先 `instantiationService.stub(IEditorGroupsService, parts)`，再对主部件 `create()`（容器挂到 `document.body`）、`layout()`，并等 `parts.whenReady`。
  3. 在第一次 `dragenter` 之前给 `ITreeViewsDnDService` 打桩（测试替身里没有它，`DropOverlay` 构造时注入），并把 `IEditorService` 换成记录 `openEditors(editors, group)` 调用的桩，或按 `editor.test.ts` 第 454–464 行建真实 `EditorService`。`TestEditorService.openEditors` 会直接抛错（`workbenchTestServices.ts` 第 1125 行）。
  4. 拖放事件上的 `DataTransfer` 只放 `DataTransfers.RESOURCES`（URI 字符串的 JSON 数组）或 `CodeDataTransfers.EDITORS`。`text/uri-list` 过不了 `onDragEnter` 的类型检查（`editorDropTarget.ts` 第 671 行），`extractEditorsDropData`（`src/vs/platform/dnd/browser/dnd.ts` 第 59–140 行）也不读它。uri-list 只放在树项桩返回的传输里，那是 `extractTreeDropData`（`src/vs/workbench/browser/dnd.ts` 第 53–69 行）读的。
  5. 在目标组元素上派发冒泡的 `dragenter`，在 `#monaco-workbench-editor-drop-overlay` 上派发 `dragover` 和 `drop`。
- 断言一（URI 分支）：drop 之后 `openEditors` 被调用一次，资源是拖进来的那个，目标组是放下的组。
- 断言二（树项分支）：给 `LocalSelectionTransfer` 设一条 `DraggedTreeItemsIdentifier`，桩 `removeDragOperationTransfer` 返回带 uri-list 的传输。等桩结算后，`openEditors` 收到该资源，`treeItemsTransfer.hasData(DraggedTreeItemsIdentifier.prototype)` 为假。
- 断言三（组销毁）：最后一个根组删不掉（`editorPart.ts` 第 877–879 行），所以先用 `addGroup` 分出第二个组并把它作为放下目标；桩在返回之前 `removeGroup` 这个组。等桩结算后，`openEditors` 没有被调用，树项传输已经清掉。
- 断言四（页签栏）：同样分出第二个组，在它的 `.tabs-container` 上派发 drop（`e.target` 必须是这个元素，见 `multiEditorTabsControl.ts` 第 540 行），桩在返回之前 `removeGroup` 这个组。等桩结算后，`openEditors` 没有被调用，树项传输已经清掉。
- 按共同步骤编译后，用 `scripts/test.sh --run` 分别跑新文件、`src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD737.test.ts`、`src/vs/workbench/test/node/workbenchEditorLeftoverPromiseCatchScan.test.ts` 与 `src/vs/workbench/services/dialogs/test/node/dialogHandlerLeftoverPromiseCatchScanD895.test.ts`，再跑 `npm run eslint`。

### r07-2

核查：`statusbarPart.ts` 第 431–439 行的 `else` 分支由 2026-11-07 的 `1dc991f93c7` 加入。提交说明只写「焦点项被移除时转到下一项」，同一提交新增的测试都是 CSS 扫描，`statusbarPart.test.ts` 的两条用例不涉及 `focus()`。`focus(false)` 只有 `statusbarActions.ts` 第 94、106、120 行三个调用方，`layout.ts` 第 1393 行的 Focus Status Bar 用默认参数。按 `statusbarModel.ts` 第 178–208 行 `focusEntry` 的回绕规则推演，Home 落到第二项，End 落到第一项，Escape 永远走不到 `activeEditorPane.focus()`，与发现稿一致。`chrome-title-status.md` 第 77 行只写「键盘在条目间走」，没有锁定这三种行为。旧审查里没有这一条。

问题类：`StatusbarPart.focus(false)` 在下一个任务里多调一次 `focusNextEntry()`，抵消了 Home、End 和 Escape 三条命令自己的选择。

不变量：

- `focus(false)` 只同步聚焦状态栏容器，之后不再有延时回调移动焦点。
- Home 之后焦点在第一个可见条目，End 之后在最后一个可见条目；只有一个可见条目时两者相同。
- 焦点在条目上时按 Escape，焦点落在状态栏容器；再按 Escape 且有 `activeEditorPane` 时，焦点交给该编辑器。
- `focus()`（`preserveEntryFocus` 为真）保持现状：上次焦点项仍在 DOM 时延时聚焦它；上次焦点项不在 DOM 或从未有过时，延时调用 `focusNextEntry()`。

要动的符号与文件：`StatusbarPart.focus`。文件：`src/vs/workbench/browser/parts/statusbar/statusbarPart.ts`（第 431–439 行）。

改法：

1. 第 436–438 行的 `else` 分支只在 `preserveEntryFocus` 为真时进入。`preserveEntryFocus` 为假时只执行第 432 行的容器聚焦，不排任何定时器。
2. 三条命令 `workbench.statusBar.focusFirst`、`workbench.statusBar.focusLast`、`workbench.statusBar.clearFocus`（`statusbarActions.ts` 第 87–125 行）不改，它们本来就依赖 `focus(false)` 只聚焦容器。
3. `StatusbarViewModel.focusEntry` 的回绕规则不改。

明确不改什么：

- `focus()` 在 `preserveEntryFocus` 为真时的两种情形，也就是 `1dc991f93c7` 想要的「焦点项被移除时转到可见条目」。
- 左右方向键 `workbench.statusBar.focusPrevious` 与 `workbench.statusBar.focusNext`。
- 第二次 Escape 没有 `activeEditorPane` 时焦点留在容器，这是上游行为，本条不扩到 Conversation。
- `1dc991f93c7` 改的状态栏焦点样式有两处，本条都不动。一处在 `media/statusbarpart.css`，由 `statusbarPartCss.test.ts` 的 `ordinary status entry focus uses hover feedback while HC keeps a contrast ring` 和 `statusbarRootCss.test.ts` 的 `ordinary statusbar focus suppresses the product ring while HC keeps a contrast ring` 锁住，两条都保持通过。另一处是 `statusbarPart.ts` 主题段第 746–751 行的条目焦点规则（非高对比主题画悬停底色，高对比主题画轮廓），没有测试锁；它和本条要改的 `focus()` 在同一个文件，改时不碰。
- 保持 `statusbarPart.test.ts` 现有的 `configuration changes update styles only after the part is created` 与 `modern UI reserves compact vertical status bar padding` 通过。

本地验证：

- 在 `src/vs/workbench/test/browser/parts/statusbar/statusbarPart.test.ts` 新增用例。部件容器挂到 `document.body`，按需桩条目依赖的服务。`statusbarPart.ts` 第 33 行导入 `statusbarActions.ts`，三条命令随之注册。
- 断言一：`focus(false)` 之后等过一个 0ms 定时器，`document.activeElement` 仍是部件容器，`focusNextEntry` 没有被调用（可在 `TestMainStatusbarPart` 里覆写计数）。
- 断言二：加三个可见条目，经 `CommandsRegistry` 执行 `workbench.statusBar.focusFirst` 与 `workbench.statusBar.focusLast`，访问器把部件当作 `IStatusbarService` 交出；各等过 0ms 定时器后，焦点分别在第一个与第三个条目的 label 上。
- 断言三：焦点在第二个条目上时执行 `workbench.statusBar.clearFocus`，等过定时器后焦点在容器；再执行一次，桩 `IEditorService.activeEditorPane.focus` 被调用一次。
- 断言四：上次焦点项被移除后调用 `focus()`，等过定时器后焦点在第一个可见条目，锁住 `1dc991f93c7` 想要的行为。
- 按共同步骤编译后，用 `scripts/test.sh --run` 跑 `src/vs/workbench/test/browser/parts/statusbar/statusbarPart.test.ts`、`src/vs/workbench/test/node/statusbarPartCss.test.ts` 与 `src/vs/workbench/test/node/statusbarRootCss.test.ts`，再跑 `npm run eslint`。

### r07-3

核查：`layout.ts` 第 2107–2133 行的 `setSourcesHidden` 显示时不退出辅助栏最大化，而 `setEditorHidden`（第 2050 行）、`setSideBarHidden`（第 2206 行）、`setPanelHidden`（第 2378 行）都先退出。`setAuxiliaryBarMaximized`（第 2468 行起）进入最大化时在第 2477–2484 行记快照、第 2513 行存入；还原在第 2517–2538 行，第 2524 行按快照重设 Sources，第 2538 行聚焦辅助栏，与发现稿一致。`parts-and-grid.md` 第 79 行与审查待定项决定 D17（`docs/decisions/ui-review-decisions-2026-11-01.md` 第 147–159 行）写定最大化时藏 End 列，也就是 Preview 与 Sources，所以这不是有意形态。Focus Sources（`layoutActions.ts` 第 540 行）、Toggle Sources、四钮里的 Sources、`sources.contribution.ts` 第 81 行和 `sourcesReview.contribution.ts` 第 29 行都经 `setPartHidden(false, Parts.SOURCES_PART)` 走到这里；`defaultWindowLayoutTogglePrecondition`（`layoutActions.ts` 第 260–263 行）不挡最大化。退出最大化时聚焦辅助栏，与未提交的 `parts-and-grid.md` 第 87 行、`commands.md` 第 27 行「点标题栏按钮、菜单或 F1 只切显隐、不抢焦点」不一致；Preview 钮经 `setEditorHidden` 今天已经如此，本条修好后 Sources 钮也一样，所以要在两篇文档里写明例外。2026-10-30 r09-1 管的是面板最大化，不是同一缺陷。降为低的理由见判定表。

问题类：辅助栏最大化期间显示 Sources 不退出最大化，最大化标记与快照都还是旧的；之后切出 Preview 或还原辅助栏，会按旧快照把 Sources 重新藏起，并把焦点交给辅助栏。

实施前提：`layout.ts` 里 `setSourcesHidden` 所在的这几段有别的会话尚未提交的改动，即 `interaction-review-2026-11-06.md` 第 53 行那一条（隐藏 Conversation / Sources 时交出焦点）与 `ui-interaction-visual-review-2026-11-07.md` §5.2 第 4 条（`setEditorHidden` 补 `handOffFocus`）的实施。本条等那批改动提交之后再做；若到时仍未提交，只暂存本条自己的 hunk。`parts-and-grid.md` 与 `commands.md` 同样有未提交改动，文档步骤照此处理。实施时按符号定位，不按本稿行号。

不变量：

- 辅助栏最大化标记为真期间，Preview 与 Sources 都不可见。
- 任一入口把 Sources 从隐藏改为显示之后，辅助栏不再处于最大化，Sources 可见。
- 退出最大化时按快照恢复侧栏、面板、Preview 与 Sources。快照里 Sources 原本可见时，由恢复把它显示出来；原本隐藏时，由这次调用显示。
- 进入最大化、还原过渡（`inMaximizedAuxiliaryBarTransition` 为真）和 `enforceAgentShellVisible` 补显示这三条路径的结果不变。
- Focus Sources 与带 `{ focus: true }` 的 Toggle Sources 结束时焦点在 Sources。
- 最大化期间经工具栏、菜单或 F1 显示 Sources 时，退出最大化后焦点落在辅助栏，与 Preview 钮的现状一致；`parts-and-grid.md` 与 `commands.md` 写明这一例外。

要动的符号与文件：

- `Layout.setSourcesHidden`，文件 `src/vs/workbench/browser/layout.ts`（第 2107–2133 行），写法参照 `setEditorHidden` 第 2049–2052 行。
- `docs/systems/workbench/parts-and-grid.md` 第 79 行 `AUXILIARYBAR_PART` 一行、第 87 行「显示时的焦点」一段、frontmatter 的 `updated`。
- `docs/systems/conversation/commands.md` §1 第 27 行那一段、frontmatter 的 `updated`。

改法：

1. 在 `setSourcesHidden` 的 `workbenchGrid` 守卫（第 2108–2110 行）之后、计算 `beforeHide` 与 `handOffFocus` 之前，`hidden` 为假时先调用 `this.setAuxiliaryBarMaximized(false)`。它返回真且此时 `this.isVisible(Parts.SOURCES_PART)` 为真，就直接返回，因为还原已经把 Sources 显示出来。
2. 它返回假（本来没有最大化，或正处在最大化过渡里），或返回真但 Sources 仍隐藏时，照现有流程往下走。状态写入、CSS 类、网格、Conversation 与 Preview 与 Sources 至少留一块的补显示、隐藏时的焦点交接都不改。还原过渡里的重入由 `setAuxiliaryBarMaximized` 开头的守卫（第 2470 行）挡住，不会递归。
3. 退出最大化时 `setAuxiliaryBarMaximized` 末尾会 `focusPart(Parts.AUXILIARYBAR_PART)`（第 2538 行），本条不改这一上游行为。Focus Sources 和键盘触发的 Toggle Sources 随后由调用方再聚焦 Sources，最终焦点在 Sources。工具栏点击、菜单和 F1 不带 focus 参数，焦点留在辅助栏，与 Preview 钮的现状相同。
4. `parts-and-grid.md`：第 79 行 `AUXILIARYBAR_PART` 一行补一句「最大化期间显示 Preview、Sources、侧栏或面板会先退出最大化，再按快照恢复」；第 87 行「显示时的焦点」补一句例外：辅助栏最大化时，显示 Preview 或 Sources 会先退出最大化，退出时焦点交给辅助栏；由默认键位或 Focus 命令触发时，随后再聚焦目标区域。改 frontmatter 的 `updated`。
5. `commands.md` §1 第 27 行那一段补同一句例外，改 frontmatter 的 `updated`。

明确不改什么：

- `setConversationHidden`。最大化时 Conversation 本来保持可见（D17），显示它不需要退出最大化。
- `setAuxiliaryBarMaximized` 的快照字段、进入时的隐藏顺序、还原顺序和末尾聚焦辅助栏；`AUXILIARYBAR_LAST_NON_MAXIMIZED_VISIBILITY` 不改。
- `enforceAgentShellVisible`（第 2152 行）与 `ensureAgentShellMinimumVisible`（第 2168 行）在最大化时跳过，这是 `parts-and-grid.md` 第 74–76 行写定的例外。
- 编辑器被自动打开时不退出最大化的规则（第 399–405 行的 `explicitUserAction`）。
- 工作区里 `layout.ts` 尚未提交的隐藏焦点交接（三个 setter 里的 `handOffFocus`）。本条在它之上改，不动那几行。
- 保持 `layoutControlMenu.test.ts` 的 `keyboard toggle args focus the region it shows; toolbar clicks do not` 与 `Panel and Auxiliary Bar stay on LayoutControlMenuSubmenu only`，以及 `layoutArrangeMiddleSection.test.ts` 的三条用例通过。

本地验证：

- 新增 `src/vs/workbench/test/browser/layoutAuxiliaryBarMaximize.test.ts`，沿用 `layoutArrangeMiddleSection.test.ts` 的 `createLayout` 与 `stubWorkbenchGrid` 搭法，按需补桩。那套桩里 `IPaneCompositePartService.getActivePaneComposite` 返回空，`focusPart(Parts.AUXILIARYBAR_PART)` 是空操作；断言五、六另换成记录调用的桩。
- 断言一：Preview 可见、Sources 隐藏时 `setAuxiliaryBarMaximized(true)`，再 `setPartHidden(false, Parts.SOURCES_PART)`；`isAuxiliaryBarMaximized()` 为假，Preview 与 Sources 都可见。
- 断言二：接着 `setPartHidden(false, Parts.EDITOR_PART)`，再调用一次 `setAuxiliaryBarMaximized(false)`，Sources 仍可见。这是发现稿症状的回归断言。
- 断言三：Preview 与 Sources 都可见时进入最大化，两者都被藏起；`setPartHidden(false, Parts.SOURCES_PART)` 之后退出最大化，两者按快照恢复为可见。
- 断言四（对照）：最大化期间先藏起再显示 Conversation，`isAuxiliaryBarMaximized()` 仍为真。
- 断言五（Focus Sources）：`ISourcesPartService.focus` 与辅助栏活动面板（`getActivePaneComposite(ViewContainerLocation.AuxiliaryBar)` 返回带 `focus` 的对象）都往同一个调用列表里记。Sources 隐藏时进入最大化，清空调用列表，再经 `CommandsRegistry` 执行 `workbench.action.focusSources`，访问器交出测试里的 layout。断言 `isAuxiliaryBarMaximized()` 为假、Sources 可见、调用列表依次是辅助栏、Sources。
- 断言六（工具栏点击）：同样的起点，执行不带参数的 `workbench.action.toggleSources`，调用列表只有辅助栏，锁住文档里写的例外。
- 按共同步骤编译后，用 `scripts/test.sh --run` 分别跑新文件、`src/vs/workbench/test/browser/layoutControlMenu.test.ts` 与 `src/vs/workbench/test/browser/layoutArrangeMiddleSection.test.ts`，再跑 `npm run eslint`、`python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`。

### r07-4

核查：`desktop.contribution.ts` 第 237–242 行仍以原说明注册 `window.doubleClickIconToClose`。工作区未提交改动去掉了 `BrowserTitlebarPart.createContentArea`（第 475–484 行）里 Windows / Linux 自定义标题栏的 `a.window-appicon`，也删了 `NativeTitlebarPart` 里读这项设置的 `onConfigurationChanged` 分支、`onUpdateAppIconDragBehavior` 和双击关闭监听。未跟踪的 `titlebarNavigationContract.test.ts` 第 33–34、37 行断言两份标题栏代码和样式里不再出现 `appIcon` / `window-appicon`；`chatgpt-visual-language.md` 第 1578 行记了撤图标和双击接线，没有提这项设置。全仓 `rg doubleClickIconToClose` 只剩注册处。`chrome-title-status.md` 第 33 行仍把 App icon 列为标题栏左侧内容。旧审查里没有这一条。

问题类：标题栏已经不画应用图标，`window.doubleClickIconToClose` 仍以原说明注册，设置编辑器照常展示一项不再起作用的设置。

实施前提：标题栏去图标的改动与 `titlebarNavigationContract.test.ts` 还是别的会话的未提交改动。本条排在它们提交之后；若那份改动收回、应用图标恢复，本条不做。

不变量：

- 设置编辑器只要显示这一项，就带弃用说明：自定义标题栏不再显示应用图标，这项设置不再起作用（渲染见 `settingsTree.ts` 第 1074–1082 行）。分类树里，没配置过这项的用户看不到它（`settingsTreeModels.ts` 第 681–689 行）；搜索结果不按弃用过滤，搜到时同样带这句说明。
- 设置键仍然登记，settings.json 里已有的这一项不报未知设置。
- 运行时没有代码读这项设置。

要动的符号与文件：

- `window.doubleClickIconToClose` 的注册块，文件 `src/vs/workbench/electron-browser/desktop.contribution.ts`（第 237–242 行）。
- `docs/systems/workbench/chrome-title-status.md` §2 第 33 行与 frontmatter 的 `updated`（现为 2026-09-05）。

改法：

1. 在注册块里加 `markdownDeprecationMessage`，另起本地化键，写明自定义标题栏不再显示应用图标、这项设置不再起作用。同文件第 352 行 `enableCrashReporter` 的弃用写法可作参照。`type`、`default: false`、`scope` 不变。
2. 不另加 `included: false`。设置编辑器已经把带弃用说明且未配置的设置排除在分类树外（`settingsTreeModels.ts` 第 681–689 行），`preferencesModels.ts` 第 741–742 行把 `markdownDeprecationMessage` 映射成这份弃用说明。
3. 同一次提交改 `chrome-title-status.md`：§2 左栏的「App icon（Windows / Linux 且非 native titlebar）」一行若仍在，删去，并写一句 `window.doubleClickIconToClose` 已标弃用；frontmatter 的 `updated` 改为实施当天。标题栏导航工具栏的说明属于那份标题栏改动，本条不补。

明确不改什么：

- 不删除这项注册。删除后，配置过的用户会在 settings.json 里看到未知设置的警告。
- `window.titleBarStyle`、`window.closeWhenEmpty` 等相邻设置。
- 标题栏拖动区 `titlebar-drag-region`、窗口控制按钮、辅助窗口标题栏。
- 保持 `titlebarNavigationContract.test.ts` 的 `moves history actions into the left navigation toolbar without creating a logo` 通过。

本地验证：

- 在 `src/vs/workbench/test/node/titlebarNavigationContract.test.ts` 的同一合同里加断言：读 `desktop.contribution.ts`，`'window.doubleClickIconToClose'` 的注册块带 `markdownDeprecationMessage`。若那时该文件改了名，加到撤图标的同一份合同测试里。
- 按共同步骤编译后，用 `scripts/test.sh --run src/vs/workbench/test/node/titlebarNavigationContract.test.ts` 跑，再跑 `npm run eslint`、`python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`。

## 审查

2026-11-07 规则 16 只读审查的结论是须改稿，没有 Critical。Important 四条对照改稿时的工作区核实都属实，已改。I1：r07-1 原测试配方搭不起浮层（`createEditorPart` 建好即 `create()`，注入的 `TestEditorGroupsService` 组元素为空；`TestEditorService.openEditors` 直接抛错；拖放事件上的 uri-list 过不了类型检查；最后一个根组删不掉），已改为手工建 `TestEditorParts` 并在 `create()` 之前注入、给 `ITreeViewsDnDService` 与 `openEditors` 打桩、事件只放 RESOURCES 或 EDITORS、先分出第二个组；uri-list 只留在树项桩返回的传输里，那是 `extractTreeDropData` 读的。I2：页签栏树项分支同样在 `clearData` 之前提前返回（`d707ab25a9c`），已并进 r07-1 一起改；树视图与 `dropIntoEditorController.ts` 不清传输是上游行为，写成实施时登记的缺口。I3：退出最大化聚焦辅助栏，与未提交的 `parts-and-grid.md` 第 87 行、`commands.md` 第 27 行矛盾，而 Preview 钮今天已经如此；r07-3 加了不变量、两篇文档的例外说明步骤和对应断言，不改上游的聚焦。I4：r07-3 写成实施前提，等 `layout.ts` 里隐藏焦点交接那批改动提交后再做，否则只暂存自己的 hunk，并按符号重核了行号。Minor 都已处理：D895 实际统计单层 catch、现在是绿的，原稿写错，已改正；只把 D886 记为与源码不符并写成登记步骤，核对时发现 D886 对 `multiEditorTabsControl.ts` 两处 `onDrop` 调用的双层 catch 断言也不成立，一并写入。`clearData` 改为取到数据就清，替代原来的 try/finally。`allowDropIntoGroup: false` 改为第 141 行。r07-3 的降级理由补了 `defaultVisibility` 为 maximized 的入口和按工作区保存的最大化标记，严重度仍为低。r07-3 补了 Focus Sources 与工具栏点击的断言桩。r07-4 的不变量 1 按设置编辑器的实际过滤范围改写（分类树按弃用过滤，搜索不过滤），文档步骤写明更新 `chrome-title-status.md` 的 `updated`。r07-2 改正了状态栏焦点样式的出处。审查提到的共性问题也已处理：本地验证按先编译、再跑测试、再跑 eslint、改了文档再跑 docs-health 的顺序写；「覆盖需求」写明四条为何不落在现有验收上；共同步骤写明提交时登记 `dev/plans/INDEX.md`。判定与严重度都不变。

## 实施记录（2026-11-07）

用户同意实施并要求不编译。四条都按本稿落到代码、测试和文档里。没有编译，没有跑测试，没有跑 eslint 和 docs-health。工作区里别的会话的未提交改动都原样保留，改动都是针对性替换。

r07-1，已实施：

- `src/vs/workbench/browser/parts/editor/editorDropTarget.ts`：`DropOverlay.handleDrop` 树项与 URI 两支的五处判断改为只看 `this.groupView.disposed`；树项分支取到数据后立即 `clearData`，删去分支末尾那次清理；函数入口加一句约束注释。
- `src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts`：`MultiEditorTabsControl.onDrop` 的树项分支同样取到数据后立即清理，删去末尾那次；`_store.isDisposed` 判断和 `openEditors(...).catch(onUnexpectedError)` 原样保留。
- 新增 `src/vs/workbench/test/browser/parts/editor/editorDropTarget.test.ts`，四条用例对应本稿断言一至四。与方案的出入：树项传输没有自写桩，直接注入真实的 `TreeViewsDnDService<VSDataTransfer>`，用 `DeferredPromise` 卡住树项数据，在它结算之前删组；`IEditorService` 经 `workbenchInstantiationService` 的 `editorService` 覆盖传入一个记录 `openEditors` 的 `TestEditorService` 子类；`splitOnDragAndDrop: false` 经 `configurationService` 覆盖，在建部件之前就位。
- 没做：共同步骤第 5 条的两条缺口登记（树视图与 `dropIntoEditorController.ts` 不清传输；D886 扫描与源码不符）。按本轮规则，共享登记表由父 agent 统一写。

r07-2，已实施：

- `src/vs/workbench/browser/parts/statusbar/statusbarPart.ts`：`StatusbarPart.focus` 的 `else` 改为 `else if (preserveEntryFocus)`，附一句尾注。
- `src/vs/workbench/test/browser/parts/statusbar/statusbarPart.test.ts`：`TestMainStatusbarPart` 加 `focusNextEntry` 计数；新增 `createAttachedPart`、`addLeftEntry`、`entryLabel`、`runStatusbarCommand` 四个辅助函数和四条用例，对应断言一至四。条目首次更新会调用 `setupManagedHover`，所以新用例的 hover 服务用 `NullHoverService`；原来两条用例不动。

r07-3，已实施：

- `src/vs/workbench/browser/layout.ts`：`Layout.setSourcesHidden` 在 `workbenchGrid` 守卫之后先退出辅助栏最大化，写法照 `setEditorHidden`。提交依赖：这三行和别的会话尚未提交的 `handOffFocus` 改动（`interaction-review-2026-11-06.md` 第 53 行那一条与 `ui-interaction-visual-review-2026-11-07.md` §5.2 第 4 条的实施）在同一个 diff hunk 里，提交时要么排在那批改动之后，要么用 `git add -p` 拆开只暂存这三行。
- `docs/systems/workbench/parts-and-grid.md`：第 79 行 `AUXILIARYBAR_PART` 一行补「maximize 期间显示 Editor、Sources、Sidebar 或 Panel 会先退出 maximize」；第 87 行「显示时的焦点」补例外；`updated` 由 2026-11-06 改为 2026-11-07。这篇有别的会话的未提交改动，原样保留。
- `docs/systems/conversation/commands.md`：§1 第 27 行那一段只加一句例外。与方案的出入：方案写了顺带改 frontmatter 的 `updated`；按本轮要求（r09 也要改这篇），这篇只加这一句；`updated` 已由 r09 改为 2026-11-07，本路不再改。
- 新增 `src/vs/workbench/test/browser/layoutAuxiliaryBarMaximize.test.ts`，六条用例对应断言一至六。搭法照抄 `layoutArrangeMiddleSection.test.ts`，只把 Sources 服务和辅助栏活动面板换成记录聚焦的桩。

r07-4，已实施：

- `src/vs/workbench/electron-browser/desktop.contribution.ts`：`window.doubleClickIconToClose` 加 `markdownDeprecationMessage`，本地化键是 `window.doubleClickIconToCloseDeprecated`。
- `docs/systems/workbench/chrome-title-status.md`：删去 §2 左栏的 App icon 一行，补一句标题条不画应用图标、这项设置已标弃用；`updated` 改为 2026-11-07。
- `src/vs/workbench/test/node/titlebarNavigationContract.test.ts`：在同一 suite 里新增一条用例，按注册块切片检查带 `markdownDeprecationMessage`；原用例不动。提交依赖：这个测试文件和标题栏去图标的改动都还是别的会话的未提交改动；新用例读的是本条改过的 `desktop.contribution.ts`，三者要同一批提交，或者本条排在标题栏那批之后。

之后要跑的本地验证（父 agent 统一跑）：

1. `npm run compile-client`（只需刷新产物时可用 `npm run transpile-client`）。
2. `scripts/test.sh --run src/vs/workbench/test/browser/parts/editor/editorDropTarget.test.ts`
3. `scripts/test.sh --run src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD737.test.ts`、`src/vs/workbench/test/node/workbenchEditorLeftoverPromiseCatchScan.test.ts`、`src/vs/workbench/services/dialogs/test/node/dialogHandlerLeftoverPromiseCatchScanD895.test.ts`。`dropOrPasteIntoLeftoverPromiseCatchScanD886.test.ts` 改之前就与源码不符，不作通过判据。
4. `scripts/test.sh --run src/vs/workbench/test/browser/parts/statusbar/statusbarPart.test.ts`、`src/vs/workbench/test/node/statusbarPartCss.test.ts`、`src/vs/workbench/test/node/statusbarRootCss.test.ts`
5. `scripts/test.sh --run src/vs/workbench/test/browser/layoutAuxiliaryBarMaximize.test.ts`、`src/vs/workbench/test/browser/layoutControlMenu.test.ts`、`src/vs/workbench/test/browser/layoutArrangeMiddleSection.test.ts`
6. `scripts/test.sh --run src/vs/workbench/test/node/titlebarNavigationContract.test.ts`
7. `npm run eslint`
8. `python3 scripts/check-docs-health.py` 与 `python3 scripts/wiki/wiki.py check --root .`

代码审查（2026-11-07）：只读代码审查的结论是须修改，已按意见改完，仍未编译、未跑测试。

- Critical，状态栏新用例在 teardown 报泄漏：属实。条目访问器在部件之后才加进 `store`，部件先释放；访问器释放时 `updateCompactEntries()` 给已释放的 `compactEntriesDisposable` 赋新的 `DisposableStore`，而 `MutableDisposable` 已释放时 setter 不接管新值。已改：`createAttachedPart()` 第一行先 `store.add(new DisposableStore())` 并返回 `entries`，四条用例把访问器加进 `entries`，让它们在部件之前释放。
- Important，标题栏契约测试的三个双引号字面量会触发 `local/code-no-unexternalized-strings`：属实，已改成模板字符串。
- Minor，拖放用例断言前只等一次 `timeout(0)`：已改。`RecordingEditorService.openEditors` 结算 `didOpen`，两条正向用例改为等它；两条反向用例断言的是不打开，仍等 `timeout(0)`。
- Minor，`parts-and-grid.md` 第 79 行容易读成任何打开编辑器都会退出最大化：已补半句，编辑器被自动打开（`explicitUserAction === false`）不算显示 Editor，既不显示 Preview，也不退出 maximize。
- 上一轮回复里怀疑 r09 同时在改 `commands.md`，实为编辑工具写盘延迟；第 27 行那句例外仍在。两条 deferred-gaps 登记仍由父 agent 写。
