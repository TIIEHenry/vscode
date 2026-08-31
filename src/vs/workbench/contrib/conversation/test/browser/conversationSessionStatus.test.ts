/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { getConversationSessionStatusText } from '../../browser/conversationSessionStatus.js';
import { ConversationStubSession } from '../../browser/conversationStubModel.js';

suite('ConversationSessionStatus', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('getConversationSessionStatusText returns session title when present', () => {
		const session: ConversationStubSession = {
			id: 'test',
			title: 'Product tour',
			turns: [],
		};
		assert.strictEqual(getConversationSessionStatusText(session), 'Product tour');
	});

	test('getConversationSessionStatusText returns empty label when session is missing', () => {
		assert.strictEqual(getConversationSessionStatusText(undefined), 'No session');
	});

	test('getConversationSessionStatusText returns empty label when title is blank', () => {
		const session: ConversationStubSession = {
			id: 'blank',
			title: '   ',
			turns: [],
		};
		assert.strictEqual(getConversationSessionStatusText(session), 'No session');
	});
});
