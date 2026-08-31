/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConversationStubService } from '../../browser/conversationStubService.js';

suite('ConversationStubService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('exposes at least three seed stub sessions', () => {
		const service = store.add(new ConversationStubService());
		assert.ok(service.getSessions().length >= 3);
	});

	test('switchSession changes the active session id', () => {
		const service = store.add(new ConversationStubService());
		const sessions = service.getSessions();
		assert.ok(sessions.length >= 2);

		const initialId = service.getActiveSessionId();
		const target = sessions.find(session => session.id !== initialId);
		assert.ok(target);

		service.switchSession(target.id);
		assert.strictEqual(service.getActiveSessionId(), target.id);
	});
});
