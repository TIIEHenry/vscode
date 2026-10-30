---
title: "方案 r06：views"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "清掉隐藏消息的 _messageValue，空欢迎不再占焦点，常量视图按 id 折叠。"
---

# 方案 r06：views
状态：草案。
覆盖需求：无（正文未引用需求编号）。


对照 `dev/plans/review-2026-10-06-ui-r06-views.md` 打开引用文件。四处行号与当前行为一致。处置：hold 2，weaken 1，drop 1。drop 只记原因。

| 条目 | 处置 |
|:-----|:-----|
| r06-1 | hold |
| r06-2 | drop |
| r06-3 | weaken |
| r06-4 | hold |

## r06-2 drop

`TreeViewPane.focus`（`treeView.ts` 第 125–128 行）先 `super.focus()`，再 `this.treeView.focus()`。有可见欢迎文案时，`ViewPane.focus`（`viewPane.ts` 第 677–679 行）把焦点放在 `.welcome-view-content`。`views.css` 第 104–106 行把 `.pane-body.welcome` 下非 `.welcome-view` 的直接子节点设为 `display: none`，树宿主 `.tree-explorer-viewlet-tree-view` 就在其中。`AbstractTreeView.focus`（第 663–677 行）随后对树 `domFocus()`。

本机 Chrome 用同一对选择器：欢迎区已聚焦时，再对 `display: none` 子树调用 `focus()`，`document.activeElement` 仍是欢迎节点。欢迎按钮仍在 Tab 序里。发现稿写的「焦点被藏起的树抢走、键盘到不了欢迎按钮」不出现。

## r06-1 hold

问题类：消息 DOM 已藏起后 `_messageValue` 仍为真，空树且没有拖放控制器时树容器被加上 `hide`，欢迎层又没盖住时整块视图空白。

不变量：

- 当前没有要展示的消息时，空树容器保持可见。
- 正在展示消息、树空、`refreshing === false`、且没有 `dragAndDropController` 时，仍只显示消息并藏起树。
- 有 `dragAndDropController` 时，即使有消息也不给树容器加 `hide`。
- `pane-body` 带 `welcome` 且有可见欢迎文案时，树宿主继续由 `views.css` 藏起，用户看到欢迎页。空白只出现在欢迎类不在、消息和树又都带 `hide` 的时候。

要动的符号：`AbstractTreeView.hideMessage`（`src/vs/workbench/browser/parts/views/treeView.ts`）。这里清掉 `_messageValue`。若当前值是 `isRenderedMessageValue`，先 `disposables.dispose()` 再置 `undefined`。`updateMessage` 已经在 `hideMessage` 之后调用 `updateContentAreas`（第 903–906 行）；值清掉后，第 1157 行的判断为假，会走第 1163–1164 行去掉树容器的 `hide`。

明确不改：`showMessage`、`shouldShowWelcome`、`views.css` 的 `.hide` 与 `.welcome` 规则、拖放例外、`refreshing` 期间不藏树。不在 `hideMessage` 里再调一次 `updateContentAreas`。

本地验证：没有覆盖这条的测试名。现有 `src/vs/workbench/test/browser/treeview.test.ts` 的 `TreeView` / `children are batched` 在 setup 里已经挂上 dataProvider，覆盖不了这条路径。在该文件另起测试，自己 `new`/`createInstance` 一个 `TreeView` 并 `show` 到容器：

- 尚无 dataProvider 时，`.message` 没有 `hide`，文案为 no data provider。
- 再设 dataProvider，且 `getChildren` 对根返回空数组、`message` 为空：`.message` 有 `hide`，`.customview-tree` 没有 `hide`。
- 另设 `dragAndDropController` 且仍在显示消息、树空：`.customview-tree` 没有 `hide`。
- 消息曾是 `MarkdownString` 再被清掉时，渲染用的 `DisposableStore` 已 dispose（该文件已有 `ensureNoDisposablesAreLeakedInTestSuite`）。

树容器要等 `show` 建出 `.customview-tree` 之后再断言；`create` 里第一次 `updateMessage` 发生在 `treeContainer` 赋值之前。命令：`scripts/test.sh --grep "TreeView"`。

## r06-3 weaken

问题类：应显示欢迎但没有任何可见文案时，`_enabled` 仍为 true，欢迎 DOM 留在已去掉 `welcome` 类的 pane-body 里；焦点可能停在这块不可见子树上，或这次 `focus()` 根本到不了正文。

反证：

- 行号仍是 `viewPane.ts` 第 225–234 行与第 677–679 行，`views.css` 第 104–105 行仍把 `:not(.welcome) > .welcome-view` 设为 `display: none`。`render` 在 `contents.length === 0` 时只 `classList.remove('welcome')`，`_enabled` 只在 `onDidChangeViewWelcomeState`（第 155 行）按 `shouldShowWelcome()` 赋值，无文案路径不会把它改回 false。
- 本机 Chrome：对已经 `display: none` 的欢迎节点调用 `focus()`，`activeElement` 不变。因此「`ViewPane.focus` 把焦点送进隐藏节点」这条因果不成立。
- `TreeViewPane.focus` 在 `super.focus()` 之后还会 `treeView.focus()`。欢迎类被去掉后树宿主可见，空树会走到 `AbstractTreeView.focus` 第 673–674 行的 `tree.domFocus()`。发现稿写的「树拿不到焦点」在树视图上不出现。
- 同一 Chrome 实验里，节点在可见时已经是 `activeElement`，再给祖先套上 `display: none`，焦点留在该节点上。这条才是隐藏欢迎区会吞掉键盘的路径。`WelcomeView`（`src/vs/workbench/contrib/debug/browser/welcomeView.ts`）和 `EmptyView`（`src/vs/workbench/contrib/files/browser/views/emptyView.ts`）不覆盖 `focus()`，`ViewPane.focus` 在 `_enabled` 为 true 时不会改到 `this.element`。

不变量：

- 有可见欢迎描述（含 `when === 'default'` 的兜底项）时，`pane-body` 带 `welcome`，`ViewPane.focus` 仍进 `.welcome-view-content`。
- 无可见描述且无 default 时，`viewWelcomeController.enabled` 对 `ViewPane.focus` 为假，pane-body 无 `welcome` 类。
- 文案从有到无时，若 `activeElement` 在 `.welcome-view` 内，藏起或拆掉该子树的同时焦点离开它。
- 上下文稍后重新匹配出文案时，欢迎区还要出现。`onDidChangeContext` 监听保持挂着。无文案时不能 `enabledDisposables.clear()`，那会拆掉上下文监听，以后匹配到文案也不会再 `render`。

要动的符号：`ViewWelcomeController`（`src/vs/workbench/browser/parts/views/viewPane.ts`）。`render` 在 `getContentDescriptors()` 为空时：去掉 `welcome` 类；若 `activeElement` 在欢迎子树内，把焦点移到 pane-body（或先 blur 再让后续 `focus()` 落到正文）；让 `enabled` 在「`shouldShowWelcome()` 为真且当前有可见文案」时才为 true。订阅用的 `_enabled` 与「正在展示」分开，避免无文案时拆掉 `onDidChangeContext`。`ViewPane.focus` 继续只看 `viewWelcomeController.enabled`；getter 与真实展示对齐后，第 677–679 行不用改分支结构。

明确不改：`views.css` 选择器，各子类的 `shouldShowWelcome`，有文案时的按钮和链接渲染，`treeView.ts` 的 `focus`（r06-2 已 drop）。

本地验证：没有现成测试名。新增 workbench browser 测试，最小 `ViewPane` 子类 `shouldShowWelcome` 恒为 true：

- 不注册欢迎文案就 `renderBody` 后 `focus`：容器无 `welcome` 类，`activeElement` 不在 `.welcome-view` 内。
- 注册带 `when` 的文案并先让其可见、聚焦 `.welcome-view-content`，再让 `when` 失败：容器无 `welcome` 类，`activeElement` 不在 `.welcome-view` 内。
- 同一 `when` 再次匹配：容器回到带 `welcome`，`focus` 后 `activeElement` 在 `.welcome-view-content` 内。
- 有 `when === 'default'` 且没有其它可见项时，欢迎区仍显示。

命令：`scripts/test.sh --grep` 加这条新测试名。

## r06-4 hold

问题类：`ViewPaneContainer.onDidAddViewDescriptors` 在 `render` 抛错时 `continue`，返回的 `panes` 比 `added` 短且下标错位；`FilterViewPaneContainer` 仍用 `added[i]` 取 `panes[i]`，常量视图会 `setExpanded` 到别的视图或碰到 `undefined`。

不变量：

- 同一批里某个视图 `render` 抛错时，其余视图仍加入容器，调用本身不抛。
- `constantViewDescriptors` 里的视图，只要对应 pane 真的加进来了，就被 `setExpanded(false)`。
- 失败项之后的非常量视图保持添加时的展开态（`expanded: !collapsed`），不被这段循环折叠。
- 返回数组仍然只含渲染成功且进入 `panesToAdd` 的 pane，顺序仍是成功项的相对顺序。

要动的符号：`FilterViewPaneContainer.onDidAddViewDescriptors`（`src/vs/workbench/browser/parts/views/viewsViewlet.ts` 第 121–126 行）。按 `pane.id === viewDescriptor.id` 查找再 `setExpanded(false)`；找不到就跳过。不要用 `added` 的下标，也不要只把 `panes[i]` 改成可选调用（下标错位时可选调用会折叠错视图）。父类 `restoreViewSizes`（`viewPaneContainer.ts` 第 719–723 行）已经按 id 查找，并写明 render 失败时描述符可以没有对应 pane。

生产子类只有 `RemoteViewPaneContainer`（`src/vs/workbench/contrib/remote/browser/remote.ts`），常量视图是帮助面板。运行和调试视图没有这条覆盖。

明确不改：父类 `render` 失败时的 `try/catch` + `continue`（第 797–801 行），`extensionsViewlet.ts` 里另一处 `onDidAddViewDescriptors`（它把返回数组当成功列表用，不用下标对齐），远程视图的过滤和帮助面板 `when`，常量视图「加进来就折叠」这件事本身。

本地验证：没有现成测试名。新增 browser 测试，子类化 `FilterViewPaneContainer`，同一批 `added` 里第一项的 `render` 抛错，第二项 id 在 `constantViewDescriptors`：

- 调用不抛。
- 返回数组不含失败项。
- 按 id 找到的常量 pane 为折叠。
- 若常量项前面有失败项、后面还有一个渲染成功的非常量 pane，该非常量 pane 仍是添加时的展开态。

命令：`scripts/test.sh --grep` 加这条新测试名。
