/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapAgentTreeNode, mapStatusResponse } from '../../node/grpc/grpcClientMappers.js';
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

	test('decodeStatusResponse reads agent=1 AgentInfo scalars 1-7; type/status varint; model_info unread', () => {
		const agent = Buffer.concat([
			encodeStringField(1, 'ag-1'),
			encodeStringField(2, 'Coder'),
			encodeInt32Field(3, 1),
			encodeInt32Field(4, 3),
			encodeStringField(5, 'gpt-test'),
			encodeInt32Field(6, 4),
			encodeInt64Field(7, 1700000000),
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
				children: [],
			},
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.strictEqual(JSON.stringify(wire).includes('model-info'), false);
		assert.deepStrictEqual(Object.keys(wire.agent ?? {}), [
			'agent_id',
			'name',
			'type',
			'status',
			'model',
			'turn_count',
			'created_at',
			'children',
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
				children: [],
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

	test('decodeStatusResponse reads nested AgentInfo children=8; maps via mapStatusResponse/mapAgentTreeNode; model_info unread', () => {
		const grandchild = encodeStringField(1, 'ag-grand');
		const child = Buffer.concat([
			encodeStringField(1, 'ag-child'),
			encodeStringField(2, 'Helper'),
			encodeInt32Field(3, 2),
			encodeInt32Field(4, 1),
			encodeMessageField(8, grandchild),
		]);
		const sibling = encodeStringField(1, 'ag-sib');
		const agent = Buffer.concat([
			encodeStringField(1, 'ag-1'),
			encodeStringField(2, 'Coder'),
			encodeInt32Field(3, 1),
			encodeInt32Field(4, 3),
			encodeMessageField(8, child),
			encodeMessageField(8, sibling),
			encodeStringField(9, 'model-info-unread'),
		]);
		const wire = decodeStatusResponse(encodeMessageField(1, agent));
		assert.ok((wire.agent?.children?.length ?? 0) > 0);
		assert.strictEqual(JSON.stringify(wire).includes('model-info'), false);
		assert.ok(!('model_info' in (wire.agent ?? {})));
		assert.ok(!('modelInfo' in (wire.agent ?? {})));
		const mappedChild = mapAgentTreeNode(wire.agent?.children?.[0]);
		const mapped = mapStatusResponse(wire);
		assert.ok((mapped.agent?.children.length ?? 0) > 0);
		assert.deepStrictEqual(mapped.agent?.children[0], mappedChild);
		assert.deepStrictEqual(mapped, {
			agent: {
				agentId: 'ag-1',
				name: 'Coder',
				type: 'AGENT_TYPE_SUB',
				status: 'AGENT_STATUS_GENERATING',
				model: '',
				turnCount: 0,
				createdAt: 0,
				children: [
					{
						agentId: 'ag-child',
						name: 'Helper',
						type: 'AGENT_TYPE_MEMBER',
						status: 'AGENT_STATUS_PENDING',
						model: '',
						turnCount: 0,
						createdAt: 0,
						children: [
							{
								agentId: 'ag-grand',
								name: '',
								type: 'AGENT_TYPE_UNKNOWN',
								status: 'AGENT_STATUS_UNKNOWN',
								model: '',
								turnCount: 0,
								createdAt: 0,
								children: [],
							},
						],
					},
					{
						agentId: 'ag-sib',
						name: '',
						type: 'AGENT_TYPE_UNKNOWN',
						status: 'AGENT_STATUS_UNKNOWN',
						model: '',
						turnCount: 0,
						createdAt: 0,
						children: [],
					},
				],
			},
		});
	});
});

function encodeEnumInclZero(field: number, value: number): Buffer {
	return Buffer.concat([
		encodeVarint((field << 3) | 0),
		encodeVarint(value),
	]);
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
