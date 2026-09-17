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
const TABS_REL = 'src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts';
const GROUP_VIEW_REL = 'src/vs/workbench/browser/parts/editor/editorGroupView.ts';
const EDITOR_VIEW_REL = 'src/vs/workbench/browser/parts/editor/editor.ts';
const EDITOR_SERVICE_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const PATH_SERVICE_REL = 'src/vs/workbench/services/path/common/pathService.ts';
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const WINDOW_REL = 'src/vs/workbench/electron-browser/window.ts';
const BROWSER_WINDOW_REL = 'src/vs/workbench/browser/window.ts';
const CONTRIBUTIONS_REL = 'src/vs/workbench/common/contributions.ts';
const LAYOUT_REL = 'src/vs/workbench/browser/layout.ts';
const LIST_COMMANDS_REL = 'src/vs/workbench/browser/actions/listCommands.ts';
const WEB_FACTORY_REL = 'src/vs/workbench/browser/web.factory.ts';
const TREE_VIEW_REL = 'src/vs/workbench/browser/parts/views/treeView.ts';
const BREADCRUMBS_REL = 'src/vs/workbench/browser/parts/editor/breadcrumbsModel.ts';
const EDITOR_PARTS_REL = 'src/vs/workbench/browser/parts/editor/editorParts.ts';
const EDITOR_CONFIG_REL = 'src/vs/workbench/browser/parts/editor/editorConfiguration.ts';
const MODAL_REL = 'src/vs/workbench/browser/parts/editor/modalEditorPart.ts';
const PANE_PART_REL = 'src/vs/workbench/browser/parts/paneCompositePart.ts';
const COMPOSITE_BAR_REL = 'src/vs/workbench/browser/parts/compositeBar.ts';

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

const pathIife = '(async () => this.path = await this.pathService.path)()';
const tabsUntitledOpen = `this.editorService.openEditor({
					resource: undefined,
					options: {
						pinned: true,
						index: this.groupView.count, // always at the end
						override: DEFAULT_EDITOR_ASSOCIATION.id
					}
				}, this.groupView.id)`;
const groupUntitledOpen = `this.editorService.openEditor({
					resource: undefined,
					options: {
						pinned: true,
						override: DEFAULT_EDITOR_ASSOCIATION.id
					}
				}, this.id)`;
const wheelOpen = 'this.groupView.openEditor(nextEditor)';
const enterOpen = 'this.groupView.openEditor(editor)';
const arrowOpen = 'this.groupView.openEditor(target, { preserveFocus: true }, { focusTabControl: true })';
const dragOpen = 'this.groupView.openEditor(draggedOverTab, { preserveFocus: true })';
const treeOpenEditors = 'this.editorService.openEditors(editors, this.groupView, { validateTrust: true })';

suite('workbench editor leftover Promise fire-and-forget catch scan (D731)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const tabs = fs.readFileSync(resolveSource(TABS_REL), 'utf8');
		const groupView = fs.readFileSync(resolveSource(GROUP_VIEW_REL), 'utf8');
		const calls = [
			[tabs, pathIife],
			[tabs, tabsUntitledOpen],
			[tabs, wheelOpen],
			[tabs, enterOpen],
			[tabs, arrowOpen],
			[tabs, dragOpen],
			[tabs, treeOpenEditors],
			[groupView, groupUntitledOpen],
		] as const;
		assert.strictEqual(calls.length, 8);
		for (const [source, call] of calls) {
			assertDoubleThen(source, call);
		}
	});

	test('multiEditorTabsControl leftover path IIFE is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(TABS_REL), 'utf8');
		const pathService = fs.readFileSync(resolveSource(PATH_SERVICE_REL), 'utf8');
		assertPromiseSignature(pathService, 'readonly path: Promise<IPath>;');
		assert.ok(source.includes("import { BugIndicatingError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, pathIife);
	});

	test('multiEditorTabsControl leftover openEditor fire-and-forget are Promise double-chain; await stays skipped', () => {
		const source = fs.readFileSync(resolveSource(TABS_REL), 'utf8');
		const editorService = fs.readFileSync(resolveSource(EDITOR_SERVICE_REL), 'utf8');
		const editorView = fs.readFileSync(resolveSource(EDITOR_VIEW_REL), 'utf8');
		assertPromiseSignature(editorService, 'openEditor(editor: IUntypedEditorInput, group?: PreferredGroup): Promise<IEditorPane | undefined>;');
		assertPromiseSignature(editorView, 'openEditor(editor: EditorInput, options?: IEditorOptions, internalOptions?: IInternalEditorOpenOptions): Promise<IEditorPane | undefined>;');
		assert.ok(source.includes("import { BugIndicatingError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, tabsUntitledOpen);
		assertDoubleThen(source, wheelOpen);
		assertDoubleThen(source, enterOpen);
		assertDoubleThen(source, arrowOpen);
		assertDoubleThen(source, dragOpen);
		assert.ok(source.includes('await this.groupView.openEditor(editor, { preserveFocus, activation: EditorActivation.ACTIVATE }, { inactiveSelection, focusTabControl: true });'));
		assert.ok(!source.includes('await this.groupView.openEditor(editor, { preserveFocus, activation: EditorActivation.ACTIVATE }, { inactiveSelection, focusTabControl: true }).catch'));
	});

	test('multiEditorTabsControl leftover openEditors fire-and-forget is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(TABS_REL), 'utf8');
		const editorService = fs.readFileSync(resolveSource(EDITOR_SERVICE_REL), 'utf8');
		assertPromiseSignature(editorService, 'openEditors(editors: IUntypedEditorInput[], group?: PreferredGroup, options?: IOpenEditorsOptions): Promise<readonly IEditorPane[]>;');
		assertDoubleThen(source, treeOpenEditors);
	});

	test('editorGroupView leftover empty-container openEditor is Promise double-chain; assigned then stays skipped', () => {
		const source = fs.readFileSync(resolveSource(GROUP_VIEW_REL), 'utf8');
		const editorService = fs.readFileSync(resolveSource(EDITOR_SERVICE_REL), 'utf8');
		assertPromiseSignature(editorService, 'openEditor(editor: IUntypedEditorInput, group?: PreferredGroup): Promise<IEditorPane | undefined>;');
		assertPromiseSignature(source, 'async openEditor(editor: EditorInput, options?: IEditorOptions, internalOptions?: IInternalEditorOpenOptions): Promise<IEditorPane | undefined> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, groupUntitledOpen);
		const assignedThen = `const result = this.doShowEditor(activeEditor, { active: true, isNew: false /* restored */ }, options, internalOptions).then(() => {`;
		assert.ok(source.includes(assignedThen));
		assert.ok(!source.includes(`${assignedThen}${doubleCatch}`));
		const returnedThen = `return this.handleCloseConfirmation(editors).then(veto => {
			if (veto) {
				return false;
			}

			this.doCloseAllEditors(options);
			return true;
		})`;
		assert.ok(source.includes(`${returnedThen};`));
		assert.ok(!source.includes(`${returnedThen}${doubleCatch}`));
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty / D697 / D706 / D714 / D722 stay skipped', () => {
		const tabs = fs.readFileSync(resolveSource(TABS_REL), 'utf8');
		const groupView = fs.readFileSync(resolveSource(GROUP_VIEW_REL), 'utf8');
		const nativeWindow = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const browserWindow = fs.readFileSync(resolveSource(BROWSER_WINDOW_REL), 'utf8');
		const contributions = fs.readFileSync(resolveSource(CONTRIBUTIONS_REL), 'utf8');
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const listCommands = fs.readFileSync(resolveSource(LIST_COMMANDS_REL), 'utf8');
		const webFactory = fs.readFileSync(resolveSource(WEB_FACTORY_REL), 'utf8');
		const treeView = fs.readFileSync(resolveSource(TREE_VIEW_REL), 'utf8');
		const breadcrumbs = fs.readFileSync(resolveSource(BREADCRUMBS_REL), 'utf8');
		const editorParts = fs.readFileSync(resolveSource(EDITOR_PARTS_REL), 'utf8');
		const editorConfig = fs.readFileSync(resolveSource(EDITOR_CONFIG_REL), 'utf8');
		const modal = fs.readFileSync(resolveSource(MODAL_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const compositeBar = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');

		assert.ok(nativeWindow.includes('this.handleWarnings().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(!nativeWindow.includes('this.handleWarnings();'));
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

		assert.ok(editorConfig.includes(`(async () => {
			await extensionService.whenInstalledExtensionsRegistered();

			this.updateDynamicEditorConfigurations();
			this.registerListeners();
		})();`));
		assert.ok(!editorConfig.includes(`(async () => {
			await extensionService.whenInstalledExtensionsRegistered();

			this.updateDynamicEditorConfigurations();
			this.registerListeners();
		})()${doubleCatch}`));

		assert.ok(modal.includes('void editorPart.close();'));
		assert.ok(!modal.includes('void editorPart.close().catch'));

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

		assert.ok(webFactory.includes('new BrowserMain(domElement, options).open().then(workbench => {'));
		assert.ok(!webFactory.includes('onUnexpectedError'));

		assert.ok(treeView.includes(`this.progressService.withProgress({ location: this.id }, () => this.extensionService.activateByEvent(\`onView:\${this.id}\`))
				.then(() => timeout(2000))
				.then(() => {
					this.updateMessage();
				});`));
		assert.ok(!treeView.includes(`this.progressService.withProgress({ location: this.id }, () => this.extensionService.activateByEvent(\`onView:\${this.id}\`))
				.then(() => timeout(2000))
				.then(() => {
					this.updateMessage();
				})${doubleCatch}`));

		assert.ok(panePart.includes('this.openPaneComposite(currentContainer.id, true).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(compositeBar.includes('this.openComposite(currentContainer.id, true).catch(onUnexpectedError).catch(onUnexpectedError);'));

		for (const source of [tabs, groupView, nativeWindow, browserWindow, layout]) {
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
