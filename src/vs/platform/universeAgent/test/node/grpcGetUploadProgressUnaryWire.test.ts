/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentGetUploadProgressResult } from '../../common/universeAgentTypes.js';
import {
	decodeGetUploadProgressResponse,
	encodeGetUploadProgressRequest,
	type UploadProgressResponseWire,
} from '../../node/grpc/grpcGetUploadProgressUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc FileTransferService GetUploadProgress protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeGetUploadProgressRequest writes transfer_id=1 session_id=2; omits empty; not JSON', () => {
		const encoded = encodeGetUploadProgressRequest({
			transferId: 'xfer-1',
			sessionId: 'sess-9',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			transfer_id: 'xfer-1',
			session_id: 'sess-9',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'xfer-1',
			2: 'sess-9',
		});
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		const transferOnly = encodeGetUploadProgressRequest({
			transferId: 'xfer-1',
			sessionId: '',
		});
		assert.strictEqual(protoStrings(transferOnly).get(1), 'xfer-1');
		assert.ok(!protoStrings(transferOnly).has(2));
		assert.notStrictEqual(transferOnly[0], 0x7b);

		assert.strictEqual(encodeGetUploadProgressRequest({
			transferId: '',
			sessionId: '',
		}).length, 0);
	});

	test('decodeGetUploadProgressResponse reads exists=1 bytes_received=2 partial_path=3; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeInt64Field(2, 1),
			encodeInt64Field(2, 4096),
			encodeStringField(3, 'partial/xfer-1.bin'),
			encodeStringField(4, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeGetUploadProgressResponse(encoded);
		assert.deepStrictEqual(wire, {
			exists: true,
			bytes_received: 4096,
			partial_path: 'partial/xfer-1.bin',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapUploadProgressResponse(wire), {
			exists: true,
			bytesReceived: 4096,
			partialPath: 'partial/xfer-1.bin',
		});

		const empty = decodeGetUploadProgressResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			exists: undefined,
			bytes_received: undefined,
			partial_path: undefined,
		});
		assert.deepStrictEqual(mapUploadProgressResponse(empty), {
			exists: false,
			bytesReceived: 0,
			partialPath: '',
		});

		const unusedOnly = decodeGetUploadProgressResponse(encodeStringField(4, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			exists: undefined,
			bytes_received: undefined,
			partial_path: undefined,
		});
		assert.deepStrictEqual(mapUploadProgressResponse(unusedOnly), {
			exists: false,
			bytesReceived: 0,
			partialPath: '',
		});

		const explicitFalse = decodeGetUploadProgressResponse(new Uint8Array([0x08, 0x00]));
		assert.deepStrictEqual(explicitFalse, {
			exists: false,
			bytes_received: undefined,
			partial_path: undefined,
		});
		assert.deepStrictEqual(mapUploadProgressResponse(explicitFalse), {
			exists: false,
			bytesReceived: 0,
			partialPath: '',
		});
	});

	test('get-upload-progress unary wire is FileTransferService.GetUploadProgress only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcGetUploadProgressUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeGetUploadProgressRequest\b/.test(source));
		assert.ok(/\bdecodeGetUploadProgressResponse\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(/\blastString\b/.test(source));
		assert.ok(!/\bUploadAttachment\b|\bDownloadAttachment\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('getUploadProgress uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const getUpload = extractGetUploadProgress(source);
		assert.ok(getUpload.includes('makeUnaryBytesClient'), 'getUploadProgress must use makeUnaryBytesClient');
		assert.ok(getUpload.includes('encodeGetUploadProgressRequest'), 'getUploadProgress must call encodeGetUploadProgressRequest');
		assert.ok(getUpload.includes('decodeGetUploadProgressResponse'), 'getUploadProgress must call decodeGetUploadProgressResponse');
		assert.ok(getUpload.includes('mapUploadProgressResponse'), 'getUploadProgress still calls mapUploadProgressResponse');
		assert.ok(!getUpload.includes('makeUnaryClient<'), 'getUploadProgress must not use JSON makeUnaryClient');
		assert.ok(!getUpload.includes('JSON.stringify'), 'getUploadProgress must not JSON.stringify');
		assert.ok(source.includes('grpcGetUploadProgressUnaryWire'));
		assert.ok(!/\bWatch\b/.test(getUpload));

		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
	});

	test('skip UploadAttachment/DownloadAttachment streams; do not lock siblings', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const upload = extractMethod(source, 'openUploadAttachmentStream');
		assert.ok(upload.includes('makeClientStreamClient<Record<string, unknown>'));
		assert.ok(!upload.includes('makeUnaryBytesClient'));
		assert.ok(!upload.includes('grpcGetUploadProgressUnaryWire'));

		const download = extractMethod(source, 'openDownloadAttachmentStream');
		assert.ok(download.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!download.includes('makeUnaryBytesClient'));
		assert.ok(!download.includes('grpcGetUploadProgressUnaryWire'));
	});
});

/** TEST mapper: same shape as catalog `mapUploadProgressResponse`. */
function mapUploadProgressResponse(wire: UploadProgressResponseWire): UniverseAgentGetUploadProgressResult {
	return {
		exists: wire.exists === true,
		bytesReceived: requiredInt64(wire.bytes_received),
		partialPath: wire.partial_path ?? '',
	};
}

function requiredInt64(value: number | string | undefined): number {
	if (value === undefined || value === '') {
		return 0;
	}
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcGetUploadProgressUnaryWire.ts')));
	assert.ok(dir, 'grpcGetUploadProgressUnaryWire.ts not found from cwd or import.meta');
	return dir;
}

function extractGetUploadProgress(source: string): string {
	const start = source.indexOf('\tasync getUploadProgress(');
	assert.ok(start >= 0, 'missing async getUploadProgress(');
	const end = source.indexOf('\n\topenUploadAttachmentStream(', start + 1);
	assert.ok(end >= 0, 'missing openUploadAttachmentStream after getUploadProgress');
	return source.slice(start, end);
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
