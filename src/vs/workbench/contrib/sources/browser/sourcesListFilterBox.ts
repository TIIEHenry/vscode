/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sourcesListFilter.css';
import * as dom from '../../../../base/browser/dom.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';

const $ = dom.$;

export class SourcesListFilterBox extends Disposable {

	readonly element: HTMLElement;
	private readonly input: HTMLInputElement;
	private readonly clearButton: HTMLButtonElement;

	private readonly _onDidChange = this._register(new Emitter<string>());
	readonly onDidChange = this._onDidChange.event;
	private dockHome: { parent: HTMLElement; next: ChildNode | null } | undefined;

	constructor(parent: HTMLElement, placeholder: string, ariaLabel: string) {
		super();

		this.element = dom.append(parent, $('.sources-list-filter'));

		const icon = dom.append(this.element, $('.sources-list-filter-icon'));
		icon.appendChild(renderIcon(Codicon.search));

		this.input = dom.append(this.element, $('input.sources-list-filter-input')) as HTMLInputElement;
		this.input.type = 'text';
		this.input.placeholder = placeholder;
		this.input.setAttribute('aria-label', ariaLabel);

		this.clearButton = dom.append(this.element, $('button.sources-list-filter-clear')) as HTMLButtonElement;
		this.clearButton.type = 'button';
		this.clearButton.setAttribute('aria-label', ariaLabel);
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
			}
		}));

		this._register(dom.addStandardDisposableListener(this.clearButton, 'click', e => {
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

	/** `undefined` returns the box to the panel it was built in. */
	dock(host: HTMLElement | undefined): void {
		if (host) {
			if (this.element.parentElement !== host) {
				if (this.element.parentElement) {
					this.dockHome = { parent: this.element.parentElement, next: this.element.nextSibling };
				}
				host.appendChild(this.element);
			}
			this.element.classList.add('is-docked');
			return;
		}
		this.element.classList.remove('is-docked');
		if (this.dockHome && this.element.parentElement !== this.dockHome.parent) {
			this.dockHome.parent.insertBefore(this.element, this.dockHome.next);
		}
	}

	setAvailable(available: boolean): void {
		this.element.style.display = available ? '' : 'none';
		this.element.classList.toggle('is-hidden', !available);
	}

	private updateClearVisibility(): void {
		this.element.classList.toggle('has-text', this.input.value.length > 0);
	}
}
