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
const WINDOW_REL = 'src/vs/workbench/electron-browser/window.ts';
const TOASTS_REL = 'src/vs/workbench/browser/parts/notifications/notificationsToasts.ts';
const EDITOR_PARTS_REL = 'src/vs/workbench/browser/parts/editor/editorParts.ts';
const LAYOUT_REL = 'src/vs/workbench/browser/layout.ts';
const CONTEXTKEYS_REL = 'src/vs/workbench/browser/contextkeys.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/common/lifecycle.ts';
const GROUPS_REL = 'src/vs/workbench/services/editor/common/editorGroupsService.ts';
const CONTRIBUTIONS_REL = 'src/vs/workbench/common/contributions.ts';
const DESKTOP_MAIN_REL = 'src/vs/workbench/electron-browser/desktop.main.ts';

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

suite('workbench chrome leftover Promise fire-and-forget catch scan (D697)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers seven leftover Promise double-chain sites', () => {
		const files = [WINDOW_REL, TOASTS_REL, EDITOR_PARTS_REL, LAYOUT_REL, CONTEXTKEYS_REL];
		let sites = 0;
		for (const rel of files) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		}
		assert.ok(sites >= 7 && sites <= 8, `expected D697 seven sites (layout may include D706 whenStylesHaveLoaded), got ${sites}`);
	});

	test('native window leftover when Ready / Restored then are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'when(phase: LifecyclePhase): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.lifecycleService.when(LifecyclePhase.Ready).then(() => this.nativeHostService.notifyReady())');
		const restoredThen = `this.lifecycleService.when(LifecyclePhase.Restored).then(() => {
			this.sharedProcessService.notifyRestored();
			this.utilityProcessWorkerWorkbenchService.notifyRestored();
		})`;
		assert.ok(source.includes(`${restoredThen}${doubleCatch};`));
		assert.ok(!source.includes(`${restoredThen};`));
		assert.ok(!source.includes(`${restoredThen}.catch(onUnexpectedError);`));
	});

	test('notificationsToasts leftover when Restored then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(TOASTS_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'when(phase: LifecyclePhase): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const restoredThen = `this.lifecycleService.when(LifecyclePhase.Restored).then(() => {

			// Show toast for initial notifications if any
			this.model.notifications.forEach(notification => this.addToast(notification));

			// Update toasts on notification changes
			this._register(this.model.onDidChangeNotification(e => this.onDidChangeNotification(e)));
		})`;
		assert.ok(source.includes(`${restoredThen}${doubleCatch};`));
		assert.ok(!source.includes(`${restoredThen};`));
		assert.ok(!source.includes(`${restoredThen}.catch(onUnexpectedError);`));
	});

	test('editorParts leftover whenReady then is Promise double-chain; sync registerGroupsContextKeyListeners stays skipped', () => {
		const source = fs.readFileSync(resolveSource(EDITOR_PARTS_REL), 'utf8');
		const groups = fs.readFileSync(resolveSource(GROUPS_REL), 'utf8');
		assertPromiseSignature(groups, 'readonly whenReady: Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.whenReady.then(() => this.registerGroupsContextKeyListeners())');
		assert.ok(source.includes('private registerGroupsContextKeyListeners(): void {'));
		assert.ok(!source.includes('this.registerGroupsContextKeyListeners().catch'));
	});

	test('layout leftover whenRestored thens are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const groups = fs.readFileSync(resolveSource(GROUPS_REL), 'utf8');
		assertPromiseSignature(groups, 'readonly whenRestored: Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../base/common/errors.js';"));
		const listenersThen = `this.editorGroupService.whenRestored.then(() => {

			// Handle visible editors changing for parts visibility
			this._register(this.mainPartEditorService.onDidVisibleEditorsChange(e => {
				const handled = maybeMaximizeAuxiliaryBar();
				if (!handled) {
					showEditorIfHidden(e.isExplicit);
				}
			}));
			this._register(this.editorGroupService.mainPart.onDidActivateGroup(e => {
				if (e.reason !== GroupActivationReason.PART_CLOSE) {
					showEditorIfHidden(); // only show unless a modal/auxiliary part closes
				}
			}));

			// Revalidate center layout when active editor changes: diff editor quits centered mode
			this._register(this.mainPartEditorService.onDidActiveEditorChange(() => this.centerMainEditorLayout(this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED))));
		})`;
		assert.ok(source.includes(`${listenersThen}${doubleCatch};`));
		assert.ok(!source.includes(`${listenersThen};`));
		assert.ok(!source.includes(`${listenersThen}.catch(onUnexpectedError);`));
		assertDoubleThen(source, 'this.editorGroupService.whenRestored.then(() => this.centerMainEditorLayout(this.stateModel.getRuntimeValue(LayoutStateKeys.MAIN_EDITOR_CENTERED), skipLayout))');
	});

	test('contextkeys leftover whenReady then is Promise double-chain; sync update* stays skipped', () => {
		const source = fs.readFileSync(resolveSource(CONTEXTKEYS_REL), 'utf8');
		const groups = fs.readFileSync(resolveSource(GROUPS_REL), 'utf8');
		assertPromiseSignature(groups, 'readonly whenReady: Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../base/common/errors.js';"));
		const thenCall = `this.editorGroupService.whenReady.then(() => {
			this.updateEditorAreaContextKeys();
			this.updateActiveEditorGroupContextKeys();
			this.updateVisiblePanesContextKeys();
		})`;
		assert.ok(source.includes(`${thenCall}${doubleCatch};`));
		assert.ok(!source.includes(`${thenCall};`));
		assert.ok(!source.includes(`${thenCall}.catch(onUnexpectedError);`));
		assert.ok(source.includes('this.updateActiveEditorGroupContextKeys())'));
		assert.ok(!source.includes('this.updateActiveEditorGroupContextKeys().catch'));
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty / contributions instantiate-by-phase stay skipped', () => {
		const windowSource = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const toasts = fs.readFileSync(resolveSource(TOASTS_REL), 'utf8');
		const editorParts = fs.readFileSync(resolveSource(EDITOR_PARTS_REL), 'utf8');
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const contextkeys = fs.readFileSync(resolveSource(CONTEXTKEYS_REL), 'utf8');
		const contributions = fs.readFileSync(resolveSource(CONTRIBUTIONS_REL), 'utf8');
		const desktopMain = fs.readFileSync(resolveSource(DESKTOP_MAIN_REL), 'utf8');

		assert.ok(windowSource.includes('this.setupOpenHandlers();'));
		assert.ok(windowSource.includes('this.handleWarnings();'));
		assert.ok(!windowSource.includes('this.handleWarnings().catch'));
		assert.ok(windowSource.includes('this.openerService.open('));
		assert.ok(!/this\.openerService\.open\([^;]+\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(windowSource));
		assert.ok(windowSource.includes('await this.lifecycleService.when(LifecyclePhase.Restored);'));

		assert.ok(editorParts.includes('void editorPart.activeGroup.openEditor(defaultInput);'));
		assert.ok(!editorParts.includes('void editorPart.activeGroup.openEditor(defaultInput).catch'));

		assert.ok(contributions.includes('lifecycleService.when(phase).then(() => this.doInstantiateByPhase(instantiationService, logService, environmentService, phase));'));
		assert.ok(!contributions.includes('lifecycleService.when(phase).then(() => this.doInstantiateByPhase(instantiationService, logService, environmentService, phase)).catch'));

		assert.ok(desktopMain.includes('this.createWorkspaceService('));
		assert.ok(!/createWorkspaceService\([^)]*\)\.then\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(desktopMain));

		for (const source of [windowSource, toasts, editorParts, layout, contextkeys]) {
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
