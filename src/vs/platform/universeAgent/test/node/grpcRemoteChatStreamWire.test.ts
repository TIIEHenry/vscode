/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { mapRemoteChatResponse } from '../../node/grpc/grpcClientMappersCatalog.js';
import {
	decodeRemoteChatResponse,
	encodeRemoteChatRequest,
} from '../../node/grpc/grpcRemoteChatStreamWire.js';
import {
	allLengthDelimited,
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodePresentMessageField,
	encodeStringField,
	encodeVarint,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc RemoteAgentService RemoteChat protobuf server-stream wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeRemoteChatRequest writes call_id=1 task=2 responses=3 override_pending=4; omits empty/false; not JSON', () => {
		const encoded = encodeRemoteChatRequest({
			callId: 'call-1',
			task: 'do the thing',
			responses: [{
				type: 'permission',
				requestId: 'req-9',
				permission: { decision: 'grant', reason: 'ok' },
			}],
			overridePending: true,
		});
		assert.ok(encoded.length > 0);
		assert.notStrictEqual(encoded[0], 0x7b);
		assert.notStrictEqual(Buffer.from(encoded).toString('utf8'), JSON.stringify({
			call_id: 'call-1',
			task: 'do the thing',
			responses: [{
				type: 'permission',
				request_id: 'req-9',
				permission: { decision: 'grant', reason: 'ok' },
			}],
			override_pending: true,
		}));
		assert.strictEqual(lastString(readProtoFields(encoded), 1), 'call-1');
		assert.strictEqual(lastString(readProtoFields(encoded), 2), 'do the thing');
		assert.strictEqual(protoVarints(encoded).get(4), 1);
		assert.ok(!protoVarints(encoded).has(1));
		assert.ok(!protoVarints(encoded).has(2));
		assert.ok(!protoVarints(encoded).has(3));
		assert.ok(!protoVarints(encoded).has(5));
		const responses = allLengthDelimited(readProtoFields(encoded), 3);
		assert.strictEqual(responses.length, 1);
		assert.strictEqual(lastString(readProtoFields(responses[0]), 1), 'permission');
		assert.strictEqual(lastString(readProtoFields(responses[0]), 2), 'req-9');
		const permission = lastBytes(readProtoFields(responses[0]), 3);
		assert.ok(permission);
		assert.strictEqual(lastString(readProtoFields(permission), 1), 'grant');
		assert.strictEqual(lastString(readProtoFields(permission), 2), 'ok');
		assert.ok(lastBytes(readProtoFields(responses[0]), 4) === undefined);

		const omitted = encodeRemoteChatRequest({
			callId: '',
			task: '',
			responses: [],
			overridePending: false,
		});
		assert.strictEqual(omitted.length, 0);
		assert.ok(!protoVarints(omitted).has(4));
		assert.strictEqual(encodeInt32Field(4, 0).length, 0);

		const callOnly = encodeRemoteChatRequest({
			callId: 'call-1',
			task: '',
			responses: [],
			overridePending: false,
		});
		assert.strictEqual(lastString(readProtoFields(callOnly), 1), 'call-1');
		assert.ok(lastString(readProtoFields(callOnly), 2) === undefined);
		assert.strictEqual(allLengthDelimited(readProtoFields(callOnly), 3).length, 0);
		assert.ok(!protoVarints(callOnly).has(4));
		assert.notStrictEqual(callOnly[0], 0x7b);
	});

	test('encodeRemoteChatRequest nested RemoteResponse oneof permission / question_answers_json; empty item present', () => {
		const question = encodeRemoteChatRequest({
			callId: '',
			task: '',
			responses: [{
				type: 'question',
				requestId: 'q-2',
				questionAnswersJson: '{"a":1}',
			}],
			overridePending: false,
		});
		assert.notStrictEqual(question[0], 0x7b);
		const inner = allLengthDelimited(readProtoFields(question), 3)[0];
		assert.ok(inner);
		assert.strictEqual(lastString(readProtoFields(inner), 1), 'question');
		assert.strictEqual(lastString(readProtoFields(inner), 2), 'q-2');
		assert.ok(lastBytes(readProtoFields(inner), 3) === undefined);
		assert.deepStrictEqual(Buffer.from(lastBytes(readProtoFields(inner), 4) ?? new Uint8Array()), Buffer.from('{"a":1}', 'utf8'));
		assert.ok(!protoVarints(question).has(4));

		const emptyAnswers = encodeRemoteChatRequest({
			callId: '',
			task: '',
			responses: [{
				type: '',
				requestId: '',
				questionAnswersJson: '',
			}],
			overridePending: false,
		});
		const emptyInner = allLengthDelimited(readProtoFields(emptyAnswers), 3)[0];
		assert.ok(emptyInner);
		assert.ok(lastString(readProtoFields(emptyInner), 1) === undefined);
		assert.ok(lastString(readProtoFields(emptyInner), 2) === undefined);
		const answers = lastBytes(readProtoFields(emptyInner), 4);
		assert.ok(answers !== undefined);
		assert.strictEqual(answers.length, 0);

		const emptyItem = encodeRemoteChatRequest({
			callId: '',
			task: '',
			responses: [{ type: '', requestId: '' }],
			overridePending: false,
		});
		const items = allLengthDelimited(readProtoFields(emptyItem), 3);
		assert.strictEqual(items.length, 1);
		assert.strictEqual(items[0].length, 0);
	});

	test('decodeRemoteChatResponse reads result=1 then mapper; pending 6/7 messages 11; unknown unread', () => {
		const pendingPermission = Buffer.concat([
			encodeStringField(1, 'req-1'),
			encodeStringField(2, 'bash'),
			encodeStringField(3, '/tmp'),
			encodeStringField(4, 'ls'),
			encodeStringField(5, '{}'),
			encodeStringField(6, 'LOW'),
			encodeStringField(7, 'USER'),
			encodeStringField(8, 'unused-permission'),
		]);
		const pendingQuestion = Buffer.concat([
			encodeStringField(1, 'q-1'),
			encodeStringField(2, '[]'),
			encodeStringField(3, 'unused-question'),
		]);
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
		const result = Buffer.concat([
			encodeStringField(1, 'paused'),
			encodeStringField(2, 'call-1'),
			encodeStringField(3, 'final'),
			encodeStringField(4, 'boom'),
			encodeStringField(5, 'E1'),
			encodeMessageField(6, pendingPermission),
			encodeMessageField(7, pendingQuestion),
			encodeStringField(8, 'step 2/5'),
			encodeInt32Field(9, 2),
			encodeInt32Field(10, 5),
			encodeMessageField(11, encodePresentMessageField(1, encodeStringField(1, 'sys'))),
			encodeMessageField(11, encodePresentMessageField(2, encodeStringField(1, 'hi'))),
			encodeMessageField(11, encodePresentMessageField(3, assistant)),
			encodeMessageField(11, encodePresentMessageField(4, toolResult)),
			encodeMessageField(11, Buffer.concat([
				encodePresentMessageField(1, encodeStringField(1, 'keep')),
				encodeStringField(5, 'unused-message'),
			])),
			encodeStringField(12, 'unused-result'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, result),
			encodeStringField(3, 'unused-frame'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeRemoteChatResponse(encoded);
		assert.ok(!('progress' in wire));
		assert.deepStrictEqual(wire.result, {
			status: 'paused',
			call_id: 'call-1',
			output: 'final',
			error_message: 'boom',
			error_code: 'E1',
			pending_permissions: [{
				request_id: 'req-1',
				tool_name: 'bash',
				path: '/tmp',
				command: 'ls',
				arguments_json: '{}',
				danger_level: 'LOW',
				bubble_target: 'USER',
			}],
			pending_questions: [{
				question_id: 'q-1',
				questions_json: '[]',
			}],
			progress: 'step 2/5',
			completed_steps: 2,
			total_steps_estimate: 5,
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
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapRemoteChatResponse(wire), {
			result: {
				status: 'paused',
				callId: 'call-1',
				output: 'final',
				errorMessage: 'boom',
				errorCode: 'E1',
				pendingPermissions: [{
					requestId: 'req-1',
					toolName: 'bash',
					path: '/tmp',
					command: 'ls',
					argumentsJson: '{}',
					dangerLevel: 'LOW',
					bubbleTarget: 'USER',
				}],
				pendingQuestions: [{
					questionId: 'q-1',
					questionsJson: '[]',
				}],
				progress: 'step 2/5',
				completedSteps: 2,
				totalStepsEstimate: 5,
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
			},
		});
	});

	test('decodeRemoteChatResponse reads progress=2 then mapper; empty/zero/unknown unread', () => {
		const progress = Buffer.concat([
			encodeStringField(1, 'call-1'),
			encodeInt64Field(2, 1700000000000),
			encodeInt64Field(3, 1500),
			encodeStringField(4, 'working'),
			encodeInt32Field(5, 2),
			encodeInt32Field(6, 5),
			encodeStringField(7, 'unused-progress'),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(2, progress),
			encodeStringField(3, 'unused-frame'),
		]);
		assert.notStrictEqual(encoded[0], 0x7b);
		const wire = decodeRemoteChatResponse(encoded);
		assert.ok(!('result' in wire));
		assert.deepStrictEqual(wire.progress, {
			call_id: 'call-1',
			timestamp: 1700000000000,
			elapsed_ms: 1500,
			progress: 'working',
			completed_steps: 2,
			total_steps_estimate: 5,
		});
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.deepStrictEqual(mapRemoteChatResponse(wire), {
			progress: {
				callId: 'call-1',
				timestamp: 1700000000000,
				elapsedMs: 1500,
				progress: 'working',
				completedSteps: 2,
				totalStepsEstimate: 5,
			},
		});

		const empty = decodeRemoteChatResponse(new Uint8Array(0));
		assert.deepStrictEqual(empty, {});
		assert.ok(!('result' in empty));
		assert.ok(!('progress' in empty));
		assert.deepStrictEqual(mapRemoteChatResponse(empty), {});

		const emptyResult = decodeRemoteChatResponse(encodePresentMessageField(1, new Uint8Array(0)));
		assert.deepStrictEqual(emptyResult.result, {
			status: undefined,
			call_id: undefined,
			output: undefined,
			error_message: undefined,
			error_code: undefined,
			pending_permissions: [],
			pending_questions: [],
			progress: undefined,
			completed_steps: undefined,
			total_steps_estimate: undefined,
			messages: [],
		});
		assert.deepStrictEqual(mapRemoteChatResponse(emptyResult), {
			result: {
				status: '',
				callId: '',
				output: '',
				errorMessage: '',
				errorCode: '',
				pendingPermissions: [],
				pendingQuestions: [],
				progress: '',
				completedSteps: 0,
				totalStepsEstimate: 0,
				messages: [],
			},
		});

		const unusedOnly = decodeRemoteChatResponse(encodeStringField(3, 'unused-frame'));
		assert.deepStrictEqual(unusedOnly, {});
		assert.deepStrictEqual(mapRemoteChatResponse(unusedOnly), {});

		const lastWins = decodeRemoteChatResponse(Buffer.concat([
			encodeMessageField(2, encodeInt64Field(2, 1)),
			encodeMessageField(2, encodeInt64Field(2, 42)),
		]));
		assert.strictEqual(lastWins.progress?.timestamp, 42);
		assert.strictEqual(mapRemoteChatResponse(lastWins).progress?.timestamp, 42);

		const zeroPresent = decodeRemoteChatResponse(encodeMessageField(2, Buffer.concat([
			encodeVarintZero(2),
			encodeVarintZero(3),
			encodeVarintZero(5),
			encodeVarintZero(6),
		])));
		assert.strictEqual(zeroPresent.progress?.timestamp, 0);
		assert.strictEqual(zeroPresent.progress?.elapsed_ms, 0);
		assert.strictEqual(zeroPresent.progress?.completed_steps, 0);
		assert.strictEqual(zeroPresent.progress?.total_steps_estimate, 0);
		assert.strictEqual(mapRemoteChatResponse(zeroPresent).progress?.timestamp, 0);
		assert.strictEqual(encodeInt64Field(2, 0).length, 0);
		assert.strictEqual(encodeInt32Field(5, 0).length, 0);
		assert.strictEqual(lastVarint(readProtoFields(encodeVarintZero(2)), 2), 0n);
	});

	test('remote-chat stream wire is RemoteAgentService.RemoteChat only; no JSON.stringify; identifier scan', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpcRemoteChatStreamWire.ts'), 'utf8');
		assert.ok(!source.includes('JSON.stringify'));
		assert.ok(/\bencodeRemoteChatRequest\b/.test(source));
		assert.ok(/\bdecodeRemoteChatResponse\b/.test(source));
		assert.ok(/\bencodeStringField\b/.test(source));
		assert.ok(/\bencodePresentMessageField\b/.test(source));
		assert.ok(/\bencodeInt32Field\b/.test(source));
		assert.ok(/\ballLengthDelimited\b/.test(source));
		assert.ok(/\blastBytes\b/.test(source));
		assert.ok(/\blastVarint\b/.test(source));
		assert.ok(!/\bCreateRemoteSession\b|\bDestroyRemoteSession\b|\bGetRemoteSessionStatus\b/.test(source));
		assert.ok(!/\bResumeRemoteSession\b|\bCancelRemoteSession\b|\bGetRemoteSessionHistory\b/.test(source));
		assert.ok(!/\bSaveSkillContent\b|\bWatch\b|\bRebuild\b/.test(source));
		assert.ok(!/\bonOpenConnection\b|\bOPEN_CONNECTION\b/.test(source));
		assert.ok(!/\bencodeConnect|\bdecodeConnect|\bmapConnect\b/.test(source));
		assert.ok(!/\bConnect\b/.test(source));
		assert.ok(!/\bResolveTurn\b|\bResolveAnchor\b/.test(source));
		assert.ok(!new RegExp(String.raw`\b` + 'grpc' + 'Client' + String.raw`\b`).test(source));
	});

	test('openRemoteChatStream uses makeServerStreamBytesClient; skip Connect/SaveSkillContent/Watch/ResolveTurn/ResolveAnchor/Upload', () => {
		const source = fs.readFileSync(path.join(grpcDir(), 'grpc' + 'Client' + '.ts'), 'utf8');
		const remoteChat = extractMethod(source, 'openRemoteChatStream');
		assert.ok(remoteChat.includes('makeServerStreamBytesClient'), 'openRemoteChatStream must use makeServerStreamBytesClient');
		assert.ok(remoteChat.includes('encodeRemoteChatRequest'), 'openRemoteChatStream must call encodeRemoteChatRequest');
		assert.ok(remoteChat.includes('decodeRemoteChatResponse'), 'openRemoteChatStream must call decodeRemoteChatResponse');
		assert.ok(remoteChat.includes('mapRemoteChatResponse'), 'openRemoteChatStream still calls mapRemoteChatResponse');
		assert.ok(!remoteChat.includes('makeServerStreamClient<'), 'openRemoteChatStream must not use JSON makeServerStreamClient');
		assert.ok(!remoteChat.includes('JSON.stringify'), 'openRemoteChatStream itself must not JSON.stringify');
		assert.ok(source.includes('grpcRemoteChatStreamWire'));

		assert.ok(!extractMethod(source, 'saveSkillContent').includes('makeUnaryBytesClient'));
		assert.ok(extractMethod(source, 'saveSkillContent').includes('makeUnaryClient<'));
		assert.ok(!extractMethod(source, 'connect').includes('makeUnaryBytesClient'));
		assert.ok(extractMethod(source, 'connect').includes('makeUnaryClient<'));
		assert.ok(!extractMethod(source, 'resolveTurn').includes('makeUnaryBytesClient'));
		assert.ok(extractMethod(source, 'resolveTurn').includes('makeUnaryClient<'));
		assert.ok(!extractMethod(source, 'resolveAnchor').includes('makeUnaryBytesClient'));
		assert.ok(extractMethod(source, 'resolveAnchor').includes('makeUnaryClient<'));

		const watch = extractMethod(source, 'openWatchConfigStream');
		assert.ok(watch.includes('makeServerStreamClient<Record<string, unknown>'));
		assert.ok(!watch.includes('makeServerStreamBytesClient'));

		const upload = extractMethod(source, 'openUploadAttachmentStream');
		assert.ok(upload.includes('makeClientStreamClient<'));
		assert.ok(!upload.includes('makeClientStreamBytesClient'));
		assert.ok(!upload.includes('makeServerStreamBytesClient'));
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
	const dir = candidates.find(candidate => fs.existsSync(path.join(candidate, 'grpcRemoteChatStreamWire.ts')));
	assert.ok(dir, 'grpcRemoteChatStreamWire.ts not found from cwd or import.meta');
	return dir;
}

function extractMethod(source: string, name: string): string {
	const asyncStart = source.indexOf(`\tasync ${name}(`);
	const start = asyncStart >= 0 ? asyncStart : source.indexOf(`\t${name}(`);
	assert.ok(start >= 0, `missing ${name}(`);
	const rest = source.slice(start + 1);
	const next = rest.search(/\n\t(async |\w+\()/);
	const end = next >= 0 ? start + 1 + next : source.length;
	return source.slice(start, end);
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
