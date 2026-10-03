/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { IDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { INewSessionTourPulseHost, NewSessionTourPulseModel } from '../../browser/newSessionTourPulse.js';

suite('NewSessionTourPulse', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('ends the pulse when that session leaves the grid, without starting the tour', () => {
		const harness = trackPulse(disposables);
		harness.model.onWillSendRequest('session-a');
		harness.clock.fireNext();

		harness.visible.delete('session-a');
		harness.model.reevaluate();
		harness.visible.add('session-a');
		harness.model.reevaluate();
		harness.clock.fireNext();

		assert.deepStrictEqual({
			pulses: harness.pulses,
			pulsing: harness.model.pulsingSessionId,
			pending: harness.clock.pending,
			signal: harness.model.signal.get(),
		}, {
			pulses: ['session-a', undefined],
			pulsing: undefined,
			pending: 0,
			signal: false,
		});
	});

	test('still pulses when the session leaves and returns before its own wait ends', () => {
		const harness = trackPulse(disposables);
		harness.model.onWillSendRequest('session-a');
		harness.visible.delete('session-a');
		harness.model.reevaluate();
		harness.visible.add('session-a');
		harness.clock.fireNext();

		assert.deepStrictEqual({
			pulses: harness.pulses,
			pulsing: harness.model.pulsingSessionId,
			signal: harness.model.signal.get(),
		}, {
			pulses: ['session-a'],
			pulsing: 'session-a',
			signal: false,
		});
	});

	test('a different session drops the current pulse and only pulses if it is still visible after its own wait', () => {
		const harness = trackPulse(disposables);
		harness.model.onWillSendRequest('session-a');
		harness.clock.fireNext();

		harness.model.onWillSendRequest('session-b');
		const whileWaiting = harness.pulses.slice();
		harness.visible.delete('session-b');
		harness.clock.fireNext();
		const leftBeforeWaitEnded = harness.pulses.slice();

		harness.visible.add('session-c');
		harness.model.onWillSendRequest('session-c');
		harness.clock.fireNext();

		assert.deepStrictEqual({
			whileWaiting,
			leftBeforeWaitEnded,
			pulses: harness.pulses,
			signal: harness.model.signal.get(),
		}, {
			whileWaiting: ['session-a', undefined],
			leftBeforeWaitEnded: ['session-a', undefined],
			pulses: ['session-a', undefined, 'session-c'],
			signal: false,
		});
	});

	test('keeps the pulse for a follow-up in the same session that is still visible', () => {
		const harness = trackPulse(disposables);
		harness.model.onWillSendRequest('session-a');
		harness.clock.fireNext();

		harness.model.onWillSendRequest('session-a');
		const duringRestartedWait = harness.pulses.slice();
		harness.clock.fireNext();

		assert.deepStrictEqual({
			duringRestartedWait,
			pulses: harness.pulses,
			pulsing: harness.model.pulsingSessionId,
		}, {
			duringRestartedWait: ['session-a'],
			pulses: ['session-a'],
			pulsing: 'session-a',
		});
	});

	test('does not bring the pulse back when that session leaves during the restarted wait and returns', () => {
		const harness = trackPulse(disposables);
		harness.model.onWillSendRequest('session-a');
		harness.clock.fireNext();
		harness.model.onWillSendRequest('session-a');

		harness.visible.delete('session-a');
		harness.model.reevaluate();
		harness.visible.add('session-a');
		harness.clock.fireNext();

		assert.deepStrictEqual({
			pulses: harness.pulses,
			pulsing: harness.model.pulsingSessionId,
			pending: harness.clock.pending,
			signal: harness.model.signal.get(),
		}, {
			pulses: ['session-a', undefined],
			pulsing: undefined,
			pending: 0,
			signal: false,
		});
	});

	test('cancels a pending pulse once the user is past the eligibility gate', () => {
		const harness = trackPulse(disposables);
		harness.model.onWillSendRequest('session-a');
		harness.eligible = false;
		harness.model.onWillSendRequest('session-a');
		harness.clock.fireNext();

		harness.eligible = true;
		harness.model.onWillSendRequest('session-b');
		harness.clock.fireNext();
		harness.eligible = false;
		harness.model.onWillSendRequest('session-c');

		assert.deepStrictEqual({
			pulses: harness.pulses,
			pending: harness.clock.pending,
			signal: harness.model.signal.get(),
		}, {
			pulses: ['session-b', undefined],
			pending: 0,
			signal: false,
		});
	});

	test('accepting still starts the tour once and does not pulse again', () => {
		const harness = trackPulse(disposables);
		harness.model.onWillSendRequest('session-a');
		harness.clock.fireNext();
		harness.model.accept();
		harness.model.accept();
		harness.model.onWillSendRequest('session-b');
		harness.clock.fireNext();

		assert.deepStrictEqual({
			pulses: harness.pulses,
			pending: harness.clock.pending,
			signal: harness.model.signal.get(),
		}, {
			pulses: ['session-a', undefined],
			pending: 0,
			signal: true,
		});
	});
});

interface IPulseHarness {
	readonly model: NewSessionTourPulseModel;
	readonly clock: ManualPulseClock;
	readonly visible: Set<string>;
	readonly pulses: (string | undefined)[];
	eligible: boolean;
}

function trackPulse(store: { add<T extends IDisposable>(disposable: T): T }): IPulseHarness {
	const clock = new ManualPulseClock();
	const visible = new Set<string>(['session-a', 'session-b', 'session-c']);
	const pulses: (string | undefined)[] = [];
	const state = { eligible: true, shown: false };
	const host: INewSessionTourPulseHost = {
		isEligible: () => state.eligible,
		hasBeenShown: () => state.shown,
		isSessionVisible: sessionId => visible.has(sessionId),
		schedule: callback => clock.schedule(callback),
	};
	const model = store.add(new NewSessionTourPulseModel(host, sessionId => pulses.push(sessionId)));
	return {
		model,
		clock,
		visible,
		pulses,
		get eligible() { return state.eligible; },
		set eligible(value: boolean) { state.eligible = value; },
	};
}

class ManualPulseClock {
	private readonly _entries = new Map<number, () => void>();
	private _nextId = 1;

	get pending(): number {
		return this._entries.size;
	}

	schedule(callback: () => void): IDisposable {
		const id = this._nextId++;
		this._entries.set(id, callback);
		return toDisposable(() => this._entries.delete(id));
	}

	fireNext(): void {
		const next = this._entries.keys().next();
		if (next.done) {
			return;
		}
		const callback = this._entries.get(next.value);
		this._entries.delete(next.value);
		callback?.();
	}
}
