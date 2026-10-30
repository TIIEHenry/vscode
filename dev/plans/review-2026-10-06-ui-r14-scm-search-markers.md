---
title: "审查 r14：scm-search-markers"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "Problems 表视图 autoReveal 用错行索引；取消搜索短路漏取消防语义搜索；文件装饰开关改了不刷新。"
---

# 审查 r14：scm-search-markers
状态：草案。
覆盖需求：无（正文未引用需求编号）。


范围：`src/vs/workbench/contrib/scm`、`search`、`markers`。已对照 [review-2026-10-06.md](review-2026-10-06.md) 与 [r10 contrib](review-2026-10-06-r10-contrib.md)（含笔记本搜索残留 r10-5；活码已用 `applyEditorWidgetFindToCellMatches` 覆盖，不再报）。无其它命中跳过。

## r14-1 中

- 症状：Problems 为 Table 视图且开启 `problems.autoReveal` 时，切换活动编辑器后列表滚动/选中落在错误行，当前文件的问题不一定出现在视口内。
- 引用：

```510:528:src/vs/workbench/contrib/markers/browser/markersTable.ts
	revealMarkers(activeResource: ResourceMarkers | null, focus: boolean, lastSelectedRelativeTop: number): void {
		if (activeResource) {
			const activeResourceIndex = this.resourceMarkers.indexOf(activeResource);

			if (activeResourceIndex !== -1) {
				if (this.hasSelectedMarkerFor(activeResource)) {
					const tableSelection = this.table.getSelection();
					this.table.reveal(tableSelection[0], lastSelectedRelativeTop);

					if (focus) {
						this.table.setFocus(tableSelection);
					}
				} else {
					this.table.reveal(activeResourceIndex, 0);

					if (focus) {
						this.table.setFocus([activeResourceIndex]);
						this.table.setSelection([activeResourceIndex]);
					}
				}
			}
```

- 为什么是问题：`activeResourceIndex` 是按「资源」在 `resourceMarkers` 里的下标；表行是扁平的 `MarkerTableItem`，并按严重级别/URI/位置排序。同一下标在表里通常是别的文件的某一条问题。树视图同名逻辑用的是树节点本身，表视图这条路径没有换算成该资源的首行表索引。
- 方向：先在表数据里定位该 `ResourceMarkers` 对应的第一条（或当前选中）行索引，再用该索引 `reveal` / `setFocus` / `setSelection`。

## r14-2 中

- 症状：仅语义/AI 搜索在跑时，Escape 或「取消搜索」不会停掉该搜索；进度与结果仍可能继续写入。
- 引用：

```1445:1450:src/vs/workbench/contrib/search/browser/searchView.ts
	cancelSearch(focus: boolean = true): boolean {
		if (this.viewModel.cancelSearch() && this.viewModel.cancelAISearch()) {
			if (focus) { this.searchWidget.focus(); }
			return true;
		}
		return false;
	}
```

- 为什么是问题：`&&` 短路。文本搜索未在跑时 `cancelSearch()` 为 `false`，`cancelAISearch()` 根本不会执行；展开 AI 结果节点触发的 `addAIResults`、关键词建议触发的 `aiSearch` 等场景下用户取消无效。即便两边都在跑，一侧已取消另一侧返回 `false` 时也不会按 `focus` 把焦点收回输入框。
- 方向：分别调用两次 cancel，用「任一为 true」决定是否聚焦并返回。

## r14-3 中

- 症状：改 `problems.decorations.enabled` 后，资源管理器等处的错误/警告角标不立刻出现或消失，要等再动 `problems.visibility` 或重载才一致。
- 引用：

```67:74:src/vs/workbench/contrib/markers/browser/markersFileDecorations.ts
		this._disposables = [
			this._configurationService.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration('problems.visibility')) {
					this._updateEnablement();
				}
			}),
		];
		this._updateEnablement();
```

```87:88:src/vs/workbench/contrib/markers/browser/markersFileDecorations.ts
		const value = this._configurationService.getValue<{ decorations: { enabled: boolean } }>('problems');
		const shouldEnable = (problem && value.decorations.enabled);
```

- 为什么是问题：开关实际依赖 `problems.visibility` 与 `problems.decorations.enabled`（后者在同文件注册），但配置监听只认 `problems.visibility`。单独改装饰开关时 `_updateEnablement` 不跑，装饰提供者仍按旧状态注册或未注册。
- 方向：配置变更时同时监听 `problems.decorations.enabled`（或 `problems`），再调用 `_updateEnablement`。
