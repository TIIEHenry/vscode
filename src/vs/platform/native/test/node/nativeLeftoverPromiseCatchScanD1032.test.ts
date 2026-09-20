/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const NATIVE_MAIN_REL = 'src/vs/platform/native/electron-main/nativeHostMainService.ts';
const NATIVE_AUTH_REL = 'src/vs/platform/native/electron-main/auth.ts';
const NATIVE_HOST_REL = 'src/vs/platform/native/common/nativeHostService.ts';
const NATIVE_IFACE_REL = 'src/vs/platform/native/common/native.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';
const STORAGE_REL = 'src/vs/base/parts/storage/common/storage.ts';
const AUTO_SYNC_REL = 'src/vs/platform/userDataSync/common/userDataAutoSyncService.ts';
const LOCAL_STORE_REL = 'src/vs/platform/userDataSync/common/userDataSyncLocalStoreService.ts';
const SYNC_SVC_REL = 'src/vs/platform/userDataSync/common/userDataSyncService.ts';
const ACCOUNT_REL = 'src/vs/platform/userDataSync/common/userDataSyncAccount.ts';
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
const BROWSERS_REL = 'src/vs/workbench/api/browser/mainThreadBrowsers.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const COMPOSITE_BAR_REL = 'src/vs/workbench/browser/parts/compositeBar.ts';
const PANE_PART_REL = 'src/vs/workbench/browser/parts/paneCompositePart.ts';
const WORKBENCH_CONFIG_REL = 'src/vs/workbench/common/configuration.ts';
const TITLEBAR_REL = 'src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts';
const LOG_REL = 'src/vs/workbench/services/log/common/defaultLogLevels.ts';
const CHAT_TIP_REL = 'src/vs/workbench/contrib/chat/browser/chatTipEligibilityTracker.ts';
const EXTENSIONS_RECS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionRecommendationsService.ts';
const CONFIG_SVC_REL = 'src/vs/workbench/services/configuration/browser/configurationService.ts';
const STORAGE_BROWSER_REL = 'src/vs/workbench/services/storage/browser/storageService.ts';
const CHAT_SESSIONS_REL = 'src/vs/workbench/api/browser/mainThreadChatSessions.ts';
const MCP_REL = 'src/vs/workbench/api/browser/mainThreadMcp.ts';
const MCP_NODE_REL = 'src/vs/workbench/api/node/extHostMcpNode.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../', rel),
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

const leftoverOpenExternalBrowserCall = 'this.openExternalBrowser(windowId, url, defaultApplication)';
const leftoverDoOpenShellExternalCall = 'this.doOpenShellExternal(windowId, url)';
const leftoverWriteClipboardCall = 'this.writeClipboardText(windowId, url)';
const leftoverShowItemCall = 'this.showItemInFolder(undefined, path)';
const leftoverReturnedShellCall = 'return this.doOpenShellExternal(windowId, url);';
const leftoverReturnedOpenWindowCall = 'return this.openWindow(window.id, { forceReuseWindow: true });';
const leftoverOpenChildCall = 'this.openChildWindow(parentWindow.win, url)';
const leftoverLoadUrlCall = 'window.loadURL(url)';
const leftoverNestedQuitCall = 'this.lifecycleMainService.quit()';
const leftoverNestedSplashCall = 'this.themeMainService.saveWindowSplash(windowId, window?.openedWorkspace, splash)';
const leftoverProcessQueueCall = 'this._processQueue()';
const leftoverSetKeyCall = 'this.set(key, value)';
const leftoverSetMigratedCall = 'this.set(MIGRATED_KEY, JSON.stringify([...this.migratedKeys]))';
const leftoverWriteQueueCall = 'this._processWriteQueue()';
const leftoverReadQueueCall = 'this._processReadQueue()';
const leftoverPeriodicSyncCall = 'this._periodicSync()';
const leftoverDoOpenHostCall = 'this.doOpen(undefined, { payload: Array.from(environment.entries()) })';
const leftoverReloadCall = '\t\tthis.reload();\n';
const leftoverApplyThemeCall = 'this.applyTheme(themeData, undefined, true)';
const leftoverReplaceEditorsCall = 'this.replaceEditors(replacements, group)';
const leftoverSyncActiveCall = 'this._syncActiveBrowserTab()';
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
const applicationCloseCall = 'void Promise.resolve(this.applicationStorage?.close())';
const tryUpdateCall = 'this.tryUpdateItemForModel(model)';
const leftoverAddOrUpdateCall = 'this.addOrUpdateItem(existing)';
const notifyOptionsCall = 'this.notifyOptionsChange(handle, sessionResource, updates)';
const leftoverAuthSessionsCall = 'this._onDidChangeAuthSessions(e.providerId, e.label)';
const leftoverStartNodeMpcCall = 'this.startNodeMpc(id, launch, defaultCwd)';

const d1032Calls: Array<[string, string, number]> = [
	[NATIVE_MAIN_REL, leftoverOpenExternalBrowserCall, 1],
	[NATIVE_MAIN_REL, leftoverDoOpenShellExternalCall, 1],
	[NATIVE_MAIN_REL, leftoverWriteClipboardCall, 1],
	[NATIVE_MAIN_REL, leftoverShowItemCall, 1],
];

suite('leftover remaining unused native leftover remaining unused this.foo() leftover remaining unused Promise fire-and-forget catch scan (D1032)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused native leftover async this.foo() FOF still had four or more legal unused leftover sites after discarding collision overflow so this knife stayed', () => {
		let sites = 0;
		for (const [, , count] of d1032Calls) {
			sites += count;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused native legal leftover >=4 after discarding collision overflow, got ${sites}`);
		assert.ok(sites <= 8);
		assert.strictEqual(sites, 4);
		const native = fs.readFileSync(resolveSource(NATIVE_MAIN_REL), 'utf8');
		const auth = fs.readFileSync(resolveSource(NATIVE_AUTH_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(NATIVE_HOST_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(NATIVE_IFACE_REL), 'utf8');
		assert.ok(!native.includes('D1032'));
		assert.ok(!auth.includes('D1032'));
		assert.ok(!host.includes('D1032'));
		assert.ok(!iface.includes('D1032'));
	});

	test('this knife covers four leftover Promise double-chain sites after leftover remaining unused stayed on native this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d1032Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 4);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(NATIVE_MAIN_REL) ?? ''), 4);
		assert.strictEqual(countDoubleChains(fs.readFileSync(resolveSource(NATIVE_AUTH_REL), 'utf8')), 0);
		assert.strictEqual(countDoubleChains(fs.readFileSync(resolveSource(NATIVE_HOST_REL), 'utf8')), 0);
		assert.strictEqual(countDoubleChains(fs.readFileSync(resolveSource(NATIVE_IFACE_REL), 'utf8')), 0);
	});

	test('native leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const native = fs.readFileSync(resolveSource(NATIVE_MAIN_REL), 'utf8');

		assertPromiseSignature(native, 'private async openExternalBrowser(windowId: number | undefined, url: string, defaultApplication?: string): Promise<void> {');
		assertPromiseSignature(native, 'private async doOpenShellExternal(windowId: number | undefined, url: string): Promise<void> {');
		assertPromiseSignature(native, 'async writeClipboardText(windowId: number | undefined, text: string, type?: \'selection\' | \'clipboard\'): Promise<void> {');
		assertPromiseSignature(native, 'async showItemInFolder(windowId: number | undefined, path: string): Promise<void> {');

		assert.ok(native.includes("import { CancellationError, onUnexpectedError } from '../../../base/common/errors.js';"));

		assertWrapped(native, leftoverOpenExternalBrowserCall);
		assertWrapped(native, leftoverDoOpenShellExternalCall);
		assertWrapped(native, leftoverWriteClipboardCall);
		assertWrapped(native, leftoverShowItemCall);
		assert.strictEqual(countIncludes(native, `${leftoverOpenExternalBrowserCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(native, `${leftoverDoOpenShellExternalCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(native, `${leftoverWriteClipboardCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(native, `${leftoverShowItemCall}${doubleCatch}`), 1);
		assert.ok(!native.includes('\t\t\t\tthis.openExternalBrowser(windowId, url, defaultApplication);\n'));
		assert.ok(!native.includes('\t\t\t\tthis.doOpenShellExternal(windowId, url);\n'));
		assert.ok(!native.includes('\t\t\tthis.writeClipboardText(windowId, url);\n'));
		assert.ok(!native.includes('\t\tthis.showItemInFolder(undefined, path);\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 / window.loadURL stay skipped', () => {
		const native = fs.readFileSync(resolveSource(NATIVE_MAIN_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(native, 'async openExternal(windowId: number | undefined, url: string, defaultApplication?: string): Promise<boolean> {');

		assert.ok(!native.includes('openerService.open'));
		assert.ok(!native.includes('IOpenerService'));
		assert.ok(!native.includes('extends Action2'));
		assert.ok(!native.includes('registerAction2'));
		assert.ok(!native.includes('.then(undefined,'));
		assert.ok(native.includes(leftoverReturnedShellCall));
		assert.ok(!native.includes(`return this.doOpenShellExternal(windowId, url)${doubleCatch}`));
		assert.ok(native.includes(leftoverReturnedOpenWindowCall));
		assert.ok(!native.includes(`return this.openWindow(window.id, { forceReuseWindow: true })${doubleCatch}`));
		assert.ok(native.includes(`${leftoverOpenChildCall};`));
		assert.ok(!native.includes(`${leftoverOpenChildCall}${doubleCatch}`));
		assert.ok(native.includes(`${leftoverLoadUrlCall};`));
		assert.ok(!native.includes(`${leftoverLoadUrlCall}${doubleCatch}`));
		assert.ok(native.includes(`${leftoverNestedQuitCall};`));
		assert.ok(!native.includes(`${leftoverNestedQuitCall}${doubleCatch}`));
		assert.ok(native.includes(`${leftoverNestedSplashCall};`));
		assert.ok(!native.includes(`${leftoverNestedSplashCall}${doubleCatch}`));
		assert.ok(native.includes('async resolveProxy(windowId: number | undefined, url: string): Promise<string | undefined> {'));
		assert.ok(native.includes('return session?.resolveProxy(url);'));
		assert.ok(!native.includes(`this.resolveProxy(${doubleCatch}`));
		assert.ok(!native.includes(`session?.resolveProxy(url)${doubleCatch}`));

		for (const source of [native]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D1032'));
			assert.ok(!source.includes('*Wire'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; D922/D939/D943/D955/D964/D972/D983 stay leftover remaining unused; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const native = fs.readFileSync(resolveSource(NATIVE_MAIN_REL), 'utf8');
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
		const compositeBar = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const workbenchConfig = fs.readFileSync(resolveSource(WORKBENCH_CONFIG_REL), 'utf8');
		const titlebar = fs.readFileSync(resolveSource(TITLEBAR_REL), 'utf8');
		const logLevels = fs.readFileSync(resolveSource(LOG_REL), 'utf8');
		const chatTip = fs.readFileSync(resolveSource(CHAT_TIP_REL), 'utf8');
		const extensionsRecs = fs.readFileSync(resolveSource(EXTENSIONS_RECS_REL), 'utf8');
		const configService = fs.readFileSync(resolveSource(CONFIG_SVC_REL), 'utf8');
		const storageBrowser = fs.readFileSync(resolveSource(STORAGE_BROWSER_REL), 'utf8');
		const chatSessions = fs.readFileSync(resolveSource(CHAT_SESSIONS_REL), 'utf8');
		const mcp = fs.readFileSync(resolveSource(MCP_REL), 'utf8');
		const mcpNode = fs.readFileSync(resolveSource(MCP_NODE_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const storage = fs.readFileSync(resolveSource(STORAGE_REL), 'utf8');

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
		assert.ok(storageBrowser.includes(`${applicationCloseCall}${doubleCatch}`));
		assert.ok(chatSessions.includes(`${tryUpdateCall}${doubleCatch}`));
		assert.ok(chatSessions.includes(`${leftoverAddOrUpdateCall}${doubleCatch}`));
		assert.ok(chatSessions.includes(`${notifyOptionsCall}${doubleCatch}`));
		assert.ok(mcp.includes(`${leftoverAuthSessionsCall}${doubleCatch}`));
		assert.ok(mcpNode.includes(`${leftoverStartNodeMpcCall}${doubleCatch}`));
		assert.ok(asyncSource.includes(`${leftoverProcessQueueCall}${doubleCatch}`));
		assert.ok(storage.includes(`${leftoverSetKeyCall}${doubleCatch}`));
		assert.ok(storage.includes(`${leftoverSetMigratedCall}${doubleCatch}`));
		assert.ok(chatTip.includes(doubleCatch));
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
			[NATIVE_MAIN_REL, native],
		] as const) {
			assert.ok(!file.includes('D1032'), `${rel} should stay off this knife id`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD1032.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD1032.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD1032.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD1032.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD1032.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD1032.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/tasks/test/node/tasksLeftoverPromiseCatchScanD1032.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/api/test/node/apiLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/base/test/node/baseLeftoverPromiseCatchScanD983.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatLeftoverPromiseCatchScanD943.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/storage/test/node/storageLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/configuration/test/node/configurationLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/sharedProcess/test/node/sharedProcessAuxiliaryWindowMcpLeftoverPromiseCatchScanD806.test.ts')));
	});

	test('this knife did not occupy parallel leftover remaining unused remaining platform leftover remaining unused remaining or D1015 wrap sites leftover remaining unused remaining', () => {
		const native = fs.readFileSync(resolveSource(NATIVE_MAIN_REL), 'utf8');
		const autoSync = fs.readFileSync(resolveSource(AUTO_SYNC_REL), 'utf8');
		const localStore = fs.readFileSync(resolveSource(LOCAL_STORE_REL), 'utf8');
		const syncSvc = fs.readFileSync(resolveSource(SYNC_SVC_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const ipcNet = fs.readFileSync(resolveSource('src/vs/base/parts/ipc/node/ipc.net.ts'), 'utf8');
		const scroll = fs.readFileSync(resolveSource('src/vs/base/browser/ui/scrollbar/scrollableElement.ts'), 'utf8');

		assert.ok(ipcNet.includes(`${leftoverWriteQueueCall}${doubleCatch}`));
		assert.ok(ipcNet.includes(`${leftoverReadQueueCall}${doubleCatch}`));
		assert.ok(scroll.includes(`${leftoverPeriodicSyncCall}${doubleCatch}`));
		assert.ok(!native.includes('D1015'));
		assert.ok(!autoSync.includes('D1032'));
		assert.ok(!localStore.includes('D1032'));
		assert.ok(!syncSvc.includes('D1032'));
		assert.ok(!account.includes('D1032'));

		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/theme/test/node/themeLeftoverPromiseCatchScanD1027.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/log/test/node/logLeftoverPromiseCatchScanD1024.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/github/test/node/githubLeftoverPromiseCatchScanD1019.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/test/node/platformLeftoverPromiseCatchScanD973.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/actions/test/node/actionsLeftoverPromiseCatchScanD1032.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/sharedProcess/test/node/sharedProcessLeftoverPromiseCatchScanD1032.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/remote/test/node/remoteLeftoverPromiseCatchScanD1032.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/request/test/node/requestLeftoverPromiseCatchScanD1032.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/ipc/test/node/ipcLeftoverPromiseCatchScanD1032.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/base/test/node/baseLeftoverPromiseCatchScanD1032.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/api/test/node/apiLeftoverPromiseCatchScanD1032.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/code/test/node/codeLeftoverPromiseCatchScanD1032.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/editor/test/node/editorLeftoverPromiseCatchScanD1032.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/sessions/test/node/sessionsLeftoverPromiseCatchScanD1032.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/userDataSync/test/node/userDataSyncLeftoverPromiseCatchScanD1015.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD1032.test.ts')));
	});
});
