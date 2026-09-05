/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { asUnaryProtoBytes } from '../../node/grpc/grpcClientCalls.js';
import {
	EMPTY_PROTO_MESSAGE,
	decodeAgentTreeResponse,
	decodeListAgentProfilesResponse,
	decodeListAgentsResponse,
	decodeListDevicesResponse,
	decodeListModelsResponse,
	decodeListSessionsResponse,
	encodeAgentTreeRequest,
	encodeEmptyProtoMessage,
	encodeListAgentProfilesRequest,
	encodeListAgentsRequest,
	encodeListDevicesRequest,
	encodeListModelsRequest,
	encodeListSessionsRequest,
} from '../../node/grpc/grpcCatalogUnaryWire.js';
import {
	encodeInt32Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc catalog unary protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('empty proto is 0 payload bytes and is still framed as a unary request', () => {
		const encoded = encodeListDevicesRequest();
		assert.strictEqual(encoded.length, 0);
		assert.strictEqual(encodeEmptyProtoMessage().length, 0);
		assert.ok(encoded !== undefined);
		const framed = asUnaryProtoBytes(EMPTY_PROTO_MESSAGE);
		assert.ok(Buffer.isBuffer(framed));
		assert.strictEqual(framed.length, 0);
		assert.notStrictEqual(framed[0], 0x7b);
	});

	test('encodeListSessionsRequest writes limit/offset, not JSON', () => {
		const encoded = encodeListSessionsRequest({ limit: 20, offset: 5 });
		assert.notStrictEqual(encoded[0], 0x7b);
		const numbers = new Map<number, number>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 0) {
				numbers.set(field.field, Number(field.varint));
			}
		}
		assert.strictEqual(numbers.get(1), 20);
		assert.strictEqual(numbers.get(2), 5);
	});

	test('encodeListSessionsRequest with no paging is empty proto, not JSON {}', () => {
		const encoded = encodeListSessionsRequest({});
		assert.strictEqual(encoded.length, 0);
		assert.notStrictEqual(JSON.stringify({}), Buffer.from(encoded).toString('utf8'));
	});

	test('decodeListSessionsResponse reads session_id and total', () => {
		const summary = Buffer.concat([
			encodeStringField(1, 'eng-1'),
			encodeInt32Field(2, 1),
			encodeStringField(7, 'Hello'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, summary),
			encodeInt32Field(2, 3),
		]);
		const decoded = decodeListSessionsResponse(encoded);
		assert.strictEqual(decoded.sessions?.[0]?.session_id, 'eng-1');
		assert.strictEqual(decoded.sessions?.[0]?.title, 'Hello');
		assert.strictEqual(decoded.total_count, 3);
	});

	test('encodeListAgentProfilesRequest writes project_path field 1', () => {
		const encoded = encodeListAgentProfilesRequest('/tmp/proj');
		assert.notStrictEqual(encoded[0], 0x7b);
		const fields = readProtoFields(encoded);
		assert.strictEqual(fields[0].field, 1);
		assert.strictEqual(Buffer.from(fields[0].wireType === 2 ? fields[0].bytes : []).toString('utf8'), '/tmp/proj');
	});

	test('encodeListAgentProfilesRequest without path is empty proto', () => {
		assert.strictEqual(encodeListAgentProfilesRequest(undefined).length, 0);
	});

	test('decodeListAgentProfilesResponse reads id/name/source', () => {
		const profile = Buffer.concat([
			encodeStringField(1, 'p1'),
			encodeStringField(2, 'Default'),
			encodeStringField(14, 'USER'),
		]);
		const decoded = decodeListAgentProfilesResponse(encodeMessageField(1, profile));
		assert.strictEqual(decoded.profiles?.[0]?.id, 'p1');
		assert.strictEqual(decoded.profiles?.[0]?.name, 'Default');
		assert.strictEqual(decoded.profiles?.[0]?.source, 'USER');
	});

	test('decodeListDevicesResponse reads device_id', () => {
		const device = encodeStringField(1, 'dev-1');
		const decoded = decodeListDevicesResponse(encodeMessageField(1, device));
		assert.strictEqual(decoded.devices?.[0]?.device_id, 'dev-1');
	});

	test('encodeListModelsRequest writes include_disabled true, not JSON', () => {
		const encoded = encodeListModelsRequest();
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		const fields = readProtoFields(encoded);
		assert.strictEqual(fields.length, 1);
		assert.strictEqual(fields[0].field, 2);
		assert.strictEqual(fields[0].wireType, 0);
		if (fields[0].wireType === 0) {
			assert.strictEqual(Number(fields[0].varint), 1);
		}
	});

	test('decodeListModelsResponse reads ModelEntryProto fields', () => {
		const model = Buffer.concat([
			encodeStringField(1, 'fast'),
			encodeStringField(2, 'chat'),
			encodeInt32Field(3, 1),
			encodeInt32Field(4, 7),
			encodeStringField(8, 'openai'),
			encodeStringField(9, 'gpt-fast'),
		]);
		const decoded = decodeListModelsResponse(encodeMessageField(1, model));
		assert.strictEqual(decoded.models?.[0]?.id, 'fast');
		assert.strictEqual(decoded.models?.[0]?.enabled, true);
		assert.strictEqual(decoded.models?.[0]?.level, 7);
		assert.strictEqual(decoded.models?.[0]?.provider, 'openai');
		assert.strictEqual(decoded.models?.[0]?.model_id, 'gpt-fast');
	});

	test('encodeListAgentsRequest with empty session_id is empty proto, not JSON {}', () => {
		const encoded = encodeListAgentsRequest('');
		assert.strictEqual(encoded.length, 0);
		assert.notStrictEqual(JSON.stringify({ session_id: '' }), Buffer.from(encoded).toString('utf8'));
		const framed = asUnaryProtoBytes(encoded);
		assert.ok(Buffer.isBuffer(framed));
		assert.strictEqual(framed.length, 0);
	});

	test('decodeListAgentsResponse reads agent_id', () => {
		const agent = Buffer.concat([
			encodeStringField(1, 'root'),
			encodeStringField(2, 'Root'),
		]);
		const decoded = decodeListAgentsResponse(encodeMessageField(1, agent));
		assert.strictEqual(decoded.agents?.[0]?.agent_id, 'root');
		assert.strictEqual(decoded.agents?.[0]?.name, 'Root');
	});

	test('encodeAgentTreeRequest writes session_id field 1', () => {
		const encoded = encodeAgentTreeRequest('eng-9');
		assert.notStrictEqual(encoded[0], 0x7b);
		const fields = readProtoFields(encoded);
		assert.strictEqual(Buffer.from(fields[0].wireType === 2 ? fields[0].bytes : []).toString('utf8'), 'eng-9');
	});

	test('decodeAgentTreeResponse reads root agent_id', () => {
		const root = Buffer.concat([
			encodeStringField(1, 'root'),
			encodeStringField(2, 'Root'),
			encodeInt32Field(3, 1),
		]);
		const decoded = decodeAgentTreeResponse(encodeMessageField(1, root));
		assert.strictEqual(decoded.root?.agent_id, 'root');
		assert.strictEqual(decoded.root?.type, 'AGENT_TYPE_SUB');
	});
});
