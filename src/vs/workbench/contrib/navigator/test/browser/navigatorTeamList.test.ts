/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { getSelectionKeyboardEvent, WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IConversationPartService } from '../../../../browser/parts/conversation/conversationPart.js';
import { ChatEditorInput } from '../../../chat/browser/widgetHosts/editor/chatEditorInput.js';
import { IConversationSessionChatService } from '../../../conversation/browser/conversationSessionChatService.js';
import { CONVERSATION_STUB_SEED_SESSIONS } from '../../../conversation/browser/conversationStubModel.js';
import { ConversationStubService, IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import { VIEW_CONTAINER as EXPLORER_VIEW_CONTAINER } from '../../../files/browser/explorerViewlet.js';
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewContainerModel, IViewContainersRegistry, IViewDescriptorService, IViewsRegistry, ViewContainer, ViewContainerLocation } from '../../../../common/views.js';
import { workbenchInstantiationService, TestViewsService } from '../../../../test/browser/workbenchTestServices.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { IAgentInspectService } from '../../common/agentInspect.js';
import { INavigatorTeamMemberEntry } from '../../common/navigatorTeamData.js';
import { AgentInspectService } from '../../browser/agentInspectService.js';
import { AGENT_INSPECT_VIEW_ID } from '../../browser/agentInspectIds.js';
import { NAVIGATOR_TEAM_VIEW_ID } from '../../browser/navigatorStubView.js';
import { NAVIGATOR_TEAM_CONTAINER_ID, NAVIGATOR_TEAM_VIEW_CONTAINER } from '../../browser/navigator.contribution.js';
import { INavigatorTeamMember, NavigatorTeamView } from '../../browser/navigatorTeamList.js';
import { createNavigatorConnectionTestStub } from '../common/navigatorConnectionTestStub.js';

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

	const teamMember: INavigatorTeamMemberEntry = {
		id: 'member:member:1',
		label: 'Alice · IDLE',
		memberName: 'Alice',
		memberAgentId: 'member:1',
		status: 'IDLE',
		preset: 'p',
		dynamic: 'd',
		turnCount: 1,
		managerAgentId: 'mgr:1',
		managerName: 'Manager',
	};

	async function mountView(
		connection: IUniverseAgentConnection = createNavigatorConnectionTestStub(),
		roster: ConversationStubService = store.add(new ConversationStubService()),
		extras?: {
			notification?: INotificationService;
			sessionChat?: IConversationSessionChatService;
			openView?: (id: string, focus?: boolean) => Promise<unknown>;
		},
	): Promise<NavigatorTeamView> {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IAgentInspectService, store.add(instantiationService.createInstance(AgentInspectService)) as IAgentInspectService);
		instantiationService.stub(IUniverseAgentConnection, connection);
		instantiationService.stub(IConversationPartService, { focus: () => { } } as IConversationPartService);
		if (extras?.notification) {
			instantiationService.stub(INotificationService, extras.notification);
		}
		if (extras?.sessionChat) {
			instantiationService.stub(IConversationSessionChatService, extras.sessionChat);
		}
		if (extras?.openView) {
			const openView = extras.openView;
			class TrackingViewsService extends TestViewsService {
				override openView<T>(id: string, focus?: boolean): Promise<T | null> {
					return openView(id, focus) as Promise<T | null>;
				}
				dispose(): void { }
			}
			instantiationService.stub(IViewsService, store.add(new TrackingViewsService()));
		}
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

	test('Team view does not register welcome overlay because shouldShowWelcome is false', () => {
		const welcomeContents = viewsRegistry.getViewWelcomeContent(NAVIGATOR_TEAM_VIEW_ID);
		assert.strictEqual(welcomeContents.length, 0, 'dead Team welcome would cover the body-top filter');
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

	test('does not leak unhandled rejection when member reveal notify throws', async () => {
		// revealNavigatorAgentInConversation already catches openSubAgent; a lone inner
		// reject does not leak. The void call site still needs `.catch` when the
		// catch-path notify throws.
		let openSubAgentCalls = 0;
		let notifyCalls = 0;
		const view = await mountView(createNavigatorConnectionTestStub(), store.add(new ConversationStubService()), {
			sessionChat: {
				findOpenTabForChat: () => undefined,
				isSubAgentDialogOpen: () => false,
				closeSubAgentDialog: () => { },
				navigateAgentBreadcrumb: async () => { },
				openSubAgent: async () => {
					openSubAgentCalls++;
					throw new Error('boom');
				},
			} as unknown as IConversationSessionChatService,
			notification: {
				error: () => {
					notifyCalls++;
					throw new Error('notify failed');
				},
			} as unknown as INotificationService,
		});
		(view as unknown as { setMemberEntries: (entries: INavigatorTeamMemberEntry[]) => void }).setMemberEntries([teamMember]);
		const membersList = getMembersList(view);
		assert.strictEqual(membersList.length, 1);

		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(() => { });
		try {
			membersList.setFocus([0]);
			membersList.setSelection([0], getSelectionKeyboardEvent('keydown', false, false));
			await timeout(0);
			assert.deepStrictEqual({ unhandledRejections, openSubAgentCalls, notifyCalls }, {
				unhandledRejections: [],
				openSubAgentCalls: 1,
				notifyCalls: 1,
			});
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('does not leak unhandled rejection when inspect openView rejects and onUnexpectedError warn-then-rethrows', async () => {
		// openInspectPanel has no inner try/catch. A lone `.catch(onUnexpectedError)`
		// still leaks when the handler warn-then-rethrows.
		let openViewCalls = 0;
		const view = await mountView(createNavigatorConnectionTestStub(), store.add(new ConversationStubService()), {
			openView: async (id: string, focus?: boolean) => {
				openViewCalls++;
				assert.strictEqual(id, AGENT_INSPECT_VIEW_ID);
				assert.strictEqual(focus, true);
				return Promise.reject('boom');
			},
		});

		const unexpectedWarns: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => {
			unexpectedWarns.push(error);
			if (unexpectedWarns.length === 1) {
				throw error;
			}
		});
		try {
			view.inspectMember(teamMember);
			await timeout(0);
			assert.deepStrictEqual({ unhandledRejections, openViewCalls, unexpectedWarns }, {
				unhandledRejections: [],
				openViewCalls: 1,
				unexpectedWarns: ['boom', 'boom'],
			});
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});
});
