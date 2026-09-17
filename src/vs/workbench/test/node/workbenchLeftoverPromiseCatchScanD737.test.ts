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
const EDITOR_CONFIG_REL = 'src/vs/workbench/browser/parts/editor/editorConfiguration.ts';
const MODAL_REL = 'src/vs/workbench/browser/parts/editor/modalEditorPart.ts';
const EDITOR_PANES_REL = 'src/vs/workbench/browser/parts/editor/editorPanes.ts';
const EDITOR_DROP_REL = 'src/vs/workbench/browser/parts/editor/editorDropTarget.ts';
const NATIVE_MENUBAR_REL = 'src/vs/workbench/electron-browser/parts/titlebar/menubarControl.ts';
const TREE_VIEW_REL = 'src/vs/workbench/browser/parts/views/treeView.ts';
const LIST_COMMANDS_REL = 'src/vs/workbench/browser/actions/listCommands.ts';
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const EDITOR_VIEW_REL = 'src/vs/workbench/browser/parts/editor/editor.ts';
const EDITOR_SERVICE_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const WORKSPACES_REL = 'src/vs/platform/workspaces/common/workspaces.ts';
const PROGRESS_REL = 'src/vs/platform/progress/common/progress.ts';
const ASYNC_TREE_REL = 'src/vs/base/browser/ui/tree/asyncDataTree.ts';
const BREADCRUMBS_REL = 'src/vs/workbench/browser/parts/editor/breadcrumbsModel.ts';
const EDITOR_PARTS_REL = 'src/vs/workbench/browser/parts/editor/editorParts.ts';
const WEB_FACTORY_REL = 'src/vs/workbench/browser/web.factory.ts';
const WINDOW_REL = 'src/vs/workbench/electron-browser/window.ts';
const BROWSER_WINDOW_REL = 'src/vs/workbench/browser/window.ts';
const CONTRIBUTIONS_REL = 'src/vs/workbench/common/contributions.ts';
const TABS_REL = 'src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts';
const GROUP_VIEW_REL = 'src/vs/workbench/browser/parts/editor/editorGroupView.ts';

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

const configIife = `(async () => {
			await extensionService.whenInstalledExtensionsRegistered();

			this.updateDynamicEditorConfigurations();
			this.registerListeners();
		})()`;
const modalClose = 'void editorPart.close()';
const trustOpen = 'this.groupView.openEditor(editor, options)';
const dropOpenEditors = 'this.editorService.openEditors(editors, ensureTargetGroup(), { validateTrust: true })';
const nativeMenubarIife = `(async () => {
			this.recentlyOpened = await this.workspacesService.getRecentlyOpened();

			this.doUpdateMenubar();
		})()`;
const treeProgressThen = `this.progressService.withProgress({ location: this.id }, () => this.extensionService.activateByEvent(\`onView:\${this.id}\`))
				.then(() => timeout(2000))
				.then(() => {
					this.updateMessage();
				})`;
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

suite('workbench leftover Promise fire-and-forget catch scan (D737)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers seven leftover Promise double-chain sites', () => {
		const editorConfig = fs.readFileSync(resolveSource(EDITOR_CONFIG_REL), 'utf8');
		const modal = fs.readFileSync(resolveSource(MODAL_REL), 'utf8');
		const editorPanes = fs.readFileSync(resolveSource(EDITOR_PANES_REL), 'utf8');
		const editorDrop = fs.readFileSync(resolveSource(EDITOR_DROP_REL), 'utf8');
		const nativeMenubar = fs.readFileSync(resolveSource(NATIVE_MENUBAR_REL), 'utf8');
		const treeView = fs.readFileSync(resolveSource(TREE_VIEW_REL), 'utf8');
		const listCommands = fs.readFileSync(resolveSource(LIST_COMMANDS_REL), 'utf8');
		const calls = [
			[editorConfig, configIife],
			[modal, modalClose],
			[editorPanes, trustOpen],
			[editorDrop, dropOpenEditors],
			[nativeMenubar, nativeMenubarIife],
			[treeView, treeProgressThen],
			[listCommands, expandThen],
		] as const;
		assert.strictEqual(calls.length, 7);
		for (const [source, call] of calls) {
			assertDoubleThen(source, call);
		}
	});

	test('editorConfiguration leftover ctor IIFE is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(EDITOR_CONFIG_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, configIife);
	});

	test('modalEditorPart leftover void close is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(MODAL_REL), 'utf8');
		assertPromiseSignature(source, 'async close(options?: { mergeAllEditorsToMainPart?: boolean }): Promise<boolean> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, modalClose);
	});

	test('editorPanes leftover trust openEditor is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(EDITOR_PANES_REL), 'utf8');
		const editorView = fs.readFileSync(resolveSource(EDITOR_VIEW_REL), 'utf8');
		assertPromiseSignature(editorView, 'openEditor(editor: EditorInput, options?: IEditorOptions, internalOptions?: IInternalEditorOpenOptions): Promise<IEditorPane | undefined>;');
		assert.ok(source.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, trustOpen);
	});

	test('editorDropTarget leftover openEditors is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(EDITOR_DROP_REL), 'utf8');
		const editorService = fs.readFileSync(resolveSource(EDITOR_SERVICE_REL), 'utf8');
		assertPromiseSignature(editorService, 'openEditors(editors: IUntypedEditorInput[], group?: PreferredGroup, options?: IOpenEditorsOptions): Promise<readonly IEditorPane[]>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, dropOpenEditors);
	});

	test('electron-browser menubar leftover recentlyOpened IIFE is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(NATIVE_MENUBAR_REL), 'utf8');
		const workspaces = fs.readFileSync(resolveSource(WORKSPACES_REL), 'utf8');
		assertPromiseSignature(workspaces, 'getRecentlyOpened(): Promise<IRecentlyOpened>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, nativeMenubarIife);
	});

	test('treeView leftover withProgress then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(TREE_VIEW_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(progress, `withProgress<R>(
		options: IProgressOptions | IProgressDialogOptions | IProgressNotificationOptions | IProgressWindowOptions | IProgressCompositeOptions,
		task: (progress: IProgress<IProgressStep>) => Promise<R>,
		onDidCancel?: (choice?: number) => void
	): Promise<R>;`);
		assertPromiseSignature(extensions, 'activateByEvent(activationEvent: string, activationKind?: ActivationKind): Promise<void>;');
		assert.ok(source.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, treeProgressThen);
	});

	test('listCommands leftover AsyncDataTree expand then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(LIST_COMMANDS_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(ASYNC_TREE_REL), 'utf8');
		assertPromiseSignature(tree, 'async expand(element: T, recursive: boolean = false): Promise<boolean> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, expandThen);
	});

	test('opener / D145 / custom-catch breadcrumbs / editorParts void / web.factory / already-double D697/D706/D714/D722/D731 stay skipped', () => {
		const breadcrumbs = fs.readFileSync(resolveSource(BREADCRUMBS_REL), 'utf8');
		const editorParts = fs.readFileSync(resolveSource(EDITOR_PARTS_REL), 'utf8');
		const webFactory = fs.readFileSync(resolveSource(WEB_FACTORY_REL), 'utf8');
		const nativeWindow = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const browserWindow = fs.readFileSync(resolveSource(BROWSER_WINDOW_REL), 'utf8');
		const contributions = fs.readFileSync(resolveSource(CONTRIBUTIONS_REL), 'utf8');
		const tabs = fs.readFileSync(resolveSource(TABS_REL), 'utf8');
		const groupView = fs.readFileSync(resolveSource(GROUP_VIEW_REL), 'utf8');

		assert.ok(breadcrumbs.includes('}).catch(err => {'));
		assert.ok(breadcrumbs.includes('onUnexpectedError(err);'));
		assert.ok(!breadcrumbs.includes(`${doubleCatch}`));

		assert.ok(editorParts.includes('void editorPart.activeGroup.openEditor(defaultInput);'));
		assert.ok(!editorParts.includes('void editorPart.activeGroup.openEditor(defaultInput).catch'));

		assert.ok(webFactory.includes('new BrowserMain(domElement, options).open().then(workbench => {'));
		assert.ok(!webFactory.includes('onUnexpectedError'));

		assert.ok(nativeWindow.includes('this.setupOpenHandlers();'));
		assert.ok(nativeWindow.includes('this.openerService.open('));
		assert.ok(!/this\.openerService\.open\([^)]*\)\.catch\(onUnexpectedError\)/.test(nativeWindow));
		assert.ok(nativeWindow.includes('this.handleWarnings().catch(onUnexpectedError).catch(onUnexpectedError);'));

		assert.ok(browserWindow.includes('this.setupOpenHandlers();'));
		assert.ok(browserWindow.includes(')).then(async () => {'));
		assert.ok(!browserWindow.includes('onUnexpectedError'));

		assert.ok(contributions.includes('lifecycleService.when(phase).then(() => this.doInstantiateByPhase(instantiationService, logService, environmentService, phase));'));
		assert.ok(!contributions.includes('lifecycleService.when(phase).then(() => this.doInstantiateByPhase(instantiationService, logService, environmentService, phase)).catch'));

		assert.ok(tabs.includes('this.groupView.openEditor(nextEditor).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(groupView.includes('}, this.id).catch(onUnexpectedError).catch(onUnexpectedError);'));

		const assignedThen = `const result = this.doShowEditor(activeEditor, { active: true, isNew: false /* restored */ }, options, internalOptions).then(() => {`;
		assert.ok(groupView.includes(assignedThen));
		assert.ok(!groupView.includes(`${assignedThen}${doubleCatch}`));

		for (const source of [nativeWindow, browserWindow, tabs, groupView]) {
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
