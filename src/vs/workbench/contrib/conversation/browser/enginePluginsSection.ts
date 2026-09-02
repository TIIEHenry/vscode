/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentPluginHookEntry,
	UniverseAgentPluginStatus,
	UniverseAgentPluginSummary,
	UniverseAgentScanNewPluginsResult,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import {
	type EngineCatalogPaneMode,
	canPerformCatalogWrite,
	canShowCatalogRows,
	resolveEngineCatalogPaneMode,
} from './engineCatalog.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';

const $ = DOM.$;

const PLUGINS_FEATURE = localize('ua.enginePluginsFeatureLabel', "engine plugins");
const EMBEDDED_SOURCE = 'embedded';

type EnginePluginListEntry = { readonly kind: 'plugin'; readonly plugin: UniverseAgentPluginSummary };
type PluginWriteMethod = 'enablePlugin' | 'reloadPlugin' | 'unloadPlugin' | 'scanNewPlugins';

class EnginePluginListDelegate implements IListVirtualDelegate<EnginePluginListEntry> {
	getHeight(): number {
		return 40;
	}

	getTemplateId(): string {
		return 'pluginRow';
	}
}

interface IPluginRowTemplateData {
	readonly name: HTMLElement;
	readonly summary: HTMLElement;
}

class EnginePluginRowRenderer implements IListRenderer<EnginePluginListEntry, IPluginRowTemplateData> {
	static readonly TEMPLATE_ID = 'pluginRow';
	readonly templateId = EnginePluginRowRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IPluginRowTemplateData {
		const row = DOM.append(container, $('.engine-catalog-row'));
		const text = DOM.append(row, $('.engine-catalog-text'));
		return {
			name: DOM.append(text, $('.engine-catalog-name')),
			summary: DOM.append(text, $('.engine-catalog-description')),
		};
	}

	renderElement(entry: EnginePluginListEntry, _index: number, templateData: IPluginRowTemplateData): void {
		templateData.name.textContent = entry.plugin.displayName || entry.plugin.id;
		templateData.summary.textContent = formatPluginRowSummary(entry.plugin);
	}

	disposeTemplate(): void {
		// noop
	}
}

class EnginePluginListAccessibilityProvider implements IListAccessibilityProvider<EnginePluginListEntry> {
	getWidgetAriaLabel(): string {
		return localize('ua.enginePluginsList', "Engine plugins");
	}

	getAriaLabel(entry: EnginePluginListEntry): string {
		return entry.plugin.displayName || entry.plugin.id;
	}
}

function getPluginStatusLabel(status: UniverseAgentPluginStatus): string {
	switch (status) {
		case 'active':
			return localize('ua.enginePluginStatusActive', "Active");
		case 'disabled':
			return localize('ua.enginePluginStatusDisabled', "Disabled");
		case 'error':
			return localize('ua.enginePluginStatusError', "Error");
		default:
			return localize('ua.enginePluginStatusUnknown', "Unknown");
	}
}

function formatEngineEpoch(ms: number | undefined): string | undefined {
	if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) {
		return undefined;
	}
	return new Date(ms).toLocaleString();
}

function formatPluginRowSummary(plugin: UniverseAgentPluginSummary): string {
	const parts = [
		plugin.version,
		plugin.source,
		localize('ua.enginePluginHookCount', "{0} hooks", plugin.hookCount),
		getPluginStatusLabel(plugin.status),
	];
	const loadedAt = formatEngineEpoch(plugin.loadedAt);
	if (loadedAt) {
		parts.push(localize('ua.enginePluginLoadedAt', "loaded {0}", loadedAt));
	}
	return parts.filter(part => part.length > 0).join(' — ');
}

function getTransportErrorMessage(error: unknown): string | undefined {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return undefined;
}

/** gRPC PERMISSION_DENIED is code 7; ProxyChannel may keep `code` or only the message. */
function isPermissionDeniedError(error: unknown): boolean {
	if (!error || typeof error !== 'object') {
		return false;
	}
	const code = (error as { code?: unknown }).code;
	if (code === 7 || code === 'PERMISSION_DENIED') {
		return true;
	}
	const message = error instanceof Error ? error.message : String(error);
	return /PERMISSION_DENIED/i.test(message);
}

function hasPluginWriteMethod(connection: IUniverseAgentConnection, method: PluginWriteMethod): boolean {
	return typeof connection[method] === 'function';
}

export class EnginePluginsSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly writeToolbar: HTMLElement;
	private readonly scanNewButton: Button;
	private readonly scanResult: HTMLElement;
	private readonly listContainer: HTMLElement;
	private readonly rowToolbar: HTMLElement;
	private readonly enableButton: Button;
	private readonly reloadButton: Button;
	private readonly unloadButton: Button;
	private readonly infoStatus: EngineCatalogStatusWidget;
	private readonly hooksTable: HTMLTableElement;
	private readonly hooksBody: HTMLTableSectionElement;
	private list: WorkbenchList<EnginePluginListEntry> | undefined;

	private mode: EngineCatalogPaneMode = 'disconnected';
	private listEntries: EnginePluginListEntry[] = [];
	private selectedPlugin: UniverseAgentPluginSummary | undefined;
	private hookEntries: readonly UniverseAgentPluginHookEntry[] = [];
	private lastScan: UniverseAgentScanNewPluginsResult | undefined;
	private writeFailedReason: string | undefined;
	private lastWritePermissionDenied = false;
	private refreshGeneration = 0;
	private infoGeneration = 0;
	private ignoreSelection = false;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-plugins-section.engine-catalog-section'));
		this.container.style.display = 'none';

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		this.writeToolbar = DOM.append(this.container, $('.engine-catalog-write-toolbar'));
		this.writeToolbar.style.display = 'none';
		this.scanNewButton = this._register(new Button(this.writeToolbar, defaultButtonStyles));
		this.scanNewButton.label = localize('ua.enginePluginsScanNew', "Scan new");
		this._register(this.scanNewButton.onDidClick(() => void this.scanNew()));

		this.scanResult = DOM.append(this.container, $('.engine-catalog-description.engine-plugins-scan-result'));
		this.scanResult.style.display = 'none';

		this.listContainer = DOM.append(this.container, $('.engine-catalog-list.engine-plugins-list'));
		this.listContainer.style.display = 'none';

		this.rowToolbar = DOM.append(this.container, $('.engine-catalog-write-toolbar.engine-plugins-row-toolbar'));
		this.rowToolbar.style.display = 'none';
		this.enableButton = this._register(new Button(this.rowToolbar, defaultButtonStyles));
		this.enableButton.label = localize('ua.enginePluginsEnable', "Enable");
		this._register(this.enableButton.onDidClick(() => void this.enableSelected()));
		this.reloadButton = this._register(new Button(this.rowToolbar, defaultButtonStyles));
		this.reloadButton.label = localize('ua.enginePluginsReload', "Reload");
		this._register(this.reloadButton.onDidClick(() => void this.reloadSelected()));
		this.unloadButton = this._register(new Button(this.rowToolbar, defaultButtonStyles));
		this.unloadButton.label = localize('ua.enginePluginsUnload', "Unload");
		this._register(this.unloadButton.onDidClick(() => void this.unloadSelected()));

		this.infoStatus = this._register(new EngineCatalogStatusWidget(this.container));
		this.hooksTable = DOM.append(this.container, $('table.engine-plugins-hooks-table')) as HTMLTableElement;
		this.hooksTable.style.display = 'none';
		this.hooksTable.style.width = '100%';
		const head = DOM.append(this.hooksTable, $('thead'));
		const headRow = DOM.append(head, $('tr'));
		DOM.append(headRow, $('th')).textContent = localize('ua.enginePluginHookType', "hook_type");
		DOM.append(headRow, $('th')).textContent = localize('ua.enginePluginHookPriority', "priority");
		DOM.append(headRow, $('th')).textContent = localize('ua.enginePluginHookClass', "class_name");
		this.hooksBody = DOM.append(this.hooksTable, $('tbody'));

		this._register(this.connection.onDidChangeConnection(() => void this.refresh()));
		void this.refresh();
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	getMode(): EngineCatalogPaneMode {
		return this.mode;
	}

	getListEntryCount(): number {
		return this.listEntries.length;
	}

	getHookRowCount(): number {
		return this.hooksBody.rows.length;
	}

	getHookEntries(): readonly UniverseAgentPluginHookEntry[] {
		return this.hookEntries;
	}

	getLastWriteWasPermissionDenied(): boolean {
		return this.lastWritePermissionDenied;
	}

	isScanNewVisible(): boolean {
		return this.writeToolbar.style.display !== 'none';
	}

	isEnableVisible(): boolean {
		return this.rowToolbar.style.display !== 'none' && this.enableButton.element.style.display !== 'none';
	}

	isReloadVisible(): boolean {
		return this.rowToolbar.style.display !== 'none' && this.reloadButton.element.style.display !== 'none';
	}

	isUnloadVisible(): boolean {
		return this.rowToolbar.style.display !== 'none' && this.unloadButton.element.style.display !== 'none';
	}

	setSectionActive(active: boolean): void {
		this.container.style.display = active ? '' : 'none';
	}

	setShowSectionHeading(_show: boolean): void {
		// Pane detail title only.
	}

	layout(width: number, height: number): void {
		this.list?.layout(Math.max(80, Math.floor(height * 0.45)), width);
	}

	canWrite(): boolean {
		return canPerformCatalogWrite(this.mode) && this.connection.isEngineConnected();
	}

	selectPluginForTest(id: string): void {
		if (!this.list) {
			return;
		}
		const index = this.listEntries.findIndex(entry => entry.plugin.id === id);
		if (index >= 0) {
			this.list.setSelection([index]);
		}
	}

	private ensureList(): WorkbenchList<EnginePluginListEntry> {
		if (!this.list) {
			this.list = this._register(this.instantiationService.createInstance(
				WorkbenchList,
				'EnginePlugins',
				this.listContainer,
				new EnginePluginListDelegate(),
				[new EnginePluginRowRenderer()],
				{
					identityProvider: {
						getId: (entry: EnginePluginListEntry) => `plugin:${entry.plugin.id}`,
					},
					accessibilityProvider: new EnginePluginListAccessibilityProvider(),
				},
			)) as WorkbenchList<EnginePluginListEntry>;
			this._register(this.list.onDidChangeSelection(e => {
				if (this.ignoreSelection) {
					return;
				}
				const entry = e.elements[0];
				this.selectedPlugin = entry?.plugin;
				this.updateRowActions();
				if (this.selectedPlugin && canShowCatalogRows(this.mode)) {
					void this.loadInfo(this.selectedPlugin.id);
				} else {
					this.clearInfoPresentation();
				}
			}));
		}
		return this.list;
	}

	private async refresh(): Promise<void> {
		const generation = ++this.refreshGeneration;
		const capabilities = this.connection.getCapabilitySnapshot();
		const connected = this.connection.isEngineConnected();
		const support = capabilities.plugins.support;
		this.writeFailedReason = undefined;
		this.lastWritePermissionDenied = false;

		if (!connected) {
			this.clearCatalogPresentation();
			this.mode = resolveEngineCatalogPaneMode(false, support);
			this.renderStatus();
			return;
		}

		if (support === 'UNSUPPORTED') {
			this.clearCatalogPresentation();
			this.mode = resolveEngineCatalogPaneMode(true, support);
			this.renderStatus({ reason: capabilities.plugins.reason });
			return;
		}

		if (support === 'UNKNOWN') {
			this.mode = resolveEngineCatalogPaneMode(true, support);
			this.writeToolbar.style.display = 'none';
			this.rowToolbar.style.display = 'none';
			this.renderStatus({ loadingKind: 'capability' });
			return;
		}

		this.mode = resolveEngineCatalogPaneMode(true, support, { kind: 'inFlight' });
		this.writeToolbar.style.display = 'none';
		this.rowToolbar.style.display = 'none';
		this.renderStatus({ loadingKind: 'list' });

		try {
			const result = await this.connection.listPlugins();
			if (generation !== this.refreshGeneration) {
				return;
			}
			if (!this.connection.isEngineConnected()) {
				this.clearCatalogPresentation();
				this.mode = resolveEngineCatalogPaneMode(false, support);
				this.renderStatus();
				return;
			}
			this.setPlugins(result.plugins);
			this.mode = resolveEngineCatalogPaneMode(true, support, {
				kind: 'success',
				itemCount: result.plugins.length,
			});
			this.listContainer.style.display = canShowCatalogRows(this.mode) ? '' : 'none';
			this.updateWriteToolbar();
			this.updateRowActions();
			this.renderScanResult();
			this.renderStatus();
			if (this.selectedPlugin && canShowCatalogRows(this.mode)) {
				void this.loadInfo(this.selectedPlugin.id);
			} else {
				this.clearInfoPresentation();
			}
		} catch (error) {
			if (generation !== this.refreshGeneration) {
				return;
			}
			this.clearCatalogPresentation();
			this.mode = resolveEngineCatalogPaneMode(true, support, {
				kind: 'failed',
				error: getTransportErrorMessage(error),
			});
			this.renderStatus({
				reason: getTransportErrorMessage(error),
				onRetry: () => void this.refresh(),
			});
		}
	}

	private async loadInfo(id: string): Promise<void> {
		const generation = ++this.infoGeneration;
		this.hooksTable.style.display = 'none';
		this.clearHookRows();
		this.infoStatus.render({
			mode: 'loading',
			loadingKind: 'list',
			featureLabel: localize('ua.enginePluginInfoFeature', "plugin info"),
		});

		try {
			const result = await this.connection.getPluginInfo(id);
			if (generation !== this.infoGeneration) {
				return;
			}
			// hooks empty → empty table. Never invent rows from hook_count.
			this.hookEntries = result.hooks;
			this.renderHookRows(result.hooks);
			if (result.hooks.length === 0) {
				this.infoStatus.render({
					mode: 'empty',
					featureLabel: localize('ua.enginePluginInfoFeature', "plugin info"),
					emptyCopy: localize('ua.enginePluginHooksEmpty', "No hooks."),
				});
			} else {
				this.infoStatus.hide();
			}
			this.hooksTable.style.display = '';
		} catch (error) {
			if (generation !== this.infoGeneration) {
				return;
			}
			this.hookEntries = [];
			this.clearHookRows();
			this.hooksTable.style.display = 'none';
			this.infoStatus.render({
				mode: 'failed',
				featureLabel: localize('ua.enginePluginInfoFeature', "plugin info"),
				reason: getTransportErrorMessage(error),
				onRetry: () => void this.loadInfo(id),
			});
		}
	}

	private renderHookRows(hooks: readonly UniverseAgentPluginHookEntry[]): void {
		this.clearHookRows();
		for (const hook of hooks) {
			const row = this.hooksBody.insertRow();
			row.insertCell().textContent = hook.hookType;
			row.insertCell().textContent = String(hook.priority);
			row.insertCell().textContent = hook.className;
		}
	}

	private clearHookRows(): void {
		while (this.hooksBody.rows.length > 0) {
			this.hooksBody.deleteRow(0);
		}
	}

	private updateWriteToolbar(): void {
		const showScan = this.canWrite() && hasPluginWriteMethod(this.connection, 'scanNewPlugins');
		this.writeToolbar.style.display = showScan ? '' : 'none';
	}

	private updateRowActions(): void {
		if (!this.canWrite() || !this.selectedPlugin) {
			this.rowToolbar.style.display = 'none';
			return;
		}
		const enable = hasPluginWriteMethod(this.connection, 'enablePlugin');
		const reload = hasPluginWriteMethod(this.connection, 'reloadPlugin');
		const unload = hasPluginWriteMethod(this.connection, 'unloadPlugin')
			&& this.selectedPlugin.source !== EMBEDDED_SOURCE;
		this.enableButton.element.style.display = enable ? '' : 'none';
		this.reloadButton.element.style.display = reload ? '' : 'none';
		this.unloadButton.element.style.display = unload ? '' : 'none';
		this.rowToolbar.style.display = (enable || reload || unload) ? '' : 'none';
	}

	private async enableSelected(): Promise<void> {
		if (!this.canWrite() || !this.selectedPlugin || !hasPluginWriteMethod(this.connection, 'enablePlugin')) {
			return;
		}
		await this.runWrite(() => this.connection.enablePlugin(this.selectedPlugin!.id, true));
	}

	private async reloadSelected(): Promise<void> {
		if (!this.canWrite() || !this.selectedPlugin || !hasPluginWriteMethod(this.connection, 'reloadPlugin')) {
			return;
		}
		await this.runWrite(() => this.connection.reloadPlugin(this.selectedPlugin!.id));
	}

	private async unloadSelected(): Promise<void> {
		if (!this.canWrite() || !this.selectedPlugin || !hasPluginWriteMethod(this.connection, 'unloadPlugin')) {
			return;
		}
		if (this.selectedPlugin.source === EMBEDDED_SOURCE) {
			return;
		}
		await this.runWrite(() => this.connection.unloadPlugin(this.selectedPlugin!.id));
	}

	private async scanNew(): Promise<void> {
		if (!this.canWrite() || !hasPluginWriteMethod(this.connection, 'scanNewPlugins')) {
			return;
		}
		this.lastScan = undefined;
		this.writeFailedReason = undefined;
		this.renderScanResult();
		try {
			const result = await this.connection.scanNewPlugins();
			this.lastScan = result;
			this.writeFailedReason = undefined;
			this.renderScanResult();
			await this.refresh();
			this.lastScan = result;
			this.renderScanResult();
		} catch (error) {
			this.showWriteFailed(error);
		}
	}

	private async runWrite(op: () => Promise<unknown>): Promise<void> {
		this.writeFailedReason = undefined;
		this.renderScanResult();
		try {
			await op();
			await this.refresh();
		} catch (error) {
			this.showWriteFailed(error);
		}
	}

	private showWriteFailed(error: unknown): void {
		const reason = getTransportErrorMessage(error)
			?? localize('ua.enginePluginsWriteFailed', "The engine rejected the plugin write.");
		this.lastWritePermissionDenied = isPermissionDeniedError(error);
		this.writeFailedReason = reason;
		this.lastScan = undefined;
		this.renderScanResult();
		this.status.render({
			mode: 'failed',
			featureLabel: PLUGINS_FEATURE,
			reason,
			onRetry: () => void this.refresh(),
		});
	}

	private renderScanResult(): void {
		if (!this.lastScan) {
			this.scanResult.style.display = 'none';
			this.scanResult.textContent = '';
			return;
		}
		if (this.lastScan.newPlugins.length === 0) {
			this.scanResult.textContent = localize(
				'ua.enginePluginsScanEmpty',
				"No new plugins found (skipped {0}).",
				this.lastScan.skippedCount,
			);
		} else {
			const names = this.lastScan.newPlugins.map(plugin => plugin.displayName || plugin.id).join(', ');
			this.scanResult.textContent = localize(
				'ua.enginePluginsScanFound',
				"New plugins: {0} (skipped {1}).",
				names,
				this.lastScan.skippedCount,
			);
		}
		this.scanResult.style.display = '';
	}

	private renderStatus(options?: { reason?: string; loadingKind?: 'capability' | 'list'; onRetry?: () => void }): void {
		if (this.writeFailedReason && (this.mode === 'ready' || this.mode === 'empty')) {
			this.status.render({
				mode: 'failed',
				featureLabel: PLUGINS_FEATURE,
				reason: this.writeFailedReason,
				onRetry: () => void this.refresh(),
			});
			return;
		}
		this.status.render({
			mode: this.mode,
			featureLabel: PLUGINS_FEATURE,
			emptyCopy: localize('ua.enginePluginsEmpty', "No engine plugins."),
			reason: options?.reason,
			loadingKind: options?.loadingKind,
			onRetry: options?.onRetry,
			onOpenConnection: this.mode === 'disconnected'
				? () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID)
				: undefined,
		});
	}

	private setPlugins(plugins: readonly UniverseAgentPluginSummary[]): void {
		this.listEntries = plugins.map(plugin => ({ kind: 'plugin', plugin }));
		if (this.selectedPlugin && !plugins.some(plugin => plugin.id === this.selectedPlugin?.id)) {
			this.selectedPlugin = undefined;
		} else if (this.selectedPlugin) {
			this.selectedPlugin = plugins.find(plugin => plugin.id === this.selectedPlugin?.id);
		}
		this.ignoreSelection = true;
		try {
			if (this.listEntries.length === 0) {
				this.list?.splice(0, this.list.length, []);
				return;
			}
			const list = this.ensureList();
			list.splice(0, list.length, this.listEntries);
			if (this.selectedPlugin) {
				const index = this.listEntries.findIndex(entry => entry.plugin.id === this.selectedPlugin?.id);
				if (index >= 0) {
					list.setSelection([index]);
				}
			}
		} finally {
			this.ignoreSelection = false;
		}
	}

	private clearCatalogPresentation(): void {
		this.listEntries = [];
		this.selectedPlugin = undefined;
		this.lastScan = undefined;
		this.writeFailedReason = undefined;
		this.lastWritePermissionDenied = false;
		this.list?.splice(0, this.list?.length ?? 0, []);
		this.status.hide();
		this.listContainer.style.display = 'none';
		this.writeToolbar.style.display = 'none';
		this.rowToolbar.style.display = 'none';
		this.scanResult.style.display = 'none';
		this.scanResult.textContent = '';
		this.clearInfoPresentation();
	}

	private clearInfoPresentation(): void {
		this.infoGeneration++;
		this.hookEntries = [];
		this.clearHookRows();
		this.hooksTable.style.display = 'none';
		this.infoStatus.hide();
	}
}
