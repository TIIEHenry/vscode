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

	test('ignores unknown call ids and does not remove a colliding question', () => {
		const snapshot: SessionViewSnapshot = {
			...emptySessionViewSnapshot('session' as SessionViewSnapshot['sessionId']),
			pendingActions: [{
				requestId: 'same-id' as SessionViewSnapshot['pendingActions'][number]['requestId'],
				summary: {
					kind: 'question', title: 'Question', items: [], answerKeysValid: true,
				},
			}],
		};

		assert.deepStrictEqual(clientToolRespondCleanupPatches(snapshot, { callId: 'unknown', isError: false, content: 'late' }), []);
		assert.deepStrictEqual(clientToolRespondCleanupPatches(snapshot, { callId: 'same-id', isError: false, content: 'wrong family' }), []);
	});

	test('does not rewrite a non-client tool row on id collision', () => {
		const snapshot: SessionViewSnapshot = {
			...emptySessionViewSnapshot('session' as SessionViewSnapshot['sessionId']),
			timeline: [{
				id: 'same-id' as SessionViewSnapshot['timeline'][number]['id'],
				orderKey: 'same-id',
				summary: { kind: 'tool', title: 'Server tool', toolName: 'server_tool', status: 'running' },
			}],
		};

		assert.deepStrictEqual(clientToolRespondCleanupPatches(snapshot, { callId: 'same-id', isError: true, content: 'wrong family' }), []);
	});

	test('does not remove a colliding non-client pending action beside a client row', () => {
		const snapshot: SessionViewSnapshot = {
			...emptySessionViewSnapshot('session' as SessionViewSnapshot['sessionId']),
			timeline: [{
				id: 'same-id' as SessionViewSnapshot['timeline'][number]['id'],
				orderKey: 'same-id',
				summary: { kind: 'tool', title: 'Client tool', toolName: 'client_tool', status: 'pending', respondable: true },
			}],
			pendingActions: [{
				requestId: 'same-id' as SessionViewSnapshot['pendingActions'][number]['requestId'],
				summary: { kind: 'question', title: 'Question', items: [], answerKeysValid: true },
			}],
		};

		assert.deepStrictEqual(clientToolRespondCleanupPatches(snapshot, { callId: 'same-id', isError: false, content: 'collision' }), []);
	});

	test('settles a pending client tool when its timeline row is not yet present', () => {
		const snapshot: SessionViewSnapshot = {
			...emptySessionViewSnapshot('session' as SessionViewSnapshot['sessionId']),
			pendingActions: [{
				requestId: 'call-3' as SessionViewSnapshot['pendingActions'][number]['requestId'],
				summary: { kind: 'tool', title: 'Tool', toolName: 'client_tool', status: 'pending', respondable: true },
			}],
		};

		assert.deepStrictEqual(clientToolRespondCleanupPatches(snapshot, { callId: 'call-3', isError: false, content: 'done' }), [
			{ op: 'removePendingAction', requestId: 'call-3' },
		]);
	});
});
