/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event, Emitter } from '../../../../../../base/common/event.js';
import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { mock } from '../../../../../../base/test/common/mock.js';
import { CommentThreadWidget } from '../../../../comments/browser/commentThreadWidget.js';
import { ICommentService, INotebookCommentInfo } from '../../../../comments/browser/commentService.js';
import { IActiveNotebookEditorDelegate, ICellViewModel } from '../../../browser/notebookBrowser.js';
import { CellComments } from '../../../browser/view/cellParts/cellComments.js';
import { setupInstantiationService } from '../testNotebookEditor.js';
import * as languages from '../../../../../../editor/common/languages.js';
import { ICellRange } from '../../../common/notebookRange.js';

class MockCommentThreadWidget extends Disposable {
	private readonly _onDidResize = this._register(new Emitter<void>());
	readonly onDidResize = this._onDidResize.event;

	async display(): Promise<void> {
		return;
	}

	async updateCommentThread(): Promise<void> {
		return;
	}

	getDimensions() {
		return { width: 100, height: 80 };
	}

	applyTheme(): void {
		return;
	}
}

function createMockCell(id: string): ICellViewModel & { readonly id: string } {
	let commentHeight = 0;
	const uri = URI.parse(`test:///notebook/${id}`);
	return {
		id,
		uri,
		get commentHeight() {
			return commentHeight;
		},
		set commentHeight(height: number) {
			commentHeight = height;
		},
		layoutInfo: {
			commentOffset: 12,
		},
	} as ICellViewModel & { readonly id: string };
}

suite('CellComments', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('does not apply stale commentHeight after switching cells while getNotebookComments is pending', async () => {
		let resolveCellAComments!: (value: INotebookCommentInfo[]) => void;
		const cellACommentsPromise = new Promise<INotebookCommentInfo[]>(resolve => {
			resolveCellAComments = resolve;
		});

		const mockThread: languages.CommentThread<ICellRange> = {
			isDocumentCommentThread: () => false,
			commentThreadHandle: 1,
			controllerHandle: 1,
			threadId: 'thread-1',
			resource: null,
			range: undefined,
			label: undefined,
			contextValue: undefined,
			comments: [],
			onDidChangeComments: Event.None,
			onDidChangeInitialCollapsibleState: Event.None,
			onDidChangeInput: Event.None,
			onDidChangeLabel: Event.None,
			onDidChangeCollapsibleState: Event.None,
			onDidChangeState: Event.None,
			onDidChangeCanReply: Event.None,
			canReply: true,
			isDisposed: false,
			isTemplate: false,
		};

		const instantiationService = setupInstantiationService(store);
		const origCreateInstance = instantiationService.createInstance.bind(instantiationService);
		instantiationService.createInstance = (<T>(ctor: new (...args: unknown[]) => T, ...args: unknown[]): T => {
			if (ctor === CommentThreadWidget) {
				return store.add(new MockCommentThreadWidget()) as T;
			}
			return origCreateInstance(ctor as never, ...args);
		}) as typeof instantiationService.createInstance;

		instantiationService.stub(ICommentService, new class extends mock<ICommentService>() {
			override onDidUpdateCommentThreads = Event.None;
			override getNotebookComments(uri: URI) {
				if (uri.path.endsWith('/cell-a')) {
					return cellACommentsPromise;
				}
				return Promise.resolve([]);
			}
		});

		const notebookUri = URI.parse('test:///notebook');
		const notebookEditor = {
			hasModel: () => true,
			textModel: { uri: notebookUri },
			getLayoutInfo: () => ({
				fontInfo: { lineHeight: 20 },
			}),
		} as unknown as IActiveNotebookEditorDelegate;

		const container = document.createElement('div');
		const cellA = createMockCell('cell-a');
		const cellB = createMockCell('cell-b');
		const cellComments = store.add(instantiationService.createInstance(CellComments, notebookEditor, container));

		cellComments.renderCell(cellA);
		cellComments.renderCell(cellB);

		resolveCellAComments([{
			uniqueOwner: 'owner',
			threads: [mockThread],
		}]);

		await cellACommentsPromise;
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(cellB.commentHeight, 0, 'stale async update must not write comment height onto the newly rendered cell');
		assert.strictEqual(cellA.commentHeight, 0, 'stale async update must not write comment height onto the previous cell after reuse');
	});
});
