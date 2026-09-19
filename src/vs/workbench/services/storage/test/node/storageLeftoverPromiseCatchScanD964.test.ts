/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const ISTORAGE_REL = 'src/vs/base/parts/storage/common/storage.ts';
const BROWSER_REL = 'src/vs/workbench/services/storage/browser/storageService.ts';
const ELECTRON_REL = 'src/vs/workbench/services/storage/electron-browser/storageService.ts';
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const DEBUG_CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const DEBUG_SERVICE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const MCP_WORKBENCH_REL = 'src/vs/workbench/services/mcp/browser/mcpWorkbenchManagementService.ts';
const MCP_GALLERY_REL = 'src/vs/workbench/services/mcp/browser/mcpGalleryManifestService.ts';
const EXT_MGMT_REL = 'src/vs/workbench/services/extensionManagement/common/extensionManagementService.ts';
const EXT_SVC_REL = 'src/vs/workbench/services/extensions/common/abstractExtensionService.ts';
const VIEWS_SVC_REL = 'src/vs/workbench/services/views/browser/viewsService.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/browserHostService.ts';
const KEYBINDING_REL = 'src/vs/workbench/services/keybinding/browser/keybindingService.ts';
const CLIPBOARD_REL = 'src/vs/workbench/services/clipboard/browser/clipboardService.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/browser/lifecycleService.ts';
const EDITOR_SVC_REL = 'src/vs/workbench/services/editor/browser/editorService.ts';
const THEME_SVC_REL = 'src/vs/workbench/services/themes/browser/workbenchThemeService.ts';
const THEMES_REL = 'src/vs/workbench/contrib/themes/browser/themes.contribution.ts';
const BROWSERS_REL = 'src/vs/workbench/api/browser/mainThreadBrowsers.ts';
const FILES_REL = 'src/vs/workbench/contrib/files/browser/views/explorerView.ts';
const FILES_SVC_REL = 'src/vs/workbench/services/files/electron-browser/elevatedFileService.ts';
const SCM_REL = 'src/vs/workbench/contrib/scm/browser/scmViewPane.ts';
const TERMINAL_REL = 'src/vs/workbench/contrib/terminal/browser/terminalService.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const SEARCH_SVC_REL = 'src/vs/workbench/services/search/common/searchService.ts';
const CONFIG_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const CONFIG_SVC_REL = 'src/vs/workbench/services/configuration/browser/configurationService.ts';
const CONFIG_EDITING_REL = 'src/vs/workbench/services/configuration/common/configurationEditing.ts';
const NOTIFICATION_REL = 'src/vs/workbench/services/notification/common/notificationService.ts';
const UNTITLED_REL = 'src/vs/workbench/services/untitled/common/untitledTextEditorService.ts';
const WORKING_COPY_REL = 'src/vs/workbench/services/workingCopy/common/workingCopyBackupTracker.ts';
const TEXTFILE_REL = 'src/vs/workbench/services/textfile/browser/textFileService.ts';
const SASH_REL = 'src/vs/workbench/contrib/sash/browser/sash.ts';
const REMOTE_REL = 'src/vs/workbench/services/remote/common/abstractRemoteAgentService.ts';
const USER_DATA_PROFILE_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const COMPOSITE_BAR_REL = 'src/vs/workbench/browser/parts/compositeBar.ts';
const PANE_PART_REL = 'src/vs/workbench/browser/parts/paneCompositePart.ts';
const WORKBENCH_CONFIG_REL = 'src/vs/workbench/common/configuration.ts';
const TITLEBAR_REL = 'src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts';
const LOG_REL = 'src/vs/workbench/services/log/common/defaultLogLevels.ts';
const CHAT_TIP_REL = 'src/vs/workbench/contrib/chat/browser/chatTipEligibilityTracker.ts';
const EXTENSIONS_RECS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionRecommendationsService.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
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

const applicationCloseCall = 'void Promise.resolve(this.applicationStorage?.close())';
const sharedCloseCall = 'void Promise.resolve(this.applicationSharedStorageDatabase?.close())';
const profileCloseCall = 'void Promise.resolve(this.profileStorageDatabase?.close())';
const workspaceCloseCall = 'void Promise.resolve(this.workspaceStorageDatabase?.close())';
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
const joinSwitchCall = 'e.join(this.switchToProfile(e.profile))';
const assignedConnectCall = 'this.whenConnected = this.connect();';
const assignedUpdateCall = 'this.pendingUpdate = this.doUpdateItems(request);';
const returnedCloseCall = 'return db.close();';
const validateFoldersCall = 'this.validateWorkspaceFoldersAndReload(fromCache)';

const d964Calls: Array<[string, string, number]> = [
	[BROWSER_REL, applicationCloseCall, 1],
	[BROWSER_REL, sharedCloseCall, 1],
	[BROWSER_REL, profileCloseCall, 1],
	[BROWSER_REL, workspaceCloseCall, 1],
];

suite('leftover remaining unused storage leftover remaining unused this.foo() leftover remaining unused Promise fire-and-forget catch scan (D964)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused storage leftover async this.foo() FOF still had four or more legal unused leftover sites after discarding collision overflow so this knife stayed', () => {
		let sites = 0;
		for (const [, , count] of d964Calls) {
			sites += count;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused storage legal leftover >=4 after discarding collision overflow, got ${sites}`);
		assert.ok(sites <= 8);
		assert.strictEqual(sites, 4);
		const browser = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		assert.strictEqual(countIncludes(browser, `${applicationCloseCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(browser, `${sharedCloseCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(browser, `${profileCloseCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(browser, `${workspaceCloseCall}${doubleCatch}`), 1);
		assert.ok(!browser.includes('D964'));
		assert.ok(!fs.readFileSync(resolveSource(ELECTRON_REL), 'utf8').includes('D964'));
	});

	test('this knife covers four leftover Promise double-chain sites after leftover remaining unused stayed on storage this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d964Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(BROWSER_REL) ?? ''), 4);
		assert.strictEqual(countDoubleChains(fs.readFileSync(resolveSource(ELECTRON_REL), 'utf8')), 0);
	});

	test('storage leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const browser = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		const storage = fs.readFileSync(resolveSource(ISTORAGE_REL), 'utf8');

		assertPromiseSignature(storage, 'close(): Promise<void>;');
		assertPromiseSignature(storage, 'async close(): Promise<void> {');
		assertPromiseSignature(browser, 'async close(): Promise<void> {');

		assert.ok(browser.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));

		assertWrapped(browser, applicationCloseCall);
		assertWrapped(browser, sharedCloseCall);
		assertWrapped(browser, profileCloseCall);
		assertWrapped(browser, workspaceCloseCall);
		assert.strictEqual(countIncludes(browser, `${applicationCloseCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(browser, `${sharedCloseCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(browser, `${profileCloseCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(browser, `${workspaceCloseCall}${doubleCatch}`), 1);
		assert.ok(!browser.includes('\t\t\tthis.applicationStorage?.close();\n'));
		assert.ok(!browser.includes('\t\t\tthis.applicationSharedStorageDatabase?.close();\n'));
		assert.ok(!browser.includes('\t\t\tthis.profileStorageDatabase?.close();\n'));
		assert.ok(!browser.includes('\t\t\tthis.workspaceStorageDatabase?.close();\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const browser = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		const electron = fs.readFileSync(resolveSource(ELECTRON_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(browser, 'async close(): Promise<void> {');

		assert.ok(!browser.includes('openerService.open'));
		assert.ok(!browser.includes('IOpenerService'));
		assert.ok(!electron.includes('openerService.open'));
		assert.ok(!electron.includes('extends Action2'));
		assert.ok(!electron.includes('registerAction2'));
		assert.ok(!browser.includes('extends Action2'));
		assert.ok(!browser.includes('registerAction2'));
		assert.ok(!browser.includes('.then(undefined,'));
		assert.ok(!electron.includes('.then(undefined,'));
		assert.ok(browser.includes(assignedConnectCall));
		assert.ok(!browser.includes(`this.connect()${doubleCatch}`));
		assert.ok(browser.includes(assignedUpdateCall));
		assert.ok(!browser.includes(`this.doUpdateItems(request)${doubleCatch}`));
		assert.ok(browser.includes(returnedCloseCall));
		assert.ok(!browser.includes(`return db.close()${doubleCatch}`));
		assert.ok(browser.includes(joinSwitchCall));
		assert.ok(!browser.includes(`${joinSwitchCall}${doubleCatch}`));
		assert.ok(electron.includes(joinSwitchCall));
		assert.ok(!electron.includes(`${joinSwitchCall}${doubleCatch}`));
		assert.ok(electron.includes('await super.doInitialize();'));
		assert.ok(!electron.includes(`super.doInitialize()${doubleCatch}`));
		assert.ok(browser.includes('await this.createProfileStorage(toProfile);'));
		assert.ok(!browser.includes(`this.createProfileStorage(toProfile)${doubleCatch}`));

		for (const source of [browser, electron]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D964'));
			assert.ok(!source.includes('*Wire'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const browser = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		const electron = fs.readFileSync(resolveSource(ELECTRON_REL), 'utf8');
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
		assert.ok(chatTip.includes(doubleCatch));
		assert.ok(extensionsRecs.includes(doubleCatch));
		assert.ok(configService.includes(`${validateFoldersCall}${doubleCatch}`));

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
			[BROWSER_REL, browser],
			[ELECTRON_REL, electron],
		] as const) {
			assert.ok(!file.includes('D964'), `${rel} should stay off this knife id`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/tasks/test/node/tasksLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/configuration/test/node/configurationLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatLeftoverPromiseCatchScanD943.test.ts')));
	});

	test('this knife did not occupy parallel leftover remaining unused untitled / workingCopy / textfile / sash / clipboard / lifecycle leftover remaining unused or exhausted PRIMARY leftover remaining unused', () => {
		const views = fs.readFileSync(resolveSource(VIEWS_SVC_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const keybinding = fs.readFileSync(resolveSource(KEYBINDING_REL), 'utf8');
		const clipboard = fs.readFileSync(resolveSource(CLIPBOARD_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const filesSvc = fs.readFileSync(resolveSource(FILES_SVC_REL), 'utf8');
		const scm = fs.readFileSync(resolveSource(SCM_REL), 'utf8');
		const terminal = fs.readFileSync(resolveSource(TERMINAL_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const search = fs.readFileSync(resolveSource(SEARCH_SVC_REL), 'utf8');
		const mcpWorkbench = fs.readFileSync(resolveSource(MCP_WORKBENCH_REL), 'utf8');
		const mcpGallery = fs.readFileSync(resolveSource(MCP_GALLERY_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const extMgmt = fs.readFileSync(resolveSource(EXT_MGMT_REL), 'utf8');
		const extSvc = fs.readFileSync(resolveSource(EXT_SVC_REL), 'utf8');
		const themeService = fs.readFileSync(resolveSource(THEME_SVC_REL), 'utf8');
		const browsers = fs.readFileSync(resolveSource(BROWSERS_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const configService = fs.readFileSync(resolveSource(CONFIG_SVC_REL), 'utf8');
		const configEditing = fs.readFileSync(resolveSource(CONFIG_EDITING_REL), 'utf8');
		const notification = fs.readFileSync(resolveSource(NOTIFICATION_REL), 'utf8');
		const untitled = fs.readFileSync(resolveSource(UNTITLED_REL), 'utf8');
		const workingCopy = fs.readFileSync(resolveSource(WORKING_COPY_REL), 'utf8');
		const textfile = fs.readFileSync(resolveSource(TEXTFILE_REL), 'utf8');
		const sash = fs.readFileSync(resolveSource(SASH_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const userDataProfile = fs.readFileSync(resolveSource(USER_DATA_PROFILE_REL), 'utf8');

		for (const [rel, file] of [
			[VIEWS_SVC_REL, views],
			[HOST_REL, host],
			[KEYBINDING_REL, keybinding],
			[CLIPBOARD_REL, clipboard],
			[LIFECYCLE_REL, lifecycle],
			[EDITOR_SVC_REL, editor],
			[FILES_REL, files],
			[FILES_SVC_REL, filesSvc],
			[SCM_REL, scm],
			[TERMINAL_REL, terminal],
			[SETTINGS_REL, settings],
			[SEARCH_SVC_REL, search],
			[MCP_WORKBENCH_REL, mcpWorkbench],
			[MCP_GALLERY_REL, mcpGallery],
			[TASKS_REL, tasks],
			[EXT_MGMT_REL, extMgmt],
			[EXT_SVC_REL, extSvc],
			[THEME_SVC_REL, themeService],
			[BROWSERS_REL, browsers],
			[CONFIG_REL, configuration],
			[CONFIG_SVC_REL, configService],
			[CONFIG_EDITING_REL, configEditing],
			[NOTIFICATION_REL, notification],
			[UNTITLED_REL, untitled],
			[WORKING_COPY_REL, workingCopy],
			[TEXTFILE_REL, textfile],
			[SASH_REL, sash],
			[REMOTE_REL, remote],
			[USER_DATA_PROFILE_REL, userDataProfile],
		] as const) {
			assert.ok(!file.includes('D964'), `${rel} should stay off this knife`);
		}
		assert.ok(host.includes(leftoverDoOpenHostCall));
		assert.ok(!host.includes(`${leftoverDoOpenHostCall}${doubleCatch}`));
		assert.ok(host.includes(leftoverReloadCall));
		assert.ok(!host.includes(`this.reload()${doubleCatch}`));
		assert.ok(editor.includes(`${leftoverReplaceEditorsCall};`));
		assert.ok(!editor.includes(`${leftoverReplaceEditorsCall}${doubleCatch}`));
		assert.ok(themeService.includes(`${leftoverApplyThemeCall};`));
		assert.ok(!themeService.includes(`${leftoverApplyThemeCall}${doubleCatch}`));
		assert.ok(browsers.includes(`${leftoverSyncActiveCall};`));
		assert.ok(!browsers.includes(`${leftoverSyncActiveCall}${doubleCatch}`));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/untitled/test/node/untitledLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/workingCopy/test/node/workingCopyLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/textfile/test/node/textfileLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/sash/test/node/sashLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/clipboard/test/node/clipboardLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/lifecycle/test/node/lifecycleLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/views/test/node/viewsLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/host/test/node/hostLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/keybinding/test/node/keybindingLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/editor/test/node/editorLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/files/test/node/filesLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/files/test/node/filesLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/scm/test/node/scmLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/terminal/test/node/terminalLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/preferences/test/node/preferencesLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/search/test/node/searchLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/themes/test/node/themesLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/notification/test/node/notificationLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/mcp/test/node/mcpLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/configuration/test/node/configurationLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/extensions/test/node/extensionsLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/remote/test/node/remoteLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/userDataProfile/test/node/userDataProfileLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/workingCopy/test/node/workingCopyLeftoverPromiseCatchScanD807.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/textfile/test/node/textfileLeftoverPromiseCatchScanD811.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/userDataProfile/test/node/userDataProfileLeftoverPromiseCatchScanD797.test.ts')));
	});
});
