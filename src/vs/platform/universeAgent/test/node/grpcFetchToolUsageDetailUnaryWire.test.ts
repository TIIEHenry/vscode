/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapFetchToolUsageDetailResponse } from '../../node/grpc/grpcClientMappers.js';
import {
	decodeFetchToolUsageDetailResponse,
	encodeFetchToolUsageDetailRequest,
} from '../../node/grpc/grpcFetchToolUsageDetailUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService FetchToolUsageDetail protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeFetchToolUsageDetailRequest writes session_id=1 tool_call_id=2; omits empty; not JSON', () => {
		const encoded = encodeFetchToolUsageDetailRequest({
			sessionId: 'sess-1',
			toolCallId: 'tc-1',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			tool_call_id: 'tc-1',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'tc-1',
		});
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		const sessionOnly = encodeFetchToolUsageDetailRequest({
			sessionId: 'sess-1',
			toolCallId: '',
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));
		assert.notStrictEqual(sessionOnly[0], 0x7b);

		assert.strictEqual(encodeFetchToolUsageDetailRequest({
			sessionId: '',
			toolCallId: '',
		}).length, 0);
	});

	test('decodeFetchToolUsageDetailResponse reads success=1 tool_call_id=2 context_sources=3 error_message=4; extra unused unread', () => {
		const contextSource = Buffer.concat([
			encodeInt32Field(1, 5),
			encodeStringField(2, 'agent-1'),
			encodeStringField(3, 'scope-1'),
			encodeStringField(4, 'msg-1'),
			encodeInt64Field(5, 42),
			encodeStringField(6, 'unused-nested'),
		]);
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'tc-1'),
			encodeMessageField(3, contextSource),
			encodeStringField(4, 'not found'),
			encodeStringField(5, 'unused-extra'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeFetchToolUsageDetailResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			tool_call_id: 'tc-1',
			context_sources: [{
				source_type: 5,
				source_agent_id: 'agent-1',
				source_scope_id: 'scope-1',
				message_id: 'msg-1',
				estimated_tokens: 42,
			}],
			error_message: 'not found',
		});
		assert.ok('context_sources' in wire);
		assert.ok((wire.context_sources?.length ?? 0) > 0);
		assert.strictEqual(wire.context_sources?.[0]?.estimated_tokens, 42);
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapFetchToolUsageDetailResponse(wire), {
			ok: true,
			toolCallId: 'tc-1',
			contextSources: [{
				sourceType: 'CONTEXT_SOURCE_TYPE_TOOL_RESULT',
				sourceAgentId: 'agent-1',
				sourceScopeId: 'scope-1',
				messageId: 'msg-1',
				estimatedTokens: 42,
			}],
			message: 'not found',
		});

		const empty = decodeFetchToolUsageDetailResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			tool_call_id: undefined,
			context_sources: [],
			error_message: undefined,
		});
		assert.deepStrictEqual(mapFetchToolUsageDetailResponse(empty), {
			ok: false,
			toolCallId: '',
			contextSources: [],
			message: undefined,
		});
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
