/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
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

	test('list-nodes unary wire is RemoteAgentService.ListNodes only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcListNodesUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeListNodesRequest\b/.test(source));
		assert.ok(/\bdecodeListNodesResponse\b/.test(source));
		assert.ok(/\bdecodeRemoteAgentInfoScalars\b/.test(source));
		assert.ok(source.includes('grpcGetNodeUnaryWire'));
		assert.ok(/\bencodeStringField\b/.test(source));
		assert.ok(/\ballLengthDelimited\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bdecodeCapabilities\b|\bdecodeLoadMetrics\b|\bdecodeModelInfo\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bResolveAnchor\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('listNodes uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const listNodes = extractAsyncMethod(source, 'listNodes');
		assert.ok(listNodes.includes('makeUnaryBytesClient'), 'listNodes must use makeUnaryBytesClient');
		assert.ok(listNodes.includes('encodeListNodesRequest'), 'listNodes must call encodeListNodesRequest');
		assert.ok(listNodes.includes('decodeListNodesResponse'), 'listNodes must call decodeListNodesResponse');
		assert.ok(listNodes.includes('mapListNodesResponse'), 'listNodes still calls mapListNodesResponse');
		assert.ok(!listNodes.includes('makeUnaryClient<'), 'listNodes must not use JSON makeUnaryClient');
		assert.ok(!listNodes.includes('JSON.stringify'), 'listNodes must not JSON.stringify');

		assert.ok(source.includes('grpcListNodesUnaryWire'));
		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
	});
});

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcListNodesUnaryWire.ts')));
	assert.ok(dir, 'grpcListNodesUnaryWire.ts not found from cwd or import.meta');
	return dir;
}

function extractAsyncMethod(source: string, name: string): string {
	const start = source.indexOf(`\tasync ${name}(`);
	assert.ok(start >= 0, `missing async ${name}(`);
	const nextAsync = source.indexOf('\n\tasync ', start + 1);
	const end = nextAsync >= 0 ? nextAsync : source.length;
	return source.slice(start, end);
}

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
