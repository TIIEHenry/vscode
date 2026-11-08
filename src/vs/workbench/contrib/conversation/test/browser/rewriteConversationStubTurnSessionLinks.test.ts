/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { rewriteConversationStubTurnSessionLinks } from './rewriteConversationStubTurnSessionLinks.js';

suite('rewriteConversationStubTurnSessionLinks (browser)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('shared chatId in another session catalog row must not rewrite this session link', () => {
		const original = 'See [Tool A](/session/sess-a/chat/tool-a).';
		const rewritten = rewriteConversationStubTurnSessionLinks(original, () => [{
			sessionKey: 'sess-b',
			chatId: 'tool-a',
			title: 'Tool from B',
			originKind: 'tool',
		}]);
		assert.strictEqual(rewritten, original);
	});
});
