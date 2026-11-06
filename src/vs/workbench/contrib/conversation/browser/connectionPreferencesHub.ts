/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { InputBox } from '../../../../base/browser/ui/inputbox/inputBox.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IUniverseAgentHubService } from '../../../../platform/universeAgent/common/hub.js';
import {
	getHubAuthStatusLabel,
	getHubAuthStatusTone,
	getHubMustChangePasswordHint,
	HUB_CHANGE_PASSWORD_BUTTON_LABEL,
	HUB_CURRENT_PASSWORD_FIELD_LABEL,
	HUB_LOGIN_BUTTON_LABEL,
	HUB_NEW_PASSWORD_FIELD_LABEL,
	HUB_PASSWORD_FIELD_LABEL,
	hubAccountSignedInActions,
} from './connectionPreferencesPaneLabels.js';
import { createConnectionFieldInput, writeStatus } from './connectionPreferencesZone.js';

export interface IConnectionPreferencesHubHost {
	/** Repaints the account zone together with the device-code actions that depend on sign-in. */
	renderHubAccount(): void;
	refreshHubDirectory(): Promise<void>;
}

/** Hub account zone: sign-in form, auth badge, sign out and Refresh devices. */
export class ConnectionPreferencesHub extends Disposable {

	readonly element: HTMLElement;
	readonly connectStatus: HTMLElement;
	private readonly hubAuthBadge: HTMLElement;
	private readonly hubBaseUrlInput: InputBox;
	private readonly hubEmailInput: InputBox;
	private readonly hubPasswordLabel: HTMLElement;
	private readonly hubPasswordInput: InputBox;
	private readonly hubNewPasswordInput: InputBox;
	private readonly hubLoginButton: Button;
	private readonly hubLogoutButton: Button;
	private readonly hubRefreshButton: Button;

	constructor(
		parent: HTMLElement,
		private readonly host: IConnectionPreferencesHubHost,
		@IContextViewService contextViewService: IContextViewService,
		@IUniverseAgentHubService private readonly hubService: IUniverseAgentHubService,
	) {
		super();
		this.element = DOM.append(parent, DOM.$('.connection-zone.connection-hub-account'));
		this.hubAuthBadge = DOM.append(this.element, DOM.$('.connection-status.connection-hub-auth-badge'));
		this.hubAuthBadge.setAttribute('role', 'status');

		this.hubBaseUrlInput = createConnectionFieldInput(this._store, contextViewService, this.element, localize('ua.connectionHubBaseUrl', "Hub URL"), {
			type: 'url',
			placeholder: 'https://hub.example.com',
			description: localize('ua.connectionHubBaseUrlDescription', "Endpoint URL for the Universe Agent Hub management service."),
		}).input;
		this.hubEmailInput = createConnectionFieldInput(this._store, contextViewService, this.element, localize('ua.connectionHubEmail', "Email"), {
			type: 'email',
			placeholder: 'you@example.com',
			description: localize('ua.connectionHubEmailDescription', "User email address registered with your Hub organization."),
		}).input;
		const passwordField = createConnectionFieldInput(this._store, contextViewService, this.element, HUB_PASSWORD_FIELD_LABEL, {
			type: 'password',
			description: localize('ua.connectionHubPasswordDescription', "Account password used for authentication."),
		});
		this.hubPasswordLabel = passwordField.label;
		this.hubPasswordInput = passwordField.input;
		const newPasswordField = createConnectionFieldInput(this._store, contextViewService, this.element, HUB_NEW_PASSWORD_FIELD_LABEL, {
			type: 'password',
			rowClass: 'connection-hub-new-password-row',
		});
		this.hubNewPasswordInput = newPasswordField.input;
		this.hubNewPasswordInput.inputElement.autocomplete = 'new-password';

		const hubMustChangeHint = DOM.append(this.element, DOM.$('.connection-hub-must-change-hint'));
		hubMustChangeHint.setAttribute('role', 'status');
		hubMustChangeHint.textContent = getHubMustChangePasswordHint();

		const hubActions = DOM.append(this.element, DOM.$('.connection-actions.connection-hub-actions'));
		this.hubLoginButton = this._register(new Button(hubActions, defaultButtonStyles));
		this.hubLoginButton.label = HUB_LOGIN_BUTTON_LABEL;
		this._register(this.hubLoginButton.onDidClick(() => void this.handleLogin().catch(onUnexpectedError)));
		this._register(this.hubBaseUrlInput.onDidChange(() => this.updateHubLoginState()));
		this._register(this.hubEmailInput.onDidChange(() => this.updateHubLoginState()));
		this._register(this.hubPasswordInput.onDidChange(() => this.updateHubLoginState()));
		this._register(this.hubNewPasswordInput.onDidChange(() => this.updateHubLoginState()));

		this.hubLogoutButton = this._register(new Button(hubActions, { ...defaultButtonStyles, secondary: true }));
		this.hubLogoutButton.label = localize('ua.connectionHubLogout', "Sign out");
		this._register(this.hubLogoutButton.onDidClick(() => void this.handleLogout().catch(onUnexpectedError)));

		this.hubRefreshButton = this._register(new Button(hubActions, { ...defaultButtonStyles, secondary: true }));
		this.hubRefreshButton.label = localize('ua.connectionHubRefreshDevices', "Refresh devices");
		this._register(this.hubRefreshButton.onDidClick(() => void this.host.refreshHubDirectory().catch(onUnexpectedError)));

		this.connectStatus = DOM.append(this.element, DOM.$('.connection-status.connection-hub-connect-status'));
		this.connectStatus.setAttribute('role', 'status');
		this.connectStatus.setAttribute('aria-live', 'polite');
	}

	async initializeState(): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}
		await this.hubService.isEncryptionAvailable().then(available => {
			if (this._store.isDisposed) {
				return;
			}
			if (!available) {
				const hint = DOM.append(this.element, DOM.$('.connection-hub-encryption-hint'));
				hint.textContent = localize('ua.connectionHubEncryptionUnavailable', "Secure storage unavailable — sign in again after restart.");
			}
		}).catch(() => undefined);
	}

	layout(): void {
		this.hubBaseUrlInput.layout();
		this.hubEmailInput.layout();
		this.hubPasswordInput.layout();
		this.hubNewPasswordInput.layout();
	}

	private async handleLogin(): Promise<void> {
		if (this.hubService.getAuthStatus().kind === 'mustChangePassword') {
			await this.handleChangePassword();
			return;
		}
		const hubBaseUrl = this.hubBaseUrlInput.value.trim();
		const email = this.hubEmailInput.value.trim();
		const password = this.hubPasswordInput.value;
		try {
			const result = await this.hubService.login(hubBaseUrl, email, password);
			if (!result.ok) {
				writeStatus(this.hubAuthBadge, result.reason, 'error');
				return;
			}
			this.host.renderHubAccount();
			if (this.hubService.getAuthStatus().kind === 'mustChangePassword') {
				return;
			}
			this.hubPasswordInput.value = '';
			this.hubNewPasswordInput.value = '';
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			writeStatus(this.hubAuthBadge, reason, 'error');
		}
	}

	private async handleChangePassword(): Promise<void> {
		const oldPassword = this.hubPasswordInput.value;
		const newPassword = this.hubNewPasswordInput.value;
		try {
			const result = await this.hubService.changePassword(oldPassword, newPassword);
			if (!result.ok) {
				writeStatus(this.hubAuthBadge, result.reason, 'error');
				return;
			}
			this.hubPasswordInput.value = '';
			this.hubNewPasswordInput.value = '';
			this.host.renderHubAccount();
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			writeStatus(this.hubAuthBadge, reason, 'error');
		}
	}

	private async handleLogout(): Promise<void> {
		try {
			await this.hubService.logout();
			this.hubPasswordInput.value = '';
			this.hubNewPasswordInput.value = '';
			this.host.renderHubAccount();
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			writeStatus(this.hubAuthBadge, reason, 'error');
		}
	}

	private canSubmitHubAccount(): boolean {
		const status = this.hubService.getAuthStatus();
		if (status.kind === 'signedIn') {
			return false;
		}
		if (status.kind === 'mustChangePassword') {
			return this.hubPasswordInput.value.length > 0 && this.hubNewPasswordInput.value.length > 0;
		}
		return this.hubBaseUrlInput.value.trim().length > 0
			&& this.hubEmailInput.value.trim().length > 0
			&& this.hubPasswordInput.value.length > 0;
	}

	private updateHubLoginState(): void {
		const status = this.hubService.getAuthStatus();
		const enabled = this.canSubmitHubAccount();
		const label = status.kind === 'mustChangePassword'
			? HUB_CHANGE_PASSWORD_BUTTON_LABEL
			: HUB_LOGIN_BUTTON_LABEL;
		const hint = status.kind === 'mustChangePassword'
			? localize('ua.connectionHubChangePasswordHint', "Enter your current password and a new password.")
			: status.kind === 'signedIn'
				? localize('ua.connectionHubSignInUnavailable', "Sign in is unavailable while signed in.")
				: localize('ua.connectionHubSignInHint', "Enter the Hub URL, email, and password to sign in.");
		this.hubLoginButton.enabled = enabled;
		this.hubLoginButton.secondary = !enabled;
		this.hubLoginButton.element.setAttribute('aria-label', enabled ? label : `${label}. ${hint}`);
		if (enabled) {
			this.hubLoginButton.element.removeAttribute('title');
		} else {
			this.hubLoginButton.element.setAttribute('title', hint);
		}
	}

	/** Account half of the pane's `renderHubAccount`; the device-code actions live in the Devices zone. */
	render(): void {
		const status = this.hubService.getAuthStatus();
		writeStatus(this.hubAuthBadge, getHubAuthStatusLabel(status), getHubAuthStatusTone(status));
		const mustChangePassword = status.kind === 'mustChangePassword';
		const signedIn = status.kind === 'signedIn';
		this.element.classList.toggle('must-change-password', mustChangePassword);
		this.hubEmailInput.setEnabled(!(signedIn || mustChangePassword));
		this.hubPasswordInput.setEnabled(!signedIn);
		this.hubPasswordLabel.textContent = mustChangePassword
			? HUB_CURRENT_PASSWORD_FIELD_LABEL
			: HUB_PASSWORD_FIELD_LABEL;
		this.hubNewPasswordInput.setEnabled(mustChangePassword);
		this.hubLoginButton.label = mustChangePassword
			? HUB_CHANGE_PASSWORD_BUTTON_LABEL
			: HUB_LOGIN_BUTTON_LABEL;
		this.updateHubLoginState();
		const signedInActions = hubAccountSignedInActions(status.kind);
		this.hubLogoutButton.element.style.display = signedInActions.showSignOut ? '' : 'none';
		this.hubRefreshButton.element.style.display = signedInActions.showRefreshDevices ? '' : 'none';
	}
}
