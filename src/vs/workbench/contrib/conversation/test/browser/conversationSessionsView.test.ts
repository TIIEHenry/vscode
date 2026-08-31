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
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewContainersRegistry, IViewDescriptorService, IViewsRegistry, ViewContainerLocation } from '../../../../common/views.js';
import { IWorkbenchLayoutService, Parts } from '../../../../services/layout/browser/layoutService.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { ChatEditorInput } from '../../../chat/browser/widgetHosts/editor/chatEditorInput.js';
import { CONVERSATION_SESSIONS_CONTAINER_ID } from '../../browser/conversation.contribution.js';
import { CONVERSATION_SESSIONS_VIEW_ID, ConversationSessionsView } from '../../browser/conversationSessionsView.js';
import { ConversationStubSession } from '../../browser/conversationStubModel.js';
import { conversationLensSessionBarNewSession } from '../../browser/conversationLensSessionBarStrings.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { TestLayoutService, TestEditorService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import '../../../conversation/browser/conversation.contribution.js';

suite('ConversationSessionsView', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
	const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

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
		instantiationService.stub(IViewDescriptorService, new class extends mock<IViewDescriptorService>() {
			override onDidChangeLocation = Event.None;
			override getViewLocationById(): ViewContainerLocation {
				return ViewContainerLocation.Sidebar;
			}
		}());

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
		const sessions = stubService.getSessions();
		const target = sessions.find(session => session.id !== stubService.getActiveSessionId());
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
		(editorService as { openEditor: typeof editorService.openEditor }).openEditor = async (...args) => {
			openEditorCalled = true;
			return originalOpenEditor(...args);
		};

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
		instantiationService.stub(IViewDescriptorService, new class extends mock<IViewDescriptorService>() {
			override onDidChangeLocation = Event.None;
			override getViewLocationById(): ViewContainerLocation {
				return ViewContainerLocation.Sidebar;
			}
		}());

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
		list.setFocus([targetIndex]);
		list.setSelection([targetIndex], getSelectionKeyboardEvent('keydown', false, false));

		assert.strictEqual(stubService.getActiveSessionId(), secondId);
		assert.ok(layoutService.setPartHiddenCalls.some(call => call.part === Parts.CONVERSATION_PART && call.hidden === false));
		assert.strictEqual(focusSpy.called, true);

		const thirdId = stubService.createSession();
		stubService.switchSession(firstId);
		const thirdIndex = stubService.getSessions().findIndex(session => session.id === thirdId);
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
			openSessionFromRoster(session: ConversationStubSession | undefined): void;
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
});
