/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { EventType as GestureEventType } from '../../../../../base/browser/touch.js';
import { IDisposable } from '../../../../../base/common/lifecycle.js';
import { constObservable, observableValue } from '../../../../../base/common/observable.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IActiveSession } from '../../../../services/sessions/common/sessionsManagement.js';
import { ISessionsService } from '../../../../services/sessions/browser/sessionsService.js';
import { watchNewSessionTourActivation } from '../../browser/newSessionTourActivation.js';

suite('NewSessionTourActivation', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('starts on the gesture tap the button emits, not a literal tap event', () => {
		const target = document.createElement('a');
		const activations = recordActivations(target, createdSession(), disposables);

		target.dispatchEvent(new CustomEvent('tap'));
		const literalTap = activations.count;
		target.dispatchEvent(new CustomEvent(GestureEventType.Tap));
		const gestureTap = activations.count - literalTap;

		assert.deepStrictEqual({ literalTap, gestureTap }, { literalTap: 0, gestureTap: 1 });
	});

	test('starts on Enter or Space the way the button activates, and ignores other keys', () => {
		const target = document.createElement('a');
		const activations = recordActivations(target, createdSession(), disposables);

		dispatchKey(target, 65);
		const letter = activations.count;
		dispatchKey(target, 13, { shiftKey: true });
		const shiftEnter = activations.count;
		dispatchKey(target, 13);
		const enter = activations.count;

		const second = recordActivations(document.createElement('a'), createdSession(), disposables);
		dispatchKey(second.target, 32);
		second.target.classList.add('disabled');
		second.target.setAttribute('aria-disabled', 'true');
		dispatchKey(second.target, 13);
		second.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		assert.deepStrictEqual({
			letter,
			shiftEnter,
			enter,
			space: second.count,
		}, {
			letter: 0,
			shiftEnter: 0,
			enter: 1,
			space: 1,
		});
	});

	test('starts when the New Session command opens the new-session view while the pulse is showing', () => {
		const activeSession = observableValue<IActiveSession | undefined>('activeSession', createdSession());
		const target = document.createElement('a');
		const activations = recordActivations(target, activeSession, disposables);

		const initial = activations.count;
		activeSession.set(createdSession(), undefined);
		const switchedCreatedSession = activations.count;
		activeSession.set(quickChatSession(), undefined);
		const openedQuickChat = activations.count;
		activeSession.set(draftSession(), undefined);
		const openedNewSession = activations.count;

		const alreadyThere = observableValue<IActiveSession | undefined>('alreadyThere', undefined);
		const staying = recordActivations(document.createElement('a'), alreadyThere, disposables);
		alreadyThere.set(draftSession(), undefined);

		assert.deepStrictEqual({
			initial,
			switchedCreatedSession,
			openedQuickChat,
			openedNewSession,
			alreadyShowingNewSession: staying.count,
		}, {
			initial: 0,
			switchedCreatedSession: 0,
			openedQuickChat: 0,
			openedNewSession: 1,
			alreadyShowingNewSession: 0,
		});
	});

	test('still starts on a click, including when that click disposes the watcher', () => {
		const target = document.createElement('a');
		let activations = 0;
		const watcher = watchNewSessionTourActivation(target, sessions(observableValue('active', createdSession())), () => {
			activations++;
			watcher.dispose();
		});
		disposables.add(watcher);

		target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		target.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		assert.strictEqual(activations, 1);
	});

	test('starts once when opening the new-session view disposes the watcher', () => {
		const activeSession = observableValue<IActiveSession | undefined>('activeSession', createdSession());
		const holder: { watcher?: IDisposable } = {};
		let activations = 0;
		holder.watcher = watchNewSessionTourActivation(document.createElement('a'), sessions(activeSession), () => {
			activations++;
			holder.watcher?.dispose();
		});
		disposables.add(holder.watcher);

		activeSession.set(draftSession(), undefined);
		activeSession.set(createdSession(), undefined);
		activeSession.set(undefined, undefined);

		assert.strictEqual(activations, 1);
	});
});

function recordActivations(target: HTMLElement, activeSession: IActiveSession | ReturnType<typeof observableValue<IActiveSession | undefined>>, store: { add<T extends IDisposable>(disposable: T): T }): { readonly target: HTMLElement; get count(): number } {
	const active = 'read' in (activeSession as object) ? activeSession as ReturnType<typeof observableValue<IActiveSession | undefined>> : observableValue<IActiveSession | undefined>('active', activeSession as IActiveSession);
	let count = 0;
	store.add(watchNewSessionTourActivation(target, sessions(active), () => count++));
	return {
		target,
		get count() { return count; },
	};
}

function sessions(activeSession: ReturnType<typeof observableValue<IActiveSession | undefined>>): ISessionsService {
	return new class extends mock<ISessionsService>() {
		override readonly activeSession = activeSession;
	}();
}

function createdSession(): IActiveSession {
	return new class extends mock<IActiveSession>() {
		override readonly isCreated = constObservable(true);
	}();
}

function draftSession(): IActiveSession {
	return new class extends mock<IActiveSession>() {
		override readonly isCreated = constObservable(false);
	}();
}

function quickChatSession(): IActiveSession {
	return new class extends mock<IActiveSession>() {
		override readonly isCreated = constObservable(false);
		override readonly isQuickChat = constObservable(true);
	}();
}

function dispatchKey(target: HTMLElement, keyCode: number, init: KeyboardEventInit = {}): void {
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
	Object.defineProperty(event, 'keyCode', { get: () => keyCode });
	target.dispatchEvent(event);
}
