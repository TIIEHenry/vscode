/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getErrorMessage } from '../../../../../base/common/errors.js';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { IConversationSessionViewLease } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { LiveAgentTreeNodeView } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { Extensions as ViewExtensions, IViewContainerModel, IViewDescriptorService, IViewsRegistry, ViewContainer, ViewContainerLocation } from '../../../../common/views.js';
import { workbenchInstantiationService, TestViewsService } from '../../../../test/browser/workbenchTestServices.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { ConversationStubService, IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import { IAgentInspectService } from '../../common/agentInspect.js';
import { AgentInspectService } from '../../browser/agentInspectService.js';
import { AGENT_INSPECT_VIEW_ID, OPEN_NAVIGATOR_TEAM_INSPECT_COMMAND_ID } from '../../browser/agentInspectIds.js';
import { NAVIGATOR_STALE_SNAPSHOT_COPY } from '../../common/navigatorAgentTreeEmptyState.js';
import { createNavigatorConnectionTestStub } from '../common/navigatorConnectionTestStub.js';
import '../../browser/navigator.contribution.js';
import { NAVIGATOR_TEAM_VIEW_ID } from '../../browser/navigatorStubView.js';
import { NavigatorSessionLeaseHolder } from '../../browser/navigatorSessionLeaseHolder.js';
import {
	INavigatorTeamMember,
	NAVIGATOR_TEAM_SHOW_MEMBERS_COMMAND_ID,
	NAVIGATOR_TEAM_SHOW_TASKS_COMMAND_ID,
	NavigatorTeamView,
} from '../../browser/navigatorTeamList.js';

const TEAM_NEVER_CONNECTED_COPY = 'No team — engine not connected.';
const TEAM_CONNECTING_COPY = 'Connecting to engine…';
const TEAM_MEMBERS_EMPTY_COPY = 'No team members yet';
const TEAM_TASKS_EMPTY_COPY = 'No tasks yet';
const TEAM_UNSUPPORTED_COPY = 'Current engine does not provide Team';
const TEAM_FETCH_FAILED_COPY = 'Failed to read team members and tasks';

suite('Navigator Team subviews', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	class RosterWithLiveTree extends ConversationStubService {
		constructor(private readonly liveTree: LiveAgentTreeNodeView) {
			super();
		}

		override acquireSessionView(sessionId: string): IConversationSessionViewLease {
			const lease = super.acquireSessionView(sessionId);
			const snapshot = { ...lease.snapshot, liveAgentTree: this.liveTree };
			Object.defineProperty(lease, 'snapshot', { get: () => snapshot });
			return lease;
		}
	}

	const teamLiveTree: LiveAgentTreeNodeView = {
		agentId: 'root',
		name: 'Root',
		type: 'AGENT_TYPE_ROOT',
		status: 'AGENT_STATUS_IDLE',
		model: 'm',
		turnCount: 0,
		createdAt: 0,
		children: [{
			agentId: 'mgr:1',
			name: 'Manager',
			type: 'AGENT_TYPE_SUB',
			status: 'AGENT_STATUS_IDLE',
			model: 'm',
			turnCount: 0,
			createdAt: 0,
			children: [{
				agentId: 'member:1',
				name: 'Member',
				type: 'AGENT_TYPE_MEMBER',
				status: 'AGENT_STATUS_IDLE',
				model: 'm',
				turnCount: 0,
				createdAt: 0,
				children: [],
			}],
		}],
	};

	function mountTeamView(
		roster: ConversationStubService = store.add(new ConversationStubService()),
		connection: IUniverseAgentConnection = createNavigatorConnectionTestStub(),
		notification?: INotificationService,
		inspectService?: IAgentInspectService,
	): NavigatorTeamView {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IAgentInspectService, inspectService ?? store.add(instantiationService.createInstance(AgentInspectService)) as IAgentInspectService);
		instantiationService.stub(IUniverseAgentConnection, connection);
		if (notification) {
			instantiationService.stub(INotificationService, notification);
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
		return view;
	}

	function getFilterInput(view: NavigatorTeamView): HTMLInputElement | null {
		return view.element.querySelector('.navigator-team-inline-filter-input');
	}

	function setMemberEntries(view: NavigatorTeamView, entries: { id: string; label: string }[]): void {
		(view as unknown as { setMemberEntries: (entries: { id: string; label: string }[]) => void }).setMemberEntries(entries);
	}

	function setTaskEntries(view: NavigatorTeamView, entries: { id: string; label: string }[]): void {
		(view as unknown as { setTaskEntries: (entries: { id: string; label: string }[]) => void }).setTaskEntries(entries);
	}

	async function setFilterQuery(view: NavigatorTeamView, query: string): Promise<void> {
		const input = getFilterInput(view);
		assert.ok(input, 'filter input must exist');
		input.value = query;
		input.dispatchEvent(new globalThis.Event('input'));
		await new Promise<void>(resolve => setTimeout(resolve, 0));
	}

	test('ViewTitle registers Members, Tasks, and Inspect actions for Team', () => {
		const viewTitleItems = MenuRegistry.getMenuItems(MenuId.ViewTitle).filter(isIMenuItem);
		const membersItem = viewTitleItems.find(item => item.command.id === NAVIGATOR_TEAM_SHOW_MEMBERS_COMMAND_ID);
		const tasksItem = viewTitleItems.find(item => item.command.id === NAVIGATOR_TEAM_SHOW_TASKS_COMMAND_ID);
		const inspectItem = viewTitleItems.find(item => item.command.id === OPEN_NAVIGATOR_TEAM_INSPECT_COMMAND_ID);

		assert.ok(membersItem, 'Team ViewTitle must expose Members');
		assert.ok(tasksItem, 'Team ViewTitle must expose Tasks');
		assert.ok(inspectItem, 'Team ViewTitle must still expose Inspect');
	});

	test('Team ViewTitle does not register engine-mutating commands (PRD-022 验收 6)', () => {
		const viewTitleItems = MenuRegistry.getMenuItems(MenuId.ViewTitle).filter(isIMenuItem);
		const mutatingCommandIds = [
			'workbench.action.navigatorTeam.startMember',
			'workbench.action.navigatorTeam.killMember',
			'workbench.action.navigatorTeam.updateTask',
			'workbench.action.navigatorTeam.cancelTask',
			'workbench.action.navigatorTeam.messageMember',
			'workbench.action.navigatorTeam.abort',
		];
		for (const id of mutatingCommandIds) {
			assert.strictEqual(viewTitleItems.find(item => item.command.id === id), undefined, `Team ViewTitle must not register ${id}`);
		}
	});

	test('defaults to Members subview with honest empty state', () => {
		const view = mountTeamView();

		assert.strictEqual(view.getActiveSubview(), 'members');

		const membersSubview = view.element.querySelector('.navigator-team-subview.active');
		assert.ok(membersSubview, 'expected active members subview');
		assert.ok(membersSubview.classList.contains('navigator-team-subview'));

		const membersEmpty = view.element.querySelector('.navigator-team-subview.active .navigator-stub-empty');
		assert.ok(membersEmpty);
		assert.strictEqual(membersEmpty?.textContent, TEAM_NEVER_CONNECTED_COPY);
		assert.ok(!membersEmpty?.textContent?.match(/copilot/i));
		assert.ok(!membersEmpty?.textContent?.match(/not connected — no engine/i));
		assert.notStrictEqual(membersEmpty?.textContent, TEAM_MEMBERS_EMPTY_COPY);

		const tasksEmpty = view.element.querySelector('.navigator-team-subview:not(.active) .navigator-stub-empty');
		assert.ok(tasksEmpty);
		assert.strictEqual(tasksEmpty?.textContent, TEAM_NEVER_CONNECTED_COPY);
		assert.ok(!tasksEmpty?.textContent?.includes('no engine'));
	});

	test('showTasks reveals Tasks empty list', () => {
		const view = mountTeamView();

		view.showTasks();
		assert.strictEqual(view.getActiveSubview(), 'tasks');
		assert.strictEqual(view.shouldShowWelcome(), false);

		const activeSubview = view.element.querySelector('.navigator-team-subview.active');
		assert.ok(activeSubview?.querySelector('.navigator-team-tasks-list'));

		const tasksEmpty = activeSubview?.querySelector('.navigator-stub-empty');
		assert.ok(tasksEmpty);
		assert.strictEqual(tasksEmpty?.textContent, TEAM_NEVER_CONNECTED_COPY);
		assert.ok(!tasksEmpty?.textContent?.includes('no engine'));
		assert.ok(!tasksEmpty?.textContent?.match(/copilot/i));
		assert.ok(!tasksEmpty?.textContent?.match(/open chat/i));
		assert.ok(!/\(command:/.test(tasksEmpty?.textContent ?? ''));
	});

	test('switches between Members and Tasks subviews', () => {
		const view = mountTeamView();

		view.showTasks();
		assert.strictEqual(view.getActiveSubview(), 'tasks');

		let activeSubview = view.element.querySelector('.navigator-team-subview.active');
		assert.ok(activeSubview?.querySelector('.navigator-team-tasks-list'));

		view.showMembers();
		assert.strictEqual(view.getActiveSubview(), 'members');

		activeSubview = view.element.querySelector('.navigator-team-subview.active');
		assert.ok(activeSubview?.querySelector('.navigator-team-list'));
	});

	test('creates WorkbenchList bodies without engine data or fake task rows', () => {
		const view = mountTeamView();

		const membersList = (view as unknown as { membersList: WorkbenchList<INavigatorTeamMember> }).membersList;
		const tasksList = (view as unknown as { tasksList: WorkbenchList<{ id: string; label: string }> }).tasksList;

		assert.ok(membersList, 'expected WorkbenchList for members');
		assert.ok(tasksList, 'expected WorkbenchList for tasks');
		assert.strictEqual(membersList.length, 0);
		assert.strictEqual(tasksList.length, 0);
		assert.strictEqual(view.element.querySelector('.chat-widget'), null);
		assert.strictEqual(view.element.querySelector('.chat-setup'), null);
		assert.strictEqual(view.element.querySelector('.navigator-team-type-filter'), null);
		assert.strictEqual(view.element.querySelector('.navigator-panel-body-filter-status'), null);
	});

	test('body-top filter sits above subview content with Filter team placeholder', () => {
		const view = mountTeamView();

		const filter = view.element.querySelector('.navigator-team-inline-filter');
		assert.ok(filter, 'expected body-top filter chrome');

		const input = getFilterInput(view);
		assert.ok(input);
		assert.strictEqual(input?.placeholder, 'Filter team');
		assert.strictEqual(input?.getAttribute('aria-label'), 'Filter team');

		const body = view.element.querySelector('.navigator-team-view');
		assert.ok(body);
		const children = Array.from(body!.children);
		assert.strictEqual(children[0], filter, 'filter must be first in body');
		assert.ok(children[1]?.classList.contains('navigator-team-subview'));

		const clearButton = view.element.querySelector('.navigator-team-inline-filter-clear') as HTMLElement | null;
		assert.ok(clearButton);
		assert.strictEqual(filter?.classList.contains('has-text'), false);

		assert.strictEqual(view.element.querySelector('.navigator-team-type-filter'), null);
		assert.strictEqual(view.element.querySelector('.navigator-panel-body-filter-status'), null);
	});

	test('shouldShowWelcome is false so filter is not covered by welcome overlay', () => {
		const view = mountTeamView();
		assert.strictEqual(view.shouldShowWelcome(), false);
	});

	test('shared filter query live-filters members and tasks lists', async () => {
		const view = mountTeamView();

		setMemberEntries(view, [
			{ id: 'm1', label: 'Alpha Member' },
			{ id: 'm2', label: 'Beta Member' },
		]);
		setTaskEntries(view, [
			{ id: 't1', label: 'Alpha Task' },
			{ id: 't2', label: 'Gamma Task' },
		]);

		const membersList = (view as unknown as { membersList: WorkbenchList<INavigatorTeamMember> }).membersList;
		const tasksList = (view as unknown as { tasksList: WorkbenchList<{ id: string; label: string }> }).tasksList;

		assert.strictEqual(membersList.length, 2);
		assert.strictEqual(tasksList.length, 2);

		await setFilterQuery(view, 'alpha');

		assert.strictEqual(membersList.length, 1);
		assert.strictEqual(tasksList.length, 1);
		assert.strictEqual(membersList.element(0)?.label, 'Alpha Member');
		assert.strictEqual(tasksList.element(0)?.label, 'Alpha Task');

		view.showTasks();
		assert.strictEqual(view.getActiveSubview(), 'tasks');
		assert.strictEqual(getFilterInput(view)?.value, 'alpha');
		assert.strictEqual(tasksList.length, 1);

		const filter = view.element.querySelector('.navigator-team-inline-filter');
		const activeSubview = view.element.querySelector('.navigator-team-subview.active');
		assert.ok(filter && activeSubview);
		assert.ok(filter!.compareDocumentPosition(activeSubview!) & Node.DOCUMENT_POSITION_FOLLOWING);
	});

	test('unfiltered empty keeps honest empty copy and hides list', () => {
		const view = mountTeamView();
		setMemberEntries(view, []);

		const membersEmpty = view.element.querySelector('.navigator-team-subview.active .navigator-stub-empty') as HTMLElement | null;
		const membersList = view.element.querySelector('.navigator-team-list') as HTMLElement | null;
		assert.ok(membersEmpty);
		assert.ok(membersList);
		assert.strictEqual(membersEmpty.style.display, 'block');
		assert.strictEqual(membersList.style.display, 'none');
		assert.strictEqual(membersEmpty.textContent, TEAM_NEVER_CONNECTED_COPY);
	});

	test('Team view descriptor registers NavigatorTeamView ctor', () => {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const descriptor = viewsRegistry.getView(NAVIGATOR_TEAM_VIEW_ID);
		assert.ok(descriptor);
		assert.strictEqual(descriptor.ctorDescriptor.ctor, NavigatorTeamView);
	});

	test('disconnect keeps last Team snapshot and marks it stale', async () => {
		const roster = store.add(new RosterWithLiveTree(teamLiveTree));
		roster.setEngineConnected(true);
		const connection = createNavigatorConnectionTestStub({
			getConnectionPhase: () => roster.isEngineConnected() ? { kind: 'connected', path: 'direct' } : { kind: 'disconnected' },
			getNavigatorCapability: () => 'SUPPORTED',
			team: {
				memberStatus: async () => [{
					memberName: 'Alice',
					memberAgentId: 'member:1',
					status: 'IDLE',
					preset: 'p',
					dynamic: 'd',
					turnCount: 1,
				}],
				taskList: async () => [],
				teamInfo: async () => undefined,
			},
		});
		const view = mountTeamView(roster, connection);
		await (view as unknown as { refreshTeamData: () => Promise<void> }).refreshTeamData();

		const membersList = (view as unknown as { membersList: WorkbenchList<INavigatorTeamMember> }).membersList;
		assert.strictEqual(membersList.length, 1);
		assert.ok(membersList.element(0)?.label.includes('Alice'));

		roster.setEngineConnected(false);
		await (view as unknown as { refreshTeamData: () => Promise<void> }).refreshTeamData();

		assert.strictEqual(membersList.length, 1);
		assert.ok(membersList.element(0)?.label.includes('Alice'));
		const note = view.element.querySelector('.navigator-team-subview.active .navigator-stub-note') as HTMLElement | null;
		assert.ok(note);
		assert.strictEqual(note.style.display, 'block');
		assert.strictEqual(note.textContent, NAVIGATOR_STALE_SNAPSHOT_COPY);
	});

	test('never-connected Team stays honest empty without a snapshot note', async () => {
		const view = mountTeamView();
		await (view as unknown as { refreshTeamData: () => Promise<void> }).refreshTeamData();
		const note = view.element.querySelector('.navigator-team-subview.active .navigator-stub-note') as HTMLElement | null;
		assert.ok(note);
		assert.strictEqual(note.style.display, 'none');
		const membersEmpty = view.element.querySelector('.navigator-team-subview.active .navigator-stub-empty');
		assert.strictEqual(membersEmpty?.textContent, TEAM_NEVER_CONNECTED_COPY);
	});

	test('successful Team load then memberStatus throw clears leftover rows and writes a failure note', async () => {
		const roster = store.add(new RosterWithLiveTree(teamLiveTree));
		roster.setEngineConnected(true);
		let memberStatusCalls = 0;
		const connection = createNavigatorConnectionTestStub({
			getConnectionPhase: () => roster.isEngineConnected() ? { kind: 'connected', path: 'direct' } : { kind: 'disconnected' },
			getNavigatorCapability: () => 'SUPPORTED',
			team: {
				memberStatus: async () => {
					memberStatusCalls++;
					if (memberStatusCalls === 1) {
						return [{
							memberName: 'Alice',
							memberAgentId: 'member:1',
							status: 'IDLE',
							preset: 'p',
							dynamic: 'd',
							turnCount: 1,
						}];
					}
					throw new Error('memberStatus boom');
				},
				taskList: async () => [],
				teamInfo: async () => undefined,
			},
		});
		const view = mountTeamView(roster, connection);
		await (view as unknown as { refreshTeamData: () => Promise<void> }).refreshTeamData();

		const membersList = (view as unknown as { membersList: WorkbenchList<INavigatorTeamMember> }).membersList;
		const tasksList = (view as unknown as { tasksList: WorkbenchList<{ id: string; label: string }> }).tasksList;
		assert.strictEqual(membersList.length, 1);
		assert.ok(membersList.element(0)?.label.includes('Alice'));

		await (view as unknown as { refreshTeamData: () => Promise<void> }).refreshTeamData();

		assert.strictEqual(membersList.length, 0);
		assert.strictEqual(tasksList.length, 0);
		const membersEmpty = view.element.querySelector('.navigator-team-subview.active .navigator-stub-empty');
		assert.strictEqual(membersEmpty?.textContent, TEAM_FETCH_FAILED_COPY);
		const note = view.element.querySelector('.navigator-team-subview.active .navigator-stub-note') as HTMLElement | null;
		assert.ok(note);
		assert.strictEqual(note.style.display, 'block');
		assert.strictEqual(note.textContent, TEAM_FETCH_FAILED_COPY);
		assert.notStrictEqual(note.textContent, NAVIGATOR_STALE_SNAPSHOT_COPY);
	});

	test('successful Team load then taskList throw clears leftover rows and writes a failure note', async () => {
		const roster = store.add(new RosterWithLiveTree(teamLiveTree));
		roster.setEngineConnected(true);
		let taskListCalls = 0;
		const connection = createNavigatorConnectionTestStub({
			getConnectionPhase: () => roster.isEngineConnected() ? { kind: 'connected', path: 'direct' } : { kind: 'disconnected' },
			getNavigatorCapability: () => 'SUPPORTED',
			team: {
				memberStatus: async () => [{
					memberName: 'Alice',
					memberAgentId: 'member:1',
					status: 'IDLE',
					preset: 'p',
					dynamic: 'd',
					turnCount: 1,
				}],
				taskList: async () => {
					taskListCalls++;
					if (taskListCalls === 1) {
						return [];
					}
					throw new Error('taskList boom');
				},
				teamInfo: async () => undefined,
			},
		});
		const view = mountTeamView(roster, connection);
		await (view as unknown as { refreshTeamData: () => Promise<void> }).refreshTeamData();

		const membersList = (view as unknown as { membersList: WorkbenchList<INavigatorTeamMember> }).membersList;
		assert.strictEqual(membersList.length, 1);
		assert.ok(membersList.element(0)?.label.includes('Alice'));

		await (view as unknown as { refreshTeamData: () => Promise<void> }).refreshTeamData();

		assert.strictEqual(membersList.length, 0);
		const membersEmpty = view.element.querySelector('.navigator-team-subview.active .navigator-stub-empty');
		assert.strictEqual(membersEmpty?.textContent, TEAM_FETCH_FAILED_COPY);
		const note = view.element.querySelector('.navigator-team-subview.active .navigator-stub-note') as HTMLElement | null;
		assert.ok(note);
		assert.strictEqual(note.style.display, 'block');
		assert.strictEqual(note.textContent, TEAM_FETCH_FAILED_COPY);
		assert.notStrictEqual(note.textContent, NAVIGATOR_STALE_SNAPSHOT_COPY);
	});

	test('Team empty copy distinguishes never-connected, connecting, connected-empty, unsupported, and fetch-failed', async () => {
		const neverView = mountTeamView();
		await (neverView as unknown as { refreshTeamData: () => Promise<void> }).refreshTeamData();
		const neverCopy = neverView.element.querySelector('.navigator-team-subview.active .navigator-stub-empty')?.textContent;

		const connectingRoster = store.add(new ConversationStubService());
		connectingRoster.setEngineConnected(true);
		const connectingView = mountTeamView(connectingRoster, createNavigatorConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connecting', reason: 'initial' }),
		}));
		await (connectingView as unknown as { refreshTeamData: () => Promise<void> }).refreshTeamData();
		const connectingCopy = connectingView.element.querySelector('.navigator-team-subview.active .navigator-stub-empty')?.textContent;

		const connectedRoster = store.add(new RosterWithLiveTree(teamLiveTree));
		connectedRoster.setEngineConnected(true);
		const connectedView = mountTeamView(connectedRoster, createNavigatorConnectionTestStub({
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getNavigatorCapability: () => 'SUPPORTED',
			team: {
				memberStatus: async () => [],
				taskList: async () => [],
				teamInfo: async () => undefined,
			},
		}));
		await (connectedView as unknown as { refreshTeamData: () => Promise<void> }).refreshTeamData();
		const connectedCopy = connectedView.element.querySelector('.navigator-team-subview.active .navigator-stub-empty')?.textContent;

		const unsupportedRoster = store.add(new RosterWithLiveTree(teamLiveTree));
		unsupportedRoster.setEngineConnected(true);
		const unsupportedView = mountTeamView(unsupportedRoster, createNavigatorConnectionTestStub({
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getNavigatorCapability: key => key === 'team' ? 'UNSUPPORTED' : 'SUPPORTED',
		}));
		await (unsupportedView as unknown as { refreshTeamData: () => Promise<void> }).refreshTeamData();
		const unsupportedCopy = unsupportedView.element.querySelector('.navigator-team-subview.active .navigator-stub-empty')?.textContent;

		const failedRoster = store.add(new RosterWithLiveTree(teamLiveTree));
		failedRoster.setEngineConnected(true);
		const failedView = mountTeamView(failedRoster, createNavigatorConnectionTestStub({
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getNavigatorCapability: () => 'SUPPORTED',
			team: {
				memberStatus: async () => {
					throw new Error('boom');
				},
				taskList: async () => [],
				teamInfo: async () => undefined,
			},
		}));
		await (failedView as unknown as { refreshTeamData: () => Promise<void> }).refreshTeamData();
		const failedCopy = failedView.element.querySelector('.navigator-team-subview.active .navigator-stub-empty')?.textContent;

		assert.strictEqual(neverCopy, TEAM_NEVER_CONNECTED_COPY);
		assert.strictEqual(connectingCopy, TEAM_CONNECTING_COPY);
		assert.strictEqual(connectedCopy, TEAM_MEMBERS_EMPTY_COPY);
		assert.strictEqual(unsupportedCopy, TEAM_UNSUPPORTED_COPY);
		assert.strictEqual(failedCopy, TEAM_FETCH_FAILED_COPY);
		assert.notStrictEqual(connectingCopy, TEAM_MEMBERS_EMPTY_COPY);
		const distinct = new Set([neverCopy, connectingCopy, connectedCopy, unsupportedCopy, failedCopy]);
		assert.strictEqual(distinct.size, 5);

		connectedView.showTasks();
		const connectedTasks = connectedView.element.querySelector('.navigator-team-subview.active .navigator-stub-empty')?.textContent;
		assert.strictEqual(connectedTasks, TEAM_TASKS_EMPTY_COPY);
	});

	test('ViewTitle Inspect with member focus sets the member target and opens Inspect', async () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const inspectService = store.add(instantiationService.createInstance(AgentInspectService));
		const openViewCalls: Array<{ id: string; focus: boolean | undefined }> = [];
		class TrackingViewsService extends TestViewsService {
			override openView<T>(id: string, focus?: boolean): Promise<T | null> {
				openViewCalls.push({ id, focus });
				return Promise.resolve(null);
			}
			dispose(): void { }
		}
		instantiationService.stub(IViewsService, store.add(new TrackingViewsService()));
		const roster = store.add(new RosterWithLiveTree(teamLiveTree));
		roster.setEngineConnected(true);
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IAgentInspectService, inspectService);
		instantiationService.stub(IUniverseAgentConnection, createNavigatorConnectionTestStub({
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getNavigatorCapability: () => 'SUPPORTED',
			team: {
				memberStatus: async () => [{
					memberName: 'Alice',
					memberAgentId: 'member:1',
					status: 'IDLE',
					preset: 'p',
					dynamic: 'd',
					turnCount: 1,
				}],
				taskList: async () => [],
				teamInfo: async () => undefined,
			},
		}));
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
		view.render();
		document.createElement('div').appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);
		await (view as unknown as { refreshTeamData: () => Promise<void> }).refreshTeamData();

		const membersList = (view as unknown as { membersList: WorkbenchList<INavigatorTeamMember> }).membersList;
		assert.strictEqual(membersList.length, 1);
		membersList.setFocus([0]);
		view.inspectFocusedTitleAction();

		const target = inspectService.getTarget();
		assert.strictEqual(target?.kind, 'member');
		assert.strictEqual(target?.kind === 'member' ? target.info.memberAgentId : undefined, 'member:1');
		assert.deepStrictEqual(openViewCalls, [{ id: AGENT_INSPECT_VIEW_ID, focus: true }]);
	});

	test('ViewTitle Inspect with no focus notifies and does not open blank Inspect', () => {
		const notices: string[] = [];
		const instantiationService = workbenchInstantiationService(undefined, store);
		const inspectService = store.add(instantiationService.createInstance(AgentInspectService));
		const openViewCalls: Array<{ id: string; focus: boolean | undefined }> = [];
		class TrackingViewsService extends TestViewsService {
			override openView<T>(id: string, focus?: boolean): Promise<T | null> {
				openViewCalls.push({ id, focus });
				return Promise.resolve(null);
			}
			dispose(): void { }
		}
		instantiationService.stub(IViewsService, store.add(new TrackingViewsService()));
		instantiationService.stub(IConversationRosterService, store.add(new ConversationStubService()));
		instantiationService.stub(IAgentInspectService, inspectService);
		instantiationService.stub(IUniverseAgentConnection, createNavigatorConnectionTestStub());
		instantiationService.stub(INotificationService, {
			info: (message: string) => {
				notices.push(typeof message === 'string' ? message : String(message));
			},
			error: () => { },
		} as INotificationService);
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
		view.render();
		document.createElement('div').appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);

		assert.strictEqual(inspectService.getTarget(), undefined);
		view.inspectFocusedTitleAction();
		assert.strictEqual(inspectService.getTarget(), undefined);
		assert.deepStrictEqual(openViewCalls, []);
		assert.deepStrictEqual(notices, ['Select a team member or task to inspect']);
	});

	test('acquireSessionView throw notifies error without hanging a lease or unhandled rejection', async () => {
		const boom = new Error('acquireSessionView: session untitled is not engine-bound');
		class RosterAcquireThrows extends ConversationStubService {
			override acquireSessionView(_sessionId: string): IConversationSessionViewLease {
				throw boom;
			}
		}
		const errors: string[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		const roster = store.add(new RosterAcquireThrows());
		const notification = {
			error: (message: string | Error) => {
				errors.push(typeof message === 'string' ? message : getErrorMessage(message));
			},
		} as INotificationService;
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			let view: NavigatorTeamView | undefined;
			assert.doesNotThrow(() => {
				view = mountTeamView(roster, createNavigatorConnectionTestStub(), notification);
			});
			assert.ok(view);
			const holder = (view as unknown as { leaseHolder: NavigatorSessionLeaseHolder }).leaseHolder;
			assert.strictEqual(holder.getLease(), undefined);
			assert.deepStrictEqual(errors, [getErrorMessage(boom)]);
			assert.strictEqual(view.getActiveSubview(), 'members');
			await new Promise<void>(resolve => setTimeout(resolve, 0));
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});
});
