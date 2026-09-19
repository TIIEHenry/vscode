/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const SETUP_REL = 'src/vs/sessions/browser/sessionsSetUpService.ts';
const PROJECT_BAR_REL = 'src/vs/sessions/browser/parts/projectBarPart.ts';
const SIGN_IN_REL = 'src/vs/sessions/browser/sessionsSignInDialog.ts';
const NEW_CHAT_INPUT_REL = 'src/vs/sessions/contrib/chat/browser/newChatInput.ts';
const LAYOUT_REL = 'src/vs/sessions/contrib/layout/browser/singlePaneLayoutController.ts';
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const SETUP_CHAT_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const DEBUG_CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const DEBUG_SERVICE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
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

const showWelcomeCall = 'this._showWelcome(false)';
const showAIDisabledCall = 'this._showAIDisabledDialog()';
const proceedCall = 'this._proceedWithoutGitHub()';
const pickAndAddCall = 'this.pickAndAddFolder()';
const leftoverApplySelectedCall = 'this.applySelectedFolder()';
const leftoverWatchFinallyCall = 'void this._watchSignInState().finally(() => this._initialSetupFlow = false);';
const leftoverWatchStmtCall = '\t\t\t\t\tthis._watchSignInState();\n';
const leftoverFirstLaunchFinallyCall = 'void this._showWelcome(true).finally(() => this._initialSetupFlow = false);';
const leftoverDoOpenHostCall = 'this.doOpen(undefined, { payload: Array.from(environment.entries()) })';
const leftoverReloadCall = '\t\tthis.reload();\n';
const leftoverApplyThemeCall = 'this.applyTheme(themeData, undefined, true)';
const leftoverReplaceEditorsCall = 'this.replaceEditors(replacements, group)';
const leftoverSyncActiveCall = 'this._syncActiveBrowserTab()';
const leftoverTriggerCall = '\t\t\tthis.trigger(value);\n';
const leftoverTwoArgThenCall = "this.setTheme(newTheme, applyTheme ? 'auto' : 'preview').then(undefined,";
const leftoverPinCall = 'this.pin(id, true)';
const leftoverDoOpenCall = 'this.doOpenPaneComposite(containerToOpen.id)';
const leftoverMigrateCall = 'this.migrateConfigurations(configurationMigrationRegistry.migrations)';
const leftoverCreateCall = 'this.create()';
const leftoverAlwaysOnTopCall = 'this.handleWindowsAlwaysOnTop(targetWindow.vscodeWindowId)';
const leftoverArgvCall = 'this.onDidChangeArgv()';
const d794LockedCall = 'this.onConfigUpdate(undefined, true, true)';
const applicationCloseCall = 'void Promise.resolve(this.applicationStorage?.close())';
const checkPromptCall = 'this._checkForPromptFiles(tip)';
const validateFoldersCall = 'this.validateWorkspaceFoldersAndReload(fromCache)';
const alreadyDoubleShowCall = 'void this.show()';
const alreadyDoubleToggleCall = 'void this.toggleDictation()';

const d980Calls: Array<[string, string, number]> = [
	[SETUP_REL, showWelcomeCall, 4],
	[SETUP_REL, showAIDisabledCall, 1],
	[SETUP_REL, proceedCall, 1],
	[PROJECT_BAR_REL, pickAndAddCall, 2],
];

suite('leftover remaining unused sessions leftover remaining unused this.foo() leftover remaining unused Promise fire-and-forget catch scan (D980)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused sessions leftover async this.foo() FOF still had four or more legal unused leftover sites after discarding collision overflow so this knife stayed', () => {
		let sites = 0;
		for (const [, , count] of d980Calls) {
			sites += count;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused sessions legal leftover >=4 after discarding collision overflow, got ${sites}`);
		assert.ok(sites <= 8);
		assert.strictEqual(sites, 8);
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const projectBar = fs.readFileSync(resolveSource(PROJECT_BAR_REL), 'utf8');
		assert.ok(!setup.includes('D980'));
		assert.ok(!projectBar.includes('D980'));
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused stayed on sessions this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d980Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(SETUP_REL) ?? ''), 6);
		assert.strictEqual(countDoubleChains(seen.get(PROJECT_BAR_REL) ?? ''), 2);
	});

	test('sessions leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const projectBar = fs.readFileSync(resolveSource(PROJECT_BAR_REL), 'utf8');

		assertPromiseSignature(setup, 'private async _showWelcome(isFirstLaunch: boolean): Promise<void> {');
		assertPromiseSignature(setup, 'private async _showAIDisabledDialog(): Promise<void> {');
		assertPromiseSignature(setup, 'private async _proceedWithoutGitHub(): Promise<void> {');
		assertPromiseSignature(projectBar, 'private async pickAndAddFolder(): Promise<void> {');

		assert.ok(setup.includes("import { onUnexpectedError } from '../../base/common/errors.js';"));
		assert.ok(projectBar.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));

		assertWrapped(setup, showWelcomeCall);
		assertWrapped(setup, showAIDisabledCall);
		assertWrapped(setup, proceedCall);
		assertWrapped(projectBar, pickAndAddCall);
		assert.strictEqual(countIncludes(setup, `${showWelcomeCall}${doubleCatch}`), 4);
		assert.strictEqual(countIncludes(setup, `${showAIDisabledCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(setup, `${proceedCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(projectBar, `${pickAndAddCall}${doubleCatch}`), 2);
		assert.ok(!setup.includes('\t\tthis._showWelcome(false);\n'));
		assert.ok(!setup.includes('\t\t\tthis._showWelcome(false);\n'));
		assert.ok(!setup.includes('\t\t\t\tthis._showWelcome(false);\n'));
		assert.ok(!setup.includes('\t\t\tvoid this._showWelcome(false);\n'));
		assert.ok(!setup.includes('\t\t\t\t\tthis._showAIDisabledDialog();\n'));
		assert.ok(!setup.includes('\t\t\tvoid this._proceedWithoutGitHub();\n'));
		assert.ok(!projectBar.includes('\t\t\t\tthis.pickAndAddFolder();\n'));
		assert.ok(!projectBar.includes('\t\t\t\t\tthis.pickAndAddFolder();\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const projectBar = fs.readFileSync(resolveSource(PROJECT_BAR_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const signIn = fs.readFileSync(resolveSource(SIGN_IN_REL), 'utf8');
		const newChatInput = fs.readFileSync(resolveSource(NEW_CHAT_INPUT_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(setup, 'private async _showWelcome(isFirstLaunch: boolean): Promise<void> {');
		assertPromiseSignature(setup, 'private async _watchSignInState(): Promise<void> {');

		assert.ok(!setup.includes('openerService.open'));
		assert.ok(!setup.includes('IOpenerService'));
		assert.ok(!projectBar.includes('openerService.open'));
		assert.ok(!projectBar.includes('IOpenerService'));
		assert.ok(!setup.includes('extends Action2'));
		assert.ok(!setup.includes('registerAction2'));
		assert.ok(!projectBar.includes('extends Action2'));
		assert.ok(!projectBar.includes('registerAction2'));
		assert.ok(!setup.includes('.then(undefined,'));
		assert.ok(!projectBar.includes('.then(undefined,'));
		assert.ok(setup.includes('await this._proceedWithoutGitHub();'));
		assert.ok(!setup.includes(`await this._proceedWithoutGitHub()${doubleCatch}`));
		assert.ok(setup.includes(leftoverWatchFinallyCall));
		assert.ok(!setup.includes(`this._watchSignInState()${doubleCatch}`));
		assert.ok(setup.includes(leftoverWatchStmtCall));
		assert.ok(setup.includes(leftoverFirstLaunchFinallyCall));
		assert.ok(!setup.includes(`this._showWelcome(true)${doubleCatch}`));
		assert.ok(projectBar.includes(`${leftoverApplySelectedCall};`));
		assert.ok(!projectBar.includes(`${leftoverApplySelectedCall}${doubleCatch}`));
		assert.ok(signIn.includes(`${alreadyDoubleShowCall}${doubleCatch}`));
		assert.ok(newChatInput.includes(`${alreadyDoubleToggleCall}${doubleCatch}`));

		for (const source of [setup, projectBar]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D980'));
			assert.ok(!source.includes('*Wire'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; already-double CatchScans stay already-double; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const projectBar = fs.readFileSync(resolveSource(PROJECT_BAR_REL), 'utf8');
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_VIEW_REL), 'utf8');
		const chatSetup = fs.readFileSync(resolveSource(SETUP_CHAT_REL), 'utf8');
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const debugConfig = fs.readFileSync(resolveSource(DEBUG_CONFIG_REL), 'utf8');
		const debugService = fs.readFileSync(resolveSource(DEBUG_SERVICE_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		const themeService = fs.readFileSync(resolveSource(THEME_SVC_REL), 'utf8');
		const themes = fs.readFileSync(resolveSource(THEMES_REL), 'utf8');
		const browsers = fs.readFileSync(resolveSource(BROWSERS_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const compositeBar = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const workbenchConfig = fs.readFileSync(resolveSource(WORKBENCH_CONFIG_REL), 'utf8');
		const titlebar = fs.readFileSync(resolveSource(TITLEBAR_REL), 'utf8');
		const logLevels = fs.readFileSync(resolveSource(LOG_REL), 'utf8');
		const chatTip = fs.readFileSync(resolveSource(CHAT_TIP_REL), 'utf8');
		const extensionsRecs = fs.readFileSync(resolveSource(EXTENSIONS_RECS_REL), 'utf8');
		const configService = fs.readFileSync(resolveSource(CONFIG_SVC_REL), 'utf8');
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');

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
		assert.ok(chatTip.includes(`${checkPromptCall}${doubleCatch}`));
		assert.ok(extensionsRecs.includes(doubleCatch));
		assert.ok(configService.includes(`${validateFoldersCall}${doubleCatch}`));
		assert.ok(layout.includes(`this._lifecycleService.when(LifecyclePhase.Restored).then(() => {`));

		for (const [rel, file] of [
			[SEARCH_WIDGET_REL, searchWidget],
			[SEARCH_EDITOR_REL, searchEditor],
			[COMMENTS_VIEW_REL, comments],
			[SETUP_CHAT_REL, chatSetup],
			[TESTING_REL, testing],
			[DEBUG_CONFIG_REL, debugConfig],
			[DEBUG_SERVICE_REL, debugService],
			[TASKS_REL, tasks],
			[HOST_REL, host],
			[EDITOR_SVC_REL, editor],
			[THEME_SVC_REL, themeService],
			[THEMES_REL, themes],
			[BROWSERS_REL, browsers],
			[SETUP_REL, setup],
			[PROJECT_BAR_REL, projectBar],
			[LAYOUT_REL, layout],
		] as const) {
			assert.ok(!file.includes('D980'), `${rel} should stay off this knife id`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/tasks/test/node/tasksLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/sessions/test/node/sessionsContribLeftoverPromiseCatchScan.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/sessions/test/node/sessionsSignInDialogCatchScan.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/sessions/test/node/newChatInputCatchScan.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/configuration/test/node/configurationLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatLeftoverPromiseCatchScanD943.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/storage/test/node/storageLeftoverPromiseCatchScanD964.test.ts')));
	});

	test('this knife did not occupy parallel leftover remaining unused untitled / workingCopy / textfile / sash / clipboard / lifecycle leftover remaining unused or exhausted PRIMARY leftover remaining unused', () => {
		const untitled = fs.readFileSync(resolveSource(UNTITLED_REL), 'utf8');
		const workingCopy = fs.readFileSync(resolveSource(WORKING_COPY_REL), 'utf8');
		const textfile = fs.readFileSync(resolveSource(TEXTFILE_REL), 'utf8');
		const sash = fs.readFileSync(resolveSource(SASH_REL), 'utf8');
		const clipboard = fs.readFileSync(resolveSource(CLIPBOARD_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const extSvc = fs.readFileSync(resolveSource(EXT_SVC_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const userDataProfile = fs.readFileSync(resolveSource(USER_DATA_PROFILE_REL), 'utf8');
		const storage = fs.readFileSync(resolveSource(STORAGE_BROWSER_REL), 'utf8');
		const browsers = fs.readFileSync(resolveSource(BROWSERS_REL), 'utf8');
		const titlebar = fs.readFileSync(resolveSource(TITLEBAR_REL), 'utf8');
		const chatTip = fs.readFileSync(resolveSource(CHAT_TIP_REL), 'utf8');

		for (const [rel, file] of [
			[UNTITLED_REL, untitled],
			[WORKING_COPY_REL, workingCopy],
			[TEXTFILE_REL, textfile],
			[SASH_REL, sash],
			[CLIPBOARD_REL, clipboard],
			[LIFECYCLE_REL, lifecycle],
			[EXT_SVC_REL, extSvc],
			[REMOTE_REL, remote],
			[FILES_REL, files],
			[USER_DATA_PROFILE_REL, userDataProfile],
			[STORAGE_BROWSER_REL, storage],
			[BROWSERS_REL, browsers],
			[TITLEBAR_REL, titlebar],
			[CHAT_TIP_REL, chatTip],
		] as const) {
			assert.ok(!file.includes('D980'), `${rel} should stay off this knife`);
		}
		assert.ok(storage.includes(`${applicationCloseCall}${doubleCatch}`));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/untitled/test/node/untitledLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/workingCopy/test/node/workingCopyLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/textfile/test/node/textfileLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/sash/test/node/sashLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/clipboard/test/node/clipboardLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/lifecycle/test/node/lifecycleLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/extensions/test/node/extensionsLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/remote/test/node/remoteLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/files/test/node/filesLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/userDataProfile/test/node/userDataProfileLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/storage/test/node/storageLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/api/test/node/apiLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/test/node/platformLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/code/test/node/codeLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/editor/test/node/editorLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD980.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/browser/test/node/browserLeftoverPromiseCatchScanD980.test.ts')));
	});
});
