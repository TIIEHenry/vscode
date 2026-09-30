/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapPtyServerMessage } from '../../node/grpc/grpcClientMappers.js';
import { decodePtyServerMessage, encodePtyClientMessage } from '../../node/grpc/grpcPtyStreamWire.js';
import {
	allLengthDelimited,
	encodeBytesField,
	encodeInt32Field,
	encodePresentMessageField,
	encodeStringField,
	encodeVarint,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

/** Binary payload that is not valid UTF-8 and contains `{`. */
const BINARY_DATA = Uint8Array.from([0x00, 0xff, 0xfe, 0x7b, 0x22]);

suite('grpc PtyService PtyStream protobuf bidi wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodePtyClientMessage writes raw bytes, present empty optionals, map entries, and empty shell args; not JSON or base64', () => {
		const encoded = encodePtyClientMessage({
			openSession: {
				engineSessionId: 'eng',
				clientSessionId: 'cli',
				tabId: 'tab',
				workingDirectory: '',
				shellArgs: ['', '-l'],
				environment: { '': '', PATH: '/bin' },
				columns: 0,
				rows: 24,
			},
			write: { data: BINARY_DATA },
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.ok(!Buffer.from(encoded).toString('utf8').includes(Buffer.from(BINARY_DATA).toString('base64')));
		const open = lastBytes(readProtoFields(encoded), 1);
		assert.ok(open);
		assert.strictEqual(protoStrings(open).get(1), 'eng');
		assert.strictEqual(protoStrings(open).get(2), 'cli');
		assert.strictEqual(protoStrings(open).get(3), 'tab');
		assert.strictEqual(lastString(readProtoFields(open), 4), '');
		assert.ok(!protoStrings(open).has(5));
		const args = allLengthDelimited(readProtoFields(open), 6).map(value => Buffer.from(value).toString('utf8'));
		assert.deepStrictEqual(args, ['', '-l']);
		const entries = allLengthDelimited(readProtoFields(open), 7);
		assert.strictEqual(entries.length, 2);
		assert.strictEqual(lastString(readProtoFields(entries[0]), 1), '');
		assert.strictEqual(lastString(readProtoFields(entries[0]), 2), '');
		assert.strictEqual(lastString(readProtoFields(entries[1]), 1), 'PATH');
		assert.strictEqual(lastString(readProtoFields(entries[1]), 2), '/bin');
		assert.ok(!protoVarints(open).has(9));
		assert.strictEqual(protoVarints(open).get(10), 24);

		const write = lastBytes(readProtoFields(encoded), 3);
		assert.ok(write);
		assert.deepStrictEqual(Buffer.from(lastBytes(readProtoFields(write), 1)!), Buffer.from(BINARY_DATA));

		const omittedOptional = encodePtyClientMessage({
			openSession: {
				engineSessionId: '',
				clientSessionId: 'cli',
				tabId: 'tab',
				shellArgs: [],
				environment: {},
				columns: 0,
				rows: 0,
			},
		});
		const omitted = lastBytes(readProtoFields(omittedOptional), 1)!;
		assert.ok(!protoStrings(omitted).has(1));
		assert.ok(!lastPresent(omitted, 4));
		assert.strictEqual(allLengthDelimited(readProtoFields(omitted), 6).length, 0);
		assert.strictEqual(allLengthDelimited(readProtoFields(omitted), 7).length, 0);

		const emptyWrite = encodePtyClientMessage({ write: { data: new Uint8Array(0) } });
		assert.notStrictEqual(emptyWrite[0], 0x7b);
		const emptyWriteBody = lastBytes(readProtoFields(emptyWrite), 3);
		assert.ok(emptyWriteBody);
		assert.strictEqual(emptyWriteBody.length, 0);

		const closeFalse = encodePtyClientMessage({ close: { interruptOnly: false } });
		const closeFalseBody = lastBytes(readProtoFields(closeFalse), 4);
		assert.ok(closeFalseBody);
		assert.strictEqual(closeFalseBody.length, 0);
		const closeTrue = encodePtyClientMessage({ close: { interruptOnly: true } });
		assert.strictEqual(lastVarint(readProtoFields(lastBytes(readProtoFields(closeTrue), 4)!), 1), 1n);

		const resizeZero = encodePtyClientMessage({ resize: { columns: 0, rows: 0 } });
		const resizeZeroBody = lastBytes(readProtoFields(resizeZero), 2);
		assert.ok(resizeZeroBody);
		assert.strictEqual(resizeZeroBody.length, 0);
	});

	test('decodePtyServerMessage reads arms and maps binary read data through mapPtyServerMessage', () => {
		const open = Buffer.concat([
			encodeVarintZero(1),
			encodeStringField(2, 'pty-1'),
			encodePresentMessageField(3, new Uint8Array(0)),
			encodeStringField(4, 'title'),
			encodeVarintZero(5),
			encodePresentMessageField(6, new Uint8Array(0)),
			encodeStringField(9, 'unused-open'),
		]);
		const read = encodeBytesField(1, BINARY_DATA);
		const closed = Buffer.concat([
			encodeVarintZero(1),
			encodePresentMessageField(2, new Uint8Array(0)),
		]);
		const error = Buffer.concat([
			encodeInt32Field(1, 3),
			encodeStringField(2, 'boom'),
		]);
		const encoded = Buffer.concat([
			encodePresentMessageField(1, open),
			encodePresentMessageField(2, read),
			encodePresentMessageField(3, closed),
			encodePresentMessageField(4, error),
			encodeStringField(9, 'unused-message'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodePtyServerMessage(encoded);
		assert.strictEqual(wire.open_session_response?.success, false);
		assert.strictEqual(wire.open_session_response?.failure_reason, 0);
		assert.strictEqual(wire.read?.data, Buffer.from(BINARY_DATA).toString('base64'));
		assert.deepStrictEqual(mapPtyServerMessage(wire), {
			openSessionResponse: {
				success: false,
				ptySessionId: 'pty-1',
				workingDirectory: '',
				title: 'title',
				failureReason: 'PTY_OPEN_FAILURE_UNSPECIFIED',
				errorMessage: '',
			},
			read: { data: BINARY_DATA },
			sessionClosed: { exitCode: 0, title: '' },
			error: { code: 'PTY_ERROR_INTERNAL', message: 'boom' },
		});

		const success = decodePtyServerMessage(encodePresentMessageField(1, encodeInt32Field(1, 1)));
		assert.strictEqual(mapPtyServerMessage(success).openSessionResponse?.success, true);
		assert.deepStrictEqual(mapPtyServerMessage(decodePtyServerMessage(new Uint8Array(0))), {});
	});

	test('pty wire encoder is not JSON or base64; openPtyStream uses the bytes handle', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcPtyStreamWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(!source.includes('bytesToBase64'));
		assert.ok(!source.includes('btoa'));
		assert.ok(!/\bResolveTurn\b|\bSaveSkillContent\b|\bWatchConfig\b/.test(source));
		const encodeStart = source.indexOf('export function encodePtyClientMessage');
		const encodeEnd = source.indexOf('export function decodePtyServerMessage');
		assert.ok(encodeStart >= 0 && encodeEnd > encodeStart);
		const encodeBody = source.slice(encodeStart, encodeEnd);
		assert.ok(!encodeBody.includes('toString(\'base64\')'));
		assert.ok(!encodeBody.includes('JSON.stringify'));
		assert.ok(source.includes('toString(\'base64\')'));

		const client = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		assert.ok(client.includes('grpcPtyStreamWire'));
		const pty = extractMethod(client, 'openPtyStream');
		assert.ok(pty.includes('makeResidentBidiBytesHandleClient'));
		assert.ok(pty.includes('encodePtyClientMessage'));
		assert.ok(pty.includes('decodePtyServerMessage'));
		assert.ok(pty.includes('mapPtyServerMessage'));
		assert.ok(pty.includes('handle.end()'));
		assert.ok(!pty.includes('makeResidentBidiHandleClient'));
		assert.ok(!pty.includes('bytesToBase64'));
		assert.ok(!pty.includes('JSON.stringify'));
		assert.ok(!pty.includes('toString(\'base64\')'));
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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcPtyStreamWire.ts')));
	assert.ok(dir, 'grpcPtyStreamWire.ts not found from cwd or import.meta');
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

function protoVarints(encoded: Uint8Array): Map<number, number> {
	const numbers = new Map<number, number>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 0) {
			numbers.set(field.field, Number(field.varint));
		}
	}
	return numbers;
}

function lastPresent(encoded: Uint8Array, fieldNumber: number): boolean {
	return readProtoFields(encoded).some(field => field.field === fieldNumber);
}
