/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConversationDiffReviewEditorId, ConversationDiffReviewInputScheme, ConversationDiffReviewInputTypeId, isConversationDiffReviewInput } from '../../../../common/editor/conversationDiffReviewInput.js';
import { TestEditorInput } from '../../workbenchTestServices.js';

suite('Conversation diff review guard', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('typed inputs match type id and untyped inputs match scheme', () => {
		assert.strictEqual(ConversationDiffReviewInputTypeId, 'workbench.editors.conversationDiffReviewInput');
		assert.strictEqual(ConversationDiffReviewEditorId, 'workbench.editor.conversationDiffReview');
		assert.strictEqual(ConversationDiffReviewInputScheme, 'conversation-diff-review');

		const typed = store.add(new TestEditorInput(URI.file('/tmp/file.ts'), ConversationDiffReviewInputTypeId));
		assert.strictEqual(isConversationDiffReviewInput(typed), true);

		const schemeWithoutType = store.add(new TestEditorInput(
			URI.from({ scheme: ConversationDiffReviewInputScheme, path: '/not-the-type' }),
			'workbench.editors.other',
		));
		assert.strictEqual(isConversationDiffReviewInput(schemeWithoutType), false);

		assert.strictEqual(isConversationDiffReviewInput({
			resource: URI.from({ scheme: ConversationDiffReviewInputScheme, path: '/modified' }),
		}), true);
		assert.strictEqual(isConversationDiffReviewInput({
			resource: URI.file('/tmp/file.ts'),
		}), false);
	});
});
