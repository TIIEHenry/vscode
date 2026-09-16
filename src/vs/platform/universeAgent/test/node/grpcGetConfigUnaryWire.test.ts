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
	encodeInt32Field,
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

	test('decodeGetConfigResponse reads scalars 1-4, 7-9; nested 5/6/10/11 unread', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'cfg-1'),
			encodeStringField(2, 'Node A'),
			encodeStringField(3, 'remote node'),
			encodeInt32Field(4, 1),
			encodeMessageField(5, encodeStringField(1, 'unused-host')),
			encodeMessageField(6, encodeStringField(1, 'unused-auth')),
			encodeStringField(7, 'prod'),
			encodeStringField(7, 'gpu'),
			encodeInt32Field(8, 4),
			encodeStringField(9, 'POOLED'),
			encodeMessageField(10, encodeStringField(1, 'unused-delegate')),
			encodeMessageField(11, encodeStringField(1, 'unused-health')),
			encodeStringField(12, 'unused-config'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeGetConfigResponse(encoded);
		assert.deepStrictEqual(wire, {
			id: 'cfg-1',
			name: 'Node A',
			description: 'remote node',
			enabled: true,
			tags: ['prod', 'gpu'],
			max_concurrent_sessions: 4,
			session_lifecycle: 'POOLED',
		});
		assert.ok(!('endpoint' in wire));
		assert.ok(!('auth' in wire));
		assert.ok(!('default_permission_delegate' in wire));
		assert.ok(!('health_check' in wire));
		assert.ok(!('unused' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapRemoteAgentConfig(wire), {
			id: 'cfg-1',
			name: 'Node A',
			description: 'remote node',
			enabled: true,
			endpoint: emptyEndpoint(),
			auth: emptyAuth(),
			tags: ['prod', 'gpu'],
			maxConcurrentSessions: 4,
			sessionLifecycle: 'POOLED',
			defaultPermissionDelegate: emptyDelegate(),
			healthCheck: emptyHealth(),
		});

		const sparse = decodeGetConfigResponse(encodeStringField(1, 'cfg-2'));
		assert.deepStrictEqual(sparse, {
			id: 'cfg-2',
			name: undefined,
			description: undefined,
			enabled: undefined,
			tags: [],
			max_concurrent_sessions: undefined,
			session_lifecycle: undefined,
		});
		assert.ok(!('endpoint' in sparse));
		assert.ok(!('auth' in sparse));
		assert.ok(!('default_permission_delegate' in sparse));
		assert.ok(!('health_check' in sparse));
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
			tags: [],
			max_concurrent_sessions: undefined,
			session_lifecycle: undefined,
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
		assert.ok(!/\bdecodeEndpoint\b|\bencodeEndpoint\b|\bdecodeAuthConfig\b|\bdecodePermissionDelegate\b|\bdecodeHealthCheck\b/.test(source));
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
