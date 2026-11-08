/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../base/common/event.js';
import { DisposableStore } from '../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { CommandsRegistry } from '../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../platform/instantiation/common/instantiation.js';
import { FocusSourcesActionId, ToggleSourcesVisibilityActionId } from '../../browser/actions/layoutActions.js';
import { Layout } from '../../browser/layout.js';
import { IConversationPartService } from '../../browser/parts/conversation/conversationPart.js';
import { ISourcesPartService } from '../../browser/parts/sources/sourcesPart.js';
import { IViewDescriptorService, ViewContainerLocation } from '../../common/views.js';
import { IAuxiliaryWindowService } from '../../services/auxiliaryWindow/browser/auxiliaryWindowService.js';
import { IEditorGroupsService } from '../../services/editor/common/editorGroupsService.js';
import { Parts } from '../../services/layout/browser/layoutService.js';
import { IPaneCompositePartService } from '../../services/panecomposite/browser/panecomposite.js';
import { ITitleService } from '../../services/title/browser/titleService.js';
import { createEditorParts, workbenchInstantiationService } from './workbenchTestServices.js';

suite('Layout - Sources while the auxiliary bar is maximized', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const disposables = store as unknown as DisposableStore;

	class AuxiliaryBarMaximizeTestLayout extends Layout {
		initialize(accessor: ServicesAccessor): void {
			this.initLayout(accessor);
		}
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

	/**
	 * Creates a layout with Preview visible and the panel hidden. Focus requests that reach
	 * Sources or the active auxiliary bar pane composite are recorded in `focusCalls`.
	 */
	async function createLayout(focusCalls: string[] = []): Promise<AuxiliaryBarMaximizeTestLayout> {
		const instantiationService = workbenchInstantiationService(undefined, disposables);
		instantiationService.stub(IConversationPartService, { _serviceBrand: undefined } as IConversationPartService);
		instantiationService.stub(ISourcesPartService, {
			_serviceBrand: undefined,
			focus: () => { focusCalls.push('sources'); },
		} as unknown as ISourcesPartService);
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
		const auxiliaryBarPaneComposite = { focus: () => { focusCalls.push('auxiliaryBar'); } };
		instantiationService.stub(IPaneCompositePartService, {
			_serviceBrand: undefined,
			onDidPaneCompositeOpen: Event.None,
			onDidPaneCompositeClose: Event.None,
			getActivePaneComposite: (location: ViewContainerLocation) => location === ViewContainerLocation.AuxiliaryBar ? auxiliaryBarPaneComposite : undefined,
			getPaneCompositeIds: () => [],
			getVisiblePaneCompositeIds: () => [],
			getLastActivePaneCompositeId: () => undefined,
			openPaneComposite: async () => undefined,
			hideActivePaneComposite: () => { },
		} as unknown as IPaneCompositePartService);
		const parts = await createEditorParts(instantiationService, disposables);
		disposables.add(parts);
		instantiationService.stub(IEditorGroupsService, parts);

		const layout = disposables.add(new AuxiliaryBarMaximizeTestLayout(document.createElement('div'), { resetLayout: true }));
		instantiationService.invokeFunction(accessor => layout.initialize(accessor));
		stubWorkbenchGrid(layout);

		layout.setPartHidden(true, Parts.PANEL_PART);
		layout.setPartHidden(false, Parts.EDITOR_PART);

		return layout;
	}

	function runLayoutCommand(commandId: string, layout: Layout): void {
		const command = CommandsRegistry.getCommand(commandId);
		assert.ok(command, `missing command ${commandId}`);
		command.handler({ get: () => layout } as unknown as ServicesAccessor);
	}

	test('showing hidden Sources leaves the maximized auxiliary bar', async () => {
		const layout = await createLayout();
		layout.setPartHidden(true, Parts.SOURCES_PART);
		layout.setAuxiliaryBarMaximized(true);

		layout.setPartHidden(false, Parts.SOURCES_PART);

		assert.deepStrictEqual({
			maximized: layout.isAuxiliaryBarMaximized(),
			preview: layout.isVisible(Parts.EDITOR_PART),
			sources: layout.isVisible(Parts.SOURCES_PART),
		}, {
			maximized: false,
			preview: true,
			sources: true,
		});
	});

	test('Sources stays visible when Preview is shown or the auxiliary bar is restored afterwards', async () => {
		const layout = await createLayout();
		layout.setPartHidden(true, Parts.SOURCES_PART);
		layout.setAuxiliaryBarMaximized(true);
		layout.setPartHidden(false, Parts.SOURCES_PART);

		layout.setPartHidden(false, Parts.EDITOR_PART);
		layout.setAuxiliaryBarMaximized(false);

		assert.strictEqual(layout.isVisible(Parts.SOURCES_PART), true);
	});

	test('showing Sources while maximized restores Preview and Sources from the snapshot', async () => {
		const layout = await createLayout();
		layout.setAuxiliaryBarMaximized(true);
		const whileMaximized = {
			preview: layout.isVisible(Parts.EDITOR_PART),
			sources: layout.isVisible(Parts.SOURCES_PART),
		};

		layout.setPartHidden(false, Parts.SOURCES_PART);

		assert.deepStrictEqual({
			whileMaximized,
			maximized: layout.isAuxiliaryBarMaximized(),
			preview: layout.isVisible(Parts.EDITOR_PART),
			sources: layout.isVisible(Parts.SOURCES_PART),
		}, {
			whileMaximized: { preview: false, sources: false },
			maximized: false,
			preview: true,
			sources: true,
		});
	});

	test('showing Conversation keeps the auxiliary bar maximized', async () => {
		const layout = await createLayout();
		layout.setAuxiliaryBarMaximized(true);

		layout.setPartHidden(true, Parts.CONVERSATION_PART);
		layout.setPartHidden(false, Parts.CONVERSATION_PART);

		assert.deepStrictEqual({
			maximized: layout.isAuxiliaryBarMaximized(),
			conversation: layout.isVisible(Parts.CONVERSATION_PART),
		}, {
			maximized: true,
			conversation: true,
		});
	});

	test('Focus Sources leaves the maximized auxiliary bar and ends with focus on Sources', async () => {
		const focusCalls: string[] = [];
		const layout = await createLayout(focusCalls);
		layout.setPartHidden(true, Parts.SOURCES_PART);
		layout.setAuxiliaryBarMaximized(true);
		focusCalls.length = 0;

		runLayoutCommand(FocusSourcesActionId, layout);

		assert.deepStrictEqual({
			maximized: layout.isAuxiliaryBarMaximized(),
			sources: layout.isVisible(Parts.SOURCES_PART),
			focusCalls,
		}, {
			maximized: false,
			sources: true,
			focusCalls: ['auxiliaryBar', 'sources'],
		});
	});

	test('toggling Sources without the keyboard focus argument leaves focus on the auxiliary bar', async () => {
		const focusCalls: string[] = [];
		const layout = await createLayout(focusCalls);
		layout.setPartHidden(true, Parts.SOURCES_PART);
		layout.setAuxiliaryBarMaximized(true);
		focusCalls.length = 0;

		runLayoutCommand(ToggleSourcesVisibilityActionId, layout);

		assert.deepStrictEqual({
			maximized: layout.isAuxiliaryBarMaximized(),
			sources: layout.isVisible(Parts.SOURCES_PART),
			focusCalls,
		}, {
			maximized: false,
			sources: true,
			focusCalls: ['auxiliaryBar'],
		});
	});
});
