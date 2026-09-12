/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CONVERSATION_STUB_SEED_SESSIONS } from '../../browser/conversationStubModel.js';
import { ConversationStubService } from '../../browser/conversationStubService.js';
import { STUB_TRAJECTORY_FIXTURE_SESSION_IDS } from '../../browser/conversationTrajectoryModel.js';
import {
	PRD020_CONVERSATION_TURN_COUNT,
	PRD020_TRAJECTORY_RECORD_COUNT,
	createPrd020ConversationTurns,
	createPrd020ScaleSession,
	createPrd020TrajectoryRecords,
} from './conversationPrd020ScaleFixture.js';

suite('PRD-020 scale fixture (B0)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('locks PRD-020 literal counts', () => {
		assert.strictEqual(PRD020_CONVERSATION_TURN_COUNT, 1000);
		assert.strictEqual(PRD020_TRAJECTORY_RECORD_COUNT, 5000);
	});

	test('createPrd020ConversationTurns: count, stable ids, Stub: copy, user/assistant echo', () => {
		const turns = createPrd020ConversationTurns(PRD020_CONVERSATION_TURN_COUNT);
		assert.strictEqual(turns.length, PRD020_CONVERSATION_TURN_COUNT);
		assert.strictEqual(turns[0].id, 'prd020-t-0001');
		assert.strictEqual(turns[1].id, 'prd020-t-0002');
		assert.strictEqual(turns[PRD020_CONVERSATION_TURN_COUNT - 1].id, 'prd020-t-1000');

		for (let i = 0; i < turns.length; i++) {
			const turn = turns[i];
			assert.ok(turn.text.includes('Stub:'), `turn ${turn.id} text must contain Stub:`);
			if (i % 2 === 0) {
				assert.strictEqual(turn.kind, 'user');
				assert.strictEqual(turn.stubEcho, undefined);
			} else {
				assert.strictEqual(turn.kind, 'assistant');
				assert.strictEqual(turn.stubEcho, true);
			}
		}
	});

	test('createPrd020TrajectoryRecords: count, stable ids, message kind, Stub: copy', () => {
		const records = createPrd020TrajectoryRecords(PRD020_TRAJECTORY_RECORD_COUNT);
		assert.strictEqual(records.length, PRD020_TRAJECTORY_RECORD_COUNT);
		assert.strictEqual(records[0].id, 'prd020-r-0001');
		assert.strictEqual(records[1].id, 'prd020-r-0002');
		assert.strictEqual(records[PRD020_TRAJECTORY_RECORD_COUNT - 1].id, 'prd020-r-5000');

		for (const record of records) {
			assert.strictEqual(record.kind, 'message');
			assert.ok(record.text.includes('Stub:'), `record ${record.id} text must contain Stub:`);
		}
	});

	test('createPrd020ScaleSession shape and does not enter production seed or untitled extras', () => {
		const session = createPrd020ScaleSession(PRD020_CONVERSATION_TURN_COUNT);
		assert.strictEqual(session.id, 'prd020-scale');
		assert.strictEqual(session.title, 'PRD-020 scale (Stub)');
		assert.strictEqual(session.source, 'local');
		assert.strictEqual(session.turns.length, PRD020_CONVERSATION_TURN_COUNT);
		assert.strictEqual(session.turns[0].id, 'prd020-t-0001');

		assert.ok(!STUB_TRAJECTORY_FIXTURE_SESSION_IDS.has('prd020-scale'));
		assert.ok(!CONVERSATION_STUB_SEED_SESSIONS.some(seed => seed.id === 'prd020-scale'));
	});

	test('createTestFrameSourceCallback.refresh exists and onSessionChanged stays fire-only', () => {
		const service = store.add(new ConversationStubService());
		const callback = service.createTestFrameSourceCallback();
		assert.strictEqual(typeof callback.refresh, 'function');

		const scale = createPrd020ScaleSession(4);
		callback.model.replaceSessionCatalog([scale], scale.id);
		assert.strictEqual(callback.model.getActiveSessionId(), 'prd020-scale');
		assert.strictEqual(callback.model.getTurns('prd020-scale').length, 4);

		let fired: string | undefined;
		store.add(service.onDidChangeSession(id => {
			fired = id;
		}));

		callback.refresh('prd020-scale');
		assert.strictEqual(fired, undefined, 'refresh must not fire onDidChangeSession');

		callback.onSessionChanged('prd020-scale');
		assert.strictEqual(fired, 'prd020-scale');
	});
});
