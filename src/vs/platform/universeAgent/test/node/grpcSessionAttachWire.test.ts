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
import { shouldRefreshAgentTree } from '../../node/fileMutationJoin.js';
import { OverlayDeltaJoin } from '../../node/overlayDeltaJoin.js';
import { demuxSessionStreamPayload } from '../../node/sessionStreamDemux.js';
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

	test('decodeSessionStreamEvent reads nested session_purged=16 SessionPurgedEvent empty; unused unread; maps via demux', () => {
		const purged = encodeStringField(1, 'unused-purged-field');
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeMessageField(16, purged),
			encodeStringField(99, 'unused-stream-field'),
		]);
		const decoded = decodeSessionStreamEvent(encoded);
		const payload = decoded.payload as {
			session_id?: string;
			session_purged?: Record<string, unknown>;
		};
		assert.strictEqual(payload.session_id, 'sess-1');
		assert.deepStrictEqual(payload.session_purged, {});
		assert.ok(!('sessionPurged' in payload));
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		const events = demuxSessionStreamPayload(decoded.payload);
		assert.strictEqual(events.length, 1);
		assert.deepStrictEqual(events[0], {
			arm: 'sessionPurged',
			body: {},
		});
		const omitted = decodeSessionStreamEvent(encodeStringField(1, 'sess-2'));
		assert.strictEqual((omitted.payload as { session_purged?: unknown }).session_purged, undefined);
		const emptyNested = decodeSessionStreamEvent(encodePresentMessageField(16, new Uint8Array(0)));
		assert.deepStrictEqual((emptyNested.payload as { session_purged?: unknown }).session_purged, {});
		assert.deepStrictEqual(demuxSessionStreamPayload(emptyNested.payload), [{
			arm: 'sessionPurged',
			body: {},
		}]);
	});

	test('decodeSessionStreamEvent reads nested permission_request=50 PermissionRequestEvent 1-3+6; maps via demux; metadata/requested_by_client/parent_tool_call_id unread', () => {
		const permission = Buffer.concat([
			encodeStringField(1, 'perm-live'),
			encodeStringField(2, 'bash'),
			encodeStringField(3, 'Run bash'),
			encodeStringField(5, 'client-unread'),
			encodeStringField(6, 'root'),
			encodeStringField(7, 'parent-tc-unread'),
		]);
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeMessageField(50, permission),
			encodeStringField(99, 'unused-stream-field'),
		]);
		const decoded = decodeSessionStreamEvent(encoded);
		const payload = decoded.payload as {
			session_id?: string;
			permission_request?: Record<string, unknown>;
		};
		assert.strictEqual(payload.session_id, 'sess-1');
		assert.deepStrictEqual(payload.permission_request, {
			request_id: 'perm-live',
			tool_name: 'bash',
			description: 'Run bash',
			agent_id: 'root',
		});
		assert.ok(!('metadata' in (payload.permission_request ?? {})));
		assert.ok(!('requested_by_client' in (payload.permission_request ?? {})));
		assert.ok(!('parent_tool_call_id' in (payload.permission_request ?? {})));
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		assert.strictEqual(JSON.stringify(decoded).includes('client-unread'), false);
		assert.strictEqual(JSON.stringify(decoded).includes('parent-tc-unread'), false);
		const events = demuxSessionStreamPayload(decoded.payload);
		assert.strictEqual(events.length, 1);
		assert.deepStrictEqual(events[0], {
			arm: 'permission',
			body: {
				id: 'perm-live',
				orderKey: 'perm-live',
				title: 'Run bash',
				permissionKind: 'bash',
				agentId: 'root',
			},
		});
	});

	test('decodeSessionStreamEvent reads nested ask_user_question=51 AskUserQuestionEvent 1-3; parent_tool_call_id unread; maps via demux', () => {
		const optionA = Buffer.concat([
			encodeStringField(1, 'opt-id-unread'),
			encodeStringField(2, 'A'),
			encodeStringField(3, 'opt-desc-unread'),
		]);
		const optionB = encodeStringField(2, 'B');
		const item = Buffer.concat([
			encodeStringField(1, 'item-a'),
			encodeStringField(2, 'Pick'),
			encodeStringField(3, 'Which?'),
			encodeMessageField(4, optionA),
			encodeMessageField(4, optionB),
			encodeInt32Field(5, 1),
			encodeInt32Field(6, 1),
			encodeStringField(7, 'item-unused'),
		]);
		const question = Buffer.concat([
			encodeStringField(1, 'q-live'),
			encodeMessageField(2, item),
			encodeStringField(3, 'root'),
			encodeStringField(4, 'parent-tc-unread'),
			encodeStringField(5, 'event-unused'),
		]);
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeMessageField(51, question),
			encodeStringField(99, 'unused-stream-field'),
		]);
		const decoded = decodeSessionStreamEvent(encoded);
		const payload = decoded.payload as {
			session_id?: string;
			ask_user_question?: Record<string, unknown>;
		};
		assert.strictEqual(payload.session_id, 'sess-1');
		assert.deepStrictEqual(payload.ask_user_question, {
			request_id: 'q-live',
			items: [{
				id: 'item-a',
				header: 'Pick',
				question: 'Which?',
				options: [{ label: 'A' }, { label: 'B' }],
				multi_select: true,
				allow_custom: true,
			}],
			agent_id: 'root',
		});
		assert.ok(!('parent_tool_call_id' in (payload.ask_user_question ?? {})));
		assert.ok(!('parentToolCallId' in (payload.ask_user_question ?? {})));
		const items = payload.ask_user_question?.items as Array<Record<string, unknown>>;
		const options = items[0]?.options as Array<Record<string, unknown>>;
		assert.ok(!('id' in (options[0] ?? {})));
		assert.ok(!('description' in (options[0] ?? {})));
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		assert.strictEqual(JSON.stringify(decoded).includes('parent-tc-unread'), false);
		assert.strictEqual(JSON.stringify(decoded).includes('opt-id-unread'), false);
		assert.strictEqual(JSON.stringify(decoded).includes('opt-desc-unread'), false);
		const events = demuxSessionStreamPayload(decoded.payload);
		assert.strictEqual(events.length, 1);
		assert.deepStrictEqual(events[0], {
			arm: 'question',
			body: {
				id: 'q-live',
				orderKey: 'q-live',
				questions: [{
					id: 'item-a',
					header: 'Pick',
					question: 'Which?',
					optionsPreview: ['A', 'B'],
					multiSelect: true,
					allowCustom: true,
				}],
				sessionId: 'sess-1',
				agentId: 'root',
			},
		});
	});

	test('decodeSessionStreamEvent reads nested client_tool_call=52 ClientToolCallEvent 1+3-5; origin/parent_tool_call_id unread; maps via demux', () => {
		const clientTool = Buffer.concat([
			encodeStringField(1, 'ctc-live'),
			encodeInt32Field(2, 2),
			encodeStringField(3, 'browser'),
			encodeStringField(4, '{}'),
			encodeStringField(5, 'root'),
			encodeStringField(6, 'parent-tc-unread'),
			encodeStringField(7, 'unused-field'),
		]);
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeMessageField(52, clientTool),
			encodeStringField(99, 'unused-stream-field'),
		]);
		const decoded = decodeSessionStreamEvent(encoded);
		const payload = decoded.payload as {
			session_id?: string;
			client_tool_call?: Record<string, unknown>;
		};
		assert.strictEqual(payload.session_id, 'sess-1');
		assert.deepStrictEqual(payload.client_tool_call, {
			request_id: 'ctc-live',
			tool_name: 'browser',
			arguments_json: '{}',
			agent_id: 'root',
		});
		assert.ok(!('origin' in (payload.client_tool_call ?? {})));
		assert.ok(!('parent_tool_call_id' in (payload.client_tool_call ?? {})));
		assert.ok(!('parentToolCallId' in (payload.client_tool_call ?? {})));
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		assert.strictEqual(JSON.stringify(decoded).includes('parent-tc-unread'), false);
		const events = demuxSessionStreamPayload(decoded.payload);
		assert.strictEqual(events.length, 1);
		assert.deepStrictEqual(events[0], {
			arm: 'clientToolCall',
			body: {
				callId: 'ctc-live',
				toolName: 'browser',
				argumentsJson: '{}',
				sessionId: 'sess-1',
				agentId: 'root',
			},
		});
	});

	test('decodeSessionStreamEvent reads nested branch_topology_notified=23 presence; unused unread; shouldRefreshAgentTree', () => {
		const topology = Buffer.concat([
			encodeInt64Field(1, 9),
			encodeInt64Field(2, 3),
			encodeStringField(3, 'client-unread'),
			encodeStringField(4, 'op-unread'),
			encodeStringField(5, 'branch_switch'),
			encodeStringField(6, '{}'),
			encodeStringField(7, '[]'),
			encodeStringField(8, '[]'),
			encodeStringField(9, 'turn-unread'),
			encodeStringField(10, 'notice-unread'),
			encodeStringField(11, 'unused-field'),
		]);
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeMessageField(23, topology),
			encodeStringField(99, 'unused-stream-field'),
		]);
		const decoded = decodeSessionStreamEvent(encoded);
		const payload = decoded.payload as {
			session_id?: string;
			branch_topology_notified?: Record<string, unknown>;
		};
		assert.strictEqual(payload.session_id, 'sess-1');
		assert.ok('branch_topology_notified' in payload);
		assert.deepStrictEqual(payload.branch_topology_notified, {});
		assert.ok(!('branchTopologyNotified' in payload));
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		assert.strictEqual(JSON.stringify(decoded).includes('unread'), false);
		assert.strictEqual(shouldRefreshAgentTree(decoded.payload), true);
		const omitted = decodeSessionStreamEvent(encodeStringField(1, 'sess-2'));
		assert.strictEqual((omitted.payload as { branch_topology_notified?: unknown }).branch_topology_notified, undefined);
		assert.ok(!('branch_topology_notified' in (omitted.payload as object)));
		assert.strictEqual(shouldRefreshAgentTree(omitted.payload), false);
		const emptyNested = decodeSessionStreamEvent(encodePresentMessageField(23, new Uint8Array(0)));
		assert.ok('branch_topology_notified' in (emptyNested.payload as object));
		assert.deepStrictEqual((emptyNested.payload as { branch_topology_notified?: unknown }).branch_topology_notified, {});
		assert.strictEqual(shouldRefreshAgentTree(emptyNested.payload), true);
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

	test('decodeSessionStreamEvent reads nested thinking_delta=31 SessionStreamThinkingDeltaEvent 1-6; unused unread', () => {
		const delta = Buffer.concat([
			encodeInt64Field(1, 9),
			encodeStringField(2, 'turn-think'),
			encodeStringField(3, 'block-1'),
			encodeStringField(4, 'root'),
			encodeStringField(5, 'hmm'),
			encodeInt64Field(6, 3),
			encodeStringField(7, 'unused-field'),
		]);
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeMessageField(31, delta),
			encodeStringField(99, 'unused-stream-field'),
		]);
		const decoded = decodeSessionStreamEvent(encoded);
		const payload = decoded.payload as {
			session_id?: string;
			thinking_delta?: {
				runtime_epoch?: number;
				turn_id?: string;
				block_id?: string;
				agent_id?: string;
				text_delta?: string;
				delta_seq?: number;
			};
		};
		assert.strictEqual(payload.session_id, 'sess-1');
		assert.deepStrictEqual(payload.thinking_delta, {
			runtime_epoch: 9,
			turn_id: 'turn-think',
			block_id: 'block-1',
			agent_id: 'root',
			text_delta: 'hmm',
			delta_seq: 3,
		});
		assert.ok(!('thinkingDelta' in payload));
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		const joined = new OverlayDeltaJoin().handlePayload(decoded.payload);
		assert.deepStrictEqual(joined, [{
			arm: 'overlayActiveTurn',
			body: { turnId: 'turn-think', streamingText: '', thinkingText: 'hmm' },
		}]);
		const omitted = decodeSessionStreamEvent(encodeStringField(1, 'sess-2'));
		assert.strictEqual((omitted.payload as { thinking_delta?: unknown }).thinking_delta, undefined);
		const emptyNested = decodeSessionStreamEvent(encodePresentMessageField(31, new Uint8Array(0)));
		assert.deepStrictEqual((emptyNested.payload as { thinking_delta?: unknown }).thinking_delta, {
			runtime_epoch: 0,
			turn_id: '',
			block_id: '',
			agent_id: '',
			text_delta: '',
			delta_seq: 0,
		});
	});

	test('decodeSessionStreamEvent reads nested generating_tool=34 GeneratingToolEvent 1-4; unused unread', () => {
		const generating = Buffer.concat([
			encodeInt64Field(1, 9),
			encodeStringField(2, 'turn-gen'),
			encodeStringField(3, 'root'),
			encodeStringField(4, 'bash'),
			encodeStringField(5, 'unused-field'),
		]);
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeMessageField(34, generating),
			encodeStringField(99, 'unused-stream-field'),
		]);
		const decoded = decodeSessionStreamEvent(encoded);
		const payload = decoded.payload as {
			session_id?: string;
			generating_tool?: {
				runtime_epoch?: number;
				turn_id?: string;
				agent_id?: string;
				tool_name?: string;
			};
		};
		assert.strictEqual(payload.session_id, 'sess-1');
		assert.deepStrictEqual(payload.generating_tool, {
			runtime_epoch: 9,
			turn_id: 'turn-gen',
			agent_id: 'root',
			tool_name: 'bash',
		});
		assert.ok(!('generatingTool' in payload));
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		const joined = new OverlayDeltaJoin().handlePayload(decoded.payload);
		assert.deepStrictEqual(joined, [{
			arm: 'overlayActiveTurn',
			body: { turnId: 'turn-gen', streamingText: '', thinkingText: '', generatingToolName: 'bash' },
		}]);
		const omitted = decodeSessionStreamEvent(encodeStringField(1, 'sess-2'));
		assert.strictEqual((omitted.payload as { generating_tool?: unknown }).generating_tool, undefined);
		const emptyNested = decodeSessionStreamEvent(encodePresentMessageField(34, new Uint8Array(0)));
		assert.deepStrictEqual((emptyNested.payload as { generating_tool?: unknown }).generating_tool, {
			runtime_epoch: 0,
			turn_id: '',
			agent_id: '',
			tool_name: '',
		});
	});

	test('decodeSessionStreamEvent reads nested sub_agent_activity=35 presence; unused unread; shouldRefreshAgentTree', () => {
		const activity = Buffer.concat([
			encodeInt64Field(1, 9),
			encodeStringField(2, 'parent-unread'),
			encodeStringField(3, 'sub-unread'),
			encodeInt32Field(4, 2),
			encodeStringField(5, 'dim-unread'),
			encodeStringField(10, 'append-unread'),
			encodeStringField(11, 'status-unread'),
			encodeStringField(12, 'usage-unread'),
		]);
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeMessageField(35, activity),
			encodeStringField(99, 'unused-stream-field'),
		]);
		const decoded = decodeSessionStreamEvent(encoded);
		const payload = decoded.payload as {
			session_id?: string;
			sub_agent_activity?: Record<string, unknown>;
		};
		assert.strictEqual(payload.session_id, 'sess-1');
		assert.ok('sub_agent_activity' in payload);
		assert.deepStrictEqual(payload.sub_agent_activity, {});
		assert.ok(!('subAgentActivity' in payload));
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		assert.strictEqual(JSON.stringify(decoded).includes('unread'), false);
		assert.strictEqual(shouldRefreshAgentTree(decoded.payload), true);
		const omitted = decodeSessionStreamEvent(encodeStringField(1, 'sess-2'));
		assert.strictEqual((omitted.payload as { sub_agent_activity?: unknown }).sub_agent_activity, undefined);
		assert.ok(!('sub_agent_activity' in (omitted.payload as object)));
		assert.strictEqual(shouldRefreshAgentTree(omitted.payload), false);
		const emptyNested = decodeSessionStreamEvent(encodePresentMessageField(35, new Uint8Array(0)));
		assert.ok('sub_agent_activity' in (emptyNested.payload as object));
		assert.deepStrictEqual((emptyNested.payload as { sub_agent_activity?: unknown }).sub_agent_activity, {});
		assert.strictEqual(shouldRefreshAgentTree(emptyNested.payload), true);
	});

	test('decodeSessionStreamEvent reads nested sub_agent_completed=36 presence; unused unread; shouldRefreshAgentTree', () => {
		const completed = Buffer.concat([
			encodeInt64Field(1, 9),
			encodeStringField(2, 'parent-unread'),
			encodeStringField(3, 'sub-unread'),
			encodeInt32Field(4, 2),
			encodeStringField(5, 'dim-unread'),
			encodeStringField(10, 'append-unread'),
			encodeStringField(11, 'status-unread'),
			encodeStringField(12, 'usage-unread'),
		]);
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeMessageField(36, completed),
			encodeStringField(99, 'unused-stream-field'),
		]);
		const decoded = decodeSessionStreamEvent(encoded);
		const payload = decoded.payload as {
			session_id?: string;
			sub_agent_completed?: Record<string, unknown>;
		};
		assert.strictEqual(payload.session_id, 'sess-1');
		assert.ok('sub_agent_completed' in payload);
		assert.deepStrictEqual(payload.sub_agent_completed, {});
		assert.ok(!('subAgentCompleted' in payload));
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		assert.strictEqual(JSON.stringify(decoded).includes('unread'), false);
		assert.strictEqual(shouldRefreshAgentTree(decoded.payload), true);
		const omitted = decodeSessionStreamEvent(encodeStringField(1, 'sess-2'));
		assert.strictEqual((omitted.payload as { sub_agent_completed?: unknown }).sub_agent_completed, undefined);
		assert.ok(!('sub_agent_completed' in (omitted.payload as object)));
		assert.strictEqual(shouldRefreshAgentTree(omitted.payload), false);
		const emptyNested = decodeSessionStreamEvent(encodePresentMessageField(36, new Uint8Array(0)));
		assert.ok('sub_agent_completed' in (emptyNested.payload as object));
		assert.deepStrictEqual((emptyNested.payload as { sub_agent_completed?: unknown }).sub_agent_completed, {});
		assert.strictEqual(shouldRefreshAgentTree(emptyNested.payload), true);
	});

	test('decodeSessionStreamEvent reads nested turn_lifecycle=37 TurnLifecycleEvent turn_started=10; unused unread', () => {
		const started = Buffer.concat([
			encodeStringField(1, 'turn-life'),
			encodeStringField(2, 'agent-unread'),
			encodeStringField(3, 'model-unread'),
			encodeStringField(4, 'provider-unread'),
			encodeStringField(5, 'name-unread'),
			encodeStringField(6, 'profile-unread'),
			encodeStringField(7, 'started-unused'),
		]);
		const lifecycle = Buffer.concat([
			encodeInt64Field(1, 9),
			encodeMessageField(10, started),
			encodeStringField(12, 'lifecycle-unused'),
		]);
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeMessageField(37, lifecycle),
			encodeStringField(99, 'unused-stream-field'),
		]);
		const decoded = decodeSessionStreamEvent(encoded);
		const payload = decoded.payload as {
			session_id?: string;
			turn_lifecycle?: {
				runtime_epoch?: number;
				turn_started?: { turn_id?: string };
				turn_completed?: unknown;
			};
		};
		assert.strictEqual(payload.session_id, 'sess-1');
		assert.deepStrictEqual(payload.turn_lifecycle, {
			runtime_epoch: 9,
			turn_started: { turn_id: 'turn-life' },
		});
		assert.ok(!('turnLifecycle' in payload));
		assert.ok(!('turn_completed' in (payload.turn_lifecycle ?? {})));
		assert.ok(!('agent_id' in (payload.turn_lifecycle?.turn_started ?? {})));
		assert.ok(!('model_id' in (payload.turn_lifecycle?.turn_started ?? {})));
		assert.ok(!('model_profile_id' in (payload.turn_lifecycle?.turn_started ?? {})));
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		assert.strictEqual(JSON.stringify(decoded).includes('unread'), false);
		const joined = new OverlayDeltaJoin().handlePayload(decoded.payload);
		assert.deepStrictEqual(joined, [{
			arm: 'overlayActiveTurn',
			body: { turnId: 'turn-life', streamingText: '', thinkingText: '' },
		}]);
		const omitted = decodeSessionStreamEvent(encodeStringField(1, 'sess-2'));
		assert.strictEqual((omitted.payload as { turn_lifecycle?: unknown }).turn_lifecycle, undefined);
		const emptyNested = decodeSessionStreamEvent(encodePresentMessageField(37, new Uint8Array(0)));
		assert.deepStrictEqual((emptyNested.payload as { turn_lifecycle?: unknown }).turn_lifecycle, {
			runtime_epoch: 0,
		});
		const emptyStarted = decodeSessionStreamEvent(encodePresentMessageField(37, encodePresentMessageField(10, new Uint8Array(0))));
		assert.deepStrictEqual((emptyStarted.payload as { turn_lifecycle?: unknown }).turn_lifecycle, {
			runtime_epoch: 0,
			turn_started: { turn_id: '' },
		});
	});

	test('decodeSessionStreamEvent reads nested turn_lifecycle=37 TurnLifecycleEvent turn_completed=11; unused unread', () => {
		const completed = Buffer.concat([
			encodeStringField(1, 'turn-done'),
			encodeStringField(2, 'agent-unread'),
			encodeStringField(3, 'stop-unread'),
			encodeStringField(9, 'model-unread'),
			encodeStringField(13, 'asst-unread'),
			encodeStringField(14, 'completed-unused'),
		]);
		const lifecycle = Buffer.concat([
			encodeInt64Field(1, 9),
			encodeMessageField(11, completed),
			encodeStringField(12, 'lifecycle-unused'),
		]);
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeMessageField(37, lifecycle),
			encodeStringField(99, 'unused-stream-field'),
		]);
		const decoded = decodeSessionStreamEvent(encoded);
		const payload = decoded.payload as {
			session_id?: string;
			turn_lifecycle?: {
				runtime_epoch?: number;
				turn_started?: unknown;
				turn_completed?: unknown;
			};
		};
		assert.strictEqual(payload.session_id, 'sess-1');
		assert.deepStrictEqual(payload.turn_lifecycle, {
			runtime_epoch: 9,
			turn_completed: {},
		});
		assert.ok(!('turnLifecycle' in payload));
		assert.ok(!('turn_started' in (payload.turn_lifecycle ?? {})));
		assert.ok(!('turn_id' in ((payload.turn_lifecycle?.turn_completed as object) ?? {})));
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		assert.strictEqual(JSON.stringify(decoded).includes('unread'), false);
		const join = new OverlayDeltaJoin();
		join.handlePayload({ streaming_delta: { turn_id: 'turn-done', text_delta: 'x' } });
		assert.deepStrictEqual(join.handlePayload(decoded.payload), [{
			arm: 'overlayActiveTurnClear',
			body: {},
		}]);
		const emptyCompleted = decodeSessionStreamEvent(encodePresentMessageField(37, encodePresentMessageField(11, new Uint8Array(0))));
		assert.deepStrictEqual((emptyCompleted.payload as { turn_lifecycle?: unknown }).turn_lifecycle, {
			runtime_epoch: 0,
			turn_completed: {},
		});
		assert.deepStrictEqual(new OverlayDeltaJoin().handlePayload(emptyCompleted.payload), [{
			arm: 'overlayActiveTurnClear',
			body: {},
		}]);
	});

	test('decodeSessionStreamEvent field 38 detached_child_phase present → shouldRefreshAgentTree', () => {
		const decoded = decodeSessionStreamEvent(Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodePresentMessageField(38, new Uint8Array(0)),
			encodeStringField(99, 'unused-stream-field'),
		]));
		const payload = decoded.payload as {
			session_id?: string;
			detached_child_phase?: Record<string, unknown>;
		};
		assert.strictEqual(payload.session_id, 'sess-1');
		assert.ok('detached_child_phase' in payload);
		assert.deepStrictEqual(payload.detached_child_phase, {});
		assert.ok(!('detachedChildPhase' in payload));
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		assert.strictEqual(shouldRefreshAgentTree(decoded.payload), true);
	});

	test('decodeSessionStreamEvent reads nested runtime_overlay_snapshot=44 pending+active_turn; unused unread; maps via demux', () => {
		const questionItem = Buffer.concat([
			encodeStringField(1, 'i1'),
			encodeStringField(3, 'Go?'),
			encodeStringField(9, 'item-unused'),
		]);
		const questionPending = Buffer.concat([
			encodeStringField(1, 'pend-q'),
			encodeInt32Field(2, 2),
			encodeStringField(4, 'Ask'),
			encodeStringField(6, 'parent-tc-unread'),
			encodeMessageField(7, questionItem),
			encodeStringField(9, 'pending-unused'),
		]);
		const permissionPending = Buffer.concat([
			encodeStringField(1, 'pend-p'),
			encodeInt32Field(2, 1),
			encodeStringField(3, 'bash'),
			encodeStringField(4, 'Run bash'),
			encodeStringField(5, 'root'),
			encodeStringField(6, 'parent-tc-unread'),
			encodeStringField(8, '{}'),
		]);
		const activeTurn = Buffer.concat([
			encodeStringField(1, 'turn-9'),
			encodeStringField(2, 'agent-unread'),
			encodeStringField(3, 'hello'),
			encodeStringField(4, 'hmm'),
			encodeStringField(5, 'bash'),
			encodeStringField(6, 'turn-unused'),
		]);
		const overlay = Buffer.concat([
			encodeInt64Field(1, 4),
			encodeMessageField(2, activeTurn),
			encodeStringField(3, 'tool-call-unread'),
			encodeStringField(4, 'sub-agent-unread'),
			encodeStringField(5, 'deep-think-unread'),
			encodeMessageField(6, permissionPending),
			encodeMessageField(6, questionPending),
			encodeStringField(7, 'tool-runtime-unread'),
			encodeStringField(8, 'block-hw-unread'),
			encodeStringField(9, 'tool-hw-unread'),
		]);
		const encoded = Buffer.concat([
			encodeStringField(1, 'sess-1'),
			encodeMessageField(44, overlay),
			encodeStringField(99, 'unused-stream-field'),
		]);
		const decoded = decodeSessionStreamEvent(encoded);
		const payload = decoded.payload as {
			session_id?: string;
			runtime_overlay_snapshot?: Record<string, unknown>;
		};
		assert.strictEqual(payload.session_id, 'sess-1');
		assert.deepStrictEqual(payload.runtime_overlay_snapshot, {
			runtime_epoch: 4,
			active_turn: {
				turn_id: 'turn-9',
				streaming_text: 'hello',
				thinking_text: 'hmm',
				generating_tool_name: 'bash',
			},
			pending: [{
				request_id: 'pend-p',
				kind: 1,
				description: 'Run bash',
				tool_name: 'bash',
				agent_id: 'root',
				arguments_json: '{}',
			}, {
				request_id: 'pend-q',
				kind: 2,
				description: 'Ask',
				questions: [{
					id: 'i1',
					header: '',
					question: 'Go?',
					options: [],
					multi_select: false,
					allow_custom: false,
				}],
			}],
		});
		assert.ok(!('runtimeOverlaySnapshot' in payload));
		assert.ok(!('agent_id' in ((payload.runtime_overlay_snapshot?.active_turn as object) ?? {})));
		assert.ok(!('parent_tool_call_id' in ((payload.runtime_overlay_snapshot?.pending as object[])?.[0] ?? {})));
		assert.ok(!('items' in ((payload.runtime_overlay_snapshot?.pending as object[])?.[1] ?? {})));
		assert.ok(!('active_tool_calls' in (payload.runtime_overlay_snapshot ?? {})));
		assert.ok(!('sub_agent_panels' in (payload.runtime_overlay_snapshot ?? {})));
		assert.ok(!('deep_think' in (payload.runtime_overlay_snapshot ?? {})));
		assert.strictEqual(JSON.stringify(decoded).includes('unused'), false);
		assert.strictEqual(JSON.stringify(decoded).includes('unread'), false);
		const events = demuxSessionStreamPayload(decoded.payload);
		assert.strictEqual(events.length, 2);
		assert.deepStrictEqual(events[0], {
			arm: 'overlayPendingSnapshot',
			body: {
				runtimeEpoch: 4,
				pending: [{
					requestId: 'pend-p',
					kind: 'permission',
					description: 'Run bash',
					toolName: 'bash',
					agentId: 'root',
					argumentsJson: '{}',
				}, {
					requestId: 'pend-q',
					kind: 'question',
					description: 'Ask',
					questions: [{ id: 'i1', question: 'Go?', multiSelect: false, allowCustom: false }],
				}],
			},
		});
		assert.deepStrictEqual(events[1], {
			arm: 'overlayActiveTurn',
			body: {
				turnId: 'turn-9',
				streamingText: 'hello',
				thinkingText: 'hmm',
				generatingToolName: 'bash',
			},
		});
		const omitted = decodeSessionStreamEvent(encodeStringField(1, 'sess-2'));
		assert.strictEqual((omitted.payload as { runtime_overlay_snapshot?: unknown }).runtime_overlay_snapshot, undefined);
		const emptyNested = decodeSessionStreamEvent(encodePresentMessageField(44, new Uint8Array(0)));
		assert.deepStrictEqual((emptyNested.payload as { runtime_overlay_snapshot?: unknown }).runtime_overlay_snapshot, {
			runtime_epoch: 0,
			pending: [],
		});
		assert.deepStrictEqual(demuxSessionStreamPayload(emptyNested.payload), [{
			arm: 'overlayPendingSnapshot',
			body: { runtimeEpoch: 0, pending: [] },
		}, {
			arm: 'overlayActiveTurnClear',
			body: {},
		}]);
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
