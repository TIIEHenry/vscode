/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { InputBox } from '../../../../base/browser/ui/inputbox/inputBox.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { defaultButtonStyles, defaultInputBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { type HubDeviceProjection, type HubDirectoryStatus, IUniverseAgentHubService } from '../../../../platform/universeAgent/common/hub.js';
import { conversationEntryHookPresent } from '../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { readPublishedEngineIdentityId, readPublishedLinkId } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import type { UniverseAgentConversationEntryCapability, UniverseAgentDeviceInfo, UniverseAgentPendingPairInfo } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import {
	canSendConnectionDeviceRotateToken,
	CONNECTION_DEVICE_LIST_FEATURE,
	CONNECTION_DEVICE_ROTATE_TOKEN_LABEL,
	connectionDeviceListFailureMessage,
	connectionDeviceRevokeFailureMessage,
	connectionDeviceRotateTokenFailureMessage,
	connectionDeviceRotateTokenIds,
	toConnectionPairedDevice,
} from './connectionDeviceList.js';
import {
	canSendConnectionDevicePairRequest,
	CONNECTION_DEVICE_PAIR_REJECT_LABEL,
	CONNECTION_DEVICE_PENDING_EMPTY_COPY,
	CONNECTION_DEVICE_PENDING_HEADING,
	CONNECTION_DEVICE_PENDING_LIST_FEATURE,
	connectionDevicePairIds,
	connectionDevicePendingListFailureMessage,
	formatConnectionPendingPairLabel,
} from './connectionDevicePair.js';
import {
	canSendConnectionDeviceRevokeRequest,
	connectionDeviceRevokeIds,
} from './connectionDeviceRevoke.js';
import {
	canConnectHubDevice,
	getHubDeviceRowStatusLabel,
	getHubDirectoryBannerLabel,
} from './connectionPreferencesPaneLabels.js';
import { layoutConnectionList, presentConnectionAction, shouldDrawDesktopConnectionZones, writeStatus } from './connectionPreferencesZone.js';
import { isConversationPairingHold, keepLeftoverCatalogForPairingHold } from './conversationSessionStatus.js';
import { getEngineSectionApiUnavailableCopy, getEngineSectionDisconnectedCopy } from './engineSectionChrome.js';

const $ = DOM.$;

class HubDevicesDelegate implements IListVirtualDelegate<HubDeviceProjection> {
	getHeight(): number {
		return 32;
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
		const connectButton = new Button(row, { ...defaultButtonStyles, secondary: true });
		connectButton.label = localize('ua.connectionDeviceConnect', "Connect");
		const templateData: IHubDeviceTemplateData = {
			row,
			name,
			status,
			connectButton,
			device: undefined,
			connectDisposable: connectButton.onDidClick(() => {
				if (templateData.device && this.canConnect(templateData.device)) {
					this.onConnect(templateData.device);
				}
			}),
		};
		return templateData;
	}

	renderElement(device: HubDeviceProjection, _index: number, templateData: IHubDeviceTemplateData): void {
		templateData.device = device;
		const statusLabel = getHubDeviceRowStatusLabel(device);
		templateData.name.textContent = device.name;
		templateData.name.title = device.name;
		templateData.status.textContent = statusLabel;
		templateData.status.title = statusLabel;
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

export interface IConnectionPreferencesDevicesHost {
	isConnectWriteHeld(): boolean;
	writeHoldReason(): string;
	handleConnectDevice(device: HubDeviceProjection): Promise<void>;
	/** Repaints the Hub account together with the device-code actions. */
	renderHubAccount(): void;
	renderProfiles(): void;
	layoutLists(): void;
	/** The zone was shown or hidden; the pane re-picks its active zone and nav. */
	applyNarrowChrome(): void;
}

/** Devices zone: Hub directory / engine paired devices, pending pair requests and the device-code row. Owns the three list refresh generations. */
export class ConnectionPreferencesDevices extends Disposable {

	readonly element: HTMLElement;
	readonly connectStatus: HTMLElement;
	private readonly hubDeviceCodeStatus: HTMLElement;
	private readonly hubDirectoryBanner: HTMLElement;
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
	private hubDevices: HubDeviceProjection[] = [];
	private enginePairedDevices: UniverseAgentDeviceInfo[] | undefined;
	private engineDevicesListFailed: string | undefined;
	/** Hub `refreshDirectory` leftover-fail (D447): leftover rows stay; Connect is not live. */
	private hubDirectoryListFailed: string | undefined;
	private pendingPairs: UniverseAgentPendingPairInfo[] = [];
	private pendingPairsListFailed: string | undefined;
	private engineDevicesRefreshGeneration = 0;
	private hubDirectoryRefreshGeneration = 0;
	private enginePendingRefreshGeneration = 0;
	private selectedPending: UniverseAgentPendingPairInfo | undefined;
	private readonly pendingRowDisposables = this._register(new DisposableStore());

	constructor(
		parent: HTMLElement,
		private readonly host: IConnectionPreferencesDevicesHost,
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextViewService contextViewService: IContextViewService,
		@IUniverseAgentHubService private readonly hubService: IUniverseAgentHubService,
		@IUniverseAgentConnection private readonly connectionService: IUniverseAgentConnection,
		@IDialogService private readonly dialogService: IDialogService,
	) {
		super();
		this.element = DOM.append(parent, DOM.$('.connection-zone.connection-hub-devices'));
		this.hubDirectoryBanner = DOM.append(this.element, DOM.$('.connection-hub-directory-banner'));
		this.hubDirectoryBanner.setAttribute('role', 'alert');
		this.hubDevicesListContainer = DOM.append(this.element, DOM.$('.connection-hub-devices-list'));
		this.hubDevicesList = this._register(instantiationService.createInstance(
			WorkbenchList,
			'HubDevices',
			this.hubDevicesListContainer,
			new HubDevicesDelegate(),
			[new HubDevicesRenderer(device => void this.host.handleConnectDevice(device).catch(onUnexpectedError), device => this.canConnectDevice(device))],
			{
				identityProvider: { getId: (device: HubDeviceProjection) => device.id },
				accessibilityProvider: new HubDevicesAccessibilityProvider(),
			},
		)) as WorkbenchList<HubDeviceProjection>;
		this._register(this.hubDevicesList.onDidChangeSelection(() => this.updateDeviceActions()));

		this.deviceActionsRow = DOM.append(this.element, DOM.$('.connection-actions.connection-hub-device-actions'));
		this.renameDeviceButton = this._register(new Button(this.deviceActionsRow, { ...defaultButtonStyles, secondary: true }));
		this.renameDeviceButton.label = localize('ua.connectionDeviceRename', "Rename");
		this._register(this.renameDeviceButton.onDidClick(() => void this.handleRenameSelectedDevice().catch(onUnexpectedError)));
		this.revokeDeviceButton = this._register(new Button(this.deviceActionsRow, { ...defaultButtonStyles, secondary: true }));
		this.revokeDeviceButton.element.classList.add('is-danger');
		this.revokeDeviceButton.label = localize('ua.connectionDeviceRevoke', "Revoke");
		this._register(this.revokeDeviceButton.onDidClick(() => void this.handleRevokeSelectedDevice().catch(onUnexpectedError)));
		this.rotateTokenButton = this._register(new Button(this.deviceActionsRow, { ...defaultButtonStyles, secondary: true }));
		this.rotateTokenButton.label = CONNECTION_DEVICE_ROTATE_TOKEN_LABEL;
		this._register(this.rotateTokenButton.onDidClick(() => void this.handleRotateSelectedDeviceToken().catch(onUnexpectedError)));

		this.connectStatus = DOM.append(this.element, DOM.$('.connection-status.connection-hub-devices-status'));
		this.connectStatus.setAttribute('role', 'status');
		this.connectStatus.setAttribute('aria-live', 'polite');

		this.pendingPairsHeading = DOM.append(this.element, DOM.$('h4.connection-engine-pending-heading'));
		this.pendingPairsHeading.textContent = CONNECTION_DEVICE_PENDING_HEADING;
		this.pendingPairsEmpty = DOM.append(this.element, DOM.$('.connection-engine-pending-empty'));
		this.pendingPairsEmpty.setAttribute('role', 'status');
		this.pendingPairsEmpty.textContent = CONNECTION_DEVICE_PENDING_EMPTY_COPY;
		this.pendingPairsList = DOM.append(this.element, DOM.$('.connection-engine-pending-list'));
		this.pendingPairsList.setAttribute('role', 'list');

		const deviceCodeRow = DOM.append(this.element, DOM.$('.connection-field-row.connection-hub-device-code'));
		DOM.append(deviceCodeRow, DOM.$('label')).textContent = localize('ua.connectionConfirmDeviceCodeLabel', "Device code");
		const deviceCodeHost = DOM.append(deviceCodeRow, $('.connection-field-input'));
		this.confirmDeviceCodeInput = this._register(new InputBox(deviceCodeHost, contextViewService, {
			placeholder: localize('ua.connectionConfirmDeviceCodePlaceholder', "Device code"),
			ariaLabel: localize('ua.connectionConfirmDeviceCodeAria', "Confirm device code"),
			inputBoxStyles: defaultInputBoxStyles,
		}));
		const deviceCodeActions = DOM.append(deviceCodeRow, $('.connection-actions'));
		this.confirmDeviceCodeButton = this._register(new Button(deviceCodeActions, defaultButtonStyles));
		this.confirmDeviceCodeButton.label = localize('ua.connectionConfirmDeviceCode', "Confirm");
		this._register(this.confirmDeviceCodeButton.onDidClick(() => void this.handleConfirmDeviceCode().catch(onUnexpectedError)));
		this.rejectDevicePairButton = this._register(new Button(deviceCodeActions, { ...defaultButtonStyles, secondary: true }));
		this.rejectDevicePairButton.label = CONNECTION_DEVICE_PAIR_REJECT_LABEL;
		this._register(this.rejectDevicePairButton.onDidClick(() => void this.handleRejectDevicePair().catch(onUnexpectedError)));
		this.hubDeviceCodeStatus = DOM.append(this.element, DOM.$('.connection-status.connection-hub-device-code-status'));
		this.hubDeviceCodeStatus.setAttribute('role', 'status');
	}

	override dispose(): void {
		this.engineDevicesRefreshGeneration++;
		this.hubDirectoryRefreshGeneration++;
		this.enginePendingRefreshGeneration++;
		super.dispose();
	}

	hide(): void {
		this.element.style.display = 'none';
	}

	layout(budget: number, detailWidth: () => number): void {
		layoutConnectionList(this.hubDevicesList, this.hubDevicesListContainer, budget, detailWidth);
		this.confirmDeviceCodeInput.layout();
	}

	/** Re-splices the rows so each Connect button re-reads the pane's write hold. */
	refreshConnectButtons(): void {
		if (this.hubDevices.length > 0) {
			this.hubDevicesList.splice(0, this.hubDevicesList.length, this.hubDevices);
		}
	}

	canConnectDevice(device: HubDeviceProjection): boolean {
		if (this.host.isConnectWriteHeld() || this.hubDirectoryListFailed) {

			return false;
		}
		return canConnectHubDevice(device, this.hubService.getDirectoryStatus());
	}

	async refreshHubDirectory(): Promise<void> {
		const listed = await this.refreshDirectoryListed();
		if (!listed) {
			return;
		}
		await this.refreshEngineDeviceLists();
	}

	private engineDeviceListsListed(): boolean {
		return this.engineDevicesListFailed === undefined && this.pendingPairsListFailed === undefined;
	}

	async refreshEngineDeviceLists(): Promise<boolean> {
		await this.refreshEngineDevices();
		await this.refreshEnginePending();
		return this.engineDeviceListsListed();
	}

	/** Pair write-success stays only after ListDevices + ListPending listed (D212 sibling). */
	private restorePairWriteSuccessIfListed(message: string): void {
		if (this.engineDeviceListsListed()) {
			writeStatus(this.hubDeviceCodeStatus, message, 'success');
			return;
		}
		writeStatus(this.hubDeviceCodeStatus, '', 'neutral');
	}

	private hubDirectoryRefreshListed(status: HubDirectoryStatus): boolean {
		return status.kind === 'ok';
	}

	private applyHubDirectoryRefreshFailure(reason: string): void {
		this.hubDirectoryListFailed = reason;
		writeStatus(this.hubDirectoryBanner, reason, 'error');
		this.hubDirectoryBanner.style.display = '';
		// Keep leftover hubDevices (D248). Splice so Connect closes without reselect (D447).
		this.hubDevicesList.splice(0, this.hubDevicesList.length, this.hubDevices);
		this.updateDeviceActions();
	}

	/** Hub write-success stays only after refreshDirectory listed (D221 sibling). */
	private async refreshDirectoryListed(): Promise<boolean | undefined> {
		const generation = ++this.hubDirectoryRefreshGeneration;
		try {
			const status = await this.hubService.refreshDirectory();
			if (generation !== this.hubDirectoryRefreshGeneration) {
				return undefined;
			}
			if (this.hubDirectoryRefreshListed(status)) {
				this.hubDirectoryListFailed = undefined;
				this.renderHubDirectory();
				return true;
			}
			const banner = getHubDirectoryBannerLabel(status);
			this.applyHubDirectoryRefreshFailure(
				banner
				?? (status.kind === 'error' || status.kind === 'unreachable' ? status.reason : status.kind),
			);
			return false;
		} catch (error) {
			if (generation !== this.hubDirectoryRefreshGeneration) {
				return undefined;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.applyHubDirectoryRefreshFailure(reason);
			return false;
		}
	}

	private restoreHubDeviceCodeSuccessIfListed(listed: boolean, message: string): void {
		if (listed) {
			writeStatus(this.hubDeviceCodeStatus, message, 'success');
			return;
		}
		writeStatus(this.hubDeviceCodeStatus, '', 'neutral');
	}

	private restoreHubDirectoryWriteSuccessIfListed(listed: boolean, message: string): void {
		if (listed) {
			writeStatus(this.hubDirectoryBanner, message, message.trim() ? 'success' : 'neutral');
			this.hubDirectoryBanner.style.display = message.trim() ? '' : 'none';
			return;
		}
	}

	isDeviceWritePairingHold(): boolean {
		return isConversationPairingHold(this.connectionService);
	}

	/** Catalog leftover contract: devices / Hub directory list-fail leftover is not a live write surface. */
	isDeviceWriteListFailed(): boolean {
		return this.engineDevicesListFailed !== undefined || this.hubDirectoryListFailed !== undefined;
	}

	/** Catalog leftover contract: pending list-fail leftover is not a live pair-write surface. */
	isPendingWriteListFailed(): boolean {
		return this.pendingPairsListFailed !== undefined;
	}

	private applyDisconnectedDevicesRefresh(): void {
		if (keepLeftoverCatalogForPairingHold(!!this.enginePairedDevices?.length, this.connectionService)) {
			this.renderHubDirectory();
			writeStatus(this.connectStatus, getEngineSectionDisconnectedCopy(), 'warning');
			return;
		}
		// Disconnect still clears engine leftover (History/Clipboard contract).
		this.enginePairedDevices = undefined;
		this.engineDevicesListFailed = undefined;
		this.hubDevices = [];
		this.renderHubDirectory();
		if (isConversationPairingHold(this.connectionService)) {
			writeStatus(this.connectStatus, getEngineSectionDisconnectedCopy(), 'warning');
			return;
		}
		writeStatus(this.connectStatus, '', 'neutral');
	}

	private applyDisconnectedPendingRefresh(): void {
		if (keepLeftoverCatalogForPairingHold(this.pendingPairs.length > 0, this.connectionService)) {
			this.renderPendingPairs();
			return;
		}
		// Disconnect still clears pending leftover (History/Clipboard contract).
		this.pendingPairs = [];
		this.pendingPairsListFailed = undefined;
		this.selectedPending = undefined;
		this.renderPendingPairs();
	}

	private async refreshEngineDevices(): Promise<void> {
		const generation = ++this.engineDevicesRefreshGeneration;
		const hook = this.connectionService.listDevices;
		const connected = this.connectionService.isEngineConnected();
		// D341 leftover-looks-live: pairing-hold first. KEEP is not only `!connected`.
		if (isConversationPairingHold(this.connectionService) || !connected) {
			this.applyDisconnectedDevicesRefresh();
			return;
		}
		// Connected + missing hook: keep leftover rows; first-pull empty stays empty (D260).
		if (!this.conversationEntryPresent('listDevices', hook) || typeof hook !== 'function') {
			if (!this.enginePairedDevices?.length) {
				this.enginePairedDevices = undefined;
			}
			this.engineDevicesListFailed = undefined;
			this.renderHubDirectory();
			writeStatus(
				this.connectStatus,
				getEngineSectionApiUnavailableCopy(CONNECTION_DEVICE_LIST_FEATURE),
				'warning',
			);
			return;
		}
		try {
			const result = await hook.call(this.connectionService);
			if (generation !== this.engineDevicesRefreshGeneration) {
				return;
			}
			if (isConversationPairingHold(this.connectionService) || !this.connectionService.isEngineConnected()) {
				this.applyDisconnectedDevicesRefresh();
				return;
			}
			this.enginePairedDevices = [...result.devices];
			const hadFail = this.engineDevicesListFailed !== undefined;
			const hadUnsupported = this.connectStatus.textContent === getEngineSectionApiUnavailableCopy(CONNECTION_DEVICE_LIST_FEATURE);
			this.engineDevicesListFailed = undefined;
			this.renderHubDirectory();
			if (hadFail || hadUnsupported) {
				writeStatus(this.connectStatus, '', 'neutral');
			}
		} catch (error) {
			if (generation !== this.engineDevicesRefreshGeneration) {
				return;
			}
			if (isConversationPairingHold(this.connectionService) || !this.connectionService.isEngineConnected()) {
				this.applyDisconnectedDevicesRefresh();
				return;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.engineDevicesListFailed = reason;
			this.renderHubDirectory();
			writeStatus(this.connectStatus, connectionDeviceListFailureMessage(reason), 'error');
		}
	}

	private rebindSelectedPendingAfterListRefresh(previous: UniverseAgentPendingPairInfo | undefined): void {
		if (!previous?.pairingCode) {
			this.selectedPending = undefined;
			return;
		}
		const matches = this.pendingPairs.filter(p => p.pairingCode === previous.pairingCode);
		if (matches.length === 0) {
			this.selectedPending = undefined;
			return;
		}
		if (matches.length === 1) {
			this.selectedPending = matches[0];
			return;
		}
		const byDisplayName = matches.filter(p => p.displayName === previous.displayName);
		if (byDisplayName.length === 1) {
			this.selectedPending = byDisplayName[0];
			return;
		}
		this.selectedPending = undefined;
	}

	private async refreshEnginePending(): Promise<void> {
		const generation = ++this.enginePendingRefreshGeneration;
		const hook = this.connectionService.listPending;
		const connected = this.connectionService.isEngineConnected();
		// D341 leftover-looks-live: pairing-hold first. KEEP is not only `!connected`.
		if (isConversationPairingHold(this.connectionService) || !connected) {
			this.applyDisconnectedPendingRefresh();
			return;
		}
		// Connected + missing hook: keep leftover rows; first-pull empty stays empty (D260).
		if (!this.conversationEntryPresent('listPending', hook) || typeof hook !== 'function') {
			if (this.pendingPairs.length === 0) {
				this.pendingPairs = [];
				this.selectedPending = undefined;
			}
			this.pendingPairsListFailed = undefined;
			this.renderPendingPairs();
			return;
		}
		try {
			const result = await hook.call(this.connectionService);
			if (generation !== this.enginePendingRefreshGeneration) {
				return;
			}
			if (isConversationPairingHold(this.connectionService) || !this.connectionService.isEngineConnected()) {
				this.applyDisconnectedPendingRefresh();
				return;
			}
			const previousSelected = this.selectedPending;
			this.pendingPairs = [...result.pending];
			this.pendingPairsListFailed = undefined;
			this.rebindSelectedPendingAfterListRefresh(previousSelected);
		} catch (error) {
			if (generation !== this.enginePendingRefreshGeneration) {
				return;
			}
			if (isConversationPairingHold(this.connectionService) || !this.connectionService.isEngineConnected()) {
				this.applyDisconnectedPendingRefresh();
				return;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			this.pendingPairsListFailed = reason;
		}
		if (generation !== this.enginePendingRefreshGeneration) {
			return;
		}
		this.renderPendingPairs();
	}

	private renderPendingPairs(): void {
		const hook = this.connectionService.listPending;
		const connected = this.connectionService.isEngineConnected();
		const pendingListed = this.conversationEntryPresent('listPending', hook);
		const canList = canSendConnectionDevicePairRequest(connected, pendingListed);
		const showUnsupported = connected && !pendingListed;
		const pairingHoldLeftover = keepLeftoverCatalogForPairingHold(this.pendingPairs.length > 0, this.connectionService);
		const showPending = canList || showUnsupported || pairingHoldLeftover;
		this.pendingPairsHeading.style.display = showPending ? '' : 'none';
		this.pendingPairsList.style.display = showPending && this.pendingPairs.length > 0 ? '' : 'none';
		this.pendingPairsEmpty.style.display = showPending && (this.pendingPairs.length === 0 || !!this.pendingPairsListFailed || showUnsupported || pairingHoldLeftover) ? '' : 'none';
		if (showUnsupported) {
			writeStatus(
				this.pendingPairsEmpty,
				getEngineSectionApiUnavailableCopy(CONNECTION_DEVICE_PENDING_LIST_FEATURE),
				'warning',
			);
		} else if (canList && this.pendingPairsListFailed) {
			writeStatus(this.pendingPairsEmpty, connectionDevicePendingListFailureMessage(this.pendingPairsListFailed), 'error');
		} else if (pairingHoldLeftover) {
			writeStatus(this.pendingPairsEmpty, getEngineSectionDisconnectedCopy(), 'warning');
		} else {
			writeStatus(this.pendingPairsEmpty, CONNECTION_DEVICE_PENDING_EMPTY_COPY, 'neutral');
		}
		this.pendingRowDisposables.clear();
		DOM.clearNode(this.pendingPairsList);
		if (showPending) {
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
				this.pendingRowDisposables.add(DOM.addDisposableListener(row, 'keydown', (e: KeyboardEvent) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						this.selectedPending = pending;
						this.renderPendingPairs();
					}
				}));
			}
		}
		// D441: pending list-fail leftover must close Confirm/Reject without reselect.
		this.host.renderHubAccount();
	}

	private getSelectedDevice(): HubDeviceProjection | undefined {
		return this.hubDevicesList.getSelectedElements()[0];
	}

	private conversationEntryPresent(key: keyof UniverseAgentConversationEntryCapability, method: unknown): boolean {
		return conversationEntryHookPresent(this.connectionService.getConnectionSnapshot(), key, method);
	}

	updateDeviceActions(): void {
		const device = this.getSelectedDevice();
		const hasDevice = !!device && !device.revoked;
		const pairingHold = this.isDeviceWritePairingHold();
		const listFailed = this.isDeviceWriteListFailed();
		const deviceReason = pairingHold || listFailed
			? this.host.writeHoldReason()
			: localize('ua.connectionDeviceSelectFirst', "Select a device first.");
		const deviceEnabled = hasDevice && !pairingHold && !listFailed;
		presentConnectionAction(this.renameDeviceButton, deviceEnabled, deviceReason);
		presentConnectionAction(this.revokeDeviceButton, deviceEnabled, deviceReason);
		const rotateEnabled = !listFailed && canSendConnectionDeviceRotateToken(
			this.connectionService.isEngineConnected(),
			this.conversationEntryPresent('rotateToken', this.connectionService.rotateToken),
			pairingHold,
		);
		const rotateReason = !rotateEnabled && !listFailed && !pairingHold
			? localize('ua.connectionRotateUnavailable', "This engine cannot rotate a device token.")
			: this.host.writeHoldReason();
		presentConnectionAction(this.rotateTokenButton, rotateEnabled, rotateReason);
	}

	/** Device writes settle on the published identity and link captured when the action starts. */
	private deviceWriteLinkStill(startedEngineIdentityId: string | undefined, startedLinkId: number | undefined): boolean {
		if (this._store.isDisposed) {
			return false;
		}
		const current = this.connectionService.getConnectionSnapshot();
		return readPublishedEngineIdentityId(current) === startedEngineIdentityId
			&& readPublishedLinkId(current) === startedLinkId;
	}

	private async handleRenameSelectedDevice(): Promise<void> {
		const device = this.getSelectedDevice();
		if (!device || device.revoked) {
			return;
		}
		if (this.isDeviceWritePairingHold() || this.isDeviceWriteListFailed()) {
			return;
		}
		const startedSnapshot = this.connectionService.getConnectionSnapshot();
		const startedEngineIdentityId = readPublishedEngineIdentityId(startedSnapshot);
		const startedLinkId = readPublishedLinkId(startedSnapshot);
		const input = await this.dialogService.input({
			type: 'question',
			message: localize('ua.connectionRenameDeviceTitle', "Rename device"),
			inputs: [{ type: 'text', label: localize('ua.connectionRenameDevicePlaceholder', "Device name"), value: device.name, placeholder: localize('ua.connectionRenameDevicePlaceholder', "Device name") }],
			primaryButton: localize('ua.connectionRenameDeviceConfirm', "Rename"),
		});
		const name = input.confirmed ? input.values?.[0]?.trim() : undefined;
		if (!name || name === device.name) {
			return;
		}
		if (this.isDeviceWritePairingHold() || this.isDeviceWriteListFailed()) {
			return;
		}
		if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
			return;
		}
		try {
			const result = await this.hubService.renameDevice(device.id, name);
			if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
				return;
			}
			if (!result.ok) {
				writeStatus(this.hubDirectoryBanner, result.reason, 'error');
				this.hubDirectoryBanner.style.display = '';
				return;
			}
			await this.refreshDirectoryListed();
		} catch (error) {
			if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
				return;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			writeStatus(this.hubDirectoryBanner, reason, 'error');
			this.hubDirectoryBanner.style.display = '';
		}
	}

	private async handleRotateSelectedDeviceToken(): Promise<void> {
		const hook = this.connectionService.rotateToken;
		if (this.isDeviceWriteListFailed() || !canSendConnectionDeviceRotateToken(this.connectionService.isEngineConnected(), this.conversationEntryPresent('rotateToken', hook), this.isDeviceWritePairingHold()) || !hook) {
			return;
		}
		const startedSnapshot = this.connectionService.getConnectionSnapshot();
		const startedEngineIdentityId = readPublishedEngineIdentityId(startedSnapshot);
		const startedLinkId = readPublishedLinkId(startedSnapshot);
		const request = connectionDeviceRotateTokenIds(this.hubDevicesList.getSelectedElements()[0]);
		try {
			const result = await hook.call(this.connectionService, request);
			if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
				return;
			}
			if (!result.success) {
				writeStatus(this.hubDirectoryBanner, connectionDeviceRotateTokenFailureMessage(result.message), 'error');
				this.hubDirectoryBanner.style.display = '';
				return;
			}
			const listed = await this.refreshDirectoryListed();
			if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
				return;
			}
			if (listed === undefined) {
				return;
			}
			this.restoreHubDirectoryWriteSuccessIfListed(listed && this.engineDeviceListsListed(), result.message);
		} catch (error) {
			if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
				return;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			writeStatus(this.hubDirectoryBanner, reason, 'error');
			this.hubDirectoryBanner.style.display = '';
		}
	}

	private async handleRevokeSelectedDevice(): Promise<void> {
		const device = this.getSelectedDevice();
		if (!device || device.revoked) {
			return;
		}
		if (this.isDeviceWritePairingHold() || this.isDeviceWriteListFailed()) {
			return;
		}
		const startedSnapshot = this.connectionService.getConnectionSnapshot();
		const startedEngineIdentityId = readPublishedEngineIdentityId(startedSnapshot);
		const startedLinkId = readPublishedLinkId(startedSnapshot);
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
		if (this.isDeviceWritePairingHold() || this.isDeviceWriteListFailed()) {
			return;
		}
		if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
			return;
		}
		const pairingHold = this.isDeviceWritePairingHold();
		const revokeHook = this.connectionService.revoke;
		if (canSendConnectionDeviceRevokeRequest(this.connectionService.isEngineConnected(), this.conversationEntryPresent('revoke', revokeHook), pairingHold) && revokeHook) {
			const request = connectionDeviceRevokeIds(device.id);
			try {
				const result = await revokeHook.call(this.connectionService, request);
				if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
					return;
				}
				if (!result.success) {
					writeStatus(this.hubDirectoryBanner, connectionDeviceRevokeFailureMessage(result.message), 'error');
					this.hubDirectoryBanner.style.display = '';
					return;
				}
				const listed = await this.refreshDirectoryListed();
				if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
					return;
				}
				if (listed === undefined) {
					return;
				}
				this.restoreHubDirectoryWriteSuccessIfListed(listed, result.message);
				this.host.renderProfiles();
			} catch (error) {
				if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
					return;
				}
				const reason = error instanceof Error && error.message ? error.message : String(error);
				writeStatus(this.hubDirectoryBanner, reason, 'error');
				this.hubDirectoryBanner.style.display = '';
			}
			return;
		}
		if (pairingHold) {
			return;
		}
		try {
			const result = await this.hubService.revokeDevice(device.id);
			if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
				return;
			}
			if (!result.ok) {
				writeStatus(this.hubDirectoryBanner, result.reason, 'error');
				this.hubDirectoryBanner.style.display = '';
				return;
			}
			const listed = await this.refreshDirectoryListed();
			if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
				return;
			}
			if (listed === undefined) {
				return;
			}
			this.host.renderProfiles();
		} catch (error) {
			if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
				return;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			writeStatus(this.hubDirectoryBanner, reason, 'error');
			this.hubDirectoryBanner.style.display = '';
		}
	}

	private async handleConfirmDeviceCode(): Promise<void> {
		if (this.isPendingWriteListFailed()) {
			return;
		}
		const startedSnapshot = this.connectionService.getConnectionSnapshot();
		const startedEngineIdentityId = readPublishedEngineIdentityId(startedSnapshot);
		const startedLinkId = readPublishedLinkId(startedSnapshot);
		const pairingHold = this.isDeviceWritePairingHold();
		const approveHook = this.connectionService.pairApprove;
		if (canSendConnectionDevicePairRequest(this.connectionService.isEngineConnected(), this.conversationEntryPresent('pairApprove', approveHook), pairingHold) && approveHook) {
			const request = connectionDevicePairIds(this.confirmDeviceCodeInput.value, this.selectedPending);
			try {
				const result = await approveHook.call(this.connectionService, request);
				if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
					return;
				}
				if (!result.success) {
					writeStatus(this.hubDeviceCodeStatus, result.message, 'error');
					return;
				}
				this.confirmDeviceCodeInput.value = '';
				await this.refreshEngineDeviceLists();
				if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
					return;
				}
				this.restorePairWriteSuccessIfListed(result.message);
			} catch (error) {
				if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
					return;
				}
				const reason = error instanceof Error && error.message ? error.message : String(error);
				writeStatus(this.hubDeviceCodeStatus, reason, 'error');
			}
			return;
		}
		if (pairingHold) {
			return;
		}
		const code = this.confirmDeviceCodeInput.value.trim();
		if (!code) {
			writeStatus(this.hubDeviceCodeStatus, localize('ua.connectionConfirmDeviceCodeEmpty', "Enter a device code first."), 'warning');
			return;
		}
		if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
			return;
		}
		try {
			const result = await this.hubService.confirmDeviceCode(code);
			if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
				return;
			}
			if (!result.ok) {
				writeStatus(this.hubDeviceCodeStatus, result.reason, 'error');
				return;
			}
			this.confirmDeviceCodeInput.value = '';
			const listed = await this.refreshDirectoryListed();
			if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
				return;
			}
			if (listed === undefined) {
				return;
			}
			this.restoreHubDeviceCodeSuccessIfListed(
				listed,
				localize('ua.connectionConfirmDeviceCodeOk', "Device code confirmed"),
			);
		} catch (error) {
			if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
				return;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			writeStatus(this.hubDeviceCodeStatus, reason, 'error');
		}
	}

	private async handleRejectDevicePair(): Promise<void> {
		const rejectHook = this.connectionService.pairReject;
		if (this.isPendingWriteListFailed() || !canSendConnectionDevicePairRequest(this.connectionService.isEngineConnected(), this.conversationEntryPresent('pairReject', rejectHook), this.isDeviceWritePairingHold()) || !rejectHook) {
			return;
		}
		const startedSnapshot = this.connectionService.getConnectionSnapshot();
		const startedEngineIdentityId = readPublishedEngineIdentityId(startedSnapshot);
		const startedLinkId = readPublishedLinkId(startedSnapshot);
		const request = { pairingCode: connectionDevicePairIds(this.confirmDeviceCodeInput.value, this.selectedPending).pairingCode };
		try {
			const result = await rejectHook.call(this.connectionService, request);
			if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
				return;
			}
			if (!result.success) {
				writeStatus(this.hubDeviceCodeStatus, result.message, 'error');
				return;
			}
			this.confirmDeviceCodeInput.value = '';
			await this.refreshEngineDeviceLists();
			if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
				return;
			}
			this.restorePairWriteSuccessIfListed(result.message);
		} catch (error) {
			if (!this.deviceWriteLinkStill(startedEngineIdentityId, startedLinkId)) {
				return;
			}
			const reason = error instanceof Error && error.message ? error.message : String(error);
			writeStatus(this.hubDeviceCodeStatus, reason, 'error');
		}
	}

	renderHubDirectory(): void {
		const directory = this.hubService.getDirectoryStatus();
		const banner = this.engineDevicesListFailed
			? connectionDeviceListFailureMessage(this.engineDevicesListFailed)
			: this.hubDirectoryListFailed
				? this.hubDirectoryListFailed
				: getHubDirectoryBannerLabel(directory);
		if (this.engineDevicesListFailed || this.hubDirectoryListFailed) {
			writeStatus(this.hubDirectoryBanner, banner ?? '', 'error');
			this.hubDirectoryBanner.style.display = banner ? '' : 'none';
		} else if (banner) {
			writeStatus(this.hubDirectoryBanner, banner, 'error');
			this.hubDirectoryBanner.style.display = '';
		} else {
			writeStatus(this.hubDirectoryBanner, '', 'neutral');
			this.hubDirectoryBanner.style.display = 'none';
		}

		if (this.enginePairedDevices !== undefined) {
			this.hubDevices = this.enginePairedDevices.map(toConnectionPairedDevice);
		} else if (isConversationPairingHold(this.connectionService)) {
			this.hubDevices = [];
		} else if (directory.kind === 'ok') {
			this.hubDevices = [...directory.devices];
		}
		// else: keep leftover (may be [] on first-pull fail)
		this.hubDevicesList.splice(0, this.hubDevicesList.length, this.hubDevices);
		this.updateDeviceActions();
		this.syncHubDevicesSectionVisibility();
		this.updateDeviceActions();
		this.host.layoutLists();
	}

	/** Signed-in Hub, live pair seat, or pairing-hold leftover devices / pending rows. */
	private shouldShowHubDevicesSection(): boolean {
		if (!shouldDrawDesktopConnectionZones(this.connectionService)) {
			return false;
		}
		const hubSignedIn = this.hubService.getAuthStatus().kind !== 'signedOut';
		// D362 leftover-looks-live: pairing-hold-first. KEEP is not only `isEngineConnected()`.
		const enginePairSeat = !(isConversationPairingHold(this.connectionService) || !this.connectionService.isEngineConnected());
		const pairingHoldCatalog = keepLeftoverCatalogForPairingHold(
			!!this.enginePairedDevices?.length || this.pendingPairs.length > 0,
			this.connectionService,
		);
		return hubSignedIn || enginePairSeat || pairingHoldCatalog;
	}

	syncHubDevicesSectionVisibility(): void {
		const display = this.shouldShowHubDevicesSection() ? '' : 'none';
		if (this.element.style.display === display) {
			return;
		}
		this.element.style.display = display;
		this.host.applyNarrowChrome();
	}

	/** Device-code Confirm / Reject; repainted with the Hub account because sign-in gates Confirm. */
	renderPairActions(): void {
		const status = this.hubService.getAuthStatus();
		const signedIn = status.kind === 'signedIn';
		const pairingHold = this.isDeviceWritePairingHold();
		const pendingListFailed = this.isPendingWriteListFailed();
		const deviceCodeEnabled = !pairingHold && !pendingListFailed && (signedIn
			|| canSendConnectionDevicePairRequest(this.connectionService.isEngineConnected(), this.conversationEntryPresent('pairApprove', this.connectionService.pairApprove), pairingHold));
		this.confirmDeviceCodeInput.setEnabled(deviceCodeEnabled);
		const deviceCodeReason = !deviceCodeEnabled && !pairingHold && !pendingListFailed
			? localize('ua.connectionDeviceCodeNeedsSignIn', "Sign in before confirming a device code.")
			: this.host.writeHoldReason();
		presentConnectionAction(this.confirmDeviceCodeButton, deviceCodeEnabled, deviceCodeReason);
		this.confirmDeviceCodeInput.inputElement.title = deviceCodeEnabled ? '' : deviceCodeReason;
		const rejectEnabled = !pendingListFailed && canSendConnectionDevicePairRequest(
			this.connectionService.isEngineConnected(),
			this.conversationEntryPresent('pairReject', this.connectionService.pairReject),
			pairingHold,
		);
		const rejectReason = pairingHold || pendingListFailed
			? this.host.writeHoldReason()
			: localize('ua.connectionDevicePairCannotReject', "This device request cannot be rejected right now.");
		presentConnectionAction(this.rejectDevicePairButton, rejectEnabled, rejectReason);
	}
}
