/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	flattenConversationTimelineItems,
	resolvePinnedUserPromptState,
} from './conversationPinnedUserPrompt.js';
import { ConversationStubTurn } from './conversationStubModel.js';

suite('conversationPinnedUserPrompt (browser unit)', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	function user(id: string, text: string): ConversationStubTurn {
		return { id, kind: 'user', text };
	}

	function assistant(id: string, text: string): ConversationStubTurn {
		return { id, kind: 'assistant', text };
	}

	test('ignores out-of-range visible indices after the timeline shrinks', () => {
		const items = flattenConversationTimelineItems([
			user('u-new', 'New session question'),
			assistant('a-new', 'Answer'),
		]);

		assert.strictEqual(resolvePinnedUserPromptState(items, [99], false), undefined);
	});

	test('pins the latest user before the bottom of the viewport, not the first user turn', () => {
		const items = flattenConversationTimelineItems([
			user('u-1', 'First question'),
			assistant('a-1', 'First answer'),
			user('u-2', 'Follow-up question'),
			assistant('a-2', 'Second answer'),
		]);

		const state = resolvePinnedUserPromptState(items, [1, 3], false);

		assert.ok(state);
		assert.strictEqual(state.turnId, 'u-2');
		assert.strictEqual(state.fullText, 'Follow-up question');
	});
});
