/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { FileMutationJoin } from '../../node/fileMutationJoin.js';

suite('FileMutationJoin', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('lifecycle + snapshot → one complete record', () => {
		const join = new FileMutationJoin('sess-1');
		const emitted: unknown[] = [];
		const onRecord = (record: unknown) => emitted.push(record);

		join.handleStreamPayload({
			tool_call_lifecycle: {
				tool_call_id: 'tc-1',
				turn_id: 'turn-runtime',
				agent_id: 'agent-a',
			},
		}, onRecord);

		join.handleStreamPayload({
			tool_runtime_snapshot: {
				tool_call_id: 'tc-1',
				payload: {
					file_mutation_payload: {
						path: 'src/foo.ts',
						operation: 'edit',
					},
				},
			},
		}, onRecord);

		assert.strictEqual(emitted.length, 1);
		assert.deepStrictEqual(emitted[0], {
			sessionId: 'sess-1',
			toolCallId: 'tc-1',
			turnId: 'turn-runtime',
			agentId: 'agent-a',
			path: 'src/foo.ts',
			operation: 'edit',
		});
	});

	test('snapshot before lifecycle → pending then emit', () => {
		const join = new FileMutationJoin('sess-2');
		const emitted: unknown[] = [];
		const onRecord = (record: unknown) => emitted.push(record);

		join.handleStreamPayload({
			tool_runtime_snapshot: {
				tool_call_id: 'tc-2',
				payload: {
					file_mutation_payload: {
						path: 'bar.ts',
						operation: 'create',
					},
				},
			},
		}, onRecord);
		assert.strictEqual(emitted.length, 0);

		join.handleStreamPayload({
			tool_call_lifecycle: {
				tool_call_id: 'tc-2',
				turn_id: 'turn-2',
				agent_id: 'agent-b',
			},
		}, onRecord);

		assert.strictEqual(emitted.length, 1);
		assert.strictEqual((emitted[0] as { turnId: string }).turnId, 'turn-2');
	});

	test('turn_completed settles turnId to assistant_turn_id', () => {
		const join = new FileMutationJoin('sess-3');
		const emitted: unknown[] = [];
		const onRecord = (record: unknown) => emitted.push(record);

		join.handleStreamPayload({
			tool_call_lifecycle: {
				tool_call_id: 'tc-3',
				turn_id: 'runtime-turn',
				agent_id: 'agent-c',
			},
		}, onRecord);
		join.handleStreamPayload({
			tool_runtime_snapshot: {
				tool_call_id: 'tc-3',
				payload: {
					file_mutation_payload: { path: 'x.ts', operation: 'edit' },
				},
			},
		}, onRecord);
		assert.strictEqual((emitted[0] as { turnId: string }).turnId, 'runtime-turn');

		join.handleStreamPayload({
			turn_completed: { turn_id: 'runtime-turn', assistant_turn_id: 'assistant-turn-3' },
		}, onRecord);

		assert.strictEqual((emitted[emitted.length - 1] as { turnId: string }).turnId, 'assistant-turn-3');
	});

	test('reseed overlay snapshots dedupe by toolCallId+path+operation', () => {
		const join = new FileMutationJoin('sess-4');
		const emitted: unknown[] = [];
		const onRecord = (record: unknown) => emitted.push(record);

		join.handleStreamPayload({
			tool_call_lifecycle: {
				tool_call_id: 'tc-4',
				turn_id: 'turn-4',
				agent_id: 'agent-d',
			},
		}, onRecord);

		const overlay = {
			runtime_overlay_snapshot: {
				tool_runtime_snapshots: [{
					tool_call_id: 'tc-4',
					payload: { file_mutation_payload: { path: 'a.ts', operation: 'edit' } },
				}],
			},
		};
		join.handleStreamPayload(overlay, onRecord);
		join.handleStreamPayload(overlay, onRecord);

		assert.strictEqual(emitted.length, 1);
	});
});
