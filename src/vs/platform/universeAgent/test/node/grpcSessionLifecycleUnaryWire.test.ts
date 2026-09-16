/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	mapExportSessionResponse,
	mapPrewarmSessionsResponse,
	mapPurgeSessionResponse,
	mapShelveSessionResponse,
	mapUnshelveSessionResponse,
} from '../../node/grpc/grpcClientMappers.js';
import {
	decodeExportSessionResponse,
	decodePrewarmSessionsResponse,
	decodePurgeSessionResponse,
	decodeShelveSessionResponse,
	decodeUnshelveSessionResponse,
	encodeExportSessionRequest,
	encodePrewarmSessionsRequest,
	encodePurgeSessionRequest,
	encodeShelveSessionRequest,
	encodeUnshelveSessionRequest,
} from '../../node/grpc/grpcSessionLifecycleUnaryWire.js';
import {
	encodeInt32Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc SessionService Prewarm / Shelve / Unshelve / Purge / Export protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodePrewarmSessionsRequest writes repeated session_ids=1; omits empty; not JSON', () => {
		const encoded = encodePrewarmSessionsRequest({ sessionIds: ['sess-1', 'sess-2'] });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_ids: ['sess-1', 'sess-2'],
		}));
		assert.deepStrictEqual(protoRepeatedStrings(encoded, 1), ['sess-1', 'sess-2']);
		assert.ok(!protoStrings(encoded).has(2));
		assert.ok(!protoVarints(encoded).has(1));

		const skippedEmpty = encodePrewarmSessionsRequest({ sessionIds: ['sess-1', '', 'sess-2'] });
		assert.deepStrictEqual(protoRepeatedStrings(skippedEmpty, 1), ['sess-1', 'sess-2']);
		assert.notStrictEqual(skippedEmpty[0], 0x7b);

		assert.strictEqual(encodePrewarmSessionsRequest({ sessionIds: [] }).length, 0);
		assert.strictEqual(encodePrewarmSessionsRequest({ sessionIds: [''] }).length, 0);
		assert.notStrictEqual(encodePrewarmSessionsRequest({ sessionIds: [] })[0], 0x7b);
	});

	test('decodePrewarmSessionsResponse reads entries=1 nested session_id=1 outcome=2 message=3; unused unread', () => {
		const entry = Buffer.concat([
			encodeStringField(1, 'sess-9'),
			encodeInt32Field(2, 2),
			encodeStringField(3, 'restored'),
			encodeStringField(4, 'unused-nested'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, entry),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodePrewarmSessionsResponse(encoded);
		assert.deepStrictEqual(wire, {
			entries: [{
				session_id: 'sess-9',
				outcome: 2,
				message: 'restored',
			}],
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapPrewarmSessionsResponse(wire), {
			entries: [{
				sessionId: 'sess-9',
				outcome: 'PREWARM_SESSION_OUTCOME_RESTORED',
				message: 'restored',
			}],
		});

		const outcomes = [0, 1, 2, 3, 4].map(value => {
			const nested = value === 0
				? encodeStringField(1, `s-${value}`)
				: Buffer.concat([encodeStringField(1, `s-${value}`), encodeInt32Field(2, value)]);
			return mapPrewarmSessionsResponse(decodePrewarmSessionsResponse(encodeMessageField(1, nested))).entries[0];
		});
		assert.deepStrictEqual(outcomes.map(entry => entry.outcome), [
			'',
			'PREWARM_SESSION_OUTCOME_ALREADY_RESTORED',
			'PREWARM_SESSION_OUTCOME_RESTORED',
			'PREWARM_SESSION_OUTCOME_SKIPPED',
			'PREWARM_SESSION_OUTCOME_FAILED',
		]);

		const empty = decodePrewarmSessionsResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, { entries: [] });
		assert.deepStrictEqual(mapPrewarmSessionsResponse(empty), { entries: [] });

		const omitted = decodePrewarmSessionsResponse(encodeMessageField(1, encodeStringField(1, 'only')));
		assert.deepStrictEqual(mapPrewarmSessionsResponse(omitted), {
			entries: [{ sessionId: 'only', outcome: '', message: '' }],
		});
	});

	test('encodeShelveSessionRequest writes session_id=1; omits empty; not JSON', () => {
		const encoded = encodeShelveSessionRequest({ sessionId: 'sess-1' });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({ session_id: 'sess-1' }));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), { 1: 'sess-1' });
		assert.ok(!protoStrings(encoded).has(2));
		assert.strictEqual(encodeShelveSessionRequest({ sessionId: '' }).length, 0);
	});

	test('decodeShelveSessionResponse reads success=1 message=2; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'shelved'),
			encodeStringField(3, 'unused-field'),
		]);
		const wire = decodeShelveSessionResponse(encoded);
		assert.deepStrictEqual(wire, { success: true, message: 'shelved' });
		assert.deepStrictEqual(Object.keys(wire), ['success', 'message']);
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapShelveSessionResponse(wire), { ok: true, message: 'shelved' });
		assert.deepStrictEqual(mapShelveSessionResponse(decodeShelveSessionResponse(new Uint8Array(0))), {
			ok: false,
			message: undefined,
		});
	});

	test('encodeUnshelveSessionRequest writes session_id=1; omits empty; not JSON', () => {
		const encoded = encodeUnshelveSessionRequest({ sessionId: 'sess-u' });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({ session_id: 'sess-u' }));
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-u');
		assert.strictEqual(encodeUnshelveSessionRequest({ sessionId: '' }).length, 0);
	});

	test('decodeUnshelveSessionResponse reads success=1 message=2; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'listed'),
			encodeStringField(3, 'unused-field'),
		]);
		const wire = decodeUnshelveSessionResponse(encoded);
		assert.deepStrictEqual(wire, { success: true, message: 'listed' });
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapUnshelveSessionResponse(wire), { ok: true, message: 'listed' });
		assert.deepStrictEqual(mapUnshelveSessionResponse(decodeUnshelveSessionResponse(new Uint8Array(0))), {
			ok: false,
			message: undefined,
		});
	});

	test('encodePurgeSessionRequest writes session_id=1; omits empty; not JSON', () => {
		const encoded = encodePurgeSessionRequest({ sessionId: 'sess-p' });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({ session_id: 'sess-p' }));
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-p');
		assert.strictEqual(encodePurgeSessionRequest({ sessionId: '' }).length, 0);
	});

	test('decodePurgeSessionResponse reads success=1 message=2; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'purged'),
			encodeStringField(3, 'unused-field'),
		]);
		const wire = decodePurgeSessionResponse(encoded);
		assert.deepStrictEqual(wire, { success: true, message: 'purged' });
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapPurgeSessionResponse(wire), { ok: true, message: 'purged' });
		assert.deepStrictEqual(mapPurgeSessionResponse(decodePurgeSessionResponse(new Uint8Array(0))), {
			ok: false,
			message: undefined,
		});
	});

	test('encodeExportSessionRequest writes session_id=1 format=2; omits empty; not JSON', () => {
		const encoded = encodeExportSessionRequest({ sessionId: 'sess-1', format: 'markdown' });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			format: 'markdown',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'markdown',
		});
		assert.ok(!protoStrings(encoded).has(3));

		const noFormat = encodeExportSessionRequest({ sessionId: 'sess-1', format: '' });
		assert.strictEqual(protoStrings(noFormat).get(1), 'sess-1');
		assert.ok(!protoStrings(noFormat).has(2));
		assert.notStrictEqual(noFormat[0], 0x7b);

		assert.strictEqual(encodeExportSessionRequest({ sessionId: '', format: '' }).length, 0);
	});

	test('decodeExportSessionResponse reads content=1 format=2; unused unread', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, '# sess'),
			encodeStringField(2, 'markdown'),
			encodeStringField(3, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeExportSessionResponse(encoded);
		assert.deepStrictEqual(wire, { content: '# sess', format: 'markdown' });
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapExportSessionResponse(wire), { content: '# sess', format: 'markdown' });

		const empty = decodeExportSessionResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, { content: undefined, format: undefined });
		assert.deepStrictEqual(mapExportSessionResponse(empty), { content: '', format: '' });
	});

	test('session lifecycle unary wire is five unaries only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcSessionLifecycleUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodePrewarmSessionsRequest\b/.test(source));
		assert.ok(/\bdecodePrewarmSessionsResponse\b/.test(source));
		assert.ok(/\bencodeShelveSessionRequest\b/.test(source));
		assert.ok(/\bdecodeShelveSessionResponse\b/.test(source));
		assert.ok(/\bencodeUnshelveSessionRequest\b/.test(source));
		assert.ok(/\bdecodeUnshelveSessionResponse\b/.test(source));
		assert.ok(/\bencodePurgeSessionRequest\b/.test(source));
		assert.ok(/\bdecodePurgeSessionResponse\b/.test(source));
		assert.ok(/\bencodeExportSessionRequest\b/.test(source));
		assert.ok(/\bdecodeExportSessionResponse\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bFireTriggerWebhook\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('prewarmSessions / shelveSession / unshelveSession / purgeSession / exportSession use bytes then map*', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const methods: Array<{ name: string; encoder: string; decoder: string; mapper: string }> = [
			{ name: 'prewarmSessions', encoder: 'encodePrewarmSessionsRequest', decoder: 'decodePrewarmSessionsResponse', mapper: 'mapPrewarmSessionsResponse' },
			{ name: 'shelveSession', encoder: 'encodeShelveSessionRequest', decoder: 'decodeShelveSessionResponse', mapper: 'mapShelveSessionResponse' },
			{ name: 'unshelveSession', encoder: 'encodeUnshelveSessionRequest', decoder: 'decodeUnshelveSessionResponse', mapper: 'mapUnshelveSessionResponse' },
			{ name: 'purgeSession', encoder: 'encodePurgeSessionRequest', decoder: 'decodePurgeSessionResponse', mapper: 'mapPurgeSessionResponse' },
			{ name: 'exportSession', encoder: 'encodeExportSessionRequest', decoder: 'decodeExportSessionResponse', mapper: 'mapExportSessionResponse' },
		];
		for (const { name, encoder, decoder, mapper } of methods) {
			const body = extractAsyncMethod(source, name);
			assert.ok(body.includes('makeUnaryBytesClient'), `${name} must use makeUnaryBytesClient`);
			assert.ok(body.includes(encoder), `${name} must call ${encoder}`);
			assert.ok(body.includes(decoder), `${name} must call ${decoder}`);
			assert.ok(body.includes(mapper), `${name} must call ${mapper}`);
			assert.ok(!body.includes('makeUnaryClient<'), `${name} must not use JSON makeUnaryClient`);
			assert.ok(!body.includes('JSON.stringify'), `${name} must not JSON.stringify`);
		}
		assert.ok(source.includes('grpcSessionLifecycleUnaryWire'));
		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
	});
});

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcSessionLifecycleUnaryWire.ts')));
	assert.ok(dir, 'grpcSessionLifecycleUnaryWire.ts not found from cwd or import.meta');
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

function protoRepeatedStrings(encoded: Uint8Array, fieldNumber: number): string[] {
	const values: string[] = [];
	for (const field of readProtoFields(encoded)) {
		if (field.field === fieldNumber && field.wireType === 2) {
			values.push(Buffer.from(field.bytes).toString('utf8'));
		}
	}
	return values;
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
