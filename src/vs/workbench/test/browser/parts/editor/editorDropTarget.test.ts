/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DataTransfers } from '../../../../../base/browser/dnd.js';
import { DeferredPromise, timeout } from '../../../../../base/common/async.js';
import { createStringDataTransferItem, VSDataTransfer } from '../../../../../base/common/dataTransfer.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { Mimes } from '../../../../../base/common/mime.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { DraggedTreeItemsIdentifier, TreeViewsDnDService } from '../../../../../editor/common/services/treeViewsDnd.js';
import { ITreeViewsDnDService } from '../../../../../editor/common/services/treeViewsDndService.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { LocalSelectionTransfer } from '../../../../../platform/dnd/browser/dnd.js';
import { IEditorGroupView } from '../../../../browser/parts/editor/editor.js';
import { IEditorPane } from '../../../../common/editor.js';
import { GroupDirection, IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { TestEditorParts, TestEditorService, workbenchInstantiationService } from '../../workbenchTestServices.js';

class RecordingEditorService extends TestEditorService {

	readonly opened: { resources: Array<URI | undefined>; group: unknown }[] = [];
	readonly didOpen = new DeferredPromise<void>();

	override async openEditors(editors: unknown[], group?: unknown): Promise<IEditorPane[]> {
		this.opened.push({ resources: editors.map(editor => (editor as { resource?: URI }).resource), group });
		this.didOpen.complete();
		return [];
	}
}

suite('Editor drop target', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();
	const treeItemsTransfer = LocalSelectionTransfer.getInstance<DraggedTreeItemsIdentifier>();

	teardown(() => {
		treeItemsTransfer.clearData(DraggedTreeItemsIdentifier.prototype);
	});

	/**
	 * The drop target resolves its groups from `IEditorGroupsService` when the part is created,
	 * so the real parts must be registered before `create()`; `createEditorPart` creates too early.
	 */
	async function createParts(): Promise<{ parts: TestEditorParts; editorService: RecordingEditorService; treeViewsDnDService: TreeViewsDnDService<VSDataTransfer> }> {
		const editorService = disposables.add(new RecordingEditorService());
		const instantiationService = workbenchInstantiationService({
			configurationService: () => new TestConfigurationService({
				files: { participants: { timeout: 60000 } },
				workbench: { editor: { splitOnDragAndDrop: false } },
			}),
			editorService: () => editorService,
		}, disposables);

		const treeViewsDnDService = new TreeViewsDnDService<VSDataTransfer>();
		instantiationService.stub(ITreeViewsDnDService, treeViewsDnDService);

		const parts = disposables.add(instantiationService.createInstance(TestEditorParts));
		instantiationService.stub(IEditorGroupsService, parts);

		const container = document.createElement('div');
		document.body.appendChild(container);
		disposables.add(toDisposable(() => container.remove()));
		parts.testMainPart.create(container);
		parts.testMainPart.layout(1080, 800, 0, 0);
		await parts.whenReady;

		return { parts, editorService, treeViewsDnDService };
	}

	function resourcesDataTransfer(...resources: URI[]): DataTransfer {
		const dataTransfer = new DataTransfer();
		dataTransfer.setData(DataTransfers.RESOURCES, JSON.stringify(resources.map(resource => resource.toString())));
		return dataTransfer;
	}

	function dragEvent(type: string, dataTransfer: DataTransfer): DragEvent {
		return new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer });
	}

	function dropIntoGroup(group: IEditorGroupView, dataTransfer: DataTransfer): void {
		group.element.dispatchEvent(dragEvent('dragenter', dataTransfer));
		const overlay = group.element.querySelector<HTMLElement>('#monaco-workbench-editor-drop-overlay');
		assert.ok(overlay, 'the drop overlay was not created');
		overlay.dispatchEvent(dragEvent('dragover', dataTransfer));
		overlay.dispatchEvent(dragEvent('drop', dataTransfer));
	}

	function startTreeItemsDrag(treeViewsDnDService: TreeViewsDnDService<VSDataTransfer>, id: string): DeferredPromise<VSDataTransfer | undefined> {
		const transfer = new DeferredPromise<VSDataTransfer | undefined>();
		treeViewsDnDService.addDragOperationTransfer(id, transfer.p);
		treeItemsTransfer.setData([new DraggedTreeItemsIdentifier(id)], DraggedTreeItemsIdentifier.prototype);
		return transfer;
	}

	function uriListTransfer(resource: URI): VSDataTransfer {
		const dataTransfer = new VSDataTransfer();
		dataTransfer.append(Mimes.uriList, createStringDataTransferItem(resource.toString()));
		return dataTransfer;
	}

	function describeOpened(editorService: RecordingEditorService, group: IEditorGroupView) {
		return editorService.opened.map(call => ({
			resources: call.resources.map(resource => resource?.toString()),
			targetGroup: call.group === group,
		}));
	}

	test('dropping resources into the editor area opens them in the target group', async () => {
		const { parts, editorService } = await createParts();
		const group = parts.testMainPart.activeGroup;
		const resource = URI.file('/workspace/dropped.txt');

		dropIntoGroup(group, resourcesDataTransfer(resource));
		await editorService.didOpen.p;

		assert.deepStrictEqual(describeOpened(editorService, group), [{ resources: [resource.toString()], targetGroup: true }]);
	});

	test('dropping tree items into the editor area opens them and clears the tree item transfer', async () => {
		const { parts, editorService, treeViewsDnDService } = await createParts();
		const group = parts.testMainPart.activeGroup;
		const resource = URI.file('/workspace/tree-item.txt');
		const transfer = startTreeItemsDrag(treeViewsDnDService, 'tree-drag');

		dropIntoGroup(group, resourcesDataTransfer());
		await transfer.complete(uriListTransfer(resource));
		await editorService.didOpen.p;

		assert.deepStrictEqual({
			opened: describeOpened(editorService, group),
			transferCleared: !treeItemsTransfer.hasData(DraggedTreeItemsIdentifier.prototype),
		}, {
			opened: [{ resources: [resource.toString()], targetGroup: true }],
			transferCleared: true,
		});
	});

	test('a tree item drop is abandoned when the target group closes while the tree data loads', async () => {
		const { parts, editorService, treeViewsDnDService } = await createParts();
		const target = parts.testMainPart.addGroup(parts.testMainPart.activeGroup, GroupDirection.RIGHT);
		const transfer = startTreeItemsDrag(treeViewsDnDService, 'tree-drag');

		dropIntoGroup(target, resourcesDataTransfer());
		parts.testMainPart.removeGroup(target);
		await transfer.complete(uriListTransfer(URI.file('/workspace/tree-item.txt')));
		await timeout(0);

		assert.deepStrictEqual({
			targetDisposed: target.disposed,
			openCalls: editorService.opened.length,
			transferCleared: !treeItemsTransfer.hasData(DraggedTreeItemsIdentifier.prototype),
		}, {
			targetDisposed: true,
			openCalls: 0,
			transferCleared: true,
		});
	});

	test('a tree item drop on the tab strip is abandoned when its group closes while the tree data loads', async () => {
		const { parts, editorService, treeViewsDnDService } = await createParts();
		const target = parts.testMainPart.addGroup(parts.testMainPart.activeGroup, GroupDirection.RIGHT);
		const tabsContainer = target.element.querySelector<HTMLElement>('.tabs-container');
		assert.ok(tabsContainer, 'the group has no tab strip');
		const transfer = startTreeItemsDrag(treeViewsDnDService, 'tree-drag');

		tabsContainer.dispatchEvent(dragEvent('drop', resourcesDataTransfer()));
		parts.testMainPart.removeGroup(target);
		await transfer.complete(uriListTransfer(URI.file('/workspace/tree-item.txt')));
		await timeout(0);

		assert.deepStrictEqual({
			openCalls: editorService.opened.length,
			transferCleared: !treeItemsTransfer.hasData(DraggedTreeItemsIdentifier.prototype),
		}, {
			openCalls: 0,
			transferCleared: true,
		});
	});
});
