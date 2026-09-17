/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapListConfigsResponse } from '../../node/grpc/grpcClientMappersCatalog.js';
import {
	decodeListConfigsResponse,
	encodeListConfigsRequest,
} from '../../node/grpc/grpcListConfigsUnaryWire.js';
import {
	encodeDouble,
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService ListConfigs protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeListConfigsRequest is empty proto, not JSON {}', () => {
		const encoded = encodeListConfigsRequest();
		assert.strictEqual(encoded.length, 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), '{}');
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({}));
		assert.deepStrictEqual(Array.from(readProtoFields(encoded)), []);
	});

	test('decodeListConfigsResponse reads configs=1 scalars 1-4, 7-9 and nested endpoint=5 auth=6 default_permission_delegate=10 health_check=11', () => {
		const config = Buffer.concat([
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
		const encoded = Buffer.concat([
			encodeMessageField(1, config),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeListConfigsResponse(encoded);
		assert.deepStrictEqual(wire, {
			configs: [{
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
			}],
		});
		const first = wire.configs?.[0] ?? {};
		assert.ok('endpoint' in first);
		assert.ok('auth' in first);
		assert.ok('default_permission_delegate' in first);
		assert.ok('health_check' in first);
		assert.ok(!('unused' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapListConfigsResponse(wire), {
			configs: [{
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
			}],
		});

		const sparse = decodeListConfigsResponse(encodeMessageField(1, encodeStringField(1, 'cfg-2')));
		assert.deepStrictEqual(sparse, {
			configs: [{
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
			}],
		});
		assert.deepStrictEqual(mapListConfigsResponse(sparse), {
			configs: [{
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
			}],
		});

		const empty = decodeListConfigsResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			configs: [],
		});
		assert.deepStrictEqual(mapListConfigsResponse(empty), {
			configs: [],
		});
	});

	test('list-configs unary wire is RemoteAgentService.ListConfigs only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcListConfigsUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeListConfigsRequest\b/.test(source));
		assert.ok(/\bdecodeListConfigsResponse\b/.test(source));
		assert.ok(/\ballLengthDelimited\b/.test(source));
		assert.ok(/\bdecodeGetConfigResponse\b/.test(source));
		assert.ok(/\bgrpcGetConfigUnaryWire\b/.test(source));
		assert.ok(!/\bdecodeEndpoint\b|\bencodeEndpoint\b|\bdecodeAuthConfig\b|\bdecodePermissionDelegate\b|\bdecodeHealthCheck\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bResolveAnchor\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('listConfigs uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const list = extractAsyncMethod(source, 'listConfigs');
		assert.ok(list.includes('makeUnaryBytesClient'), 'listConfigs must use makeUnaryBytesClient');
		assert.ok(list.includes('encodeListConfigsRequest'), 'listConfigs must call encodeListConfigsRequest');
		assert.ok(list.includes('decodeListConfigsResponse'), 'listConfigs must call decodeListConfigsResponse');
		assert.ok(list.includes('mapListConfigsResponse'), 'listConfigs still calls mapListConfigsResponse');
		assert.ok(!list.includes('makeUnaryClient<'), 'listConfigs must not use JSON makeUnaryClient');
		assert.ok(!list.includes('JSON.stringify'), 'listConfigs must not JSON.stringify');

		assert.ok(source.includes('grpcListConfigsUnaryWire'));
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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcListConfigsUnaryWire.ts')));
	assert.ok(dir, 'grpcListConfigsUnaryWire.ts not found from cwd or import.meta');
	return dir;
}

function extractAsyncMethod(source: string, name: string): string {
	const start = source.indexOf(`\tasync ${name}(`);
	assert.ok(start >= 0, `missing async ${name}(`);
	const nextAsync = source.indexOf('\n\tasync ', start + 1);
	const end = nextAsync >= 0 ? nextAsync : source.length;
	return source.slice(start, end);
}
