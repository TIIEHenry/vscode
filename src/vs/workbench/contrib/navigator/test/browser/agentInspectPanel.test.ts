/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewContainerModel, IViewContainersRegistry, IViewDescriptorService, IViewsRegistry, ViewContainer, ViewContainerLocation } from '../../../../common/views.js';
import { IViewsService } from '../../../../services/views/common/viewsService.js';
import { workbenchInstantiationService, TestViewsService } from '../../../../test/browser/workbenchTestServices.js';
import {
	AGENT_INSPECT_CONTAINER_ID,
	AGENT_INSPECT_VIEW_ID,
	OPEN_AGENT_INSPECT_VIEW_COMMAND_ID,
	OPEN_NAVIGATOR_AGENTS_INSPECT_COMMAND_ID,
	OPEN_NAVIGATOR_TEAM_INSPECT_COMMAND_ID,
} from '../../browser/agentInspectIds.js';
import { AGENT_INSPECT_VIEW_CONTAINER } from '../../browser/agentInspect.contribution.js';
import '../../browser/agentInspect.contribution.js';
import { AgentInspectService } from '../../browser/agentInspectService.js';
import { AgentInspectView, IAgentInspectEntry, inspectTitleFromTarget, isInspectTargetStale } from '../../browser/agentInspectView.js';
import { IAgentInspectService } from '../../common/agentInspect.js';
import { ConversationStubService, IConversationRosterService } from '../../../conversation/browser/conversationStubService.js';
import '../../browser/navigator.contribution.js';
import { NAVIGATOR_AGENTS_VIEW_ID, NAVIGATOR_TEAM_VIEW_ID } from '../../browser/navigatorStubView.js';

const INSPECT_EMPTY_COPY = '在 Agents 或 Team 里选择一项';

suite('Agent inspect panel', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
	const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

	function getViewList(view: AgentInspectView): WorkbenchList<IAgentInspectEntry> {
		return (view as unknown as { list: WorkbenchList<IAgentInspectEntry> }).list;
	}

	function getViewEntries(view: AgentInspectView): IAgentInspectEntry[] {
		return (view as unknown as { entries: IAgentInspectEntry[] }).entries;
	}

	async function mountView(): Promise<AgentInspectView> {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, store.add(new ConversationStubService()));
		instantiationService.stub(IAgentInspectService, store.add(instantiationService.createInstance(AgentInspectService)));
		return mountViewWithService(instantiationService);
	}

	test('Inspect container and view register on Panel', () => {
		const container = viewContainersRegistry.get(AGENT_INSPECT_CONTAINER_ID);
		assert.ok(container, 'Agent inspect panel container should be registered');
		assert.strictEqual(container, AGENT_INSPECT_VIEW_CONTAINER);
		assert.strictEqual(
			viewContainersRegistry.getViewContainerLocation(container),
			ViewContainerLocation.Panel,
			'Agent inspect must live on PANEL_PART'
		);

		const viewDescriptor = viewsRegistry.getView(AGENT_INSPECT_VIEW_ID);
		assert.ok(viewDescriptor, 'Agent inspect view should be registered');
		assert.strictEqual(viewsRegistry.getViewContainer(AGENT_INSPECT_VIEW_ID), container);
	});

	test('Inspect view descriptor is not EditorInput', () => {
		const viewDescriptor = viewsRegistry.getView(AGENT_INSPECT_VIEW_ID);
		assert.ok(viewDescriptor);
		assert.notStrictEqual(viewDescriptor.ctorDescriptor.ctor, EditorInput);
	});

	test('Inspect view exposes open command for default-window product path', () => {
		const viewDescriptor = viewsRegistry.getView(AGENT_INSPECT_VIEW_ID);
		assert.ok(viewDescriptor);
		assert.ok(viewDescriptor.openCommandActionDescriptor, 'Agent inspect must register an open command');
		assert.strictEqual(viewDescriptor.openCommandActionDescriptor.id, OPEN_AGENT_INSPECT_VIEW_COMMAND_ID);
		assert.strictEqual(viewDescriptor.when, undefined, 'v1 single leaf must stay always active for hideIfEmpty container');
	});

	test('Product four path opens inspect panel view via ViewsService', async () => {
		const openViewCalls: Array<{ id: string; focus: boolean | undefined }> = [];
		class TrackingViewsService extends TestViewsService {
			override openView<T>(id: string, focus?: boolean): Promise<T | null> {
				openViewCalls.push({ id, focus });
				return Promise.resolve(null);
			}
			dispose(): void { }
		}

		const instantiationService = workbenchInstantiationService(undefined, store);
		const viewsService = store.add(new TrackingViewsService());
		instantiationService.stub(IViewsService, viewsService);

		await instantiationService.invokeFunction(async accessor => {
			await accessor.get(IViewsService).openView(AGENT_INSPECT_VIEW_ID, true);
		});

		assert.deepStrictEqual(openViewCalls, [{ id: AGENT_INSPECT_VIEW_ID, focus: true }]);
	});

	test('Agents and Team ViewTitle Inspect actions are registered on product-four views', () => {
		const viewTitleItems = MenuRegistry.getMenuItems(MenuId.ViewTitle);
		const agentsInspectItem = viewTitleItems.filter(isIMenuItem).find(item => item.command.id === OPEN_NAVIGATOR_AGENTS_INSPECT_COMMAND_ID);
		const teamInspectItem = viewTitleItems.filter(isIMenuItem).find(item => item.command.id === OPEN_NAVIGATOR_TEAM_INSPECT_COMMAND_ID);
		assert.ok(agentsInspectItem, 'Agents ViewTitle must expose an Inspect action');
		assert.ok(teamInspectItem, 'Team ViewTitle must expose an Inspect action');
		assert.strictEqual(agentsInspectItem.command.id, OPEN_NAVIGATOR_AGENTS_INSPECT_COMMAND_ID);
		assert.strictEqual(teamInspectItem.command.id, OPEN_NAVIGATOR_TEAM_INSPECT_COMMAND_ID);
	});

	test('Agents ViewTitle Inspect action opens inspect panel view via ViewsService', async () => {
		const openViewCalls: Array<{ id: string; focus: boolean | undefined }> = [];
		class TrackingViewsService extends TestViewsService {
			override openView<T>(id: string, focus?: boolean): Promise<T | null> {
				openViewCalls.push({ id, focus });
				return Promise.resolve(null);
			}
			override getActiveViewWithId<T>(id: string): T | null {
				return id === NAVIGATOR_AGENTS_VIEW_ID ? {} as T : null;
			}
			dispose(): void { }
		}

		const instantiationService = workbenchInstantiationService(undefined, store);
		const viewsService = store.add(new TrackingViewsService());
		instantiationService.stub(IViewsService, viewsService);

		const command = CommandsRegistry.getCommand(OPEN_NAVIGATOR_AGENTS_INSPECT_COMMAND_ID);
		assert.ok(command, 'Agents Inspect action must register as a command');

		await instantiationService.invokeFunction(accessor => command!.handler(accessor));
		assert.deepStrictEqual(openViewCalls, [{ id: AGENT_INSPECT_VIEW_ID, focus: true }]);
	});

	test('empty inspect list shows welcome with no targets', async () => {
		const view = await mountView();
		assert.strictEqual(view.shouldShowWelcome(), true);
		assert.deepStrictEqual(getViewEntries(view), []);
		assert.strictEqual(getViewList(view).length, 0);
	});

	test('welcome content uses inspect-empty copy without service-disconnected wording', () => {
		const welcomeContents = viewsRegistry.getViewWelcomeContent(AGENT_INSPECT_VIEW_ID);
		assert.ok(welcomeContents.length > 0, 'Inspect view must register welcome content');
		const combined = welcomeContents.map(item => item.content).join('\n');
		assert.ok(combined.includes(INSPECT_EMPTY_COPY), `welcome must include "${INSPECT_EMPTY_COPY}"`);
		assert.ok(!/not connected/i.test(combined), 'welcome must not say not connected');
		assert.ok(!/copilot/i.test(combined), 'welcome must not mention Copilot');
		assert.ok(!/open chat/i.test(combined), 'welcome must not mention Open Chat');
		assert.ok(!/\(command:/.test(combined), 'welcome must not include command buttons');
	});

	test('setTarget agent template renders inspect fields', async () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, store.add(new ConversationStubService()));
		const inspectService = store.add(instantiationService.createInstance(AgentInspectService));
		instantiationService.stub(IAgentInspectService, inspectService);

		const view = await mountViewWithService(instantiationService);
		inspectService.setTarget({
			kind: 'agent',
			node: {
				agentId: 'sub:1',
				name: 'Worker',
				type: 'AGENT_TYPE_SUB',
				status: 'AGENT_STATUS_IDLE',
				model: 'gpt',
				turnCount: 3,
				createdAt: 100,
				children: [],
			},
		});

		await new Promise<void>(resolve => setTimeout(resolve, 0));
		const labels = getViewEntries(view).map(entry => entry.label);
		assert.ok(labels.some(label => label.includes('agent_id: sub:1')));
		assert.ok(labels.some(label => label.includes('name: Worker')));
		assert.strictEqual(inspectTitleFromTarget({
			kind: 'agent',
			node: {
				agentId: 'sub:1',
				name: 'Worker',
				type: 'AGENT_TYPE_SUB',
				status: 'AGENT_STATUS_IDLE',
				model: 'gpt',
				turnCount: 3,
				createdAt: 100,
				children: [],
			},
		}), 'Inspect: Worker');
		assert.strictEqual(inspectTitleFromTarget({
			kind: 'member',
			info: {
				memberName: 'Alice',
				memberAgentId: 'member:1',
				status: 'IDLE',
				preset: 'p',
				dynamic: 'd',
				turnCount: 1,
			},
		}), 'Inspect: Alice');
		assert.strictEqual(inspectTitleFromTarget({
			kind: 'task',
			task: {
				taskId: 't1',
				subject: 'Fix bug',
				owner: 'mgr',
				status: 'OPEN',
				blockedBy: '',
				lastMessage: '',
				description: '',
			},
		}), 'Inspect: Fix bug');
		assert.strictEqual(inspectTitleFromTarget({
			kind: 'activity',
			item: { id: 'a1', label: 'Run', toolName: 'grep', status: 'completed', itemId: 'i1' },
		}), 'Inspect: grep');
		assert.strictEqual(inspectTitleFromTarget(undefined), 'Inspect');
	});

	test('stale note follows live agent ids from inspect service bus', async () => {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, store.add(new ConversationStubService()));
		const inspectService = store.add(instantiationService.createInstance(AgentInspectService));
		instantiationService.stub(IAgentInspectService, inspectService);

		const view = await mountViewWithService(instantiationService);
		inspectService.setTarget({
			kind: 'member',
			info: {
				memberName: 'Alice',
				memberAgentId: 'member:gone',
				status: 'IDLE',
				preset: 'p',
				dynamic: 'd',
				turnCount: 1,
			},
		});
		inspectService.setLiveAgentIds('agents', undefined);
		inspectService.setLiveAgentIds('team', new Set(['member:other']));

		await new Promise<void>(resolve => setTimeout(resolve, 0));
		const staleNote = view.element.querySelector('.agent-inspect-stale-note') as HTMLElement;
		assert.ok(staleNote);
		assert.strictEqual(staleNote.style.display, '');
		assert.strictEqual(isInspectTargetStale(inspectService.getTarget(), inspectService.getLiveAgentIds()), true);

		inspectService.setLiveAgentIds('team', undefined);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.strictEqual(staleNote.style.display, 'none');
		assert.strictEqual(isInspectTargetStale(inspectService.getTarget(), inspectService.getLiveAgentIds()), false);
	});

	test('AgentInspectView does not hold its own session lease', async () => {
		const view = await mountView();
		assert.strictEqual((view as unknown as { leaseHolder?: unknown }).leaseHolder, undefined);
	});

	async function mountViewWithService(instantiationService: ReturnType<typeof workbenchInstantiationService>): Promise<AgentInspectView> {
		const stubViewContainer = {
			id: 'agent-inspect-test-container',
			title: { value: 'Inspect', original: 'Inspect' },
		} as ViewContainer;
		instantiationService.stub(IViewDescriptorService, {
			onDidChangeLocation: Event.None,
			getViewLocationById(_id: string): ViewContainerLocation {
				return ViewContainerLocation.Panel;
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

		const view = store.add(instantiationService.createInstance(AgentInspectView, {
			id: AGENT_INSPECT_VIEW_ID,
			title: 'Inspect',
		}));
		const container = document.createElement('div');
		view.render();
		container.appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		return view;
	}

	test('mounted view has WorkbenchList and no stub or chat widgets', async () => {
		const view = await mountView();
		const list = getViewList(view);
		assert.ok(list instanceof WorkbenchList, 'Inspect view must construct WorkbenchList');
		assert.ok(view.element.querySelector('.agent-inspect-list'));
		assert.strictEqual(view.element.querySelector('.agent-inspect-empty'), null);
		assert.strictEqual(view.element.querySelector('.navigator-stub-empty'), null);
		assert.strictEqual(view.element.querySelector('.chat-widget'), null);
		assert.strictEqual(view.element.querySelector('.chat-setup'), null);
	});

	test('Team ViewTitle Inspect action opens inspect panel view via ViewsService', async () => {
		const openViewCalls: Array<{ id: string; focus: boolean | undefined }> = [];
		class TrackingViewsService extends TestViewsService {
			override openView<T>(id: string, focus?: boolean): Promise<T | null> {
				openViewCalls.push({ id, focus });
				return Promise.resolve(null);
			}
			override getActiveViewWithId<T>(id: string): T | null {
				return id === NAVIGATOR_TEAM_VIEW_ID ? {} as T : null;
			}
			dispose(): void { }
		}

		const instantiationService = workbenchInstantiationService(undefined, store);
		const viewsService = store.add(new TrackingViewsService());
		instantiationService.stub(IViewsService, viewsService);

		const command = CommandsRegistry.getCommand(OPEN_NAVIGATOR_TEAM_INSPECT_COMMAND_ID);
		assert.ok(command, 'Team Inspect action must register as a command');

		await instantiationService.invokeFunction(accessor => command!.handler(accessor));
		assert.deepStrictEqual(openViewCalls, [{ id: AGENT_INSPECT_VIEW_ID, focus: true }]);
	});
});
