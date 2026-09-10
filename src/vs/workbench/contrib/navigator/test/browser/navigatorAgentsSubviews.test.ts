/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, getErrorMessage, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { getSelectionKeyboardEvent, WorkbenchList, WorkbenchObjectTree } from '../../../../../platform/list/browser/listService.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { Extensions as ViewExtensions, IViewContainerModel, IViewDescriptorService, IViewsRegistry, ViewContainer, ViewContainerLocation } from '../../../../common/views.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { IConversationSessionViewLease } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { LiveAgentTreeNodeView, SessionViewSnapshot } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import type { UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { ConversationStubService, IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import { IConversationSessionChatService } from '../../../conversation/browser/conversationSessionChatService.js';
import { IConversationPartService } from '../../../../browser/parts/conversation/conversationPart.js';
import { IAgentInspectService } from '../../common/agentInspect.js';
import { AgentInspectService } from '../../browser/agentInspectService.js';
import { CommandsRegistry, ICommandService } from '../../../../../platform/commands/common/commands.js';
import type { INavigatorAgentsHierarchyNode } from '../../common/navigatorAgentHierarchy.js';
import type { INavigatorAgentsActivityItem } from '../../common/navigatorAgentsActivity.js';
import { NAVIGATOR_ACTIVITY_FETCH_FAILED_COPY, NAVIGATOR_STALE_SNAPSHOT_COPY } from '../../common/navigatorAgentTreeEmptyState.js';
import { createNavigatorConnectionTestStub } from '../common/navigatorConnectionTestStub.js';
import { workbenchInstantiationService, TestViewsService } from '../../../../test/browser/workbenchTestServices.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { AGENT_INSPECT_VIEW_ID, OPEN_NAVIGATOR_AGENTS_INSPECT_COMMAND_ID } from '../../browser/agentInspectIds.js';
import { CONVERSATION_REVEAL_ITEM_COMMAND_ID } from '../../../conversation/browser/conversationRevealItem.contribution.js';
import { IConversationTimelineRevealService } from '../../../conversation/browser/conversationTimelineRevealService.js';
import '../../browser/navigator.contribution.js';
import {
	NAVIGATOR_AGENTS_SHOW_ACTIVITY_COMMAND_ID,
	NAVIGATOR_AGENTS_SHOW_HIERARCHY_COMMAND_ID,
	NAVIGATOR_AGENTS_REFRESH_COMMAND_ID,
	NAVIGATOR_AGENTS_INSPECT_ITEM_COMMAND_ID,
	NAVIGATOR_AGENTS_REVEAL_COMMAND_ID,
	NAVIGATOR_AGENTS_VIEW_ID,
	NavigatorAgentsView,
	UA_ENGINE_CONNECTED_KEY,
} from '../../browser/navigatorAgentsView.js';

suite('Navigator Agents subviews', () => {

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

	const sampleLiveTree: LiveAgentTreeNodeView = {
		agentId: 'root',
		name: 'Root',
		type: 'AGENT_TYPE_ROOT',
		status: 'AGENT_STATUS_IDLE',
		model: 'm',
		turnCount: 1,
		createdAt: 0,
		children: [{
			agentId: 'sub:alpha',
			name: 'Alpha',
			type: 'AGENT_TYPE_SUB',
			status: 'AGENT_STATUS_IDLE',
			model: 'm',
			turnCount: 0,
			createdAt: 0,
			children: [],
		}],
	};

	class RosterWithMutableTreeAndActivity extends ConversationStubService {
		liveTree: LiveAgentTreeNodeView | undefined = sampleLiveTree;

		override acquireSessionView(sessionId: string): IConversationSessionViewLease {
			const lease = super.acquireSessionView(sessionId);
			const originalSnapshot = lease.snapshot;
			const originalAttribution = lease.attribution;
			const toolId = 'tool-leftover' as SessionViewSnapshot['timeline'][number]['id'];
			const self = this;
			Object.defineProperty(lease, 'snapshot', {
				configurable: true,
				get: () => ({
					...originalSnapshot,
					liveAgentTree: self.liveTree,
					timeline: [
						...originalSnapshot.timeline,
						{
							id: toolId,
							orderKey: 'leftover',
							summary: { kind: 'tool' as const, title: 'Run', toolName: 'grep', status: 'completed' as const },
						},
					],
				}),
			});
			Object.defineProperty(lease, 'attribution', {
				configurable: true,
				get: () => {
					const next = new Map(originalAttribution);
					next.set(String(toolId), { role: 'tool', agentId: 'sub:alpha' });
					return next;
				},
			});
			return lease;
		}
	}

	function mountAgentsView(
		roster: ConversationStubService = store.add(new ConversationStubService()),
		connection: IUniverseAgentConnection = createNavigatorConnectionTestStub(),
		inspectService?: IAgentInspectService,
		executeCommand: ICommandService['executeCommand'] = async () => undefined,
	): NavigatorAgentsView {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IAgentInspectService, inspectService ?? store.add(instantiationService.createInstance(AgentInspectService)) as IAgentInspectService);
		instantiationService.stub(ICommandService, { executeCommand });
		instantiationService.stub(IUniverseAgentConnection, connection);
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

	test('ViewTitle registers Hierarchy, Activity, Refresh, and Inspect actions for Agents', () => {
		const viewTitleItems = MenuRegistry.getMenuItems(MenuId.ViewTitle).filter(isIMenuItem);
		const hierarchyItem = viewTitleItems.find(item => item.command.id === NAVIGATOR_AGENTS_SHOW_HIERARCHY_COMMAND_ID);
		const activityItem = viewTitleItems.find(item => item.command.id === NAVIGATOR_AGENTS_SHOW_ACTIVITY_COMMAND_ID);
		const refreshItem = viewTitleItems.find(item => item.command.id === NAVIGATOR_AGENTS_REFRESH_COMMAND_ID);
		const inspectItem = viewTitleItems.find(item => item.command.id === OPEN_NAVIGATOR_AGENTS_INSPECT_COMMAND_ID);

		assert.ok(hierarchyItem, 'Agents ViewTitle must expose Hierarchy');
		assert.ok(activityItem, 'Agents ViewTitle must expose Activity');
		assert.ok(refreshItem, 'Agents ViewTitle must expose Refresh');
		assert.ok(inspectItem, 'Agents ViewTitle must still expose Inspect');
	});

	test('Refresh asks the connection to reload the live agent tree', () => {
		let refreshedSessionId: string | undefined;
		const instantiationService = workbenchInstantiationService(undefined, store);
		const roster = store.add(new ConversationStubService());
		roster.setEngineConnected(true);
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IAgentInspectService, store.add(instantiationService.createInstance(AgentInspectService)) as IAgentInspectService);
		instantiationService.stub(ICommandService, { executeCommand: async () => undefined });
		instantiationService.stub(IUniverseAgentConnection, createNavigatorConnectionTestStub({
			requestAgentTreeRefresh: sessionId => {
				refreshedSessionId = sessionId;
			},
		}));
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
		view.render();
		document.createElement('div').appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);
		view.refreshAgentTree();
		assert.strictEqual(refreshedSessionId, roster.getActiveSessionId());
	});

	test('Refresh is unavailable when engine is disconnected', () => {
		let refreshCalls = 0;
		const instantiationService = workbenchInstantiationService(undefined, store);
		const roster = store.add(new ConversationStubService());
		roster.setEngineConnected(false);
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IAgentInspectService, store.add(instantiationService.createInstance(AgentInspectService)) as IAgentInspectService);
		instantiationService.stub(ICommandService, { executeCommand: async () => undefined });
		instantiationService.stub(IUniverseAgentConnection, createNavigatorConnectionTestStub({
			requestAgentTreeRefresh: () => {
				refreshCalls++;
			},
		}));
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
		view.render();
		document.createElement('div').appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);
		assert.strictEqual(UA_ENGINE_CONNECTED_KEY.getValue(view['scopedContextKeyService']), false);
		view.refreshAgentTree();
		assert.strictEqual(refreshCalls, 0);
	});

	test('connecting phase is honest empty, not Agent tree loading', () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const roster = store.add(new ConversationStubService());
		roster.setEngineConnected(true);
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IAgentInspectService, store.add(instantiationService.createInstance(AgentInspectService)) as IAgentInspectService);
		instantiationService.stub(ICommandService, { executeCommand: async () => undefined });
		instantiationService.stub(IUniverseAgentConnection, createNavigatorConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connecting', reason: 'initial' }),
		}));
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
		view.render();
		document.createElement('div').appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);
		const hierarchyEmpty = view.element.querySelector('.navigator-agents-subview.active .navigator-stub-empty');
		assert.strictEqual(hierarchyEmpty?.textContent, 'No agents — no engine.');
		assert.ok(!hierarchyEmpty?.textContent?.includes('Reading'));
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

	test('disconnect keeps last Agents snapshot and marks it stale', () => {
		const roster = store.add(new RosterWithLiveTree(sampleLiveTree));
		roster.setEngineConnected(true);
		const connection = createNavigatorConnectionTestStub({
			getConnectionPhase: () => roster.isEngineConnected() ? { kind: 'connected', path: 'direct' } : { kind: 'disconnected' },
			getNavigatorCapability: () => 'SUPPORTED',
		});
		const view = mountAgentsView(roster, connection);

		const hierarchyTree = (view as unknown as { hierarchyTree: WorkbenchObjectTree<INavigatorAgentsHierarchyNode, void> }).hierarchyTree;
		assert.strictEqual(hierarchyTree.getNode(null)?.children.length ?? 0, 1);
		assert.strictEqual(hierarchyTree.getNode(null)?.children[0]?.element?.label, 'Root');

		roster.setEngineConnected(false);

		assert.strictEqual(hierarchyTree.getNode(null)?.children.length ?? 0, 1);
		assert.strictEqual(hierarchyTree.getNode(null)?.children[0]?.element?.label, 'Root');
		const note = view.element.querySelector('.navigator-agents-subview.active .navigator-stub-note') as HTMLElement | null;
		assert.ok(note);
		assert.strictEqual(note.style.display, 'block');
		assert.strictEqual(note.textContent, NAVIGATOR_STALE_SNAPSHOT_COPY);
		const hierarchyEmpty = view.element.querySelector('.navigator-agents-subview.active .navigator-stub-empty') as HTMLElement | null;
		assert.ok(hierarchyEmpty);
		assert.notStrictEqual(hierarchyEmpty.style.display, 'block');
	});

	test('Agents leftover-empty is not used for pending / UNSUPPORTED / no-session / hidden', () => {
		const inspectService = store.add(new AgentInspectService());
		const roster = store.add(new RosterWithLiveTree(sampleLiveTree));
		roster.setEngineConnected(true);
		const view = mountAgentsView(roster, createNavigatorConnectionTestStub({
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getNavigatorCapability: () => 'SUPPORTED',
		}), inspectService);
		assert.ok(inspectService.getLiveAgentIds()?.has('sub:alpha'));
		assert.ok(inspectService.getLiveAgentIds()?.has('root'));

		view.setVisible(false);
		assert.strictEqual(inspectService.getLiveAgentIds(), undefined);
		view.setVisible(true);
		assert.ok(inspectService.getLiveAgentIds()?.has('sub:alpha'));

		class RosterNoSession extends ConversationStubService {
			override getActiveSessionId(): string {
				return '';
			}
		}
		const noSessionInspect = store.add(new AgentInspectService());
		const noSessionRoster = store.add(new RosterNoSession());
		noSessionRoster.setEngineConnected(true);
		mountAgentsView(noSessionRoster, createNavigatorConnectionTestStub({
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getNavigatorCapability: () => 'SUPPORTED',
		}), noSessionInspect);
		assert.strictEqual(noSessionInspect.getLiveAgentIds(), undefined);

		const unsupportedInspect = store.add(new AgentInspectService());
		const unsupportedRoster = store.add(new ConversationStubService());
		unsupportedRoster.setEngineConnected(true);
		mountAgentsView(unsupportedRoster, createNavigatorConnectionTestStub({
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getNavigatorCapability: () => 'UNSUPPORTED',
		}), unsupportedInspect);
		assert.strictEqual(unsupportedInspect.getLiveAgentIds(), undefined);

		const pendingInspect = store.add(new AgentInspectService());
		const pendingRoster = store.add(new ConversationStubService());
		pendingRoster.setEngineConnected(true);
		mountAgentsView(pendingRoster, createNavigatorConnectionTestStub({
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getNavigatorCapability: () => 'SUPPORTED',
			isAgentTreeFetchFailed: () => true,
		}), pendingInspect);
		assert.strictEqual(pendingInspect.getLiveAgentIds(), undefined);
	});

	test('never-connected Agents stay honest empty without a snapshot note', () => {
		const view = mountAgentsView();
		const note = view.element.querySelector('.navigator-agents-subview.active .navigator-stub-note') as HTMLElement | null;
		assert.ok(note);
		assert.strictEqual(note.style.display, 'none');
		const hierarchyEmpty = view.element.querySelector('.navigator-agents-subview.active .navigator-stub-empty') as HTMLElement | null;
		assert.strictEqual(hierarchyEmpty?.textContent, 'No agents — no engine.');
	});

	test('engineReady Activity empty is connected-empty, not no-engine', () => {
		const roster = store.add(new ConversationStubService());
		roster.setEngineConnected(true);
		const view = mountAgentsView(roster, createNavigatorConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getNavigatorCapability: () => 'UNKNOWN',
		}));
		view.showActivity();
		const activityEmpty = view.element.querySelector('.navigator-agents-subview.active .navigator-stub-empty');
		assert.strictEqual(activityEmpty?.textContent, 'No tool activity yet.');
		assert.ok(!activityEmpty?.textContent?.includes('no engine'));
		view.showHierarchy();
		const hierarchyEmpty = view.element.querySelector('.navigator-agents-subview.active .navigator-stub-empty');
		assert.ok(!hierarchyEmpty?.textContent?.includes('no engine'));
	});

	test('engineReady tree fetch-failed does not use no-engine copy', () => {
		const roster = store.add(new ConversationStubService());
		roster.setEngineConnected(true);
		const view = mountAgentsView(roster, createNavigatorConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getNavigatorCapability: () => 'SUPPORTED',
			isAgentTreeFetchFailed: () => true,
		}));
		const hierarchyEmpty = view.element.querySelector('.navigator-agents-subview.active .navigator-stub-empty');
		assert.strictEqual(hierarchyEmpty?.textContent, 'Failed to read the agent tree');
		assert.ok(!hierarchyEmpty?.textContent?.includes('no engine'));
		view.showActivity();
		const activityEmpty = view.element.querySelector('.navigator-agents-subview.active .navigator-stub-empty');
		assert.strictEqual(activityEmpty?.textContent, 'Failed to read tool activity');
		assert.ok(!activityEmpty?.textContent?.includes('no engine'));
	});

	test('tree fetch-failed after live Activity paint keeps leftover rows and marks failed', () => {
		const roster = store.add(new RosterWithMutableTreeAndActivity());
		roster.setEngineConnected(true);
		let treeFetchFailed = false;
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const connection = createNavigatorConnectionTestStub({
			getConnectionPhase: () => ({ kind: 'connected', path: 'direct' }),
			getNavigatorCapability: () => 'SUPPORTED',
			isAgentTreeFetchFailed: () => treeFetchFailed,
			onDidChangeConnection: onDidChangeConnection.event,
		});
		const view = mountAgentsView(roster, connection);
		view.showActivity();

		const activityList = (view as unknown as { activityList: WorkbenchList<INavigatorAgentsActivityItem> }).activityList;
		assert.ok(activityList, 'live paint must have an activity list');
		assert.ok(activityList.length > 0, 'live paint must have leftover activity rows');
		const leftoverLabels = Array.from({ length: activityList.length }, (_, i) => activityList.element(i)?.label);
		assert.ok(leftoverLabels.some(label => label?.includes('grep')), 'live paint must show leftover tool activity');
		const liveNote = view.element.querySelector('.navigator-agents-subview.active .navigator-stub-note') as HTMLElement | null;
		assert.ok(liveNote);
		assert.notStrictEqual(liveNote.style.display, 'block', 'live paint must not already look failed');

		roster.liveTree = undefined;
		treeFetchFailed = true;
		onDidChangeConnection.fire(connection.getConnectionSnapshot());

		assert.strictEqual(activityList.length, leftoverLabels.length, 'fetch-fail must keep leftover activity rows');
		assert.deepStrictEqual(
			Array.from({ length: activityList.length }, (_, i) => activityList.element(i)?.label),
			leftoverLabels,
		);
		const failedNote = view.element.querySelector('.navigator-agents-subview.active .navigator-stub-note') as HTMLElement | null;
		assert.ok(failedNote, 'fetch-fail must mark leftover activity');
		assert.strictEqual(failedNote.style.display, 'block');
		assert.strictEqual(failedNote.textContent, NAVIGATOR_ACTIVITY_FETCH_FAILED_COPY);
		const activityEmpty = view.element.querySelector('.navigator-agents-subview.active .navigator-stub-empty') as HTMLElement | null;
		assert.ok(activityEmpty);
		assert.notStrictEqual(activityEmpty.style.display, 'block', 'fetch-fail leftover must not be painted as empty success');
	});

	test('ViewTitle Inspect with hierarchy focus sets the agent target and opens Inspect', () => {
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
		view.render();
		document.createElement('div').appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);

		setHierarchyEntries(view, [{ id: 'sub:alpha', label: 'Alpha' }]);
		const hierarchyTree = (view as unknown as { hierarchyTree: WorkbenchObjectTree<INavigatorAgentsHierarchyNode, void> }).hierarchyTree;
		const focused = hierarchyTree.getNode(null)?.children[0]?.element;
		assert.ok(focused);
		hierarchyTree.setFocus([focused]);
		view.inspectFocusedTitleAction();

		const target = inspectService.getTarget();
		assert.strictEqual(target?.kind, 'agent');
		assert.strictEqual(target?.kind === 'agent' ? target.node.agentId : undefined, 'sub:alpha');
		assert.deepStrictEqual(openViewCalls, [{ id: AGENT_INSPECT_VIEW_ID, focus: true }]);
	});

	test('ViewTitle Inspect with activity focus sets the activity target and opens Inspect', () => {
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
		view.render();
		document.createElement('div').appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);
		view.showActivity();
		setActivityEntries(view, [{ id: 'a1', label: 'Alpha Tool Run' }]);
		const activityList = (view as unknown as { activityList: WorkbenchList<INavigatorAgentsActivityItem> }).activityList;
		activityList.setFocus([0]);
		view.inspectFocusedTitleAction();

		const target = inspectService.getTarget();
		assert.strictEqual(target?.kind, 'activity');
		assert.strictEqual(target?.kind === 'activity' ? target.item.itemId : undefined, 'a1');
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
		instantiationService.stub(ICommandService, { executeCommand: async () => undefined });
		instantiationService.stub(IUniverseAgentConnection, createNavigatorConnectionTestStub());
		instantiationService.stub(INotificationService, {
			info: (message: string) => {
				notices.push(typeof message === 'string' ? message : String(message));
			},
			error: () => { },
		} as unknown as INotificationService);
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
		view.render();
		document.createElement('div').appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);

		assert.strictEqual(inspectService.getTarget(), undefined);
		view.inspectFocusedTitleAction();
		assert.strictEqual(inspectService.getTarget(), undefined);
		assert.deepStrictEqual(openViewCalls, []);
		assert.deepStrictEqual(notices, ['Select an agent or activity item to inspect']);
	});

	test('Agents tree registers per-row Inspect and Reveal actions', () => {
		const viewItemItems = MenuRegistry.getMenuItems(MenuId.ViewItemContext).filter(isIMenuItem);
		const inspectItem = viewItemItems.find(item => item.command.id === NAVIGATOR_AGENTS_INSPECT_ITEM_COMMAND_ID);
		const revealItem = viewItemItems.find(item => item.command.id === NAVIGATOR_AGENTS_REVEAL_COMMAND_ID);
		assert.ok(inspectItem, 'Agents tree must expose per-row Inspect');
		assert.ok(revealItem, 'Agents tree must expose per-row Reveal');
	});

	test('per-row Inspect sets the agent target and opens Inspect panel', async () => {
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
		view.render();
		document.createElement('div').appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);

		const node = hierarchyNode('sub:alpha', 'Alpha');
		view.inspectHierarchyNode(node);

		const target = inspectService.getTarget();
		assert.strictEqual(target?.kind, 'agent');
		assert.strictEqual(target?.kind === 'agent' ? target.node.agentId : undefined, 'sub:alpha');
		assert.deepStrictEqual(openViewCalls, [{ id: AGENT_INSPECT_VIEW_ID, focus: true }]);
	});

	test('per-row Reveal opens the agent in Conversation', async () => {
		const opened: Array<{ sessionKey: string; chatId: string; title?: string }> = [];
		const instantiationService = workbenchInstantiationService(undefined, store);
		const roster = store.add(new ConversationStubService());
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IAgentInspectService, store.add(instantiationService.createInstance(AgentInspectService)) as IAgentInspectService);
		instantiationService.stub(ICommandService, { executeCommand: async () => undefined });
		instantiationService.stub(IUniverseAgentConnection, createNavigatorConnectionTestStub());
		instantiationService.stub(IConversationPartService, { focus: () => { } } as IConversationPartService);
		instantiationService.stub(IConversationSessionChatService, {
			findOpenTabForChat: () => undefined,
			isSubAgentDialogOpen: () => false,
			closeSubAgentDialog: () => { },
			navigateAgentBreadcrumb: async () => { },
			openSubAgent: async (sessionKey: string, chatId: string, title?: string) => {
				opened.push({ sessionKey, chatId, title });
			},
		} as unknown as IConversationSessionChatService);
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
		view.render();
		document.createElement('div').appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);

		view.revealHierarchyNode(hierarchyNode('sub:alpha', 'Alpha'));
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(opened, [{ sessionKey: roster.getActiveSessionId(), chatId: 'sub:alpha', title: 'Alpha' }]);
	});

	test('openSubAgent throw notifies error without unhandled rejection', async () => {
		const boom = new Error('Sub-agent overlay for session untitled is not mounted');
		const errors: string[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		const instantiationService = workbenchInstantiationService(undefined, store);
		const roster = store.add(new ConversationStubService());
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IAgentInspectService, store.add(instantiationService.createInstance(AgentInspectService)) as IAgentInspectService);
		instantiationService.stub(ICommandService, { executeCommand: async () => undefined });
		instantiationService.stub(IUniverseAgentConnection, createNavigatorConnectionTestStub());
		instantiationService.stub(IConversationPartService, { focus: () => { } } as IConversationPartService);
		instantiationService.stub(IConversationSessionChatService, {
			findOpenTabForChat: () => undefined,
			isSubAgentDialogOpen: () => false,
			closeSubAgentDialog: () => { },
			navigateAgentBreadcrumb: async () => { },
			openSubAgent: async () => {
				throw boom;
			},
		} as unknown as IConversationSessionChatService);
		instantiationService.stub(INotificationService, {
			error: (message: string | Error) => {
				errors.push(typeof message === 'string' ? message : getErrorMessage(message));
			},
		} as INotificationService);
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
		view.render();
		document.createElement('div').appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);

		process.on('unhandledRejection', onUnhandledRejection);
		try {
			view.revealHierarchyNode(hierarchyNode('sub:alpha', 'Alpha'));
			await new Promise<void>(resolve => setTimeout(resolve, 0));
			assert.deepStrictEqual(errors, [getErrorMessage(boom)]);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('conversation.revealItem acquireSessionView throw notifies error without unhandled rejection', async () => {
		const boom = new Error('acquireSessionView: session untitled is not engine-bound');
		const errors: string[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		class RosterAcquireThrows extends ConversationStubService {
			override acquireSessionView(_sessionId: string): IConversationSessionViewLease {
				throw boom;
			}
		}
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, store.add(new RosterAcquireThrows()));
		instantiationService.stub(IConversationPartService, { focus: () => { } } as IConversationPartService);
		instantiationService.stub(IConversationTimelineRevealService, {
			revealItem: () => { },
			registerLens: () => ({ dispose: () => { } }),
			getAccessibleTurnContent: () => undefined,
			focusAccessibleTurn: () => { },
			scrollToFirstPendingConfirmation: () => { },
		} as unknown as IConversationTimelineRevealService);
		instantiationService.stub(INotificationService, {
			error: (message: string | Error) => {
				errors.push(typeof message === 'string' ? message : getErrorMessage(message));
			},
		} as INotificationService);

		const command = CommandsRegistry.getCommand(CONVERSATION_REVEAL_ITEM_COMMAND_ID);
		assert.ok(command, 'conversation.revealItem must be registered');

		process.on('unhandledRejection', onUnhandledRejection);
		try {
			void instantiationService.invokeFunction(accessor => command.handler(accessor, { itemId: 'item-1' }));
			await new Promise<void>(resolve => setTimeout(resolve, 0));
			assert.deepStrictEqual(errors, [getErrorMessage(boom)]);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('activity list open does not leak unhandled rejection when reveal command rejects', async () => {
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		let executeCommandCalls = 0;
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(() => { });
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const view = mountAgentsView(
				store.add(new ConversationStubService()),
				createNavigatorConnectionTestStub(),
				undefined,
				async () => {
					executeCommandCalls++;
					throw new Error('boom');
				},
			);
			setActivityEntries(view, [{ id: 'a1', label: 'Alpha Tool Run' }]);
			view.showActivity();
			const activityList = (view as unknown as { activityList: WorkbenchList<INavigatorAgentsActivityItem> }).activityList;
			assert.ok(activityList, 'expected WorkbenchList for activity');
			assert.strictEqual(activityList.length, 1);
			activityList.setFocus([0]);
			activityList.setSelection([0], getSelectionKeyboardEvent('keydown', false, false));
			await timeout(0);
			assert.strictEqual(executeCommandCalls, 1);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});
});
