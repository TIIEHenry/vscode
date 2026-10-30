---
title: "方案 r13：terminal"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "终端装饰清 class 降为潜在残留；隐藏 Chat 条要重排；杀终端按退出焦点；编辑器 mousedown 降为非 xterm 命中；has-text 与列表分界对齐。"
---

# 方案 r13：terminal
状态：草案。
覆盖需求：无（正文未引用需求编号）。


核查 [review-2026-10-06-ui-r13-terminal.md](review-2026-10-06-ui-r13-terminal.md)。引用行号仍是所述代码。本篇只写仍要改的条目。

## r13-1 降级：装饰 class 边删边走

问题类：`_updateClasses` 在活的 `DOMTokenList` 上边遍历边 `remove`，会留下间隔 token。

反证（因此不把「状态一切换就错色」当已证实症状）：

- 命令结束走 `onCommandFinished` → `registerCommandDecoration`。该函数先 `_clearPlaceholder()` 丢掉运行中装饰，再向 xterm 注册新装饰。新元素在 `BufferDecorationRenderer._createElement` 里先只有 `xterm-decoration`（`layer === 'top'` 时才多一个 `xterm-decoration-top-layer`）。单 token 的 `for...of` + `remove` 会删干净。
- 第一次 `onRender` 在缺少 `codicon` 时调用 `_updateClasses`；之后同一元素只有 `marker.line === 0` 才再进。主题与 `workbench.colorCustomizations` 走 `_refreshStyles`，对**同一条命令的当前状态**再刷一遍 class。本机 Chrome 对「失败状态刷两次」得到的 token 集合与刷一次相同（`error` 与失败图标都在，没有运行中 class）。
- 同一元素先按运行中再按失败刷时，Chrome 会留下 `default-color` 和 `codicon-terminal-decoration-incomplete`，并再叠上 `error` 与失败图标。这是循环本身的失败模式，当前完成路径不走这条。

不变量：一次 `_updateClasses` 返回后，元素上的 class 只包含这次 `add` 进去的 token。上一状态的 `error` / `success` / `default` / `default-color` 以及上一枚图标 class 不得留下。

要动：

- `DecorationAddon._updateClasses`（`src/vs/workbench/contrib/terminal/browser/xterm/decorationAddon.ts`）。先把 `classList` 拷成数组再删，或先清空再按现有分支 `add`。`add` 的选择（命令状态、mark、`hide`）保持现在的 `_updateCommandDecorationVisibility` 与 `getTerminalCommandDecorationState`。

不改：

- `registerCommandDecoration`、`onCommandFinished`、占位装饰的销毁时机。
- `onRender` 里「已有 `codicon` 则跳过」的条件。
- 悬停、右键菜单、`refreshLayouts` 的尺寸计算。

验证：在 `src/vs/workbench/contrib/terminal/test/browser/xterm/decorationAddon.test.ts` 的 `DecorationAddon` 套件加一条。对同一元素先用 `exitCode === undefined` 的命令调用 `_updateClasses`，再用 `exitCode !== 0` 调用。断言 class 含 `error` 与失败图标 class，不含 `default`、`default-color`、`success`、`codicon-terminal-decoration-incomplete`。现有 `registerDecoration` 用例的期望不动。

```bash
scripts/test.sh --grep "DecorationAddon"
```

## r13-2：隐藏 Chat 条出现后列表高度不更新

问题类：Chat 隐藏终端条只改 `display`，标签列表的滚动视口仍是上一次 `layout` 记下的高度，底部标签落在裁切区。

不变量：`TerminalTabsChatEntry` 的 `display` 在 `none` 与可见之间切换之后，列表拿到的高度等于最近一次面板 `layout` 传入的高度减去条目高度；条目隐藏时减数为 0。

要动：

- `TerminalTabsChatEntry.update`（`terminalTabsChatEntry.ts`）：在改 `display` 前后比较，把「显隐是否变化」告诉调用方。文案更新保持现状。
- `TerminalTabbedView.layout` / `_updateChatTerminalsEntry`（`terminalTabbedView.ts`）：`layout(width, height)` 的 `height` 是面板高度；字段 `_height` 已是扣掉 Chat 条之后的列表高度。另存面板高度。显隐变化且已经有过面板尺寸时，再用那一对面板宽高调用 `layout`。`layout` 开头继续用 `clientHeight`（`display === 'none'` 则为 0）写入 `_height`，并让分栏里的 `TerminalTabList.layout` 使用这个新高度。
- 只在 `display` 实际变化时再进入 `layout`。`layout` 末尾的 `_updateHasText` 会再调用 `_updateChatTerminalsEntry`；第二次 `display` 不变则停，避免与 `SplitView` 嵌套改尺寸。

不改：

- `terminal.css` 里 `.tabs-list-container` 的 flex、`.terminal-tabs-chat-entry` 的 22px、`.monaco-list { height: 100% }`。列表 DOM 本来随 flex 变矮，缺的是 `ListView.layout` 写进滚动模型的那一截高度。
- `TerminalView.onDidChangeInstances` 里的 `layoutBody`。隐藏条出现走的是 `onDidRegisterTerminalInstanceWithToolSession`（在 `createTerminal` 的实例事件之后），那条路径没有 `layoutBody`。
- Chat 条的点击、删除、无障碍文案。

验证：现无 `TerminalTabbedView` 测试。新增 browser 测试，断言两件事：条目从 `display:none` 变为可见后，`TerminalTabList.layout` 的 height 为面板高度减条目 `clientHeight`；再变为 `none` 后 height 回到面板高度。构造整页过重时，把「显隐变化才用上次面板尺寸再 `layout`」抽出来测，并断言传入的是扣减前的面板高度。

```bash
scripts/test.sh --grep "TerminalTabbedView"
```

## r13-3：拆分组关掉活动终端时抢走焦点

问题类：组里还有实例时，关掉当前活动终端会无条件 `focus(true)`，编辑器或其它视图里的焦点被拉进下一个终端。

不变量：被关掉的实例在退出时没有焦点，则只切换活动索引，不调用 `focus`。它退出时确有焦点，才对下一个活动实例 `focus(true)`。

要动：

- `TerminalGroup._removeInstance`（`terminalGroup.ts` 约 387–392 行）。`TerminalInstance.dispose` 在 `xterm.raw.element` 存在时先把 `hasFocus` 写入 `hadFocusOnExit`，然后才 `dispose` xterm 并 `fire` `onDisposed`。组的处理发生在这次 `onDisposed` 上，此时再读 `hasFocus` 已经不可靠。条件使用 `instance.hadFocusOnExit`。`setActiveInstanceByIndex` 仍执行。

不改：

- `TerminalInstance.focus` 的 `force` 语义。
- `TerminalGroupService._removeGroup`：整组消失时已经用 `group.hadFocusOnExit` 决定是否 `focus`。
- 关掉的不是活动实例时，只递减 `_activeInstanceIndex` 的分支。

验证：现无 `TerminalGroup` 单测。新增测试两则：活动实例 `hadFocusOnExit === false` 且组内仍有实例时，下一个实例的 `focus` 不被调用；`hadFocusOnExit === true` 时，`focus` 以 `true` 被调用一次。

```bash
scripts/test.sh --grep "TerminalGroup"
```

## r13-4 降级：编辑器 mousedown 读了活动实例

问题类：终端编辑器的 `mousedown` 把中键与「是否取消菜单」交给 `TerminalEditorService.activeInstance`，同文件的 `contextmenu` 用的是本页 `_editorInput.terminalInstance`。

反证（因此不把「点在终端网格上就会作用到另一页」当主路径）：

- xterm 对元素上的 `mousedown` 始终调用 `focus()`（`MouseService._handleMouseDown`）。`TerminalInstance` 在 textarea 的 `focus` 上同步 `fire` `onDidFocus`。`TerminalEditor.setInput` 里订阅了它并 `setActiveInstance(本页实例)`。监听在 `_editorInstanceElement` 上、冒泡阶段；xterm 元素是其子节点，焦点切换发生在这次冒泡到达编辑器监听之前。
- 点在 xterm 网格上时，监听读到的 `activeInstance` 已经是本页。仍会错的是命中 `_editorInstanceElement` 但不经过 xterm 元素的按下（溢出层留白、与 xterm 并列的滚动条）：`handleMouseEvent` 里的中键 `focus` 和 `cancelContextMenu` 会算到另一页，而随后的 `contextmenu` 仍打开本页实例。

不变量：该编辑器页上的 `mousedown` 与 `contextmenu` 使用同一个 `ITerminalInstance`，即本页 `_editorInput.terminalInstance`。本页没有实例时不改用服务里的活动实例。

要动：

- `TerminalEditor._registerListeners` 的 `mousedown`（`terminalEditor.ts` 约 131–138 行）。在任何 `await` 之前把终端定为 `this._editorInput?.terminalInstance`。`handleMouseEvent`、`_cancelContextMenu` 与后面的 `contextmenu` 分支保持原样。

不改：

- `terminalTabbedView.ts` 里面板容器的 `mousedown`。那里一个容器对应组服务的活动实例。
- `TerminalInstance.handleMouseEvent` 的中键/右键规则。
- xterm 的 focus 时机。

验证：现无覆盖这段监听的测试（`terminalEditorSerializer.test.ts` 只覆盖序列化）。新增测试：两个终端编辑器实例并存、服务的 `activeInstance` 是另一页时，在本页编辑器元素上派发 `mousedown`（右键或中键），`handleMouseEvent` 的接收者是本页 `_editorInput.terminalInstance`。

```bash
scripts/test.sh --grep "TerminalEditor"
```

## r13-5：窄/宽分界两边比较不一致

问题类：同一 `MidpointViewWidth`（`(46 + 80) / 2`，即 63），容器用 `clientWidth > 63` 决定 `has-text`，列表用布局宽度 `>= 63` 决定是否画出标题。

不变量：给定同一次布局宽度 `w`，`TerminalTabList.hasText` 与 `_tabContainer` 的 `has-text` 同为 `w >= TerminalTabsListSizes.MidpointViewWidth`。

要动：

- 比较只保留一份，与 `_updateListWidth` 的宽侧一致：`w >= TerminalTabsListSizes.MidpointViewWidth` 为有文字。`_updateListWidth` 把 `>= Midpoint && < WideViewMinimumWidth` 收到 80，窄侧收到 46。
- 两边使用同一个宽度数：分栏交给 `TerminalTabList.layout` 的那个 `width`。`_updateHasText` 今天读的是 `.tabs-list` 的 `clientWidth`。`.tabs-container` 在左右分栏上有 1px 边框（`terminal.css` 里 `.split-view-view:first-child .tabs-container` / `:last-child`），内容盒会比分栏宽度少 1px。只把 `>` 改成 `>=` 仍会在分栏宽度 63 上分歧。
- `rerenderTabs` 只 `_updateHasText` 再 `refresh()`。`refresh` 不重算 `_hasText`。容器 class 与列表 `_hasText` 都从上述同一宽度来，而不是各读各的 DOM。

不改：

- `_updateListWidth` 的吸附（46 / 80）、`ActionbarMinimumWidth` 的 `>`、`NarrowViewWidth` / `DefaultWidth` / `MaximumWidth`。
- 拖拽 sash 时每 100ms `rerenderTabs` 的节流。
- Chat 条按 `has-text` 切换完整文案或数字的逻辑；class 对齐后它跟着容器走。

验证：现无这条阈值的测试。新增断言：宽度 63 时列表 `hasText` 与容器 `has-text` 都为真；宽度 62 时都为假。断言使用的是布局宽度，不把 `.tabs-list.clientWidth` 单独再比一次。吸附边界仍是小于 63 收到 46、大于等于 63 且小于 80 收到 80。

```bash
scripts/test.sh --grep "TerminalTabList"
```
