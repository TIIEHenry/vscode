/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button, type IButtonStyles } from '../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { readCapabilityEntry } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import { builtinProviderPresets } from '../../../../platform/universeAgent/common/providerPresetCatalog.js';
import type {
	UniverseAgentCapabilitySupport,
	UniverseAgentModelEntry,
	UniverseAgentProviderPreset,
	UniverseAgentProviderStatus,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { isConversationPairingHold } from './conversationSessionStatus.js';
import { showEngineConfirmPopover } from './engineConfirmPopover.js';
import {
	canPerformCatalogWriteLive,
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

function formatProviderCredentialSource(source: string): string {
	switch (source) {
		case 'FILE':
			return localize('ua.engineProviderCredentialFile', "File");
		case 'PROVIDER_ENV':
			return localize('ua.engineProviderCredentialProviderEnv', "Provider env");
		case 'BUILTIN_ENV':
			return localize('ua.engineProviderCredentialBuiltinEnv', "Built-in env");
		default: {
			const words = source.toLowerCase().split('_').filter(word => word.length > 0);
			return words.map((word, index) => index === 0 ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word).join(' ');
		}
	}
}

function formatPresetSummary(preset: UniverseAgentProviderPreset): string {
	const parts: string[] = [];
	if (preset.defaultProtocol) {
		parts.push(preset.defaultProtocol);
	}
	const host = presetHost(preset.defaultApiBaseUrl);
	if (host) {
		parts.push(host);
	}
	if (preset.defaultModels.length > 0) {
		parts.push(localize('ua.engineProviderPresetModels', "{0} models", preset.defaultModels.length));
	}
	return parts.join(' · ');
}

function getProviderBrandIcon(brandOrId: string): ThemeIcon {
	const lower = brandOrId.toLowerCase();
	if (lower.includes('openai')) {
		return Codicon.sparkle;
	}
	if (lower.includes('anthropic') || lower.includes('claude')) {
		return Codicon.symbolEvent;
	}
	if (lower.includes('deepseek')) {
		return Codicon.hubot;
	}
	if (lower.includes('gemini') || lower.includes('google')) {
		return Codicon.globe;
	}
	if (lower.includes('zhipu') || lower.includes('glm')) {
		return Codicon.zap;
	}
	if (lower.includes('qwen') || lower.includes('alibaba') || lower.includes('dashscope')) {
		return Codicon.cloud;
	}
	if (lower.includes('openrouter')) {
		return Codicon.chip;
	}
	return Codicon.serverProcess;
}

function presetHost(url: string): string {
	const trimmed = url.trim();
	if (!trimmed) {
		return '';
	}
	try {
		return new URL(trimmed).host;
	} catch {
		return trimmed;
	}
}

function formatProviderRowSummary(provider: UniverseAgentProviderStatus): string {
	const parts: string[] = [
		provider.providerId,
		provider.protocol,
		formatProviderConfiguredLabel(provider.configured),
		formatProviderCredentialSource(provider.credentialSource),
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

/** Provider credential status, plus desktop write and local harness import. */
export class EngineProvidersSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly providerStatus: EngineCatalogStatusWidget;
	private readonly providerToolbar: HTMLElement;
	private readonly providerActionMessage: HTMLElement;
	private readonly providerList: HTMLElement;
	private readonly providerRowActions = this._register(new DisposableStore());
	private readonly catalogFilter: HTMLInputElement;
	private readonly builtinList: HTMLElement;
	private readonly cloudStatus: HTMLElement;
	private readonly cloudList: HTMLElement;
	private readonly presetRowActions = this._register(new DisposableStore());
	private providerWriteChromeReady = false;
	private builtinPresets: readonly UniverseAgentProviderPreset[] = builtinProviderPresets();
	private cloudPresets: readonly UniverseAgentProviderPreset[] = [];
	private cloudMessage = '';
	private catalogQuery = '';
	private catalogGeneration = 0;

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
		@IDialogService private readonly dialogService: IDialogService,
		@IContextViewService private readonly contextViewService: IContextViewService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-providers-section'));
		this.container.style.display = 'none';

		this.providerStatus = this._register(new EngineCatalogStatusWidget(this.container));
		this.providerToolbar = DOM.append(this.container, $('.engine-catalog-write-toolbar.engine-catalog-icon-actions'));
		this.providerToolbar.style.display = 'none';
		this.providerActionMessage = DOM.append(this.container, $('.engine-catalog-action-message'));
		this.providerActionMessage.setAttribute('role', 'status');
		this.providerList = DOM.append(this.container, $('.engine-provider-status-list.engine-catalog-list'));
		this.providerList.style.display = 'none';

		const catalog = DOM.append(this.container, $('.engine-provider-catalog'));
		this.catalogFilter = DOM.append(catalog, $('input.engine-provider-catalog-filter')) as HTMLInputElement;
		this.catalogFilter.type = 'search';
		this.catalogFilter.placeholder = localize('ua.engineProviderCatalogFilter', "Filter providers");
		this.catalogFilter.setAttribute('aria-label', localize('ua.engineProviderCatalogFilter', "Filter providers"));
		this._register(DOM.addDisposableListener(this.catalogFilter, 'input', () => {
			this.catalogQuery = this.catalogFilter.value;
			this.renderPresetLists();
		}));
		DOM.append(catalog, $('.engine-catalog-group-label')).textContent = localize('ua.engineProviderBuiltin', "Built-in");
		this.builtinList = DOM.append(catalog, $('.engine-provider-builtin-list'));
		const cloudHeading = DOM.append(catalog, $('.engine-provider-catalog-heading'));
		DOM.append(cloudHeading, $('.engine-catalog-group-label')).textContent = localize('ua.engineProviderCloud', "Cloud");
		if (typeof this.connection.listProviderPresetCatalog === 'function') {
			const cloudActions = DOM.append(cloudHeading, $('.engine-catalog-icon-actions'));
			appendIconButton(this._store, cloudActions, localize('ua.engineProviderCloudRefresh', "Refresh cloud catalog"), Codicon.refresh, () => {
				void this.loadCloudCatalog(true);
			});
		}
		this.cloudStatus = DOM.append(catalog, $('.engine-provider-cloud-status'));
		this.cloudStatus.setAttribute('role', 'status');
		this.cloudList = DOM.append(catalog, $('.engine-provider-cloud-list'));
		this.renderPresetLists();
		void this.loadCloudCatalog(false);

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
		if (this.canWriteProviders()) {
			this.ensureProviderWriteChrome();
			this.providerToolbar.style.display = '';
		} else {
			this.providerToolbar.style.display = 'none';
			this.clearProviderRowActions();
		}
		this.renderPresetLists();
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
		this.clearProviderRowActions();
		DOM.clearNode(this.providerList);
		for (const provider of providers) {
			const row = DOM.append(this.providerList, $('.engine-catalog-row.engine-provider-status-row'));
			if (!provider.enabled) {
				row.classList.add('engine-provider-status-row--disabled');
			}
			const brandName = provider.brand || provider.providerId;

			const avatar = DOM.append(row, $('.engine-provider-avatar'));
			const avatarIcon = DOM.append(avatar, $('span.engine-provider-avatar-icon'));
			avatarIcon.classList.add(...ThemeIcon.asClassNameArray(getProviderBrandIcon(brandName)));

			const text = DOM.append(row, $('.engine-catalog-text'));
			const titleRow = DOM.append(text, $('.engine-provider-title-row'));
			DOM.append(titleRow, $('.engine-catalog-name')).textContent = brandName;

			const metaParts: string[] = [];
			if (provider.protocol && provider.protocol.toLowerCase() !== brandName.toLowerCase()) {
				metaParts.push(provider.protocol);
			}
			metaParts.push(provider.hasBaseUrl
				? localize('ua.engineProviderHasBaseUrl', "base URL set")
				: localize('ua.engineProviderNoBaseUrl', "no base URL"));
			DOM.append(text, $('.engine-catalog-description')).textContent = metaParts.join(' · ');

			const badges = DOM.append(row, $('.engine-provider-badges'));
			const statusPill = DOM.append(badges, $(provider.configured
				? '.engine-provider-pill.engine-provider-pill--success'
				: '.engine-provider-pill.engine-provider-pill--warning'));
			DOM.append(statusPill, $('.engine-provider-pill-dot'));
			DOM.append(statusPill, $('span')).textContent = formatProviderConfiguredLabel(provider.configured);

			if (provider.credentialSource && provider.credentialSource !== 'NONE') {
				const sourcePill = DOM.append(badges, $('.engine-provider-pill.engine-provider-pill--muted'));
				sourcePill.textContent = formatProviderCredentialSource(provider.credentialSource);
			}

			const switchContainer = DOM.append(row, $('.engine-provider-switch-container'));
			const switchEl = DOM.append(switchContainer, $('.engine-provider-switch'));
			const switchLabel = DOM.append(switchContainer, $('span.engine-provider-switch-label'));
			DOM.append(switchEl, $('.engine-provider-switch-thumb'));
			switchEl.setAttribute('aria-hidden', 'true');
			const label = getModelEnabledLabel(provider.enabled);
			switchEl.classList.toggle('is-enabled', provider.enabled);
			switchEl.classList.toggle('is-disabled', !provider.enabled);
			switchLabel.textContent = label;
			row.classList.toggle('engine-provider-status-row--disabled', !provider.enabled);

			if (this.canWriteProviders()) {
				const actions = DOM.append(row, $('.engine-catalog-row-actions.engine-catalog-icon-actions'));
				const name = provider.brand || provider.providerId;
				appendIconButton(this.providerRowActions, actions, localize('ua.engineProviderEdit', "Edit {0}", name), Codicon.edit, () => void this.promptProvider(provider.providerId, provider.protocol, '', 'edit'));
				appendIconButton(this.providerRowActions, actions, localize('ua.engineProviderClearRow', "Clear {0}", name), Codicon.clearAll, anchor => void this.clearProvider(provider.providerId, anchor), true);
			}
		}
		this.providerList.style.display = '';
	}

	private ensureProviderWriteChrome(): void {
		if (this.providerWriteChromeReady) {
			return;
		}
		this.providerWriteChromeReady = true;
		appendIconButton(this._store, this.providerToolbar, localize('ua.engineProviderImport', "Import from local harnesses"), Codicon.desktopDownload, anchor => void this.importLocalProviders(anchor));
		appendIconButton(this._store, this.providerToolbar, localize('ua.engineProviderAdd', "Add provider"), Codicon.add, () => void this.promptProvider('', ''));
	}

	private clearProviderRowActions(): void {
		this.providerRowActions.clear();
		for (const node of this.providerList.querySelectorAll('.engine-catalog-row-actions')) {
			node.remove();
		}
	}

	private canWriteProviders(): boolean {
		return canPerformCatalogWriteLive(
			this.providerMode,
			this.connection.isEngineConnected(),
			isConversationPairingHold(this.connection),
		) && typeof this.connection.upsertProviderCredentials === 'function'
			&& typeof this.connection.clearProviderCredentials === 'function';
	}

	private async loadCloudCatalog(force: boolean): Promise<void> {
		if (typeof this.connection.listProviderPresetCatalog !== 'function') {
			this.cloudMessage = localize('ua.engineProviderCloudDesktop', "Cloud catalog loads in the desktop app.");
			this.renderPresetLists();
			return;
		}
		const generation = ++this.catalogGeneration;
		this.cloudMessage = localize('ua.engineProviderCloudLoading', "Reading the cloud catalog…");
		this.renderPresetLists();
		try {
			const result = await this.connection.listProviderPresetCatalog(force ? { force: true } : undefined);
			if (generation !== this.catalogGeneration || this._store.isDisposed) {
				return;
			}
			this.builtinPresets = result.builtin;
			this.cloudPresets = result.cloud;
			this.cloudMessage = result.cloudStatus === 'loaded'
				? ''
				: (result.cloudError || localize('ua.engineProviderCloudUnavailable', "Cloud catalog is unavailable."));
		} catch (error) {
			if (generation !== this.catalogGeneration || this._store.isDisposed) {
				return;
			}
			this.cloudMessage = localize('ua.engineProviderCloudFailed', "Cloud catalog is unavailable: {0}", publicActionError(error));
		}
		this.renderPresetLists();
	}

	private renderPresetLists(): void {
		this.presetRowActions.clear();
		this.renderPresetRows(this.builtinList, this.filteredPresets(this.builtinPresets));
		this.renderPresetRows(this.cloudList, this.filteredPresets(this.cloudPresets));
		this.cloudStatus.textContent = this.cloudMessage;
		this.cloudStatus.style.display = this.cloudMessage ? '' : 'none';
	}

	private filteredPresets(presets: readonly UniverseAgentProviderPreset[]): readonly UniverseAgentProviderPreset[] {
		const query = this.catalogQuery.trim().toLowerCase();
		if (!query) {
			return presets;
		}
		return presets.filter(preset =>
			preset.displayName.toLowerCase().includes(query) || preset.id.toLowerCase().includes(query));
	}

	private renderPresetRows(host: HTMLElement, presets: readonly UniverseAgentProviderPreset[]): void {
		DOM.clearNode(host);
		for (const preset of presets) {
			const row = DOM.append(host, $('.engine-catalog-row.engine-provider-preset-row'));
			const avatar = DOM.append(row, $('.engine-provider-preset-avatar'));
			const icon = DOM.append(avatar, $('span'));
			icon.classList.add(...ThemeIcon.asClassNameArray(getProviderBrandIcon(preset.displayName || preset.id)));

			const text = DOM.append(row, $('.engine-catalog-text'));
			DOM.append(text, $('.engine-catalog-name')).textContent = preset.displayName;
			DOM.append(text, $('.engine-catalog-description')).textContent = formatPresetSummary(preset);
			if (this.canWriteProviders()) {
				const actions = DOM.append(row, $('.engine-catalog-row-actions.engine-catalog-icon-actions'));
				appendIconButton(
					this.presetRowActions,
					actions,
					localize('ua.engineProviderAddPreset', "Add {0}", preset.displayName),
					Codicon.add,
					() => void this.promptProvider(preset.id, preset.defaultProtocol, preset.defaultApiBaseUrl),
				);
			}
		}
	}

	private setProviderAction(message: string, tone: 'neutral' | 'error'): void {
		this.providerActionMessage.textContent = message;
		this.providerActionMessage.classList.toggle('engine-catalog-action-message--error', tone === 'error');
	}

	private async promptProvider(providerId: string, protocol: string, baseUrl = '', intent: 'add' | 'edit' = 'add'): Promise<void> {
		if (!this.canWriteProviders() || !this.connection.upsertProviderCredentials) {
			return;
		}
		const idRequired = localize('ua.engineProviderIdRequired', "Provider id is required.");
		const result = await this.dialogService.input({
			type: 'question',
			message: intent === 'edit'
				? localize('ua.engineProviderEditTitle', "Edit provider")
				: localize('ua.engineProviderAddTitle', "Add provider"),
			detail: localize('ua.engineProviderDialogDetail', "A blank protocol, base URL, or API key keeps the current value. The key is not shown again. Changing the provider id saves the new id and clears the previous one."),
			primaryButton: localize('ua.engineProviderSave', "Save"),
			inputs: [
				{ type: 'text', label: localize('ua.engineProviderId', "Provider id"), value: providerId, placeholder: localize('ua.engineProviderId', "Provider id") },
				{ type: 'text', label: localize('ua.engineProviderProtocol', "Protocol"), value: protocol, placeholder: localize('ua.engineProviderProtocol', "Protocol") },
				{ type: 'text', label: localize('ua.engineProviderBaseUrl', "Base URL"), value: baseUrl, placeholder: localize('ua.engineProviderBaseUrl', "Base URL") },
				{ type: 'password', label: localize('ua.engineProviderApiKey', "API key"), placeholder: localize('ua.engineProviderApiKey', "API key") },
			],
			validate: values => (values[0] ?? '').trim() ? undefined : idRequired,
		});
		if (!result.confirmed || !result.values) {
			return;
		}
		const [providerIdRaw, protocolRaw, baseUrlRaw, apiKeyRaw] = result.values;
		const nextProviderId = (providerIdRaw ?? '').trim();
		if (!nextProviderId) {
			this.setProviderAction(idRequired, 'error');
			return;
		}
		try {
			await this.connection.upsertProviderCredentials({
				providerId: nextProviderId,
				apiKey: apiKeyRaw ?? '',
				baseUrl: (baseUrlRaw ?? '').trim(),
				protocol: (protocolRaw ?? '').trim(),
			});
			if (intent === 'edit' && providerId && nextProviderId !== providerId && this.connection.clearProviderCredentials) {
				await this.connection.clearProviderCredentials({ providerId });
			}
			this.setProviderAction(localize('ua.engineProviderSaved', "Provider saved. The key is not shown again."), 'neutral');
			this.refresh();
		} catch (error) {
			this.setProviderAction(localize('ua.engineProviderSaveFailed', "Unable to save provider: {0}", publicActionError(error)), 'error');
		}
	}

	private async clearProvider(providerId: string, anchor: HTMLElement): Promise<void> {
		if (!this.canWriteProviders() || !this.connection.clearProviderCredentials) {
			return;
		}
		const confirmed = await showEngineConfirmPopover({
			contextViewService: this.contextViewService,
			anchor,
			message: localize('ua.engineProviderClearConfirm', "Clear credentials for \"{0}\"?", providerId),
			detail: localize('ua.engineProviderClearDetail', "This clears the engine credential store. Host environment variables stay as they are."),
			confirmLabel: localize('ua.engineProviderClear', "Clear"),
		});
		if (!confirmed) {
			return;
		}
		try {
			await this.connection.clearProviderCredentials({ providerId });
			this.setProviderAction(localize('ua.engineProviderCleared', "Credentials cleared."), 'neutral');
			this.refresh();
		} catch (error) {
			this.setProviderAction(localize('ua.engineProviderClearFailed', "Unable to clear credentials: {0}", publicActionError(error)), 'error');
		}
	}

	private async importLocalProviders(anchor: HTMLElement): Promise<void> {
		if (!this.canWriteProviders() || !this.connection.previewHarnessProviderImport || !this.connection.importHarnessProviders) {
			this.setProviderAction(localize('ua.engineProviderImportDesktop', "Import runs in the desktop app."), 'error');
			return;
		}
		let preview;
		try {
			preview = await this.connection.previewHarnessProviderImport();
		} catch (error) {
			this.setProviderAction(localize('ua.engineProviderImportFailed', "Unable to import: {0}", publicActionError(error)), 'error');
			return;
		}
		if (preview.items.length === 0) {
			this.setProviderAction(localize('ua.engineProviderImportEmpty', "No local providers found."), 'neutral');
			return;
		}
		const lines = preview.items.map(item => `${item.label} (${item.source})`);
		const confirmed = await showEngineConfirmPopover({
			contextViewService: this.contextViewService,
			anchor,
			message: localize('ua.engineProviderImportConfirm', "Import {0} providers into the engine?", preview.items.length),
			detail: lines.join('\n'),
			confirmLabel: localize('ua.engineProviderImport', "Import from local harnesses"),
			danger: false,
		});
		if (!confirmed) {
			return;
		}
		try {
			const result = await this.connection.importHarnessProviders({
				providerIds: preview.items.map(item => item.providerId),
			});
			const errorSuffix = result.errors.length > 0 ? ` ${result.errors[0]}` : '';
			this.setProviderAction(localize(
				'ua.engineProviderImportResult',
				"Imported {0}, updated {1}, skipped {2}, models {3}.{4}",
				result.imported,
				result.updated,
				result.skipped,
				result.modelWrites,
				errorSuffix,
			), result.errors.length > 0 ? 'error' : 'neutral');
			this.refresh();
		} catch (error) {
			this.setProviderAction(localize('ua.engineProviderImportFailed', "Unable to import: {0}", publicActionError(error)), 'error');
		}
	}

	private clearProviderPresentation(): void {
		this.setProviderCount(0);
		DOM.clearNode(this.providerList);
		this.providerList.style.display = 'none';
	}
}

function validateModelDialog(values: readonly string[], required: string, levelInvalid: string): string | undefined {
	const parsed = parseModelDialog(values);
	if (parsed.ok) {
		return undefined;
	}
	return parsed.reason === 'level' ? levelInvalid : required;
}

function parseModelDialog(values: readonly string[]): { ok: true; provider: string; modelId: string; type: string; level: number } | { ok: false; message: string; reason: 'required' | 'level' } {
	const provider = (values[0] ?? '').trim();
	const modelId = (values[1] ?? '').trim();
	const type = (values[2] ?? '').trim() || 'general';
	if (!provider || !modelId) {
		return { ok: false, reason: 'required', message: '' };
	}
	const levelText = (values[3] ?? '').trim();
	let level = 0;
	if (levelText) {
		const parsed = Number(levelText);
		if (!Number.isInteger(parsed) || parsed < 1 || parsed > 9) {
			return { ok: false, reason: 'level', message: '' };
		}
		level = parsed;
	}
	// Description, cost, and speed follow level. They are not validated.
	return { ok: true, provider, modelId, type, level };
}

/** Edit keeps a blank field's stored text ('' if unset). Add sends ''. Typed text is trimmed. */
function resolveModelDialogText(raw: string | undefined, previous: string | undefined, editing: boolean): string {
	const trimmed = (raw ?? '').trim();
	if (trimmed) {
		return trimmed;
	}
	return editing ? (previous ?? '') : '';
}

/** Model registry. The open session chooses a model in the composer. */
export class EngineModelsSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly modelStatus: EngineCatalogStatusWidget;
	private readonly modelToolbar: HTMLElement;
	private readonly modelActionMessage: HTMLElement;
	private readonly modelList: HTMLElement;
	private readonly sessionHint: HTMLElement;
	private readonly modelRowActions = this._register(new DisposableStore());
	private modelWriteChromeReady = false;

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
		@IDialogService private readonly dialogService: IDialogService,
		@IContextViewService private readonly contextViewService: IContextViewService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-models-section'));
		this.container.style.display = 'none';

		this.modelStatus = this._register(new EngineCatalogStatusWidget(this.container));
		this.modelToolbar = DOM.append(this.container, $('.engine-catalog-write-toolbar.engine-catalog-icon-actions'));
		this.modelToolbar.style.display = 'none';
		this.modelActionMessage = DOM.append(this.container, $('.engine-catalog-action-message'));
		this.modelActionMessage.setAttribute('role', 'status');
		this.modelList = DOM.append(this.container, $('.engine-models-list.engine-catalog-list'));
		this.modelList.style.display = 'none';
		this.sessionHint = DOM.append(this.container, $('.engine-models-session-hint'));
		this.sessionHint.textContent = localize(
			'ua.engineModelSessionHint',
			"This page is the engine model registry. The open session chooses a model in the composer. That choice stays with the session and is sent as its model profile.",
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
		if (this.canWriteModels()) {
			this.ensureModelWriteChrome();
			this.modelToolbar.style.display = '';
		} else {
			this.modelToolbar.style.display = 'none';
			this.clearModelRowActions();
		}
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
		this.clearModelRowActions();
		DOM.clearNode(this.modelList);
		const writable = this.canWriteModels();
		const testable = writable && typeof this.connection.testModelProfile === 'function';
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
				if (writable) {
					const actions = DOM.append(row, $('.engine-catalog-row-actions.engine-catalog-icon-actions'));
					const name = model.modelId || model.id;
					appendIconButton(this.modelRowActions, actions, localize('ua.engineModelEdit', "Edit {0}", name), Codicon.edit, () => void this.promptModel(model));
					appendIconButton(
						this.modelRowActions,
						actions,
						model.enabled
							? localize('ua.engineModelDisable', "Disable {0}", name)
							: localize('ua.engineModelEnable', "Enable {0}", name),
						model.enabled ? Codicon.circleSlash : Codicon.check,
						() => void this.setListedModelEnabled(model, !model.enabled),
					);
					appendIconButton(this.modelRowActions, actions, localize('ua.engineModelDeleteRow', "Delete {0}", name), Codicon.trash, anchor => void this.deleteListedModel(model, anchor), true);
					if (testable) {
						appendIconButton(this.modelRowActions, actions, localize('ua.engineModelTest', "Test {0}", name), Codicon.beaker, () => void this.testListedModel(model));
					}
				}
			}
		}
		this.modelList.style.display = '';
	}

	private canWriteModels(): boolean {
		return canPerformCatalogWriteLive(
			this.modelMode,
			this.connection.isEngineConnected(),
			isConversationPairingHold(this.connection),
		) && typeof this.connection.upsertModel === 'function'
			&& typeof this.connection.deleteModel === 'function'
			&& typeof this.connection.setModelEnabled === 'function';
	}

	private ensureModelWriteChrome(): void {
		if (this.modelWriteChromeReady) {
			return;
		}
		this.modelWriteChromeReady = true;
		appendIconButton(this._store, this.modelToolbar, localize('ua.engineModelAdd', "Add model"), Codicon.add, () => void this.promptModel());
	}

	private setModelAction(message: string, tone: 'neutral' | 'error'): void {
		this.modelActionMessage.textContent = message;
		this.modelActionMessage.classList.toggle('engine-catalog-action-message--error', tone === 'error');
	}

	private async promptModel(model?: UniverseAgentModelEntry): Promise<void> {
		if (!this.canWriteModels() || !this.connection.upsertModel) {
			return;
		}
		const required = localize('ua.engineModelRequired', "Provider and model id are required.");
		const levelInvalid = localize('ua.engineModelLevelInvalid', "Level must be a whole number from 1 to 9, or left blank.");
		const result = await this.dialogService.input({
			type: 'question',
			message: model
				? localize('ua.engineModelEditTitle', "Edit model")
				: localize('ua.engineModelAddTitle', "Add model"),
			detail: localize('ua.engineModelDialogDetail', "Level is optional, from 1 to 9. Leave it blank to keep the current level. A blank description, cost, or speed keeps the current value. On add, a blank description, cost, or speed is saved as empty. Changing the provider or model id saves a new registry id and removes the previous row."),
			primaryButton: localize('ua.engineModelSave', "Save"),
			inputs: [
				{ type: 'text', label: localize('ua.engineModelProvider', "Provider"), value: model?.provider ?? '', placeholder: localize('ua.engineModelProvider', "Provider") },
				{ type: 'text', label: localize('ua.engineModelId', "Model id"), value: model?.modelId ?? '', placeholder: localize('ua.engineModelId', "Model id") },
				{ type: 'text', label: localize('ua.engineModelType', "Type"), value: model?.type || 'general', placeholder: localize('ua.engineModelType', "Type") },
				{ type: 'text', label: localize('ua.engineModelLevel', "Level (optional, 1–9)"), value: model && model.level > 0 ? String(model.level) : '', placeholder: localize('ua.engineModelLevel', "Level (optional, 1–9)") },
				{ type: 'text', label: localize('ua.engineModelDescription', "Description"), value: model?.description ?? '', placeholder: localize('ua.engineModelDescription', "Description") },
				{ type: 'text', label: localize('ua.engineModelCost', "Cost"), value: model?.cost ?? '', placeholder: localize('ua.engineModelCost', "Cost") },
				{ type: 'text', label: localize('ua.engineModelSpeed', "Speed"), value: model?.speed ?? '', placeholder: localize('ua.engineModelSpeed', "Speed") },
			],
			validate: values => validateModelDialog(values, required, levelInvalid),
		});
		if (!result.confirmed || !result.values) {
			return;
		}
		const parsed = parseModelDialog(result.values);
		if (!parsed.ok) {
			this.setModelAction(parsed.reason === 'level' ? levelInvalid : required, 'error');
			return;
		}
		const { provider, modelId, type, level } = parsed;
		const editing = !!model;
		const description = resolveModelDialogText(result.values[4], model?.description, editing);
		const cost = resolveModelDialogText(result.values[5], model?.cost, editing);
		const speed = resolveModelDialogText(result.values[6], model?.speed, editing);
		const sameIdentity = !!model && model.provider === provider && model.modelId === modelId;
		const id = sameIdentity && model?.id ? model.id : `${provider}:${modelId}`;
		try {
			await this.connection.upsertModel({
				id,
				type,
				enabled: model?.enabled ?? true,
				level,
				description,
				cost,
				speed,
				provider,
				modelId,
			});
			if (model?.id && model.id !== id && this.connection.deleteModel) {
				await this.connection.deleteModel({ id: model.id });
			}
			this.setModelAction(localize('ua.engineModelSaved', "Model saved."), 'neutral');
			this.refresh();
		} catch (error) {
			this.setModelAction(localize('ua.engineModelSaveFailed', "Unable to save model: {0}", publicActionError(error)), 'error');
		}
	}

	private async setListedModelEnabled(model: UniverseAgentModelEntry, enabled: boolean): Promise<void> {
		if (!this.canWriteModels() || !this.connection.setModelEnabled) {
			return;
		}
		try {
			await this.connection.setModelEnabled({ id: model.id, enabled });
			this.setModelAction(enabled
				? localize('ua.engineModelEnabledDone', "Model enabled.")
				: localize('ua.engineModelDisabledDone', "Model disabled."), 'neutral');
			this.refresh();
		} catch (error) {
			this.setModelAction(localize('ua.engineModelEnableFailed', "Unable to update model: {0}", publicActionError(error)), 'error');
		}
	}

	private async deleteListedModel(model: UniverseAgentModelEntry, anchor: HTMLElement): Promise<void> {
		if (!this.canWriteModels() || !this.connection.deleteModel) {
			return;
		}
		const label = model.modelId || model.id;
		const confirmed = await showEngineConfirmPopover({
			contextViewService: this.contextViewService,
			anchor,
			message: localize('ua.engineModelDeleteConfirm', "Delete model \"{0}\"?", label),
			detail: localize('ua.engineModelDeleteDetail', "This removes the model from the engine registry."),
			confirmLabel: localize('ua.engineModelDelete', "Delete"),
		});
		if (!confirmed) {
			return;
		}
		try {
			await this.connection.deleteModel({ id: model.id });
			this.setModelAction(localize('ua.engineModelDeleted', "Model deleted."), 'neutral');
			this.refresh();
		} catch (error) {
			this.setModelAction(localize('ua.engineModelDeleteFailed', "Unable to delete model: {0}", publicActionError(error)), 'error');
		}
	}

	private async testListedModel(model: UniverseAgentModelEntry): Promise<void> {
		if (!this.connection.testModelProfile) {
			return;
		}
		try {
			const result = await this.connection.testModelProfile({
				providerId: model.provider,
				modelId: model.modelId || model.id,
				apiKey: '',
				baseUrl: '',
				protocol: '',
				params: {},
			});
			this.setModelAction(result.ok
				? localize('ua.engineModelTestPassed', "Model test passed.")
				: localize('ua.engineModelTestFailed', "Model test failed: {0}", (result.message ?? '').slice(0, 240)), result.ok ? 'neutral' : 'error');
		} catch (error) {
			this.setModelAction(localize('ua.engineModelTestFailed', "Model test failed: {0}", publicActionError(error)), 'error');
		}
	}

	private clearModelRowActions(): void {
		this.modelRowActions.clear();
		for (const node of this.modelList.querySelectorAll('.engine-catalog-row-actions')) {
			node.remove();
		}
	}

	private clearModelPresentation(): void {
		this.setModelCount(0);
		this.clearModelRowActions();
		DOM.clearNode(this.modelList);
		this.modelList.style.display = 'none';
		this.sessionHint.style.display = 'none';
	}
}

/**
 * Styles stay unset so `.engine-catalog-icon-actions` paints the ghost icon.
 * A label here would become visible text on the button.
 */
const catalogIconButtonStyles: IButtonStyles = {
	buttonBackground: undefined,
	buttonHoverBackground: undefined,
	buttonSeparator: undefined,
	buttonForeground: undefined,
	buttonBorder: undefined,
	buttonSecondaryBackground: undefined,
	buttonSecondaryForeground: undefined,
	buttonSecondaryHoverBackground: undefined,
	buttonSecondaryBorder: undefined,
};

function appendIconButton(store: DisposableStore, parent: HTMLElement, label: string, icon: ThemeIcon, onClick: (anchor: HTMLElement) => void, danger = false): void {
	const button = store.add(new Button(parent, {
		...catalogIconButtonStyles,
		supportIcons: true,
		title: label,
		ariaLabel: label,
	}));
	button.icon = icon;
	if (danger) {
		button.element.classList.add('is-danger');
	}
	store.add(button.onDidClick(() => onClick(button.element)));
}

function publicActionError(error: unknown): string {
	const raw = error instanceof Error && error.message ? error.message : 'request failed';
	return raw.replace(/[\r\n]+/g, ' ').slice(0, 240);
}
