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
import { CONVERSATION_STUB_SEED_SESSIONS } from '../../browser/conversationStubModel.js';
import { ConversationStubService, IConversationStubService } from '../../browser/conversationStubService.js';

suite('ConversationLens', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountLens(): { part: ConversationPart; lens: ConversationLens } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const stubService = store.add(new ConversationStubService());
		instantiationService.stub(IConversationStubService, stubService);
		const part = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		part.create(parent);
		const slots = part.getSlots();
		assert.ok(slots);
		const lens = store.add(instantiationService.createInstance(ConversationLens, slots));
		return { part, lens };
	}

	test('fills SessionBar, stub timeline, and stub dock slots', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		assert.ok(slots.sessionBar.querySelector('.conversation-lens-session-bar'));
		assert.ok(slots.timeline.querySelector('.conversation-lens-timeline'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock'));
		assert.ok(slots.sessionBar.querySelector('.conversation-lens-session-select'));
		assert.ok(slots.dock.querySelector('.conversation-lens-inbox-row'));
		assert.ok(slots.dock.querySelector('textarea.conversation-lens-dock-input'));
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

	test('does not host the lens as ChatEditorInput', () => {
		const { part } = mountLens();
		assert.notStrictEqual(Parts.CONVERSATION_PART, ChatEditorInput.TypeID);
		assert.notStrictEqual(Parts.CONVERSATION_PART, ChatEditorInput.EditorID);
		assert.deepStrictEqual(part.toJSON(), { type: Parts.CONVERSATION_PART });
		assert.strictEqual(part.getSlots()!.timeline.querySelector('.chat-setup'), null);
	});

	test('session switcher changes visible title and timeline turns', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const title = slots.sessionBar.querySelector('.conversation-lens-session-title')!;
		const select = slots.sessionBar.querySelector('.conversation-lens-session-select') as HTMLSelectElement;
		const timelineContent = slots.timeline.querySelector('.conversation-lens-timeline-content')!;

		const untitled = CONVERSATION_STUB_SEED_SESSIONS.find(s => s.id === 'untitled')!;
		const tour = CONVERSATION_STUB_SEED_SESSIONS.find(s => s.id === 'tour')!;
		assert.strictEqual(title.textContent, untitled.title);
		assert.ok(timelineContent.textContent?.includes(untitled.turns[0].text));

		select.value = tour.id;
		select.dispatchEvent(new Event('change'));

		assert.strictEqual(title.textContent, tour.title);
		assert.ok(timelineContent.textContent?.includes(tour.turns[0].text));
		assert.ok(!timelineContent.textContent?.includes(untitled.turns[0].text));
	});

	test('inbox status row is honest: no fake queue list, pending summary in dock', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const inboxRow = slots.dock.querySelector('.conversation-lens-inbox-row')!;
		const pendingButton = inboxRow.querySelector('.conversation-lens-inbox-pending') as HTMLButtonElement;

		assert.ok(inboxRow.textContent?.includes('No queue'));
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
		const allowButton = [...seat.querySelectorAll('button, .monaco-button')].find(el => el.textContent?.trim() === 'Allow') as HTMLElement;
		const pendingButton = slots.dock.querySelector('.conversation-lens-inbox-pending') as HTMLButtonElement;

		assert.ok(allowButton);
		allowButton.click();

		const buttonsAfter = [...seat.querySelectorAll('button, .monaco-button')].map(el => el.textContent?.trim());
		assert.ok(!buttonsAfter.includes('Allow'));
		assert.ok(!buttonsAfter.includes('Skip'));
		assert.ok(seat.textContent?.includes('Allowed'));
		assert.ok(seat.textContent?.includes('Write README.md?'));
		assert.strictEqual(pendingButton.hidden, true);
	});

	test('dock appends a local user turn and stub echo to the current session timeline', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const textarea = slots.dock.querySelector('textarea.conversation-lens-dock-input') as HTMLTextAreaElement;
		const sendButton = slots.dock.querySelector('.conversation-lens-dock-row button') as HTMLButtonElement;
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
