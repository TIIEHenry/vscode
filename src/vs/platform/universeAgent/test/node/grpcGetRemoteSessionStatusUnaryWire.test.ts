/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapGetRemoteSessionStatusResponse } from '../../node/grpc/grpcClientMappersCatalog.js';
import {
	decodeGetRemoteSessionStatusResponse,
	encodeGetRemoteSessionStatusRequest,
} from '../../node/grpc/grpcGetRemoteSessionStatusUnaryWire.js';
import {
	encodeInt64Field,
	encodeMessageField,
	encodeStringField,
	encodeVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService GetRemoteSessionStatus protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeGetRemoteSessionStatusRequest writes call_id=1; omits empty; not JSON', () => {
		const encoded = encodeGetRemoteSessionStatusRequest({
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

		assert.strictEqual(encodeGetRemoteSessionStatusRequest({
			callId: '',
		}).length, 0);
	});

	test('decodeGetRemoteSessionStatusResponse reads status=1 call_id=2 progress=3 elapsed_ms=4 expires_at=5 pending_permissions=6 pending_questions=7', () => {
		const permission = Buffer.concat([
			encodeStringField(1, 'perm-1'),
			encodeStringField(2, 'bash'),
			encodeStringField(3, '/tmp/a'),
			encodeStringField(4, 'ls'),
			encodeStringField(5, '{"n":1}'),
			encodeStringField(6, 'HIGH'),
			encodeStringField(7, 'USER'),
			encodeStringField(8, 'unused-permission-field'),
		]);
		const sparsePermission = encodeStringField(1, 'perm-2');
		const question = Buffer.concat([
			encodeStringField(1, 'q-1'),
			encodeStringField(2, '[{"id":"a"}]'),
			encodeStringField(3, 'unused-question-field'),
		]);
		const sparseQuestion = encodeStringField(1, 'q-2');
		const encoded = Buffer.concat([
			encodeStringField(1, 'running'),
			encodeStringField(2, 'call-1'),
			encodeStringField(3, 'step 2/5'),
			encodeInt64Field(4, 1200),
			encodeInt64Field(5, 1700003600),
			encodeMessageField(6, permission),
			encodeMessageField(6, sparsePermission),
			encodeMessageField(7, question),
			encodeMessageField(7, sparseQuestion),
			encodeStringField(8, 'unused-field'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeGetRemoteSessionStatusResponse(encoded);
		assert.deepStrictEqual(wire, {
			status: 'running',
			call_id: 'call-1',
			progress: 'step 2/5',
			elapsed_ms: 1200,
			expires_at: 1700003600,
			pending_permissions: [
				{
					request_id: 'perm-1',
					tool_name: 'bash',
					path: '/tmp/a',
					command: 'ls',
					arguments_json: '{"n":1}',
					danger_level: 'HIGH',
					bubble_target: 'USER',
				},
				{
					request_id: 'perm-2',
					tool_name: undefined,
					path: undefined,
					command: undefined,
					arguments_json: undefined,
					danger_level: undefined,
					bubble_target: undefined,
				},
			],
			pending_questions: [
				{
					question_id: 'q-1',
					questions_json: '[{"id":"a"}]',
				},
				{
					question_id: 'q-2',
					questions_json: undefined,
				},
			],
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapGetRemoteSessionStatusResponse(wire), {
			status: 'running',
			callId: 'call-1',
			progress: 'step 2/5',
			elapsedMs: 1200,
			expiresAt: 1700003600,
			pendingPermissions: [
				{
					requestId: 'perm-1',
					toolName: 'bash',
					path: '/tmp/a',
					command: 'ls',
					argumentsJson: '{"n":1}',
					dangerLevel: 'HIGH',
					bubbleTarget: 'USER',
				},
				{
					requestId: 'perm-2',
					toolName: '',
					path: '',
					command: '',
					argumentsJson: '',
					dangerLevel: '',
					bubbleTarget: '',
				},
			],
			pendingQuestions: [
				{
					questionId: 'q-1',
					questionsJson: '[{"id":"a"}]',
				},
				{
					questionId: 'q-2',
					questionsJson: '',
				},
			],
		});

		const empty = decodeGetRemoteSessionStatusResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {
			status: undefined,
			call_id: undefined,
			progress: undefined,
			elapsed_ms: undefined,
			expires_at: undefined,
			pending_permissions: [],
			pending_questions: [],
		});
		assert.deepStrictEqual(mapGetRemoteSessionStatusResponse(empty), {
			status: '',
			callId: '',
			progress: '',
			elapsedMs: 0,
			expiresAt: 0,
			pendingPermissions: [],
			pendingQuestions: [],
		});

		const unusedOnly = decodeGetRemoteSessionStatusResponse(encodeStringField(8, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {
			status: undefined,
			call_id: undefined,
			progress: undefined,
			elapsed_ms: undefined,
			expires_at: undefined,
			pending_permissions: [],
			pending_questions: [],
		});
		assert.strictEqual(JSON.stringify(unusedOnly).includes('unused'), false);
		assert.deepStrictEqual(mapGetRemoteSessionStatusResponse(unusedOnly), {
			status: '',
			callId: '',
			progress: '',
			elapsedMs: 0,
			expiresAt: 0,
			pendingPermissions: [],
			pendingQuestions: [],
		});

		const lastWins = decodeGetRemoteSessionStatusResponse(Buffer.concat([
			encodeInt64Field(4, 1),
			encodeInt64Field(4, 1200),
			encodeInt64Field(5, 1),
			encodeInt64Field(5, 1700003600),
		]));
		assert.strictEqual(lastWins.elapsed_ms, 1200);
		assert.strictEqual(lastWins.expires_at, 1700003600);
		assert.strictEqual(mapGetRemoteSessionStatusResponse(lastWins).elapsedMs, 1200);
		assert.strictEqual(mapGetRemoteSessionStatusResponse(lastWins).expiresAt, 1700003600);

		const zeroPresent = decodeGetRemoteSessionStatusResponse(Buffer.concat([
			encodeVarintZero(4),
			encodeVarintZero(5),
		]));
		assert.strictEqual(zeroPresent.elapsed_ms, 0);
		assert.strictEqual(zeroPresent.expires_at, 0);
		assert.strictEqual(mapGetRemoteSessionStatusResponse(zeroPresent).elapsedMs, 0);
		assert.strictEqual(mapGetRemoteSessionStatusResponse(zeroPresent).expiresAt, 0);
		assert.strictEqual(encodeInt64Field(4, 0).length, 0);
		assert.strictEqual(encodeInt64Field(5, 0).length, 0);
	});

	test('get-remote-session-status unary wire is RemoteAgentService.GetRemoteSessionStatus only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcGetRemoteSessionStatusUnaryWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeGetRemoteSessionStatusRequest\b/.test(source));
		assert.ok(/\bdecodeGetRemoteSessionStatusResponse\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(/\blastString\b/.test(source));
		assert.ok(/\ballLengthDelimited\b/.test(source));
		assert.ok(/\bdecodeRemotePendingPermission\b/.test(source));
		assert.ok(/\bdecodeRemotePendingQuestion\b/.test(source));
		assert.ok(!/\bencodeRemotePendingPermission\b|\bencodeRemotePendingQuestion\b/.test(source));
		assert.ok(!/\bmapRemotePendingPermission\b|\bmapRemotePendingQuestion\b/.test(source));
		assert.ok(!/\bCreateRemoteSession\b|\bDestroyRemoteSession\b|\bGetRemoteSessionHistory\b/.test(source));
		assert.ok(!/\bResumeRemoteSession\b|\bCancelRemoteSession\b|\bRemoteChat\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bGetModelPreferences\b|\bSetModelPreferences\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('getRemoteSessionStatus uses bytes then existing map; skip Connect/SaveSkillContent/Watch/ResolveTurn', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const status = extractAsyncMethod(source, 'getRemoteSessionStatus');
		assert.ok(status.includes('makeUnaryBytesClient'), 'getRemoteSessionStatus must use makeUnaryBytesClient');
		assert.ok(status.includes('encodeGetRemoteSessionStatusRequest'), 'getRemoteSessionStatus must call encodeGetRemoteSessionStatusRequest');
		assert.ok(status.includes('decodeGetRemoteSessionStatusResponse'), 'getRemoteSessionStatus must call decodeGetRemoteSessionStatusResponse');
		assert.ok(status.includes('mapGetRemoteSessionStatusResponse'), 'getRemoteSessionStatus still calls mapGetRemoteSessionStatusResponse');
		assert.ok(!status.includes('makeUnaryClient<'), 'getRemoteSessionStatus must not use JSON makeUnaryClient');
		assert.ok(!status.includes('JSON.stringify'), 'getRemoteSessionStatus must not JSON.stringify');
		assert.ok(source.includes('grpcGetRemoteSessionStatusUnaryWire'));
		assert.ok(!/\bWatch\b/.test(status));

		assert.ok(!extractAsyncMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(!extractAsyncMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		const watchStart = source.indexOf('\topenWatchConfigStream(');
		assert.ok(watchStart >= 0, 'missing openWatchConfigStream(');
		const watchEnd = source.indexOf('\n\tasync ', watchStart + 1);
		const watchBody = source.slice(watchStart, watchEnd >= 0 ? watchEnd : source.length);
		assert.ok(watchBody.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!watchBody.includes('makeUnaryBytesClient'));
		assert.ok(!watchBody.includes('grpcGetRemoteSessionStatusUnaryWire'));
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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcGetRemoteSessionStatusUnaryWire.ts')));
	assert.ok(dir, 'grpcGetRemoteSessionStatusUnaryWire.ts not found from cwd or import.meta');
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
