/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { ClientActionRequestId, PendingActionView, TimelineItemId, ViewPatch } from '../../common/sessionView/types.js';
import type { OverlayPendingSnapshotItem } from '../../node/sessionCore/local-fact.js';
import {
	L2_SEQ_INDEX_FLOOR_NONE,
	createL2SeqIndexState,
	feedL2SeqIndex,
	feedL2SeqIndexState,
	pruneL2SeqIndexState,
	type L2SeqIndexEntry,
} from '../../node/sessionCore/l2-seq-index.js';
import {
	PENDING_ACTIONS_AT_CAPACITY,
	PENDING_ACTIONS_CAP,
	countPendingActionParents,
	decidePendingActionUpsert,
	planOverlayPendingSetReplace,
} from '../../node/sessionCore/pending-actions-bound.js';

function id(value: string): TimelineItemId {
	return value as TimelineItemId;
}

function question(requestId: string): PendingActionView {
	return {
		requestId: requestId as ClientActionRequestId,
		summary: {
			kind: 'question',
			title: 'Q',
			items: [{ id: 'c', title: 'Q' }],
			answerKeysValid: true,
		},
	};
}

function permission(requestId: string): PendingActionView {
	return {
		requestId: requestId as ClientActionRequestId,
		summary: { kind: 'permission', title: 'P', permissionKind: 'bash' },
	};
}

function touchedRequestId(patch: ViewPatch): string | undefined {
	if (patch.op === 'removePendingAction') {
		return patch.requestId;
	}
	if (patch.op === 'upsertPendingAction') {
		return patch.action.requestId;
	}
	return undefined;
}

function fullPermissions(): PendingActionView[] {
	assert.strictEqual(PENDING_ACTIONS_CAP, 64);
	return Array.from({ length: PENDING_ACTIONS_CAP }, (_, index) => permission(`p${index}`));
}

suite('L2 seq index and pending-action quota', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('feed past the magnitude marker keeps seq 1 and seq 65 without raising the floor', () => {
		let state = createL2SeqIndexState();
		for (let seq = 1; seq <= 65; seq++) {
			const entry: L2SeqIndexEntry = [seq, id(`item-${seq}`)];
			state = feedL2SeqIndexState(state, [entry]);
		}
		assert.strictEqual(state.entries.size, 65);
		assert.strictEqual(state.entries.get(1), id('item-1'));
		assert.strictEqual(state.entries.get(65), id('item-65'));
		assert.strictEqual(state.evictedFloor, L2_SEQ_INDEX_FLOOR_NONE);

		const pruned = pruneL2SeqIndexState(state, [1]);
		assert.strictEqual(pruned.entries.has(1), false);
		assert.strictEqual(pruned.entries.get(65), id('item-65'));
		assert.strictEqual(pruned.entries.size, 64);
		assert.strictEqual(pruned.evictedFloor, L2_SEQ_INDEX_FLOOR_NONE);
		assert.strictEqual(state.entries.has(1), true);

		const seeded = new Map<number, TimelineItemId>();
		for (let seq = 1; seq <= 65; seq++) {
			seeded.set(seq, id(`seed-${seq}`));
		}
		const created = createL2SeqIndexState(seeded, 1);
		assert.strictEqual(created.entries.get(1), id('seed-1'));
		assert.strictEqual(created.entries.get(65), id('seed-65'));
		assert.strictEqual(created.entries.size, 65);
		assert.strictEqual(created.evictedFloor, L2_SEQ_INDEX_FLOOR_NONE);

		const entries: L2SeqIndexEntry[] = [];
		for (let seq = 1; seq <= 65; seq++) {
			const entry: L2SeqIndexEntry = [seq, id(`map-${seq}`)];
			entries.push(entry);
		}
		const mapped = feedL2SeqIndex(new Map(), entries, 1);
		assert.strictEqual(mapped.size, 65);
		assert.strictEqual(mapped.get(1), id('map-1'));
		assert.strictEqual(mapped.get(65), id('map-65'));
	});

	test('unaddressable feed still withholds the id and can raise the floor', () => {
		const before = createL2SeqIndexState(new Map<number, TimelineItemId>([[3, id('keep')]]));
		const rejectedEntries: L2SeqIndexEntry[] = [
			[7, id('')],
			[8, id('  ')],
			[9, id('ok')],
		];
		const rejected = feedL2SeqIndexState(before, rejectedEntries);
		assert.strictEqual(rejected.entries.has(7), false);
		assert.strictEqual(rejected.entries.has(8), false);
		assert.strictEqual(rejected.entries.get(9), id('ok'));
		assert.strictEqual(rejected.entries.get(3), id('keep'));
		assert.strictEqual(rejected.evictedFloor, 8);
		assert.strictEqual(before.entries.size, 1);
		assert.strictEqual(before.evictedFloor, L2_SEQ_INDEX_FLOOR_NONE);

		const seeded = createL2SeqIndexState(new Map<number, TimelineItemId>([
			[10, id('  pad')],
			[2, id('stay')],
		]));
		assert.strictEqual(seeded.entries.has(10), false);
		assert.strictEqual(seeded.entries.get(2), id('stay'));
		assert.strictEqual(seeded.evictedFloor, 10);
		const lowerEntry: L2SeqIndexEntry = [4, id('')];
		const lower = feedL2SeqIndexState(seeded, [lowerEntry]);
		assert.strictEqual(lower.evictedFloor, 10);
		assert.strictEqual(lower.entries.get(2), id('stay'));
		const higherEntry: L2SeqIndexEntry = [12, id(' x')];
		const higher = feedL2SeqIndexState(lower, [higherEntry]);
		assert.strictEqual(higher.evictedFloor, 12);
		assert.strictEqual(higher.entries.has(12), false);
		assert.strictEqual(higher.entries.get(2), id('stay'));
	});

	test('failed mint of an existing question keeps the row and still upserts a good permission', () => {
		const broken: OverlayPendingSnapshotItem[] = [
			{ requestId: 'q-keep', kind: 'question', description: '' },
			{
				requestId: 'q-keep',
				kind: 'question',
				description: 'Ask',
				questions: 'nope',
			} as unknown as OverlayPendingSnapshotItem,
		];
		for (const item of broken) {
			const planned = planOverlayPendingSetReplace(
				[question('q-keep')],
				{
					runtimeEpoch: 1,
					pending: [
						item,
						{ requestId: 'ghost', kind: 'question', description: '' },
						{ requestId: 'perm-ok', kind: 'permission', description: 'Allow', toolName: 'bash' },
					],
				},
				1,
				1,
			);
			assert.strictEqual(planned.kind, 'apply');
			if (planned.kind !== 'apply') {
				continue;
			}
			assert.deepStrictEqual(planned.removedRequestIds, []);
			assert.deepStrictEqual(planned.patches.map(touchedRequestId), ['perm-ok']);
		}
	});

	test('a migrated requestId absent from the snapshot is still removed', () => {
		const planned = planOverlayPendingSetReplace(
			[question('q-keep')],
			{ runtimeEpoch: 1, pending: [] },
			1,
			1,
		);
		assert.strictEqual(planned.kind, 'apply');
		if (planned.kind !== 'apply') {
			return;
		}
		assert.deepStrictEqual(planned.patches, [
			{ op: 'removePendingAction', requestId: 'q-keep' },
		]);
		assert.deepStrictEqual(planned.removedRequestIds, ['q-keep']);
	});

	test('a duplicate canonical requestId skips the frame with no patches', () => {
		const planned = planOverlayPendingSetReplace(
			[question('q-keep')],
			{
				runtimeEpoch: 1,
				pending: [
					{ requestId: 'dup', kind: 'permission', description: 'A', toolName: 'bash' },
					{ requestId: 'dup', kind: 'permission', description: 'B', toolName: 'bash' },
				],
			},
			1,
			1,
		);
		assert.strictEqual(planned.kind, 'skip_ambiguous_pending_ids');
		assert.strictEqual('patches' in planned, false);
	});

	test('non-question quota uses the full requestId; questions still share a parent', () => {
		const full = fullPermissions();
		const colonChild = decidePendingActionUpsert(full, permission('p0:x'));
		assert.strictEqual(colonChild.kind, 'skip_at_capacity');
		if (colonChild.kind === 'skip_at_capacity') {
			assert.strictEqual(colonChild.code, PENDING_ACTIONS_AT_CAPACITY);
		}
		const exact = decidePendingActionUpsert(full, permission('p0'));
		assert.strictEqual(exact.kind, 'upsert');

		const withQuestion = [...full.slice(0, PENDING_ACTIONS_CAP - 1), question('q')];
		const residual = decidePendingActionUpsert(withQuestion, question('q:c1'));
		assert.strictEqual(residual.kind, 'upsert');

		const withPermissionA = [...full.slice(0, PENDING_ACTIONS_CAP - 1), permission('a')];
		const questionShares = decidePendingActionUpsert(withPermissionA, question('a:x'));
		assert.strictEqual(questionShares.kind, 'upsert');
		const withQuestionA = [...full.slice(0, PENDING_ACTIONS_CAP - 1), question('a:x')];
		const permissionShares = decidePendingActionUpsert(withQuestionA, permission('a'));
		assert.strictEqual(permissionShares.kind, 'upsert');

		assert.strictEqual(countPendingActionParents([permission('a'), permission('a:b')]), 2);
		assert.strictEqual(countPendingActionParents([question('a:1'), question('a:2')]), 1);
		assert.strictEqual(countPendingActionParents([permission('a'), question('a:x')]), 1);

		const sneaky = Object.defineProperty(
			{ requestId: 'a:b' as ClientActionRequestId },
			'summary',
			{
				get() {
					throw new Error('summary accessor');
				},
				enumerable: true,
			},
		) as PendingActionView;
		assert.strictEqual(countPendingActionParents([permission('a'), sneaky]), 2);
		const sneakyDecision = decidePendingActionUpsert(full, Object.defineProperty(
			{ requestId: 'p0:x' as ClientActionRequestId },
			'summary',
			{
				get() {
					throw new Error('summary accessor');
				},
				enumerable: true,
			},
		) as PendingActionView);
		assert.strictEqual(sneakyDecision.kind, 'skip_at_capacity');
		if (sneakyDecision.kind === 'skip_at_capacity') {
			assert.strictEqual(sneakyDecision.code, PENDING_ACTIONS_AT_CAPACITY);
		}
	});
});
