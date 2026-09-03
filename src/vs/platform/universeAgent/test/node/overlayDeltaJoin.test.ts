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

	test('turn_completed clears overlay', () => {
		const join = new OverlayDeltaJoin();
		join.handlePayload({ streaming_delta: { turn_id: 't1', text_delta: 'x' } });
		assert.deepStrictEqual(join.handlePayload({
			turn_lifecycle: { turn_completed: { turn_id: 't1' } },
		}), [{ arm: 'overlayActiveTurnClear', body: {} }]);
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
});
