/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConversationStubModel } from '../../browser/conversationStubModel.js';

suite('ConversationStubModel (browser)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('upsertCachedSession does not replace an existing title with blank', () => {
		const model = new ConversationStubModel([{
			id: 'ua-session-1',
			title: 'Renamed locally',
			turns: [{ id: 'u1', kind: 'user', text: 'hello' }],
			source: 'local',
		}]);

		model.upsertCachedSession({
			id: 'ua-session-1',
			title: '',
			source: 'engine-cache',
			turns: [{ id: 'u2', kind: 'user', text: 'cache refresh' }],
		});

		const session = model.getSessions().find(row => row.id === 'ua-session-1');
		assert.ok(session);
		assert.strictEqual(session.title, 'Renamed locally');
		assert.strictEqual(session.turns.length, 1);
		assert.strictEqual(session.turns[0]?.text, 'cache refresh');
	});

	test('resolving confirmations settles only their linked pending tools', () => {
		const model = new ConversationStubModel([{
			id: 'ua-session-1',
			title: 'Session',
			turns: [
				{ id: 'allow', kind: 'confirmation', text: 'Allow write?', status: 'pending' },
				{ id: 'skip', kind: 'confirmation', text: 'Allow edit?', status: 'pending' },
				{ id: 'write', kind: 'tool', text: 'Write', toolStatus: 'pending', confirmationId: 'allow' },
				{ id: 'edit', kind: 'tool', text: 'Edit', toolStatus: 'pending', confirmationId: 'skip' },
				{ id: 'other', kind: 'tool', text: 'Other', toolStatus: 'pending', confirmationId: 'other' },
			],
		}]);

		model.resolveConfirmation('ua-session-1', 'allow', 'allowed');
		model.resolveConfirmation('ua-session-1', 'skip', 'skipped');

		assert.deepStrictEqual(model.getTurns('ua-session-1').map(turn => [turn.id, turn.status, turn.toolStatus]), [
			['allow', 'allowed', undefined],
			['skip', 'skipped', undefined],
			['write', undefined, 'completed'],
			['edit', undefined, 'cancelled'],
			['other', undefined, 'pending'],
		]);
		assert.strictEqual(model.countPendingConfirmations('ua-session-1'), 0);
	});
});
