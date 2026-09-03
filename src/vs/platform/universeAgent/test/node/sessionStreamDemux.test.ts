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

suite('sessionStreamDemux overlay + seats', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

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

	test('individual L3 deltas stay dropped (OverlayDeltaJoin owns them)', () => {
		assert.deepStrictEqual(demuxSessionStreamPayload({
			streaming_delta: { turn_id: 't', text_delta: 'x' },
		}), []);
		assert.deepStrictEqual(demuxSessionStreamPayload({
			thinking_delta: { turn_id: 't', text_delta: 'y' },
		}), []);
	});

	test('ask_user_question yields question arm and questionAsked localFact', () => {
		const events = demuxSessionStreamPayload({
			ask_user_question: {
				request_id: 'q-1',
				agent_id: 'root',
				items: [{
					id: 'i1',
					header: 'Pick',
					question: 'Which?',
					options: [{ label: 'A' }, { label: 'B' }],
					multi_select: true,
				}],
			},
		});
		assert.strictEqual(armOf(events[0]), 'question');
		assert.deepStrictEqual(bodyOf(events[0]).questions, [{
			id: 'i1',
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
});
