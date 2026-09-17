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
const MENUBAR_REL = 'src/vs/workbench/browser/parts/titlebar/menubarControl.ts';
const PANE_PART_REL = 'src/vs/workbench/browser/parts/paneCompositePart.ts';
const PANE_BAR_REL = 'src/vs/workbench/browser/parts/paneCompositeBar.ts';
const COMPOSITE_BAR_REL = 'src/vs/workbench/browser/parts/compositeBar.ts';
const COMPOSITE_PART_REL = 'src/vs/workbench/browser/parts/compositePart.ts';
const ACCESSIBILITY_REL = 'src/vs/platform/accessibility/common/accessibility.ts';
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const WINDOW_REL = 'src/vs/workbench/electron-browser/window.ts';
const BROWSER_WINDOW_REL = 'src/vs/workbench/browser/window.ts';
const CONTRIBUTIONS_REL = 'src/vs/workbench/common/contributions.ts';
const LAYOUT_REL = 'src/vs/workbench/browser/layout.ts';
const TOASTS_REL = 'src/vs/workbench/browser/parts/notifications/notificationsToasts.ts';
const EDITOR_PARTS_REL = 'src/vs/workbench/browser/parts/editor/editorParts.ts';
const CONTEXTKEYS_REL = 'src/vs/workbench/browser/contextkeys.ts';
const GLOBAL_BAR_REL = 'src/vs/workbench/browser/parts/globalCompositeBar.ts';
const VIEW_PANE_REL = 'src/vs/workbench/browser/parts/views/viewPaneContainer.ts';
const TREE_VIEW_REL = 'src/vs/workbench/browser/parts/views/treeView.ts';
const EDITOR_STATUS_REL = 'src/vs/workbench/browser/parts/editor/editorStatus.ts';
const BREADCRUMBS_REL = 'src/vs/workbench/browser/parts/editor/breadcrumbsModel.ts';
const LIST_COMMANDS_REL = 'src/vs/workbench/browser/actions/listCommands.ts';

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

suite('workbench composite leftover Promise fire-and-forget catch scan (D714)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const menubar = fs.readFileSync(resolveSource(MENUBAR_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const paneBar = fs.readFileSync(resolveSource(PANE_BAR_REL), 'utf8');
		const compositeBar = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');
		const calls = [
			[menubar, `this.accessibilityService.alwaysUnderlineAccessKeys().then(val => {
				this.alwaysOnMnemonics = val;
				this.menubar?.update(this.getMenuBarOptions());
			})`],
			[panePart, 'this.openPaneComposite(currentContainer.id, true)'],
			[panePart, `this.openPaneComposite(newContainer.id, true).then(composite => {
									composite?.openView(viewToMove.id, true);
								})`],
			[paneBar, `case 'focus':
						this.paneCompositePart.openPaneComposite(this.compositeBarActionItem.id, focus)`],
			[compositeBar, 'this.openComposite(currentContainer.id, true)'],
			[compositeBar, `this.openComposite(newContainer.id, true).then(composite => {
					composite?.openView(viewToMove.id, true);
				})`],
			[compositeBar, 'this.options.openComposite(defaultCompositeId, true)'],
			[compositeBar, 'this.options.openComposite(visibleComposite)'],
		] as const;
		assert.strictEqual(calls.length, 8);
		for (const [source, call] of calls) {
			assertDoubleThen(source, call);
		}
	});

	test('menubar leftover alwaysUnderlineAccessKeys then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(MENUBAR_REL), 'utf8');
		const accessibility = fs.readFileSync(resolveSource(ACCESSIBILITY_REL), 'utf8');
		assertPromiseSignature(accessibility, 'alwaysUnderlineAccessKeys(): Promise<boolean>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, `this.accessibilityService.alwaysUnderlineAccessKeys().then(val => {
				this.alwaysOnMnemonics = val;
				this.menubar?.update(this.getMenuBarOptions());
			})`);
	});

	test('paneCompositePart leftover openPaneComposite fire-and-forget and then are Promise double-chain; sync CompositePart.openComposite stays skipped', () => {
		const source = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const compositePart = fs.readFileSync(resolveSource(COMPOSITE_PART_REL), 'utf8');
		assertPromiseSignature(source, 'openPaneComposite(id: string | undefined, focus?: boolean): Promise<IPaneComposite | undefined>;');
		assertPromiseSignature(source, 'async openPaneComposite(id?: string, focus?: boolean): Promise<PaneComposite | undefined> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.openPaneComposite(currentContainer.id, true)');
		assertDoubleThen(source, `this.openPaneComposite(newContainer.id, true).then(composite => {
									composite?.openView(viewToMove.id, true);
								})`);
		assert.ok(source.includes('const result = this.openComposite(id, focus) as PaneComposite | undefined;'));
		assert.ok(!source.includes('this.openComposite(id, focus).catch'));
		assert.ok(compositePart.includes('protected openComposite(id: string, focus?: boolean): Composite | undefined {'));
		assert.ok(!compositePart.includes('protected openComposite(id: string, focus?: boolean): Promise'));
	});

	test('paneCompositeBar leftover openPaneComposite fire-and-forget is Promise double-chain; await stays skipped', () => {
		const source = fs.readFileSync(resolveSource(PANE_BAR_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		assertPromiseSignature(panePart, 'openPaneComposite(id: string | undefined, focus?: boolean): Promise<IPaneComposite | undefined>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, `case 'focus':
						this.paneCompositePart.openPaneComposite(this.compositeBarActionItem.id, focus)`);
		assert.ok(source.includes('await this.paneCompositePart.openPaneComposite(this.compositeBarActionItem.id, focus);'));
		assert.ok(!source.includes('await this.paneCompositePart.openPaneComposite(this.compositeBarActionItem.id, focus).catch'));
	});

	test('compositeBar leftover openComposite fire-and-forget and then are Promise double-chain; await stays skipped', () => {
		const source = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');
		assertPromiseSignature(source, 'private openComposite: (id: string, focus?: boolean) => Promise<IPaneComposite | null>,');
		assertPromiseSignature(source, 'readonly openComposite: (compositeId: string, preserveFocus?: boolean) => Promise<IComposite | null>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.openComposite(currentContainer.id, true)');
		assertDoubleThen(source, `this.openComposite(newContainer.id, true).then(composite => {
					composite?.openView(viewToMove.id, true);
				})`);
		assertDoubleThen(source, 'this.options.openComposite(defaultCompositeId, true)');
		assertDoubleThen(source, 'this.options.openComposite(visibleComposite)');
		assert.ok(source.includes('await this.options.openComposite(compositeId);'));
		assert.ok(!source.includes('await this.options.openComposite(compositeId).catch'));
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty / D697 chrome / D706 parts stay skipped; D722 handleWarnings is chained', () => {
		const nativeWindow = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const browserWindow = fs.readFileSync(resolveSource(BROWSER_WINDOW_REL), 'utf8');
		const contributions = fs.readFileSync(resolveSource(CONTRIBUTIONS_REL), 'utf8');
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const toasts = fs.readFileSync(resolveSource(TOASTS_REL), 'utf8');
		const editorParts = fs.readFileSync(resolveSource(EDITOR_PARTS_REL), 'utf8');
		const contextkeys = fs.readFileSync(resolveSource(CONTEXTKEYS_REL), 'utf8');
		const globalBar = fs.readFileSync(resolveSource(GLOBAL_BAR_REL), 'utf8');
		const viewPane = fs.readFileSync(resolveSource(VIEW_PANE_REL), 'utf8');
		const paneBar = fs.readFileSync(resolveSource(PANE_BAR_REL), 'utf8');
		const treeView = fs.readFileSync(resolveSource(TREE_VIEW_REL), 'utf8');
		const editorStatus = fs.readFileSync(resolveSource(EDITOR_STATUS_REL), 'utf8');
		const breadcrumbs = fs.readFileSync(resolveSource(BREADCRUMBS_REL), 'utf8');
		const listCommands = fs.readFileSync(resolveSource(LIST_COMMANDS_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const compositeBar = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');

		assert.ok(nativeWindow.includes('this.handleWarnings().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(!nativeWindow.includes('this.handleWarnings();'));
		assert.ok(nativeWindow.includes('private async handleWarnings(): Promise<void> {'));
		assert.ok(nativeWindow.includes('this.setupOpenHandlers();'));
		assert.ok(nativeWindow.includes('this.openerService.open('));
		assert.ok(!/this\.openerService\.open\([^)]*\)\.catch\(onUnexpectedError\)/.test(nativeWindow));

		assert.ok(browserWindow.includes('this.setupOpenHandlers();'));
		assert.ok(browserWindow.includes(')).then(async () => {'));
		assert.ok(!browserWindow.includes('onUnexpectedError'));

		assert.ok(contributions.includes('lifecycleService.when(phase).then(() => this.doInstantiateByPhase(instantiationService, logService, environmentService, phase));'));
		assert.ok(!contributions.includes('lifecycleService.when(phase).then(() => this.doInstantiateByPhase(instantiationService, logService, environmentService, phase)).catch'));

		assert.ok(editorParts.includes('void editorPart.activeGroup.openEditor(defaultInput);'));
		assert.ok(!editorParts.includes('void editorPart.activeGroup.openEditor(defaultInput).catch'));

		assert.ok(breadcrumbs.includes('}).catch(err => {'));
		assert.ok(breadcrumbs.includes('onUnexpectedError(err);'));
		assert.ok(!breadcrumbs.includes(`${doubleCatch}`));

		const expandThen = `widget.expand(focus).then(didExpand => {
				if (focus && !didExpand) {
					const child = widget.getFirstElementChild(focus);

					if (child) {
						const node = widget.getNode(child);

						if (node.visible) {
							navigate(widget, widget => {
								const fakeKeyboardEvent = new KeyboardEvent('keydown');
								widget.setFocus([child], fakeKeyboardEvent);
							});
						}
					}
				}
			})`;
		assert.ok(listCommands.includes(`${expandThen};`));
		assert.ok(!listCommands.includes(`${expandThen}${doubleCatch}`));
		assert.ok(!listCommands.includes(`${expandThen}.catch(onUnexpectedError)`));

		assert.ok(toasts.includes(`this.lifecycleService.when(LifecyclePhase.Restored).then(() => {

			// Show toast for initial notifications if any
			this.model.notifications.forEach(notification => this.addToast(notification));

			// Update toasts on notification changes
			this._register(this.model.onDidChangeNotification(e => this.onDidChangeNotification(e)));
		})${doubleCatch};`));
		assert.ok(editorParts.includes(`this.whenReady.then(() => this.registerGroupsContextKeyListeners())${doubleCatch};`));
		assert.ok(contextkeys.includes(`this.editorGroupService.whenReady.then(() => {
			this.updateEditorAreaContextKeys();
			this.updateActiveEditorGroupContextKeys();
			this.updateVisiblePanesContextKeys();
		})${doubleCatch};`));
		assert.ok(layout.includes(`window.whenStylesHaveLoaded.then(() => this.containerStylesLoaded.delete(windowId))${doubleCatch};`));
		assert.ok(globalBar.includes(`${doubleCatch}`));
		assert.ok(viewPane.includes(`${doubleCatch}`));
		assert.ok(paneBar.includes(`${doubleCatch}`));
		assert.ok(treeView.includes(`this.tree.setInput(this.root).then(() => this.updateContentAreas())${doubleCatch};`));
		assert.ok(editorStatus.includes(`${doubleCatch}`));

		for (const source of [layout, panePart, compositeBar, nativeWindow, browserWindow]) {
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
