/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { emptySessionViewSnapshot } from '../../common/sessionView/empty-snapshot.js';
import { clientToolRespondCleanupPatches } from '../../common/sessionView/respond-cleanup.js';
import type { SessionViewSnapshot } from '../../common/sessionView/types.js';

suite('clientToolRespondCleanupPatches', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	test('settles the timeline row and removes the pending action', () => {
		const snapshot: SessionViewSnapshot = {
			...emptySessionViewSnapshot('session' as SessionViewSnapshot['sessionId']),
			timeline: [{
				id: 'call-1' as SessionViewSnapshot['timeline'][number]['id'],
				orderKey: 'call-1',
				summary: { kind: 'tool', title: 'Tool', toolName: 'client_tool', status: 'pending', respondable: true },
			}],
			pendingActions: [{
				requestId: 'call-1' as SessionViewSnapshot['pendingActions'][number]['requestId'],
				summary: { kind: 'tool', title: 'Tool', toolName: 'client_tool', status: 'pending', respondable: true },
			}],
		};

		const patches = clientToolRespondCleanupPatches(snapshot, { callId: 'call-1', isError: false, content: 'done' });

		assert.deepStrictEqual(patches, [
			{
				op: 'upsertTimelineItem',
				item: {
					id: 'call-1',
					orderKey: 'call-1',
					summary: { kind: 'tool', title: 'Tool', toolName: 'client_tool', status: 'completed', resultPreview: 'done' },
				},
			},
			{ op: 'removePendingAction', requestId: 'call-1' },
		]);
	});

	test('keeps a failed response honest and still clears pending state', () => {
		const snapshot: SessionViewSnapshot = {
			...emptySessionViewSnapshot('session' as SessionViewSnapshot['sessionId']),
			timeline: [{
				id: 'call-2' as SessionViewSnapshot['timeline'][number]['id'],
				orderKey: 'call-2',
				summary: { kind: 'tool', title: 'Tool', toolName: 'client_tool', status: 'running', respondable: true },
			}],
		};

		const patches = clientToolRespondCleanupPatches(snapshot, { callId: 'call-2', isError: true, content: '' });

		assert.strictEqual(patches[0]?.op, 'upsertTimelineItem');
		assert.strictEqual((patches[0] as { item: SessionViewSnapshot['timeline'][number] }).item.summary.kind, 'tool');
		assert.strictEqual((patches[0] as { item: SessionViewSnapshot['timeline'][number] }).item.summary.kind === 'tool' && (patches[0] as { item: SessionViewSnapshot['timeline'][number] }).item.summary.status, 'failed');
		assert.deepStrictEqual(patches[1], { op: 'removePendingAction', requestId: 'call-2' });
	});
});
