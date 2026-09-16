/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapPruneResponse } from '../../node/grpc/grpcClientMappers.js';
import {
	decodePruneResponse,
	encodePruneRequest,
} from '../../node/grpc/grpcPruneUnaryWire.js';
import {
	encodeInt32Field,
	encodeStringField,
	encodeVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService Prune protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodePruneRequest writes session_id=1 agent_id=2; omits empty; not JSON', () => {
		const encoded = encodePruneRequest({
			sessionId: 'sess-1',
			agentId: 'agent-9',
		});
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

		const sessionOnly = encodePruneRequest({
			sessionId: 'sess-1',
			agentId: '',
		});
		assert.strictEqual(protoStrings(sessionOnly).get(1), 'sess-1');
		assert.ok(!protoStrings(sessionOnly).has(2));
		assert.notStrictEqual(sessionOnly[0], 0x7b);

		assert.strictEqual(encodePruneRequest({
			sessionId: '',
			agentId: '',
		}).length, 0);
	});

	test('decodePruneResponse reads success=1 message=2 removed_count=3; 0 omit; unused unread', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'pruned'),
			encodeInt32Field(3, 4),
			encodeStringField(4, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodePruneResponse(encoded);
		assert.deepStrictEqual(wire, {
			success: true,
			message: 'pruned',
			removed_count: 4,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapPruneResponse(wire), {
			ok: true,
			message: 'pruned',
			removedCount: 4,
		});

		const empty = decodePruneResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			success: undefined,
			message: undefined,
			removed_count: undefined,
		});
		assert.deepStrictEqual(mapPruneResponse(empty), {
			ok: false,
			message: undefined,
			removedCount: 0,
		});

		const zeroPresent = decodePruneResponse(encodeVarintZero(3));
		assert.strictEqual(zeroPresent.removed_count, 0);
		assert.deepStrictEqual(mapPruneResponse(zeroPresent), {
			ok: false,
			message: undefined,
			removedCount: 0,
		});
		assert.strictEqual(encodeInt32Field(3, 0).length, 0);
	});

	test('prune unary wire is Prune only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcPruneUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodePruneRequest\b/.test(source));
		assert.ok(/\bdecodePruneResponse\b/.test(source));
		assert.ok(/\bencodeStringField\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bClearSessionDemoFake\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('prune still JSON unary; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const prune = extractAsyncMethod(source, 'prune');
		assert.ok(prune.includes('makeUnaryClient<'), 'prune still uses JSON makeUnaryClient');
		assert.ok(!prune.includes('makeUnaryBytesClient'), 'prune must not use makeUnaryBytesClient this slice');
		assert.ok(!prune.includes('encodePruneRequest'), 'prune must not call encodePruneRequest this slice');
		assert.ok(!prune.includes('decodePruneResponse'), 'prune must not call decodePruneResponse this slice');
		assert.ok(prune.includes('mapPruneResponse'), 'prune still calls mapPruneResponse');
		assert.ok(prune.includes('session_id'), 'prune still sends session_id JSON key');
		assert.ok(prune.includes('agent_id'), 'prune still sends agent_id JSON key');
		assert.ok(!source.includes('grpcPruneUnaryWire'));

		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(!/\bWatch\b/.test(prune));
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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcPruneUnaryWire.ts')));
	assert.ok(dir, 'grpcPruneUnaryWire.ts not found from cwd or import.meta');
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
