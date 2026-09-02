/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { ChatEditorInput } from '../../../chat/browser/widgetHosts/editor/chatEditorInput.js';
import { CONVERSATION_STUB_SEED_SESSIONS } from '../../../conversation/browser/conversationStubModel.js';
import { ConversationStubService, IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import { VIEW_CONTAINER as EXPLORER_VIEW_CONTAINER } from '../../../files/browser/explorerViewlet.js';
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewContainerModel, IViewContainersRegistry, IViewDescriptorService, IViewsRegistry, ViewContainer, ViewContainerLocation } from '../../../../common/views.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { IAgentInspectService } from '../../common/agentInspect.js';
import { AgentInspectService } from '../../browser/agentInspectService.js';
import { NAVIGATOR_TEAM_VIEW_ID } from '../../browser/navigatorStubView.js';
import { NAVIGATOR_TEAM_CONTAINER_ID, NAVIGATOR_TEAM_VIEW_CONTAINER } from '../../browser/navigator.contribution.js';
import { INavigatorTeamMember, NavigatorTeamView } from '../../browser/navigatorTeamList.js';
import { createNavigatorConnectionTestStub } from '../common/navigatorConnectionTestStub.js';
import '../../browser/navigator.contribution.js';

const TEAM_EMPTY_COPY = 'No team members yet';

suite('NavigatorTeamView', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
	const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

	function getMembersList(view: NavigatorTeamView): WorkbenchList<INavigatorTeamMember> {
		return (view as unknown as { membersList: WorkbenchList<INavigatorTeamMember> }).membersList;
	}

	function getMemberEntries(view: NavigatorTeamView): INavigatorTeamMember[] {
		return (view as unknown as { memberEntries: INavigatorTeamMember[] }).memberEntries;
	}

	async function mountView(): Promise<NavigatorTeamView> {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, store.add(new ConversationStubService()));
		instantiationService.stub(IAgentInspectService, store.add(instantiationService.createInstance(AgentInspectService)) as IAgentInspectService);
		instantiationService.stub(IUniverseAgentConnection, createNavigatorConnectionTestStub());
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

	test('empty members subview does not show welcome so body-top filter stays visible', async () => {
		const view = await mountView();
		assert.strictEqual(view.getActiveSubview(), 'members');
		assert.strictEqual(view.shouldShowWelcome(), false);
		assert.deepStrictEqual(getMemberEntries(view), []);
		assert.strictEqual(getMembersList(view).length, 0);
	});

	test('tasks subview does not show members welcome', async () => {
		const view = await mountView();
		view.showTasks();
		assert.strictEqual(view.shouldShowWelcome(), false);
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
		const list = getMembersList(view);
		assert.ok(list instanceof WorkbenchList, 'Team view must construct WorkbenchList');
		assert.ok(view.element.querySelector('.navigator-team-list'));
		assert.ok(view.element.querySelector('.navigator-team-subview.active .navigator-stub-empty'));
		assert.strictEqual(view.element.querySelector('.chat-widget'), null);
		assert.strictEqual(view.element.querySelector('.chat-setup'), null);
	});

	test('roster does not seed conversation session ids or demo members', async () => {
		const view = await mountView();
		const entries = getMemberEntries(view);
		const sessionIds = new Set(CONVERSATION_STUB_SEED_SESSIONS.map(session => session.id));
		for (const entry of entries) {
			assert.ok(!sessionIds.has(entry.id), `team entry must not use conversation session id ${entry.id}`);
			assert.ok(!entry.id.startsWith('session-'), `team entry must not look like a session id: ${entry.id}`);
		}
		assert.strictEqual(entries.length, 0);
		assert.strictEqual(getMembersList(view).length, 0);
	});
});
