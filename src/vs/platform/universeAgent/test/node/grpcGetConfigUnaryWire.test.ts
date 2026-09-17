/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapRemoteAgentConfig } from '../../node/grpc/grpcClientMappersCatalog.js';
import {
	decodeGetConfigResponse,
	encodeGetConfigRequest,
} from '../../node/grpc/grpcGetConfigUnaryWire.js';
import {
	encodeDouble,
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService GetConfig protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeGetConfigRequest writes node_id=1; omits empty; not JSON', () => {
		const encoded = encodeGetConfigRequest({
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

		assert.strictEqual(encodeGetConfigRequest({
			nodeId: '',
		}).length, 0);
	});

	test('decodeGetConfigResponse reads scalars 1-4, 7-9 and nested endpoint=5 auth=6 default_permission_delegate=10 health_check=11', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'cfg-1'),
			encodeStringField(2, 'Node A'),
			encodeStringField(3, 'remote node'),
			encodeInt32Field(4, 1),
			encodeMessageField(5, nestedEndpointBytes()),
			encodeMessageField(6, nestedAuthBytes()),
			encodeStringField(7, 'prod'),
			encodeStringField(7, 'gpu'),
			encodeInt32Field(8, 4),
			encodeStringField(9, 'POOLED'),
			encodeMessageField(10, nestedDelegateBytes()),
			encodeMessageField(11, nestedHealthBytes()),
			encodeStringField(12, 'unused-config'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeGetConfigResponse(encoded);
		assert.deepStrictEqual(wire, {
			id: 'cfg-1',
			name: 'Node A',
			description: 'remote node',
			enabled: true,
			endpoint: {
				host: '10.0.0.2',
				port: 8443,
				tls: true,
				tls_cert_path: '/ca.pem',
			},
			auth: {
				type: 'API_KEY',
				api_key_ref: 'env:KEY',
				token_ref: 'env:TOKEN',
			},
			tags: ['prod', 'gpu'],
			max_concurrent_sessions: 4,
			session_lifecycle: 'POOLED',
			default_permission_delegate: {
				mode: 'WHITELIST_VERIFIED',
				whitelist: [{
					tool_name: 'bash',
					arg_conditions: [{
						field: 'command',
						operator: 'starts_with',
						value: 'ls',
					}],
				}],
				budget: {
					max_tool_calls: 9,
					max_tokens: 8,
					timeout_ms: 7,
					window_ms: 6,
					max_bubble_to_user_per_day: 5,
				},
				timeout_policy: 'DENY',
				fallback: 'DENY_ALL',
				bubble_target: 'USER',
			},
			health_check: {
				interval_ms: 1000,
				timeout_ms: 500,
				unhealthy_threshold: 3,
				healthy_threshold: 2,
				use_watch: true,
				degraded_error_rate_threshold: 1.5,
				degraded_p99_latency_ms: 200,
			},
		});
		assert.ok('endpoint' in wire);
		assert.ok('auth' in wire);
		assert.ok('default_permission_delegate' in wire);
		assert.ok('health_check' in wire);
		assert.ok(!('unused' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapRemoteAgentConfig(wire), {
			id: 'cfg-1',
			name: 'Node A',
			description: 'remote node',
			enabled: true,
			endpoint: {
				host: '10.0.0.2',
				port: 8443,
				tls: true,
				tlsCertPath: '/ca.pem',
			},
			auth: {
				type: 'API_KEY',
				apiKeyRef: 'env:KEY',
				tokenRef: 'env:TOKEN',
			},
			tags: ['prod', 'gpu'],
			maxConcurrentSessions: 4,
			sessionLifecycle: 'POOLED',
			defaultPermissionDelegate: {
				mode: 'WHITELIST_VERIFIED',
				whitelist: [{
					toolName: 'bash',
					argConditions: [{
						field: 'command',
						operator: 'starts_with',
						value: 'ls',
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
				degradedErrorRateThreshold: 1.5,
				degradedP99LatencyMs: 200,
			},
		});

		const sparse = decodeGetConfigResponse(encodeStringField(1, 'cfg-2'));
		assert.deepStrictEqual(sparse, {
			id: 'cfg-2',
			name: undefined,
			description: undefined,
			enabled: undefined,
			endpoint: undefined,
			auth: undefined,
			tags: [],
			max_concurrent_sessions: undefined,
			session_lifecycle: undefined,
			default_permission_delegate: undefined,
			health_check: undefined,
		});
		assert.deepStrictEqual(mapRemoteAgentConfig(sparse), {
			id: 'cfg-2',
			name: '',
			description: '',
			enabled: false,
			endpoint: emptyEndpoint(),
			auth: emptyAuth(),
			tags: [],
			maxConcurrentSessions: 0,
			sessionLifecycle: '',
			defaultPermissionDelegate: emptyDelegate(),
			healthCheck: emptyHealth(),
		});

		const empty = decodeGetConfigResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			id: undefined,
			name: undefined,
			description: undefined,
			enabled: undefined,
			endpoint: undefined,
			auth: undefined,
			tags: [],
			max_concurrent_sessions: undefined,
			session_lifecycle: undefined,
			default_permission_delegate: undefined,
			health_check: undefined,
		});
		assert.deepStrictEqual(mapRemoteAgentConfig(empty), {
			id: '',
			name: '',
			description: '',
			enabled: false,
			endpoint: emptyEndpoint(),
			auth: emptyAuth(),
			tags: [],
			maxConcurrentSessions: 0,
			sessionLifecycle: '',
			defaultPermissionDelegate: emptyDelegate(),
			healthCheck: emptyHealth(),
		});
	});

	test('get-config unary wire is RemoteAgentService.GetConfig only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcGetConfigUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeGetConfigRequest\b/.test(source));
		assert.ok(/\bdecodeGetConfigResponse\b/.test(source));
		assert.ok(/\ballLengthDelimited\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(/\blastBytes\b/.test(source));
		assert.ok(/\blastFixed64\b/.test(source));
		assert.ok(/\bdecodeEndpoint\b/.test(source));
		assert.ok(/\bdecodeAuthConfig\b/.test(source));
		assert.ok(/\bdecodePermissionDelegate\b/.test(source));
		assert.ok(/\bdecodeWhitelistEntry\b/.test(source));
		assert.ok(/\bdecodeArgCondition\b/.test(source));
		assert.ok(/\bdecodePermissionBudget\b/.test(source));
		assert.ok(/\bdecodeHealthCheckConfig\b/.test(source));
		assert.ok(!/\bencodeEndpoint\b|\bencodeAuthConfig\b|\bencodePermissionDelegate\b|\bencodeHealthCheckConfig\b/.test(source));
		assert.ok(!/\bgrpcListConfigsUnaryWire\b/.test(source));
		assert.ok(!source.includes('UniverseAgent-WorkTrees'));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bResolveAnchor\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('getRemoteAgentConfig uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const getConfig = extractAsyncMethod(source, 'getRemoteAgentConfig');
		assert.ok(getConfig.includes('makeUnaryBytesClient'), 'getRemoteAgentConfig must use makeUnaryBytesClient');
		assert.ok(getConfig.includes('encodeGetConfigRequest'), 'getRemoteAgentConfig must call encodeGetConfigRequest');
		assert.ok(getConfig.includes('decodeGetConfigResponse'), 'getRemoteAgentConfig must call decodeGetConfigResponse');
		assert.ok(getConfig.includes('mapRemoteAgentConfig'), 'getRemoteAgentConfig still calls mapRemoteAgentConfig');
		assert.ok(!getConfig.includes('makeUnaryClient<'), 'getRemoteAgentConfig must not use JSON makeUnaryClient');
		assert.ok(!getConfig.includes('JSON.stringify'), 'getRemoteAgentConfig must not JSON.stringify');

		assert.ok(source.includes('grpcGetConfigUnaryWire'));
		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
	});
});

function emptyEndpoint() {
	return {
		host: '',
		port: 0,
		tls: false,
		tlsCertPath: '',
	};
}

function emptyAuth() {
	return {
		type: '',
		apiKeyRef: '',
		tokenRef: '',
	};
}

function emptyDelegate() {
	return {
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
	};
}

function emptyHealth() {
	return {
		intervalMs: 0,
		timeoutMs: 0,
		unhealthyThreshold: 0,
		healthyThreshold: 0,
		useWatch: false,
		degradedErrorRateThreshold: 0,
		degradedP99LatencyMs: 0,
	};
}

function nestedEndpointBytes(): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, '10.0.0.2'),
		encodeInt32Field(2, 8443),
		encodeInt32Field(3, 1),
		encodeStringField(4, '/ca.pem'),
		encodeStringField(5, 'unused-endpoint'),
	]);
}

function nestedAuthBytes(): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, 'API_KEY'),
		encodeStringField(2, 'env:KEY'),
		encodeStringField(3, 'env:TOKEN'),
		encodeStringField(4, 'unused-auth'),
	]);
}

function nestedDelegateBytes(): Uint8Array {
	const arg = Buffer.concat([
		encodeStringField(1, 'command'),
		encodeStringField(2, 'starts_with'),
		encodeStringField(3, 'ls'),
		encodeStringField(4, 'unused-arg'),
	]);
	const whitelist = Buffer.concat([
		encodeStringField(1, 'bash'),
		encodeMessageField(2, arg),
		encodeStringField(3, 'unused-whitelist'),
	]);
	const budget = Buffer.concat([
		encodeInt64Field(1, 9),
		encodeInt64Field(2, 8),
		encodeInt64Field(3, 7),
		encodeInt64Field(4, 6),
		encodeInt32Field(5, 5),
		encodeStringField(6, 'unused-budget'),
	]);
	return Buffer.concat([
		encodeStringField(1, 'WHITELIST_VERIFIED'),
		encodeMessageField(2, whitelist),
		encodeMessageField(3, budget),
		encodeStringField(4, 'DENY'),
		encodeStringField(5, 'DENY_ALL'),
		encodeStringField(6, 'USER'),
		encodeStringField(7, 'unused-delegate'),
	]);
}

function nestedHealthBytes(): Uint8Array {
	return Buffer.concat([
		encodeInt32Field(1, 1000),
		encodeInt32Field(2, 500),
		encodeInt32Field(3, 3),
		encodeInt32Field(4, 2),
		encodeInt32Field(5, 1),
		encodeDouble(6, 1.5),
		encodeInt32Field(7, 200),
		encodeStringField(8, 'unused-health'),
	]);
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcGetConfigUnaryWire.ts')));
	assert.ok(dir, 'grpcGetConfigUnaryWire.ts not found from cwd or import.meta');
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
