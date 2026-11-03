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
const KERNEL_REL = 'src/vs/workbench/contrib/notebook/browser/viewParts/notebookKernelQuickPickStrategy.ts';
const BACKLAYER_REL = 'src/vs/workbench/contrib/notebook/browser/view/renderers/backLayerWebView.ts';
const MARKUP_REL = 'src/vs/workbench/contrib/notebook/browser/view/cellParts/markupCell.ts';
const CODE_REL = 'src/vs/workbench/contrib/notebook/browser/view/cellParts/codeCell.ts';
const CELLLIST_REL = 'src/vs/workbench/contrib/notebook/browser/view/notebookCellList.ts';
const EDITOR_SVC_REL = 'src/vs/workbench/contrib/notebook/browser/services/notebookEditorServiceImpl.ts';
const TOKENIZE_REL = 'src/vs/editor/common/languages/textToHtmlTokenizer.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';
const EDITOR_GROUPS_REL = 'src/vs/workbench/services/editor/common/editorGroupsService.ts';
const INDENT_REL = 'src/vs/workbench/contrib/notebook/browser/controller/notebookIndentationActions.ts';
const PRELOADS_REL = 'src/vs/workbench/contrib/notebook/browser/view/renderers/webviewPreloads.ts';
const OUTLINE_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/outline/notebookOutline.ts';
const INPUT_REL = 'src/vs/workbench/contrib/notebook/common/notebookEditorInput.ts';
const leftoverFiles = [KERNEL_REL, BACKLAYER_REL, MARKUP_REL, CODE_REL, CELLLIST_REL, EDITOR_SVC_REL];

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const singleCatch = '.catch(onUnexpectedError)';
const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async ') || signature.includes('new Promise'));
}

function countSingleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)/g) ?? []).length;
}

suite('Notebook leftover Promise fire-and-forget catch scan (D750)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise single-chain sites after D684 and zero double catches', () => {
		let sites = 0;
		for (const rel of leftoverFiles) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += countSingleChains(source);
			assert.ok(!source.includes(doubleCatch), `${rel} contains double catch`);
		}
		assert.ok(sites >= 8, `expected at least 8 D750 leftover sites, got ${sites}`);
	});

	test('kernel leftover _calculdateKernelSources then is Promise single-chain; opener leftover stays skipped', () => {
		const source = fs.readFileSync(resolveSource(KERNEL_REL), 'utf8');
		assertPromiseSignature(source, 'private async _calculdateKernelSources(editor: IActiveNotebookEditor) {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('this._calculdateKernelSources(editor).then(quickPickItems => {'));
		assert.ok(source.includes(singleCatch));
		assert.ok(!source.includes(doubleCatch));
		assert.ok(source.includes('void this._openerService.open(uri, { openExternal: true });'));
		assert.ok(!source.includes('void this._openerService.open(uri, { openExternal: true }).catch'));
	});

	test('backLayer leftover tokenizeToString then is Promise single-chain', () => {
		const source = fs.readFileSync(resolveSource(BACKLAYER_REL), 'utf8');
		const tokenize = fs.readFileSync(resolveSource(TOKENIZE_REL), 'utf8');
		assertPromiseSignature(tokenize, 'export async function tokenizeToString(languageService: ILanguageService, text: string, languageId: string | null): Promise<string> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('tokenizeToString(this.languageService, value, languageId).then((html) => {'));
		assert.ok(source.includes(singleCatch));
		assert.ok(!source.includes(doubleCatch));
	});

	test('markup/code leftover raceCancellation(resolveTextModel) thens are Promise single-chain', () => {
		const markup = fs.readFileSync(resolveSource(MARKUP_REL), 'utf8');
		const code = fs.readFileSync(resolveSource(CODE_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		assertPromiseSignature(asyncSource, 'export function raceCancellation<T>(promise: Promise<T>, token: CancellationToken): Promise<T | undefined>;');
		assert.ok(markup.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(code.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		const raceThen = /raceCancellation\(this\.viewCell\.resolveTextModel\(\), cts\.token\)\.then/g;
		assert.strictEqual((markup.match(raceThen) ?? []).length, 2);
		assert.strictEqual((code.match(raceThen) ?? []).length, 2);
		assert.ok(!markup.includes(doubleCatch));
		assert.ok(!code.includes(doubleCatch));
	});

	test('cellList leftover getEditorAttachedPromise then is Promise single-chain', () => {
		const source = fs.readFileSync(resolveSource(CELLLIST_REL), 'utf8');
		assertPromiseSignature(source, 'return new Promise<void>((resolve, reject) => {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('getEditorAttachedPromise(element).then(() => {'));
		assert.ok(source.includes(singleCatch));
		assert.ok(!source.includes(doubleCatch));
	});

	test('editor service leftover whenReady then is Promise single-chain', () => {
		const source = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		const groups = fs.readFileSync(resolveSource(EDITOR_GROUPS_REL), 'utf8');
		assertPromiseSignature(groups, 'readonly whenReady: Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('editorGroupService.whenReady.then(() => {'));
		assert.ok(source.includes('editorGroupService.groups.forEach(onNewGroup)'));
		assert.ok(source.includes(singleCatch));
		assert.ok(!source.includes(doubleCatch));
	});

	test('opener / Action2.run / two-arg / assigned then / zero double catches', () => {
		const indent = fs.readFileSync(resolveSource(INDENT_REL), 'utf8');
		const preloads = fs.readFileSync(resolveSource(PRELOADS_REL), 'utf8');
		const outline = fs.readFileSync(resolveSource(OUTLINE_REL), 'utf8');
		const input = fs.readFileSync(resolveSource(INPUT_REL), 'utf8');

		assert.ok(indent.includes('quickInputService.pick(picks, { placeHolder: nls.localize({ key: \'selectTabWidth\', comment: [\'Tab corresponds to the tab key\'] }, "Select Tab Size for Current File") }).then(pick => {'));
		assert.ok(!indent.includes(doubleCatch));
		assert.ok(indent.includes('Promise.all(notebookTextModel.cells.map(async cell => {'));
		assert.ok(preloads.includes('record.queue = record.queue.then(async r => {'));
		assert.ok(preloads.includes('this.updateContentAndRender(this._content.value, this._content.metadata).then(() => {'));
		assert.ok(preloads.includes(', () => reject());'));
		assert.ok(!preloads.includes(doubleCatch));
		assert.ok(!outline.includes(doubleCatch));
		assert.ok(!input.includes(doubleCatch));
	});
});
