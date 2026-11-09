---
title: "十六路审查 2026-11-07 r06：workbench api 与 services 发现"
type: reference
status: draft
phase: N/A
updated: 2026-11-07
summary: "看了 workbench api 与 services 在 2026-10-30 之后的改动和产品自有服务，证实 2 条：同端口转发重叠时互相关掉隧道，编辑器历史延迟加载被跳过后覆盖存储。"
---

# 十六路审查 2026-11-07 r06：workbench api 与 services 发现

状态：草案。
覆盖需求：无（正文未引用需求编号）。

本次先看了 `src/vs/workbench/api` 与 `src/vs/workbench/services` 在 2026-10-30 之后的提交（主要是 2026-11-04 的 catch 去重与销毁守卫），以及工作区里三份未提交改动（`editorOpenSlot.ts`、`previewCategoryRouting.ts`、`layoutService.test.ts`）。随后按相对上游 `004a1fbb165` 的产品差异，抽查了 `agentSession`、编辑器打开槽与 Preview 类别路由、端口转发模型、编辑器历史、文本文件与工作副本、工作区信任、扩展宿主启动与激活缓存、远程管理连接、配置、存储、偏好设置面板，以及主线程的终端、编辑器标签、装饰、输出通道等文件。证实 2 条，都是产品改动引入的竞态，旧审查稿与 `deferred-gaps.md` 里没有记过。其余看过的改动（catch 去重、销毁后早退、各类「失败后可重试」的共享 promise、未提交的类别路由改动）没有找到能沿代码路径证实的问题。

### r06-1

- 严重度：中
- 症状：远程窗口里，同一个远程端口有两次转发请求重叠时，两次都结束后这个端口没有被转发。端口视图里不出现它，或者出现后马上被移除；后一次请求的调用方（例如扩展的 `workspace.openTunnel`）拿到的隧道随后被关闭。
- 代码：`src/vs/workbench/services/remote/common/tunnelModel.ts` 733、746–757、768–773（`doForward` 的转发代数与过期关闭）；524–526、562–568（隧道关闭事件删除 `forwarded` 条目）；扩展入口 `src/vs/workbench/api/browser/mainThreadTunnelService.ts` 103–113。块外接口：`src/vs/platform/tunnel/node/tunnelService.ts` 195–200，`src/vs/platform/tunnel/common/tunnel.ts` 367–371、445–453。

```746:757:src/vs/workbench/services/remote/common/tunnelModel.ts
			const key = makeAddress(tunnelProperties.remote.host, tunnelProperties.remote.port);
			const forwardGenerations = ((this as { _forwardGenerationsByKey?: Map<string, number> })._forwardGenerationsByKey ??= new Map<string, number>());
			const forwardGeneration = (forwardGenerations.get(key) ?? 0) + 1;
			forwardGenerations.set(key, forwardGeneration);
			this.inProgress.set(key, true);
			tunnelProperties = this.mergeCachedAndUnrestoredProperties(key, tunnelProperties);

			const closedListener = this.tunnelService.onTunnelClosed(address => {
				if (address.host === tunnelProperties.remote.host && address.port === tunnelProperties.remote.port) {
					forwardGenerations.set(key, (forwardGenerations.get(key) ?? 0) + 1);
				}
			});
```

```768:773:src/vs/workbench/services/remote/common/tunnelModel.ts
					const localUri = await this.makeLocalUri(tunnel.localAddress, attributes);
					if (forwardGenerations.get(key) !== forwardGeneration) {
						this.inProgress.delete(key);
						await this.tunnelService.closeTunnel(tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort);
						return undefined;
					}
```

```195:200:src/vs/platform/tunnel/node/tunnelService.ts
	protected retainOrCreateTunnel(addressOrTunnelProvider: IAddressProvider | ITunnelProvider, remoteHost: string, remotePort: number, localHost: string, localPort: number | undefined, elevateIfNeeded: boolean, privacy?: string, protocol?: string): Promise<RemoteTunnel | string | undefined> | undefined {
		const existing = this.getTunnelFromMap(remoteHost, remotePort);
		if (existing) {
			++existing.refcount;
			return existing.value;
		}
```

```445:453:src/vs/platform/tunnel/common/tunnel.ts
	async closeTunnel(remoteHost: string, remotePort: number): Promise<void> {
		this.logService.trace(`ForwardedPorts: (TunnelService) close request for ${remoteHost}:${remotePort} `);
		const portMap = this._tunnels.get(remoteHost);
		if (portMap && portMap.has(remotePort)) {
			const value = portMap.get(remotePort)!;
			value.refcount = 0;
			await this.tryDisposeTunnel(remoteHost, remotePort, value);
		}
	}
```

- 为什么是问题：`doForward` 判断端口是否已转发只看 `forwarded`（733 行），不看 `inProgress`。请求 A 还在等 `openTunnel` 时，请求 B 同样走进新建分支，把同一键的代数从 1 推到 2。隧道服务按远程主机和端口共享隧道。没有隧道提供方时，B 的 `openTunnel` 经 `retainOrCreateTunnel` 拿到 A 正在建立的同一个隧道，只把引用计数加一。A 返回后发现代数不等，就按主机和端口调用 `closeTunnel`；`closeTunnel` 把引用计数直接置 0 并销毁隧道，而 B 持有的正是这个隧道。销毁完成时触发 `onTunnelClosed`：如果 B 还没返回，B 的 `closedListener` 再把代数加一，B 返回时同样走过期分支并返回 `undefined`；如果 B 已经写入 `forwarded`，模型在构造函数里注册的 `onTunnelClosed` 处理（524–526、562–568 行）会删掉这一项并触发 `onClosePort`。有隧道提供方时，A 的工厂还没结束，B 的 `openTunnel` 直接返回 `undefined`（`tunnel.ts` 367–371 行），B 以无隧道结束；A 随后因为代数已被 B 推进，关掉自己建好的唯一一个隧道。两条路径的结果都是端口没有转发。这段代数逻辑由提交 `a2878a2f8af` 加入；在此之前两次请求共享同一个隧道，端口保持转发。

  重叠请求的来源：扩展经 `$openTunnel`（`mainThreadTunnelService.ts` 103–113 行）调用 `forward`，可以和自动转发或用户的 Forward a Port 落在同一端口。自动转发里，`UrlFinder.processData` 对同一批终端输出中的每个匹配各触发一次 `onDidMatchLocalUrl`（`src/vs/workbench/contrib/remote/browser/urlFinder.ts` 136–158 行），`remoteExplorer.ts` 687–699 行的处理函数各自调用一次 `forward`；同一个本地地址在一批输出里出现两次，两次转发就会重叠。

- 方向：同一端口已有转发在建立时让后来的请求复用那次结果、不推进代数，过期的尝试只释放自己持有的引用，不按主机和端口强制关闭共享隧道。

### r06-2

- 严重度：中
- 症状：重启时要恢复辅助编辑器窗口的工作区，以前积累的编辑器历史（Quick Open 的最近打开列表，工作区存储键 `history.entries`）不会被读入；下一次保存状态时，存储被只含本次会话条目的列表覆盖，之前的记录永久丢失。
- 代码：`src/vs/workbench/services/history/browser/historyService.ts` 1087–1109（`ensureHistoryLoaded` 的代数判断）、904–905 与 928（激活编辑器时先删后加，加时推进代数）、1119（唯一读取存储的位置）、1201–1220（`saveState` 覆盖写入）；触发路径 `src/vs/workbench/services/editor/browser/editorService.ts` 109、148–167。块外：`src/vs/workbench/browser/parts/editor/editorParts.ts` 446–453、610–642、710–739，`editorPart.ts` 756–759，`editorGroupView.ts` 1129–1140。

```1087:1109:src/vs/workbench/services/history/browser/historyService.ts
	private ensureHistoryLoaded(history: Array<EditorInput | IResourceEditorInput> | undefined): asserts history {
		if (!this.history) {

			// Until history is loaded, it is just empty
			this.history = [];

			// We want to seed history from opened editors
			// too as well as previous stored state, so we
			// need to wait for the editor groups being ready
			if (this.editorGroupService.isReady) {
				this.loadHistory();
			} else {
				const loadEpoch = this.historyMutationEpoch;
				(async () => {
					await this.editorGroupService.whenReady;

					if (loadEpoch === this.historyMutationEpoch) {
						this.loadHistory();
					}
				})();
			}
		}
	}
```

```638:642:src/vs/workbench/browser/parts/editor/editorParts.ts
		const mostRecentActivePart = this.mostRecentActiveParts.at(0);
		mostRecentActivePart?.activeGroup.focus();

		this._isReady = true;
		this.whenReadyPromise.complete();
```

- 为什么是问题：编辑器组还没就绪时第一次访问历史，`ensureHistoryLoaded` 把 `history` 置为空数组，记下当前的 `historyMutationEpoch`，等 `whenReady` 之后只有代数没变才调用 `loadHistory()`。`loadHistory()` 是唯一读取 `history.entries` 的地方（1119 行调用 `loadHistoryFromStorage`）。等待期间只要有一次 `addToHistory`，代数就加一（928 行），延迟加载整个跳过，而不是只跳过被改动的条目。

  `EditorParts.restoreParts` 有辅助窗口状态时，先 `await this.restoreState(state)`，等辅助窗口创建完并 `whenReady`（`editorParts.ts` 710–739 行），然后在 638–639 行聚焦最近活动部件的活动组，641 行才把 `isReady` 置真。`EditorGroupView.focus()` 同步触发组的 `onDidFocus`（`editorGroupView.ts` 1139 行），`EditorPart` 随之触发部件的 `onDidFocus`（`editorPart.ts` 756–759 行）；部件不止一个时，`EditorParts` 触发 `onDidActiveGroupChange`（446–453 行），`EditorService` 把它转成 `onDidActiveEditorChange`（`editorService.ts` 109、148–167 行）。只要这个组恢复的编辑器在辅助窗口就绪之前已经打开（读文件比新建窗口快），历史服务的 `handleActiveEditorChangeInHistory` 就先 `removeFromHistory`（第一次访问，`isReady` 仍为假，登记延迟加载并记下代数），再 `addToHistory`（代数加一）。`isReady` 置真后，延迟回调看到代数不同，`loadHistory()` 不执行。之后 `onWillSaveState` 触发 `saveState()`，把只含本次会话条目的 `this.history` 写回 `history.entries`（1220 行），旧列表被覆盖。这段代数判断由提交 `c8b4c83a504`、`be99dec5203` 加入；上游在就绪后无条件调用 `loadHistory()`，存储里的条目仍会合并进来。

- 方向：延迟加载不要因为等待期间有改动就整体放弃，加载时把存储条目合并到等待期间已经加入的条目后面。

## 打开过的文件

范围内，按段或整篇读过：

- `src/vs/workbench/services/agentSession/common/agentSessionContext.ts`
- `src/vs/workbench/services/agentSession/common/agentWorkRoot.ts`
- `src/vs/workbench/services/editor/browser/editorOpenSlot.ts`
- `src/vs/workbench/services/editor/common/editorOpenSlot.ts`
- `src/vs/workbench/services/editor/common/previewCategoryRouting.ts`
- `src/vs/workbench/services/editor/common/previewCategoryService.ts`
- `src/vs/workbench/services/editor/browser/previewCategoryService.ts`
- `src/vs/workbench/services/editor/common/explorerAutoRevealGate.ts`
- `src/vs/workbench/services/editor/browser/editorService.ts`
- `src/vs/workbench/services/remote/common/tunnelModel.ts`
- `src/vs/workbench/services/remote/common/shareRemoteAgentConnection.ts`
- `src/vs/workbench/services/remote/common/abstractRemoteAgentService.ts`
- `src/vs/workbench/services/history/browser/historyService.ts`
- `src/vs/workbench/services/textfile/browser/textFileService.ts`
- `src/vs/workbench/services/workspaces/common/workspaceTrust.ts`
- `src/vs/workbench/services/extensions/common/abstractExtensionService.ts`
- `src/vs/workbench/services/extensions/common/extensionHostActivationCache.ts`
- `src/vs/workbench/services/extensions/electron-browser/localProcessExtensionHost.ts`
- `src/vs/workbench/services/extensions/electron-browser/localProcessExtensionHostStart.ts`
- `src/vs/workbench/services/commands/common/commandStarActivation.ts`
- `src/vs/workbench/services/host/electron-browser/nativeWindowHandleCache.ts`
- `src/vs/workbench/services/preferences/browser/preferencesEditorPaneRegistry.ts`
- `src/vs/workbench/services/themes/browser/workbenchThemeService.ts`
- `src/vs/workbench/api/browser/mainThreadDecorations.ts`
- `src/vs/workbench/api/browser/mainThreadTunnelService.ts`
- `src/vs/workbench/api/common/extHostOutput.ts`
- `src/vs/workbench/api/common/extHostExtensionPathIndex.ts`
- `src/vs/workbench/api/node/extHostAuthentication.ts`

范围内，只看了相对上游或 2026-10-30 之后提交的差异：

- `src/vs/workbench/services/editor/common/editorGroupFinder.ts`
- `src/vs/workbench/services/editor/common/editorGroupColumn.ts`
- `src/vs/workbench/services/editor/common/editorService.ts`
- `src/vs/workbench/services/configuration/browser/configuration.ts`
- `src/vs/workbench/services/configuration/browser/configurationService.ts`
- `src/vs/workbench/services/extensions/browser/extensionService.ts`
- `src/vs/workbench/services/extensions/browser/extensionUrlHandler.ts`
- `src/vs/workbench/services/extensions/browser/webWorkerExtensionHost.ts`
- `src/vs/workbench/services/extensions/common/extensionHostManager.ts`
- `src/vs/workbench/services/extensions/electron-browser/nativeExtensionService.ts`
- `src/vs/workbench/services/textfile/common/textFileEditorModel.ts`
- `src/vs/workbench/services/untitled/common/untitledTextEditorInput.ts`
- `src/vs/workbench/services/workingCopy/common/storedFileWorkingCopy.ts`
- `src/vs/workbench/services/workingCopy/common/resourceWorkingCopy.ts`
- `src/vs/workbench/services/workingCopy/common/untitledFileWorkingCopy.ts`
- `src/vs/workbench/services/workingCopy/common/workingCopyBackupTracker.ts`
- `src/vs/workbench/services/workingCopy/common/workingCopyHistoryService.ts`
- `src/vs/workbench/services/workingCopy/common/workingCopyHistoryTracker.ts`
- `src/vs/workbench/services/workspaces/browser/workspacesService.ts`
- `src/vs/workbench/services/workspaces/electron-browser/workspaceEditingService.ts`
- `src/vs/workbench/services/layout/browser/layoutService.ts`
- `src/vs/workbench/services/preferences/browser/preferencesService.ts`
- `src/vs/workbench/services/storage/browser/storageService.ts`
- `src/vs/workbench/services/userDataProfile/browser/userDataProfileManagement.ts`
- `src/vs/workbench/services/userDataProfile/browser/userDataProfileInit.ts`
- `src/vs/workbench/services/userDataSync/browser/userDataSyncInit.ts`
- `src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts`
- `src/vs/workbench/services/chat/common/chatEntitlementService.ts`
- `src/vs/workbench/services/policies/common/accountPolicyService.ts`
- `src/vs/workbench/services/accounts/browser/defaultAccount.ts`
- `src/vs/workbench/services/themes/common/workbenchThemeService.ts`
- `src/vs/workbench/services/host/browser/browserHostService.ts`
- `src/vs/workbench/services/keybinding/browser/keyboardLayoutService.ts`
- `src/vs/workbench/services/inlineCompletions/common/inlineCompletionsUnification.ts`
- `src/vs/workbench/api/browser/mainThreadEditorTabs.ts`
- `src/vs/workbench/api/browser/mainThreadChatSessions.ts`
- `src/vs/workbench/api/browser/mainThreadTerminalService.ts`
- `src/vs/workbench/api/browser/mainThreadSpeech.ts`
- `src/vs/workbench/api/browser/mainThreadWorkspace.ts`
- `src/vs/workbench/api/browser/mainThreadTreeViews.ts`
- `src/vs/workbench/api/browser/mainThreadMcp.ts`
- `src/vs/workbench/api/browser/viewsExtensionPoint.ts`
- `src/vs/workbench/api/common/extHostVariableResolverService.ts`
- `src/vs/workbench/api/common/extHostExtensionService.ts`
- `src/vs/workbench/api/common/extHostQuickDiff.ts`
- `src/vs/workbench/api/common/extHostTask.ts`
- `src/vs/workbench/api/common/extHostDocumentContentProviders.ts`
- `src/vs/workbench/api/node/extHostLoggerService.ts`
- `src/vs/workbench/api/node/extHostMcpNode.ts`
- `src/vs/workbench/api/node/extHostSearch.ts`
- `src/vs/workbench/api/node/extHostTunnelService.ts`

块外，只用于核对接口与调用方：

- `src/vs/platform/tunnel/common/tunnel.ts`
- `src/vs/platform/tunnel/node/tunnelService.ts`
- `src/vs/workbench/browser/parts/editor/editorParts.ts`
- `src/vs/workbench/browser/parts/editor/editorPart.ts`
- `src/vs/workbench/browser/parts/editor/editorGroupView.ts`
- `src/vs/workbench/browser/parts/editor/categorizedMainEditorPart.ts`
- `src/vs/workbench/contrib/remote/browser/remoteExplorer.ts`
- `src/vs/workbench/contrib/remote/browser/urlFinder.ts`
- `src/vs/workbench/contrib/extensions/browser/extensionEnablementWorkspaceTrustTransitionParticipant.ts`
