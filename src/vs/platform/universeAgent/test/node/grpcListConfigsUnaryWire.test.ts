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
	encodeInt32Field,
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

	test('decodeListConfigsResponse reads configs=1 scalars 1-4, 7-9; nested 5/6/10/11 unread', () => {
		const config = Buffer.concat([
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
				tags: ['prod', 'gpu'],
				max_concurrent_sessions: 4,
				session_lifecycle: 'POOLED',
			}],
		});
		const first = wire.configs?.[0] ?? {};
		assert.ok(!('endpoint' in first));
		assert.ok(!('auth' in first));
		assert.ok(!('default_permission_delegate' in first));
		assert.ok(!('health_check' in first));
		assert.ok(!('unused' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapListConfigsResponse(wire), {
			configs: [{
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
			}],
		});

		const sparse = decodeListConfigsResponse(encodeMessageField(1, encodeStringField(1, 'cfg-2')));
		assert.deepStrictEqual(sparse, {
			configs: [{
				id: 'cfg-2',
				name: undefined,
				description: undefined,
				enabled: undefined,
				tags: [],
				max_concurrent_sessions: undefined,
				session_lifecycle: undefined,
			}],
		});
		assert.ok(!('endpoint' in (sparse.configs?.[0] ?? {})));
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
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bdecodeEndpoint\b|\bencodeEndpoint\b|\bdecodeAuthConfig\b|\bdecodePermissionDelegate\b|\bdecodeHealthCheck\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bResolveAnchor\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('ONLY listConfigs still JSON unary; skip Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const list = extractAsyncMethod(source, 'listConfigs');
		assert.ok(list.includes('makeUnaryClient<'), 'listConfigs still uses JSON makeUnaryClient');
		assert.ok(!list.includes('makeUnaryBytesClient'), 'listConfigs must not use makeUnaryBytesClient this slice');
		assert.ok(!list.includes('encodeListConfigsRequest'), 'listConfigs must not call encodeListConfigsRequest this slice');
		assert.ok(!list.includes('decodeListConfigsResponse'), 'listConfigs must not call decodeListConfigsResponse this slice');
		assert.ok(list.includes('mapListConfigsResponse'), 'listConfigs still calls mapListConfigsResponse');
		assert.ok(list.includes('unary({})'), 'listConfigs still sends empty JSON {}');
		assert.ok(!source.includes('grpcListConfigsUnaryWire'));

		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveAnchor').includes('makeUnaryBytesClient'));
		const watchStart = source.indexOf('\topenWatchConfigStream(');
		assert.ok(watchStart >= 0, 'missing openWatchConfigStream(');
		const watchEnd = source.indexOf('\n\tasync ', watchStart + 1);
		const watchBody = source.slice(watchStart, watchEnd >= 0 ? watchEnd : source.length);
		assert.ok(watchBody.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!watchBody.includes('grpcListConfigsUnaryWire'));
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
