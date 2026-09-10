/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainerLocation } from '../../../../common/views.js';
import { VIEWLET_ID } from '../../../files/common/files.js';
import { VIEW_CONTAINER as EXPLORER_VIEW_CONTAINER } from '../../../files/browser/explorerViewlet.js';
import { ChatEditorInput } from '../../../chat/browser/widgetHosts/editor/chatEditorInput.js';
import { CONVERSATION_SESSIONS_CONTAINER_ID } from '../../../conversation/browser/conversation.contribution.js';
import { CONVERSATION_SESSIONS_VIEW_ID } from '../../../conversation/browser/conversationSessionsView.js';
import {
	NAVIGATOR_AGENTS_VIEW_ID,
	NAVIGATOR_PROJECTS_VIEW_ID,
	NAVIGATOR_TEAM_VIEW_ID,
	NAVIGATOR_VIEW_IDS,
} from '../../browser/navigatorStubView.js';
import { NavigatorProjectsView } from '../../browser/navigatorProjectsList.js';
import { NavigatorAgentsView } from '../../browser/navigatorAgentsView.js';
import { NavigatorTeamView } from '../../browser/navigatorTeamList.js';
import {
	NAVIGATOR_AGENTS_CONTAINER_ID,
	NAVIGATOR_AGENTS_VIEW_CONTAINER,
	NAVIGATOR_PROJECTS_CONTAINER_ID,
	NAVIGATOR_PROJECTS_VIEW_CONTAINER,
	NAVIGATOR_TEAM_CONTAINER_ID,
	NAVIGATOR_TEAM_VIEW_CONTAINER,
} from '../../browser/navigator.contribution.js';

suite('Navigator stub views', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
	const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

	const productFourSegments = [
		{ viewId: NAVIGATOR_PROJECTS_VIEW_ID, containerId: NAVIGATOR_PROJECTS_CONTAINER_ID, container: NAVIGATOR_PROJECTS_VIEW_CONTAINER },
		{ viewId: NAVIGATOR_AGENTS_VIEW_ID, containerId: NAVIGATOR_AGENTS_CONTAINER_ID, container: NAVIGATOR_AGENTS_VIEW_CONTAINER },
		{ viewId: NAVIGATOR_TEAM_VIEW_ID, containerId: NAVIGATOR_TEAM_CONTAINER_ID, container: NAVIGATOR_TEAM_VIEW_CONTAINER },
		{ viewId: CONVERSATION_SESSIONS_VIEW_ID, containerId: CONVERSATION_SESSIONS_CONTAINER_ID, container: viewContainersRegistry.get(CONVERSATION_SESSIONS_CONTAINER_ID)! },
	] as const;

	test('Projects, Agents, Team, and Sessions views register on dedicated Sidebar ViewContainers', () => {
		for (const { viewId, containerId, container } of productFourSegments) {
			const descriptor = viewsRegistry.getView(viewId);
			assert.ok(descriptor, `expected view descriptor for ${viewId}`);
			assert.strictEqual(descriptor.canToggleVisibility, false, `${viewId} must keep canToggleVisibility false`);
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

	test('Product four segments use hideIfEmpty false and Explorer keeps hideIfEmpty true', () => {
		const defaultSidebarContainers = viewContainersRegistry.getDefaultViewContainers(ViewContainerLocation.Sidebar);
		for (const { containerId, container } of productFourSegments) {
			assert.strictEqual(container.hideIfEmpty, false, `${containerId} must keep hideIfEmpty false`);
			assert.ok(!defaultSidebarContainers.some(c => c.id === containerId), `${containerId} must not be default`);
		}
		assert.strictEqual(EXPLORER_VIEW_CONTAINER.hideIfEmpty, true, 'Explorer must keep hideIfEmpty true');
	});

	test('Navigator and Sessions ViewContainers are Sidebar non-default composites', () => {
		const defaultSidebarContainers = viewContainersRegistry.getDefaultViewContainers(ViewContainerLocation.Sidebar);
		const nonDefaultContainerIds = [
			CONVERSATION_SESSIONS_CONTAINER_ID,
			NAVIGATOR_PROJECTS_CONTAINER_ID,
			NAVIGATOR_AGENTS_CONTAINER_ID,
			NAVIGATOR_TEAM_CONTAINER_ID,
		];

		for (const containerId of nonDefaultContainerIds) {
			assert.ok(!defaultSidebarContainers.some(container => container.id === containerId), `${containerId} must not be default`);
		}
	});

	test('Files explorer is the default Sidebar composite', () => {
		const defaultSidebarContainers = viewContainersRegistry.getDefaultViewContainers(ViewContainerLocation.Sidebar);
		assert.ok(defaultSidebarContainers.some(container => container.id === VIEWLET_ID));
		assert.ok(defaultSidebarContainers.some(container => container.id === EXPLORER_VIEW_CONTAINER.id));
		assert.ok(!defaultSidebarContainers.some(container => container.id === NAVIGATOR_PROJECTS_CONTAINER_ID));
		assert.ok(!defaultSidebarContainers.some(container => container.id === NAVIGATOR_AGENTS_CONTAINER_ID));
		assert.ok(!defaultSidebarContainers.some(container => container.id === NAVIGATOR_TEAM_CONTAINER_ID));
		assert.ok(!defaultSidebarContainers.some(container => container.id === CONVERSATION_SESSIONS_CONTAINER_ID));

		for (const viewId of NAVIGATOR_VIEW_IDS) {
			assert.notStrictEqual(viewsRegistry.getViewContainer(viewId), EXPLORER_VIEW_CONTAINER);
		}
		assert.notStrictEqual(viewsRegistry.getViewContainer(CONVERSATION_SESSIONS_VIEW_ID), EXPLORER_VIEW_CONTAINER);
	});

	test('view descriptors do not reference ChatEditorInput', () => {
		for (const viewId of NAVIGATOR_VIEW_IDS) {
			const descriptor = viewsRegistry.getView(viewId)!;
			assert.notStrictEqual(descriptor.ctorDescriptor.ctor, ChatEditorInput);
		}
	});

	test('Projects, Agents, and Team descriptors register the real view ctors', () => {
		const projects = viewsRegistry.getView(NAVIGATOR_PROJECTS_VIEW_ID);
		const agents = viewsRegistry.getView(NAVIGATOR_AGENTS_VIEW_ID);
		const team = viewsRegistry.getView(NAVIGATOR_TEAM_VIEW_ID);
		assert.ok(projects);
		assert.ok(agents);
		assert.ok(team);
		assert.strictEqual(projects.ctorDescriptor.ctor, NavigatorProjectsView);
		assert.strictEqual(agents.ctorDescriptor.ctor, NavigatorAgentsView);
		assert.strictEqual(team.ctorDescriptor.ctor, NavigatorTeamView);
		assert.notStrictEqual(projects.ctorDescriptor.ctor, agents.ctorDescriptor.ctor);
		assert.notStrictEqual(projects.ctorDescriptor.ctor, team.ctorDescriptor.ctor);
		assert.notStrictEqual(agents.ctorDescriptor.ctor, team.ctorDescriptor.ctor);
	});
});
