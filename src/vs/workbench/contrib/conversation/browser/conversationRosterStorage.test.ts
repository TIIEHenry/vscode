/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { TestStorageService } from '../../../test/common/workbenchTestServices.js';
import { ConversationStubService } from './conversationStubService.js';
import { CONVERSATION_ROSTER_STORAGE_KEY, loadConversationRosterStorage } from './conversationRosterStorage.js';

suite('conversationRosterStorage (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('localSessions bucket coerces engine-cache source tags so roster rows stay visible', () => {
		const storage = store.add(new TestStorageService());
		storage.store(
			CONVERSATION_ROSTER_STORAGE_KEY,
			JSON.stringify({
				version: 1,
				wasEverConnected: false,
				activeSessionId: 'misplaced-cache',
				nextTurnId: 100,
				localSessions: [{
					id: 'misplaced-cache',
					title: 'Local row',
					source: 'engine-cache',
					turns: [{ id: 'turn-1', kind: 'user', text: 'hello' }],
				}],
			}),
			StorageScope.WORKSPACE,
			StorageTarget.MACHINE,
		);

		const loaded = loadConversationRosterStorage(storage);
		assert.ok(loaded);
		assert.strictEqual(loaded.localSessions.length, 1);
		assert.strictEqual(loaded.localSessions[0].source, 'local');

		const roster = store.add(new ConversationStubService(storage));
		assert.ok(roster.getSessions().some(session => session.id === 'misplaced-cache'));
		assert.strictEqual(roster.getActiveSessionId(), 'misplaced-cache');
	});
});
