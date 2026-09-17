/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapGetRemoteSessionHistoryResponse } from '../../node/grpc/grpcClientMappersCatalog.js';
import {
	decodeGetRemoteSessionHistoryResponse,
	encodeGetRemoteSessionHistoryRequest,
} from '../../node/grpc/grpcGetRemoteSessionHistoryUnaryWire.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodePresentMessageField,
	encodeStringField,
	encodeVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService GetRemoteSessionHistory protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeGetRemoteSessionHistoryRequest writes call_id=1 since_version=2 page_size=3; omits empty/0; not JSON', () => {
		const encoded = encodeGetRemoteSessionHistoryRequest({
			callId: 'call-1',
			sinceVersion: 7,
			pageSize: 20,
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			call_id: 'call-1',
			since_version: 7,
			page_size: 20,
		}));
		assert.deepStrictEqual(Object.fromEntries(protoStrings(encoded)), {
			1: 'call-1',
		});
		assert.deepStrictEqual(Object.fromEntries(protoVarints(encoded)), {
			2: 7,
			3: 20,
		});
		assert.ok(!protoStrings(encoded).has(2));
		assert.ok(!protoStrings(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(4));

		const zeros = encodeGetRemoteSessionHistoryRequest({
			callId: 'call-1',
			sinceVersion: 0,
			pageSize: 0,
		});
		assert.strictEqual(protoStrings(zeros).get(1), 'call-1');
		assert.ok(!protoVarints(zeros).has(2));
		assert.ok(!protoVarints(zeros).has(3));
		assert.notStrictEqual(zeros[0], 0x7b);
		assert.strictEqual(encodeInt64Field(2, 0).length, 0);
		assert.strictEqual(encodeInt32Field(3, 0).length, 0);

		const numbersOnly = encodeGetRemoteSessionHistoryRequest({
			callId: '',
			sinceVersion: 7,
			pageSize: 20,
		});
		assert.ok(!protoStrings(numbersOnly).has(1));
		assert.strictEqual(protoVarints(numbersOnly).get(2), 7);
		assert.strictEqual(protoVarints(numbersOnly).get(3), 20);

		assert.strictEqual(encodeGetRemoteSessionHistoryRequest({
			callId: '',
			sinceVersion: 0,
			pageSize: 0,
		}).length, 0);
	});

	test('decodeGetRemoteSessionHistoryResponse reads messages=1 version=2 has_more=3 then mapper', () => {
		const toolCall = Buffer.concat([
			encodeStringField(1, 'c1'),
			encodeStringField(2, 'bash'),
			encodeStringField(3, '{}'),
			encodeStringField(4, 'unused-tool-call'),
		]);
		const assistant = Buffer.concat([
			encodeStringField(1, 'done'),
			encodeMessageField(2, toolCall),
		]);
		const toolResult = Buffer.concat([
			encodeStringField(1, 'c1'),
			encodeStringField(2, 'bash'),
			encodeStringField(3, 'out'),
			encodeInt32Field(4, 1),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, encodePresentMessageField(1, encodeStringField(1, 'sys'))),
			encodeMessageField(1, encodePresentMessageField(2, encodeStringField(1, 'hi'))),
			encodeMessageField(1, encodePresentMessageField(3, assistant)),
			encodeMessageField(1, encodePresentMessageField(4, toolResult)),
			encodeMessageField(1, Buffer.concat([
				encodePresentMessageField(1, encodeStringField(1, 'keep')),
				encodeStringField(5, 'unused-message'),
			])),
			encodeInt64Field(2, 42),
			encodeInt32Field(3, 1),
			encodeStringField(4, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeGetRemoteSessionHistoryResponse(encoded);
		assert.deepStrictEqual(wire, {
			messages: [
				{ system: { content: 'sys' } },
				{ user: { content: 'hi' } },
				{
					assistant: {
						content: 'done',
						tool_calls: [{ id: 'c1', name: 'bash', arguments: '{}' }],
					},
				},
				{
					tool_result: {
						tool_call_id: 'c1',
						tool_name: 'bash',
						content: 'out',
						is_error: true,
					},
				},
				{ system: { content: 'keep' } },
			],
			version: 42,
			has_more: true,
		});
		assert.ok(!('unused' in wire));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapGetRemoteSessionHistoryResponse(wire), {
			messages: [
				{ system: { content: 'sys' } },
				{ user: { content: 'hi' } },
				{
					assistant: {
						content: 'done',
						toolCalls: [{ id: 'c1', name: 'bash', arguments: '{}' }],
					},
				},
				{
					toolResult: {
						toolCallId: 'c1',
						toolName: 'bash',
						content: 'out',
						isError: true,
					},
				},
				{ system: { content: 'keep' } },
			],
			version: 42,
			hasMore: true,
		});
		assert.ok(mapGetRemoteSessionHistoryResponse(wire).messages.length > 0);

		const lastWins = decodeGetRemoteSessionHistoryResponse(Buffer.concat([
			encodeInt64Field(2, 1),
			encodeInt64Field(2, 42),
			encodeInt32Field(3, 1),
		]));
		assert.strictEqual(lastWins.version, 42);
		assert.strictEqual(lastWins.has_more, true);
		assert.deepStrictEqual(lastWins.messages, []);
		assert.deepStrictEqual(mapGetRemoteSessionHistoryResponse(lastWins).messages, []);
	});

	test('decodeGetRemoteSessionHistoryResponse omitted/false/zero; mapper missing messages → []', () => {
		const empty = decodeGetRemoteSessionHistoryResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			messages: [],
			version: undefined,
			has_more: undefined,
		});
		assert.deepStrictEqual(mapGetRemoteSessionHistoryResponse(empty), {
			messages: [],
			version: 0,
			hasMore: false,
		});

		const unusedOnly = decodeGetRemoteSessionHistoryResponse(encodeStringField(4, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			messages: [],
			version: undefined,
			has_more: undefined,
		});
		assert.strictEqual(JSON.stringify(unusedOnly).includes('unused'), false);
		assert.deepStrictEqual(mapGetRemoteSessionHistoryResponse(unusedOnly), {
			messages: [],
			version: 0,
			hasMore: false,
		});

		const explicitFalse = decodeGetRemoteSessionHistoryResponse(new Uint8Array([0x18, 0x00]));
		assert.deepStrictEqual(explicitFalse, {
			messages: [],
			version: undefined,
			has_more: false,
		});
		assert.strictEqual(mapGetRemoteSessionHistoryResponse(explicitFalse).hasMore, false);
		assert.deepStrictEqual(mapGetRemoteSessionHistoryResponse(explicitFalse).messages, []);

		const zeroPresent = decodeGetRemoteSessionHistoryResponse(encodeVarintZero(2));
		assert.strictEqual(zeroPresent.version, 0);
		assert.deepStrictEqual(zeroPresent.messages, []);
		assert.strictEqual(mapGetRemoteSessionHistoryResponse(zeroPresent).version, 0);
		assert.deepStrictEqual(mapGetRemoteSessionHistoryResponse(zeroPresent).messages, []);
		assert.strictEqual(encodeInt64Field(2, 0).length, 0);
	});

	test('get-remote-session-history unary wire is RemoteAgentService.GetRemoteSessionHistory only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcGetRemoteSessionHistoryUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeGetRemoteSessionHistoryRequest\b/.test(source));
		assert.ok(/\bdecodeGetRemoteSessionHistoryResponse\b/.test(source));
		assert.ok(/\bencodeInt64Field\b/.test(source));
		assert.ok(/\bencodeInt32Field\b/.test(source));
		assert.ok(/\bencodeStringField\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(/\ballLengthDelimited\b/.test(source));
		assert.ok(/\bdecodeRemoteChatMessage\b/.test(source));
		assert.ok(/\bRemoteChatMessage\b/.test(source));
		assert.ok(/grpcRemoteChatStreamWire/.test(source));
		assert.ok(!/\bCreateRemoteSession\b|\bDestroyRemoteSession\b|\bGetRemoteSessionStatus\b/.test(source));
		assert.ok(!/\bResumeRemoteSession\b|\bCancelRemoteSession\b|\bRemoteChat\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b|\bResolveAnchor\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('getRemoteSessionHistory uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const history = extractAsyncMethod(source, 'getRemoteSessionHistory');
		assert.ok(history.includes('makeUnaryBytesClient'), 'getRemoteSessionHistory must use makeUnaryBytesClient');
		assert.ok(history.includes('encodeGetRemoteSessionHistoryRequest'), 'getRemoteSessionHistory must call encodeGetRemoteSessionHistoryRequest');
		assert.ok(history.includes('decodeGetRemoteSessionHistoryResponse'), 'getRemoteSessionHistory must call decodeGetRemoteSessionHistoryResponse');
		assert.ok(history.includes('mapGetRemoteSessionHistoryResponse'), 'getRemoteSessionHistory still calls mapGetRemoteSessionHistoryResponse');
		assert.ok(!history.includes('makeUnaryClient<'), 'getRemoteSessionHistory must not use JSON makeUnaryClient');
		assert.ok(!history.includes('JSON.stringify'), 'getRemoteSessionHistory must not JSON.stringify');
		assert.ok(source.includes('grpcGetRemoteSessionHistoryUnaryWire'));
		assert.ok(!/\bWatch\b/.test(history));

		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveAnchor').includes('makeUnaryBytesClient'));
		const watchStart = source.indexOf('\topenWatchConfigStream(');
		assert.ok(watchStart >= 0, 'missing openWatchConfigStream(');
		const watchEnd = source.indexOf('\n\tasync ', watchStart + 1);
		const watchBody = source.slice(watchStart, watchEnd >= 0 ? watchEnd : source.length);
		assert.ok(watchBody.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!watchBody.includes('makeUnaryBytesClient'));
		assert.ok(!watchBody.includes('grpcGetRemoteSessionHistoryUnaryWire'));
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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcGetRemoteSessionHistoryUnaryWire.ts')));
	assert.ok(dir, 'grpcGetRemoteSessionHistoryUnaryWire.ts not found from cwd or import.meta');
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
