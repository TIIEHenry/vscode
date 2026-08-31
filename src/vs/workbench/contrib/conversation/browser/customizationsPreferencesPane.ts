/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IPreferencesEditorPane } from '../../preferences/browser/preferencesEditorRegistry.js';

export class CustomizationsPreferencesPane extends Disposable implements IPreferencesEditorPane {

	private readonly container: HTMLElement;

	constructor() {
		super();

		this.container = DOM.$('.customizations-preferences-pane');
		this.container.style.padding = '24px';

		const title = DOM.append(this.container, DOM.$('h2'));
		title.textContent = localize('ua.customizationsPaneTitle', "Customizations");

		const emptyState = DOM.append(this.container, DOM.$('.customizations-empty-state'));
		emptyState.textContent = localize('ua.customizationsEmptyState', "Customizations not connected — no engine.");
		emptyState.style.opacity = '0.8';
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	layout(dimension: DOM.Dimension): void {
		this.container.style.height = `${dimension.height}px`;
	}

	search(_text: string): void {
		// Header search disabled for this pane family.
	}
}
