/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapRemoteAgentInfo } from '../../node/grpc/grpcClientMappersCatalog.js';
import {
	decodeGetNodeResponse,
	encodeGetNodeRequest,
} from '../../node/grpc/grpcGetNodeUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	encodeVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService GetNode protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeGetNodeRequest writes node_id=1; omits empty; not JSON', () => {
		const encoded = encodeGetNodeRequest({
			nodeId: 'node-1',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			node_id: 'node-1',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'node-1',
		});
		assert.ok(!protoStrings(encoded).has(2));
		assert.ok(!protoVarints(encoded).has(1));

		assert.strictEqual(encodeGetNodeRequest({
			nodeId: '',
		}).length, 0);
		assert.notStrictEqual(encoded[0], 0x7b);
	});

	test('decodeGetNodeResponse reads id=1 name=2 description=3 status=4 endpoint=5 tags=6 capabilities=7 load=8 last_heartbeat_at=9', () => {
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
		const encoded = Buffer.concat([
			encodeStringField(1, 'node-1'),
			encodeStringField(2, 'Edge GPU'),
			encodeStringField(3, 'remote coder'),
			encodeStringField(4, 'ONLINE'),
			encodeStringField(5, '10.0.0.2:8443'),
			encodeStringField(6, 'gpu'),
			encodeStringField(6, 'prod'),
			encodeMessageField(7, capabilities),
			encodeMessageField(8, load),
			encodeInt64Field(9, 1700000000),
			encodeStringField(10, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeGetNodeResponse(encoded);
		assert.deepStrictEqual(wire, {
			id: 'node-1',
			name: 'Edge GPU',
			description: 'remote coder',
			status: 'ONLINE',
			endpoint: '10.0.0.2:8443',
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
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapRemoteAgentInfo(wire), {
			id: 'node-1',
			name: 'Edge GPU',
			description: 'remote coder',
			status: 'ONLINE',
			endpoint: '10.0.0.2:8443',
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
		});

		const empty = decodeGetNodeResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			id: undefined,
			name: undefined,
			description: undefined,
			status: undefined,
			endpoint: undefined,
			tags: undefined,
			capabilities: undefined,
			load: undefined,
			last_heartbeat_at: undefined,
		});
		assert.deepStrictEqual(mapRemoteAgentInfo(empty), {
			id: '',
			name: '',
			description: '',
			status: '',
			endpoint: '',
			tags: [],
			capabilities: emptyCapabilities(),
			load: emptyLoad(),
			lastHeartbeatAt: 0,
		});

		const unusedOnly = decodeGetNodeResponse(encodeStringField(10, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			id: undefined,
			name: undefined,
			description: undefined,
			status: undefined,
			endpoint: undefined,
			tags: undefined,
			capabilities: undefined,
			load: undefined,
			last_heartbeat_at: undefined,
		});
		assert.strictEqual(JSON.stringify(unusedOnly).includes('unused'), false);
		assert.deepStrictEqual(mapRemoteAgentInfo(unusedOnly), {
			id: '',
			name: '',
			description: '',
			status: '',
			endpoint: '',
			tags: [],
			capabilities: emptyCapabilities(),
			load: emptyLoad(),
			lastHeartbeatAt: 0,
		});

		const lastWins = decodeGetNodeResponse(Buffer.concat([
			encodeMessageField(7, encodeStringField(4, 'old')),
			encodeMessageField(7, encodeStringField(4, '1.2.3')),
			encodeMessageField(8, encodeInt32Field(1, 1)),
			encodeMessageField(8, encodeInt32Field(1, 3)),
			encodeInt64Field(9, 1),
			encodeInt64Field(9, 1700000000),
		]));
		assert.strictEqual(lastWins.capabilities?.server_version, '1.2.3');
		assert.strictEqual(lastWins.load?.active_sessions, 3);
		assert.strictEqual(lastWins.last_heartbeat_at, 1700000000);
		assert.strictEqual(mapRemoteAgentInfo(lastWins).capabilities.serverVersion, '1.2.3');
		assert.strictEqual(mapRemoteAgentInfo(lastWins).load.activeSessions, 3);
		assert.strictEqual(mapRemoteAgentInfo(lastWins).lastHeartbeatAt, 1700000000);

		const lastWinsMap = decodeGetNodeResponse(encodeMessageField(7, Buffer.concat([
			encodeMessageField(6, Buffer.concat([
				encodeStringField(1, 'region'),
				encodeStringField(2, 'us-west'),
			])),
			encodeMessageField(6, Buffer.concat([
				encodeStringField(1, 'region'),
				encodeStringField(2, 'us-east'),
			])),
		])));
		assert.deepStrictEqual(lastWinsMap.capabilities?.properties, { region: 'us-east' });
		assert.deepStrictEqual(mapRemoteAgentInfo(lastWinsMap).capabilities.properties, { region: 'us-east' });

		const zeroPresent = decodeGetNodeResponse(Buffer.concat([
			encodeMessageField(7, Buffer.concat([
				encodeMessageField(1, Buffer.concat([
					encodeStringField(1, 'local-7b'),
					encodeVarintZero(4),
					encodeVarintZero(5),
				])),
			])),
			encodeMessageField(8, Buffer.concat([
				encodeVarintZero(1),
				encodeVarintZero(2),
				encodeVarintZero(3),
				encodeVarintZero(4),
			])),
			encodeVarintZero(9),
		]));
		assert.deepStrictEqual(zeroPresent.capabilities?.models, [{
			id: 'local-7b',
			name: undefined,
			provider: undefined,
			max_tokens: 0,
			enabled: false,
		}]);
		assert.deepStrictEqual(zeroPresent.load, {
			active_sessions: 0,
			queue_depth: 0,
			cpu_percent: 0,
			memory_used_mb: 0,
		});
		assert.strictEqual(zeroPresent.last_heartbeat_at, 0);
		assert.deepStrictEqual(mapRemoteAgentInfo(zeroPresent).capabilities.models, [{
			id: 'local-7b',
			name: '',
			provider: '',
			maxTokens: 0,
			enabled: false,
		}]);
		assert.deepStrictEqual(mapRemoteAgentInfo(zeroPresent).load, emptyLoad());
		assert.strictEqual(mapRemoteAgentInfo(zeroPresent).lastHeartbeatAt, 0);
		assert.strictEqual(encodeInt32Field(1, 0).length, 0);
		assert.strictEqual(encodeInt64Field(4, 0).length, 0);
		assert.strictEqual(encodeInt64Field(9, 0).length, 0);
	});

	test('get-node unary wire is RemoteAgentService.GetNode only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcGetNodeUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeGetNodeRequest\b/.test(source));
		assert.ok(/\bdecodeGetNodeResponse\b/.test(source));
		assert.ok(/\bdecodeRemoteAgentInfoScalars\b/.test(source));
		assert.ok(/\bdecodeCapabilities\b/.test(source));
		assert.ok(/\bdecodeLoadMetrics\b/.test(source));
		assert.ok(/\bdecodeModelInfo\b/.test(source));
		assert.ok(/\blastBytes\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(/\ballLengthDelimited\b/.test(source));
		assert.ok(source.includes('grpcClientMappersCatalog'));
		assert.ok(!/export interface RemoteAgentInfoWire/.test(source));
		assert.ok(/export function decodeCapabilities/.test(source));
		assert.ok(/export function decodeLoadMetrics/.test(source));
		assert.ok(/export function decodeModelInfo/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bResolveAnchor\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('getNode uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const getNode = extractAsyncMethod(source, 'getNode');
		assert.ok(getNode.includes('makeUnaryBytesClient'), 'getNode must use makeUnaryBytesClient');
		assert.ok(getNode.includes('encodeGetNodeRequest'), 'getNode must call encodeGetNodeRequest');
		assert.ok(getNode.includes('decodeGetNodeResponse'), 'getNode must call decodeGetNodeResponse');
		assert.ok(getNode.includes('mapRemoteAgentInfo'), 'getNode still calls mapRemoteAgentInfo');
		assert.ok(!getNode.includes('makeUnaryClient<'), 'getNode must not use JSON makeUnaryClient');
		assert.ok(!getNode.includes('JSON.stringify'), 'getNode must not JSON.stringify');

		assert.ok(source.includes('grpcGetNodeUnaryWire'));
		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveAnchor').includes('makeUnaryBytesClient'));
		const watchStart = source.indexOf('\topenWatchConfigStream(');
		assert.ok(watchStart >= 0, 'missing openWatchConfigStream(');
		const watchEnd = source.indexOf('\n\tasync ', watchStart + 1);
		const watchBody = source.slice(watchStart, watchEnd >= 0 ? watchEnd : source.length);
		assert.ok(watchBody.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!watchBody.includes('makeUnaryBytesClient'));
		assert.ok(!watchBody.includes('grpcGetNodeUnaryWire'));
	});
});

function emptyCapabilities() {
	return {
		models: [],
		tools: [],
		modes: [],
		serverVersion: '',
		protocolVersion: '',
		properties: {},
	};
}

function emptyLoad() {
	return {
		activeSessions: 0,
		queueDepth: 0,
		cpuPercent: 0,
		memoryUsedMb: 0,
	};
}

function encodeVarintZero(field: number): Buffer {
	return Buffer.concat([
		encodeVarint((field << 3) | 0),
		encodeVarint(0),
	]);
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcGetNodeUnaryWire.ts')));
	assert.ok(dir, 'grpcGetNodeUnaryWire.ts not found from cwd or import.meta');
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
