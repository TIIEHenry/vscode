/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	mapChatSyncResponse,
	mapSyncInputDeliveryResponse,
} from '../../node/grpc/grpcClientMappers.js';
import {
	decodeChatSyncResponse,
	decodeSyncInputDeliveryResponse,
	encodeChatSyncRequest,
	encodeSyncInputDeliveryRequest,
} from '../../node/grpc/grpcChatSyncUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc ChatSync / SyncInputDelivery protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeChatSyncRequest writes 1-6; omits empty/0; not JSON', () => {
		const encoded = encodeChatSyncRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			timeoutSeconds: 300,
			lastKnownMessageIds: ['m-1', 'm-2'],
			idempotencyKey: 'idemp-1',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.strictEqual(protoStrings(encoded).get(2), 'root');
		assert.ok(!protoNested(encoded, 3));
		assert.strictEqual(protoVarints(encoded).get(4), 300);
		assert.deepStrictEqual(protoRepeatedStrings(encoded, 5), ['m-1', 'm-2']);
		assert.strictEqual(protoStrings(encoded).get(6), 'idemp-1');
		const empty = encodeChatSyncRequest({
			sessionId: '',
			agentId: '',
			timeoutSeconds: 0,
			lastKnownMessageIds: [],
			idempotencyKey: '',
		});
		assert.strictEqual(empty.length, 0);
		assert.ok(!protoVarints(empty).has(4));
		assert.deepStrictEqual(protoRepeatedStrings(empty, 5), []);
	});

	test('encodeChatSyncRequest nested session_input=3; SessionInput 1-2/4-13; attachments=3 absent', () => {
		const encoded = encodeChatSyncRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			sessionInput: {
				messageId: 'm-new',
				text: 'hi',
				delivery: 1,
				modelProfileId: 'prof-1',
				systemPrompt: 'sys',
				memoryEnabled: true,
				thinkingEnabled: true,
				replyToId: 'm-prev',
				operationId: 'op-1',
				skillName: 'deploy',
				skillScope: 'USER',
				skillCommandText: '/deploy args',
			},
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		const nested = protoNested(encoded, 3);
		assert.ok(nested);
		assert.strictEqual(protoStrings(nested).get(1), 'm-new');
		assert.strictEqual(protoStrings(nested).get(2), 'hi');
		assert.ok(!protoNested(nested, 3), 'TS has no attachments; field 3 omitted');
		assert.deepStrictEqual(protoRepeatedMessages(nested, 3), []);
		assert.strictEqual(protoVarints(nested).get(4), 1);
		assert.strictEqual(protoStrings(nested).get(5), 'prof-1');
		assert.strictEqual(protoStrings(nested).get(6), 'sys');
		assert.strictEqual(protoVarints(nested).get(7), 1);
		assert.strictEqual(protoVarints(nested).get(8), 1);
		assert.strictEqual(protoStrings(nested).get(9), 'm-prev');
		assert.strictEqual(protoStrings(nested).get(10), 'op-1');
		assert.strictEqual(protoStrings(nested).get(11), 'deploy');
		assert.strictEqual(protoStrings(nested).get(12), 'USER');
		assert.strictEqual(protoStrings(nested).get(13), '/deploy args');
	});

	test('encodeChatSyncRequest maps delivery 1/2/3; omits 0 and unmapped', () => {
		assert.strictEqual(nestedVarint(encodeChatSyncRequest({
			sessionId: 's',
			agentId: 'a',
			sessionInput: { messageId: 'm', text: 't', delivery: 1 },
		}), 4), 1);
		assert.strictEqual(nestedVarint(encodeChatSyncRequest({
			sessionId: 's',
			agentId: 'a',
			sessionInput: { messageId: 'm', text: 't', delivery: 2 },
		}), 4), 2);
		assert.strictEqual(nestedVarint(encodeChatSyncRequest({
			sessionId: 's',
			agentId: 'a',
			sessionInput: { messageId: 'm', text: 't', delivery: 3 },
		}), 4), 3);
		const unspecified = encodeChatSyncRequest({
			sessionId: 's',
			agentId: 'a',
			sessionInput: { messageId: 'm', text: 't', delivery: 0 },
		});
		assert.ok(!protoVarints(mustNested(unspecified, 3)).has(4));
		const unmapped = encodeChatSyncRequest({
			sessionId: 's',
			agentId: 'a',
			sessionInput: { messageId: 'm', text: 't', delivery: 99 },
		});
		assert.ok(!protoVarints(mustNested(unmapped, 3)).has(4));
		const omitted = encodeChatSyncRequest({
			sessionId: 's',
			agentId: 'a',
			sessionInput: { messageId: 'm', text: 't' },
		});
		assert.ok(!protoVarints(mustNested(omitted, 3)).has(4));
	});

	test('encodeChatSyncRequest optional bool false writes varint0; undefined omits', () => {
		const explicitFalse = encodeChatSyncRequest({
			sessionId: '',
			agentId: '',
			sessionInput: {
				messageId: '',
				text: '',
				memoryEnabled: false,
				thinkingEnabled: false,
			},
		});
		assert.ok(explicitFalse.length > 0);
		assert.notStrictEqual(explicitFalse[0], 0x7b);
		const nestedFalse = mustNested(explicitFalse, 3);
		assert.strictEqual(protoVarints(nestedFalse).get(7), 0);
		assert.strictEqual(protoVarints(nestedFalse).get(8), 0);
		const omitted = encodeChatSyncRequest({
			sessionId: 's',
			agentId: 'a',
			sessionInput: { messageId: 'm', text: 't' },
		});
		const nestedOmit = mustNested(omitted, 3);
		assert.ok(!protoVarints(nestedOmit).has(7));
		assert.ok(!protoVarints(nestedOmit).has(8));
	});

	test('decodeChatSyncResponse reads 1-10; ToolResult 1-5; InputDelivery 1-4; unknown unread', () => {
		const tool = Buffer.concat([
			encodeStringField(1, 'tool-1'),
			encodeStringField(2, 'bash'),
			encodeInt32Field(3, 1),
			encodeStringField(4, 'boom'),
			encodeInt64Field(5, 42),
			encodeStringField(6, 'unused-tool'),
		]);
		const delivery = Buffer.concat([
			encodeStringField(1, 'm-1'),
			encodeInt32Field(2, 1),
			encodeStringField(3, 'overflow'),
			encodeStringField(4, 'full'),
			encodeStringField(5, 'unused-delivery'),
		]);
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeStringField(2, 'root'),
			encodeStringField(3, 'pong'),
			encodeStringField(4, 'end_turn'),
			encodeInt64Field(5, 11),
			encodeInt64Field(6, 22),
			encodeInt32Field(7, 3),
			encodeMessageField(8, tool),
			encodeStringField(9, 'err'),
			encodeMessageField(10, delivery),
			encodeStringField(11, 'unused-field'),
		]);
		const wire = decodeChatSyncResponse(encoded);
		assert.deepStrictEqual(wire, {
			session_id: 'sess-1',
			agent_id: 'root',
			text: 'pong',
			stop_reason: 'end_turn',
			input_tokens: 11,
			output_tokens: 22,
			turn_count: 3,
			tool_results: [{
				tool_id: 'tool-1',
				tool_name: 'bash',
				is_error: true,
				content: 'boom',
				duration_ms: 42,
			}],
			error: 'err',
			input_delivery_events: [{
				message_id: 'm-1',
				status: 1,
				error_code: 'overflow',
				error_message: 'full',
			}],
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapChatSyncResponse(wire), {
			sessionId: 'sess-1',
			agentId: 'root',
			text: 'pong',
			stopReason: 'end_turn',
			inputTokens: 11,
			outputTokens: 22,
			turnCount: 3,
			toolResults: [{
				toolId: 'tool-1',
				toolName: 'bash',
				isError: true,
				content: 'boom',
				durationMs: 42,
			}],
			error: 'err',
			inputDeliveryEvents: [{
				messageId: 'm-1',
				status: 1,
				errorCode: 'overflow',
				errorMessage: 'full',
			}],
		});
		assert.deepStrictEqual(decodeChatSyncResponse(new Uint8Array(0)), {
			session_id: undefined,
			agent_id: undefined,
			text: undefined,
			stop_reason: undefined,
			input_tokens: undefined,
			output_tokens: undefined,
			turn_count: undefined,
			tool_results: [],
			error: undefined,
			input_delivery_events: [],
		});
		assert.deepStrictEqual(mapChatSyncResponse(decodeChatSyncResponse(new Uint8Array(0))), {
			sessionId: '',
			agentId: '',
			text: '',
			stopReason: '',
			inputTokens: 0,
			outputTokens: 0,
			turnCount: 0,
			toolResults: [],
			error: '',
			inputDeliveryEvents: [],
		});
	});

	test('encodeSyncInputDeliveryRequest writes session_id=1 repeated ids=2; omits empty; not JSON', () => {
		const encoded = encodeSyncInputDeliveryRequest({
			sessionId: 'sess-1',
			lastKnownMessageIds: ['m-1', 'm-2'],
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.deepStrictEqual(protoRepeatedStrings(encoded, 2), ['m-1', 'm-2']);
		assert.strictEqual(encodeSyncInputDeliveryRequest({
			sessionId: '',
			lastKnownMessageIds: [],
		}).length, 0);
	});

	test('decodeSyncInputDeliveryResponse reads events=1; unknown unread', () => {
		const event = Buffer.concat([
			encodeStringField(1, 'm-9'),
			encodeInt32Field(2, 3),
			encodeStringField(3, 'timeout'),
			encodeStringField(4, 'late'),
			encodeStringField(5, 'unused-event'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, event),
			encodeStringField(2, 'unused-field'),
		]);
		const wire = decodeSyncInputDeliveryResponse(encoded);
		assert.deepStrictEqual(wire, {
			input_delivery_events: [{
				message_id: 'm-9',
				status: 3,
				error_code: 'timeout',
				error_message: 'late',
			}],
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapSyncInputDeliveryResponse(wire), {
			inputDeliveryEvents: [{
				messageId: 'm-9',
				status: 3,
				errorCode: 'timeout',
				errorMessage: 'late',
			}],
		});
		assert.deepStrictEqual(decodeSyncInputDeliveryResponse(new Uint8Array(0)), {
			input_delivery_events: [],
		});
		assert.deepStrictEqual(mapSyncInputDeliveryResponse(decodeSyncInputDeliveryResponse(new Uint8Array(0))), {
			inputDeliveryEvents: [],
		});
	});

	test('ChatSync unary wire source has no JSON.stringify and no SaveSkillContent / continuation stream', () => {
		const thisDir = path.dirname(fileURLToPath(import.meta.url));
		const repoRoot = path.join(thisDir, '../../../../../../');
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/platform/universeAgent/node/grpc/grpcChatSyncUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(!/\bSaveSkillContent\b/.test(source));
		assert.ok(!/\bopenContinuationStream\b/.test(source));
		assert.ok(!/\bencodeDouble|\bdecodeDouble|\bwriteDouble/.test(source));
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

function protoRepeatedStrings(encoded: Uint8Array, fieldNumber: number): string[] {
	const values: string[] = [];
	for (const field of readProtoFields(encoded)) {
		if (field.field === fieldNumber && field.wireType === 2) {
			values.push(Buffer.from(field.bytes).toString('utf8'));
		}
	}
	return values;
}

function protoRepeatedMessages(encoded: Uint8Array, fieldNumber: number): Uint8Array[] {
	const values: Uint8Array[] = [];
	for (const field of readProtoFields(encoded)) {
		if (field.field === fieldNumber && field.wireType === 2) {
			values.push(field.bytes);
		}
	}
	return values;
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

function protoNested(encoded: Uint8Array, fieldNumber: number): Uint8Array | undefined {
	let found: Uint8Array | undefined;
	for (const field of readProtoFields(encoded)) {
		if (field.field === fieldNumber && field.wireType === 2) {
			found = field.bytes;
		}
	}
	return found;
}

function mustNested(encoded: Uint8Array, fieldNumber: number): Uint8Array {
	const nested = protoNested(encoded, fieldNumber);
	assert.ok(nested);
	return nested;
}

function nestedVarint(encoded: Uint8Array, fieldNumber: number): number | undefined {
	return protoVarints(mustNested(encoded, 3)).get(fieldNumber);
}
