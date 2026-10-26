/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, getActiveElement, getWindow, isHTMLElement } from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { getConversationPermissionRespondBlockedLabel, getConversationPermissionSeatAriaLabel } from './conversationAccessibility.js';
import { conversationLensDockSendBusy } from './conversationLensDockStrings.js';
import { ConfirmationStatus } from './conversationStubModel.js';

export interface IConversationConfirmationSeatOptions {
	readonly message: string;
	readonly status: ConfirmationStatus;
	/** Bounded argument preview. Omitted from the seat when absent or blank. */
	readonly detail?: string;
	readonly onAllow?: () => void;
	readonly onSkip?: () => void;
	/** When false, Allow/Skip stay visible but aria-disabled (D297 pairing-hold). */
	readonly writesEnabled?: boolean;
	/**
	 * A decision was already posted and the snapshot still says pending.
	 * Buttons stay visible and disabled until that snapshot moves on.
	 */
	readonly responseInFlight?: boolean;
	/** Uplink failed. `retryable: false` hides Allow/Skip; the error stays visible. */
	readonly respondFailure?: { readonly retryable: boolean; readonly error: string };
}

export interface IConversationOptionGroupKeysOptions {
	readonly role?: 'radio';
	readonly initialIndex?: number;
	readonly onSelect?: (index: number) => void;
	readonly onActivate?: (index: number) => void;
}

/**
 * Roving tabindex + arrow keys for a permission toolbar or question radiogroup.
 * Does not invent answers: the caller supplies the option elements.
 */
export function wireConversationSeatOptionKeys(
	elements: readonly HTMLElement[],
	disposables: DisposableStore,
	options?: IConversationOptionGroupKeysOptions,
): void {
	if (elements.length === 0) {
		return;
	}

	let selected = 0;
	const apply = (index: number): void => {
		selected = index;
		elements.forEach((el, i) => {
			el.tabIndex = i === selected ? 0 : -1;
			if (options?.role === 'radio') {
				el.setAttribute('aria-checked', i === selected ? 'true' : 'false');
			}
		});
		options?.onSelect?.(selected);
	};
	apply(options?.initialIndex ?? 0);

	elements.forEach((el, i) => {
		disposables.add(addDisposableListener(el, 'focus', () => {
			if (selected !== i) {
				apply(i);
			}
		}));
		disposables.add(addDisposableListener(el, 'keydown', e => {
			const standard = new StandardKeyboardEvent(e);
			if (standard.equals(KeyCode.RightArrow) || standard.equals(KeyCode.DownArrow)) {
				standard.preventDefault();
				standard.stopPropagation();
				const next = (selected + 1) % elements.length;
				apply(next);
				elements[next].focus();
				return;
			}
			if (standard.equals(KeyCode.LeftArrow) || standard.equals(KeyCode.UpArrow)) {
				standard.preventDefault();
				standard.stopPropagation();
				const next = (selected - 1 + elements.length) % elements.length;
				apply(next);
				elements[next].focus();
				return;
			}
			if (options?.onActivate && (standard.equals(KeyCode.Enter) || standard.equals(KeyCode.Space))) {
				standard.preventDefault();
				standard.stopPropagation();
				apply(i);
				options.onActivate(i);
			}
		}));
		if (options?.onActivate) {
			disposables.add(addDisposableListener(el, 'click', () => {
				apply(i);
				options.onActivate!(i);
			}));
		}
	});
}

const OVERLAY_FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], iframe, [tabindex]:not([tabindex="-1"])';

function isOverlayFocusable(container: HTMLElement, element: HTMLElement): boolean {
	if (!element.isConnected || element.getAttribute('aria-hidden') === 'true' || element.tabIndex === -1 || element.hasAttribute('disabled')) {
		return false;
	}
	const style = getWindow(container).getComputedStyle(element);
	return style.display !== 'none' && style.visibility !== 'hidden';
}

/** Focusable controls inside an overlay, in DOM order. */
export function collectConversationOverlayFocusable(container: HTMLElement): HTMLElement[] {
	// eslint-disable-next-line no-restricted-syntax -- overlay owns this subtree
	return [...container.querySelectorAll<HTMLElement>(OVERLAY_FOCUSABLE)].filter(element => isOverlayFocusable(container, element));
}

/**
 * Cycle Tab / Shift+Tab inside `container` so focus does not leak to the workbench.
 * Returns true when the event was handled.
 */
export function handleConversationOverlayTab(container: HTMLElement, event: KeyboardEvent): boolean {
	const standard = new StandardKeyboardEvent(event);
	if (!standard.equals(KeyCode.Tab) && !standard.equals(KeyMod.Shift | KeyCode.Tab)) {
		return false;
	}

	const focusable = collectConversationOverlayFocusable(container);
	event.preventDefault();
	event.stopPropagation();

	if (focusable.length === 0) {
		if (container.tabIndex < 0) {
			container.tabIndex = 0;
		}
		container.focus();
		return true;
	}

	const active = getActiveElement();
	const currentIndex = isHTMLElement(active)
		? focusable.findIndex(element => element === active || element.contains(active))
		: -1;
	let nextIndex: number;
	if (currentIndex === -1) {
		nextIndex = standard.shiftKey ? focusable.length - 1 : 0;
	} else {
		const delta = standard.shiftKey ? -1 : 1;
		nextIndex = (currentIndex + delta + focusable.length) % focusable.length;
	}
	focusable[nextIndex].focus();
	return true;
}

/**
 * Remember the control that opened an overlay so closing it can return keyboard
 * focus to the same task context. The active element may be inside another
 * overlay while one is being replaced, so callers must capture after closing
 * any previous instance.
 */
export function captureConversationOverlayTrigger(container: HTMLElement): HTMLElement | undefined {
	const active = getActiveElement();
	if (!isHTMLElement(active) || active === container || container.contains(active) || active === active.ownerDocument.body || active === active.ownerDocument.documentElement) {
		return undefined;
	}
	return active;
}

/** Restore focus only while the overlay still owns focus and the trigger is usable. */
export function restoreConversationOverlayFocus(container: HTMLElement, trigger: HTMLElement | undefined): void {
	if (!trigger?.isConnected || trigger.hidden || !!trigger.closest('[hidden]')) {
		return;
	}
	const style = getWindow(trigger).getComputedStyle(trigger);
	if (style.display === 'none' || style.visibility === 'hidden') {
		return;
	}
	const active = getActiveElement();
	if (active !== container && !container.contains(active)) {
		return;
	}
	trigger.focus();
}

/**
 * Timeline permission seat (Allow / Skip, pending summary, Input needed).
 * Not ChatConfirmationWidget: no IChatModel, no engine, no Copilot setup.
 * Allow/Skip are a decision toolbar, not question answers — ask-user uses
 * ConversationQuestionSeat (different role/name; never reuse these buttons).
 */
export class ConversationConfirmationSeat extends Disposable {

	readonly element: HTMLElement;

	constructor(options: IConversationConfirmationSeatOptions) {
		super();

		const isPending = options.status === 'pending';
		const respondBlocked = isPending && options.respondFailure?.retryable === false;

		this.element = $('.conversation-lens-confirmation-seat');
		this.element.tabIndex = 0;
		this.element.setAttribute('role', 'group');
		this.element.setAttribute('aria-label', getConversationPermissionSeatAriaLabel(options.status, options.message, options.respondFailure));
		if (options.responseInFlight) {
			this.element.setAttribute('aria-busy', 'true');
		}

		const summary = append(this.element, $('.conversation-lens-confirmation-summary'));
		const pendingLabel = append(summary, $('span.conversation-lens-confirmation-pending'));
		if (isPending) {
			pendingLabel.textContent = localize('conversationLens.confirmationPending', "1 confirmation pending");
			if (respondBlocked) {
				append(summary, $('span.conversation-lens-confirmation-blocked')).textContent = getConversationPermissionRespondBlockedLabel();
			} else {
				append(summary, $('span.conversation-lens-input-needed')).textContent = localize('conversationLens.inputNeeded', "Input needed");
			}
		} else if (options.status === 'allowed') {
			pendingLabel.textContent = localize('conversationLens.confirmationAllowed', "Allowed");
		} else if (options.status === 'skipped') {
			pendingLabel.textContent = localize('conversationLens.confirmationSkipped', "Skipped");
		}

		append(this.element, $('p.conversation-lens-confirmation-message')).textContent = options.message;
		const detail = options.detail?.trim();
		if (detail) {
			append(this.element, $('pre.conversation-lens-confirmation-args')).textContent = detail;
		}
		if (isPending && options.respondFailure) {
			append(this.element, $('p.conversation-lens-confirmation-failure')).textContent = localize(
				'conversationLens.confirmationRespondFailed',
				"Couldn't send this response: {0}",
				options.respondFailure.error,
			);
		}

		const canRetry = !options.respondFailure || options.respondFailure.retryable;
		if (isPending && canRetry && options.onAllow && options.onSkip) {
			const actions = append(this.element, $('.conversation-lens-confirmation-actions'));
			actions.setAttribute('role', 'toolbar');
			actions.setAttribute('aria-label', localize('conversationLens.permissionDecision', "Permission decision"));
			const writesEnabled = options.writesEnabled !== false && options.responseInFlight !== true;
			const holdReason = options.responseInFlight
				? conversationLensDockSendBusy
				: (options.writesEnabled === false
					? localize('conversationLens.turnWritesUnavailable', "This session cannot be edited right now.")
					: undefined);
			const allowLabel = localize('conversationLens.allow', "Allow");
			const allow = this._register(new Button(actions, { ...defaultButtonStyles, ariaLabel: allowLabel }));
			allow.label = allowLabel;
			presentDecision(allow, allowLabel, writesEnabled, holdReason);

			const skipLabel = localize('conversationLens.skip', "Skip");
			const skip = this._register(new Button(actions, { ...defaultButtonStyles, secondary: true, ariaLabel: skipLabel }));
			skip.label = skipLabel;
			presentDecision(skip, skipLabel, writesEnabled, holdReason);

			// One activation posts once. A second click, or Enter plus the
			// synthesized click, must not send the same decision again while
			// this seat is still pending.
			let sent = false;
			const send = (run: () => void): void => {
				if (sent || !writesEnabled) {
					return;
				}
				sent = true;
				presentDecision(allow, allowLabel, false, conversationLensDockSendBusy);
				presentDecision(skip, skipLabel, false, conversationLensDockSendBusy);
				this.element.setAttribute('aria-busy', 'true');
				run();
			};
			this._register(allow.onDidClick(() => send(() => options.onAllow!())));
			this._register(skip.onDidClick(() => send(() => options.onSkip!())));

			const keys = this._register(new DisposableStore());
			wireConversationSeatOptionKeys([allow.element, skip.element], keys);
		}
	}
}

function presentDecision(button: Button, label: string, enabled: boolean, holdReason: string | undefined): void {
	button.enabled = enabled;
	const presented = !enabled && holdReason ? `${label}. ${holdReason}` : label;
	button.setTitle(presented);
	button.setAriaLabel(presented);
}
