/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sourcesListFilter.css';
import * as dom from '../../../../base/browser/dom.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';

const $ = dom.$;

export class SourcesListFilterBox extends Disposable {

	readonly element: HTMLElement;
	private readonly input: HTMLInputElement;

	private readonly _onDidChange = this._register(new Emitter<string>());
	readonly onDidChange = this._onDidChange.event;

	constructor(parent: HTMLElement, placeholder: string, ariaLabel: string) {
		super();

		this.element = dom.append(parent, $('.sources-list-filter'));
		this.input = dom.append(this.element, $('input.sources-list-filter-input')) as HTMLInputElement;
		this.input.type = 'text';
		this.input.placeholder = placeholder;
		this.input.setAttribute('aria-label', ariaLabel);

		this._register(dom.addStandardDisposableListener(this.input, 'input', () => {
			this._onDidChange.fire(this.input.value);
		}));
	}

	get value(): string {
		return this.input.value;
	}

	focus(): void {
		this.input.focus();
	}
}
