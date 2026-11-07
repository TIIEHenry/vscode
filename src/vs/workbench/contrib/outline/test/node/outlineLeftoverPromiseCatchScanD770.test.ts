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
const ASYNC_REL = 'src/vs/base/common/async.ts';
const EDITOR_SVC_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const CODE_EDITOR_SVC_REL = 'src/vs/editor/browser/services/codeEditorService.ts';
const OUTLINE_PANE_REL = 'src/vs/workbench/contrib/outline/browser/outlinePane.ts';
const GOTO_ERR_REL = 'src/vs/editor/contrib/gotoError/browser/gotoError.ts';
const MARKERS_VIEW_REL = 'src/vs/workbench/contrib/markers/browser/markersView.ts';
const NOTEBOOK_OUTLINE_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/outline/notebookOutline.ts';

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

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

function countWrapped(source: string, call: string): number {
	const needle = `${call}${doubleCatch}`;
	return (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

const outlineOpenCall = `void Promise.resolve((async () => {
				const myId = ++idPool;
				const isDoubleClick = e.browserEvent?.type === 'dblclick';
				if (!isDoubleClick) {
					// workaround for https://github.com/microsoft/vscode/issues/206424
					await timeout(150);
					if (myId !== idPool) {
						return;
					}
				}
				await newOutline.reveal(e.element, e.editorOptions, e.sideBySide, isDoubleClick);
			})())`;
const navigateCall = 'void Promise.resolve(MarkerController.get(otherEditor)?.navigate(next, multiFile))';
const markersThenCall = `}, sideByside ? SIDE_GROUP : ACTIVE_GROUP).then(editor => {
				if (editor && preserveFocus) {
					this.rangeHighlightDecorations.highlightRange({ resource, range: selection }, <ICodeEditor>editor.getControl());
				} else {
					this.rangeHighlightDecorations.removeHighlightRange();
				}
			})`;
const computeSymbolsCall = 'this.computeSymbols()';
const delayedComputeCall = 'this.delayedComputeSymbols()';
const triggerComputeCall = 'this.delayerRecomputeSymbols.trigger(() => this.computeSymbols())';

const d770Calls: Array<[string, string, number]> = [
	[OUTLINE_PANE_REL, outlineOpenCall, 1],
	[GOTO_ERR_REL, navigateCall, 1],
	[MARKERS_VIEW_REL, markersThenCall, 1],
	[NOTEBOOK_OUTLINE_REL, computeSymbolsCall, 3],
	[NOTEBOOK_OUTLINE_REL, delayedComputeCall, 1],
	[NOTEBOOK_OUTLINE_REL, triggerComputeCall, 1],
];

suite('outline leftover remaining overflowed to gotoError leftover Promise fire-and-forget catch scan (D770)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eight leftover Promise double-chain sites after outline leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d770Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countWrapped(source, call);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 8);
		assert.ok(sites >= 4);
		assert.strictEqual(countDoubleChains(seen.get(OUTLINE_PANE_REL)!), 2);
		assert.strictEqual(countDoubleChains(seen.get(GOTO_ERR_REL)!), 2);
		assert.strictEqual(countDoubleChains(seen.get(MARKERS_VIEW_REL)!), 1);
		assert.strictEqual(countDoubleChains(seen.get(NOTEBOOK_OUTLINE_REL)!), 6);
	});

	test('gotoError leftover other-editor navigate PromiseLike is Promise double-chain; already-double related / awaited openCodeEditor stay skipped', () => {
		const gotoErr = fs.readFileSync(resolveSource(GOTO_ERR_REL), 'utf8');
		const editorSvc = fs.readFileSync(resolveSource(CODE_EDITOR_SVC_REL), 'utf8');
		assertPromiseSignature(editorSvc, 'openCodeEditor(input: ITextResourceEditorInput, source: ICodeEditor | null, sideBySide?: boolean): Promise<ICodeEditor | null>;');
		assertPromiseSignature(gotoErr, 'async navigate(next: boolean, multiFile: boolean) {');
		assert.ok(gotoErr.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(gotoErr, navigateCall);
		assert.ok(gotoErr.includes(`}, this._editor)${doubleCatch};`));
		assert.ok(gotoErr.includes('const otherEditor = await this._editorService.openCodeEditor({'));
		assert.ok(!gotoErr.includes(`await this._editorService.openCodeEditor({}${doubleCatch}`));
		assert.ok(gotoErr.includes('await MarkerController.get(editor)?.navigate(this._next, this._multiFile);'));
		assert.ok(!gotoErr.includes(`await MarkerController.get(editor)?.navigate(this._next, this._multiFile)${doubleCatch}`));
	});

	test('markers leftover openFileAtElement then is Promise double-chain; notebook leftover computeSymbols voids / trigger are Promise double-chain', () => {
		const markers = fs.readFileSync(resolveSource(MARKERS_VIEW_REL), 'utf8');
		const notebook = fs.readFileSync(resolveSource(NOTEBOOK_OUTLINE_REL), 'utf8');
		const editorSvc = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		assertPromiseSignature(editorSvc, 'openEditor(editor: IUntypedEditorInput, group?: PreferredGroup): Promise<IEditorPane | undefined>;');
		assertPromiseSignature(notebook, 'private async computeSymbols(cancelToken: CancellationToken = CancellationToken.None) {');
		assertPromiseSignature(notebook, 'private async delayedComputeSymbols() {');
		assertPromiseSignature(asyncSource, 'trigger(task: ITask<T | Promise<T>>, delay = this.defaultDelay): Promise<T> {');
		assert.ok(markers.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(notebook.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assertWrapped(markers, markersThenCall);
		assert.strictEqual(countWrapped(notebook, computeSymbolsCall), 3);
		assertWrapped(notebook, delayedComputeCall);
		assertWrapped(notebook, triggerComputeCall);
		assert.ok(notebook.includes(`void this.doComputeSymbols(cancelToken)${doubleCatch};`));
	});

});
