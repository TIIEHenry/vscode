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
