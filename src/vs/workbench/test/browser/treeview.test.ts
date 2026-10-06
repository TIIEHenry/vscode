/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { TreeView } from '../../browser/parts/views/treeView.js';
import { workbenchInstantiationService } from './workbenchTestServices.js';
import { TestInstantiationService } from '../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ITreeItem, ITreeViewDragAndDropController, IViewDescriptorService, TreeItemCollapsibleState } from '../../common/views.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { ViewDescriptorService } from '../../services/views/browser/viewDescriptorService.js';
import { MarkdownString } from '../../../base/common/htmlContent.js';

suite('TreeView', function () {

	let instantiationService: TestInstantiationService;
	let treeView: TreeView;
	let largestBatchSize: number = 0;

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	setup(async () => {
		largestBatchSize = 0;
		instantiationService = workbenchInstantiationService(undefined, disposables);
		const viewDescriptorService = disposables.add(instantiationService.createInstance(ViewDescriptorService));
		instantiationService.stub(IViewDescriptorService, viewDescriptorService);
		treeView = disposables.add(instantiationService.createInstance(TreeView, 'testTree', 'Test Title'));
		const getChildrenOfItem = async (element?: ITreeItem): Promise<ITreeItem[] | undefined> => {
			if (element) {
				return undefined;
			} else {
				const rootChildren: ITreeItem[] = [];
				for (let i = 0; i < 100; i++) {
					rootChildren.push({ handle: `item_${i}`, collapsibleState: TreeItemCollapsibleState.Expanded });
				}
				return rootChildren;
			}
		};

		treeView.dataProvider = {
			getChildren: getChildrenOfItem,
			getChildrenBatch: async (elements?: ITreeItem[]): Promise<ITreeItem[][] | undefined> => {
				if (elements && elements.length > largestBatchSize) {
					largestBatchSize = elements.length;
				}
				if (elements) {
					return Array(elements.length).fill([]);
				} else {
					return [(await getChildrenOfItem()) ?? []];
				}
			}
		};
	});

	test('children are batched', async () => {
		assert.strictEqual(largestBatchSize, 0);
		treeView.setVisibility(true);
		await treeView.refresh();
		assert.strictEqual(largestBatchSize, 100);
	});

	test('empty tree and message hiding with data provider and dnd controller', async () => {
		const testTreeView = disposables.add(instantiationService.createInstance(TreeView, 'testTreeEmpty', 'Test Title'));
		testTreeView.setVisibility(true);
		const container = document.createElement('div');
		testTreeView.show(container);

		const messageElement = container.querySelector('.message') as HTMLElement;
		const treeContainer = container.querySelector('.customview-tree') as HTMLElement;
		assert.ok(messageElement);
		assert.ok(treeContainer);

		// 1. 尚无 dataProvider 时，.message 没有 hide，文案为 no data provider
		assert.strictEqual(messageElement.classList.contains('hide'), false);
		assert.ok(messageElement.textContent?.includes('There is no data provider registered'));

		// 2. 再设 dataProvider，且 getChildren 对根返回空数组、message 为空：.message 有 hide，.customview-tree 没有 hide
		testTreeView.dataProvider = {
			getChildren: async () => []
		};
		await testTreeView.refresh();
		assert.strictEqual(messageElement.classList.contains('hide'), true);
		assert.strictEqual(treeContainer.classList.contains('hide'), false);

		// 3. 消息曾是 MarkdownString 再被清掉时，渲染用的 DisposableStore 已 dispose
		testTreeView.message = new MarkdownString('Markdown message [link](command:test)');
		assert.strictEqual(messageElement.classList.contains('hide'), false);
		assert.strictEqual(treeContainer.classList.contains('hide'), true);

		testTreeView.message = undefined;
		assert.strictEqual(messageElement.classList.contains('hide'), true);
		assert.strictEqual(treeContainer.classList.contains('hide'), false);

		// 4. 另设 dragAndDropController 且仍在显示消息、树空：.customview-tree 没有 hide
		const dndController: ITreeViewDragAndDropController = {
			dropMimeTypes: [],
			dragMimeTypes: [],
			handleDrag: async () => undefined,
			handleDrop: async () => { }
		};
		testTreeView.dragAndDropController = dndController;
		testTreeView.message = 'custom message with dnd';
		assert.strictEqual(messageElement.classList.contains('hide'), false);
		assert.strictEqual(treeContainer.classList.contains('hide'), false);

		testTreeView.message = undefined;
		assert.strictEqual(messageElement.classList.contains('hide'), true);
		assert.strictEqual(treeContainer.classList.contains('hide'), false);
	});

});
