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
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentMcpServerConfig, UniverseAgentMcpServerOrigin, UniverseAgentMcpServerSummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultButtonStyles, defaultCheckboxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import {
	type EngineCatalogPaneMode,
	canPerformCatalogWrite,
	getCatalogTransportFailedCopy,
	getCatalogUnsupportedCopy,
	getCatalogUnknownCopy,
	resolveEngineCatalogPaneMode,
	shouldHideCatalogRows,
} from './engineCatalog.js';

const $ = DOM.$;

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
	private readonly statusMessage: HTMLElement;
	private readonly writeToolbar: HTMLElement;
	private readonly listContainer: HTMLElement;
	private readonly instantiationService: IInstantiationService;
	private list: WorkbenchList<EngineMcpListEntry> | undefined;

	private mode: EngineCatalogPaneMode = 'disconnected';
	private listEntries: EngineMcpListEntry[] = [];
	private selectedServer: UniverseAgentMcpServerSummary | undefined;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();
		this.instantiationService = instantiationService;

		this.container = DOM.append(parent, $('.engine-mcp-section.engine-catalog-section'));
		this.container.style.display = 'none';

		const heading = DOM.append(this.container, $('h3'));
		heading.textContent = localize('ua.engineMcpSectionTitle', "MCP Servers");

		this.statusMessage = DOM.append(this.container, $('.engine-catalog-status'));
		this.statusMessage.style.display = 'none';

		this.writeToolbar = DOM.append(this.container, $('.engine-catalog-write-toolbar'));
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

		this.listContainer = DOM.append(this.container, $('.engine-catalog-list'));

		this._register(this.connection.onDidChangeConnection(() => {
			void this.refresh();
		}));

		void this.refresh();
	}

	layout(width: number, listHeight: number): void {
		this.list?.layout(Math.max(80, listHeight), width);
	}

	override dispose(): void {
		this.clearCatalogPresentation();
		super.dispose();
	}

	getDomNode(): HTMLElement {
		return this.container;
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
		this.clearCatalogPresentation();
		this.selectedServer = undefined;

		const capabilities = this.connection.getCapabilitySnapshot();
		this.mode = resolveEngineCatalogPaneMode(
			this.connection.isEngineConnected(),
			capabilities.mcp.support,
		);

		if (this.mode === 'disconnected') {
			this.container.style.display = 'none';
			return;
		}

		this.container.style.display = '';

		if (shouldHideCatalogRows(this.mode)) {
			this.statusMessage.style.display = '';
			this.statusMessage.textContent = this.mode === 'unknown'
				? getCatalogUnknownCopy()
				: getCatalogUnsupportedCopy(MCP_FEATURE, capabilities.mcp.reason);
			return;
		}

		this.listContainer.style.display = '';
		this.writeToolbar.style.display = canPerformCatalogWrite(this.mode) ? '' : 'none';

		try {
			const result = await this.connection.listMcpServers();
			if (this.mode !== 'supported' || !this.connection.isEngineConnected()) {
				this.clearCatalogPresentation();
				return;
			}
			this.setServers(result.servers);
		} catch {
			this.clearCatalogPresentation();
			this.statusMessage.style.display = '';
			this.statusMessage.textContent = getCatalogTransportFailedCopy(MCP_FEATURE);
		}
	}

	private clearCatalogPresentation(): void {
		this.listEntries = [];
		this.list?.splice(0, this.list?.length ?? 0, []);
		this.statusMessage.style.display = 'none';
		this.statusMessage.textContent = '';
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
			return;
		}
		const list = this.ensureList();
		list.splice(0, list.length, entries);
	}

	private async toggleServer(server: UniverseAgentMcpServerSummary, enabled: boolean): Promise<void> {
		if (this.mode !== 'supported' || !this.connection.isEngineConnected()) {
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
