/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { readCapabilityEntry } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import type {
	UniverseAgentCapabilitySupport,
	UniverseAgentModelEntry,
	UniverseAgentProviderStatus,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import {
	canShowCatalogRows,
	type EngineCatalogListPhase,
	type EngineCatalogPaneMode,
	resolveEngineCatalogPaneMode,
} from './engineCatalog.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';

const $ = DOM.$;

const PROVIDER_FEATURE = localize('ua.engineProviderFeatureLabel', "provider configuration");
const MODEL_FEATURE = localize('ua.engineModelFeatureLabel', "model registry");

const PROVIDER_REGISTRY_FOOTNOTE = localize(
	'ua.engineModelProviderFootnote',
	"provider 名来自模型注册表，不代表已配置凭据",
);

function getTransportErrorMessage(error: unknown): string | undefined {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return undefined;
}

function getModelEnabledLabel(enabled: boolean): string {
	return enabled
		? localize('ua.engineModelEnabled', "Enabled")
		: localize('ua.engineModelDisabled', "Disabled");
}

function formatProviderConfiguredLabel(configured: boolean): string {
	return configured
		? localize('ua.engineProviderConfigured', "Configured")
		: localize('ua.engineProviderNotConfigured', "Not configured");
}

function formatProviderRowSummary(provider: UniverseAgentProviderStatus): string {
	const parts: string[] = [
		provider.providerId,
		provider.protocol,
		formatProviderConfiguredLabel(provider.configured),
		provider.credentialSource,
		provider.hasBaseUrl
			? localize('ua.engineProviderHasBaseUrl', "base URL set")
			: localize('ua.engineProviderNoBaseUrl', "no base URL"),
		getModelEnabledLabel(provider.enabled),
	];
	return parts.filter(part => part.length > 0).join(' · ');
}

function formatModelRowSummary(model: UniverseAgentModelEntry): string {
	const parts: string[] = [model.type, model.modelId, String(model.level)];
	if (model.cost) {
		parts.push(model.cost);
	}
	if (model.speed) {
		parts.push(model.speed);
	}
	parts.push(getModelEnabledLabel(model.enabled));
	return parts.filter(part => part.length > 0).join(' · ');
}

function groupModelsByProvider(models: readonly UniverseAgentModelEntry[]): ReadonlyArray<{
	readonly provider: string;
	readonly models: readonly UniverseAgentModelEntry[];
}> {
	const buckets = new Map<string, UniverseAgentModelEntry[]>();
	for (const model of models) {
		const existing = buckets.get(model.provider);
		if (existing) {
			existing.push(model);
		} else {
			buckets.set(model.provider, [model]);
		}
	}
	return [...buckets.keys()]
		.sort((a, b) => a.localeCompare(b))
		.map(provider => ({ provider, models: buckets.get(provider) ?? [] }));
}

export class EngineProviderModelSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly providerStatus: EngineCatalogStatusWidget;
	private readonly providerList: HTMLElement;
	private readonly modelStatus: EngineCatalogStatusWidget;
	private readonly modelList: HTMLElement;
	private readonly sessionHint: HTMLElement;

	private providerMode: EngineCatalogPaneMode = 'disconnected';
	private providerCount = 0;
	private providerListPhase: EngineCatalogListPhase = { kind: 'none' };
	private providerRefreshGeneration = 0;
	private modelMode: EngineCatalogPaneMode = 'disconnected';
	private modelCount = 0;
	private modelListPhase: EngineCatalogListPhase = { kind: 'none' };
	private refreshGeneration = 0;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-provider-model-section'));
		this.container.style.display = 'none';

		const form = DOM.append(this.container, $('.engine-provider-model-form'));

		const providerGroup = DOM.append(form, $('.engine-provider-model-group.engine-provider-model-group--provider'));
		DOM.append(providerGroup, $('h4.engine-provider-model-heading')).textContent = localize('ua.engineProviderHeading', "Provider");
		this.providerStatus = this._register(new EngineCatalogStatusWidget(providerGroup));
		this.providerList = DOM.append(providerGroup, $('.engine-provider-status-list.engine-catalog-list'));
		this.providerList.style.display = 'none';

		const modelGroup = DOM.append(form, $('.engine-provider-model-group.engine-provider-model-group--model'));
		DOM.append(modelGroup, $('h4.engine-provider-model-heading')).textContent = localize('ua.engineModelHeading', "Model");
		this.modelStatus = this._register(new EngineCatalogStatusWidget(modelGroup));
		this.modelList = DOM.append(modelGroup, $('.engine-provider-model-list.engine-catalog-list'));
		this.modelList.style.display = 'none';
		this.sessionHint = DOM.append(modelGroup, $('.engine-provider-model-session-hint'));
		this.sessionHint.textContent = localize(
			'ua.engineModelSessionHint',
			"Session model selection and preferences (SwitchModel) belong in the Composer Model dropdown, not on this page.",
		);
		this.sessionHint.style.display = 'none';

		this._register(this.connection.onDidChangeConnection(() => void this.refresh()));
		void this.refresh();
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	setSectionActive(active: boolean): void {
		this.container.style.display = active ? '' : 'none';
	}

	setShowSectionHeading(_show: boolean): void {
		// Pane detail title only.
	}

	getMode(): EngineCatalogPaneMode {
		return this.modelMode;
	}

	getListEntryCount(): number {
		return this.modelCount;
	}

	getProviderMode(): EngineCatalogPaneMode {
		return this.providerMode;
	}

	getProviderListEntryCount(): number {
		return this.providerCount;
	}

	layout(_width: number, _height: number): void {
		// Static grouped list.
	}

	private refresh(): void {
		void this.refreshProviders();
		void this.refreshModels();
	}

	private hasProviderListHook(): boolean {
		return typeof this.connection.listProviderStatus === 'function';
	}

	/**
	 * Without a connection list hook, SUPPORTED would stall in loading
	 * (`listPhase: none`) — fold it to unsupported (zero engine data).
	 */
	private resolveProviderMode(
		connected: boolean,
		support: UniverseAgentCapabilitySupport,
		listPhase: EngineCatalogListPhase = { kind: 'none' },
	): EngineCatalogPaneMode {
		const mode = resolveEngineCatalogPaneMode(connected, support, listPhase);
		if (!this.hasProviderListHook() && (mode === 'ready' || mode === 'empty' || (connected && support === 'SUPPORTED'))) {
			return 'unsupported';
		}
		return mode;
	}

	private async refreshProviders(): Promise<void> {
		const generation = ++this.providerRefreshGeneration;
		const connected = this.connection.isEngineConnected();
		const entry = readCapabilityEntry(this.connection.getCapabilitySnapshot(), 'providerConfig');

		if (!connected) {
			this.clearProviderPresentation();
			this.providerListPhase = { kind: 'none' };
			this.renderProviderStatus(this.resolveProviderMode(false, entry.support));
			return;
		}

		if (entry.support === 'UNSUPPORTED') {
			this.clearProviderPresentation();
			this.providerListPhase = { kind: 'none' };
			this.renderProviderStatus(this.resolveProviderMode(true, entry.support), entry.reason);
			return;
		}

		if (!this.hasProviderListHook()) {
			this.clearProviderPresentation();
			this.providerListPhase = { kind: 'none' };
			this.renderProviderStatus(this.resolveProviderMode(true, entry.support), entry.reason);
			return;
		}

		if (entry.support === 'UNKNOWN') {
			const hadLivePaint = this.providerCount > 0;
			if (!hadLivePaint) {
				this.clearProviderPresentation();
			} else {
				this.providerList.style.display = '';
			}
			this.providerListPhase = { kind: 'none' };
			this.renderProviderStatus(this.resolveProviderMode(true, entry.support), undefined, 'capability');
			return;
		}

		this.providerListPhase = { kind: 'inFlight' };
		this.renderProviderStatus(this.resolveProviderMode(true, entry.support, this.providerListPhase), undefined, 'list');

		try {
			const result = await this.connection.listProviderStatus!();
			if (generation !== this.providerRefreshGeneration) {
				return;
			}
			if (!this.connection.isEngineConnected()) {
				this.clearProviderPresentation();
				this.providerListPhase = { kind: 'none' };
				this.renderProviderStatus(this.resolveProviderMode(false, entry.support));
				return;
			}
			this.providerListPhase = { kind: 'success', itemCount: result.providers.length };
			const mode = this.resolveProviderMode(true, entry.support, this.providerListPhase);
			this.renderProviderStatus(mode);
			if (canShowCatalogRows(mode)) {
				this.renderProviderList(result.providers);
			} else {
				this.clearProviderPresentation();
			}
		} catch (error) {
			if (generation !== this.providerRefreshGeneration) {
				return;
			}
			const hadLivePaint = this.providerCount > 0;
			if (!hadLivePaint) {
				this.clearProviderPresentation();
			} else {
				this.providerList.style.display = '';
			}
			const reason = getTransportErrorMessage(error);
			this.providerListPhase = { kind: 'failed', error: reason };
			this.renderProviderStatus(
				this.resolveProviderMode(true, entry.support, this.providerListPhase),
				reason,
				undefined,
				() => void this.refreshProviders(),
			);
		}
	}

	private renderProviderStatus(
		mode: EngineCatalogPaneMode,
		reason?: string,
		loadingKind?: 'capability' | 'list',
		onRetry?: () => void,
	): void {
		this.providerMode = mode;
		this.providerStatus.render({
			mode,
			featureLabel: PROVIDER_FEATURE,
			reason,
			loadingKind,
			emptyCopy: localize('ua.engineProviderListEmpty', "No providers reported."),
			onRetry,
			onOpenConnection: mode === 'disconnected'
				? () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID)
				: undefined,
		});
	}

	private renderProviderList(providers: readonly UniverseAgentProviderStatus[]): void {
		this.providerCount = providers.length;
		DOM.clearNode(this.providerList);
		for (const provider of providers) {
			const row = DOM.append(this.providerList, $('.engine-catalog-row.engine-provider-status-row'));
			if (!provider.enabled) {
				row.classList.add('engine-provider-status-row--disabled');
			}
			const text = DOM.append(row, $('.engine-catalog-text'));
			DOM.append(text, $('.engine-catalog-name')).textContent = provider.brand || provider.providerId;
			DOM.append(text, $('.engine-catalog-description')).textContent = formatProviderRowSummary(provider);
		}
		this.providerList.style.display = '';
	}

	private clearProviderPresentation(): void {
		this.providerCount = 0;
		DOM.clearNode(this.providerList);
		this.providerList.style.display = 'none';
	}

	private async refreshModels(): Promise<void> {
		const generation = ++this.refreshGeneration;
		const connected = this.connection.isEngineConnected();
		const entry = readCapabilityEntry(this.connection.getCapabilitySnapshot(), 'models');

		if (!connected) {
			this.clearModelPresentation();
			this.modelListPhase = { kind: 'none' };
			this.renderModelStatus(resolveEngineCatalogPaneMode(false, entry.support));
			return;
		}

		if (entry.support === 'UNSUPPORTED') {
			this.clearModelPresentation();
			this.modelListPhase = { kind: 'none' };
			this.renderModelStatus(resolveEngineCatalogPaneMode(true, entry.support), entry.reason);
			return;
		}

		if (entry.support === 'UNKNOWN') {
			// D252: leftover honesty after a live paint (align D204 Composer UNKNOWN
			// keep-last). First-pull UNKNOWN still clears — no fake list, no list RPC.
			const hadLivePaint = this.modelCount > 0;
			if (!hadLivePaint) {
				this.clearModelPresentation();
			} else {
				this.sessionHint.style.display = 'none';
				this.modelList.style.display = '';
			}
			this.modelListPhase = { kind: 'none' };
			this.renderModelStatus(resolveEngineCatalogPaneMode(true, entry.support), undefined, 'capability');
			return;
		}

		this.modelListPhase = { kind: 'inFlight' };
		this.renderModelStatus(resolveEngineCatalogPaneMode(true, entry.support, this.modelListPhase), undefined, 'list');

		try {
			const result = await this.connection.listModels();
			if (generation !== this.refreshGeneration) {
				return;
			}
			if (!this.connection.isEngineConnected()) {
				this.clearModelPresentation();
				this.modelListPhase = { kind: 'none' };
				this.renderModelStatus(resolveEngineCatalogPaneMode(false, entry.support));
				return;
			}
			this.modelListPhase = { kind: 'success', itemCount: result.models.length };
			const mode = resolveEngineCatalogPaneMode(true, entry.support, this.modelListPhase);
			this.renderModelStatus(mode);
			if (canShowCatalogRows(mode)) {
				this.renderModelList(result.models);
			} else {
				this.clearModelPresentation();
			}
			this.sessionHint.style.display = (mode === 'ready' || mode === 'empty') ? '' : 'none';
		} catch (error) {
			if (generation !== this.refreshGeneration) {
				return;
			}
			const hadLivePaint = this.modelCount > 0;
			if (!hadLivePaint) {
				this.clearModelPresentation();
			} else {
				this.sessionHint.style.display = 'none';
				this.modelList.style.display = '';
			}
			const reason = getTransportErrorMessage(error);
			this.modelListPhase = { kind: 'failed', error: reason };
			this.renderModelStatus(
				resolveEngineCatalogPaneMode(true, entry.support, this.modelListPhase),
				reason,
				undefined,
				() => void this.refreshModels(),
			);
		}
	}

	private renderModelStatus(
		mode: EngineCatalogPaneMode,
		reason?: string,
		loadingKind?: 'capability' | 'list',
		onRetry?: () => void,
	): void {
		this.modelMode = mode;
		this.modelStatus.render({
			mode,
			featureLabel: MODEL_FEATURE,
			reason,
			loadingKind,
			emptyCopy: localize('ua.engineModelListEmpty', "No models in the registry."),
			onRetry,
			onOpenConnection: mode === 'disconnected'
				? () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID)
				: undefined,
		});
	}

	private renderModelList(models: readonly UniverseAgentModelEntry[]): void {
		this.modelCount = models.length;
		DOM.clearNode(this.modelList);
		for (const group of groupModelsByProvider(models)) {
			const groupEl = DOM.append(this.modelList, $('.engine-provider-model-provider-group'));
			const heading = DOM.append(groupEl, $('.engine-provider-model-group-heading'));
			const title = DOM.append(heading, $('.engine-catalog-group-label.engine-provider-model-provider-name'));
			title.textContent = group.provider;
			const footnote = DOM.append(heading, $('span.engine-provider-model-footnote'));
			footnote.textContent = PROVIDER_REGISTRY_FOOTNOTE;
			for (const model of group.models) {
				const row = DOM.append(groupEl, $('.engine-catalog-row.engine-provider-model-row'));
				if (!model.enabled) {
					row.classList.add('engine-provider-model-row--disabled');
				}
				const text = DOM.append(row, $('.engine-catalog-text'));
				DOM.append(text, $('.engine-catalog-name')).textContent = model.modelId || model.id;
				DOM.append(text, $('.engine-catalog-description')).textContent = formatModelRowSummary(model);
			}
		}
		this.modelList.style.display = '';
	}

	private clearModelPresentation(): void {
		this.modelCount = 0;
		DOM.clearNode(this.modelList);
		this.modelList.style.display = 'none';
		this.sessionHint.style.display = 'none';
	}
}
