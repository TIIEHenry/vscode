/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const FIND_HISTORY_REL = 'src/vs/editor/contrib/find/browser/findWidgetSearchHistory.ts';
const REPLACE_HISTORY_REL = 'src/vs/editor/contrib/find/browser/replaceWidgetHistory.ts';
const FIND_WIDGET_REL = 'src/vs/editor/contrib/find/browser/findWidget.ts';
const HOVER_REL = 'src/vs/editor/contrib/hover/browser/hoverActions.ts';
const MARKER_REL = 'src/vs/editor/contrib/hover/browser/markerHoverParticipant.ts';
const LINKS_REL = 'src/vs/editor/contrib/links/browser/links.ts';
const WORD_REL = 'src/vs/editor/contrib/wordHighlighter/browser/wordHighlighter.ts';
const FOLD_REL = 'src/vs/editor/contrib/folding/browser/folding.ts';
const STICKY_REL = 'src/vs/editor/contrib/stickyScroll/browser/stickyScrollController.ts';
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
const CONFIG_SVC_REL = 'src/vs/workbench/services/configuration/browser/configurationService.ts';
const STORAGE_BROWSER_REL = 'src/vs/workbench/services/storage/browser/storageService.ts';
const STORAGE_ELECTRON_REL = 'src/vs/workbench/services/storage/electron-browser/storageService.ts';
const ISTORAGE_REL = 'src/vs/base/parts/storage/common/storage.ts';
const ENVIRONMENT_REL = 'src/vs/workbench/services/environment/browser/environmentService.ts';
const UNTITLED_REL = 'src/vs/workbench/services/untitled/common/untitledTextEditorService.ts';
const WORKING_COPY_REL = 'src/vs/workbench/services/workingCopy/common/workingCopyBackupTracker.ts';
const TEXTFILE_REL = 'src/vs/workbench/services/textfile/browser/textFileService.ts';
const SASH_REL = 'src/vs/workbench/contrib/sash/browser/sash.ts';
const CLIPBOARD_REL = 'src/vs/workbench/services/clipboard/browser/clipboardService.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/browser/lifecycleService.ts';
const EXT_SVC_REL = 'src/vs/workbench/services/extensions/common/abstractExtensionService.ts';
const REMOTE_REL = 'src/vs/workbench/services/remote/common/abstractRemoteAgentService.ts';
const FILES_REL = 'src/vs/workbench/contrib/files/browser/views/explorerView.ts';
const USER_DATA_PROFILE_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const PANE_PART_REL = 'src/vs/workbench/browser/parts/paneCompositePart.ts';
const COMPOSITE_BAR_REL = 'src/vs/workbench/browser/parts/compositeBar.ts';
const WEBVIEW_REL = 'src/vs/workbench/contrib/webview/browser/webviewElement.ts';
const TITLEBAR_REL = 'src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts';
const CHAT_TIP_REL = 'src/vs/workbench/contrib/chat/browser/chatTipEligibilityTracker.ts';
const LANG_DETECT_REL = 'src/vs/workbench/contrib/languageDetection/browser/languageDetection.contribution.ts';
const TIMER_REL = 'src/vs/workbench/services/timer/browser/timerService.ts';
const CODE_MAIN_REL = 'src/vs/code/electron-main/app.ts';
const EXTENSIONS_RECS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionRecommendationsService.ts';

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

const leftoverSaveCall = 'this.save()';
const leftoverDoOpenHostCall = 'this.doOpen(undefined, { payload: Array.from(environment.entries()) })';
const leftoverReloadCall = '\t\tthis.reload();\n';
const leftoverApplyThemeCall = 'this.applyTheme(themeData, undefined, true)';
const leftoverReplaceEditorsCall = 'this.replaceEditors(replacements, group)';
const leftoverSyncActiveCall = 'this._syncActiveBrowserTab()';
const leftoverTriggerCall = '\t\t\tthis.trigger(value);\n';
const leftoverTwoArgThenCall = "this.setTheme(newTheme, applyTheme ? 'auto' : 'preview').then(undefined,";
const d794LockedCall = 'this.onConfigUpdate(undefined, true, true)';
const leftoverPinCall = 'this.pin(id, true)';
const leftoverDoOpenCall = 'this.doOpenPaneComposite(containerToOpen.id)';
const leftoverAlwaysOnTopCall = 'this.handleWindowsAlwaysOnTop(targetWindow.vscodeWindowId)';
const validateFoldersCall = 'this.validateWorkspaceFoldersAndReload(fromCache)';
const applicationCloseCall = 'void Promise.resolve(this.applicationStorage?.close())';
const sharedCloseCall = 'void Promise.resolve(this.applicationSharedStorageDatabase?.close())';
const profileCloseCall = 'void Promise.resolve(this.profileStorageDatabase?.close())';
const workspaceCloseCall = 'void Promise.resolve(this.workspaceStorageDatabase?.close())';
const findWidgetTwoArgThenCall = 'this._updateHistoryDelayer.trigger(this._updateHistory.bind(this)).then(undefined, onUnexpectedError);';

const d978Calls: Array<[string, string, number]> = [
	[FIND_HISTORY_REL, leftoverSaveCall, 4],
	[REPLACE_HISTORY_REL, leftoverSaveCall, 4],
];

suite('leftover remaining unused editor leftover remaining unused this.foo() leftover remaining unused Promise fire-and-forget catch scan (D978)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused editor leftover async this.foo() FOF still had four or more legal unused leftover sites after discarding collision overflow so this knife stayed', () => {
		let sites = 0;
		for (const [, , count] of d978Calls) {
			sites += count;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused editor legal leftover >=4 after discarding collision overflow, got ${sites}`);
		assert.ok(sites <= 8);
		assert.strictEqual(sites, 8);
		const findHistory = fs.readFileSync(resolveSource(FIND_HISTORY_REL), 'utf8');
		const replaceHistory = fs.readFileSync(resolveSource(REPLACE_HISTORY_REL), 'utf8');
		assert.strictEqual(countIncludes(findHistory, `${leftoverSaveCall}${doubleCatch}`), 4);
		assert.strictEqual(countIncludes(replaceHistory, `${leftoverSaveCall}${doubleCatch}`), 4);
		assert.ok(!findHistory.includes('D978'));
		assert.ok(!replaceHistory.includes('D978'));
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused stayed on editor this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d978Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(FIND_HISTORY_REL) ?? ''), 4);
		assert.strictEqual(countDoubleChains(seen.get(REPLACE_HISTORY_REL) ?? ''), 4);
	});

	test('editor leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const findHistory = fs.readFileSync(resolveSource(FIND_HISTORY_REL), 'utf8');
		const replaceHistory = fs.readFileSync(resolveSource(REPLACE_HISTORY_REL), 'utf8');

		assertPromiseSignature(findHistory, 'save(): Promise<void> {');
		assertPromiseSignature(replaceHistory, 'save(): Promise<void> {');

		assert.ok(findHistory.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(replaceHistory.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));

		assertWrapped(findHistory, leftoverSaveCall);
		assertWrapped(replaceHistory, leftoverSaveCall);
		assert.strictEqual(countIncludes(findHistory, `${leftoverSaveCall}${doubleCatch}`), 4);
		assert.strictEqual(countIncludes(replaceHistory, `${leftoverSaveCall}${doubleCatch}`), 4);
		assert.ok(!findHistory.includes('\t\tthis.save();\n'));
		assert.ok(!replaceHistory.includes('\t\tthis.save();\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const findHistory = fs.readFileSync(resolveSource(FIND_HISTORY_REL), 'utf8');
		const replaceHistory = fs.readFileSync(resolveSource(REPLACE_HISTORY_REL), 'utf8');
		const findWidget = fs.readFileSync(resolveSource(FIND_WIDGET_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const marker = fs.readFileSync(resolveSource(MARKER_REL), 'utf8');
		const links = fs.readFileSync(resolveSource(LINKS_REL), 'utf8');
		const word = fs.readFileSync(resolveSource(WORD_REL), 'utf8');
		const fold = fs.readFileSync(resolveSource(FOLD_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(findHistory, 'save(): Promise<void> {');

		assert.ok(!findHistory.includes('openerService.open'));
		assert.ok(!findHistory.includes('IOpenerService'));
		assert.ok(!replaceHistory.includes('openerService.open'));
		assert.ok(!findHistory.includes('extends Action2'));
		assert.ok(!findHistory.includes('registerAction2'));
		assert.ok(!replaceHistory.includes('extends Action2'));
		assert.ok(!replaceHistory.includes('registerAction2'));
		assert.ok(!findHistory.includes('.then(undefined,'));
		assert.ok(!replaceHistory.includes('.then(undefined,'));
		assert.ok(findWidget.includes(findWidgetTwoArgThenCall));
		assert.ok(!findWidget.includes(`${findWidgetTwoArgThenCall.slice(0, -1)}${doubleCatch}`));
		assert.ok(marker.includes('this._openerService.open(resource, {'));
		assert.ok(marker.includes('}).catch(onUnexpectedError);'));
		assert.ok(!marker.includes('}).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(links.includes('link.resolve(CancellationToken.None).then(uri => {'));
		assert.ok(!links.includes(doubleCatch));
		assert.ok(word.includes('.then(undefined, onUnexpectedExternalError);'));
		assert.ok(fold.includes('}).then(undefined, onUnexpectedError);'));
		assert.ok(!fold.includes('}).then(undefined, onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(!findHistory.includes('return this.save()'));
		assert.ok(!replaceHistory.includes('return this.save()'));
		assert.ok(!findHistory.includes(`${leftoverSaveCall}${doubleCatch}${doubleCatch}`));

		for (const source of [findHistory, replaceHistory, findWidget]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D978'));
			assert.ok(!source.includes('*Wire'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const findHistory = fs.readFileSync(resolveSource(FIND_HISTORY_REL), 'utf8');
		const replaceHistory = fs.readFileSync(resolveSource(REPLACE_HISTORY_REL), 'utf8');
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
		const hover = fs.readFileSync(resolveSource(HOVER_REL), 'utf8');
		const sticky = fs.readFileSync(resolveSource(STICKY_REL), 'utf8');
		const compositeBar = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const titlebar = fs.readFileSync(resolveSource(TITLEBAR_REL), 'utf8');
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
		assert.ok(titlebar.includes(`${leftoverAlwaysOnTopCall}${doubleCatch}`));
		assert.ok(chatTip.includes(doubleCatch));
		assert.ok(extensionsRecs.includes(doubleCatch));
		assert.ok(configService.includes(`${validateFoldersCall}${doubleCatch}`));
		assert.ok(hover.includes(doubleCatch));
		assert.ok(sticky.includes(doubleCatch));

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
			[HOVER_REL, hover],
			[FIND_HISTORY_REL, findHistory],
			[REPLACE_HISTORY_REL, replaceHistory],
		] as const) {
			assert.ok(!file.includes('D978'), `${rel} should stay off this knife id`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/tasks/test/node/tasksLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/editor/contrib/hover/test/node/hoverLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/storage/test/node/storageLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/configuration/test/node/configurationLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatLeftoverPromiseCatchScanD943.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/dropOrPasteInto/test/node/dropOrPasteIntoLeftoverPromiseCatchScanD886.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/editor/contrib/hover/test/node/editorContribLeftoverPromiseCatchScan.test.ts')));
	});

	test('this knife did not occupy parallel leftover remaining unused untitled / workingCopy / textfile / sash / clipboard / lifecycle leftover remaining unused or exhausted PRIMARY leftover remaining unused', () => {
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const clipboard = fs.readFileSync(resolveSource(CLIPBOARD_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const mcpWorkbench = fs.readFileSync(resolveSource(MCP_WORKBENCH_REL), 'utf8');
		const extSvc = fs.readFileSync(resolveSource(EXT_SVC_REL), 'utf8');
		const themeService = fs.readFileSync(resolveSource(THEME_SVC_REL), 'utf8');
		const browsers = fs.readFileSync(resolveSource(BROWSERS_REL), 'utf8');
		const configService = fs.readFileSync(resolveSource(CONFIG_SVC_REL), 'utf8');
		const untitled = fs.readFileSync(resolveSource(UNTITLED_REL), 'utf8');
		const workingCopy = fs.readFileSync(resolveSource(WORKING_COPY_REL), 'utf8');
		const textfile = fs.readFileSync(resolveSource(TEXTFILE_REL), 'utf8');
		const sash = fs.readFileSync(resolveSource(SASH_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const userDataProfile = fs.readFileSync(resolveSource(USER_DATA_PROFILE_REL), 'utf8');
		const storageBrowser = fs.readFileSync(resolveSource(STORAGE_BROWSER_REL), 'utf8');
		const storageElectron = fs.readFileSync(resolveSource(STORAGE_ELECTRON_REL), 'utf8');
		const storage = fs.readFileSync(resolveSource(ISTORAGE_REL), 'utf8');
		const environment = fs.readFileSync(resolveSource(ENVIRONMENT_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const webview = fs.readFileSync(resolveSource(WEBVIEW_REL), 'utf8');
		const titlebar = fs.readFileSync(resolveSource(TITLEBAR_REL), 'utf8');
		const langDetect = fs.readFileSync(resolveSource(LANG_DETECT_REL), 'utf8');
		const timer = fs.readFileSync(resolveSource(TIMER_REL), 'utf8');
		const codeMain = fs.readFileSync(resolveSource(CODE_MAIN_REL), 'utf8');
		const hover = fs.readFileSync(resolveSource(HOVER_REL), 'utf8');
		const chatTip = fs.readFileSync(resolveSource(CHAT_TIP_REL), 'utf8');

		for (const [rel, file] of [
			[HOST_REL, host],
			[CLIPBOARD_REL, clipboard],
			[LIFECYCLE_REL, lifecycle],
			[EDITOR_SVC_REL, editor],
			[FILES_REL, files],
			[TASKS_REL, tasks],
			[MCP_WORKBENCH_REL, mcpWorkbench],
			[EXT_SVC_REL, extSvc],
			[THEME_SVC_REL, themeService],
			[BROWSERS_REL, browsers],
			[CONFIG_SVC_REL, configService],
			[UNTITLED_REL, untitled],
			[WORKING_COPY_REL, workingCopy],
			[TEXTFILE_REL, textfile],
			[SASH_REL, sash],
			[REMOTE_REL, remote],
			[USER_DATA_PROFILE_REL, userDataProfile],
			[STORAGE_BROWSER_REL, storageBrowser],
			[STORAGE_ELECTRON_REL, storageElectron],
			[ISTORAGE_REL, storage],
			[ENVIRONMENT_REL, environment],
			[PANE_PART_REL, panePart],
			[WEBVIEW_REL, webview],
			[TITLEBAR_REL, titlebar],
			[LANG_DETECT_REL, langDetect],
			[TIMER_REL, timer],
			[CODE_MAIN_REL, codeMain],
			[HOVER_REL, hover],
			[CHAT_TIP_REL, chatTip],
		] as const) {
			assert.ok(!file.includes('D978'), `${rel} should stay off this knife`);
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
		assert.ok(storageBrowser.includes(`${applicationCloseCall}${doubleCatch}`));
		assert.ok(storageBrowser.includes(`${sharedCloseCall}${doubleCatch}`));
		assert.ok(storageBrowser.includes(`${profileCloseCall}${doubleCatch}`));
		assert.ok(storageBrowser.includes(`${workspaceCloseCall}${doubleCatch}`));
		assert.ok(!storageBrowser.includes('\t\t\tthis.applicationStorage?.close();\n'));
		assert.ok(!storageElectron.includes(doubleCatch));
		assert.ok(!environment.includes(doubleCatch));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/untitled/test/node/untitledLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/workingCopy/test/node/workingCopyLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/textfile/test/node/textfileLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/sash/test/node/sashLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/clipboard/test/node/clipboardLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/lifecycle/test/node/lifecycleLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/storage/test/node/storageLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/environment/test/node/environmentLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/extensions/test/node/extensionsLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/remote/test/node/remoteLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/editor/test/node/editorLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/api/test/node/apiLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/test/node/platformLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/code/test/node/codeLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/languageDetection/test/node/languageDetectionLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/timer/test/node/timerLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/storage/test/node/storageLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/workingCopy/test/node/workingCopyLeftoverPromiseCatchScanD807.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/textfile/test/node/textfileLeftoverPromiseCatchScanD811.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/userDataProfile/test/node/userDataProfileLeftoverPromiseCatchScanD797.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/timer/test/node/timerLeftoverPromiseCatchScanD803.test.ts')));
	});
});
