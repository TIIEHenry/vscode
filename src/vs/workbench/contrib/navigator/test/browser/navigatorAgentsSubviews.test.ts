/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { WorkbenchList, WorkbenchObjectTree } from '../../../../../platform/list/browser/listService.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { Extensions as ViewExtensions, IViewContainerModel, IViewDescriptorService, IViewsRegistry, ViewContainer, ViewContainerLocation } from '../../../../common/views.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { ConversationStubService, IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import { IAgentInspectService } from '../../common/agentInspect.js';
import { AgentInspectService } from '../../browser/agentInspectService.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import type { INavigatorAgentsHierarchyNode } from '../../common/navigatorAgentHierarchy.js';
import type { INavigatorAgentsActivityItem } from '../../common/navigatorAgentsActivity.js';
import { createNavigatorConnectionTestStub } from '../common/navigatorConnectionTestStub.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { OPEN_NAVIGATOR_AGENTS_INSPECT_COMMAND_ID } from '../../browser/agentInspectIds.js';
import '../../browser/navigator.contribution.js';
import {
	NAVIGATOR_AGENTS_SHOW_ACTIVITY_COMMAND_ID,
	NAVIGATOR_AGENTS_SHOW_HIERARCHY_COMMAND_ID,
	NAVIGATOR_AGENTS_VIEW_ID,
	NavigatorAgentsView,
} from '../../browser/navigatorAgentsView.js';

suite('Navigator Agents subviews', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountAgentsView(): NavigatorAgentsView {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, store.add(new ConversationStubService()));
		instantiationService.stub(IAgentInspectService, store.add(instantiationService.createInstance(AgentInspectService)) as IAgentInspectService);
		instantiationService.stub(ICommandService, { executeCommand: async () => undefined });
		instantiationService.stub(IUniverseAgentConnection, createNavigatorConnectionTestStub());
		const stubViewContainer = {
			id: 'navigator-agents-test-container',
			title: { value: 'Agents', original: 'Agents' },
		} as ViewContainer;
		instantiationService.stub(IViewDescriptorService, {
			onDidChangeLocation: Event.None,
			getViewLocationById(_id: string): ViewContainerLocation {
				return ViewContainerLocation.Sidebar;
			},
			getViewDescriptorById(_id: string): null {
				return null;
			},
			getViewContainerByViewId(_id: string): ViewContainer | null {
				return stubViewContainer;
			},
			getViewContainerModel(_viewContainer: ViewContainer): IViewContainerModel {
				return {
					title: stubViewContainer.title.value,
					onDidChangeContainerInfo: Event.None,
				} as IViewContainerModel;
			},
			getDefaultContainerById(_id: string): ViewContainer | null {
				return stubViewContainer;
			},
		});

		const view = store.add(instantiationService.createInstance(NavigatorAgentsView, {
			id: NAVIGATOR_AGENTS_VIEW_ID,
			title: 'Agents',
		}));
		const container = document.createElement('div');
		view.render();
		container.appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);
		return view;
	}

	function getFilterInput(view: NavigatorAgentsView): HTMLInputElement | null {
		return view.element.querySelector('.navigator-agents-inline-filter-input');
	}

	function hierarchyNode(id: string, label: string): INavigatorAgentsHierarchyNode {
		return {
			id,
			label,
			agentId: id,
			type: 'AGENT_TYPE_SUB',
			status: 'AGENT_STATUS_IDLE',
			model: 'm',
			turnCount: 0,
			source: {
				agentId: id,
				name: label,
				type: 'AGENT_TYPE_SUB',
				status: 'AGENT_STATUS_IDLE',
				model: 'm',
				turnCount: 0,
				createdAt: 0,
				children: [],
			},
		};
	}

	function activityItem(id: string, label: string): INavigatorAgentsActivityItem {
		return { id, label, toolName: label, status: 'completed', itemId: id };
	}

	function setHierarchyEntries(view: NavigatorAgentsView, entries: { id: string; label: string }[]): void {
		(view as unknown as { setHierarchyEntries: (entries: INavigatorAgentsHierarchyNode[]) => void }).setHierarchyEntries(entries.map(entry => hierarchyNode(entry.id, entry.label)));
	}

	function setActivityEntries(view: NavigatorAgentsView, entries: { id: string; label: string }[]): void {
		(view as unknown as { setActivityEntries: (entries: INavigatorAgentsActivityItem[]) => void }).setActivityEntries(entries.map(entry => activityItem(entry.id, entry.label)));
	}

	async function setFilterQuery(view: NavigatorAgentsView, query: string): Promise<void> {
		const input = getFilterInput(view);
		assert.ok(input, 'filter input must exist');
		input.value = query;
		input.dispatchEvent(new globalThis.Event('input'));
		await new Promise<void>(resolve => setTimeout(resolve, 0));
	}

	test('ViewTitle registers Hierarchy, Activity, and Inspect actions for Agents', () => {
		const viewTitleItems = MenuRegistry.getMenuItems(MenuId.ViewTitle).filter(isIMenuItem);
		const hierarchyItem = viewTitleItems.find(item => item.command.id === NAVIGATOR_AGENTS_SHOW_HIERARCHY_COMMAND_ID);
		const activityItem = viewTitleItems.find(item => item.command.id === NAVIGATOR_AGENTS_SHOW_ACTIVITY_COMMAND_ID);
		const inspectItem = viewTitleItems.find(item => item.command.id === OPEN_NAVIGATOR_AGENTS_INSPECT_COMMAND_ID);

		assert.ok(hierarchyItem, 'Agents ViewTitle must expose Hierarchy');
		assert.ok(activityItem, 'Agents ViewTitle must expose Activity');
		assert.ok(inspectItem, 'Agents ViewTitle must still expose Inspect');
	});

	test('defaults to Hierarchy subview with honest empty state', () => {
		const view = mountAgentsView();

		assert.strictEqual(view.getActiveSubview(), 'hierarchy');

		const hierarchySubview = view.element.querySelector('.navigator-agents-subview.active');
		assert.ok(hierarchySubview, 'expected active hierarchy subview');
		assert.ok(hierarchySubview.classList.contains('navigator-agents-subview'));

		const hierarchyEmpty = view.element.querySelector('.navigator-agents-subview.active .navigator-stub-empty');
		assert.ok(hierarchyEmpty);
		assert.strictEqual(hierarchyEmpty?.textContent, 'No agents — no engine.');
		assert.ok(!hierarchyEmpty?.textContent?.match(/copilot/i));
		assert.ok(!hierarchyEmpty?.textContent?.match(/not connected/i));

		const activityEmpty = view.element.querySelector('.navigator-agents-subview:not(.active) .navigator-stub-empty');
		assert.ok(activityEmpty);
		assert.strictEqual(activityEmpty?.textContent, 'No tool activity — no engine.');
	});

	test('switches between Hierarchy and Activity subviews', () => {
		const view = mountAgentsView();

		view.showActivity();
		assert.strictEqual(view.getActiveSubview(), 'activity');

		let activeSubview = view.element.querySelector('.navigator-agents-subview.active');
		assert.ok(activeSubview?.querySelector('.navigator-agents-activity-list'));

		view.showHierarchy();
		assert.strictEqual(view.getActiveSubview(), 'hierarchy');

		activeSubview = view.element.querySelector('.navigator-agents-subview.active');
		assert.ok(activeSubview?.querySelector('.navigator-agents-hierarchy-tree'));
	});

	test('creates WorkbenchObjectTree and WorkbenchList bodies without engine data', () => {
		const view = mountAgentsView();

		const hierarchyTree = (view as unknown as { hierarchyTree: WorkbenchObjectTree<{ id: string; label: string }, void> }).hierarchyTree;
		const activityList = (view as unknown as { activityList: WorkbenchList<{ id: string; label: string }> }).activityList;

		assert.ok(hierarchyTree, 'expected WorkbenchObjectTree for hierarchy');
		assert.ok(activityList, 'expected WorkbenchList for activity');
		assert.strictEqual(hierarchyTree.getNode(null)?.children.length ?? 0, 0);
		assert.strictEqual(activityList.length, 0);
		assert.strictEqual(view.element.querySelector('.chat-widget'), null);
		assert.strictEqual(view.element.querySelector('.chat-setup'), null);
	});

	test('Agents view descriptor registers NavigatorAgentsView ctor', () => {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const descriptor = viewsRegistry.getView(NAVIGATOR_AGENTS_VIEW_ID);
		assert.ok(descriptor);
		assert.strictEqual(descriptor.ctorDescriptor.ctor, NavigatorAgentsView);
	});

	test('body-top filter sits above subview content with Filter agents placeholder', () => {
		const view = mountAgentsView();

		const filter = view.element.querySelector('.navigator-agents-inline-filter');
		assert.ok(filter, 'expected body-top filter chrome');

		const input = getFilterInput(view);
		assert.ok(input);
		assert.strictEqual(input?.placeholder, 'Filter agents');
		assert.strictEqual(input?.getAttribute('aria-label'), 'Filter agents');

		const body = view.element.querySelector('.navigator-agents-view');
		assert.ok(body);
		const children = Array.from(body!.children);
		assert.strictEqual(children[0], filter, 'filter must be first in body');
		assert.ok(children[1]?.classList.contains('navigator-agents-subview'));

		const clearButton = view.element.querySelector('.navigator-agents-inline-filter-clear') as HTMLElement | null;
		assert.ok(clearButton);
		assert.strictEqual(filter?.classList.contains('has-text'), false);

		assert.strictEqual(view.element.querySelector('.navigator-agents-type-filter'), null);
		assert.strictEqual(view.element.querySelector('.navigator-panel-body-filter-status'), null);
	});

	test('shared filter query live-filters hierarchy and activity lists', async () => {
		const view = mountAgentsView();

		setHierarchyEntries(view, [
			{ id: 'h1', label: 'Alpha Agent' },
			{ id: 'h2', label: 'Beta Agent' },
		]);
		setActivityEntries(view, [
			{ id: 'a1', label: 'Alpha Tool Run' },
			{ id: 'a2', label: 'Gamma Tool Run' },
		]);

		const hierarchyTree = (view as unknown as { hierarchyTree: WorkbenchObjectTree<{ id: string; label: string }, void> }).hierarchyTree;
		const activityList = (view as unknown as { activityList: WorkbenchList<{ id: string; label: string }> }).activityList;

		assert.strictEqual(hierarchyTree.getNode(null)?.children.length ?? 0, 2);
		assert.strictEqual(activityList.length, 2);

		await setFilterQuery(view, 'alpha');

		assert.strictEqual(hierarchyTree.getNode(null)?.children.length ?? 0, 1);
		assert.strictEqual(activityList.length, 1);
		assert.strictEqual(hierarchyTree.getNode(null)?.children[0]?.element?.label, 'Alpha Agent');
		assert.strictEqual(activityList.element(0)?.label, 'Alpha Tool Run');

		view.showActivity();
		assert.strictEqual(view.getActiveSubview(), 'activity');
		assert.strictEqual(getFilterInput(view)?.value, 'alpha');
		assert.strictEqual(activityList.length, 1);

		const filter = view.element.querySelector('.navigator-agents-inline-filter');
		const activeSubview = view.element.querySelector('.navigator-agents-subview.active');
		assert.ok(filter && activeSubview);
		assert.ok(filter!.compareDocumentPosition(activeSubview!) & Node.DOCUMENT_POSITION_FOLLOWING);
	});

	test('unfiltered empty keeps honest empty copy and hides list or tree', () => {
		const view = mountAgentsView();

		const hierarchyEmpty = view.element.querySelector('.navigator-agents-subview.active .navigator-stub-empty') as HTMLElement | null;
		const hierarchyTree = view.element.querySelector('.navigator-agents-hierarchy-tree') as HTMLElement | null;
		assert.ok(hierarchyEmpty);
		assert.ok(hierarchyTree);
		assert.strictEqual(hierarchyEmpty.style.display, 'block');
		assert.strictEqual(hierarchyTree.style.display, 'none');
		assert.strictEqual(hierarchyEmpty.textContent, 'No agents — no engine.');
	});
});
