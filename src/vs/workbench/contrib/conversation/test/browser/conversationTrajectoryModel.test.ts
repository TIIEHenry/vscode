/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	collectTrajectoryTurnIdsFromSnapshot,
	findTurnIdForTrajectoryRecord,
	getTrajectoryRecordSearchHaystack,
	projectSnapshotToTrajectory,
	type ConversationTrajectoryRecord,
} from './conversationTrajectoryModel.js';
import type { OverlayBlockId, SessionViewSnapshot, TimelineCanvasRef, TimelineItemId } from '../../../../platform/universeAgent/common/sessionView/index.js';

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
			{ record: { id: 'env-tool:think', kind: 'thinking', text: 'plan' }, expected: 'env-tool' },
			{ record: { id: 'env-tool:body', kind: 'message', text: 'Checking.' }, expected: 'env-tool' },
			{ record: { id: 'env-tool:tool:1', kind: 'tool', text: 'grep' }, expected: 'env-tool' },
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

	test('tool canvas refs are copied when admitted and omitted when absent or invalid', () => {
		const accessorRef: { revisionId: string; title: string } = { revisionId: 'r-get', title: 'Getter' };
		Object.defineProperty(accessorRef, 'canvasId', { get: () => 'invented-id' });
		const snapshot: SessionViewSnapshot = {
			sessionId: 'ua-live' as SessionViewSnapshot['sessionId'],
			sync: { kind: 'live' },
			timeline: [
				{
					id: 'tool-canvas' as TimelineItemId,
					orderKey: '0001',
					summary: {
						kind: 'tool',
						title: 'Read',
						toolName: 'read_file',
						toolNames: ['read_file', 'grep'],
						status: 'completed',
						assistantText: 'Checking.',
						argPreview: '{"path":"a.ts"}',
						canvasRefs: [
							{ canvasId: 'c1', revisionId: 'r1', title: 'Board', sourceHash: 'h1' },
							{ canvasId: 'c2', revisionId: 'r2', title: 'Notes' },
							{ canvasId: '', revisionId: 'r-empty', title: 'Dropped' },
						],
					},
				},
				{
					id: 'tool-bad' as TimelineItemId,
					orderKey: '0002',
					summary: {
						kind: 'tool',
						title: 'Grep',
						toolName: 'grep',
						status: 'completed',
						canvasRefs: [
							{ canvasId: 'c-bad', revisionId: '', title: 'Nope' },
							{ canvasId: 'c-hash', revisionId: 'r-hash', title: 'Hash', sourceHash: 1 as unknown as string },
						],
					},
				},
				{
					id: 'tool-empty' as TimelineItemId,
					orderKey: '0003',
					summary: {
						kind: 'tool',
						title: 'Shell',
						toolName: 'shell',
						status: 'completed',
						canvasRefs: [],
					},
				},
				{
					id: 'tool-plain' as TimelineItemId,
					orderKey: '0004',
					summary: {
						kind: 'tool',
						title: 'Write',
						toolName: 'write',
						status: 'completed',
					},
				},
				{
					id: 'tool-getter' as TimelineItemId,
					orderKey: '0005',
					summary: {
						kind: 'tool',
						title: 'Accessor',
						toolName: 'read_file',
						status: 'completed',
						canvasRefs: [accessorRef as TimelineCanvasRef],
					},
				},
			],
			overlay: {
				blocks: [
					{
						blockId: 'live-canvas' as OverlayBlockId,
						orderKey: '0009',
						chunks: [],
						summary: {
							kind: 'tool',
							title: ' ',
							toolName: '',
							status: 'running',
							canvasRefs: [{ canvasId: 'c-live', revisionId: 'r-live', title: 'Only board' }],
						},
					},
				],
			},
			pendingActions: [],
			localPendingSends: [],
		};

		const records = projectSnapshotToTrajectory(snapshot, new Map(), new Map());
		const primary = records.find(record => record.id === 'tool-canvas');
		assert.ok(primary);
		assert.strictEqual(primary.kind, 'tool');
		assert.strictEqual(primary.inputDetail, '{"path":"a.ts"}');
		assert.deepStrictEqual(primary.canvasRefs, [
			{ canvasId: 'c1', revisionId: 'r1', title: 'Board', sourceHash: 'h1' },
			{ canvasId: 'c2', revisionId: 'r2', title: 'Notes' },
		]);
		assert.ok(!('sourceHash' in (primary.canvasRefs?.[1] ?? {})));
		assert.strictEqual(records.find(record => record.id === 'tool-canvas:body')?.canvasRefs, undefined);
		assert.strictEqual(records.find(record => record.id === 'tool-canvas:tool:1')?.canvasRefs, undefined);
		assert.ok(getTrajectoryRecordSearchHaystack(primary).includes('board'));
		assert.ok(getTrajectoryRecordSearchHaystack(primary).includes('notes'));
		assert.ok(!getTrajectoryRecordSearchHaystack(primary).includes('c1'));
		assert.ok(!getTrajectoryRecordSearchHaystack(primary).includes('r1'));

		const bad = records.find(record => record.id === 'tool-bad');
		assert.ok(bad);
		assert.ok(!('canvasRefs' in bad));
		const empty = records.find(record => record.id === 'tool-empty');
		assert.ok(empty);
		assert.ok(!('canvasRefs' in empty));
		const plain = records.find(record => record.id === 'tool-plain');
		assert.ok(plain);
		assert.ok(!('canvasRefs' in plain));
		const getter = records.find(record => record.id === 'tool-getter');
		assert.ok(getter);
		assert.ok(!('canvasRefs' in getter));
		assert.ok(!getter.text.includes('invented-id'));

		const overlay = records.find(record => record.id === 'overlay:live-canvas');
		assert.ok(overlay);
		assert.strictEqual(overlay.text, 'Only board');
		assert.deepStrictEqual(overlay.canvasRefs, [{ canvasId: 'c-live', revisionId: 'r-live', title: 'Only board' }]);
		assert.deepStrictEqual(overlay.messageSource, { kind: 'tool' });
	});

	test('usage numbers are copied when admitted and omitted when the summary left them out', () => {
		const snapshot: SessionViewSnapshot = {
			sessionId: 'ua-live' as SessionViewSnapshot['sessionId'],
			sync: { kind: 'live' },
			timeline: [
				{
					id: 'usage-full' as TimelineItemId,
					orderKey: '0001',
					summary: {
						kind: 'usage',
						title: 'Usage',
						inputTokens: 12,
						outputTokens: 34,
						contextPct: 50,
					},
				},
				{
					id: 'usage-zero' as TimelineItemId,
					orderKey: '0002',
					summary: {
						kind: 'usage',
						title: 'Usage zero',
						outputTokens: 0,
					},
				},
				{
					id: 'usage-bare' as TimelineItemId,
					orderKey: '0003',
					summary: {
						kind: 'usage',
						title: 'Usage bare',
					},
				},
				{
					id: 'usage-nan' as TimelineItemId,
					orderKey: '0004',
					summary: {
						kind: 'usage',
						title: 'Usage nan',
						inputTokens: Number.NaN,
						outputTokens: Number.POSITIVE_INFINITY,
						contextPct: 10,
					},
				},
			],
			overlay: { blocks: [] },
			pendingActions: [],
			localPendingSends: [],
		};

		const records = projectSnapshotToTrajectory(snapshot, new Map(), new Map());
		const full = records.find(record => record.id === 'usage-full');
		assert.deepStrictEqual(full, {
			id: 'usage-full',
			kind: 'context',
			text: 'Usage',
			messageSource: { kind: 'usage' },
			inputTokens: 12,
			outputTokens: 34,
			contextPct: 50,
		});
		assert.ok(getTrajectoryRecordSearchHaystack(full!).includes('input tokens: 12'));
		assert.ok(getTrajectoryRecordSearchHaystack(full!).includes('context: 50'));

		const zero = records.find(record => record.id === 'usage-zero');
		assert.strictEqual(zero?.outputTokens, 0);
		assert.ok(zero && !('inputTokens' in zero));
		assert.ok(zero && !('contextPct' in zero));

		const bare = records.find(record => record.id === 'usage-bare');
		assert.ok(bare);
		assert.strictEqual(bare.kind, 'context');
		assert.ok(!('inputTokens' in bare));
		assert.ok(!('outputTokens' in bare));
		assert.ok(!('contextPct' in bare));
		assert.ok(!getTrajectoryRecordSearchHaystack(bare).includes('input tokens'));
		assert.ok(!getTrajectoryRecordSearchHaystack(bare).includes('context:'));

		const nan = records.find(record => record.id === 'usage-nan');
		assert.strictEqual(nan?.contextPct, 10);
		assert.ok(nan && !('inputTokens' in nan));
		assert.ok(nan && !('outputTokens' in nan));
	});
});
