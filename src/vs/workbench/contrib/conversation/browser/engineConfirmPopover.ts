/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, addStandardDisposableListener, append } from '../../../../base/browser/dom.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { AnchorPosition } from '../../../../base/common/layout.js';
import { DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IContextViewService, IOpenContextView } from '../../../../platform/contextview/browser/contextView.js';
import { getContextViewEventTarget, isContextViewClick } from './conversationContextViewEvent.js';

const engineConfirmCancel = localize('ua.engineConfirmCancel', "Cancel");

export interface IEngineConfirmPopoverOptions {
	readonly contextViewService: IContextViewService;
	readonly anchor: HTMLElement;
	readonly message: string;
	readonly detail?: string;
	readonly confirmLabel: string;
	/** Destructive confirms focus Cancel. Other confirms focus the primary button. */
	readonly danger?: boolean;
}

let openConfirm: IOpenContextView | undefined;

/** Anchored confirm. Replaces the native message box for engine catalog writes. */
export function showEngineConfirmPopover(options: IEngineConfirmPopoverOptions): Promise<boolean> {
	openConfirm?.close();
	return new Promise(resolve => {
		let settled = false;
		const finish = (confirmed: boolean) => {
			if (settled) {
				return;
			}
			settled = true;
			resolve(confirmed);
		};
		const danger = options.danger !== false;
		const view = options.contextViewService.showContextView({
			getAnchor: () => options.anchor,
			anchorAlignment: AnchorAlignment.RIGHT,
			anchorPosition: AnchorPosition.BELOW,
			render: container => {
				const popup = append(container, $('.engine-confirm-popover'));
				popup.tabIndex = -1;
				popup.setAttribute('role', 'dialog');
				popup.setAttribute('aria-label', options.message);
				const message = append(popup, $('p.engine-confirm-popover-message'));
				message.textContent = options.message;
				if (options.detail) {
					const detail = append(popup, $('p.engine-confirm-popover-detail'));
					detail.textContent = options.detail;
				}
				const actions = append(popup, $('.engine-confirm-popover-actions'));
				const cancel = append(actions, $('button.engine-confirm-popover-cancel')) as HTMLButtonElement;
				cancel.type = 'button';
				cancel.textContent = engineConfirmCancel;
				const confirm = append(actions, $('button.engine-confirm-popover-confirm')) as HTMLButtonElement;
				confirm.type = 'button';
				confirm.textContent = options.confirmLabel;
				if (danger) {
					confirm.classList.add('is-danger');
				}
				const store = new DisposableStore();
				const close = (confirmed: boolean) => {
					finish(confirmed);
					view.close();
				};
				store.add(addDisposableListener(cancel, 'click', event => {
					event.preventDefault();
					close(false);
				}));
				store.add(addDisposableListener(confirm, 'click', event => {
					event.preventDefault();
					close(true);
				}));
				store.add(addStandardDisposableListener(popup.ownerDocument, 'keydown', event => {
					if (event.keyCode !== KeyCode.Escape) {
						return;
					}
					event.preventDefault();
					event.stopPropagation();
					close(false);
				}, true));
				(danger ? cancel : confirm).focus();
				return toDisposable(() => {
					store.dispose();
					finish(false);
				});
			},
			onDOMEvent: event => {
				if (!isContextViewClick(event)) {
					return;
				}
				const target = getContextViewEventTarget(event);
				if (target && !options.anchor.contains(target) && !target.closest('.engine-confirm-popover')) {
					finish(false);
					view.close();
				}
			},
			onHide: () => {
				if (openConfirm === view) {
					openConfirm = undefined;
				}
				finish(false);
			},
		});
		openConfirm = view;
	});
}
