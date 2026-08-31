/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/navigatorProjectsInlineFilter.css';
import * as dom from '../../../../base/browser/dom.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';

const $ = dom.$;

export class NavigatorProjectsInlineFilterBox extends Disposable {

	static readonly HEIGHT = 28;

	readonly element: HTMLElement;
	private readonly input: HTMLInputElement;
	private readonly clearButton: HTMLElement;

	private readonly _onDidChange = this._register(new Emitter<string>());
	readonly onDidChange = this._onDidChange.event;

	constructor(parent: HTMLElement, placeholder: string, ariaLabel: string) {
		super();

		this.element = dom.append(parent, $('.navigator-projects-inline-filter'));
		const icon = dom.append(this.element, $('.navigator-projects-inline-filter-icon'));
		icon.appendChild(renderIcon(Codicon.search));

		this.input = dom.append(this.element, $('input.navigator-projects-inline-filter-input')) as HTMLInputElement;
		this.input.type = 'text';
		this.input.placeholder = placeholder;
		this.input.setAttribute('aria-label', ariaLabel);

		this.clearButton = dom.append(this.element, $('button.navigator-projects-inline-filter-clear'));
		this.clearButton.setAttribute('aria-label', ariaLabel);
		this.clearButton.appendChild(renderIcon(Codicon.close));

		this._register(dom.addStandardDisposableListener(this.input, 'input', () => {
			this.updateClearVisibility();
			this._onDidChange.fire(this.input.value);
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
		this.element.style.display = visible ? '' : 'none';
	}

	focus(): void {
		this.input.focus();
	}

	private updateClearVisibility(): void {
		this.element.classList.toggle('has-text', this.input.value.length > 0);
	}
}
