/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapResolveAnchorResponse, mapResolveTurnResponse } from '../../node/grpc/grpcClientMappers.js';
import {
	decodeResolveAnchorResponse,
	decodeResolveTurnResponse,
	encodeResolveAnchorRequest,
	encodeResolveTurnRequest,
} from '../../node/grpc/grpcSessionResolveUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodePresentMessageField,
	encodeStringField,
	encodeVarint,
	lastBytes,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc SessionService ResolveTurn/ResolveAnchor protobuf unary wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeResolveTurnRequest writes session_id=1 turn_id=2 current_leaf_turn_id=3; omits empty; not JSON', () => {
		const encoded = encodeResolveTurnRequest({ sessionId: 'sess-1', turnId: 'turn-9', currentLeafTurnId: 'leaf-3' });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.strictEqual(protoStrings(encoded).get(2), 'turn-9');
		assert.strictEqual(protoStrings(encoded).get(3), 'leaf-3');
		assert.ok(!protoVarints(encoded).has(1));

		const blankLeaf = encodeResolveTurnRequest({ sessionId: 'sess-1', turnId: 'turn-9', currentLeafTurnId: '' });
		assert.strictEqual(protoStrings(blankLeaf).get(1), 'sess-1');
		assert.strictEqual(protoStrings(blankLeaf).get(2), 'turn-9');
		assert.ok(!protoStrings(blankLeaf).has(3));

		assert.strictEqual(encodeResolveTurnRequest({ sessionId: '', turnId: '', currentLeafTurnId: '' }).length, 0);
	});

	test('decodeResolveTurnResponse reads hit/tombstone/expired; empty hit stays hit; maps through mapResolveTurnResponse', () => {
		const envelope = Buffer.concat([
			encodeStringField(1, 'env-1'),
			encodeStringField(2, 'sess-1'),
			encodeInt64Field(3, 7),
			encodeStringField(9, 'unused-envelope'),
		]);
		const hit = Buffer.concat([
			encodePresentMessageField(1, envelope),
			encodeInt32Field(2, 2),
			encodeVarintZero(3),
			encodeStringField(9, 'unused-hit'),
		]);
		const encoded = Buffer.concat([
			encodePresentMessageField(1, hit),
			encodeStringField(9, 'unused-response'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeResolveTurnResponse(encoded);
		assert.deepStrictEqual(wire, {
			hit: {
				envelope: { id: 'env-1', seq: 7, session_id: 'sess-1' },
				presence: 2,
				generation: 0,
			},
		});
		assert.deepStrictEqual(mapResolveTurnResponse(wire), {
			kind: 'hit',
			envelope: { id: 'env-1', seq: 7, session_id: 'sess-1' },
			presence: 'ENVELOPE_RECORD_PRESENCE_ACTIVE_OFF_PATH',
			generation: 0,
		});

		const emptyHit = decodeResolveTurnResponse(encodePresentMessageField(1, new Uint8Array(0)));
		assert.deepStrictEqual(emptyHit, { hit: {} });
		assert.deepStrictEqual(mapResolveTurnResponse(emptyHit), {
			kind: 'hit',
			envelope: {},
			presence: 'ENVELOPE_RECORD_PRESENCE_UNSPECIFIED',
		});

		const tombstone = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeStringField(2, 'env-2'),
			encodeVarintZero(3),
			encodePresentMessageField(4, new Uint8Array(0)),
			encodeVarintZero(5),
		]);
		const tombstoneWire = decodeResolveTurnResponse(encodePresentMessageField(2, tombstone));
		assert.deepStrictEqual(tombstoneWire.tombstone, {
			session_id: 'sess-1',
			envelope_id: 'env-2',
			seq: 0,
			turn_id: '',
			generation: 0,
		});
		assert.deepStrictEqual(mapResolveTurnResponse(tombstoneWire), {
			kind: 'tombstone',
			sessionId: 'sess-1',
			envelopeId: 'env-2',
			seq: 0,
			turnId: '',
			generation: 0,
		});

		const expiredAnchor = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeStringField(2, 'env-3'),
			encodeVarintZero(3),
		]);
		const expiredWire = decodeResolveTurnResponse(encodePresentMessageField(3, encodePresentMessageField(1, expiredAnchor)));
		assert.deepStrictEqual(mapResolveTurnResponse(expiredWire), {
			kind: 'expired',
			sessionId: 'sess-1',
			envelopeId: 'env-3',
			generation: 0,
		});

		assert.deepStrictEqual(mapResolveTurnResponse(decodeResolveTurnResponse(new Uint8Array(0))), { kind: 'unspecified' });
	});

	test('encodeResolveAnchorRequest always writes anchor=1; scope=2 omits 0; generation 0 stays; leaf empty omitted; not JSON', () => {
		const encoded = encodeResolveAnchorRequest({
			anchor: { sessionId: 'sess-1', envelopeId: 'env-1', generation: 0 },
			scope: 'ANCHOR_RESOLVE_SCOPE_INCLUDING_ARCHIVED',
			currentLeafTurnId: 'leaf-3',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoVarints(encoded).get(2), 3);
		assert.strictEqual(protoStrings(encoded).get(3), 'leaf-3');
		const anchor = lastBytes(readProtoFields(encoded), 1);
		assert.ok(anchor);
		assert.strictEqual(protoStrings(anchor).get(1), 'sess-1');
		assert.strictEqual(protoStrings(anchor).get(2), 'env-1');
		assert.strictEqual(protoVarints(anchor).get(3), 0);
		assert.ok(protoVarints(anchor).has(3));

		const emptyAnchor = encodeResolveAnchorRequest({
			anchor: { sessionId: '', envelopeId: '' },
			scope: 'ANCHOR_RESOLVE_SCOPE_UNSPECIFIED',
		});
		assert.notStrictEqual(emptyAnchor[0], 0x7b);
		assert.deepStrictEqual(Array.from(emptyAnchor), [0x0a, 0x00]);
		assert.ok(!protoVarints(emptyAnchor).has(2));
		assert.ok(!protoStrings(emptyAnchor).has(3));

		const blankLeaf = encodeResolveAnchorRequest({
			anchor: { sessionId: 'sess-1', envelopeId: 'env-1' },
			scope: 'ANCHOR_RESOLVE_SCOPE_ACTIVE',
			currentLeafTurnId: '',
		});
		assert.strictEqual(protoVarints(blankLeaf).get(2), 1);
		assert.ok(!protoStrings(blankLeaf).has(3));
		const blankAnchor = lastBytes(readProtoFields(blankLeaf), 1);
		assert.ok(blankAnchor);
		assert.ok(!protoVarints(blankAnchor).has(3));
	});

	test('decodeResolveAnchorResponse empty message maps to {}; hit {} stays hit', () => {
		assert.deepStrictEqual(mapResolveAnchorResponse(decodeResolveAnchorResponse(new Uint8Array(0))), {});
		const emptyHit = decodeResolveAnchorResponse(encodePresentMessageField(1, new Uint8Array(0)));
		assert.deepStrictEqual(mapResolveAnchorResponse(emptyHit), {
			hit: {
				envelope: {},
				presence: 'ENVELOPE_RECORD_PRESENCE_UNSPECIFIED',
			},
		});
	});

	test('resolve wire is ResolveTurn/ResolveAnchor only; client methods use bytes; SaveSkillContent stays JSON; Connect is bytes', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcSessionResolveUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeResolveTurnRequest\b/.test(source));
		assert.ok(/\bdecodeResolveTurnResponse\b/.test(source));
		assert.ok(/\bencodeResolveAnchorRequest\b/.test(source));
		assert.ok(/\bdecodeResolveAnchorResponse\b/.test(source));
		assert.ok(/\bdecodeMessageEnvelope\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bPtyStream\b|\bWatchConfig\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));

		const client = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		assert.ok(client.includes('grpcSessionResolveUnaryWire'));
		const resolveTurn = extractAsyncMethod(client, 'resolveTurn');
		assert.ok(resolveTurn.includes('makeUnaryBytesClient'));
		assert.ok(resolveTurn.includes('encodeResolveTurnRequest'));
		assert.ok(resolveTurn.includes('decodeResolveTurnResponse'));
		assert.ok(resolveTurn.includes('mapResolveTurnResponse'));
		assert.ok(!resolveTurn.includes('makeUnaryClient<'));
		assert.ok(!resolveTurn.includes('JSON.stringify'));
		const resolveAnchor = extractAsyncMethod(client, 'resolveAnchor');
		assert.ok(resolveAnchor.includes('makeUnaryBytesClient'));
		assert.ok(resolveAnchor.includes('encodeResolveAnchorRequest'));
		assert.ok(resolveAnchor.includes('decodeResolveAnchorResponse'));
		assert.ok(resolveAnchor.includes('mapResolveAnchorResponse'));
		assert.ok(!resolveAnchor.includes('makeUnaryClient<'));

		const connect = extractAsyncMethod(client, 'connect');
		assert.ok(connect.includes('makeUnaryBytesClient'));
		assert.ok(!connect.includes('makeUnaryClient<'));
		const saveSkill = extractAsyncMethod(client, 'saveSkillContent');
		assert.ok(saveSkill.includes('makeUnaryClient<'));
		assert.ok(!saveSkill.includes('makeUnaryBytesClient'));

		const pty = extractMethod(client, 'openPtyStream');
		assert.ok(pty.includes('makeResidentBidiBytesHandleClient'));
		assert.ok(pty.includes('encodePtyClientMessage'));
		assert.ok(!pty.includes('makeResidentBidiHandleClient'));
		assert.ok(!pty.includes('bytesToBase64'));
		const watch = extractMethod(client, 'openWatchConfigStream');
		assert.ok(watch.includes('makeServerStreamBytesClient'));
		assert.ok(watch.includes('encodeWatchConfigRequest'));
		assert.ok(!watch.includes('makeServerStreamClient<'));
	});
});

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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcSessionResolveUnaryWire.ts')));
	assert.ok(dir, 'grpcSessionResolveUnaryWire.ts not found from cwd or import.meta');
	return dir;
}

function extractAsyncMethod(source: string, name: string): string {
	const start = source.indexOf(`\tasync ${name}(`);
	assert.ok(start >= 0, `missing async ${name}(`);
	const nextAsync = source.indexOf('\n\tasync ', start + 1);
	const end = nextAsync >= 0 ? nextAsync : source.length;
	return source.slice(start, end);
}

function extractMethod(source: string, name: string): string {
	const asyncStart = source.indexOf(`\tasync ${name}(`);
	const start = asyncStart >= 0 ? asyncStart : source.indexOf(`\t${name}(`);
	assert.ok(start >= 0, `missing ${name}(`);
	const rest = source.slice(start + 1);
	const next = rest.search(/\n\t(async |\w+\()/);
	const end = next >= 0 ? start + 1 + next : source.length;
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
