/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConversationPart } from '../../../../browser/parts/conversation/conversationPart.js';
import { Parts } from '../../../../services/layout/browser/layoutService.js';
import { ChatEditorInput } from '../../../chat/browser/widgetHosts/editor/chatEditorInput.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationLens } from '../../browser/conversationLens.js';
import {
	conversationLensDockEngineNotConnected,
	conversationLensDockInboxNoQueue,
	conversationLensDockNoModel,
} from '../../browser/conversationLensDockStrings.js';
import { conversationLensSessionBarNewSession } from '../../browser/conversationLensSessionBarStrings.js';
import { CONVERSATION_STUB_SEED_SESSIONS } from '../../browser/conversationStubModel.js';
import { ConversationStubService, IConversationStubService } from '../../browser/conversationStubService.js';
import { shouldRenderTurnAsMarkdown } from '../../browser/conversationTurnMarkdown.js';

suite('ConversationLens', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountLens(): { part: ConversationPart; lens: ConversationLens; stubService: ConversationStubService } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const stubService = store.add(new ConversationStubService());
		instantiationService.stub(IConversationStubService, stubService);
		const part = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		part.create(parent);
		const slots = part.getSlots();
		assert.ok(slots);
		const lens = store.add(instantiationService.createInstance(ConversationLens, slots));
		return { part, lens, stubService };
	}

	test('fills SessionBar, stub timeline, and stub dock slots', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		assert.ok(slots.sessionBar.querySelector('.conversation-lens-session-bar'));
		assert.ok(slots.timeline.querySelector('.conversation-lens-timeline'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock'));
		assert.ok(slots.sessionBar.querySelector('.conversation-lens-session-select'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-gate-row'));
		assert.ok(slots.dock.querySelector('.conversation-lens-inbox-row'));
		assert.ok(slots.dock.querySelector('textarea.conversation-lens-dock-input'));
	});

	test('exposes Agent IDE chrome landmarks', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;

		assert.ok(slots.sessionBar.querySelector('.conversation-lens-session-icon'));
		assert.ok(slots.sessionBar.querySelector('.conversation-lens-session-title'));
		assert.ok(slots.sessionBar.querySelector('.conversation-lens-session-switcher-label'));
		assert.ok(slots.timeline.querySelector('.conversation-lens-timeline-scroll'));
		assert.ok(slots.timeline.querySelector('.conversation-lens-timeline-content'));
		assert.ok(slots.dock.querySelector('.conversation-lens-composer'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-input-row'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-bottom-bar'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-actions'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-gate-row'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock-model'));
		assert.ok(slots.dock.querySelector('.conversation-lens-inbox-label'));
	});

	test('compact chrome: scroll region is timeline inner scroll only', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const timelineSlot = slots.timeline;

		assert.ok(timelineSlot.querySelector('.conversation-lens-timeline-scroll'));
		assert.strictEqual(timelineSlot.classList.contains('conversation-timeline'), true);
		assert.ok(!timelineSlot.querySelector('.conversation-lens-dock'));
	});

	test('compact chrome: dock composer textarea with bottom bar send', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const textarea = slots.dock.querySelector('textarea.conversation-lens-dock-input') as HTMLTextAreaElement;
		const inputRow = slots.dock.querySelector('.conversation-lens-dock-input-row')!;
		const bottomBar = slots.dock.querySelector('.conversation-lens-dock-bottom-bar')!;
		const sendButton = bottomBar.querySelector('.conversation-lens-dock-actions .monaco-button');

		assert.strictEqual(textarea.rows, 1);
		assert.ok(inputRow.contains(textarea));
		assert.ok(sendButton);
		assert.ok(bottomBar.contains(sendButton!.parentElement!));
		assert.ok(!inputRow.querySelector('.conversation-lens-dock-actions'));
	});

	test('compact chrome: inbox status stays on one row', () => {
		const { part } = mountLens();
		const inboxRow = part.getSlots()!.dock.querySelector('.conversation-lens-inbox-row')!;

		assert.ok(inboxRow.querySelector('.conversation-lens-inbox-label'));
		assert.ok(inboxRow.querySelector('.conversation-lens-inbox-queue'));
		assert.ok(inboxRow.textContent?.includes(conversationLensDockInboxNoQueue));
	});

	test('honest dock gate and model labels without Copilot CTAs', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const gateRow = slots.dock.querySelector('.conversation-lens-dock-gate-row')!;
		const modelLabel = slots.dock.querySelector('.conversation-lens-dock-model')!;
		const sendButton = slots.dock.querySelector('.conversation-lens-dock-bottom-bar .monaco-button')!;

		assert.ok(gateRow.textContent?.includes(conversationLensDockEngineNotConnected));
		assert.strictEqual(modelLabel.textContent, conversationLensDockNoModel);
		assert.ok(sendButton.textContent?.includes('Send'));
		assert.strictEqual(slots.dock.querySelector('.chat-setup'), null);
		assert.strictEqual(slots.dock.querySelector('.monaco-button[aria-label*="Sign in"]'), null);
	});

	test('blank session shows timeline empty state', () => {
		const { part, stubService } = mountLens();
		stubService.switchSession('blank');
		const empty = part.getSlots()!.timeline.querySelector('.conversation-lens-timeline-empty');
		assert.ok(empty);
		assert.ok(empty.textContent?.includes('No messages yet'));
	});

	test('renders confirmation as a timeline list item with Allow and Skip', () => {
		const { part } = mountLens();
		const timelineContent = part.getSlots()!.timeline.querySelector('.conversation-lens-timeline-content')!;
		const seat = timelineContent.querySelector('.conversation-lens-confirmation-seat');
		assert.ok(seat);
		assert.ok(seat.textContent?.includes('confirmation pending'));
		assert.ok(seat.textContent?.includes('Input needed'));
		assert.ok(seat.textContent?.includes('Write README.md?'));
		const buttons = [...seat.querySelectorAll('button, .monaco-button')].map(el => el.textContent?.trim());
		assert.ok(buttons.some(label => label === 'Allow'));
		assert.ok(buttons.some(label => label === 'Skip'));
		assert.strictEqual(timelineContent.querySelectorAll('.conversation-lens-turn').length >= 3, true);
	});

	test('renders user and assistant turns with role headers', () => {
		const { part } = mountLens();
		const timelineContent = part.getSlots()!.timeline.querySelector('.conversation-lens-timeline-content')!;
		const userTurn = timelineContent.querySelector('.conversation-lens-turn[data-kind="user"]');
		const assistantTurn = timelineContent.querySelector('.conversation-lens-turn[data-kind="assistant"]');
		assert.ok(userTurn?.querySelector('.conversation-lens-turn-header')?.textContent?.includes('You'));
		assert.ok(userTurn?.querySelector('.conversation-lens-turn-body'));
		assert.ok(assistantTurn?.querySelector('.conversation-lens-turn-header')?.textContent?.includes('Agent'));
		assert.ok(assistantTurn?.querySelector('.conversation-lens-turn-body'));
		assert.strictEqual(shouldRenderTurnAsMarkdown('assistant'), true);
		assert.strictEqual(shouldRenderTurnAsMarkdown('user'), false);
	});

	test('renders assistant turns as markdown, user turns as plain text', () => {
		const { part, stubService } = mountLens();
		stubService.switchSession('blank');
		const markdownEcho = '**bold** stub echo';
		stubService.appendStubEchoAssistant('blank', markdownEcho);

		const timelineContent = part.getSlots()!.timeline.querySelector('.conversation-lens-timeline-content')!;
		const assistantBody = timelineContent.querySelector('.conversation-lens-turn[data-kind="assistant"] .conversation-lens-turn-body')!;
		const userBody = timelineContent.querySelector('.conversation-lens-turn[data-kind="user"] .conversation-lens-turn-body');

		assert.ok(assistantBody.classList.contains('rendered-markdown'));
		assert.ok(assistantBody.querySelector('strong'));
		assert.strictEqual(assistantBody.textContent, 'bold stub echo');
		assert.notStrictEqual(assistantBody.textContent, markdownEcho);
		assert.strictEqual(userBody, null);
	});

	test('keeps user turn body as plain text without markdown rendering', () => {
		const { part, stubService } = mountLens();
		stubService.switchSession('blank');
		const userMessage = 'plain **not bold** text';
		stubService.appendUserTurn('blank', userMessage);

		const userBody = part.getSlots()!.timeline.querySelector('.conversation-lens-turn[data-kind="user"] .conversation-lens-turn-body')!;
		assert.strictEqual(userBody.textContent, userMessage);
		assert.strictEqual(userBody.classList.contains('rendered-markdown'), false);
		assert.strictEqual(userBody.querySelector('strong'), null);
	});

	test('does not host the lens as ChatEditorInput', () => {
		const { part } = mountLens();
		assert.notStrictEqual(Parts.CONVERSATION_PART, ChatEditorInput.TypeID);
		assert.notStrictEqual(Parts.CONVERSATION_PART, ChatEditorInput.EditorID);
		assert.deepStrictEqual(part.toJSON(), { type: Parts.CONVERSATION_PART });
		assert.strictEqual(part.getSlots()!.timeline.querySelector('.chat-setup'), null);
	});

	test('session switcher changes visible title and timeline turns', () => {
		const { part, stubService } = mountLens();
		const slots = part.getSlots()!;
		const title = slots.sessionBar.querySelector('.conversation-lens-session-title')!;
		const timelineContent = slots.timeline.querySelector('.conversation-lens-timeline-content')!;

		const untitled = CONVERSATION_STUB_SEED_SESSIONS.find(s => s.id === 'untitled')!;
		const tour = CONVERSATION_STUB_SEED_SESSIONS.find(s => s.id === 'tour')!;
		assert.strictEqual(title.textContent, untitled.title);
		assert.ok(timelineContent.textContent?.includes(untitled.turns[0].text));

		stubService.switchSession(tour.id);

		assert.strictEqual(title.textContent, tour.title);
		assert.ok(timelineContent.textContent?.includes(tour.turns[0].text));
		assert.ok(!timelineContent.textContent?.includes(untitled.turns[0].text));
	});

	test('SessionBar new session button creates an empty stub session', () => {
		const { part, stubService } = mountLens();
		const slots = part.getSlots()!;
		const newButton = slots.sessionBar.querySelector('.conversation-lens-session-new .monaco-button') as HTMLButtonElement;
		const title = slots.sessionBar.querySelector('.conversation-lens-session-title')!;
		const timelineContent = slots.timeline.querySelector('.conversation-lens-timeline-content')!;
		const initialCount = stubService.getSessions().length;

		assert.ok(newButton);
		assert.strictEqual(newButton.getAttribute('aria-label'), conversationLensSessionBarNewSession);
		assert.strictEqual(slots.sessionBar.querySelector('.conversation-lens-session-maximize'), null);
		assert.strictEqual(slots.sessionBar.querySelector('.conversation-lens-session-drawer'), null);

		newButton.click();

		assert.strictEqual(stubService.getSessions().length, initialCount + 1);
		assert.strictEqual(stubService.getTurns(stubService.getActiveSessionId()).length, 0);
		assert.ok(title.textContent?.includes('New session'));
		assert.ok(timelineContent.querySelector('.conversation-lens-timeline-empty'));
		assert.ok(timelineContent.textContent?.includes('No messages yet'));
	});

	test('inbox status row is honest: no fake queue list, pending summary in dock', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const inboxRow = slots.dock.querySelector('.conversation-lens-inbox-row')!;
		const pendingButton = inboxRow.querySelector('.conversation-lens-inbox-pending') as HTMLButtonElement;

		assert.ok(inboxRow.textContent?.includes(conversationLensDockInboxNoQueue));
		assert.strictEqual(inboxRow.querySelector('.conversation-lens-inbox-list'), null);
		assert.strictEqual(inboxRow.querySelector('.conversation-lens-inbox-item'), null);
		assert.strictEqual(slots.sessionBar.querySelector('.conversation-lens-inbox-badge'), null);
		assert.ok(pendingButton.textContent?.includes('confirmation pending'));
	});

	test('allow on confirmation hides CTAs and updates inbox pending count', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const timelineContent = slots.timeline.querySelector('.conversation-lens-timeline-content')!;
		const seat = timelineContent.querySelector('.conversation-lens-confirmation-seat')!;
		const allowButton = seat.querySelector('.conversation-lens-confirmation-actions .monaco-button') as HTMLElement | null;
		const pendingButton = slots.dock.querySelector('.conversation-lens-inbox-pending') as HTMLButtonElement;

		assert.ok(allowButton);
		allowButton.click();

		const seatAfter = timelineContent.querySelector('.conversation-lens-confirmation-seat')!;
		const buttonsAfter = [...seatAfter.querySelectorAll('button, .monaco-button')].map(el => el.textContent?.trim());
		assert.ok(!buttonsAfter.includes('Allow'));
		assert.ok(!buttonsAfter.includes('Skip'));
		assert.ok(seatAfter.textContent?.includes('Allowed'));
		assert.ok(seatAfter.textContent?.includes('Write README.md?'));
		assert.strictEqual(pendingButton.hidden, true);
	});

	test('dock appends a local user turn and stub echo to the current session timeline', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const textarea = slots.dock.querySelector('textarea.conversation-lens-dock-input') as HTMLTextAreaElement;
		const sendButton = slots.dock.querySelector('.conversation-lens-dock-actions .monaco-button') as HTMLElement;
		const timelineContent = slots.timeline.querySelector('.conversation-lens-timeline-content')!;

		const message = 'Local stub message from test';
		assert.ok(!timelineContent.textContent?.includes(message));

		textarea.value = message;
		sendButton.click();

		assert.ok(timelineContent.textContent?.includes(message));
		assert.ok(timelineContent.querySelector('[data-stub="true"]'));
		assert.strictEqual(textarea.value, '');
	});
});
