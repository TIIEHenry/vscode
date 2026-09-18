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
const ASYNC_TREE_REL = 'src/vs/base/browser/ui/tree/asyncDataTree.ts';
const DIALOGS_REL = 'src/vs/platform/dialogs/common/dialogs.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const RESOLVER_REL = 'src/vs/editor/common/services/resolverService.ts';
const EDITOR_SVC_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const EDITOR_GROUPS_REL = 'src/vs/workbench/services/editor/common/editorGroupsService.ts';
const MARKERS_VIEW_REL = 'src/vs/workbench/contrib/markers/browser/markersView.ts';
const MARKERS_TREE_REL = 'src/vs/workbench/contrib/markers/browser/markersTreeViewer.ts';
const MARKERS_CONTRIB_REL = 'src/vs/workbench/contrib/markers/browser/markers.contribution.ts';
const MARKERS_ACTIONS_REL = 'src/vs/workbench/contrib/markers/browser/markersViewActions.ts';
const BULK_PANE_REL = 'src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPane.ts';
const BULK_PREVIEW_REL = 'src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPreview.ts';
const BULK_CONTRIB_REL = 'src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEdit.contribution.ts';
const BULK_TEXT_REL = 'src/vs/workbench/contrib/bulkEdit/browser/bulkTextEdits.ts';

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

const markersThenCall = `}, sideByside ? SIDE_GROUP : ACTIVE_GROUP).then(editor => {
				if (editor && preserveFocus) {
					this.rangeHighlightDecorations.highlightRange({ resource, range: selection }, <ICodeEditor>editor.getControl());
				} else {
					this.rangeHighlightDecorations.removeHighlightRange();
				}
			})`;
const setQuickFixesCall = 'void this.setQuickFixes(true)';
const openElementCall = 'void this._openElementInMultiDiffEditor(e)';
const setTreeInputCall = 'this._setTreeInput(input)';
const warnFinallyCall = 'this._dialogService.warn(message).finally(() => this._done(false))';
const openEditorCall = `this._editorService.openEditor({
			multiDiffSource,
			label,
			options,
			isTransient: true,
			description: label,
			resources: result.resources
		}, e.sideBySide ? SIDE_GROUP : ACTIVE_GROUP)`;
const updateChildrenCall = 'this._tree.updateChildren()';
const applyTextEditsCall = 'this._applyTextEditsToPreviewModel(uri)';
const queueMicrotaskCall = `void Promise.resolve((async () => {
					this._disposables.add(await this._textModelResolverService.createModelReference(model!.uri));
				})())`;
const closeEditorsCall = 'group.closeEditors(previewEditors, { preserveFocus: true })';

const d796Calls: Array<[string, string, number]> = [
	[MARKERS_VIEW_REL, markersThenCall, 1],
	[MARKERS_TREE_REL, setQuickFixesCall, 1],
	[BULK_PANE_REL, openElementCall, 1],
	[BULK_PANE_REL, setTreeInputCall, 2],
	[BULK_PANE_REL, warnFinallyCall, 1],
	[BULK_PANE_REL, openEditorCall, 1],
	[BULK_PANE_REL, updateChildrenCall, 1],
	[BULK_PREVIEW_REL, applyTextEditsCall, 1],
	[BULK_PREVIEW_REL, queueMicrotaskCall, 1],
	[BULK_CONTRIB_REL, closeEditorsCall, 1],
];

suite('markers leftover remaining overflowed to bulkEdit leftover Promise fire-and-forget catch scan (D796)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('markers leftover remaining has fewer than four legal sites so this knife moved to bulkEdit leftover remaining', () => {
		const view = fs.readFileSync(resolveSource(MARKERS_VIEW_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(MARKERS_TREE_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(MARKERS_CONTRIB_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(MARKERS_ACTIONS_REL), 'utf8');
		const markersLegal = countWrapped(view, markersThenCall) + countWrapped(tree, setQuickFixesCall);
		assert.ok(markersLegal < 4, `expected markers leftover remaining <4, got ${markersLegal}`);
		assert.strictEqual(markersLegal, 2);
		assert.strictEqual(countDoubleChains(view), 1);
		assert.strictEqual(countDoubleChains(tree), 1);
		assert.ok(view.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(tree.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(view, markersThenCall);
		assertWrapped(tree, setQuickFixesCall);
		assert.ok(tree.includes('}, ACTIVE_GROUP).then(() => undefined);'));
		assert.ok(!tree.includes('}, ACTIVE_GROUP).then(() => undefined).catch'));
		assert.ok(view.includes('viewModel.quickFixAction.run();'));
		assert.ok(!view.includes(`viewModel.quickFixAction.run()${doubleCatch}`));
		assert.ok(contrib.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(!contrib.includes(doubleCatch));
		assert.ok(actions.includes('override run(): Promise<void> {'));
		assert.ok(!actions.includes(doubleCatch));
	});

	test('this knife covers eleven leftover Promise double-chain sites after markers leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d796Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countWrapped(source, call);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 11);
		assert.ok(sites >= 4);
		assert.strictEqual(countDoubleChains(seen.get(MARKERS_VIEW_REL)!), 1);
		assert.strictEqual(countDoubleChains(seen.get(MARKERS_TREE_REL)!), 1);
		assert.strictEqual(countDoubleChains(seen.get(BULK_PANE_REL)!), 6);
		assert.strictEqual(countDoubleChains(seen.get(BULK_PREVIEW_REL)!), 2);
		assert.strictEqual(countDoubleChains(seen.get(BULK_CONTRIB_REL)!), 1);
	});

	test('markers leftover remaining openFileAtElement then / setQuickFixes already-double stay leftover remaining; returned then / Action.run stay skipped', () => {
		const view = fs.readFileSync(resolveSource(MARKERS_VIEW_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(MARKERS_TREE_REL), 'utf8');
		const editorSvc = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		assertPromiseSignature(editorSvc, 'openEditor(editor: IUntypedEditorInput, group?: PreferredGroup): Promise<IEditorPane | undefined>;');
		assertPromiseSignature(tree, 'private async setQuickFixes(waitForModel: boolean): Promise<void> {');
		assertWrapped(view, markersThenCall);
		assertWrapped(tree, setQuickFixesCall);
		assert.ok(tree.includes('return this.editorService.openEditor({'));
		assert.ok(tree.includes('}, ACTIVE_GROUP).then(() => undefined);'));
		assert.ok(!tree.includes(`}, ACTIVE_GROUP).then(() => undefined)${doubleCatch}`));
		assert.ok(view.includes('viewModel.quickFixAction.run();'));
		assert.ok(!view.includes(`viewModel.quickFixAction.run()${doubleCatch}`));
	});

	test('bulkEdit leftover remaining openElement / setTreeInput / warn.finally / openEditor / updateChildren are Promise double-chain', () => {
		const pane = fs.readFileSync(resolveSource(BULK_PANE_REL), 'utf8');
		const editorSvc = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		const dialogs = fs.readFileSync(resolveSource(DIALOGS_REL), 'utf8');
		const asyncTree = fs.readFileSync(resolveSource(ASYNC_TREE_REL), 'utf8');
		assertPromiseSignature(pane, 'private async _openElementInMultiDiffEditor(e: IOpenEvent<BulkEditElement | undefined>): Promise<void> {');
		assertPromiseSignature(pane, 'private async _setTreeInput(input: BulkFileOperations) {');
		assertPromiseSignature(editorSvc, 'openEditor(editor: IUntypedEditorInput, group?: PreferredGroup): Promise<IEditorPane | undefined>;');
		assertPromiseSignature(dialogs, 'warn(message: string, detail?: string): Promise<void>;');
		assertPromiseSignature(asyncTree, 'async updateChildren(element: TInput | T = this.root.element, recursive = true, rerender = false, options?: IAsyncDataTreeUpdateChildrenOptions<T>): Promise<void> {');
		assert.ok(pane.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assertWrapped(pane, openElementCall);
		assert.strictEqual(countWrapped(pane, setTreeInputCall), 2);
		assertWrapped(pane, warnFinallyCall);
		assertWrapped(pane, openEditorCall);
		assertWrapped(pane, updateChildrenCall);
		assert.ok(pane.includes('await this._tree.setInput(input, viewState);'));
		assert.ok(!pane.includes(`await this._tree.setInput(input, viewState)${doubleCatch}`));
		assert.ok(!pane.includes('this._setTreeInput(input);'));
		assert.ok(!pane.includes('this._tree.updateChildren();'));
	});

	test('bulkEdit leftover remaining applyTextEdits / PromiseLike createModelReference / closeEditors are Promise double-chain', () => {
		const preview = fs.readFileSync(resolveSource(BULK_PREVIEW_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(BULK_CONTRIB_REL), 'utf8');
		const resolver = fs.readFileSync(resolveSource(RESOLVER_REL), 'utf8');
		const groups = fs.readFileSync(resolveSource(EDITOR_GROUPS_REL), 'utf8');
		assertPromiseSignature(preview, 'private async _applyTextEditsToPreviewModel(uri: URI) {');
		assertPromiseSignature(resolver, 'createModelReference(resource: URI): Promise<IReference<IResolvedTextEditorModel>>;');
		assertPromiseSignature(groups, 'closeEditors(editors: EditorInput[] | ICloseEditorsFilter, options?: ICloseEditorOptions): Promise<boolean>;');
		assert.ok(preview.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(contrib.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assertWrapped(preview, applyTextEditsCall);
		assertWrapped(preview, queueMicrotaskCall);
		assertWrapped(contrib, closeEditorsCall);
		assert.ok(preview.includes('await this._applyTextEditsToPreviewModel(operation.uri);'));
		assert.ok(!preview.includes(`await this._applyTextEditsToPreviewModel(operation.uri)${doubleCatch}`));
		assert.ok(!preview.includes('queueMicrotask(async () => {'));
		assert.ok(!contrib.includes('group.closeEditors(previewEditors, { preserveFocus: true });'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Watch / Resolve / Pty / Connect / D145 stay skipped', () => {
		const view = fs.readFileSync(resolveSource(MARKERS_VIEW_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(MARKERS_TREE_REL), 'utf8');
		const markersContrib = fs.readFileSync(resolveSource(MARKERS_CONTRIB_REL), 'utf8');
		const pane = fs.readFileSync(resolveSource(BULK_PANE_REL), 'utf8');
		const preview = fs.readFileSync(resolveSource(BULK_PREVIEW_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(BULK_CONTRIB_REL), 'utf8');
		const textEdits = fs.readFileSync(resolveSource(BULK_TEXT_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');

		assert.ok(markersContrib.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(markersContrib.includes('accessor.get(IViewsService).openView(Markers.MARKERS_VIEW_ID, true);'));
		assert.ok(!markersContrib.includes(doubleCatch));
		assert.ok(contrib.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(contrib.includes('view?.accept();'));
		assert.ok(!contrib.includes(`view?.accept()${doubleCatch}`));

		assert.ok(tree.includes('}, ACTIVE_GROUP).then(() => undefined);'));
		assert.ok(!tree.includes('}, ACTIVE_GROUP).then(() => undefined).catch'));
		assert.ok(textEdits.includes('const promise = this._textModelResolverService.createModelReference(key).then(async ref => {'));
		assert.ok(!textEdits.includes(doubleCatch));
		assert.ok(preview.includes('const ref = await this._textModelResolverService.createModelReference(uri);'));
		assert.ok(!preview.includes(`await this._textModelResolverService.createModelReference(uri)${doubleCatch}`));
		assert.ok(contrib.includes('await this._paneCompositeService.openPaneComposite(this._activePanel, ViewContainerLocation.Panel);'));
		assert.ok(!contrib.includes(`openPaneComposite(this._activePanel, ViewContainerLocation.Panel)${doubleCatch}`));

		assert.ok(view.includes('viewModel.quickFixAction.run();'));
		assert.ok(!view.includes(`viewModel.quickFixAction.run()${doubleCatch}`));

		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/remoteTunnel/test/node/remoteTunnelLeftoverPromiseCatchScanD796.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/speech/test/node/speechLeftoverPromiseCatchScanD796.test.ts')));

		for (const source of [view, tree, markersContrib, pane, preview, contrib, textEdits]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
