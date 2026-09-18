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
const BROWSER_REL = 'src/vs/workbench/contrib/userDataSync/browser/userDataSync.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/userDataSync/browser/userDataSync.contribution.ts';
const TRIGGER_REL = 'src/vs/workbench/contrib/userDataSync/browser/userDataSyncTrigger.ts';
const CONFLICTS_REL = 'src/vs/workbench/contrib/userDataSync/browser/userDataSyncConflictsView.ts';
const VIEWS_REL = 'src/vs/workbench/contrib/userDataSync/browser/userDataSyncViews.ts';
const ELECTRON_REL = 'src/vs/workbench/contrib/userDataSync/electron-browser/userDataSync.contribution.ts';
const UTIL_CHANNEL_REL = 'src/vs/workbench/contrib/userDataSync/electron-browser/userDataSyncUtilChannel.contribution.ts';
const SYNC_IFACE_REL = 'src/vs/workbench/services/userDataSync/common/userDataSync.ts';
const AUTO_SYNC_REL = 'src/vs/platform/userDataSync/common/userDataSync.ts';
const VIEWS_IFACE_REL = 'src/vs/workbench/common/views.ts';
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const PREFERENCES_REL = 'src/vs/workbench/services/preferences/common/preferences.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/host.ts';
const ISSUE_REL = 'src/vs/workbench/contrib/issue/common/issue.ts';
const NATIVE_REL = 'src/vs/platform/native/common/native.ts';
const SYNC_INIT_REL = 'src/vs/workbench/services/userDataSync/browser/userDataSyncInit.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/services/userDataSync/browser/userDataSyncWorkbenchService.ts';
const ENABLEMENT_REL = 'src/vs/platform/userDataSync/common/userDataSyncEnablementService.ts';

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

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const updateAccountBadgeCall = 'this.updateAccountBadge()';
const updateGlobalActivityBadgeCall = 'this.updateGlobalActivityBadge()';
const acceptLocalCall = 'this.acceptLocal(conflict, conflict.conflicts[0])';
const acceptRemoteCall = 'this.acceptRemote(conflict, conflict.conflicts[0])';
const showConflictsCall = 'this.userDataSyncWorkbenchService.showConflicts(conflict.conflicts[0])';
const turnOnRunCall = 'run: () => this.turnOn()';
const executeLogRunCall = 'run: () => this.commandService.executeCommand(SHOW_SYNC_LOG_COMMAND_ID)';
const openReporterRunCall = 'run: () => this.workbenchIssueService.openReporter()';
const resetSyncedDataRunCall = 'run: () => this.userDataSyncWorkbenchService.resetSyncedData()';
const showSyncActivityRunCall = 'run: () => this.userDataSyncWorkbenchService.showSyncActivity()';
const openUserSettingsCall = 'this.preferencesService.openUserSettings({ jsonEditor: true })';
const openKeybindingsCall = 'this.preferencesService.openGlobalKeybindingSettings(true)';
const manageExecuteCall = 'commandService.executeCommand(quickPick.selectedItems[0].id)';
const restartRunCall = 'run: () => this.hostService.restart()';
const triggerWebCall = 'userDataAutoSyncService.triggerSync(sources, { skipIfSyncedRecently: true })';
const triggerDesktopCall = 'userDataAutoSyncService.triggerSync([source!], { skipIfSyncedRecently: true })';
const conflictsRefreshCall = '() => this.treeView.refresh()';
const viewsRefreshCall = '() => treeView.refresh()';
const showItemInFolderCall = 'run: () => hostService.showItemInFolder(folder.fsPath)';

const d789Calls: Array<[string, string, number]> = [
	[BROWSER_REL, updateAccountBadgeCall, 2],
	[BROWSER_REL, updateGlobalActivityBadgeCall, 4],
	[BROWSER_REL, acceptLocalCall, 1],
	[BROWSER_REL, acceptRemoteCall, 1],
	[BROWSER_REL, showConflictsCall, 1],
	[BROWSER_REL, turnOnRunCall, 3],
	[BROWSER_REL, executeLogRunCall, 1],
	[BROWSER_REL, openReporterRunCall, 1],
	[BROWSER_REL, resetSyncedDataRunCall, 2],
	[BROWSER_REL, showSyncActivityRunCall, 2],
	[BROWSER_REL, openUserSettingsCall, 2],
	[BROWSER_REL, openKeybindingsCall, 2],
	[BROWSER_REL, manageExecuteCall, 1],
	[CONTRIB_REL, executeLogRunCall, 2],
	[CONTRIB_REL, restartRunCall, 1],
	[TRIGGER_REL, triggerWebCall, 1],
	[TRIGGER_REL, triggerDesktopCall, 1],
	[CONFLICTS_REL, conflictsRefreshCall, 1],
	[VIEWS_REL, viewsRefreshCall, 2],
	[VIEWS_REL, resetSyncedDataRunCall, 1],
	[ELECTRON_REL, showItemInFolderCall, 1],
];

suite('userDataSync leftover Promise fire-and-forget catch scan (D789)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers thirty-three leftover Promise double-chain sites in contrib/userDataSync', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d789Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 33);
		assert.ok(sites >= 4);
	});

	test('contrib/userDataSync leftover updateAccountBadge / updateGlobalActivityBadge / accept / showConflicts / turnOn / executeCommand / openReporter / reset / showSyncActivity / preferences are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const syncIface = fs.readFileSync(resolveSource(SYNC_IFACE_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const preferences = fs.readFileSync(resolveSource(PREFERENCES_REL), 'utf8');
		const issue = fs.readFileSync(resolveSource(ISSUE_REL), 'utf8');
		assertPromiseSignature(source, 'private async updateAccountBadge(): Promise<void> {');
		assertPromiseSignature(source, 'private async updateGlobalActivityBadge(): Promise<void> {');
		assertPromiseSignature(source, 'private async acceptLocal(syncResource: IUserDataSyncResource, conflict: IResourcePreview): Promise<void> {');
		assertPromiseSignature(source, 'private async acceptRemote(syncResource: IUserDataSyncResource, conflict: IResourcePreview) {');
		assertPromiseSignature(source, 'private async turnOn(): Promise<void> {');
		assertPromiseSignature(syncIface, 'showConflicts(conflictToOpen?: IResourcePreview): Promise<void>;');
		assertPromiseSignature(syncIface, 'resetSyncedData(): Promise<void>;');
		assertPromiseSignature(syncIface, 'showSyncActivity(): Promise<void>;');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assertPromiseSignature(preferences, 'openUserSettings(options?: IOpenSettingsOptions): Promise<IEditorPane | undefined>;');
		assertPromiseSignature(preferences, 'openGlobalKeybindingSettings(textual: boolean, options?: IOpenKeybindingsEditorOptions): Promise<void>;');
		assertPromiseSignature(issue, 'openReporter(dataOverrides?: Partial<IssueReporterData>): Promise<void>;');
		assert.ok(source.includes("import { getErrorMessage, isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(contrib.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, updateAccountBadgeCall);
		assert.strictEqual(countIncludes(source, `${updateAccountBadgeCall}${doubleCatch}`), 2);
		assertWrapped(source, updateGlobalActivityBadgeCall);
		assert.strictEqual(countIncludes(source, `${updateGlobalActivityBadgeCall}${doubleCatch}`), 4);
		assertWrapped(source, acceptLocalCall);
		assertWrapped(source, acceptRemoteCall);
		assertWrapped(source, showConflictsCall);
		assertWrapped(source, turnOnRunCall);
		assert.strictEqual(countIncludes(source, `${turnOnRunCall}${doubleCatch}`), 3);
		assertWrapped(source, executeLogRunCall);
		assertWrapped(source, openReporterRunCall);
		assertWrapped(source, resetSyncedDataRunCall);
		assertWrapped(source, showSyncActivityRunCall);
		assertWrapped(source, openUserSettingsCall);
		assertWrapped(source, openKeybindingsCall);
		assertWrapped(source, manageExecuteCall);
		assertWrapped(contrib, executeLogRunCall);
		assert.strictEqual(countIncludes(contrib, `${executeLogRunCall}${doubleCatch}`), 2);
		assert.ok(!source.includes('this.updateAccountBadge();'));
		assert.ok(!source.includes('this.updateGlobalActivityBadge();'));
		assert.ok(!source.includes('this.acceptLocal(conflict, conflict.conflicts[0]);'));
		assert.ok(!source.includes('this.acceptRemote(conflict, conflict.conflicts[0]);'));
		assert.ok(!source.includes('this.userDataSyncWorkbenchService.showConflicts(conflict.conflicts[0]);'));
		assert.ok(!source.includes('run: () => this.turnOn()}'));
		assert.ok(!source.includes('commandService.executeCommand(quickPick.selectedItems[0].id);'));
	});

	test('contrib/userDataSync leftover triggerSync / treeView.refresh / restart / showItemInFolder are Promise double-chain', () => {
		const trigger = fs.readFileSync(resolveSource(TRIGGER_REL), 'utf8');
		const conflicts = fs.readFileSync(resolveSource(CONFLICTS_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const electron = fs.readFileSync(resolveSource(ELECTRON_REL), 'utf8');
		const autoSync = fs.readFileSync(resolveSource(AUTO_SYNC_REL), 'utf8');
		const viewsIface = fs.readFileSync(resolveSource(VIEWS_IFACE_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		assertPromiseSignature(autoSync, 'triggerSync(sources: string[], options?: SyncOptions): Promise<void>;');
		assertPromiseSignature(viewsIface, 'refresh(treeItems?: readonly ITreeItem[], checkboxesChanged?: readonly ITreeItem[]): Promise<void>;');
		assertPromiseSignature(host, 'restart(): Promise<void>;');
		assertPromiseSignature(native, 'showItemInFolder(path: string): Promise<void>;');
		assert.ok(trigger.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(conflicts.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(views.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(electron.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(trigger, triggerWebCall);
		assertWrapped(trigger, triggerDesktopCall);
		assertWrapped(conflicts, conflictsRefreshCall);
		assertWrapped(views, viewsRefreshCall);
		assert.strictEqual(countIncludes(views, `${viewsRefreshCall}${doubleCatch}`), 2);
		assertWrapped(views, resetSyncedDataRunCall);
		assertWrapped(contrib, restartRunCall);
		assertWrapped(electron, showItemInFolderCall);
		assert.ok(!trigger.includes('userDataAutoSyncService.triggerSync(sources, { skipIfSyncedRecently: true }));'));
		assert.ok(!trigger.includes('userDataAutoSyncService.triggerSync([source!], { skipIfSyncedRecently: true })));'));
		assert.ok(!conflicts.includes('() => this.treeView.refresh());'));
		assert.ok(!views.includes('() => treeView.refresh());'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / D145 stay skipped', () => {
		const source = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		const conflicts = fs.readFileSync(resolveSource(CONFLICTS_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_REL), 'utf8');
		const electron = fs.readFileSync(resolveSource(ELECTRON_REL), 'utf8');
		const utilChannel = fs.readFileSync(resolveSource(UTIL_CHANNEL_REL), 'utf8');
		const init = fs.readFileSync(resolveSource(SYNC_INIT_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');

		assert.ok(source.includes("run(): unknown { return that.openerService.open(URI.parse('https://aka.ms/vscode-settings-sync-help')); }"));
		assert.ok(!source.includes(`that.openerService.open(URI.parse('https://aka.ms/vscode-settings-sync-help'))${doubleCatch}`));
		assert.ok(source.includes('async run(): Promise<void> {\n\t\t\t\treturn that.turnOn();'));
		assert.ok(!source.includes(`return that.turnOn()${doubleCatch}`));
		assert.ok(source.includes('return that.userDataSyncWorkbenchService.turnoff(false);'));
		assert.ok(!source.includes(`return that.userDataSyncWorkbenchService.turnoff(false)${doubleCatch}`));
		assert.ok(source.includes('return that.userDataSyncWorkbenchService.showConflicts();'));
		assert.ok(!source.includes(`return that.userDataSyncWorkbenchService.showConflicts()${doubleCatch}`));
		assert.ok(source.includes('return that.userDataSyncWorkbenchService.showSyncActivity();'));
		assert.ok(!source.includes(`return that.userDataSyncWorkbenchService.showSyncActivity()${doubleCatch}`));
		assert.ok(source.includes('return that.userDataSyncWorkbenchService.syncNow();'));
		assert.ok(!source.includes(`return that.userDataSyncWorkbenchService.syncNow()${doubleCatch}`));
		assert.ok(source.includes('run(): unknown { return that.configureSyncOptions(); }'));
		assert.ok(!source.includes(`return that.configureSyncOptions()${doubleCatch}`));
		assert.ok(source.includes("accessor.get(IPreferencesService).openUserSettings({ jsonEditor: false, query: '@tag:sync' });"));
		assert.ok(!source.includes(`openUserSettings({ jsonEditor: false, query: '@tag:sync' })${doubleCatch}`));
		assert.ok(source.includes('return this.userDataSyncService.resolveContent(uri).then(content => this.modelService.createModel(content || \'\', this.languageService.createById(\'jsonc\'), uri));'));
		assert.ok(!source.includes(`resolveContent(uri).then(content => this.modelService.createModel(content || '', this.languageService.createById('jsonc'), uri))${doubleCatch}`));

		assert.ok(enablement.includes('setResourceEnablement(resource: SyncResource, enabled: boolean): void {'));
		assert.ok(source.includes('this.userDataSyncEnablementService.setResourceEnablement(item.id, isEnabled);'));
		assert.ok(!source.includes(`this.userDataSyncEnablementService.setResourceEnablement(item.id, isEnabled)${doubleCatch}`));

		assert.ok(views.includes('await treeView.refresh();'));
		assert.ok(!views.includes(`await treeView.refresh()${doubleCatch}`));
		assert.ok(conflicts.includes('async run(accessor: ServicesAccessor, handle: TreeViewItemHandleArg): Promise<void> {'));
		assert.ok(conflicts.includes('return that.open(conflict);'));
		assert.ok(!conflicts.includes(`return that.open(conflict)${doubleCatch}`));

		assert.ok(electron.includes('return nativeHostService.showItemInFolder(item.with({ scheme: Schemas.file }).fsPath);'));
		assert.ok(!electron.includes(`return nativeHostService.showItemInFolder(item.with({ scheme: Schemas.file }).fsPath)${doubleCatch}`));

		assert.ok(init.includes(`this.createUserDataSyncStoreClient().then(userDataSyncStoreClient => {
			if (!userDataSyncStoreClient) {
				this.initializationFinished.open();
			}
		})${doubleCatch};`));
		assert.ok(init.includes('this.previewPromise = super.initialize(this.extensionsData).then(() => this.preview);'));
		assert.ok(!init.includes(`this.previewPromise = super.initialize(this.extensionsData).then(() => this.preview)${doubleCatch}`));
		assert.ok(workbench.includes('this.waitAndInitialize();'));
		assert.ok(!workbench.includes(`this.waitAndInitialize()${doubleCatch}`));
		assert.ok(workbench.includes("() => this.update('authentication provider change')"));
		assert.ok(!workbench.includes(`this.update('authentication provider change')${doubleCatch}`));

		assert.ok(!utilChannel.includes('.then('));
		assert.ok(!utilChannel.includes(doubleCatch));

		for (const file of [source, conflicts, views, electron, utilChannel]) {
			assert.ok(!file.includes('acknowledge('));
			assert.ok(!file.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(file));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(file));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(file));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(file));
		}
	});
});
