/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/connectionPreferencesPane.css';
import * as DOM from '../../../../base/browser/dom.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { type HubDeviceProjection, IUniverseAgentHubService } from '../../../../platform/universeAgent/common/hub.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { IPreferencesEditorPane } from '../../preferences/browser/preferencesEditorRegistry.js';
import { onDidRevealConnectionProfiles } from '../common/uaPreferencesPanes.js';
import type { ConnectionStatusTone } from './connectionPreferencesPaneLabels.js';
import { applyConnectionPaneIdentityStripReservation } from './connectionPaneIdentityStripReservation.js';
import { promptRecoverTrustConfirmInPane, promptSasConfirmInPane } from './connectionPreferencesPaneSas.js';
import { ConnectionPreferencesDevices } from './connectionPreferencesDevices.js';
import { ConnectionPreferencesDirect } from './connectionPreferencesDirect.js';
import { ConnectionPreferencesHub } from './connectionPreferencesHub.js';
import { ConnectionPreferencesProfiles } from './connectionPreferencesProfiles.js';
import { ConnectionPreferencesTest } from './connectionPreferencesTest.js';
import { ConnectionProfileFlow, readDirectAddressPort } from './connectionProfileFlow.js';
import {
	getUnsupportedEnvironmentCopy,
	PREFERENCES_PANE_COMPACT_WIDTH,
	PREFERENCES_PANE_NARROW_WIDTH,
} from './engineSectionChrome.js';
import { shouldDrawDesktopConnectionZones, writeStatus } from './connectionPreferencesZone.js';

const $ = DOM.$;

export type { IConnectionProfileEntry } from './connectionPreferencesProfiles.js';
export type { ConnectProfileDiagnosticExtras } from './connectionProfileFlow.js';
export { directAddressEndpointLabel, findDirectAddressProfilesForEndpoint, formatConnectProfileDiagnostics, formatConnectProfileStatusText, readDirectAddressPort } from './connectionProfileFlow.js';
export { formatConnectionProbeStatus, getConnectionEmptyCopy, getConnectionRemoteIoHintCopy, getConnectionTestStatusText, writeStatus } from './connectionPreferencesZone.js';

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
		return 32;
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

export class ConnectionPreferencesPane extends Disposable implements IPreferencesEditorPane {

	private readonly container: HTMLElement;
	private readonly hub: ConnectionPreferencesHub;
	private readonly direct: ConnectionPreferencesDirect;
	private readonly profiles: ConnectionPreferencesProfiles;
	private readonly devices: ConnectionPreferencesDevices;
	/** In-pane pairing confirm host — attached to the Connect-initiating zone, not profiles-only. */
	private readonly pairingConfirmHost: HTMLElement;
	private readonly test: ConnectionPreferencesTest;
	private readonly environmentNotice: HTMLElement;
	private readonly backButton: HTMLButtonElement;
	private readonly navHost: HTMLElement;
	private readonly navList: WorkbenchList<typeof CONNECTION_ZONE_NAV_ENTRIES[number]>;
	private readonly detail: HTMLElement;
	private readonly detailTitle: HTMLElement;
	private readonly detailHeader: HTMLElement;
	private readonly scrollBody: HTMLElement;
	private lastLayoutWidth = 900;
	private lastLayoutHeight = 480;
	private narrowShowingDetail = false;
	private syncingNav = false;
	private activeZoneId: ConnectionZoneId = 'hub';
	private activeProfileId: string | undefined;
	private readonly flow: ConnectionProfileFlow;

	constructor(
		@IInstantiationService instantiationService: IInstantiationService,
		@IUniverseAgentHubService private readonly hubService: IUniverseAgentHubService,
		@IUniverseAgentConnection private readonly connectionService: IUniverseAgentConnection,
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
		this.detailHeader = DOM.append(this.detail, $('.connection-preferences-detail-header'));
		this.backButton = DOM.append(this.detailHeader, $('button.connection-preferences-back')) as HTMLButtonElement;
		this.backButton.type = 'button';
		this.backButton.textContent = localize('ua.connectionPreferencesBack', "Back");
		this.backButton.setAttribute('aria-label', localize('ua.connectionPreferencesBackAria', "Back to Connection sections"));
		this.backButton.hidden = true;
		this._register(DOM.addDisposableListener(this.backButton, 'click', () => this.showNarrowNav()));
		this.detailTitle = DOM.append(this.detailHeader, $('h3.connection-preferences-detail-title'));

		this.scrollBody = DOM.append(this.detail, $('.connection-preferences-detail-body'));

		this.flow = this._register(instantiationService.createInstance(ConnectionProfileFlow, {
			getActiveProfileId: () => this.activeProfileId,
			setActiveProfileId: profileId => {
				this.activeProfileId = profileId;
			},
			readDirectAddressForm: () => this.readDirectAddressForm(),
			readDirectProfileFields: () => ({
				displayName: this.direct.directNameInput.value.trim() || undefined,
				allowPrivateNetwork: this.direct.directAllowPrivateCheckbox.checked,
			}),
			writeConnectStatus: (text, tone) => this.writeConnectStatus(text, tone),
			writeDirectStatus: (text, tone) => writeStatus(this.direct.status, text, tone),
			updateConnectGates: () => this.updateConnectGates(),
			renderProfiles: () => this.renderProfiles(),
			renderConnectionPhase: () => this.renderConnectionPhase(),
			isPairingConfirmHostLive: () => this.isPairingConfirmHostLive(),
			isDeviceWritePairingHold: () => this.devices.isDeviceWritePairingHold(),
			isDeviceWriteListFailed: () => this.devices.isDeviceWriteListFailed(),
			isPendingWriteListFailed: () => this.devices.isPendingWriteListFailed(),
			promptSasConfirm: options => this.awaitInPanePairingPrompt(promptSasConfirmInPane(this.pairingConfirmHost, options)),
			promptRecoverTrustConfirm: options => this.awaitInPanePairingPrompt(promptRecoverTrustConfirmInPane(this.pairingConfirmHost, options)),
		}));

		// Zone 1 — Hub account
		this.hub = this._register(instantiationService.createInstance(ConnectionPreferencesHub, this.scrollBody, {
			renderHubAccount: () => this.renderHubAccount(),
			refreshHubDirectory: () => this.refreshHubDirectory(),
		}));

		// Zone 2 — Device list
		this.devices = this._register(instantiationService.createInstance(ConnectionPreferencesDevices, this.scrollBody, {
			isConnectWriteHeld: () => this.isConnectWriteHeld(),
			writeHoldReason: () => this.writeHoldReason(),
			handleConnectDevice: device => this.handleConnectDevice(device),
			renderHubAccount: () => this.renderHubAccount(),
			renderProfiles: () => this.renderProfiles(),
			layoutLists: () => this.layoutLists(),
			applyNarrowChrome: () => this.applyNarrowChrome(),
		}));

		// Zone 2b — Direct Address (debug / fallback; no Hub ticket)
		this.direct = this._register(instantiationService.createInstance(ConnectionPreferencesDirect, this.scrollBody, {
			handleConnectDirectAddress: () => this.handleConnectDirectAddress(),
			handleAddDirectAddress: () => this.handleAddDirectAddress(),
		}));

		// Zone 3 — Connection profiles
		this.profiles = this._register(instantiationService.createInstance(ConnectionPreferencesProfiles, this.scrollBody, {
			getActiveProfileId: () => this.activeProfileId,
			selectActiveProfile: profileId => {
				this.activeProfileId = profileId;
				this.test.invalidateProfileProbe();
			},
			setActiveProfileId: profileId => {
				this.activeProfileId = profileId;
			},
			getConnectedProfileId: () => this.flow.getSettledProfileId(),
			layoutLists: () => this.layoutLists(),
			handleConnectSelectedProfile: () => this.handleConnectSelectedProfile(),
			handleDisconnect: () => this.handleDisconnect(),
			handleForgetSelectedProfile: () => this.handleForgetSelectedProfile(),
		}));

		// Zone 4 — Test Connection + Remote I/O hint
		this.test = this._register(instantiationService.createInstance(ConnectionPreferencesTest, this.scrollBody, {
			getActiveProfileId: () => this.activeProfileId,
		}));

		// Sibling of zones so inactive-zone `display:none` cannot swallow the SAS box.
		this.pairingConfirmHost = DOM.append(this.scrollBody, DOM.$('.connection-pairing-confirm-host'));
		this.pairingConfirmHost.style.display = 'none';
		this.pairingConfirmHost.setAttribute('aria-live', 'polite');

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
		this._register(this.hubService.onDidChangeDirectory(() => this.devices.renderHubDirectory()));
		this._register(this.hubService.onDidChangeProfiles(() => this.renderProfiles()));
		this._register(this.connectionService.onDidChangeConnection(() => {
			this.renderConnectionPhase();
			this.renderProfiles();
			this.applyDesktopConnectionControlVisibility();
			this.renderHubAccount();
			void this.refreshEngineDeviceLists().catch(onUnexpectedError);
		}));

		this.renderHubAccount();
		this.devices.renderHubDirectory();
		this.devices.updateDeviceActions();
		this.renderProfiles();
		this.renderConnectionPhase();
		this.applyDesktopConnectionControlVisibility();
		this.applyNarrowChrome();
		this.selectZone(this.activeZoneId);
		this._register(onDidRevealConnectionProfiles(() => this.revealProfilesZone()));
		const resizeObserver = this._register(new DOM.DisposableResizeObserver(
			'ConnectionPreferencesPane.content', () => {
				if (this._store.isDisposed) {
					return;
				}
				if (!(this.lastLayoutWidth < PREFERENCES_PANE_NARROW_WIDTH && this.narrowShowingDetail)) {
					this.navList.layout(this.getNavHeight(this.lastLayoutHeight), this.getNavWidth(this.lastLayoutWidth));
				}
				this.layoutLists();
			}, DOM.getWindow(this.container),
		));
		this._register(resizeObserver.observe(this.navHost));
		this._register(resizeObserver.observe(this.scrollBody));
		void this.hub.initializeState().catch(onUnexpectedError);
		void this.refreshEngineDeviceLists().catch(onUnexpectedError);
	}

	private getZoneElement(id: ConnectionZoneId): HTMLElement {
		switch (id) {
			case 'hub': return this.hub.element;
			case 'devices': return this.devices.element;
			case 'direct': return this.direct.element;
			case 'profiles': return this.profiles.element;
			case 'test': return this.test.element;
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

	private revealProfilesZone(): void {
		if (!this.isZoneAvailable('profiles')) {
			return;
		}
		this.selectZone('profiles');
		this.refreshZoneNav();
	}

	selectZone(id: ConnectionZoneId): void {
		const focusNarrowDetailBackButton = this.lastLayoutWidth < PREFERENCES_PANE_NARROW_WIDTH
			&& !this.narrowShowingDetail
			&& this.navHost.contains(this.navHost.ownerDocument.activeElement);
		this.activeZoneId = id;
		const index = this.getAvailableZoneEntries().findIndex(entry => entry.id === id);
		if (index >= 0 && (this.navList.getSelection()[0] !== index || this.navList.getFocus()[0] !== index)) {
			this.syncingNav = true;
			try {
				if (this.navList.getSelection()[0] !== index) {
					this.navList.setSelection([index]);
				}
				if (this.navList.getFocus()[0] !== index) {
					this.navList.setFocus([index]);
				}
			} finally {
				this.syncingNav = false;
			}
		}
		this.detailTitle.textContent = CONNECTION_ZONE_NAV_ENTRIES.find(entry => entry.id === id)?.label ?? '';
		if (this.lastLayoutWidth < PREFERENCES_PANE_NARROW_WIDTH) {
			this.narrowShowingDetail = true;
			this.container.classList.add('is-showing-detail');
			this.backButton.hidden = false;
			if (focusNarrowDetailBackButton) {
				// The nav is hidden by CSS as soon as the detail opens. Move focus after
				// the list selection settles so keyboard users do not remain on a hidden row.
				queueMicrotask(() => {
					if (this.narrowShowingDetail && !this.backButton.hidden) {
						this.backButton.focus();
					}
				});
			}
		}
		for (const zoneId of ['hub', 'devices', 'direct', 'profiles', 'test'] as const) {
			this.getZoneElement(zoneId).classList.toggle('is-active-zone', zoneId === id);
		}
		this.layoutLists();
		this.syncPairingConfirmHostParent();
	}

	private showNarrowNav(): void {
		this.narrowShowingDetail = false;
		this.applyNarrowChrome();
		this.navList.layout(this.getNavHeight(this.lastLayoutHeight), this.getNavWidth(this.lastLayoutWidth));
		if (this.isPairingConfirmHostLive()) {
			this.revealAndFocusPairingConfirm();
			return;
		}
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
		this.container.classList.toggle('is-mid', narrow && !compact);
		this.container.classList.toggle('is-showing-detail', narrow && this.narrowShowingDetail);
		this.backButton.hidden = !(narrow && this.narrowShowingDetail);
		for (const id of ['hub', 'devices', 'direct', 'profiles', 'test'] as const) {
			this.getZoneElement(id).classList.toggle('is-active-zone', id === this.activeZoneId);
		}
		this.refreshZoneNav();
		this.syncPairingConfirmHostParent();
	}

	private applyDesktopConnectionControlVisibility(): void {
		const drawDesktop = shouldDrawDesktopConnectionZones(this.connectionService);
		this.hub.element.style.display = drawDesktop ? '' : 'none';
		this.direct.element.style.display = drawDesktop ? '' : 'none';
		this.test.element.style.display = drawDesktop ? '' : 'none';
		this.environmentNotice.style.display = drawDesktop ? 'none' : '';
		this.profiles.syncProfileActionsVisibility();
		if (!drawDesktop) {
			this.devices.hide();
			this.applyNarrowChrome();
			return;
		}
		this.devices.syncHubDevicesSectionVisibility();
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	layout(dimension: DOM.Dimension): void {
		this.container.style.height = `${dimension.height}px`;
		const wasWide = this.lastLayoutWidth >= PREFERENCES_PANE_NARROW_WIDTH;
		const focusNarrowDetailBackButton = wasWide && this.navHost.contains(this.navHost.ownerDocument.activeElement);
		this.lastLayoutWidth = dimension.width;
		this.lastLayoutHeight = dimension.height;
		if (dimension.width >= PREFERENCES_PANE_NARROW_WIDTH) {
			this.narrowShowingDetail = false;
		} else if (wasWide) {
			this.narrowShowingDetail = true;
			if (focusNarrowDetailBackButton) {
				// The nav is hidden by CSS when a wide pane collapses. Move focus after
				// the layout settles so keyboard users do not remain on a hidden row.
				queueMicrotask(() => {
					if (this.narrowShowingDetail && !this.backButton.hidden) {
						this.backButton.focus();
					}
				});
			}
		}
		this.applyNarrowChrome();
		this.navList.layout(this.getNavHeight(dimension.height), this.getNavWidth(dimension.width));
		this.layoutLists();
		applyConnectionPaneIdentityStripReservation(this.container);
	}

	onDidShow(): void {
		const pairingPending = !!this.connectionService.getConnectionSnapshot().pairingPending;
		const narrowNav = this.lastLayoutWidth < PREFERENCES_PANE_NARROW_WIDTH && !this.narrowShowingDetail;
		if (pairingPending && this.activeZoneId === 'hub' && !narrowNav) {
			this.selectZone(this.inferPairingZone());
		}
		if (this.isPairingConfirmHostLive()) {
			this.revealAndFocusPairingConfirm();
		}
	}

	private inferPairingZone(): ConnectionZoneId {
		const phase = this.connectionService.getConnectionPhase();
		if (phase.kind === 'connected') {
			if (phase.path === 'direct' || phase.path === 'loopback') {
				return 'direct';
			}
			if (phase.path === 'hubRelay') {
				return 'devices';
			}
		}
		return 'profiles';
	}

	private revealAndFocusPairingConfirm(): void {
		this.syncPairingConfirmHostParent();
		this.navList.layout(this.getNavHeight(this.lastLayoutHeight), this.getNavWidth(this.lastLayoutWidth));
		if (typeof this.pairingConfirmHost.scrollIntoView === 'function') {
			this.pairingConfirmHost.scrollIntoView({ block: 'nearest' });
		}
		const button = this.pairingConfirmHost.querySelector('.monaco-button') as HTMLElement | null;
		const dialog = this.pairingConfirmHost.querySelector('.monaco-dialog-box') as HTMLElement | null;
		(button ?? dialog)?.focus();
	}

	private getNavWidth(paneWidth: number): number {
		const measured = DOM.getContentWidth(this.navHost);
		if (measured > 0) {
			return measured;
		}
		if (paneWidth >= PREFERENCES_PANE_NARROW_WIDTH) {
			return 216; // 240px navigation column, with 12px inset on each side.
		}
		const stacked = Math.max(0, paneWidth - (paneWidth < PREFERENCES_PANE_COMPACT_WIDTH ? 20 : 0));
		return paneWidth >= PREFERENCES_PANE_COMPACT_WIDTH ? Math.min(256, stacked) : stacked;
	}

	private getNavHeight(paneHeight: number): number {
		const measured = DOM.getContentHeight(this.navHost);
		if (measured > 0) {
			return measured;
		}
		const sasReserve = this.pairingConfirmHost.parentElement === this.container && this.isPairingConfirmHostLive()
			? this.pairingConfirmHost.offsetHeight
			: 0;
		return Math.max(32, paneHeight - 32 - sasReserve);
	}

	private getDetailWidth(): number {
		const measured = DOM.getContentWidth(this.scrollBody);
		if (measured > 0) {
			return measured;
		}
		const navigation = this.lastLayoutWidth >= PREFERENCES_PANE_NARROW_WIDTH ? 240 : 0;
		return Math.max(0, Math.min(760, this.lastLayoutWidth - navigation - 32));
	}

	private getDetailHeight(): number {
		const measured = DOM.getContentHeight(this.scrollBody);
		if (measured > 0) {
			return measured;
		}
		return Math.max(80, this.lastLayoutHeight - DOM.getTotalHeight(this.detailHeader) - 80);
	}

	private layoutLists(): void {
		const budget = Math.max(32, Math.min(224, this.getDetailHeight() - 120));
		this.devices.layout(budget, () => this.getDetailWidth());
		this.profiles.layoutList(budget, () => this.getDetailWidth());
		this.hub.layout();
		this.direct.layout();
	}

	search(_text: string): void {
		// Header search disabled for this pane family.
	}

	override dispose(): void {
		this.container.remove();
		super.dispose();
	}

	private isConnectWriteHeld(): boolean {
		return this.flow.isConnectWriteHeld();
	}

	private updateConnectGates(): void {
		const held = this.isConnectWriteHeld();
		this.direct.presentConnectGate(!held, this.writeHoldReason());
		this.profiles.presentConnectGate(
			!held && !!this.activeProfileId,
			held
				? this.writeHoldReason()
				: localize('ua.connectionProfileSelectFirst', "Select a profile first."),
		);
		this.devices.refreshConnectButtons();
	}

	private readDirectAddressForm(): { host: string; port: number } | undefined {
		const host = this.direct.directHostInput.value.trim();
		const port = readDirectAddressPort(this.direct.directPortInput.value);
		if (!host || port === undefined) {
			writeStatus(this.direct.status, localize('ua.connectionDirectInvalid', "Enter a valid host and port."), 'warning');
			return undefined;
		}
		return { host, port };
	}

	private async handleAddDirectAddress(): Promise<void> {
		const endpoint = this.readDirectAddressForm();
		if (!endpoint) {
			return;
		}
		const { host, port } = endpoint;
		const displayName = this.direct.directNameInput.value.trim() || undefined;
		const allowPrivateNetwork = this.direct.directAllowPrivateCheckbox.checked;
		try {
			const result = await this.hubService.addDirectAddressProfile({ host, port, displayName, allowPrivateNetwork });
			if (!result.ok) {
				writeStatus(this.direct.status, result.reason, 'error');
				return;
			}
			this.activeProfileId = result.profileId;
			writeStatus(this.direct.status, localize('ua.connectionDirectAdded', "Direct address profile added."), 'success');
			this.renderProfiles();
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			writeStatus(this.direct.status, reason, 'error');
		}
	}

	private handleConnectDirectAddress(): Promise<void> {
		return this.flow.connectDirectAddress();
	}

	private handleConnectSelectedProfile(): Promise<void> {
		return this.flow.connectSelectedProfile();
	}

	private handleDisconnect(): Promise<void> {
		return this.flow.disconnect();
	}

	private handleForgetSelectedProfile(): Promise<void> {
		return this.flow.forgetSelectedProfile();
	}

	private getVisibleConnectStatusTarget(): HTMLElement {
		switch (this.activeZoneId) {
			case 'direct':
				return this.direct.status;
			case 'devices':
				return this.devices.connectStatus;
			case 'profiles':
				return this.profiles.status;
			case 'hub':
				return this.hub.connectStatus;
			case 'test':
				return this.test.status;
		}
	}

	private writeConnectStatus(text: string, tone: ConnectionStatusTone = 'neutral'): void {
		writeStatus(this.getVisibleConnectStatusTarget(), text, tone);
	}

	/** Live host: SAS / recoverTrust is mounted — remount on liveness, not `sasCode`. */
	private isPairingConfirmHostLive(): boolean {
		return this.pairingConfirmHost.classList.contains('connection-pairing-confirm')
			|| !!this.pairingConfirmHost.querySelector('.connection-pairing-confirm, .monaco-dialog-box');
	}

	/**
	 * Remount only. Never calls `selectZone`. Narrow nav + live host → pane
	 * root (outside `.connection-preferences-detail`); otherwise zone sibling.
	 */
	private syncPairingConfirmHostParent(): void {
		const live = this.isPairingConfirmHostLive();
		const narrow = this.lastLayoutWidth < PREFERENCES_PANE_NARROW_WIDTH;
		if (live && narrow && !this.narrowShowingDetail) {
			if (this.pairingConfirmHost.parentElement !== this.container) {
				this.container.appendChild(this.pairingConfirmHost);
			}
			return;
		}
		const zone = this.isZoneAvailable(this.activeZoneId)
			? this.getZoneElement(this.activeZoneId)
			: undefined;
		if (zone) {
			if (this.pairingConfirmHost.previousElementSibling !== zone) {
				zone.after(this.pairingConfirmHost);
			}
		} else if (this.pairingConfirmHost.parentElement !== this.scrollBody) {
			this.scrollBody.appendChild(this.pairingConfirmHost);
		}
	}

	/** Remount the live host, then wait. The prompt renders before this method runs. */
	private awaitInPanePairingPrompt<T>(pending: Promise<T>): Promise<T> {
		this.syncPairingConfirmHostParent();
		this.revealAndFocusPairingConfirm();
		return pending;
	}

	private connectProfileWithPairing(profileId: string, options?: { readonly skipEngineSwitchConfirm?: boolean }): Promise<void> {
		return this.flow.connectProfileWithPairing(profileId, options);
	}

	private async handleConnectDevice(device: HubDeviceProjection): Promise<void> {
		if (!this.devices.canConnectDevice(device)) {

			return;
		}
		try {
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
		} catch (error) {
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.writeConnectStatus(reason, 'error');
		}
	}

	private writeHoldReason(): string {
		return this.flow.writeHoldReason();
	}

	private refreshHubDirectory(): Promise<void> {
		return this.devices.refreshHubDirectory();
	}

	private refreshEngineDeviceLists(): Promise<boolean> {
		return this.devices.refreshEngineDeviceLists();
	}

	private renderHubAccount(): void {
		this.hub.render();
		this.devices.renderPairActions();
	}

	private renderProfiles(): void {
		this.profiles.render();
	}

	private renderConnectionPhase(): void {
		this.profiles.renderConnectionPhase();
		this.updateConnectGates();
	}
}
