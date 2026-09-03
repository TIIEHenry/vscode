/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';
import { getConnectionPhaseStatusBarText } from './conversationSessionStatus.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { formatCapabilitySupportLabel } from './engineSectionChrome.js';
import type {
	UniverseAgentCapabilityKey,
	UniverseAgentTransportState,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';

const $ = DOM.$;

const PROVIDER_UNAVAILABLE = localize(
	'ua.engineOverviewProviderUnavailable',
	"Unavailable — this client has no provider API yet.",
);

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

export function formatOverviewModelUnsupportedCopy(): string {
	return localize(
		'ua.engineOverviewModelUnavailable',
		"Unavailable — this client has no model profile API yet.",
	);
}

export function formatOverviewModelUnknownCopy(): string {
	return localize('ua.engineOverviewModelUnknown', "正在确认引擎能力…");
}

export function formatOverviewModelLoadingCopy(): string {
	return localize('ua.engineOverviewModelLoading', "正在读取…");
}

export function formatOverviewModelSummary(modelCount: number): string {
	if (modelCount === 0) {
		return localize('ua.engineOverviewModelEmpty', "No models in the registry.");
	}
	return localize('ua.engineOverviewModelCount', "{0} models", modelCount);
}

export function formatOverviewModelFailedCopy(reason: string): string {
	return localize('ua.engineOverviewModelFailed', "读取失败 — {0}", reason);
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
	private readonly status: EngineCatalogStatusWidget;
	private sectionActive = false;
	private modelDataLoaded = false;
	private renderGeneration = 0;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-overview-section'));
		this.container.style.display = 'none';

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		this.summaryGrid = DOM.append(this.container, $('.engine-overview-grid'));
		this.summaryGrid.style.display = 'none';

		this._register(this.connection.onDidChangeConnection(() => {
			this.modelDataLoaded = false;
			this.render();
		}));
		this.render();
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	setSectionActive(active: boolean): void {
		const wasInactive = !this.sectionActive;
		this.sectionActive = active;
		this.container.style.display = active ? '' : 'none';
		if (active && wasInactive && this.connection.isEngineConnected()) {
			const modelsSupport = this.connection.getConnectionSnapshot().capabilities?.models?.support ?? 'UNKNOWN';
			if (modelsSupport === 'SUPPORTED' && !this.modelDataLoaded) {
				void this.renderAsync();
			}
		}
	}

	setShowSectionHeading(_show: boolean): void {
		// Overview uses pane detail title only.
	}

	layout(width: number, _height: number): void {
		this.container.classList.toggle('engine-overview-section--narrow', width < 400);
	}

	private render(): void {
		void this.renderAsync();
	}

	private resolveModelRow(
		modelsSupport: 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN',
		reason: string | undefined,
	): { value: string; title?: string } {
		switch (modelsSupport) {
			case 'UNSUPPORTED':
				return { value: formatOverviewModelUnsupportedCopy(), title: reason };
			case 'UNKNOWN':
				return { value: formatOverviewModelUnknownCopy() };
			default:
				return { value: formatOverviewModelLoadingCopy() };
		}
	}

	private async renderAsync(): Promise<void> {
		const generation = ++this.renderGeneration;
		this.summaryGrid.style.display = 'none';
		this.status.hide();

		if (!this.connection.isEngineConnected()) {
			this.status.render({
				mode: 'disconnected',
				onOpenConnection: () => {
					void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID);
				},
			});
			return;
		}

		const snapshot = this.connection.getConnectionSnapshot();
		const phase = this.connection.getConnectionPhase();
		const modelsEntry = snapshot.capabilities?.models;
		const modelsSupport = modelsEntry?.support ?? 'UNKNOWN';
		let modelRow = this.resolveModelRow(modelsSupport, modelsEntry?.reason);

		this.paintSummary(snapshot, phase, modelRow.value, modelRow.title);

		const shouldFetchModels = modelsSupport === 'SUPPORTED'
			&& this.sectionActive
			&& !this.modelDataLoaded;
		if (!shouldFetchModels) {
			return;
		}

		try {
			const result = await this.connection.listModels();
			if (generation !== this.renderGeneration) {
				return;
			}
			if (!this.connection.isEngineConnected()) {
				return;
			}
			this.modelDataLoaded = true;
			modelRow = { value: formatOverviewModelSummary(result.models.length) };
		} catch (error) {
			if (generation !== this.renderGeneration) {
				return;
			}
			const reason = error instanceof Error ? error.message : String(error);
			modelRow = { value: formatOverviewModelFailedCopy(reason) };
		}

		this.paintSummary(this.connection.getConnectionSnapshot(), this.connection.getConnectionPhase(), modelRow.value, modelRow.title);
	}

	private paintSummary(
		snapshot: ReturnType<IUniverseAgentConnection['getConnectionSnapshot']>,
		phase: ReturnType<IUniverseAgentConnection['getConnectionPhase']>,
		modelValue: string,
		modelTitle?: string,
	): void {
		this.summaryGrid.style.display = '';
		DOM.clearNode(this.summaryGrid);

		this.appendSummaryRow(localize('ua.engineOverviewConnection', "Connection"), getConnectionPhaseStatusBarText(phase));
		this.appendSummaryRow(localize('ua.engineOverviewWorkDir', "Working directory"), snapshot.workDir ?? localize('ua.engineOverviewWorkDirUnknown', "Unknown"));
		this.appendSummaryRow(localize('ua.engineOverviewTransport', "Transport"), getOverviewTransportLabel(snapshot.transport));
		this.appendSummaryRow(localize('ua.engineOverviewProvider', "Provider"), PROVIDER_UNAVAILABLE);
		this.appendSummaryRow(localize('ua.engineOverviewModel', "Model"), modelValue, modelTitle);

		if (snapshot.transport === 'failed') {
			this.status.render({
				mode: 'failed',
				featureLabel: localize('ua.engineOverviewTransportFeature', "engine transport"),
				reason: localize('ua.engineOverviewTransportFailedCopy', "Engine transport failed. Retry from Connection preferences."),
				onRetry: () => this.render(),
			});
		}

		const capabilitiesHeading = DOM.append(this.summaryGrid, $('.engine-overview-capabilities-heading'));
		capabilitiesHeading.textContent = localize('ua.engineOverviewCapabilities', "Capabilities");
		const capabilitiesList = DOM.append(this.summaryGrid, $('.engine-overview-capabilities-list'));
		for (const key of OVERVIEW_CAPABILITY_KEYS) {
			const entry = snapshot.capabilities?.[key];
			const row = DOM.append(capabilitiesList, $('.engine-overview-capability-row'));
			DOM.append(row, $('.engine-overview-capability-name')).textContent = getOverviewCapabilityLabel(key);
			const support = DOM.append(row, $('.engine-overview-capability-support'));
			support.textContent = formatCapabilitySupportLabel(entry?.support ?? 'UNKNOWN');
			if (entry?.reason) {
				support.title = entry.reason;
			}
		}
	}

	private appendSummaryRow(label: string, value: string, valueTitle?: string): void {
		const row = DOM.append(this.summaryGrid, $('.engine-overview-row'));
		DOM.append(row, $('.engine-overview-label')).textContent = label;
		const valueEl = DOM.append(row, $('.engine-overview-value'));
		valueEl.textContent = value;
		if (valueTitle) {
			valueEl.title = valueTitle;
		}
	}

}
