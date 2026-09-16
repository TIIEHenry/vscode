/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type {
	UniverseAgentGetConfigResult,
	UniverseAgentSetConfigResult,
} from '../../common/universeAgentTypes.js';
import {
	decodeGetConfigResponse,
	decodeSetConfigResponse,
	encodeGetConfigRequest,
	encodeSetConfigRequest,
	type GetConfigResponseWire,
	type SetConfigResponseWire,
} from '../../node/grpc/grpcConfigUnaryWire.js';
import {
	encodeInt32Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc ConfigService Get/Set protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeGetConfigRequest writes key=1 scope=2 session_id=3; omits empty; not JSON', () => {
		const encoded = encodeGetConfigRequest({ key: 'theme', scope: 'session', sessionId: 'sess-1' });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(JSON.stringify({ session_id: 'sess-1' }).includes(Buffer.from(encoded).toString('utf8')), false);
		assert.strictEqual(protoStrings(encoded).get(1), 'theme');
		assert.strictEqual(protoStrings(encoded).get(2), 'session');
		assert.strictEqual(protoStrings(encoded).get(3), 'sess-1');
		assert.ok(!protoStrings(encoded).has(4));
		assert.ok(!protoVarints(encoded).has(1));

		const keyOnly = encodeGetConfigRequest({ key: 'theme', scope: '', sessionId: '' });
		assert.notStrictEqual(keyOnly[0], 0x7b);
		assert.strictEqual(protoStrings(keyOnly).get(1), 'theme');
		assert.ok(!protoStrings(keyOnly).has(2));
		assert.ok(!protoStrings(keyOnly).has(3));

		assert.strictEqual(encodeGetConfigRequest({ key: '', scope: '', sessionId: '' }).length, 0);
	});

	test('decodeGetConfigResponse reads values=1 MapEntry key=1 value=2 and scope=2; unknown unread', () => {
		const first = Buffer.concat([
			encodeStringField(1, 'theme'),
			encodeStringField(2, 'dark'),
			encodeStringField(3, 'unused-entry'),
		]);
		const second = Buffer.concat([
			encodeStringField(1, 'locale'),
			encodeStringField(2, 'zh'),
		]);
		const emptyValue = encodeStringField(1, 'empty-val');
		const encoded = Buffer.concat([
			encodeMessageField(1, first),
			encodeMessageField(1, second),
			encodeMessageField(1, emptyValue),
			encodeStringField(2, 'session'),
			encodeStringField(3, 'unused-field'),
		]);
		const wire = decodeGetConfigResponse(encoded);
		assert.deepStrictEqual(wire, {
			values: { theme: 'dark', locale: 'zh', 'empty-val': '' },
			scope: 'session',
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapGetConfig(wire), {
			values: { theme: 'dark', locale: 'zh', 'empty-val': '' },
			scope: 'session',
		});

		const empty = decodeGetConfigResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, { values: undefined, scope: undefined });
		assert.deepStrictEqual(mapGetConfig(empty), { values: {}, scope: '' });
		assert.deepStrictEqual(mapGetConfig({}), { values: {}, scope: '' });
	});

	test('encodeSetConfigRequest writes key=1 value=2 scope=3 session_id=4; omits empty; not JSON', () => {
		const encoded = encodeSetConfigRequest({
			key: 'theme',
			value: 'dark',
			scope: 'session',
			sessionId: 'sess-1',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(JSON.stringify({ session_id: 'sess-1' }).includes(Buffer.from(encoded).toString('utf8')), false);
		assert.strictEqual(protoStrings(encoded).get(1), 'theme');
		assert.strictEqual(protoStrings(encoded).get(2), 'dark');
		assert.strictEqual(protoStrings(encoded).get(3), 'session');
		assert.strictEqual(protoStrings(encoded).get(4), 'sess-1');
		assert.ok(!protoStrings(encoded).has(5));

		const keyOnly = encodeSetConfigRequest({ key: 'theme', value: '', scope: '', sessionId: '' });
		assert.strictEqual(protoStrings(keyOnly).get(1), 'theme');
		assert.ok(!protoStrings(keyOnly).has(2));
		assert.ok(!protoStrings(keyOnly).has(3));
		assert.ok(!protoStrings(keyOnly).has(4));

		assert.strictEqual(encodeSetConfigRequest({ key: '', value: '', scope: '', sessionId: '' }).length, 0);
	});

	test('decodeSetConfigResponse reads success=1 message=2; false omit; unknown unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'saved'),
			encodeStringField(3, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeSetConfigResponse(encoded);
		assert.deepStrictEqual(wire, { success: true, message: 'saved' });
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapSetConfig(wire), { ok: true, message: 'saved' });

		const empty = decodeSetConfigResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, { success: undefined, message: undefined });
		assert.deepStrictEqual(mapSetConfig(empty), { ok: false, message: undefined });

		const rejected = decodeSetConfigResponse(encodeInt32Field(1, 0));
		assert.deepStrictEqual(rejected, { success: undefined, message: undefined });
		assert.deepStrictEqual(mapSetConfig(rejected), { ok: false, message: undefined });
	});

	test('config unary wire is Get+Set only; no JSON.stringify; grpcClient still JSON', () => {
		const thisDir = path.dirname(fileURLToPath(import.meta.url));
		const candidates = [
			path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
			path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
		];
		const grpcDir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcConfigUnaryWire.ts')));
		assert.ok(grpcDir, 'grpcConfigUnaryWire.ts not found from cwd or import.meta');
		const source = fs.readFileSync(path.join(grpcDir, 'grpcConfigUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeGetConfigRequest\b/.test(source));
		assert.ok(/\bdecodeGetConfigResponse\b/.test(source));
		assert.ok(/\bencodeSetConfigRequest\b/.test(source));
		assert.ok(/\bdecodeSetConfigResponse\b/.test(source));
		assert.ok(!/\bencodeWatch|\bdecodeWatch|\bWatchConfig|\bConfigChanged/.test(source));
		assert.ok(!/\bSwitchModel|\bListModels|\bResolveModel|\bSetPermissionPolicy|\bGetModelPreferences|\bSetModelPreferences/.test(source));

		const client = fs.readFileSync(path.join(grpcDir, 'grpcClient.ts'), 'utf8');
		assert.ok(!client.includes('grpcConfigUnaryWire'));
		assert.ok(!client.includes('encodeGetConfigRequest'));
		assert.ok(!client.includes('decodeGetConfigResponse'));
		assert.ok(!client.includes('encodeSetConfigRequest'));
		assert.ok(!client.includes('decodeSetConfigResponse'));
		const getBody = extractAsyncMethod(client, 'getConfig');
		const setBody = extractAsyncMethod(client, 'setConfig');
		assert.ok(getBody.includes('makeUnaryClient<'), 'getConfig must stay JSON until a later slice wires bytes');
		assert.ok(setBody.includes('makeUnaryClient<'), 'setConfig must stay JSON until a later slice wires bytes');
		assert.ok(!getBody.includes('makeUnaryBytesClient'), 'getConfig must not be wired yet');
		assert.ok(!setBody.includes('makeUnaryBytesClient'), 'setConfig must not be wired yet');
	});
});

/** Same mapping as grpcClient.getConfig (inline; mapper file has none). */
function mapGetConfig(wire: GetConfigResponseWire): UniverseAgentGetConfigResult {
	return {
		values: wire.values && typeof wire.values === 'object' ? wire.values : {},
		scope: wire.scope ?? '',
	};
}

/** Same mapping as grpcClient.setConfig (inline; mapper file has none). */
function mapSetConfig(wire: SetConfigResponseWire): UniverseAgentSetConfigResult {
	return {
		ok: wire.success === true,
		message: wire.message,
	};
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

function extractAsyncMethod(source: string, name: string): string {
	const start = source.indexOf(`\tasync ${name}(`);
	assert.ok(start >= 0, `missing async ${name}(`);
	const nextAsync = source.indexOf('\n\tasync ', start + 1);
	const end = nextAsync >= 0 ? nextAsync : source.length;
	return source.slice(start, end);
}
