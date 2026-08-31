/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewContainersRegistry, IViewDescriptorService, IViewsRegistry, ViewContainerLocation } from '../../../../common/views.js';
import { VIEWLET_ID } from '../../../files/common/files.js';
import { VIEW_CONTAINER as EXPLORER_VIEW_CONTAINER } from '../../../files/browser/explorerViewlet.js';
import { ChatEditorInput } from '../../../chat/browser/widgetHosts/editor/chatEditorInput.js';
import { CONVERSATION_SESSIONS_CONTAINER_ID } from '../../../conversation/browser/conversation.contribution.js';
import { CONVERSATION_SESSIONS_VIEW_ID } from '../../../conversation/browser/conversationSessionsView.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import {
	NAVIGATOR_AGENTS_VIEW_ID,
	NAVIGATOR_PROJECTS_VIEW_ID,
	NAVIGATOR_STUB_VIEW_IDS,
	NAVIGATOR_TEAM_VIEW_ID,
	NavigatorAgentsView,
	NavigatorProjectsView,
	NavigatorTeamView,
} from '../../browser/navigatorStubView.js';
import {
	NAVIGATOR_AGENTS_CONTAINER_ID,
	NAVIGATOR_AGENTS_VIEW_CONTAINER,
	NAVIGATOR_PROJECTS_CONTAINER_ID,
	NAVIGATOR_PROJECTS_VIEW_CONTAINER,
	NAVIGATOR_TEAM_CONTAINER_ID,
	NAVIGATOR_TEAM_VIEW_CONTAINER,
} from '../../browser/navigator.contribution.js';
import '../../../conversation/browser/conversation.contribution.js';
import '../../browser/navigator.contribution.js';

suite('Navigator stub views', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
	const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

	const navigatorContainerCases = [
		{ viewId: NAVIGATOR_PROJECTS_VIEW_ID, containerId: NAVIGATOR_PROJECTS_CONTAINER_ID, container: NAVIGATOR_PROJECTS_VIEW_CONTAINER },
		{ viewId: NAVIGATOR_AGENTS_VIEW_ID, containerId: NAVIGATOR_AGENTS_CONTAINER_ID, container: NAVIGATOR_AGENTS_VIEW_CONTAINER },
		{ viewId: NAVIGATOR_TEAM_VIEW_ID, containerId: NAVIGATOR_TEAM_CONTAINER_ID, container: NAVIGATOR_TEAM_VIEW_CONTAINER },
	] as const;

	test('Projects, Agents, and Team views register on dedicated Sidebar ViewContainers', () => {
		for (const { viewId, containerId, container } of navigatorContainerCases) {
			const descriptor = viewsRegistry.getView(viewId);
			assert.ok(descriptor, `expected view descriptor for ${viewId}`);
			assert.strictEqual(descriptor.canToggleVisibility, true);
			assert.strictEqual(viewsRegistry.getViewContainer(viewId), container);
			assert.strictEqual(container.id, containerId);
			assert.strictEqual(viewContainersRegistry.getViewContainerLocation(container), ViewContainerLocation.Sidebar);
		}
	});

	test('Sessions view registers on dedicated Sidebar ViewContainer', () => {
		const sessionsContainer = viewContainersRegistry.get(CONVERSATION_SESSIONS_CONTAINER_ID);
		assert.ok(sessionsContainer);
		assert.strictEqual(viewContainersRegistry.getViewContainerLocation(sessionsContainer), ViewContainerLocation.Sidebar);
		assert.strictEqual(viewsRegistry.getViewContainer(CONVERSATION_SESSIONS_VIEW_ID), sessionsContainer);
		assert.notStrictEqual(viewsRegistry.getViewContainer(CONVERSATION_SESSIONS_VIEW_ID), EXPLORER_VIEW_CONTAINER);
	});

	test('Navigator stub ViewContainers use hideIfEmpty and are non-default', () => {
		for (const { containerId, container } of navigatorContainerCases) {
			assert.strictEqual(container.hideIfEmpty, true, `${containerId} must keep hideIfEmpty`);
		}
	});

	test('Navigator Agents and Team ViewContainers are Sidebar non-default composites', () => {
		const defaultSidebarContainers = viewContainersRegistry.getDefaultViewContainers(ViewContainerLocation.Sidebar);
		const nonDefaultContainerIds = [
			CONVERSATION_SESSIONS_CONTAINER_ID,
			NAVIGATOR_AGENTS_CONTAINER_ID,
			NAVIGATOR_TEAM_CONTAINER_ID,
		];

		for (const containerId of nonDefaultContainerIds) {
			assert.ok(!defaultSidebarContainers.some(container => container.id === containerId), `${containerId} must not be default`);
		}
	});

	test('Navigator Projects is the default Sidebar composite', () => {
		const defaultSidebarContainers = viewContainersRegistry.getDefaultViewContainers(ViewContainerLocation.Sidebar);
		assert.ok(defaultSidebarContainers.some(container => container.id === NAVIGATOR_PROJECTS_CONTAINER_ID));
		assert.ok(!defaultSidebarContainers.some(container => container.id === VIEWLET_ID));
		assert.ok(!defaultSidebarContainers.some(container => container.id === NAVIGATOR_AGENTS_CONTAINER_ID));
		assert.ok(!defaultSidebarContainers.some(container => container.id === NAVIGATOR_TEAM_CONTAINER_ID));
		assert.ok(!defaultSidebarContainers.some(container => container.id === CONVERSATION_SESSIONS_CONTAINER_ID));

		for (const viewId of NAVIGATOR_STUB_VIEW_IDS) {
			assert.notStrictEqual(viewsRegistry.getViewContainer(viewId), EXPLORER_VIEW_CONTAINER);
		}
		assert.notStrictEqual(viewsRegistry.getViewContainer(CONVERSATION_SESSIONS_VIEW_ID), EXPLORER_VIEW_CONTAINER);
	});

	test('stub view descriptors do not reference ChatEditorInput', () => {
		for (const viewId of NAVIGATOR_STUB_VIEW_IDS) {
			const descriptor = viewsRegistry.getView(viewId)!;
			assert.notStrictEqual(descriptor.ctorDescriptor.ctor, ChatEditorInput);
		}
	});

	test('stub views render honest empty state without ChatEditorInput', () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IViewDescriptorService, new class extends mock<IViewDescriptorService>() {
			override getViewLocationById(): ViewContainerLocation {
				return ViewContainerLocation.Sidebar;
			}
		}());

		const cases: Array<{ id: string; ctor: typeof NavigatorProjectsView | typeof NavigatorAgentsView | typeof NavigatorTeamView; label: string }> = [
			{ id: NAVIGATOR_PROJECTS_VIEW_ID, ctor: NavigatorProjectsView, label: 'Projects' },
			{ id: NAVIGATOR_AGENTS_VIEW_ID, ctor: NavigatorAgentsView, label: 'Agents' },
			{ id: NAVIGATOR_TEAM_VIEW_ID, ctor: NavigatorTeamView, label: 'Team' },
		];

		for (const { id, ctor, label } of cases) {
			const view = store.add(instantiationService.createInstance(ctor, { id, title: label }));
			const container = document.createElement('div');
			view.render();
			container.appendChild(view.element);
			view.setExpanded(true);
			view.setVisible(true);

			const empty = view.element.querySelector('.navigator-stub-empty');
			assert.ok(empty, `expected empty stub body for ${id}`);
			assert.ok(empty.textContent?.includes('not connected'));
			assert.ok(empty.textContent?.includes('no engine'));
			assert.ok(!empty.textContent?.match(/copilot/i), `stub body must not mention Copilot (${id})`);
			assert.ok(!empty.textContent?.match(/open chat/i), `stub body must not mention Open Chat (${id})`);
			assert.strictEqual(view.element.querySelector('.chat-widget'), null);
			assert.strictEqual(view.element.querySelector('.chat-setup'), null);
		}
	});
});
