/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { timeout } from '../../../../../base/common/async.js';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { HierarchicalKind } from '../../../../../base/common/hierarchicalKind.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { RawContextKey } from '../../../../../platform/contextkey/common/contextkey.js';
import { getSingletonServiceDescriptors } from '../../../../../platform/instantiation/common/extensions.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IActionWidgetService } from '../../../../../platform/actionWidget/browser/actionWidget.js';
import { IUndoRedoService } from '../../../../../platform/undoRedo/common/undoRedo.js';
import { IBulkEditResult, IBulkEditService, ResourceEdit, ResourceTextEdit } from '../../../../browser/services/bulkEditService.js';
import { Range } from '../../../../common/core/range.js';
import { DocumentPasteEdit } from '../../../../common/languages.js';
import { ITextModel } from '../../../../common/model.js';
import { createTextModel } from '../../../../test/common/testTextModel.js';
import { withAsyncTestCodeEditor } from '../../../../test/browser/testCodeEditor.js';
import { PostEditWidgetManager } from '../../browser/postEditWidget.js';

interface EditSet {
	readonly activeEditIndex: number;
	readonly allEdits: ReadonlyArray<DocumentPasteEdit>;
}

class CapturingPostEditWidgetManager extends PostEditWidgetManager<DocumentPasteEdit> {
	selectEdit: ((newEditIndex: number) => void) | undefined;

	override show(_range: Range, _edits: EditSet, onDidSelectEdit: (newIndex: number) => void): void {
		this.selectEdit = onDidSelectEdit;
	}
}

function pasteEdit(title: string, insertText: string): DocumentPasteEdit {
	return {
		title,
		kind: new HierarchicalKind('test.paste'),
		insertText,
	};
}

function applyTextEdits(model: ITextModel, edit: ResourceEdit[] | { edits: readonly unknown[] }): void {
	const edits = Array.isArray(edit) ? edit : edit.edits;
	for (const candidate of edits) {
		if (candidate instanceof ResourceTextEdit) {
			model.pushEditOperations(null, [{ range: candidate.textEdit.range, text: candidate.textEdit.text.replace(/\$0$/, '') }], () => null);
		}
	}
}

function ensureEditorCancellationTokens(instantiationService: TestInstantiationService): void {
	const entry = getSingletonServiceDescriptors().find(([id]) => id.toString() === 'IEditorCancelService');
	assert.ok(entry, 'IEditorCancelService is not registered');
	instantiationService.set(entry[0], instantiationService.createInstance(entry[1]));
}

function bulkEditService(model: ITextModel): IBulkEditService {
	return {
		_serviceBrand: undefined,
		hasPreviewHandler: () => false,
		setPreviewHandler: () => Disposable.None,
		apply: async (edit): Promise<IBulkEditResult> => {
			applyTextEdits(model, edit as ResourceEdit[] | { edits: readonly unknown[] });
			return { ariaSummary: '', isApplied: true };
		},
	};
}

suite('PostEditWidgetManager - switching paste edits', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not undo or write when the top undo element is not this paste', async () => {
		await withAsyncTestCodeEditor('', {}, async (editor, _viewModel, instantiationService) => {
			const model = editor.getModel()!;
			const undoRedoService = instantiationService.get(IUndoRedoService);
			ensureEditorCancellationTokens(instantiationService);
			instantiationService.stub(IBulkEditService, bulkEditService(model));
			instantiationService.stub(IActionWidgetService, { show: () => { }, hide: () => { } } as unknown as IActionWidgetService);

			const manager = store.add(instantiationService.createInstance(
				CapturingPostEditWidgetManager,
				'test-paste',
				editor,
				new RawContextKey<boolean>('test.pasteWidgetVisible', false),
				{ id: 'test.show', label: 'Show' },
				() => [],
			));

			await manager.applyEditAndShowIfNeeded([new Range(1, 1, 1, 1)], {
				activeEditIndex: 0,
				allEdits: [pasteEdit('first', 'ONE'), pasteEdit('second', 'TWO')],
			}, true, async edit => edit, CancellationToken.None);

			assert.ok(manager.selectEdit);
			assert.strictEqual(model.getValue(), 'ONE');

			// Somebody else edits after the paste. Close the paste's undo element first so this
			// becomes a separate element instead of merging into it.
			model.pushStackElement();
			model.pushEditOperations(null, [{ range: new Range(1, 4, 1, 4), text: 'USER' }], () => null);
			assert.strictEqual(model.getValue(), 'ONEUSER');
			const topBeforeSwitch = undoRedoService.getElements(model.uri).past.at(-1);

			await manager.selectEdit!(1);

			assert.strictEqual(model.getValue(), 'ONEUSER');
			assert.strictEqual(undoRedoService.getElements(model.uri).past.at(-1), topBeforeSwitch);
		});
	});

	test('does not write old ranges into a model swapped in while switching', async () => {
		await withAsyncTestCodeEditor('', {}, async (editor, _viewModel, instantiationService) => {
			const model = editor.getModel()!;
			const otherModel = store.add(createTextModel('other'));
			ensureEditorCancellationTokens(instantiationService);
			instantiationService.stub(IBulkEditService, bulkEditService(model));
			instantiationService.stub(IActionWidgetService, { show: () => { }, hide: () => { } } as unknown as IActionWidgetService);

			const manager = store.add(instantiationService.createInstance(
				CapturingPostEditWidgetManager,
				'test-paste',
				editor,
				new RawContextKey<boolean>('test.pasteWidgetVisible', false),
				{ id: 'test.show', label: 'Show' },
				() => [],
			));

			await manager.applyEditAndShowIfNeeded([new Range(1, 1, 1, 1)], {
				activeEditIndex: 0,
				allEdits: [pasteEdit('first', 'ONE'), pasteEdit('second', 'TWO')],
			}, true, async edit => edit, CancellationToken.None);

			assert.ok(manager.selectEdit);
			editor.setModel(otherModel);
			await manager.selectEdit!(1);

			assert.strictEqual(otherModel.getValue(), 'other');
			assert.strictEqual(model.getValue(), 'ONE');
		});
	});

	test('undoes this paste and writes the new type at the restored selection', async () => {
		await withAsyncTestCodeEditor('', {}, async (editor, _viewModel, instantiationService) => {
			const model = editor.getModel()!;
			ensureEditorCancellationTokens(instantiationService);
			instantiationService.stub(IBulkEditService, bulkEditService(model));
			instantiationService.stub(IActionWidgetService, { show: () => { }, hide: () => { } } as unknown as IActionWidgetService);

			const manager = store.add(instantiationService.createInstance(
				CapturingPostEditWidgetManager,
				'test-paste',
				editor,
				new RawContextKey<boolean>('test.pasteWidgetVisible', false),
				{ id: 'test.show', label: 'Show' },
				() => [],
			));

			await manager.applyEditAndShowIfNeeded([new Range(1, 1, 1, 1)], {
				activeEditIndex: 0,
				allEdits: [pasteEdit('first', 'ONE'), pasteEdit('second', 'TWO')],
			}, true, async edit => edit, CancellationToken.None);

			assert.ok(manager.selectEdit);
			assert.strictEqual(model.getValue(), 'ONE');

			await manager.selectEdit!(1);
			await timeout(0);

			assert.strictEqual(model.getValue(), 'TWO');
		});
	});
});

suite('CopyPasteController - cancel after provider edit', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function source(): string {
		const candidates = [
			path.join(process.cwd(), 'src/vs/editor/contrib/dropOrPasteInto/browser/copyPasteController.ts'),
			path.join(path.dirname(fileURLToPath(import.meta.url)), '../../browser/copyPasteController.ts'),
		];
		const found = candidates.find(candidate => fs.existsSync(candidate));
		assert.ok(found, `copyPasteController.ts not found (${candidates.join(' | ')})`);
		return fs.readFileSync(found, 'utf8');
	}

	test('undoes only the element this paste pushed before default paste', () => {
		const text = source();
		const cancelStart = text.indexOf('cancel: async () => {');
		const cancelBlock = text.slice(cancelStart, text.indexOf('}).finally(() => {', cancelStart));

		assert.ok(cancelBlock.includes('alternativeVersionIdBeforePaste === undefined'));
		assert.ok(cancelBlock.includes('top !== topBeforePaste'));
		assert.ok(cancelBlock.includes('model.getAlternativeVersionId() !== alternativeVersionIdBeforePaste'));
		assert.ok(cancelBlock.includes('await model.undo();'));
		assert.ok(cancelBlock.indexOf('await model.undo();') < cancelBlock.indexOf('applyDefaultPasteHandler'));
		assert.ok(cancelBlock.includes('CancellationToken.None'));
		assert.ok(!cancelBlock.includes('editorStateCts.token.isCancellationRequested'));
	});

	test('captures the paste baseline before providers can write', () => {
		const text = source();
		const start = text.indexOf('const p = createCancelablePromise');
		const block = text.slice(start, text.indexOf('const disposables = new DisposableStore();', start));

		assert.ok(block.includes('alternativeVersionIdBeforePaste = model.getAlternativeVersionId();'));
		assert.ok(block.includes('topBeforePaste = this._undoRedoService.getElements(model.uri).past.at(-1);'));
	});
});
