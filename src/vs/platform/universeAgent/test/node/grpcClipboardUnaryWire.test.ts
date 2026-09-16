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
	mapClipboardClearResponse,
	mapClipboardListResponse,
	mapClipboardReadResponse,
	mapClipboardWriteResponse,
} from '../../node/grpc/grpcClientMappers.js';
import {
	decodeClipboardClearResponse,
	decodeClipboardListResponse,
	decodeClipboardReadResponse,
	decodeClipboardWriteResponse,
	encodeClipboardClearRequest,
	encodeClipboardListRequest,
	encodeClipboardReadRequest,
	encodeClipboardWriteRequest,
} from '../../node/grpc/grpcClipboardUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc clipboard unary protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeClipboardWriteRequest writes 1-7, omits TEXT type=0 and empty, not JSON', () => {
		const encoded = encodeClipboardWriteRequest({
			sessionId: 'sess-1',
			agentId: 'agent-1',
			label: 'note',
			type: 'CLIPBOARD_URL',
			content: 'hello',
			filePath: '/tmp/a',
			url: 'https://ex',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(JSON.stringify({ session_id: 'sess-1' }).includes(Buffer.from(encoded).toString('utf8')), false);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.strictEqual(protoStrings(encoded).get(2), 'agent-1');
		assert.strictEqual(protoStrings(encoded).get(3), 'note');
		assert.strictEqual(protoVarints(encoded).get(4), 2);
		assert.strictEqual(protoStrings(encoded).get(5), 'hello');
		assert.strictEqual(protoStrings(encoded).get(6), '/tmp/a');
		assert.strictEqual(protoStrings(encoded).get(7), 'https://ex');

		const text = encodeClipboardWriteRequest({
			sessionId: 'sess-1',
			agentId: '',
			label: '',
			type: 'CLIPBOARD_TEXT',
			content: 'plain',
			filePath: '',
			url: '',
		});
		assert.notStrictEqual(text[0], 0x7b);
		assert.strictEqual(protoStrings(text).get(1), 'sess-1');
		assert.strictEqual(protoStrings(text).get(5), 'plain');
		assert.ok(!protoVarints(text).has(4));
		assert.ok(!protoStrings(text).has(2));
		assert.ok(!protoStrings(text).has(6));
		assert.ok(!protoStrings(text).has(7));

		assert.strictEqual(encodeClipboardWriteRequest({
			sessionId: '',
			agentId: '',
			label: '',
			type: 'CLIPBOARD_TEXT',
			content: '',
			filePath: '',
			url: '',
		}).length, 0);
	});

	test('decodeClipboardWriteResponse reads clip_id=1; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'clip-9'),
			encodeStringField(2, 'unused-field'),
		]);
		const wire = decodeClipboardWriteResponse(encoded);
		assert.deepStrictEqual(wire, { clip_id: 'clip-9' });
		assert.strictEqual(JSON.stringify(wire).includes('unused-field'), false);
		assert.deepStrictEqual(mapClipboardWriteResponse(wire), { clipId: 'clip-9' });
		assert.deepStrictEqual(decodeClipboardWriteResponse(new Uint8Array(0)), { clip_id: undefined });
		assert.deepStrictEqual(mapClipboardWriteResponse(decodeClipboardWriteResponse(new Uint8Array(0))), { clipId: '' });
	});

	test('encodeClipboardReadRequest writes session_id=1 clip_id=2; omits empty, not JSON', () => {
		const encoded = encodeClipboardReadRequest({ sessionId: 'sess-1', clipId: 'clip-9' });
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.strictEqual(protoStrings(encoded).get(2), 'clip-9');
		assert.ok(!protoStrings(encoded).has(3));
		assert.strictEqual(encodeClipboardReadRequest({ sessionId: '', clipId: '' }).length, 0);
	});

	test('decodeClipboardReadResponse reads entry=1; ClipboardEntry 1-6; TEXT type=0 omit; unknown unread', () => {
		const entry = Buffer.concat([
			encodeStringField(1, 'clip-9'),
			encodeStringField(2, 'note'),
			encodeInt32Field(3, 1),
			encodeStringField(4, 'body'),
			encodeStringField(5, 'agent-1'),
			encodeInt64Field(6, 1700000000000),
			encodeStringField(7, 'unused-entry'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, entry),
			encodeStringField(2, 'unused-field'),
		]);
		const wire = decodeClipboardReadResponse(encoded);
		assert.deepStrictEqual(wire, {
			entry: {
				clip_id: 'clip-9',
				label: 'note',
				type: 1,
				content: 'body',
				created_by: 'agent-1',
				created_at: 1700000000000,
			},
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapClipboardReadResponse(wire), {
			entry: {
				clipId: 'clip-9',
				label: 'note',
				type: 'CLIPBOARD_FILE_PATH',
				content: 'body',
				createdBy: 'agent-1',
				createdAt: 1700000000000,
			},
		});

		const textEntry = decodeClipboardReadResponse(encodeMessageField(1, encodeStringField(1, 'clip-t')));
		assert.strictEqual(textEntry.entry?.type, undefined);
		assert.strictEqual(mapClipboardReadResponse(textEntry).entry.type, 'CLIPBOARD_TEXT');
		assert.deepStrictEqual(decodeClipboardReadResponse(new Uint8Array(0)), { entry: undefined });
	});

	test('encodeClipboardListRequest writes session_id=1; omits empty, not JSON', () => {
		const encoded = encodeClipboardListRequest({ sessionId: 'sess-1' });
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.ok(!protoStrings(encoded).has(2));
		assert.strictEqual(encodeClipboardListRequest({ sessionId: '' }).length, 0);
	});

	test('decodeClipboardListResponse reads entries=1; Summary 1-5; unknown unread', () => {
		const summary = Buffer.concat([
			encodeStringField(1, 'clip-9'),
			encodeStringField(2, 'note'),
			encodeInt32Field(3, 2),
			encodeStringField(4, 'agent-1'),
			encodeInt64Field(5, 42),
			encodeStringField(6, 'unused-entry'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, summary),
			encodeStringField(2, 'unused-field'),
		]);
		const wire = decodeClipboardListResponse(encoded);
		assert.deepStrictEqual(wire, {
			entries: [{
				clip_id: 'clip-9',
				label: 'note',
				type: 2,
				created_by: 'agent-1',
				created_at: 42,
			}],
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapClipboardListResponse(wire), {
			entries: [{
				clipId: 'clip-9',
				label: 'note',
				type: 'CLIPBOARD_URL',
				createdBy: 'agent-1',
				createdAt: 42,
			}],
		});
		assert.deepStrictEqual(decodeClipboardListResponse(new Uint8Array(0)), { entries: [] });
		assert.deepStrictEqual(mapClipboardListResponse(decodeClipboardListResponse(new Uint8Array(0))), { entries: [] });
	});

	test('encodeClipboardClearRequest writes session_id=1; omits empty, not JSON', () => {
		const encoded = encodeClipboardClearRequest({ sessionId: 'sess-1' });
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.strictEqual(encodeClipboardClearRequest({ sessionId: '' }).length, 0);
	});

	test('decodeClipboardClearResponse reads removed_count=1; 0 omit; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 3),
			encodeStringField(2, 'unused-field'),
		]);
		const wire = decodeClipboardClearResponse(encoded);
		assert.deepStrictEqual(wire, { removed_count: 3 });
		assert.strictEqual(JSON.stringify(wire).includes('unused-field'), false);
		assert.deepStrictEqual(mapClipboardClearResponse(wire), { removedCount: 3 });
		assert.deepStrictEqual(decodeClipboardClearResponse(new Uint8Array(0)), { removed_count: undefined });
		assert.deepStrictEqual(mapClipboardClearResponse(decodeClipboardClearResponse(new Uint8Array(0))), { removedCount: 0 });
	});

	test('grpcClient clipboard four unaries use bytes', () => {
		const thisDir = path.dirname(fileURLToPath(import.meta.url));
		const repoRoot = path.join(thisDir, '../../../../../../');
		const clientPath = path.join(repoRoot, 'src/vs/platform/universeAgent/node/grpc/grpcClient.ts');
		const source = fs.readFileSync(clientPath, 'utf8');
		const methods: Array<{ name: string; encoder: string; decoder: string; mapper: string }> = [
			{ name: 'writeClipboard', encoder: 'encodeClipboardWriteRequest', decoder: 'decodeClipboardWriteResponse', mapper: 'mapClipboardWriteResponse' },
			{ name: 'readClipboard', encoder: 'encodeClipboardReadRequest', decoder: 'decodeClipboardReadResponse', mapper: 'mapClipboardReadResponse' },
			{ name: 'listClipboard', encoder: 'encodeClipboardListRequest', decoder: 'decodeClipboardListResponse', mapper: 'mapClipboardListResponse' },
			{ name: 'clearClipboard', encoder: 'encodeClipboardClearRequest', decoder: 'decodeClipboardClearResponse', mapper: 'mapClipboardClearResponse' },
		];
		for (const { name, encoder, decoder, mapper } of methods) {
			const body = extractAsyncMethod(source, name);
			assert.ok(body.includes('makeUnaryBytesClient'), `${name} must use makeUnaryBytesClient`);
			assert.ok(body.includes(encoder), `${name} must call ${encoder}`);
			assert.ok(body.includes(decoder), `${name} must call ${decoder}`);
			assert.ok(body.includes(mapper), `${name} must call ${mapper}`);
			assert.ok(!body.includes('makeUnaryClient<'), `${name} must not use JSON makeUnaryClient`);
		}
	});
});

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

function extractAsyncMethod(source: string, name: string): string {
	const start = source.indexOf(`\tasync ${name}(`);
	assert.ok(start >= 0, `missing async ${name}(`);
	const nextAsync = source.indexOf('\n\tasync ', start + 1);
	const end = nextAsync >= 0 ? nextAsync : source.length;
	return source.slice(start, end);
}
