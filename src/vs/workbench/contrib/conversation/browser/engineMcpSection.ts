/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Checkbox } from '../../../../base/browser/ui/toggle/toggle.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentMcpServerConfig, UniverseAgentMcpServerOrigin, UniverseAgentMcpServerSummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultButtonStyles, defaultCheckboxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import {
	type EngineCatalogPaneMode,
	canPerformCatalogWrite,
	canShowCatalogRows,
	resolveEngineCatalogPaneMode,
} from './engineCatalog.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { EngineMcpRuntimePanel } from './engineMcpRuntimePanel.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';

const $ = DOM.$;

type EngineMcpTab = 'definitions' | 'runtime';

const MCP_FEATURE = localize('ua.engineMcpFeatureLabel', "MCP server definitions");

type EngineMcpListEntry =
	| { readonly kind: 'group'; readonly origin: UniverseAgentMcpServerOrigin; readonly label: string }
	| { readonly kind: 'server'; readonly server: UniverseAgentMcpServerSummary };

class EngineMcpListDelegate implements IListVirtualDelegate<EngineMcpListEntry> {
	getHeight(entry: EngineMcpListEntry): number {
		return entry.kind === 'group' ? 28 : 36;
	}

	getTemplateId(entry: EngineMcpListEntry): string {
		return entry.kind === 'group' ? 'mcpGroup' : 'mcpRow';
	}
}

interface IMcpGroupTemplateData {
	readonly label: HTMLElement;
}

interface IMcpRowTemplateData {
	readonly row: HTMLElement;
	readonly checkbox: Checkbox;
	readonly name: HTMLElement;
	readonly transport: HTMLElement;
	server: UniverseAgentMcpServerSummary | undefined;
	readonly checkboxDisposable: { dispose(): void };
}

class EngineMcpGroupRenderer implements IListRenderer<EngineMcpListEntry, IMcpGroupTemplateData> {
	static readonly TEMPLATE_ID = 'mcpGroup';
	readonly templateId = EngineMcpGroupRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IMcpGroupTemplateData {
		container.classList.add('engine-catalog-group');
		return { label: DOM.append(container, $('.engine-catalog-group-label')) };
	}

	renderElement(entry: EngineMcpListEntry, _index: number, templateData: IMcpGroupTemplateData): void {
		if (entry.kind !== 'group') {
			return;
		}
		templateData.label.textContent = entry.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

class EngineMcpRowRenderer implements IListRenderer<EngineMcpListEntry, IMcpRowTemplateData> {
	static readonly TEMPLATE_ID = 'mcpRow';
	readonly templateId = EngineMcpRowRenderer.TEMPLATE_ID;

	constructor(
		private readonly onToggle: (server: UniverseAgentMcpServerSummary, enabled: boolean) => void,
	) { }

	renderTemplate(container: HTMLElement): IMcpRowTemplateData {
		const row = DOM.append(container, $('.engine-catalog-row'));
		const checkbox = new Checkbox('', false, defaultCheckboxStyles);
		const checkboxDisposable = checkbox.onChange(() => {
			const server = (row as unknown as { __server?: UniverseAgentMcpServerSummary }).__server;
			if (server) {
				this.onToggle(server, checkbox.checked);
			}
		});
		row.appendChild(checkbox.domNode);
		const text = DOM.append(row, $('.engine-catalog-text'));
		return {
			row,
			checkbox,
			name: DOM.append(text, $('.engine-catalog-name')),
			transport: DOM.append(text, $('.engine-catalog-description')),
			server: undefined,
			checkboxDisposable: { dispose: () => checkboxDisposable.dispose() },
		};
	}

	renderElement(entry: EngineMcpListEntry, _index: number, templateData: IMcpRowTemplateData): void {
		if (entry.kind !== 'server') {
			return;
		}
		templateData.server = entry.server;
		(templateData.row as unknown as { __server?: UniverseAgentMcpServerSummary }).__server = entry.server;
		templateData.name.textContent = entry.server.name || entry.server.id;
		templateData.transport.textContent = entry.server.transport;
		templateData.checkbox.checked = entry.server.effectiveEnabled ?? entry.server.enabled;
	}

	disposeTemplate(templateData: IMcpRowTemplateData): void {
		templateData.checkboxDisposable.dispose();
		templateData.checkbox.dispose();
	}
}

class EngineMcpListAccessibilityProvider implements IListAccessibilityProvider<EngineMcpListEntry> {
	getWidgetAriaLabel(): string {
		return localize('ua.engineMcpList', "Engine MCP servers");
	}

	getAriaLabel(entry: EngineMcpListEntry): string {
		return entry.kind === 'group' ? entry.label : (entry.server.name || entry.server.id);
	}
}

function getMcpOriginGroupLabel(origin: UniverseAgentMcpServerOrigin): string {
	switch (origin) {
		case 'global':
			return localize('ua.engineMcpOriginGlobal', "Global");
		case 'project':
			return localize('ua.engineMcpOriginProject', "Project");
		default:
			return localize('ua.engineMcpOriginUnknown', "Unknown");
	}
}

function groupMcpServersByOrigin(servers: readonly UniverseAgentMcpServerSummary[]): Map<UniverseAgentMcpServerOrigin, UniverseAgentMcpServerSummary[]> {
	const order: UniverseAgentMcpServerOrigin[] = ['project', 'global', 'unknown'];
	const groups = new Map<UniverseAgentMcpServerOrigin, UniverseAgentMcpServerSummary[]>();
	for (const origin of order) {
		groups.set(origin, []);
	}
	for (const server of servers) {
		const bucket = groups.get(server.origin) ?? groups.get('unknown')!;
		bucket.push(server);
	}
	for (const [origin, entries] of groups) {
		if (entries.length === 0) {
			groups.delete(origin);
		}
	}
	return groups;
}

export class EngineMcpSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly heading: HTMLElement;
	private readonly tabBar: HTMLElement;
	private readonly definitionsTab: HTMLButtonElement;
	private readonly runtimeTab: HTMLButtonElement;
	private readonly definitionsPanel: HTMLElement;
	private readonly runtimePanelHost: HTMLElement;
	private readonly runtimePanel: EngineMcpRuntimePanel;
	private readonly status: EngineCatalogStatusWidget;
	private readonly writeToolbar: HTMLElement;
	private readonly listContainer: HTMLElement;
	private readonly instantiationService: IInstantiationService;
	private list: WorkbenchList<EngineMcpListEntry> | undefined;

	private mode: EngineCatalogPaneMode = 'disconnected';
	private listEntries: EngineMcpListEntry[] = [];
	private selectedServer: UniverseAgentMcpServerSummary | undefined;
	private activeTab: EngineMcpTab = 'definitions';
	private sectionActive = false;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IInstantiationService instantiationService: IInstantiationService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();
		this.instantiationService = instantiationService;

		this.container = DOM.append(parent, $('.engine-mcp-section.engine-catalog-section'));
		this.container.style.display = 'none';

		this.heading = DOM.append(this.container, $('h3.engine-section-heading'));
		this.heading.textContent = localize('ua.engineMcpSectionTitle', "MCP Servers");
		this.heading.style.display = 'none';

		this.tabBar = DOM.append(this.container, $('.engine-mcp-tab-bar'));
		this.definitionsTab = DOM.append(this.tabBar, $('button.engine-mcp-tab')) as HTMLButtonElement;
		this.definitionsTab.type = 'button';
		this.definitionsTab.textContent = localize('ua.engineMcpTabDefinitions', "Definitions");
		this.runtimeTab = DOM.append(this.tabBar, $('button.engine-mcp-tab')) as HTMLButtonElement;
		this.runtimeTab.type = 'button';
		this.runtimeTab.textContent = localize('ua.engineMcpTabRuntime', "Runtime");
		this._register(DOM.addDisposableListener(this.definitionsTab, 'click', () => this.setActiveTab('definitions')));
		this._register(DOM.addDisposableListener(this.runtimeTab, 'click', () => this.setActiveTab('runtime')));

		this.definitionsPanel = DOM.append(this.container, $('.engine-mcp-definitions-panel'));

		this.status = this._register(new EngineCatalogStatusWidget(this.definitionsPanel));

		this.writeToolbar = DOM.append(this.definitionsPanel, $('.engine-catalog-write-toolbar'));
		this.writeToolbar.style.display = 'none';
		const addButton = this._register(new Button(this.writeToolbar, defaultButtonStyles));
		addButton.label = localize('ua.engineMcpAdd', "Add");
		this._register(addButton.onDidClick(() => void this.addServer()));
		const removeButton = this._register(new Button(this.writeToolbar, defaultButtonStyles));
		removeButton.label = localize('ua.engineMcpRemove', "Remove");
		this._register(removeButton.onDidClick(() => void this.removeSelectedServer()));
		const updateButton = this._register(new Button(this.writeToolbar, defaultButtonStyles));
		updateButton.label = localize('ua.engineMcpUpdate', "Update");
		this._register(updateButton.onDidClick(() => void this.updateSelectedServer()));

		this.listContainer = DOM.append(this.definitionsPanel, $('.engine-catalog-list'));

		this.runtimePanelHost = DOM.append(this.container, $('.engine-mcp-runtime-host'));
		this.runtimePanel = this._register(instantiationService.createInstance(EngineMcpRuntimePanel, this.runtimePanelHost));

		this._register(this.connection.onDidChangeConnection(() => {
			void this.refresh();
			this.runtimePanel.render();
		}));

		this.setActiveTab('definitions');
		void this.refresh();
	}

	private setActiveTab(tab: EngineMcpTab): void {
		this.activeTab = tab;
		this.definitionsTab.classList.toggle('engine-mcp-tab--active', tab === 'definitions');
		this.runtimeTab.classList.toggle('engine-mcp-tab--active', tab === 'runtime');
		this.definitionsPanel.style.display = tab === 'definitions' ? '' : 'none';
		this.runtimePanel.setVisible(tab === 'runtime');
		if (tab === 'runtime') {
			this.runtimePanel.render();
		}
	}

	layout(width: number, listHeight: number): void {
		this.list?.layout(Math.max(80, listHeight), width);
		this.runtimePanel.layout(width, listHeight);
	}

	override dispose(): void {
		this.clearCatalogPresentation();
		super.dispose();
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	setSectionActive(active: boolean): void {
		this.sectionActive = active;
		this.updateContainerVisibility();
	}

	setShowSectionHeading(show: boolean): void {
		this.heading.style.display = show ? '' : 'none';
	}

	private updateContainerVisibility(): void {
		this.container.style.display = this.sectionActive ? '' : 'none';
	}

	getMode(): EngineCatalogPaneMode {
		return this.mode;
	}

	getListEntryCount(): number {
		return this.listEntries.filter(entry => entry.kind === 'server').length;
	}

	canWrite(): boolean {
		return canPerformCatalogWrite(this.mode) && this.connection.isEngineConnected();
	}

	getSelectedServerId(): string | undefined {
		return this.selectedServer?.id;
	}

	isWriteToolbarVisible(): boolean {
		return this.writeToolbar.style.display !== 'none';
	}

	async addServer(config?: UniverseAgentMcpServerConfig): Promise<boolean> {
		if (!this.canWrite()) {
			return false;
		}
		const payload: UniverseAgentMcpServerConfig = config ?? {
			name: localize('ua.engineMcpNewDefaultName', "New MCP Server"),
			transport: 'stdio',
			command: 'echo',
			args: ['mcp-stub'],
			enabled: true,
		};
		const scope = 'global';
		try {
			const result = await this.connection.addMcpServer({ config: payload, scope });
			if (!result.ok) {
				return false;
			}
			await this.refresh();
			return true;
		} catch {
			return false;
		}
	}

	async updateSelectedServer(config?: Partial<UniverseAgentMcpServerConfig>): Promise<boolean> {
		if (!this.canWrite() || !this.selectedServer) {
			return false;
		}
		const scope = this.selectedServer.origin === 'project' ? 'project' : 'global';
		const merged: UniverseAgentMcpServerConfig = {
			id: this.selectedServer.id,
			name: config?.name ?? this.selectedServer.name,
			transport: config?.transport ?? this.selectedServer.transport,
			command: config?.command,
			enabled: config?.enabled ?? this.selectedServer.enabled,
		};
		try {
			const result = await this.connection.updateMcpServer({
				serverId: this.selectedServer.id,
				config: merged,
				scope,
			});
			if (!result.ok) {
				return false;
			}
			await this.refresh();
			return true;
		} catch {
			return false;
		}
	}

	async removeSelectedServer(): Promise<boolean> {
		if (!this.canWrite() || !this.selectedServer) {
			return false;
		}
		const scope = this.selectedServer.origin === 'project' ? 'project' : 'global';
		try {
			const result = await this.connection.removeMcpServer({
				serverId: this.selectedServer.id,
				scope,
			});
			if (!result.ok) {
				return false;
			}
			this.selectedServer = undefined;
			await this.refresh();
			return true;
		} catch {
			return false;
		}
	}

	private ensureList(): WorkbenchList<EngineMcpListEntry> {
		if (!this.list) {
			this.list = this._register(this.instantiationService.createInstance(
				WorkbenchList,
				'EngineMcp',
				this.listContainer,
				new EngineMcpListDelegate(),
				[
					new EngineMcpGroupRenderer(),
					new EngineMcpRowRenderer((server, enabled) => this.toggleServer(server, enabled)),
				],
				{
					identityProvider: {
						getId: (entry: EngineMcpListEntry) => entry.kind === 'group'
							? `group:${entry.origin}`
							: `server:${entry.server.id}`,
					},
					accessibilityProvider: new EngineMcpListAccessibilityProvider(),
				},
			)) as WorkbenchList<EngineMcpListEntry>;
			this._register(this.list.onDidChangeSelection(e => {
				const entry = e.elements[0];
				this.selectedServer = entry?.kind === 'server' ? entry.server : undefined;
			}));
		}
		return this.list;
	}

	private async refresh(): Promise<void> {
		const capabilities = this.connection.getCapabilitySnapshot();
		const connected = this.connection.isEngineConnected();
		const support = capabilities.mcp.support;

		if (!connected) {
			this.clearCatalogPresentation();
			this.mode = resolveEngineCatalogPaneMode(false, support);
			this.renderStatus();
			return;
		}

		if (support === 'UNSUPPORTED') {
			this.clearCatalogPresentation();
			this.mode = resolveEngineCatalogPaneMode(true, support);
			this.renderStatus({ reason: capabilities.mcp.reason });
			return;
		}

		if (support === 'UNKNOWN') {
			this.mode = resolveEngineCatalogPaneMode(true, support);
			this.writeToolbar.style.display = 'none';
			this.renderStatus({ loadingKind: 'capability' });
			return;
		}

		this.mode = resolveEngineCatalogPaneMode(true, support, { kind: 'inFlight' });
		this.writeToolbar.style.display = 'none';
		this.renderStatus({ loadingKind: 'list' });

		try {
			const result = await this.connection.listMcpServers();
			if (!this.connection.isEngineConnected()) {
				this.clearCatalogPresentation();
				this.mode = resolveEngineCatalogPaneMode(false, support);
				this.renderStatus();
				return;
			}
			this.setServers(result.servers);
			this.mode = resolveEngineCatalogPaneMode(true, support, {
				kind: 'success',
				itemCount: result.servers.length,
			});
			this.listContainer.style.display = canShowCatalogRows(this.mode) ? '' : 'none';
			this.writeToolbar.style.display = canPerformCatalogWrite(this.mode) ? '' : 'none';
			this.renderStatus();
		} catch (error) {
			this.writeToolbar.style.display = 'none';
			this.mode = resolveEngineCatalogPaneMode(true, support, {
				kind: 'failed',
				error: error instanceof Error ? error.message : undefined,
			});
			this.renderStatus({
				reason: error instanceof Error ? error.message : undefined,
				onRetry: () => void this.refresh(),
			});
		}
	}

	private renderStatus(options?: { reason?: string; loadingKind?: 'capability' | 'list'; onRetry?: () => void }): void {
		this.status.render({
			mode: this.mode,
			featureLabel: MCP_FEATURE,
			emptyCopy: localize('ua.engineMcpEmpty', "No MCP servers yet."),
			reason: options?.reason,
			loadingKind: options?.loadingKind,
			onRetry: options?.onRetry,
			onOpenConnection: this.mode === 'disconnected'
				? () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID)
				: undefined,
		});
	}

	private clearCatalogPresentation(): void {
		this.listEntries = [];
		this.list?.splice(0, this.list?.length ?? 0, []);
		this.selectedServer = undefined;
		this.status.hide();
		this.listContainer.style.display = 'none';
		this.writeToolbar.style.display = 'none';
	}

	private setServers(servers: readonly UniverseAgentMcpServerSummary[]): void {
		const entries: EngineMcpListEntry[] = [];
		for (const [origin, group] of groupMcpServersByOrigin(servers)) {
			entries.push({ kind: 'group', origin, label: getMcpOriginGroupLabel(origin) });
			for (const server of group) {
				entries.push({ kind: 'server', server });
			}
		}
		this.listEntries = entries;
		if (entries.length === 0) {
			this.list?.splice(0, this.list?.length ?? 0, []);
			this.selectedServer = undefined;
			return;
		}
		const list = this.ensureList();
		list.splice(0, list.length, entries);
		this.restoreServerSelection();
	}

	private restoreServerSelection(): void {
		const id = this.selectedServer?.id;
		if (!id || !this.list) {
			return;
		}
		const index = this.listEntries.findIndex(entry => entry.kind === 'server' && entry.server.id === id);
		if (index < 0) {
			this.selectedServer = undefined;
			return;
		}
		const entry = this.listEntries[index];
		if (entry?.kind === 'server') {
			this.selectedServer = entry.server;
		}
		this.list.setSelection([index]);
	}

	private async toggleServer(server: UniverseAgentMcpServerSummary, enabled: boolean): Promise<void> {
		if (!canShowCatalogRows(this.mode) || !this.connection.isEngineConnected()) {
			return;
		}
		const scope = server.origin === 'project' ? 'project' : 'global';
		try {
			const result = await this.connection.toggleMcpServer({
				id: server.id,
				enabled,
				scope,
			});
			if (!result.ok) {
				await this.refresh();
				return;
			}
			await this.refresh();
		} catch {
			await this.refresh();
		}
	}
}
