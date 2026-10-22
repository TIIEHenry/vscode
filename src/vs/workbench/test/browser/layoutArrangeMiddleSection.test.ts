/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ISerializedNode } from '../../../base/browser/ui/grid/grid.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { Event } from '../../../base/common/event.js';
import { ServicesAccessor } from '../../../platform/instantiation/common/instantiation.js';
import { CONVERSATION_PART_MINIMUM_WIDTH, IConversationPartService } from '../../browser/parts/conversation/conversationPart.js';
import { ISourcesPartService } from '../../browser/parts/sources/sourcesPart.js';
import { clampConversationEndColumnWidth, Layout } from '../../browser/layout.js';
import { Parts, Position } from '../../services/layout/browser/layoutService.js';
import { ITitleService } from '../../services/title/browser/titleService.js';
import { IAuxiliaryWindowService } from '../../services/auxiliaryWindow/browser/auxiliaryWindowService.js';
import { IViewDescriptorService } from '../../common/views.js';
import { IPaneCompositePartService } from '../../services/panecomposite/browser/panecomposite.js';
import { createEditorParts, workbenchInstantiationService } from './workbenchTestServices.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { IEditorGroupsService } from '../../services/editor/common/editorGroupsService.js';

suite('Layout - arrangeMiddleSectionNodes panel reservation', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;

	class ArrangeMiddleSectionTestLayout extends Layout {
		initialize(accessor: ServicesAccessor): void {
			this.initLayout(accessor);
		}

		arrange(nodes: {
			conversation: ISerializedNode;
			editor: ISerializedNode;
			sources: ISerializedNode;
			panel: ISerializedNode;
			activityBar: ISerializedNode;
			sideBar: ISerializedNode;
			auxiliaryBar: ISerializedNode;
		}, availableWidth: number, availableHeight: number): ISerializedNode[] {
			// eslint-disable-next-line local/code-no-any-casts
			return (this as any).arrangeMiddleSectionNodes(nodes, availableWidth, availableHeight);
		}
	}

	function leaf(size: number): ISerializedNode {
		return { type: 'leaf', size, visible: true, data: {} };
	}

	function baseNodes(panelSize: number) {
		return {
			conversation: leaf(0),
			editor: leaf(480),
			sources: leaf(240),
			panel: leaf(panelSize),
			activityBar: leaf(48),
			sideBar: leaf(300),
			auxiliaryBar: leaf(300),
		};
	}

	function centerSectionHeight(result: ISerializedNode[]): number | undefined {
		for (const node of result) {
			if (node.type === 'branch' && node.data?.length === 2) {
				return node.data[0].size;
			}
		}
		return undefined;
	}

	function stubWorkbenchGrid(target: Layout): void {
		// eslint-disable-next-line local/code-no-any-casts
		const internal = target as any;
		internal.workbenchGrid = {
			setViewVisible: () => { },
			getViewSize: () => ({ width: 480, height: 900 }),
			getViewCachedVisibleSize: () => undefined,
			moveView: () => { },
			moveViewTo: () => { },
			resizeView: () => { },
			layout: () => { },
			edgeSnapping: false,
		};
		internal.conversationPartView = {};
		internal.editorPartView = {};
		internal.sourcesPartView = {};
		internal.panelPartView = {};
		internal.sideBarPartView = {};
		internal.auxiliaryBarPartView = {};
		internal.activityBarPartView = {};
		internal.statusBarPartView = {};

		for (const id of [Parts.ACTIVITYBAR_PART, Parts.SIDEBAR_PART, Parts.CONVERSATION_PART, Parts.PANEL_PART, Parts.AUXILIARYBAR_PART, Parts.EDITOR_PART, Parts.SOURCES_PART, Parts.STATUSBAR_PART]) {
			disposables.add(target.registerPart({
				getId: () => id,
				getContainer: () => document.createElement('div'),
				updateStyles: () => { },
			} as unknown as Parameters<Layout['registerPart']>[0]));
		}
	}

	async function createLayout(): Promise<ArrangeMiddleSectionTestLayout> {
		const instantiationService = workbenchInstantiationService(undefined, disposables);
		instantiationService.stub(IConversationPartService, { _serviceBrand: undefined } as IConversationPartService);
		instantiationService.stub(ISourcesPartService, { _serviceBrand: undefined } as ISourcesPartService);
		instantiationService.stub(ITitleService, {
			_serviceBrand: undefined,
			onMenubarVisibilityChange: () => ({ dispose: () => { } }),
		} as unknown as ITitleService);
		instantiationService.stub(IAuxiliaryWindowService, {
			_serviceBrand: undefined,
			onDidOpenAuxiliaryWindow: Event.None,
		} as unknown as IAuxiliaryWindowService);
		instantiationService.stub(IViewDescriptorService, {
			_serviceBrand: undefined,
			getDefaultViewContainer: () => undefined,
			getViewContainersByLocation: () => [],
			getViewContainerById: () => undefined,
		} as unknown as IViewDescriptorService);
		instantiationService.stub(IPaneCompositePartService, {
			_serviceBrand: undefined,
			onDidPaneCompositeOpen: Event.None,
			onDidPaneCompositeClose: Event.None,
			getActivePaneComposite: () => undefined,
			getPaneCompositeIds: () => [],
			getVisiblePaneCompositeIds: () => [],
			getLastActivePaneCompositeId: () => undefined,
			openPaneComposite: async () => undefined,
			hideActivePaneComposite: () => { },
		} as unknown as IPaneCompositePartService);
		const parts = await createEditorParts(instantiationService, disposables);
		disposables.add(parts);
		instantiationService.stub(IEditorGroupsService, parts);

		const layout = disposables.add(new ArrangeMiddleSectionTestLayout(document.createElement('div'), { resetLayout: true }));
		instantiationService.invokeFunction(accessor => layout.initialize(accessor));
		stubWorkbenchGrid(layout);
		return layout;
	}

	test('visible panel reserves saved size in sidebar and bottom layouts', async () => {
		const layout = await createLayout();
		const panelSize = 300;
		const availableWidth = 1600;
		const availableHeight = 900;

		await layout.setPartHidden(false, Parts.PANEL_PART);
		await layout.setPartHidden(false, Parts.ACTIVITYBAR_PART);
		await layout.setPartHidden(false, Parts.SIDEBAR_PART);
		await layout.setPartHidden(false, Parts.AUXILIARYBAR_PART);
		await layout.setPartHidden(false, Parts.EDITOR_PART);
		await layout.setPartHidden(false, Parts.SOURCES_PART);

		const sideNodes = baseNodes(panelSize);
		layout.setPanelPosition(Position.LEFT);
		layout.arrange(sideNodes, availableWidth, availableHeight);
		assert.strictEqual(sideNodes.conversation.size, CONVERSATION_PART_MINIMUM_WIDTH);

		const bottomNodes = baseNodes(panelSize);
		layout.setPanelPosition(Position.BOTTOM);
		const bottomResult = layout.arrange(bottomNodes, availableWidth, availableHeight);
		assert.strictEqual(centerSectionHeight(bottomResult), availableHeight - panelSize);
	});

	test('hidden panel does not reserve size in sidebar or bottom layouts', async () => {
		const layout = await createLayout();
		const panelSize = 300;
		const availableWidth = 1600;
		const availableHeight = 900;

		await layout.setPartHidden(false, Parts.ACTIVITYBAR_PART);
		await layout.setPartHidden(false, Parts.SIDEBAR_PART);
		await layout.setPartHidden(false, Parts.AUXILIARYBAR_PART);
		await layout.setPartHidden(false, Parts.EDITOR_PART);
		await layout.setPartHidden(false, Parts.SOURCES_PART);

		const sideNodes = baseNodes(panelSize);
		layout.setPanelPosition(Position.LEFT);
		await layout.setPartHidden(true, Parts.PANEL_PART);
		layout.arrange(sideNodes, availableWidth, availableHeight);
		assert.strictEqual(sideNodes.conversation.size, 472);

		const bottomNodes = baseNodes(panelSize);
		layout.setPanelPosition(Position.BOTTOM);
		await layout.setPartHidden(true, Parts.PANEL_PART);
		const bottomResult = layout.arrange(bottomNodes, availableWidth, availableHeight);
		assert.strictEqual(centerSectionHeight(bottomResult), availableHeight);
	});

	test('a persisted end column width does not starve the conversation', () => {
		assert.strictEqual(CONVERSATION_PART_MINIMUM_WIDTH, 450);
		assert.strictEqual(clampConversationEndColumnWidth(1443, 48 + 170, 925), 775);
		assert.strictEqual(clampConversationEndColumnWidth(1600, 48 + 300, 480), 480);
	});
});
