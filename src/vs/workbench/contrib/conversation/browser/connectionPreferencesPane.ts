/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/connectionPreferencesPane.css';
import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { InputBox } from '../../../../base/browser/ui/inputbox/inputBox.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { Checkbox } from '../../../../base/browser/ui/toggle/toggle.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { defaultButtonStyles, defaultCheckboxStyles, defaultInputBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import type { ConnectionPhase, ConnectionProbeResult } from '../../../../platform/universeAgent/common/connectionHubTypes.js';
import type { ConnectionProfileProjection, HubDeviceProjection } from '../../../../platform/universeAgent/common/hub.js';
import { IUniverseAgentConnection, type UniverseAgentProbeEngineResult } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentDeviceInfo, UniverseAgentPendingPairInfo } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import type { IPreferencesEditorPane } from '../../preferences/browser/preferencesEditorRegistry.js';
import { IUniverseAgentHubService } from '../../../../platform/universeAgent/common/hub.js';
import { asConnectionProfileList, ensureCapabilitySnapshot } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import {
	canSendConnectionDeviceListRequest,
	canSendConnectionDeviceRotateToken,
	CONNECTION_DEVICE_ROTATE_TOKEN_LABEL,
	connectionDeviceRotateTokenIds,
	toConnectionPairedDevice,
} from './connectionDeviceList.js';
import {
	canSendConnectionDevicePairRequest,
	CONNECTION_DEVICE_PAIR_REJECT_LABEL,
	CONNECTION_DEVICE_PENDING_EMPTY_COPY,
	CONNECTION_DEVICE_PENDING_HEADING,
	connectionDevicePairIds,
	formatConnectionPendingPairLabel,
} from './connectionDevicePair.js';
import {
	canSendConnectionDeviceRevokeRequest,
	connectionDeviceRevokeIds,
} from './connectionDeviceRevoke.js';
import {
	canConnectHubDevice,
	getConnectionPhasePaneLabel,
	getConnectionPhaseTone,
	getHubAuthStatusLabel,
	getHubAuthStatusTone,
	getHubDeviceRowStatusLabel,
	getHubDirectoryBannerLabel,
	getHubMustChangePasswordHint,
	HUB_CHANGE_PASSWORD_BUTTON_LABEL,
	HUB_CURRENT_PASSWORD_FIELD_LABEL,
	HUB_LOGIN_BUTTON_LABEL,
	HUB_NEW_PASSWORD_FIELD_LABEL,
	HUB_PASSWORD_FIELD_LABEL,
	readHandshakeSasCode,
	isRecoverTrustConnectResult,
	readRecoverTrustLeafFingerprint,
	type ConnectionStatusTone,
} from './connectionPreferencesPaneLabels.js';
import { promptRecoverTrustConfirmDialog, promptSasConfirmDialog } from './connectionPreferencesPaneSas.js';
import { getConnectionPhaseStatusBarText } from './conversationSessionStatus.js';
import {
	getUnsupportedEnvironmentCopy,
	PREFERENCES_PANE_COMPACT_WIDTH,
	PREFERENCES_PANE_NARROW_WIDTH,
	shouldDrawDesktopConnectionControls,
} from './engineSectionChrome.js';

const $ = DOM.$;

/** Every status line in the pane is written through here so tone and copy never drift apart. */
function writeStatus(element: HTMLElement, text: string, tone: ConnectionStatusTone = 'neutral'): void {
	element.textContent = text;
	element.classList.toggle('is-success', tone === 'success');
	element.classList.toggle('is-warning', tone === 'warning');
	element.classList.toggle('is-error', tone === 'error');
}

export type ConnectionZoneId = 'hub' | 'devices' | 'direct' | 'profiles' | 'test';

const CONNECTION_ZONE_NAV_ENTRIES: ReadonlyArray<{ readonly id: ConnectionZoneId; readonly label: string }> = [
	{ id: 'hub', label: localize('ua.connectionHubAccountHeading', "Hub account") },
	{ id: 'devices', label: localize('ua.connectionDevicesHeading', "Devices") },
	{ id: 'direct', label: localize('ua.connectionDirectAddressHeading', "Direct Address") },
	{ id: 'profiles', label: localize('ua.connectionProfilesHeading', "Connection profiles") },
	{ id: 'test', label: localize('ua.connectionTestHeading', "Test Connection") },
];

class ConnectionNavDelegate implements IListVirtualDelegate<typeof CONNECTION_ZONE_NAV_ENTRIES[number]> {
	getHeight(): number {
		return 28;
	}

	getTemplateId(): string {
		return 'connectionNav';
	}
}

interface IConnectionNavTemplateData {
	readonly label: HTMLElement;
}

class ConnectionNavRenderer implements IListRenderer<typeof CONNECTION_ZONE_NAV_ENTRIES[number], IConnectionNavTemplateData> {
	static readonly TEMPLATE_ID = 'connectionNav';
	readonly templateId = ConnectionNavRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IConnectionNavTemplateData {
		container.classList.add('connection-preferences-nav-row');
		return { label: DOM.append(container, $('.connection-preferences-nav-label')) };
	}

	renderElement(entry: typeof CONNECTION_ZONE_NAV_ENTRIES[number], _index: number, templateData: IConnectionNavTemplateData): void {
		templateData.label.textContent = entry.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

class ConnectionNavAccessibilityProvider implements IListAccessibilityProvider<typeof CONNECTION_ZONE_NAV_ENTRIES[number]> {
	getWidgetAriaLabel(): string {
		return localize('ua.connectionPreferencesNav', "Connection sections");
	}

	getAriaLabel(entry: typeof CONNECTION_ZONE_NAV_ENTRIES[number]): string {
		return entry.label;
	}
}

export interface IConnectionProfileEntry {
	readonly id: string;
	readonly label: string;
	readonly stateLabel: string;
}

/** Test Connection 结果与 StatusBar / Engine 共用 H4b 文案。 */
export function getConnectionTestStatusText(phase?: ConnectionPhase, pairingPending = false): string {
	return getConnectionPhaseStatusBarText(phase ?? { kind: 'disconnected' }, pairingPending);
}

export function formatConnectionProbeStatus(result: ConnectionProbeResult): string;
export function formatConnectionProbeStatus(result: UniverseAgentProbeEngineResult, phaseText: string): string;
export function formatConnectionProbeStatus(
	result: ConnectionProbeResult | UniverseAgentProbeEngineResult,
	phaseText?: string,
): string {
	if (phaseText !== undefined) {
		const engine = result as UniverseAgentProbeEngineResult;
		return engine.ok
			? localize('ua.connectionEngineTestOk', "Reachable — {0}", phaseText)
			: localize('ua.connectionTestFailed', "Unreachable — {0}", engine.reason);
	}
	const profile = result as ConnectionProbeResult;
	if (profile.ok) {
		return localize('ua.connectionTestOk', "Reachable · {0} · {1} ms", profile.path, profile.latencyMs);
	}
	return profile.reason;
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
	private readonly hubDeviceCodeStatus: HTMLElement;
	private readonly hubDirectoryBanner: HTMLElement;
	private readonly hubDevicesSection: HTMLElement;
	private readonly hubDevicesListContainer: HTMLElement;
	private readonly hubDevicesList: WorkbenchList<HubDeviceProjection>;
	private readonly deviceActionsRow: HTMLElement;
	private readonly renameDeviceButton: Button;
	private readonly revokeDeviceButton: Button;
	private readonly rotateTokenButton: Button;
	private readonly confirmDeviceCodeInput: InputBox;
	private readonly confirmDeviceCodeButton: Button;
	private readonly rejectDevicePairButton: Button;
	private readonly pendingPairsHeading: HTMLElement;
	private readonly pendingPairsEmpty: HTMLElement;
	private readonly pendingPairsList: HTMLElement;
	private readonly directAddressSection: HTMLElement;
	private readonly directHostInput: InputBox;
	private readonly directPortInput: InputBox;
	private readonly directNameInput: InputBox;
	private readonly directAllowPrivateCheckbox: Checkbox;
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
	private readonly backButton: HTMLButtonElement;
	private readonly navHost: HTMLElement;
	private readonly navList: WorkbenchList<typeof CONNECTION_ZONE_NAV_ENTRIES[number]>;
	private readonly detail: HTMLElement;
	private readonly detailTitle: HTMLElement;
	private readonly scrollBody: HTMLElement;
	private lastLayoutWidth = 900;
	private lastLayoutHeight = 480;
	private narrowShowingDetail = false;
	private syncingNav = false;
	private activeZoneId: ConnectionZoneId = 'hub';
	private entries: IConnectionProfileEntry[] = [];
	private hubDevices: HubDeviceProjection[] = [];
	private enginePairedDevices: UniverseAgentDeviceInfo[] | undefined;
	private pendingPairs: UniverseAgentPendingPairInfo[] = [];
	private selectedPending: UniverseAgentPendingPairInfo | undefined;
	private readonly pendingRowDisposables = this._register(new DisposableStore());
	private connectionPhase: ConnectionPhase = { kind: 'disconnected' };
	private activeProfileId: string | undefined;

	private readonly hubBaseUrlInput: InputBox;
	private readonly hubEmailInput: InputBox;
	private readonly hubPasswordLabel: HTMLElement;
	private readonly hubPasswordInput: InputBox;
	private readonly hubNewPasswordInput: InputBox;
	private readonly hubLoginButton: Button;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IUniverseAgentHubService private readonly hubService: IUniverseAgentHubService,
		@IUniverseAgentConnection private readonly connectionService: IUniverseAgentConnection,
		@IDialogService private readonly dialogService: IDialogService,
	) {
		super();

		this.container = DOM.$('.connection-preferences-pane');

		const title = DOM.append(this.container, DOM.$('h2.connection-preferences-title'));
		title.textContent = localize('ua.connectionPaneTitle', "Connection");

		this.environmentNotice = DOM.append(this.container, DOM.$('.connection-environment-notice'));
		this.environmentNotice.setAttribute('role', 'status');
		this.environmentNotice.textContent = getUnsupportedEnvironmentCopy();
		this.environmentNotice.style.display = 'none';

		const body = DOM.append(this.container, $('.connection-preferences-body'));
		this.navHost = DOM.append(body, $('.connection-preferences-nav'));
		this.navHost.setAttribute('role', 'navigation');
		this.navHost.setAttribute('aria-label', localize('ua.connectionPreferencesNav', "Connection sections"));
		this.navList = this._register(instantiationService.createInstance(
			WorkbenchList,
			'ConnectionPreferencesNav',
			this.navHost,
			new ConnectionNavDelegate(),
			[new ConnectionNavRenderer()],
			{
				identityProvider: { getId: (entry: typeof CONNECTION_ZONE_NAV_ENTRIES[number]) => entry.id },
				accessibilityProvider: new ConnectionNavAccessibilityProvider(),
				keyboardNavigationLabelProvider: { getKeyboardNavigationLabel: (entry: typeof CONNECTION_ZONE_NAV_ENTRIES[number]) => entry.label },
				keyboardSupport: true,
				multipleSelectionSupport: false,
				openOnSingleClick: true,
			},
		)) as WorkbenchList<typeof CONNECTION_ZONE_NAV_ENTRIES[number]>;

		this.detail = DOM.append(body, $('.connection-preferences-detail'));
		const detailHeader = DOM.append(this.detail, $('.connection-preferences-detail-header'));
		this.backButton = DOM.append(detailHeader, $('button.connection-preferences-back')) as HTMLButtonElement;
		this.backButton.type = 'button';
		this.backButton.textContent = localize('ua.connectionPreferencesBack', "Back");
		this.backButton.setAttribute('aria-label', localize('ua.connectionPreferencesBackAria', "Back to Connection sections"));
		this.backButton.hidden = true;
		this._register(DOM.addDisposableListener(this.backButton, 'click', () => this.showNarrowNav()));
		this.detailTitle = DOM.append(detailHeader, $('h3.connection-preferences-detail-title'));

		this.scrollBody = DOM.append(this.detail, $('.connection-preferences-detail-body'));

		// Zone 1 — Hub account
		this.hubAccountSection = DOM.append(this.scrollBody, DOM.$('.connection-zone.connection-hub-account'));
		this.hubAuthBadge = DOM.append(this.hubAccountSection, DOM.$('.connection-status.connection-hub-auth-badge'));
		this.hubAuthBadge.setAttribute('role', 'status');

		this.hubBaseUrlInput = this.createFieldInput(this.hubAccountSection, localize('ua.connectionHubBaseUrl', "Hub URL"), {
			type: 'url',
			placeholder: 'https://hub.example.com',
		}).input;
		this.hubEmailInput = this.createFieldInput(this.hubAccountSection, localize('ua.connectionHubEmail', "Email"), {
			type: 'email',
			placeholder: 'you@example.com',
		}).input;
		const passwordField = this.createFieldInput(this.hubAccountSection, HUB_PASSWORD_FIELD_LABEL, { type: 'password' });
		this.hubPasswordLabel = passwordField.label;
		this.hubPasswordInput = passwordField.input;
		const newPasswordField = this.createFieldInput(this.hubAccountSection, HUB_NEW_PASSWORD_FIELD_LABEL, {
			type: 'password',
			rowClass: 'connection-hub-new-password-row',
		});
		this.hubNewPasswordInput = newPasswordField.input;
		this.hubNewPasswordInput.inputElement.autocomplete = 'new-password';

		const hubMustChangeHint = DOM.append(this.hubAccountSection, DOM.$('.connection-hub-must-change-hint'));
		hubMustChangeHint.setAttribute('role', 'status');
		hubMustChangeHint.textContent = getHubMustChangePasswordHint();

		const hubActions = DOM.append(this.hubAccountSection, DOM.$('.connection-actions.connection-hub-actions'));
		this.hubLoginButton = this._register(new Button(hubActions, defaultButtonStyles));
		this.hubLoginButton.label = HUB_LOGIN_BUTTON_LABEL;
		this._register(this.hubLoginButton.onDidClick(() => this.handleLogin()));

		const logoutButton = this._register(new Button(hubActions, { ...defaultButtonStyles, secondary: true }));
		logoutButton.label = localize('ua.connectionHubLogout', "Sign out");
		this._register(logoutButton.onDidClick(() => this.handleLogout()));

		const refreshButton = this._register(new Button(hubActions, { ...defaultButtonStyles, secondary: true }));
		refreshButton.label = localize('ua.connectionHubRefreshDevices', "Refresh devices");
		this._register(refreshButton.onDidClick(() => this.refreshHubDirectory()));

		// Zone 2 — Device list
		this.hubDevicesSection = DOM.append(this.scrollBody, DOM.$('.connection-zone.connection-hub-devices'));
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
		this._register(this.hubDevicesList.onDidChangeSelection(() => this.updateDeviceActions()));

		this.deviceActionsRow = DOM.append(this.hubDevicesSection, DOM.$('.connection-actions.connection-hub-device-actions'));
		this.renameDeviceButton = this._register(new Button(this.deviceActionsRow, { ...defaultButtonStyles, secondary: true }));
		this.renameDeviceButton.label = localize('ua.connectionDeviceRename', "Rename");
		this._register(this.renameDeviceButton.onDidClick(() => void this.handleRenameSelectedDevice()));
		this.revokeDeviceButton = this._register(new Button(this.deviceActionsRow, { ...defaultButtonStyles, secondary: true }));
		this.revokeDeviceButton.label = localize('ua.connectionDeviceRevoke', "Revoke");
		this._register(this.revokeDeviceButton.onDidClick(() => void this.handleRevokeSelectedDevice()));
		this.rotateTokenButton = this._register(new Button(this.deviceActionsRow, { ...defaultButtonStyles, secondary: true }));
		this.rotateTokenButton.label = CONNECTION_DEVICE_ROTATE_TOKEN_LABEL;
		this._register(this.rotateTokenButton.onDidClick(() => void this.handleRotateSelectedDeviceToken()));

		this.pendingPairsHeading = DOM.append(this.hubDevicesSection, DOM.$('h4.connection-engine-pending-heading'));
		this.pendingPairsHeading.textContent = CONNECTION_DEVICE_PENDING_HEADING;
		this.pendingPairsEmpty = DOM.append(this.hubDevicesSection, DOM.$('.connection-engine-pending-empty'));
		this.pendingPairsEmpty.setAttribute('role', 'status');
		this.pendingPairsEmpty.textContent = CONNECTION_DEVICE_PENDING_EMPTY_COPY;
		this.pendingPairsList = DOM.append(this.hubDevicesSection, DOM.$('.connection-engine-pending-list'));
		this.pendingPairsList.setAttribute('role', 'list');

		const deviceCodeRow = DOM.append(this.hubDevicesSection, DOM.$('.connection-field-row.connection-hub-device-code'));
		DOM.append(deviceCodeRow, DOM.$('label')).textContent = localize('ua.connectionConfirmDeviceCodeLabel', "Device code");
		const deviceCodeHost = DOM.append(deviceCodeRow, $('.connection-field-input'));
		this.confirmDeviceCodeInput = this._register(new InputBox(deviceCodeHost, this.contextViewService, {
			placeholder: localize('ua.connectionConfirmDeviceCodePlaceholder', "Device code"),
			ariaLabel: localize('ua.connectionConfirmDeviceCodeAria', "Confirm device code"),
			inputBoxStyles: defaultInputBoxStyles,
		}));
		this.confirmDeviceCodeButton = this._register(new Button(deviceCodeRow, defaultButtonStyles));
		this.confirmDeviceCodeButton.label = localize('ua.connectionConfirmDeviceCode', "Confirm");
		this._register(this.confirmDeviceCodeButton.onDidClick(() => void this.handleConfirmDeviceCode()));
		this.rejectDevicePairButton = this._register(new Button(deviceCodeRow, { ...defaultButtonStyles, secondary: true }));
		this.rejectDevicePairButton.label = CONNECTION_DEVICE_PAIR_REJECT_LABEL;
		this._register(this.rejectDevicePairButton.onDidClick(() => void this.handleRejectDevicePair()));
		this.hubDeviceCodeStatus = DOM.append(this.hubDevicesSection, DOM.$('.connection-status.connection-hub-device-code-status'));
		this.hubDeviceCodeStatus.setAttribute('role', 'status');

		// Zone 2b — Direct Address (debug / fallback; no Hub ticket)
		this.directAddressSection = DOM.append(this.scrollBody, DOM.$('.connection-zone.connection-direct-address'));
		const directHint = DOM.append(this.directAddressSection, DOM.$('.connection-direct-address-hint'));
		directHint.textContent = localize(
			'ua.connectionDirectAddressHint',
			"Manual host and port for debugging or fallback. Private networks are blocked unless explicitly allowed.",
		);

		this.directHostInput = this.createFieldInput(this.directAddressSection, localize('ua.connectionDirectHost', "Host"), {
			placeholder: '203.0.113.10',
		}).input;
		this.directPortInput = this.createFieldInput(this.directAddressSection, localize('ua.connectionDirectPort', "Port"), {
			type: 'number',
			placeholder: '7443',
		}).input;
		this.directPortInput.inputElement.min = '1';
		this.directPortInput.inputElement.max = '65535';
		this.directNameInput = this.createFieldInput(this.directAddressSection, localize('ua.connectionDirectDisplayName', "Name"), {
			placeholder: localize('ua.connectionDirectDisplayNamePlaceholder', "Optional label"),
		}).input;

		const allowPrivateLabelText = localize('ua.connectionAllowPrivateNetwork', "Allow private / loopback networks");
		const directAllowRow = DOM.append(this.directAddressSection, DOM.$('.connection-field-row.connection-toggle-row'));
		this.directAllowPrivateCheckbox = this._register(new Checkbox(allowPrivateLabelText, false, defaultCheckboxStyles));
		this.directAllowPrivateCheckbox.domNode.id = 'connection-allow-private-network';
		DOM.append(directAllowRow, this.directAllowPrivateCheckbox.domNode);
		const allowLabel = DOM.append(directAllowRow, DOM.$('span.connection-toggle-label'));
		allowLabel.textContent = allowPrivateLabelText;
		this._register(DOM.addDisposableListener(allowLabel, DOM.EventType.CLICK, () => {
			this.directAllowPrivateCheckbox.checked = !this.directAllowPrivateCheckbox.checked;
			this.directAllowPrivateCheckbox.focus();
		}));

		const directActions = DOM.append(this.directAddressSection, DOM.$('.connection-actions.connection-direct-actions'));
		const connectDirectButton = this._register(new Button(directActions, defaultButtonStyles));
		connectDirectButton.label = localize('ua.connectionDirectConnect', "Connect");
		this._register(connectDirectButton.onDidClick(() => this.handleConnectDirectAddress()));

		const addDirectButton = this._register(new Button(directActions, { ...defaultButtonStyles, secondary: true }));
		addDirectButton.label = localize('ua.connectionDirectAdd', "Add");
		this._register(addDirectButton.onDidClick(() => this.handleAddDirectAddress()));

		this.directAddressStatus = DOM.append(this.directAddressSection, DOM.$('.connection-status.connection-direct-address-status'));
		this.directAddressStatus.setAttribute('role', 'status');

		// Zone 3 — Connection profiles
		this.profilesSection = DOM.append(this.scrollBody, DOM.$('.connection-zone.connection-profiles'));
		this.connectionPhaseLabel = DOM.append(this.profilesSection, DOM.$('.connection-status.connection-phase-label'));
		this.connectionPhaseLabel.setAttribute('role', 'status');
		this.emptyWelcome = DOM.append(this.profilesSection, DOM.$('.connection-empty-welcome'));
		this.emptyWelcome.textContent = getConnectionEmptyCopy();
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

		this.profileActionsRow = DOM.append(this.profilesSection, DOM.$('.connection-actions.connection-profile-actions'));
		const connectProfileButton = this._register(new Button(this.profileActionsRow, defaultButtonStyles));
		connectProfileButton.label = localize('ua.connectionProfileConnect', "Connect");
		this._register(connectProfileButton.onDidClick(() => this.handleConnectSelectedProfile()));

		const disconnectButton = this._register(new Button(this.profileActionsRow, { ...defaultButtonStyles, secondary: true }));
		disconnectButton.label = localize('ua.connectionProfileDisconnect', "Disconnect");
		this._register(disconnectButton.onDidClick(() => this.handleDisconnect()));

		const forgetButton = this._register(new Button(this.profileActionsRow, { ...defaultButtonStyles, secondary: true }));
		forgetButton.label = localize('ua.connectionProfileForget', "Forget this Engine");
		this._register(forgetButton.onDidClick(() => this.handleForgetSelectedProfile()));

		this._register(this.list.onDidChangeSelection(e => {
			const selected = e.elements[0];
			if (selected) {
				this.activeProfileId = selected.id;
			}
		}));

		// Zone 4 — Test Connection + Remote I/O hint
		this.testSection = DOM.append(this.scrollBody, DOM.$('.connection-zone.connection-test-section'));
		const testSection = this.testSection;
		const testRow = DOM.append(testSection, DOM.$('.connection-test-row'));
		const testButton = this._register(new Button(testRow, defaultButtonStyles));
		testButton.label = localize('ua.connectionTestActiveProfile', "Test active profile");
		this.testStatus = DOM.append(testRow, DOM.$('.connection-status.connection-test-status'));
		this.testStatus.setAttribute('role', 'status');
		this.testStatus.setAttribute('aria-live', 'polite');
		this._register(testButton.onDidClick(() => void this.handleTestConnection()));

		const remoteIoHint = DOM.append(testSection, DOM.$('.connection-remote-io-hint'));
		remoteIoHint.textContent = getConnectionRemoteIoHintCopy();

		this._register(this.navList.onDidChangeFocus(e => {
			if (this.syncingNav) {
				return;
			}
			const entry = e.elements[0] as typeof CONNECTION_ZONE_NAV_ENTRIES[number] | undefined;
			if (!entry) {
				return;
			}
			const available = this.getAvailableZoneEntries();
			const index = available.findIndex(item => item.id === entry.id);
			if (index >= 0 && this.navList.getSelection()[0] !== index) {
				this.navList.setSelection([index]);
			}
			this.selectZone(entry.id);
		}));
		this._register(this.navList.onDidChangeSelection(e => {
			if (this.syncingNav) {
				return;
			}
			const entry = e.elements[0] as typeof CONNECTION_ZONE_NAV_ENTRIES[number] | undefined;
			if (entry) {
				this.selectZone(entry.id);
			}
		}));
		this._register(this.navList.onDidOpen(e => {
			if (this.syncingNav) {
				return;
			}
			if (e.element) {
				this.selectZone((e.element as typeof CONNECTION_ZONE_NAV_ENTRIES[number]).id);
			}
		}));

		this._register(this.hubService.onDidChangeAuthStatus(() => {
			this.renderHubAccount();
			this.applyDesktopConnectionControlVisibility();
		}));
		this._register(this.hubService.onDidChangeDirectory(() => this.renderHubDirectory()));
		this._register(this.hubService.onDidChangeProfiles(() => this.renderProfiles()));
		this._register(this.connectionService.onDidChangeConnection(() => {
			this.renderConnectionPhase();
			this.applyDesktopConnectionControlVisibility();
			this.renderHubAccount();
			void this.refreshEngineDeviceLists();
		}));

		this.renderHubAccount();
		this.renderHubDirectory();
		this.updateDeviceActions();
		this.renderProfiles();
		this.renderConnectionPhase();
		this.applyDesktopConnectionControlVisibility();
		this.applyNarrowChrome();
		this.selectZone(this.activeZoneId);
		void this.initializeState();
		void this.refreshEngineDeviceLists();
	}

	private createFieldInput(
		parent: HTMLElement,
		labelText: string,
		options: { readonly type?: string; readonly placeholder?: string; readonly ariaLabel?: string; readonly rowClass?: string },
	): { readonly row: HTMLElement; readonly label: HTMLElement; readonly input: InputBox } {
		const row = DOM.append(parent, $(options.rowClass ? `.connection-field-row.${options.rowClass}` : '.connection-field-row'));
		const label = DOM.append(row, $('label'));
		label.textContent = labelText;
		const host = DOM.append(row, $('.connection-field-input'));
		const input = this._register(new InputBox(host, this.contextViewService, {
			type: options.type,
			placeholder: options.placeholder,
			ariaLabel: options.ariaLabel ?? labelText,
			inputBoxStyles: defaultInputBoxStyles,
		}));
		return { row, label, input };
	}

	private getZoneElement(id: ConnectionZoneId): HTMLElement {
		switch (id) {
			case 'hub': return this.hubAccountSection;
			case 'devices': return this.hubDevicesSection;
			case 'direct': return this.directAddressSection;
			case 'profiles': return this.profilesSection;
			case 'test': return this.testSection;
		}
	}

	private isZoneAvailable(id: ConnectionZoneId): boolean {
		return this.getZoneElement(id).style.display !== 'none';
	}

	private getAvailableZoneEntries(): typeof CONNECTION_ZONE_NAV_ENTRIES[number][] {
		return CONNECTION_ZONE_NAV_ENTRIES.filter(entry => this.isZoneAvailable(entry.id));
	}

	private refreshZoneNav(): void {
		const available = this.getAvailableZoneEntries();
		this.syncingNav = true;
		try {
			this.navList.splice(0, this.navList.length, available);
			const index = available.findIndex(entry => entry.id === this.activeZoneId);
			if (index >= 0) {
				this.navList.setFocus([index]);
				this.navList.setSelection([index]);
			}
		} finally {
			this.syncingNav = false;
		}
	}

	selectZone(id: ConnectionZoneId): void {
		this.activeZoneId = id;
		this.detailTitle.textContent = CONNECTION_ZONE_NAV_ENTRIES.find(entry => entry.id === id)?.label ?? '';
		if (this.lastLayoutWidth < PREFERENCES_PANE_NARROW_WIDTH) {
			this.narrowShowingDetail = true;
			this.container.classList.add('is-showing-detail');
			this.backButton.hidden = false;
		}
		for (const zoneId of ['hub', 'devices', 'direct', 'profiles', 'test'] as const) {
			this.getZoneElement(zoneId).classList.toggle('is-active-zone', zoneId === id);
		}
		this.layoutLists();
	}

	private showNarrowNav(): void {
		this.narrowShowingDetail = false;
		this.applyNarrowChrome();
		this.navList.layout(this.getNavHeight(this.lastLayoutHeight), this.getNavWidth(this.lastLayoutWidth));
		this.navList.domFocus();
	}

	private applyNarrowChrome(): void {
		const narrow = this.lastLayoutWidth < PREFERENCES_PANE_NARROW_WIDTH;
		const compact = this.lastLayoutWidth < PREFERENCES_PANE_COMPACT_WIDTH;
		if (!this.isZoneAvailable(this.activeZoneId)) {
			const fallback = (['hub', 'devices', 'direct', 'profiles', 'test'] as const).find(id => this.isZoneAvailable(id));
			if (fallback) {
				this.activeZoneId = fallback;
			}
		}
		this.detailTitle.textContent = CONNECTION_ZONE_NAV_ENTRIES.find(entry => entry.id === this.activeZoneId)?.label ?? '';
		this.container.classList.toggle('is-narrow', narrow);
		this.container.classList.toggle('is-compact', compact);
		this.container.classList.toggle('is-showing-detail', narrow && this.narrowShowingDetail);
		this.backButton.hidden = !(narrow && this.narrowShowingDetail);
		for (const id of ['hub', 'devices', 'direct', 'profiles', 'test'] as const) {
			this.getZoneElement(id).classList.toggle('is-active-zone', id === this.activeZoneId);
		}
		this.refreshZoneNav();
	}

	private desktopConnectionControlContext() {
		return {
			phase: this.connectionService.getConnectionPhase(),
			snapshot: this.connectionService.getConnectionSnapshot(),
			capabilities: ensureCapabilitySnapshot(this.connectionService.getCapabilitySnapshot()),
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
			this.applyNarrowChrome();
			return;
		}
		const hubSignedIn = this.hubService.getAuthStatus().kind !== 'signedOut';
		const enginePairSeat = this.connectionService.isEngineConnected();
		this.hubDevicesSection.style.display = hubSignedIn || enginePairSeat ? '' : 'none';
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
		const wasWide = this.lastLayoutWidth >= PREFERENCES_PANE_NARROW_WIDTH;
		this.lastLayoutWidth = dimension.width;
		this.lastLayoutHeight = dimension.height;
		if (dimension.width >= PREFERENCES_PANE_NARROW_WIDTH) {
			this.narrowShowingDetail = false;
		} else if (wasWide) {
			this.narrowShowingDetail = true;
		}
		this.applyNarrowChrome();
		this.navList.layout(this.getNavHeight(dimension.height), this.getNavWidth(dimension.width));
		this.layoutLists();
	}

	private getNavWidth(paneWidth: number): number {
		return paneWidth < PREFERENCES_PANE_NARROW_WIDTH
			? Math.max(0, paneWidth - 40)
			: 200;
	}

	private getNavHeight(paneHeight: number): number {
		return Math.max(120, paneHeight - 120);
	}

	private getDetailWidth(): number {
		if (this.lastLayoutWidth < PREFERENCES_PANE_NARROW_WIDTH) {
			return Math.max(0, this.lastLayoutWidth - 48);
		}
		return Math.max(240, this.lastLayoutWidth - 220 - 48);
	}

	private getDetailHeight(): number {
		return Math.max(160, this.lastLayoutHeight - 120);
	}

	private layoutLists(): void {
		const listHeight = Math.max(80, Math.min(220, this.getDetailHeight() - 120));
		const listWidth = this.getDetailWidth();
		this.hubDevicesList.layout(listHeight, listWidth);
		this.list.layout(listHeight, listWidth);
		this.hubBaseUrlInput.layout();
		this.hubEmailInput.layout();
		this.hubPasswordInput.layout();
		this.hubNewPasswordInput.layout();
		this.confirmDeviceCodeInput.layout();
		this.directHostInput.layout();
		this.directPortInput.layout();
		this.directNameInput.layout();
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
			writeStatus(this.hubAuthBadge, result.reason, 'error');
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
			writeStatus(this.hubAuthBadge, result.reason, 'error');
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
		await this.refreshEngineDeviceLists();
	}

	private async refreshEngineDeviceLists(): Promise<void> {
		await this.refreshEngineDevices();
		await this.refreshEnginePending();
	}

	private async refreshEngineDevices(): Promise<void> {
		const hook = this.connectionService.listDevices;
		if (!canSendConnectionDeviceListRequest(this.connectionService.isEngineConnected(), typeof hook === 'function') || !hook) {
			this.enginePairedDevices = undefined;
			this.renderHubDirectory();
			return;
		}
		try {
			const result = await hook.call(this.connectionService);
			this.enginePairedDevices = [...result.devices];
		} catch {
			this.enginePairedDevices = [];
		}
		this.renderHubDirectory();
	}

	private async refreshEnginePending(): Promise<void> {
		const hook = this.connectionService.listPending;
		if (!canSendConnectionDevicePairRequest(this.connectionService.isEngineConnected(), typeof hook === 'function') || !hook) {
			this.pendingPairs = [];
			this.selectedPending = undefined;
			this.renderPendingPairs();
			return;
		}
		try {
			const result = await hook.call(this.connectionService);
			this.pendingPairs = [...result.pending];
		} catch {
			this.pendingPairs = [];
		}
		this.selectedPending = undefined;
		this.renderPendingPairs();
	}

	private renderPendingPairs(): void {
		const hook = this.connectionService.listPending;
		const canList = canSendConnectionDevicePairRequest(this.connectionService.isEngineConnected(), typeof hook === 'function');
		this.pendingPairsHeading.style.display = canList ? '' : 'none';
		this.pendingPairsList.style.display = canList && this.pendingPairs.length > 0 ? '' : 'none';
		this.pendingPairsEmpty.style.display = canList && this.pendingPairs.length === 0 ? '' : 'none';
		this.pendingRowDisposables.clear();
		DOM.clearNode(this.pendingPairsList);
		if (!canList) {
			return;
		}
		for (const pending of this.pendingPairs) {
			const row = DOM.append(this.pendingPairsList, DOM.$('.connection-engine-pending-row'));
			row.setAttribute('role', 'listitem');
			row.tabIndex = 0;
			row.textContent = formatConnectionPendingPairLabel(pending);
			if (pending === this.selectedPending) {
				row.classList.add('selected');
				row.setAttribute('aria-current', 'true');
			}
			this.pendingRowDisposables.add(DOM.addDisposableListener(row, 'click', () => {
				this.selectedPending = pending;
				this.renderPendingPairs();
			}));
		}
	}

	private async handleAddDirectAddress(): Promise<void> {
		const host = this.directHostInput.value.trim();
		const port = Number(this.directPortInput.value);
		const displayName = this.directNameInput.value.trim() || undefined;
		const allowPrivateNetwork = this.directAllowPrivateCheckbox.checked;
		const result = await this.hubService.addDirectAddressProfile({ host, port, displayName, allowPrivateNetwork });
		if (!result.ok) {
			writeStatus(this.directAddressStatus, result.reason, 'error');
			return;
		}
		this.activeProfileId = result.profileId;
		writeStatus(this.directAddressStatus, localize('ua.connectionDirectAdded', "Direct address profile added."), 'success');
		this.renderProfiles();
	}

	private async handleConnectDirectAddress(): Promise<void> {
		const host = this.directHostInput.value.trim();
		const port = Number(this.directPortInput.value);
		if (!host || !Number.isInteger(port)) {
			writeStatus(this.directAddressStatus, localize('ua.connectionDirectInvalid', "Enter a valid host and port."), 'warning');
			return;
		}

		let profileId = this.activeProfileId;
		const profiles = asConnectionProfileList(this.hubService.listConnectionProfiles());
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
				writeStatus(this.directAddressStatus, added.reason, 'error');
				return;
			}
			profileId = added.profileId;
		}

		this.activeProfileId = profileId;
		writeStatus(this.directAddressStatus, localize('ua.connectionDirectConnecting', "Connecting…"));
		await this.connectProfileWithPairing(profileId);
		this.renderProfiles();
	}

	private async handleConnectSelectedProfile(): Promise<void> {
		if (!this.activeProfileId) {
			writeStatus(this.testStatus, localize('ua.connectionNoActiveProfile', "Select a connection profile first."), 'warning');
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
			writeStatus(this.testStatus, result.reason, 'error');
			return;
		}
		this.activeProfileId = undefined;
		this.renderProfiles();
		this.renderConnectionPhase();
	}

	private writeConnectStatus(text: string, tone: ConnectionStatusTone = 'neutral'): void {
		const target = this.activeZoneId === 'direct' ? this.directAddressStatus : this.testStatus;
		writeStatus(target, text, tone);
	}

	private async connectProfileWithPairing(profileId: string): Promise<void> {
		this.activeProfileId = profileId;
		const profiles = asConnectionProfileList(this.hubService.listConnectionProfiles());
		const profile = profiles.find(p => p.profileId === profileId);
		const result = await this.connectionService.connectProfile(profileId);
		if (!result.ok) {
			this.writeConnectStatus(result.reason, 'error');
			this.renderConnectionPhase();
			return;
		}
		const awaitingPairing = result.pairingPending || !!readHandshakeSasCode(result);
		if (result.ok && awaitingPairing) {
			const displayName = profile?.displayName ?? profileId;
			const engineIdentityId = result.engineIdentityId ?? profileId;
			if (isRecoverTrustConnectResult(result)) {
				const leafSha256Hex = readRecoverTrustLeafFingerprint(result);
				if (!leafSha256Hex) {
					this.writeConnectStatus(localize(
						'ua.connectionRecoverTrustMissingFingerprint',
						"Trust recovery requires the observed certificate fingerprint.",
					), 'error');
					await this.connectionService.cancelPairing();
				} else {
					const confirmed = await promptRecoverTrustConfirmDialog(this.dialogService, {
						displayName,
						engineIdentityId,
						leafSha256Hex,
					});
					if (confirmed.confirmed) {
						const confirmResult = await this.connectionService.confirmPairing();
						if (!confirmResult.ok) {
							this.writeConnectStatus(confirmResult.reason, 'error');
						}
					} else {
						await this.connectionService.cancelPairing();
					}
				}
			} else {
				const confirmed = await promptSasConfirmDialog(this.dialogService, {
					displayName,
					sasCode: readHandshakeSasCode(result),
					engineIdentityId,
				});
				if (confirmed.confirmed) {
					const confirmResult = await this.connectionService.confirmPairing();
					if (!confirmResult.ok) {
						this.writeConnectStatus(confirmResult.reason, 'error');
					}
				} else {
					await this.connectionService.cancelPairing();
				}
			}
		}
		this.renderConnectionPhase();
	}

	private async handleConnectDevice(device: HubDeviceProjection): Promise<void> {
		const result = await this.hubService.addHubDeviceProfile({
			hubDeviceId: device.id,
			displayName: device.name,
		});
		if (!result.ok) {
			this.writeConnectStatus(result.reason, 'error');
			return;
		}

		await this.connectProfileWithPairing(result.profileId);
		this.renderProfiles();
	}

	private getSelectedDevice(): HubDeviceProjection | undefined {
		return this.hubDevicesList.getSelectedElements()[0] ?? this.hubDevices[0];
	}

	private updateDeviceActions(): void {
		const device = this.getSelectedDevice();
		const hasDevice = !!device && !device.revoked;
		this.renameDeviceButton.enabled = hasDevice;
		this.revokeDeviceButton.enabled = !!device && !device.revoked;
		this.rotateTokenButton.enabled = canSendConnectionDeviceRotateToken(
			this.connectionService.isEngineConnected(),
			typeof this.connectionService.rotateToken === 'function',
		);
	}

	private async handleTestConnection(): Promise<void> {
		const testingCopy = localize('ua.connectionTestRunning', "Testing…");
		if (!this.activeProfileId) {
			if (typeof this.connectionService.probeEngine === 'function') {
				writeStatus(this.testStatus, testingCopy);
				const result = await this.connectionService.probeEngine();
				writeStatus(
					this.testStatus,
					formatConnectionProbeStatus(
						result,
						getConnectionTestStatusText(
							this.connectionService.getConnectionPhase(),
							this.connectionService.getConnectionSnapshot().pairingPending,
						),
					),
					result.ok ? 'success' : 'error',
				);
				return;
			}
			writeStatus(this.testStatus, getConnectionTestStatusText());
			return;
		}
		writeStatus(this.testStatus, testingCopy);
		const result = await this.connectionService.probeConnectionProfile(this.activeProfileId);
		writeStatus(this.testStatus, formatConnectionProbeStatus(result), result.ok ? 'success' : 'error');
	}

	private async handleRenameSelectedDevice(): Promise<void> {
		const device = this.getSelectedDevice();
		if (!device || device.revoked) {
			return;
		}
		const input = await this.dialogService.input({
			type: 'question',
			message: localize('ua.connectionRenameDeviceTitle', "Rename device"),
			inputs: [{ type: 'text', value: device.name, placeholder: localize('ua.connectionRenameDevicePlaceholder', "Device name") }],
			primaryButton: localize('ua.connectionRenameDeviceConfirm', "Rename"),
		});
		const name = input.confirmed ? input.values?.[0]?.trim() : undefined;
		if (!name || name === device.name) {
			return;
		}
		const result = await this.hubService.renameDevice(device.id, name);
		if (!result.ok) {
			this.hubDirectoryBanner.textContent = result.reason;
			this.hubDirectoryBanner.style.display = '';
			return;
		}
		await this.hubService.refreshDirectory();
	}

	private async handleRotateSelectedDeviceToken(): Promise<void> {
		const hook = this.connectionService.rotateToken;
		if (!canSendConnectionDeviceRotateToken(this.connectionService.isEngineConnected(), typeof hook === 'function') || !hook) {
			return;
		}
		const request = connectionDeviceRotateTokenIds(this.hubDevicesList.getSelectedElements()[0]);
		try {
			const result = await hook.call(this.connectionService, request);
			this.hubDirectoryBanner.textContent = result.message;
			this.hubDirectoryBanner.style.display = result.message ? '' : 'none';
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.hubDirectoryBanner.textContent = reason;
			this.hubDirectoryBanner.style.display = '';
		}
	}

	private async handleRevokeSelectedDevice(): Promise<void> {
		const device = this.getSelectedDevice();
		if (!device || device.revoked) {
			return;
		}
		const confirm = await this.dialogService.confirm({
			type: 'warning',
			message: localize('ua.connectionRevokeDeviceTitle', "Revoke {0}?", device.name),
			detail: localize(
				'ua.connectionRevokeDeviceDetail',
				"This device will no longer connect through the Hub. Local paired profiles will be marked as Revoked.",
			),
			primaryButton: localize('ua.connectionRevokeDeviceConfirm', "Revoke"),
		});
		if (!confirm.confirmed) {
			return;
		}
		const revokeHook = this.connectionService.revoke;
		if (canSendConnectionDeviceRevokeRequest(this.connectionService.isEngineConnected(), typeof revokeHook === 'function') && revokeHook) {
			const request = connectionDeviceRevokeIds(device.id);
			try {
				const result = await revokeHook.call(this.connectionService, request);
				this.hubDirectoryBanner.textContent = result.message;
				this.hubDirectoryBanner.style.display = '';
				if (result.success) {
					await this.hubService.refreshDirectory();
					this.renderProfiles();
				}
			} catch (error) {
				const reason = error instanceof Error && error.message ? error.message : String(error);
				this.hubDirectoryBanner.textContent = reason;
				this.hubDirectoryBanner.style.display = '';
			}
			return;
		}
		const result = await this.hubService.revokeDevice(device.id);
		if (!result.ok) {
			this.hubDirectoryBanner.textContent = result.reason;
			this.hubDirectoryBanner.style.display = '';
			return;
		}
		await this.hubService.refreshDirectory();
		this.renderProfiles();
	}

	private async handleConfirmDeviceCode(): Promise<void> {
		const approveHook = this.connectionService.pairApprove;
		if (canSendConnectionDevicePairRequest(this.connectionService.isEngineConnected(), typeof approveHook === 'function') && approveHook) {
			const request = connectionDevicePairIds(this.confirmDeviceCodeInput.value, this.selectedPending);
			try {
				const result = await approveHook.call(this.connectionService, request);
				writeStatus(this.hubDeviceCodeStatus, result.message, result.success ? 'success' : 'error');
				if (result.success) {
					this.confirmDeviceCodeInput.value = '';
					await this.refreshEngineDeviceLists();
				}
			} catch (error) {
				const reason = error instanceof Error && error.message ? error.message : String(error);
				writeStatus(this.hubDeviceCodeStatus, reason, 'error');
			}
			return;
		}
		const code = this.confirmDeviceCodeInput.value.trim();
		if (!code) {
			writeStatus(this.hubDeviceCodeStatus, localize('ua.connectionConfirmDeviceCodeEmpty', "Enter a device code first."), 'warning');
			return;
		}
		const result = await this.hubService.confirmDeviceCode(code);
		writeStatus(
			this.hubDeviceCodeStatus,
			result.ok ? localize('ua.connectionConfirmDeviceCodeOk', "Device code confirmed") : result.reason,
			result.ok ? 'success' : 'error',
		);
		if (result.ok) {
			this.confirmDeviceCodeInput.value = '';
			await this.hubService.refreshDirectory();
		}
	}

	private async handleRejectDevicePair(): Promise<void> {
		const rejectHook = this.connectionService.pairReject;
		if (!canSendConnectionDevicePairRequest(this.connectionService.isEngineConnected(), typeof rejectHook === 'function') || !rejectHook) {
			return;
		}
		const request = { pairingCode: connectionDevicePairIds(this.confirmDeviceCodeInput.value, this.selectedPending).pairingCode };
		try {
			const result = await rejectHook.call(this.connectionService, request);
			writeStatus(this.hubDeviceCodeStatus, result.message, result.success ? 'success' : 'error');
			if (result.success) {
				this.confirmDeviceCodeInput.value = '';
				await this.refreshEngineDeviceLists();
			}
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			writeStatus(this.hubDeviceCodeStatus, reason, 'error');
		}
	}

	private renderHubAccount(): void {
		const status = this.hubService.getAuthStatus();
		writeStatus(this.hubAuthBadge, getHubAuthStatusLabel(status), getHubAuthStatusTone(status));
		const mustChangePassword = status.kind === 'mustChangePassword';
		const signedIn = status.kind === 'signedIn';
		this.hubAccountSection.classList.toggle('must-change-password', mustChangePassword);
		this.hubEmailInput.setEnabled(!(signedIn || mustChangePassword));
		this.hubPasswordInput.setEnabled(!signedIn);
		this.hubPasswordLabel.textContent = mustChangePassword
			? HUB_CURRENT_PASSWORD_FIELD_LABEL
			: HUB_PASSWORD_FIELD_LABEL;
		this.hubNewPasswordInput.setEnabled(mustChangePassword);
		this.hubLoginButton.label = mustChangePassword
			? HUB_CHANGE_PASSWORD_BUTTON_LABEL
			: HUB_LOGIN_BUTTON_LABEL;
		this.hubLoginButton.enabled = !signedIn;
		const deviceCodeEnabled = signedIn
			|| canSendConnectionDevicePairRequest(this.connectionService.isEngineConnected(), typeof this.connectionService.pairApprove === 'function');
		this.confirmDeviceCodeInput.setEnabled(deviceCodeEnabled);
		this.confirmDeviceCodeButton.enabled = deviceCodeEnabled;
		this.rejectDevicePairButton.enabled = canSendConnectionDevicePairRequest(
			this.connectionService.isEngineConnected(),
			typeof this.connectionService.pairReject === 'function',
		);
	}

	private renderHubDirectory(): void {
		const directory = this.hubService.getDirectoryStatus();
		const banner = getHubDirectoryBannerLabel(directory);
		this.hubDirectoryBanner.textContent = banner ?? '';
		this.hubDirectoryBanner.style.display = banner ? '' : 'none';

		if (this.enginePairedDevices !== undefined) {
			this.hubDevices = this.enginePairedDevices.map(toConnectionPairedDevice);
		} else if (directory.kind === 'ok') {
			this.hubDevices = [...directory.devices];
		} else {
			this.hubDevices = [];
		}
		this.hubDevicesList.splice(0, this.hubDevicesList.length, this.hubDevices);
		this.updateDeviceActions();
		if (shouldDrawDesktopConnectionControls(this.desktopConnectionControlContext())) {
			const hubSignedIn = this.hubService.getAuthStatus().kind !== 'signedOut';
			const enginePairSeat = this.connectionService.isEngineConnected();
			this.hubDevicesSection.style.display = hubSignedIn || enginePairSeat ? '' : 'none';
		}
		this.updateDeviceActions();
	}

	private renderProfiles(): void {
		const profiles = asConnectionProfileList(this.hubService.listConnectionProfiles());
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
		const pairingPending = this.connectionService.getConnectionSnapshot().pairingPending;
		writeStatus(
			this.connectionPhaseLabel,
			getConnectionPhasePaneLabel(this.connectionPhase, pairingPending),
			getConnectionPhaseTone(this.connectionPhase, pairingPending),
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
