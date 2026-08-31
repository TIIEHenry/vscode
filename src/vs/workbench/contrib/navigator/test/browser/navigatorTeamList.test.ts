/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { ChatEditorInput } from '../../../chat/browser/widgetHosts/editor/chatEditorInput.js';
import { CONVERSATION_STUB_SEED_SESSIONS } from '../../../conversation/browser/conversationStubModel.js';
import { VIEW_CONTAINER as EXPLORER_VIEW_CONTAINER } from '../../../files/browser/explorerViewlet.js';
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewContainerModel, IViewContainersRegistry, IViewDescriptorService, IViewsRegistry, ViewContainer, ViewContainerLocation } from '../../../../common/views.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { NAVIGATOR_TEAM_VIEW_ID } from '../../browser/navigatorStubView.js';
import { NAVIGATOR_TEAM_CONTAINER_ID, NAVIGATOR_TEAM_VIEW_CONTAINER } from '../../browser/navigator.contribution.js';
import { INavigatorTeamMember, NavigatorTeamView } from '../../browser/navigatorTeamList.js';
import '../../browser/navigator.contribution.js';

const TEAM_EMPTY_COPY = 'No team members yet';

suite('NavigatorTeamView', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
	const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

	function getViewList(view: NavigatorTeamView): WorkbenchList<INavigatorTeamMember> {
		return (view as unknown as { list: WorkbenchList<INavigatorTeamMember> }).list;
	}

	function getViewEntries(view: NavigatorTeamView): INavigatorTeamMember[] {
		return (view as unknown as { entries: INavigatorTeamMember[] }).entries;
	}

	async function mountView(): Promise<NavigatorTeamView> {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const stubViewContainer = {
			id: 'navigator-team-test-container',
			title: { value: 'Team', original: 'Team' },
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

		const view = store.add(instantiationService.createInstance(NavigatorTeamView, {
			id: NAVIGATOR_TEAM_VIEW_ID,
			title: 'Team',
		}));
		const container = document.createElement('div');
		view.render();
		container.appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);

		await new Promise<void>(resolve => setTimeout(resolve, 0));

		return view;
	}

	test('Team view descriptor registers NavigatorTeamView on Sidebar container', () => {
		const descriptor = viewsRegistry.getView(NAVIGATOR_TEAM_VIEW_ID);
		assert.ok(descriptor, 'expected Team view descriptor');
		assert.strictEqual(descriptor.ctorDescriptor.ctor, NavigatorTeamView);
		assert.strictEqual(descriptor.canToggleVisibility, false);
		assert.strictEqual(viewsRegistry.getViewContainer(NAVIGATOR_TEAM_VIEW_ID), NAVIGATOR_TEAM_VIEW_CONTAINER);
		assert.strictEqual(NAVIGATOR_TEAM_VIEW_CONTAINER.id, NAVIGATOR_TEAM_CONTAINER_ID);
		assert.strictEqual(viewContainersRegistry.getViewContainerLocation(NAVIGATOR_TEAM_VIEW_CONTAINER), ViewContainerLocation.Sidebar);
		assert.strictEqual(NAVIGATOR_TEAM_VIEW_CONTAINER.hideIfEmpty, false);
		assert.notStrictEqual(viewsRegistry.getViewContainer(NAVIGATOR_TEAM_VIEW_ID), EXPLORER_VIEW_CONTAINER);
		assert.notStrictEqual(descriptor.ctorDescriptor.ctor, ChatEditorInput);
	});

	test('empty roster shows welcome with no members', async () => {
		const view = await mountView();
		assert.strictEqual(view.shouldShowWelcome(), true);
		assert.deepStrictEqual(getViewEntries(view), []);
		assert.strictEqual(getViewList(view).length, 0);
	});

	test('welcome content uses roster-empty copy without service-disconnected wording', () => {
		const welcomeContents = viewsRegistry.getViewWelcomeContent(NAVIGATOR_TEAM_VIEW_ID);
		assert.ok(welcomeContents.length > 0, 'Team view must register welcome content');
		const combined = welcomeContents.map(item => item.content).join('\n');
		assert.ok(combined.includes(TEAM_EMPTY_COPY), `welcome must include "${TEAM_EMPTY_COPY}"`);
		assert.ok(!/not connected/i.test(combined), 'welcome must not say not connected');
		assert.ok(!/copilot/i.test(combined), 'welcome must not mention Copilot');
		assert.ok(!/open chat/i.test(combined), 'welcome must not mention Open Chat');
		assert.ok(!/\(command:/.test(combined), 'welcome must not include command buttons');
	});

	test('mounted view has WorkbenchList and no chat widgets', async () => {
		const view = await mountView();
		const list = getViewList(view);
		assert.ok(list instanceof WorkbenchList, 'Team view must construct WorkbenchList');
		assert.ok(view.element.querySelector('.navigator-team-list'));
		assert.strictEqual(view.element.querySelector('.chat-widget'), null);
		assert.strictEqual(view.element.querySelector('.chat-setup'), null);
		assert.strictEqual(view.element.querySelector('.navigator-stub-empty'), null);
	});

	test('roster does not seed conversation session ids or demo members', async () => {
		const view = await mountView();
		const entries = getViewEntries(view);
		const sessionIds = new Set(CONVERSATION_STUB_SEED_SESSIONS.map(session => session.id));
		for (const entry of entries) {
			assert.ok(!sessionIds.has(entry.id), `team entry must not use conversation session id ${entry.id}`);
			assert.ok(!entry.id.startsWith('session-'), `team entry must not look like a session id: ${entry.id}`);
		}
		assert.strictEqual(entries.length, 0);
		assert.strictEqual(getViewList(view).length, 0);
	});
});
