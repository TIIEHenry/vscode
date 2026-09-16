/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	mapContextVariableListResponse,
	mapContextVariableReadResponse,
} from '../../node/grpc/grpcClientMappers.js';
import {
	decodeContextVariableListResponse,
	decodeContextVariableReadResponse,
	encodeContextVariableListRequest,
	encodeContextVariableReadRequest,
} from '../../node/grpc/grpcContextVariableUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc ContextVariable List/Read protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeContextVariableListRequest writes session_id=1 agent_id=2; omits empty; not JSON', () => {
		const encoded = encodeContextVariableListRequest({ sessionId: 'sess-1', agentId: 'agent-9' });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(JSON.stringify({ session_id: 'sess-1' }).includes(Buffer.from(encoded).toString('utf8')), false);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.strictEqual(protoStrings(encoded).get(2), 'agent-9');
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));

		const rootOnly = encodeContextVariableListRequest({ sessionId: 'sess-1', agentId: '' });
		assert.notStrictEqual(rootOnly[0], 0x7b);
		assert.strictEqual(protoStrings(rootOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(rootOnly).has(2));

		assert.strictEqual(encodeContextVariableListRequest({ sessionId: '', agentId: '' }).length, 0);
	});

	test('decodeContextVariableListResponse reads current=1 inherited=2; Summary 1-5; GLOBAL=0 omit; unknown unread', () => {
		const current = Buffer.concat([
			encodeStringField(1, 'cwd'),
			encodeInt32Field(2, 1),
			encodeStringField(3, 'root'),
			encodeInt64Field(4, 1700000000000),
			encodeStringField(5, '/tmp/…'),
			encodeStringField(6, 'unused-current'),
		]);
		const inherited = Buffer.concat([
			encodeStringField(1, 'home'),
			encodeStringField(3, 'parent'),
			encodeInt64Field(4, 42),
			encodeStringField(5, '~'),
			encodeStringField(6, 'unused-inherited'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, current),
			encodeMessageField(2, inherited),
			encodeStringField(3, 'unused-field'),
		]);
		const wire = decodeContextVariableListResponse(encoded);
		assert.deepStrictEqual(wire, {
			current: [{
				name: 'cwd',
				scope: 1,
				updated_by: 'root',
				updated_at: 1700000000000,
				content_preview: '/tmp/…',
			}],
			inherited: [{
				name: 'home',
				scope: undefined,
				updated_by: 'parent',
				updated_at: 42,
				content_preview: '~',
			}],
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapContextVariableListResponse(wire), {
			current: [{
				name: 'cwd',
				scope: 'VARIABLE_LOCAL',
				updatedBy: 'root',
				updatedAt: 1700000000000,
				contentPreview: '/tmp/…',
			}],
			inherited: [{
				name: 'home',
				scope: 'VARIABLE_GLOBAL',
				updatedBy: 'parent',
				updatedAt: 42,
				contentPreview: '~',
			}],
		});
		assert.deepStrictEqual(decodeContextVariableListResponse(new Uint8Array(0)), {
			current: [],
			inherited: [],
		});
		assert.deepStrictEqual(mapContextVariableListResponse(decodeContextVariableListResponse(new Uint8Array(0))), {
			current: [],
			inherited: [],
		});
	});

	test('encodeContextVariableReadRequest writes session_id=1 name=2 agent_id=3; omits empty; not JSON', () => {
		const encoded = encodeContextVariableReadRequest({
			sessionId: 'sess-1',
			name: 'cwd',
			agentId: 'agent-9',
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.strictEqual(JSON.stringify({ session_id: 'sess-1' }).includes(Buffer.from(encoded).toString('utf8')), false);
		assert.strictEqual(protoStrings(encoded).get(1), 'sess-1');
		assert.strictEqual(protoStrings(encoded).get(2), 'cwd');
		assert.strictEqual(protoStrings(encoded).get(3), 'agent-9');
		assert.ok(!protoStrings(encoded).has(4));

		const emptyName = encodeContextVariableReadRequest({ sessionId: 'sess-1', name: '', agentId: '' });
		assert.strictEqual(protoStrings(emptyName).get(1), 'sess-1');
		assert.ok(!protoStrings(emptyName).has(2));
		assert.ok(!protoStrings(emptyName).has(3));

		assert.strictEqual(encodeContextVariableReadRequest({ sessionId: '', name: '', agentId: '' }).length, 0);
	});

	test('decodeContextVariableReadResponse reads entry=1; Entry 1-5; GLOBAL=0 omit; unknown unread', () => {
		const entry = Buffer.concat([
			encodeStringField(1, 'cwd'),
			encodeStringField(2, '/tmp/work'),
			encodeInt32Field(3, 1),
			encodeStringField(4, 'root'),
			encodeInt64Field(5, 1700000000000),
			encodeStringField(6, 'unused-entry'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, entry),
			encodeStringField(2, 'unused-field'),
		]);
		const wire = decodeContextVariableReadResponse(encoded);
		assert.deepStrictEqual(wire, {
			entry: {
				name: 'cwd',
				content: '/tmp/work',
				scope: 1,
				updated_by: 'root',
				updated_at: 1700000000000,
			},
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapContextVariableReadResponse(wire), {
			entry: {
				name: 'cwd',
				content: '/tmp/work',
				scope: 'VARIABLE_LOCAL',
				updatedBy: 'root',
				updatedAt: 1700000000000,
			},
		});

		const globalEntry = decodeContextVariableReadResponse(encodeMessageField(1, encodeStringField(1, 'home')));
		assert.strictEqual(globalEntry.entry?.scope, undefined);
		assert.strictEqual(mapContextVariableReadResponse(globalEntry).entry.scope, 'VARIABLE_GLOBAL');
		assert.deepStrictEqual(decodeContextVariableReadResponse(new Uint8Array(0)), { entry: undefined });
		assert.deepStrictEqual(mapContextVariableReadResponse(decodeContextVariableReadResponse(new Uint8Array(0))), {
			entry: {
				name: '',
				content: '',
				scope: 'VARIABLE_GLOBAL',
				updatedBy: '',
				updatedAt: 0,
			},
		});
	});

	test('context variable unary wire is List+Read only; no JSON.stringify; grpcClient uses bytes', () => {
		const thisDir = path.dirname(fileURLToPath(import.meta.url));
		const candidates = [
			path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
			path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
		];
		const grpcDir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcContextVariableUnaryWire.ts')));
		assert.ok(grpcDir, 'grpcContextVariableUnaryWire.ts not found from cwd or import.meta');
		const source = fs.readFileSync(path.join(grpcDir, 'grpcContextVariableUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeContextVariableListRequest\b/.test(source));
		assert.ok(/\bdecodeContextVariableListResponse\b/.test(source));
		assert.ok(/\bencodeContextVariableReadRequest\b/.test(source));
		assert.ok(/\bdecodeContextVariableReadResponse\b/.test(source));
		assert.ok(!/\bencodeContextVariableWriteRequest|\bencodeContextVariableSetRequest|\bencodeContextVariableDeleteRequest/.test(source));

		const client = fs.readFileSync(path.join(grpcDir, 'grpcClient.ts'), 'utf8');
		assert.ok(client.includes('grpcContextVariableUnaryWire'));
		const methods: Array<{ name: string; encoder: string; decoder: string; mapper: string }> = [
			{ name: 'listContextVariable', encoder: 'encodeContextVariableListRequest', decoder: 'decodeContextVariableListResponse', mapper: 'mapContextVariableListResponse' },
			{ name: 'readContextVariable', encoder: 'encodeContextVariableReadRequest', decoder: 'decodeContextVariableReadResponse', mapper: 'mapContextVariableReadResponse' },
		];
		for (const { name, encoder, decoder, mapper } of methods) {
			const body = extractAsyncMethod(client, name);
			assert.ok(body.includes('makeUnaryBytesClient'), `${name} must use makeUnaryBytesClient`);
			assert.ok(body.includes(encoder), `${name} must call ${encoder}`);
			assert.ok(body.includes(decoder), `${name} must call ${decoder}`);
			assert.ok(body.includes(mapper), `${name} must call ${mapper}`);
			assert.ok(!body.includes('makeUnaryClient<'), `${name} must not use JSON makeUnaryClient`);
			assert.ok(!body.includes('JSON.stringify'), `${name} must not JSON.stringify`);
		}
	});
});

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
