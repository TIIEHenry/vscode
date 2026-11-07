/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { InputBox } from '../../../../base/browser/ui/inputbox/inputBox.js';
import { Toggle } from '../../../../base/browser/ui/toggle/toggle.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { createConnectionFieldInput, presentConnectionAction } from './connectionPreferencesZone.js';

export interface IConnectionPreferencesDirectHost {
	handleConnectDirectAddress(): Promise<void>;
	handleAddDirectAddress(): Promise<void>;
}

/** Direct Address zone (debug / fallback; no Hub ticket). The pane still owns Connect and Add. */
export class ConnectionPreferencesDirect extends Disposable {

	readonly element: HTMLElement;
	readonly status: HTMLElement;
	readonly directHostInput: InputBox;
	readonly directPortInput: InputBox;
	readonly directNameInput: InputBox;
	readonly directAllowPrivateCheckbox: Toggle;
	private readonly connectDirectButton: Button;

	constructor(
		parent: HTMLElement,
		host: IConnectionPreferencesDirectHost,
		@IContextViewService contextViewService: IContextViewService,
	) {
		super();
		this.element = DOM.append(parent, DOM.$('.connection-zone.connection-direct-address'));
		const directHint = DOM.append(this.element, DOM.$('.connection-direct-address-hint'));
		directHint.textContent = localize(
			'ua.connectionDirectAddressHint',
			"Enter a host and port. Private networks stay blocked unless you allow them.",
		);

		this.directHostInput = createConnectionFieldInput(this._store, contextViewService, this.element, localize('ua.connectionDirectHost', "Host"), {
			placeholder: '127.0.0.1',
			description: localize('ua.connectionDirectHostDescription', "Hostname or IP address of the Universe Agent engine."),
			layout: 'setting-row',
		}).input;
		this.directHostInput.value = '127.0.0.1';
		this.directPortInput = createConnectionFieldInput(this._store, contextViewService, this.element, localize('ua.connectionDirectPort', "Port"), {
			type: 'number',
			placeholder: '50061',
			description: localize('ua.connectionDirectPortDescription', "Port number where the engine is listening (1-65535)."),
			layout: 'setting-row',
		}).input;
		this.directPortInput.inputElement.min = '1';
		this.directPortInput.inputElement.max = '65535';
		this.directPortInput.value = '50061';
		this.directNameInput = createConnectionFieldInput(this._store, contextViewService, this.element, localize('ua.connectionDirectDisplayName', "Name"), {
			placeholder: localize('ua.connectionDirectDisplayNamePlaceholder', "Local Engine"),
			description: localize('ua.connectionDirectDisplayNameDescription', "A friendly label to identify this engine connection profile."),
			layout: 'setting-row',
		}).input;
		this.directNameInput.value = 'Local Engine';

		const allowPrivateLabelText = localize('ua.connectionAllowPrivateNetwork', "Allow private / loopback networks");
		const directAllowRow = DOM.append(this.element, DOM.$('.connection-field-row.connection-toggle-row.ua-setting-row'));
		const toggleDetails = DOM.append(directAllowRow, DOM.$('.connection-toggle-details.ua-setting-copy'));
		const allowLabel = DOM.append(toggleDetails, DOM.$('span.connection-toggle-label'));
		allowLabel.textContent = allowPrivateLabelText;
		allowLabel.id = 'connection-allow-private-network-label';
		const allowDesc = DOM.append(toggleDetails, DOM.$('span.connection-toggle-description'));
		allowDesc.id = 'connection-allow-private-network-description';
		allowDesc.textContent = localize('ua.connectionAllowPrivateNetworkDescription', "Permit connections to private subnets, localhost, and loopback addresses.");
		const toggleCheckbox = () => {
			this.directAllowPrivateCheckbox.checked = !this.directAllowPrivateCheckbox.checked;
			this.directAllowPrivateCheckbox.focus();
		};
		this.directAllowPrivateCheckbox = this._register(new Toggle({
			title: allowPrivateLabelText,
			isChecked: true,
			inputActiveOptionBackground: 'var(--ua-connection-switch-track)',
			inputActiveOptionForeground: undefined,
			inputActiveOptionBorder: 'transparent',
		}));
		this.directAllowPrivateCheckbox.domNode.setAttribute('role', 'switch');
		this.directAllowPrivateCheckbox.domNode.id = 'connection-allow-private-network';
		this.directAllowPrivateCheckbox.domNode.setAttribute('aria-labelledby', allowLabel.id);
		this.directAllowPrivateCheckbox.domNode.setAttribute('aria-describedby', allowDesc.id);
		DOM.append(directAllowRow, this.directAllowPrivateCheckbox.domNode);
		this._register(DOM.addDisposableListener(allowLabel, DOM.EventType.CLICK, toggleCheckbox));
		this._register(DOM.addDisposableListener(allowDesc, DOM.EventType.CLICK, toggleCheckbox));

		const directActions = DOM.append(this.element, DOM.$('.connection-actions.connection-direct-actions'));
		this.connectDirectButton = this._register(new Button(directActions, defaultButtonStyles));
		this.connectDirectButton.label = localize('ua.connectionDirectConnect', "Connect");
		this._register(this.connectDirectButton.onDidClick(() => void host.handleConnectDirectAddress().catch(onUnexpectedError).catch(onUnexpectedError)));

		const addDirectButton = this._register(new Button(directActions, { ...defaultButtonStyles, secondary: true }));
		addDirectButton.label = localize('ua.connectionDirectAdd', "Add");
		this._register(addDirectButton.onDidClick(() => void host.handleAddDirectAddress().catch(onUnexpectedError).catch(onUnexpectedError)));

		this.status = DOM.append(this.element, DOM.$('.connection-status.connection-direct-address-status'));
		this.status.setAttribute('role', 'status');
	}

	presentConnectGate(enabled: boolean, disabledReason: string): void {
		presentConnectionAction(this.connectDirectButton, enabled, disabledReason);
	}

	layout(): void {
		this.directHostInput.layout();
		this.directPortInput.layout();
		this.directNameInput.layout();
	}
}
