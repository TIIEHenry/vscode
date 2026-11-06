/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentSendShellSessionClientControlResult } from '../../common/universeAgentTypes.js';
import {
	decodeSendShellSessionClientControlResponse,
	encodeSendShellSessionClientControlRequest,
	type SendShellSessionClientControlResponseWire,
} from '../../node/grpc/grpcSendShellSessionClientControlUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService SendShellSessionClientControl protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeSendShellSessionClientControlRequest writes session_id=1 tool_call_id=2 ref_id=3 control_payload_json=4; omits empty; not JSON', () => {
		const encoded = encodeSendShellSessionClientControlRequest({
			sessionId: 'sess-1',
			toolCallId: 'tc-7',
			refId: 'shell-3',
			controlPayloadJson: '{"op":"resize"}',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			tool_call_id: 'tc-7',
			ref_id: 'shell-3',
			control_payload_json: '{"op":"resize"}',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'tc-7',
			3: 'shell-3',
			4: '{"op":"resize"}',
		});
		assert.ok(!protoStrings(encoded).has(5));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));
		assert.ok(!protoVarints(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(4));

		const sessionOnly = encodeSendShellSessionClientControlRequest({
			sessionId: 'sess-1',
			toolCallId: '',
			refId: '',
			controlPayloadJson: '',
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));
		assert.ok(!protoStrings(sessionOnly).has(3));
		assert.ok(!protoStrings(sessionOnly).has(4));
		assert.notStrictEqual(sessionOnly[0], 0x7b);

		const noRef = encodeSendShellSessionClientControlRequest({
			sessionId: 'sess-1',
			toolCallId: 'tc-7',
			refId: '',
			controlPayloadJson: '{"op":"detach"}',
		});
		assert.strictEqual(protoStrings(noRef).get(1), 'sess-1');
		assert.strictEqual(protoStrings(noRef).get(2), 'tc-7');
		assert.ok(!protoStrings(noRef).has(3));
		assert.strictEqual(protoStrings(noRef).get(4), '{"op":"detach"}');

		assert.strictEqual(encodeSendShellSessionClientControlRequest({
			sessionId: '',
			toolCallId: '',
			refId: '',
			controlPayloadJson: '',
		}).length, 0);
	});

	test('decodeSendShellSessionClientControlResponse reads success=1 error_message=2 error_code=3 debounced=4 delivered_to_subscribe=5; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'dropped'),
			encodeStringField(3, 'BUSY'),
			encodeInt32Field(4, 1),
			encodeInt32Field(5, 1),
			encodeStringField(6, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeSendShellSessionClientControlResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			error_message: 'dropped',
			error_code: 'BUSY',
			debounced: true,
			delivered_to_subscribe: true,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapSendShellSessionClientControl(wire), {
			ok: true,
			message: 'dropped',
			errorCode: 'BUSY',
			debounced: true,
			deliveredToSubscribe: true,
		});

		const omittedFalse = decodeSendShellSessionClientControlResponse(Buffer.concat([
			encodeStringField(2, 'denied'),
			encodeStringField(3, 'FORBIDDEN'),
		]));
		assert.deepStrictEqual(omittedFalse, {
			success: undefined,
			error_message: 'denied',
			error_code: 'FORBIDDEN',
			debounced: undefined,
			delivered_to_subscribe: undefined,
		});
		assert.deepStrictEqual(mapSendShellSessionClientControl(omittedFalse), {
			ok: false,
			message: 'denied',
			errorCode: 'FORBIDDEN',
			debounced: undefined,
			deliveredToSubscribe: undefined,
		});

		const empty = decodeSendShellSessionClientControlResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			error_message: undefined,
			error_code: undefined,
			debounced: undefined,
			delivered_to_subscribe: undefined,
		});
		assert.deepStrictEqual(mapSendShellSessionClientControl(empty), {
			ok: false,
			message: undefined,
			errorCode: undefined,
			debounced: undefined,
			deliveredToSubscribe: undefined,
		});
	});
});

/** Same mapping as Agent.SendShellSessionClientControl JSON unary (`ok: wire.success === true`). */
function mapSendShellSessionClientControl(wire: SendShellSessionClientControlResponseWire): UniverseAgentSendShellSessionClientControlResult {
	return {
		ok: wire.success === true,
		message: wire.error_message,
		errorCode: wire.error_code,
		debounced: wire.debounced,
		deliveredToSubscribe: wire.delivered_to_subscribe,
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
