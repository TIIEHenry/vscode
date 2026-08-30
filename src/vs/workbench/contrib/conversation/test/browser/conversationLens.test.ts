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
});
