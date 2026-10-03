/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable, Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { IObservable, observableValue } from '../../../../base/common/observable.js';

/**
 * Host services the pulse model needs. The delay lives in {@link schedule} so
 * tests can fire it without waiting, and so a replaced request can cancel the
 * previous wait by disposing the returned handle.
 */
export interface INewSessionTourPulseHost {
	isEligible(): boolean;
	hasBeenShown(): boolean;
	isSessionVisible(sessionId: string): boolean;
	schedule(callback: () => void): IDisposable;
}

/**
 * Decides when the New Session button should pulse.
 *
 * A request arms one wait. The pulse starts only if that session is still in
 * the visible grid when the wait ends. It ends, without starting the tour,
 * when that session leaves the grid, and that wait is cancelled so coming
 * back does not resume it. Another session's request drops the current pulse
 * immediately and waits again; a follow-up in the same still-visible session
 * keeps a pulse that is already showing, but leaving before the restarted
 * wait ends does not bring it back. Crossing the eligibility gate, or
 * learning the tour was shown, cancels both the wait and the pulse so a late
 * callback cannot light the button.
 */
export class NewSessionTourPulseModel extends Disposable {
	private readonly _trigger = observableValue<boolean>(this, false);
	readonly signal: IObservable<boolean> = this._trigger;

	private readonly _pending = this._register(new MutableDisposable());
	private _watchedSessionId: string | undefined;
	private _pulsingSessionId: string | undefined;

	constructor(
		private readonly _host: INewSessionTourPulseHost,
		private readonly _onPulse: (sessionId: string | undefined) => void,
	) {
		super();
	}

	get pulsingSessionId(): string | undefined {
		return this._pulsingSessionId;
	}

	onWillSendRequest(sessionId: string): void {
		if (this._trigger.get() || this._host.hasBeenShown() || !this._host.isEligible()) {
			this._stop();
			return;
		}

		// The latest request owns the nudge. A different session must not keep
		// the previous button pulse while its own wait is running.
		if (this._pulsingSessionId && (this._pulsingSessionId !== sessionId || !this._host.isSessionVisible(sessionId))) {
			this._notify(undefined);
		}
		this._watchedSessionId = sessionId;
		this._pending.value = this._host.schedule(() => {
			this._pending.clear();
			this._tryStart(sessionId);
		});
	}

	/** End the pulse when it can no longer show, and cancel its wait so it does not resume. */
	reevaluate(): void {
		const sessionId = this._pulsingSessionId;
		if (!sessionId || this._canShow(sessionId)) {
			return;
		}
		this._notify(undefined);
		if (this._watchedSessionId === sessionId) {
			this._watchedSessionId = undefined;
			this._pending.clear();
		}
	}

	/** The button is not rendered, so there is nothing to pulse. */
	releaseUnshown(): void {
		if (this._pulsingSessionId) {
			this._notify(undefined);
		}
	}

	accept(): void {
		if (this._trigger.get()) {
			return;
		}
		this._pending.clear();
		this._watchedSessionId = undefined;
		this._notify(undefined);
		this._trigger.set(true, undefined);
	}

	private _tryStart(sessionId: string): void {
		if (this._watchedSessionId !== sessionId || this._trigger.get()) {
			return;
		}
		if (!this._canShow(sessionId)) {
			if (this._pulsingSessionId === sessionId) {
				this._notify(undefined);
			}
			return;
		}
		if (this._pulsingSessionId === sessionId) {
			return;
		}
		this._notify(sessionId);
	}

	private _canShow(sessionId: string): boolean {
		return !this._trigger.get()
			&& !this._host.hasBeenShown()
			&& this._host.isEligible()
			&& this._host.isSessionVisible(sessionId);
	}

	private _stop(): void {
		this._watchedSessionId = undefined;
		this._pending.clear();
		this._notify(undefined);
	}

	private _notify(sessionId: string | undefined): void {
		if (this._pulsingSessionId === sessionId) {
			return;
		}
		this._pulsingSessionId = sessionId;
		this._onPulse(sessionId);
	}
}
