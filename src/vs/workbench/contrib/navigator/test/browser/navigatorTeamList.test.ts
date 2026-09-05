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
import type { UniverseAgentKillMemberRequest, UniverseAgentStartMemberRequest, UniverseAgentTaskCancelRequest, UniverseAgentTaskUpdateRequest } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { INavigatorTeamMember, NavigatorTeamView } from '../../browser/navigatorTeamList.js';
import type { INavigatorTeamMemberEntry, INavigatorTeamTaskEntry } from '../../common/navigatorTeamData.js';
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

	async function mountView(
		connection: IUniverseAgentConnection = createNavigatorConnectionTestStub(),
		roster: ConversationStubService = store.add(new ConversationStubService()),
	): Promise<NavigatorTeamView> {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IAgentInspectService, store.add(instantiationService.createInstance(AgentInspectService)) as IAgentInspectService);
		instantiationService.stub(IUniverseAgentConnection, connection);
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

	test('TaskUpdate / TaskCancel do not send when disconnected or hook missing', async () => {
		const updateCalls: UniverseAgentTaskUpdateRequest[] = [];
		const cancelCalls: UniverseAgentTaskCancelRequest[] = [];
		const disconnected = await mountView(createNavigatorConnectionTestStub({
			taskUpdate: async (request) => {
				updateCalls.push(request);
				return { ok: true };
			},
			taskCancel: async (request) => {
				cancelCalls.push(request);
				return { ok: true };
			},
		}));
		assert.strictEqual(await disconnected.updateSelectedTask('DONE', ''), false);
		assert.strictEqual(await disconnected.cancelSelectedTask(), false);
		assert.deepStrictEqual(updateCalls, []);
		assert.deepStrictEqual(cancelCalls, []);

		const roster = store.add(new ConversationStubService());
		roster.setEngineConnected(true);
		const noHook = await mountView(createNavigatorConnectionTestStub({
			isEngineConnected: () => true,
		}), roster);
		assert.strictEqual(await noHook.updateSelectedTask('DONE', ''), false);
		assert.strictEqual(await noHook.cancelSelectedTask(), false);
	});

	test('TaskUpdate / TaskCancel send empty ids as-is when nothing selected', async () => {
		const updateCalls: UniverseAgentTaskUpdateRequest[] = [];
		const cancelCalls: UniverseAgentTaskCancelRequest[] = [];
		const roster = store.add(new ConversationStubService());
		roster.setEngineConnected(true);
		const view = await mountView(createNavigatorConnectionTestStub({
			isEngineConnected: () => true,
			taskUpdate: async (request) => {
				updateCalls.push(request);
				return { ok: true };
			},
			taskCancel: async (request) => {
				cancelCalls.push(request);
				return { ok: true };
			},
		}), roster);

		assert.strictEqual(await view.updateSelectedTask('', ''), true);
		assert.strictEqual(await view.cancelSelectedTask(), true);
		assert.deepStrictEqual(updateCalls, [{
			sessionId: roster.getActiveSessionId(),
			agentId: '',
			taskId: '',
			newStatus: '',
			message: '',
		}]);
		assert.deepStrictEqual(cancelCalls, [{
			sessionId: roster.getActiveSessionId(),
			agentId: '',
			taskId: '',
		}]);
	});

	test('TaskUpdate / TaskCancel send selected task ids without inventing defaults', async () => {
		const updateCalls: UniverseAgentTaskUpdateRequest[] = [];
		const cancelCalls: UniverseAgentTaskCancelRequest[] = [];
		const roster = store.add(new ConversationStubService());
		roster.setEngineConnected(true);
		const view = await mountView(createNavigatorConnectionTestStub({
			isEngineConnected: () => true,
			taskUpdate: async (request) => {
				updateCalls.push(request);
				return { ok: true };
			},
			taskCancel: async (request) => {
				cancelCalls.push(request);
				return { ok: true };
			},
		}), roster);

		const task: INavigatorTeamTaskEntry = {
			id: 'task:t1',
			label: 'Ship · OPEN',
			taskId: 't1',
			subject: 'Ship',
			owner: '',
			status: 'OPEN',
			blockedBy: '',
			lastMessage: '',
			description: '',
			managerAgentId: 'mgr-1',
			managerName: 'Mgr',
		};
		(view as unknown as { setTaskEntries: (entries: INavigatorTeamTaskEntry[]) => void }).setTaskEntries([task]);
		const tasksList = (view as unknown as { tasksList: WorkbenchList<INavigatorTeamTaskEntry> }).tasksList;
		tasksList.setSelection([0]);

		assert.strictEqual(await view.updateSelectedTask('DONE', 'ok'), true);
		assert.strictEqual(await view.cancelSelectedTask(), true);
		assert.deepStrictEqual(updateCalls, [{
			sessionId: roster.getActiveSessionId(),
			agentId: 'mgr-1',
			taskId: 't1',
			newStatus: 'DONE',
			message: 'ok',
		}]);
		assert.deepStrictEqual(cancelCalls, [{
			sessionId: roster.getActiveSessionId(),
			agentId: 'mgr-1',
			taskId: 't1',
		}]);
	});

	test('StartMember / KillMember do not send when disconnected or hook missing', async () => {
		const startCalls: UniverseAgentStartMemberRequest[] = [];
		const killCalls: UniverseAgentKillMemberRequest[] = [];
		const disconnected = await mountView(createNavigatorConnectionTestStub({
			startMember: async (request) => {
				startCalls.push(request);
				return { memberAgentId: '', memberName: '', dynamic: false };
			},
			killMember: async (request) => {
				killCalls.push(request);
				return { ok: true };
			},
		}));
		assert.strictEqual(await disconnected.startSelectedMember(''), false);
		assert.strictEqual(await disconnected.killSelectedMember(), false);
		assert.deepStrictEqual(startCalls, []);
		assert.deepStrictEqual(killCalls, []);

		const roster = store.add(new ConversationStubService());
		roster.setEngineConnected(true);
		const noHook = await mountView(createNavigatorConnectionTestStub({
			isEngineConnected: () => true,
		}), roster);
		assert.strictEqual(await noHook.startSelectedMember(''), false);
		assert.strictEqual(await noHook.killSelectedMember(), false);
	});

	test('StartMember / KillMember send empty ids as-is when nothing selected', async () => {
		const startCalls: UniverseAgentStartMemberRequest[] = [];
		const killCalls: UniverseAgentKillMemberRequest[] = [];
		const roster = store.add(new ConversationStubService());
		roster.setEngineConnected(true);
		const view = await mountView(createNavigatorConnectionTestStub({
			isEngineConnected: () => true,
			startMember: async (request) => {
				startCalls.push(request);
				return { memberAgentId: '', memberName: '', dynamic: false };
			},
			killMember: async (request) => {
				killCalls.push(request);
				return { ok: true };
			},
		}), roster);

		assert.strictEqual(await view.startSelectedMember(''), true);
		assert.strictEqual(await view.killSelectedMember(), true);
		assert.deepStrictEqual(startCalls, [{
			sessionId: roster.getActiveSessionId(),
			agentId: '',
			memberName: '',
			presetId: '',
			systemPrompt: '',
			modelType: '',
			dynamic: false,
		}]);
		assert.deepStrictEqual(killCalls, [{
			sessionId: roster.getActiveSessionId(),
			agentId: '',
			memberName: '',
		}]);
	});

	test('StartMember / KillMember send selected member ids without inventing defaults', async () => {
		const startCalls: UniverseAgentStartMemberRequest[] = [];
		const killCalls: UniverseAgentKillMemberRequest[] = [];
		const roster = store.add(new ConversationStubService());
		roster.setEngineConnected(true);
		const view = await mountView(createNavigatorConnectionTestStub({
			isEngineConnected: () => true,
			startMember: async (request) => {
				startCalls.push(request);
				return { memberAgentId: 'm2', memberName: 'worker', dynamic: false };
			},
			killMember: async (request) => {
				killCalls.push(request);
				return { ok: true };
			},
		}), roster);

		const member: INavigatorTeamMemberEntry = {
			id: 'member:m1',
			label: 'Writer · IDLE',
			memberName: 'writer',
			memberAgentId: 'm1',
			status: 'IDLE',
			preset: '',
			dynamic: '',
			turnCount: 0,
			managerAgentId: 'mgr-1',
			managerName: 'Mgr',
		};
		(view as unknown as { setMemberEntries: (entries: INavigatorTeamMemberEntry[]) => void }).setMemberEntries([member]);
		const membersList = (view as unknown as { membersList: WorkbenchList<INavigatorTeamMemberEntry> }).membersList;
		membersList.setSelection([0]);

		assert.strictEqual(await view.startSelectedMember('worker'), true);
		assert.strictEqual(await view.killSelectedMember(), true);
		assert.deepStrictEqual(startCalls, [{
			sessionId: roster.getActiveSessionId(),
			agentId: 'mgr-1',
			memberName: 'worker',
			presetId: '',
			systemPrompt: '',
			modelType: '',
			dynamic: false,
		}]);
		assert.deepStrictEqual(killCalls, [{
			sessionId: roster.getActiveSessionId(),
			agentId: 'mgr-1',
			memberName: 'writer',
		}]);
	});
});
