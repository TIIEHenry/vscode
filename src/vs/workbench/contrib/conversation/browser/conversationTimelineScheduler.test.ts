/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	ConversationTimelineFrameScheduler,
	type ConversationTimelineFlush,
	type ConversationTimelineScheduleFrame,
} from './conversationTimelineScheduler.js';
import type { ViewEffect } from '../../../../platform/universeAgent/common/sessionView/index.js';

function sendFailed(id: string): ViewEffect {
	return { effectId: id as ViewEffect['effectId'], kind: 'send_failed', message: 'send failed' };
}

function manualFrame(): { schedule: ConversationTimelineScheduleFrame; run: () => void } {
	let pending: (() => void) | undefined;
	return {
		schedule: (run) => {
			pending = run;
			return { cancel() { pending = undefined; } };
		},
		run() {
			const current = pending;
			pending = undefined;
			current?.();
		},
	};
}

suite('conversationTimelineScheduler (browser)', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('empty patch coalesced with effects leaves applied unset so effects are not dropped downstream', () => {
		const flushes: ConversationTimelineFlush[] = [];
		const frame = manualFrame();
		const effect = sendFailed('e1');
		const scheduler = disposables.add(new ConversationTimelineFrameScheduler(flush => flushes.push(flush), frame.schedule));
		scheduler.push({ kind: 'patches', changedIds: new Set<string>() });
		scheduler.push({ kind: 'effects', effects: [effect] });

		frame.run();
		assert.deepStrictEqual(flushes, [{
			applied: undefined,
			sidecar: false,
			effects: [effect],
		}]);
	});
});
