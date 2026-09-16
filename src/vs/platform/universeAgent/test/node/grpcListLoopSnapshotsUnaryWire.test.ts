/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapListLoopSnapshotsResponse, mapLoopSnapshotRecord } from '../../node/grpc/grpcClientMappers.js';
import {
	decodeListLoopSnapshotsResponse,
	encodeListLoopSnapshotsRequest,
} from '../../node/grpc/grpcListLoopSnapshotsUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService ListLoopSnapshots protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeListLoopSnapshotsRequest writes session_id=1 optional loop_id=2; omits empty; not JSON', () => {
		const encoded = encodeListLoopSnapshotsRequest({
			sessionId: 'sess-1',
			loopId: 'loop-1',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			loop_id: 'loop-1',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'loop-1',
		});
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		const sessionOnly = encodeListLoopSnapshotsRequest({
			sessionId: 'sess-1',
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));
		assert.notStrictEqual(sessionOnly[0], 0x7b);

		const emptyLoop = encodeListLoopSnapshotsRequest({
			sessionId: 'sess-1',
			loopId: '',
		});
		assert.strictEqual(protoStrings(emptyLoop).get(1), 'sess-1');
		assert.ok(!protoStrings(emptyLoop).has(2));

		assert.strictEqual(encodeListLoopSnapshotsRequest({
			sessionId: '',
			loopId: '',
		}).length, 0);
	});

	test('decodeListLoopSnapshotsResponse reads snapshots=1 LoopSnapshotRecord 1-11; unused unread', () => {
		const record = Buffer.concat([
			encodeInt64Field(1, 1700000000),
			encodeStringField(2, 'turn-1'),
			encodeStringField(3, 'loop-1'),
			encodeInt32Field(4, 2),
			encodeInt32Field(5, 8),
			encodeStringField(6, 'finish'),
			encodeStringField(7, 'done'),
			encodeStringField(8, 'tmp/loop.md'),
			encodeInt32Field(9, 1),
			encodeStringField(10, 'supervisor'),
			encodeStringField(11, 'goal-met'),
			encodeStringField(12, 'unused-record'),
		]);
		const sparse = Buffer.concat([
			encodeStringField(2, 'turn-2'),
			encodeStringField(6, 'keep-going'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, record),
			encodeMessageField(1, sparse),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeListLoopSnapshotsResponse(encoded);
		assert.deepStrictEqual(wire, {
			snapshots: [
				{
					timestamp: 1700000000,
					turn_id: 'turn-1',
					loop_id: 'loop-1',
					iteration: 2,
					max_iterations: 8,
					goal: 'finish',
					exit_condition: 'done',
					tmp_file_relative_path: 'tmp/loop.md',
					is_exit: true,
					self_supervise: 'supervisor',
					terminal_reason: 'goal-met',
				},
				{
					timestamp: undefined,
					turn_id: 'turn-2',
					loop_id: undefined,
					iteration: undefined,
					max_iterations: undefined,
					goal: 'keep-going',
					exit_condition: undefined,
					tmp_file_relative_path: undefined,
					is_exit: undefined,
					self_supervise: undefined,
					terminal_reason: undefined,
				},
			],
		});
		assert.ok(!('unused' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapLoopSnapshotRecord(wire.snapshots?.[0]), {
			timestamp: 1700000000,
			turnId: 'turn-1',
			loopId: 'loop-1',
			iteration: 2,
			maxIterations: 8,
			goal: 'finish',
			exitCondition: 'done',
			tmpFileRelativePath: 'tmp/loop.md',
			isExit: true,
			selfSupervise: 'supervisor',
			terminalReason: 'goal-met',
		});
		assert.deepStrictEqual(mapListLoopSnapshotsResponse(wire), {
			snapshots: [
				{
					timestamp: 1700000000,
					turnId: 'turn-1',
					loopId: 'loop-1',
					iteration: 2,
					maxIterations: 8,
					goal: 'finish',
					exitCondition: 'done',
					tmpFileRelativePath: 'tmp/loop.md',
					isExit: true,
					selfSupervise: 'supervisor',
					terminalReason: 'goal-met',
				},
				{
					timestamp: undefined,
					turnId: 'turn-2',
					loopId: '',
					iteration: undefined,
					maxIterations: undefined,
					goal: 'keep-going',
					exitCondition: '',
					tmpFileRelativePath: '',
					isExit: undefined,
					selfSupervise: undefined,
					terminalReason: undefined,
				},
			],
		});

		const omittedZeros = decodeListLoopSnapshotsResponse(encodeMessageField(1, encodeStringField(2, 'turn-3')));
		assert.deepStrictEqual(omittedZeros, {
			snapshots: [{
				timestamp: undefined,
				turn_id: 'turn-3',
				loop_id: undefined,
				iteration: undefined,
				max_iterations: undefined,
				goal: undefined,
				exit_condition: undefined,
				tmp_file_relative_path: undefined,
				is_exit: undefined,
				self_supervise: undefined,
				terminal_reason: undefined,
			}],
		});
		assert.deepStrictEqual(mapListLoopSnapshotsResponse(omittedZeros), {
			snapshots: [{
				timestamp: undefined,
				turnId: 'turn-3',
				loopId: '',
				iteration: undefined,
				maxIterations: undefined,
				goal: '',
				exitCondition: '',
				tmpFileRelativePath: '',
				isExit: undefined,
				selfSupervise: undefined,
				terminalReason: undefined,
			}],
		});

		const empty = decodeListLoopSnapshotsResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			snapshots: [],
		});
		assert.deepStrictEqual(mapListLoopSnapshotsResponse(empty), {
			snapshots: [],
		});
	});

	test('listLoopSnapshots unary wire is AgentService.ListLoopSnapshots only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcListLoopSnapshotsUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeListLoopSnapshotsRequest\b/.test(source));
		assert.ok(/\bdecodeListLoopSnapshotsResponse\b/.test(source));
		assert.ok(/\ballLengthDelimited\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('ONLY listLoopSnapshots still JSON unary; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const listLoop = extractAsyncMethod(source, 'listLoopSnapshots');
		assert.ok(listLoop.includes('makeUnaryClient<'), 'listLoopSnapshots still uses JSON makeUnaryClient');
		assert.ok(!listLoop.includes('makeUnaryBytesClient'), 'listLoopSnapshots must not use makeUnaryBytesClient this slice');
		assert.ok(!listLoop.includes('encodeListLoopSnapshotsRequest'), 'listLoopSnapshots must not call encodeListLoopSnapshotsRequest this slice');
		assert.ok(!listLoop.includes('decodeListLoopSnapshotsResponse'), 'listLoopSnapshots must not call decodeListLoopSnapshotsResponse this slice');
		assert.ok(listLoop.includes('mapListLoopSnapshotsResponse'), 'listLoopSnapshots still calls mapListLoopSnapshotsResponse');
		assert.ok(listLoop.includes('session_id'), 'listLoopSnapshots still sends session_id JSON key');
		assert.ok(listLoop.includes('loop_id'), 'listLoopSnapshots still sends loop_id JSON key');
		assert.ok(!source.includes('grpcListLoopSnapshotsUnaryWire'));

		for (const name of ['listSnapshots', 'createSnapshot', 'restoreSnapshot', 'deleteSnapshot'] as const) {
			const body = extractAsyncMethod(source, name);
			assert.ok(body.includes('makeUnaryBytesClient'), `${name} already bytes`);
			assert.ok(!body.includes('makeUnaryClient<'), `${name} must not still be JSON`);
		}

		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		const watchStart = source.indexOf('\topenWatchConfigStream(');
		assert.ok(watchStart >= 0, 'missing openWatchConfigStream(');
		const watchEnd = source.indexOf('\n\tasync ', watchStart + 1);
		const watchBody = source.slice(watchStart, watchEnd >= 0 ? watchEnd : source.length);
		assert.ok(watchBody.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!watchBody.includes('grpcListLoopSnapshotsUnaryWire'));
	});
});

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcListLoopSnapshotsUnaryWire.ts')));
	assert.ok(dir, 'grpcListLoopSnapshotsUnaryWire.ts not found from cwd or import.meta');
	return dir;
}

function extractAsyncMethod(source: string, name: string): string {
	const start = source.indexOf(`\tasync ${name}(`);
	assert.ok(start >= 0, `missing async ${name}(`);
	const nextAsync = source.indexOf('\n\tasync ', start + 1);
	const end = nextAsync >= 0 ? nextAsync : source.length;
	return source.slice(start, end);
}

function protoStrings(encoded: Uint8Array): Map<number, string> {
	const strings = new Map<number, string>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 2) {
			strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
		}
	}
	return strings;
}

function protoVarints(encoded: Uint8Array): Map<number, number> {
	const numbers = new Map<number, number>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 0) {
			numbers.set(field.field, Number(field.varint));
		}
	}
	return numbers;
}
