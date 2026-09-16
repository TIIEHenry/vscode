/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapHistoryEntry, mapHistoryResponse } from '../../node/grpc/grpcClientMappers.js';
import {
	decodeHistoryResponse,
	encodeHistoryRequest,
} from '../../node/grpc/grpcAgentHistoryUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc AgentService History protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeHistoryRequest writes session_id=1 agent_id=2 limit=3 offset=4; omits empty/0; not JSON', () => {
		const encoded = encodeHistoryRequest({
			sessionId: 'sess-1',
			agentId: 'root',
			limit: 20,
			offset: 5,
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			session_id: 'sess-1',
			agent_id: 'root',
			limit: 20,
			offset: 5,
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'sess-1',
			2: 'root',
		});
		assert.deepStrictEqual(Object.fromEntries(protoVarints(encoded)), {
			3: 20,
			4: 5,
		});
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoStrings(encoded).has(4));
		assert.ok(!protoStrings(encoded).has(5));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));
		assert.ok(!protoVarints(encoded).has(5));

		const zeros = encodeHistoryRequest({
			sessionId: 'sess-1',
			agentId: '',
			limit: 0,
			offset: 0,
		});
		assert.strictEqual(protoStrings(zeros).get(1), 'sess-1');
		assert.ok(!protoStrings(zeros).has(2));
		assert.ok(!protoVarints(zeros).has(3));
		assert.ok(!protoVarints(zeros).has(4));
		assert.notStrictEqual(zeros[0], 0x7b);

		assert.strictEqual(encodeHistoryRequest({
			sessionId: '',
			agentId: '',
			limit: 0,
			offset: 0,
		}).length, 0);
	});

	test('decodeHistoryResponse reads entries=1 HistoryEntry 1-4 total=2; unused unread', () => {
		const entry = Buffer.concat([
			encodeStringField(1, 'user'),
			encodeStringField(2, 'hello'),
			encodeInt64Field(3, 1700000000),
			encodeStringField(4, 'root'),
			encodeStringField(5, 'unused-entry'),
		]);
		const second = Buffer.concat([
			encodeStringField(1, 'assistant'),
			encodeStringField(2, 'pong'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, entry),
			encodeMessageField(1, second),
			encodeInt32Field(2, 9),
			encodeStringField(3, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeHistoryResponse(encoded);
		assert.deepStrictEqual(wire, {
			entries: [
				{
					role: 'user',
					content: 'hello',
					timestamp: 1700000000,
					agent_id: 'root',
				},
				{
					role: 'assistant',
					content: 'pong',
					timestamp: undefined,
					agent_id: undefined,
				},
			],
			total: 9,
		});
		assert.ok(!('unused' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapHistoryEntry(wire.entries?.[0]), {
			role: 'user',
			content: 'hello',
			timestamp: 1700000000,
			agentId: 'root',
		});
		assert.deepStrictEqual(mapHistoryResponse(wire), {
			entries: [
				{
					role: 'user',
					content: 'hello',
					timestamp: 1700000000,
					agentId: 'root',
				},
				{
					role: 'assistant',
					content: 'pong',
					timestamp: 0,
					agentId: '',
				},
			],
			total: 9,
		});

		const omittedZeros = decodeHistoryResponse(encodeMessageField(1, encodeStringField(1, 'system')));
		assert.deepStrictEqual(omittedZeros, {
			entries: [{
				role: 'system',
				content: undefined,
				timestamp: undefined,
				agent_id: undefined,
			}],
			total: undefined,
		});
		assert.deepStrictEqual(mapHistoryResponse(omittedZeros), {
			entries: [{
				role: 'system',
				content: '',
				timestamp: 0,
				agentId: '',
			}],
			total: 0,
		});

		const empty = decodeHistoryResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			entries: [],
			total: undefined,
		});
		assert.deepStrictEqual(mapHistoryResponse(empty), {
			entries: [],
			total: 0,
		});
	});

	test('history unary wire is AgentService.History only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcAgentHistoryUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeHistoryRequest\b/.test(source));
		assert.ok(/\bdecodeHistoryResponse\b/.test(source));
		assert.ok(/\ballLengthDelimited\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!/\bencodeGetHistoryRequest\b|\bdecodeGetHistoryResponse\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('getAgentHistory uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcClient.ts'), 'utf8');
		const agentHistory = extractAsyncMethod(source, 'getAgentHistory');
		assert.ok(agentHistory.includes('makeUnaryBytesClient'), 'getAgentHistory must use makeUnaryBytesClient');
		assert.ok(agentHistory.includes('encodeHistoryRequest'), 'getAgentHistory must call encodeHistoryRequest');
		assert.ok(agentHistory.includes('decodeHistoryResponse'), 'getAgentHistory must call decodeHistoryResponse');
		assert.ok(agentHistory.includes('mapHistoryResponse'), 'getAgentHistory still calls mapHistoryResponse');
		assert.ok(!agentHistory.includes('makeUnaryClient<'), 'getAgentHistory must not use JSON makeUnaryClient');
		assert.ok(!agentHistory.includes('JSON.stringify'), 'getAgentHistory must not JSON.stringify');

		assert.ok(source.includes('grpcAgentHistoryUnaryWire'));

		const sessionHistory = extractAsyncMethod(source, 'getHistory');
		assert.ok(sessionHistory.includes('encodeGetHistoryRequest'));
		assert.ok(sessionHistory.includes('decodeGetHistoryResponse'));
		assert.ok(!sessionHistory.includes('encodeHistoryRequest'));
		assert.ok(!sessionHistory.includes('decodeHistoryResponse'));

		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		const watchStart = source.indexOf('\topenWatchConfigStream(');
		assert.ok(watchStart >= 0, 'missing openWatchConfigStream(');
		const watchEnd = source.indexOf('\n\tasync ', watchStart + 1);
		const watchBody = source.slice(watchStart, watchEnd >= 0 ? watchEnd : source.length);
		assert.ok(!watchBody.includes('makeUnaryBytesClient'));
		assert.ok(!watchBody.includes('grpcAgentHistoryUnaryWire'));
	});
});

function grpcDir(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [
		path.join(process.cwd(), 'src/vs/platform/universeAgent/node/grpc'),
		path.join(thisDir, '../../../../../../src/vs/platform/universeAgent/node/grpc'),
	];
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcAgentHistoryUnaryWire.ts')));
	assert.ok(dir, 'grpcAgentHistoryUnaryWire.ts not found from cwd or import.meta');
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
