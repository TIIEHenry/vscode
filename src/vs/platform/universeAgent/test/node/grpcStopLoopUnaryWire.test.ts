/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
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
});

/** Same mapping as Agent.StopLoop JSON unary (`ok: wire.success === true`). */
function mapStopLoop(wire: StopLoopResponseWire): UniverseAgentStopLoopResult {
	return {
		ok: wire.success === true,
		message: wire.message,
	};
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
