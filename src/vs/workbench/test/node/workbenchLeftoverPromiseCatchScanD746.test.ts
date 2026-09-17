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
const EDITOR_PARTS_REL = 'src/vs/workbench/browser/parts/editor/editorParts.ts';
const PLACEHOLDER_REL = 'src/vs/workbench/browser/parts/editor/editorPlaceholder.ts';
const EDITOR_COMMANDS_REL = 'src/vs/workbench/browser/parts/editor/editorCommands.ts';
const AUX_PART_REL = 'src/vs/workbench/browser/parts/editor/auxiliaryEditorPart.ts';
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const EDITOR_VIEW_REL = 'src/vs/workbench/browser/parts/editor/editor.ts';
const GROUPS_REL = 'src/vs/workbench/services/editor/common/editorGroupsService.ts';
const EDITOR_SERVICE_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const BREADCRUMBS_REL = 'src/vs/workbench/browser/parts/editor/breadcrumbsModel.ts';
const WEB_FACTORY_REL = 'src/vs/workbench/browser/web.factory.ts';
const TREE_VIEW_REL = 'src/vs/workbench/browser/parts/views/treeView.ts';
const WINDOW_REL = 'src/vs/workbench/electron-browser/window.ts';
const BROWSER_WINDOW_REL = 'src/vs/workbench/browser/window.ts';
const CONTRIBUTIONS_REL = 'src/vs/workbench/common/contributions.ts';
const TABS_REL = 'src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts';
const GROUP_VIEW_REL = 'src/vs/workbench/browser/parts/editor/editorGroupView.ts';
const SINGLE_TABS_REL = 'src/vs/workbench/browser/parts/editor/singleEditorTabsControl.ts';
const DEVELOPER_REL = 'src/vs/workbench/browser/actions/developerActions.ts';

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
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const partsOpen = 'void editorPart.activeGroup.openEditor(defaultInput)';
const placeholderRetryOpen = 'this.group.openEditor(input, { ...options, source: EditorOpenSource.USER /* explicit user gesture */ })';
const placeholderReloadOpen = 'this.group.openEditor(input, options)';
const commandsOpen = 'editorService.openEditor(editor)';
const auxOpen = 'group.openEditor(editor)';

suite('workbench leftover Promise fire-and-forget catch scan (D746)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers five leftover Promise double-chain sites', () => {
		const editorParts = fs.readFileSync(resolveSource(EDITOR_PARTS_REL), 'utf8');
		const placeholder = fs.readFileSync(resolveSource(PLACEHOLDER_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(EDITOR_COMMANDS_REL), 'utf8');
		const aux = fs.readFileSync(resolveSource(AUX_PART_REL), 'utf8');
		const calls = [
			[editorParts, partsOpen],
			[placeholder, placeholderRetryOpen],
			[placeholder, placeholderReloadOpen],
			[commands, commandsOpen],
			[aux, auxOpen],
		] as const;
		assert.strictEqual(calls.length, 5);
		for (const [source, call] of calls) {
			assertDoubleThen(source, call);
		}
	});

	test('editorParts leftover void openEditor is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(EDITOR_PARTS_REL), 'utf8');
		const editorView = fs.readFileSync(resolveSource(EDITOR_VIEW_REL), 'utf8');
		assertPromiseSignature(editorView, 'openEditor(editor: EditorInput, options?: IEditorOptions, internalOptions?: IInternalEditorOpenOptions): Promise<IEditorPane | undefined>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, partsOpen);
	});

	test('editorPlaceholder leftover group.openEditor fire-and-forget are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(PLACEHOLDER_REL), 'utf8');
		const groups = fs.readFileSync(resolveSource(GROUPS_REL), 'utf8');
		assertPromiseSignature(groups, 'openEditor(editor: EditorInput, options?: IEditorOptions): Promise<IEditorPane | undefined>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, placeholderRetryOpen);
		assertDoubleThen(source, placeholderReloadOpen);
	});

	test('editorCommands leftover editorService.openEditor is Promise double-chain; await and returned stay skipped', () => {
		const source = fs.readFileSync(resolveSource(EDITOR_COMMANDS_REL), 'utf8');
		const editorService = fs.readFileSync(resolveSource(EDITOR_SERVICE_REL), 'utf8');
		assertPromiseSignature(editorService, 'openEditor(editor: EditorInput, options?: IEditorOptions, group?: PreferredGroup): Promise<IEditorPane | undefined>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, commandsOpen);
		assert.ok(source.includes('await editorService.openEditor(input, columnToEditorGroup(editorGroupsService, configurationService, column));'));
		assert.ok(!source.includes('await editorService.openEditor(input, columnToEditorGroup(editorGroupsService, configurationService, column)).catch'));
		assert.ok(source.includes('return activeGroup.openEditor(nextNonStickyEditorInGroup);'));
		assert.ok(!source.includes('return activeGroup.openEditor(nextNonStickyEditorInGroup).catch'));
	});

	test('auxiliaryEditorPart leftover group.openEditor is Promise double-chain; sync close stays skipped', () => {
		const source = fs.readFileSync(resolveSource(AUX_PART_REL), 'utf8');
		const groups = fs.readFileSync(resolveSource(GROUPS_REL), 'utf8');
		assertPromiseSignature(groups, 'openEditor(editor: EditorInput, options?: IEditorOptions): Promise<IEditorPane | undefined>;');
		assert.ok(source.includes('close(): boolean {'));
		assert.ok(source.includes('editorPart.close();'));
		assert.ok(!source.includes('editorPart.close().catch'));
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, auxOpen);
	});

	test('opener / D145 / custom-catch breadcrumbs / web.factory / Action2.run / treeView tooltip / already-double D697-D737 stay skipped', () => {
		const breadcrumbs = fs.readFileSync(resolveSource(BREADCRUMBS_REL), 'utf8');
		const webFactory = fs.readFileSync(resolveSource(WEB_FACTORY_REL), 'utf8');
		const treeView = fs.readFileSync(resolveSource(TREE_VIEW_REL), 'utf8');
		const nativeWindow = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const browserWindow = fs.readFileSync(resolveSource(BROWSER_WINDOW_REL), 'utf8');
		const contributions = fs.readFileSync(resolveSource(CONTRIBUTIONS_REL), 'utf8');
		const tabs = fs.readFileSync(resolveSource(TABS_REL), 'utf8');
		const groupView = fs.readFileSync(resolveSource(GROUP_VIEW_REL), 'utf8');
		const singleTabs = fs.readFileSync(resolveSource(SINGLE_TABS_REL), 'utf8');
		const developer = fs.readFileSync(resolveSource(DEVELOPER_REL), 'utf8');
		const placeholder = fs.readFileSync(resolveSource(PLACEHOLDER_REL), 'utf8');

		assert.ok(breadcrumbs.includes('}).catch(err => {'));
		assert.ok(breadcrumbs.includes('onUnexpectedError(err);'));
		assert.ok(!breadcrumbs.includes(`${doubleCatch}`));

		assert.ok(webFactory.includes('new BrowserMain(domElement, options).open().then(workbench => {'));
		assert.ok(!webFactory.includes('onUnexpectedError'));

		assert.ok(treeView.includes('node.resolve(token).then(() => resolve(node.tooltip));'));
		assert.ok(!treeView.includes('node.resolve(token).then(() => resolve(node.tooltip)).catch'));

		assert.ok(singleTabs.includes('this.groupView.closeEditor(this.tabsModel.activeEditor);'));
		assert.ok(!singleTabs.includes('this.groupView.closeEditor(this.tabsModel.activeEditor).catch'));

		assert.ok(developer.includes('editorService.openEditor({ resource: undefined, contents: leaks.details });'));
		assert.ok(!developer.includes('editorService.openEditor({ resource: undefined, contents: leaks.details }).catch'));

		assert.ok(placeholder.includes('actions[i].run();'));
		assert.ok(!placeholder.includes('actions[i].run().catch'));
		assert.ok(placeholder.includes('run: () => this.commandService.executeCommand(showWindowLogActionId)'));
		assert.ok(!placeholder.includes('this.commandService.executeCommand(showWindowLogActionId).catch'));

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
