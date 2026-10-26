/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { ConversationViewFrameApplied } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import { ConversationStubFrameSource } from '../../browser/conversationStubFrameSource.js';
import { entriesToLegacyTurns, projectSnapshotToEntries } from '../../browser/conversationSessionView.js';
import { projectSnapshotToTrajectory } from '../../browser/conversationTrajectoryModel.js';
import { ConversationStubModel, ConversationStubTurn } from '../../browser/conversationStubModel.js';

suite('ConversationStubFrameSource', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('same tool id switches unknown to known to unknown through real diff frames without stale sidecars', () => {
		const sessionId = 'status-transition';
		const base: ConversationStubTurn = { id: 'tool', kind: 'tool', text: 'Inspect', toolName: 'read', summary: 'source', payload: 'body', toolCallId: 'call' };
		const model = new ConversationStubModel([{ id: sessionId, title: 'Status', source: 'local', turns: [base] }]);
		const source = store.add(new ConversationStubFrameSource(model, () => { }));
		const lease = store.add(source.acquire(sessionId));
		const frames: ConversationViewFrameApplied[] = [];
		store.add(lease.onDidApplyFrame(frame => frames.push(frame)));
		const assertTurn = (turn: ConversationStubTurn) => {
			assert.deepStrictEqual(entriesToLegacyTurns(projectSnapshotToEntries(lease.snapshot, lease.attribution, lease.details)), [turn]);
			const trajectory = projectSnapshotToTrajectory(lease.snapshot, lease.attribution, lease.details);
			assert.deepStrictEqual(trajectory.map(record => [record.id, record.kind, record.inputDetail, record.outputDetail]), [['tool', 'tool', 'source', 'body']]);
			// Known summaries retain the existing trajectory fallback to item id; only
			// the local unknown representation reads its own admitted sidecar call id.
			assert.strictEqual(trajectory[0].callId, turn.toolStatus === undefined ? 'call' : 'tool');
		};
		assertTurn(base);
		assert.ok(lease.attribution.get('tool')?.localTool);
		const known: ConversationStubTurn = { ...base, toolStatus: 'completed' };
		model.replaceSessionCatalog([{ id: sessionId, title: 'Status', source: 'local', turns: [known] }], sessionId);
		source.refresh(sessionId);
		assertTurn(known);
		assert.strictEqual(lease.attribution.get('tool')?.localTool, undefined);
		assert.strictEqual(lease.snapshot.timeline[0].summary.kind, 'tool');
		model.replaceSessionCatalog([{ id: sessionId, title: 'Status', source: 'local', turns: [base] }], sessionId);
		source.refresh(sessionId);
		assertTurn(base);
		assert.ok(lease.attribution.get('tool')?.localTool);
		assert.strictEqual(lease.snapshot.timeline[0].summary.kind, 'text');
		assert.strictEqual(frames.length, 2);
	});

	test('dispose before submit timeout does not land turns or emit late frames', async () => {
		const sessionId = 'stub-dispose-session';
		const model = new ConversationStubModel([{ id: sessionId, title: 'Dispose test', source: 'local', turns: [] }]);
		const source = store.add(new ConversationStubFrameSource(model, () => { }));
		const lease = store.add(source.acquire(sessionId));
		const applied: ConversationViewFrameApplied[] = [];
		store.add(lease.onDidApplyFrame(e => applied.push(e)));

		const turnsBefore = model.getTurns(sessionId).length;
		const outcome = await lease.post({ kind: 'submitInput', text: 'late should drop' });
		assert.strictEqual(outcome.accepted, true);
		assert.strictEqual(lease.snapshot.localPendingSends.length, 1);

		const appliedAfterPending = applied.length;
		source.dispose();

		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.strictEqual(model.getTurns(sessionId).length, turnsBefore);
		assert.strictEqual(applied.length, appliedAfterPending);
		assert.strictEqual(lease.snapshot.localPendingSends.length, 1);
	});
});
