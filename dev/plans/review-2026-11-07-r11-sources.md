---
title: "十六路审查 2026-11-07 r11：contrib/sources 发现"
type: reference
status: draft
phase: N/A
updated: 2026-11-07
summary: "只读审查 contrib/sources 近期提交与未提交改动，记录 5 条：手动刷新后自动刷新停摆、收起目录被重画撤销、整文件 diff 上 Accept 切错 hunk、审阅标记随变更记录上限丢失、Review 选中跨会话搬到无关行。"
---

# 十六路审查 2026-11-07 r11：contrib/sources 发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。

范围是 `src/vs/workbench/contrib/sources/`。本次先看 2026-10-30 之后的提交（`sourcesChangesReadModel.ts` 的刷新串行化、`sourcesReviewProgressService.ts` 的变更记录上限、11-01 的 IDEA 式 Changes 目录树），再看工作区里的未提交改动（Changes 的键盘操作与右键 Stage、筛选框键盘出口与清除链接、Review 的路径筛选随会话清除与焦点保持、Preview diff 记住变更身份后再移动、tab 切换命令、Files 列表模式跟随会话根、`isWorkDirCompatible` 接受子目录），并顺着调用核对了 Conversation diff pane、Diff Panel、Accept 的 hunk 切片和写闸。`SourcesChangesIdeaPanel` 与 `SourcesCommitRow` 只被再导出，生产代码里没有实例，没有计入。下面 5 条都来自这次读到的活码（含未提交改动）。

### r11-1

- 严重度：中
- 症状：引擎已连接、后台定时刷新正在等 `ReadGitChanges` / `ReadGitSummary` 返回时，用户点了 Changes 工具栏的 Refresh。此后 Changes 和 Review 两个列表都不再自动刷新：代理改了文件、本地 SCM 有变化、在列表里 Stage 或 Commit 之后，行都停在旧状态。只有再手动点 Refresh 才更新一次，切换会话后才恢复。
- 代码：`src/vs/workbench/contrib/sources/common/sourcesChangesReadModel.ts` 95–98、126–144、180–182；入口在 `src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts` 656–661。

```95:98:src/vs/workbench/contrib/sources/common/sourcesChangesReadModel.ts
		if (this.refreshRunning) {
			this.refreshAgain = true;
			return;
		}
```

```126:144:src/vs/workbench/contrib/sources/common/sourcesChangesReadModel.ts
	private async runScheduledRefresh(): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}
		this.refreshRunning = true;
		this.refreshAgain = false;
		const generation = ++this.readGeneration;
		try {
			await this.refreshWithGeneration(generation);
		} finally {
			if (generation === this.readGeneration) {
				this.refreshRunning = false;
				if (this.refreshAgain && !this._store.isDisposed) {
					this.refreshAgain = false;
					this.scheduleRefresh();
				}
			}
		}
	}
```

```180:182:src/vs/workbench/contrib/sources/common/sourcesChangesReadModel.ts
	async refresh(): Promise<void> {
		return this.refreshWithGeneration(++this.readGeneration);
	}
```

```656:661:src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts
		this._register(this.refreshButton.onDidClick(() => {
			if (this._store.isDisposed) {
				return;
			}
			void this.changesModel.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
		}));
```

- 为什么是问题：`runScheduledRefresh` 先把 `refreshRunning` 置真并取一个新代次，只有结束时这个代次仍等于 `readGeneration`，才把 `refreshRunning` 放回假。公开的 `refresh()` 同样把 `readGeneration` 加一，却不碰 `refreshRunning`，也不做收尾。于是：定时刷新用代次 G1 发出引擎读取并在等待；用户点 Refresh，`refresh()` 用 G2 读完并更新快照；G1 的读取返回时已经过期，`finally` 里的判断不成立，`refreshRunning` 一直停在真。此后每次 `scheduleRefresh` 都停在 95–98 行，只记下 `refreshAgain`，不再排定时器。能把它放回假的只有 88–93 行的会话切换分支；`flushScheduledRefresh` 在生产代码里没有调用方，两个列表只在 `refreshScheduler` 代理里引用它，而这两个代理只被 `void` 掉（`sourcesChangesList.ts` 552、739 行，`sourcesReviewList.ts` 239、352 行）。连接变化、会话变化、SCM 资源变化，以及列表写成功后的 `scheduleRefresh`（`sourcesChangesList.ts` 1743、1787、2052 行）都会被吞掉。测试里没找到覆盖手动刷新与定时刷新重叠的用例。
- 方向：手动刷新和定时刷新共用同一个运行标记与收尾；代次被取代时也要清掉 `refreshRunning`，并补跑挂起的那次刷新。

### r11-2

- 严重度：中
- 症状：在 Changes 里收起一个分组或目录（点分组头、点目录行、用本次新加的 Left 键，或点 Collapse All Folders），列表下一次重画时所有分组和目录又全部展开。重画来自任意一次模型刷新（代理改文件、SCM 变化、会话变化、Stage 之后），也来自在筛选框里每输入一个字符。
- 代码：`src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts` 1404–1409、1421–1424；收起入口 1311–1318、1320–1327、1478–1494；重画入口 594、725–730，经 1245 行调用 `rememberGroups`。

```1404:1409:src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts
			for (let depth = 0; depth < segments.length; depth++) {
				path = path ? `${path}/${segments[depth]}` : segments[depth];
				const id = `${entry.groupId}\0${path}`;
				if (!this.expandedFolderIds.has(id)) {
					this.expandedFolderIds.add(id);
				}
```

```1421:1424:src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts
			headersByEntry.set(identity, headers);
			if (!this.expandedGroupIds.has(entry.groupId)) {
				this.expandedGroupIds.add(entry.groupId);
			}
```

```1311:1318:src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts
	toggleGroup(groupId: string): void {
		if (this.expandedGroupIds.has(groupId)) {
			this.expandedGroupIds.delete(groupId);
		} else {
			this.expandedGroupIds.add(groupId);
		}
		this.refreshVisibleList();
	}
```

- 为什么是问题：展开状态只用 `expandedFolderIds` 和 `expandedGroupIds` 两个“已展开”集合表示，收起就是把 id 从集合里删掉。`rememberGroups` 为了让新出现的目录默认展开，对当前每一条的每一级目录和它所在的分组都做“不在集合里就加进去”。这样分不清“第一次出现”和“被用户收起”，每次 `renderFromSnapshot` 走到 1245 行都会把刚收起的 id 加回去，随后 1252–1256 行按加回后的集合重新 splice。`toggleGroup`、`toggleFolder` 和 `setAllFoldersExpanded` 只调用 `refreshVisibleList`，不经过 `rememberGroups`，所以收起只维持到下一次重画。这段来自 2026-11-01 的提交 `b5ec35bd101`；`sourcesChangesList.test.ts` 4924 行和 5149 行起的用例都是收起后立刻断言，测试里没找到收起之后再刷新或再筛选的断言。
- 方向：单独记住用户收起过的分组和目录（或记住已经见过的 id），默认展开只用于第一次出现的 id。

### r11-3

- 严重度：高
- 症状：引擎和窗口用同一个本地仓库（会话工作目录正好是一个本地 Git 仓库根）时，Changes / Review 里的引擎行打开的是整文件 diff（索引对工作区）。把它从 Preview 移到 Conversation 或 Panel 后会出现 Accept。光标放在某一段改动上点 Accept，写进索引的可能是同一文件里的另一段改动；光标行号较大时只提示 “Git accept is not available.”。
- 代码：`src/vs/workbench/contrib/sources/common/sourcesGitHunkPatch.ts` 108–115、144–160；`src/vs/workbench/contrib/sources/common/sourcesChangesGitRead.ts` 97–102；`src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts` 495、659；`src/vs/workbench/contrib/sources/browser/sourcesDiffPanelView.ts` 522、683；本次未提交改动 `src/vs/workbench/contrib/sources/browser/sourcesChangeEntryOpen.ts` 225–229 与 `src/vs/workbench/contrib/sources/browser/sourcesDiffRefHelpers.ts` 45–54。

```108:115:src/vs/workbench/contrib/sources/common/sourcesGitHunkPatch.ts
/**
 * File header (every line before the first `@@`, including rename / mode)
 * plus the single hunk whose new-side or old-side body contains `cursorLine`.
 * `cursorLine` is a line in the diff model built by
 * `parseSourcesGitUnifiedDiff`, not a file line from the `@@` header.
 * Binary diffs and a cursor outside every hunk return undefined (0 Apply).
 */
export function sourcesGitHunkPatchAtCursor(unifiedDiff: string, cursorLine: number, side: SourcesGitAcceptCursorSide = 'new'): string | undefined {
```

```153:157:src/vs/workbench/contrib/sources/common/sourcesGitHunkPatch.ts
		const counts = countHunkBodyLines(lines.slice(start + 1, end));
		const count = side === 'new' ? counts.newLines : counts.oldLines;
		const rangeStart = modelLine + 1;
		modelLine += count;
		if (selected === undefined && lineInHunk(rangeStart, count, cursorLine)) {
```

```97:102:src/vs/workbench/contrib/sources/common/sourcesChangesGitRead.ts
export function needsSourcesGitFileDiff(
	entry: ISourcesChangeEntry,
	hasLocalOriginal: boolean,
): boolean {
	return entry.gitPath !== undefined && !entry.scmResource && !hasLocalOriginal;
}
```

```495:495:src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts
			hasApplyHunksPayload: canOfferSourcesGitAcceptHunk(input.kind, input.indexState) && gate.path !== '' && hasSourcesGitSessionId(pinnedSessionId),
```

```225:229:src/vs/workbench/contrib/sources/browser/sourcesChangeEntryOpen.ts
		rememberSourcesDiffOpenIdentity(pane?.input, {
			groupId: ref.groupId,
			scmResource: ref.scmResource,
			...sourcesChangeIdentity(ref),
		});
```

- 为什么是问题：会话工作目录等于本地仓库根时，`getRootUri()` 返回 `localRoot`（`sourcesChangesReadModel.ts` 309–313），引擎行因此带 `file:` 资源，并带 `origin: 'engine'`、`sessionId`、`gitPath`、`kind`、`indexState`，没有 `scmResource`（`sourcesChangesGitRead.ts` 199–213，`sourcesChangesModel.ts` 135–137）。打开时 `resolveSourcesChangeRef` 用 Git 扩展 quick diff 给出的 `git:` 索引版本作左侧（`sourcesChangeRef.ts` 72–80），`needsSourcesGitFileDiff` 于是为假，不调用 `ReadGitFileDiff`，两侧都是完整文件。Accept 是否显示只看 `kind`、`indexState`、写路径和会话（pane 495 行、panel 522 行），不看模型是不是 `parseSourcesGitUnifiedDiff` 拼出的 hunk 正文。点击时光标是完整文件里的行号，`sourcesGitHunkPatchAtCursor`（pane 659 行、panel 683 行调用）却按文档约定，把它当作各段 hunk 正文首尾相接后的行号来数（144–160 行）。例如三段改动在文件第 3–9、12–18、100–106 行，各 7 行正文，拼接后是第 1–7、8–14、15–21 行；光标在第二段的文件第 15 行，切出来的是第三段，随后 `git apply --cached` 把第三段写进索引。工作区文件不受影响，但索引里多了用户没选的改动、选中的那段没进去，接着提交就会提交错的内容，属于接受变更时写错。默认的 `sources.diff.defaultOwner` 是 `preview`（`sourcesDiffConfiguration.ts` 25 行）；以前从 Preview 移出来的 diff 不带 `kind` / `indexState`，Accept 不显示。本次未提交改动把引擎身份记到 Preview 的 `DiffEditorInput` 上，并在移动时还原（`sourcesDiffRefHelpers.ts` 45–54），默认路径从此会走到这里；把 `defaultOwner` 设成 `conversation` 或 `panel` 时，直接打开就已如此。旧稿 r08-2（`dev/plans/review-2026-10-24-r08-sources-navigator.md`）处理的是反方向，即 hunk 正文模型被当成文件行号；它的修复假定 Accept 面对的都是 hunk 正文模型，没有覆盖整文件 diff。
- 方向：Accept 先确认当前 diff 用的是 hunk 正文模型；整文件 diff 改用 `@@` 里的文件行区间定位，或者不提供 Accept。

### r11-4

- 严重度：低
- 症状：同一窗口里引擎上报的不同（会话，路径）文件变更超过 1000 个后，较早在 Review 里标为已审、之后没再改过的引擎行，会在下一次列表刷新时变回未审。
- 代码：`src/vs/workbench/contrib/sources/browser/sourcesReviewProgressService.ts` 94–97、306–310、312–331、175–193；`src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts` 510–525。

```94:97:src/vs/workbench/contrib/sources/browser/sourcesReviewProgressService.ts
	static readonly DEFAULT_MAX_MUTATIONS = 1000;

	private readonly reviewed = new Map<string, IStoredReview>();
	private readonly latestMutation = new LRUCache<string, ILatestMutation>(SourcesReviewProgressService.DEFAULT_MAX_MUTATIONS);
```

```327:330:src/vs/workbench/contrib/sources/browser/sourcesReviewProgressService.ts
		if (!best) {
			return '';
		}
		return `${best.record.turnId}\0${best.record.toolCallId}`;
```

```175:188:src/vs/workbench/contrib/sources/browser/sourcesReviewProgressService.ts
	noteRefreshedKey(key: ISourcesReviewProgressKey): void {
		const built = buildSourcesReviewProgressKey(key);
		const keep = this.reviewed.has(built);
		let changed = false;
		for (const mapKey of [...this.reviewed.keys()]) {
			const stored = this.reviewed.get(mapKey);
			if (!stored || !this.sameIdentity(stored, key)) {
				continue;
			}
			if (keep && mapKey === built) {
				continue;
			}
			this.reviewed.delete(mapKey);
			changed = true;
```

```523:525:src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts
		for (const key of resolved) {
			this.reviewProgressService.noteRefreshedKey(key);
		}
```

- 为什么是问题：引擎行的审阅键包含 `contentHash`，取自 `latestMutation` 里与该行匹配的最新一条变更的 `turnId` 和 `toolCallId`（312–331 行）。2026-11-03 的提交 `9966cf79734` 把 `latestMutation` 从不设上限的 `Map` 换成容量 1000 的 `LRUCache`，所有会话共用。代码只在 `rememberMutation` 的 `set` 里更新新近度（306–310 行），遍历不算访问，所以先被挤掉的正是很久没再改、已经审完的文件。记录被挤掉后，`engineContentHash` 找不到匹配，返回空串。Review 列表每次画快照前，`ensureEntryKeys` 都对已审行重新 `resolveKey`（510–513 行），再调用 `noteRefreshedKey`；新键的 hash 是空串，`keep` 为假，该身份下已存的审阅记录全被删掉。`sourcesReviewProgress.test.ts` 368–400 行只断言挤掉后 hash 变空，没有覆盖已审标记随之丢失。
- 方向：变更记录被挤掉不等于内容变了；找不到记录时应沿用打标时的 hash，不据此清掉已审。

### r11-5

- 严重度：低
- 症状：在 Review 里点开一行（这一行同时被选中）后切到另一个会话，新会话列表里同一位置的那一行显示为选中，焦点也在那里；在 Review 筛选框里输入、让原选中行被筛掉时也一样。随后从命令面板执行 Sources: Open Selected Review Change，会打开这一行并标为已审；执行 Sources: Toggle Reviewed for Selected，会翻转这一行的审阅状态。用户从没选过它。
- 代码：`src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts` 925–944（本次未提交改动），由 918 行调用；`getSelectedEntry` 在 375–377；`src/vs/workbench/contrib/sources/browser/sourcesReviewCommands.contribution.ts` 43–48、96–104、131–133。

```925:944:src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts
	/**
	 * Rows keep focus and selection by identity. When the focused row leaves the
	 * list (Unreviewed only after it is marked reviewed), focus moves to the row
	 * that took its place, or the last row when it was at the end.
	 */
	private spliceKeepingFocus(list: WorkbenchList<ISourcesReviewEntry>, entries: readonly ISourcesReviewEntry[]): void {
		const focusedIndex = list.getFocus()[0];
		const focused = list.getFocusedElements()[0];
		const wasSelected = !!focused && list.getSelectedElements().includes(focused);
		list.splice(0, list.length, entries);
		if (focusedIndex === undefined || !focused || list.length === 0 || list.getFocus().length > 0) {
			return;
		}
		const next = Math.min(focusedIndex, list.length - 1);
		list.setFocus([next]);
		if (wasSelected) {
			list.setSelection([next]);
		}
		list.reveal(next);
	}
```

- 为什么是问题：Review 列表按 `sourcesChangeEntryIdentity` 保留焦点和选中（770 行的 `identityProvider`），原行不在新数据里时，这两个状态会被列表清掉。`spliceKeepingFocus` 遇到这种情况就按旧下标重新设焦点，原行被选中时还一并 `setSelection`。注释写的场景只有“Unreviewed only 下刚标完的那一行消失”，代码却对所有让原行消失的原因生效：切换会话后 `renderSnapshot` 换成另一个会话的条目、文字筛选、刷新后文件已提交或已还原。选中状态于是从上一个会话或上一份数据搬到一条无关的行上。`getSelectedEntry()` 只读列表选中，两条命令据此打开后 `markReviewed`，或调用 `toggleEntryReview`。
- 方向：只在 Unreviewed only 标完这一种情况下移动焦点，且不搬选中；会话切换或整份数据替换时清掉选中。

## 打开过的文件

- `src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts`
- `src/vs/workbench/contrib/sources/browser/sourcesChangeEntryOpen.ts`
- `src/vs/workbench/contrib/sources/browser/sourcesDiffActions.ts`
- `src/vs/workbench/contrib/sources/browser/sourcesDiffRefHelpers.ts`
- `src/vs/workbench/contrib/sources/browser/sourcesDiffOpenIdentity.ts`
- `src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts`
- `src/vs/workbench/contrib/sources/browser/conversationDiffReviewInput.ts`
- `src/vs/workbench/contrib/sources/browser/sourcesDiffPanelView.ts`
- `src/vs/workbench/contrib/sources/browser/sourcesDiffPanelService.ts`
- `src/vs/workbench/contrib/sources/browser/sourcesGitDiffContent.ts`
- `src/vs/workbench/contrib/sources/browser/sourcesFilesExplorer.ts`
- `src/vs/workbench/contrib/sources/browser/sourcesFilesList.ts`
- `src/vs/workbench/contrib/sources/browser/sources.contribution.ts`
- `src/vs/workbench/contrib/sources/browser/sourcesTabsHost.ts`
- `src/vs/workbench/contrib/sources/browser/sourcesListFilterBox.ts`
- `src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts`
- `src/vs/workbench/contrib/sources/browser/sourcesReview.contribution.ts`
- `src/vs/workbench/contrib/sources/browser/sourcesReviewHostService.ts`
- `src/vs/workbench/contrib/sources/browser/sourcesReviewCommands.contribution.ts`
- `src/vs/workbench/contrib/sources/browser/sourcesReviewAttributionService.ts`
- `src/vs/workbench/contrib/sources/browser/sourcesReviewProgressService.ts`
- `src/vs/workbench/contrib/sources/common/sourcesChangesReadModel.ts`
- `src/vs/workbench/contrib/sources/common/sourcesChangeRef.ts`
- `src/vs/workbench/contrib/sources/common/sourcesChangesGitRead.ts`
- `src/vs/workbench/contrib/sources/common/sourcesChangesGitWrite.ts`
- `src/vs/workbench/contrib/sources/common/sourcesChangesModel.ts`
- `src/vs/workbench/contrib/sources/common/sourcesDiffWriteController.ts`
- `src/vs/workbench/contrib/sources/common/sourcesDiffConfiguration.ts`
- `src/vs/workbench/contrib/sources/common/sourcesGitHunkPatch.ts`
- `src/vs/workbench/contrib/sources/common/sourcesFilesListMode.ts`
- `src/vs/workbench/contrib/sources/common/sourcesReviewAttribution.ts`
- `src/vs/workbench/contrib/sources/common/sourcesReviewHostService.ts`
- `src/vs/workbench/contrib/sources/common/sourcesReviewListModel.ts`
- `src/vs/workbench/contrib/sources/common/sourcesReviewProgress.ts`
- `src/vs/workbench/contrib/sources/test/browser/sourcesChangesList.test.ts`
- `src/vs/workbench/contrib/sources/test/browser/sourcesReviewProgress.test.ts`
- `src/vs/workbench/contrib/conversation/browser/agentSessionContext.ts`（块外，只核对接口）
- `src/vs/workbench/services/agentSession/common/agentWorkRoot.ts`（块外，只核对接口）
- `src/vs/workbench/contrib/files/browser/views/explorerView.ts`（块外，只核对接口）
- `src/vs/workbench/contrib/files/common/explorerLocationBreadcrumb.ts`（块外，只核对接口）
- `src/vs/workbench/contrib/conversation/browser/conversationLensReadingColumn.ts`（块外，只核对接口）
- `src/vs/workbench/contrib/scm/common/quickDiffService.ts`（块外，只核对接口）
- `src/vs/workbench/browser/parts/sources/sourcesPart.ts`（块外，只核对接口）
