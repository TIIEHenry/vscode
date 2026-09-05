/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { CONNECT_WIRE_PROTOCOL } from '../../node/grpc/grpcHandshakeWire.js';
import {
	HISTORY_DIRECTION_FORWARD_AFTER,
	decodeChatResponse,
	decodeCreateSessionResponse,
	decodeGetHistoryResponse,
	decodeResumeSessionResponse,
	decodeSessionStreamEvent,
	encodeChatRequest,
	encodeCreateSessionRequest,
	encodeGetHistoryRequest,
	encodeResumeSessionRequest,
	encodeSessionStreamHandshake,
} from '../../node/grpc/grpcSessionAttachWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodePresentMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc first-send / attach protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeCreateSessionRequest writes model field 3, not title JSON', () => {
		const encoded = encodeCreateSessionRequest({ title: 'New session', model: 'gpt-test' });
		assert.notStrictEqual(encoded[0], 0x7b, 'must not start with JSON {');
		const fields = readProtoFields(encoded);
		assert.strictEqual(fields.length, 1);
		assert.strictEqual(fields[0].field, 3);
		assert.strictEqual(Buffer.from(fields[0].wireType === 2 ? fields[0].bytes : []).toString('utf8'), 'gpt-test');
	});

	test('decodeCreateSessionResponse reads session_id field 1', () => {
		const decoded = decodeCreateSessionResponse(encodeStringField(1, 'sess-9'));
		assert.strictEqual(decoded.sessionId, 'sess-9');
	});

	test('encodeResumeSessionRequest writes session_id field 1', () => {
		const encoded = encodeResumeSessionRequest({ sessionId: 'sess-1' });
		assert.notStrictEqual(encoded[0], 0x7b);
		const fields = readProtoFields(encoded);
		assert.strictEqual(Buffer.from(fields[0].wireType === 2 ? fields[0].bytes : []).toString('utf8'), 'sess-1');
	});

	test('decodeResumeSessionResponse maps success varint', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'ok'),
		]);
		const decoded = decodeResumeSessionResponse(encoded);
		assert.strictEqual(decoded.ok, true);
		assert.strictEqual(decoded.message, 'ok');
	});

	test('encodeGetHistoryRequest uses page_size + FORWARD_AFTER, not JSON limit', () => {
		const encoded = encodeGetHistoryRequest({
			sessionId: 'sess-1',
			cursorSeq: '12',
			limit: 100,
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		const fields = readProtoFields(encoded);
		const numbers = new Map<number, number>();
		let sessionId = '';
		for (const field of fields) {
			if (field.wireType === 0) {
				numbers.set(field.field, Number(field.varint));
			}
			if (field.field === 1 && field.wireType === 2) {
				sessionId = Buffer.from(field.bytes).toString('utf8');
			}
		}
		assert.strictEqual(sessionId, 'sess-1');
		assert.strictEqual(numbers.get(2), 12);
		assert.strictEqual(numbers.get(3), HISTORY_DIRECTION_FORWARD_AFTER);
		assert.strictEqual(numbers.get(4), 100);
	});

	test('decodeGetHistoryResponse maps envelope seq to cursorSeq', () => {
		const envelope = Buffer.concat([
			encodeStringField(1, 'env-1'),
			encodeInt64Field(3, 7),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, envelope),
			encodeInt32Field(4, 1),
		]);
		const decoded = decodeGetHistoryResponse(encoded);
		assert.strictEqual(decoded.envelopes.length, 1);
		assert.strictEqual(decoded.envelopes[0].cursorSeq, '7');
		assert.strictEqual((decoded.envelopes[0].payload as { id?: string }).id, 'env-1');
		assert.strictEqual(decoded.nextCursorSeq, '7');
	});

	test('encodeSessionStreamHandshake writes protocol 2.0, not JSON session_id', () => {
		const encoded = encodeSessionStreamHandshake('sess-1');
		assert.notStrictEqual(encoded[0], 0x7b);
		const fields = readProtoFields(encoded);
		const numbers = new Map<number, number>();
		let sessionId = '';
		for (const field of fields) {
			if (field.wireType === 0) {
				numbers.set(field.field, Number(field.varint));
			}
			if (field.field === 1 && field.wireType === 2) {
				sessionId = Buffer.from(field.bytes).toString('utf8');
			}
		}
		assert.strictEqual(sessionId, 'sess-1');
		assert.strictEqual(numbers.get(3), CONNECT_WIRE_PROTOCOL.protocolMajor);
		assert.strictEqual(numbers.get(4) ?? 0, CONNECT_WIRE_PROTOCOL.protocolMinor);
	});

	test('decodeSessionStreamEvent maps hello arm for HistoryFill', () => {
		const hello = Buffer.concat([
			encodeInt64Field(1, 3),
			encodeInt64Field(2, 8),
			encodeInt64Field(3, 1),
			encodeInt64Field(4, 0),
		]);
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeMessageField(10, hello),
		]);
		const decoded = decodeSessionStreamEvent(encoded);
		const payload = decoded.payload as { hello?: { session_version?: number; head_seq?: number } };
		assert.strictEqual((decoded.payload as { session_id?: string }).session_id, 'sess-1');
		assert.strictEqual(payload.hello?.session_version, 3);
		assert.strictEqual(payload.hello?.head_seq, 8);
	});

	test('encodeChatRequest writes session_input oneof, not JSON payload wrapper', () => {
		const encoded = encodeChatRequest('sess-1', {
			agentId: 'root',
			messageId: 'msg-1',
			text: 'ping from debug agent',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		const fields = readProtoFields(encoded);
		let sessionInput: Uint8Array | undefined;
		for (const field of fields) {
			if (field.field === 30 && field.wireType === 2) {
				sessionInput = field.bytes;
			}
		}
		assert.ok(sessionInput);
		const inputFields = readProtoFields(sessionInput);
		assert.strictEqual(Buffer.from(inputFields[0].wireType === 2 ? inputFields[0].bytes : []).toString('utf8'), 'msg-1');
		assert.strictEqual(Buffer.from(inputFields[1].wireType === 2 ? inputFields[1].bytes : []).toString('utf8'), 'ping from debug agent');
	});

	test('encodeChatRequest heartbeat_ack is present even when empty', () => {
		const encoded = encodeChatRequest('sess-1', { heartbeat_ack: {} });
		const fields = readProtoFields(encoded);
		assert.ok(fields.some(field => field.field === 12 && field.wireType === 2));
		assert.ok(!fields.some(field => field.field === 30));
	});

	test('decodeChatResponse reads session_id without JSON.parse', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeStringField(2, 'root'),
		]);
		const decoded = decodeChatResponse(encoded);
		assert.strictEqual((decoded.payload as { session_id?: string }).session_id, 'sess-1');
	});

	test('encodePresentMessageField keeps empty oneof arm', () => {
		const encoded = encodePresentMessageField(12, new Uint8Array(0));
		const fields = readProtoFields(encoded);
		assert.strictEqual(fields.length, 1);
		assert.strictEqual(fields[0].field, 12);
		assert.strictEqual(fields[0].wireType, 2);
		assert.strictEqual(fields[0].wireType === 2 ? fields[0].bytes.length : -1, 0);
	});
});
