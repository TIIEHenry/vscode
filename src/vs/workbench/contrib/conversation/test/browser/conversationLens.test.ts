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
import { CONVERSATION_STUB_SESSIONS } from '../../browser/conversationStubSessions.js';

suite('ConversationLens', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountLens(): { part: ConversationPart; lens: ConversationLens } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const part = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		part.create(parent);
		const slots = part.getSlots();
		assert.ok(slots);
		const lens = store.add(new ConversationLens(slots));
		return { part, lens };
	}

	test('fills SessionBar, stub timeline, and stub dock slots', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		assert.ok(slots.sessionBar.querySelector('.conversation-lens-session-bar'));
		assert.ok(slots.timeline.querySelector('.conversation-lens-timeline'));
		assert.ok(slots.dock.querySelector('.conversation-lens-dock'));
		assert.ok(slots.sessionBar.querySelector('.conversation-lens-session-select'));
		assert.ok(slots.sessionBar.querySelector('.conversation-lens-inbox-badge'));
		assert.ok(slots.dock.querySelector('textarea.conversation-lens-dock-input'));
	});

	test('embeds confirmation donor chrome in the stub timeline', () => {
		const { part } = mountLens();
		const seat = part.getSlots()!.timeline.querySelector('.conversation-lens-confirmation-seat');
		assert.ok(seat);
		assert.ok(seat.textContent?.includes('confirmation pending'));
		assert.ok(seat.textContent?.includes('Input needed'));
		const buttons = [...seat.querySelectorAll('button, .monaco-button')].map(el => el.textContent?.trim());
		assert.ok(buttons.some(label => label === 'Allow'));
		assert.ok(buttons.some(label => label === 'Skip'));
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

		const first = CONVERSATION_STUB_SESSIONS[0];
		const second = CONVERSATION_STUB_SESSIONS[1];
		assert.strictEqual(title.textContent, first.title);
		assert.ok(timelineContent.textContent?.includes(first.turns[0].text));

		select.value = second.id;
		select.dispatchEvent(new Event('change'));

		assert.strictEqual(title.textContent, second.title);
		assert.ok(timelineContent.textContent?.includes(second.turns[0].text));
		assert.ok(!timelineContent.textContent?.includes(first.turns[0].text));
	});

	test('inbox opens with stub items and closes back to timeline', () => {
		const { part } = mountLens();
		const slots = part.getSlots()!;
		const inboxButton = slots.sessionBar.querySelector('.conversation-lens-inbox-host button') as HTMLButtonElement;
		const timelineContent = slots.timeline.querySelector('.conversation-lens-timeline-content')!;
		const confirmation = slots.timeline.querySelector('.conversation-lens-confirmation-seat')!;

		inboxButton.click();
		const panel = timelineContent.querySelector('.conversation-lens-inbox-panel');
		assert.ok(panel);
		assert.strictEqual(confirmation.hidden, true);
		assert.ok(panel.querySelectorAll('.conversation-lens-inbox-item').length >= 2);

		const closeButton = panel.querySelector('.conversation-lens-inbox-close') as HTMLButtonElement;
		closeButton.click();
		assert.strictEqual(timelineContent.querySelector('.conversation-lens-inbox-panel'), null);
		assert.strictEqual(confirmation.hidden, false);
	});

	test('dock appends a local user turn to the current session timeline', () => {
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
		assert.strictEqual(textarea.value, '');
	});
});
