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
const ASYNC_TREE_REL = 'src/vs/base/browser/ui/tree/asyncDataTree.ts';
const CODE_EDITOR_REL = 'src/vs/editor/browser/services/codeEditorService.ts';
const EDITOR_SVC_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/callHierarchy/browser/callHierarchy.contribution.ts';
const PEEK_REL = 'src/vs/workbench/contrib/callHierarchy/browser/callHierarchyPeek.ts';
const TREE_REL = 'src/vs/workbench/contrib/callHierarchy/browser/callHierarchyTree.ts';
const MODEL_REL = 'src/vs/workbench/contrib/callHierarchy/common/callHierarchy.ts';
const TYPE_CONTRIB_REL = 'src/vs/workbench/contrib/typeHierarchy/browser/typeHierarchy.contribution.ts';
const TYPE_PEEK_REL = 'src/vs/workbench/contrib/typeHierarchy/browser/typeHierarchyPeek.ts';
const KEYBINDINGS_EXPORT_REL = 'src/vs/workbench/contrib/keybindingsExport/electron-browser/keybindingsExport.contribution.ts';
const INLAY_HINTS_REL = 'src/vs/workbench/contrib/inlayHints/browser/inlayHintsAccessibilty.ts';
const LANGUAGE_STATUS_REL = 'src/vs/workbench/contrib/languageStatus/browser/languageStatus.ts';
const FOLDING_REL = 'src/vs/workbench/contrib/folding/browser/folding.contribution.ts';
const TIMELINE_REL = 'src/vs/workbench/contrib/timeline/browser/timelinePane.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/browserHostService.ts';
const WALKTHROUGH_REL = 'src/vs/workbench/contrib/welcomeWalkthrough/browser/walkThroughInput.ts';
const BULK_PANE_REL = 'src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPane.ts';

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

const showModelCall = 'this._widget!.showModel(model)';
const outgoingDirectionCall = 'this._widget?.updateDirection(CallHierarchyDirection.CallsFrom)?';
const incomingDirectionCall = 'this._widget?.updateDirection(CallHierarchyDirection.CallsTo)?';
const updatePreviewCall = 'this._updatePreview()';
const mouseDownOpenCall = `this._editorService.openEditor({
				resource: focus.item.uri,
				options: { selection: target.range! }
			})`;
const dblClickOpenCall = `this._editorService.openEditor({
					resource: e.element.item.uri,
					options: { selection: e.element.item.selectionRange, pinned: true }
				})`;
const selectionOpenCall = `this._editorService.openEditor({
					resource: element.item.uri,
					options: { selection: element.item.selectionRange, pinned: true }
				})`;

const d812Calls: Array<[string, string, number]> = [
	[CONTRIB_REL, showModelCall, 1],
	[CONTRIB_REL, outgoingDirectionCall, 1],
	[CONTRIB_REL, incomingDirectionCall, 1],
	[PEEK_REL, updatePreviewCall, 1],
	[PEEK_REL, mouseDownOpenCall, 1],
	[PEEK_REL, dblClickOpenCall, 1],
	[PEEK_REL, selectionOpenCall, 1],
];

suite('callHierarchy leftover Promise fire-and-forget catch scan (D812)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers seven leftover Promise double-chain sites in contrib/callHierarchy and did not overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d812Calls) {
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
		const contrib = seen.get(CONTRIB_REL) ?? fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const peek = seen.get(PEEK_REL) ?? fs.readFileSync(resolveSource(PEEK_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(TREE_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		assert.strictEqual(countDoubleChains(contrib), 3);
		assert.strictEqual(countDoubleChains(peek), 4);
		assert.strictEqual(countDoubleChains(tree), 0);
		assert.strictEqual(countDoubleChains(model), 0);
		assert.ok(!fs.readFileSync(resolveSource(KEYBINDINGS_EXPORT_REL), 'utf8').includes(doubleCatch));
		assert.ok(!fs.readFileSync(resolveSource(INLAY_HINTS_REL), 'utf8').includes(doubleCatch));
		assert.ok(!fs.readFileSync(resolveSource(LANGUAGE_STATUS_REL), 'utf8').includes(doubleCatch));
		assert.ok(!fs.readFileSync(resolveSource(FOLDING_REL), 'utf8').includes(doubleCatch));
	});

	test('callHierarchy leftover showModel / updateDirection are Promise double-chain; model.then custom catch stays skipped', () => {
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const peek = fs.readFileSync(resolveSource(PEEK_REL), 'utf8');
		assertPromiseSignature(peek, 'async showModel(model: CallHierarchyModel): Promise<void> {');
		assertPromiseSignature(peek, 'async updateDirection(newDirection: CallHierarchyDirection): Promise<void> {');
		assert.ok(contrib.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(contrib, showModelCall);
		assertWrapped(contrib, outgoingDirectionCall);
		assertWrapped(contrib, incomingDirectionCall);
		assert.ok(!contrib.includes('\t\t\t\tthis._widget!.showModel(model);\n'));
		assert.ok(!contrib.includes('\t\tthis._widget?.updateDirection(CallHierarchyDirection.CallsFrom);\n'));
		assert.ok(!contrib.includes('\t\tthis._widget?.updateDirection(CallHierarchyDirection.CallsTo);\n'));
		assert.ok(contrib.includes('model.then(model => {'));
		assert.ok(contrib.includes('}).catch(err => {'));
		assert.ok(contrib.includes('this._widget!.showMessage(localize(\'error\', "Failed to show call hierarchy"));'));
		assert.ok(!contrib.includes(`model.then(model => {${doubleCatch}`));
		assert.ok(!contrib.includes(`}).catch(err => {${doubleCatch}`));
	});

	test('callHierarchy leftover _updatePreview / discarded openEditor are Promise double-chain; await setInput/expand/showModel stay skipped', () => {
		const peek = fs.readFileSync(resolveSource(PEEK_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		const asyncTree = fs.readFileSync(resolveSource(ASYNC_TREE_REL), 'utf8');
		assertPromiseSignature(peek, 'private async _updatePreview() {');
		assertPromiseSignature(editor, 'openEditor(editor: IUntypedEditorInput, group?: PreferredGroup): Promise<IEditorPane | undefined>;');
		assertPromiseSignature(asyncTree, 'async setInput(input: TInput, viewState?: IAsyncDataTreeViewState): Promise<void> {');
		assertPromiseSignature(asyncTree, 'async expand(element: T, recursive: boolean = false): Promise<boolean> {');
		assert.ok(peek.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(peek, updatePreviewCall);
		assertWrapped(peek, mouseDownOpenCall);
		assertWrapped(peek, dblClickOpenCall);
		assertWrapped(peek, selectionOpenCall);
		assert.ok(!peek.includes('\t\t\tthis._updatePreview();\n'));
		assert.ok(peek.includes('await this._tree.setInput(model, viewState);'));
		assert.ok(!peek.includes(`await this._tree.setInput(model, viewState)${doubleCatch}`));
		assert.ok(peek.includes('await this._tree.expand(root.element);'));
		assert.ok(!peek.includes(`await this._tree.expand(root.element)${doubleCatch}`));
		assert.ok(peek.includes('await this.showModel(model);'));
		assert.ok(!peek.includes(`await this.showModel(model)${doubleCatch}`));
		assert.ok(peek.includes('const value = await this._textModelService.createModelReference(previewUri);'));
		assert.ok(!peek.includes(`await this._textModelService.createModelReference(previewUri)${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const peek = fs.readFileSync(resolveSource(PEEK_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(TREE_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const codeEditor = fs.readFileSync(resolveSource(CODE_EDITOR_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(codeEditor, 'openCodeEditor(input: ITextResourceEditorInput, source: ICodeEditor | null, sideBySide?: boolean): Promise<ICodeEditor | null>;');
		assertPromiseSignature(contrib, 'async startCallHierarchyFromEditor(): Promise<void> {');
		assertPromiseSignature(contrib, 'async startCallHierarchyFromCallHierarchy(): Promise<void> {');

		assert.ok(!contrib.includes('openerService.open'));
		assert.ok(!peek.includes('openerService.open'));
		assert.ok(contrib.includes('return CallHierarchyController.get(editor)?.startCallHierarchyFromEditor();'));
		assert.ok(!contrib.includes(`return CallHierarchyController.get(editor)?.startCallHierarchyFromEditor()${doubleCatch}`));
		assert.ok(contrib.includes('return CallHierarchyController.get(editor)?.startCallHierarchyFromCallHierarchy();'));
		assert.ok(!contrib.includes(`return CallHierarchyController.get(editor)?.startCallHierarchyFromCallHierarchy()${doubleCatch}`));
		assert.ok(contrib.includes('return CallHierarchyController.get(editor)?.showIncomingCalls();'));
		assert.ok(!contrib.includes(`return CallHierarchyController.get(editor)?.showIncomingCalls()${doubleCatch}`));
		assert.ok(contrib.includes('return CallHierarchyController.get(editor)?.showOutgoingCalls();'));
		assert.ok(!contrib.includes(`return CallHierarchyController.get(editor)?.showOutgoingCalls()${doubleCatch}`));
		assert.ok(contrib.includes('const newEditor = await this._editorService.openCodeEditor({ resource: call.item.uri }, this._editor);'));
		assert.ok(!contrib.includes(`await this._editorService.openCodeEditor({ resource: call.item.uri }, this._editor)${doubleCatch}`));
		assert.ok(contrib.includes('Promise.resolve(newModel),'));
		assert.ok(!contrib.includes(`Promise.resolve(newModel)${doubleCatch}`));
		assert.ok(peek.includes('this._tree.onDidChangeFocus(this._updatePreview, this)'));
		assert.ok(!peek.includes(`this._tree.onDidChangeFocus(this._updatePreview, this)${doubleCatch}`));
		assert.ok(model.includes('const session = await provider.prepareCallHierarchy(model, position, token);'));
		assert.ok(!model.includes(doubleCatch));
		assert.ok(!tree.includes(doubleCatch));
		assert.ok(!contrib.includes('.then(undefined,'));
		assert.ok(!peek.includes('.then(undefined,'));

		for (const source of [contrib, peek, tree, model]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
		}
	});

	test('callHierarchy had four-plus legal leftover sites so this knife did not overflow into keybindingsExport/inlayHints/languageStatus/folding or re-edit typeHierarchy remaining leftover', () => {
		const typeContrib = fs.readFileSync(resolveSource(TYPE_CONTRIB_REL), 'utf8');
		const typePeek = fs.readFileSync(resolveSource(TYPE_PEEK_REL), 'utf8');
		const keybindingsExport = fs.readFileSync(resolveSource(KEYBINDINGS_EXPORT_REL), 'utf8');
		const inlayHints = fs.readFileSync(resolveSource(INLAY_HINTS_REL), 'utf8');
		const languageStatus = fs.readFileSync(resolveSource(LANGUAGE_STATUS_REL), 'utf8');
		const folding = fs.readFileSync(resolveSource(FOLDING_REL), 'utf8');
		const timeline = fs.readFileSync(resolveSource(TIMELINE_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const walkthrough = fs.readFileSync(resolveSource(WALKTHROUGH_REL), 'utf8');
		const bulkPane = fs.readFileSync(resolveSource(BULK_PANE_REL), 'utf8');

		assert.ok(typeContrib.includes('model.then(model => {'));
		assert.ok(typeContrib.includes('}).catch(err => {'));
		assert.ok(!typeContrib.includes(`model.then(model => {${doubleCatch}`));
		assert.ok(!typeContrib.includes(`}).catch(err => {${doubleCatch}`));
		assert.ok(typePeek.includes('this._tree.onDidChangeFocus(this._updatePreview, this)'));
		assert.ok(!typePeek.includes(`this._tree.onDidChangeFocus(this._updatePreview, this)${doubleCatch}`));
		assert.ok(keybindingsExport.includes('.catch(async error => {'));
		assert.ok(inlayHints.includes('\t\t\tthis._read(line, hints);\n'));
		assert.ok(!languageStatus.includes(doubleCatch));
		assert.ok(folding.includes('\t\tthis._updateConfigValues();\n'));
		assert.ok(!folding.includes(`this._updateConfigValues()${doubleCatch}`));
		assert.ok(!typeContrib.includes('D812'));
		assert.ok(!typePeek.includes('D812'));
		assert.ok(!timeline.includes('D812'));
		assert.ok(host.includes(doubleCatch));
		assert.ok(walkthrough.includes(doubleCatch));
		assert.ok(bulkPane.includes(doubleCatch));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/keybindingsExport/test/node/keybindingsExportLeftoverPromiseCatchScanD812.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/inlayHints/test/node/inlayHintsLeftoverPromiseCatchScanD812.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/typeHierarchy/test/node/typeHierarchyLeftoverPromiseCatchScanD812.test.ts')));
	});
});
