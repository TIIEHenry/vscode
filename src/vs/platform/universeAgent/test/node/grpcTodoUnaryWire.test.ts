/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapTodoItem, mapTodoResponse } from '../../node/grpc/grpcClientMappers.js';
import {
	decodeTodoResponse,
	encodeTodoRequest,
} from '../../node/grpc/grpcTodoUnaryWire.js';
import {
	encodeInt32Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService Todo protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeTodoRequest writes session_id=1 agent_id=2; omits empty; not JSON', () => {
		const encoded = encodeTodoRequest({ sessionId: 'sess-1', agentId: 'agent-9' });
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			agent_id: 'agent-9',
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'agent-9',
		});
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));

		const noAgent = encodeTodoRequest({ sessionId: 'sess-1', agentId: '' });
		assert.strictEqual(protoStrings(noAgent).get(1), 'sess-1');
		assert.ok(!protoStrings(noAgent).has(2));
		assert.notStrictEqual(noAgent[0], 0x7b);

		assert.strictEqual(encodeTodoRequest({ sessionId: '', agentId: '' }).length, 0);
	});

	test('decodeTodoResponse reads repeated items=1; TodoItem 1-6; unused unread', () => {
		const item = Buffer.concat([
			encodeStringField(1, 'todo-1'),
			encodeStringField(2, 'write wire'),
			encodeStringField(3, 'in_progress'),
			encodeInt32Field(4, 2),
			encodeInt32Field(5, 1),
			encodeStringField(6, 'waiting-review'),
			encodeStringField(7, 'unused-item-field'),
		]);
		const second = Buffer.concat([
			encodeStringField(1, 'todo-2'),
			encodeStringField(2, 'ship'),
			encodeStringField(3, 'pending'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, item),
			encodeMessageField(1, second),
			encodeStringField(2, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeTodoResponse(encoded);
		assert.deepStrictEqual(wire, {
			items: [
				{
					id: 'todo-1',
					content: 'write wire',
					status: 'in_progress',
					priority: 2,
					require_confirm: true,
					blocked: 'waiting-review',
				},
				{
					id: 'todo-2',
					content: 'ship',
					status: 'pending',
					priority: undefined,
					require_confirm: undefined,
					blocked: undefined,
				},
			],
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapTodoItem(wire.items?.[0]), {
			id: 'todo-1',
			content: 'write wire',
			status: 'in_progress',
			priority: 2,
			requireConfirm: true,
			blocked: 'waiting-review',
		});
		assert.deepStrictEqual(mapTodoResponse(wire), {
			items: [
				{
					id: 'todo-1',
					content: 'write wire',
					status: 'in_progress',
					priority: 2,
					requireConfirm: true,
					blocked: 'waiting-review',
				},
				{
					id: 'todo-2',
					content: 'ship',
					status: 'pending',
					priority: 0,
					requireConfirm: false,
					blocked: '',
				},
			],
		});

		const empty = decodeTodoResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, { items: [] });
		assert.deepStrictEqual(mapTodoResponse(empty), { items: [] });
	});

	test('todo unary wire is AgentService.Todo only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcTodoUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeTodoRequest\b/.test(source));
		assert.ok(/\bdecodeTodoResponse\b/.test(source));
		assert.ok(/\bencodeStringField\b/.test(source));
		assert.ok(/\ballLengthDelimited\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bClearSessionDemoFake\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('getTodo uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const body = extractAsyncMethod(source, 'getTodo');
		assert.ok(body.includes('makeUnaryBytesClient'), 'getTodo must use makeUnaryBytesClient');
		assert.ok(body.includes('encodeTodoRequest'), 'getTodo must call encodeTodoRequest');
		assert.ok(body.includes('decodeTodoResponse'), 'getTodo must call decodeTodoResponse');
		assert.ok(body.includes('mapTodoResponse'), 'getTodo still calls mapTodoResponse');
		assert.ok(!body.includes('makeUnaryClient<'), 'getTodo must not use JSON makeUnaryClient');
		assert.ok(!body.includes('JSON.stringify'), 'getTodo must not JSON.stringify');

		assert.ok(source.includes('grpcTodoUnaryWire'));
		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'testModelProfile').includes('makeUnaryBytesClient'));
	});
});

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcTodoUnaryWire.ts')));
	assert.ok(dir, 'grpcTodoUnaryWire.ts not found from cwd or import.meta');
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
