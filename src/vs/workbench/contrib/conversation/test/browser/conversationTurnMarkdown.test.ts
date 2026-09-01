/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { shouldRenderTurnAsMarkdown } from '../../browser/conversationTurnMarkdown.js';

suite('ConversationTurnMarkdown', () => {

	test('shouldRenderTurnAsMarkdown is true only for assistant turns', () => {
		assert.strictEqual(shouldRenderTurnAsMarkdown('assistant'), true);
		assert.strictEqual(shouldRenderTurnAsMarkdown('user'), false);
		assert.strictEqual(shouldRenderTurnAsMarkdown('confirmation'), false);
		assert.strictEqual(shouldRenderTurnAsMarkdown('thinking'), false);
		assert.strictEqual(shouldRenderTurnAsMarkdown('tool'), false);
		assert.strictEqual(shouldRenderTurnAsMarkdown('visualization'), false);
	});
});
