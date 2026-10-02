/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener, EventType } from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { EventType as GestureEventType } from '../../../../base/browser/touch.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { autorun } from '../../../../base/common/observable.js';
import { ISessionsService } from '../../../services/sessions/browser/sessionsService.js';

/**
 * Accepts the pulsing New Session nudge the same ways that control does.
 *
 * Touch delivers `-monaco-gesturetap` and suppresses the compatibility click,
 * so a listener for the literal name `tap` never runs. Enter and Space
 * activate a focused, enabled button without dispatching a click. The New
 * Session command never hits this element; arriving at the new-session view
 * from a created session counts instead. A pulse that is already on that
 * view, a switch between created sessions, and opening Quick Chat do not.
 */
export function watchNewSessionTourActivation(target: HTMLElement, sessionsService: ISessionsService, onActivate: () => void): IDisposable {
	const store = new DisposableStore();
	let activated = false;
	const activate = () => {
		if (activated) {
			return;
		}
		activated = true;
		onActivate();
	};
	const activateFromTarget = () => {
		if (target.classList.contains('disabled') || target.getAttribute('aria-disabled') === 'true') {
			return;
		}
		activate();
	};

	store.add(addDisposableListener(target, EventType.CLICK, () => activateFromTarget()));
	store.add(addDisposableListener(target, GestureEventType.Tap, () => activateFromTarget()));
	store.add(addDisposableListener(target, EventType.KEY_DOWN, event => {
		const keyboardEvent = new StandardKeyboardEvent(event);
		if (keyboardEvent.equals(KeyCode.Enter) || keyboardEvent.equals(KeyCode.Space)) {
			activateFromTarget();
		}
	}));

	// `undefined` means the pulse has not yet observed a view, so the view that
	// is already open when the pulse starts does not count as accepting it.
	let previousWasNewSessionView: boolean | undefined;
	store.add(autorun(reader => {
		const activeSession = sessionsService.activeSession.read(reader);
		const quickChat = !!activeSession && !!activeSession.isQuickChat?.read(reader);
		const newSessionViewOpen = !quickChat && (!activeSession || !activeSession.isCreated.read(reader));
		const previous = previousWasNewSessionView;
		previousWasNewSessionView = newSessionViewOpen;
		if (previous === false && newSessionViewOpen) {
			activate();
		}
	}));

	return store;
}
