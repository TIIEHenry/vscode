/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	ConversationTimelineFrameScheduler,
	type ConversationTimelineFlush,
	type ConversationTimelineScheduleFrame,
} from '../../browser/conversationTimelineScheduler.js';
import type { ViewEffect } from '../../../../../platform/universeAgent/common/sessionView/index.js';

function sendFailed(id: string): ViewEffect {
	return { effectId: id as ViewEffect['effectId'], kind: 'send_failed', message: 'send failed' };
}

function manualFrame(): { schedule: ConversationTimelineScheduleFrame; run: () => void; scheduled: () => number } {
	let pending: (() => void) | undefined;
	let scheduled = 0;
	return {
		schedule: (run) => {
			scheduled++;
			pending = run;
			return {
				cancel() {
					pending = undefined;
				},
			};
		},
		run() {
			const current = pending;
			pending = undefined;
			current?.();
		},
		scheduled: () => scheduled,
	};
}

suite('ConversationTimelineFrameScheduler', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('several patches in one frame flush once with the union of changedIds', () => {
		const flushes: ConversationTimelineFlush[] = [];
		const frame = manualFrame();
		const scheduler = disposables.add(new ConversationTimelineFrameScheduler(flush => flushes.push(flush), frame.schedule));
		scheduler.push({ kind: 'patches', changedIds: new Set(['a']) });
		scheduler.push({ kind: 'patches', changedIds: new Set(['b']) });
		scheduler.push({ kind: 'patches', changedIds: new Set(['a', 'c']) });
		assert.deepStrictEqual(flushes, []);
		assert.strictEqual(frame.scheduled(), 1);

		frame.run();
		assert.deepStrictEqual(flushes, [{
			applied: { kind: 'patches', changedIds: new Set(['a', 'b', 'c']) },
			sidecar: false,
			effects: [],
		}]);
	});

	test('patches, effects, and baseline flush once as a baseline', () => {
		const flushes: ConversationTimelineFlush[] = [];
		const frame = manualFrame();
		const effect = sendFailed('e1');
		const scheduler = disposables.add(new ConversationTimelineFrameScheduler(flush => flushes.push(flush), frame.schedule));
		scheduler.push({ kind: 'patches', changedIds: new Set(['a1']) });
		scheduler.push({ kind: 'effects', effects: [effect] });
		scheduler.push({ kind: 'baseline' });
		assert.deepStrictEqual(flushes, []);

		frame.run();
		assert.deepStrictEqual(flushes, [{
			applied: { kind: 'baseline' },
			sidecar: false,
			effects: [effect],
		}]);
	});

	test('16ms fallback flushes a patch without an animation frame', async () => {
		const flushes: ConversationTimelineFlush[] = [];
		const scheduler = disposables.add(new ConversationTimelineFrameScheduler(flush => flushes.push(flush)));
		scheduler.push({ kind: 'patches', changedIds: new Set(['a']) });
		await timeout(40);
		assert.deepStrictEqual(flushes, [{
			applied: { kind: 'patches', changedIds: new Set(['a']) },
			sidecar: false,
			effects: [],
		}]);
	});

	test('markSidecarDirty alone flushes a sidecar-only batch', () => {
		const flushes: ConversationTimelineFlush[] = [];
		const frame = manualFrame();
		const scheduler = disposables.add(new ConversationTimelineFrameScheduler(flush => flushes.push(flush), frame.schedule));
		scheduler.markSidecarDirty();
		assert.deepStrictEqual(flushes, []);

		frame.run();
		assert.deepStrictEqual(flushes, [{
			applied: undefined,
			sidecar: true,
			effects: [],
		}]);
	});

	test('baseline does not drop effects pushed earlier in the same window', () => {
		const flushes: ConversationTimelineFlush[] = [];
		const frame = manualFrame();
		const earlier = sendFailed('e1');
		const later = sendFailed('e2');
		const scheduler = disposables.add(new ConversationTimelineFrameScheduler(flush => flushes.push(flush), frame.schedule));
		scheduler.push({ kind: 'effects', effects: [earlier] });
		scheduler.push({ kind: 'baseline' });
		scheduler.push({ kind: 'effects', effects: [later] });
		assert.deepStrictEqual(flushes, []);
		assert.strictEqual(frame.scheduled(), 1);

		frame.run();
		assert.deepStrictEqual(flushes, [{
			applied: { kind: 'baseline' },
			sidecar: false,
			effects: [earlier, later],
		}]);
	});
});
