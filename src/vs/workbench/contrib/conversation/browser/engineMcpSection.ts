/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Checkbox } from '../../../../base/browser/ui/toggle/toggle.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { equals as arraysEqual } from '../../../../base/common/arrays.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { ensureCapabilitySnapshot } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import type { UniverseAgentCapabilitySupport, UniverseAgentMcpServerConfig, UniverseAgentMcpServerOrigin, UniverseAgentMcpServerSummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultButtonStyles, defaultCheckboxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { isConversationPairingHold } from './conversationSessionStatus.js';
import {
	type EngineCatalogPaneMode,
	canPerformCatalogWriteLive,
	canShowCatalogRows,
	resolveEngineCatalogPaneMode,
} from './engineCatalog.js';
import { createCatalogIconButton } from './engineCatalogIconButton.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { appendCatalogScopeNote } from './engineSectionChrome.js';
import { EngineMcpRuntimePanel } from './engineMcpRuntimePanel.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';
import { writeStatus } from './connectionPreferencesPane.js';

const $ = DOM.$;

type EngineMcpTab = 'definitions' | 'runtime';

const MCP_FEATURE = localize('ua.engineMcpFeatureLabel', "MCP server definitions");

export const ENGINE_MCP_ADD_SUCCESS_COPY = localize('ua.engineMcpAddSuccess', "Added.");
export const ENGINE_MCP_UPDATE_SUCCESS_COPY = localize('ua.engineMcpUpdateSuccess', "Updated.");
export const ENGINE_MCP_REMOVE_SUCCESS_COPY = localize('ua.engineMcpRemoveSuccess', "Removed.");
export const ENGINE_MCP_TOGGLE_SUCCESS_COPY = localize('ua.engineMcpToggleSuccess', "Toggled.");

const ENGINE_MCP_DIALOG_DETAIL = localize('ua.engineMcpDialogDetail', "stdio uses the command. sse and streamable_http use the URL. Arguments are one per line. Environment is one KEY=VALUE per line.");
const ENGINE_MCP_ARGS_FIELD = localize('ua.engineMcpArgs', "Arguments — one argument per line");
const ENGINE_MCP_ENV_FIELD = localize('ua.engineMcpEnv', "Environment — one KEY=VALUE per line");
const ENGINE_MCP_ENV_INVALID_COPY = localize('ua.engineMcpEnvInvalid', "Environment lines must be KEY=VALUE.");

function mcpTransportFromDialog(value: string): 'stdio' | 'sse' | 'streamable_http' | undefined {
	if (value === 'stdio' || value === 'sse' || value === 'streamable_http') {
		return value;
	}
	return undefined;
}

function mcpDialogError(values: readonly string[]): string | undefined {
	const transport = mcpTransportFromDialog((values[1] ?? '').trim());
	if (!transport) {
		return localize('ua.engineMcpTransportRequired', "Transport must be stdio, sse, or streamable_http.");
	}
	if (!mcpConfigFromDialog(values)) {
		return localize('ua.engineMcpAddIncomplete', "Name, transport, and a command or URL are required.");
	}
	if (!parseMcpEnvField(values[5]).ok) {
		return ENGINE_MCP_ENV_INVALID_COPY;
	}
	return undefined;
}

/** Blank args/env are omitted. An update partial includes them only when the parsed value differs. */
function mcpFieldLines(raw: string | undefined): readonly string[] {
	if (!raw || !raw.trim()) {
		return [];
	}
	const lines: string[] = [];
	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed) {
			lines.push(trimmed);
		}
	}
	return lines;
}

function parseMcpArgsField(raw: string | undefined): readonly string[] | undefined {
	const lines = mcpFieldLines(raw);
	return lines.length > 0 ? lines : undefined;
}

function parseMcpEnvField(raw: string | undefined): { readonly ok: true; readonly env?: Readonly<Record<string, string>> } | { readonly ok: false } {
	const lines = mcpFieldLines(raw);
	if (lines.length === 0) {
		return { ok: true };
	}
	const env: Record<string, string> = {};
	for (const line of lines) {
		const separator = line.indexOf('=');
		if (separator <= 0) {
			return { ok: false };
		}
		const key = line.slice(0, separator).trim();
		if (!key) {
			return { ok: false };
		}
		env[key] = line.slice(separator + 1).trim();
	}
	return { ok: true, env };
}

function envRecordsEqual(left: Readonly<Record<string, string>> | undefined, right: Readonly<Record<string, string>>): boolean {
	const existing = left ?? {};
	const rightKeys = Object.keys(right);
	if (Object.keys(existing).length !== rightKeys.length) {
		return false;
	}
	for (const key of rightKeys) {
		if (existing[key] !== right[key]) {
			return false;
		}
	}
	return true;
}

function formatMcpArgsField(args: readonly string[] | undefined): string {
	return args && args.length > 0 ? args.join('\n') : '';
}

function formatMcpEnvField(env: Readonly<Record<string, string>> | undefined): string {
	if (!env) {
		return '';
	}
	return Object.keys(env).map(key => `${key}=${env[key]}`).join('\n');
}

function mcpConfigFromDialog(values: readonly string[]): UniverseAgentMcpServerConfig | undefined {
	const name = (values[0] ?? '').trim();
	const transport = mcpTransportFromDialog((values[1] ?? '').trim());
	const command = (values[2] ?? '').trim();
	const url = (values[3] ?? '').trim();
	if (!transport) {
		return undefined;
	}
	const config: UniverseAgentMcpServerConfig = transport === 'stdio'
		? { name, transport, command }
		: { name, transport, url };
	return isCompleteMcpAddConfig(config) ? config : undefined;
}

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

function mcpDialogInputs(prefill?: {
	readonly name: string;
	readonly transport: string;
	readonly command: string;
	readonly url: string;
	readonly args: string;
	readonly env: string;
}): { type: 'text'; label: string; placeholder: string; value?: string }[] {
	const inputs: { type: 'text'; label: string; placeholder: string; value?: string }[] = [
		{ type: 'text', label: localize('ua.engineMcpName', "Name"), placeholder: localize('ua.engineMcpName', "Name") },
		{ type: 'text', label: localize('ua.engineMcpTransport', "Transport"), placeholder: localize('ua.engineMcpTransport', "stdio, sse, or streamable_http") },
		{ type: 'text', label: localize('ua.engineMcpCommand', "Command"), placeholder: localize('ua.engineMcpCommand', "Command") },
		{ type: 'text', label: localize('ua.engineMcpUrl', "URL"), placeholder: localize('ua.engineMcpUrl', "URL") },
		{ type: 'text', label: ENGINE_MCP_ARGS_FIELD, placeholder: ENGINE_MCP_ARGS_FIELD },
		{ type: 'text', label: ENGINE_MCP_ENV_FIELD, placeholder: ENGINE_MCP_ENV_FIELD },
	];
	if (!prefill) {
		return inputs;
	}
	const values = [prefill.name, prefill.transport, prefill.command, prefill.url, prefill.args, prefill.env];
	return inputs.map((input, index) => ({ ...input, value: values[index] }));
}

type EngineMcpListEntry =
	| { readonly kind: 'group'; readonly origin: UniverseAgentMcpServerOrigin; readonly label: string }
	| { readonly kind: 'server'; readonly server: UniverseAgentMcpServerSummary };

class EngineMcpListDelegate implements IListVirtualDelegate<EngineMcpListEntry> {
	getHeight(entry: EngineMcpListEntry): number {
		return entry.kind === 'group' ? 28 : 48;
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

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IInstantiationService instantiationService: IInstantiationService,
		@ICommandService private readonly commandService: ICommandService,
		@IAgentSessionContext private readonly sessionContext: IAgentSessionContext,
		@IDialogService private readonly dialogService: IDialogService,
	) {
		super();
		this.instantiationService = instantiationService;

		this.container = DOM.append(parent, $('.engine-mcp-section.engine-catalog-section'));
		this.container.style.display = 'none';

		this.heading = DOM.append(this.container, $('h3.engine-section-heading'));
		this.heading.textContent = localize('ua.engineMcpSectionTitle', "MCP Servers");
		this.heading.style.display = 'none';
		const workRoot = sessionWorkDir(this.sessionContext);
		appendCatalogScopeNote(this.container, workRoot
			? localize('ua.engineMcpScopeWithRoot', "Project servers follow this work root: {0}. Global servers are engine-wide.", workRoot)
			: localize('ua.engineMcpScope', "Project servers follow the open work root. Global servers are engine-wide."));

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

		this.writeToolbar = DOM.append(this.definitionsPanel, $('.engine-catalog-write-toolbar.engine-catalog-icon-actions'));
		this.writeToolbar.style.display = 'none';
		const addButton = this._register(createCatalogIconButton(this.writeToolbar, localize('ua.engineMcpAdd', "Add"), Codicon.add));
		this._register(addButton.onDidClick(() => void this.promptAddServer().catch(onUnexpectedError).catch(onUnexpectedError)));
		const updateButton = this._register(createCatalogIconButton(this.writeToolbar, localize('ua.engineMcpUpdate', "Update"), Codicon.edit));
		this._register(updateButton.onDidClick(() => void this.promptUpdateSelectedServer().catch(onUnexpectedError).catch(onUnexpectedError)));
		const removeButton = this._register(createCatalogIconButton(this.writeToolbar, localize('ua.engineMcpRemove', "Remove"), Codicon.trash));
		this._register(removeButton.onDidClick(() => void this.confirmAndRemoveSelectedServer().catch(onUnexpectedError).catch(onUnexpectedError)));
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

	private async promptAddServer(): Promise<void> {
		if (!this.canWrite()) {
			return;
		}
		const result = await this.dialogService.input({
			type: 'question',
			message: localize('ua.engineMcpAddTitle', "Add MCP server"),
			detail: ENGINE_MCP_DIALOG_DETAIL,
			primaryButton: localize('ua.engineMcpAdd', "Add"),
			inputs: mcpDialogInputs(),
			validate: mcpDialogError,
		});
		if (!result.confirmed || !result.values || !this.canWrite()) {
			return;
		}
		const drafted = mcpConfigFromDialog(result.values);
		if (!drafted) {
			this.showMcpDialogError(localize('ua.engineMcpAddIncomplete', "Name, transport, and a command or URL are required."));
			return;
		}
		const envField = parseMcpEnvField(result.values[5]);
		if (!envField.ok) {
			this.showMcpDialogError(ENGINE_MCP_ENV_INVALID_COPY);
			return;
		}
		const args = parseMcpArgsField(result.values[4]);
		const config: UniverseAgentMcpServerConfig = {
			...drafted,
			...(args ? { args } : {}),
			...(envField.env ? { env: envField.env } : {}),
		};
		await this.addServer(config);
	}

	private async promptUpdateSelectedServer(): Promise<void> {
		const selected = this.selectedServer;
		if (!this.canWrite() || !selected) {
			return;
		}
		const result = await this.dialogService.input({
			type: 'question',
			message: localize('ua.engineMcpUpdateTitle', "Edit MCP server"),
			detail: ENGINE_MCP_DIALOG_DETAIL,
			primaryButton: localize('ua.engineMcpUpdateSave', "Save"),
			inputs: mcpDialogInputs({
				name: selected.name,
				transport: selected.transport === 'unknown' ? '' : selected.transport,
				command: selected.command ?? '',
				url: selected.url ?? '',
				args: formatMcpArgsField(selected.args),
				env: formatMcpEnvField(selected.env),
			}),
			validate: mcpDialogError,
		});
		if (!result.confirmed || !result.values || !this.canWrite() || this.selectedServer?.id !== selected.id) {
			return;
		}
		const name = (result.values[0] ?? '').trim();
		const transport = mcpTransportFromDialog((result.values[1] ?? '').trim());
		const command = (result.values[2] ?? '').trim();
		const url = (result.values[3] ?? '').trim();
		if (!transport) {
			this.showMcpDialogError(localize('ua.engineMcpTransportRequired', "Transport must be stdio, sse, or streamable_http."));
			return;
		}
		const envField = parseMcpEnvField(result.values[5]);
		if (!envField.ok) {
			this.showMcpDialogError(ENGINE_MCP_ENV_INVALID_COPY);
			return;
		}
		const args = parseMcpArgsField(result.values[4]);
		const partial: Partial<UniverseAgentMcpServerConfig> = {};
		if (name !== selected.name) {
			partial.name = name;
		}
		if (transport !== selected.transport) {
			partial.transport = transport;
		}
		if (transport === 'stdio') {
			if (command !== (selected.command ?? '').trim()) {
				partial.command = command;
			}
		} else if (url !== (selected.url ?? '').trim()) {
			partial.url = url;
		}
		if (args && !arraysEqual(selected.args, args)) {
			partial.args = args;
		}
		if (envField.env && !envRecordsEqual(selected.env, envField.env)) {
			partial.env = envField.env;
		}
		if (Object.keys(partial).length === 0) {
			return;
		}
		const merged: UniverseAgentMcpServerConfig = {
			name: partial.name ?? selected.name,
			transport: partial.transport ?? selected.transport,
			command: partial.command ?? selected.command,
			args: partial.args ?? selected.args,
			env: partial.env ?? selected.env,
			url: partial.url ?? selected.url,
			enabled: selected.enabled,
		};
		if (!isCompleteMcpAddConfig(merged)) {
			this.showMcpDialogError(localize('ua.engineMcpAddIncomplete', "Name, transport, and a command or URL are required."));
			return;
		}
		await this.updateSelectedServer(partial);
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

	private async confirmAndRemoveSelectedServer(): Promise<void> {
		const selected = this.selectedServer;
		if (!this.canWrite() || !selected) {
			return;
		}
		const name = selected.name || selected.id;
		const { confirmed } = await this.dialogService.confirm({
			type: 'warning',
			message: localize('ua.engineMcpRemoveConfirm', "Remove MCP server \"{0}\"?", name),
			detail: localize('ua.engineMcpRemoveDetail', "This removes the server definition from the engine."),
			primaryButton: localize('ua.engineMcpRemove', "Remove"),
		});
		if (!confirmed || this.selectedServer?.id !== selected.id) {
			return;
		}
		await this.removeSelectedServer();
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

	private showMcpDialogError(message: string): void {
		this.catalogWriteStatus.style.display = '';
		writeStatus(this.catalogWriteStatus, message, 'error');
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
			entries.push({ kind: 'group', origin, label: getMcpOriginGroupLabel(origin) });
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
