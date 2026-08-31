/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	flattenConversationTimelineItems,
	normalizeUserPromptText,
	resolvePinnedUserPromptState,
	toPinnedUserPromptPreview,
} from '../../browser/conversationPinnedUserPrompt.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';

suite('ConversationPinnedUserPrompt', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function user(id: string, text: string): ConversationStubTurn {
		return { id, kind: 'user', text };
	}

	function assistant(id: string, text: string): ConversationStubTurn {
		return { id, kind: 'assistant', text };
	}

	test('returns undefined when empty, at bottom, or no user turns', () => {
		assert.strictEqual(resolvePinnedUserPromptState([], [0], false), undefined);
		assert.strictEqual(resolvePinnedUserPromptState([], [0], true), undefined);

		const assistantOnly = flattenConversationTimelineItems([assistant('a-1', 'Hello')]);
		assert.strictEqual(resolvePinnedUserPromptState(assistantOnly, [0], false), undefined);

		const withUser = flattenConversationTimelineItems([
			user('u-1', 'Question'),
			assistant('a-1', 'Answer'),
		]);
		assert.strictEqual(resolvePinnedUserPromptState(withUser, [1], true), undefined);
	});

	test('returns undefined when the first visible row is a user turn', () => {
		const items = flattenConversationTimelineItems([
			user('u-1', 'Explain the plan'),
			assistant('a-1', 'The plan is...'),
		]);

		assert.strictEqual(resolvePinnedUserPromptState(items, [0, 1], false), undefined);
	});

	test('pins previous user prompt when reading assistant content above the viewport', () => {
		const items = flattenConversationTimelineItems([
			user('u-1', 'What changed in the implementation?'),
			assistant('a-1', 'A long answer'),
			assistant('a-2', 'More detail'),
		]);

		const state = resolvePinnedUserPromptState(items, [1], false);

		assert.ok(state);
		assert.strictEqual(state.turnId, 'u-1');
		assert.strictEqual(state.fullText, 'What changed in the implementation?');
		assert.strictEqual(state.previewText, 'What changed in the implementation?');
	});

	test('hides when the owning user turn is still visible', () => {
		const items = flattenConversationTimelineItems([
			user('u-1', 'Keep context visible'),
			assistant('a-1', 'Done'),
		]);

		assert.strictEqual(resolvePinnedUserPromptState(items, [0, 1], false), undefined);
	});

	test('normalizes whitespace for preview and full text', () => {
		const items = flattenConversationTimelineItems([
			user('u-1', 'Line one\n\nLine two'),
			assistant('a-1', 'Done'),
		]);

		const state = resolvePinnedUserPromptState(items, [1], false);
		assert.ok(state);
		assert.strictEqual(state.fullText, 'Line one Line two');
		assert.strictEqual(state.previewText, 'Line one Line two');
		assert.strictEqual(normalizeUserPromptText('  spaced   words  '), 'spaced words');
	});

	test('truncates long prompt preview', () => {
		const longText = '1234567890 1234567890 1234567890';
		const items = flattenConversationTimelineItems([
			user('u-1', longText),
			assistant('a-1', 'Done'),
		]);

		const state = resolvePinnedUserPromptState(items, [1], false, 11);
		assert.ok(state);
		assert.strictEqual(state.fullText, longText);
		assert.strictEqual(state.previewText, '1234567890...');
		assert.strictEqual(toPinnedUserPromptPreview('short', 11), 'short');
	});

	test('pins through thinking/tool process rows', () => {
		const items = flattenConversationTimelineItems([
			user('u-1', 'Run grep'),
			{ id: 't-1', kind: 'tool', text: 'grep src' },
			assistant('a-1', 'Found matches'),
		]);

		// First visible is the tool process header (not user).
		assert.strictEqual(resolvePinnedUserPromptState(items, [1], false)?.turnId, 'u-1');
		// First visible is expanded tool body.
		assert.strictEqual(resolvePinnedUserPromptState(items, [2], false)?.turnId, 'u-1');
	});
});
