/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import type { ConnectionPhase } from '../../../../platform/universeAgent/common/connectionHubTypes.js';
import { type ConnectionProfileProjection, IUniverseAgentHubService } from '../../../../platform/universeAgent/common/hub.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { asConnectionProfileList, isUniverseAgentPhaseConnected } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import { getConnectionPhasePaneLabel, getConnectionPhaseTone } from './connectionPreferencesPaneLabels.js';
import { getConnectionEmptyCopy, layoutConnectionList, presentConnectionAction, shouldDrawDesktopConnectionZones, writeStatus } from './connectionPreferencesZone.js';

const $ = DOM.$;

export interface IConnectionProfileEntry {
	readonly id: string;
	readonly label: string;
	readonly stateLabel: string;
}

class ConnectionProfilesDelegate implements IListVirtualDelegate<IConnectionProfileEntry> {
	getHeight(): number {
		return 32;
	}

	getTemplateId(): string {
		return 'connectionProfileEntry';
	}
}

interface IConnectionProfileTemplateData {
	readonly label: HTMLElement;
	readonly state: HTMLElement;
}

class ConnectionProfilesRenderer implements IListRenderer<IConnectionProfileEntry, IConnectionProfileTemplateData> {
	static readonly TEMPLATE_ID = 'connectionProfileEntry';

	readonly templateId = ConnectionProfilesRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IConnectionProfileTemplateData {
		return { label: DOM.append(container, $('.connection-profile-label')), state: DOM.append(container, $('.connection-profile-state')) };
	}

	renderElement(entry: IConnectionProfileEntry, _index: number, templateData: IConnectionProfileTemplateData): void {
		templateData.label.textContent = entry.label;
		templateData.label.title = entry.label;
		templateData.state.textContent = entry.stateLabel;
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

export interface IConnectionPreferencesProfilesHost {
	getActiveProfileId(): string | undefined;
	/** List selection moved to another profile: the pane records it and invalidates an in-flight profile probe. */
	selectActiveProfile(profileId: string): void;
	/** Render fallback to the first profile. A direct write: it does not invalidate the profile probe. */
	setActiveProfileId(profileId: string): void;
	getConnectedProfileId(): string | undefined;
	layoutLists(): void;
	handleConnectSelectedProfile(): Promise<void>;
	handleDisconnect(): Promise<void>;
	handleForgetSelectedProfile(): Promise<void>;
}

/** Connection profiles zone: phase label, profile list and Connect / Disconnect / Forget. */
export class ConnectionPreferencesProfiles extends Disposable {

	readonly element: HTMLElement;
	readonly status: HTMLElement;
	private readonly connectionPhaseLabel: HTMLElement;
	private readonly emptyWelcome: HTMLElement;
	private readonly listContainer: HTMLElement;
	private readonly list: WorkbenchList<IConnectionProfileEntry>;
	private readonly profileActionsRow: HTMLElement;
	private readonly connectProfileButton: Button;
	private readonly disconnectButton: Button;
	private readonly forgetButton: Button;
	private entries: IConnectionProfileEntry[] = [];
	private syncingProfiles = false;
	private connectionPhase: ConnectionPhase = { kind: 'disconnected' };

	constructor(
		parent: HTMLElement,
		private readonly host: IConnectionPreferencesProfilesHost,
		@IInstantiationService instantiationService: IInstantiationService,
		@IUniverseAgentHubService private readonly hubService: IUniverseAgentHubService,
		@IUniverseAgentConnection private readonly connectionService: IUniverseAgentConnection,
	) {
		super();
		this.element = DOM.append(parent, DOM.$('.connection-zone.connection-profiles'));
		this.connectionPhaseLabel = DOM.append(this.element, DOM.$('.connection-status.connection-phase-label'));
		this.connectionPhaseLabel.setAttribute('role', 'status');
		this.emptyWelcome = DOM.append(this.element, DOM.$('.connection-empty-welcome'));
		this.emptyWelcome.textContent = getConnectionEmptyCopy();
		this.listContainer = DOM.append(this.element, DOM.$('.connection-list'));
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

		this.profileActionsRow = DOM.append(this.element, DOM.$('.connection-actions.connection-profile-actions'));
		this.connectProfileButton = this._register(new Button(this.profileActionsRow, defaultButtonStyles));
		this.connectProfileButton.label = localize('ua.connectionProfileConnect', "Connect");
		this._register(this.connectProfileButton.onDidClick(() => void host.handleConnectSelectedProfile().catch(onUnexpectedError)));

		this.disconnectButton = this._register(new Button(this.profileActionsRow, { ...defaultButtonStyles, secondary: true }));
		this.disconnectButton.label = localize('ua.connectionProfileDisconnect', "Disconnect");
		this._register(this.disconnectButton.onDidClick(() => void host.handleDisconnect().catch(onUnexpectedError)));

		this.forgetButton = this._register(new Button(this.profileActionsRow, { ...defaultButtonStyles, secondary: true }));
		this.forgetButton.element.classList.add('is-danger');
		this.forgetButton.label = localize('ua.connectionProfileForget', "Forget this Engine");
		this._register(this.forgetButton.onDidClick(() => void host.handleForgetSelectedProfile().catch(onUnexpectedError)));

		this.status = DOM.append(this.element, DOM.$('.connection-status.connection-profiles-status'));
		this.status.setAttribute('role', 'status');
		this.status.setAttribute('aria-live', 'polite');

		this._register(this.list.onDidChangeSelection(e => {
			if (this.syncingProfiles) {
				return;
			}
			const selected = e.elements[0];
			// Re-selecting the same profile must not invalidate an in-flight Test Connection.
			if (selected && selected.id !== this.host.getActiveProfileId()) {
				this.host.selectActiveProfile(selected.id);
			}
		}));
	}

	presentConnectGate(enabled: boolean, disabledReason: string): void {
		presentConnectionAction(this.connectProfileButton, enabled, disabledReason);
	}

	/** Disconnect follows the live phase; Forget needs a selected profile and no dial in flight. */
	presentProfileActions(connectInFlight: boolean, hasActiveProfile: boolean): void {
		const phase = this.connectionService.getConnectionPhase().kind;
		presentConnectionAction(
			this.disconnectButton,
			phase === 'connecting' || phase === 'connected',
			localize('ua.connectionDisconnectIdle', "No engine is connected."),
		);
		presentConnectionAction(
			this.forgetButton,
			!connectInFlight && hasActiveProfile,
			connectInFlight
				? localize('ua.connectionActionInFlight', "A connection is already in progress.")
				: localize('ua.connectionProfileSelectFirst', "Select a profile first."),
		);
	}

	layoutList(budget: number, detailWidth: () => number): void {
		layoutConnectionList(this.list, this.listContainer, budget, detailWidth);
	}

	render(): void {
		this.syncingProfiles = true;
		try {
			const profiles = asConnectionProfileList(this.hubService.listConnectionProfiles());
			this.entries = profiles.map(profile => ({
				id: profile.profileId,
				label: profile.displayName,
				stateLabel: this.getProfileStateLabel(profile),
			}));
			this.setEntries(this.entries);
			if (profiles.length > 0 && !this.host.getActiveProfileId()) {
				this.host.setActiveProfileId(profiles[0].profileId);
			}
			const activeProfileId = this.host.getActiveProfileId();
			const activeIndex = activeProfileId
				? this.entries.findIndex(entry => entry.id === activeProfileId)
				: -1;
			if (activeIndex >= 0) {
				this.list.setFocus([activeIndex]);
				this.list.setSelection([activeIndex]);
			} else {
				this.list.setFocus([]);
				this.list.setSelection([]);
			}
		} finally {
			this.syncingProfiles = false;
		}
	}

	private getProfileStateLabel(profile: ConnectionProfileProjection): string {
		const snapshot = this.connectionService.getConnectionSnapshot();
		const phase = this.connectionService.getConnectionPhase();
		if (
			profile.profileId === this.host.getConnectedProfileId()
			&& isUniverseAgentPhaseConnected(phase)
			&& !snapshot.pairingPending
			&& (profile.state === 'pairingPending' || (profile.state === 'active' && !profile.hasTrust))
		) {
			return localize('ua.connectionProfilePaired', "Paired");
		}
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

	renderConnectionPhase(): void {
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
		this.host.layoutLists();
	}

	private updateEmptyState(): void {
		const isEmpty = this.entries.length === 0;
		this.emptyWelcome.style.display = isEmpty ? '' : 'none';
		this.listContainer.style.display = isEmpty ? 'none' : '';
		this.syncProfileActionsVisibility();
	}

	syncProfileActionsVisibility(): void {
		const drawDesktop = shouldDrawDesktopConnectionZones(this.connectionService);
		this.profileActionsRow.style.display = drawDesktop && this.entries.length > 0 ? '' : 'none';
	}
}
