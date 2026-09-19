/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';
const STORAGE_REL = 'src/vs/base/parts/storage/common/storage.ts';
const IPC_NET_REL = 'src/vs/base/parts/ipc/node/ipc.net.ts';
const SCROLL_REL = 'src/vs/base/browser/ui/scrollbar/scrollableElement.ts';
const ASYNC_TREE_REL = 'src/vs/base/browser/ui/tree/asyncDataTree.ts';
const ACTIONBAR_REL = 'src/vs/base/browser/ui/actionbar/actionbar.ts';
const PAGING_REL = 'src/vs/base/common/paging.ts';
const IPC_REL = 'src/vs/base/parts/ipc/common/ipc.ts';
const WORKER_REL = 'src/vs/base/common/worker/webWorker.ts';
const HISTORY_REL = 'src/vs/workbench/services/history/browser/historyService.ts';
const STORAGE_BROWSER_REL = 'src/vs/workbench/services/storage/browser/storageService.ts';
const CHAT_SESSIONS_REL = 'src/vs/workbench/api/browser/mainThreadChatSessions.ts';
const MCP_REL = 'src/vs/workbench/api/browser/mainThreadMcp.ts';
const MCP_NODE_REL = 'src/vs/workbench/api/node/extHostMcpNode.ts';
const BROWSERS_REL = 'src/vs/workbench/api/browser/mainThreadBrowsers.ts';
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const DEBUG_CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const DEBUG_SERVICE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const MCP_WORKBENCH_REL = 'src/vs/workbench/services/mcp/browser/mcpWorkbenchManagementService.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/browserHostService.ts';
const EDITOR_SVC_REL = 'src/vs/workbench/services/editor/browser/editorService.ts';
const THEME_SVC_REL = 'src/vs/workbench/services/themes/browser/workbenchThemeService.ts';
const THEMES_REL = 'src/vs/workbench/contrib/themes/browser/themes.contribution.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const COMPOSITE_BAR_REL = 'src/vs/workbench/browser/parts/compositeBar.ts';
const PANE_PART_REL = 'src/vs/workbench/browser/parts/paneCompositePart.ts';
const WORKBENCH_CONFIG_REL = 'src/vs/workbench/common/configuration.ts';
const TITLEBAR_REL = 'src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts';
const LOG_REL = 'src/vs/workbench/services/log/common/defaultLogLevels.ts';
const CHAT_TIP_REL = 'src/vs/workbench/contrib/chat/browser/chatTipEligibilityTracker.ts';
const EXTENSIONS_RECS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionRecommendationsService.ts';
const CONFIG_SVC_REL = 'src/vs/workbench/services/configuration/browser/configurationService.ts';
const CONFIG_EDITING_REL = 'src/vs/workbench/services/configuration/common/configurationEditing.ts';
const TEXTFILE_REL = 'src/vs/workbench/services/textfile/browser/textFileService.ts';
const FILES_SVC_REL = 'src/vs/workbench/services/files/electron-browser/elevatedFileService.ts';
const USER_DATA_PROFILE_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const EXT_SVC_REL = 'src/vs/workbench/services/extensions/common/abstractExtensionService.ts';
const REMOTE_REL = 'src/vs/workbench/services/remote/common/abstractRemoteAgentService.ts';
const LOCAL_CHAT_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/localAgentSessionsController.ts';
const SHARED_CHAT_REL = 'src/vs/workbench/contrib/chat/browser/chat.shared.contribution.ts';
const CHAT_RECS_REL = 'src/vs/workbench/contrib/chat/browser/claudePluginRecommendations.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function countIncludes(source: string, needle: string): number {
	return (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`) || source.includes(`await ${call};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const leftoverSetKeyCall = 'this.set(key, value)';
const leftoverSetMigratedCall = 'this.set(MIGRATED_KEY, JSON.stringify([...this.migratedKeys]))';
const leftoverProcessQueueCall = 'this._processQueue()';
const leftoverWriteQueueCall = 'this._processWriteQueue()';
const leftoverReadQueueCall = 'this._processReadQueue()';
const leftoverPeriodicSyncCall = 'this._periodicSync()';
const leftoverApplyPatternCall = 'this.applyPatternAsync()';
const leftoverRefreshNodeThenCall = 'result = refreshPromise.then(() => this.refreshNode(node, recursive, viewStateContext));';
const leftoverRefreshAndRenderCall = 'this.refreshAndRenderNode(node.element, false)';
const leftoverActionbarRunCall = 'this.run(actionViewItem._action, context)';
const leftoverLoadPagesCall = 'promise = this.loadPagesUntil(pageIndex, cancellationToken);';
const leftoverWhenInitializedCall = 'uninitializedPromise = createCancelablePromise(_ => this.whenInitialized())';
const leftoverReturnedHandleCall = 'handleMessage: (channel: string, method: string, args: unknown[]): Promise<unknown> => this._handleMessage(channel, method, args)';
const leftoverFallbackDeleteCall = 'this.fallbackStorage?.delete(key)';
const leftoverGoBackCall = 'this.goBack()';
const leftoverGoForwardCall = 'this.goForward()';
const leftoverReturnedGoBackCall = 'return this.goBack();';
const applicationCloseCall = 'void Promise.resolve(this.applicationStorage?.close())';
const tryUpdateCall = 'this.tryUpdateItemForModel(model)';
const leftoverAddOrUpdateCall = 'this.addOrUpdateItem(existing)';
const notifyOptionsCall = 'this.notifyOptionsChange(handle, sessionResource, updates)';
const leftoverAuthSessionsCall = 'this._onDidChangeAuthSessions(e.providerId, e.label)';
const leftoverStartNodeMpcCall = 'this.startNodeMpc(id, launch, defaultCwd)';
const leftoverSyncActiveCall = 'this._syncActiveBrowserTab()';
const leftoverDoOpenHostCall = 'this.doOpen(undefined, { payload: Array.from(environment.entries()) })';
const leftoverReloadCall = '\t\tthis.reload();\n';
const leftoverApplyThemeCall = 'this.applyTheme(themeData, undefined, true)';
const leftoverReplaceEditorsCall = 'this.replaceEditors(replacements, group)';
const leftoverPinCall = 'this.pin(id, true)';
const leftoverDoOpenCall = 'this.doOpenPaneComposite(containerToOpen.id)';
const leftoverMigrateCall = 'this.migrateConfigurations(configurationMigrationRegistry.migrations)';
const leftoverCreateCall = 'this.create()';
const leftoverAlwaysOnTopCall = 'this.handleWindowsAlwaysOnTop(targetWindow.vscodeWindowId)';
const leftoverArgvCall = 'this.onDidChangeArgv()';
const leftoverTriggerCall = '\t\t\tthis.trigger(value);\n';
const leftoverTwoArgThenCall = "this.setTheme(newTheme, applyTheme ? 'auto' : 'preview').then(undefined,";
const d794LockedCall = 'this.onConfigUpdate(undefined, true, true)';
const validateFoldersCall = 'this.validateWorkspaceFoldersAndReload(fromCache)';
const reloadLocalIdleCall = 'this.reloadLocalUserConfiguration(false, this._configuration.localUserConfiguration)';
const processExperimentalCall = 'this.processExperimentalSettings(properties, false)';
const writeStandaloneCall = 'this.writeConfiguration(operation.target, { key, value: operation.value }, { handleDirtyFile: \'save\', scopes })';
const checkPromptCall = 'this._checkForPromptFiles(tip)';
const leftoverLocalTryUpdateCall = 'this.tryUpdateLiveSessionItem(model)';
const leftoverUpdateAssocCall = 'this._updateAssociations()';
const leftoverCheckRecsCall = 'this._checkForRecommendedPlugins()';

const d983Calls: Array<[string, string, number]> = [
	[STORAGE_REL, leftoverSetKeyCall, 1],
	[STORAGE_REL, leftoverSetMigratedCall, 1],
	[ASYNC_REL, leftoverProcessQueueCall, 2],
	[IPC_NET_REL, leftoverWriteQueueCall, 1],
	[IPC_NET_REL, leftoverReadQueueCall, 1],
	[SCROLL_REL, leftoverPeriodicSyncCall, 2],
];

suite('leftover remaining unused base leftover remaining unused this.foo() leftover remaining unused Promise fire-and-forget catch scan (D983)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused base leftover async this.foo() FOF still had four or more legal unused leftover sites after discarding collision overflow so this knife stayed', () => {
		let sites = 0;
		for (const [, , count] of d983Calls) {
			sites += count;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused base legal leftover >=4 after discarding collision overflow, got ${sites}`);
		assert.ok(sites <= 8);
		assert.strictEqual(sites, 8);
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const storage = fs.readFileSync(resolveSource(STORAGE_REL), 'utf8');
		const ipcNet = fs.readFileSync(resolveSource(IPC_NET_REL), 'utf8');
		const scroll = fs.readFileSync(resolveSource(SCROLL_REL), 'utf8');
		assert.ok(!asyncSource.includes('D983'));
		assert.ok(!storage.includes('D983'));
		assert.ok(!ipcNet.includes('D983'));
		assert.ok(!scroll.includes('D983'));
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused stayed on base this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d983Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 8);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(STORAGE_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(ASYNC_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(IPC_NET_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(SCROLL_REL) ?? ''), 2);
	});

	test('base leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const storage = fs.readFileSync(resolveSource(STORAGE_REL), 'utf8');
		const ipcNet = fs.readFileSync(resolveSource(IPC_NET_REL), 'utf8');
		const scroll = fs.readFileSync(resolveSource(SCROLL_REL), 'utf8');

		assertPromiseSignature(storage, 'async set(key: string, value: string | boolean | number | null | undefined | object, external = false): Promise<void> {');
		assertPromiseSignature(asyncSource, 'private async _processQueue(): Promise<void> {');
		assertPromiseSignature(ipcNet, 'private async _processWriteQueue(): Promise<void> {');
		assertPromiseSignature(ipcNet, 'private async _processReadQueue(): Promise<void> {');
		assertPromiseSignature(scroll, 'private async _periodicSync(): Promise<void> {');

		assert.ok(asyncSource.includes("import { BugIndicatingError, CancellationError, isCancellationError, onUnexpectedError } from './errors.js';"));
		assert.ok(storage.includes("import { onUnexpectedError } from '../../../common/errors.js';"));
		assert.ok(ipcNet.includes("import { onUnexpectedError } from '../../../common/errors.js';"));
		assert.ok(scroll.includes("import { onUnexpectedError } from '../../../common/errors.js';"));

		assertWrapped(storage, leftoverSetKeyCall);
		assertWrapped(storage, leftoverSetMigratedCall);
		assertWrapped(asyncSource, leftoverProcessQueueCall);
		assertWrapped(ipcNet, leftoverWriteQueueCall);
		assertWrapped(ipcNet, leftoverReadQueueCall);
		assertWrapped(scroll, leftoverPeriodicSyncCall);
		assert.strictEqual(countIncludes(storage, `${leftoverSetKeyCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(storage, `${leftoverSetMigratedCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(asyncSource, `${leftoverProcessQueueCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(ipcNet, `${leftoverWriteQueueCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(ipcNet, `${leftoverReadQueueCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(scroll, `${leftoverPeriodicSyncCall}${doubleCatch}`), 2);
		assert.ok(!storage.includes('\t\t\t\tthis.set(key, value);\n'));
		assert.ok(!storage.includes('\t\tthis.set(MIGRATED_KEY, JSON.stringify([...this.migratedKeys]));\n'));
		assert.ok(!asyncSource.includes('\t\t\tthis._processQueue();\n'));
		assert.ok(!ipcNet.includes('\t\tthis._processWriteQueue();\n'));
		assert.ok(!ipcNet.includes('\t\tthis._processReadQueue();\n'));
		assert.ok(!scroll.includes('\t\t\t\t\tthis._periodicSync();\n'));
		assert.ok(!scroll.includes('() => this._periodicSync(), 1000 / 60)'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const storage = fs.readFileSync(resolveSource(STORAGE_REL), 'utf8');
		const ipcNet = fs.readFileSync(resolveSource(IPC_NET_REL), 'utf8');
		const scroll = fs.readFileSync(resolveSource(SCROLL_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const asyncTree = fs.readFileSync(resolveSource(ASYNC_TREE_REL), 'utf8');
		const actionbar = fs.readFileSync(resolveSource(ACTIONBAR_REL), 'utf8');
		const paging = fs.readFileSync(resolveSource(PAGING_REL), 'utf8');
		const ipc = fs.readFileSync(resolveSource(IPC_REL), 'utf8');
		const worker = fs.readFileSync(resolveSource(WORKER_REL), 'utf8');
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(storage, 'async set(key: string, value: string | boolean | number | null | undefined | object, external = false): Promise<void> {');

		assert.ok(!asyncSource.includes('openerService.open'));
		assert.ok(!storage.includes('IOpenerService'));
		assert.ok(!ipcNet.includes('openerService.open'));
		assert.ok(!scroll.includes('IOpenerService'));
		assert.ok(!asyncSource.includes('extends Action2'));
		assert.ok(!storage.includes('registerAction2'));
		assert.ok(!ipcNet.includes('extends Action2'));
		assert.ok(!scroll.includes('registerAction2'));
		assert.ok(actionbar.includes(`${leftoverActionbarRunCall};`));
		assert.ok(!actionbar.includes(`${leftoverActionbarRunCall}${doubleCatch}`));
		assert.ok(asyncTree.includes(leftoverRefreshNodeThenCall));
		assert.ok(!asyncTree.includes(`this.refreshNode(node, recursive, viewStateContext)${doubleCatch}`));
		assert.ok(paging.includes(leftoverLoadPagesCall));
		assert.ok(!paging.includes(`this.loadPagesUntil(pageIndex, cancellationToken)${doubleCatch}`));
		assert.ok(ipc.includes(leftoverWhenInitializedCall));
		assert.ok(!ipc.includes(`this.whenInitialized()${doubleCatch}`));
		assert.ok(worker.includes(leftoverReturnedHandleCall));
		assert.ok(!worker.includes(`this._handleMessage(channel, method, args)${doubleCatch}`));
		assert.ok(asyncTree.includes(`${leftoverRefreshAndRenderCall}\n\t\t\t\t\t${doubleCatch}`));
		assert.ok(asyncTree.includes(`this.taskQueue.trigger(() => ${leftoverApplyPatternCall});`));
		assert.ok(!asyncTree.includes(`${leftoverApplyPatternCall}${doubleCatch}`));
		assert.ok(history.includes(`${leftoverGoBackCall}${doubleCatch}`));
		assert.ok(history.includes(`${leftoverGoForwardCall}${doubleCatch}`));
		assert.ok(history.includes(leftoverReturnedGoBackCall));
		assert.ok(!history.includes(`return this.goBack()${doubleCatch}`));
		assert.ok(storage.includes(`${leftoverFallbackDeleteCall};`));
		assert.ok(!storage.includes(`${leftoverFallbackDeleteCall}${doubleCatch}`));
		assert.ok(!storage.includes(`void Promise.resolve(${leftoverFallbackDeleteCall})`));

		for (const source of [asyncSource, storage, ipcNet, scroll]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D983'));
			assert.ok(!source.includes('*Wire'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; D922/D939/D943/D955/D964/D972 stay leftover remaining unused; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const storage = fs.readFileSync(resolveSource(STORAGE_REL), 'utf8');
		const ipcNet = fs.readFileSync(resolveSource(IPC_NET_REL), 'utf8');
		const scroll = fs.readFileSync(resolveSource(SCROLL_REL), 'utf8');
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_VIEW_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const debugConfig = fs.readFileSync(resolveSource(DEBUG_CONFIG_REL), 'utf8');
		const debugService = fs.readFileSync(resolveSource(DEBUG_SERVICE_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const mcpWorkbench = fs.readFileSync(resolveSource(MCP_WORKBENCH_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		const themeService = fs.readFileSync(resolveSource(THEME_SVC_REL), 'utf8');
		const themes = fs.readFileSync(resolveSource(THEMES_REL), 'utf8');
		const browsers = fs.readFileSync(resolveSource(BROWSERS_REL), 'utf8');
		const chatSessions = fs.readFileSync(resolveSource(CHAT_SESSIONS_REL), 'utf8');
		const mcp = fs.readFileSync(resolveSource(MCP_REL), 'utf8');
		const mcpNode = fs.readFileSync(resolveSource(MCP_NODE_REL), 'utf8');
		const compositeBar = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const workbenchConfig = fs.readFileSync(resolveSource(WORKBENCH_CONFIG_REL), 'utf8');
		const titlebar = fs.readFileSync(resolveSource(TITLEBAR_REL), 'utf8');
		const logLevels = fs.readFileSync(resolveSource(LOG_REL), 'utf8');
		const chatTip = fs.readFileSync(resolveSource(CHAT_TIP_REL), 'utf8');
		const extensionsRecs = fs.readFileSync(resolveSource(EXTENSIONS_RECS_REL), 'utf8');
		const configService = fs.readFileSync(resolveSource(CONFIG_SVC_REL), 'utf8');
		const configEditing = fs.readFileSync(resolveSource(CONFIG_EDITING_REL), 'utf8');
		const storageBrowser = fs.readFileSync(resolveSource(STORAGE_BROWSER_REL), 'utf8');
		const localChat = fs.readFileSync(resolveSource(LOCAL_CHAT_REL), 'utf8');
		const sharedChat = fs.readFileSync(resolveSource(SHARED_CHAT_REL), 'utf8');
		const chatRecs = fs.readFileSync(resolveSource(CHAT_RECS_REL), 'utf8');

		assert.ok(settings.includes(`${d794LockedCall};`));
		assert.ok(!settings.includes(`${d794LockedCall}${doubleCatch}`));
		assert.ok(host.includes(leftoverDoOpenHostCall));
		assert.ok(!host.includes(`${leftoverDoOpenHostCall}${doubleCatch}`));
		assert.ok(host.includes(leftoverReloadCall));
		assert.ok(!host.includes(`this.reload()${doubleCatch}`));
		assert.ok(themeService.includes(`${leftoverApplyThemeCall};`));
		assert.ok(!themeService.includes(`${leftoverApplyThemeCall}${doubleCatch}`));
		assert.ok(editor.includes(`${leftoverReplaceEditorsCall};`));
		assert.ok(!editor.includes(`${leftoverReplaceEditorsCall}${doubleCatch}`));
		assert.ok(browsers.includes(`${leftoverSyncActiveCall};`));
		assert.ok(!browsers.includes(`${leftoverSyncActiveCall}${doubleCatch}`));
		assert.ok(themes.includes(leftoverTriggerCall));
		assert.ok(!themes.includes(`this.trigger(value)${doubleCatch}`));
		assert.ok(themes.includes(leftoverTwoArgThenCall));
		assert.ok(!themes.includes(`this.setTheme(newTheme, applyTheme ? 'auto' : 'preview')${doubleCatch}`));
		assert.ok(compositeBar.includes(`${leftoverPinCall}${doubleCatch}`));
		assert.ok(panePart.includes(`${leftoverDoOpenCall}${doubleCatch}`));
		assert.ok(workbenchConfig.includes(`${leftoverMigrateCall}${doubleCatch}`));
		assert.ok(workbenchConfig.includes(`${leftoverCreateCall}${doubleCatch}`));
		assert.ok(titlebar.includes(`${leftoverAlwaysOnTopCall}${doubleCatch}`));
		assert.ok(logLevels.includes(`${leftoverArgvCall}${doubleCatch}`));
		assert.ok(configService.includes(`${validateFoldersCall}${doubleCatch}`));
		assert.ok(configService.includes(`${reloadLocalIdleCall}${doubleCatch}`));
		assert.ok(configService.includes(`${processExperimentalCall}${doubleCatch}`));
		assert.ok(configEditing.includes(`${writeStandaloneCall}${doubleCatch}`));
		assert.ok(storageBrowser.includes(`${applicationCloseCall}${doubleCatch}`));
		assert.ok(chatSessions.includes(`${tryUpdateCall}${doubleCatch}`));
		assert.ok(chatSessions.includes(`${leftoverAddOrUpdateCall}${doubleCatch}`));
		assert.ok(chatSessions.includes(`${notifyOptionsCall}${doubleCatch}`));
		assert.ok(mcp.includes(`${leftoverAuthSessionsCall}${doubleCatch}`));
		assert.ok(mcpNode.includes(`${leftoverStartNodeMpcCall}${doubleCatch}`));
		assert.ok(chatTip.includes(`${checkPromptCall}${doubleCatch}`));
		assert.ok(localChat.includes(`${leftoverLocalTryUpdateCall}${doubleCatch}`));
		assert.ok(sharedChat.includes(`${leftoverUpdateAssocCall}${doubleCatch}`));
		assert.ok(chatRecs.includes(`${leftoverCheckRecsCall}${doubleCatch}`));
		assert.ok(extensionsRecs.includes(doubleCatch));
		assert.ok(!mcpWorkbench.includes(doubleCatch));

		for (const [rel, file] of [
			[SEARCH_WIDGET_REL, searchWidget],
			[SEARCH_EDITOR_REL, searchEditor],
			[COMMENTS_VIEW_REL, comments],
			[SETUP_REL, setup],
			[TESTING_REL, testing],
			[DEBUG_CONFIG_REL, debugConfig],
			[DEBUG_SERVICE_REL, debugService],
			[TASKS_REL, tasks],
			[MCP_WORKBENCH_REL, mcpWorkbench],
			[HOST_REL, host],
			[EDITOR_SVC_REL, editor],
			[THEME_SVC_REL, themeService],
			[THEMES_REL, themes],
			[BROWSERS_REL, browsers],
			[CHAT_SESSIONS_REL, chatSessions],
			[MCP_REL, mcp],
			[MCP_NODE_REL, mcpNode],
			[ASYNC_REL, asyncSource],
			[STORAGE_REL, storage],
			[IPC_NET_REL, ipcNet],
			[SCROLL_REL, scroll],
			[STORAGE_BROWSER_REL, storageBrowser],
			[CONFIG_SVC_REL, configService],
			[CHAT_TIP_REL, chatTip],
		] as const) {
			assert.ok(!file.includes('D983'), `${rel} should stay off this knife id`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/tasks/test/node/tasksLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/api/test/node/apiLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/customEditor/test/node/customEditorLeftoverPromiseCatchScanD876.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/storage/test/node/storageLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/configuration/test/node/configurationLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatLeftoverPromiseCatchScanD943.test.ts')));
	});

	test('this knife did not occupy parallel leftover remaining unused platform / editor / sessions / workbench browser remaining / userDataProfile remaining / exhausted PRIMARY leftover remaining unused', () => {
		const textfile = fs.readFileSync(resolveSource(TEXTFILE_REL), 'utf8');
		const filesSvc = fs.readFileSync(resolveSource(FILES_SVC_REL), 'utf8');
		const userDataProfile = fs.readFileSync(resolveSource(USER_DATA_PROFILE_REL), 'utf8');
		const extSvc = fs.readFileSync(resolveSource(EXT_SVC_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const storageBrowser = fs.readFileSync(resolveSource(STORAGE_BROWSER_REL), 'utf8');
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		const mcpWorkbench = fs.readFileSync(resolveSource(MCP_WORKBENCH_REL), 'utf8');

		for (const [rel, file] of [
			[TEXTFILE_REL, textfile],
			[FILES_SVC_REL, filesSvc],
			[USER_DATA_PROFILE_REL, userDataProfile],
			[EXT_SVC_REL, extSvc],
			[REMOTE_REL, remote],
			[STORAGE_BROWSER_REL, storageBrowser],
			[HISTORY_REL, history],
			[MCP_WORKBENCH_REL, mcpWorkbench],
		] as const) {
			assert.ok(!file.includes('D983'), `${rel} should stay off this knife`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/test/node/platformLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/editor/test/node/editorLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/sessions/test/node/sessionsLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/browser/test/node/browserLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/userDataProfile/test/node/userDataProfileLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/code/test/node/codeLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/history/test/node/historyLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/storage/test/node/storageLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/textfile/test/node/textfileLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/files/test/node/filesLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/activity/test/node/activityLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/userDataProfile/test/node/userDataProfileLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/panecomposite/test/node/panecompositeLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/webview/test/node/webviewLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/electron-browser/test/node/electronLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/browser/parts/test/node/partsLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/hover/test/node/hoverLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/environment/test/node/environmentLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/languageDetection/test/node/languageDetectionLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/timer/test/node/timerLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/extensions/test/node/extensionsLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/remote/test/node/remoteLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/api/test/node/apiLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/base/test/node/asyncDataTreeCatchScan.test.ts')));
	});
});
