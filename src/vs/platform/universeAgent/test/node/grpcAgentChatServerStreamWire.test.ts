/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { asUnaryProtoBytes, makeServerStreamBytesClient, makeServerStreamClient } from '../../node/grpc/grpcClientCalls.js';
import {
	encodeContinueGenerationRequest,
	encodeRegenerateRequest,
	encodeResumeRequest,
} from '../../node/grpc/grpcAgentChatServerStreamWire.js';
import { readProtoFields } from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService ContinueGeneration/Regenerate/Resume protobuf server-stream wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeContinueGenerationRequest writes session_id=1 agent_id=2 turn_id=3 message_id=4; omits empty; not JSON', () => {
		const encoded = encodeContinueGenerationRequest({
			sessionId: 'sess-1',
			agentId: 'agent-9',
			turnId: 'turn-3',
			messageId: 'msg-4',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			agent_id: 'agent-9',
			turn_id: 'turn-3',
			message_id: 'msg-4',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'agent-9',
			3: 'turn-3',
			4: 'msg-4',
		});
		assert.ok(!protoStrings(encoded).has(5));
		assert.ok(!protoVarints(encoded).has(1));

		const sessionOnly = encodeContinueGenerationRequest({
			sessionId: 'sess-1',
			agentId: '',
			turnId: '',
			messageId: '',
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));
		assert.ok(!protoStrings(sessionOnly).has(3));
		assert.ok(!protoStrings(sessionOnly).has(4));
		assert.notStrictEqual(sessionOnly[0], 0x7b);

		assert.strictEqual(encodeContinueGenerationRequest({
			sessionId: '',
			agentId: '',
			turnId: '',
			messageId: '',
		}).length, 0);
	});

	test('encodeRegenerateRequest shares ContinueGeneration layout; not JSON', () => {
		const request = {
			sessionId: 'sess-1',
			agentId: 'agent-9',
			turnId: 'turn-3',
			messageId: 'msg-4',
		};
		const encoded = encodeRegenerateRequest(request);
		assert.deepStrictEqual(Buffer.from(encoded), Buffer.from(encodeContinueGenerationRequest(request)));
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'agent-9',
			3: 'turn-3',
			4: 'msg-4',
		});

		assert.strictEqual(encodeRegenerateRequest({
			sessionId: '',
			agentId: '',
			turnId: '',
			messageId: '',
		}).length, 0);
	});

	test('encodeResumeRequest writes session_id=1 agent_id=2; omits empty; not JSON', () => {
		const encoded = encodeResumeRequest({
			sessionId: 'sess-1',
			agentId: 'agent-9',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			agent_id: 'agent-9',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'agent-9',
		});
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));

		const sessionOnly = encodeResumeRequest({
			sessionId: 'sess-1',
			agentId: '',
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));

		assert.strictEqual(encodeResumeRequest({
			sessionId: '',
			agentId: '',
		}).length, 0);
	});

	test('makeServerStreamBytesClient serializes proto bytes; makeServerStreamClient stays JSON', () => {
		let bytesSerialize: ((value: Uint8Array | undefined) => Buffer) | undefined;
		let bytesDeserialize: ((buffer: Buffer) => { n: number }) | undefined;
		let bytesPayload: Uint8Array | undefined;
		const noopCall = { on(): void { }, cancel(): void { } };
		const bytesStream = makeServerStreamBytesClient<{ n: number }>(
			{
				makeServerStreamRequest(_path: string, ser: (v: Uint8Array | undefined) => Buffer, deser: (b: Buffer) => { n: number }, req: Uint8Array) {
					bytesSerialize = ser;
					bytesDeserialize = deser;
					bytesPayload = req;
					return noopCall;
				},
			} as never,
			'agentservice.AgentService',
			'ContinueGeneration',
			buffer => ({ n: buffer[0] ?? 0 }),
		);
		const reqBytes = encodeContinueGenerationRequest({ sessionId: 'sess-1' });
		const sub1 = bytesStream(reqBytes, () => { });
		sub1.dispose();
		assert.strictEqual(bytesSerialize, asUnaryProtoBytes);
		assert.deepStrictEqual(bytesPayload, reqBytes);
		assert.deepStrictEqual(bytesDeserialize?.(Buffer.from([7])), { n: 7 });

		let jsonSerialize: ((value: { a: number }) => Buffer) | undefined;
		const jsonStream = makeServerStreamClient<{ a: number }, { ok: boolean }>(
			{
				makeServerStreamRequest(_path: string, ser: (v: { a: number }) => Buffer) {
					jsonSerialize = ser;
					return noopCall;
				},
			} as never,
			'agentservice.AgentService',
			'Legacy',
		);
		const sub2 = jsonStream({ a: 1 }, () => { });
		sub2.dispose();
		assert.strictEqual(jsonSerialize?.({ a: 1 }).toString('utf8'), JSON.stringify({ a: 1 }));
	});
});

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
