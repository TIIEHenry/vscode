/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/explorerInlineFilter.css';
import * as dom from '../../../../base/browser/dom.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Emitter } from '../../../../base/common/event.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';

const $ = dom.$;

export class ExplorerInlineFilterBox extends Disposable {

	static readonly HEIGHT = 28;

	readonly element: HTMLElement;
	private readonly input: HTMLInputElement;
	private readonly clearButton: HTMLButtonElement;

	private readonly _onDidChange = this._register(new Emitter<string>());
	readonly onDidChange = this._onDidChange.event;

	constructor(parent: HTMLElement, placeholder: string, ariaLabel: string, private readonly focusList?: (first: boolean) => boolean) {
		super();

		this.element = dom.append(parent, $('.explorer-inline-filter'));
		const icon = dom.append(this.element, $('.explorer-inline-filter-icon'));
		icon.appendChild(renderIcon(Codicon.search));

		this.input = dom.append(this.element, $('input.explorer-inline-filter-input')) as HTMLInputElement;
		this.input.type = 'text';
		this.input.placeholder = placeholder;
		this.input.setAttribute('aria-label', ariaLabel);

		const clearLabel = localize('explorerInlineFilter.clearFilter', "Clear filter");
		this.clearButton = dom.append(this.element, $('button.explorer-inline-filter-clear')) as HTMLButtonElement;
		this.clearButton.type = 'button';
		this.clearButton.title = clearLabel;
		this.clearButton.setAttribute('aria-label', clearLabel);
		this.clearButton.appendChild(renderIcon(Codicon.close));

		this._register(dom.addStandardDisposableListener(this.input, 'input', () => {
			this.updateClearVisibility();
			this._onDidChange.fire(this.input.value);
		}));

		this._register(dom.addStandardDisposableListener(this.input, 'keydown', e => {
			if (e.keyCode === KeyCode.Escape) {
				if (this.input.value) {
					e.preventDefault();
					this.input.value = '';
					this.updateClearVisibility();
					this._onDidChange.fire('');
				} else if (this.focusList?.(false)) {
					e.preventDefault();
					e.stopPropagation();
				}
			} else if (e.keyCode === KeyCode.DownArrow && this.focusList?.(true)) {
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

	focus(): void {
		this.input.focus();
	}

	private updateClearVisibility(): void {
		this.element.classList.toggle('has-text', this.input.value.length > 0);
	}
}
