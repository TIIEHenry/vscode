/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { EditorInput } from '../../../../common/editor/editorInput.js';
import { ConversationPart } from '../../../../browser/parts/conversation/conversationPart.js';
import { Parts } from '../../../../services/layout/browser/layoutService.js';
import { workbenchInstantiationService } from '../../workbenchTestServices.js';

suite('ConversationPart', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createPart(): ConversationPart {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const part = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		part.create(parent);
		return part;
	}

	test('exposes SessionBar and session window grid slots', () => {
		const part = createPart();
		const slots = part.getSlots();
		assert.ok(slots);
		assert.ok(slots.sessionBar);
		assert.ok(slots.sessionWindowGrid);
		assert.strictEqual(slots.editorPartHost, undefined);

		const fill = document.createElement('div');
		fill.className = 'test-slot-fill';
		slots.sessionBar.appendChild(fill);
		assert.strictEqual(slots.sessionBar.querySelector('.test-slot-fill'), fill);
	});

	test('is the conversation Part, not an EditorInput', () => {
		const part = createPart();
		assert.ok(!(part instanceof EditorInput));
		assert.deepStrictEqual(part.toJSON(), { type: Parts.CONVERSATION_PART });
	});

	test('exposes a region hide control with accessible name', () => {
		const part = createPart();
		const hideControl = part.getContainer()?.querySelector('.part-region-hide-actions .action-label');
		assert.ok(hideControl);
		assert.strictEqual(hideControl.getAttribute('aria-label'), 'Hide Conversation');
	});

	test('focus fires onDidFocus even when autoFocus is off', () => {
		const instantiationService = workbenchInstantiationService({
			configurationService: () => new TestConfigurationService({
				'ua.client.chatInput.autoFocus': false,
			}),
		}, store);
		const part = store.add(instantiationService.createInstance(ConversationPart));
		const parent = document.createElement('div');
		part.create(parent);
		let fired = 0;
		store.add(part.onDidFocus(() => fired++));
		part.focus();
		assert.strictEqual(fired, 1);
	});
});
