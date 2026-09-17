/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { CONNECT_WIRE_PROTOCOL } from '../../node/grpc/grpcHandshakeWire.js';
import {
	HISTORY_DIRECTION_FORWARD_AFTER,
	decodeChatResponse,
	decodeCreateSessionResponse,
	decodeCreateSnapshotResponse,
	decodeDeleteMessageResponse,
	decodeDeleteSnapshotResponse,
	decodeFetchToolDetailResponse,
	decodeForkAgentResponse,
	decodeGetHistoryResponse,
	decodeListSnapshotsResponse,
	decodeRestoreSnapshotResponse,
	decodeResumeSessionResponse,
	decodeSessionResumeResponse,
	decodeSessionStreamEvent,
	encodeChatRequest,
	encodeCreateSessionRequest,
	encodeCreateSnapshotRequest,
	encodeDeleteSnapshotRequest,
	encodeFetchToolDetailRequest,
	encodeGetHistoryRequest,
	encodeListSnapshotsRequest,
	encodeRenameSessionRequest,
	encodeCancelGenerationRequest,
	encodeCancelToolCallRequest,
	encodeDeleteMessageRequest,
	encodeEditMessageRequest,
	encodeForkAgentRequest,
	encodeKillAgentRequest,
	encodeRestoreSnapshotRequest,
	encodeResumeSessionRequest,
	encodeSessionStreamHandshake,
	fetchToolDetailRequestFromHistoryToolCall,
	resolveCreateSessionClientId,
} from '../../node/grpc/grpcSessionAttachWire.js';
import {
	mapCreateSnapshotResponse,
	mapDeleteSnapshotResponse,
	mapListSnapshotsResponse,
	mapRestoreSnapshotResponse,
	mapResumeSessionResponse,
} from '../../node/grpc/grpcClientMappers.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodeMessageField,
	encodePresentMessageField,
	encodeStringField,
	readProtoFields,
} from '../../node/grpc/grpcProtoCodec.js';

suite('grpc first-send / attach protobuf wire', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encodeCreateSessionRequest writes model field 3, not title JSON', () => {
		const encoded = encodeCreateSessionRequest({ title: 'New session', model: 'gpt-test', clientSessionId: 'local-1' });
		assert.notStrictEqual(encoded[0], 0x7b, 'must not start with JSON {');
		const fields = readProtoFields(encoded);
		const byField = new Map(fields.map(field => [field.field, field]));
		const model = byField.get(3);
		assert.ok(model && model.wireType === 2);
		assert.strictEqual(Buffer.from(model.bytes).toString('utf8'), 'gpt-test');
		assert.ok(!fields.some(field => field.wireType === 2 && Buffer.from(field.bytes).toString('utf8') === 'New session'));
	});

	test('encodeCreateSessionRequest writes client_session_id field 4 from local session id', () => {
		const encoded = encodeCreateSessionRequest({ title: 'New session', model: 'gpt-test', clientSessionId: 'local-stable' });
		const fields = readProtoFields(encoded);
		const clientId = fields.find(field => field.field === 4 && field.wireType === 2);
		assert.ok(clientId && clientId.wireType === 2);
		assert.strictEqual(Buffer.from(clientId.bytes).toString('utf8'), 'local-stable');
	});

	test('encodeCreateSessionRequest always writes a non-empty client_session_id field 4', () => {
		const encoded = encodeCreateSessionRequest({ title: 'New session', model: 'gpt-test' });
		const fields = readProtoFields(encoded);
		const clientId = fields.find(field => field.field === 4 && field.wireType === 2);
		assert.ok(clientId && clientId.wireType === 2);
		const value = Buffer.from(clientId.bytes).toString('utf8');
		assert.ok(value.length > 0);
		assert.notStrictEqual(value, 'New session');
		assert.strictEqual(resolveCreateSessionClientId({ clientSessionId: 'keep-me' }), 'keep-me');
	});

	test('decodeCreateSessionResponse reads session_id field 1', () => {
		const decoded = decodeCreateSessionResponse(encodeStringField(1, 'sess-9'));
		assert.strictEqual(decoded.sessionId, 'sess-9');
	});

	test('encodeResumeSessionRequest writes session_id field 1', () => {
		const encoded = encodeResumeSessionRequest({ sessionId: 'sess-1' });
		assert.notStrictEqual(encoded[0], 0x7b);
		const fields = readProtoFields(encoded);
		assert.strictEqual(Buffer.from(fields[0].wireType === 2 ? fields[0].bytes : []).toString('utf8'), 'sess-1');
	});

	test('decodeResumeSessionResponse maps success varint', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'ok'),
		]);
		const decoded = decodeResumeSessionResponse(encoded);
		assert.strictEqual(decoded.ok, true);
		assert.strictEqual(decoded.message, 'ok');
	});

	test('decodeSessionResumeResponse reads nested root_agent=3 AgentInfo 1-8; maps via mapResumeSessionResponse; model_info unread', () => {
		const child = encodeStringField(1, 'ag-child');
		const agent = Buffer.concat([
			encodeStringField(1, 'ag-root'),
			encodeStringField(2, 'Root'),
			encodeInt32Field(3, 0),
			encodeInt32Field(4, 3),
			encodeStringField(5, 'gpt-test'),
			encodeInt32Field(6, 4),
			encodeInt64Field(7, 1700000000),
			encodeMessageField(8, child),
			encodeStringField(9, 'model-info-unread'),
		]);
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'resumed'),
			encodeMessageField(3, agent),
			encodeStringField(4, 'unused-field'),
		]);
		const wire = decodeSessionResumeResponse(encoded);
		assert.strictEqual(wire.success, true);
		assert.strictEqual(wire.message, 'resumed');
		assert.ok(!('model_info' in (wire.root_agent ?? {})));
		assert.ok(!('modelInfo' in (wire.root_agent ?? {})));
		assert.strictEqual(JSON.stringify(wire).includes('unused'), false);
		assert.strictEqual(JSON.stringify(wire).includes('model-info'), false);
		assert.deepStrictEqual(mapResumeSessionResponse(wire), {
			ok: true,
			message: 'resumed',
			rootAgent: {
				agentId: 'ag-root',
				name: 'Root',
				type: 'AGENT_TYPE_ROOT',
				status: 'AGENT_STATUS_GENERATING',
				model: 'gpt-test',
				turnCount: 4,
				createdAt: 1700000000,
				children: [{
					agentId: 'ag-child',
					name: '',
					type: 'AGENT_TYPE_ROOT',
					status: 'AGENT_STATUS_UNKNOWN',
					model: '',
					turnCount: 0,
					createdAt: 0,
					children: [],
				}],
			},
		});
		const unusedOnly = decodeSessionResumeResponse(encodeStringField(4, 'unused-field'));
		assert.deepStrictEqual(unusedOnly, {});
		assert.deepStrictEqual(mapResumeSessionResponse(unusedOnly), {
			ok: false,
			message: undefined,
			rootAgent: undefined,
		});
	});

	test('encodeGetHistoryRequest uses page_size + FORWARD_AFTER, not JSON limit', () => {
		const encoded = encodeGetHistoryRequest({
			sessionId: 'sess-1',
			cursorSeq: '12',
			limit: 100,
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		const fields = readProtoFields(encoded);
		const numbers = new Map<number, number>();
		let sessionId = '';
		for (const field of fields) {
			if (field.wireType === 0) {
				numbers.set(field.field, Number(field.varint));
			}
			if (field.field === 1 && field.wireType === 2) {
				sessionId = Buffer.from(field.bytes).toString('utf8');
			}
		}
		assert.strictEqual(sessionId, 'sess-1');
		assert.strictEqual(numbers.get(2), 12);
		assert.strictEqual(numbers.get(3), HISTORY_DIRECTION_FORWARD_AFTER);
		assert.strictEqual(numbers.get(4), 100);
	});

	test('decodeGetHistoryResponse maps envelope seq to cursorSeq', () => {
		const envelope = Buffer.concat([
			encodeStringField(1, 'env-1'),
			encodeInt64Field(3, 7),
		]);
		const encoded = Buffer.concat([
			encodeMessageField(1, envelope),
			encodeInt32Field(4, 1),
		]);
		const decoded = decodeGetHistoryResponse(encoded);
		assert.strictEqual(decoded.envelopes.length, 1);
		assert.strictEqual(decoded.envelopes[0].cursorSeq, '7');
		assert.strictEqual((decoded.envelopes[0].payload as { id?: string }).id, 'env-1');
		assert.strictEqual(decoded.nextCursorSeq, '7');
	});

	test('encodeSessionStreamHandshake writes protocol 2.0, not JSON session_id', () => {
		const encoded = encodeSessionStreamHandshake('sess-1');
		assert.notStrictEqual(encoded[0], 0x7b);
		const fields = readProtoFields(encoded);
		const numbers = new Map<number, number>();
		let sessionId = '';
		for (const field of fields) {
			if (field.wireType === 0) {
				numbers.set(field.field, Number(field.varint));
			}
			if (field.field === 1 && field.wireType === 2) {
				sessionId = Buffer.from(field.bytes).toString('utf8');
			}
		}
		assert.strictEqual(sessionId, 'sess-1');
		assert.strictEqual(numbers.get(3), CONNECT_WIRE_PROTOCOL.protocolMajor);
		assert.strictEqual(numbers.get(4) ?? 0, CONNECT_WIRE_PROTOCOL.protocolMinor);
	});

	test('decodeSessionStreamEvent maps hello arm for HistoryFill', () => {
		const hello = Buffer.concat([
			encodeInt64Field(1, 3),
			encodeInt64Field(2, 8),
			encodeInt64Field(3, 1),
			encodeInt64Field(4, 0),
		]);
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeMessageField(10, hello),
		]);
		const decoded = decodeSessionStreamEvent(encoded);
		const payload = decoded.payload as { hello?: { session_version?: number; head_seq?: number } };
		assert.strictEqual((decoded.payload as { session_id?: string }).session_id, 'sess-1');
		assert.strictEqual(payload.hello?.session_version, 3);
		assert.strictEqual(payload.hello?.head_seq, 8);
	});

	test('decodeSessionStreamEvent reads nested streaming_delta=30 StreamingDeltaEvent 1-6; unused unread', () => {
		const delta = Buffer.concat([
			encodeInt64Field(1, 9),
			encodeStringField(2, 'turn-delta'),
			encodeStringField(3, 'block-1'),
			encodeStringField(4, 'root'),
			encodeStringField(5, 'partial'),
			encodeInt64Field(6, 3),
			encodeStringField(7, 'unused-field'),
		]);
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeMessageField(30, delta),
		]);
		const decoded = decodeSessionStreamEvent(encoded);
		const payload = decoded.payload as {
			session_id?: string;
			streaming_delta?: {
				runtime_epoch?: number;
				turn_id?: string;
				block_id?: string;
				agent_id?: string;
				text_delta?: string;
				delta_seq?: number;
			};
		};
		assert.strictEqual(payload.session_id, 'sess-1');
		assert.deepStrictEqual(payload.streaming_delta, {
			runtime_epoch: 9,
			turn_id: 'turn-delta',
			block_id: 'block-1',
			agent_id: 'root',
			text_delta: 'partial',
			delta_seq: 3,
		});
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		const omitted = decodeSessionStreamEvent(encodeStringField(1, 'sess-2'));
		assert.strictEqual((omitted.payload as { streaming_delta?: unknown }).streaming_delta, undefined);
		const emptyNested = decodeSessionStreamEvent(encodePresentMessageField(30, new Uint8Array(0)));
		assert.deepStrictEqual((emptyNested.payload as { streaming_delta?: unknown }).streaming_delta, {
			runtime_epoch: 0,
			turn_id: '',
			block_id: '',
			agent_id: '',
			text_delta: '',
			delta_seq: 0,
		});
	});

	test('encodeChatRequest writes session_input oneof, not JSON payload wrapper', () => {
		const encoded = encodeChatRequest('sess-1', {
			agentId: 'root',
			messageId: 'msg-1',
			text: 'ping from debug agent',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		const fields = readProtoFields(encoded);
		let sessionInput: Uint8Array | undefined;
		for (const field of fields) {
			if (field.field === 30 && field.wireType === 2) {
				sessionInput = field.bytes;
			}
		}
		assert.ok(sessionInput);
		const inputFields = readProtoFields(sessionInput);
		assert.strictEqual(Buffer.from(inputFields[0].wireType === 2 ? inputFields[0].bytes : []).toString('utf8'), 'msg-1');
		assert.strictEqual(Buffer.from(inputFields[1].wireType === 2 ? inputFields[1].bytes : []).toString('utf8'), 'ping from debug agent');
		assert.ok(!inputFields.some(field => field.field === 5));
	});

	test('encodeChatRequest writes SessionInput model_profile_id field 5', () => {
		const encoded = encodeChatRequest('sess-1', {
			agentId: 'root',
			messageId: 'msg-2',
			text: 'ping',
			modelProfileId: 'claude-code',
		});
		const fields = readProtoFields(encoded);
		const sessionInput = fields.find(field => field.field === 30 && field.wireType === 2);
		assert.ok(sessionInput && sessionInput.wireType === 2);
		const inputFields = readProtoFields(sessionInput.bytes);
		const profile = inputFields.find(field => field.field === 5 && field.wireType === 2);
		assert.ok(profile && profile.wireType === 2);
		assert.strictEqual(Buffer.from(profile.bytes).toString('utf8'), 'claude-code');
	});

	test('encodeChatRequest heartbeat_ack is present even when empty', () => {
		const encoded = encodeChatRequest('sess-1', { heartbeat_ack: {} });
		const fields = readProtoFields(encoded);
		assert.ok(fields.some(field => field.field === 12 && field.wireType === 2));
		assert.ok(!fields.some(field => field.field === 30));
	});

	test('decodeChatResponse reads session_id without JSON.parse', () => {
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeStringField(2, 'root'),
		]);
		const decoded = decodeChatResponse(encoded);
		assert.strictEqual((decoded.payload as { session_id?: string }).session_id, 'sess-1');
	});

	test('decodeGetHistoryResponse ToolCallBlock detail_ref can feed fetchToolDetail', () => {
		const detailRef = Buffer.concat([
			encodeInt32Field(1, 5),
			encodeStringField(2, 'ref-diff-1'),
		]);
		const fileMutation = Buffer.concat([
			encodeStringField(2, '/workspace/a.ts'),
			encodeStringField(3, 'edit'),
			encodeMessageField(4, Buffer.concat([
				encodeInt32Field(1, 3),
				encodeInt32Field(2, 1),
				encodeInt32Field(3, 1),
			])),
		]);
		const toolCall = Buffer.concat([
			encodeStringField(1, 'call-1'),
			encodeStringField(2, 'edit_file'),
			encodeStringField(3, '{"path":"/guessed/from/args.ts"}'),
			encodeMessageField(4, detailRef),
			encodeMessageField(5, fileMutation),
		]);
		const envelope = Buffer.concat([
			encodeStringField(1, 'env-1'),
			encodeInt64Field(3, 9),
			encodeStringField(8, 'agent-hist'),
			encodeStringField(10, 'turn-hist'),
			encodeMessageField(17, Buffer.concat([
				encodeInt32Field(1, 2),
				encodeMessageField(3, toolCall),
			])),
		]);
		const decoded = decodeGetHistoryResponse(encodeMessageField(1, envelope));
		const payload = decoded.envelopes[0].payload as {
			agent_id?: string;
			turn_id?: string;
			blocks?: Array<{ tool_call_block?: Record<string, unknown> }>;
		};
		assert.strictEqual(payload.agent_id, 'agent-hist');
		assert.strictEqual(payload.turn_id, 'turn-hist');
		const block = payload.blocks?.[0]?.tool_call_block;
		assert.ok(block);
		const ref = block.detail_ref as { kind?: number; ref_id?: string };
		assert.strictEqual(ref.kind, 5);
		assert.strictEqual(ref.ref_id, 'ref-diff-1');
		const mutation = block.file_mutation as { path?: string; diff_stats?: { added_lines?: number } };
		assert.strictEqual(mutation.path, '/workspace/a.ts');
		assert.strictEqual(mutation.diff_stats?.added_lines, 3);
		const fetch = fetchToolDetailRequestFromHistoryToolCall('sess-1', block);
		assert.deepStrictEqual(fetch, {
			sessionId: 'sess-1',
			toolCallId: 'call-1',
			detailKind: 5,
			refId: 'ref-diff-1',
		});
	});

	test('decodeGetHistoryResponse does not guess file path from arguments_json', () => {
		const toolCall = Buffer.concat([
			encodeStringField(1, 'call-2'),
			encodeStringField(2, 'edit_file'),
			encodeStringField(3, '{"path":"/guessed/from/args.ts"}'),
		]);
		const envelope = Buffer.concat([
			encodeStringField(1, 'env-2'),
			encodeInt64Field(3, 10),
			encodeMessageField(17, Buffer.concat([
				encodeInt32Field(1, 2),
				encodeMessageField(3, toolCall),
			])),
		]);
		const decoded = decodeGetHistoryResponse(encodeMessageField(1, envelope));
		const payload = decoded.envelopes[0].payload as {
			blocks?: Array<{ tool_call_block?: Record<string, unknown> }>;
		};
		const block = payload.blocks?.[0]?.tool_call_block;
		assert.ok(block);
		assert.strictEqual(block.file_mutation, undefined);
		assert.strictEqual(block.detail_ref, undefined);
		assert.strictEqual(fetchToolDetailRequestFromHistoryToolCall('sess-1', block), undefined);
	});

	test('encodePresentMessageField keeps empty oneof arm', () => {
		const encoded = encodePresentMessageField(12, new Uint8Array(0));
		const fields = readProtoFields(encoded);
		assert.strictEqual(fields.length, 1);
		assert.strictEqual(fields[0].field, 12);
		assert.strictEqual(fields[0].wireType, 2);
		assert.strictEqual(fields[0].wireType === 2 ? fields[0].bytes.length : -1, 0);
	});

	test('encodeRenameSessionRequest writes session_id field 1 and title field 2, not JSON', () => {
		const encoded = encodeRenameSessionRequest({ sessionId: 'sess-1', title: 'New title' });
		assert.notStrictEqual(encoded[0], 0x7b);
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.get(2), 'New title');
	});

	test('encodeRenameSessionRequest omits empty title field 2', () => {
		const encoded = encodeRenameSessionRequest({ sessionId: 'sess-1', title: '' });
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.has(2), false);
	});

	test('encodeCancelGenerationRequest writes session_id field 1 and agent_id field 2, not JSON', () => {
		const encoded = encodeCancelGenerationRequest({ sessionId: 'sess-1', agentId: 'root' });
		assert.notStrictEqual(encoded[0], 0x7b);
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.get(2), 'root');
	});

	test('encodeCancelToolCallRequest writes session_id/agent_id/tool_call_id fields 1-3, not JSON', () => {
		const encoded = encodeCancelToolCallRequest({ sessionId: 'sess-1', agentId: 'sub:a', toolCallId: 'tc-9' });
		assert.notStrictEqual(encoded[0], 0x7b);
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.get(2), 'sub:a');
		assert.strictEqual(strings.get(3), 'tc-9');
		assert.strictEqual(strings.has(4), false);
	});

	test('encodeCancelToolCallRequest empty agentId wires root field 2', () => {
		const encoded = encodeCancelToolCallRequest({ sessionId: 'sess-1', toolCallId: 'tc-1' });
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(2), 'root');
		assert.strictEqual(strings.get(3), 'tc-1');
	});

	test('encodeForkAgentRequest writes fields 1-6; empty parent wires root', () => {
		const encoded = encodeForkAgentRequest({
			sessionId: 'sess-1',
			parentAgentId: '',
			name: 'researcher',
			task: 'Investigate',
			modelType: 'quality',
			systemPrompt: 'Be brief',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.get(2), 'root');
		assert.strictEqual(strings.get(3), 'researcher');
		assert.strictEqual(strings.get(4), 'Investigate');
		assert.strictEqual(strings.get(5), 'quality');
		assert.strictEqual(strings.get(6), 'Be brief');
	});

	test('encodeForkAgentRequest omits empty name/task/model/system_prompt', () => {
		const encoded = encodeForkAgentRequest({ sessionId: 'sess-1' });
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(2), 'root');
		assert.strictEqual(strings.has(3), false);
		assert.strictEqual(strings.has(4), false);
		assert.strictEqual(strings.has(5), false);
		assert.strictEqual(strings.has(6), false);
	});

	test('decodeForkAgentResponse reads success field 1 and agent_id field 2', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'sub:researcher'),
			encodeStringField(3, 'ignored-agent-message'),
		]);
		const decoded = decodeForkAgentResponse(encoded);
		assert.deepStrictEqual(decoded, { ok: true, agentId: 'sub:researcher' });
		assert.strictEqual(decodeForkAgentResponse(new Uint8Array(0)).ok, false);
	});

	test('encodeKillAgentRequest writes session_id/agent_id; force false omits field 3', () => {
		const forced = encodeKillAgentRequest({ sessionId: 'sess-1', agentId: 'sub:a', force: true });
		assert.notStrictEqual(forced[0], 0x7b);
		const strings = new Map<number, string>();
		const numbers = new Map<number, number>();
		for (const field of readProtoFields(forced)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
			if (field.wireType === 0) {
				numbers.set(field.field, Number(field.varint));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.get(2), 'sub:a');
		assert.strictEqual(numbers.get(3), 1);

		const soft = encodeKillAgentRequest({ sessionId: 'sess-1', agentId: 'sub:a', force: false });
		const softNumbers = new Map<number, number>();
		for (const field of readProtoFields(soft)) {
			if (field.wireType === 0) {
				softNumbers.set(field.field, Number(field.varint));
			}
		}
		assert.strictEqual(softNumbers.has(3), false);
	});

	test('encodeKillAgentRequest empty agentId omits field 2 and does not wire root', () => {
		const encoded = encodeKillAgentRequest({ sessionId: 'sess-1', agentId: '' });
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.has(2), false);
	});

	test('encodeDeleteMessageRequest writes fields 1-4; empty agent wires root', () => {
		const encoded = encodeDeleteMessageRequest({
			sessionId: 'sess-1',
			turnId: 'turn-9',
			operationId: 'op-1',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.get(2), 'turn-9');
		assert.strictEqual(strings.get(3), 'root');
		assert.strictEqual(strings.get(4), 'op-1');
	});

	test('decodeDeleteMessageResponse reads success/message/current_turn_id/removed_turn_count', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'deleted'),
			encodeStringField(3, 'turn-head'),
			encodeInt32Field(4, 3),
		]);
		const decoded = decodeDeleteMessageResponse(encoded);
		assert.deepStrictEqual(decoded, {
			ok: true,
			message: 'deleted',
			currentTurnId: 'turn-head',
			removedTurnCount: 3,
		});
	});

	test('encodeEditMessageRequest writes fields 1-5; empty agent wires root', () => {
		const encoded = encodeEditMessageRequest({
			sessionId: 'sess-1',
			turnId: 'turn-9',
			newContent: 'revised',
			operationId: 'op-2',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.get(2), 'turn-9');
		assert.strictEqual(strings.get(3), 'revised');
		assert.strictEqual(strings.get(4), 'root');
		assert.strictEqual(strings.get(5), 'op-2');
	});

	test('encodeEditMessageRequest omits empty new_content and operation_id', () => {
		const encoded = encodeEditMessageRequest({
			sessionId: 'sess-1',
			turnId: 'turn-9',
			newContent: '',
			agentId: 'sub:a',
		});
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(4), 'sub:a');
		assert.strictEqual(strings.has(3), false);
		assert.strictEqual(strings.has(5), false);
	});

	test('encodeFetchToolDetailRequest writes fields 1-4 and omits subscribe field 10', () => {
		const encoded = encodeFetchToolDetailRequest({
			sessionId: 'sess-1',
			toolCallId: 'tc-1',
			detailKind: 2,
			refId: 'ref-9',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		const strings = new Map<number, string>();
		const numbers = new Map<number, number>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
			if (field.wireType === 0) {
				numbers.set(field.field, Number(field.varint));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.get(2), 'tc-1');
		assert.strictEqual(numbers.get(3), 2);
		assert.strictEqual(strings.get(4), 'ref-9');
		assert.strictEqual(strings.has(5), false);
		assert.strictEqual(numbers.has(10), false);
	});

	test('encodeFetchToolDetailRequest omits default detail_kind field 3', () => {
		const encoded = encodeFetchToolDetailRequest({
			sessionId: 'sess-1',
			toolCallId: 'tc-1',
			detailKind: 0,
			refId: 'ref-9',
		});
		const numbers = new Map<number, number>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 0) {
				numbers.set(field.field, Number(field.varint));
			}
		}
		assert.strictEqual(numbers.has(3), false);
		assert.strictEqual(numbers.has(10), false);
	});

	test('decodeFetchToolDetailResponse reads success/content/truncated/total_bytes/error_message', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'detail-body'),
			encodeInt32Field(4, 1),
			encodeInt64Field(5, 4096),
			encodeStringField(7, 'too large'),
		]);
		const decoded = decodeFetchToolDetailResponse(encoded);
		assert.strictEqual(decoded.success, true);
		assert.strictEqual(decoded.content, 'detail-body');
		assert.strictEqual(decoded.truncated, true);
		assert.strictEqual(decoded.total_bytes, 4096);
		assert.strictEqual(decoded.error_message, 'too large');
	});

	test('encodeListSnapshotsRequest writes session_id field 1, not JSON', () => {
		const encoded = encodeListSnapshotsRequest({ sessionId: 'sess-1' });
		assert.notStrictEqual(encoded[0], 0x7b);
		const fields = readProtoFields(encoded);
		assert.strictEqual(fields.length, 1);
		assert.strictEqual(fields[0]?.field, 1);
		assert.strictEqual(Buffer.from(fields[0]?.wireType === 2 ? fields[0].bytes : []).toString('utf8'), 'sess-1');
	});

	test('decodeListSnapshotsResponse reads SessionSnapshotInfo fields 1-9', () => {
		const snapshot = Buffer.concat([
			encodeStringField(1, 'snap-1'),
			encodeStringField(2, 'sess-1'),
			encodeStringField(3, 'Before refactor'),
			encodeStringField(4, 'checkpoint'),
			encodeInt64Field(5, 1700000000),
			encodeInt32Field(6, 12),
			encodeInt64Field(7, 4096),
			encodeStringField(8, 'claude-sonnet'),
			encodeInt32Field(9, 1),
		]);
		const decoded = decodeListSnapshotsResponse(encodeMessageField(1, snapshot));
		const mapped = mapListSnapshotsResponse(decoded);
		assert.strictEqual(mapped.snapshots.length, 1);
		assert.deepStrictEqual(mapped.snapshots[0], {
			id: 'snap-1',
			sessionId: 'sess-1',
			title: 'Before refactor',
			description: 'checkpoint',
			createdAt: 1700000000,
			turnCount: 12,
			tokenCount: 4096,
			modelId: 'claude-sonnet',
			isAuto: true,
		});
	});

	test('encodeCreateSnapshotRequest writes session_id/title/description fields 1-3, not JSON', () => {
		const encoded = encodeCreateSnapshotRequest({
			sessionId: 'sess-1',
			title: 'Before refactor',
			description: 'checkpoint',
		});
		assert.notStrictEqual(encoded[0], 0x7b);
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.get(2), 'Before refactor');
		assert.strictEqual(strings.get(3), 'checkpoint');
		assert.strictEqual(strings.has(4), false);
	});

	test('encodeCreateSnapshotRequest omits empty description field 3', () => {
		const encoded = encodeCreateSnapshotRequest({ sessionId: 'sess-1', title: 'Only title' });
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.get(2), 'Only title');
		assert.strictEqual(strings.has(3), false);
	});

	test('decodeCreateSnapshotResponse reads success field 1, snapshot field 2, error_message field 3', () => {
		const snapshot = Buffer.concat([
			encodeStringField(1, 'snap-9'),
			encodeStringField(2, 'sess-1'),
			encodeStringField(3, 'Saved'),
		]);
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeMessageField(2, snapshot),
			encodeStringField(3, 'ignored-on-ok'),
		]);
		const mapped = mapCreateSnapshotResponse(decodeCreateSnapshotResponse(encoded));
		assert.strictEqual(mapped.ok, true);
		assert.strictEqual(mapped.message, 'ignored-on-ok');
		assert.strictEqual(mapped.snapshot?.id, 'snap-9');
		assert.strictEqual(mapped.snapshot?.title, 'Saved');
	});

	test('encodeRestoreSnapshotRequest writes session_id field 1 and snapshot_id field 2, not JSON', () => {
		const encoded = encodeRestoreSnapshotRequest({ sessionId: 'sess-1', snapshotId: 'snap-2' });
		assert.notStrictEqual(encoded[0], 0x7b);
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.get(2), 'snap-2');
		assert.strictEqual(strings.has(3), false);
	});

	test('encodeDeleteSnapshotRequest writes session_id field 1 and snapshot_id field 2, not JSON', () => {
		const encoded = encodeDeleteSnapshotRequest({ sessionId: 'sess-1', snapshotId: 'snap-2' });
		const restore = encodeRestoreSnapshotRequest({ sessionId: 'sess-1', snapshotId: 'snap-2' });
		assert.deepStrictEqual(Buffer.from(encoded), Buffer.from(restore));
		const strings = new Map<number, string>();
		for (const field of readProtoFields(encoded)) {
			if (field.wireType === 2) {
				strings.set(field.field, Buffer.from(field.bytes).toString('utf8'));
			}
		}
		assert.strictEqual(strings.get(1), 'sess-1');
		assert.strictEqual(strings.get(2), 'snap-2');
	});

	test('decodeRestoreSnapshotResponse and decodeDeleteSnapshotResponse read success field 1 and error_message field 2', () => {
		const encoded = Buffer.concat([
			encodeInt32Field(1, 1),
			encodeStringField(2, 'restored'),
		]);
		const restored = mapRestoreSnapshotResponse(decodeRestoreSnapshotResponse(encoded));
		const deleted = mapDeleteSnapshotResponse(decodeDeleteSnapshotResponse(encoded));
		assert.deepStrictEqual(restored, { ok: true, message: 'restored' });
		assert.deepStrictEqual(deleted, { ok: true, message: 'restored' });
	});
});
