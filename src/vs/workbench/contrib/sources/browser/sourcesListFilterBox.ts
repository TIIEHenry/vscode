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
import { List } from '../../../../base/browser/ui/list/listWidget.js';
import { localize } from '../../../../nls.js';

const $ = dom.$;

/**
 * Moves keyboard focus from a filter box into its list. `first` puts the list
 * focus on the first row; otherwise the current row is kept.
 */
export function focusSourcesListFromFilter<T>(list: List<T> | undefined, first: boolean): boolean {
	if (!list || list.length === 0 || list.getHTMLElement().offsetParent === null) {
		return false;
	}
	if (first || list.getFocus().length === 0) {
		list.setFocus([0]);
		list.reveal(0);
	}
	list.domFocus();
	return true;
}

export class SourcesListFilterBox extends Disposable {

	readonly element: HTMLElement;
	private readonly input: HTMLInputElement;
	private readonly clearButton: HTMLButtonElement;

	private readonly _onDidChange = this._register(new Emitter<string>());
	readonly onDidChange = this._onDidChange.event;
	private dockHome: { parent: HTMLElement; next: ChildNode | null } | undefined;

	/**
	 * @param focusList Escape on an empty box and Down hand focus to the list
	 * through this callback; it returns false when there is no list to enter.
	 */
	constructor(parent: HTMLElement, placeholder: string, ariaLabel: string, private readonly focusList?: (first: boolean) => boolean) {
		super();

		this.element = dom.append(parent, $('.sources-list-filter'));

		const icon = dom.append(this.element, $('.sources-list-filter-icon'));
		icon.appendChild(renderIcon(Codicon.search));

		this.input = dom.append(this.element, $('input.sources-list-filter-input')) as HTMLInputElement;
		this.input.type = 'text';
		this.input.placeholder = placeholder;
		this.input.setAttribute('aria-label', ariaLabel);

		const clearLabel = localize('sourcesListFilter.clearFilter', "Clear filter");
		this.clearButton = dom.append(this.element, $('button.sources-list-filter-clear')) as HTMLButtonElement;
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
					this.setValue('');
				} else if (this.focusList?.(false)) {
					e.preventDefault();
					e.stopPropagation();
				}
			} else if (e.keyCode === KeyCode.DownArrow && this.focusList?.(true)) {
				e.preventDefault();
				e.stopPropagation();
			}
		}));

		this._register(dom.addStandardDisposableListener(this.clearButton, 'click', e => {
			dom.EventHelper.stop(e, true);
			this.clear();
		}));
	}

	get value(): string {
		return this.input.value;
	}

	clear(): void {
		if (this._store.isDisposed) {
			return;
		}
		this.setValue('');
		this.input.focus();
	}

	/** A text button for an empty state that clears this filter. */
	createClearFilterLink(): HTMLButtonElement {
		const link = $('button.sources-list-filter-clear-link') as HTMLButtonElement;
		link.type = 'button';
		link.textContent = localize('sourcesListFilter.clearFilterLink', "Clear filter");
		this._register(dom.addDisposableListener(link, dom.EventType.CLICK, e => {
			dom.EventHelper.stop(e, true);
			this.clear();
		}));
		return link;
	}

	focus(): void {
		if (this._store.isDisposed) {
			return;
		}
		this.input.focus();
	}

	/** `undefined` returns the box to the panel it was built in. */
	dock(host: HTMLElement | undefined): void {
		if (this._store.isDisposed) {
			return;
		}
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
		if (this._store.isDisposed) {
			return;
		}
		this.element.style.display = available ? '' : 'none';
		this.element.classList.toggle('is-hidden', !available);
	}

	override dispose(): void {
		this.dockHome = undefined;
		dom.clearNode(this.element);
		this.element.remove();
		super.dispose();
	}

	private setValue(value: string): void {
		if (this.input.value === value) {
			return;
		}
		this.input.value = value;
		this.updateClearVisibility();
		this._onDidChange.fire(value);
	}

	private updateClearVisibility(): void {
		this.element.classList.toggle('has-text', this.input.value.length > 0);
	}
}
