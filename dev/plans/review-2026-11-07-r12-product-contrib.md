---
title: "十六路审查 2026-11-07 r12：navigator 与产品贡献面发现"
type: reference
status: draft
phase: N/A
updated: 2026-11-07
summary: "抽查 navigator 未提交改动与 10-30 后提交、MCP 11-03 生命周期提交、语音与欢迎页去重 catch，以及 planning 与迁移现状，证实 2 条。"
---

# 十六路审查 2026-11-07 r12：navigator 与产品贡献面发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。

本次先看 navigator 的未提交改动（Team、Agents、Projects 三个视图的键盘焦点、行尾状态列、单击只选中、工作目录右键菜单与 Enter 新建会话、三个筛选框的 Escape 与下箭头），再看 10-30 以后的 navigator 提交（检查器按会话和连接隔离、生命周期清理）、MCP 11-03 的生命周期提交（`mcpServer`、`mcpService`、`mcpServersView`、`mcpWorkbenchService`、`mcpServerEditor`）、agentsVoice 与欢迎页 11-04 的去重 catch 和销毁检查，以及 planning、universeAgentMigration 的现状。共 2 条。工作目录行按 Enter 新建会话按 `ui-interaction-parallel-review-2026-11-06.md` §2.2 的设计处理，检查器显示选中时的快照见 D1396，均未作为发现。

### r12-1

- 严重度：中
- 症状：引擎连上后（启动时本地有上次的会话缓存，或断线后重连），会话已经可以读写，Team 视图标题栏的 Refresh 和 Inspect 仍是灰的。只有切换活动会话、或引擎断开再连上，这两个按钮才会恢复。
- 代码：`src/vs/workbench/contrib/navigator/browser/navigatorTeamList.ts` 311–332、573–582、1143–1149、1295–1303、1317–1324；对照 `src/vs/workbench/contrib/navigator/browser/navigatorAgentsView.ts` 411–417、547–553。

```311:332:src/vs/workbench/contrib/navigator/browser/navigatorTeamList.ts
		this._register(this.rosterService.onDidChangeActiveSession(() => {
			if (this._store.isDisposed) {
				return;
			}
			this.updateRefreshAvailability();
			this.scheduleRefresh();
		}));
		this._register(this.rosterService.onDidChangeEngineConnection(() => {
			if (this._store.isDisposed) {
				return;
			}
			this.updateEngineConnectedContextKey();
			this.updateRefreshAvailability();
			this.scheduleRefresh();
		}));
		// D457: KEEP list-fail flips via roster session events, not connection.
		this._register(this.rosterService.onDidChangeSession(() => {
			if (this._store.isDisposed) {
				return;
			}
			this.syncKeepLeftoverListFailInspect();
		}));
```

```573:582:src/vs/workbench/contrib/navigator/browser/navigatorTeamList.ts
	private isRefreshAvailable(): boolean {
		return !isConversationPairingHold(this.uaConnection)
			&& this.uaConnection.getConnectionPhase().kind === 'connected'
			&& this.rosterService.isEngineConnected()
			&& getConversationSessionReadiness(this.rosterService) === 'ready';
	}

	private updateRefreshAvailability(): void {
		this.refreshAvailableContextKey.set(this.isRefreshAvailable());
	}
```

```1143:1149:src/vs/workbench/contrib/navigator/browser/navigatorTeamList.ts
	private syncKeepLeftoverListFailInspect(): void {
		if (this._store.isDisposed) {
			return;
		}
		this.updateEngineConnectedContextKey();
		if (!isConversationSessionNotReady(this.rosterService)) {
			return;
```

```1295:1303:src/vs/workbench/contrib/navigator/browser/navigatorTeamList.ts
registerAction2(class NavigatorTeamOpenInspectAction extends ViewAction<NavigatorTeamView> {
	constructor() {
		super({
			id: OPEN_NAVIGATOR_TEAM_INSPECT_COMMAND_ID,
			viewId: NAVIGATOR_TEAM_VIEW_ID,
			title: localize2('navigatorTeamView.openInspect', "Inspect"),
			icon: Codicon.inspect,
			precondition: NAVIGATOR_TEAM_REFRESH_AVAILABLE_KEY,
			menu: {
```

```1317:1324:src/vs/workbench/contrib/navigator/browser/navigatorTeamList.ts
registerAction2(class NavigatorTeamRefreshAction extends ViewAction<NavigatorTeamView> {
	constructor() {
		super({
			id: NAVIGATOR_TEAM_REFRESH_COMMAND_ID,
			viewId: NAVIGATOR_TEAM_VIEW_ID,
			title: localize2('navigatorTeamView.refresh', "Refresh"),
			icon: Codicon.refresh,
			precondition: NAVIGATOR_TEAM_REFRESH_AVAILABLE_KEY,
```

- 为什么是问题：`navigatorTeamRefreshAvailable` 只在活动会话变化、引擎连接标志变化和连接快照推送时重算（315、323、338 行），读的是花名册的会话就绪度（577 行）。块外的 `ConversationEngineRosterService` 连上时，先在 1876 行 `super.setEngineConnected(true)` 发出 `onDidChangeEngineConnection`，再在 1877 行开始列会话目录。这时 `listCompleted` 是 false：启动时 `restoreEngineCacheFromStorage` 在 2299 行把它置 false，`doRefreshEngineCatalog` 在 2155 行、第一次 await 之前也把它置 false。所以 `getEngineSessionReadiness()` 在 184–185 行返回 `loading`，Team 视图把键算成 false。目录列完后，2193 行把 `listCompleted` 置 true，2201 行调用 `activateEngineSession`。缓存恢复的活动会话仍在列表里时 id 不变，1065 行不发 `onDidChangeActiveSession`，只在 2208 行发 `onDidChangeSession`。Team 视图对 `onDidChangeSession` 只走 `syncKeepLeftoverListFailInspect`，它只重算 `ua.engineConnected`（1147 行），这个键保持 false。之后每次连接快照推送，花名册的 `onUaConnectionChanged` 都会重新列目录，同样在等待前把 `listCompleted` 置回 false；花名册的监听先于视图注册时，视图在同一次推送里重算仍得到 `loading`。D457（`dev/progress/deferred-gaps.md`）已经让 Agents 视图在 `onDidChangeSession` 里重算同类键（`navigatorAgentsView.ts` 411–417、547–553）。Team 的这个键是 10-29 的 `e48af5ae75c` 加的，没有跟上。工作区未提交改动又把同一个键设成 Team Inspect 的前置条件（1302 行），原来 Inspect 不受影响。
- 方向：Team 视图在 `onDidChangeSession` 里同样调用 `updateRefreshAvailability()`，与 D457 对 Agents 的处理一致。

### r12-2

- 严重度：低
- 症状：MCP 服务器刚启动、还在校验工具定义时被移除（例如在 `mcp.json` 里删掉它），迟到的校验结果会把这台服务器的工具缓存写成空列表并落盘。之后以同样配置加回它（同一个定义 id、同一个 `cacheNonce`）时，新实例按缓存判为 Cached、零个工具，自动启动跳过它，聊天里看不到它的工具，直到手动启动一次。
- 代码：`src/vs/workbench/contrib/mcp/common/mcpServer.ts` 1142–1147、1164–1173、1210–1219、470–474；`src/vs/workbench/contrib/mcp/common/mcpService.ts` 56–59、200–208、119–126。

```1142:1147:src/vs/workbench/contrib/mcp/common/mcpServer.ts
		try {
			const schemaUri = URI.parse('https://json-schema.org/draft-07/schema');
			diagnostics = await this._commandService.executeCommand<JsonDiagnostic[]>('json.validate', schemaUri, toolJson) || [];
		} catch (e) {
			// ignored (error in json extension?);
		}
```

```1164:1173:src/vs/workbench/contrib/mcp/common/mcpServer.ts
	private async _getValidatedTools(tools: MCP.Tool[]): Promise<ValidatedMcpTool[]> {
		if (this._store.isDisposed) {
			return [];
		}
		let error = '';

		const validations = await Promise.all(tools.map(t => this._normalizeTool(t)));
		if (this._store.isDisposed) {
			return [];
		}
```

```1210:1219:src/vs/workbench/contrib/mcp/common/mcpServer.ts
	private _setServerTools(nonce: string | undefined, toolsPromise: Promise<MCP.Tool[]>, tx: ITransaction | undefined) {
		const epoch = ++this._toolsRefreshEpoch;
		const toolPromiseSafe = toolsPromise.then(async tools => {
			this._logger.info(`Discovered ${tools.length} tools`);
			const data = await this._getValidatedTools(tools);
			if (epoch === this._toolsRefreshEpoch) {
				this._primitiveCache.store(this.definition.id, { tools: data, nonce });
			}
			return { data, nonce };
		});
```

```470:474:src/vs/workbench/contrib/mcp/common/mcpServer.ts
			if (!this._tools.fromCache) {
				return McpServerCacheState.Unknown;
			}

			return currentNonce() === this._tools.fromCache.nonce ? McpServerCacheState.Cached : McpServerCacheState.Outdated;
```

```200:208:src/vs/workbench/contrib/mcp/common/mcpService.ts
		// Transfer over any servers that are still valid.
		for (const server of currentServers) {
			const match = definitions.find(d => defsEqual(server.object, d));
			if (match) {
				pushMatch(match, server);
			} else {
				server.object.dispose();
			}
		}
```

```119:126:src/vs/workbench/contrib/mcp/common/mcpService.ts
		if (autoStartConfig === McpAutoStartValue.OnlyNew) {
			todo = new Set(candidates.filter(s => s.cacheState.get() === McpServerCacheState.Unknown));
		} else if (autoStartConfig === McpAutoStartValue.NewAndOutdated) {
			todo = new Set(candidates.filter(s => {
				const c = s.cacheState.get();
				return c === McpServerCacheState.Unknown || c === McpServerCacheState.Outdated;
			}));
		}
```

- 为什么是问题：`listTools` 返回后，`_normalizeTool` 对每个工具都要等 `json.validate` 命令经扩展宿主往返（1144 行）。等待期间定义消失，`McpService` 在 500ms 节流后（59 行）由 `updateCollectedServers` 销毁这个实例（206 行）。`Promise.all` 回来后 1171 行看到已销毁，返回 `[]`。这个实例不会再有更新的刷新，1215 行的代数仍相等，1216 行把 `{ tools: [], nonce }` 写进共享缓存。缓存由 `McpService` 持有（56–57 行），比单个服务器活得久，`onWillSaveState` 时写入 `mcpToolCache`（`mcpServer.ts` 166–175 行）。之后同 id 的新实例读到这条缓存：nonce 与当前定义一致，`cacheState` 为 Cached（474 行），工具取缓存里的空数组（341 行）。`autostart` 只启动 Unknown 或 Outdated 的服务器（`mcpService.ts` 119–126 行），这台不会被自动启动。两处已销毁时返回空数组的判断是 11-03 的 `c9016d48b50` 加的；在那之前，迟到的结果写入的是真实校验结果，不会清空缓存。
- 方向：实例已销毁时在 `_setServerTools` 写缓存之前跳过写入，不要用空数组代替校验结果。

## 打开过的文件

- `src/vs/workbench/contrib/navigator/browser/navigatorTeamList.ts`
- `src/vs/workbench/contrib/navigator/browser/navigatorAgentsView.ts`
- `src/vs/workbench/contrib/navigator/browser/navigatorProjectsList.ts`
- `src/vs/workbench/contrib/navigator/browser/navigatorProjectsTree.ts`
- `src/vs/workbench/contrib/navigator/browser/navigatorTeamInlineFilterBox.ts`
- `src/vs/workbench/contrib/navigator/browser/navigatorAgentsInlineFilterBox.ts`（只看 diff）
- `src/vs/workbench/contrib/navigator/browser/navigatorProjectsInlineFilterBox.ts`（只看 diff）
- `src/vs/workbench/contrib/navigator/browser/navigatorReveal.ts`
- `src/vs/workbench/contrib/navigator/browser/navigatorSessionLeaseHolder.ts`
- `src/vs/workbench/contrib/navigator/browser/agentInspectService.ts`
- `src/vs/workbench/contrib/navigator/browser/agentInspectView.ts`
- `src/vs/workbench/contrib/navigator/common/agentInspect.ts`
- `src/vs/workbench/contrib/navigator/common/navigatorTeamData.ts`
- `src/vs/workbench/contrib/navigator/common/navigatorAgentsActivity.ts`
- `src/vs/workbench/contrib/navigator/common/navigatorAgentHierarchy.ts`
- `src/vs/workbench/contrib/navigator/common/navigatorProjectsInlineFilter.ts`
- `src/vs/workbench/contrib/navigator/common/navigatorAgentsInlineFilter.ts`
- `src/vs/workbench/contrib/navigator/common/navigatorTeamInlineFilter.ts`
- `src/vs/workbench/contrib/navigator/test/browser/navigatorTeamSubviews.test.ts`
- `src/vs/workbench/contrib/navigator/test/browser/navigatorProjectsList.test.ts`
- `src/vs/workbench/contrib/mcp/common/mcpServer.ts`
- `src/vs/workbench/contrib/mcp/common/mcpService.ts`
- `src/vs/workbench/contrib/mcp/browser/mcpServersView.ts`（只看 diff）
- `src/vs/workbench/contrib/mcp/browser/mcpWorkbenchService.ts`（只看 diff）
- `src/vs/workbench/contrib/mcp/browser/mcpServerEditor.ts`（只看 diff）
- `src/vs/workbench/contrib/agentsVoice/browser/agentsVoiceWidget.ts`（只看 diff）
- `src/vs/workbench/contrib/agentsVoice/browser/agentsVoiceWindowService.ts`（只看 diff）
- `src/vs/workbench/contrib/agentsVoice/browser/voiceModeOnboarding.ts`（只看 diff）
- `src/vs/workbench/contrib/welcomeAgentSessions/browser/agentSessionsWelcome.ts`（只看 diff）
- `src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts`（只看 diff）
- `src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStartedService.ts`（只看 diff）
- `src/vs/workbench/contrib/welcomeGettingStarted/browser/startupPage.ts`（只看 diff）
- `src/vs/workbench/contrib/welcomeOnboarding/browser/onboardingVariationA.ts`（只看 diff）
- `src/vs/workbench/contrib/planning/browser/planningTodoEditor.ts`
- `src/vs/workbench/contrib/planning/browser/planningTodoModel.ts`
- `src/vs/workbench/contrib/planning/browser/planningTodoEditorInput.ts`
- `src/vs/workbench/contrib/universeAgentMigration/electron-browser/universeAgentMigration.contribution.ts`
- `src/vs/workbench/contrib/universeAgentMigration/common/codeOssMigration.ts`
- 块外，只用于核对调用路径：`src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts`、`src/vs/workbench/contrib/conversation/common/conversationSessionReadiness.ts`、`src/vs/workbench/contrib/conversation/browser/conversationSessionsView.ts`、`src/vs/platform/list/browser/listService.ts`、`src/vs/workbench/browser/actions/listCommands.ts`
