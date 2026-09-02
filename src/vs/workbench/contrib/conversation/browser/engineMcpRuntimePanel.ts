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
	UniverseAgentMcpRuntimeStatus,
	UniverseAgentMcpServerStatus,
	UniverseAgentMcpToolDefinition,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import {
	type EngineCatalogPaneMode,
	canShowCatalogRows,
	resolveEngineCatalogPaneMode,
} from './engineCatalog.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';

const $ = DOM.$;

const MCP_RUNTIME_FEATURE = localize('ua.engineMcpRuntimeFeatureLabel', "MCP server runtime");

type EngineMcpRuntimeListEntry = { readonly kind: 'server'; readonly status: UniverseAgentMcpServerStatus };

class EngineMcpRuntimeListDelegate implements IListVirtualDelegate<EngineMcpRuntimeListEntry> {
	getHeight(): number {
		return 40;
	}

	getTemplateId(): string {
		return 'mcpRuntimeRow';
	}
}

interface IMcpRuntimeRowTemplateData {
	readonly name: HTMLElement;
	readonly summary: HTMLElement;
}

class EngineMcpRuntimeRowRenderer implements IListRenderer<EngineMcpRuntimeListEntry, IMcpRuntimeRowTemplateData> {
	static readonly TEMPLATE_ID = 'mcpRuntimeRow';
	readonly templateId = EngineMcpRuntimeRowRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IMcpRuntimeRowTemplateData {
		const row = DOM.append(container, $('.engine-catalog-row'));
		const text = DOM.append(row, $('.engine-catalog-text'));
		return {
			name: DOM.append(text, $('.engine-catalog-name')),
			summary: DOM.append(text, $('.engine-catalog-description')),
		};
	}

	renderElement(entry: EngineMcpRuntimeListEntry, _index: number, templateData: IMcpRuntimeRowTemplateData): void {
		templateData.name.textContent = entry.status.serverId;
		templateData.summary.textContent = formatMcpRuntimeRowSummary(entry.status);
	}

	disposeTemplate(): void {
		// noop
	}
}

class EngineMcpRuntimeListAccessibilityProvider implements IListAccessibilityProvider<EngineMcpRuntimeListEntry> {
	getWidgetAriaLabel(): string {
		return localize('ua.engineMcpRuntimeList', "MCP server runtime");
	}

	getAriaLabel(entry: EngineMcpRuntimeListEntry): string {
		return `${entry.status.serverId} ${getMcpRuntimeStatusLabel(entry.status.status)}`;
	}
}

function getMcpRuntimeStatusLabel(status: UniverseAgentMcpRuntimeStatus): string {
	switch (status) {
		case 'disconnected':
			return localize('ua.engineMcpRuntimeDisconnected', "Disconnected");
		case 'connecting':
			return localize('ua.engineMcpRuntimeConnecting', "Connecting");
		case 'connected':
			return localize('ua.engineMcpRuntimeConnected', "Connected");
		case 'error':
			return localize('ua.engineMcpRuntimeError', "Error");
		case 'failed':
			return localize('ua.engineMcpRuntimeStatusUnknown', "Status unknown");
	}
}

function formatEngineEpoch(ms: number | undefined): string | undefined {
	if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) {
		return undefined;
	}
	return new Date(ms).toLocaleString();
}

function formatMcpRuntimeRowSummary(status: UniverseAgentMcpServerStatus): string {
	const parts = [getMcpRuntimeStatusLabel(status.status)];
	if (status.errorMessage) {
		parts.push(status.errorMessage);
	}
	const lastConnected = formatEngineEpoch(status.lastConnectedAt);
	if (lastConnected) {
		parts.push(localize('ua.engineMcpRuntimeLastConnected', "last connected {0}", lastConnected));
	}
	return parts.join(' — ');
}

function getTransportErrorMessage(error: unknown): string | undefined {
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return undefined;
}

export class EngineMcpRuntimePanel extends Disposable {

	private readonly container: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly refreshToolbar: HTMLElement;
	private readonly refreshButton: Button;
	private readonly listContainer: HTMLElement;
	private readonly checkedAtFooter: HTMLElement;
	private readonly toolsStatus: EngineCatalogStatusWidget;
	private readonly toolsMeta: HTMLElement;
	private readonly toolsList: HTMLElement;
	private list: WorkbenchList<EngineMcpRuntimeListEntry> | undefined;

	private mode: EngineCatalogPaneMode = 'disconnected';
	private listEntries: EngineMcpRuntimeListEntry[] = [];
	private selectedServerId: string | undefined;
	private checkedAt: number | undefined;
	private tools: readonly UniverseAgentMcpToolDefinition[] = [];
	private toolsTotal: number | undefined;
	private toolsCachedAt: number | undefined;
	private refreshGeneration = 0;
	private toolsGeneration = 0;
	private ignoreSelection = false;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@ICommandService private readonly commandService: ICommandService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-mcp-runtime-panel.engine-catalog-section'));
		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		this.refreshToolbar = DOM.append(this.container, $('.engine-catalog-write-toolbar.engine-mcp-runtime-toolbar'));
		this.refreshToolbar.style.display = 'none';
		this.refreshButton = this._register(new Button(this.refreshToolbar, defaultButtonStyles));
		this.refreshButton.label = localize('ua.engineMcpRuntimeRefresh', "Refresh");
		this.refreshButton.enabled = false;
		this._register(this.refreshButton.onDidClick(() => void this.refresh({ forceTools: true })));

		this.listContainer = DOM.append(this.container, $('.engine-catalog-list.engine-mcp-runtime-list'));
		this.listContainer.style.display = 'none';

		this.checkedAtFooter = DOM.append(this.container, $('.engine-catalog-description.engine-mcp-runtime-checked-at'));
		this.checkedAtFooter.style.display = 'none';

		this.toolsStatus = this._register(new EngineCatalogStatusWidget(this.container));
		this.toolsMeta = DOM.append(this.container, $('.engine-catalog-description.engine-mcp-runtime-tools-meta'));
		this.toolsMeta.style.display = 'none';
		this.toolsList = DOM.append(this.container, $('.engine-catalog-list.engine-mcp-runtime-tools'));
		this.toolsList.style.display = 'none';

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

	getSelectedServerId(): string | undefined {
		return this.selectedServerId;
	}

	getToolsCount(): number {
		return this.tools.length;
	}

	setVisible(visible: boolean): void {
		this.container.style.display = visible ? '' : 'none';
	}

	layout(width: number, height: number): void {
		this.list?.layout(Math.max(80, Math.floor(height * 0.45)), width);
	}

	render(): void {
		void this.refresh();
	}

	private ensureList(): WorkbenchList<EngineMcpRuntimeListEntry> {
		if (!this.list) {
			this.list = this._register(this.instantiationService.createInstance(
				WorkbenchList,
				'EngineMcpRuntime',
				this.listContainer,
				new EngineMcpRuntimeListDelegate(),
				[new EngineMcpRuntimeRowRenderer()],
				{
					identityProvider: {
						getId: (entry: EngineMcpRuntimeListEntry) => `runtime:${entry.status.serverId}`,
					},
					accessibilityProvider: new EngineMcpRuntimeListAccessibilityProvider(),
				},
			)) as WorkbenchList<EngineMcpRuntimeListEntry>;
			this._register(this.list.onDidChangeSelection(e => {
				if (this.ignoreSelection) {
					return;
				}
				const entry = e.elements[0];
				this.selectedServerId = entry?.status.serverId;
				if (this.selectedServerId && canShowCatalogRows(this.mode)) {
					void this.loadTools(this.selectedServerId, false);
				} else {
					this.clearToolsPresentation();
				}
			}));
		}
		return this.list;
	}

	private async refresh(options?: { readonly forceTools?: boolean }): Promise<void> {
		const generation = ++this.refreshGeneration;
		const capabilities = this.connection.getCapabilitySnapshot();
		const connected = this.connection.isEngineConnected();
		const support = capabilities.mcpRuntime.support;
		this.refreshButton.enabled = false;
		this.refreshToolbar.style.display = 'none';

		if (!connected) {
			this.clearRuntimePresentation();
			this.mode = resolveEngineCatalogPaneMode(false, support);
			this.renderStatus();
			return;
		}

		if (support === 'UNSUPPORTED') {
			this.clearRuntimePresentation();
			this.mode = resolveEngineCatalogPaneMode(true, support);
			this.renderStatus({ reason: capabilities.mcpRuntime.reason });
			return;
		}

		if (support === 'UNKNOWN') {
			this.mode = resolveEngineCatalogPaneMode(true, support);
			this.renderStatus({ loadingKind: 'capability' });
			return;
		}

		this.mode = resolveEngineCatalogPaneMode(true, support, { kind: 'inFlight' });
		this.renderStatus({ loadingKind: 'list' });

		try {
			const result = await this.connection.getMcpServerStatuses();
			if (generation !== this.refreshGeneration) {
				return;
			}
			if (!this.connection.isEngineConnected()) {
				this.clearRuntimePresentation();
				this.mode = resolveEngineCatalogPaneMode(false, support);
				this.renderStatus();
				return;
			}
			this.checkedAt = result.checkedAt;
			this.setStatuses(result.statuses);
			this.mode = resolveEngineCatalogPaneMode(true, support, {
				kind: 'success',
				itemCount: result.statuses.length,
			});
			this.listContainer.style.display = canShowCatalogRows(this.mode) ? '' : 'none';
			const canRefresh = this.mode === 'empty' || this.mode === 'ready';
			this.refreshButton.enabled = canRefresh;
			this.refreshToolbar.style.display = canRefresh ? '' : 'none';
			this.renderCheckedAt();
			this.renderStatus();
			if (this.selectedServerId && canShowCatalogRows(this.mode)) {
				void this.loadTools(this.selectedServerId, options?.forceTools === true);
			} else {
				this.clearToolsPresentation();
			}
		} catch (error) {
			if (generation !== this.refreshGeneration) {
				return;
			}
			this.clearRuntimePresentation();
			this.mode = resolveEngineCatalogPaneMode(true, support, {
				kind: 'failed',
				error: getTransportErrorMessage(error),
			});
			this.renderStatus({
				reason: getTransportErrorMessage(error),
				onRetry: () => void this.refresh(options),
			});
		}
	}

	private async loadTools(serverId: string, forceRefresh: boolean): Promise<void> {
		const generation = ++this.toolsGeneration;
		this.toolsMeta.style.display = 'none';
		this.toolsList.style.display = 'none';
		this.toolsStatus.render({
			mode: 'loading',
			loadingKind: 'list',
			featureLabel: localize('ua.engineMcpRuntimeToolsFeature', "MCP server tools"),
		});

		try {
			const result = await this.connection.getMcpServerTools(serverId, forceRefresh);
			if (generation !== this.toolsGeneration) {
				return;
			}
			this.tools = result.tools;
			this.toolsTotal = result.total ?? result.tools.length;
			this.toolsCachedAt = result.cachedAt;
			this.renderTools();
		} catch (error) {
			if (generation !== this.toolsGeneration) {
				return;
			}
			this.tools = [];
			this.toolsTotal = undefined;
			this.toolsCachedAt = undefined;
			this.toolsMeta.style.display = 'none';
			this.toolsList.style.display = 'none';
			this.toolsStatus.render({
				mode: 'failed',
				featureLabel: localize('ua.engineMcpRuntimeToolsFeature', "MCP server tools"),
				reason: getTransportErrorMessage(error),
				onRetry: () => void this.loadTools(serverId, forceRefresh),
			});
		}
	}

	private renderTools(): void {
		DOM.clearNode(this.toolsList);
		if (this.tools.length === 0) {
			this.toolsStatus.render({
				mode: 'empty',
				featureLabel: localize('ua.engineMcpRuntimeToolsFeature', "MCP server tools"),
				emptyCopy: localize('ua.engineMcpRuntimeToolsEmpty', "No tools on this MCP server."),
			});
			this.toolsList.style.display = 'none';
		} else {
			this.toolsStatus.hide();
			for (const tool of this.tools) {
				const row = DOM.append(this.toolsList, $('.engine-catalog-row'));
				const text = DOM.append(row, $('.engine-catalog-text'));
				DOM.append(text, $('.engine-catalog-name')).textContent = tool.name;
				DOM.append(text, $('.engine-catalog-description')).textContent = tool.description ?? '';
			}
			this.toolsList.style.display = '';
		}

		const cachedAt = formatEngineEpoch(this.toolsCachedAt);
		const total = this.toolsTotal ?? this.tools.length;
		this.toolsMeta.textContent = cachedAt
			? localize('ua.engineMcpRuntimeToolsMetaCached', "total {0} · cached at {1}", total, cachedAt)
			: localize('ua.engineMcpRuntimeToolsMeta', "total {0}", total);
		this.toolsMeta.style.display = '';
	}

	private renderStatus(options?: { reason?: string; loadingKind?: 'capability' | 'list'; onRetry?: () => void }): void {
		this.status.render({
			mode: this.mode,
			featureLabel: MCP_RUNTIME_FEATURE,
			emptyCopy: localize('ua.engineMcpRuntimeEmpty', "No MCP servers in runtime."),
			reason: options?.reason,
			loadingKind: options?.loadingKind,
			onRetry: options?.onRetry,
			onOpenConnection: this.mode === 'disconnected'
				? () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID)
				: undefined,
		});
	}

	private renderCheckedAt(): void {
		const checkedAt = formatEngineEpoch(this.checkedAt);
		if (!checkedAt || (this.mode !== 'empty' && this.mode !== 'ready')) {
			this.checkedAtFooter.style.display = 'none';
			this.checkedAtFooter.textContent = '';
			return;
		}
		this.checkedAtFooter.textContent = localize('ua.engineMcpRuntimeCheckedAt', "checked at {0}", checkedAt);
		this.checkedAtFooter.style.display = '';
	}

	private setStatuses(statuses: readonly UniverseAgentMcpServerStatus[]): void {
		this.listEntries = statuses.map(status => ({ kind: 'server', status }));
		if (this.selectedServerId && !statuses.some(status => status.serverId === this.selectedServerId)) {
			this.selectedServerId = undefined;
		}
		this.ignoreSelection = true;
		try {
			if (this.listEntries.length === 0) {
				this.list?.splice(0, this.list.length, []);
				return;
			}
			const list = this.ensureList();
			list.splice(0, list.length, this.listEntries);
			if (this.selectedServerId) {
				const index = this.listEntries.findIndex(entry => entry.status.serverId === this.selectedServerId);
				if (index >= 0) {
					list.setSelection([index]);
				}
			}
		} finally {
			this.ignoreSelection = false;
		}
	}

	private clearRuntimePresentation(): void {
		this.listEntries = [];
		this.selectedServerId = undefined;
		this.checkedAt = undefined;
		this.list?.splice(0, this.list?.length ?? 0, []);
		this.status.hide();
		this.listContainer.style.display = 'none';
		this.checkedAtFooter.style.display = 'none';
		this.checkedAtFooter.textContent = '';
		this.refreshButton.enabled = false;
		this.refreshToolbar.style.display = 'none';
		this.clearToolsPresentation();
	}

	private clearToolsPresentation(): void {
		this.toolsGeneration++;
		this.tools = [];
		this.toolsTotal = undefined;
		this.toolsCachedAt = undefined;
		this.toolsStatus.hide();
		this.toolsMeta.style.display = 'none';
		this.toolsMeta.textContent = '';
		DOM.clearNode(this.toolsList);
		this.toolsList.style.display = 'none';
	}
}
