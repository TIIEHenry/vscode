/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentConnectionReport } from '../../common/universeAgentTypes.js';
import { mapConnectionReport } from '../../node/grpc/grpcClientMappersCatalog.js';
import {
	decodeCheckConnectionResponse,
	encodeCheckConnectionRequest,
} from '../../node/grpc/grpcCheckConnectionUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	lastBytes,
	lastString,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService CheckConnection protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeCheckConnectionRequest writes node_id=1 session_params=2 SessionParams 1-7; omits empty/0; not JSON', () => {
		const encoded = encodeCheckConnectionRequest({
			nodeId: 'node-1',
			sessionParams: {
				preferredModel: 'gemini',
				requiredTools: ['bash', 'read'],
				mode: 'agent',
				maxTokens: 8192,
				maxTurns: 20,
				systemPromptSuffix: 'be brief',
				maxExecutionTimeMs: 60000,
			},
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			node_id: 'node-1',
			session_params: {
				preferred_model: 'gemini',
				required_tools: ['bash', 'read'],
				mode: 'agent',
				max_tokens: 8192,
				max_turns: 20,
				system_prompt_suffix: 'be brief',
				max_execution_time_ms: 60000,
			},
		}));
		assert.strictEqual(lastString(readProtoFields(encoded), 1), 'node-1');
		assert.ok(!protoVarints(encoded).has(1));
		const inner = lastBytes(readProtoFields(encoded), 2);
		assert.ok(inner);
		assert.deepStrictEqual(protoStringLists(inner).get(1), ['gemini']);
		assert.deepStrictEqual(protoStringLists(inner).get(2), ['bash', 'read']);
		assert.deepStrictEqual(protoStringLists(inner).get(3), ['agent']);
		assert.strictEqual(protoVarints(inner).get(4), 8192);
		assert.strictEqual(protoVarints(inner).get(5), 20);
		assert.deepStrictEqual(protoStringLists(inner).get(6), ['be brief']);
		assert.strictEqual(protoVarints(inner).get(7), 60000);
		assert.ok(!protoStringLists(inner).has(8));
		assert.ok(!protoVarints(inner).has(1));
		assert.ok(!protoVarints(inner).has(2));
		assert.ok(!protoVarints(inner).has(3));
		assert.ok(!protoVarints(inner).has(6));

		const zerosOmitted = encodeCheckConnectionRequest({
			nodeId: 'node-1',
			sessionParams: {
				preferredModel: '',
				requiredTools: [''],
				mode: '',
				maxTokens: 0,
				maxTurns: 0,
				systemPromptSuffix: '',
				maxExecutionTimeMs: 0,
			},
		});
		assert.strictEqual(lastString(readProtoFields(zerosOmitted), 1), 'node-1');
		const emptyInner = lastBytes(readProtoFields(zerosOmitted), 2);
		assert.ok(emptyInner);
		assert.strictEqual(emptyInner.length, 0);
		assert.deepStrictEqual(Array.from(readProtoFields(emptyInner)), []);
		assert.notStrictEqual(zerosOmitted[0], 0x7b);

		const empty = encodeCheckConnectionRequest({
			nodeId: '',
			sessionParams: {
				preferredModel: '',
				requiredTools: [],
				mode: '',
				maxTokens: 0,
				maxTurns: 0,
				systemPromptSuffix: '',
				maxExecutionTimeMs: 0,
			},
		});
		assert.ok(!lastString(readProtoFields(empty), 1));
		const presentEmpty = lastBytes(readProtoFields(empty), 2);
		assert.ok(presentEmpty);
		assert.strictEqual(presentEmpty.length, 0);
		assert.notStrictEqual(empty[0], 0x7b);
	});

	test('decodeCheckConnectionResponse reads reachable=1 authenticated=2 can_create_session=3 latency_ms=4 capabilities=5 errors=6 load=7; unused unread', () => {
		const model = Buffer.concat([
			encodeStringField(1, 'gemini'),
			encodeStringField(2, 'Gemini'),
			encodeStringField(3, 'google'),
			encodeInt64Field(4, 8192),
			encodeInt32Field(5, 1),
			encodeStringField(6, 'unused-model'),
		]);
		const property = Buffer.concat([
			encodeStringField(1, 'region'),
			encodeStringField(2, 'us'),
			encodeStringField(3, 'unused-entry'),
		]);
		const capabilities = Buffer.concat([
			encodeMessageField(1, model),
			encodeStringField(2, 'bash'),
			encodeStringField(2, 'read'),
			encodeStringField(3, 'agent'),
			encodeStringField(4, '1.2.3'),
			encodeStringField(5, 'v1'),
			encodeMessageField(6, property),
			encodeStringField(7, 'unused-cap'),
		]);
		const error = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'node_id'),
			encodeStringField(3, 'timeout'),
			encodeStringField(4, 'retry'),
			encodeStringField(5, 'unused-error'),
		]);
		const load = Buffer.concat([
			encodeInt32Field(1, 3),
			encodeInt32Field(2, 5),
			encodeInt32Field(3, 40),
			encodeInt64Field(4, 1024),
			encodeStringField(5, 'unused-load'),
		]);
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeInt32Field(2, 1),
			encodeInt32Field(3, 1),
			encodeInt64Field(4, 42),
			encodeMessageField(5, capabilities),
			encodeMessageField(6, error),
			encodeMessageField(7, load),
			encodeStringField(8, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeCheckConnectionResponse(encoded);
		assert.deepStrictEqual(wire, {
			reachable: true,
			authenticated: true,
			can_create_session: true,
			latency_ms: 42,
			capabilities: {
				models: [{
					id: 'gemini',
					name: 'Gemini',
					provider: 'google',
					max_tokens: 8192,
					enabled: true,
				}],
				tools: ['bash', 'read'],
				modes: ['agent'],
				server_version: '1.2.3',
				protocol_version: 'v1',
				properties: { region: 'us' },
			},
			errors: [{
				code: 1,
				field: 'node_id',
				message: 'timeout',
				suggestion: 'retry',
			}],
			load: {
				active_sessions: 3,
				queue_depth: 5,
				cpu_percent: 40,
				memory_used_mb: 1024,
			},
		});
		assert.ok((wire.capabilities?.models?.length ?? 0) > 0);
		assert.ok((wire.errors?.length ?? 0) > 0);
		assert.ok(wire.load);
		assert.ok(!('unused' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		const mapped = mapConnectionReport(wire);
		assert.ok(mapped.capabilities.models.length > 0);
		assert.ok(mapped.errors.length > 0);
		assert.ok(mapped.load.activeSessions > 0);
		assert.deepStrictEqual(mapped, {
			reachable: true,
			authenticated: true,
			canCreateSession: true,
			latencyMs: 42,
			capabilities: {
				models: [{
					id: 'gemini',
					name: 'Gemini',
					provider: 'google',
					maxTokens: 8192,
					enabled: true,
				}],
				tools: ['bash', 'read'],
				modes: ['agent'],
				serverVersion: '1.2.3',
				protocolVersion: 'v1',
				properties: { region: 'us' },
			},
			errors: [{
				code: 'CONNECT_TIMEOUT',
				field: 'node_id',
				message: 'timeout',
				suggestion: 'retry',
			}],
			load: {
				activeSessions: 3,
				queueDepth: 5,
				cpuPercent: 40,
				memoryUsedMb: 1024,
			},
		});

		const omittedFalse = decodeCheckConnectionResponse(encodeInt64Field(4, 7));
		assert.deepStrictEqual(omittedFalse, {
			reachable: undefined,
			authenticated: undefined,
			can_create_session: undefined,
			latency_ms: 7,
			capabilities: undefined,
			errors: [],
			load: undefined,
		});
		assert.deepStrictEqual(mapConnectionReport(omittedFalse), {
			reachable: false,
			authenticated: false,
			canCreateSession: false,
			latencyMs: 7,
			capabilities: emptyCapabilities(),
			errors: [],
			load: emptyLoad(),
		});

		const explicitFalse = decodeCheckConnectionResponse(new Uint8Array([0x08, 0x00]));
		assert.deepStrictEqual(explicitFalse, {
			reachable: false,
			authenticated: undefined,
			can_create_session: undefined,
			latency_ms: undefined,
			capabilities: undefined,
			errors: [],
			load: undefined,
		});
		assert.deepStrictEqual(mapConnectionReport(explicitFalse), {
			reachable: false,
			authenticated: false,
			canCreateSession: false,
			latencyMs: 0,
			capabilities: emptyCapabilities(),
			errors: [],
			load: emptyLoad(),
		});

		const empty = decodeCheckConnectionResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			reachable: undefined,
			authenticated: undefined,
			can_create_session: undefined,
			latency_ms: undefined,
			capabilities: undefined,
			errors: [],
			load: undefined,
		});
		assert.deepStrictEqual(mapConnectionReport(empty), {
			reachable: false,
			authenticated: false,
			canCreateSession: false,
			latencyMs: 0,
			capabilities: emptyCapabilities(),
			errors: [],
			load: emptyLoad(),
		});
	});

	test('check-connection unary wire is RemoteAgentService.CheckConnection only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcCheckConnectionUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeCheckConnectionRequest\b/.test(source));
		assert.ok(/\bdecodeCheckConnectionResponse\b/.test(source));
		assert.ok(/\bencodePresentMessageField\b/.test(source));
		assert.ok(/\bencodeInt32Field\b/.test(source));
		assert.ok(/\bencodeInt64Field\b/.test(source));
		assert.ok(/\bencodeStringField\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(/\blastBytes\b/.test(source));
		assert.ok(/\blastString\b/.test(source));
		assert.ok(/\ballLengthDelimited\b/.test(source));
		assert.ok(/\bdecodeCapabilities\b/.test(source));
		assert.ok(/\bdecodeLoadMetrics\b/.test(source));
		assert.ok(/\bdecodeModelInfo\b/.test(source));
		assert.ok(/\bdecodeValidationError\b/.test(source));
		assert.ok(/\bdecodeStringStringMap\b/.test(source));
		assert.ok(!/\bGetNode\b|\bgrpcGetNodeUnaryWire\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bResolveAnchor\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('checkConnection uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const check = extractAsyncMethod(source, 'checkConnection');
		assert.ok(check.includes('makeUnaryBytesClient'), 'checkConnection must use makeUnaryBytesClient');
		assert.ok(check.includes('encodeCheckConnectionRequest'), 'checkConnection must call encodeCheckConnectionRequest');
		assert.ok(check.includes('decodeCheckConnectionResponse'), 'checkConnection must call decodeCheckConnectionResponse');
		assert.ok(check.includes('mapConnectionReport'), 'checkConnection still calls mapConnectionReport');
		assert.ok(!check.includes('makeUnaryClient<'), 'checkConnection must not use JSON makeUnaryClient');
		assert.ok(!check.includes('JSON.stringify'), 'checkConnection must not JSON.stringify');

		assert.ok(source.includes('grpcCheckConnectionUnaryWire'));
		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveAnchor').includes('makeUnaryBytesClient'));
	});

	test('skip Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor; do not lock siblings', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveAnchor').includes('makeUnaryBytesClient'));
		const watchStart = source.indexOf('\topenWatchConfigStream(');
		assert.ok(watchStart >= 0, 'missing openWatchConfigStream(');
		const watchEnd = source.indexOf('\n\tasync ', watchStart + 1);
		const watchBody = source.slice(watchStart, watchEnd >= 0 ? watchEnd : source.length);
		assert.ok(watchBody.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!watchBody.includes('grpcCheckConnectionUnaryWire'));
	});
});

function emptyCapabilities(): UniverseAgentConnectionReport['capabilities'] {
	return {
		models: [],
		tools: [],
		modes: [],
		serverVersion: '',
		protocolVersion: '',
		properties: {},
	};
}

function emptyLoad(): UniverseAgentConnectionReport['load'] {
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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcCheckConnectionUnaryWire.ts')));
	assert.ok(dir, 'grpcCheckConnectionUnaryWire.ts not found from cwd or import.meta');
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
