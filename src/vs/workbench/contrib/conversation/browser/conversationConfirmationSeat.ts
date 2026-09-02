/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, getActiveElement, getWindow } from '../../../../base/browser/dom.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { getConversationPermissionSeatAriaLabel } from './conversationAccessibility.js';
import { ConfirmationStatus } from './conversationStubModel.js';

export interface IConversationConfirmationSeatOptions {
	readonly message: string;
	readonly status: ConfirmationStatus;
	readonly onAllow?: () => void;
	readonly onSkip?: () => void;
}

export interface IConversationOptionGroupKeysOptions {
	readonly role?: 'radio';
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
	apply(0);

	elements.forEach((el, i) => {
		disposables.add(addDisposableListener(el, 'focus', () => {
			if (selected !== i) {
				apply(i);
			}
		}));
		disposables.add(addDisposableListener(el, 'keydown', e => {
			if (e.keyCode === KeyCode.RightArrow || e.keyCode === KeyCode.DownArrow) {
				e.preventDefault();
				e.stopPropagation();
				const next = (selected + 1) % elements.length;
				apply(next);
				elements[next].focus();
				return;
			}
			if (e.keyCode === KeyCode.LeftArrow || e.keyCode === KeyCode.UpArrow) {
				e.preventDefault();
				e.stopPropagation();
				const next = (selected - 1 + elements.length) % elements.length;
				apply(next);
				elements[next].focus();
				return;
			}
			if (options?.onActivate && (e.keyCode === KeyCode.Enter || e.keyCode === KeyCode.Space)) {
				e.preventDefault();
				e.stopPropagation();
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
	const currentIndex = active instanceof HTMLElement
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
 * Timeline permission seat (Allow / Skip, pending summary, Input needed).
 * Not ChatConfirmationWidget: no IChatModel, no engine, no Copilot setup.
 * Allow/Skip are a decision toolbar, not question answers.
 */
export class ConversationConfirmationSeat extends Disposable {

	readonly element: HTMLElement;

	constructor(options: IConversationConfirmationSeatOptions) {
		super();

		const isPending = options.status === 'pending';

		this.element = $('.conversation-lens-confirmation-seat');
		this.element.tabIndex = 0;
		this.element.setAttribute('role', 'group');
		this.element.setAttribute('aria-label', getConversationPermissionSeatAriaLabel(options.status, options.message));

		const summary = append(this.element, $('.conversation-lens-confirmation-summary'));
		const pendingLabel = append(summary, $('span.conversation-lens-confirmation-pending'));
		if (isPending) {
			pendingLabel.textContent = localize('conversationLens.confirmationPending', "1 confirmation pending");
			append(summary, $('span.conversation-lens-input-needed')).textContent = localize('conversationLens.inputNeeded', "Input needed");
		} else if (options.status === 'allowed') {
			pendingLabel.textContent = localize('conversationLens.confirmationAllowed', "Allowed");
		} else {
			pendingLabel.textContent = localize('conversationLens.confirmationSkipped', "Skipped");
		}

		append(this.element, $('p.conversation-lens-confirmation-message')).textContent = options.message;

		if (isPending && options.onAllow && options.onSkip) {
			const actions = append(this.element, $('.conversation-lens-confirmation-actions'));
			actions.setAttribute('role', 'toolbar');
			actions.setAttribute('aria-label', localize('conversationLens.permissionDecision', "Permission decision"));
			const allowLabel = localize('conversationLens.allow', "Allow");
			const allow = this._register(new Button(actions, { ...defaultButtonStyles, ariaLabel: allowLabel }));
			allow.label = allowLabel;
			this._register(allow.onDidClick(() => options.onAllow!()));

			const skipLabel = localize('conversationLens.skip', "Skip");
			const skip = this._register(new Button(actions, { ...defaultButtonStyles, secondary: true, ariaLabel: skipLabel }));
			skip.label = skipLabel;
			this._register(skip.onDidClick(() => options.onSkip!()));

			const keys = this._register(new DisposableStore());
			wireConversationSeatOptionKeys([allow.element, skip.element], keys);
		}
	}
}
