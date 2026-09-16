/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapResumeRemoteSessionResponse } from '../../node/grpc/grpcClientMappersCatalog.js';
import {
	decodeResumeRemoteSessionResponse,
	encodeResumeRemoteSessionRequest,
} from '../../node/grpc/grpcResumeRemoteSessionUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeStringField,
	encodeVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService ResumeRemoteSession protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeResumeRemoteSessionRequest writes call_id=1 node_id=2; omits empty; not JSON', () => {
		const encoded = encodeResumeRemoteSessionRequest({
			callId: 'call-1',
			nodeId: 'node-9',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			call_id: 'call-1',
			node_id: 'node-9',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'call-1',
			2: 'node-9',
		});
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		const callOnly = encodeResumeRemoteSessionRequest({
			callId: 'call-1',
			nodeId: '',
		});
		assert.strictEqual(protoStrings(callOnly).get(1), 'call-1');
		assert.ok(!protoStrings(callOnly).has(2));
		assert.notStrictEqual(callOnly[0], 0x7b);

		assert.strictEqual(encodeResumeRemoteSessionRequest({
			callId: '',
			nodeId: '',
		}).length, 0);
	});

	test('decodeResumeRemoteSessionResponse reads success=1 call_id=2 status=3 message=4 expires_at=5; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'call-1'),
			encodeStringField(3, 'resumed'),
			encodeStringField(4, 'session live'),
			encodeInt64Field(5, 1700003600),
			encodeStringField(6, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeResumeRemoteSessionResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			call_id: 'call-1',
			status: 'resumed',
			message: 'session live',
			expires_at: 1700003600,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapResumeRemoteSessionResponse(wire), {
			success: true,
			callId: 'call-1',
			status: 'resumed',
			message: 'session live',
			expiresAt: 1700003600,
		});

		const empty = decodeResumeRemoteSessionResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			call_id: undefined,
			status: undefined,
			message: undefined,
			expires_at: undefined,
		});
		assert.deepStrictEqual(mapResumeRemoteSessionResponse(empty), {
			success: false,
			callId: '',
			status: '',
			message: '',
			expiresAt: 0,
		});

		const lastWins = decodeResumeRemoteSessionResponse(Buffer.concat([
			encodeInt32Field(1, 1),
			encodeInt64Field(5, 1),
			encodeInt64Field(5, 1700003600),
		]));
		assert.strictEqual(lastWins.success, true);
		assert.strictEqual(lastWins.expires_at, 1700003600);
		assert.strictEqual(mapResumeRemoteSessionResponse(lastWins).expiresAt, 1700003600);

		const successFalse = decodeResumeRemoteSessionResponse(Buffer.from([0x08, 0x00]));
		assert.deepStrictEqual(successFalse, {
			success: false,
			call_id: undefined,
			status: undefined,
			message: undefined,
			expires_at: undefined,
		});
		assert.strictEqual(mapResumeRemoteSessionResponse(successFalse).success, false);
		assert.strictEqual(mapResumeRemoteSessionResponse(successFalse).expiresAt, 0);

		const zeroPresent = decodeResumeRemoteSessionResponse(encodeVarintZero(5));
		assert.strictEqual(zeroPresent.expires_at, 0);
		assert.strictEqual(mapResumeRemoteSessionResponse(zeroPresent).expiresAt, 0);
		assert.strictEqual(encodeInt64Field(5, 0).length, 0);
	});

	test('resume-remote-session unary wire is RemoteAgentService.ResumeRemoteSession only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcResumeRemoteSessionUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeResumeRemoteSessionRequest\b/.test(source));
		assert.ok(/\bdecodeResumeRemoteSessionResponse\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bCancelRemoteSession\b|\bDestroyRemoteSession\b|\bCreateRemoteSession\b/.test(source));
		assert.ok(!/\bGetRemoteSessionStatus\b|\bGetRemoteSessionHistory\b/.test(source));
		assert.ok(!/\bResumeLoop\b|\bresumeSession\b|\bencodeResumeSessionRequest\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('ONLY resumeRemoteSession still JSON unary; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const resume = extractAsyncMethod(source, 'resumeRemoteSession');
		assert.ok(resume.includes('makeUnaryClient<'), 'resumeRemoteSession still uses JSON makeUnaryClient');
		assert.ok(!resume.includes('makeUnaryBytesClient'), 'resumeRemoteSession must not use makeUnaryBytesClient this slice');
		assert.ok(!resume.includes('encodeResumeRemoteSessionRequest'), 'resumeRemoteSession must not call encodeResumeRemoteSessionRequest this slice');
		assert.ok(!resume.includes('decodeResumeRemoteSessionResponse'), 'resumeRemoteSession must not call decodeResumeRemoteSessionResponse this slice');
		assert.ok(resume.includes('call_id'), 'resumeRemoteSession still sends call_id JSON key');
		assert.ok(resume.includes('node_id'), 'resumeRemoteSession still sends node_id JSON key');
		assert.ok(resume.includes('mapResumeRemoteSessionResponse'), 'resumeRemoteSession still calls mapResumeRemoteSessionResponse');
		assert.ok(!source.includes('grpcResumeRemoteSessionUnaryWire'));
		assert.ok(!/\bWatch\b/.test(resume));

		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		const watchStart = source.indexOf('\topenWatchConfigStream(');
		assert.ok(watchStart >= 0, 'missing openWatchConfigStream(');
		const watchEnd = source.indexOf('\n\tasync ', watchStart + 1);
		const watchBody = source.slice(watchStart, watchEnd >= 0 ? watchEnd : source.length);
		assert.ok(watchBody.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!watchBody.includes('grpcResumeRemoteSessionUnaryWire'));
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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcResumeRemoteSessionUnaryWire.ts')));
	assert.ok(dir, 'grpcResumeRemoteSessionUnaryWire.ts not found from cwd or import.meta');
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

function protoVarints(encoded: Uint8Array): Map<number, number> {
	const numbers = new Map<number, number>();
	for (const field of readProtoFields(encoded)) {
		if (field.wireType === 0) {
			numbers.set(field.field, Number(field.varint));
		}
	}
	return numbers;
}
