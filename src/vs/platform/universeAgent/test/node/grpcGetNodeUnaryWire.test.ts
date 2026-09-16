/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentRemoteAgentInfo } from '../../common/universeAgentTypes.js';
import {
	decodeGetNodeResponse,
	encodeGetNodeRequest,
	type RemoteAgentInfoWire,
} from '../../node/grpc/grpcGetNodeUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
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

	test('decodeGetNodeResponse reads id=1 name=2 description=3 status=4 endpoint=5 tags=6 last_heartbeat_at=9; capabilities=7 load=8 unused unread', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'node-1'),
			encodeStringField(2, 'Edge GPU'),
			encodeStringField(3, 'remote coder'),
			encodeStringField(4, 'ONLINE'),
			encodeStringField(5, '10.0.0.2:8443'),
			encodeStringField(6, 'gpu'),
			encodeStringField(6, 'prod'),
			encodeMessageField(7, encodeStringField(4, 'unread-server-version')),
			encodeMessageField(8, encodeInt32Field(1, 9)),
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
			last_heartbeat_at: 1700000000,
		});
		assert.ok(!('capabilities' in wire));
		assert.ok(!('load' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.strictEqual(JSON.stringify(wire).includes('unread'), false);
		assert.deepStrictEqual(mapRemoteAgentInfo(wire), {
			id: 'node-1',
			name: 'Edge GPU',
			description: 'remote coder',
			status: 'ONLINE',
			endpoint: '10.0.0.2:8443',
			tags: ['gpu', 'prod'],
			capabilities: emptyCapabilities(),
			load: emptyLoad(),
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
	});

	test('get-node unary wire is RemoteAgentService.GetNode only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcGetNodeUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeGetNodeRequest\b/.test(source));
		assert.ok(/\bdecodeGetNodeResponse\b/.test(source));
		assert.ok(/\bdecodeRemoteAgentInfoScalars\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(/\ballLengthDelimited\b/.test(source));
		assert.ok(!/\bdecodeCapabilities\b|\bdecodeLoadMetrics\b|\bdecodeModelInfo\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('getNode uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
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
	});
});

/** TEST-only mapper: same shape as catalog `mapRemoteAgentInfo` (nested 7/8 unread → empty). */
function mapRemoteAgentInfo(wire: RemoteAgentInfoWire): UniverseAgentRemoteAgentInfo {
	return {
		id: wire.id ?? '',
		name: wire.name ?? '',
		description: wire.description ?? '',
		status: wire.status ?? '',
		endpoint: wire.endpoint ?? '',
		tags: [...(wire.tags ?? [])],
		capabilities: emptyCapabilities(),
		load: emptyLoad(),
		lastHeartbeatAt: requiredInt64(wire.last_heartbeat_at),
	};
}

function requiredInt64(value: number | string | undefined): number {
	if (value === undefined || value === '') {
		return 0;
	}
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

function emptyCapabilities(): UniverseAgentRemoteAgentInfo['capabilities'] {
	return {
		models: [],
		tools: [],
		modes: [],
		serverVersion: '',
		protocolVersion: '',
		properties: {},
	};
}

function emptyLoad(): UniverseAgentRemoteAgentInfo['load'] {
	return {
		activeSessions: 0,
		queueDepth: 0,
		cpuPercent: 0,
		memoryUsedMb: 0,
	};
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
