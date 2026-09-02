/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { getConnectionPhasePaneLabel } from './connectionPreferencesPaneLabels.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';
import {
	formatCapabilitySupportLabel,
	getEngineSectionDisconnectedCopy,
} from './engineSectionChrome.js';
import type { UniverseAgentCapabilityKey, UniverseAgentTransportState } from '../../../../platform/universeAgent/common/universeAgentTypes.js';

const $ = DOM.$;

function getOverviewCapabilityLabel(key: UniverseAgentCapabilityKey): string {
	switch (key) {
		case 'skills':
			return localize('ua.engineOverviewCapSkills', "Skills");
		case 'agentProfiles':
			return localize('ua.engineOverviewCapAgents', "Agents");
		case 'tools':
			return localize('ua.engineOverviewCapTools', "Tools");
		case 'mcp':
			return localize('ua.engineOverviewCapMcp', "MCP");
		case 'globalRules':
			return localize('ua.engineOverviewCapGlobalRules', "Global rules");
		case 'projectRules':
			return localize('ua.engineOverviewCapProjectRules', "Project rules");
		case 'hooksMetadata':
			return localize('ua.engineOverviewCapHooks', "Hooks");
		case 'plugins':
			return localize('ua.engineOverviewCapPlugins', "Plugins");
		default:
			return key;
	}
}

function getOverviewTransportLabel(transport: UniverseAgentTransportState): string {
	switch (transport) {
		case 'ok':
			return localize('ua.engineOverviewTransportOk', "Healthy");
		case 'failed':
			return localize('ua.engineOverviewTransportFailed', "Failed");
		default:
			return localize('ua.engineOverviewTransportIdle', "Idle");
	}
}

const OVERVIEW_CAPABILITY_KEYS: readonly UniverseAgentCapabilityKey[] = [
	'skills',
	'agentProfiles',
	'tools',
	'mcp',
	'globalRules',
	'projectRules',
	'hooksMetadata',
	'plugins',
];

export class EngineOverviewSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly summaryGrid: HTMLElement;
	private readonly statusMessage: HTMLElement;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-overview-section'));
		this.container.style.display = 'none';

		this.statusMessage = DOM.append(this.container, $('.engine-section-status'));
		this.statusMessage.style.display = 'none';

		this.summaryGrid = DOM.append(this.container, $('.engine-overview-grid'));
		this.summaryGrid.style.display = 'none';

		this._register(this.connection.onDidChangeConnection(() => this.render()));
		this.render();
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	setSectionActive(active: boolean): void {
		this.container.style.display = active ? '' : 'none';
	}

	setShowSectionHeading(_show: boolean): void {
		// Overview uses pane detail title only.
	}

	layout(width: number, _height: number): void {
		this.container.classList.toggle('engine-overview-section--narrow', width < 400);
	}

	private render(): void {
		this.summaryGrid.style.display = 'none';
		this.hideStatus();

		if (!this.connection.isEngineConnected()) {
			this.showDisconnectedStatus();
			return;
		}

		const snapshot = this.connection.getConnectionSnapshot();
		const phase = this.connection.getConnectionPhase();
		this.summaryGrid.style.display = '';
		DOM.clearNode(this.summaryGrid);

		this.appendSummaryRow(localize('ua.engineOverviewConnection', "Connection"), getConnectionPhasePaneLabel(phase));
		this.appendSummaryRow(localize('ua.engineOverviewWorkDir', "Working directory"), snapshot.workDir ?? localize('ua.engineOverviewWorkDirUnknown', "Unknown"));
		this.appendSummaryRow(localize('ua.engineOverviewTransport', "Transport"), getOverviewTransportLabel(snapshot.transport));
		this.appendSummaryRow(
			localize('ua.engineOverviewProvider', "Provider"),
			localize('ua.engineOverviewProviderUnavailable', "Unavailable — this client has no provider API yet."),
		);
		this.appendSummaryRow(
			localize('ua.engineOverviewModel', "Model"),
			localize('ua.engineOverviewModelUnavailable', "Unavailable — this client has no model profile API yet."),
		);

		if (snapshot.transport === 'failed') {
			this.showStatus(localize('ua.engineOverviewTransportFailedCopy', "Engine transport failed. Retry from Connection preferences."));
		}

		const capabilitiesHeading = DOM.append(this.summaryGrid, $('.engine-overview-capabilities-heading'));
		capabilitiesHeading.textContent = localize('ua.engineOverviewCapabilities', "Capabilities");
		const capabilitiesList = DOM.append(this.summaryGrid, $('.engine-overview-capabilities-list'));
		for (const key of OVERVIEW_CAPABILITY_KEYS) {
			const entry = snapshot.capabilities[key];
			const row = DOM.append(capabilitiesList, $('.engine-overview-capability-row'));
			DOM.append(row, $('.engine-overview-capability-name')).textContent = getOverviewCapabilityLabel(key);
			const support = DOM.append(row, $('.engine-overview-capability-support'));
			support.textContent = formatCapabilitySupportLabel(entry.support);
			if (entry.reason) {
				support.title = entry.reason;
			}
		}
	}

	private appendSummaryRow(label: string, value: string): void {
		const row = DOM.append(this.summaryGrid, $('.engine-overview-row'));
		DOM.append(row, $('.engine-overview-label')).textContent = label;
		DOM.append(row, $('.engine-overview-value')).textContent = value;
	}

	private showDisconnectedStatus(): void {
		this.statusMessage.style.display = '';
		DOM.clearNode(this.statusMessage);
		this.statusMessage.textContent = getEngineSectionDisconnectedCopy();

		const actions = DOM.append(this.statusMessage, $('.engine-section-status-actions'));
		const openConnection = this._register(new Button(actions, defaultButtonStyles));
		openConnection.label = localize('ua.engineOpenConnection', "Open Connection");
		this._register(openConnection.onDidClick(() => {
			void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID);
		}));
	}

	private showStatus(message: string): void {
		this.statusMessage.style.display = '';
		DOM.clearNode(this.statusMessage);
		this.statusMessage.textContent = message;
	}

	private hideStatus(): void {
		this.statusMessage.style.display = 'none';
		DOM.clearNode(this.statusMessage);
	}
}
