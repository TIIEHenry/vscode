/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/connectionPreferencesPane.css';
import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import type { ConnectionPhase } from '../../../../platform/universeAgent/common/connectionHubTypes.js';
import type { ConnectionProfileProjection, HubDeviceProjection } from '../../../../platform/universeAgent/common/hub.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { IPreferencesEditorPane } from '../../preferences/browser/preferencesEditorRegistry.js';
import { IUniverseAgentHubService } from '../../../../platform/universeAgent/common/hub.js';
import {
	canConnectHubDevice,
	getConnectionPhasePaneLabel,
	getHubAuthStatusLabel,
	getHubDeviceRowStatusLabel,
	getHubDirectoryBannerLabel,
	getHubMustChangePasswordHint,
	HUB_CHANGE_PASSWORD_BUTTON_LABEL,
	HUB_CURRENT_PASSWORD_FIELD_LABEL,
	HUB_LOGIN_BUTTON_LABEL,
	HUB_NEW_PASSWORD_FIELD_LABEL,
	HUB_PASSWORD_FIELD_LABEL,
	readHandshakeSasCode,
} from './connectionPreferencesPaneLabels.js';
import { promptSasConfirmDialog } from './connectionPreferencesPaneSas.js';
import { getConnectionPhaseStatusBarText } from './conversationSessionStatus.js';
import {
	getUnsupportedEnvironmentCopy,
	PREFERENCES_PANE_COMPACT_WIDTH,
	PREFERENCES_PANE_NARROW_WIDTH,
	shouldDrawDesktopConnectionControls,
} from './engineSectionChrome.js';

const $ = DOM.$;

export interface IConnectionProfileEntry {
	readonly id: string;
	readonly label: string;
	readonly stateLabel: string;
}

/** Test Connection 结果与 StatusBar / Engine 共用 H4b 文案。 */
export function getConnectionTestStatusText(phase?: ConnectionPhase, pairingPending = false): string {
	return getConnectionPhaseStatusBarText(phase ?? { kind: 'disconnected' }, pairingPending);
}

export function getConnectionEmptyCopy(): string {
	return localize('ua.connectionEmptyWelcome', "No connection profiles yet");
}

export function getConnectionRemoteIoHintCopy(): string {
	return localize(
		'ua.connectionRemoteIoHint',
		"When connected to a remote Engine, file and shell operations run on this machine unless routed otherwise.",
	);
}

class ConnectionProfilesDelegate implements IListVirtualDelegate<IConnectionProfileEntry> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return 'connectionProfileEntry';
	}
}

interface IConnectionProfileTemplateData {
	readonly label: HTMLElement;
}

class ConnectionProfilesRenderer implements IListRenderer<IConnectionProfileEntry, IConnectionProfileTemplateData> {
	static readonly TEMPLATE_ID = 'connectionProfileEntry';

	readonly templateId = ConnectionProfilesRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IConnectionProfileTemplateData {
		return { label: DOM.append(container, $('.connection-profile-label')) };
	}

	renderElement(entry: IConnectionProfileEntry, _index: number, templateData: IConnectionProfileTemplateData): void {
		templateData.label.textContent = `${entry.label} — ${entry.stateLabel}`;
	}

	disposeTemplate(): void {
		// noop
	}
}

class ConnectionProfilesAccessibilityProvider implements IListAccessibilityProvider<IConnectionProfileEntry> {
	getWidgetAriaLabel(): string {
		return localize('ua.connectionProfilesList', "Connection profiles");
	}

	getAriaLabel(entry: IConnectionProfileEntry): string {
		return `${entry.label}, ${entry.stateLabel}`;
	}
}

class HubDevicesDelegate implements IListVirtualDelegate<HubDeviceProjection> {
	getHeight(): number {
		return 28;
	}

	getTemplateId(): string {
		return 'hubDeviceEntry';
	}
}

interface IHubDeviceTemplateData {
	readonly row: HTMLElement;
	readonly name: HTMLElement;
	readonly status: HTMLElement;
	readonly connectButton: Button;
	device: HubDeviceProjection | undefined;
	readonly connectDisposable: { dispose(): void };
}

class HubDevicesRenderer implements IListRenderer<HubDeviceProjection, IHubDeviceTemplateData> {
	static readonly TEMPLATE_ID = 'hubDeviceEntry';

	readonly templateId = HubDevicesRenderer.TEMPLATE_ID;

	constructor(
		private readonly onConnect: (device: HubDeviceProjection) => void,
		private readonly canConnect: (device: HubDeviceProjection) => boolean,
	) { }

	renderTemplate(container: HTMLElement): IHubDeviceTemplateData {
		const row = DOM.append(container, $('.connection-hub-device-row'));
		const name = DOM.append(row, $('.connection-hub-device-name'));
		const status = DOM.append(row, $('.connection-hub-device-status'));
		const connectButton = new Button(row, defaultButtonStyles);
		connectButton.label = localize('ua.connectionDeviceConnect', "Connect");
		const templateData: IHubDeviceTemplateData = {
			row,
			name,
			status,
			connectButton,
			device: undefined,
			connectDisposable: connectButton.onDidClick(() => {
				if (templateData.device) {
					this.onConnect(templateData.device);
				}
			}),
		};
		return templateData;
	}

	renderElement(device: HubDeviceProjection, _index: number, templateData: IHubDeviceTemplateData): void {
		templateData.device = device;
		templateData.name.textContent = device.name;
		templateData.status.textContent = getHubDeviceRowStatusLabel(device);
		const showConnect = this.canConnect(device);
		templateData.connectButton.element.style.display = showConnect ? '' : 'none';
		templateData.connectButton.enabled = showConnect;
	}

	disposeTemplate(templateData: IHubDeviceTemplateData): void {
		templateData.connectDisposable.dispose();
		templateData.connectButton.dispose();
	}
}

class HubDevicesAccessibilityProvider implements IListAccessibilityProvider<HubDeviceProjection> {
	getWidgetAriaLabel(): string {
		return localize('ua.connectionDevicesList', "Hub devices");
	}

	getAriaLabel(device: HubDeviceProjection): string {
		return `${device.name}, ${getHubDeviceRowStatusLabel(device)}`;
	}
}

export class ConnectionPreferencesPane extends Disposable implements IPreferencesEditorPane {

	private readonly container: HTMLElement;
	private readonly hubAccountSection: HTMLElement;
	private readonly hubAuthBadge: HTMLElement;
	private readonly hubDirectoryBanner: HTMLElement;
	private readonly hubDevicesSection: HTMLElement;
	private readonly hubDevicesListContainer: HTMLElement;
	private readonly hubDevicesList: WorkbenchList<HubDeviceProjection>;
	private readonly directAddressSection: HTMLElement;
	private readonly directHostInput: HTMLInputElement;
	private readonly directPortInput: HTMLInputElement;
	private readonly directNameInput: HTMLInputElement;
	private readonly directAllowPrivateCheckbox: HTMLInputElement;
	private readonly directAddressStatus: HTMLElement;
	private readonly profilesSection: HTMLElement;
	private readonly emptyWelcome: HTMLElement;
	private readonly listContainer: HTMLElement;
	private readonly list: WorkbenchList<IConnectionProfileEntry>;
	private readonly profileActionsRow: HTMLElement;
	private readonly connectionPhaseLabel: HTMLElement;
	private readonly testStatus: HTMLElement;
	private readonly testSection: HTMLElement;
	private readonly environmentNotice: HTMLElement;
	private entries: IConnectionProfileEntry[] = [];
	private hubDevices: HubDeviceProjection[] = [];
	private connectionPhase: ConnectionPhase = { kind: 'disconnected' };
	private activeProfileId: string | undefined;

	private readonly hubBaseUrlInput: HTMLInputElement;
	private readonly hubEmailInput: HTMLInputElement;
	private readonly hubPasswordLabel: HTMLElement;
	private readonly hubPasswordInput: HTMLInputElement;
	private readonly hubNewPasswordInput: HTMLInputElement;
	private readonly hubLoginButton: Button;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IUniverseAgentHubService private readonly hubService: IUniverseAgentHubService,
		@IUniverseAgentConnection private readonly connectionService: IUniverseAgentConnection,
		@IDialogService private readonly dialogService: IDialogService,
	) {
		super();

		this.container = DOM.$('.connection-preferences-pane');

		const title = DOM.append(this.container, DOM.$('h2'));
		title.textContent = localize('ua.connectionPaneTitle', "Connection");

		this.environmentNotice = DOM.append(this.container, DOM.$('.connection-environment-notice'));
		this.environmentNotice.setAttribute('role', 'status');
		this.environmentNotice.textContent = getUnsupportedEnvironmentCopy();
		this.environmentNotice.style.display = 'none';

		// Zone 1 — Hub account
		this.hubAccountSection = DOM.append(this.container, DOM.$('.connection-zone.connection-hub-account'));
		DOM.append(this.hubAccountSection, DOM.$('h3')).textContent = localize('ua.connectionHubAccountHeading', "Hub account");
		this.hubAuthBadge = DOM.append(this.hubAccountSection, DOM.$('.connection-hub-auth-badge'));
		this.hubAuthBadge.setAttribute('role', 'status');

		const hubUrlRow = DOM.append(this.hubAccountSection, DOM.$('.connection-field-row'));
		DOM.append(hubUrlRow, DOM.$('label')).textContent = localize('ua.connectionHubBaseUrl', "Hub URL");
		this.hubBaseUrlInput = DOM.append(hubUrlRow, DOM.$('input.connection-field-input')) as HTMLInputElement;
		this.hubBaseUrlInput.type = 'url';
		this.hubBaseUrlInput.placeholder = 'https://hub.example.com';

		const emailRow = DOM.append(this.hubAccountSection, DOM.$('.connection-field-row'));
		DOM.append(emailRow, DOM.$('label')).textContent = localize('ua.connectionHubEmail', "Email");
		this.hubEmailInput = DOM.append(emailRow, DOM.$('input.connection-field-input')) as HTMLInputElement;
		this.hubEmailInput.type = 'email';
		this.hubEmailInput.placeholder = 'you@example.com';

		const passwordRow = DOM.append(this.hubAccountSection, DOM.$('.connection-field-row'));
		this.hubPasswordLabel = DOM.append(passwordRow, DOM.$('label'));
		this.hubPasswordLabel.textContent = HUB_PASSWORD_FIELD_LABEL;
		this.hubPasswordInput = DOM.append(passwordRow, DOM.$('input.connection-field-input')) as HTMLInputElement;
		this.hubPasswordInput.type = 'password';

		const hubNewPasswordRow = DOM.append(this.hubAccountSection, DOM.$('.connection-field-row.connection-hub-new-password-row'));
		DOM.append(hubNewPasswordRow, DOM.$('label')).textContent = HUB_NEW_PASSWORD_FIELD_LABEL;
		this.hubNewPasswordInput = DOM.append(hubNewPasswordRow, DOM.$('input.connection-field-input')) as HTMLInputElement;
		this.hubNewPasswordInput.type = 'password';
		this.hubNewPasswordInput.autocomplete = 'new-password';

		const hubMustChangeHint = DOM.append(this.hubAccountSection, DOM.$('.connection-hub-must-change-hint'));
		hubMustChangeHint.setAttribute('role', 'status');
		hubMustChangeHint.textContent = getHubMustChangePasswordHint();

		const hubActions = DOM.append(this.hubAccountSection, DOM.$('.connection-hub-actions'));
		this.hubLoginButton = this._register(new Button(hubActions, defaultButtonStyles));
		this.hubLoginButton.label = HUB_LOGIN_BUTTON_LABEL;
		this._register(this.hubLoginButton.onDidClick(() => this.handleLogin()));

		const logoutButton = this._register(new Button(hubActions, defaultButtonStyles));
		logoutButton.label = localize('ua.connectionHubLogout', "Sign out");
		this._register(logoutButton.onDidClick(() => this.handleLogout()));

		const refreshButton = this._register(new Button(hubActions, defaultButtonStyles));
		refreshButton.label = localize('ua.connectionHubRefreshDevices', "Refresh devices");
		this._register(refreshButton.onDidClick(() => this.refreshHubDirectory()));

		// Zone 2 — Device list
		this.hubDevicesSection = DOM.append(this.container, DOM.$('.connection-zone.connection-hub-devices'));
		DOM.append(this.hubDevicesSection, DOM.$('h3')).textContent = localize('ua.connectionDevicesHeading', "Devices");
		this.hubDirectoryBanner = DOM.append(this.hubDevicesSection, DOM.$('.connection-hub-directory-banner'));
		this.hubDirectoryBanner.setAttribute('role', 'alert');
		this.hubDevicesListContainer = DOM.append(this.hubDevicesSection, DOM.$('.connection-hub-devices-list'));
		this.hubDevicesList = this._register(instantiationService.createInstance(
			WorkbenchList,
			'HubDevices',
			this.hubDevicesListContainer,
			new HubDevicesDelegate(),
			[new HubDevicesRenderer(device => this.handleConnectDevice(device), device => this.canConnectDevice(device))],
			{
				identityProvider: { getId: (device: HubDeviceProjection) => device.id },
				accessibilityProvider: new HubDevicesAccessibilityProvider(),
			},
		)) as WorkbenchList<HubDeviceProjection>;

		// Zone 2b — Direct Address (debug / fallback; no Hub ticket)
		this.directAddressSection = DOM.append(this.container, DOM.$('.connection-zone.connection-direct-address'));
		DOM.append(this.directAddressSection, DOM.$('h3')).textContent = localize('ua.connectionDirectAddressHeading', "Direct Address");
		const directHint = DOM.append(this.directAddressSection, DOM.$('.connection-direct-address-hint'));
		directHint.textContent = localize(
			'ua.connectionDirectAddressHint',
			"Manual host and port for debugging or fallback. Private networks are blocked unless explicitly allowed.",
		);

		const directHostRow = DOM.append(this.directAddressSection, DOM.$('.connection-field-row'));
		DOM.append(directHostRow, DOM.$('label')).textContent = localize('ua.connectionDirectHost', "Host");
		this.directHostInput = DOM.append(directHostRow, DOM.$('input.connection-field-input')) as HTMLInputElement;
		this.directHostInput.placeholder = '203.0.113.10';

		const directPortRow = DOM.append(this.directAddressSection, DOM.$('.connection-field-row'));
		DOM.append(directPortRow, DOM.$('label')).textContent = localize('ua.connectionDirectPort', "Port");
		this.directPortInput = DOM.append(directPortRow, DOM.$('input.connection-field-input')) as HTMLInputElement;
		this.directPortInput.type = 'number';
		this.directPortInput.min = '1';
		this.directPortInput.max = '65535';
		this.directPortInput.placeholder = '7443';

		const directNameRow = DOM.append(this.directAddressSection, DOM.$('.connection-field-row'));
		DOM.append(directNameRow, DOM.$('label')).textContent = localize('ua.connectionDirectDisplayName', "Name");
		this.directNameInput = DOM.append(directNameRow, DOM.$('input.connection-field-input')) as HTMLInputElement;
		this.directNameInput.placeholder = localize('ua.connectionDirectDisplayNamePlaceholder', "Optional label");

		const directAllowRow = DOM.append(this.directAddressSection, DOM.$('.connection-field-row'));
		this.directAllowPrivateCheckbox = DOM.append(directAllowRow, DOM.$('input')) as HTMLInputElement;
		this.directAllowPrivateCheckbox.type = 'checkbox';
		this.directAllowPrivateCheckbox.id = 'connection-allow-private-network';
		const allowLabel = DOM.append(directAllowRow, DOM.$('label')) as HTMLLabelElement;
		allowLabel.setAttribute('for', 'connection-allow-private-network');
		allowLabel.textContent = localize('ua.connectionAllowPrivateNetwork', "Allow private / loopback networks");

		const directActions = DOM.append(this.directAddressSection, DOM.$('.connection-hub-actions'));
		const addDirectButton = this._register(new Button(directActions, defaultButtonStyles));
		addDirectButton.label = localize('ua.connectionDirectAdd', "Add");
		this._register(addDirectButton.onDidClick(() => this.handleAddDirectAddress()));

		const connectDirectButton = this._register(new Button(directActions, defaultButtonStyles));
		connectDirectButton.label = localize('ua.connectionDirectConnect', "Connect");
		this._register(connectDirectButton.onDidClick(() => this.handleConnectDirectAddress()));

		this.directAddressStatus = DOM.append(this.directAddressSection, DOM.$('.connection-direct-address-status'));
		this.directAddressStatus.setAttribute('role', 'status');

		// Zone 3 — Connection profiles
		this.profilesSection = DOM.append(this.container, DOM.$('.connection-zone.connection-profiles'));
		DOM.append(this.profilesSection, DOM.$('h3')).textContent = localize('ua.connectionProfilesHeading', "Connection profiles");
		this.connectionPhaseLabel = DOM.append(this.profilesSection, DOM.$('.connection-phase-label'));
		this.connectionPhaseLabel.setAttribute('role', 'status');
		this.emptyWelcome = DOM.append(this.profilesSection, DOM.$('.connection-empty-welcome'));
		this.emptyWelcome.textContent = getConnectionEmptyCopy();
		this.emptyWelcome.style.opacity = '0.8';
		this.listContainer = DOM.append(this.profilesSection, DOM.$('.connection-list'));
		this.list = this._register(instantiationService.createInstance(
			WorkbenchList,
			'ConnectionProfiles',
			this.listContainer,
			new ConnectionProfilesDelegate(),
			[new ConnectionProfilesRenderer()],
			{
				identityProvider: { getId: (entry: IConnectionProfileEntry) => entry.id },
				accessibilityProvider: new ConnectionProfilesAccessibilityProvider(),
			},
		)) as WorkbenchList<IConnectionProfileEntry>;

		this.profileActionsRow = DOM.append(this.profilesSection, DOM.$('.connection-profile-actions'));
		const connectProfileButton = this._register(new Button(this.profileActionsRow, defaultButtonStyles));
		connectProfileButton.label = localize('ua.connectionProfileConnect', "Connect");
		this._register(connectProfileButton.onDidClick(() => this.handleConnectSelectedProfile()));

		const disconnectButton = this._register(new Button(this.profileActionsRow, defaultButtonStyles));
		disconnectButton.label = localize('ua.connectionProfileDisconnect', "Disconnect");
		this._register(disconnectButton.onDidClick(() => this.handleDisconnect()));

		const forgetButton = this._register(new Button(this.profileActionsRow, defaultButtonStyles));
		forgetButton.label = localize('ua.connectionProfileForget', "Forget this Engine");
		this._register(forgetButton.onDidClick(() => this.handleForgetSelectedProfile()));

		this._register(this.list.onDidChangeSelection(e => {
			const selected = e.elements[0];
			if (selected) {
				this.activeProfileId = selected.id;
			}
		}));

		// Zone 4 — Test Connection + Remote I/O hint
		this.testSection = DOM.append(this.container, DOM.$('.connection-zone.connection-test-section'));
		const testSection = this.testSection;
		DOM.append(testSection, DOM.$('h3')).textContent = localize('ua.connectionTestHeading', "Test Connection");
		const testRow = DOM.append(testSection, DOM.$('.connection-test-row'));
		const testButton = this._register(new Button(testRow, defaultButtonStyles));
		testButton.label = localize('ua.connectionTest', "Test Connection");
		this.testStatus = DOM.append(testRow, DOM.$('.connection-test-status'));
		this.testStatus.setAttribute('role', 'status');
		this.testStatus.setAttribute('aria-live', 'polite');
		this._register(testButton.onDidClick(() => {
			this.testStatus.textContent = getConnectionTestStatusText(
				this.connectionService.getConnectionPhase(),
				this.connectionService.getConnectionSnapshot().pairingPending,
			);
		}));

		const remoteIoHint = DOM.append(this.container, DOM.$('.connection-remote-io-hint'));
		remoteIoHint.textContent = getConnectionRemoteIoHintCopy();

		this._register(this.hubService.onDidChangeAuthStatus(() => this.renderHubAccount()));
		this._register(this.hubService.onDidChangeDirectory(() => this.renderHubDirectory()));
		this._register(this.hubService.onDidChangeProfiles(() => this.renderProfiles()));
		this._register(this.connectionService.onDidChangeConnection(() => {
			this.renderConnectionPhase();
			this.applyDesktopConnectionControlVisibility();
		}));

		this.renderHubAccount();
		this.renderHubDirectory();
		this.renderProfiles();
		this.renderConnectionPhase();
		this.applyDesktopConnectionControlVisibility();
		void this.initializeState();
	}

	private desktopConnectionControlContext() {
		return {
			phase: this.connectionService.getConnectionPhase(),
			snapshot: this.connectionService.getConnectionSnapshot(),
			capabilities: this.connectionService.getCapabilitySnapshot(),
		};
	}

	private applyDesktopConnectionControlVisibility(): void {
		const drawDesktop = shouldDrawDesktopConnectionControls(this.desktopConnectionControlContext());
		this.hubAccountSection.style.display = drawDesktop ? '' : 'none';
		this.directAddressSection.style.display = drawDesktop ? '' : 'none';
		this.testSection.style.display = drawDesktop ? '' : 'none';
		this.environmentNotice.style.display = drawDesktop ? 'none' : '';
		if (!drawDesktop) {
			this.hubDevicesSection.style.display = 'none';
			return;
		}
		this.hubDevicesSection.style.display = this.hubService.getAuthStatus().kind === 'signedOut' ? 'none' : '';
	}

	private async initializeState(): Promise<void> {
		await this.hubService.isEncryptionAvailable().then(available => {
			if (!available) {
				const hint = DOM.append(this.hubAccountSection, DOM.$('.connection-hub-encryption-hint'));
				hint.textContent = localize('ua.connectionHubEncryptionUnavailable', "Secure storage unavailable — sign in again after restart.");
			}
		}).catch(() => undefined);
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	layout(dimension: DOM.Dimension): void {
		this.container.style.height = `${dimension.height}px`;
		this.container.classList.toggle('is-narrow', dimension.width < PREFERENCES_PANE_NARROW_WIDTH);
		this.container.classList.toggle('is-compact', dimension.width < PREFERENCES_PANE_COMPACT_WIDTH);
		const listHeight = Math.max(0, Math.floor((dimension.height - 520) / 2));
		const listWidth = Math.max(0, dimension.width - 48);
		this.hubDevicesList.layout(listHeight, listWidth);
		this.list.layout(listHeight, listWidth);
	}

	search(_text: string): void {
		// Header search disabled for this pane family.
	}

	private canConnectDevice(device: HubDeviceProjection): boolean {
		return canConnectHubDevice(device, this.hubService.getDirectoryStatus());
	}

	private async handleLogin(): Promise<void> {
		if (this.hubService.getAuthStatus().kind === 'mustChangePassword') {
			await this.handleChangePassword();
			return;
		}
		const hubBaseUrl = this.hubBaseUrlInput.value.trim();
		const email = this.hubEmailInput.value.trim();
		const password = this.hubPasswordInput.value;
		this.hubService.setActiveHubBaseUrl(hubBaseUrl || undefined);
		const result = await this.hubService.login(hubBaseUrl, email, password);
		if (!result.ok) {
			this.hubAuthBadge.textContent = result.reason;
			return;
		}
		this.renderHubAccount();
		if (this.hubService.getAuthStatus().kind === 'mustChangePassword') {
			return;
		}
		this.hubPasswordInput.value = '';
		this.hubNewPasswordInput.value = '';
	}

	private async handleChangePassword(): Promise<void> {
		const oldPassword = this.hubPasswordInput.value;
		const newPassword = this.hubNewPasswordInput.value;
		const result = await this.hubService.changePassword(oldPassword, newPassword);
		if (!result.ok) {
			this.hubAuthBadge.textContent = result.reason;
			return;
		}
		this.hubPasswordInput.value = '';
		this.hubNewPasswordInput.value = '';
		this.renderHubAccount();
	}

	private async handleLogout(): Promise<void> {
		await this.hubService.logout();
		this.hubPasswordInput.value = '';
		this.hubNewPasswordInput.value = '';
		this.renderHubAccount();
	}

	private async refreshHubDirectory(): Promise<void> {
		await this.hubService.refreshDirectory();
	}

	private async handleAddDirectAddress(): Promise<void> {
		const host = this.directHostInput.value.trim();
		const port = Number(this.directPortInput.value);
		const displayName = this.directNameInput.value.trim() || undefined;
		const allowPrivateNetwork = this.directAllowPrivateCheckbox.checked;
		const result = await this.hubService.addDirectAddressProfile({ host, port, displayName, allowPrivateNetwork });
		if (!result.ok) {
			this.directAddressStatus.textContent = result.reason;
			return;
		}
		this.activeProfileId = result.profileId;
		this.directAddressStatus.textContent = localize('ua.connectionDirectAdded', "Direct address profile added.");
		this.renderProfiles();
	}

	private async handleConnectDirectAddress(): Promise<void> {
		const host = this.directHostInput.value.trim();
		const port = Number(this.directPortInput.value);
		if (!host || !Number.isInteger(port)) {
			this.directAddressStatus.textContent = localize('ua.connectionDirectInvalid', "Enter a valid host and port.");
			return;
		}

		let profileId = this.activeProfileId;
		const profiles = this.hubService.listConnectionProfiles();
		const existing = profiles.find(p =>
			p.targetKind === 'directAddress' && p.displayName === (this.directNameInput.value.trim() || `${host}:${port}`));
		if (existing) {
			profileId = existing.profileId;
		} else {
			const added = await this.hubService.addDirectAddressProfile({
				host,
				port,
				displayName: this.directNameInput.value.trim() || undefined,
				allowPrivateNetwork: this.directAllowPrivateCheckbox.checked,
			});
			if (!added.ok) {
				this.directAddressStatus.textContent = added.reason;
				return;
			}
			profileId = added.profileId;
		}

		this.activeProfileId = profileId;
		await this.connectProfileWithPairing(profileId);
		this.renderProfiles();
	}

	private async handleConnectSelectedProfile(): Promise<void> {
		if (!this.activeProfileId) {
			this.testStatus.textContent = localize('ua.connectionNoActiveProfile', "Select a connection profile first.");
			return;
		}
		await this.connectProfileWithPairing(this.activeProfileId);
		this.renderProfiles();
	}

	private async handleDisconnect(): Promise<void> {
		await this.connectionService.disconnect();
		this.renderConnectionPhase();
	}

	private async handleForgetSelectedProfile(): Promise<void> {
		if (!this.activeProfileId) {
			return;
		}
		await this.connectionService.disconnect().catch(() => undefined);
		const result = await this.hubService.forgetConnectionProfile(this.activeProfileId);
		if (!result.ok) {
			this.testStatus.textContent = result.reason;
			return;
		}
		this.activeProfileId = undefined;
		this.renderProfiles();
		this.renderConnectionPhase();
	}

	private async connectProfileWithPairing(profileId: string): Promise<void> {
		this.activeProfileId = profileId;
		const profiles = this.hubService.listConnectionProfiles();
		const profile = profiles.find(p => p.profileId === profileId);
		const result = await this.connectionService.connectProfile(profileId);
		if (!result.ok) {
			this.testStatus.textContent = result.reason;
			this.renderConnectionPhase();
			return;
		}
		if (result.ok && result.pairingPending && shouldDrawDesktopConnectionControls(this.desktopConnectionControlContext())) {
			const confirmed = await promptSasConfirmDialog(this.dialogService, {
				displayName: profile?.displayName ?? profileId,
				sasCode: readHandshakeSasCode(result),
				engineIdentityId: profileId,
			});
			if (!confirmed.confirmed) {
				await this.connectionService.disconnect();
			}
		}
		this.renderConnectionPhase();
	}

	private async handleConnectDevice(device: HubDeviceProjection): Promise<void> {
		const existing = this.hubService.listConnectionProfiles().find(p => p.displayName === device.name);
		const profileId = existing?.profileId;
		if (!profileId) {
			this.testStatus.textContent = localize('ua.connectionNoProfileForDevice', "No profile for device — pairing wiring pending.");
			return;
		}

		await this.connectProfileWithPairing(profileId);
		this.renderProfiles();
	}

	private renderHubAccount(): void {
		const status = this.hubService.getAuthStatus();
		this.hubAuthBadge.textContent = getHubAuthStatusLabel(status);
		const mustChangePassword = status.kind === 'mustChangePassword';
		const signedIn = status.kind === 'signedIn';
		this.hubAccountSection.classList.toggle('must-change-password', mustChangePassword);
		this.hubEmailInput.disabled = signedIn || mustChangePassword;
		this.hubPasswordInput.disabled = signedIn;
		this.hubPasswordLabel.textContent = mustChangePassword
			? HUB_CURRENT_PASSWORD_FIELD_LABEL
			: HUB_PASSWORD_FIELD_LABEL;
		this.hubNewPasswordInput.disabled = !mustChangePassword;
		this.hubLoginButton.label = mustChangePassword
			? HUB_CHANGE_PASSWORD_BUTTON_LABEL
			: HUB_LOGIN_BUTTON_LABEL;
		this.hubLoginButton.enabled = !signedIn;
	}

	private renderHubDirectory(): void {
		const directory = this.hubService.getDirectoryStatus();
		const banner = getHubDirectoryBannerLabel(directory);
		this.hubDirectoryBanner.textContent = banner ?? '';
		this.hubDirectoryBanner.style.display = banner ? '' : 'none';

		if (directory.kind === 'ok') {
			this.hubDevices = [...directory.devices];
		} else {
			this.hubDevices = [];
		}
		this.hubDevicesList.splice(0, this.hubDevicesList.length, this.hubDevices);
		if (shouldDrawDesktopConnectionControls(this.desktopConnectionControlContext())) {
			this.hubDevicesSection.style.display = this.hubService.getAuthStatus().kind === 'signedOut' ? 'none' : '';
		}
	}

	private renderProfiles(): void {
		const profiles = this.hubService.listConnectionProfiles();
		this.entries = profiles.map(profile => ({
			id: profile.profileId,
			label: profile.displayName,
			stateLabel: this.getProfileStateLabel(profile),
		}));
		this.setEntries(this.entries);
		if (profiles.length > 0 && !this.activeProfileId) {
			this.activeProfileId = profiles[0].profileId;
		}
	}

	private getProfileStateLabel(profile: ConnectionProfileProjection): string {
		switch (profile.state) {
			case 'pairingPending':
				return localize('ua.connectionProfilePairingPending', "Pairing pending");
			case 'revoked':
				return localize('ua.connectionProfileRevoked', "Revoked");
			case 'disabled':
				return localize('ua.connectionProfileDisabled', "Disabled");
			default:
				return profile.hasTrust
					? localize('ua.connectionProfilePaired', "Paired")
					: localize('ua.connectionProfileUnpaired', "Unpaired");
		}
	}

	private renderConnectionPhase(): void {
		this.connectionPhase = this.connectionService.getConnectionPhase();
		this.connectionPhaseLabel.textContent = getConnectionPhasePaneLabel(
			this.connectionPhase,
			this.connectionService.getConnectionSnapshot().pairingPending,
		);
	}

	private setEntries(entries: IConnectionProfileEntry[]): void {
		this.entries = entries;
		this.list.splice(0, this.list.length, entries);
		this.updateEmptyState();
	}

	private updateEmptyState(): void {
		const isEmpty = this.entries.length === 0;
		this.emptyWelcome.style.display = isEmpty ? '' : 'none';
		this.listContainer.style.display = isEmpty ? 'none' : '';
		this.profileActionsRow.style.display = isEmpty ? 'none' : '';
	}
}
