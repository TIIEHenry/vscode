/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IPreferencesEditorPane } from '../../preferences/browser/preferencesEditorRegistry.js';

/** Honest Test Connection result — no engine probe, no fake success. */
export function getConnectionTestStatusText(): string {
	return localize('ua.connectionTestNotConnected', "Not connected — no engine.");
}

export class ConnectionPreferencesPane extends Disposable implements IPreferencesEditorPane {

	private readonly container: HTMLElement;

	constructor() {
		super();

		this.container = DOM.$('.connection-preferences-pane');
		this.container.style.padding = '24px';

		const title = DOM.append(this.container, DOM.$('h2'));
		title.textContent = localize('ua.connectionPaneTitle', "Connection");

		const emptyState = DOM.append(this.container, DOM.$('.connection-empty-state'));
		emptyState.textContent = localize('ua.connectionEmptyState', "Connection not connected — no engine.");
		emptyState.style.opacity = '0.8';

		const testRow = DOM.append(this.container, DOM.$('.connection-test-row'));
		const testButton = this._register(new Button(testRow, defaultButtonStyles));
		testButton.label = localize('ua.connectionTest', "Test Connection");
		const testStatus = DOM.append(testRow, DOM.$('.connection-test-status'));
		testStatus.setAttribute('role', 'status');
		testStatus.setAttribute('aria-live', 'polite');
		this._register(testButton.onDidClick(() => {
			testStatus.textContent = getConnectionTestStatusText();
		}));
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
