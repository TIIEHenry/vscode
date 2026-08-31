/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Checkbox } from '../../../../base/browser/ui/toggle/toggle.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { defaultButtonStyles, defaultCheckboxStyles, getInputBoxStyle } from '../../../../platform/theme/browser/defaultStyles.js';
import { IPreferencesEditorPane } from '../../preferences/browser/preferencesEditorRegistry.js';
import { InputBox } from '../../../../base/browser/ui/inputbox/inputBox.js';

/** Honest Test Connection result — no engine probe, no fake success. */
export function getConnectionTestStatusText(): string {
	return localize('ua.connectionTestNotConnected', "Not connected — no engine.");
}

export class ConnectionPreferencesPane extends Disposable implements IPreferencesEditorPane {

	private readonly container: HTMLElement;
	private readonly hostInput: InputBox;
	private readonly portInput: InputBox;
	private readonly tlsCheckbox: Checkbox;

	constructor() {
		super();

		this.container = DOM.$('.connection-preferences-pane');
		this.container.style.padding = '24px';

		const title = DOM.append(this.container, DOM.$('h2'));
		title.textContent = localize('ua.connectionPaneTitle', "Connection");

		const hostRow = DOM.append(this.container, DOM.$('.connection-field-row'));
		DOM.append(hostRow, DOM.$('label')).textContent = localize('ua.connectionHost', "Host");
		this.hostInput = this._register(new InputBox(DOM.append(hostRow, DOM.$('.connection-field-input')), undefined, getInputBoxStyle({})));
		this.hostInput.onDidChange(value => this.hostValue = value);

		const portRow = DOM.append(this.container, DOM.$('.connection-field-row'));
		DOM.append(portRow, DOM.$('label')).textContent = localize('ua.connectionPort', "Port");
		this.portInput = this._register(new InputBox(DOM.append(portRow, DOM.$('.connection-field-input')), undefined, getInputBoxStyle({})));
		this.portInput.onDidChange(value => this.portValue = value);

		const tlsRow = DOM.append(this.container, DOM.$('.connection-field-row'));
		this.tlsCheckbox = this._register(new Checkbox(localize('ua.connectionTls', "Use TLS"), false, defaultCheckboxStyles));
		tlsRow.appendChild(this.tlsCheckbox.domNode);
		this._register(this.tlsCheckbox.onChange(checked => this.useTls = checked));

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

	private hostValue = '';
	private portValue = '';
	private useTls = false;

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
