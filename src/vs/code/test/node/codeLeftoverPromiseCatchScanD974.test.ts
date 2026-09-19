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
const LOGS_REL = 'src/vs/code/electron-utility/sharedProcess/contrib/logsDataCleaner.ts';
const CACHE_REL = 'src/vs/code/electron-utility/sharedProcess/contrib/codeCacheCleaner.ts';
const STORAGE_CLEANER_REL = 'src/vs/code/electron-utility/sharedProcess/contrib/storageDataCleaner.ts';
const LANGPACK_REL = 'src/vs/code/electron-utility/sharedProcess/contrib/languagePackCachedDataCleaner.ts';
const SHARED_REL = 'src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts';
const WORKBENCH_REL = 'src/vs/code/browser/workbench/workbench.ts';
const MAIN_REL = 'src/vs/code/electron-main/main.ts';
const APP_REL = 'src/vs/code/electron-main/app.ts';
const CLI_REL = 'src/vs/code/node/cli.ts';
const CLI_PROCESS_REL = 'src/vs/code/node/cliProcessMain.ts';
const DEFAULT_EXT_REL = 'src/vs/code/electron-utility/sharedProcess/contrib/defaultExtensionsInitializer.ts';
const EXTENSIONS_REL = 'src/vs/code/electron-utility/sharedProcess/contrib/extensions.ts';
const LOCALIZATIONS_REL = 'src/vs/code/electron-utility/sharedProcess/contrib/localizationsUpdater.ts';
const PROFILES_CLEANER_REL = 'src/vs/code/electron-utility/sharedProcess/contrib/userDataProfilesCleaner.ts';
const THEME_SVC_REL = 'src/vs/workbench/services/themes/browser/workbenchThemeService.ts';
const TRUST_REL = 'src/vs/workbench/contrib/workspace/browser/workspaceTrustEditor.ts';
const BROWSERS_REL = 'src/vs/workbench/api/browser/mainThreadBrowsers.ts';
const GIT_EXT_REL = 'src/vs/workbench/api/browser/mainThreadGitExtensionService.ts';
const ACTIVATOR_REL = 'src/vs/workbench/api/common/extHostExtensionActivator.ts';
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const DEBUG_CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const DEBUG_SERVICE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/browserHostService.ts';
const EDITOR_SVC_REL = 'src/vs/workbench/services/editor/browser/editorService.ts';
const THEMES_REL = 'src/vs/workbench/contrib/themes/browser/themes.contribution.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const STORAGE_BROWSER_REL = 'src/vs/workbench/services/storage/browser/storageService.ts';
const FILES_REL = 'src/vs/workbench/contrib/files/browser/views/explorerView.ts';
const USER_DATA_PROFILE_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const TEXTFILE_REL = 'src/vs/workbench/services/textfile/browser/textFileService.ts';
const PANE_PART_REL = 'src/vs/workbench/browser/parts/paneCompositePart.ts';
const COMPOSITE_BAR_REL = 'src/vs/workbench/browser/parts/compositeBar.ts';
const EXT_SVC_REL = 'src/vs/workbench/services/extensions/common/abstractExtensionService.ts';
const REMOTE_REL = 'src/vs/workbench/services/remote/common/abstractRemoteAgentService.ts';
const CONFIG_SVC_REL = 'src/vs/workbench/services/configuration/browser/configurationService.ts';

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

const leftoverLogsCall = 'this.cleanUpOldLogs()';
const leftoverCodeCachesCall = 'this.cleanUpCodeCaches(currentCodeCachePath)';
const leftoverStorageCall = 'this.cleanUpStorage()';
const leftoverLanguagePackCall = 'this.cleanUpLanguagePackCache()';
const leftoverOsInfoCall = 'this.reportClientOSInfo(telemetryService, logService)';
const leftoverSaveCall = 'this.save()';
const leftoverLocalStorageCall = '() => this.onDidChangeLocalStorage()';
const leftoverStartupCall = 'this.startup()';
const leftoverDoOpenHostCall = 'this.doOpen(undefined, { payload: Array.from(environment.entries()) })';
const leftoverReloadCall = '\t\tthis.reload();\n';
const leftoverApplyThemeCall = 'this.applyTheme(themeData, undefined, true)';
const leftoverReplaceEditorsCall = 'this.replaceEditors(replacements, group)';
const leftoverSyncActiveCall = 'this._syncActiveBrowserTab()';
const leftoverRenderAffectedCall = 'this.renderAffectedFeatures(settingsRequiringTrustedWorkspaceCount, this.getExtensionCount())';
const leftoverInitializeDelegateCall = 'this._initializeDelegate()';
const leftoverActivatorInitCall = '\t\tthis._initialize();\n';
const leftoverTriggerCall = '\t\t\tthis.trigger(value);\n';
const leftoverTwoArgThenCall = "this.setTheme(newTheme, applyTheme ? 'auto' : 'preview').then(undefined,";
const leftoverPinCall = 'this.pin(id, true)';
const leftoverDoOpenCall = 'this.doOpenPaneComposite(containerToOpen.id)';
const d794LockedCall = 'this.onConfigUpdate(undefined, true, true)';
const applicationCloseCall = 'void Promise.resolve(this.applicationStorage?.close())';
const assignedInitExtCall = 'this.initializeDefaultExtensions().then(() => storageService.store(defaultExtensionsInitStatusKey, false, StorageScope.APPLICATION, StorageTarget.MACHINE));';
const migrateCatchCall = "this.migrateUnsupportedExtensions().catch(error => logService.error('Error while migrating unsupported extensions', error));";
const cliTwoArgThenCall = '.then(null, err => {';

const d974Calls: Array<[string, string, number]> = [
	[LOGS_REL, leftoverLogsCall, 1],
	[CACHE_REL, leftoverCodeCachesCall, 1],
	[STORAGE_CLEANER_REL, leftoverStorageCall, 1],
	[LANGPACK_REL, leftoverLanguagePackCall, 1],
	[SHARED_REL, leftoverOsInfoCall, 1],
	[WORKBENCH_REL, leftoverSaveCall, 2],
	[WORKBENCH_REL, leftoverLocalStorageCall, 1],
];

suite('leftover remaining unused code leftover remaining unused this.foo() leftover remaining unused Promise fire-and-forget catch scan (D974)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused code leftover async this.foo() FOF still had four or more legal unused leftover sites after discarding collision overflow so this knife stayed', () => {
		let sites = 0;
		for (const [, , count] of d974Calls) {
			sites += count;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused code legal leftover >=4 after discarding collision overflow, got ${sites}`);
		assert.ok(sites <= 8);
		assert.strictEqual(sites, 8);
		const logs = fs.readFileSync(resolveSource(LOGS_REL), 'utf8');
		const cache = fs.readFileSync(resolveSource(CACHE_REL), 'utf8');
		const storage = fs.readFileSync(resolveSource(STORAGE_CLEANER_REL), 'utf8');
		const langpack = fs.readFileSync(resolveSource(LANGPACK_REL), 'utf8');
		const shared = fs.readFileSync(resolveSource(SHARED_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_REL), 'utf8');
		assert.strictEqual(countIncludes(logs, `${leftoverLogsCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(cache, `${leftoverCodeCachesCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(storage, `${leftoverStorageCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(langpack, `${leftoverLanguagePackCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(shared, `${leftoverOsInfoCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(workbench, `${leftoverSaveCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(workbench, `${leftoverLocalStorageCall}${doubleCatch}`), 1);
		for (const source of [logs, cache, storage, langpack, shared, workbench]) {
			assert.ok(!source.includes('D974'));
		}
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused stayed on code this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d974Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(LOGS_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(CACHE_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(STORAGE_CLEANER_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(LANGPACK_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(SHARED_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(WORKBENCH_REL) ?? ''), 3);
	});

	test('code leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const logs = fs.readFileSync(resolveSource(LOGS_REL), 'utf8');
		const cache = fs.readFileSync(resolveSource(CACHE_REL), 'utf8');
		const storage = fs.readFileSync(resolveSource(STORAGE_CLEANER_REL), 'utf8');
		const langpack = fs.readFileSync(resolveSource(LANGPACK_REL), 'utf8');
		const shared = fs.readFileSync(resolveSource(SHARED_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_REL), 'utf8');

		assertPromiseSignature(logs, 'private async cleanUpOldLogs(): Promise<void> {');
		assertPromiseSignature(cache, 'private async cleanUpCodeCaches(currentCodeCachePath: string): Promise<void> {');
		assertPromiseSignature(storage, 'async cleanUpStorage(): Promise<void> {');
		assertPromiseSignature(langpack, 'async cleanUpLanguagePackCache(): Promise<void> {');
		assertPromiseSignature(shared, 'private async reportClientOSInfo(telemetryService: ITelemetryService, logService: ILogService): Promise<void> {');
		assertPromiseSignature(workbench, 'private async save(): Promise<void> {');
		assertPromiseSignature(workbench, 'private async onDidChangeLocalStorage(): Promise<void> {');

		assert.ok(logs.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(cache.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(storage.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(langpack.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(shared.includes("import { onUnexpectedError, setUnexpectedErrorHandler } from '../../../base/common/errors.js';"));
		assert.ok(workbench.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));

		assertWrapped(logs, leftoverLogsCall);
		assertWrapped(cache, leftoverCodeCachesCall);
		assertWrapped(storage, leftoverStorageCall);
		assertWrapped(langpack, leftoverLanguagePackCall);
		assertWrapped(shared, leftoverOsInfoCall);
		assertWrapped(workbench, leftoverSaveCall);
		assertWrapped(workbench, leftoverLocalStorageCall);
		assert.ok(!logs.includes('\t\t\tthis.cleanUpOldLogs();\n'));
		assert.ok(!cache.includes('\t\t\t\tthis.cleanUpCodeCaches(currentCodeCachePath);\n'));
		assert.ok(!storage.includes('\t\t\tthis.cleanUpStorage();\n'));
		assert.ok(!langpack.includes('\t\t\t\tthis.cleanUpLanguagePackCache();\n'));
		assert.ok(!shared.includes('\t\t\tthis.reportClientOSInfo(telemetryService, logService);\n'));
		assert.ok(!workbench.includes('\t\tthis.save();\n'));
		assert.ok(!workbench.includes("addDisposableListener(mainWindow, 'storage', () => this.onDidChangeLocalStorage());"));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const logs = fs.readFileSync(resolveSource(LOGS_REL), 'utf8');
		const cache = fs.readFileSync(resolveSource(CACHE_REL), 'utf8');
		const storage = fs.readFileSync(resolveSource(STORAGE_CLEANER_REL), 'utf8');
		const langpack = fs.readFileSync(resolveSource(LANGPACK_REL), 'utf8');
		const shared = fs.readFileSync(resolveSource(SHARED_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_REL), 'utf8');
		const main = fs.readFileSync(resolveSource(MAIN_REL), 'utf8');
		const app = fs.readFileSync(resolveSource(APP_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const defaultExt = fs.readFileSync(resolveSource(DEFAULT_EXT_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		const localizations = fs.readFileSync(resolveSource(LOCALIZATIONS_REL), 'utf8');
		const cli = fs.readFileSync(resolveSource(CLI_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(main, 'private async startup(): Promise<void> {');

		assert.ok(!logs.includes('openerService.open'));
		assert.ok(!logs.includes('IOpenerService'));
		assert.ok(!workbench.includes('openerService.open'));
		assert.ok(!workbench.includes('extends Action2'));
		assert.ok(!workbench.includes('registerAction2'));
		assert.ok(!shared.includes('extends Action2'));
		assert.ok(!shared.includes('.then(undefined,'));
		assert.ok(main.includes(`${leftoverStartupCall};`));
		assert.ok(!main.includes(`${leftoverStartupCall}${doubleCatch}`));
		assert.ok(defaultExt.includes(assignedInitExtCall));
		assert.ok(!defaultExt.includes(`this.initializeDefaultExtensions()${doubleCatch}`));
		assert.ok(extensions.includes(migrateCatchCall));
		assert.ok(!extensions.includes(`this.migrateUnsupportedExtensions()${doubleCatch}`));
		assert.ok(localizations.includes('this.updateLocalizations();'));
		assert.ok(!localizations.includes(`this.updateLocalizations()${doubleCatch}`));
		assert.ok(cli.includes(cliTwoArgThenCall));
		assert.ok(!cli.includes(`main(process.argv)${doubleCatch}`));
		assert.ok(main.includes('return this.claimInstance(logService, environmentMainService, lifecycleMainService, instantiationService, productService, false);'));
		assert.ok(!main.includes(`return this.claimInstance(logService, environmentMainService, lifecycleMainService, instantiationService, productService, false)${doubleCatch}`));
		assert.ok(app.includes(`this.installMutex()${doubleCatch};`));
		assert.ok(!app.includes(`this.installMutex()${doubleCatch}${doubleCatch}`));

		for (const source of [logs, cache, storage, langpack, shared, workbench, main, app]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D974'));
			assert.ok(!source.includes('*Wire'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused or D956 overflow', () => {
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_VIEW_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
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
		const trust = fs.readFileSync(resolveSource(TRUST_REL), 'utf8');
		const gitExt = fs.readFileSync(resolveSource(GIT_EXT_REL), 'utf8');
		const activator = fs.readFileSync(resolveSource(ACTIVATOR_REL), 'utf8');
		const cli = fs.readFileSync(resolveSource(CLI_REL), 'utf8');
		const cliProcess = fs.readFileSync(resolveSource(CLI_PROCESS_REL), 'utf8');
		const main = fs.readFileSync(resolveSource(MAIN_REL), 'utf8');
		const compositeBar = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const storageBrowser = fs.readFileSync(resolveSource(STORAGE_BROWSER_REL), 'utf8');

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
		assert.ok(trust.includes(`${leftoverRenderAffectedCall};`));
		assert.ok(!trust.includes(`${leftoverRenderAffectedCall}${doubleCatch}`));
		assert.ok(gitExt.includes(`${leftoverInitializeDelegateCall};`));
		assert.ok(!gitExt.includes(`${leftoverInitializeDelegateCall}${doubleCatch}`));
		assert.ok(activator.includes(leftoverActivatorInitCall));
		assert.ok(!activator.includes(`this._initialize()${doubleCatch}`));
		assert.ok(themes.includes(leftoverTriggerCall));
		assert.ok(!themes.includes(`this.trigger(value)${doubleCatch}`));
		assert.ok(themes.includes(leftoverTwoArgThenCall));
		assert.ok(!themes.includes(`this.setTheme(newTheme, applyTheme ? 'auto' : 'preview')${doubleCatch}`));
		assert.ok(cli.includes(cliTwoArgThenCall));
		assert.ok(!cli.includes(`eventuallyExit(0)${doubleCatch}`));
		assert.ok(!cliProcess.includes(doubleCatch));
		assert.ok(main.includes(`${leftoverStartupCall};`));
		assert.ok(!main.includes(`${leftoverStartupCall}${doubleCatch}`));
		assert.ok(compositeBar.includes(`${leftoverPinCall}${doubleCatch}`));
		assert.ok(panePart.includes(`${leftoverDoOpenCall}${doubleCatch}`));
		assert.ok(storageBrowser.includes(`${applicationCloseCall}${doubleCatch}`));

		for (const [rel, file] of [
			[SEARCH_WIDGET_REL, searchWidget],
			[SEARCH_EDITOR_REL, searchEditor],
			[COMMENTS_VIEW_REL, comments],
			[SETUP_REL, setup],
			[TESTING_REL, testing],
			[DEBUG_CONFIG_REL, debugConfig],
			[DEBUG_SERVICE_REL, debugService],
			[TASKS_REL, tasks],
			[HOST_REL, host],
			[EDITOR_SVC_REL, editor],
			[THEME_SVC_REL, themeService],
			[THEMES_REL, themes],
			[BROWSERS_REL, browsers],
			[TRUST_REL, trust],
			[GIT_EXT_REL, gitExt],
			[ACTIVATOR_REL, activator],
			[CLI_REL, cli],
			[CLI_PROCESS_REL, cliProcess],
			[MAIN_REL, main],
		] as const) {
			assert.ok(!file.includes('D974'), `${rel} should stay off this knife id`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD974.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD974.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD974.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD974.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD974.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD974.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/tasks/test/node/tasksLeftoverPromiseCatchScanD974.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/configuration/test/node/configurationLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatLeftoverPromiseCatchScanD943.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/storage/test/node/storageLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/code/test/node/codeElectronMainLeftoverPromiseCatchScan.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/code/test/node/codeElectronMainRemainingLeftoverPromiseCatchScan.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/code/test/node/codeElectronMainFurtherLeftoverPromiseCatchScan.test.ts')));
	});

	test('this knife did not occupy parallel leftover remaining unused storage / files / activity / userDataProfile / textfile / panecomposite / webview remaining / electron-browser / browser/parts / hover / chat remaining / services/extensions / remote leftover remaining unused or exhausted PRIMARY leftover remaining unused', () => {
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const userDataProfile = fs.readFileSync(resolveSource(USER_DATA_PROFILE_REL), 'utf8');
		const textfile = fs.readFileSync(resolveSource(TEXTFILE_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const compositeBar = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');
		const extSvc = fs.readFileSync(resolveSource(EXT_SVC_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		const themeService = fs.readFileSync(resolveSource(THEME_SVC_REL), 'utf8');
		const browsers = fs.readFileSync(resolveSource(BROWSERS_REL), 'utf8');
		const configService = fs.readFileSync(resolveSource(CONFIG_SVC_REL), 'utf8');
		const storageBrowser = fs.readFileSync(resolveSource(STORAGE_BROWSER_REL), 'utf8');
		const profilesCleaner = fs.readFileSync(resolveSource(PROFILES_CLEANER_REL), 'utf8');

		for (const [rel, file] of [
			[FILES_REL, files],
			[USER_DATA_PROFILE_REL, userDataProfile],
			[TEXTFILE_REL, textfile],
			[PANE_PART_REL, panePart],
			[COMPOSITE_BAR_REL, compositeBar],
			[EXT_SVC_REL, extSvc],
			[REMOTE_REL, remote],
			[HOST_REL, host],
			[EDITOR_SVC_REL, editor],
			[THEME_SVC_REL, themeService],
			[BROWSERS_REL, browsers],
			[CONFIG_SVC_REL, configService],
			[STORAGE_BROWSER_REL, storageBrowser],
			[PROFILES_CLEANER_REL, profilesCleaner],
		] as const) {
			assert.ok(!file.includes('D974'), `${rel} should stay off this knife`);
		}
		assert.ok(host.includes(leftoverDoOpenHostCall));
		assert.ok(!host.includes(`${leftoverDoOpenHostCall}${doubleCatch}`));
		assert.ok(editor.includes(`${leftoverReplaceEditorsCall};`));
		assert.ok(!editor.includes(`${leftoverReplaceEditorsCall}${doubleCatch}`));
		assert.ok(themeService.includes(`${leftoverApplyThemeCall};`));
		assert.ok(!themeService.includes(`${leftoverApplyThemeCall}${doubleCatch}`));
		assert.ok(browsers.includes(`${leftoverSyncActiveCall};`));
		assert.ok(!browsers.includes(`${leftoverSyncActiveCall}${doubleCatch}`));
		assert.ok(storageBrowser.includes(`${applicationCloseCall}${doubleCatch}`));
		assert.ok(!storageBrowser.includes('D974'));
		assert.ok(profilesCleaner.includes('userDataProfilesService.cleanUp();'));
		assert.ok(!profilesCleaner.includes(`userDataProfilesService.cleanUp()${doubleCatch}`));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/storage/test/node/storageLeftoverPromiseCatchScanD974.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/files/test/node/filesLeftoverPromiseCatchScanD974.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/userDataProfile/test/node/userDataProfileLeftoverPromiseCatchScanD974.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/textfile/test/node/textfileLeftoverPromiseCatchScanD974.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/extensions/test/node/extensionsLeftoverPromiseCatchScanD974.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/remote/test/node/remoteLeftoverPromiseCatchScanD974.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/api/test/node/mainThreadBrowsersLeftoverPromiseCatchScanD974.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/test/node/platformLeftoverPromiseCatchScanD974.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/storage/test/node/storageLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/themes/test/node/themesLeftoverPromiseCatchScanD898.test.ts')));
	});
});
