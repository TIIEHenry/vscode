/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Checkbox } from '../../../../base/browser/ui/toggle/toggle.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { ensureCapabilitySnapshot } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import { InputBox } from '../../../../base/browser/ui/inputbox/inputBox.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import type { UniverseAgentCapabilitySupport, UniverseAgentMcpServerConfig, UniverseAgentMcpServerOrigin, UniverseAgentMcpServerSummary, UniverseAgentMcpServerTransport } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultButtonStyles, defaultCheckboxStyles, defaultInputBoxStyles, defaultSelectBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { isConversationPairingHold } from './conversationSessionStatus.js';
import {
	type EngineCatalogPaneMode,
	canPerformCatalogWriteLive,
	canShowCatalogRows,
	resolveEngineCatalogPaneMode,
} from './engineCatalog.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { EngineMcpRuntimePanel } from './engineMcpRuntimePanel.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';
import { writeStatus } from './connectionPreferencesPane.js';

const $ = DOM.$;

type EngineMcpTab = 'definitions' | 'runtime';

const MCP_FORM_TRANSPORTS: readonly UniverseAgentMcpServerTransport[] = ['stdio', 'sse', 'streamable_http'];

const MCP_FEATURE = localize('ua.engineMcpFeatureLabel', "MCP server definitions");

export const ENGINE_MCP_ADD_SUCCESS_COPY = localize('ua.engineMcpAddSuccess', "Added.");
export const ENGINE_MCP_UPDATE_SUCCESS_COPY = localize('ua.engineMcpUpdateSuccess', "Updated.");
export const ENGINE_MCP_REMOVE_SUCCESS_COPY = localize('ua.engineMcpRemoveSuccess', "Removed.");
export const ENGINE_MCP_TOGGLE_SUCCESS_COPY = localize('ua.engineMcpToggleSuccess', "Toggled.");

function isCompleteMcpAddConfig(config: UniverseAgentMcpServerConfig | undefined): config is UniverseAgentMcpServerConfig {
	if (!config || !config.name.trim()) {
		return false;
	}
	if (config.transport === 'stdio') {
		return typeof config.command === 'string' && config.command.trim().length > 0;
	}
	if (config.transport === 'sse' || config.transport === 'streamable_http') {
		return typeof config.url === 'string' && config.url.trim().length > 0;
	}
	return false;
}

type EngineMcpListEntry =
	| { readonly kind: 'group'; readonly origin: UniverseAgentMcpServerOrigin; readonly label: string; readonly count?: number }
	| { readonly kind: 'server'; readonly server: UniverseAgentMcpServerSummary };

class EngineMcpListDelegate implements IListVirtualDelegate<EngineMcpListEntry> {
	getHeight(_entry: EngineMcpListEntry): number {
		return 24;
	}

	getTemplateId(entry: EngineMcpListEntry): string {
		return entry.kind === 'group' ? 'mcpGroup' : 'mcpRow';
	}
}

interface IMcpGroupTemplateData {
	readonly label: HTMLElement;
	readonly count: HTMLElement;
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
		const label = DOM.append(container, $('.engine-catalog-group-label'));
		const count = DOM.append(container, $('.engine-catalog-group-count'));
		return { label, count };
	}

	renderElement(entry: EngineMcpListEntry, _index: number, templateData: IMcpGroupTemplateData): void {
		if (entry.kind !== 'group') {
			return;
		}
		templateData.label.textContent = entry.label;
		templateData.count.textContent = typeof entry.count === 'number' ? String(entry.count) : '';
	}

	disposeTemplate(): void {
		// noop
	}
}

class EngineMcpRowRenderer implements IListRenderer<EngineMcpListEntry, IMcpRowTemplateData> {
	static readonly TEMPLATE_ID = 'mcpRow';
	readonly templateId = EngineMcpRowRenderer.TEMPLATE_ID;

	constructor(
		private readonly canToggle: () => boolean,
		private readonly onToggle: (server: UniverseAgentMcpServerSummary, enabled: boolean) => void,
	) { }

	renderTemplate(container: HTMLElement): IMcpRowTemplateData {
		const row = DOM.append(container, $('.engine-catalog-row'));
		const checkbox = new Checkbox('', false, defaultCheckboxStyles);
		const checkboxDisposable = checkbox.onChange(() => {
			const server = (row as unknown as { __server?: UniverseAgentMcpServerSummary }).__server;
			if (server && this.canToggle()) {
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
		templateData.checkbox.setTitle(localize('ua.engineMcpRowToggle', "Enable {0}", entry.server.name || entry.server.id));
		templateData.checkbox.checked = entry.server.effectiveEnabled ?? entry.server.enabled;
		templateData.checkbox.enable();
		if (!this.canToggle()) {
			templateData.checkbox.disable();
		}
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

/** Session work root, when the optional API is present. Blank stays off the request. */
function sessionWorkDir(session: IAgentSessionContext | undefined): string | undefined {
	const workDir = session?.getActiveWorkRoot?.().workDir?.trim();
	return workDir || undefined;
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

/**
 * MCP Definitions write success is restored after refresh only when
 * ListMcpServers listed (D201 sibling).
 */
export class EngineMcpSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly heading: HTMLElement;
	private readonly tabBar: HTMLElement;
	private readonly definitionsTab: Button;
	private readonly runtimeTab: Button;
	private readonly definitionsPanel: HTMLElement;
	private readonly runtimePanelHost: HTMLElement;
	private readonly runtimePanel: EngineMcpRuntimePanel;
	private readonly status: EngineCatalogStatusWidget;
	private readonly writeToolbar: HTMLElement;
	private readonly formHost: HTMLElement;
	private readonly nameInput: InputBox;
	private readonly transportSelect: SelectBox;
	private readonly commandRow: HTMLElement;
	private readonly commandInput: InputBox;
	private readonly urlRow: HTMLElement;
	private readonly urlInput: InputBox;
	private readonly catalogWriteStatus: HTMLElement;
	private readonly listContainer: HTMLElement;
	private readonly instantiationService: IInstantiationService;
	private list: WorkbenchList<EngineMcpListEntry> | undefined;

	private mode: EngineCatalogPaneMode = 'disconnected';
	private listEntries: EngineMcpListEntry[] = [];
	private serverCount = 0;
	private readonly _onDidChangeItemCount = this._register(new Emitter<void>());
	readonly onDidChangeItemCount: Event<void> = this._onDidChangeItemCount.event;
	private selectedServer: UniverseAgentMcpServerSummary | undefined;
	private writeFailedReason: string | undefined;
	private sectionActive = false;
	private refreshGeneration = 0;
	private _removeServerGeneration = 0;
	private lastLayout: { readonly width: number; readonly listHeight: number } | undefined;

	private formMode: 'add' | 'update' | undefined;
	private formTransport: UniverseAgentMcpServerTransport = 'stdio';

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IInstantiationService instantiationService: IInstantiationService,
		@ICommandService private readonly commandService: ICommandService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IAgentSessionContext private readonly sessionContext: IAgentSessionContext,
	) {
		super();
		this.instantiationService = instantiationService;

		this.container = DOM.append(parent, $('.engine-mcp-section.engine-catalog-section'));
		this.container.style.display = 'none';

		this.heading = DOM.append(this.container, $('h3.engine-section-heading'));
		this.heading.textContent = localize('ua.engineMcpSectionTitle', "MCP Servers");
		this.heading.style.display = 'none';

		this.tabBar = DOM.append(this.container, $('.engine-mcp-tab-bar'));
		this.tabBar.setAttribute('role', 'tablist');
		this.definitionsTab = this._register(new Button(this.tabBar, { ...defaultButtonStyles, secondary: true }));
		this.definitionsTab.label = localize('ua.engineMcpTabDefinitions', "Definitions");
		this.definitionsTab.element.setAttribute('role', 'tab');
		this.runtimeTab = this._register(new Button(this.tabBar, { ...defaultButtonStyles, secondary: true }));
		this.runtimeTab.label = localize('ua.engineMcpTabRuntime', "Runtime");
		this.runtimeTab.element.setAttribute('role', 'tab');
		this._register(this.definitionsTab.onDidClick(() => this.setActiveTab('definitions')));
		this._register(this.runtimeTab.onDidClick(() => this.setActiveTab('runtime')));

		this.definitionsPanel = DOM.append(this.container, $('.engine-mcp-definitions-panel'));

		this.status = this._register(new EngineCatalogStatusWidget(this.definitionsPanel));

		this.writeToolbar = DOM.append(this.definitionsPanel, $('.engine-catalog-write-toolbar'));
		this.writeToolbar.style.display = 'none';
		const addButton = this._register(new Button(this.writeToolbar, defaultButtonStyles));
		addButton.label = localize('ua.engineMcpAdd', "Add");
		this._register(addButton.onDidClick(() => this.openAddForm()));
		const updateButton = this._register(new Button(this.writeToolbar, { ...defaultButtonStyles, secondary: true }));
		updateButton.label = localize('ua.engineMcpUpdate', "Update");
		this._register(updateButton.onDidClick(() => this.openUpdateForm()));
		const removeButton = this._register(new Button(this.writeToolbar, { ...defaultButtonStyles, secondary: true }));
		removeButton.label = localize('ua.engineMcpRemove', "Remove");
		this._register(removeButton.onDidClick(() => void this.removeSelectedServer().catch(onUnexpectedError).catch(onUnexpectedError)));

		this.formHost = DOM.append(this.definitionsPanel, $('.engine-mcp-form'));
		this.formHost.style.display = 'none';

		const nameRow = DOM.append(this.formHost, $('.engine-mcp-form-row'));
		DOM.append(nameRow, $('label')).textContent = localize('ua.engineMcpName', "Name");
		this.nameInput = this._register(new InputBox(nameRow, this.contextViewService, {
			ariaLabel: localize('ua.engineMcpName', "Name"),
			inputBoxStyles: defaultInputBoxStyles,
		}));
		this.nameInput.element.classList.add('engine-mcp-name-input');

		const transportRow = DOM.append(this.formHost, $('.engine-mcp-form-row'));
		DOM.append(transportRow, $('label')).textContent = localize('ua.engineMcpTransport', "Transport");
		this.transportSelect = this._register(new SelectBox(
			MCP_FORM_TRANSPORTS.map(text => ({ text })),
			0,
			this.contextViewService,
			defaultSelectBoxStyles,
			{ ariaLabel: localize('ua.engineMcpTransport', "Transport") },
		));
		this.transportSelect.render(transportRow);
		this._register(this.transportSelect.onDidSelect(e => {
			this.formTransport = MCP_FORM_TRANSPORTS[e.index];
			this.updateFormFieldsVisibility();
		}));

		this.commandRow = DOM.append(this.formHost, $('.engine-mcp-form-row'));
		DOM.append(this.commandRow, $('label')).textContent = localize('ua.engineMcpCommand', "Command");
		this.commandInput = this._register(new InputBox(this.commandRow, this.contextViewService, {
			ariaLabel: localize('ua.engineMcpCommand', "Command"),
			inputBoxStyles: defaultInputBoxStyles,
		}));
		this.commandInput.element.classList.add('engine-mcp-command-input');

		this.urlRow = DOM.append(this.formHost, $('.engine-mcp-form-row'));
		DOM.append(this.urlRow, $('label')).textContent = localize('ua.engineMcpUrl', "URL");
		this.urlInput = this._register(new InputBox(this.urlRow, this.contextViewService, {
			ariaLabel: localize('ua.engineMcpUrl', "URL"),
			inputBoxStyles: defaultInputBoxStyles,
		}));
		this.urlInput.element.classList.add('engine-mcp-url-input');

		const formActions = DOM.append(this.formHost, $('.engine-mcp-form-actions'));
		const submitButton = this._register(new Button(formActions, defaultButtonStyles));
		submitButton.element.classList.add('engine-mcp-form-submit');
		submitButton.label = localize('ua.engineMcpSubmit', "Submit");
		this._register(submitButton.onDidClick(() => void this.handleFormSubmit().catch(onUnexpectedError).catch(onUnexpectedError)));

		const cancelButton = this._register(new Button(formActions, { ...defaultButtonStyles, secondary: true }));
		cancelButton.element.classList.add('engine-mcp-form-cancel');
		cancelButton.label = localize('ua.engineMcpCancel', "Cancel");
		this._register(cancelButton.onDidClick(() => this.closeForm()));

		this.catalogWriteStatus = DOM.append(this.definitionsPanel, $('.engine-catalog-write-status'));
		this.catalogWriteStatus.setAttribute('role', 'status');
		this.catalogWriteStatus.setAttribute('aria-live', 'polite');
		this.catalogWriteStatus.style.display = 'none';

		this.listContainer = DOM.append(this.definitionsPanel, $('.engine-catalog-list'));

		this.runtimePanelHost = DOM.append(this.container, $('.engine-mcp-runtime-host'));
		this.runtimePanel = this._register(instantiationService.createInstance(EngineMcpRuntimePanel, this.runtimePanelHost));

		this._register(this.connection.onDidChangeConnection(() => {
			void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
			this.runtimePanel.render();
		}));

		if (this.sessionContext?.onDidChangeActiveSession) {
			this._register(this.sessionContext.onDidChangeActiveSession(() => {
				void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
			}));
		}
		if (this.sessionContext?.onDidChangeActiveWorkRoot) {
			this._register(this.sessionContext.onDidChangeActiveWorkRoot(() => {
				void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
			}));
		}

		this.setActiveTab('definitions');
		void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);
	}

	private setActiveTab(tab: EngineMcpTab): void {
		this.definitionsTab.secondary = tab !== 'definitions';
		this.runtimeTab.secondary = tab !== 'runtime';
		this.definitionsTab.element.setAttribute('aria-selected', String(tab === 'definitions'));
		this.runtimeTab.element.setAttribute('aria-selected', String(tab === 'runtime'));
		this.definitionsPanel.style.display = tab === 'definitions' ? '' : 'none';
		this.runtimePanel.setVisible(tab === 'runtime');
		if (tab === 'runtime') {
			this.runtimePanel.render();
		}
	}

	layout(width: number, listHeight: number): void {
		this.lastLayout = { width, listHeight };
		this.list?.layout(Math.max(80, listHeight), width);
		this.runtimePanel.layout(width, listHeight);
	}

	override dispose(): void {
		this._removeServerGeneration++;
		this.refreshGeneration++;
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

	/** Nav badge counts servers, not origin group headings. */
	getItemCount(): number | undefined {
		return this.serverCount > 0 ? this.serverCount : undefined;
	}

	private setServerCount(count: number): void {
		if (this.serverCount === count) {
			return;
		}
		this.serverCount = count;
		this._onDidChangeItemCount.fire();
	}

	canWrite(): boolean {
		return canPerformCatalogWriteLive(
			this.mode,
			this.connection.isEngineConnected(),
			isConversationPairingHold(this.connection),
		);
	}

	getSelectedServerId(): string | undefined {
		return this.selectedServer?.id;
	}

	private setSelectedServer(server: UniverseAgentMcpServerSummary | undefined): void {
		if (server?.id !== this.selectedServer?.id) {
			this._removeServerGeneration++;
		}
		this.selectedServer = server;
	}

	isWriteToolbarVisible(): boolean {
		return this.writeToolbar.style.display !== 'none';
	}

	selectServerByIdForTest(id: string): boolean {
		const index = this.listEntries.findIndex(entry => entry.kind === 'server' && entry.server.id === id);
		if (index < 0 || !this.list) {
			this.setSelectedServer(undefined);
			return false;
		}
		const entry = this.listEntries[index];
		if (entry.kind === 'server') {
			this.setSelectedServer(entry.server);
		}
		this.list.setSelection([index]);
		return true;
	}

	/** Test hook: programmatically toggle a server by id. */
	async toggleServerForTest(id: string, enabled: boolean): Promise<void> {
		const entry = this.listEntries.find(item => item.kind === 'server' && item.server.id === id);
		if (entry?.kind === 'server') {
			await this.toggleServer(entry.server, enabled);
		}
	}

	private openAddForm(): void {
		if (!this.canWrite()) {
			return;
		}
		this.formMode = 'add';
		this.formTransport = 'stdio';
		this.nameInput.value = '';
		this.commandInput.value = '';
		this.urlInput.value = '';
		this.transportSelect.select(0);
		this.updateFormFieldsVisibility();
		this.formHost.style.display = '';
	}

	private openUpdateForm(): void {
		if (!this.canWrite() || !this.selectedServer) {
			return;
		}
		this.formMode = 'update';
		this.nameInput.value = this.selectedServer.name || '';
		const transport = this.selectedServer.transport;
		const knownIndex = MCP_FORM_TRANSPORTS.indexOf(transport as any);
		if (knownIndex >= 0) {
			this.formTransport = transport;
			this.transportSelect.select(knownIndex);
		} else {
			this.formTransport = 'unknown';
			this.transportSelect.select(0);
		}
		this.commandInput.value = this.selectedServer.command || '';
		this.urlInput.value = this.selectedServer.url || '';
		this.updateFormFieldsVisibility();
		this.formHost.style.display = '';
	}

	closeForm(): void {
		this.formHost.style.display = 'none';
		this.formMode = undefined;
		this.nameInput.value = '';
		this.commandInput.value = '';
		this.urlInput.value = '';
	}

	private updateFormFieldsVisibility(): void {
		const isStdio = this.formTransport === 'stdio';
		this.commandRow.style.display = isStdio ? '' : 'none';
		const isUrl = this.formTransport === 'sse' || this.formTransport === 'streamable_http';
		this.urlRow.style.display = isUrl ? '' : 'none';
	}

	isFormVisible(): boolean {
		return this.formHost.style.display !== 'none';
	}

	getFormMode(): 'add' | 'update' | undefined {
		return this.formHost.style.display !== 'none' ? this.formMode : undefined;
	}

	getFormValues(): { name: string; transport: string; command: string; url: string } {
		return {
			name: this.nameInput.value,
			transport: this.formTransport,
			command: this.commandInput.value,
			url: this.urlInput.value,
		};
	}

	setFormValues(values: { name?: string; transport?: UniverseAgentMcpServerTransport; command?: string; url?: string }): void {
		if (values.name !== undefined) {
			this.nameInput.value = values.name;
		}
		if (values.transport !== undefined) {
			this.formTransport = values.transport;
			const index = MCP_FORM_TRANSPORTS.indexOf(values.transport as any);
			if (index >= 0) {
				this.transportSelect.select(index);
			}
			this.updateFormFieldsVisibility();
		}
		if (values.command !== undefined) {
			this.commandInput.value = values.command;
		}
		if (values.url !== undefined) {
			this.urlInput.value = values.url;
		}
	}

	async submitFormForTest(): Promise<boolean> {
		return this.handleFormSubmit();
	}

	private async handleFormSubmit(): Promise<boolean> {
		if (this.formMode === 'add') {
			return this.submitAddForm();
		}
		if (this.formMode === 'update') {
			return this.submitUpdateForm();
		}
		return false;
	}

	private async submitAddForm(): Promise<boolean> {
		const trimmedName = this.nameInput.value.trim();
		if (!trimmedName) {
			return false;
		}
		const currentTransport = this.formTransport;
		if (currentTransport === 'unknown') {
			return false;
		}
		const trimmedCommand = currentTransport === 'stdio' ? this.commandInput.value.trim() : undefined;
		const trimmedUrl = (currentTransport === 'sse' || currentTransport === 'streamable_http') ? this.urlInput.value.trim() : undefined;
		const config: UniverseAgentMcpServerConfig = {
			name: trimmedName,
			transport: currentTransport,
			...(currentTransport === 'stdio' ? { command: trimmedCommand } : {}),
			...(currentTransport === 'sse' || currentTransport === 'streamable_http' ? { url: trimmedUrl } : {}),
		};
		if (!isCompleteMcpAddConfig(config)) {
			return false;
		}
		const ok = await this.addServer(config);
		if (ok) {
			this.closeForm();
		}
		return ok;
	}

	private async submitUpdateForm(): Promise<boolean> {
		if (!this.selectedServer) {
			return false;
		}
		const trimmedName = this.nameInput.value.trim();
		const currentTransport = this.formTransport;
		const trimmedCommand = currentTransport === 'stdio' ? this.commandInput.value.trim() : undefined;
		const trimmedUrl = (currentTransport === 'sse' || currentTransport === 'streamable_http') ? this.urlInput.value.trim() : undefined;

		const nameSame = trimmedName === (this.selectedServer.name ?? '');
		const transportSame = currentTransport === this.selectedServer.transport;
		let commandSame = true;
		if (currentTransport === 'stdio') {
			commandSame = trimmedCommand === (this.selectedServer.command ?? '');
		}
		let urlSame = true;
		if (currentTransport === 'sse' || currentTransport === 'streamable_http') {
			urlSame = trimmedUrl === (this.selectedServer.url ?? '');
		}

		if (nameSame && transportSame && commandSame && urlSame) {
			return false;
		}

		const merged: UniverseAgentMcpServerConfig = {
			id: this.selectedServer.id,
			name: trimmedName,
			transport: currentTransport,
			command: currentTransport === 'stdio' ? trimmedCommand : this.selectedServer.command,
			args: this.selectedServer.args,
			env: this.selectedServer.env,
			url: (currentTransport === 'sse' || currentTransport === 'streamable_http') ? trimmedUrl : this.selectedServer.url,
			enabled: this.selectedServer.enabled,
		};

		if (!isCompleteMcpAddConfig(merged)) {
			return false;
		}

		const partial: Partial<UniverseAgentMcpServerConfig> = {};
		if (trimmedName !== (this.selectedServer.name ?? '')) {
			partial.name = trimmedName;
		}
		if (currentTransport !== this.selectedServer.transport) {
			partial.transport = currentTransport;
		}
		if (currentTransport === 'stdio') {
			if (trimmedCommand !== (this.selectedServer.command ?? '')) {
				partial.command = trimmedCommand;
			}
		} else if (currentTransport === 'sse' || currentTransport === 'streamable_http') {
			if (trimmedUrl !== (this.selectedServer.url ?? '')) {
				partial.url = trimmedUrl;
			}
		}

		const ok = await this.updateSelectedServer(partial);
		if (ok) {
			this.closeForm();
		}
		return ok;
	}

	async addServer(config?: UniverseAgentMcpServerConfig): Promise<boolean> {
		if (!this.canWrite() || !isCompleteMcpAddConfig(config)) {
			return false;
		}
		this.writeFailedReason = undefined;
		this.hideCatalogWriteStatus();
		const scope = 'global';
		try {
			const workDir = sessionWorkDir(this.sessionContext);
			const result = await this.connection.addMcpServer(workDir ? { config, scope, workDir } : { config, scope });
			if (!result.ok) {
				this.showWriteFailed(result.reason);
				return false;
			}
			this.showCatalogWriteStatus(ENGINE_MCP_ADD_SUCCESS_COPY);
			const listed = await this.refresh();
			if (listed) {
				this.showCatalogWriteStatus(ENGINE_MCP_ADD_SUCCESS_COPY);
			}
			return true;
		} catch (error) {
			this.showWriteFailed(error);
			return false;
		}
	}

	async updateSelectedServer(config?: Partial<UniverseAgentMcpServerConfig>): Promise<boolean> {
		if (!this.canWrite() || !this.selectedServer) {
			return false;
		}
		this.writeFailedReason = undefined;
		this.hideCatalogWriteStatus();
		const scope = this.selectedServer.origin === 'project' ? 'project' : 'global';
		const merged: UniverseAgentMcpServerConfig = {
			id: this.selectedServer.id,
			name: config?.name ?? this.selectedServer.name,
			transport: config?.transport ?? this.selectedServer.transport,
			command: config?.command ?? this.selectedServer.command,
			args: config?.args ?? this.selectedServer.args,
			env: config?.env ?? this.selectedServer.env,
			url: config?.url ?? this.selectedServer.url,
			enabled: config?.enabled ?? this.selectedServer.enabled,
		};
		try {
			const workDir = sessionWorkDir(this.sessionContext);
			const result = await this.connection.updateMcpServer(workDir ? {
				serverId: this.selectedServer.id,
				config: merged,
				scope,
				workDir,
			} : {
				serverId: this.selectedServer.id,
				config: merged,
				scope,
			});
			if (!result.ok) {
				this.showWriteFailed(result.reason);
				return false;
			}
			this.showCatalogWriteStatus(ENGINE_MCP_UPDATE_SUCCESS_COPY);
			const listed = await this.refresh();
			if (listed) {
				this.showCatalogWriteStatus(ENGINE_MCP_UPDATE_SUCCESS_COPY);
			}
			return true;
		} catch (error) {
			this.showWriteFailed(error);
			return false;
		}
	}

	async removeSelectedServer(): Promise<boolean> {
		if (!this.canWrite() || !this.selectedServer) {
			return false;
		}
		this.writeFailedReason = undefined;
		this.hideCatalogWriteStatus();
		const generation = ++this._removeServerGeneration;
		const serverId = this.selectedServer.id;
		const scope = this.selectedServer.origin === 'project' ? 'project' : 'global';
		try {
			const workDir = sessionWorkDir(this.sessionContext);
			const result = await this.connection.removeMcpServer(workDir ? {
				serverId,
				scope,
				workDir,
			} : {
				serverId,
				scope,
			});
			if (generation !== this._removeServerGeneration || this._store.isDisposed || this.selectedServer?.id !== serverId) {
				return false;
			}
			if (!result.ok) {
				this.showWriteFailed(result.reason);
				return false;
			}
			this.selectedServer = undefined;
			this.showCatalogWriteStatus(ENGINE_MCP_REMOVE_SUCCESS_COPY);
			const listed = await this.refresh();
			if (generation !== this._removeServerGeneration || this._store.isDisposed) {
				return true;
			}
			if (listed) {
				this.showCatalogWriteStatus(ENGINE_MCP_REMOVE_SUCCESS_COPY);
			}
			return true;
		} catch (error) {
			if (generation !== this._removeServerGeneration || this._store.isDisposed || this.selectedServer?.id !== serverId) {
				return false;
			}
			this.showWriteFailed(error);
			return false;
		}
	}

	private hideCatalogWriteStatus(): void {
		this.catalogWriteStatus.style.display = 'none';
		writeStatus(this.catalogWriteStatus, '');
	}

	private showCatalogWriteStatus(message: string): void {
		this.catalogWriteStatus.style.display = '';
		writeStatus(this.catalogWriteStatus, message, 'success');
	}

	private showWriteFailed(error: unknown): void {
		const reason = (typeof error === 'string' && error)
			? error
			: (error instanceof Error && error.message
				? error.message
				: localize('ua.engineMcpWriteFailed', "The engine rejected the MCP write."));
		this.writeFailedReason = reason;
		this.catalogWriteStatus.style.display = '';
		writeStatus(this.catalogWriteStatus, reason, 'error');
		this.status.render({
			mode: 'failed',
			featureLabel: MCP_FEATURE,
			reason,
			onRetry: () => void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError),
		});
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
					new EngineMcpRowRenderer(
						() => this.canWrite(),
						(server, enabled) => void this.toggleServer(server, enabled).catch(onUnexpectedError).catch(onUnexpectedError),
					),
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
				this.setSelectedServer(entry?.kind === 'server' ? entry.server : undefined);
			}));
		}
		return this.list;
	}

	private relayoutLeftoverList(): void {
		if (this.lastLayout && this.list) {
			this.list.layout(Math.max(80, this.lastLayout.listHeight), this.lastLayout.width);
		}
	}

	private keepLeftoverCatalogForPairingHold(hadLiveCatalog: boolean): boolean {
		return hadLiveCatalog && isConversationPairingHold(this.connection);
	}

	private closeLeftoverRowToggleChrome(): void {
		// D425 / D427: leftover KEEP / UNKNOWN / list-fail must close leftover
		// row toggle chrome on refresh; do not wait for another selectServer.
		// Toolbar hide alone left leftover checkboxes looking live.
		// `list.rerender()` is a no-op unless supportDynamicHeights; splice
		// the leftover entries so renderElement can disable toggles via canWrite().
		this.relayoutLeftoverList();
		if (this.list && this.listEntries.length > 0) {
			this.list.splice(0, this.list.length, this.listEntries);
			this.restoreServerSelection();
		}
	}

	private applyDisconnectedRefresh(support: UniverseAgentCapabilitySupport, hadLiveCatalog: boolean): boolean {
		if (this.keepLeftoverCatalogForPairingHold(hadLiveCatalog)) {
			this.hideCatalogWriteStatus();
			this.writeToolbar.style.display = 'none';
			this.listContainer.style.display = '';
			this.mode = resolveEngineCatalogPaneMode(false, support);
			this.renderStatus();
			this.closeLeftoverRowToggleChrome();
			return false;
		}
		this.clearCatalogPresentation();
		this.mode = resolveEngineCatalogPaneMode(false, support);
		this.renderStatus();
		return false;
	}

	private async refresh(): Promise<boolean> {
		const generation = ++this.refreshGeneration;
		const capabilities = ensureCapabilitySnapshot(this.connection.getCapabilitySnapshot());
		const connected = this.connection.isEngineConnected();
		const support = capabilities.mcp.support;
		this.writeFailedReason = undefined;
		this.hideCatalogWriteStatus();

		const hadLiveCatalog = this.listEntries.some(entry => entry.kind === 'server');
		// D348 leftover-looks-live: pairing-hold first. KEEP is not only `!connected`.
		if (isConversationPairingHold(this.connection) || !connected) {
			return this.applyDisconnectedRefresh(support, hadLiveCatalog);
		}

		if (support === 'UNSUPPORTED') {
			this.clearCatalogPresentation();
			this.mode = resolveEngineCatalogPaneMode(true, support);
			this.renderStatus({ reason: capabilities.mcp.reason });
			return false;
		}

		if (support === 'UNKNOWN') {
			// Keep leftover server rows after a live paint (D254; D232).
			if (!hadLiveCatalog) {
				this.clearCatalogPresentation();
			} else {
				this.hideCatalogWriteStatus();
				this.listContainer.style.display = '';
			}
			this.mode = resolveEngineCatalogPaneMode(true, support);
			this.writeToolbar.style.display = 'none';
			this.renderStatus({ loadingKind: 'capability' });
			if (hadLiveCatalog) {
				this.closeLeftoverRowToggleChrome();
			}
			return false;
		}

		this.mode = resolveEngineCatalogPaneMode(true, support, { kind: 'inFlight' });
		this.writeToolbar.style.display = 'none';
		this.renderStatus({ loadingKind: 'list' });

		try {
			const workDir = sessionWorkDir(this.sessionContext);
			const result = await (workDir
				? this.connection.listMcpServers({ workDir })
				: this.connection.listMcpServers());
			if (generation !== this.refreshGeneration || this._store.isDisposed) {
				return false;
			}
			const leftoverAfterList = this.listEntries.some(entry => entry.kind === 'server');
			if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
				return this.applyDisconnectedRefresh(support, leftoverAfterList);
			}
			this.setServers(result.servers);
			this.mode = resolveEngineCatalogPaneMode(true, support, {
				kind: 'success',
				itemCount: result.servers.length,
			});
			this.listContainer.style.display = canShowCatalogRows(this.mode) ? '' : 'none';
			this.writeToolbar.style.display = this.canWrite() ? '' : 'none';
			this.renderStatus();
			return true;
		} catch (error) {
			if (generation !== this.refreshGeneration || this._store.isDisposed) {
				return false;
			}
			const leftoverAfterList = this.listEntries.some(entry => entry.kind === 'server');
			if (!leftoverAfterList) {
				this.clearCatalogPresentation();
			}
			this.mode = resolveEngineCatalogPaneMode(true, support, {
				kind: 'failed',
				error: error instanceof Error ? error.message : undefined,
			});
			this.writeToolbar.style.display = 'none';
			this.renderStatus({
				reason: error instanceof Error ? error.message : undefined,
				onRetry: () => void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError),
			});
			if (leftoverAfterList) {
				this.closeLeftoverRowToggleChrome();
			}
			return false;
		}
	}

	private renderStatus(options?: { reason?: string; loadingKind?: 'capability' | 'list'; onRetry?: () => void }): void {
		if (this.writeFailedReason && (this.mode === 'ready' || this.mode === 'empty')) {
			this.status.render({
				mode: 'failed',
				featureLabel: MCP_FEATURE,
				reason: this.writeFailedReason,
				onRetry: () => void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError),
			});
			return;
		}
		this.status.render({
			mode: this.mode,
			featureLabel: MCP_FEATURE,
			emptyCopy: localize('ua.engineMcpEmpty', "No MCP servers yet."),
			reason: options?.reason,
			loadingKind: options?.loadingKind,
			onRetry: options?.onRetry,
			onOpenConnection: this.mode === 'disconnected'
				? () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID).catch(onUnexpectedError).catch(onUnexpectedError)
				: undefined,
		});
	}

	private clearCatalogPresentation(): void {
		this.closeForm();
		this.listEntries = [];
		this.setServerCount(0);
		this.list?.splice(0, this.list?.length ?? 0, []);
		this.setSelectedServer(undefined);
		this.writeFailedReason = undefined;
		this.hideCatalogWriteStatus();
		this.status.hide();
		this.listContainer.style.display = 'none';
		this.writeToolbar.style.display = 'none';
	}

	private setServers(servers: readonly UniverseAgentMcpServerSummary[]): void {
		this.setServerCount(servers.length);
		const entries: EngineMcpListEntry[] = [];
		for (const [origin, group] of groupMcpServersByOrigin(servers)) {
			entries.push({ kind: 'group', origin, label: getMcpOriginGroupLabel(origin), count: group.length });
			for (const server of group) {
				entries.push({ kind: 'server', server });
			}
		}
		this.listEntries = entries;
		if (entries.length === 0) {
			this.list?.splice(0, this.list?.length ?? 0, []);
			this.setSelectedServer(undefined);
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
			this.setSelectedServer(undefined);
			return;
		}
		const entry = this.listEntries[index];
		if (entry?.kind === 'server') {
			this.setSelectedServer(entry.server);
		}
		this.list.setSelection([index]);
	}

	private async toggleServer(server: UniverseAgentMcpServerSummary, enabled: boolean): Promise<void> {
		if (!this.canWrite()) {
			return;
		}
		const scope = server.origin === 'project' ? 'project' : 'global';
		try {
			const workDir = sessionWorkDir(this.sessionContext);
			const result = await this.connection.toggleMcpServer(workDir ? {
				id: server.id,
				enabled,
				scope,
				workDir,
			} : {
				id: server.id,
				enabled,
				scope,
			});
			if (!result.ok) {
				this.showWriteFailed(result.reason);
				await this.refresh();
				this.showWriteFailed(result.reason);
				return;
			}
			this.showCatalogWriteStatus(ENGINE_MCP_TOGGLE_SUCCESS_COPY);
			const listed = await this.refresh();
			if (listed) {
				this.showCatalogWriteStatus(ENGINE_MCP_TOGGLE_SUCCESS_COPY);
			}
		} catch (error) {
			this.showWriteFailed(error);
			await this.refresh();
			this.showWriteFailed(error);
		}
	}
}
