/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	collectTrajectoryTurnIdsFromSnapshot,
	findTurnIdForTrajectoryRecord,
	type ConversationTrajectoryRecord,
} from './conversationTrajectoryModel.js';
import type { SessionViewSnapshot, TimelineItemId } from '../../../../platform/universeAgent/common/sessionView/index.js';

suite('conversationTrajectoryModel (unit)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('findTurnIdForTrajectoryRecord maps derived row ids to linked timeline items', () => {
		const snapshot: SessionViewSnapshot = {
			sessionId: 'ua-live' as SessionViewSnapshot['sessionId'],
			sync: { kind: 'live' },
			timeline: [
				{
					id: 'env-tool' as TimelineItemId,
					orderKey: '0000000000000001',
					summary: {
						kind: 'tool',
						title: 'Read',
						toolName: 'read_file',
						toolNames: ['read_file', 'grep'],
						status: 'completed',
						assistantText: 'Checking.',
						thinkingText: 'plan',
					},
				},
			],
			overlay: { blocks: [] },
			pendingActions: [],
			localPendingSends: [],
		};
		const turnIds = collectTrajectoryTurnIdsFromSnapshot(snapshot);

		const cases: Array<{ record: ConversationTrajectoryRecord; expected: string | undefined }> = [
			{ record: { id: 'env-tool:think', kind: 'thinking', text: 'plan' }, expected: 'env-tool:think' },
			{ record: { id: 'env-tool:body', kind: 'message', text: 'Checking.' }, expected: 'env-tool:body' },
			{ record: { id: 'env-tool:tool:1', kind: 'tool', text: 'grep' }, expected: 'env-tool:tool:1' },
			{ record: { id: 'env-tool', kind: 'tool', text: 'read_file' }, expected: 'env-tool' },
			{ record: { id: 'fixture:untitled:subtool', kind: 'subtool', text: 'nested', parentCallId: 'call-x' }, expected: undefined },
		];

		for (const { record, expected } of cases) {
			assert.strictEqual(
				findTurnIdForTrajectoryRecord(record, turnIds),
				expected,
				`record id ${record.id}`,
			);
		}
	});
});
