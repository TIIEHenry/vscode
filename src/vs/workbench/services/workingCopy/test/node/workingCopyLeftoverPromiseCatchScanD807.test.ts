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
const FILES_REL = 'src/vs/platform/files/common/files.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const BACKUP_IFACE_REL = 'src/vs/workbench/services/workingCopy/common/workingCopyBackup.ts';
const WORKING_COPY_REL = 'src/vs/workbench/services/workingCopy/common/workingCopy.ts';
const HISTORY_IFACE_REL = 'src/vs/workbench/services/workingCopy/common/workingCopyHistory.ts';
const TRACKER_REL = 'src/vs/workbench/services/workingCopy/common/workingCopyBackupTracker.ts';
const HISTORY_TRACKER_REL = 'src/vs/workbench/services/workingCopy/common/workingCopyHistoryTracker.ts';
const RESOURCE_REL = 'src/vs/workbench/services/workingCopy/common/resourceWorkingCopy.ts';
const HISTORY_SVC_REL = 'src/vs/workbench/services/workingCopy/common/workingCopyHistoryService.ts';
const STORED_REL = 'src/vs/workbench/services/workingCopy/common/storedFileWorkingCopy.ts';
const STORED_MGR_REL = 'src/vs/workbench/services/workingCopy/common/storedFileWorkingCopyManager.ts';
const TEXTFILE_MODEL_REL = 'src/vs/workbench/services/textfile/common/textFileEditorModel.ts';
const TEXTFILE_MGR_REL = 'src/vs/workbench/services/textfile/common/textFileEditorModelManager.ts';
const TEXTFILE_SVC_REL = 'src/vs/workbench/services/textfile/browser/textFileService.ts';
const UNTITLED_MODEL_REL = 'src/vs/workbench/services/untitled/common/untitledTextEditorModel.ts';
const UNTITLED_SVC_REL = 'src/vs/workbench/services/untitled/common/untitledTextEditorService.ts';
const VIEWS_DESC_REL = 'src/vs/workbench/services/views/browser/viewDescriptorService.ts';
const VIEWS_SVC_REL = 'src/vs/workbench/services/views/common/viewsService.ts';
const FILES_CFG_REL = 'src/vs/workbench/services/filesConfiguration/common/filesConfigurationService.ts';
const HOST_BROWSER_REL = 'src/vs/workbench/services/host/browser/browserHostService.ts';

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
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const restoreBackupsCall = 'this.restoreBackups(handler)';
const doDiscardBackupCall = 'this.doDiscardBackup(workingCopyIdentifier, cts)';
const onDidRunFileOperationCall = 'this.onDidRunFileOperation(e)';
const onDidFilesChangeCall = 'this.onDidFilesChange(e)';
const storeAllCall = 'this.storeAll(this.storeAllCts.token)';
const asyncReloadIifeCall = `await workingCopy.resolve(resolveOptions);
						} catch (error) {
							if (!workingCopy.isDisposed()) {
								onUnexpectedError(error); // only log if the working copy is still around
							}
						}
					})()`;
const elevatedSaveCall = 'this.save({ ...options, writeElevated: true, writeUnlock: triedToUnlock, reason: SaveReason.EXPLICIT })';

const d807Calls: Array<[string, string, number]> = [
	[TRACKER_REL, restoreBackupsCall, 1],
	[TRACKER_REL, doDiscardBackupCall, 1],
	[HISTORY_TRACKER_REL, onDidRunFileOperationCall, 1],
	[RESOURCE_REL, onDidFilesChangeCall, 1],
	[HISTORY_SVC_REL, storeAllCall, 1],
	[STORED_MGR_REL, asyncReloadIifeCall, 1],
	[STORED_REL, elevatedSaveCall, 1],
];

suite('workingCopy leftover Promise fire-and-forget catch scan (D807)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers seven leftover Promise double-chain sites in services/workingCopy and did not overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d807Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 7);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(TRACKER_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(HISTORY_TRACKER_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(RESOURCE_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(HISTORY_SVC_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(STORED_MGR_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(STORED_REL) ?? ''), 1);
		assert.ok(!fs.readFileSync(resolveSource(TEXTFILE_SVC_REL), 'utf8').includes(doubleCatch));
		assert.ok(!fs.readFileSync(resolveSource(UNTITLED_SVC_REL), 'utf8').includes(doubleCatch));
		assert.ok(!fs.readFileSync(resolveSource(VIEWS_SVC_REL), 'utf8').includes(doubleCatch));
		assert.ok(!fs.readFileSync(resolveSource(FILES_CFG_REL), 'utf8').includes(doubleCatch));
	});

	test('workingCopy leftover restoreBackups / doDiscardBackup / onDidRunFileOperation / onDidFilesChange are Promise double-chain', () => {
		const tracker = fs.readFileSync(resolveSource(TRACKER_REL), 'utf8');
		const historyTracker = fs.readFileSync(resolveSource(HISTORY_TRACKER_REL), 'utf8');
		const resource = fs.readFileSync(resolveSource(RESOURCE_REL), 'utf8');
		const backup = fs.readFileSync(resolveSource(BACKUP_IFACE_REL), 'utf8');
		const history = fs.readFileSync(resolveSource(HISTORY_IFACE_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		assertPromiseSignature(tracker, 'protected async restoreBackups(handler: IWorkingCopyEditorHandler): Promise<void> {');
		assertPromiseSignature(tracker, 'private async doDiscardBackup(workingCopyIdentifier: IWorkingCopyIdentifier, cts: CancellationTokenSource)');
		assertPromiseSignature(backup, 'discardBackup(identifier: IWorkingCopyIdentifier, token?: CancellationToken): Promise<void>;');
		assertPromiseSignature(historyTracker, 'private async onDidRunFileOperation(e: FileOperationEvent): Promise<void> {');
		assertPromiseSignature(history, 'moveEntries(source: URI, target: URI): Promise<URI[]>;');
		assertPromiseSignature(resource, 'private async onDidFilesChange(e: FileChangesEvent): Promise<void> {');
		assertPromiseSignature(files, 'exists(resource: URI): Promise<boolean>;');
		assert.ok(tracker.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(historyTracker.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(resource.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(tracker, restoreBackupsCall);
		assertWrapped(tracker, doDiscardBackupCall);
		assertWrapped(historyTracker, onDidRunFileOperationCall);
		assertWrapped(resource, onDidFilesChangeCall);
		assert.ok(!tracker.includes('handler => this.restoreBackups(handler)));'));
		assert.ok(!tracker.includes(`${doDiscardBackupCall};`));
		assert.ok(!historyTracker.includes('e => this.onDidRunFileOperation(e)));'));
		assert.ok(!resource.includes('e => this.onDidFilesChange(e)));'));
	});

	test('workingCopy leftover storeAll scheduler / async reload IIFE / elevated save are Promise double-chain', () => {
		const historySvc = fs.readFileSync(resolveSource(HISTORY_SVC_REL), 'utf8');
		const storedMgr = fs.readFileSync(resolveSource(STORED_MGR_REL), 'utf8');
		const stored = fs.readFileSync(resolveSource(STORED_REL), 'utf8');
		const workingCopy = fs.readFileSync(resolveSource(WORKING_COPY_REL), 'utf8');
		assertPromiseSignature(historySvc, 'private async storeAll(token: CancellationToken): Promise<void> {');
		assertPromiseSignature(stored, 'async resolve(options?: IStoredFileWorkingCopyResolveOptions): Promise<void> {');
		assertPromiseSignature(stored, 'async save(options: IStoredFileWorkingCopySaveAsOptions = Object.create(null)): Promise<boolean> {');
		assertPromiseSignature(workingCopy, 'save(options?: ISaveOptions): Promise<boolean>;');
		assert.ok(historySvc.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(storedMgr.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(stored.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(historySvc, storeAllCall);
		assertWrapped(storedMgr, asyncReloadIifeCall);
		assertWrapped(stored, elevatedSaveCall);
		assert.ok(!historySvc.includes('() => this.storeAll(this.storeAllCts.token), NativeWorkingCopyHistoryService.STORE_ALL_INTERVAL)'));
		assert.ok(!storedMgr.includes('})();\n'));
		assert.ok(!stored.includes(`${elevatedSaveCall};\n`));
	});

	test('workingCopy leftover remaining limiter.queue / returned IAction.run / assigned whenReady stay unwrapped', () => {
		const historyTracker = fs.readFileSync(resolveSource(HISTORY_TRACKER_REL), 'utf8');
		const stored = fs.readFileSync(resolveSource(STORED_REL), 'utf8');
		const tracker = fs.readFileSync(resolveSource(TRACKER_REL), 'utf8');
		const storedMgr = fs.readFileSync(resolveSource(STORED_MGR_REL), 'utf8');
		assert.ok(historyTracker.includes('this.limiter.queue(async () => {'));
		assert.ok(!historyTracker.includes(`this.limiter.queue(async () => {${doubleCatch}`));
		assert.ok(stored.includes('run: () => this.save({ ...options, ignoreModifiedSince: true, reason: SaveReason.EXPLICIT })'));
		assert.ok(!stored.includes(`run: () => this.save({ ...options, ignoreModifiedSince: true, reason: SaveReason.EXPLICIT })${doubleCatch}`));
		assert.ok(stored.includes('run: () => this.revert()'));
		assert.ok(!stored.includes(`run: () => this.revert()${doubleCatch}`));
		assert.ok(stored.includes('run: () => this.save({ ...options, writeUnlock: true, reason: SaveReason.EXPLICIT })'));
		assert.ok(stored.includes('run: () => this.save({ ...options, reason: SaveReason.EXPLICIT })'));
		assert.ok(tracker.includes('this.whenReady = this.resolveBackupsToRestore();'));
		assert.ok(!tracker.includes(`this.whenReady = this.resolveBackupsToRestore()${doubleCatch}`));
		assert.ok(storedMgr.includes('this._register(this.fileService.onDidFilesChange(e => this.onDidFilesChange(e)));'));
		assert.ok(!storedMgr.includes(`this._register(this.fileService.onDidFilesChange(e => this.onDidFilesChange(e)${doubleCatch}`));
	});

	test('textfile / untitled / views / filesConfiguration leftover remaining stay unwrapped because workingCopy already has seven legal sites', () => {
		const textfileModel = fs.readFileSync(resolveSource(TEXTFILE_MODEL_REL), 'utf8');
		const textfileMgr = fs.readFileSync(resolveSource(TEXTFILE_MGR_REL), 'utf8');
		const untitled = fs.readFileSync(resolveSource(UNTITLED_MODEL_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_DESC_REL), 'utf8');
		const filesCfg = fs.readFileSync(resolveSource(FILES_CFG_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_BROWSER_REL), 'utf8');
		assertPromiseSignature(textfileModel, 'protected override async autoDetectLanguage(): Promise<void> {');
		assert.ok(textfileModel.includes('\t\tthis.autoDetectLanguage();\n'));
		assert.ok(!textfileModel.includes(`this.autoDetectLanguage()${doubleCatch}`));
		assert.ok(textfileMgr.includes('})();\n'));
		assert.ok(!textfileMgr.includes(`})${doubleCatch};`));
		assert.ok(untitled.includes('\t\tthis.autoDetectLanguage();\n'));
		assert.ok(!untitled.includes(`this.autoDetectLanguage()${doubleCatch}`));
		assert.ok(views.includes('this.extensionService.whenInstalledExtensionsRegistered().then(() => this.whenExtensionsRegistered());'));
		assert.ok(!views.includes(`this.extensionService.whenInstalledExtensionsRegistered().then(() => this.whenExtensionsRegistered())${doubleCatch}`));
		assert.ok(!filesCfg.includes(doubleCatch));
		assert.ok(host.includes('this.doOpen(undefined, { payload: Array.from(environment.entries()) });'));
		assert.ok(!host.includes(`this.doOpen(undefined, { payload: Array.from(environment.entries()) })${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const tracker = fs.readFileSync(resolveSource(TRACKER_REL), 'utf8');
		const historyTracker = fs.readFileSync(resolveSource(HISTORY_TRACKER_REL), 'utf8');
		const resource = fs.readFileSync(resolveSource(RESOURCE_REL), 'utf8');
		const historySvc = fs.readFileSync(resolveSource(HISTORY_SVC_REL), 'utf8');
		const stored = fs.readFileSync(resolveSource(STORED_REL), 'utf8');
		const storedMgr = fs.readFileSync(resolveSource(STORED_MGR_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_DESC_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assertPromiseSignature(tracker, 'private async resolveBackupsToRestore(): Promise<void> {');
		assert.ok(views.includes('whenExtensionsRegistered(): void {'));

		assert.ok(!tracker.includes('IOpenerService'));
		assert.ok(!historyTracker.includes('IOpenerService'));
		assert.ok(!resource.includes('IOpenerService'));
		assert.ok(!historySvc.includes('IOpenerService'));
		assert.ok(!stored.includes('IOpenerService'));
		assert.ok(!storedMgr.includes('IOpenerService'));
		assert.ok(!tracker.includes('openerService.open'));
		assert.ok(!stored.includes('openerService.open'));

		assert.ok(!tracker.includes('extends Action2'));
		assert.ok(!historyTracker.includes('extends Action2'));
		assert.ok(!resource.includes('extends Action2'));
		assert.ok(!historySvc.includes('extends Action2'));
		assert.ok(!stored.includes('extends Action2'));
		assert.ok(!storedMgr.includes('extends Action2'));

		assert.ok(tracker.includes('await this.editorService.openEditors(['));
		assert.ok(!tracker.includes(`openEditors([${doubleCatch}`));
		assert.ok(tracker.includes('return openedEditorForBackup.resolve();'));
		assert.ok(!tracker.includes(`return openedEditorForBackup.resolve()${doubleCatch}`));
		assert.ok(historySvc.includes('e.join(this.storeAll(e.token), { id: \'join.workingCopyHistory\', label: localize(\'join.workingCopyHistory\', "Saving local history") });'));
		assert.ok(!historySvc.includes(`e.join(this.storeAll(e.token)${doubleCatch}`));
		assert.ok(stored.includes('await this.doSave(options);'));
		assert.ok(!stored.includes(`await this.doSave(options)${doubleCatch}`));

		assert.ok(!tracker.includes('.then('));
		assert.ok(!historyTracker.includes('.then('));
		assert.ok(!resource.includes('.then('));
		assert.ok(!stored.includes('.then('));
		assert.ok(!stored.includes(', error => {'));
		assert.ok(!tracker.includes(' = this.restoreBackups'));
		assert.ok(!historySvc.includes(' = this.storeAll'));

		for (const source of [tracker, historyTracker, resource, historySvc, stored, storedMgr]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
		}
	});
});
