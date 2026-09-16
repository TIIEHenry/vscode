/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentCancelRemoteSessionResult } from '../../common/universeAgentTypes.js';
import {
	decodeCancelRemoteSessionResponse,
	encodeCancelRemoteSessionRequest,
	type CancelRemoteSessionResponseWire,
} from '../../node/grpc/grpcCancelRemoteSessionUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService CancelRemoteSession protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeCancelRemoteSessionRequest writes call_id=1 reason=2; omits empty; not JSON', () => {
		const encoded = encodeCancelRemoteSessionRequest({
			callId: 'call-7',
			reason: 'user',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			call_id: 'call-7',
			reason: 'user',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'call-7',
			2: 'user',
		});
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		const callOnly = encodeCancelRemoteSessionRequest({
			callId: 'call-7',
			reason: '',
		});
		assert.strictEqual(protoStrings(callOnly).get(1), 'call-7');
		assert.ok(!protoStrings(callOnly).has(2));
		assert.notStrictEqual(callOnly[0], 0x7b);

		const reasonOnly = encodeCancelRemoteSessionRequest({
			callId: '',
			reason: 'user',
		});
		assert.ok(!protoStrings(reasonOnly).has(1));
		assert.strictEqual(protoStrings(reasonOnly).get(2), 'user');

		assert.strictEqual(encodeCancelRemoteSessionRequest({
			callId: '',
			reason: '',
		}).length, 0);
	});

	test('decodeCancelRemoteSessionResponse reads success=1 call_id=2 status=3 message=4; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'call-7'),
			encodeStringField(3, 'cancelled'),
			encodeStringField(4, 'ok'),
			encodeStringField(5, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeCancelRemoteSessionResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			call_id: 'call-7',
			status: 'cancelled',
			message: 'ok',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapCancelRemoteSessionResponse(wire), {
			success: true,
			callId: 'call-7',
			status: 'cancelled',
			message: 'ok',
		});
	});

	test('decodeCancelRemoteSessionResponse treats omitted/false success as not true', () => {
		const empty = decodeCancelRemoteSessionResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			call_id: undefined,
			status: undefined,
			message: undefined,
		});
		assert.deepStrictEqual(mapCancelRemoteSessionResponse(empty), {
			success: false,
			callId: '',
			status: '',
			message: '',
		});

		const unusedOnly = decodeCancelRemoteSessionResponse(encodeStringField(5, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			success: undefined,
			call_id: undefined,
			status: undefined,
			message: undefined,
		});
		assert.deepStrictEqual(mapCancelRemoteSessionResponse(unusedOnly), {
			success: false,
			callId: '',
			status: '',
			message: '',
		});

		const explicitFalse = decodeCancelRemoteSessionResponse(new Uint8Array([0x08, 0x00]));
		assert.deepStrictEqual(explicitFalse, {
			success: false,
			call_id: undefined,
			status: undefined,
			message: undefined,
		});
		assert.deepStrictEqual(mapCancelRemoteSessionResponse(explicitFalse), {
			success: false,
			callId: '',
			status: '',
			message: '',
		});
	});

	test('cancel-remote-session unary wire is RemoteAgentService.CancelRemoteSession only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcCancelRemoteSessionUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeCancelRemoteSessionRequest\b/.test(source));
		assert.ok(/\bdecodeCancelRemoteSessionResponse\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(/\blastString\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bDestroyRemoteSession\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('ONLY cancelRemoteSession still JSON unary; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const cancel = extractAsyncMethod(source, 'cancelRemoteSession');
		assert.ok(cancel.includes('makeUnaryClient<'), 'cancelRemoteSession still uses JSON makeUnaryClient');
		assert.ok(!cancel.includes('makeUnaryBytesClient'), 'cancelRemoteSession must not use makeUnaryBytesClient this slice');
		assert.ok(!cancel.includes('encodeCancelRemoteSessionRequest'), 'cancelRemoteSession must not call encodeCancelRemoteSessionRequest this slice');
		assert.ok(!cancel.includes('decodeCancelRemoteSessionResponse'), 'cancelRemoteSession must not call decodeCancelRemoteSessionResponse this slice');
		assert.ok(cancel.includes('call_id'), 'cancelRemoteSession still sends call_id JSON key');
		assert.ok(cancel.includes('reason'), 'cancelRemoteSession still sends reason JSON key');
		assert.ok(cancel.includes('mapCancelRemoteSessionResponse'), 'cancelRemoteSession still calls mapCancelRemoteSessionResponse');
		assert.ok(!source.includes('grpcCancelRemoteSessionUnaryWire'));
		assert.ok(!/\bWatch\b/.test(cancel));
		assert.ok(!/\bSaveSkillContent\b/.test(cancel));
		assert.ok(!/\bResolveTurn\b/.test(cancel));
	});
});

/** Same mapping as RemoteAgent.CancelRemoteSession JSON unary (`success: wire.success === true`). */
function mapCancelRemoteSessionResponse(wire: CancelRemoteSessionResponseWire): UniverseAgentCancelRemoteSessionResult {
	return {
		success: wire.success === true,
		callId: wire.call_id ?? '',
		status: wire.status ?? '',
		message: wire.message ?? '',
	};
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcCancelRemoteSessionUnaryWire.ts')));
	assert.ok(dir, 'grpcCancelRemoteSessionUnaryWire.ts not found from cwd or import.meta');
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
