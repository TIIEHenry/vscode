/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
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
	lastFixed64,
	lastString,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService SaveConfig protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeSaveConfigRequest writes nested config scalars 1-4,7-9 and nested 5/6/10/11; omits empty/0/false; not JSON', () => {
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
		assert.ok(!protoVarints(inner).has(1));
		assert.ok(!protoVarints(inner).has(2));
		assert.ok(!protoVarints(inner).has(3));
		assert.ok(!protoVarints(inner).has(5));
		assert.ok(!protoVarints(inner).has(6));

		const endpoint = lastBytes(readProtoFields(inner), 5);
		assert.ok(endpoint);
		assert.strictEqual(lastString(readProtoFields(endpoint), 1), 'unused-host');
		assert.strictEqual(protoVarints(endpoint).get(2), 443);
		assert.strictEqual(protoVarints(endpoint).get(3), 1);
		assert.strictEqual(lastString(readProtoFields(endpoint), 4), '/unused.pem');

		const auth = lastBytes(readProtoFields(inner), 6);
		assert.ok(auth);
		assert.strictEqual(lastString(readProtoFields(auth), 1), 'API_KEY');
		assert.strictEqual(lastString(readProtoFields(auth), 2), 'unused-key');
		assert.strictEqual(lastString(readProtoFields(auth), 3), 'unused-token');

		const delegate = lastBytes(readProtoFields(inner), 10);
		assert.ok(delegate);
		assert.strictEqual(lastString(readProtoFields(delegate), 1), 'DENY_ALL');
		assert.strictEqual(lastString(readProtoFields(delegate), 4), 'DENY');
		assert.strictEqual(lastString(readProtoFields(delegate), 5), 'DENY_ALL');
		assert.strictEqual(lastString(readProtoFields(delegate), 6), 'USER');
		const whitelist = lastBytes(readProtoFields(delegate), 2);
		assert.ok(whitelist);
		assert.strictEqual(lastString(readProtoFields(whitelist), 1), 'unused-tool');
		const arg = lastBytes(readProtoFields(whitelist), 2);
		assert.ok(arg);
		assert.strictEqual(lastString(readProtoFields(arg), 1), 'unused-field');
		assert.strictEqual(lastString(readProtoFields(arg), 2), 'equals');
		assert.strictEqual(lastString(readProtoFields(arg), 3), 'unused-value');
		const budget = lastBytes(readProtoFields(delegate), 3);
		assert.ok(budget);
		assert.strictEqual(protoVarints(budget).get(1), 9);
		assert.strictEqual(protoVarints(budget).get(2), 8);
		assert.strictEqual(protoVarints(budget).get(3), 7);
		assert.strictEqual(protoVarints(budget).get(4), 6);
		assert.strictEqual(protoVarints(budget).get(5), 5);

		const health = lastBytes(readProtoFields(inner), 11);
		assert.ok(health);
		assert.strictEqual(protoVarints(health).get(1), 1000);
		assert.strictEqual(protoVarints(health).get(2), 500);
		assert.strictEqual(protoVarints(health).get(3), 3);
		assert.strictEqual(protoVarints(health).get(4), 2);
		assert.strictEqual(protoVarints(health).get(5), 1);
		assert.strictEqual(lastFixed64(readProtoFields(health), 6), 0.1);
		assert.strictEqual(protoVarints(health).get(7), 200);

		const omittedFalse = encodeSaveConfigRequest({
			config: sampleConfig({
				id: 'cfg-1',
				name: '',
				description: '',
				enabled: false,
				tags: [],
				maxConcurrentSessions: 0,
				sessionLifecycle: '',
				...emptyNested(),
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
		assert.ok(!lastBytes(readProtoFields(sparseInner), 5));
		assert.ok(!lastBytes(readProtoFields(sparseInner), 6));
		assert.ok(!protoStringLists(sparseInner).has(7));
		assert.ok(!protoVarints(sparseInner).has(8));
		assert.ok(!protoStringLists(sparseInner).has(9));
		assert.ok(!lastBytes(readProtoFields(sparseInner), 10));
		assert.ok(!lastBytes(readProtoFields(sparseInner), 11));

		const empty = encodeSaveConfigRequest({
			config: sampleConfig({
				id: '',
				name: '',
				description: '',
				enabled: false,
				tags: [],
				maxConcurrentSessions: 0,
				sessionLifecycle: '',
				...emptyNested(),
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
				models: undefined,
				tools: undefined,
				modes: undefined,
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

function emptyNested(): Pick<UniverseAgentRemoteAgentConfig, 'endpoint' | 'auth' | 'defaultPermissionDelegate' | 'healthCheck'> {
	return {
		endpoint: {
			host: '',
			port: 0,
			tls: false,
			tlsCertPath: '',
		},
		auth: {
			type: '',
			apiKeyRef: '',
			tokenRef: '',
		},
		defaultPermissionDelegate: {
			mode: '',
			whitelist: [],
			budget: {
				maxToolCalls: 0,
				maxTokens: 0,
				timeoutMs: 0,
				windowMs: 0,
				maxBubbleToUserPerDay: 0,
			},
			timeoutPolicy: '',
			fallback: '',
			bubbleTarget: '',
		},
		healthCheck: {
			intervalMs: 0,
			timeoutMs: 0,
			unhealthyThreshold: 0,
			healthyThreshold: 0,
			useWatch: false,
			degradedErrorRateThreshold: 0,
			degradedP99LatencyMs: 0,
		},
	};
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
