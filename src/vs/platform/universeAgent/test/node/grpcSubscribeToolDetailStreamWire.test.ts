/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapSubscribeToolDetailChunk } from '../../node/grpc/grpcClientMappers.js';
import {
	decodeSubscribeToolDetailChunk,
	encodeSubscribeToolDetailRequest,
} from '../../node/grpc/grpcSubscribeToolDetailStreamWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService SubscribeToolDetail protobuf server-stream wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeSubscribeToolDetailRequest writes fields 1-7; omits empty/0/undefined; not JSON', () => {
		const encoded = encodeSubscribeToolDetailRequest({
			sessionId: 'sess-1',
			toolCallId: 'tc-2',
			detailKind: 3,
			refId: 'ref-9',
			mimeType: 'text/plain',
			fromRevision: 42,
			tailBytes: 4096,
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			tool_call_id: 'tc-2',
			detail_kind: 3,
			ref_id: 'ref-9',
			mime_type: 'text/plain',
			from_revision: 42,
			tail_bytes: 4096,
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'tc-2',
			4: 'ref-9',
			5: 'text/plain',
		});
		assert.deepStrictEqual(Object.fromEntries(protoVarints(encoded)), {
			3: 3,
			6: 42,
			7: 4096,
		});
		assert.ok(!protoStrings(encoded).has(8));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(5));

		const noOptional = encodeSubscribeToolDetailRequest({
			sessionId: 'sess-1',
			toolCallId: 'tc-2',
			detailKind: 3,
			refId: 'ref-9',
			fromRevision: 42,
		});
		assert.strictEqual(protoStrings(noOptional).get(1), 'sess-1');
		assert.strictEqual(protoStrings(noOptional).get(2), 'tc-2');
		assert.strictEqual(protoVarints(noOptional).get(3), 3);
		assert.strictEqual(protoStrings(noOptional).get(4), 'ref-9');
		assert.ok(!protoStrings(noOptional).has(5));
		assert.strictEqual(protoVarints(noOptional).get(6), 42);
		assert.ok(!protoVarints(noOptional).has(7));
		assert.notStrictEqual(noOptional[0], 0x7b);

		const sessionOnly = encodeSubscribeToolDetailRequest({
			sessionId: 'sess-1',
			toolCallId: '',
			detailKind: 0,
			refId: '',
			fromRevision: 0,
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));
		assert.ok(!protoVarints(sessionOnly).has(3));
		assert.ok(!protoStrings(sessionOnly).has(4));
		assert.ok(!protoStrings(sessionOnly).has(5));
		assert.ok(!protoVarints(sessionOnly).has(6));
		assert.ok(!protoVarints(sessionOnly).has(7));
		assert.notStrictEqual(sessionOnly[0], 0x7b);

		assert.strictEqual(encodeSubscribeToolDetailRequest({
			sessionId: '',
			toolCallId: '',
			detailKind: 0,
			refId: '',
			fromRevision: 0,
		}).length, 0);
	});

	test('decodeSubscribeToolDetailChunk reads fields 1-9; mapSubscribeToolDetailChunk non-empty; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'boom'),
			encodeStringField(3, 'tail-bytes'),
			encodeInt64Field(4, 42),
			encodeInt32Field(5, 1),
			encodeInt64Field(6, 4096),
			encodeStringField(7, 'text/plain'),
			encodeInt32Field(8, 1),
			encodeInt32Field(9, 2),
			encodeStringField(10, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeSubscribeToolDetailChunk(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			error_message: 'boom',
			content: 'tail-bytes',
			revision: 42,
			truncated: true,
			total_bytes: 4096,
			mime_type: 'text/plain',
			eof: true,
			content_mode: 2,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		const mapped = mapSubscribeToolDetailChunk(wire);
		assert.ok(mapped.content.length > 0);
		assert.deepStrictEqual(mapped, {
			success: true,
			errorMessage: 'boom',
			content: 'tail-bytes',
			revision: 42,
			truncated: true,
			totalBytes: 4096,
			mimeType: 'text/plain',
			eof: true,
			contentMode: 'TOOL_DETAIL_CONTENT_MODE_APPEND_SLICE',
		});

		const empty = decodeSubscribeToolDetailChunk(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			error_message: undefined,
			content: undefined,
			revision: undefined,
			truncated: undefined,
			total_bytes: undefined,
			mime_type: undefined,
			eof: undefined,
			content_mode: undefined,
		});
		assert.deepStrictEqual(mapSubscribeToolDetailChunk(empty), {
			success: false,
			errorMessage: '',
			content: '',
			revision: 0,
			truncated: false,
			eof: false,
			contentMode: 'TOOL_DETAIL_CONTENT_MODE_UNSPECIFIED',
		});
	});

	test('subscribe-tool-detail stream wire is SubscribeToolDetail only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcSubscribeToolDetailStreamWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeSubscribeToolDetailRequest\b/.test(source));
		assert.ok(/\bdecodeSubscribeToolDetailChunk\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(/\blastString\b/.test(source));
		assert.ok(/\bencodeInt32Field\b/.test(source));
		assert.ok(/\bencodeInt64Field\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b|\bResolveAnchor\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('openSubscribeToolDetailStream uses makeServerStreamBytesClient; skip Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor/Upload', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const body = extractMethod(source, 'openSubscribeToolDetailStream');
		assert.ok(body.includes('makeServerStreamBytesClient'), 'openSubscribeToolDetailStream must use makeServerStreamBytesClient');
		assert.ok(body.includes('encodeSubscribeToolDetailRequest'), 'openSubscribeToolDetailStream must call encodeSubscribeToolDetailRequest');
		assert.ok(body.includes('decodeSubscribeToolDetailChunk'), 'openSubscribeToolDetailStream must call decodeSubscribeToolDetailChunk');
		assert.ok(body.includes('mapSubscribeToolDetailChunk'), 'openSubscribeToolDetailStream still calls mapSubscribeToolDetailChunk');
		assert.ok(!body.includes('makeServerStreamClient<'), 'openSubscribeToolDetailStream must not use JSON makeServerStreamClient');
		assert.ok(!body.includes('JSON.stringify'), 'openSubscribeToolDetailStream itself must not JSON.stringify');
		assert.ok(source.includes('grpcSubscribeToolDetailStreamWire'));

		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryClient<'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(extractAsyncMethod(source, 'connect').includes('makeUnaryClient<'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryClient<'));
		assert.ok(!extractAsyncMethod(source, 'resolveAnchor').includes('makeUnaryBytesClient'));
		assert.ok(extractAsyncMethod(source, 'resolveAnchor').includes('makeUnaryClient<'));

		const watch = extractMethod(source, 'openWatchConfigStream');
		assert.ok(watch.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!watch.includes('makeServerStreamBytesClient'));

		const upload = extractMethod(source, 'openUploadAttachmentStream');
		assert.ok(upload.includes('makeClientStreamClient<'));
		assert.ok(!upload.includes('makeClientStreamBytesClient'));
		assert.ok(!upload.includes('makeServerStreamBytesClient'));
	});
});

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcSubscribeToolDetailStreamWire.ts')));
	assert.ok(dir, 'grpcSubscribeToolDetailStreamWire.ts not found from cwd or import.meta');
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
