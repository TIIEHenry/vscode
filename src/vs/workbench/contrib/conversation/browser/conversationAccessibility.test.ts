/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { getConversationTurnAccessibleText } from './conversationAccessibility.js';

suite('conversationAccessibility (browser unit)', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('Accessible View includes thinking payload not only the fold header line', () => {
		const payload = 'Stub: # Project\n\nFull reasoning body.';
		const view = getConversationTurnAccessibleText({
			id: 't1',
			kind: 'thinking',
			text: 'Stub: outline sections',
			payload,
		});
		assert.ok(view.includes('Stub: outline sections'));
		assert.ok(view.includes('Full reasoning body.'));
	});

	test('Accessible View includes tool summary when the row title differs', () => {
		const view = getConversationTurnAccessibleText({
			id: 'tool-1',
			kind: 'tool',
			text: 'read_file',
			summary: 'src/main.ts',
		});
		assert.ok(view.includes('read_file'));
		assert.ok(view.includes('src/main.ts'));
	});
});
