/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { FileMutationJoin } from '../../node/fileMutationJoin.js';
import { decodeSessionStreamEvent } from '../../node/grpc/grpcSessionAttachWire.js';
import { encodeMessageField, encodeStringField } from '../../node/grpc/grpcProtoCodec.js';

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

	test('turn_completed invokes onTurnSettle when runtime and assistant ids present', () => {
		const join = new FileMutationJoin('sess-settle');
		const settled: unknown[] = [];
		join.handleStreamPayload({
			turn_completed: { turn_id: 'runtime-1', assistant_turn_id: 'assistant-1' },
		}, () => { }, signal => settled.push(signal));

		assert.deepStrictEqual(settled, [{ runtimeTurnId: 'runtime-1', assistantTurnId: 'assistant-1' }]);
	});

	test('lifecycle without turn_completed does not invoke onTurnSettle', () => {
		const join = new FileMutationJoin('sess-no-settle');
		const settled: unknown[] = [];
		join.handleStreamPayload({
			tool_call_lifecycle: { tool_call_id: 'tc', turn_id: 'turn-1', agent_id: 'agent' },
		}, () => { }, signal => settled.push(signal));

		assert.strictEqual(settled.length, 0);
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

	test('history envelope file_mutation emits without lifecycle join', () => {
		const join = new FileMutationJoin('sess-hist');
		const emitted: unknown[] = [];
		join.handleHistoryPayload({
			id: 'env-1',
			turn_id: 'turn-h',
			agent_id: 'agent-h',
			blocks: [{
				tool_call_block: {
					tool_call_id: 'tc-h',
					tool_name: 'edit_file',
					arguments_json: '{"path":"/guessed/from/args.ts"}',
					file_mutation: { path: 'src/hist.ts', operation: 'edit' },
				},
			}],
		}, record => emitted.push(record));

		assert.strictEqual(emitted.length, 1);
		assert.deepStrictEqual(emitted[0], {
			sessionId: 'sess-hist',
			toolCallId: 'tc-h',
			turnId: 'turn-h',
			agentId: 'agent-h',
			path: 'src/hist.ts',
			operation: 'edit',
		});
	});

	test('history envelope without file_mutation does not parse arguments_json', () => {
		const join = new FileMutationJoin('sess-hist-args');
		const emitted: unknown[] = [];
		join.handleHistoryPayload({
			id: 'env-2',
			turn_id: 'turn-h',
			agent_id: 'agent-h',
			blocks: [{
				tool_call_block: {
					tool_call_id: 'tc-args',
					arguments_json: '{"path":"/guessed/from/args.ts"}',
				},
			}],
		}, record => emitted.push(record));
		assert.strictEqual(emitted.length, 0);
	});

	test('history envelope skips when turn_id or agent_id is missing', () => {
		const join = new FileMutationJoin('sess-hist-skip');
		const emitted: unknown[] = [];
		const mutation = {
			blocks: [{
				tool_call_block: {
					tool_call_id: 'tc-skip',
					file_mutation: { path: 'x.ts', operation: 'edit' },
				},
			}],
		};
		join.handleHistoryPayload({ ...mutation, agent_id: 'agent-h' }, record => emitted.push(record));
		join.handleHistoryPayload({ ...mutation, turn_id: 'turn-h' }, record => emitted.push(record));
		assert.strictEqual(emitted.length, 0);
	});

	test('history payload wrapped as envelope_appended still emits', () => {
		const join = new FileMutationJoin('sess-hist-wrap');
		const emitted: unknown[] = [];
		join.handleHistoryPayload({
			envelope_appended: {
				envelope: {
					turn_id: 'turn-w',
					agent_id: 'agent-w',
					blocks: [{
						tool_call_block: {
							tool_call_id: 'tc-w',
							file_mutation: { path: 'wrap.ts', operation: 'create' },
						},
					}],
				},
			},
		}, record => emitted.push(record));
		assert.strictEqual(emitted.length, 1);
		assert.strictEqual((emitted[0] as { path: string }).path, 'wrap.ts');
	});

	test('root file_mutation_payload without a payload wrapper emits after lifecycle', () => {
		const join = new FileMutationJoin('sess-root');
		const emitted: unknown[] = [];
		const onRecord = (record: unknown) => emitted.push(record);
		join.handleStreamPayload({
			tool_call_lifecycle: {
				tool_call_id: 'tc-root',
				turn_id: 'turn-root',
				agent_id: 'agent-root',
			},
		}, onRecord);
		join.handleStreamPayload({
			tool_runtime_snapshot: {
				tool_call_id: 'tc-root',
				file_mutation_payload: { path: 'root.ts', operation: 'create' },
			},
		}, onRecord);
		assert.deepStrictEqual(emitted, [{
			sessionId: 'sess-root',
			toolCallId: 'tc-root',
			turnId: 'turn-root',
			agentId: 'agent-root',
			path: 'root.ts',
			operation: 'create',
		}]);
	});

	test('bytes 32 then 44 tool_runtime_snapshots root field 23 emit one record', () => {
		const lifecycle = decodeSessionStreamEvent(Buffer.concat([
			encodeStringField(1, 'sess-bytes'),
			encodeMessageField(32, Buffer.concat([
				encodeStringField(2, 'turn-bytes'),
				encodeStringField(3, 'tc-bytes'),
				encodeStringField(4, 'agent-bytes'),
			])),
		]));
		const overlay = decodeSessionStreamEvent(Buffer.concat([
			encodeStringField(1, 'sess-bytes'),
			encodeMessageField(44, encodeMessageField(7, Buffer.concat([
				encodeStringField(2, 'tc-bytes'),
				encodeMessageField(23, Buffer.concat([
					encodeStringField(2, 'src/bytes.ts'),
					encodeStringField(3, 'edit'),
				])),
			]))),
		]));
		const join = new FileMutationJoin('sess-bytes');
		const emitted: unknown[] = [];
		join.handleStreamPayload(lifecycle.payload, record => emitted.push(record));
		assert.strictEqual(emitted.length, 0);
		join.handleStreamPayload(overlay.payload, record => emitted.push(record));
		assert.deepStrictEqual(emitted, [{
			sessionId: 'sess-bytes',
			toolCallId: 'tc-bytes',
			turnId: 'turn-bytes',
			agentId: 'agent-bytes',
			path: 'src/bytes.ts',
			operation: 'edit',
		}]);
	});

	test('bytes 44 then 32 still emits; 44 alone does not', () => {
		const overlayBytes = Buffer.concat([
			encodeStringField(1, 'sess-rev'),
			encodeMessageField(44, encodeMessageField(7, Buffer.concat([
				encodeStringField(2, 'tc-rev'),
				encodeMessageField(23, Buffer.concat([
					encodeStringField(2, 'rev.ts'),
					encodeStringField(3, 'create'),
				])),
			]))),
		]);
		const lifecycleBytes = Buffer.concat([
			encodeStringField(1, 'sess-rev'),
			encodeMessageField(32, Buffer.concat([
				encodeStringField(2, 'turn-rev'),
				encodeStringField(3, 'tc-rev'),
				encodeStringField(4, 'agent-rev'),
			])),
		]);
		const alone = new FileMutationJoin('sess-rev');
		const aloneEmitted: unknown[] = [];
		alone.handleStreamPayload(decodeSessionStreamEvent(overlayBytes).payload, record => aloneEmitted.push(record));
		assert.strictEqual(aloneEmitted.length, 0);

		const join = new FileMutationJoin('sess-rev');
		const emitted: unknown[] = [];
		join.handleStreamPayload(decodeSessionStreamEvent(overlayBytes).payload, record => emitted.push(record));
		join.handleStreamPayload(decodeSessionStreamEvent(lifecycleBytes).payload, record => emitted.push(record));
		assert.deepStrictEqual(emitted, [{
			sessionId: 'sess-rev',
			toolCallId: 'tc-rev',
			turnId: 'turn-rev',
			agentId: 'agent-rev',
			path: 'rev.ts',
			operation: 'create',
		}]);
	});

	test('bytes nested turn_lifecycle.turn_completed reaches onTurnSettle', () => {
		const decoded = decodeSessionStreamEvent(Buffer.concat([
			encodeStringField(1, 'sess-nested'),
			encodeMessageField(37, encodeMessageField(11, Buffer.concat([
				encodeStringField(1, 'runtime-nested'),
				encodeStringField(13, 'assistant-nested'),
			]))),
		]));
		const lifecycle = (decoded.payload as { turn_lifecycle?: { turn_completed?: { turn_id?: string } } }).turn_lifecycle;
		assert.strictEqual(lifecycle?.turn_completed?.turn_id, 'runtime-nested');
		const settled: unknown[] = [];
		const join = new FileMutationJoin('sess-nested');
		join.handleStreamPayload(decoded.payload, () => { }, signal => settled.push(signal));
		assert.deepStrictEqual(settled, [{
			runtimeTurnId: 'runtime-nested',
			assistantTurnId: 'assistant-nested',
		}]);
	});
});
