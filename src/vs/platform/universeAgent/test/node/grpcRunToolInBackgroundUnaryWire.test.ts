/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentRunToolInBackgroundResult } from '../../common/universeAgentTypes.js';
import {
	decodeRunToolInBackgroundResponse,
	encodeRunToolInBackgroundRequest,
	type RunToolInBackgroundResponseWire,
} from '../../node/grpc/grpcRunToolInBackgroundUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService RunToolInBackground protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeRunToolInBackgroundRequest writes session_id=1 agent_id=2 tool_call_id=3; omits empty; not JSON', () => {
		const encoded = encodeRunToolInBackgroundRequest({
			sessionId: 'sess-1',
			agentId: 'agent-9',
			toolCallId: 'tc-7',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			agent_id: 'agent-9',
			tool_call_id: 'tc-7',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'agent-9',
			3: 'tc-7',
		});
		assert.ok(!protoStrings(encoded).has(4));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));
		assert.ok(!protoVarints(encoded).has(3));

		const noTool = encodeRunToolInBackgroundRequest({
			sessionId: 'sess-1',
			agentId: 'agent-9',
			toolCallId: '',
		});
		assert.strictEqual(protoStrings(noTool).get(1), 'sess-1');
		assert.strictEqual(protoStrings(noTool).get(2), 'agent-9');
		assert.ok(!protoStrings(noTool).has(3));
		assert.notStrictEqual(noTool[0], 0x7b);

		const noAgent = encodeRunToolInBackgroundRequest({
			sessionId: 'sess-1',
			agentId: '',
			toolCallId: 'tc-7',
		});
		assert.strictEqual(protoStrings(noAgent).get(1), 'sess-1');
		assert.ok(!protoStrings(noAgent).has(2));
		assert.strictEqual(protoStrings(noAgent).get(3), 'tc-7');

		assert.strictEqual(encodeRunToolInBackgroundRequest({
			sessionId: '',
			agentId: '',
			toolCallId: '',
		}).length, 0);
	});

	test('decodeRunToolInBackgroundResponse reads success=1 message=2 reason_code=3; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'detached'),
			encodeStringField(3, 'OK'),
			encodeStringField(4, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeRunToolInBackgroundResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'detached',
			reason_code: 'OK',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapRunToolInBackground(wire), {
			ok: true,
			message: 'detached',
			reasonCode: 'OK',
		});

		const empty = decodeRunToolInBackgroundResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
			reason_code: undefined,
		});
		assert.deepStrictEqual(mapRunToolInBackground(empty), {
			ok: false,
			message: undefined,
			reasonCode: undefined,
		});
	});
});

/** Same mapping as Agent.RunToolInBackground JSON unary (`ok: wire.success === true`). */
function mapRunToolInBackground(wire: RunToolInBackgroundResponseWire): UniverseAgentRunToolInBackgroundResult {
	return {
		ok: wire.success === true,
		message: wire.message,
		reasonCode: wire.reason_code,
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
