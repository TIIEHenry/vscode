/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../base/common/event.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { getErrorMessage } from '../../../../base/common/errors.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { ConversationPart, IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IViewContainerModel, IViewDescriptorService, ViewContainer, ViewContainerLocation } from '../../../common/views.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { TestEditorService, TestLayoutService, workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { CONVERSATION_SESSIONS_VIEW_ID, ConversationSessionsView } from './conversationSessionsView.js';
import { ConversationStubService, IConversationRosterService } from './conversationStubService.js';
import { createConversationConnectionTestStub } from '../test/common/conversationConnectionTestStub.js';
import { stubConversationTimelineLinkServices } from '../test/browser/conversationTimelineLinkTestStubs.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';

suite('ConversationSessionsView (browser co-located)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const stubViewContainer = {
		id: 'conversation-sessions-colocated-test-container',
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

	async function setFilterQuery(view: ConversationSessionsView, query: string): Promise<void> {
		const input = view.element.querySelector('.conversation-sessions-inline-filter-input') as HTMLInputElement | null;
		assert.ok(input, 'filter input must exist');
		input.value = query;
		input.dispatchEvent(new globalThis.Event('input'));
		await new Promise<void>(resolve => setTimeout(resolve, 0));
	}

	function getVisibleSessionTitles(view: ConversationSessionsView): string[] {
		return [...view.element.querySelectorAll('.conversation-sessions-item-label')]
			.map(label => label.textContent ?? '');
	}

	function mountView(stubService?: ConversationStubService): { view: ConversationSessionsView; stubService: ConversationStubService } {
		const service = stubService ?? store.add(new ConversationStubService());
		const layoutService = new class extends TestLayoutService {
			override isVisible(part: Parts): boolean {
				return part === Parts.CONVERSATION_PART ? true : super.isVisible(part);
			}
		}();
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, service);
		instantiationService.stub(IWorkbenchLayoutService, layoutService);
		instantiationService.stub(IViewDescriptorService, createViewDescriptorServiceStub());
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());
		instantiationService.stub(INotificationService, {
			error: (message: string | Error) => {
				void (typeof message === 'string' ? message : getErrorMessage(message));
			},
		} as INotificationService);
		stubConversationTimelineLinkServices(instantiationService);
		instantiationService.stub(IEditorService, store.add(new TestEditorService()));

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
		return { view, stubService: service };
	}

	test('inline filter keeps the active session visible when its title does not match', async () => {
		const { view, stubService } = mountView();
		const alphaId = stubService.getActiveSessionId();
		stubService.renameSession(alphaId, 'Alpha roster item');
		const betaId = stubService.createSession();
		stubService.renameSession(betaId, 'Beta roster item');
		stubService.switchSession(betaId);

		await setFilterQuery(view, 'alpha');

		const titles = getVisibleSessionTitles(view);
		assert.strictEqual(stubService.getActiveSessionId(), betaId);
		assert.ok(titles.includes('Beta roster item'), 'active session must stay in the filtered roster');
		assert.ok(titles.includes('Alpha roster item'));
		assert.strictEqual(titles.length, 2);
		assert.ok(view.element.querySelector('.conversation-sessions-item-active .conversation-sessions-item-label')?.textContent === 'Beta roster item');
		assert.ok(view.element.querySelector('.conversation-sessions-item-active .conversation-sessions-item-more'));
		assert.ok(view.element.querySelector('.conversation-sessions-item-icon--waiting, .conversation-sessions-item-icon--idle, .conversation-sessions-item-icon--running, .conversation-sessions-item-icon--failed'));
	});
});
