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
const CODE_EDITOR_REL = 'src/vs/editor/browser/services/codeEditorService.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/typeHierarchy/browser/typeHierarchy.contribution.ts';
const PEEK_REL = 'src/vs/workbench/contrib/typeHierarchy/browser/typeHierarchyPeek.ts';
const TREE_REL = 'src/vs/workbench/contrib/typeHierarchy/browser/typeHierarchyTree.ts';
const MODEL_REL = 'src/vs/workbench/contrib/typeHierarchy/common/typeHierarchy.ts';
const CALL_CONTRIB_REL = 'src/vs/workbench/contrib/callHierarchy/browser/callHierarchy.contribution.ts';
const CALL_PEEK_REL = 'src/vs/workbench/contrib/callHierarchy/browser/callHierarchyPeek.ts';
const KEYBINDINGS_EXPORT_REL = 'src/vs/workbench/contrib/keybindingsExport/electron-browser/keybindingsExport.contribution.ts';
const INLAY_HINTS_REL = 'src/vs/workbench/contrib/inlayHints/browser/inlayHintsAccessibilty.ts';
const LANGUAGE_STATUS_REL = 'src/vs/workbench/contrib/languageStatus/browser/languageStatus.ts';
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

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

suite('typeHierarchy leftover Promise fire-and-forget catch scan (D809)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
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
		assertPromiseSignature(contrib, 'async startTypeHierarchyFromEditor(): Promise<void> {');
		assertPromiseSignature(contrib, 'async startTypeHierarchyFromTypeHierarchy(): Promise<void> {');

		assert.ok(!contrib.includes('openerService.open'));
		assert.ok(!peek.includes('openerService.open'));
		assert.ok(contrib.includes('return TypeHierarchyController.get(editor)?.startTypeHierarchyFromEditor();'));
		assert.ok(!contrib.includes(`return TypeHierarchyController.get(editor)?.startTypeHierarchyFromEditor()${doubleCatch}`));
		assert.ok(contrib.includes('return TypeHierarchyController.get(editor)?.startTypeHierarchyFromTypeHierarchy();'));
		assert.ok(!contrib.includes(`return TypeHierarchyController.get(editor)?.startTypeHierarchyFromTypeHierarchy()${doubleCatch}`));
		assert.ok(contrib.includes('return TypeHierarchyController.get(editor)?.showSupertypes();'));
		assert.ok(!contrib.includes(`return TypeHierarchyController.get(editor)?.showSupertypes()${doubleCatch}`));
		assert.ok(contrib.includes('return TypeHierarchyController.get(editor)?.showSubtypes();'));
		assert.ok(!contrib.includes(`return TypeHierarchyController.get(editor)?.showSubtypes()${doubleCatch}`));
		assert.ok(contrib.includes('const newEditor = await this._editorService.openCodeEditor({ resource: typeItem.item.uri }, this._editor);'));
		assert.ok(!contrib.includes(`await this._editorService.openCodeEditor({ resource: typeItem.item.uri }, this._editor)${doubleCatch}`));
		assert.ok(contrib.includes('Promise.resolve(newModel),'));
		assert.ok(!contrib.includes(`Promise.resolve(newModel)${doubleCatch}`));
		assert.ok(peek.includes('this._tree.onDidChangeFocus(this._updatePreview, this)'));
		assert.ok(!peek.includes(`this._tree.onDidChangeFocus(this._updatePreview, this)${doubleCatch}`));
		assert.ok(model.includes('const session = await provider.prepareTypeHierarchy(model, position, token);'));
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

	test('typeHierarchy had four-plus legal leftover sites so this knife did not overflow into callHierarchy/keybindingsExport/inlayHints/languageStatus or occupied leftover modules', () => {
		const callContrib = fs.readFileSync(resolveSource(CALL_CONTRIB_REL), 'utf8');
		const callPeek = fs.readFileSync(resolveSource(CALL_PEEK_REL), 'utf8');
		const keybindingsExport = fs.readFileSync(resolveSource(KEYBINDINGS_EXPORT_REL), 'utf8');
		const inlayHints = fs.readFileSync(resolveSource(INLAY_HINTS_REL), 'utf8');
		const languageStatus = fs.readFileSync(resolveSource(LANGUAGE_STATUS_REL), 'utf8');
		const timeline = fs.readFileSync(resolveSource(TIMELINE_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const walkthrough = fs.readFileSync(resolveSource(WALKTHROUGH_REL), 'utf8');
		const bulkPane = fs.readFileSync(resolveSource(BULK_PANE_REL), 'utf8');

		assert.ok(callContrib.includes(`this._widget!.showModel(model)${doubleCatch}`));
		assert.ok(callContrib.includes(`this._widget?.updateDirection(CallHierarchyDirection.CallsFrom)?${doubleCatch}`));
		assert.ok(callContrib.includes(`this._widget?.updateDirection(CallHierarchyDirection.CallsTo)?${doubleCatch}`));
		assert.ok(callPeek.includes(`this._updatePreview()${doubleCatch}`));
		assert.ok(keybindingsExport.includes('.catch(async error => {'));
		assert.ok(inlayHints.includes('\t\t\tthis._read(line, hints);\n'));
		assert.ok(!languageStatus.includes(doubleCatch));
		assert.ok(!callContrib.includes('D809'));
		assert.ok(!timeline.includes('D809'));
		assert.ok(host.includes(doubleCatch));
		assert.ok(walkthrough.includes(doubleCatch));
		assert.ok(bulkPane.includes(doubleCatch));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/callHierarchy/test/node/callHierarchyLeftoverPromiseCatchScanD809.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/timeline/test/node/timelineLeftoverPromiseCatchScanD809.test.ts')));
	});
});
