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
import {
	decodeCheckConnectionResponse,
	encodeCheckConnectionRequest,
	type ConnectionReportWire,
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

	test('decodeCheckConnectionResponse reads reachable=1 authenticated=2 can_create_session=3 latency_ms=4; field 5/6/7 unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeInt32Field(2, 1),
			encodeInt32Field(3, 1),
			encodeInt64Field(4, 42),
			encodeMessageField(5, encodeStringField(4, 'unused-server-version')),
			encodeMessageField(6, encodeStringField(3, 'unused-error')),
			encodeMessageField(7, encodeInt32Field(1, 9)),
			encodeStringField(8, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeCheckConnectionResponse(encoded);
		assert.deepStrictEqual(wire, {
			reachable: true,
			authenticated: true,
			can_create_session: true,
			latency_ms: 42,
		});
		assert.ok(!('capabilities' in wire));
		assert.ok(!('errors' in wire));
		assert.ok(!('load' in wire));
		assert.ok(!('unused' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapConnectionReport(wire), {
			reachable: true,
			authenticated: true,
			canCreateSession: true,
			latencyMs: 42,
			capabilities: emptyCapabilities(),
			errors: [],
			load: emptyLoad(),
		});

		const omittedFalse = decodeCheckConnectionResponse(encodeInt64Field(4, 7));
		assert.deepStrictEqual(omittedFalse, {
			reachable: undefined,
			authenticated: undefined,
			can_create_session: undefined,
			latency_ms: 7,
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
		});
		assert.ok(!('capabilities' in empty));
		assert.ok(!('errors' in empty));
		assert.ok(!('load' in empty));
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
		assert.ok(!/\bdecodeCapabilities\b|\bdecodeLoadMetrics\b|\bdecodeModelInfo\b|\bdecodeValidationError\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bResolveAnchor\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('ONLY checkConnection still JSON unary; skip Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const check = extractAsyncMethod(source, 'checkConnection');
		assert.ok(check.includes('makeUnaryClient<'), 'checkConnection still uses JSON makeUnaryClient');
		assert.ok(!check.includes('makeUnaryBytesClient'), 'checkConnection must not use makeUnaryBytesClient this slice');
		assert.ok(!check.includes('encodeCheckConnectionRequest'), 'checkConnection must not call encodeCheckConnectionRequest this slice');
		assert.ok(!check.includes('decodeCheckConnectionResponse'), 'checkConnection must not call decodeCheckConnectionResponse this slice');
		assert.ok(check.includes('mapConnectionReport'), 'checkConnection still calls mapConnectionReport');
		assert.ok(check.includes('node_id'), 'checkConnection still sends node_id JSON key');
		assert.ok(check.includes('session_params'), 'checkConnection still sends session_params JSON key');
		assert.ok(check.includes('preferred_model'), 'checkConnection still sends preferred_model JSON key');
		assert.ok(!source.includes('grpcCheckConnectionUnaryWire'));
		assert.ok(!/\bWatch\b/.test(check));
	});

	test('skip Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor; do not lock siblings', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
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

/** TEST-only mapper: missing nested capabilities/errors/load → empty defaults. */
function mapConnectionReport(wire: ConnectionReportWire): UniverseAgentConnectionReport {
	return {
		reachable: wire.reachable === true,
		authenticated: wire.authenticated === true,
		canCreateSession: wire.can_create_session === true,
		latencyMs: requiredInt64(wire.latency_ms),
		capabilities: emptyCapabilities(),
		errors: [],
		load: emptyLoad(),
	};
}

function requiredInt64(value: number | string | undefined): number {
	if (value === undefined || value === '') {
		return 0;
	}
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

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
