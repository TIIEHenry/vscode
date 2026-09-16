/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentCreateRemoteSessionResult } from '../../common/universeAgentTypes.js';
import {
	decodeCreateRemoteSessionResponse,
	encodeCreateRemoteSessionRequest,
	type CreateRemoteSessionResponseWire,
} from '../../node/grpc/grpcCreateRemoteSessionUnaryWire.js';
import {
	encodeInt64Field,
	encodeStringField,
	encodeVarint,
	lastBytes,
	lastString,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService CreateRemoteSession protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeCreateRemoteSessionRequest writes node_id=1 mode=2 session_params=3 SessionParams 1-7; omits empty/0; not JSON', () => {
		const encoded = encodeCreateRemoteSessionRequest({
			nodeId: 'node-1',
			mode: 'polling',
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
			mode: 'polling',
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
		assert.strictEqual(lastString(readProtoFields(encoded), 2), 'polling');
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));
		assert.ok(!protoVarints(encoded).has(3));
		const inner = lastBytes(readProtoFields(encoded), 3);
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

		const zerosOmitted = encodeCreateRemoteSessionRequest({
			nodeId: 'node-1',
			mode: 'polling',
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
		assert.strictEqual(lastString(readProtoFields(zerosOmitted), 2), 'polling');
		const emptyInner = lastBytes(readProtoFields(zerosOmitted), 3);
		assert.ok(emptyInner);
		assert.strictEqual(emptyInner.length, 0);
		assert.deepStrictEqual(Array.from(readProtoFields(emptyInner)), []);
		assert.notStrictEqual(zerosOmitted[0], 0x7b);

		const empty = encodeCreateRemoteSessionRequest({
			nodeId: '',
			mode: '',
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
		assert.ok(!lastString(readProtoFields(empty), 2));
		const presentEmpty = lastBytes(readProtoFields(empty), 3);
		assert.ok(presentEmpty);
		assert.strictEqual(presentEmpty.length, 0);
		assert.notStrictEqual(empty[0], 0x7b);
	});

	test('decodeCreateRemoteSessionResponse reads call_id=1 status=2 created_at=3 expires_at=4; unused unread', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'call-1'),
			encodeStringField(2, 'created'),
			encodeInt64Field(3, 1700000000),
			encodeInt64Field(4, 1700003600),
			encodeStringField(5, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeCreateRemoteSessionResponse(encoded);
		assert.deepStrictEqual(wire, {
			call_id: 'call-1',
			status: 'created',
			created_at: 1700000000,
			expires_at: 1700003600,
		});
		assert.ok(!('unused' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapCreateRemoteSessionResponse(wire), {
			callId: 'call-1',
			status: 'created',
			createdAt: 1700000000,
			expiresAt: 1700003600,
		});
	});

	test('decodeCreateRemoteSessionResponse omitted/empty/zero timestamps; lastVarint created_at/expires_at', () => {
		const empty = decodeCreateRemoteSessionResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			call_id: undefined,
			status: undefined,
			created_at: undefined,
			expires_at: undefined,
		});
		assert.deepStrictEqual(mapCreateRemoteSessionResponse(empty), {
			callId: '',
			status: '',
			createdAt: 0,
			expiresAt: 0,
		});

		const unusedOnly = decodeCreateRemoteSessionResponse(encodeStringField(5, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			call_id: undefined,
			status: undefined,
			created_at: undefined,
			expires_at: undefined,
		});
		assert.deepStrictEqual(mapCreateRemoteSessionResponse(unusedOnly), {
			callId: '',
			status: '',
			createdAt: 0,
			expiresAt: 0,
		});

		const lastWins = decodeCreateRemoteSessionResponse(Buffer.concat([
			encodeInt64Field(3, 1),
			encodeInt64Field(3, 1700000000),
			encodeInt64Field(4, 1),
			encodeInt64Field(4, 1700003600),
		]));
		assert.strictEqual(lastWins.created_at, 1700000000);
		assert.strictEqual(lastWins.expires_at, 1700003600);
		assert.strictEqual(mapCreateRemoteSessionResponse(lastWins).createdAt, 1700000000);
		assert.strictEqual(mapCreateRemoteSessionResponse(lastWins).expiresAt, 1700003600);

		const zeroPresent = decodeCreateRemoteSessionResponse(Buffer.concat([
			encodeVarintZero(3),
			encodeVarintZero(4),
		]));
		assert.strictEqual(zeroPresent.created_at, 0);
		assert.strictEqual(zeroPresent.expires_at, 0);
		assert.strictEqual(mapCreateRemoteSessionResponse(zeroPresent).createdAt, 0);
		assert.strictEqual(mapCreateRemoteSessionResponse(zeroPresent).expiresAt, 0);
		assert.strictEqual(encodeInt64Field(3, 0).length, 0);
		assert.strictEqual(encodeInt64Field(4, 0).length, 0);
	});

	test('create-remote-session unary wire is RemoteAgentService.CreateRemoteSession only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcCreateRemoteSessionUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeCreateRemoteSessionRequest\b/.test(source));
		assert.ok(/\bdecodeCreateRemoteSessionResponse\b/.test(source));
		assert.ok(/\bencodePresentMessageField\b/.test(source));
		assert.ok(/\bencodeInt32Field\b/.test(source));
		assert.ok(/\bencodeInt64Field\b/.test(source));
		assert.ok(/\bencodeStringField\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bgrpcCheckConnectionUnaryWire\b/.test(source));
		assert.ok(!source.includes('UniverseAgent-WorkTrees'));
		assert.ok(!/\bDestroyRemoteSession\b|\bGetRemoteSessionStatus\b|\bGetRemoteSessionHistory\b/.test(source));
		assert.ok(!/\bResumeRemoteSession\b|\bCancelRemoteSession\b|\bRemoteChat\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bResolveAnchor\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('ONLY createRemoteSession still JSON unary; skip Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const create = extractAsyncMethod(source, 'createRemoteSession');
		assert.ok(create.includes('makeUnaryClient<'), 'createRemoteSession still uses JSON makeUnaryClient');
		assert.ok(!create.includes('makeUnaryBytesClient'), 'createRemoteSession must not use makeUnaryBytesClient this slice');
		assert.ok(!create.includes('encodeCreateRemoteSessionRequest'), 'createRemoteSession must not call encodeCreateRemoteSessionRequest this slice');
		assert.ok(!create.includes('decodeCreateRemoteSessionResponse'), 'createRemoteSession must not call decodeCreateRemoteSessionResponse this slice');
		assert.ok(create.includes('mapCreateRemoteSessionResponse'), 'createRemoteSession still calls mapCreateRemoteSessionResponse');
		assert.ok(create.includes('node_id'), 'createRemoteSession still sends node_id JSON key');
		assert.ok(create.includes('session_params'), 'createRemoteSession still sends session_params JSON key');
		assert.ok(create.includes('preferred_model'), 'createRemoteSession still sends preferred_model JSON key');
		assert.ok(!source.includes('grpcCreateRemoteSessionUnaryWire'));
		assert.ok(!/\bWatch\b/.test(create));
		assert.ok(!/\bSaveSkillContent\b/.test(create));
		assert.ok(!/\bResolveTurn\b/.test(create));
		assert.ok(!/\bResolveAnchor\b/.test(create));

		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveAnchor').includes('makeUnaryBytesClient'));
		const watchStart = source.indexOf('\topenWatchConfigStream(');
		assert.ok(watchStart >= 0, 'missing openWatchConfigStream(');
		const watchEnd = source.indexOf('\n\tasync ', watchStart + 1);
		const watchBody = source.slice(watchStart, watchEnd >= 0 ? watchEnd : source.length);
		assert.ok(watchBody.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!watchBody.includes('grpcCreateRemoteSessionUnaryWire'));
	});
});

/** TEST-only mapper: same shape as catalog `mapCreateRemoteSessionResponse`. */
function mapCreateRemoteSessionResponse(wire: CreateRemoteSessionResponseWire): UniverseAgentCreateRemoteSessionResult {
	return {
		callId: wire.call_id ?? '',
		status: wire.status ?? '',
		createdAt: requiredInt64(wire.created_at),
		expiresAt: requiredInt64(wire.expires_at),
	};
}

function requiredInt64(value: number | string | undefined): number {
	if (value === undefined || value === '') {
		return 0;
	}
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcCreateRemoteSessionUnaryWire.ts')));
	assert.ok(dir, 'grpcCreateRemoteSessionUnaryWire.ts not found from cwd or import.meta');
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
