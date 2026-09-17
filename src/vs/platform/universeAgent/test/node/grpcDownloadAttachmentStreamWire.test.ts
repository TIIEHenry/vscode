/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapDownloadChunk } from '../../node/grpc/grpcClientMappers.js';
import {
	decodeDownloadChunk,
	encodeDownloadAttachmentRequest,
} from '../../node/grpc/grpcDownloadAttachmentStreamWire.js';
import {
	encodeBytesField,
	encodeInt32Field,
	encodeInt64Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

/** Binary payload that is not valid UTF-8 and not a JSON object (`{` present as raw bytes). */
const BINARY_DATA = Uint8Array.from([0x00, 0xff, 0xfe, 0x7b, 0x22]);

suite('grpc FileTransferService DownloadAttachment protobuf server-stream wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeDownloadAttachmentRequest writes file_path=1 offset=2 max_bytes=3 session_id=4 artifact_id=5; omits 0/empty; optional artifact omit when undefined; not JSON', () => {
		const encoded = encodeDownloadAttachmentRequest({
			filePath: 'attachments/a.bin',
			offset: 64,
			maxBytes: 4096,
			sessionId: 'sess-9',
			artifactId: 'art-7',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			file_path: 'attachments/a.bin',
			offset: 64,
			max_bytes: 4096,
			session_id: 'sess-9',
			artifact_id: 'art-7',
		}));
		assert.strictEqual(protoStrings(encoded).get(1), 'attachments/a.bin');
		assert.strictEqual(protoVarints(encoded).get(2), 64);
		assert.strictEqual(protoVarints(encoded).get(3), 4096);
		assert.strictEqual(protoStrings(encoded).get(4), 'sess-9');
		assert.strictEqual(protoStrings(encoded).get(5), 'art-7');
		assert.ok(!protoStrings(encoded).has(6));
		assert.ok(!protoVarints(encoded).has(1));

		const withoutArtifact = encodeDownloadAttachmentRequest({
			filePath: 'attachments/a.bin',
			offset: 64,
			maxBytes: 4096,
			sessionId: 'sess-9',
			artifactId: '',
		});
		assert.strictEqual(protoStrings(withoutArtifact).get(1), 'attachments/a.bin');
		assert.strictEqual(protoVarints(withoutArtifact).get(2), 64);
		assert.strictEqual(protoVarints(withoutArtifact).get(3), 4096);
		assert.strictEqual(protoStrings(withoutArtifact).get(4), 'sess-9');
		assert.ok(!protoStrings(withoutArtifact).has(5));
		assert.notStrictEqual(withoutArtifact[0], 0x7b);

		const zeros = encodeDownloadAttachmentRequest({
			filePath: 'attachments/a.bin',
			offset: 0,
			maxBytes: 0,
			sessionId: 'sess-9',
			artifactId: '',
		});
		assert.strictEqual(protoStrings(zeros).get(1), 'attachments/a.bin');
		assert.strictEqual(protoStrings(zeros).get(4), 'sess-9');
		assert.ok(!protoVarints(zeros).has(2));
		assert.ok(!protoVarints(zeros).has(3));
		assert.ok(!protoStrings(zeros).has(5));

		assert.strictEqual(encodeDownloadAttachmentRequest({
			filePath: '',
			offset: 0,
			maxBytes: 0,
			sessionId: '',
			artifactId: '',
		}).length, 0);
	});

	test('decodeDownloadChunk reads offset=1 data=2 total_size=3 is_last=4 checksum_sha256=5 as base64; mapDownloadChunk recovers non-empty data; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeInt64Field(1, 128),
			encodeBytesField(2, BINARY_DATA),
			encodeInt64Field(3, 2048),
			encodeInt32Field(4, 1),
			encodeStringField(5, 'deadbeef'),
			encodeStringField(6, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.deepStrictEqual(Buffer.from(protoBytes(encoded, 2) ?? []), Buffer.from(BINARY_DATA));
		assert.notStrictEqual(Buffer.from(protoBytes(encoded, 2) ?? []).toString('utf8'), Buffer.from(BINARY_DATA).toString('base64'));
		const wire = decodeDownloadChunk(encoded);
		assert.strictEqual(wire.data, Buffer.from(BINARY_DATA).toString('base64'));
		assert.ok(wire.data && wire.data.length > 0, 'non-empty data must decode to non-empty base64');
		assert.deepStrictEqual(wire, {
			offset: 128,
			data: Buffer.from(BINARY_DATA).toString('base64'),
			total_size: 2048,
			is_last: true,
			checksum_sha256: 'deadbeef',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		const mapped = mapDownloadChunk(wire);
		assert.deepStrictEqual(Buffer.from(mapped.data), Buffer.from(BINARY_DATA));
		assert.ok(mapped.data.length > 0);
		assert.deepStrictEqual(mapped, {
			offset: 128,
			data: mapped.data,
			totalSize: 2048,
			isLast: true,
			checksumSha256: 'deadbeef',
		});

		const empty = decodeDownloadChunk(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			offset: undefined,
			data: undefined,
			total_size: undefined,
			is_last: undefined,
			checksum_sha256: undefined,
		});
		assert.deepStrictEqual(mapDownloadChunk(empty), {
			offset: 0,
			data: new Uint8Array(0),
			totalSize: 0,
			isLast: false,
			checksumSha256: '',
		});

		const unusedOnly = decodeDownloadChunk(encodeStringField(6, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			offset: undefined,
			data: undefined,
			total_size: undefined,
			is_last: undefined,
			checksum_sha256: undefined,
		});
		assert.deepStrictEqual(mapDownloadChunk(unusedOnly), {
			offset: 0,
			data: new Uint8Array(0),
			totalSize: 0,
			isLast: false,
			checksumSha256: '',
		});

		const explicitFalse = decodeDownloadChunk(new Uint8Array([0x20, 0x00]));
		assert.deepStrictEqual(explicitFalse, {
			offset: undefined,
			data: undefined,
			total_size: undefined,
			is_last: false,
			checksum_sha256: undefined,
		});
		assert.deepStrictEqual(mapDownloadChunk(explicitFalse), {
			offset: 0,
			data: new Uint8Array(0),
			totalSize: 0,
			isLast: false,
			checksumSha256: '',
		});
	});

	test('download-attachment stream wire is FileTransferService.DownloadAttachment only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcDownloadAttachmentStreamWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeDownloadAttachmentRequest\b/.test(source));
		assert.ok(/\bdecodeDownloadChunk\b/.test(source));
		assert.ok(/\blastBytes\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(/\blastString\b/.test(source));
		assert.ok(!/\bUploadAttachment\b|\bGetUploadProgress\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b|\bResolveAnchor\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('openDownloadAttachmentStream uses makeServerStreamBytesClient; Upload bytes; skip Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const download = extractMethod(source, 'openDownloadAttachmentStream');
		assert.ok(download.includes('makeServerStreamBytesClient'), 'openDownloadAttachmentStream must use makeServerStreamBytesClient');
		assert.ok(download.includes('encodeDownloadAttachmentRequest'), 'openDownloadAttachmentStream must call encodeDownloadAttachmentRequest');
		assert.ok(download.includes('decodeDownloadChunk'), 'openDownloadAttachmentStream must call decodeDownloadChunk');
		assert.ok(download.includes('mapDownloadChunk'), 'openDownloadAttachmentStream still calls mapDownloadChunk');
		assert.ok(!download.includes('makeServerStreamClient<'), 'openDownloadAttachmentStream must not use JSON makeServerStreamClient');
		assert.ok(!download.includes('JSON.stringify'), 'openDownloadAttachmentStream itself must not JSON.stringify');
		assert.ok(source.includes('grpcDownloadAttachmentStreamWire'));

		assert.ok(!extractMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(extractMethod(source, 'saveSkillContent').includes('makeUnaryClient<'));
		assert.ok(!extractMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(extractMethod(source, 'connect').includes('makeUnaryClient<'));
		assert.ok(!extractMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(extractMethod(source, 'resolveTurn').includes('makeUnaryClient<'));
		assert.ok(!extractMethod(source, 'resolveAnchor').includes('makeUnaryBytesClient'));
		assert.ok(extractMethod(source, 'resolveAnchor').includes('makeUnaryClient<'));

		const watch = extractMethod(source, 'openWatchConfigStream');
		assert.ok(watch.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!watch.includes('makeServerStreamBytesClient'));

		const upload = extractMethod(source, 'openUploadAttachmentStream');
		assert.ok(upload.includes('makeClientStreamBytesClient'), 'openUploadAttachmentStream must wire makeClientStreamBytesClient');
		assert.ok(upload.includes('encodeUploadChunk'), 'openUploadAttachmentStream must call encodeUploadChunk');
		assert.ok(upload.includes('decodeUploadResponse'), 'openUploadAttachmentStream must call decodeUploadResponse');
		assert.ok(!upload.includes('makeClientStreamClient<'));
		assert.ok(!upload.includes('makeServerStreamBytesClient'));
	});
});

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcDownloadAttachmentStreamWire.ts')));
	assert.ok(dir, 'grpcDownloadAttachmentStreamWire.ts not found from cwd or import.meta');
	return dir;
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
