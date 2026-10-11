/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
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
import { isConversationPairingHold } from './conversationSessionStatus.js';
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

/** Credential status for engine providers. Read-only; no key, base URL, or test form. */
export class EngineProvidersSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly providerStatus: EngineCatalogStatusWidget;
	private readonly providerList: HTMLElement;

	private providerMode: EngineCatalogPaneMode = 'disconnected';
	private providerCount = 0;
	private readonly _onDidChangeItemCount = this._register(new Emitter<void>());
	readonly onDidChangeItemCount: Event<void> = this._onDidChangeItemCount.event;
	private providerListPhase: EngineCatalogListPhase = { kind: 'none' };
	private providerRefreshGeneration = 0;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-providers-section'));
		this.container.style.display = 'none';

		this.providerStatus = this._register(new EngineCatalogStatusWidget(this.container));
		this.providerList = DOM.append(this.container, $('.engine-provider-status-list.engine-catalog-list'));
		this.providerList.style.display = 'none';

		this._register(this.connection.onDidChangeConnection(() => void this.refresh()));
		void this.refresh();
	}

	override dispose(): void {
		this.providerRefreshGeneration++;
		this.clearProviderPresentation();
		super.dispose();
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
		return this.providerMode;
	}

	getListEntryCount(): number {
		return this.providerCount;
	}

	/** Nav badge counts provider-status rows, including disabled ones. */
	getItemCount(): number | undefined {
		return this.providerCount > 0 ? this.providerCount : undefined;
	}

	layout(_width: number, _height: number): void {
		// Static list.
	}

	private setProviderCount(count: number): void {
		if (this.providerCount === count) {
			return;
		}
		this.providerCount = count;
		this._onDidChangeItemCount.fire();
	}

	private refresh(): void {
		void this.refreshProviders().catch(onUnexpectedError).catch(onUnexpectedError);
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

	private applyDisconnectedProvidersRefresh(support: UniverseAgentCapabilitySupport, hadLiveCatalog: boolean): void {
		// D359 leftover-looks-live: pairing-hold first. KEEP-chrome is not only `isEngineConnected()`.
		if (hadLiveCatalog && isConversationPairingHold(this.connection)) {
			this.providerList.style.display = '';
			this.providerListPhase = { kind: 'none' };
			this.renderProviderStatus(this.resolveProviderMode(false, support));
			return;
		}
		this.clearProviderPresentation();
		this.providerListPhase = { kind: 'none' };
		this.renderProviderStatus(this.resolveProviderMode(false, support));
	}

	private async refreshProviders(): Promise<void> {
		const generation = ++this.providerRefreshGeneration;
		const connected = this.connection.isEngineConnected();
		const entry = readCapabilityEntry(this.connection.getCapabilitySnapshot(), 'providerConfig');

		if (isConversationPairingHold(this.connection) || !connected) {
			this.applyDisconnectedProvidersRefresh(entry.support, this.providerCount > 0);
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
			if (generation !== this.providerRefreshGeneration || this._store.isDisposed) {
				return;
			}
			if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
				this.applyDisconnectedProvidersRefresh(entry.support, this.providerCount > 0);
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
			if (generation !== this.providerRefreshGeneration || this._store.isDisposed) {
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
				() => void this.refreshProviders().catch(onUnexpectedError).catch(onUnexpectedError),
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
				? () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID).catch(onUnexpectedError).catch(onUnexpectedError)
				: undefined,
		});
	}

	private renderProviderList(providers: readonly UniverseAgentProviderStatus[]): void {
		this.setProviderCount(providers.length);
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
		this.setProviderCount(0);
		DOM.clearNode(this.providerList);
		this.providerList.style.display = 'none';
	}
}

/** Read-only model registry. Session selection stays in the Composer Model menu. */
export class EngineModelsSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly modelStatus: EngineCatalogStatusWidget;
	private readonly modelList: HTMLElement;
	private readonly sessionHint: HTMLElement;

	private modelMode: EngineCatalogPaneMode = 'disconnected';
	private modelCount = 0;
	private readonly _onDidChangeItemCount = this._register(new Emitter<void>());
	readonly onDidChangeItemCount: Event<void> = this._onDidChangeItemCount.event;
	private modelListPhase: EngineCatalogListPhase = { kind: 'none' };
	private refreshGeneration = 0;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-models-section'));
		this.container.style.display = 'none';

		this.modelStatus = this._register(new EngineCatalogStatusWidget(this.container));
		this.modelList = DOM.append(this.container, $('.engine-models-list.engine-catalog-list'));
		this.modelList.style.display = 'none';
		this.sessionHint = DOM.append(this.container, $('.engine-models-session-hint'));
		this.sessionHint.textContent = localize(
			'ua.engineModelSessionHint',
			"Session model selection and preferences (SwitchModel) belong in the Composer Model dropdown, not on this page.",
		);
		this.sessionHint.style.display = 'none';

		this._register(this.connection.onDidChangeConnection(() => void this.refresh()));
		void this.refresh();
	}

	override dispose(): void {
		this.refreshGeneration++;
		this.clearModelPresentation();
		super.dispose();
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

	/** Nav badge counts registry models, not provider group headings. */
	getItemCount(): number | undefined {
		return this.modelCount > 0 ? this.modelCount : undefined;
	}

	layout(_width: number, _height: number): void {
		// Static grouped list.
	}

	private setModelCount(count: number): void {
		if (this.modelCount === count) {
			return;
		}
		this.modelCount = count;
		this._onDidChangeItemCount.fire();
	}

	private refresh(): void {
		void this.refreshModels().catch(onUnexpectedError).catch(onUnexpectedError);
	}

	private keepLeftoverCatalogForPairingHold(hadLiveCatalog: boolean): boolean {
		return hadLiveCatalog && isConversationPairingHold(this.connection);
	}

	private applyDisconnectedModelsRefresh(support: UniverseAgentCapabilitySupport, hadLiveCatalog: boolean): void {
		if (this.keepLeftoverCatalogForPairingHold(hadLiveCatalog)) {
			this.sessionHint.style.display = 'none';
			this.modelList.style.display = '';
			this.modelListPhase = { kind: 'none' };
			this.renderModelStatus(resolveEngineCatalogPaneMode(false, support));
			return;
		}
		this.clearModelPresentation();
		this.modelListPhase = { kind: 'none' };
		this.renderModelStatus(resolveEngineCatalogPaneMode(false, support));
	}

	private async refreshModels(): Promise<void> {
		const generation = ++this.refreshGeneration;
		const connected = this.connection.isEngineConnected();
		const entry = readCapabilityEntry(this.connection.getCapabilitySnapshot(), 'models');

		// D340 leftover-looks-live: pairing-hold first. KEEP is not only `!connected`.
		if (isConversationPairingHold(this.connection) || !connected) {
			this.applyDisconnectedModelsRefresh(entry.support, this.modelCount > 0);
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
			if (generation !== this.refreshGeneration || this._store.isDisposed) {
				return;
			}
			if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
				this.applyDisconnectedModelsRefresh(entry.support, this.modelCount > 0);
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
			if (generation !== this.refreshGeneration || this._store.isDisposed) {
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
				() => void this.refreshModels().catch(onUnexpectedError).catch(onUnexpectedError),
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
				? () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID).catch(onUnexpectedError).catch(onUnexpectedError)
				: undefined,
		});
	}

	private renderModelList(models: readonly UniverseAgentModelEntry[]): void {
		this.setModelCount(models.length);
		DOM.clearNode(this.modelList);
		for (const group of groupModelsByProvider(models)) {
			const groupEl = DOM.append(this.modelList, $('.engine-models-provider-group'));
			const title = DOM.append(groupEl, $('.engine-catalog-group-label'));
			title.textContent = group.provider;
			for (const model of group.models) {
				const row = DOM.append(groupEl, $('.engine-catalog-row.engine-models-row'));
				if (!model.enabled) {
					row.classList.add('engine-models-row--disabled');
				}
				const text = DOM.append(row, $('.engine-catalog-text'));
				DOM.append(text, $('.engine-catalog-name')).textContent = model.modelId || model.id;
				DOM.append(text, $('.engine-catalog-description')).textContent = formatModelRowSummary(model);
			}
		}
		this.modelList.style.display = '';
	}

	private clearModelPresentation(): void {
		this.setModelCount(0);
		DOM.clearNode(this.modelList);
		this.modelList.style.display = 'none';
		this.sessionHint.style.display = 'none';
	}
}
