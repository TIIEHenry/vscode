/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConversationPart, IConversationLensSlots } from '../../../../browser/parts/conversation/conversationPart.js';
import { ILayoutService } from '../../../../../platform/layout/browser/layoutService.js';
import { IExplorerService } from '../../../files/browser/files.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { IChatService } from '../../../chat/common/chatService/chatService.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IExtensionService } from '../../../../services/extensions/common/extensions.js';
import { IWebviewService } from '../../../webview/browser/webview.js';
import { TestLayoutService, workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IClipboardService } from '../../../../../platform/clipboard/common/clipboardService.js';
import { TestClipboardService } from '../../../../../platform/clipboard/test/common/testClipboardService.js';
import { ConversationLens } from '../../browser/conversationLens.js';
import { ConversationStubService, IConversationRosterService } from '../../browser/conversationStubService.js';
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';
import { IConversationReviewNavService } from '../../common/conversationReviewEntry.js';
import { getConversationSessionStatusText } from '../../browser/conversationSessionStatus.js';

suite('Page access schemes slice 5 (UI contract)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const LENS_LAYOUT_WIDTH = 640;
	const LENS_LAYOUT_HEIGHT = 480;

	function getSessionBarTitle(slots: IConversationLensSlots): string | undefined {
		const titleButton = slots.sessionBar.querySelector('button.conversation-lens-session-title') as HTMLButtonElement | null;
		return titleButton?.textContent?.trim() ?? undefined;
	}

	function getSessionSelectLabel(slots: IConversationLensSlots): string | undefined {
		const select = slots.sessionBar.querySelector('select.monaco-select-box') as HTMLSelectElement | null;
		if (!select || select.options.length === 0) {
			return undefined;
		}
		return select.options[select.selectedIndex]?.text;
	}

	function mountLens(stubService: ConversationStubService, chatService?: IChatService): IConversationLensSlots {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const storageService = store.add(new TestStorageService());
		instantiationService.stub(IStorageService, storageService);
		instantiationService.stub(IConversationRosterService, stubService);
		instantiationService.stub(IConversationTimelineRevealService, {
			_serviceBrand: undefined,
			registerLens: () => ({ dispose: () => { } }),
			revealItem: () => { },
		});
		instantiationService.stub(IConversationReviewNavService, {
			_serviceBrand: undefined,
			onDidChange: Event.None,
			getReviewNavForSession: () => [],
		});
		instantiationService.stub(IClipboardService, new TestClipboardService());
		if (chatService) {
			instantiationService.stub(IChatService, chatService);
		}
		instantiationService.stub(ICommandService, new class implements ICommandService {
			declare readonly _serviceBrand: undefined;
			onWillExecuteCommand = Event.None;
			onDidExecuteCommand = Event.None;
			executeCommand() { return Promise.resolve(undefined); }
		}());
		instantiationService.stub(IExtensionService, {
			_serviceBrand: undefined,
			getExtension: () => Promise.resolve(undefined),
		} as unknown as IExtensionService);
		instantiationService.stub(IWebviewService, {
			_serviceBrand: undefined,
			activeWebview: undefined,
			webviews: [],
			onDidChangeActiveWebview: Event.None,
			createWebviewOverlay: () => { throw new Error('not used'); },
			createWebviewElement: () => ({
				mountTo(parent: HTMLElement) {
					parent.appendChild(document.createElement('div'));
				},
				setHtml() { },
				postMessage: () => Promise.resolve(true),
				onDidWheel: Event.None,
				onFatalError: Event.None,
				intrinsicContentSize: { get: () => undefined },
				dispose() { },
			}),
		} as unknown as IWebviewService);
		const layoutContainer = document.createElement('div');
		layoutContainer.classList.add('monaco-workbench');
		document.body.appendChild(layoutContainer);
		store.add(toDisposable(() => layoutContainer.remove()));
		const layoutService = new TestLayoutService();
		layoutService.getContainer = () => layoutContainer;
		instantiationService.stub(ILayoutService, layoutService);
		instantiationService.stub(IExplorerService, {
			_serviceBrand: undefined,
			select: async () => { },
		} as unknown as IExplorerService);
		instantiationService.stub(ISCMService, {
			_serviceBrand: undefined,
			get repositories() { return []; },
			get repositoryCount() { return 0; },
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			registerSCMProvider: () => { throw new Error('not implemented'); },
			getRepository: () => undefined,
		} as unknown as ISCMService);

		const part = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		parent.style.width = `${LENS_LAYOUT_WIDTH}px`;
		parent.style.height = `${LENS_LAYOUT_HEIGHT}px`;
		document.body.appendChild(parent);
		store.add(toDisposable(() => parent.remove()));
		part.create(parent);
		const partSlots = part.getSlots();
		assert.ok(partSlots);

		const slots: IConversationLensSlots = {
			sessionBar: partSlots.sessionBar,
			timeline: document.createElement('div'),
			dock: document.createElement('div'),
		};
		slots.timeline.classList.add('conversation-timeline');
		slots.dock.classList.add('conversation-dock');
		parent.appendChild(slots.timeline);
		parent.appendChild(slots.dock);
		part.layout(LENS_LAYOUT_WIDTH, LENS_LAYOUT_HEIGHT, 0, 0);
		store.add(instantiationService.createInstance(ConversationLens, slots));
		return slots;
	}

	function assertActiveSessionProjection(stubService: ConversationStubService, slots: IConversationLensSlots): void {
		const activeId = stubService.getActiveSessionId();
		const activeSession = stubService.getSessions().find(session => session.id === activeId);
		assert.ok(activeSession, 'active session must exist in roster catalog');

		const rosterListedTitle = activeSession.title;
		assert.strictEqual(getSessionBarTitle(slots), rosterListedTitle);
		assert.strictEqual(getSessionSelectLabel(slots), rosterListedTitle);
		assert.strictEqual(getConversationSessionStatusText(stubService.getActiveSession()), rosterListedTitle);
	}

	test('roster listed title matches SessionBar and StatusBar via getActiveSessionId single source', () => {
		const stubService = store.add(new ConversationStubService());
		const slots = mountLens(stubService);

		assertActiveSessionProjection(stubService, slots);

		const secondId = stubService.createSession();
		stubService.renameSession(secondId, 'Slice 5 roster sync');
		stubService.switchSession(secondId);

		assertActiveSessionProjection(stubService, slots);
	});

	test('Send does not call IChatService.sendRequest (negative mock)', () => {
		const stubService = store.add(new ConversationStubService());
		let sendRequestCalls = 0;
		const chatService = {
			_serviceBrand: undefined,
			sendRequest: async () => {
				sendRequestCalls++;
				throw new Error('IChatService.sendRequest must not be used by Conversation Send');
			},
		} as unknown as IChatService;

		const slots = mountLens(stubService, chatService);

		const textarea = slots.dock.querySelector('textarea.conversation-lens-dock-input') as HTMLTextAreaElement | null;
		const sendButton = slots.dock.querySelector('.conversation-lens-dock-send .monaco-button') as HTMLButtonElement | null;
		assert.ok(textarea);
		assert.ok(sendButton);

		const modelSelect = slots.dock.querySelector('.conversation-lens-dock-model select.monaco-select-box') as HTMLSelectElement | null;
		assert.ok(modelSelect);
		modelSelect.selectedIndex = 1;
		modelSelect.dispatchEvent(new globalThis.Event('change', { bubbles: true }));

		textarea.value = 'slice 5 negative send contract';
		textarea.dispatchEvent(new globalThis.Event('input', { bubbles: true }));
		sendButton.click();

		assert.strictEqual(sendRequestCalls, 0);
		assert.ok(stubService.getTurns(stubService.getActiveSessionId()).some(turn => turn.text === 'slice 5 negative send contract'));
	});
});
