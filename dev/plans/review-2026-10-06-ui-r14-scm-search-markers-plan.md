---
title: "方案 r14：scm-search-markers"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 2，drop 0，weaken 1。表视图 autoReveal 改用可见行下标；装饰开关补上监听；搜索取消只修焦点与返回值。"
---

hold 2，drop 0，weaken 1

# 方案 r14：scm-search-markers
状态：草案。
覆盖需求：无（正文未引用需求编号）。


r14-1、r14-3 按读到的行号 hold。r14-2 降为低。没有 drop。

## r14-1（中）

- 问题类：Problems 为 Table 且 `problems.autoReveal` 开启时，`MarkersTable.revealMarkers` 在该资源没有已选中问题的分支里把 `resourceMarkers` 下标传给 `table.reveal`；活动编辑器一切换，列表滚到别的问题，可见行数小于该下标时 `List.reveal` 抛出 `ListError`。
- 不变量：`hasSelectedMarkerFor` 为真时仍用 `this.table.getSelection()[0]` 和 `lastSelectedRelativeTop` 做 `reveal`，`focus` 为真时仍 `setFocus(tableSelection)`。未选中时，行下标是当前表里第一条满足 `activeResource.has(row.resource)` 的可见行；没有这样的行时不调用 `reveal` / `setFocus` / `setSelection`。`focus` 为真且下标有效时，`setFocus` 与 `setSelection` 用同一个下标。`autoReveal()` 的两处调用（`markersView.ts` 第 613、670 行）仍不传 `focus`，实参保持默认 `false`。`problems.autoReveal` 为假或 `filters.activeFile` 为真时，`markersView.ts` 第 778–783 行仍直接返回。
- 要动的符号或文件：`src/vs/workbench/contrib/markers/browser/markersTable.ts` 的 `revealMarkers`（第 510–535 行），第 522–528 行的 `else` 改为按可见行查找。把「可见行 URI 序列 + `ResourceMarkers` → 第一行下标或 -1」收成 `markersModel.ts` 的导出函数，内部用 `ResourceMarkers.has`。`MarkersTable` 把 `this.table.row(i).resource` 按表顺序交给该函数。
- 明确不改什么：不改第 515–520 行已选中分支。不改 `hasSelectedMarkerFor`（第 587–598 行；`MarkerTableItem` 继承 `Marker`，`instanceof Marker` 仍成立）。不改 `reset` 第 495–507 行按严重级别、URI、范围排序。不改 `markersModel.ts` 第 24–34 行与第 155–159 行按资源排序。不改 `findMarkerIndex`、`setMarkerSelection`、`update`。不改树视图 `MarkersView.revealMarkers`（`markersView.ts` 第 987–1009 行，那里 `reveal` 的是资源节点）。不改 `autoReveal` 的调用点。
- 怎样本地验证：`src/vs/workbench/contrib/markers/test/browser/markersModel.test.ts` 的 suite `MarkersModel Test` 没有表行下标用例。在该 suite 为上述函数新增断言：可见行顺序是文件 B 的一条、文件 A 的一条，而 A 在 `resourceMarkers` 里排在 B 前面时，A 的返回值是 1；同一资源连续两行时返回第一行；可见行不含该资源时返回 -1；空序列返回 -1。命令：`scripts/test.sh --run src/vs/workbench/contrib/markers/test/browser/markersModel.test.ts`。

## r14-2（降为低）

- 问题类：`SearchView.cancelSearch` 把 `searchWidget.focus()` 和返回值放在两次 `cancel` 都为 true 的条件里；文本搜索已经取消、语义搜索令牌源仍是 null 时，方法返回 false，并且不把焦点放回搜索框。
- 反证：第 1445–1450 行的 `&&` 仍在。`SearchModelImpl.cancelSearch`（`searchModel.ts` 第 394–400 行）在 `currentCancelTokenSource` 非 null 时返回 true，该字段只在 `doSearch` 第 173 行赋值，搜索结束时 `dispose(true)` 并不把它清成 null。`cancelAISearch`（第 402–411 行）对 `currentAICancelTokenSource` 同样处理，赋值在 `aiSearch` 第 132 行。`aiSearch` 在第 125–127 行要求已有 `_searchQuery`，而 `_searchQuery` 只在 `search()` 第 224 行赋值，且 `search()` 会进入 `doSearch`。因此语义搜索能跑的时候，文本令牌源已经不是 null，`cancelSearch()` 返回 true，`&&` 右侧的 `cancelAISearch()` 会执行。已结束搜索的令牌再次 `cancel()` 时，`MutableToken.cancel`（`cancellation.ts` 第 65–70 行）在 `_isCancelled` 之后直接返回，模型方法仍返回 true。`clearSearchResults`（`searchView.ts` 第 1432–1433 行）本来就各调一次。发现稿里「文本没在跑就停不掉语义搜索，进度还会继续写」与这条令牌生命周期对不上。剩下的行为是：语义令牌源仍为 null 时，合取为 false。结果列表上的 Escape 走 `CancelSearchAction`（`searchActionsTopBar.ts` 第 285–288 行），`cancelSearch()` 的 `focus` 默认 true，此时搜索已停，焦点留在列表。搜索框里的 Escape（`searchWidget.ts` 第 710–711 行）同样传 `focus: true`，`searchWidget.focus()`（第 259–276 行，默认会选中查询文本）不会跑。返回值没有调用方读取。
- 不变量：`viewModel.cancelSearch()` 与 `viewModel.cancelAISearch()` 都调用，不论前者返回什么。两者有一个为 true 时方法返回 true；`focus` 为 true 时才 `searchWidget.focus()`。两者都为 false 时不聚焦并返回 false。`focus` 为 false 时（包含/排除框的 `onCancel`，第 565、586 行）即使取消成功也不聚焦。模型层两个 `cancel*` 的返回条件、令牌字段的生命周期保持原样。
- 要动的符号或文件：`src/vs/workbench/contrib/search/browser/searchView.ts` 的 `cancelSearch`（第 1445–1450 行）。把「先调用两个取消函数，再按或以及 `focus` 决定是否聚焦并返回」收成同文件导出函数，`cancelSearch` 只把 `viewModel.cancelSearch`、`viewModel.cancelAISearch` 和 `searchWidget.focus` 传进去。
- 明确不改什么：不改 `SearchModelImpl.cancelSearch` / `cancelAISearch`，不清空两个令牌源字段。不改 `clearSearchResults` 第 1432–1433 行、`onQueryTriggered` 第 1779 行的 `cancelSearch(true)`、`clearAIResults` 第 1979 行的 `cancelAISearch(true)`。不改 `CancelSearchAction` 的 when 与快捷键。不改 `searchWidget.focus` 的选中默认值。
- 怎样本地验证：`src/vs/workbench/contrib/search/test/browser/searchModel.test.ts` 有 `Search Model: Previous search is cancelled when new search is called`，不断言 `SearchView.cancelSearch`。`searchViewlet.test.ts` 的 suite `Search - Viewlet` 也没有。在 `searchViewlet.test.ts` 为上述函数新增断言：文本取消返回 false 时语义取消函数仍被调用；文本 true、语义 false、`focus` true 时聚焦函数被调用且返回 true；同一结果且 `focus` false 时不聚焦且返回 true；两边都 false 且 `focus` true 时不聚焦且返回 false；文本 false、语义 true、`focus` true 时聚焦且返回 true。命令：`scripts/test.sh --run src/vs/workbench/contrib/search/test/browser/searchViewlet.test.ts`。

## r14-3（中）

- 问题类：只改 `problems.decorations.enabled` 时，`MarkersFileDecorations` 不跑 `_updateEnablement`，资源管理器上的错误/警告角标保持改之前的注册状态。
- 不变量：`problems.visibility` 与 `problems.decorations.enabled` 任一变化都调用 `_updateEnablement`。启用条件仍是第 87–88 行的 `problem && value.decorations.enabled`。`problem === undefined` 时第 84–86 行仍直接返回。计算出的开关与 `this._enabled` 不同时，仍走第 98–104 行：为真则 `registerDecorationsProvider`，为假则在已有提供者时 `dispose`。两个键都不变时不调用 `_updateEnablement`。
- 要动的符号或文件：`src/vs/workbench/contrib/markers/browser/markersFileDecorations.ts` 构造函数里的配置监听（第 67–74 行）。把「变更是否涉及 `problems.visibility` 或 `problems.decorations.enabled`」收成同文件导出函数，监听回调用它决定是否 `_updateEnablement`。
- 明确不改什么：不改 `_updateEnablement` 第 82–105 行，包括第 90–95 行相等时的处理。不改 `MarkersDecorationsProvider.provideDecorations`。不改第 108–118 行 `problems.decorations.enabled` 的注册与默认值 `true`。不改 `workbench.contribution.ts` 第 1018–1022 行 `problems.visibility` 的默认值 `true`。不改 `markers.contribution.ts` 第 612 行状态栏对 `problems.visibility` 的监听。监听的键只包含上述两个，`problems.autoReveal`、`problems.defaultViewMode`、`problems.sortOrder`、`problems.showCurrentInStatus` 不进入这次回调。
- 怎样本地验证：`src/vs/workbench/contrib/markers/test/browser/` 下没有装饰启用用例。在 `markers.contribution.test.ts` 为上述函数新增断言：假事件只报告 `problems.decorations.enabled` 时为真；只报告 `problems.visibility` 时为真；只报告 `problems.autoReveal` 时为假；两个键都不报告时为假。命令：`scripts/test.sh --run src/vs/workbench/contrib/markers/test/browser/markers.contribution.test.ts`。
