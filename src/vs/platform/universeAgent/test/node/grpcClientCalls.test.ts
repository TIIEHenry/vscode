/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { makeClientStreamClient, asUnaryProtoBytes, makeClientStreamBytesClient, makeResidentBidiBytesHandleClient } from '../../node/grpc/grpcClientCalls.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentSessionStreamCloseCause } from '../../common/universeAgentTypes.js';

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
		let jsonSer: ((v: { a: number }) => Buffer) | undefined;
		let jsonDeser: ((b: Buffer) => { ok: boolean }) | undefined;
		const jsonChannel = {
			makeClientStreamRequest(_p: string, ser: (v: { a: number }) => Buffer, deser: (b: Buffer) => { ok: boolean }) {
				jsonSer = ser;
				jsonDeser = deser;
				return { write() { }, end() { }, cancel() { } };
			},
		};
		const jsonHandle = makeClientStreamClient<{ a: number }, { ok: boolean }>(jsonChannel as never, 'agentservice.FileTransferService', 'Legacy')(
			() => { },
		);
		jsonHandle.dispose();
		assert.strictEqual(jsonSer?.({ a: 1 }).toString('utf8'), '{"a":1}');
		assert.deepStrictEqual(jsonDeser?.(Buffer.from('{"ok":true}')), { ok: true });

		const bytes = openFakeBytesClient();
		assert.strictEqual(bytes.serialize, asUnaryProtoBytes);
		assert.deepStrictEqual(bytes.deserialize(Buffer.from([9])), { n: 9 });
		bytes.handle.dispose();
	});

	test('resident bidi handle drops data after local dispose but keeps it after a half-close', () => {
		const channel = fakeBidiChannel();
		const open = makeResidentBidiBytesHandleClient<{ n: number }>(
			channel as never,
			'agentservice.ChatService',
			'Chat',
			buffer => ({ n: buffer[0] ?? 0 }),
		);
		const responses: number[] = [];
		const causes: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = open(response => responses.push(response.n), cause => causes.push(cause));

		handle.end();
		channel.emitData({ n: 1 });
		assert.deepStrictEqual(responses, [1], 'half-close must still deliver server frames');
		assert.deepStrictEqual(causes, [], 'half-close is not a close');

		handle.dispose();
		channel.emitData({ n: 2 });
		assert.deepStrictEqual(responses, [1], 'locally disposed stream must drop late frames');
		assert.deepStrictEqual(causes, []);
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

function fakeBidiChannel(): { emitData(data: unknown): void } {
	let onData: ((data: unknown) => void) | undefined;
	const call = {
		on(event: string, listener: (value: unknown) => void): void {
			if (event === 'data') {
				onData = listener;
			}
		},
		write(): void { },
		end(): void { },
		cancel(): void { },
	};
	return {
		makeBidiStreamRequest: () => call,
		emitData: (data: unknown) => onData?.(data),
	} as never;
}
