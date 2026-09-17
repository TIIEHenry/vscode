/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentUploadHeader } from '../../common/universeAgentTypes.js';
import { mapUploadResponse } from '../../node/grpc/grpcClientMappers.js';
import {
	decodeUploadResponse,
	encodeUploadChunk,
} from '../../node/grpc/grpcUploadAttachmentStreamWire.js';
import {
	encodeInt32Field,
	encodePresentMessageField,
	encodeStringField,
	lastBytes,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

/** Binary payload that is not valid UTF-8 and not a JSON object (`{` as a raw byte). */
const BINARY_CHUNK = Uint8Array.from([0x00, 0xff, 0xfe, 0x7b, 0x22]);

suite('grpc FileTransferService UploadAttachment protobuf client-stream wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeUploadChunk writes header=1 nested 1-9, chunk=2 bytes, offset=3; omits empty/0/false; not JSON', () => {
		const encoded = encodeUploadChunk({
			header: sampleHeader({
				transferId: 'xfer-1',
				filename: 'a.bin',
				totalSize: 4096,
				mimeType: 'application/octet-stream',
				checksumSha256: 'abc',
				isPrecompressed: true,
				sessionId: 'sess-9',
				chunkSize: 1024,
				queueItemId: 'q-7',
			}),
			offset: 0,
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			header: {
				transfer_id: 'xfer-1',
				filename: 'a.bin',
				total_size: 4096,
				mime_type: 'application/octet-stream',
				checksum_sha256: 'abc',
				is_precompressed: true,
				session_id: 'sess-9',
				chunk_size: 1024,
				queue_item_id: 'q-7',
			},
			offset: 0,
		}));
		assert.ok(!protoVarints(encoded).has(3), 'offset 0 omitted');
		assert.ok(!protoBytes(encoded, 2), 'no chunk field');
		const inner = lastBytes(readProtoFields(encoded), 1);
		assert.ok(inner);
		assert.deepStrictEqual(Object.fromEntries(protoStrings(inner)), {
			1: 'xfer-1',
			2: 'a.bin',
			4: 'application/octet-stream',
			5: 'abc',
			7: 'sess-9',
			9: 'q-7',
		});
		assert.strictEqual(protoVarints(inner).get(3), 4096);
		assert.strictEqual(protoVarints(inner).get(6), 1);
		assert.strictEqual(protoVarints(inner).get(8), 1024);
		assert.ok(!protoStrings(inner).has(3));
		assert.ok(!protoStrings(inner).has(8));
		assert.ok(!protoStrings(inner).has(10));

		const omitted = encodeUploadChunk({
			header: sampleHeader({
				transferId: 'xfer-1',
				filename: '',
				totalSize: 0,
				mimeType: '',
				checksumSha256: '',
				isPrecompressed: false,
				sessionId: '',
				chunkSize: 0,
			}),
			offset: 0,
		});
		assert.notStrictEqual(omitted[0], 0x7b);
		assert.ok(!protoVarints(omitted).has(3));
		assert.ok(!protoBytes(omitted, 2));
		const sparseInner = lastBytes(readProtoFields(omitted), 1);
		assert.ok(sparseInner);
		assert.deepStrictEqual(Object.fromEntries(protoStrings(sparseInner)), {
			1: 'xfer-1',
		});
		assert.ok(!protoVarints(sparseInner).has(3));
		assert.ok(!protoVarints(sparseInner).has(6));
		assert.ok(!protoVarints(sparseInner).has(8));
		assert.ok(!protoStrings(sparseInner).has(9));

		const emptyQueue = encodeUploadChunk({
			header: sampleHeader({
				transferId: 'xfer-1',
				filename: '',
				totalSize: 0,
				mimeType: '',
				checksumSha256: '',
				isPrecompressed: false,
				sessionId: '',
				chunkSize: 0,
				queueItemId: '',
			}),
			offset: 0,
		});
		const emptyQueueInner = lastBytes(readProtoFields(emptyQueue), 1);
		assert.ok(emptyQueueInner);
		assert.ok(!protoStrings(emptyQueueInner).has(9), 'empty queue_item_id omitted');

		const emptyHeader = encodeUploadChunk({
			header: sampleHeader({
				transferId: '',
				filename: '',
				totalSize: 0,
				mimeType: '',
				checksumSha256: '',
				isPrecompressed: false,
				sessionId: '',
				chunkSize: 0,
			}),
			offset: 0,
		});
		assert.notStrictEqual(emptyHeader[0], 0x7b);
		const presentEmpty = lastBytes(readProtoFields(emptyHeader), 1);
		assert.ok(presentEmpty);
		assert.strictEqual(presentEmpty.length, 0);
		assert.deepStrictEqual(Array.from(readProtoFields(presentEmpty)), []);
		assert.ok(!protoVarints(emptyHeader).has(3));

		assert.strictEqual(encodeUploadChunk({ offset: 0 }).length, 0);
	});

	test('encodeUploadChunk writes chunk=2 as proto bytes not JSON/base64; offset=3', () => {
		const encoded = encodeUploadChunk({
			chunk: BINARY_CHUNK,
			offset: 4096,
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			chunk: Buffer.from(BINARY_CHUNK).toString('base64'),
			offset: 4096,
		}));
		assert.deepStrictEqual(Buffer.from(protoBytes(encoded, 2) ?? []), Buffer.from(BINARY_CHUNK));
		assert.notStrictEqual(Buffer.from(protoBytes(encoded, 2) ?? []).toString('utf8'), Buffer.from(BINARY_CHUNK).toString('base64'));
		assert.strictEqual(protoVarints(encoded).get(3), 4096);
		assert.ok(!lastBytes(readProtoFields(encoded), 1));

		const emptyBytes = encodeUploadChunk({
			chunk: new Uint8Array(0),
			offset: 8,
		});
		assert.ok(!protoBytes(emptyBytes, 2), 'empty chunk omitted');
		assert.strictEqual(protoVarints(emptyBytes).get(3), 8);
		assert.notStrictEqual(emptyBytes[0], 0x7b);
	});

	test('decodeUploadResponse reads 1-5; error_code varint; unused unread; mapUploadResponse', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'store/a.bin'),
			encodeStringField(3, 'deadbeef'),
			encodeStringField(4, 'ok'),
			encodeInt32Field(5, 4),
			encodeStringField(6, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeUploadResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			file_path: 'store/a.bin',
			checksum_sha256: 'deadbeef',
			error_message: 'ok',
			error_code: 4,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapUploadResponse(wire), {
			success: true,
			filePath: 'store/a.bin',
			checksumSha256: 'deadbeef',
			errorMessage: 'ok',
			errorCode: 'UPLOAD_ERROR_INVALID_OFFSET',
		});

		const empty = decodeUploadResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			file_path: undefined,
			checksum_sha256: undefined,
			error_message: undefined,
			error_code: undefined,
		});
		assert.deepStrictEqual(mapUploadResponse(empty), {
			success: false,
			filePath: '',
			checksumSha256: '',
			errorMessage: '',
			errorCode: 'UPLOAD_ERROR_NONE',
		});

		const unusedOnly = decodeUploadResponse(encodeStringField(6, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			success: undefined,
			file_path: undefined,
			checksum_sha256: undefined,
			error_message: undefined,
			error_code: undefined,
		});
		assert.deepStrictEqual(mapUploadResponse(unusedOnly), {
			success: false,
			filePath: '',
			checksumSha256: '',
			errorMessage: '',
			errorCode: 'UPLOAD_ERROR_NONE',
		});

		const explicitFalse = decodeUploadResponse(new Uint8Array([0x08, 0x00]));
		assert.deepStrictEqual(explicitFalse, {
			success: false,
			file_path: undefined,
			checksum_sha256: undefined,
			error_message: undefined,
			error_code: undefined,
		});
		assert.deepStrictEqual(mapUploadResponse(explicitFalse), {
			success: false,
			filePath: '',
			checksumSha256: '',
			errorMessage: '',
			errorCode: 'UPLOAD_ERROR_NONE',
		});

		const noneCode = decodeUploadResponse(Buffer.concat([
			encodeInt32Field(1, 1),
			new Uint8Array([0x28, 0x00]),
		]));
		assert.deepStrictEqual(noneCode, {
			success: true,
			file_path: undefined,
			checksum_sha256: undefined,
			error_message: undefined,
			error_code: 0,
		});
		assert.deepStrictEqual(mapUploadResponse(noneCode), {
			success: true,
			filePath: '',
			checksumSha256: '',
			errorMessage: '',
			errorCode: 'UPLOAD_ERROR_NONE',
		});

		const emptyStrings = decodeUploadResponse(Buffer.concat([
			encodeInt32Field(1, 1),
			encodePresentMessageField(2, new Uint8Array(0)),
			encodePresentMessageField(3, new Uint8Array(0)),
			encodePresentMessageField(4, new Uint8Array(0)),
			encodeInt32Field(5, 1),
		]));
		assert.deepStrictEqual(emptyStrings, {
			success: true,
			file_path: '',
			checksum_sha256: '',
			error_message: '',
			error_code: 1,
		});
		assert.deepStrictEqual(mapUploadResponse(emptyStrings), {
			success: true,
			filePath: '',
			checksumSha256: '',
			errorMessage: '',
			errorCode: 'UPLOAD_ERROR_CHECKSUM_MISMATCH',
		});
	});

	test('upload-attachment stream wire is FileTransferService.UploadAttachment only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcUploadAttachmentStreamWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeUploadChunk\b/.test(source));
		assert.ok(/\bdecodeUploadResponse\b/.test(source));
		assert.ok(/\bencodePresentMessageField\b/.test(source));
		assert.ok(/\bencodeBytesField\b/.test(source));
		assert.ok(/\bencodeInt64Field\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(/\blastString\b/.test(source));
		assert.ok(!/\bGetUploadProgress\b|\bDownloadAttachment\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bResolveAnchor\b/.test(source));
		assert.ok(!/\bmakeClientStreamBytesClient\b/.test(source), 'wire file must not import makeClientStreamBytesClient');
		assert.ok(!source.includes('UniverseAgent-WorkTrees'));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('openUploadAttachmentStream / makeClientStreamBytesClient bytes; leftover RPCs stay JSON', () => {
		const client = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const upload = extractMethod(client, 'openUploadAttachmentStream');
		assert.ok(upload.includes('makeClientStreamBytesClient'), 'openUploadAttachmentStream must wire makeClientStreamBytesClient');
		assert.ok(upload.includes('encodeUploadChunk'), 'openUploadAttachmentStream must call encodeUploadChunk');
		assert.ok(upload.includes('decodeUploadResponse'), 'openUploadAttachmentStream must call decodeUploadResponse');
		assert.ok(upload.includes('mapUploadResponse'), 'openUploadAttachmentStream still maps UploadResponseWire');
		assert.ok(!upload.includes('mapUploadChunkWire'), 'write path must not use mapUploadChunkWire');
		assert.ok(!upload.includes('makeClientStreamClient<'), 'openUploadAttachmentStream must not use JSON makeClientStreamClient');
		assert.ok(!upload.includes('makeUnaryBytesClient'));
		assert.ok(!upload.includes('JSON.stringify'), 'JSON.stringify must not live in the method body');
		assert.ok(!/\bWatch\b/.test(upload));
		assert.ok(!/\bSaveSkillContent\b/.test(upload));
		assert.ok(!/\bResolveTurn\b/.test(upload));
		assert.ok(!/\bResolveAnchor\b/.test(upload));

		assert.ok(!extractAsyncMethod(client, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(extractAsyncMethod(client, 'saveSkillContent').includes('makeUnaryClient<'));
		assert.ok(!extractAsyncMethod(client, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(extractAsyncMethod(client, 'connect').includes('makeUnaryClient<'));
		assert.ok(!extractAsyncMethod(client, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(extractAsyncMethod(client, 'resolveTurn').includes('makeUnaryClient<'));
		assert.ok(!extractAsyncMethod(client, 'resolveAnchor').includes('makeUnaryBytesClient'));
		assert.ok(extractAsyncMethod(client, 'resolveAnchor').includes('makeUnaryClient<'));

		const watch = extractMethod(client, 'openWatchConfigStream');
		assert.ok(watch.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!watch.includes('makeServerStreamBytesClient'));

		const calls = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + 'Calls.ts'), 'utf8');
		const jsonStart = calls.indexOf('export function makeClientStreamClient<');
		assert.ok(jsonStart >= 0, 'missing makeClientStreamClient');
		const jsonEnd = calls.indexOf('\nexport function ', jsonStart + 1);
		const jsonBody = calls.slice(jsonStart, jsonEnd >= 0 ? jsonEnd : calls.length);
		assert.ok(jsonBody.includes('JSON.stringify'), 'makeClientStreamClient must keep JSON.stringify');
		assert.ok(jsonBody.includes('JSON.parse'), 'makeClientStreamClient must keep JSON.parse');
	});
});

function sampleHeader(header: UniverseAgentUploadHeader): UniverseAgentUploadHeader {
	return header;
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcUploadAttachmentStreamWire.ts')));
	assert.ok(dir, 'grpcUploadAttachmentStreamWire.ts not found from cwd or import.meta');
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
	const start = source.indexOf(`\t${name}(`);
	assert.ok(start >= 0, `missing ${name}(`);
	const from = start + 1;
	const next = source.slice(from).search(/\n\t(?:async )?[A-Za-z][A-Za-z0-9]*\(/);
	const end = next >= 0 ? from + next : source.length;
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

function protoBytes(encoded: Uint8Array, field: number): Uint8Array | undefined {
	return lastBytes(readProtoFields(encoded), field);
}
