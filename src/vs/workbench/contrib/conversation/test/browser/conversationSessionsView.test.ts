/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewContainersRegistry, IViewDescriptorService, IViewsRegistry, ViewContainerLocation } from '../../../../common/views.js';
import { ChatEditorInput } from '../../../chat/browser/widgetHosts/editor/chatEditorInput.js';
import { CONVERSATION_SESSIONS_CONTAINER_ID } from '../../browser/conversation.contribution.js';
import { CONVERSATION_SESSIONS_VIEW_ID, ConversationSessionsView } from '../../browser/conversationSessionsView.js';
import { conversationLensSessionBarNewSession } from '../../browser/conversationLensSessionBarStrings.js';
import { ConversationStubService, IConversationStubService } from '../../browser/conversationStubService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import '../../../conversation/browser/conversation.contribution.js';

suite('ConversationSessionsView', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
	const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

	function mountView(stubService?: ConversationStubService): { view: ConversationSessionsView; stubService: ConversationStubService } {
		const service = stubService ?? store.add(new ConversationStubService());
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationStubService, service);
		instantiationService.stub(IViewDescriptorService, new class extends mock<IViewDescriptorService>() {
			override getViewLocationById(): ViewContainerLocation {
				return ViewContainerLocation.Sidebar;
			}
		}());

		const view = store.add(instantiationService.createInstance(ConversationSessionsView, {
			id: CONVERSATION_SESSIONS_VIEW_ID,
			title: 'Sessions',
		}));
		const container = document.createElement('div');
		view.render();
		container.appendChild(view.element);
		view.setExpanded(true);
		view.setVisible(true);
		return { view, stubService: service };
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
		const stubService = store.add(new class extends mock<IConversationStubService>() {
			override onDidChangeActiveSession = Event.None;
			override onDidChangeSession = Event.None;
			override getSessions() { return []; }
			override getActiveSessionId() { return ''; }
			override createSession() { return 'new'; }
		}());

		const { view } = mountView(stubService);
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
});
