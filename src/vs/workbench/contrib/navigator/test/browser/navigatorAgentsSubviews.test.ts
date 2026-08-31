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
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { OPEN_NAVIGATOR_AGENTS_INSPECT_COMMAND_ID } from '../../browser/agentInspectIds.js';
import '../../browser/navigator.contribution.js';
import {
	NAVIGATOR_AGENTS_SHOW_ACTIVITY_COMMAND_ID,
	NAVIGATOR_AGENTS_SHOW_HIERARCHY_COMMAND_ID,
	NAVIGATOR_AGENTS_VIEW_ID,
	NavigatorAgentsView,
} from '../../browser/navigatorStubView.js';

suite('Navigator Agents subviews', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountAgentsView(): NavigatorAgentsView {
		const instantiationService = workbenchInstantiationService(undefined, store);
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
});
