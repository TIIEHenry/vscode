/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentSessionStreamCloseCause } from '../../common/universeAgentTypes.js';
import { asUnaryProtoBytes, makeClientStreamBytesClient } from '../../node/grpc/grpcClientCalls.js';

/** Not valid UTF-8 and not a JSON object (`{` as a raw byte). */
const BINARY_CHUNK = Uint8Array.from([0x00, 0xff, 0xfe, 0x7b, 0x22]);

suite('grpcClientCalls makeClientStreamBytesClient', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('write Uint8Array proto bytes; decode unary via caller; close-gate/error/end/dispose', () => {
		const first = openFakeBytesClient();
		assert.strictEqual(first.path, '/agentservice.FileTransferService/UploadAttachment');
		assert.strictEqual(first.serialize, asUnaryProtoBytes);

		first.handle.write(BINARY_CHUNK);
		assert.strictEqual(first.call.writes.length, 1);
		assert.strictEqual(first.call.writes[0], BINARY_CHUNK);
		const framed = first.serialize(BINARY_CHUNK);
		assert.ok(Buffer.isBuffer(framed));
		assert.deepStrictEqual([...framed], [...BINARY_CHUNK]);
		assert.notStrictEqual(framed.toString('utf8'), JSON.stringify(BINARY_CHUNK));

		const responseBuf = Buffer.from([42]);
		assert.deepStrictEqual(first.deserialize(responseBuf), { n: 42 });
		assert.strictEqual(first.decoded.length, 1);
		assert.strictEqual(first.decoded[0], responseBuf);

		first.callback(null, { n: 42 });
		assert.deepStrictEqual(first.responses, [{ n: 42 }]);
		assert.deepStrictEqual(first.closes, [{ kind: 'remote' }]);
		first.handle.write(Uint8Array.from([9]));
		first.handle.end();
		assert.strictEqual(first.call.writes.length, 1, 'write after remote close must no-op');
		assert.strictEqual(first.call.ended, false, 'end after remote close must no-op');
		first.handle.dispose();
		assert.strictEqual(first.call.cancelled, 1);

		const errored = openFakeBytesClient();
		errored.callback({ message: 'boom' });
		assert.deepStrictEqual(errored.responses, []);
		assert.deepStrictEqual(errored.closes, [{ kind: 'error', message: 'boom' }]);
		errored.handle.write(BINARY_CHUNK);
		errored.handle.end();
		assert.strictEqual(errored.call.writes.length, 0);
		assert.strictEqual(errored.call.ended, false);
		errored.handle.dispose();
		assert.strictEqual(errored.call.cancelled, 1);

		const local = openFakeBytesClient();
		local.handle.dispose();
		assert.strictEqual(local.call.cancelled, 1);
		local.callback({ message: 'cancelled' });
		assert.deepStrictEqual(local.closes, []);
		local.handle.write(BINARY_CHUNK);
		local.handle.end();
		assert.strictEqual(local.call.writes.length, 0);
		assert.strictEqual(local.call.ended, false);
	});

	test('makeClientStreamBytesClient exists; serializes proto bytes; JSON makeClientStreamClient stays', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClientCalls.ts'), 'utf8');
		assert.ok(/\bexport function makeClientStreamBytesClient\b/.test(source), 'identifier makeClientStreamBytesClient must exist');
		assert.ok(/\bexport function makeClientStreamClient\b/.test(source), 'JSON makeClientStreamClient must stay');

		const jsonStart = source.indexOf('export function makeClientStreamClient<');
		assert.ok(jsonStart >= 0, 'missing makeClientStreamClient');
		const jsonEnd = source.indexOf('export function makeClientStreamBytesClient<', jsonStart + 1);
		const jsonBody = source.slice(jsonStart, jsonEnd >= 0 ? jsonEnd : source.length);
		assert.ok(jsonBody.includes('JSON.stringify'), 'makeClientStreamClient must keep JSON.stringify');
		assert.ok(jsonBody.includes('JSON.parse'), 'makeClientStreamClient must keep JSON.parse');
		assert.ok(jsonBody.includes('createStreamCloseGate'));
		assert.ok(jsonBody.includes("gate.finish({ kind: 'error'"));
		assert.ok(jsonBody.includes("gate.finish({ kind: 'remote'"));
		assert.ok(jsonBody.includes('gate.closeLocal()'));
		assert.ok(jsonBody.includes('call.cancel()'));
		assert.ok(jsonBody.includes('call.end()'));
		assert.ok(jsonBody.includes('call.write('));

		const bytesStart = source.indexOf('export function makeClientStreamBytesClient<');
		assert.ok(bytesStart >= 0, 'missing makeClientStreamBytesClient');
		const bytesEnd = source.indexOf('\nexport function ', bytesStart + 1);
		const bytesBody = source.slice(bytesStart, bytesEnd >= 0 ? bytesEnd : source.length);
		assert.ok(!bytesBody.includes('JSON.stringify'), 'makeClientStreamBytesClient must not JSON.stringify');
		assert.ok(!bytesBody.includes('JSON.parse'), 'makeClientStreamBytesClient must not JSON.parse');
		assert.ok(bytesBody.includes('asUnaryProtoBytes'), 'makeClientStreamBytesClient must serialize via asUnaryProtoBytes');
		assert.ok(bytesBody.includes('decode: (buffer: Buffer) => TResponse'), 'makeClientStreamBytesClient must take caller decode');
		assert.ok(bytesBody.includes('(buffer: Buffer) => decode(buffer)'));
		assert.ok(bytesBody.includes('write(chunk: Uint8Array)'));
		assert.ok(bytesBody.includes('createStreamCloseGate'));
		assert.ok(bytesBody.includes("gate.finish({ kind: 'error'"));
		assert.ok(bytesBody.includes("gate.finish({ kind: 'remote'"));
		assert.ok(bytesBody.includes('gate.closeLocal()'));
		assert.ok(bytesBody.includes('call.cancel()'));
		assert.ok(bytesBody.includes('call.end()'));
		assert.ok(bytesBody.includes('call.write('));
	});

	test('openUploadAttachmentStream wires makeClientStreamBytesClient; leftover RPCs stay JSON', () => {
		const client = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const upload = extractMethod(client, 'openUploadAttachmentStream');
		assert.ok(upload.includes('makeClientStreamBytesClient'), 'openUploadAttachmentStream must wire makeClientStreamBytesClient');
		assert.ok(upload.includes('encodeUploadChunk'), 'openUploadAttachmentStream must call encodeUploadChunk');
		assert.ok(upload.includes('decodeUploadResponse'), 'openUploadAttachmentStream must call decodeUploadResponse');
		assert.ok(upload.includes('mapUploadResponse'), 'openUploadAttachmentStream still maps UploadResponseWire');
		assert.ok(!upload.includes('mapUploadChunkWire'), 'write path must not use mapUploadChunkWire');
		assert.ok(!upload.includes('makeClientStreamClient<'), 'openUploadAttachmentStream must not use JSON makeClientStreamClient');
		assert.ok(!upload.includes('JSON.stringify'), 'JSON.stringify lives in makeClientStreamClient, not the method body');

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
	});
});

type FakeCall = {
	writes: unknown[];
	ended: boolean;
	cancelled: number;
	write(chunk: unknown): void;
	end(): void;
	cancel(): void;
};

type FakeResponse = { n: number };

type FakeBytesClient = {
	path: string;
	serialize: (value: Uint8Array | undefined) => Buffer;
	deserialize: (buffer: Buffer) => FakeResponse;
	callback: (error: { message?: string } | null, response?: FakeResponse) => void;
	call: FakeCall;
	decoded: Buffer[];
	responses: FakeResponse[];
	closes: UniverseAgentSessionStreamCloseCause[];
	handle: { write(chunk: Uint8Array): void; end(): void; dispose(): void };
};

function openFakeBytesClient(): FakeBytesClient {
	const call: FakeCall = {
		writes: [],
		ended: false,
		cancelled: 0,
		write(chunk: unknown): void {
			this.writes.push(chunk);
		},
		end(): void {
			this.ended = true;
		},
		cancel(): void {
			this.cancelled++;
		},
	};
	const decoded: Buffer[] = [];
	const responses: FakeResponse[] = [];
	const closes: UniverseAgentSessionStreamCloseCause[] = [];
	let path = '';
	let serialize: ((value: Uint8Array | undefined) => Buffer) | undefined;
	let deserialize: ((buffer: Buffer) => FakeResponse) | undefined;
	let callback: ((error: { message?: string } | null, response?: FakeResponse) => void) | undefined;
	const channel = {
		makeClientStreamRequest(
			requestPath: string,
			ser: (value: Uint8Array | undefined) => Buffer,
			deser: (buffer: Buffer) => FakeResponse,
			cb: (error: { message?: string } | null, response?: FakeResponse) => void,
		) {
			path = requestPath;
			serialize = ser;
			deserialize = deser;
			callback = cb;
			return call;
		},
	};
	const handle = makeClientStreamBytesClient<FakeResponse>(
		channel as never,
		'agentservice.FileTransferService',
		'UploadAttachment',
		buffer => {
			decoded.push(buffer);
			return { n: buffer[0] ?? 0 };
		},
	)(response => responses.push(response), cause => closes.push(cause));
	assert.ok(serialize);
	assert.ok(deserialize);
	assert.ok(callback);
	return { path, serialize, deserialize, callback, call, decoded, responses, closes, handle };
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcClientCalls.ts')));
	assert.ok(dir, 'grpcClientCalls.ts not found from cwd or import.meta');
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
