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
	UniverseAgentCapabilitySupport,
	UniverseAgentCapabilityKey,
	UniverseAgentModelEntry,
	UniverseAgentTransportState,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';

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

export function formatOverviewModelSummary(models: readonly UniverseAgentModelEntry[]): string {
	return localize('ua.engineOverviewModelCount', "{0} 个模型", models.length);
}

export function formatOverviewProviderSummary(models: readonly UniverseAgentModelEntry[]): string {
	const providers = new Set<string>();
	for (const model of models) {
		if (model.provider) {
			providers.add(model.provider);
		}
	}
	return localize(
		'ua.engineOverviewProviderCount',
		"来自模型注册表的 {0} 个 provider（不代表已配凭据）",
		providers.size,
	);
}

export function formatOverviewRegistryUnavailable(support: UniverseAgentCapabilitySupport): string {
	if (support === 'UNSUPPORTED') {
		return localize('ua.engineOverviewRegistryUnsupported', "Unavailable — engine has no model registry.");
	}
	return localize('ua.engineOverviewRegistryUnknown', "Unknown — model registry capability not advertised.");
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
		void this.renderAsync();
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
		const modelsSupport = snapshot.capabilities?.models?.support ?? 'UNKNOWN';
		let providerValue = formatOverviewRegistryUnavailable(modelsSupport);
		let modelValue = formatOverviewRegistryUnavailable(modelsSupport);

		if (modelsSupport === 'SUPPORTED') {
			providerValue = localize('ua.engineOverviewRegistryLoading', "Loading…");
			modelValue = localize('ua.engineOverviewRegistryLoading', "Loading…");
		}

		this.paintSummary(snapshot, phase, providerValue, modelValue);

		if (modelsSupport === 'SUPPORTED') {
			try {
				const result = await this.connection.listModels();
				if (generation !== this.renderGeneration) {
					return;
				}
				providerValue = formatOverviewProviderSummary(result.models);
				modelValue = formatOverviewModelSummary(result.models);
			} catch (error) {
				if (generation !== this.renderGeneration) {
					return;
				}
				const reason = error instanceof Error ? error.message : String(error);
				providerValue = reason;
				modelValue = reason;
			}
			this.paintSummary(this.connection.getConnectionSnapshot(), this.connection.getConnectionPhase(), providerValue, modelValue);
		}
	}

	private paintSummary(
		snapshot: ReturnType<IUniverseAgentConnection['getConnectionSnapshot']>,
		phase: ReturnType<IUniverseAgentConnection['getConnectionPhase']>,
		providerValue: string,
		modelValue: string,
	): void {
		this.summaryGrid.style.display = '';
		DOM.clearNode(this.summaryGrid);

		this.appendSummaryRow(localize('ua.engineOverviewConnection', "Connection"), getConnectionPhaseStatusBarText(phase));
		this.appendSummaryRow(localize('ua.engineOverviewWorkDir', "Working directory"), snapshot.workDir ?? localize('ua.engineOverviewWorkDirUnknown', "Unknown"));
		this.appendSummaryRow(localize('ua.engineOverviewTransport', "Transport"), getOverviewTransportLabel(snapshot.transport));
		this.appendSummaryRow(localize('ua.engineOverviewProvider', "Provider"), providerValue);
		this.appendSummaryRow(localize('ua.engineOverviewModel', "Model"), modelValue);

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

	private appendSummaryRow(label: string, value: string): void {
		const row = DOM.append(this.summaryGrid, $('.engine-overview-row'));
		DOM.append(row, $('.engine-overview-label')).textContent = label;
		DOM.append(row, $('.engine-overview-value')).textContent = value;
	}

}
