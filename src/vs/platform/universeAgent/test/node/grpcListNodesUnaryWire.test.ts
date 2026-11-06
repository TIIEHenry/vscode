/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapListNodesResponse } from '../../node/grpc/grpcClientMappersCatalog.js';
import {
	decodeListNodesResponse,
	encodeListNodesRequest,
} from '../../node/grpc/grpcListNodesUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService ListNodes protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeListNodesRequest writes repeated filter_status=1 filter_tags=2; omits empty; not JSON', () => {
		const encoded = encodeListNodesRequest({
			filterStatus: ['ONLINE', 'DEGRADED'],
			filterTags: ['gpu', 'prod'],
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			filter_status: ['ONLINE', 'DEGRADED'],
			filter_tags: ['gpu', 'prod'],
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStringLists(encoded)), {
			1: ['ONLINE', 'DEGRADED'],
			2: ['gpu', 'prod'],
		});
		assert.ok(!protoStringLists(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		const statusOnly = encodeListNodesRequest({
			filterStatus: ['ONLINE'],
			filterTags: [],
		});
		assert.deepStrictEqual(protoStringLists(statusOnly).get(1), ['ONLINE']);
		assert.ok(!protoStringLists(statusOnly).has(2));
		assert.notStrictEqual(statusOnly[0], 0x7b);

		const emptyStrings = encodeListNodesRequest({
			filterStatus: [''],
			filterTags: [''],
		});
		assert.strictEqual(emptyStrings.length, 0);

		assert.strictEqual(encodeListNodesRequest({
			filterStatus: [],
			filterTags: [],
		}).length, 0);
	});

	test('decodeListNodesResponse reads nodes=1 RemoteAgentInfo 1-9 including nested capabilities=7 load=8', () => {
		const model = Buffer.concat([
			encodeStringField(1, 'gemini-flash'),
			encodeStringField(2, 'Gemini Flash'),
			encodeStringField(3, 'google'),
			encodeInt64Field(4, 8192),
			encodeInt32Field(5, 1),
			encodeStringField(6, 'unused-model'),
		]);
		const sparseModel = encodeStringField(1, 'local-7b');
		const properties = Buffer.concat([
			encodeStringField(1, 'region'),
			encodeStringField(2, 'us-east'),
			encodeStringField(3, 'unused-property'),
		]);
		const capabilities = Buffer.concat([
			encodeMessageField(1, model),
			encodeMessageField(1, sparseModel),
			encodeStringField(2, 'bash'),
			encodeStringField(2, 'read'),
			encodeStringField(3, 'agent'),
			encodeStringField(3, 'plan'),
			encodeStringField(4, '1.2.3'),
			encodeStringField(5, 'v1'),
			encodeMessageField(6, properties),
			encodeStringField(7, 'unused-capabilities'),
		]);
		const load = Buffer.concat([
			encodeInt32Field(1, 3),
			encodeInt32Field(2, 7),
			encodeInt32Field(3, 42),
			encodeInt64Field(4, 1024),
			encodeStringField(5, 'unused-load'),
		]);
		const node = Buffer.concat([
			encodeStringField(1, 'node-1'),
			encodeStringField(2, 'galaxy'),
			encodeStringField(3, 'remote'),
			encodeStringField(4, 'ONLINE'),
			encodeStringField(5, '127.0.0.1:50061'),
			encodeStringField(6, 'gpu'),
			encodeStringField(6, 'prod'),
			encodeMessageField(7, capabilities),
			encodeMessageField(8, load),
			encodeInt64Field(9, 1700000000),
			encodeStringField(10, 'unused-node'),
		]);
		const sparse = Buffer.concat([
			encodeStringField(1, 'node-2'),
			encodeStringField(4, 'OFFLINE'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, node),
			encodeMessageField(1, sparse),
			encodeInt32Field(2, 4),
			encodeInt32Field(3, 1),
			encodeStringField(4, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeListNodesResponse(encoded);
		assert.deepStrictEqual(wire, {
			nodes: [
				{
					id: 'node-1',
					name: 'galaxy',
					description: 'remote',
					status: 'ONLINE',
					endpoint: '127.0.0.1:50061',
					tags: ['gpu', 'prod'],
					capabilities: {
						models: [
							{
								id: 'gemini-flash',
								name: 'Gemini Flash',
								provider: 'google',
								max_tokens: 8192,
								enabled: true,
							},
							{
								id: 'local-7b',
								name: undefined,
								provider: undefined,
								max_tokens: undefined,
								enabled: undefined,
							},
						],
						tools: ['bash', 'read'],
						modes: ['agent', 'plan'],
						server_version: '1.2.3',
						protocol_version: 'v1',
						properties: { region: 'us-east' },
					},
					load: {
						active_sessions: 3,
						queue_depth: 7,
						cpu_percent: 42,
						memory_used_mb: 1024,
					},
					last_heartbeat_at: 1700000000,
				},
				{
					id: 'node-2',
					name: undefined,
					description: undefined,
					status: 'OFFLINE',
					endpoint: undefined,
					tags: undefined,
					capabilities: undefined,
					load: undefined,
					last_heartbeat_at: undefined,
				},
			],
			total: 4,
			online_count: 1,
		});
		assert.ok(!('unused' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapListNodesResponse(wire), {
			nodes: [
				{
					id: 'node-1',
					name: 'galaxy',
					description: 'remote',
					status: 'ONLINE',
					endpoint: '127.0.0.1:50061',
					tags: ['gpu', 'prod'],
					capabilities: {
						models: [
							{
								id: 'gemini-flash',
								name: 'Gemini Flash',
								provider: 'google',
								maxTokens: 8192,
								enabled: true,
							},
							{
								id: 'local-7b',
								name: '',
								provider: '',
								maxTokens: 0,
								enabled: false,
							},
						],
						tools: ['bash', 'read'],
						modes: ['agent', 'plan'],
						serverVersion: '1.2.3',
						protocolVersion: 'v1',
						properties: { region: 'us-east' },
					},
					load: {
						activeSessions: 3,
						queueDepth: 7,
						cpuPercent: 42,
						memoryUsedMb: 1024,
					},
					lastHeartbeatAt: 1700000000,
				},
				{
					id: 'node-2',
					name: '',
					description: '',
					status: 'OFFLINE',
					endpoint: '',
					tags: [],
					capabilities: {
						models: [],
						tools: [],
						modes: [],
						serverVersion: '',
						protocolVersion: '',
						properties: {},
					},
					load: {
						activeSessions: 0,
						queueDepth: 0,
						cpuPercent: 0,
						memoryUsedMb: 0,
					},
					lastHeartbeatAt: 0,
				},
			],
			total: 4,
			onlineCount: 1,
		});

		const omittedZeros = decodeListNodesResponse(encodeMessageField(1, encodeStringField(1, 'node-3')));
		assert.deepStrictEqual(omittedZeros, {
			nodes: [{
				id: 'node-3',
				name: undefined,
				description: undefined,
				status: undefined,
				endpoint: undefined,
				tags: undefined,
				capabilities: undefined,
				load: undefined,
				last_heartbeat_at: undefined,
			}],
			total: undefined,
			online_count: undefined,
		});
		assert.deepStrictEqual(mapListNodesResponse(omittedZeros), {
			nodes: [{
				id: 'node-3',
				name: '',
				description: '',
				status: '',
				endpoint: '',
				tags: [],
				capabilities: {
					models: [],
					tools: [],
					modes: [],
					serverVersion: '',
					protocolVersion: '',
					properties: {},
				},
				load: {
					activeSessions: 0,
					queueDepth: 0,
					cpuPercent: 0,
					memoryUsedMb: 0,
				},
				lastHeartbeatAt: 0,
			}],
			total: 0,
			onlineCount: 0,
		});

		const empty = decodeListNodesResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			nodes: [],
			total: undefined,
			online_count: undefined,
		});
		assert.deepStrictEqual(mapListNodesResponse(empty), {
			nodes: [],
			total: 0,
			onlineCount: 0,
		});
	});
});



function protoStringLists(encoded: Uint8Array): Map<number, string[]> {
	const strings = new Map<number, string[]>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 2) {
			const list = strings.get(field.field) ?? [];
			list.push(Buffer.from(field.bytes).toString('utf8'));
			strings.set(field.field, list);
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
