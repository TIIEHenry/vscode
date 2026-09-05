/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { demuxSessionStreamPayload, localFactFromQuestionArm } from '../../node/sessionStreamDemux.js';

function armOf(event: unknown): string | undefined {
	return event && typeof event === 'object' ? (event as { arm?: string }).arm : undefined;
}

function bodyOf(event: unknown): Record<string, unknown> {
	assert.ok(event && typeof event === 'object');
	const body = (event as { body?: unknown }).body;
	assert.ok(body && typeof body === 'object');
	return body as Record<string, unknown>;
}

suite('sessionStreamDemux L2/L3/L4', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('hello and heartbeat stay foldable', () => {
		const hello = demuxSessionStreamPayload({
			hello: { session_version: 1, head_seq: 3, runtime_epoch: 2, last_mutated_from_seq: 0 },
		});
		assert.deepStrictEqual(hello, [{
			arm: 'hello',
			body: { sessionVersion: 1, headSeq: 3, runtimeEpoch: 2, lastMutatedFromSeq: 0 },
		}]);
		assert.deepStrictEqual(demuxSessionStreamPayload({ heartbeat: {} }), [{ arm: 'heartbeat' }]);
	});

	test('text envelope with nested textBlock has no role on the body', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e1',
					seq: 4,
					role: 'ASSISTANT',
					turn_id: 't1',
					blocks: [{ block_type: 1, text_block: { text: 'hello world' } }],
				},
			},
		});
		assert.strictEqual(events.length, 1);
		assert.strictEqual(armOf(events[0]), 'text');
		const body = bodyOf(events[0]);
		assert.strictEqual(body.id, 'e1');
		assert.strictEqual(body.orderKey, '4');
		assert.strictEqual(body.title, 'Agent');
		assert.strictEqual(body.preview, 'hello world');
		assert.strictEqual(body.turnId, 't1');
		assert.strictEqual(body.role, undefined);
	});

	test('flat text / content blocks still map to text', () => {
		const events = demuxSessionStreamPayload({
			envelopeAppended: {
				envelope: {
					id: 'e2',
					seq: 1,
					role: 'USER',
					blocks: [{ text: 'typed here' }],
				},
			},
		});
		assert.strictEqual(armOf(events[0]), 'text');
		assert.strictEqual(bodyOf(events[0]).title, 'You');
		assert.strictEqual(bodyOf(events[0]).preview, 'typed here');
	});

	test('tool result wins over text in the same envelope', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e3',
					seq: 8,
					role: 'ASSISTANT',
					blocks: [
						{ blockType: 'TEXT', textBlock: { text: 'ignored' } },
						{ blockType: 'TOOL_RESULT', toolResultBlock: { toolName: 'bash', content: 'ok', isError: false } },
					],
				},
			},
		});
		assert.strictEqual(armOf(events[0]), 'tool');
		const body = bodyOf(events[0]);
		assert.strictEqual(body.toolName, 'bash');
		assert.strictEqual(body.status, 'completed');
		assert.strictEqual(body.resultPreview, 'ok');
	});

	test('tool call maps to tool with arg preview', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e4',
					seq: 9,
					blocks: [{
						block_type: 2,
						tool_call_block: { tool_name: 'read_file', arguments_json: '{"path":"a.ts"}' },
					}],
				},
			},
		});
		assert.strictEqual(armOf(events[0]), 'tool');
		assert.strictEqual(bodyOf(events[0]).toolName, 'read_file');
		assert.strictEqual(bodyOf(events[0]).argPreview, '{"path":"a.ts"}');
	});

	test('thinking block maps to reasoning', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e5',
					seq: 2,
					blocks: [{ block_type: 4, thinking_block: { thinking: 'considering' } }],
				},
			},
		});
		assert.strictEqual(armOf(events[0]), 'reasoning');
		assert.strictEqual(bodyOf(events[0]).title, 'THINKING');
		assert.strictEqual(bodyOf(events[0]).collapsedPreview, 'considering');
		assert.strictEqual(bodyOf(events[0]).streaming, false);
	});

	test('unknown carrier maps to unknownBlock', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e6',
					seq: 5,
					blocks: [{ block_type: 8, original_type: 'Metadata', raw_json: '{"k":1}' }],
				},
			},
		});
		assert.strictEqual(armOf(events[0]), 'unknownBlock');
		assert.strictEqual(bodyOf(events[0]).typeName, 'Metadata');
		assert.strictEqual(bodyOf(events[0]).rawContent, '{"k":1}');
	});

	test('pin-era snippet stays a text placeholder', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e7',
					seq: 6,
					role: 'SYSTEM',
					blocks: [{ block_type: 16, original_type: 'snippet' }],
				},
			},
		});
		assert.strictEqual(armOf(events[0]), 'text');
		assert.strictEqual(bodyOf(events[0]).preview, 'snippet');
	});

	test('permission request uses fold identity fields', () => {
		const events = demuxSessionStreamPayload({
			permission_request: {
				request_id: 'perm-1',
				description: 'Run bash',
				tool_name: 'bash',
				agent_id: 'root',
			},
		});
		assert.strictEqual(armOf(events[0]), 'permission');
		assert.deepStrictEqual(bodyOf(events[0]), {
			id: 'perm-1',
			orderKey: 'perm-1',
			title: 'Run bash',
			permissionKind: 'bash',
			agentId: 'root',
		});
	});

	test('permission camelCase works; blank requestId is dropped', () => {
		assert.deepStrictEqual(demuxSessionStreamPayload({
			permissionRequest: { requestId: '  padded  ', toolName: 'bash', description: 'x' },
		}), []);
		const events = demuxSessionStreamPayload({
			permissionRequest: { requestId: 'p2', toolName: 'edit', description: 'Edit file' },
		});
		assert.strictEqual(bodyOf(events[0]).id, 'p2');
		assert.strictEqual(bodyOf(events[0]).permissionKind, 'edit');
	});

	test('client_tool_call maps requestId to callId', () => {
		const events = demuxSessionStreamPayload({
			session_id: 's1',
			client_tool_call: {
				request_id: 'ctc-1',
				tool_name: 'browser',
				arguments_json: '{}',
				agent_id: 'agent-a',
			},
		});
		assert.strictEqual(armOf(events[0]), 'clientToolCall');
		assert.deepStrictEqual(bodyOf(events[0]), {
			callId: 'ctc-1',
			toolName: 'browser',
			argumentsJson: '{}',
			sessionId: 's1',
			agentId: 'agent-a',
		});
	});

	test('ask_user_question maps items and yields a questionAsked localFact', () => {
		const events = demuxSessionStreamPayload({
			ask_user_question: {
				request_id: 'q-1',
				agent_id: 'root',
				items: [{
					id: 'item-a',
					header: 'Pick',
					question: 'Which?',
					options: [{ label: 'A' }, { label: 'B' }],
					multi_select: true,
					allow_custom: false,
				}],
			},
		});
		assert.strictEqual(armOf(events[0]), 'question');
		const body = bodyOf(events[0]);
		assert.strictEqual(body.id, 'q-1');
		assert.deepStrictEqual(body.questions, [{
			id: 'item-a',
			header: 'Pick',
			question: 'Which?',
			optionsPreview: ['A', 'B'],
			multiSelect: true,
			allowCustom: false,
		}]);
		const fact = localFactFromQuestionArm(events[0]);
		assert.ok(fact);
		assert.strictEqual(fact.kind, 'questionAsked');
		assert.strictEqual(fact.questionId, 'q-1');
		assert.strictEqual(fact.agentId, 'root');
		assert.strictEqual(fact.questions.length, 1);
	});

	test('ask_user_question without items does not invent a localFact', () => {
		const events = demuxSessionStreamPayload({
			askUserQuestion: { requestId: 'q-empty', items: [] },
		});
		assert.strictEqual(armOf(events[0]), 'question');
		assert.strictEqual(localFactFromQuestionArm(events[0]), undefined);
	});

	test('runtime overlay snapshot yields pending plus activeTurn', () => {
		const events = demuxSessionStreamPayload({
			runtime_overlay_snapshot: {
				runtime_epoch: 4,
				active_turn: {
					turn_id: 'turn-9',
					streaming_text: 'hello',
					thinking_text: 'hmm',
					generating_tool_name: 'bash',
				},
				pending: [{
					request_id: 'pend-1',
					kind: 2,
					description: 'Ask',
					questions: [{ id: 'i1', question: 'Go?' }],
				}],
			},
		});
		assert.strictEqual(events.length, 2);
		assert.strictEqual(armOf(events[0]), 'overlayPendingSnapshot');
		assert.strictEqual(bodyOf(events[0]).runtimeEpoch, 4);
		assert.deepStrictEqual((bodyOf(events[0]).pending as unknown[])[0], {
			requestId: 'pend-1',
			kind: 'question',
			description: 'Ask',
			questions: [{ id: 'i1', question: 'Go?', multiSelect: false, allowCustom: false }],
		});
		assert.strictEqual(armOf(events[1]), 'overlayActiveTurn');
		assert.deepStrictEqual(bodyOf(events[1]), {
			turnId: 'turn-9',
			streamingText: 'hello',
			thinkingText: 'hmm',
			generatingToolName: 'bash',
		});
	});

	test('runtime overlay without activeTurn clears overlay', () => {
		const events = demuxSessionStreamPayload({
			runtimeOverlaySnapshot: { runtimeEpoch: 1, pending: [] },
		});
		assert.strictEqual(armOf(events[0]), 'overlayPendingSnapshot');
		assert.deepStrictEqual(events[1], { arm: 'overlayActiveTurnClear', body: {} });
	});

	test('rangeReplaced inner envelopes are classified', () => {
		const events = demuxSessionStreamPayload({
			envelope_range_replaced: {
				from_seq: 2,
				replacement: [{
					id: 'r1',
					seq: 3,
					blocks: [{ block_type: 2, tool_call_block: { tool_name: 'grep' } }],
				}],
			},
		});
		assert.strictEqual(armOf(events[0]), 'rangeReplaced');
		const inner = bodyOf(events[0]).events as unknown[];
		assert.strictEqual(armOf(inner[0]), 'tool');
		assert.strictEqual(bodyOf(inner[0]).toolName, 'grep');
	});

	test('individual L3 deltas stay dropped', () => {
		assert.deepStrictEqual(demuxSessionStreamPayload({
			streaming_delta: { turn_id: 't', text_delta: 'x' },
		}), []);
		assert.deepStrictEqual(demuxSessionStreamPayload({
			thinking_delta: { turn_id: 't', text_delta: 'y' },
		}), []);
		assert.deepStrictEqual(demuxSessionStreamPayload({
			tool_call_lifecycle: { tool_call_id: 'tc' },
		}), []);
	});

	test('subscriptionHealth and sessionPurged are L1 arms', () => {
		assert.deepStrictEqual(demuxSessionStreamPayload({
			subscription_health: { phase: 2 },
		}), [{ arm: 'subscriptionHealth', body: { phase: 2 } }]);
		assert.deepStrictEqual(demuxSessionStreamPayload({
			sessionPurged: {},
		}), [{ arm: 'sessionPurged', body: {} }]);
	});
});
