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
import { VIEW_CONTAINER } from '../../../files/browser/explorerViewlet.js';
import { ChatEditorInput } from '../../../chat/browser/widgetHosts/editor/chatEditorInput.js';
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
import '../../browser/navigator.contribution.js';

suite('Navigator stub views', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
	const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

	test('Projects, Agents, and Team views register on Sidebar Explorer container', () => {
		assert.strictEqual(viewContainersRegistry.getViewContainerLocation(VIEW_CONTAINER), ViewContainerLocation.Sidebar);

		for (const viewId of NAVIGATOR_STUB_VIEW_IDS) {
			const descriptor = viewsRegistry.getView(viewId);
			assert.ok(descriptor, `expected view descriptor for ${viewId}`);
			assert.strictEqual(descriptor.canToggleVisibility, true);
			assert.strictEqual(viewsRegistry.getViewContainer(viewId), VIEW_CONTAINER);
		}
	});

	test('Explorer remains the default Sidebar composite', () => {
		const defaultSidebarContainers = viewContainersRegistry.getDefaultViewContainers(ViewContainerLocation.Sidebar);
		assert.ok(defaultSidebarContainers.some(container => container.id === VIEWLET_ID));
		assert.ok(!defaultSidebarContainers.some(container => container.id === NAVIGATOR_PROJECTS_VIEW_ID));
		assert.ok(!defaultSidebarContainers.some(container => container.id === NAVIGATOR_AGENTS_VIEW_ID));
		assert.ok(!defaultSidebarContainers.some(container => container.id === NAVIGATOR_TEAM_VIEW_ID));
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

		const cases: Array<{ id: string; ctor: typeof NavigatorProjectsView; label: string }> = [
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
			assert.ok(empty.textContent?.includes('not wired'));
			assert.ok(empty.textContent?.includes('no engine'));
			assert.strictEqual(view.element.querySelector('.chat-widget'), null);
			assert.strictEqual(view.element.querySelector('.chat-setup'), null);
		}
	});
});
