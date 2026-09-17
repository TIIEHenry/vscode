/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentRemoteAgentConfig } from '../../common/universeAgentTypes.js';
import { mapConnectionReport, mapSaveRemoteAgentConfigResponse } from '../../node/grpc/grpcClientMappersCatalog.js';
import {
	decodeSaveConfigResponse,
	encodeSaveConfigRequest,
} from '../../node/grpc/grpcSaveConfigUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodePresentMessageField,
	encodeStringField,
	lastBytes,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService SaveConfig protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeSaveConfigRequest writes nested config scalars 1-4,7-9 + skip/async; omits nested 5/6/10/11; not JSON', () => {
		const encoded = encodeSaveConfigRequest({
			config: sampleConfig({
				id: 'cfg-1',
				name: 'Node A',
				description: 'remote node',
				enabled: true,
				tags: ['prod', 'gpu'],
				maxConcurrentSessions: 4,
				sessionLifecycle: 'POOLED',
			}),
			skipConnectionTest: true,
			asyncTest: true,
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			config: {
				id: 'cfg-1',
				name: 'Node A',
				description: 'remote node',
				enabled: true,
				tags: ['prod', 'gpu'],
				max_concurrent_sessions: 4,
				session_lifecycle: 'POOLED',
			},
			skip_connection_test: true,
			async_test: true,
		}));
		assert.strictEqual(protoVarints(encoded).get(2), 1);
		assert.strictEqual(protoVarints(encoded).get(3), 1);
		assert.ok(!protoVarints(encoded).has(1));
		const inner = lastBytes(readProtoFields(encoded), 1);
		assert.ok(inner);
		assert.deepStrictEqual(protoStringLists(inner).get(1), ['cfg-1']);
		assert.deepStrictEqual(protoStringLists(inner).get(2), ['Node A']);
		assert.deepStrictEqual(protoStringLists(inner).get(3), ['remote node']);
		assert.strictEqual(protoVarints(inner).get(4), 1);
		assert.deepStrictEqual(protoStringLists(inner).get(7), ['prod', 'gpu']);
		assert.strictEqual(protoVarints(inner).get(8), 4);
		assert.deepStrictEqual(protoStringLists(inner).get(9), ['POOLED']);
		assert.ok(!protoStringLists(inner).has(5));
		assert.ok(!protoStringLists(inner).has(6));
		assert.ok(!protoStringLists(inner).has(10));
		assert.ok(!protoStringLists(inner).has(11));
		assert.ok(!protoVarints(inner).has(1));
		assert.ok(!protoVarints(inner).has(2));
		assert.ok(!protoVarints(inner).has(3));
		assert.ok(!protoVarints(inner).has(5));
		assert.ok(!protoVarints(inner).has(6));

		const omittedFalse = encodeSaveConfigRequest({
			config: sampleConfig({
				id: 'cfg-1',
				name: '',
				description: '',
				enabled: false,
				tags: [],
				maxConcurrentSessions: 0,
				sessionLifecycle: '',
			}),
			skipConnectionTest: false,
			asyncTest: false,
		});
		assert.notStrictEqual(omittedFalse[0], 0x7b);
		assert.ok(!protoVarints(omittedFalse).has(2));
		assert.ok(!protoVarints(omittedFalse).has(3));
		const sparseInner = lastBytes(readProtoFields(omittedFalse), 1);
		assert.ok(sparseInner);
		assert.deepStrictEqual(protoStringLists(sparseInner).get(1), ['cfg-1']);
		assert.ok(!protoStringLists(sparseInner).has(2));
		assert.ok(!protoStringLists(sparseInner).has(3));
		assert.ok(!protoVarints(sparseInner).has(4));
		assert.ok(!protoStringLists(sparseInner).has(5));
		assert.ok(!protoStringLists(sparseInner).has(6));
		assert.ok(!protoStringLists(sparseInner).has(7));
		assert.ok(!protoVarints(sparseInner).has(8));
		assert.ok(!protoStringLists(sparseInner).has(9));
		assert.ok(!protoStringLists(sparseInner).has(10));
		assert.ok(!protoStringLists(sparseInner).has(11));

		const empty = encodeSaveConfigRequest({
			config: sampleConfig({
				id: '',
				name: '',
				description: '',
				enabled: false,
				tags: [],
				maxConcurrentSessions: 0,
				sessionLifecycle: '',
			}),
			skipConnectionTest: false,
			asyncTest: false,
		});
		assert.notStrictEqual(empty[0], 0x7b);
		assert.ok(!protoVarints(empty).has(2));
		assert.ok(!protoVarints(empty).has(3));
		const presentEmpty = lastBytes(readProtoFields(empty), 1);
		assert.ok(presentEmpty);
		assert.strictEqual(presentEmpty.length, 0);
		assert.deepStrictEqual(Array.from(readProtoFields(presentEmpty)), []);
	});

	test('decodeSaveConfigResponse reads success=1 message=2 connection_test=3 async_test_id=4; mapper connectionTest non-empty from field 3', () => {
		const nestedReport = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeInt32Field(2, 1),
			encodeInt32Field(3, 1),
			encodeInt64Field(4, 42),
			encodeMessageField(5, encodeStringField(4, 'unused-server-version')),
			encodeMessageField(6, encodeStringField(3, 'unused-error')),
			encodeMessageField(7, encodeInt32Field(1, 9)),
		]);
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'saved'),
			encodeMessageField(3, nestedReport),
			encodeStringField(4, 'async-9'),
			encodeStringField(5, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeSaveConfigResponse(encoded);
		const nestedConnectionTest = {
			reachable: true,
			authenticated: true,
			can_create_session: true,
			latency_ms: 42,
			capabilities: {
				models: [],
				tools: [],
				modes: [],
				server_version: 'unused-server-version',
				protocol_version: undefined,
				properties: undefined,
			},
			errors: [{
				code: undefined,
				field: undefined,
				message: 'unused-error',
				suggestion: undefined,
			}],
			load: {
				active_sessions: 9,
				queue_depth: undefined,
				cpu_percent: undefined,
				memory_used_mb: undefined,
			},
		};
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'saved',
			connection_test: nestedConnectionTest,
			async_test_id: 'async-9',
		});
		assert.ok(wire.connection_test);
		assert.ok(!('unused' in wire));
		const mapped = mapSaveRemoteAgentConfigResponse(wire);
		assert.notDeepStrictEqual(mapped.connectionTest, mapConnectionReport({}));
		assert.deepStrictEqual(mapped, {
			success: true,
			message: 'saved',
			connectionTest: mapConnectionReport(nestedConnectionTest),
			asyncTestId: 'async-9',
		});
		assert.strictEqual(mapped.connectionTest.reachable, true);
		assert.strictEqual(mapped.connectionTest.authenticated, true);
		assert.strictEqual(mapped.connectionTest.canCreateSession, true);
		assert.strictEqual(mapped.connectionTest.latencyMs, 42);
	});

	test('decodeSaveConfigResponse omitted/false/empty-string; unused unread', () => {
		const empty = decodeSaveConfigResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
			connection_test: undefined,
			async_test_id: undefined,
		});
		assert.deepStrictEqual(mapSaveRemoteAgentConfigResponse(empty), {
			success: false,
			message: '',
			connectionTest: mapConnectionReport({}),
			asyncTestId: '',
		});

		const unusedOnly = decodeSaveConfigResponse(encodeStringField(5, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			success: undefined,
			message: undefined,
			connection_test: undefined,
			async_test_id: undefined,
		});
		assert.ok(!('unused' in unusedOnly));
		assert.deepStrictEqual(mapSaveRemoteAgentConfigResponse(unusedOnly), {
			success: false,
			message: '',
			connectionTest: mapConnectionReport({}),
			asyncTestId: '',
		});

		const explicitFalse = decodeSaveConfigResponse(new Uint8Array([0x08, 0x00]));
		assert.deepStrictEqual(explicitFalse, {
			success: false,
			message: undefined,
			connection_test: undefined,
			async_test_id: undefined,
		});
		assert.deepStrictEqual(mapSaveRemoteAgentConfigResponse(explicitFalse), {
			success: false,
			message: '',
			connectionTest: mapConnectionReport({}),
			asyncTestId: '',
		});

		const emptyStrings = decodeSaveConfigResponse(Buffer.concat([
			encodeInt32Field(1, 1),
			encodePresentMessageField(2, new Uint8Array(0)),
			encodePresentMessageField(4, new Uint8Array(0)),
		]));
		assert.deepStrictEqual(emptyStrings, {
			success: true,
			message: '',
			connection_test: undefined,
			async_test_id: '',
		});
		assert.deepStrictEqual(mapSaveRemoteAgentConfigResponse(emptyStrings), {
			success: true,
			message: '',
			connectionTest: mapConnectionReport({}),
			asyncTestId: '',
		});
	});

	test('save-config unary wire is RemoteAgentService.SaveConfig only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcSaveConfigUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeSaveConfigRequest\b/.test(source));
		assert.ok(/\bdecodeSaveConfigResponse\b/.test(source));
		assert.ok(/\bencodePresentMessageField\b/.test(source));
		assert.ok(/\bencodeInt32Field\b/.test(source));
		assert.ok(/\bencodeStringField\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(/\blastString\b/.test(source));
		assert.ok(/\blastBytes\b/.test(source));
		assert.ok(/\bdecodeCheckConnectionResponse\b/.test(source));
		assert.ok(!/\bdecodeEndpoint\b|\bencodeEndpoint\b|\bdecodeAuthConfig\b|\bdecodePermissionDelegate\b|\bdecodeHealthCheck\b/.test(source));
		assert.ok(!/\bdecodeConnectionReport\b|\bencodeConnectionReport\b/.test(source));
		assert.ok(!/\bdecodeCapabilities\b|\bdecodeLoadMetrics\b|\bdecodeValidationError\b/.test(source));
		assert.ok(!/\bgrpcListConfigsUnaryWire\b|\bgrpcGetConfigUnaryWire\b/.test(source));
		assert.ok(!source.includes('UniverseAgent-WorkTrees'));
		assert.ok(!/\bListConfigs\b|\bGetConfig\b|\bDeleteConfig\b|\bReload\b/.test(source));
		assert.ok(!/\bSetMaintenance\b|\bExitMaintenance\b|\bResetError\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bResolveAnchor\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('saveRemoteAgentConfig uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const save = extractAsyncMethod(source, 'saveRemoteAgentConfig');
		assert.ok(save.includes('makeUnaryBytesClient'), 'saveRemoteAgentConfig must use makeUnaryBytesClient');
		assert.ok(save.includes('encodeSaveConfigRequest'), 'saveRemoteAgentConfig must call encodeSaveConfigRequest');
		assert.ok(save.includes('decodeSaveConfigResponse'), 'saveRemoteAgentConfig must call decodeSaveConfigResponse');
		assert.ok(save.includes('mapSaveRemoteAgentConfigResponse'), 'saveRemoteAgentConfig still calls mapSaveRemoteAgentConfigResponse');
		assert.ok(!save.includes('makeUnaryClient<'), 'saveRemoteAgentConfig must not use JSON makeUnaryClient');
		assert.ok(!save.includes('JSON.stringify'), 'saveRemoteAgentConfig must not JSON.stringify');
		assert.ok(source.includes('grpcSaveConfigUnaryWire'));
		assert.ok(!/\bWatch\b/.test(save));
		assert.ok(!/\bSaveSkillContent\b/.test(save));
		assert.ok(!/\bResolveTurn\b/.test(save));
		assert.ok(!/\bResolveAnchor\b/.test(save));

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
	});
});

function sampleConfig(overrides: Partial<UniverseAgentRemoteAgentConfig>): UniverseAgentRemoteAgentConfig {
	return {
		id: 'cfg-1',
		name: 'Node A',
		description: 'remote node',
		enabled: true,
		endpoint: {
			host: 'unused-host',
			port: 443,
			tls: true,
			tlsCertPath: '/unused.pem',
		},
		auth: {
			type: 'API_KEY',
			apiKeyRef: 'unused-key',
			tokenRef: 'unused-token',
		},
		tags: ['prod'],
		maxConcurrentSessions: 4,
		sessionLifecycle: 'POOLED',
		defaultPermissionDelegate: {
			mode: 'DENY_ALL',
			whitelist: [{
				toolName: 'unused-tool',
				argConditions: [{
					field: 'unused-field',
					operator: 'equals',
					value: 'unused-value',
				}],
			}],
			budget: {
				maxToolCalls: 9,
				maxTokens: 8,
				timeoutMs: 7,
				windowMs: 6,
				maxBubbleToUserPerDay: 5,
			},
			timeoutPolicy: 'DENY',
			fallback: 'DENY_ALL',
			bubbleTarget: 'USER',
		},
		healthCheck: {
			intervalMs: 1000,
			timeoutMs: 500,
			unhealthyThreshold: 3,
			healthyThreshold: 2,
			useWatch: true,
			degradedErrorRateThreshold: 0.1,
			degradedP99LatencyMs: 200,
		},
		...overrides,
	};
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcSaveConfigUnaryWire.ts')));
	assert.ok(dir, 'grpcSaveConfigUnaryWire.ts not found from cwd or import.meta');
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
