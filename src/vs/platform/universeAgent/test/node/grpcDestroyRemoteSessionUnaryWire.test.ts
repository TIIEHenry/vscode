/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentDestroyRemoteSessionResult } from '../../common/universeAgentTypes.js';
import {
	decodeDestroyRemoteSessionResponse,
	encodeDestroyRemoteSessionRequest,
	type DestroyRemoteSessionResponseWire,
} from '../../node/grpc/grpcDestroyRemoteSessionUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService DestroyRemoteSession protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeDestroyRemoteSessionRequest writes call_id=1; omits empty; not JSON', () => {
		const encoded = encodeDestroyRemoteSessionRequest({
			callId: 'call-1',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			call_id: 'call-1',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'call-1',
		});
		assert.ok(!protoStrings(encoded).has(2));
		assert.ok(!protoVarints(encoded).has(1));

		assert.strictEqual(encodeDestroyRemoteSessionRequest({
			callId: '',
		}).length, 0);
	});

	test('decodeDestroyRemoteSessionResponse reads success=1 message=2; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'destroyed'),
			encodeStringField(3, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeDestroyRemoteSessionResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'destroyed',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapDestroyRemoteSessionResponse(wire), {
			success: true,
			message: 'destroyed',
		});

		const empty = decodeDestroyRemoteSessionResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
		});
		assert.deepStrictEqual(mapDestroyRemoteSessionResponse(empty), {
			success: false,
			message: '',
		});

		const unusedOnly = decodeDestroyRemoteSessionResponse(encodeStringField(3, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			success: undefined,
			message: undefined,
		});
		assert.deepStrictEqual(mapDestroyRemoteSessionResponse(unusedOnly), {
			success: false,
			message: '',
		});

		const explicitFalse = decodeDestroyRemoteSessionResponse(new Uint8Array([0x08, 0x00]));
		assert.deepStrictEqual(explicitFalse, {
			success: false,
			message: undefined,
		});
		assert.deepStrictEqual(mapDestroyRemoteSessionResponse(explicitFalse), {
			success: false,
			message: '',
		});
	});

	test('destroy-remote-session unary wire is RemoteAgentService.DestroyRemoteSession only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcDestroyRemoteSessionUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeDestroyRemoteSessionRequest\b/.test(source));
		assert.ok(/\bdecodeDestroyRemoteSessionResponse\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(/\blastString\b/.test(source));
		assert.ok(!/\bCreateRemoteSession\b|\bGetRemoteSessionStatus\b|\bGetRemoteSessionHistory\b/.test(source));
		assert.ok(!/\bResumeRemoteSession\b|\bCancelRemoteSession\b|\bRemoteChat\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('ONLY destroyRemoteSession still JSON unary; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const destroy = extractAsyncMethod(source, 'destroyRemoteSession');
		assert.ok(destroy.includes('makeUnaryClient<'), 'destroyRemoteSession still uses JSON makeUnaryClient');
		assert.ok(!destroy.includes('makeUnaryBytesClient'), 'destroyRemoteSession must not use makeUnaryBytesClient this slice');
		assert.ok(!destroy.includes('encodeDestroyRemoteSessionRequest'), 'destroyRemoteSession must not call encodeDestroyRemoteSessionRequest this slice');
		assert.ok(!destroy.includes('decodeDestroyRemoteSessionResponse'), 'destroyRemoteSession must not call decodeDestroyRemoteSessionResponse this slice');
		assert.ok(destroy.includes('call_id'), 'destroyRemoteSession still sends call_id JSON key');
		assert.ok(destroy.includes('mapDestroyRemoteSessionResponse'), 'destroyRemoteSession still calls mapDestroyRemoteSessionResponse');
		assert.ok(!source.includes('grpcDestroyRemoteSessionUnaryWire'));
		assert.ok(!/\bWatch\b/.test(destroy));

		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		const watchStart = source.indexOf('\topenWatchConfigStream(');
		assert.ok(watchStart >= 0, 'missing openWatchConfigStream(');
		const watchEnd = source.indexOf('\n\tasync ', watchStart + 1);
		const watchBody = source.slice(watchStart, watchEnd >= 0 ? watchEnd : source.length);
		assert.ok(watchBody.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!watchBody.includes('grpcDestroyRemoteSessionUnaryWire'));
	});
});

/** Same mapping as RemoteAgent.DestroyRemoteSession JSON unary (`success: wire.success === true`, `message: wire.message ?? ''`). */
function mapDestroyRemoteSessionResponse(wire: DestroyRemoteSessionResponseWire): UniverseAgentDestroyRemoteSessionResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
	};
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcDestroyRemoteSessionUnaryWire.ts')));
	assert.ok(dir, 'grpcDestroyRemoteSessionUnaryWire.ts not found from cwd or import.meta');
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
