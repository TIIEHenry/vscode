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
const LAYOUT_REL = 'src/vs/sessions/contrib/layout/browser/singlePaneLayoutController.ts';
const CHAT_CONTRIB_REL = 'src/vs/sessions/contrib/chat/electron-browser/chat.contribution.ts';
const MODEL_PICKER_REL = 'src/vs/sessions/contrib/chat/browser/modelPicker.ts';
const TERMINAL_REL = 'src/vs/sessions/contrib/terminal/browser/sessionsTerminalContribution.ts';
const SESSIONS_VIEW_REL = 'src/vs/sessions/contrib/sessions/browser/views/sessionsView.ts';
const TREE_REL = 'src/vs/sessions/contrib/aiCustomizationTreeView/browser/aiCustomizationTreeViewViews.ts';
const ATTACHMENTS_REL = 'src/vs/sessions/contrib/chat/browser/newChatContextAttachments.ts';
const TELEMETRY_REL = 'src/vs/sessions/contrib/sessions/browser/sessionsTelemetry.contribution.ts';
const SLASH_REL = 'src/vs/sessions/contrib/chat/browser/slashCommands.ts';
const WORKSPACE_PICKER_REL = 'src/vs/sessions/contrib/chat/browser/sessionWorkspacePicker.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/common/lifecycle.ts';
const TERMINAL_IFACE_REL = 'src/vs/workbench/contrib/terminal/browser/terminal.ts';
const TRUST_REL = 'src/vs/platform/workspace/common/workspaceTrust.ts';
const SORT_SHEET_REL = 'src/vs/sessions/browser/parts/mobile/mobileSortGroupSheet.ts';
const ASYNC_TREE_REL = 'src/vs/base/browser/ui/tree/asyncDataTree.ts';

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

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertDoubleThen(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch};`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

suite('sessions/contrib leftover Promise fire-and-forget catch scan (D699)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const chat = fs.readFileSync(resolveSource(CHAT_CONTRIB_REL), 'utf8');
		const picker = fs.readFileSync(resolveSource(MODEL_PICKER_REL), 'utf8');
		const terminal = fs.readFileSync(resolveSource(TERMINAL_REL), 'utf8');
		const sessionsView = fs.readFileSync(resolveSource(SESSIONS_VIEW_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(TREE_REL), 'utf8');
		const attachments = fs.readFileSync(resolveSource(ATTACHMENTS_REL), 'utf8');
		const sites = [
			layout.includes(`this._lifecycleService.when(LifecyclePhase.Restored).then(() => {`),
			chat.includes(`this.lifecycleService.when(LifecyclePhase.Eventually).then(() => disposable.dispose())${doubleCatch};`),
			picker.includes(`this._workspaceTrustManagementService.workspaceTrustInitialized.then(() => {`),
			terminal.includes(`instance.getInitialCwd().then(cwd => {`),
			sessionsView.includes(`showMobileSortGroupSheet(this.layoutService.mainContainer, localize('sortGroupSheet.title', "Sort"), items).then(selectedId => {`),
			tree.includes(`void this.tree.setInput(ROOT_ELEMENT).then(() => this.autoExpandCategories())${doubleCatch};`),
			tree.includes(`void this.tree?.setInput(ROOT_ELEMENT).then(() => this.autoExpandCategories())${doubleCatch};`),
			attachments.includes(`this._collectFilePicks(folderUri, filePattern, token).then(filePicks => {`),
		].filter(Boolean).length;
		assert.strictEqual(sites, 8);
		assert.ok(layout.includes(`		})${doubleCatch};`));
		assert.ok(picker.includes(`		})${doubleCatch};`));
		assert.ok(terminal.includes(`				})${doubleCatch};`));
		assert.ok(sessionsView.includes(`		})${doubleCatch};`));
		assert.ok(attachments.includes(`				})${doubleCatch};`));
	});

	test('layout leftover when Restored then is Promise double-chain; sync toggleDetails stays skipped', () => {
		const source = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'when(phase: LifecyclePhase): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const thenCall = `this._lifecycleService.when(LifecyclePhase.Restored).then(() => {
			if (this._store.isDisposed) {
				return;
			}
			this._managedTabs = this._register(this._instantiationService.createInstance(SinglePaneDockedTabsCoordinator, this._ctx));
			this._existingSession?.registerManagedTabs(this._managedTabs);
		})`;
		assertDoubleThen(source, thenCall);
		assert.ok(source.includes('toggleDetails(): boolean {'));
		assert.ok(!source.includes('toggleDetails().catch'));
	});

	test('chat leftover when Eventually then is Promise double-chain; awaited when stays skipped', () => {
		const source = fs.readFileSync(resolveSource(CHAT_CONTRIB_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'when(phase: LifecyclePhase): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.lifecycleService.when(LifecyclePhase.Eventually).then(() => disposable.dispose())');
		assert.ok(source.includes('await this.lifecycleService.when(LifecyclePhase.Eventually);'));
		assert.ok(!source.includes('await this.lifecycleService.when(LifecyclePhase.Eventually).catch'));
	});

	test('modelPicker leftover workspaceTrustInitialized then is Promise double-chain; sync _updatePickerState stays skipped', () => {
		const source = fs.readFileSync(resolveSource(MODEL_PICKER_REL), 'utf8');
		const trust = fs.readFileSync(resolveSource(TRUST_REL), 'utf8');
		assertPromiseSignature(trust, 'readonly workspaceTrustInitialized: Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const thenCall = `this._workspaceTrustManagementService.workspaceTrustInitialized.then(() => {
			if (!this._store.isDisposed) {
				this._updatePickerState();
			}
		})`;
		assertDoubleThen(source, thenCall);
		assert.ok(source.includes('private _updatePickerState(): void {'));
		assert.ok(source.includes('this._updatePickerState();'));
		assert.ok(!source.includes('this._updatePickerState().catch'));
	});

	test('terminal leftover getInitialCwd then is Promise double-chain; D145 await swallow stays skipped', () => {
		const source = fs.readFileSync(resolveSource(TERMINAL_REL), 'utf8');
		const terminal = fs.readFileSync(resolveSource(TERMINAL_IFACE_REL), 'utf8');
		assertPromiseSignature(terminal, 'getInitialCwd(): Promise<string>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const thenCall = `instance.getInitialCwd().then(cwd => {
					if (cwd.toLowerCase() !== this._activeKey) {
						const availableInstance = this._getAvailableTerminal(instance, \`hide restored terminal for \${cwd}\`);
						if (!availableInstance) {
							return;
						}
						this._terminalService.moveToBackground(availableInstance);
						this._logService.trace(\`[SessionsTerminal] Hid restored terminal \${availableInstance.instanceId} (cwd: \${cwd})\`);
					}
				})`;
		assertDoubleThen(source, thenCall);
		assert.ok(source.includes('try { cwd = await instance.getInitialCwd(); } catch { /* ignored */ }'));
		assert.ok(!source.includes('await instance.getInitialCwd().catch(onUnexpectedError)'));
	});

	test('sessionsView leftover showMobileSortGroupSheet then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(SESSIONS_VIEW_REL), 'utf8');
		const sheet = fs.readFileSync(resolveSource(SORT_SHEET_REL), 'utf8');
		assertPromiseSignature(sheet, '): Promise<string | undefined> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		const thenCall = `showMobileSortGroupSheet(this.layoutService.mainContainer, localize('sortGroupSheet.title', "Sort"), items).then(selectedId => {
			if (!selectedId) {
				return;
			}
			if (selectedId === SessionsSorting.Created || selectedId === SessionsSorting.Updated) {
				this.setSorting(selectedId);
			} else if (selectedId === SessionsGrouping.Workspace || selectedId === SessionsGrouping.Date) {
				this.setGrouping(selectedId);
			}
		})`;
		assertDoubleThen(source, thenCall);
	});

	test('aiCustomization leftover setInput thens are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(TREE_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(ASYNC_TREE_REL), 'utf8');
		assertPromiseSignature(tree, 'async setInput(input: TInput, viewState?: IAsyncDataTreeViewState): Promise<void> {');
		assertPromiseSignature(source, 'private async autoExpandCategories(): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'void this.tree.setInput(ROOT_ELEMENT).then(() => this.autoExpandCategories())');
		assertDoubleThen(source, 'void this.tree?.setInput(ROOT_ELEMENT).then(() => this.autoExpandCategories())');
	});

	test('newChatContextAttachments leftover _collectFilePicks then is Promise double-chain; opener stays skipped', () => {
		const source = fs.readFileSync(resolveSource(ATTACHMENTS_REL), 'utf8');
		assertPromiseSignature(source, 'private async _collectFilePicks(rootUri: URI, filePattern?: string, token?: CancellationToken): Promise<IQuickPickItem[]> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const thenCall = `this._collectFilePicks(folderUri, filePattern, token).then(filePicks => {
					if (token.isCancellationRequested) {
						return;
					}
					picker.busy = false;
					if (filePicks.length > 0) {
						picker.items = [
							...staticPicks,
							{ type: 'separator', label: basename(folderUri) },
							...filePicks,
						];
					} else {
						picker.items = staticPicks;
					}
				})`;
		assertDoubleThen(source, thenCall);
		assert.ok(source.includes('await this.openerService.open(resource, { fromUserGesture: true });'));
		assert.ok(source.includes('await this.openerService.open(openResource, { fromUserGesture: true });'));
		assert.ok(!source.includes('openerService.open(resource, { fromUserGesture: true }).catch'));
		assert.ok(!source.includes('openerService.open(openResource, { fromUserGesture: true }).catch'));
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty / two-arg then / await / already-double stay skipped', () => {
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const chat = fs.readFileSync(resolveSource(CHAT_CONTRIB_REL), 'utf8');
		const picker = fs.readFileSync(resolveSource(MODEL_PICKER_REL), 'utf8');
		const terminal = fs.readFileSync(resolveSource(TERMINAL_REL), 'utf8');
		const sessionsView = fs.readFileSync(resolveSource(SESSIONS_VIEW_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(TREE_REL), 'utf8');
		const attachments = fs.readFileSync(resolveSource(ATTACHMENTS_REL), 'utf8');
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		const slash = fs.readFileSync(resolveSource(SLASH_REL), 'utf8');
		const workspacePicker = fs.readFileSync(resolveSource(WORKSPACE_PICKER_REL), 'utf8');
		assert.ok(attachments.includes('await this.openerService.open(resource, { fromUserGesture: true });'));
		assert.ok(!attachments.includes('openerService.open(resource, { fromUserGesture: true }).catch'));
		assert.ok(terminal.includes('try { cwd = await instance.getInitialCwd(); } catch { /* ignored */ }'));
		assert.ok(layout.includes('toggleDetails(): boolean {'));
		assert.ok(picker.includes('private _updatePickerState(): void {'));
		assert.ok(chat.includes('await this.lifecycleService.when(LifecyclePhase.Eventually);'));
		assert.ok(slash.includes('this.harnessService.getSlashCommands(sessionResource, CancellationToken.None).then(commands => {'));
		assert.ok(slash.includes('		}, () => {'));
		assert.ok(!slash.includes(`getSlashCommands(sessionResource, CancellationToken.None).then(commands => {}${doubleCatch}`));
		assert.ok(telemetry.includes('void this._sessionsTasksService.getAllTasks(session).then(tasks => {'));
		assert.ok(telemetry.includes('void this._getOrFetchWorkspaceFileCount(session.sessionId, workspace).then(workspaceFileCount => {'));
		assert.ok(telemetry.includes('void this._getSessionActionPayload(session).then(payload => {'));
		assert.ok(!telemetry.includes('}).catch(onUnexpectedError);'));
		assert.ok(telemetry.includes(`}).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(workspacePicker.includes(`void this._sessionWorkspaceFallback.findWorkspace().then(restored => {`));
		assert.ok(workspacePicker.includes(`})${doubleCatch};`));
		for (const source of [layout, chat, picker, terminal, sessionsView, tree, attachments]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('Wire('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
