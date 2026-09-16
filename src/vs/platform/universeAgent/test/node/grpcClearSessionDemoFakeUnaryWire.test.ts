/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentClearSessionDemoFakeResult } from '../../common/universeAgentTypes.js';
import {
	decodeClearSessionDemoFakeResponse,
	encodeClearSessionDemoFakeRequest,
	type ClearSessionDemoFakeResponseWire,
} from '../../node/grpc/grpcClearSessionDemoFakeUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService ClearSessionDemoFake protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeClearSessionDemoFakeRequest writes session_id=1; omits empty; not JSON', () => {
		const encoded = encodeClearSessionDemoFakeRequest({ sessionId: 'sess-1' });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({ session_id: 'sess-1' }));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), { 1: 'sess-1' });
		assert.ok(!protoStrings(encoded).has(2));
		assert.ok(!protoVarints(encoded).has(1));

		assert.strictEqual(encodeClearSessionDemoFakeRequest({ sessionId: '' }).length, 0);
	});

	test('decodeClearSessionDemoFakeResponse reads success=1 message=2 reason_code=3; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'cleared'),
			encodeStringField(3, 'OK'),
			encodeStringField(4, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeClearSessionDemoFakeResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'cleared',
			reason_code: 'OK',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapClearSessionDemoFake(wire), {
			ok: true,
			message: 'cleared',
			reasonCode: 'OK',
		});

		const empty = decodeClearSessionDemoFakeResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
			reason_code: undefined,
		});
		assert.deepStrictEqual(mapClearSessionDemoFake(empty), {
			ok: false,
			message: undefined,
			reasonCode: '',
		});
	});

	test('clear-session-demo-fake unary wire is ClearSessionDemoFake only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClearSessionDemoFakeUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeClearSessionDemoFakeRequest\b/.test(source));
		assert.ok(/\bdecodeClearSessionDemoFakeResponse\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bConnect\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bFireTriggerWebhook\b|\bInstallSessionDemoFake\b/.test(source));
		assert.ok(!/\bResolveTurn\b|\bSwitchWorkDir\b|\bRebuild\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('clearSessionDemoFake uses bytes then existing map; skip Connect/SaveSkillContent/Watch', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const clear = extractAsyncMethod(source, 'clearSessionDemoFake');
		assert.ok(clear.includes('makeUnaryBytesClient'), 'clearSessionDemoFake must use makeUnaryBytesClient');
		assert.ok(clear.includes('encodeClearSessionDemoFakeRequest'), 'clearSessionDemoFake must call encodeClearSessionDemoFakeRequest');
		assert.ok(clear.includes('decodeClearSessionDemoFakeResponse'), 'clearSessionDemoFake must call decodeClearSessionDemoFakeResponse');
		assert.ok(clear.includes('ok: wire.success === true'), 'clearSessionDemoFake must keep ok: wire.success === true');
		assert.ok(!clear.includes('makeUnaryClient<'), 'clearSessionDemoFake must not use JSON makeUnaryClient');
		assert.ok(!clear.includes('JSON.stringify'), 'clearSessionDemoFake must not JSON.stringify');

		assert.ok(source.includes('grpcClearSessionDemoFakeUnaryWire'));
		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(extractAsyncMethod(source, 'switchWorkDir').includes('makeUnaryBytesClient'));
	});
});

/** Same mapping as Agent.ClearSessionDemoFake JSON unary (`ok: wire.success === true`). */
function mapClearSessionDemoFake(wire: ClearSessionDemoFakeResponseWire): UniverseAgentClearSessionDemoFakeResult {
	return {
		ok: wire.success === true,
		message: wire.message,
		reasonCode: wire.reason_code ?? '',
	};
}

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcClearSessionDemoFakeUnaryWire.ts')));
	assert.ok(dir, 'grpcClearSessionDemoFakeUnaryWire.ts not found from cwd or import.meta');
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
