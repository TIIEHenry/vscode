/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { getSelectionKeyboardEvent, WorkbenchList } from '../../../../../platform/list/browser/listService.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { ConversationPart, IConversationPartService } from '../../../../browser/parts/conversation/conversationPart.js';
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewContainerModel, IViewContainersRegistry, IViewDescriptorService, IViewsRegistry, ViewContainer, ViewContainerLocation } from '../../../../common/views.js';
import { IWorkbenchLayoutService, Parts } from '../../../../services/layout/browser/layoutService.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { IEditorPane, IUntypedEditorInput } from '../../../../common/editor.js';
import { IEditorOptions } from '../../../../../platform/editor/common/editor.js';
import { IEditorService, PreferredGroup } from '../../../../services/editor/common/editorService.js';
import { ChatEditorInput } from '../../../chat/browser/widgetHosts/editor/chatEditorInput.js';
import { CONVERSATION_SESSIONS_CONTAINER_ID } from '../../browser/conversation.contribution.js';
import { CONVERSATION_SESSION_ROW_HEIGHT, CONVERSATION_SESSIONS_VIEW_ID, ConversationSessionsView } from '../../browser/conversationSessionsView.js';
import { ConversationStubSession } from '../../browser/conversationStubModel.js';
import { conversationLensSessionBarNewSession } from '../../browser/conversationLensSessionBarStrings.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { TestLayoutService, TestEditorService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import '../../../conversation/browser/conversation.contribution.js';

suite('ConversationSessionsView', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
	const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

	const stubViewContainer = {
		id: 'conversation-sessions-test-container',
		title: { value: 'Sessions', original: 'Sessions' },
	} as ViewContainer;

	function createViewDescriptorServiceStub(): IViewDescriptorService {
		return new class extends mock<IViewDescriptorService>() {
			override onDidChangeLocation = Event.None;
			override getViewLocationById(_id: string): ViewContainerLocation {
				return ViewContainerLocation.Sidebar;
			}
			override getViewDescriptorById(_id: string) {
				return null;
			}
			override getViewContainerByViewId(_id: string): ViewContainer | null {
				return stubViewContainer;
			}
			override getViewContainerModel(_viewContainer: ViewContainer): IViewContainerModel {
				return {
					title: stubViewContainer.title.value,
					onDidChangeContainerInfo: Event.None,
				} as IViewContainerModel;
			}
			override getDefaultContainerById(_id: string): ViewContainer | null {
				return stubViewContainer;
			}
		}();
	}

	class RosterNavigationLayoutService extends TestLayoutService {
		private conversationVisible = true;
		readonly setPartHiddenCalls: { hidden: boolean; part: Parts }[] = [];

		constructor(conversationVisible = true) {
			super();
			this.conversationVisible = conversationVisible;
		}

		override isVisible(part: Parts): boolean {
			if (part === Parts.CONVERSATION_PART) {
				return this.conversationVisible;
			}
			return super.isVisible(part);
		}

		override async setPartHidden(hidden: boolean, part: Parts): Promise<void> {
			this.setPartHiddenCalls.push({ hidden, part });
			if (part === Parts.CONVERSATION_PART) {
				this.conversationVisible = !hidden;
			}
		}
	}

	function getViewList(view: ConversationSessionsView): WorkbenchList<ConversationStubSession> {
		return (view as unknown as { list: WorkbenchList<ConversationStubSession> }).list;
	}

	function getFilterInput(view: ConversationSessionsView): HTMLInputElement | null {
		return view.element.querySelector('.conversation-sessions-inline-filter-input');
	}

	function isFilterVisible(view: ConversationSessionsView): boolean {
		const filter = view.element.querySelector('.conversation-sessions-inline-filter') as HTMLElement | null;
		return filter !== null && filter.style.display !== 'none';
	}

	async function setFilterQuery(view: ConversationSessionsView, query: string): Promise<void> {
		const input = getFilterInput(view);
		assert.ok(input, 'filter input must exist');
		input.value = query;
		input.dispatchEvent(new globalThis.Event('input'));
		await new Promise<void>(resolve => setTimeout(resolve, 0));
	}

	function getVisibleSessionTitles(view: ConversationSessionsView): string[] {
		return [...view.element.querySelectorAll('.conversation-sessions-item-label')]
			.map(label => label.textContent ?? '');
	}

	function mountView(options?: {
		stubService?: ConversationStubService;
		conversationVisible?: boolean;
	}): {
		view: ConversationSessionsView;
		stubService: ConversationStubService;
		layoutService: RosterNavigationLayoutService;
		conversationPart: ConversationPart;
		focusSpy: { called: boolean };
	} {
		const service = options?.stubService ?? store.add(new ConversationStubService());
		const layoutService = new RosterNavigationLayoutService(options?.conversationVisible ?? true);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, service);
		instantiationService.stub(IWorkbenchLayoutService, layoutService);
		instantiationService.stub(IViewDescriptorService, createViewDescriptorServiceStub());

		const conversationPart = store.add(instantiationService.createInstance(ConversationPart));
		const partParent = document.createElement('div');
		conversationPart.create(partParent);
		const focusSpy = { called: false };
		const originalFocus = conversationPart.focus.bind(conversationPart);
		conversationPart.focus = () => {
			focusSpy.called = true;
			originalFocus();
		};
		instantiationService.stub(IConversationPartService, conversationPart);

		const view = store.add(instantiationService.createInstance(ConversationSessionsView, {
			id: CONVERSATION_SESSIONS_VIEW_ID,
			title: 'Sessions',
		}));
		const container = document.createElement('div');
		view.render();
		container.appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);
		return { view, stubService: service, layoutService, conversationPart, focusSpy };
	}

	test('registers on dedicated Sidebar ViewContainer that is not default', () => {
		const sessionsContainer = viewContainersRegistry.get(CONVERSATION_SESSIONS_CONTAINER_ID);
		assert.ok(sessionsContainer);
		assert.strictEqual(viewContainersRegistry.getViewContainerLocation(sessionsContainer), ViewContainerLocation.Sidebar);

		const defaultSidebarContainers = viewContainersRegistry.getDefaultViewContainers(ViewContainerLocation.Sidebar);
		assert.ok(!defaultSidebarContainers.some(container => container.id === CONVERSATION_SESSIONS_CONTAINER_ID));
	});

	test('view descriptor does not reference ChatEditorInput', () => {
		const descriptor = viewsRegistry.getView(CONVERSATION_SESSIONS_VIEW_ID);
		assert.ok(descriptor);
		assert.notStrictEqual(descriptor.ctorDescriptor.ctor, ChatEditorInput);
	});

	function getRosterCombinedText(view: ConversationSessionsView): string {
		return view.element.querySelector('.conversation-sessions-list')?.textContent?.toLowerCase() ?? '';
	}

	test('seed session row shows title and No messages subtitle', () => {
		const { view, stubService } = mountView();
		const session = stubService.getActiveSession();
		const row = view.element.querySelector('.conversation-sessions-item-active');
		assert.ok(row);
		assert.strictEqual(row?.querySelector('.conversation-sessions-item-label')?.textContent, session.title);
		assert.strictEqual(row?.querySelector('.conversation-sessions-item-subtitle')?.textContent, 'No messages');
		assert.ok(row?.querySelector('.conversation-sessions-item-icon.codicon-comment-discussion'));
	});

	test('appendUserTurn updates roster subtitle to 1 message', () => {
		const { view, stubService } = mountView();
		const sessionId = stubService.getActiveSessionId();
		stubService.appendUserTurn(sessionId, 'Hello from roster test');

		const subtitle = view.element.querySelector('.conversation-sessions-item-active .conversation-sessions-item-subtitle');
		assert.strictEqual(subtitle?.textContent, '1 message');
	});

	test('session roster rows use 44px delegate height', () => {
		assert.strictEqual(CONVERSATION_SESSION_ROW_HEIGHT, 44);
	});

	test('roster copy has no engine or Copilot placeholders', () => {
		const { view, stubService } = mountView();
		stubService.appendUserTurn(stubService.getActiveSessionId(), 'Local stub message');
		const combined = getRosterCombinedText(view);
		assert.ok(!combined.includes('copilot'));
		assert.ok(!combined.includes('not connected'));
		assert.ok(!combined.includes('no engine'));
	});

	test('lists stub session titles and highlights the active session', () => {
		const { view, stubService } = mountView();
		const secondId = stubService.createSession();
		stubService.switchSession(stubService.getSessions()[0].id);
		const sessions = stubService.getSessions();
		assert.strictEqual(sessions.length, 2);

		const labels = [...view.element.querySelectorAll('.conversation-sessions-item-label')];
		assert.strictEqual(labels.length, sessions.length);
		assert.ok(labels.every((label, index) => label.textContent === sessions[index].title));
		assert.strictEqual(view.element.querySelector('.conversation-sessions-empty')?.getAttribute('style'), 'display: none;');

		const activeIndex = sessions.findIndex(session => session.id === stubService.getActiveSessionId());
		assert.ok(activeIndex >= 0);
		const activeRow = view.element.querySelector('.conversation-sessions-item-active');
		assert.ok(activeRow);
		assert.strictEqual(activeRow?.querySelector('.conversation-sessions-item-label')?.textContent, sessions[activeIndex].title);
		assert.strictEqual(secondId, sessions[1].id);
	});

	test('active highlight follows getActiveSessionId when session switches', () => {
		const { view, stubService } = mountView();
		const secondId = stubService.createSession();
		const firstId = stubService.getSessions()[0].id;
		stubService.switchSession(firstId);
		const target = stubService.getSessions().find(session => session.id === secondId);
		assert.ok(target);

		stubService.switchSession(target.id);

		const activeRow = view.element.querySelector('.conversation-sessions-item-active');
		assert.ok(activeRow);
		assert.strictEqual(activeRow?.querySelector('.conversation-sessions-item-label')?.textContent, target.title);
	});

	test('createNewSession adds a memory session and selects it', () => {
		const { view, stubService } = mountView();
		const initialCount = stubService.getSessions().length;

		view.createNewSession();

		assert.strictEqual(stubService.getSessions().length, initialCount + 1);
		assert.ok(stubService.getActiveSession().title.includes('New session'));
		const labels = [...view.element.querySelectorAll('.conversation-sessions-item-label')];
		assert.strictEqual(labels.length, initialCount + 1);
		assert.strictEqual(labels.at(-1)?.textContent, stubService.getActiveSession().title);
	});

	test('shows honest empty state without Open Chat copy', () => {
		const stubService = new class extends mock<IConversationRosterService>() {
			override onDidChangeActiveSession = Event.None;
			override onDidChangeSession = Event.None;
			override getSessions() { return []; }
			override getActiveSessionId() { return ''; }
			override createSession() { return 'new'; }
		}() as unknown as ConversationStubService;

		const { view } = mountView({ stubService });
		const empty = view.element.querySelector('.conversation-sessions-empty') as HTMLElement | undefined;
		assert.ok(empty);
		assert.ok(empty.textContent?.includes('in-memory'));
		assert.ok(!empty.textContent?.toLowerCase().includes('open chat'));
		assert.strictEqual(view.element.querySelector('.chat-widget'), null);
		assert.strictEqual(view.element.querySelector('.conversation-sessions-list')?.getAttribute('style'), 'display: none;');
	});

	test('New session action title matches SessionBar copy', () => {
		assert.strictEqual(conversationLensSessionBarNewSession, 'New session');
	});

	test('list labels refresh when a stub session is renamed', () => {
		const { view, stubService } = mountView();
		const sessionId = stubService.getActiveSessionId();
		const renamedTitle = 'Sidebar roster rename sync';

		stubService.renameSession(sessionId, renamedTitle);

		const label = view.element.querySelector('.conversation-sessions-item-active .conversation-sessions-item-label');
		assert.strictEqual(label?.textContent, renamedTitle);
		assert.ok([...view.element.querySelectorAll('.conversation-sessions-item-label')].some(el => el.textContent === renamedTitle));
	});

	test('roster row click switches session without opening an editor', () => {
		const service = store.add(new ConversationStubService());
		const editorService = store.add(new TestEditorService());
		let openEditorCalled = false;
		const originalOpenEditor = editorService.openEditor.bind(editorService);
		editorService.openEditor = (async (editor: EditorInput | IUntypedEditorInput, optionsOrGroup?: IEditorOptions | PreferredGroup, group?: PreferredGroup): Promise<IEditorPane | undefined> => {
			openEditorCalled = true;
			return originalOpenEditor(editor as EditorInput, optionsOrGroup as never, group);
		}) as typeof editorService.openEditor;

		let switchSessionCalled = false;
		const originalSwitchSession = service.switchSession.bind(service);
		service.switchSession = (sessionId: string) => {
			switchSessionCalled = true;
			originalSwitchSession(sessionId);
		};

		const layoutService = new RosterNavigationLayoutService(true);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, service);
		instantiationService.stub(IWorkbenchLayoutService, layoutService);
		instantiationService.stub(IEditorService, editorService);
		instantiationService.stub(IViewDescriptorService, createViewDescriptorServiceStub());

		const conversationPart = store.add(instantiationService.createInstance(ConversationPart));
		conversationPart.create(document.createElement('div'));
		instantiationService.stub(IConversationPartService, conversationPart);

		const view = store.add(instantiationService.createInstance(ConversationSessionsView, {
			id: CONVERSATION_SESSIONS_VIEW_ID,
			title: 'Sessions',
		}));
		const container = document.createElement('div');
		view.render();
		container.appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);

		const secondId = service.createSession();
		const firstId = service.getSessions()[0].id;
		service.switchSession(firstId);
		switchSessionCalled = false;
		openEditorCalled = false;

		const targetIndex = service.getSessions().findIndex(session => session.id === secondId);
		const label = view.element.querySelectorAll('.conversation-sessions-item-label')[targetIndex] as HTMLElement;
		label.click();

		assert.strictEqual(switchSessionCalled, true);
		assert.strictEqual(service.getActiveSessionId(), secondId);
		assert.strictEqual(openEditorCalled, false);
		assert.notStrictEqual(editorService.activeEditor instanceof ChatEditorInput, true);
	});

	test('opening a roster item while Conversation is hidden switches session, shows, and focuses', () => {
		const { view, stubService, layoutService, focusSpy } = mountView({ conversationVisible: false });
		const secondId = stubService.createSession();
		const firstId = stubService.getSessions()[0].id;
		stubService.switchSession(firstId);
		layoutService.setPartHiddenCalls.length = 0;
		focusSpy.called = false;

		const targetIndex = stubService.getSessions().findIndex(session => session.id === secondId);
		assert.ok(targetIndex >= 0);
		const label = view.element.querySelectorAll('.conversation-sessions-item-label')[targetIndex] as HTMLElement;
		label.click();

		assert.strictEqual(stubService.getActiveSessionId(), secondId);
		assert.ok(layoutService.setPartHiddenCalls.some(call => call.part === Parts.CONVERSATION_PART && call.hidden === false));
		assert.strictEqual(layoutService.isVisible(Parts.CONVERSATION_PART), true);
		assert.strictEqual(focusSpy.called, true);
		assert.notStrictEqual(document.activeElement, label);
	});

	test('keyboard open and click share the same onDidOpen navigation path', () => {
		const { view, stubService, layoutService, focusSpy } = mountView({ conversationVisible: false });
		const secondId = stubService.createSession();
		const firstId = stubService.getSessions()[0].id;
		stubService.switchSession(firstId);
		const list = getViewList(view);
		const targetIndex = stubService.getSessions().findIndex(session => session.id === secondId);
		assert.ok(targetIndex >= 0);

		layoutService.setPartHiddenCalls.length = 0;
		focusSpy.called = false;
		list.domFocus();
		list.setFocus([targetIndex]);
		list.setSelection([targetIndex], getSelectionKeyboardEvent('keydown', false, false));

		assert.strictEqual(stubService.getActiveSessionId(), secondId);
		assert.ok(layoutService.setPartHiddenCalls.some(call => call.part === Parts.CONVERSATION_PART && call.hidden === false));
		assert.strictEqual(focusSpy.called, true);

		const thirdId = stubService.createSession();
		stubService.switchSession(firstId);
		const thirdIndex = stubService.getSessions().findIndex(session => session.id === thirdId);
		void layoutService.setPartHidden(true, Parts.CONVERSATION_PART);
		layoutService.setPartHiddenCalls.length = 0;
		focusSpy.called = false;

		const label = view.element.querySelectorAll('.conversation-sessions-item-label')[thirdIndex] as HTMLElement;
		label.click();

		assert.strictEqual(stubService.getActiveSessionId(), thirdId);
		assert.ok(layoutService.setPartHiddenCalls.some(call => call.part === Parts.CONVERSATION_PART && call.hidden === false));
		assert.strictEqual(focusSpy.called, true);
	});

	test('stale or empty roster open does not show Conversation', () => {
		const { view, stubService, layoutService, focusSpy } = mountView({ conversationVisible: false });
		const openSessionFromRoster = (view as unknown as {
			openSessionFromRoster(session: ConversationStubSession | undefined, browserEvent?: UIEvent): void;
		}).openSessionFromRoster.bind(view);
		const staleSession: ConversationStubSession = { id: 'missing-session', title: 'Stale', turns: [] };

		layoutService.setPartHiddenCalls.length = 0;
		focusSpy.called = false;
		openSessionFromRoster(staleSession);

		assert.strictEqual(layoutService.setPartHiddenCalls.length, 0);
		assert.strictEqual(focusSpy.called, false);
		assert.strictEqual(layoutService.isVisible(Parts.CONVERSATION_PART), false);

		const activeBefore = stubService.getActiveSessionId();
		focusSpy.called = false;
		openSessionFromRoster(undefined);

		assert.strictEqual(stubService.getActiveSessionId(), activeBefore);
		assert.strictEqual(focusSpy.called, false);
	});

	test('filter input is hidden when roster is empty', () => {
		const stubService = new class extends mock<IConversationRosterService>() {
			override onDidChangeActiveSession = Event.None;
			override onDidChangeSession = Event.None;
			override getSessions() { return []; }
			override getActiveSessionId() { return ''; }
			override createSession() { return 'new'; }
		}() as unknown as ConversationStubService;

		const { view } = mountView({ stubService });
		assert.ok(!isFilterVisible(view));
	});

	test('filter input is shown when seed session exists', () => {
		const { view } = mountView();
		assert.ok(isFilterVisible(view));
		const input = getFilterInput(view);
		assert.ok(input);
		assert.strictEqual(input.placeholder, 'Filter sessions');
	});

	test('filter input stays visible after New session', () => {
		const { view } = mountView();
		assert.ok(isFilterVisible(view));
		view.createNewSession();
		assert.ok(isFilterVisible(view));
	});

	test('filter query hides non-matching session titles', async () => {
		const { view, stubService } = mountView();
		const alphaId = stubService.getActiveSessionId();
		stubService.renameSession(alphaId, 'Alpha roster item');
		const betaId = stubService.createSession();
		stubService.renameSession(betaId, 'Beta roster item');

		await setFilterQuery(view, 'alpha');

		const titles = getVisibleSessionTitles(view);
		assert.strictEqual(titles.length, 1);
		assert.strictEqual(titles[0], 'Alpha roster item');
		assert.ok(stubService.getSessions().some(session => session.title === 'Beta roster item'));
	});

	test('filter clear restores the full roster list', async () => {
		const { view, stubService } = mountView();
		const alphaId = stubService.getActiveSessionId();
		stubService.renameSession(alphaId, 'Alpha roster item');
		const betaId = stubService.createSession();
		stubService.renameSession(betaId, 'Beta roster item');
		const fullCount = stubService.getSessions().length;

		await setFilterQuery(view, 'alpha');
		assert.strictEqual(getVisibleSessionTitles(view).length, 1);

		await setFilterQuery(view, '');
		assert.strictEqual(getVisibleSessionTitles(view).length, fullCount);
	});

	test('filter does not reorder sessions in the roster', async () => {
		const { view, stubService } = mountView();
		const firstId = stubService.getActiveSessionId();
		stubService.renameSession(firstId, 'Zulu session');
		const secondId = stubService.createSession();
		stubService.renameSession(secondId, 'Alpha session');
		const thirdId = stubService.createSession();
		stubService.renameSession(thirdId, 'Mike session');
		const rosterOrder = stubService.getSessions().map(session => session.title);

		await setFilterQuery(view, 'session');

		assert.deepStrictEqual(getVisibleSessionTitles(view), rosterOrder);
	});

	test('click still switches session for a visible filtered row', async () => {
		const { view, stubService } = mountView();
		const firstId = stubService.getActiveSessionId();
		stubService.renameSession(firstId, 'Alpha roster item');
		const secondId = stubService.createSession();
		stubService.renameSession(secondId, 'Beta roster item');
		stubService.switchSession(firstId);

		await setFilterQuery(view, 'beta');

		const label = view.element.querySelector('.conversation-sessions-item-label') as HTMLElement;
		assert.ok(label);
		assert.strictEqual(label.textContent, 'Beta roster item');
		label.click();

		assert.strictEqual(stubService.getActiveSessionId(), secondId);
	});
});
