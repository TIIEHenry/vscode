/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapStatusResponse } from '../../node/grpc/grpcClientMappers.js';
import {
	decodeStatusResponse,
	encodeStatusRequest,
} from '../../node/grpc/grpcStatusUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodePresentMessageField,
	encodeStringField,
	encodeVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService Status protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeStatusRequest writes session_id=1 agent_id=2; omits empty; not JSON', () => {
		const encoded = encodeStatusRequest({
			sessionId: 'sess-1',
			agentId: 'ag-9',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			agent_id: 'ag-9',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'ag-9',
		});
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		const noAgent = encodeStatusRequest({
			sessionId: 'sess-1',
			agentId: '',
		});
		assert.strictEqual(protoStrings(noAgent).get(1), 'sess-1');
		assert.ok(!protoStrings(noAgent).has(2));
		assert.notStrictEqual(noAgent[0], 0x7b);

		assert.strictEqual(encodeStatusRequest({
			sessionId: '',
			agentId: '',
		}).length, 0);
	});

	test('decodeStatusResponse reads agent=1 AgentInfo scalars 1-7; type/status varint; children/model_info unread', () => {
		const agent = Buffer.concat([
			encodeStringField(1, 'ag-1'),
			encodeStringField(2, 'Coder'),
			encodeInt32Field(3, 1),
			encodeInt32Field(4, 3),
			encodeStringField(5, 'gpt-test'),
			encodeInt32Field(6, 4),
			encodeInt64Field(7, 1700000000),
			encodeMessageField(8, encodeStringField(1, 'child-unread')),
			encodeStringField(9, 'model-info-unread'),
			encodeStringField(10, 'unused-field'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, agent),
			encodeStringField(2, 'unused-top'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeStatusResponse(encoded);
		assert.deepStrictEqual(wire, {
			agent: {
				agent_id: 'ag-1',
				name: 'Coder',
				type: 'AGENT_TYPE_SUB',
				status: 'AGENT_STATUS_GENERATING',
				model: 'gpt-test',
				turn_count: 4,
				created_at: 1700000000,
			},
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.strictEqual(JSON.stringify(wire).includes('child'), false);
		assert.strictEqual(JSON.stringify(wire).includes('model-info'), false);
		assert.deepStrictEqual(Object.keys(wire.agent ?? {}), [
			'agent_id',
			'name',
			'type',
			'status',
			'model',
			'turn_count',
			'created_at',
		]);
		assert.deepStrictEqual(mapStatusResponse(wire), {
			agent: {
				agentId: 'ag-1',
				name: 'Coder',
				type: 'AGENT_TYPE_SUB',
				status: 'AGENT_STATUS_GENERATING',
				model: 'gpt-test',
				turnCount: 4,
				createdAt: 1700000000,
				children: [],
			},
		});

		const types = [0, 1, 2, 3].map(value => {
			const body = value === 0
				? encodeEnumInclZero(3, 0)
				: encodeInt32Field(3, value);
			return mapStatusResponse(decodeStatusResponse(encodeMessageField(1, body))).agent?.type;
		});
		assert.deepStrictEqual(types, [
			'AGENT_TYPE_ROOT',
			'AGENT_TYPE_SUB',
			'AGENT_TYPE_MEMBER',
			'AGENT_TYPE_ADVISE',
		]);

		const statuses = [0, 1, 2, 3, 4, 5, 6, 7].map(value => {
			const body = value === 0
				? encodeEnumInclZero(4, 0)
				: encodeInt32Field(4, value);
			return mapStatusResponse(decodeStatusResponse(encodeMessageField(1, body))).agent?.status;
		});
		assert.deepStrictEqual(statuses, [
			'AGENT_STATUS_UNKNOWN',
			'AGENT_STATUS_PENDING',
			'AGENT_STATUS_WAITING',
			'AGENT_STATUS_GENERATING',
			'AGENT_STATUS_PAUSED',
			'AGENT_STATUS_ERROR',
			'AGENT_STATUS_COMPLETED',
			'AGENT_STATUS_TIMEOUT',
		]);

		const empty = decodeStatusResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, { agent: undefined });
		assert.deepStrictEqual(mapStatusResponse(empty), { agent: undefined });

		const emptyAgent = decodeStatusResponse(encodePresentMessageField(1, new Uint8Array(0)));
		assert.deepStrictEqual(emptyAgent, {
			agent: {
				agent_id: undefined,
				name: undefined,
				type: undefined,
				status: undefined,
				model: undefined,
				turn_count: undefined,
				created_at: undefined,
			},
		});
		assert.deepStrictEqual(mapStatusResponse(emptyAgent), {
			agent: {
				agentId: 'root',
				name: '',
				type: 'AGENT_TYPE_UNKNOWN',
				status: 'AGENT_STATUS_UNKNOWN',
				model: '',
				turnCount: 0,
				createdAt: 0,
				children: [],
			},
		});
	});

	test('status unary wire is Status only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcStatusUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeStatusRequest\b/.test(source));
		assert.ok(/\bdecodeStatusResponse\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bClearSessionDemoFake\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bModelEntryProto\b/.test(source));
		assert.ok(!/\ballLengthDelimited\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('getAgentStatus still JSON unary; skip Connect/SaveSkillContent/GetModelPreferences/Watch/ResolveTurn/ClearSessionDemoFake', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const status = extractAsyncMethod(source, 'getAgentStatus');
		assert.ok(status.includes('makeUnaryClient<'), 'getAgentStatus still uses JSON makeUnaryClient');
		assert.ok(!status.includes('makeUnaryBytesClient'), 'getAgentStatus must not use makeUnaryBytesClient this slice');
		assert.ok(!status.includes('encodeStatusRequest'), 'getAgentStatus must not call encodeStatusRequest this slice');
		assert.ok(!status.includes('decodeStatusResponse'), 'getAgentStatus must not call decodeStatusResponse this slice');
		assert.ok(status.includes('mapStatusResponse'), 'getAgentStatus still calls mapStatusResponse');
		assert.ok(status.includes('session_id'), 'getAgentStatus still sends session_id JSON key');
		assert.ok(status.includes('agent_id'), 'getAgentStatus still sends agent_id JSON key');
		assert.ok(!source.includes('grpcStatusUnaryWire'));

		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'getModelPreferences').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'clearSessionDemoFake').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
	});
});

function encodeEnumInclZero(field: number, value: number): Buffer {
	return Buffer.concat([
		encodeVarint((field << 3) | 0),
		encodeVarint(value),
	]);
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcStatusUnaryWire.ts')));
	assert.ok(dir, 'grpcStatusUnaryWire.ts not found from cwd or import.meta');
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
