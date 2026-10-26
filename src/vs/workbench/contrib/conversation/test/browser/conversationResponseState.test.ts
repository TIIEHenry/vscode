/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConversationResponseState, conversationResponseChangedIds, resolveConversationResponses } from '../../../../../platform/universeAgent/common/conversationResponseState.js';
import type { ItemAttribution } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import { emptySessionViewSnapshot } from '../../../../../platform/universeAgent/common/sessionView/empty-snapshot.js';
import type { ClientActionRequestId, PendingActionView, SessionId, SessionViewSnapshot, TimelineItemId, TimelineItemSummary } from '../../../../../platform/universeAgent/common/sessionView/types.js';
import { createConversationProjectionCache, projectSnapshotToEntries } from '../../browser/conversationSessionView.js';

suite('Conversation response canonical identity', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	const permission: TimelineItemSummary = { kind: 'permission', title: 'Allow?', permissionKind: 'shell' };
	const question: TimelineItemSummary = { kind: 'question', title: 'Choose', answerKeysValid: true, items: [{ id: 'item', title: 'Which?', optionsPreview: ['one', 'two'] }] };
	const tool: TimelineItemSummary = { kind: 'tool', title: 'Respond', toolName: 'client', status: 'pending', respondable: true };
	const action = (id: string, summary: TimelineItemSummary, agentId?: string): PendingActionView => ({ requestId: id as ClientActionRequestId, summary, ...(agentId !== undefined ? { agentId } : {}) });
	function snapshot(pending: readonly PendingActionView[], rows: readonly { id: string; summary: TimelineItemSummary; agentId?: string }[]): SessionViewSnapshot {
		return { ...emptySessionViewSnapshot('session' as SessionId), pendingActions: pending,
			timeline: rows.map(row => ({ ...row, id: row.id as TimelineItemId, orderKey: row.id })) };
	}

	for (const [name, pending, row] of [
		['permission/question', permission, question], ['question/client-tool', question, tool], ['client-tool/permission', tool, permission],
	] as const) {
		test(`same-id ${name} conflict never projects a bare failure onto another kind`, () => {
			const view = snapshot([action('same', pending)], [{ id: 'same', summary: row }]);
			const state = new ConversationResponseState();
			state.reconcile(view, new Map());
			assert.strictEqual(state.projection.byRequest.size, 0);
			const legacy = new Map([['same', { retryable: true, error: 'belongs to another kind' }]]);
			for (const options of [undefined, { responseProjection: state.projection }]) {
				const entries = projectSnapshotToEntries(view, new Map(), new Map(), undefined, undefined, legacy, options);
				assert.ok(entries.every(entry => entry.respondFailure === undefined && entry.responseState === undefined));
			}
		});
	}

	for (const declaration of ['timeline', 'attribution'] as const) {
		test(`same-id ${declaration} agent conflict rejects busy, failure and cleanup ownership`, () => {
			const view = snapshot([action('same', permission, 'agent-a')], [{ id: 'same', summary: permission, ...(declaration === 'timeline' ? { agentId: 'agent-b' } : {}) }]);
			const attribution = new Map<string, ItemAttribution>(declaration === 'attribution' ? [['same', { role: 'assistant', agentId: 'agent-b' }]] : []);
			const state = new ConversationResponseState();
			state.reconcile(view, attribution);
			assert.deepStrictEqual(state.begin('permission', 'same'), { kind: 'untracked' });
			state.noteFailure('same', { retryable: true, error: 'wrong agent' });
			assert.strictEqual(state.projection.byRequest.size, 0);
		});
	}

	test('question longest prefix is resolved across all kinds before aliases can own any state', () => {
		const view = snapshot([action('q', question), action('q:sub', permission)], [{ id: 'q:sub:row', summary: question }]);
		const resolved = resolveConversationResponses(view, new Map());
		assert.ok([...resolved.values()].every(state => !state.rowIds.includes('q:sub:row')));
		const entries = projectSnapshotToEntries(view, new Map(), new Map(), undefined, undefined, new Map([
			['q', { retryable: true, error: 'short prefix' }], ['q:sub', { retryable: true, error: 'foreign permission' }],
		]));
		assert.ok(entries.every(entry => entry.respondFailure === undefined));
	});

	test('question alias failure, retry clear and busy invalidate both the display row and pending alias with a live cache', () => {
		const view = snapshot([action('q:sub', question, 'agent')], [{ id: 'q:sub:row', summary: question }]);
		const state = new ConversationResponseState();
		state.reconcile(view, new Map());
		const before = state.projection;
		const attempt = state.begin('question', 'q:sub');
		assert.strictEqual(attempt.kind, 'started');
		if (attempt.kind !== 'started') { return; }
		const cache = createConversationProjectionCache();
		const project = () => projectSnapshotToEntries(view, new Map(), new Map(), undefined, cache, new Map([['q:sub:row', { retryable: true, error: 'untyped stale' }]]), { responseProjection: state.projection });
		const busy = project().find(entry => entry.id === 'q:sub:row');
		assert.strictEqual(busy?.responseState?.inFlight, true);
		assert.strictEqual(busy?.respondFailure, undefined, 'typed projection never falls back to a raw display id');
		state.finish(attempt.ticket, { retryable: true, error: 'wire failed' });
		const failed = state.projection;
		assert.deepStrictEqual(project().find(entry => entry.id === 'q:sub:row')?.respondFailure, { retryable: true, error: 'wire failed' });
		const retry = state.begin('question', 'q:sub');
		assert.strictEqual(retry.kind, 'started');
		assert.deepStrictEqual([...conversationResponseChangedIds(before, failed)].sort(), ['pending:q:sub', 'q:sub:row']);
		assert.deepStrictEqual([...conversationResponseChangedIds(failed, state.projection)].sort(), ['pending:q:sub', 'q:sub:row']);
		assert.strictEqual(project().find(entry => entry.id === 'q:sub:row')?.responseState?.inFlight, true);
		assert.strictEqual(project().find(entry => entry.id === 'q:sub:row')?.respondFailure, undefined);
		state.finish(attempt.ticket, { retryable: true, error: 'late old failure' });
		assert.strictEqual(project().find(entry => entry.id === 'q:sub:row')?.responseState?.inFlight, true);
	});

	test('a conflict introduced during an attempt retires its result and a later same-id request gets a fresh incarnation', () => {
		const view = snapshot([action('same', permission, 'agent-a')], [{ id: 'same', summary: permission }]);
		const state = new ConversationResponseState();
		state.reconcile(view, new Map());
		const before = [...state.projection.byRequest.values()][0];
		const attempt = state.begin('permission', 'same');
		assert.strictEqual(attempt.kind, 'started');
		if (attempt.kind !== 'started') { return; }
		state.reconcile(view, new Map([['same', { role: 'assistant', agentId: 'agent-b' }]]));
		assert.strictEqual(state.isCurrent(attempt.ticket), false);
		state.finish(attempt.ticket, { retryable: true, error: 'late conflict result' });
		assert.strictEqual(state.projection.byRequest.size, 0);
		state.reconcile(view, new Map());
		const replacement = [...state.projection.byRequest.values()][0];
		assert.notStrictEqual(replacement.incarnation, before.incarnation);
		assert.strictEqual(replacement.failure, undefined);
	});

	test('same semantic question baseline preserves the attempt despite object property order and optional false flags', () => {
		const state = new ConversationResponseState();
		const original = snapshot([action('q', question)], [{ id: 'q:row', summary: question }]);
		state.reconcile(original, new Map());
		const begun = state.begin('question', 'q');
		assert.strictEqual(begun.kind, 'started');
		if (begun.kind !== 'started') { return; }
		const reordered: TimelineItemSummary = { kind: 'question', title: 'Choose', allowCustom: false, multiSelect: false, optionsPreview: [], answerKeysValid: true,
			items: [{ optionsPreview: ['one', 'two'], allowCustom: false, multiSelect: false, title: 'Which?', id: 'item' }] };
		state.reconcile(snapshot([action('q', reordered)], [{ id: 'q:row', summary: reordered }]), new Map());
		assert.strictEqual(state.isCurrent(begun.ticket), true);
		assert.strictEqual([...state.projection.byRequest.values()][0].inFlight, true);
	});

	test('non-retryable failure is explicitly blocked and cannot enter the forwarding branch', () => {
		const state = new ConversationResponseState();
		state.reconcile(snapshot([action('same', tool)], [{ id: 'same', summary: tool }]), new Map());
		const attempt = state.begin('clientTool', 'same');
		assert.strictEqual(attempt.kind, 'started');
		if (attempt.kind !== 'started') { return; }
		state.noteFailure('same', { retryable: false, error: 'expired' });
		assert.deepStrictEqual(state.begin('clientTool', 'same'), { kind: 'blocked' });
		state.finish(attempt.ticket, { retryable: true, error: 'late transport error' });
		assert.deepStrictEqual([...state.projection.byRequest.values()].map(record => record.failure), [{ retryable: false, error: 'expired' }]);
	});
});
