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
const RENDERER_REL = 'src/vs/workbench/contrib/notebook/browser/services/notebookRendererMessagingServiceImpl.ts';
const NOTEBOOK_EDITOR_REL = 'src/vs/workbench/contrib/notebook/browser/notebookEditor.ts';
const WIDGET_REL = 'src/vs/workbench/contrib/notebook/browser/notebookEditorWidget.ts';
const SERVICE_REL = 'src/vs/workbench/contrib/notebook/browser/services/notebookServiceImpl.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/gettingStarted/notebookGettingStarted.ts';
const STATUS_REL = 'src/vs/workbench/contrib/notebook/browser/view/cellParts/cellStatusPart.ts';
const MARKUP_REL = 'src/vs/workbench/contrib/notebook/browser/view/cellParts/markupCell.ts';
const CODE_REL = 'src/vs/workbench/contrib/notebook/browser/view/cellParts/codeCell.ts';
const OUTPUT_REL = 'src/vs/workbench/contrib/notebook/browser/view/cellParts/cellOutput.ts';
const VIEWPORT_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/viewportWarmup/viewportWarmup.ts';
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';
const LAYOUT_REL = 'src/vs/platform/layout/browser/layoutService.ts';
const BROWSER_REL = 'src/vs/workbench/contrib/notebook/browser/notebookBrowser.ts';
const INDENT_REL = 'src/vs/workbench/contrib/notebook/browser/controller/notebookIndentationActions.ts';
const PRELOADS_REL = 'src/vs/workbench/contrib/notebook/browser/view/renderers/webviewPreloads.ts';
const OUTLINE_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/outline/notebookOutline.ts';
const INPUT_REL = 'src/vs/workbench/contrib/notebook/common/notebookEditorInput.ts';
const KERNEL_REL = 'src/vs/workbench/contrib/notebook/browser/viewParts/notebookKernelQuickPickStrategy.ts';
const EDITOR_MODEL_REL = 'src/vs/workbench/contrib/notebook/common/notebookEditorModel.ts';
const STICKY_REL = 'src/vs/workbench/contrib/notebook/browser/viewParts/notebookEditorStickyScroll.ts';

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
	assert.ok(signature.includes('Promise<') || signature.includes('async ') || signature.includes('CancelablePromise'));
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const d758Calls: Array<[string, string, number]> = [
	[RENDERER_REL, `this.extensionService.activateByEvent(\`onRenderer:\${rendererId}\`).then(() => {
			for (const message of queue) {
				this.postMessageEmitter.fire(message);
			}

			this.activations.set(rendererId, undefined);
		})`, 1],
	[NOTEBOOK_EDITOR_REL, `fileOpenMonitor.then(() => {
				perfMarksCaptured = true;
				this._handlePerfMark(perf, input);
			})`, 1],
	[WIDGET_REL, 'whenContainerStylesLoaded.then(() => this.layoutNotebook(dimension, shadowElement))', 1],
	[SERVICE_REL, 'this._extensionService.activateByEvent(`onNotebook:${viewType}`)', 1],
	[SERVICE_REL, 'this._extensionService.activateByEvent(`onNotebook:*`)', 1],
	[GETTING_STARTED_REL, "_commandService.executeCommand('workbench.action.openWalkthrough', { category: 'notebooks', step: 'notebookProfile' }, true)", 1],
	[STATUS_REL, 'this.executeCommand()', 2],
	[WIDGET_REL, 'this.createMarkupPreview(firstMarkupCell)', 1],
	[WIDGET_REL, 'this.hideMarkupPreviews(hiddenCells)', 1],
	[WIDGET_REL, 'this.deleteMarkupPreviews(deletedCells)', 1],
	[WIDGET_REL, 'this.layoutNotebookCell(cell, cell.layoutInfo.totalHeight, e.context)', 1],
	[WIDGET_REL, 'this.hideMarkupPreviews([(cell as MarkupCellViewModel)])', 1],
	[WIDGET_REL, 'this.layoutNotebookCell(cell, cell.layoutInfo.totalHeight)', 1],
	[MARKUP_REL, 'this.notebookEditor.hideMarkupPreviews([this.viewCell])', 2],
	[MARKUP_REL, 'this.notebookEditor.unhideMarkupPreviews([this.viewCell])', 1],
	[MARKUP_REL, 'this.notebookEditor.createMarkupPreview(this.viewCell)', 1],
	[MARKUP_REL, 'this.notebookEditor.layoutNotebookCell(this.viewCell, this.viewCell.layoutInfo.totalHeight)', 1],
	[CODE_REL, 'this.notebookEditor.layoutNotebookCell(this.viewCell, this.viewCell.layoutInfo.totalHeight)', 1],
	[OUTPUT_REL, 'this.notebookEditor.layoutNotebookCell(this.viewCell, this.viewCell.layoutInfo.totalHeight)', 2],
	[VIEWPORT_REL, '(this._notebookEditor as INotebookEditorDelegate).createMarkupPreview(cell)', 1],
];

suite('Notebook leftover Promise fire-and-forget catch scan (D758)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers twenty-three leftover Promise double-chain sites after D750', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d758Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = (source.match(new RegExp(`${call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${doubleCatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length;
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 23);
		assert.ok(sites >= 4);
	});

	test('leftover activateByEvent then / dropped activateByEvent are Promise double-chain', () => {
		const renderer = fs.readFileSync(resolveSource(RENDERER_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(extensions, 'activateByEvent(activationEvent: string, activationKind?: ActivationKind): Promise<void>;');
		assert.ok(renderer.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(service.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual(countDoubleChains(renderer), 1);
		assert.strictEqual(countDoubleChains(service), 2);
		assert.ok(!renderer.includes(`this.extensionService.activateByEvent(\`onRenderer:\${rendererId}\`).then(() => {
			for (const message of queue) {
				this.postMessageEmitter.fire(message);
			}

			this.activations.set(rendererId, undefined);
		});`));
		assert.ok(!service.includes('this._extensionService.activateByEvent(`onNotebook:${viewType}`);'));
		assert.ok(!service.includes('this._extensionService.activateByEvent(`onNotebook:*`);'));
	});

	test('leftover fileOpenMonitor then / whenContainerStylesLoaded then are Promise double-chain', () => {
		const notebookEditor = fs.readFileSync(resolveSource(NOTEBOOK_EDITOR_REL), 'utf8');
		const widget = fs.readFileSync(resolveSource(WIDGET_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		assertPromiseSignature(asyncSource, 'export function timeout(millis: number): CancelablePromise<void>;');
		assertPromiseSignature(asyncSource, 'export interface CancelablePromise<T> extends Promise<T> {');
		assertPromiseSignature(layout, 'whenContainerStylesLoaded(window: Window): Promise<void> | undefined;');
		assert.ok(notebookEditor.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(widget.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(notebookEditor.includes(`fileOpenMonitor.then(() => {
				perfMarksCaptured = true;
				this._handlePerfMark(perf, input);
			})${doubleCatch};`));
		assert.ok(!notebookEditor.includes(`fileOpenMonitor.then(() => {
				perfMarksCaptured = true;
				this._handlePerfMark(perf, input);
			});`));
		assert.ok(widget.includes(`whenContainerStylesLoaded.then(() => this.layoutNotebook(dimension, shadowElement))${doubleCatch};`));
		assert.ok(!widget.includes('whenContainerStylesLoaded.then(() => this.layoutNotebook(dimension, shadowElement));'));
	});

	test('leftover executeCommand fire-and-forgets are Promise double-chain', () => {
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const status = fs.readFileSync(resolveSource(STATUS_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assertPromiseSignature(status, 'private async executeCommand(): Promise<void> {');
		assert.ok(gettingStarted.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(status.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.strictEqual(countDoubleChains(gettingStarted), 1);
		assert.strictEqual(countDoubleChains(status), 2);
		assert.ok(!gettingStarted.includes("_commandService.executeCommand('workbench.action.openWalkthrough', { category: 'notebooks', step: 'notebookProfile' }, true);"));
		assert.ok(!status.includes('\t\t\t\tthis.executeCommand();'));
	});

	test('leftover hide/unhide/create/delete markup preview and layoutNotebookCell FOF are Promise double-chain', () => {
		const widget = fs.readFileSync(resolveSource(WIDGET_REL), 'utf8');
		const markup = fs.readFileSync(resolveSource(MARKUP_REL), 'utf8');
		const code = fs.readFileSync(resolveSource(CODE_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_REL), 'utf8');
		const viewport = fs.readFileSync(resolveSource(VIEWPORT_REL), 'utf8');
		const browser = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		assertPromiseSignature(browser, 'createMarkupPreview(cell: ICellViewModel): Promise<void>;');
		assertPromiseSignature(browser, 'unhideMarkupPreviews(cells: readonly ICellViewModel[]): Promise<void>;');
		assertPromiseSignature(browser, 'hideMarkupPreviews(cells: readonly ICellViewModel[]): Promise<void>;');
		assertPromiseSignature(browser, 'layoutNotebookCell(cell: ICellViewModel, height: number): Promise<void>;');
		assertPromiseSignature(widget, 'async deleteMarkupPreviews(cells: readonly MarkupCellViewModel[]) {');
		assert.strictEqual(countDoubleChains(widget), 7);
		assert.strictEqual(countDoubleChains(output), 2);
		assert.strictEqual(countDoubleChains(viewport), 1);
		assert.ok(markup.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(code.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(output.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(viewport.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(widget.includes('requests.push(this.createMarkupPreview(cells[i]));'));
		assert.ok(!widget.includes(`requests.push(this.createMarkupPreview(cells[i]))${doubleCatch}`));
	});

	test('opener / Action2.run / two-arg / assigned then / returned Promise / already-double / custom catch stay skipped', () => {
		const indent = fs.readFileSync(resolveSource(INDENT_REL), 'utf8');
		const preloads = fs.readFileSync(resolveSource(PRELOADS_REL), 'utf8');
		const outline = fs.readFileSync(resolveSource(OUTLINE_REL), 'utf8');
		const input = fs.readFileSync(resolveSource(INPUT_REL), 'utf8');
		const kernel = fs.readFileSync(resolveSource(KERNEL_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_REL), 'utf8');
		const editorModel = fs.readFileSync(resolveSource(EDITOR_MODEL_REL), 'utf8');
		const sticky = fs.readFileSync(resolveSource(STICKY_REL), 'utf8');
		const widget = fs.readFileSync(resolveSource(WIDGET_REL), 'utf8');
		const notebookEditor = fs.readFileSync(resolveSource(NOTEBOOK_EDITOR_REL), 'utf8');

		assert.ok(indent.includes('quickInputService.pick(picks, { placeHolder: nls.localize({ key: \'selectTabWidth\', comment: [\'Tab corresponds to the tab key\'] }, "Select Tab Size for Current File") }).then(pick => {'));
		assert.ok(!indent.includes(doubleCatch));
		assert.ok(preloads.includes('record.queue = record.queue.then(async r => {'));
		assert.ok(preloads.includes(', () => reject());'));
		assert.ok(!preloads.includes(doubleCatch));
		assert.ok(outline.includes(`void this.doComputeSymbols(cancelToken)${doubleCatch};`));
		assert.ok(input.includes(`this.resolve()${doubleCatch};`));
		assert.ok(kernel.includes('void this._openerService.open(uri, { openExternal: true });'));
		assert.ok(!kernel.includes('void this._openerService.open(uri, { openExternal: true }).catch'));
		assert.ok(output.includes('this.openerService.open(CellUri.generateCellOutputUriWithId(this.notebookEditor.textModel!.uri));'));
		assert.ok(!output.includes('this.openerService.open(CellUri.generateCellOutputUriWithId(this.notebookEditor.textModel!.uri)).catch'));
		assert.ok(widget.includes('return this._cellLayoutManager?.layoutNotebookCell(cell, height);'));
		assert.ok(notebookEditor.includes('this._editorService.openEditor({ resource: input.resource, options: { override: DEFAULT_EDITOR_ASSOCIATION.id, pinned: true } });'));
		assert.ok(!notebookEditor.includes('this._editorService.openEditor({ resource: input.resource, options: { override: DEFAULT_EDITOR_ASSOCIATION.id, pinned: true } }).catch'));
		assert.ok(editorModel.includes("this.setSaveDelegate().catch(error => this._notebookLogService.error('WorkingCopyModel', `Failed to set save delegate: ${error}`));"));
		assert.ok(!editorModel.includes(`this.setSaveDelegate()${doubleCatch}`));
		assert.ok(sticky.includes('this.init().catch(console.error);'));
		assert.ok(!sticky.includes(`this.init()${doubleCatch}`));
		for (const source of [indent, preloads, outline, input, kernel, editorModel, sticky]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
