/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationSessionsInlineFilter.css';
import * as dom from '../../../../base/browser/dom.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';

const $ = dom.$;

export class ConversationSessionsInlineFilterBox extends Disposable {

	static readonly HEIGHT = 32;

	readonly element: HTMLElement;
	private readonly input: HTMLInputElement;
	private readonly clearButton: HTMLElement;

	private readonly _onDidChange = this._register(new Emitter<string>());
	readonly onDidChange = this._onDidChange.event;

	/**
	 * @param focusList Moves focus into the list: `first` focuses the first row, `current` keeps the list's
	 * focused row. Returns false when the list cannot take focus.
	 */
	constructor(parent: HTMLElement, placeholder: string, ariaLabel: string, focusList?: (target: 'first' | 'current') => boolean) {
		super();

		this.element = dom.append(parent, $('.conversation-sessions-inline-filter'));
		const icon = dom.append(this.element, $('.conversation-sessions-inline-filter-icon'));
		icon.appendChild(renderIcon(Codicon.search));

		this.input = dom.append(this.element, $('input.conversation-sessions-inline-filter-input')) as HTMLInputElement;
		this.input.type = 'text';
		this.input.placeholder = placeholder;
		this.input.setAttribute('aria-label', ariaLabel);

		const clearLabel = localize('conversationSessions.clearFilter', "Clear filter");
		this.clearButton = dom.append(this.element, $('button.conversation-sessions-inline-filter-clear'));
		this.clearButton.setAttribute('type', 'button');
		this.clearButton.setAttribute('aria-label', clearLabel);
		this.clearButton.title = clearLabel;
		this.clearButton.appendChild(renderIcon(Codicon.close));

		this._register(dom.addStandardDisposableListener(this.input, 'input', () => {
			this.updateClearVisibility();
			this._onDidChange.fire(this.input.value);
		}));
		this._register(dom.addStandardDisposableListener(this.input, 'keydown', e => {
			if (e.keyCode === KeyCode.Escape && this.input.value) {
				e.preventDefault();
				this.input.value = '';
				this.updateClearVisibility();
				this._onDidChange.fire('');
			} else if (e.keyCode === KeyCode.Escape && focusList?.('current')) {
				e.preventDefault();
				e.stopPropagation();
			} else if (e.keyCode === KeyCode.DownArrow && focusList?.('first')) {
				e.preventDefault();
				e.stopPropagation();
			}
		}));

		this._register(dom.addStandardDisposableListener(this.clearButton, 'click', (e) => {
			dom.EventHelper.stop(e, true);
			if (this.input.value) {
				this.input.value = '';
				this.updateClearVisibility();
				this._onDidChange.fire('');
			}
			this.input.focus();
		}));
	}

	get value(): string {
		return this.input.value;
	}

	setVisible(visible: boolean): void {
		this.element.hidden = !visible;
	}

	focus(): void {
		this.input.focus();
	}

	private updateClearVisibility(): void {
		this.element.classList.toggle('has-text', this.input.value.length > 0);
	}

	override dispose(): void {
		this.element.remove();
		super.dispose();
	}
}
