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
const AUTO_SYNC_REL = 'src/vs/platform/userDataSync/common/userDataAutoSyncService.ts';
const AUTO_SYNC_NODE_REL = 'src/vs/platform/userDataSync/node/userDataAutoSyncService.ts';
const LOCAL_STORE_REL = 'src/vs/platform/userDataSync/common/userDataSyncLocalStoreService.ts';
const SYNC_SVC_REL = 'src/vs/platform/userDataSync/common/userDataSyncService.ts';
const ACCOUNT_REL = 'src/vs/platform/userDataSync/common/userDataSyncAccount.ts';
const IPC_REL = 'src/vs/platform/userDataSync/common/userDataSyncIpc.ts';
const SVC_IPC_REL = 'src/vs/platform/userDataSync/common/userDataSyncServiceIpc.ts';
const ABSTRACT_REL = 'src/vs/platform/userDataSync/common/abstractSynchronizer.ts';
const FIND_HISTORY_REL = 'src/vs/editor/contrib/find/browser/findWidgetSearchHistory.ts';
const REPLACE_HISTORY_REL = 'src/vs/editor/contrib/find/browser/replaceWidgetHistory.ts';
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
const STORAGE_BROWSER_REL = 'src/vs/workbench/services/storage/browser/storageService.ts';
const CONFIG_SVC_REL = 'src/vs/workbench/services/configuration/browser/configurationService.ts';

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

const leftoverDisableCall = 'this.disableMachineEventually()';
const leftoverIntervalSyncCall = 'this.sync(AutoSync.INTERVAL_SYNCING, false)';
const leftoverCleanCall = 'this.cleanUp()';
const leftoverStaleCall = 'this.cleanUpStaleStorageData()';
const leftoverAccountCall = 'this.updateAccount(undefined)';
const leftoverDoOpenHostCall = 'this.doOpen(undefined, { payload: Array.from(environment.entries()) })';
const leftoverReloadCall = '\t\tthis.reload();\n';
const leftoverApplyThemeCall = 'this.applyTheme(themeData, undefined, true)';
const leftoverReplaceEditorsCall = 'this.replaceEditors(replacements, group)';
const leftoverSyncActiveCall = 'this._syncActiveBrowserTab()';
const leftoverTriggerCall = '\t\t\tthis.trigger(value);\n';
const leftoverTwoArgThenCall = "this.setTheme(newTheme, applyTheme ? 'auto' : 'preview').then(undefined,";
const d794LockedCall = 'this.onConfigUpdate(undefined, true, true)';
const leftoverSaveCall = 'this.save()';
const applicationCloseCall = 'void Promise.resolve(this.applicationStorage?.close())';
const leftoverTriggerSourceCall = 'this.triggerSync([source])';
const leftoverNodeTriggerCall = 'this.triggerSync(sources, { skipIfSyncedRecently: true })';
const nestedStopCall = 'this.syncTask?.stop()';
const leftoverLocalChangeCall = 'this.triggerLocalChange()';

const d1015Calls: Array<[string, string, number]> = [
	[AUTO_SYNC_REL, leftoverDisableCall, 3],
	[AUTO_SYNC_REL, leftoverIntervalSyncCall, 2],
	[LOCAL_STORE_REL, leftoverCleanCall, 1],
	[SYNC_SVC_REL, leftoverStaleCall, 1],
	[ACCOUNT_REL, leftoverAccountCall, 1],
];

suite('leftover remaining unused userDataSync leftover remaining unused this.foo() leftover remaining unused Promise fire-and-forget catch scan (D1015)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused userDataSync leftover async this.foo() FOF still had four or more legal unused leftover sites after discarding collision overflow so this knife stayed', () => {
		let sites = 0;
		for (const [, , count] of d1015Calls) {
			sites += count;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused userDataSync legal leftover >=4 after discarding collision overflow, got ${sites}`);
		assert.ok(sites <= 8);
		assert.strictEqual(sites, 8);
		const autoSync = fs.readFileSync(resolveSource(AUTO_SYNC_REL), 'utf8');
		const localStore = fs.readFileSync(resolveSource(LOCAL_STORE_REL), 'utf8');
		const syncSvc = fs.readFileSync(resolveSource(SYNC_SVC_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		assert.ok(!autoSync.includes('D1015'));
		assert.ok(!localStore.includes('D1015'));
		assert.ok(!syncSvc.includes('D1015'));
		assert.ok(!account.includes('D1015'));
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused stayed on userDataSync this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map();
		for (const [rel, call, count] of d1015Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(AUTO_SYNC_REL) ?? ''), 5);
		assert.strictEqual(countDoubleChains(seen.get(LOCAL_STORE_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(SYNC_SVC_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(ACCOUNT_REL) ?? ''), 1);
	});

	test('userDataSync leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const autoSync = fs.readFileSync(resolveSource(AUTO_SYNC_REL), 'utf8');
		const localStore = fs.readFileSync(resolveSource(LOCAL_STORE_REL), 'utf8');
		const syncSvc = fs.readFileSync(resolveSource(SYNC_SVC_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');

		assertPromiseSignature(autoSync, 'private async disableMachineEventually(): Promise<void> {');
		assertPromiseSignature(autoSync, 'sync(reason: string, disableCache: boolean): Promise<void> {');
		assertPromiseSignature(localStore, 'private async cleanUp(): Promise<void> {');
		assertPromiseSignature(syncSvc, 'private async cleanUpStaleStorageData(): Promise<void> {');
		assertPromiseSignature(account, 'async updateAccount(account: IUserDataSyncAccount | undefined): Promise<void> {');

		assert.ok(autoSync.includes("import { isCancellationError, onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.ok(localStore.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.ok(syncSvc.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.ok(account.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));

		assertWrapped(autoSync, leftoverDisableCall);
		assertWrapped(autoSync, leftoverIntervalSyncCall);
		assertWrapped(localStore, leftoverCleanCall);
		assertWrapped(syncSvc, leftoverStaleCall);
		assertWrapped(account, leftoverAccountCall);
		assert.strictEqual(countIncludes(autoSync, `${leftoverDisableCall}${doubleCatch}`), 3);
		assert.strictEqual(countIncludes(autoSync, `${leftoverIntervalSyncCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(localStore, `${leftoverCleanCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(syncSvc, `${leftoverStaleCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(account, `${leftoverAccountCall}${doubleCatch}`), 1);
		assert.ok(!autoSync.includes('\t\t\t\tthis.disableMachineEventually();\n'));
		assert.ok(!autoSync.includes('\t\tthis.sync(AutoSync.INTERVAL_SYNCING, false);\n'));
		assert.ok(!localStore.includes('\t\tthis.cleanUp();\n'));
		assert.ok(!account.includes('\t\t\tthis.updateAccount(undefined);\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const autoSync = fs.readFileSync(resolveSource(AUTO_SYNC_REL), 'utf8');
		const localStore = fs.readFileSync(resolveSource(LOCAL_STORE_REL), 'utf8');
		const syncSvc = fs.readFileSync(resolveSource(SYNC_SVC_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const ipc = fs.readFileSync(resolveSource(IPC_REL), 'utf8');
		const svcIpc = fs.readFileSync(resolveSource(SVC_IPC_REL), 'utf8');
		const abstract = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const nodeAuto = fs.readFileSync(resolveSource(AUTO_SYNC_NODE_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(autoSync, 'async triggerSync(sources: string[], options?: SyncOptions): Promise<void> {');

		assert.ok(!autoSync.includes('openerService.open'));
		assert.ok(!autoSync.includes('IOpenerService'));
		assert.ok(!localStore.includes('openerService.open'));
		assert.ok(!autoSync.includes('extends Action2'));
		assert.ok(!autoSync.includes('registerAction2'));
		assert.ok(!localStore.includes('extends Action2'));
		assert.ok(!syncSvc.includes('extends Action2'));
		assert.ok(!account.includes('extends Action2'));
		assert.ok(!autoSync.includes('.then(undefined,'));
		assert.ok(!localStore.includes('.then(undefined,'));
		assert.ok(!syncSvc.includes('.then(undefined,'));
		assert.ok(!account.includes('.then(undefined,'));
		assert.ok(!autoSync.includes('window.loadURL'));
		assert.ok(!localStore.includes('window.loadURL'));
		assert.ok(ipc.includes('}).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(svcIpc.includes('}).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(svcIpc.includes('\t\t\tthis.updateStatus(status);\n'));
		assert.ok(!svcIpc.includes(`this.updateStatus(status)${doubleCatch}`));
		assert.ok(svcIpc.includes('\t\t\tthis.updateConflicts(conflicts);\n'));
		assert.ok(!svcIpc.includes(`this.updateConflicts(conflicts)${doubleCatch}`));
		assert.ok(autoSync.includes(leftoverTriggerSourceCall));
		assert.ok(!autoSync.includes(`${leftoverTriggerSourceCall}${doubleCatch}`));
		assert.ok(nodeAuto.includes(leftoverNodeTriggerCall));
		assert.ok(!nodeAuto.includes(`${leftoverNodeTriggerCall}${doubleCatch}`));
		assert.ok(autoSync.includes(`${nestedStopCall};`));
		assert.ok(!autoSync.includes(`${nestedStopCall}${doubleCatch}`));
		assert.ok(abstract.includes('protected triggerLocalChange(): void {'));
		assert.ok(abstract.includes(`${leftoverLocalChangeCall};`));
		assert.ok(!abstract.includes(`${leftoverLocalChangeCall}${doubleCatch}`));
		assert.ok(abstract.includes('this.localChangeTriggerThrottler.trigger(() => this.doTriggerLocalChange());'));
		assert.ok(!abstract.includes(`this.doTriggerLocalChange()${doubleCatch}`));
		assert.ok(autoSync.includes('private updateAutoSync(): void {'));
		assert.ok(autoSync.includes('return this.syncPromise;'));
		assert.ok(!autoSync.includes(`return this.syncPromise${doubleCatch}`));
		assert.ok(autoSync.includes('await this.userDataSyncService.reset();'));
		assert.ok(!autoSync.includes(`this.userDataSyncService.reset()${doubleCatch}`));
		assert.ok(autoSync.includes('await this.userDataSyncMachinesService.removeCurrentMachine();'));
		assert.ok(!autoSync.includes(`this.userDataSyncMachinesService.removeCurrentMachine()${doubleCatch}`));

		for (const source of [autoSync, localStore, syncSvc, account, ipc, svcIpc, nodeAuto]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D1015'));
			assert.ok(!source.includes('*Wire'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const autoSync = fs.readFileSync(resolveSource(AUTO_SYNC_REL), 'utf8');
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
		const findHistory = fs.readFileSync(resolveSource(FIND_HISTORY_REL), 'utf8');
		const replaceHistory = fs.readFileSync(resolveSource(REPLACE_HISTORY_REL), 'utf8');
		const storageBrowser = fs.readFileSync(resolveSource(STORAGE_BROWSER_REL), 'utf8');
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
		assert.ok(findHistory.includes(`${leftoverSaveCall}${doubleCatch}`));
		assert.ok(replaceHistory.includes(`${leftoverSaveCall}${doubleCatch}`));
		assert.ok(storageBrowser.includes(`${applicationCloseCall}${doubleCatch}`));
		assert.ok(configService.includes('this.validateWorkspaceFoldersAndReload(fromCache)'));

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
			[FIND_HISTORY_REL, findHistory],
			[REPLACE_HISTORY_REL, replaceHistory],
			[AUTO_SYNC_REL, autoSync],
		]) {
			assert.ok(!file.includes('D1015'), `${rel} should stay off this knife id`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD1015.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD1015.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD1015.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD1015.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD1015.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD1015.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/tasks/test/node/tasksLeftoverPromiseCatchScanD1015.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/telemetry/test/node/telemetryLeftoverPromiseCatchScanD1015.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/remote/test/node/remoteLeftoverPromiseCatchScanD1015.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/welcomeGettingStarted/test/node/welcomeGettingStartedLeftoverPromiseCatchScanD1015.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/mcp/test/node/mcpLeftoverPromiseCatchScanD1015.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/terminal/test/node/terminalLeftoverPromiseCatchScanD1015.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/universeAgent/test/node/universeAgentLeftoverPromiseCatchScanD1010.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/suggest/test/node/suggestLeftoverPromiseCatchScanD1007.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/textMate/test/node/textMateLeftoverPromiseCatchScanD1003.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/platform/test/node/platformLeftoverPromiseCatchScanD973.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/editor/test/node/editorLeftoverPromiseCatchScanD978.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/policies/test/node/accountPolicyLeftoverPromiseCatchScanD821.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/markers/test/node/markersLeftoverPromiseCatchScanD868.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/storage/test/node/storageLeftoverPromiseCatchScanD964.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/userDataSync/test/node/userDataSyncLeftoverPromiseCatchScanD789.test.ts')));
	});
});
