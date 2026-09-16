/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentStopLoopResult } from '../../common/universeAgentTypes.js';
import {
	decodeStopLoopResponse,
	encodeStopLoopRequest,
	type StopLoopResponseWire,
} from '../../node/grpc/grpcStopLoopUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService StopLoop protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeStopLoopRequest writes session_id=1 agent_id=2 detail=3; omits empty; not JSON', () => {
		const encoded = encodeStopLoopRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			detail: 'user_stop',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			agent_id: 'root',
			detail: 'user_stop',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'root',
			3: 'user_stop',
		});
		assert.ok(!protoStrings(encoded).has(4));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));
		assert.ok(!protoVarints(encoded).has(3));

		const noDetail = encodeStopLoopRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			detail: '',
		});
		assert.strictEqual(protoStrings(noDetail).get(1), 'sess-1');
		assert.strictEqual(protoStrings(noDetail).get(2), 'root');
		assert.ok(!protoStrings(noDetail).has(3));
		assert.notStrictEqual(noDetail[0], 0x7b);

		const detailOnly = encodeStopLoopRequest({
			sessionId: '',
			agentId: '',
			detail: 'user_stop',
		});
		assert.ok(!protoStrings(detailOnly).has(1));
		assert.ok(!protoStrings(detailOnly).has(2));
		assert.strictEqual(protoStrings(detailOnly).get(3), 'user_stop');
		assert.notStrictEqual(detailOnly[0], 0x7b);

		const noAgent = encodeStopLoopRequest({
			sessionId: 'sess-1',
			agentId: '',
			detail: 'user_stop',
		});
		assert.strictEqual(protoStrings(noAgent).get(1), 'sess-1');
		assert.ok(!protoStrings(noAgent).has(2));
		assert.strictEqual(protoStrings(noAgent).get(3), 'user_stop');

		assert.strictEqual(encodeStopLoopRequest({
			sessionId: '',
			agentId: '',
			detail: '',
		}).length, 0);
	});

	test('decodeStopLoopResponse reads success=1 message=2; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'stopped'),
			encodeStringField(3, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeStopLoopResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'stopped',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapStopLoop(wire), {
			ok: true,
			message: 'stopped',
		});

		const empty = decodeStopLoopResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
		});
		assert.deepStrictEqual(mapStopLoop(empty), {
			ok: false,
			message: undefined,
		});
	});

	test('stopLoop unary wire is AgentService.StopLoop only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcStopLoopUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeStopLoopRequest\b/.test(source));
		assert.ok(/\bdecodeStopLoopResponse\b/.test(source));
		assert.ok(/\bUniverseAgentStopLoopRequest\b/.test(source));
		assert.ok(/\bencodeStringField\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('stopLoop still JSON unary; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const stop = extractAsyncMethod(source, 'stopLoop');
		assert.ok(stop.includes('makeUnaryClient<'), 'stopLoop still uses JSON makeUnaryClient');
		assert.ok(!stop.includes('makeUnaryBytesClient'), 'stopLoop must not use makeUnaryBytesClient this slice');
		assert.ok(!stop.includes('encodeStopLoopRequest'), 'stopLoop must not call encodeStopLoopRequest this slice');
		assert.ok(!stop.includes('decodeStopLoopResponse'), 'stopLoop must not call decodeStopLoopResponse this slice');
		assert.ok(stop.includes('session_id'), 'stopLoop still sends session_id JSON key');
		assert.ok(stop.includes('agent_id'), 'stopLoop still sends agent_id JSON key');
		assert.ok(stop.includes('detail'), 'stopLoop still sends detail JSON key');
		assert.ok(stop.includes('wire.success === true'), 'stopLoop still maps success');
		assert.ok(!source.includes('grpcStopLoopUnaryWire'));

		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
	});
});

/** Same mapping as Agent.StopLoop JSON unary (`ok: wire.success === true`). */
function mapStopLoop(wire: StopLoopResponseWire): UniverseAgentStopLoopResult {
	return {
		ok: wire.success === true,
		message: wire.message,
	};
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcStopLoopUnaryWire.ts')));
	assert.ok(dir, 'grpcStopLoopUnaryWire.ts not found from cwd or import.meta');
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
