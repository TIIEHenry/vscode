/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { ConversationTrajectoryRecord } from './conversationTrajectoryModel.js';
import { buildTrajectoryOverviewSegments, TRAJECTORY_OVERVIEW_MAX_SEGMENTS } from './conversationTrajectoryOverview.js';

suite('conversationTrajectoryOverview', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('buildTrajectoryOverviewSegments([]) yields no segments for an empty session window', () => {
		const { segments, aggregatedByTurn } = buildTrajectoryOverviewSegments([]);
		assert.strictEqual(segments.length, 0);
		assert.strictEqual(aggregatedByTurn, false);
	});

	test('turn aggregation splits on user rows when opensTurn is omitted', () => {
		const records: ConversationTrajectoryRecord[] = [];
		records.push({ id: 'session-a-user', kind: 'user', text: 'A' });
		for (let i = 0; i < 100; i++) {
			records.push({ id: `session-a-tool-${i}`, kind: 'tool', text: `a-${i}` });
		}
		records.push({ id: 'session-b-user', kind: 'user', text: 'B' });
		for (let i = 0; i < 100; i++) {
			records.push({ id: `session-b-tool-${i}`, kind: 'tool', text: `b-${i}` });
		}
		assert.ok(records.length > TRAJECTORY_OVERVIEW_MAX_SEGMENTS);

		const { segments, aggregatedByTurn } = buildTrajectoryOverviewSegments(records);
		assert.strictEqual(aggregatedByTurn, true);
		assert.strictEqual(segments.length, 2);
		assert.ok(segments[0]!.recordIds.includes('session-a-user'));
		assert.ok(!segments[0]!.recordIds.includes('session-b-user'));
		assert.ok(segments[1]!.recordIds.includes('session-b-user'));
		assert.ok(!segments[1]!.recordIds.includes('session-a-user'));
	});
});
