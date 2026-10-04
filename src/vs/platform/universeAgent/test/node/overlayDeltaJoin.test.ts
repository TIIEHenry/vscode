/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { OverlayDeltaJoin } from '../../node/overlayDeltaJoin.js';

suite('OverlayDeltaJoin', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('accumulates streaming and thinking deltas into overlayActiveTurn', () => {
		const join = new OverlayDeltaJoin();
		const first = join.handlePayload({
			streaming_delta: { turn_id: 't1', text_delta: 'Hel' },
		});
		assert.deepStrictEqual(first, [{
			arm: 'overlayActiveTurn',
			body: { turnId: 't1', streamingText: 'Hel', thinkingText: '' },
		}]);
		const second = join.handlePayload({
			thinking_delta: { turn_id: 't1', text_delta: 'hmm' },
		});
		assert.deepStrictEqual(second, [{
			arm: 'overlayActiveTurn',
			body: { turnId: 't1', streamingText: 'Hel', thinkingText: 'hmm' },
		}]);
		const third = join.handlePayload({
			streaming_delta: { turnId: 't1', textDelta: 'lo' },
		});
		assert.strictEqual((third[0] as { body: { streamingText: string } }).body.streamingText, 'Hello');
	});

	test('keeps a decoded agent_id on overlayActiveTurn across deltas and a snapshot', () => {
		const join = new OverlayDeltaJoin();
		const streaming = join.handlePayload({
			streaming_delta: { turn_id: 't1', text_delta: 'Hel', agent_id: 'agent-sub' },
		});
		assert.deepStrictEqual(streaming, [{
			arm: 'overlayActiveTurn',
			body: { turnId: 't1', streamingText: 'Hel', thinkingText: '', agentId: 'agent-sub' },
		}]);
		const thinking = join.handlePayload({
			thinking_delta: { turn_id: 't1', text_delta: 'hmm' },
		});
		assert.strictEqual((thinking[0] as { body: { agentId?: string; thinkingText: string } }).body.agentId, 'agent-sub');
		assert.strictEqual((thinking[0] as { body: { thinkingText: string } }).body.thinkingText, 'hmm');
		const tool = join.handlePayload({
			generating_tool: { turn_id: 't1', tool_name: 'bash', agentId: 'agent-sub' },
		});
		assert.deepStrictEqual(tool, [{
			arm: 'overlayActiveTurn',
			body: { turnId: 't1', streamingText: 'Hel', thinkingText: 'hmm', generatingToolName: 'bash', agentId: 'agent-sub' },
		}]);

		const snapped = new OverlayDeltaJoin();
		assert.deepStrictEqual(snapped.handlePayload({
			runtime_overlay_snapshot: {
				active_turn: { turn_id: 't9', streaming_text: 'snap', thinking_text: '', agent_id: 'agent-snap' },
			},
		}), []);
		const next = snapped.handlePayload({
			streaming_delta: { turn_id: 't9', text_delta: '!' },
		});
		assert.deepStrictEqual(next, [{
			arm: 'overlayActiveTurn',
			body: { turnId: 't9', streamingText: 'snap!', thinkingText: '', agentId: 'agent-snap' },
		}]);

		const switched = new OverlayDeltaJoin();
		switched.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'a', agent_id: 'agent-sub' } });
		const other = switched.handlePayload({ streaming_delta: { turn_id: 't2', text_delta: 'b' } });
		assert.deepStrictEqual(other, [{
			arm: 'overlayActiveTurn',
			body: { turnId: 't2', streamingText: 'b', thinkingText: '' },
		}]);
		const blank = new OverlayDeltaJoin().handlePayload({
			streaming_delta: { turn_id: 't3', text_delta: 'c', agent_id: '' },
		});
		assert.deepStrictEqual(blank, [{
			arm: 'overlayActiveTurn',
			body: { turnId: 't3', streamingText: 'c', thinkingText: '' },
		}]);
	});

	test('turn_completed clears overlay', () => {
		const timer = new ManualTimeout();
		const join = new OverlayDeltaJoin({ scheduleTimeout: timer.scheduleTimeout });
		join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'x' } });
		assert.deepStrictEqual(join.handlePayload({
			turn_lifecycle: { turn_completed: { turn_id: 't1' } },
		}), []);
		assert.strictEqual(timer.delayMs, 2000);
		assert.strictEqual(timer.disposed, false);
	});

	test('clear drops accumulated text so a replay is not doubled', () => {
		const join = new OverlayDeltaJoin();
		join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'Hel' } });
		join.clear();
		const next = join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'Hel' } });
		assert.strictEqual((next[0] as { body: { streamingText: string } }).body.streamingText, 'Hel');
	});

	test('runtime overlay snapshot resets and yields nothing', () => {
		const join = new OverlayDeltaJoin();
		join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'old' } });
		assert.deepStrictEqual(join.handlePayload({
			runtime_overlay_snapshot: {
				active_turn: { turn_id: 't2', streaming_text: 'snap', thinking_text: '' },
			},
		}), []);
		const next = join.handlePayload({
			streaming_delta: { turn_id: 't2', text_delta: '!' },
		});
		assert.strictEqual((next[0] as { body: { streamingText: string; turnId: string } }).body.turnId, 't2');
		assert.strictEqual((next[0] as { body: { streamingText: string } }).body.streamingText, 'snap!');
	});

	test('assistant L2 envelope clears the matching overlay turn', () => {
		const roles: unknown[] = ['ASSISTANT', 'assistant', 'MESSAGE_ROLE_ASSISTANT', 'message_role_assistant', 2];
		for (const role of roles) {
			const join = new OverlayDeltaJoin();
			join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'x' } });
			assert.deepStrictEqual(join.handlePayload({
				envelope_appended: { envelope: { id: 'e1', seq: 3, role, turn_id: 't1', blocks: [] } },
			}), [{ arm: 'overlayActiveTurnClear', body: {} }]);
			const next = join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'y' } });
			assert.strictEqual((next[0] as { body: { streamingText: string } }).body.streamingText, 'y');
		}
		const camel = new OverlayDeltaJoin();
		camel.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'x' } });
		assert.deepStrictEqual(camel.handlePayload({
			envelopeAppended: { envelope: { id: 'e1', seq: 3, role: 'ASSISTANT', turnId: 't1', blocks: [] } },
		}), [{ arm: 'overlayActiveTurnClear', body: {} }]);
	});

	test('non-assistant or different turn_id does not clear', () => {
		const join = new OverlayDeltaJoin();
		join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'x' } });
		assert.deepStrictEqual(join.handlePayload({
			envelope_appended: { envelope: { id: 'e1', seq: 3, role: 'USER', turn_id: 't1', blocks: [] } },
		}), []);
		assert.deepStrictEqual(join.handlePayload({
			envelope_appended: { envelope: { id: 'e2', seq: 4, role: 'ASSISTANT', turn_id: 't2', blocks: [] } },
		}), []);
		const next = join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'y' } });
		assert.strictEqual((next[0] as { body: { streamingText: string } }).body.streamingText, 'xy');
	});

	test('assistant envelope in a batch clears the matching overlay turn', () => {
		const join = new OverlayDeltaJoin();
		join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'x' } });
		assert.deepStrictEqual(join.handlePayload({
			envelope_batch_appended: {
				envelopes: [
					{ id: 'u', seq: 2, role: 'USER', turn_id: 't1', blocks: [] },
					{ id: 'e1', seq: 3, role: 'ASSISTANT', turn_id: 't1', blocks: [] },
				],
			},
		}), [{ arm: 'overlayActiveTurnClear', body: {} }]);
	});

	test('turn_completed holds until matching assistant L2', () => {
		const timer = new ManualTimeout();
		const join = new OverlayDeltaJoin({ scheduleTimeout: timer.scheduleTimeout });
		const delivered: unknown[] = [];
		join.setDeferredArmHandler(arm => delivered.push(arm));
		join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'x' } });
		assert.deepStrictEqual(join.handlePayload({
			turn_lifecycle: { turn_completed: { turn_id: 't1' } },
		}), []);
		assert.deepStrictEqual(join.handlePayload({
			envelope_appended: { envelope: { id: 'e1', seq: 3, role: 'ASSISTANT', turn_id: 't1', blocks: [] } },
		}), [{ arm: 'overlayActiveTurnClear', body: {} }]);
		assert.strictEqual(timer.disposed, true);
		assert.deepStrictEqual(delivered, []);
		assert.strictEqual(join.deferredClearTimeoutCount, 0);
		timer.fire();
		assert.deepStrictEqual(delivered, []);
		assert.strictEqual(join.deferredClearTimeoutCount, 0);
	});

	test('turn_started during hold returns clear then the new active turn', () => {
		const timer = new ManualTimeout();
		const join = new OverlayDeltaJoin({ scheduleTimeout: timer.scheduleTimeout });
		const delivered: unknown[] = [];
		join.setDeferredArmHandler(arm => delivered.push(arm));
		join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'x' } });
		assert.deepStrictEqual(join.handlePayload({
			turn_lifecycle: { turn_completed: { turn_id: 't1' } },
		}), []);
		assert.deepStrictEqual(join.handlePayload({
			turn_lifecycle: { turn_started: { turn_id: 't2' } },
		}), [
			{ arm: 'overlayActiveTurnClear', body: {} },
			{ arm: 'overlayActiveTurn', body: { turnId: 't2', streamingText: '', thinkingText: '' } },
		]);
		assert.strictEqual(timer.disposed, true);
		timer.fire();
		assert.deepStrictEqual(delivered, []);
		assert.strictEqual(join.deferredClearTimeoutCount, 0);
	});

	test('held clear fires after 2s through the deferred handler', () => {
		const timer = new ManualTimeout();
		const join = new OverlayDeltaJoin({ scheduleTimeout: timer.scheduleTimeout });
		const delivered: unknown[] = [];
		join.setDeferredArmHandler(arm => delivered.push(arm));
		join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'x' } });
		assert.deepStrictEqual(join.handlePayload({
			turn_lifecycle: { turn_completed: { turn_id: 't1' } },
		}), []);
		assert.strictEqual(join.deferredClearTimeoutCount, 0);
		assert.strictEqual(timer.delayMs, 2000);
		timer.fire();
		assert.strictEqual(join.deferredClearTimeoutCount, 1);
		assert.deepStrictEqual(delivered, [{ arm: 'overlayActiveTurnClear', body: {} }]);
		timer.fire();
		assert.strictEqual(join.deferredClearTimeoutCount, 1);
		const next = join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'a' } });
		assert.strictEqual((next[0] as { body: { streamingText: string } }).body.streamingText, 'a');
	});

	test('held clear timeout counts when no deferred handler is set', () => {
		const timer = new ManualTimeout();
		const join = new OverlayDeltaJoin({ scheduleTimeout: timer.scheduleTimeout });
		join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'x' } });
		assert.deepStrictEqual(join.handlePayload({
			turn_lifecycle: { turn_completed: {} },
		}), []);
		timer.fire();
		assert.strictEqual(join.deferredClearTimeoutCount, 1);
		const next = join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'a' } });
		assert.strictEqual((next[0] as { body: { streamingText: string } }).body.streamingText, 'a');
	});

	test('snapshot and clear during hold cancel the timer', () => {
		const snapshotTimer = new ManualTimeout();
		const snapshotJoin = new OverlayDeltaJoin({ scheduleTimeout: snapshotTimer.scheduleTimeout });
		const snapshotDelivered: unknown[] = [];
		snapshotJoin.setDeferredArmHandler(arm => snapshotDelivered.push(arm));
		snapshotJoin.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'x' } });
		assert.deepStrictEqual(snapshotJoin.handlePayload({
			turn_lifecycle: { turn_completed: { turn_id: 't1' } },
		}), []);
		assert.deepStrictEqual(snapshotJoin.handlePayload({
			runtime_overlay_snapshot: {},
		}), []);
		assert.strictEqual(snapshotTimer.disposed, true);
		snapshotTimer.fire();
		assert.deepStrictEqual(snapshotDelivered, []);
		assert.strictEqual(snapshotJoin.deferredClearTimeoutCount, 0);

		const clearTimer = new ManualTimeout();
		const clearJoin = new OverlayDeltaJoin({ scheduleTimeout: clearTimer.scheduleTimeout });
		const clearDelivered: unknown[] = [];
		clearJoin.setDeferredArmHandler(arm => clearDelivered.push(arm));
		clearJoin.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'x' } });
		assert.deepStrictEqual(clearJoin.handlePayload({
			turn_lifecycle: { turn_completed: { turn_id: 't1' } },
		}), []);
		clearJoin.clear();
		assert.strictEqual(clearTimer.disposed, true);
		clearTimer.fire();
		assert.deepStrictEqual(clearDelivered, []);
		assert.strictEqual(clearJoin.deferredClearTimeoutCount, 0);
	});

	test('turn_completed with no active overlay returns an immediate clear', () => {
		let scheduled = 0;
		const join = new OverlayDeltaJoin({
			scheduleTimeout: () => {
				scheduled++;
				return { dispose() { /* hold must not start */ } };
			},
		});
		assert.deepStrictEqual(join.handlePayload({
			turn_lifecycle: { turn_completed: {} },
		}), [{ arm: 'overlayActiveTurnClear', body: {} }]);
		assert.strictEqual(scheduled, 0);
		assert.strictEqual(join.deferredClearTimeoutCount, 0);
	});

	test('tool-only assistant envelope keeps accumulated streaming text', () => {
		const toolOnly = {
			envelope_appended: {
				envelope: {
					id: 'env-call-1', seq: 2, role: 'ASSISTANT', turn_id: 't1',
					blocks: [{ block_type: 2, tool_call_block: { tool_name: 'ls', arguments_json: '{"path":"."}' } }],
				},
			},
		};
		const join = new OverlayDeltaJoin();
		join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'I will check.', agent_id: 'agent-sub' } });
		join.handlePayload({ thinking_delta: { turn_id: 't1', text_delta: 'hmm' } });
		join.handlePayload({ generating_tool: { turn_id: 't1', tool_name: 'bash', agent_id: 'agent-sub' } });
		assert.deepStrictEqual(join.handlePayload(toolOnly), [{
			arm: 'overlayActiveTurn',
			body: { turnId: 't1', streamingText: 'I will check.', thinkingText: 'hmm', agentId: 'agent-sub' },
		}]);
		const more = join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: ' Yes.' } });
		assert.strictEqual((more[0] as { body: { streamingText: string; generatingToolName?: string } }).body.streamingText, 'I will check. Yes.');
		assert.strictEqual((more[0] as { body: { generatingToolName?: string } }).body.generatingToolName, undefined);

		const camel = new OverlayDeltaJoin();
		camel.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'Hel' } });
		assert.deepStrictEqual(camel.handlePayload({
			envelopeAppended: {
				envelope: {
					id: 'e1', seq: 2, role: 'ASSISTANT', turnId: 't1',
					blocks: [{ blockType: 2, toolCallBlock: { toolName: 'ls' } }],
				},
			},
		}), [{
			arm: 'overlayActiveTurn',
			body: { turnId: 't1', streamingText: 'Hel', thinkingText: '' },
		}]);

		const batch = new OverlayDeltaJoin();
		batch.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'Hel' } });
		assert.deepStrictEqual(batch.handlePayload({
			envelope_batch_appended: {
				envelopes: [
					{ id: 'u', seq: 1, role: 'USER', turn_id: 't1', blocks: [] },
					{ id: 'e1', seq: 2, role: 'ASSISTANT', turn_id: 't1', blocks: [{ block_type: 2, tool_call_block: { tool_name: 'ls' } }] },
				],
			},
		}), [{
			arm: 'overlayActiveTurn',
			body: { turnId: 't1', streamingText: 'Hel', thinkingText: '' },
		}]);

		const blankText = new OverlayDeltaJoin();
		blankText.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'Hel' } });
		assert.deepStrictEqual(blankText.handlePayload({
			envelope_appended: {
				envelope: {
					id: 'e1', seq: 2, role: 'ASSISTANT', turn_id: 't1',
					blocks: [
						{ block_type: 2, tool_call_block: { tool_name: 'ls' } },
						{ block_type: 1, text_block: { text: '   ' } },
					],
				},
			},
		}), [{
			arm: 'overlayActiveTurn',
			body: { turnId: 't1', streamingText: 'Hel', thinkingText: '' },
		}]);

		const withText = new OverlayDeltaJoin();
		withText.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'I will check.' } });
		assert.deepStrictEqual(withText.handlePayload({
			envelope_appended: {
				envelope: {
					id: 'env-asst-1', seq: 4, role: 'ASSISTANT', turn_id: 't1',
					blocks: [{ block_type: 1, text_block: { text: 'I will check.' } }],
				},
			},
		}), [{ arm: 'overlayActiveTurnClear', body: {} }]);

		const mixed = new OverlayDeltaJoin();
		mixed.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'I will check.' } });
		assert.deepStrictEqual(mixed.handlePayload({
			envelope_appended: {
				envelope: {
					id: 'e-mix', seq: 3, role: 'ASSISTANT', turn_id: 't1',
					blocks: [
						{ block_type: 2, tool_call_block: { tool_name: 'ls' } },
						{ block_type: 1, text_block: { text: 'done' } },
					],
				},
			},
		}), [{ arm: 'overlayActiveTurnClear', body: {} }]);

		const emptyBlocks = new OverlayDeltaJoin();
		emptyBlocks.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'x' } });
		assert.deepStrictEqual(emptyBlocks.handlePayload({
			envelope_appended: { envelope: { id: 'e1', seq: 3, role: 'ASSISTANT', turn_id: 't1', blocks: [] } },
		}), [{ arm: 'overlayActiveTurnClear', body: {} }]);

		const unnamed = new OverlayDeltaJoin();
		unnamed.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'x' } });
		assert.deepStrictEqual(unnamed.handlePayload({
			envelope_appended: {
				envelope: {
					id: 'e1', seq: 2, role: 'ASSISTANT', turn_id: 't1',
					blocks: [{ block_type: 2, tool_call_block: { tool_name: '  ' } }],
				},
			},
		}), [{ arm: 'overlayActiveTurnClear', body: {} }]);

		const thinkingOnly = new OverlayDeltaJoin();
		thinkingOnly.handlePayload({ thinking_delta: { turn_id: 't1', text_delta: 'hmm', agent_id: 'agent-sub' } });
		thinkingOnly.handlePayload({ generating_tool: { turn_id: 't1', tool_name: 'bash', agent_id: 'agent-sub' } });
		assert.deepStrictEqual(thinkingOnly.handlePayload(toolOnly), [{
			arm: 'overlayActiveTurn',
			body: { turnId: 't1', streamingText: '', thinkingText: 'hmm', agentId: 'agent-sub' },
		}]);
		const moreThink = thinkingOnly.handlePayload({ thinking_delta: { turn_id: 't1', text_delta: ' more' } });
		assert.strictEqual((moreThink[0] as { body: { thinkingText: string } }).body.thinkingText, 'hmm more');
		assert.strictEqual((moreThink[0] as { body: { generatingToolName?: string } }).body.generatingToolName, undefined);

		const blankThink = new OverlayDeltaJoin();
		blankThink.handlePayload({ thinking_delta: { turn_id: 't1', text_delta: 'hmm' } });
		blankThink.handlePayload({ generating_tool: { turn_id: 't1', tool_name: 'bash' } });
		assert.deepStrictEqual(blankThink.handlePayload({
			envelope_appended: {
				envelope: {
					id: 'e-blank-think', seq: 2, role: 'ASSISTANT', turn_id: 't1',
					blocks: [
						{ thinking_block: { thinking: '   \n\t' } },
						{ block_type: 2, tool_call_block: { tool_name: 'ls' } },
					],
				},
			},
		}), [{
			arm: 'overlayActiveTurn',
			body: { turnId: 't1', streamingText: '', thinkingText: 'hmm' },
		}]);

		const persistedThink = new OverlayDeltaJoin();
		persistedThink.handlePayload({ thinking_delta: { turn_id: 't1', text_delta: 'hmm' } });
		persistedThink.handlePayload({ generating_tool: { turn_id: 't1', tool_name: 'bash' } });
		assert.deepStrictEqual(persistedThink.handlePayload({
			envelope_appended: {
				envelope: {
					id: 'e-think', seq: 2, role: 'ASSISTANT', turn_id: 't1',
					blocks: [
						{ thinking_block: { thinking: 'from envelope' } },
						{ block_type: 2, tool_call_block: { tool_name: 'ls' } },
					],
				},
			},
		}), [{ arm: 'overlayActiveTurnClear', body: {} }]);

		const camelThink = new OverlayDeltaJoin();
		camelThink.handlePayload({ thinking_delta: { turn_id: 't1', text_delta: 'hmm' } });
		assert.deepStrictEqual(camelThink.handlePayload({
			envelopeAppended: {
				envelope: {
					id: 'e1', seq: 2, role: 'ASSISTANT', turnId: 't1',
					blocks: [
						{ blockType: 'THINKING', thinkingBlock: { thinking: 'from envelope' } },
						{ blockType: 2, toolCallBlock: { toolName: 'ls' } },
					],
				},
			},
		}), [{ arm: 'overlayActiveTurnClear', body: {} }]);

		const bodyAndPersistedThink = new OverlayDeltaJoin();
		bodyAndPersistedThink.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'I will check.' } });
		bodyAndPersistedThink.handlePayload({ thinking_delta: { turn_id: 't1', text_delta: 'hmm' } });
		bodyAndPersistedThink.handlePayload({ generating_tool: { turn_id: 't1', tool_name: 'bash' } });
		assert.deepStrictEqual(bodyAndPersistedThink.handlePayload({
			envelope_appended: {
				envelope: {
					id: 'e-body-think', seq: 2, role: 'ASSISTANT', turn_id: 't1',
					blocks: [
						{ block_type: 4, thinking_block: { thinking: 'from envelope' } },
						{ block_type: 2, tool_call_block: { tool_name: 'ls' } },
					],
				},
			},
		}), [{
			arm: 'overlayActiveTurn',
			body: { turnId: 't1', streamingText: 'I will check.', thinkingText: '' },
		}]);

		const thinkingEnvelope = new OverlayDeltaJoin();
		thinkingEnvelope.handlePayload({ thinking_delta: { turn_id: 't1', text_delta: 'hmm' } });
		assert.deepStrictEqual(thinkingEnvelope.handlePayload({
			envelope_appended: {
				envelope: {
					id: 'e-think-only', seq: 2, role: 'ASSISTANT', turn_id: 't1',
					blocks: [{ block_type: 4, thinking_block: { thinking: 'hmm' } }],
				},
			},
		}), [{ arm: 'overlayActiveTurnClear', body: {} }]);

		const timer = new ManualTimeout();
		const held = new OverlayDeltaJoin({ scheduleTimeout: timer.scheduleTimeout });
		const delivered: unknown[] = [];
		held.setDeferredArmHandler(arm => delivered.push(arm));
		held.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'I will check.' } });
		assert.deepStrictEqual(held.handlePayload({
			turn_lifecycle: { turn_completed: { turn_id: 't1' } },
		}), []);
		assert.deepStrictEqual(held.handlePayload(toolOnly), [{
			arm: 'overlayActiveTurn',
			body: { turnId: 't1', streamingText: 'I will check.', thinkingText: '' },
		}]);
		assert.strictEqual(timer.disposed, true);
		timer.fire();
		assert.deepStrictEqual(delivered, []);
		assert.strictEqual(held.deferredClearTimeoutCount, 0);
		assert.deepStrictEqual(held.handlePayload({
			envelope_appended: {
				envelope: {
					id: 'env-asst-1', seq: 4, role: 'ASSISTANT', turn_id: 't1',
					blocks: [{ block_type: 1, text_block: { text: 'I will check.' } }],
				},
			},
		}), [{ arm: 'overlayActiveTurnClear', body: {} }]);
	});

	test('tool_call_lifecycle started reuses generating_tool and later arms keep the text', () => {
		const join = new OverlayDeltaJoin();
		join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'I will check.', agent_id: 'agent-sub' } });
		join.handlePayload({ thinking_delta: { turn_id: 't1', text_delta: 'hmm' } });
		assert.deepStrictEqual(join.handlePayload({
			tool_call_lifecycle: {
				turn_id: 't1',
				tool_call_id: 'tc-1',
				agent_id: 'agent-sub',
				started: { tool_name: 'bash' },
			},
		}), [{
			arm: 'overlayActiveTurn',
			body: { turnId: 't1', streamingText: 'I will check.', thinkingText: 'hmm', generatingToolName: 'bash', generatingToolCallId: 'tc-1', agentId: 'agent-sub' },
		}]);
		assert.deepStrictEqual(join.handlePayload({
			tool_call_lifecycle: { turn_id: 't1', args_complete: { args_json: '{}' } },
		}), []);
		assert.deepStrictEqual(join.handlePayload({
			tool_call_lifecycle: { turn_id: 't1', completed: { output: 'ok' } },
		}), []);
		assert.deepStrictEqual(join.handlePayload({
			toolCallLifecycle: { turnId: 't1', failed: { error_message: 'no' } },
		}), []);
		assert.deepStrictEqual(join.handlePayload({
			tool_call_lifecycle: { turn_id: 't1', started: { tool_name: '' } },
		}), []);
		const still = join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: '' } });
		assert.strictEqual((still[0] as { body: { streamingText: string } }).body.streamingText, 'I will check.');
		assert.strictEqual((still[0] as { body: { thinkingText: string } }).body.thinkingText, 'hmm');
		assert.strictEqual((still[0] as { body: { generatingToolName?: string } }).body.generatingToolName, 'bash');
		assert.strictEqual((still[0] as { body: { generatingToolCallId?: string } }).body.generatingToolCallId, 'tc-1');
		assert.strictEqual((still[0] as { body: { agentId?: string } }).body.agentId, 'agent-sub');
	});

	test('a blank tool_call_id is omitted and a later generating_tool keeps an exact id only for the same name', () => {
		const join = new OverlayDeltaJoin();
		join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'I will check.' } });
		const started = join.handlePayload({
			tool_call_lifecycle: {
				turn_id: 't1',
				tool_call_id: 'tc-1',
				started: { tool_name: 'bash' },
			},
		});
		assert.strictEqual((started[0] as { body: { generatingToolCallId?: string } }).body.generatingToolCallId, 'tc-1');
		const blank = join.handlePayload({
			tool_call_lifecycle: {
				turn_id: 't1',
				tool_call_id: '  tc  ',
				started: { tool_name: 'bash' },
			},
		});
		assert.strictEqual((blank[0] as { body: { generatingToolName?: string } }).body.generatingToolName, 'bash');
		assert.ok(!Object.hasOwn((blank[0] as { body: object }).body, 'generatingToolCallId'));
		const again = join.handlePayload({
			tool_call_lifecycle: {
				turn_id: 't1',
				tool_call_id: 'tc-1',
				started: { tool_name: 'bash' },
			},
		});
		assert.strictEqual((again[0] as { body: { generatingToolCallId?: string } }).body.generatingToolCallId, 'tc-1');
		const sameName = join.handlePayload({ generating_tool: { turn_id: 't1', tool_name: 'bash' } });
		assert.strictEqual((sameName[0] as { body: { generatingToolCallId?: string } }).body.generatingToolCallId, 'tc-1');
		const otherName = join.handlePayload({ generating_tool: { turn_id: 't1', tool_name: 'read' } });
		assert.strictEqual((otherName[0] as { body: { generatingToolName?: string } }).body.generatingToolName, 'read');
		assert.ok(!Object.hasOwn((otherName[0] as { body: object }).body, 'generatingToolCallId'));
	});
});

class ManualTimeout {
	delayMs = 0;
	disposed = false;
	private callback: (() => void) | undefined;

	readonly scheduleTimeout = (delayMs: number, callback: () => void): { dispose(): void } => {
		this.delayMs = delayMs;
		this.callback = callback;
		this.disposed = false;
		return {
			dispose: () => {
				this.disposed = true;
			},
		};
	};

	fire(): void {
		this.callback?.();
	}
}
