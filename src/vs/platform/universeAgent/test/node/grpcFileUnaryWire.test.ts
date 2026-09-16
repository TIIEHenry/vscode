/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	mapAgentMergeResponse,
	mapGetFileInfoResponse,
	mapListFilesResponse,
	mapReadFileResponse,
	mapWriteFileResponse,
} from '../../node/grpc/grpcClientMappers.js';
import {
	decodeAgentMergeResponse,
	decodeGetFileInfoResponse,
	decodeListFilesResponse,
	decodeReadFileResponse,
	decodeWriteFileResponse,
	encodeAgentMergeRequest,
	encodeForceWriteFileRequest,
	encodeGetFileInfoRequest,
	encodeListFilesRequest,
	encodeReadFileRequest,
	encodeWriteFileRequest,
} from '../../node/grpc/grpcFileUnaryWire.js';
import {
	encodeBytesField,
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

/** Binary payload that is not valid UTF-8 and not a JSON object (`{` / `"` present as raw bytes). */
const BINARY_CONTENT = Uint8Array.from([0x00, 0xff, 0xfe, 0x7b, 0x22]);

suite('grpc file unary protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeListFilesRequest writes 1-5; omits empty/0/false; not JSON', () => {
		const encoded = encodeListFilesRequest({
			path: '/src',
			sessionId: 'sess-1',
			recursive: true,
			pattern: '*.ts',
			maxResults: 20,
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), '/src');
		assert.strictEqual(protoStrings(encoded).get(2), 'sess-1');
		assert.strictEqual(protoVarints(encoded).get(3), 1);
		assert.strictEqual(protoStrings(encoded).get(4), '*.ts');
		assert.strictEqual(protoVarints(encoded).get(5), 20);
		const omitted = encodeListFilesRequest({
			path: '',
			sessionId: '',
			recursive: false,
			pattern: '',
			maxResults: 0,
		});
		assert.strictEqual(omitted.length, 0);
		assert.ok(!protoVarints(omitted).has(3));
		assert.ok(!protoVarints(omitted).has(5));
	});

	test('decodeListFilesResponse reads entries=1 FileEntry 1-6 total=2; unknown unread', () => {
		const entry = Buffer.concat([
			encodeStringField(1, 'a.ts'),
			encodeStringField(2, '/src/a.ts'),
			encodeInt32Field(3, 1),
			encodeInt64Field(4, 42),
			encodeInt64Field(5, 1700000000000),
			encodeStringField(6, 'text/plain'),
			encodeStringField(7, 'unused-entry'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, entry),
			encodeInt32Field(2, 9),
			encodeStringField(3, 'unused-field'),
		]);
		const wire = decodeListFilesResponse(encoded);
		assert.deepStrictEqual(wire, {
			entries: [{
				name: 'a.ts',
				path: '/src/a.ts',
				is_directory: true,
				size: 42,
				last_modified: 1700000000000,
				mime_type: 'text/plain',
			}],
			total: 9,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapListFilesResponse(wire), {
			entries: [{
				name: 'a.ts',
				path: '/src/a.ts',
				isDirectory: true,
				size: 42,
				lastModified: 1700000000000,
				mimeType: 'text/plain',
			}],
			total: 9,
		});
		assert.deepStrictEqual(decodeListFilesResponse(new Uint8Array(0)), {
			entries: [],
			total: undefined,
		});
		assert.deepStrictEqual(mapListFilesResponse(decodeListFilesResponse(new Uint8Array(0))), {
			entries: [],
			total: 0,
		});
	});

	test('encodeReadFileRequest writes path=1 session_id=2 start_line=3 end_line=4 max_bytes=5; omits empty/0; not JSON', () => {
		const encoded = encodeReadFileRequest({
			path: '/src/a.ts',
			sessionId: 'sess-1',
			startLine: 2,
			endLine: 8,
			maxBytes: 1024,
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), '/src/a.ts');
		assert.strictEqual(protoStrings(encoded).get(2), 'sess-1');
		assert.strictEqual(protoVarints(encoded).get(3), 2);
		assert.strictEqual(protoVarints(encoded).get(4), 8);
		assert.strictEqual(protoVarints(encoded).get(5), 1024);
		assert.strictEqual(encodeReadFileRequest({
			path: '',
			sessionId: '',
			startLine: 0,
			endLine: 0,
			maxBytes: 0,
		}).length, 0);
	});

	test('decodeReadFileResponse content is proto bytes not JSON string; mapper recovers binary; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeBytesField(1, BINARY_CONTENT),
			encodeInt64Field(2, 99),
			encodeStringField(3, 'application/octet-stream'),
			encodeInt32Field(4, 3),
			encodeStringField(5, 'hash-1'),
			encodeStringField(6, 'unused-field'),
		]);
		assert.deepStrictEqual(Buffer.from(protoBytes(encoded, 1) ?? []), Buffer.from(BINARY_CONTENT));
		assert.notStrictEqual(Buffer.from(protoBytes(encoded, 1) ?? []).toString('utf8'), Buffer.from(BINARY_CONTENT).toString('base64'));
		assert.notStrictEqual(Buffer.from(protoBytes(encoded, 1) ?? []).toString('utf8'), JSON.stringify(Buffer.from(BINARY_CONTENT).toString('base64')));
		const wire = decodeReadFileResponse(encoded);
		assert.strictEqual(wire.content, Buffer.from(BINARY_CONTENT).toString('base64'));
		assert.deepStrictEqual(wire, {
			content: Buffer.from(BINARY_CONTENT).toString('base64'),
			total_size: 99,
			mime_type: 'application/octet-stream',
			line_count: 3,
			content_hash: 'hash-1',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		const mapped = mapReadFileResponse(wire);
		assert.deepStrictEqual(Buffer.from(mapped.content), Buffer.from(BINARY_CONTENT));
		assert.deepStrictEqual(mapped, {
			content: mapped.content,
			totalSize: 99,
			mimeType: 'application/octet-stream',
			lineCount: 3,
			contentHash: 'hash-1',
		});
		assert.deepStrictEqual(decodeReadFileResponse(new Uint8Array(0)), {
			content: undefined,
			total_size: undefined,
			mime_type: undefined,
			line_count: undefined,
			content_hash: undefined,
		});
		assert.deepStrictEqual(mapReadFileResponse(decodeReadFileResponse(new Uint8Array(0))), {
			content: new Uint8Array(0),
			totalSize: 0,
			mimeType: '',
			lineCount: 0,
			contentHash: '',
		});
	});

	test('encodeGetFileInfoRequest writes path=1 session_id=2; omits empty; not JSON', () => {
		const encoded = encodeGetFileInfoRequest({ path: '/src/a.ts', sessionId: 'sess-1' });
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), '/src/a.ts');
		assert.strictEqual(protoStrings(encoded).get(2), 'sess-1');
		assert.ok(!protoStrings(encoded).has(3));
		assert.strictEqual(encodeGetFileInfoRequest({ path: '', sessionId: '' }).length, 0);
	});

	test('decodeGetFileInfoResponse reads file=1 FileEntry 1-6; unknown unread', () => {
		const file = Buffer.concat([
			encodeStringField(1, 'a.ts'),
			encodeStringField(2, '/src/a.ts'),
			encodeInt64Field(4, 8),
			encodeInt64Field(5, 11),
			encodeStringField(6, 'text/typescript'),
			encodeStringField(7, 'unused-entry'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, file),
			encodeStringField(2, 'unused-field'),
		]);
		const wire = decodeGetFileInfoResponse(encoded);
		assert.deepStrictEqual(wire, {
			file: {
				name: 'a.ts',
				path: '/src/a.ts',
				is_directory: false,
				size: 8,
				last_modified: 11,
				mime_type: 'text/typescript',
			},
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapGetFileInfoResponse(wire), {
			file: {
				name: 'a.ts',
				path: '/src/a.ts',
				isDirectory: false,
				size: 8,
				lastModified: 11,
				mimeType: 'text/typescript',
			},
		});
		assert.deepStrictEqual(decodeGetFileInfoResponse(new Uint8Array(0)), { file: undefined });
		assert.deepStrictEqual(mapGetFileInfoResponse(decodeGetFileInfoResponse(new Uint8Array(0))), {
			file: {
				name: '',
				path: '',
				isDirectory: false,
				size: 0,
				lastModified: 0,
				mimeType: '',
			},
		});
	});

	test('encodeWriteFileRequest writes content/base_content as proto bytes not JSON string; omits empty; not JSON', () => {
		const encoded = encodeWriteFileRequest({
			path: '/src/a.bin',
			content: BINARY_CONTENT,
			baseHash: 'base-1',
			sessionId: 'sess-1',
			baseContent: Uint8Array.from([0x01, 0x02]),
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), '/src/a.bin');
		assert.deepStrictEqual(Buffer.from(protoBytes(encoded, 2) ?? []), Buffer.from(BINARY_CONTENT));
		assert.notStrictEqual(Buffer.from(protoBytes(encoded, 2) ?? []).toString('utf8'), Buffer.from(BINARY_CONTENT).toString('base64'));
		assert.notStrictEqual(Buffer.from(protoBytes(encoded, 2) ?? []).toString('utf8'), JSON.stringify(Buffer.from(BINARY_CONTENT).toString('base64')));
		assert.ok(!Buffer.from(encoded).includes(Buffer.from(JSON.stringify({ content: Buffer.from(BINARY_CONTENT).toString('base64') }))));
		assert.strictEqual(protoStrings(encoded).get(3), 'base-1');
		assert.strictEqual(protoStrings(encoded).get(4), 'sess-1');
		assert.deepStrictEqual(Buffer.from(protoBytes(encoded, 5) ?? []), Buffer.from([0x01, 0x02]));
		const omitted = encodeWriteFileRequest({
			path: '',
			content: new Uint8Array(0),
			baseHash: '',
			sessionId: '',
			baseContent: new Uint8Array(0),
		});
		assert.strictEqual(omitted.length, 0);
		assert.ok(!protoBytes(omitted, 2));
		assert.ok(!protoBytes(omitted, 5));
	});

	test('encodeForceWriteFileRequest writes path=1 content=2 bytes session_id=3; omits empty; not JSON', () => {
		const encoded = encodeForceWriteFileRequest({
			path: '/src/a.bin',
			content: BINARY_CONTENT,
			sessionId: 'sess-1',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), '/src/a.bin');
		assert.deepStrictEqual(Buffer.from(protoBytes(encoded, 2) ?? []), Buffer.from(BINARY_CONTENT));
		assert.notStrictEqual(Buffer.from(protoBytes(encoded, 2) ?? []).toString('utf8'), Buffer.from(BINARY_CONTENT).toString('base64'));
		assert.strictEqual(protoStrings(encoded).get(3), 'sess-1');
		assert.ok(!protoStrings(encoded).has(4));
		assert.ok(!protoBytes(encoded, 5));
		assert.strictEqual(encodeForceWriteFileRequest({
			path: '',
			content: new Uint8Array(0),
			sessionId: '',
		}).length, 0);
	});

	test('decodeWriteFileResponse SAVED=0 omit; MERGED/CONFLICT; bytes not JSON string; unknown unread', () => {
		assert.strictEqual(encodeInt32Field(1, 0).length, 0);
		const saved = Buffer.concat([
			encodeStringField(2, 'new-hash'),
			encodeInt64Field(3, 16),
			encodeInt64Field(4, 99),
			encodeBytesField(5, BINARY_CONTENT),
			encodeStringField(6, 'cur-hash'),
			encodeBytesField(7, Uint8Array.from([0xaa])),
			encodeStringField(8, 'unused-field'),
		]);
		assert.deepStrictEqual(Buffer.from(protoBytes(saved, 5) ?? []), Buffer.from(BINARY_CONTENT));
		assert.notStrictEqual(Buffer.from(protoBytes(saved, 5) ?? []).toString('utf8'), Buffer.from(BINARY_CONTENT).toString('base64'));
		const savedWire = decodeWriteFileResponse(saved);
		assert.strictEqual(savedWire.status, undefined);
		assert.strictEqual(JSON.stringify(savedWire).includes('unused'), false);
		assert.deepStrictEqual(savedWire, {
			status: undefined,
			new_hash: 'new-hash',
			size: 16,
			modified_at: 99,
			current_content: Buffer.from(BINARY_CONTENT).toString('base64'),
			current_hash: 'cur-hash',
			merged_content: Buffer.from([0xaa]).toString('base64'),
		});
		const savedMapped = mapWriteFileResponse(savedWire);
		assert.strictEqual(savedMapped.status, 'SAVED');
		assert.deepStrictEqual(Buffer.from(savedMapped.currentContent), Buffer.from(BINARY_CONTENT));
		assert.deepStrictEqual(Buffer.from(savedMapped.mergedContent), Buffer.from([0xaa]));
		assert.deepStrictEqual(savedMapped, {
			status: 'SAVED',
			newHash: 'new-hash',
			size: 16,
			modifiedAt: 99,
			currentContent: savedMapped.currentContent,
			currentHash: 'cur-hash',
			mergedContent: savedMapped.mergedContent,
		});

		const merged = decodeWriteFileResponse(encodeInt32Field(1, 1));
		assert.strictEqual(merged.status, 1);
		assert.strictEqual(mapWriteFileResponse(merged).status, 'MERGED');
		const conflict = decodeWriteFileResponse(encodeInt32Field(1, 2));
		assert.strictEqual(conflict.status, 2);
		assert.strictEqual(mapWriteFileResponse(conflict).status, 'CONFLICT');

		assert.deepStrictEqual(decodeWriteFileResponse(new Uint8Array(0)), {
			status: undefined,
			new_hash: undefined,
			size: undefined,
			modified_at: undefined,
			current_content: undefined,
			current_hash: undefined,
			merged_content: undefined,
		});
		assert.deepStrictEqual(mapWriteFileResponse(decodeWriteFileResponse(new Uint8Array(0))), {
			status: 'SAVED',
			newHash: '',
			size: 0,
			modifiedAt: 0,
			currentContent: new Uint8Array(0),
			currentHash: '',
			mergedContent: new Uint8Array(0),
		});
	});

	test('encodeAgentMergeRequest writes session_id=1 path=2 and content bytes 3-5; omits empty; not JSON', () => {
		const encoded = encodeAgentMergeRequest({
			sessionId: 'sess-1',
			path: '/src/a.bin',
			baseContent: Uint8Array.from([0x01]),
			currentContent: BINARY_CONTENT,
			userContent: Uint8Array.from([0x02, 0x03]),
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.strictEqual(protoStrings(encoded).get(2), '/src/a.bin');
		assert.deepStrictEqual(Buffer.from(protoBytes(encoded, 3) ?? []), Buffer.from([0x01]));
		assert.deepStrictEqual(Buffer.from(protoBytes(encoded, 4) ?? []), Buffer.from(BINARY_CONTENT));
		assert.notStrictEqual(Buffer.from(protoBytes(encoded, 4) ?? []).toString('utf8'), Buffer.from(BINARY_CONTENT).toString('base64'));
		assert.deepStrictEqual(Buffer.from(protoBytes(encoded, 5) ?? []), Buffer.from([0x02, 0x03]));
		assert.strictEqual(encodeAgentMergeRequest({
			sessionId: '',
			path: '',
			baseContent: new Uint8Array(0),
			currentContent: new Uint8Array(0),
			userContent: new Uint8Array(0),
		}).length, 0);
	});

	test('decodeAgentMergeResponse reads accepted=1; false omit; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'unused-field'),
		]);
		const wire = decodeAgentMergeResponse(encoded);
		assert.deepStrictEqual(wire, { accepted: true });
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapAgentMergeResponse(wire), { accepted: true });
		assert.deepStrictEqual(decodeAgentMergeResponse(new Uint8Array(0)), { accepted: false });
		assert.deepStrictEqual(mapAgentMergeResponse(decodeAgentMergeResponse(new Uint8Array(0))), { accepted: false });
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

function protoBytes(encoded: Uint8Array, fieldNumber: number): Uint8Array | undefined {
	let found: Uint8Array | undefined;
	for (const field of readProtoFields(encoded)) {
		if (field.field === fieldNumber && field.wireType === 2) {
			found = field.bytes;
		}
	}
	return found;
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
