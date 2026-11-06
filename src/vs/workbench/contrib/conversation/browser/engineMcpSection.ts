/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentPublishedLinkOwner } from '../../../../platform/universeAgent/common/universeAgentExpectedOwner.js';
import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Toggle } from '../../../../base/browser/ui/toggle/toggle.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { equals as arraysEqual } from '../../../../base/common/arrays.js';
import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { ensureCapabilitySnapshot, readPublishedEngineIdentityId, readPublishedLinkId } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import { captureEnginePublishedLinkOwner, EngineRefreshGate, evaluateEnginePublishedWrite, engineWriteNotSentCopy, engineWriteUnconfirmedCopy, engineWriteSelectionNotSentCopy, engineWriteSelectionUnconfirmedCopy } from './engineWriteGate.js';
import type { UniverseAgentCapabilitySupport, UniverseAgentMcpServerConfig, UniverseAgentMcpServerOrigin, UniverseAgentMcpServerSummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { isConversationPairingHold } from './conversationSessionStatus.js';
import {
	type EngineCatalogPaneMode,
	canPerformCatalogWriteLive,
	canShowCatalogRows,
	resolveEngineCatalogPaneMode,
} from './engineCatalog.js';
import { showEngineConfirmPopover } from './engineConfirmPopover.js';
import { createCatalogIconButton } from './engineCatalogIconButton.js';
import { EngineCatalogSectionController, paintEngineLinkNotice } from './engineCatalogSectionController.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { appendCatalogScopeNote } from './engineSectionChrome.js';
import { EngineMcpRuntimePanel } from './engineMcpRuntimePanel.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';
import { writeStatus } from './connectionPreferencesPane.js';

const $ = DOM.$;

type EngineMcpTab = 'definitions' | 'runtime';

interface McpWriteIntent {
	readonly owner: UniverseAgentPublishedLinkOwner;
	readonly workDir: string | undefined;
	readonly scope: 'project' | 'global';
	readonly server?: UniverseAgentMcpServerSummary;
}


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
	readonly checkbox: Toggle;
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
		const checkbox = new Toggle({
			title: '',
			isChecked: false,
			inputActiveOptionBackground: 'var(--ua-editor-setting-switch-track)',
			inputActiveOptionForeground: 'var(--vscode-inputOption-activeForeground)',
			inputActiveOptionBorder: 'transparent',
		});
		checkbox.domNode.setAttribute('role', 'switch');
		const checkboxDisposable = checkbox.onChange(() => {
			const server = (row as unknown as { __server?: UniverseAgentMcpServerSummary }).__server;
			if (server && this.canToggle()) {
				this.onToggle(server, checkbox.checked);
			}
		});
		const text = DOM.append(row, $('.engine-catalog-text'));
		row.appendChild(checkbox.domNode);
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

	private _isDisposed = false;
	get isDisposed(): boolean {
		return this._isDisposed || this._store.isDisposed;
	}

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
	private readonly addButton: Button;
	private readonly updateButton: Button;
	private readonly removeButton: Button;
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
	private readonly refreshGate: EngineRefreshGate;
	private readonly controller: EngineCatalogSectionController;
	private linkNotice: string | undefined;
	private addInFlight = false;
	private _removeServerGeneration = 0;
	private lastLayout: { readonly width: number; readonly listHeight: number } | undefined;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IInstantiationService instantiationService: IInstantiationService,
		@ICommandService private readonly commandService: ICommandService,
		@IAgentSessionContext private readonly sessionContext: IAgentSessionContext,
		@IDialogService private readonly dialogService: IDialogService,
		@IContextViewService private readonly contextViewService: IContextViewService,
	) {
		super();
		this.instantiationService = instantiationService;
		this.refreshGate = new EngineRefreshGate(this.connection, this._store);
		this.controller = new EngineCatalogSectionController(this.connection);

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
		this._register(this.definitionsTab.onDidClick(() => {
			if (this.isDisposed || this._store.isDisposed) {
				return;
			}
			this.setActiveTab('definitions');
		}));
		this._register(this.runtimeTab.onDidClick(() => {
			if (this.isDisposed || this._store.isDisposed) {
				return;
			}
			this.setActiveTab('runtime');
		}));

		this.definitionsPanel = DOM.append(this.container, $('.engine-mcp-definitions-panel'));

		this.status = this._register(new EngineCatalogStatusWidget(this.definitionsPanel));

		this.writeToolbar = DOM.append(this.definitionsPanel, $('.engine-catalog-write-toolbar.engine-catalog-icon-actions'));
		this.writeToolbar.style.display = 'none';
		this.addButton = this._register(createCatalogIconButton(this.writeToolbar, localize('ua.engineMcpAdd', "Add"), Codicon.add));
		this._register(this.addButton.onDidClick(() => {
			if (this.isDisposed || this._store.isDisposed) {
				return;
			}
			void this.promptAddServer().catch(onUnexpectedError);
		}));
		const updateLabel = localize('ua.engineMcpUpdate', "Update");
		this.updateButton = this._register(createCatalogIconButton(this.writeToolbar, updateLabel, Codicon.edit));
		this.updateButton.element.dataset.mcpLabel = updateLabel;
		this._register(this.updateButton.onDidClick(() => {
			if (this.isDisposed || this._store.isDisposed) {
				return;
			}
			void this.promptUpdateSelectedServer().catch(onUnexpectedError);
		}));
		const removeLabel = localize('ua.engineMcpRemove', "Remove");
		this.removeButton = this._register(createCatalogIconButton(this.writeToolbar, removeLabel, Codicon.trash));
		this.removeButton.element.dataset.mcpLabel = removeLabel;
		this._register(this.removeButton.onDidClick(() => {
			if (this.isDisposed || this._store.isDisposed) {
				return;
			}
			void this.confirmAndRemoveSelectedServer().catch(onUnexpectedError);
		}));
		this.syncMcpSelectionActions();
		this.catalogWriteStatus = DOM.append(this.definitionsPanel, $('.engine-catalog-write-status'));
		this.catalogWriteStatus.setAttribute('role', 'status');
		this.catalogWriteStatus.setAttribute('aria-live', 'polite');
		this.catalogWriteStatus.style.display = 'none';

		this.listContainer = DOM.append(this.definitionsPanel, $('.engine-catalog-list'));

		this.runtimePanelHost = DOM.append(this.container, $('.engine-mcp-runtime-host'));
		this.runtimePanel = this._register(instantiationService.createInstance(EngineMcpRuntimePanel, this.runtimePanelHost));

		this._register(this.connection.onDidChangeConnection(() => {
			if (this.isDisposed || this._store.isDisposed) {
				return;
			}
			void this.refresh().catch(onUnexpectedError);
			this.runtimePanel.render();
		}));

		if (this.sessionContext?.onDidChangeActiveSession) {
			this._register(this.sessionContext.onDidChangeActiveSession(() => {
				if (this.isDisposed || this._store.isDisposed) {
					return;
				}
				void this.refresh().catch(onUnexpectedError);
			}));
		}
		if (this.sessionContext?.onDidChangeActiveWorkRoot) {
			this._register(this.sessionContext.onDidChangeActiveWorkRoot(() => {
				if (this.isDisposed || this._store.isDisposed) {
					return;
				}
				void this.refresh().catch(onUnexpectedError);
			}));
		}

		const resizeObserver = this._register(new DOM.DisposableResizeObserver(
			'EngineMcpSection.viewport', () => this.layoutPanels(), DOM.getWindow(this.container),
		));
		this._register(resizeObserver.observe(this.container));

		this.setActiveTab('definitions');
		void this.refresh().catch(onUnexpectedError);
	}

	private setActiveTab(tab: EngineMcpTab): void {
		if (this.isDisposed || this._store.isDisposed) {
			return;
		}
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
		if (this.isDisposed || this._store.isDisposed) {
			return;
		}
		this.lastLayout = { width, listHeight };
		this.layoutPanels();
	}

	private layoutPanels(): void {
		if (!this.lastLayout) {
			return;
		}
		const width = DOM.getContentWidth(this.container) || this.lastLayout.width;
		const style = DOM.getComputedStyle(this.container);
		let chrome = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
		for (const child of this.container.children) {
			if (child !== this.definitionsPanel && child !== this.runtimePanelHost && DOM.isHTMLElement(child) && DOM.getComputedStyle(child).display !== 'none') {
				chrome += DOM.getTotalHeight(child);
			}
		}
		const available = Math.max(80, this.lastLayout.listHeight - chrome);
		if (this.list) {
			const definitionChrome = Math.max(0, DOM.getTotalHeight(this.definitionsPanel) - DOM.getTotalHeight(this.listContainer));
			const budget = Math.max(80, available - definitionChrome);
			const height = Math.min(Math.max(80, this.listEntries.length * 24), budget);
			this.listContainer.style.height = `${height}px`;
			this.list.layout(height, width);
		}
		this.runtimePanel.layout(width, available);
	}

	override dispose(): void {
		this._isDisposed = true;
		this._removeServerGeneration++;
		this.refreshGate.invalidate();
		this.clearCatalogPresentation();
		DOM.clearNode(this.container);
		this.container.remove();
		super.dispose();
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	setSectionActive(active: boolean): void {
		if (this.isDisposed || this._store.isDisposed) {
			return;
		}
		this.sectionActive = active;
		this.updateContainerVisibility();
	}

	setShowSectionHeading(show: boolean): void {
		if (this.isDisposed || this._store.isDisposed) {
			return;
		}
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

	private captureWriteLink(): UniverseAgentPublishedLinkOwner | undefined {
		if (this.isDisposed || this._store.isDisposed || !this.canWrite()) {
			return undefined;
		}
		return captureEnginePublishedLinkOwner(this.connection);
	}

	private captureWriteIntent(server?: UniverseAgentMcpServerSummary): McpWriteIntent | undefined {
		const owner = this.captureWriteLink();
		const workDir = sessionWorkDir(this.sessionContext);
		const scope = server?.origin === 'project' ? 'project' : 'global';
		if (!owner || (scope === 'project' && !workDir)) {
			if (owner) { this.showLinkNotice(engineWriteNotSentCopy()); }
			return undefined;
		}
		return { owner, workDir, scope, server: server ? { ...server, args: server.args ? [...server.args] : undefined, env: server.env ? { ...server.env } : undefined } : undefined };
	}

	private rejectIntent(intent: McpWriteIntent, sent: boolean, checkTarget = true): boolean {
		if (this.rejectWrite(intent.owner, sent, checkTarget && intent.server ? { targetId: intent.server.id, currentTargetId: this.selectedServer?.id } : undefined)) { return true; }
		if (checkTarget && intent.server && this.selectedServer?.origin !== intent.server.origin) {
			this.showLinkNotice(sent ? engineWriteSelectionUnconfirmedCopy() : engineWriteSelectionNotSentCopy());
			return true;
		}
		if (intent.workDir !== sessionWorkDir(this.sessionContext)) {
			this.showLinkNotice(sent ? engineWriteUnconfirmedCopy() : engineWriteNotSentCopy());
			return true;
		}
		return false;
	}

	/** @returns true when the caller must stop. A disposed view stays silent. */
	private rejectWrite(link: UniverseAgentPublishedLinkOwner, sent: boolean, target?: { readonly targetId: string; readonly currentTargetId: string | undefined }, generation?: number): boolean {
		const result = evaluateEnginePublishedWrite(this._store, this.connection, {
			link,
			sent,
			targetId: target?.targetId,
			currentTargetId: target?.currentTargetId,
			generation,
			currentGeneration: generation === undefined ? undefined : this._removeServerGeneration,
		});
		if (result.kind === 'rejected') {
			this.showLinkNotice(result.message);
		}
		return result.kind !== 'current';
	}

	private syncAddButton(): void {
		if (this.isDisposed || this._store.isDisposed) {
			return;
		}
		this.addButton.enabled = this.canWrite() && !this.addInFlight;
	}

	/** After a follow-up list, catalog mode is not a link change. Disconnect and pairing-hold still drop the result. */
	private sameSettledWriteLink(link: UniverseAgentPublishedLinkOwner): boolean {
		if (this.isDisposed || this._store.isDisposed || !this.connection.isEngineConnected() || isConversationPairingHold(this.connection)) {
			return false;
		}
		const snapshot = this.connection.getConnectionSnapshot();
		return readPublishedEngineIdentityId(snapshot) === link.engineIdentityId
			&& readPublishedLinkId(snapshot) === link.linkId;
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
		this.syncMcpSelectionActions();
	}

	private syncMcpSelectionActions(): void {
		const selected = this.selectedServer !== undefined;
		const reason = localize('ua.engineMcpSelectServer', "Select a server first.");
		this.presentMcpSelection(this.updateButton, selected, reason);
		this.presentMcpSelection(this.removeButton, selected, reason);
	}

	private presentMcpSelection(button: Button, enabled: boolean, disabledReason: string): void {
		const label = button.element.dataset.mcpLabel ?? '';
		button.enabled = enabled;
		button.setTitle(enabled ? label : disabledReason);
		button.setAriaLabel(enabled ? label : (label ? `${label}. ${disabledReason}` : disabledReason));
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
		if (this.isDisposed || this._store.isDisposed) {
			return;
		}
		const entry = this.listEntries.find(item => item.kind === 'server' && item.server.id === id);
		if (entry?.kind === 'server') {
			await this.toggleServer(entry.server, enabled);
		}
	}

	private async promptAddServer(): Promise<void> {
		if (this.isDisposed || this._store.isDisposed) {
			return;
		}
		if (this.addInFlight || !this.canWrite()) {
			return;
		}
		const intent = this.captureWriteIntent();
		if (!intent) {
			return;
		}
		this.linkNotice = undefined;
		const result = await this.dialogService.input({
			type: 'question',
			message: localize('ua.engineMcpAddTitle', "Add MCP server"),
			detail: ENGINE_MCP_DIALOG_DETAIL,
			primaryButton: localize('ua.engineMcpAdd', "Add"),
			inputs: mcpDialogInputs(),
			validate: mcpDialogError,
		});
		if (this.isDisposed || this._store.isDisposed) {
			return;
		}
		if (!result.confirmed || !result.values) {
			return;
		}
		if (this.rejectIntent(intent, false)) {
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
		await this.addServer(config, intent);
	}

	private async promptUpdateSelectedServer(): Promise<void> {
		if (this.isDisposed || this._store.isDisposed) {
			return;
		}
		const selected = this.selectedServer;
		if (!this.canWrite() || !selected) {
			return;
		}
		const intent = this.captureWriteIntent(selected);
		if (!intent) {
			return;
		}
		this.linkNotice = undefined;
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
		if (this.isDisposed || this._store.isDisposed) {
			return;
		}
		if (!result.confirmed || !result.values) {
			return;
		}
		if (this.rejectIntent(intent, false)) {
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
		const partial: { -readonly [K in keyof UniverseAgentMcpServerConfig]?: UniverseAgentMcpServerConfig[K] } = {};
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
		await this.updateSelectedServer(partial, intent);
	}

	async addServer(config?: UniverseAgentMcpServerConfig, confirmedIntent?: McpWriteIntent): Promise<boolean> {
		if (this.isDisposed || this._store.isDisposed) {
			return false;
		}
		if (this.addInFlight || !isCompleteMcpAddConfig(config)) {
			return false;
		}
		const intent = confirmedIntent ?? this.captureWriteIntent();
		if (!intent || this.rejectIntent(intent, false)) {
			return false;
		}
		const link = intent.owner;
		this.linkNotice = undefined;
		this.writeFailedReason = undefined;
		this.hideCatalogWriteStatus();
		const scope = intent.scope;
		this.addInFlight = true;
		this.syncAddButton();
		try {
			const workDir = intent.workDir;
			const result = await this.connection.addMcpServer(workDir ? { config, scope, workDir } : { config, scope }, link);
			if (this.isDisposed || this._store.isDisposed || this.rejectIntent(intent, true)) {
				return false;
			}
			if (!result.ok) {
				this.showWriteFailed(result.reason);
				return false;
			}
			this.showCatalogWriteStatus(ENGINE_MCP_ADD_SUCCESS_COPY);
			const listed = await this.refresh();
			if (this.isDisposed || this._store.isDisposed || this.rejectIntent(intent, true) || !this.sameSettledWriteLink(link)) {
				return false;
			}
			if (listed && (this.mode === 'ready' || this.mode === 'empty')) {
				this.showCatalogWriteStatus(ENGINE_MCP_ADD_SUCCESS_COPY);
			}
			return true;
		} catch (error) {
			if (this.isDisposed || this._store.isDisposed) {
				return false;
			}
			if (!this.rejectIntent(intent, true, false)) {
				if (isCancellationError(error)) { this.showLinkNotice(engineWriteUnconfirmedCopy()); } else { this.showWriteFailed(error); }
			}
			return false;
		} finally {
			this.addInFlight = false;
			this.syncAddButton();
		}
	}

	async updateSelectedServer(config?: Partial<UniverseAgentMcpServerConfig>, confirmedIntent?: McpWriteIntent): Promise<boolean> {
		if (this.isDisposed || this._store.isDisposed) {
			return false;
		}
		if (!this.selectedServer || (!confirmedIntent && !this.canWrite())) {
			return false;
		}
		const intent = confirmedIntent ?? this.captureWriteIntent(this.selectedServer);
		if (!intent || this.rejectIntent(intent, false)) {
			return false;
		}
		const link = intent.owner;
		const selected = intent.server;
		if (!selected) { return false; }
		this.linkNotice = undefined;
		this.writeFailedReason = undefined;
		this.hideCatalogWriteStatus();
		const scope = intent.scope;
		const merged: UniverseAgentMcpServerConfig = {
			id: selected.id,
			name: config?.name ?? selected.name,
			transport: config?.transport ?? selected.transport,
			command: config?.command ?? selected.command,
			args: config?.args ?? selected.args,
			env: config?.env ?? selected.env,
			url: config?.url ?? selected.url,
			enabled: config?.enabled ?? selected.enabled,
		};
		try {
			const workDir = intent.workDir;
			const result = await this.connection.updateMcpServer(workDir ? {
				serverId: selected.id,
				config: merged,
				scope,
				workDir,
			} : {
				serverId: selected.id,
				config: merged,
				scope,
			}, link);
			if (this.isDisposed || this._store.isDisposed || this.rejectIntent(intent, true)) {
				return false;
			}
			if (!result.ok) {
				this.showWriteFailed(result.reason);
				return false;
			}
			this.showCatalogWriteStatus(ENGINE_MCP_UPDATE_SUCCESS_COPY);
			const listed = await this.refresh();
			if (this.isDisposed || this._store.isDisposed || this.rejectIntent(intent, true) || !this.sameSettledWriteLink(link)) {
				return false;
			}
			if (listed && (this.mode === 'ready' || this.mode === 'empty')) {
				this.showCatalogWriteStatus(ENGINE_MCP_UPDATE_SUCCESS_COPY);
			}
			return true;
		} catch (error) {
			if (this.isDisposed || this._store.isDisposed) {
				return false;
			}
			if (!this.rejectIntent(intent, true)) {
				if (isCancellationError(error)) { this.showLinkNotice(engineWriteUnconfirmedCopy()); } else { this.showWriteFailed(error); }
			}
			return false;
		}
	}

	private async confirmAndRemoveSelectedServer(): Promise<void> {
		if (this.isDisposed || this._store.isDisposed) {
			return;
		}
		const selected = this.selectedServer;
		if (!this.canWrite() || !selected) {
			return;
		}
		const intent = this.captureWriteIntent(selected);
		if (!intent) {
			return;
		}
		this.linkNotice = undefined;
		const name = selected.name || selected.id;
		const confirmed = await showEngineConfirmPopover({
			contextViewService: this.contextViewService,
			anchor: this.removeButton.element,
			message: localize('ua.engineMcpRemoveConfirm', "Remove MCP server \"{0}\"?", name),
			detail: localize('ua.engineMcpRemoveDetail', "This removes the server definition from the engine."),
			confirmLabel: localize('ua.engineMcpRemove', "Remove"),
		});
		if (this.isDisposed || this._store.isDisposed) {
			return;
		}
		if (!confirmed) {
			return;
		}
		if (this.rejectIntent(intent, false)) {
			return;
		}
		await this.removeSelectedServer(intent);
	}

	async removeSelectedServer(confirmedIntent?: McpWriteIntent): Promise<boolean> {
		if (this.isDisposed || this._store.isDisposed) {
			return false;
		}
		if (!this.selectedServer || (!confirmedIntent && !this.canWrite())) {
			return false;
		}
		const intent = confirmedIntent ?? this.captureWriteIntent(this.selectedServer);
		if (!intent || this.rejectIntent(intent, false)) {
			return false;
		}
		const link = intent.owner;
		const selected = intent.server;
		if (!selected) { return false; }
		this.linkNotice = undefined;
		this.writeFailedReason = undefined;
		this.hideCatalogWriteStatus();
		const generation = ++this._removeServerGeneration;
		const serverId = selected.id;
		const scope = intent.scope;
		let cleared = false;
		try {
			const workDir = intent.workDir;
			const result = await this.connection.removeMcpServer(workDir ? {
				serverId,
				scope,
				workDir,
			} : {
				serverId,
				scope,
			}, link);
			if (this.isDisposed || this._store.isDisposed || this.rejectIntent(intent, true) || this.rejectWrite(link, true, { targetId: serverId, currentTargetId: this.selectedServer?.id }, generation)) {
				return false;
			}
			if (!result.ok) {
				this.showWriteFailed(result.reason);
				return false;
			}
			this.selectedServer = undefined;
			this.list?.setSelection([]);
			this.syncMcpSelectionActions();
			cleared = true;
			this.showCatalogWriteStatus(ENGINE_MCP_REMOVE_SUCCESS_COPY);
			const listed = await this.refresh();
			if (this.isDisposed || this._store.isDisposed || this.rejectIntent(intent, true, false) || this.rejectWrite(link, true, undefined, generation) || !this.sameSettledWriteLink(link)) {
				return false;
			}
			if (listed && (this.mode === 'ready' || this.mode === 'empty')) {
				this.showCatalogWriteStatus(ENGINE_MCP_REMOVE_SUCCESS_COPY);
			}
			return true;
		} catch (error) {
			if (this.isDisposed || this._store.isDisposed) {
				return false;
			}
			if (!this.rejectIntent(intent, true, !cleared) && !this.rejectWrite(link, true, cleared ? undefined : { targetId: serverId, currentTargetId: this.selectedServer?.id }, generation)) {
				if (isCancellationError(error)) { this.showLinkNotice(engineWriteUnconfirmedCopy()); } else { this.showWriteFailed(error); }
			}
			return false;
		}
	}

	private hideCatalogWriteStatus(): void {
		this.catalogWriteStatus.style.display = 'none';
		writeStatus(this.catalogWriteStatus, '');
	}

	private showLinkNotice(message: string): void {
		this.linkNotice = message;
		paintEngineLinkNotice(this.isDisposed || this._store.isDisposed, this.catalogWriteStatus, this.linkNotice);
	}

	private showCatalogWriteStatus(message: string): void {
		this.linkNotice = undefined;
		this.catalogWriteStatus.style.display = '';
		writeStatus(this.catalogWriteStatus, message, 'success');
	}

	private showMcpDialogError(message: string): void {
		this.linkNotice = undefined;
		this.catalogWriteStatus.style.display = '';
		writeStatus(this.catalogWriteStatus, message, 'error');
	}

	private showWriteFailed(error: unknown): void {
		this.linkNotice = undefined;
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
			onRetry: () => void this.refresh().catch(onUnexpectedError),
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
						(server, enabled) => {
							if (this.isDisposed || this._store.isDisposed) {
								return;
							}
							void this.toggleServer(server, enabled).catch(onUnexpectedError);
						},
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
				if (this.isDisposed || this._store.isDisposed) {
					return;
				}
				const entry = e.elements[0];
				this.setSelectedServer(entry?.kind === 'server' ? entry.server : undefined);
			}));
		}
		return this.list;
	}

	private relayoutLeftoverList(): void {
		this.layoutPanels();
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
		return this.controller.applyDisconnectedRefresh(hadLiveCatalog, () => {
			this.hideCatalogWriteStatus();
			this.writeToolbar.style.display = 'none';
			this.listContainer.style.display = '';
			this.mode = resolveEngineCatalogPaneMode(false, support);
			this.renderStatus();
			this.closeLeftoverRowToggleChrome();
		}, () => {
			this.clearCatalogPresentation();
			this.mode = resolveEngineCatalogPaneMode(false, support);
			this.renderStatus();
		});
	}

	private async refresh(): Promise<boolean> {
		if (this.isDisposed || this._store.isDisposed) {
			return false;
		}
		try {
			return await this.refreshListed();
		} finally {
			paintEngineLinkNotice(this.isDisposed || this._store.isDisposed, this.catalogWriteStatus, this.linkNotice);
			this.syncAddButton();
		}
	}

	private async refreshListed(): Promise<boolean> {
		const generation = this.refreshGate.begin();
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
			if (this.isDisposed || this._store.isDisposed || !this.refreshGate.isCurrent(generation)) {
				return false;
			}
			const leftoverAfterList = this.listEntries.some(entry => entry.kind === 'server');
			if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
				return this.applyDisconnectedRefresh(support, leftoverAfterList);
			}
			this.mode = resolveEngineCatalogPaneMode(true, support, {
				kind: 'success',
				itemCount: result.servers.length,
			});
			this.setServers(result.servers);
			this.listContainer.style.display = canShowCatalogRows(this.mode) ? '' : 'none';
			this.writeToolbar.style.display = this.canWrite() ? '' : 'none';
			this.renderStatus();
			return true;
		} catch (error) {
			if (this.isDisposed || this._store.isDisposed || !this.refreshGate.isCurrent(generation)) {
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
				onRetry: () => void this.refresh().catch(onUnexpectedError),
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
				onRetry: () => void this.refresh().catch(onUnexpectedError),
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
				? () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID).catch(onUnexpectedError)
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
		this.layoutPanels();
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
		if (this.isDisposed || this._store.isDisposed) {
			return;
		}
		if (!this.canWrite()) {
			return;
		}
		const intent = this.captureWriteIntent(server);
		if (!intent) {
			return;
		}
		this.linkNotice = undefined;
		const link = intent.owner;
		const scope = intent.scope;
		try {
			const workDir = intent.workDir;
			const result = await this.connection.toggleMcpServer(workDir ? {
				id: server.id,
				enabled,
				scope,
				workDir,
			} : {
				id: server.id,
				enabled,
				scope,
			}, link);
			if (this.isDisposed || this._store.isDisposed || this.rejectIntent(intent, true, false)) {
				return;
			}
			if (!result.ok) {
				await this.refresh();
				if (this.isDisposed || this._store.isDisposed || !this.rejectIntent(intent, true, false)) {
					this.showWriteFailed(result.reason);
				}
				return;
			}
			this.showCatalogWriteStatus(ENGINE_MCP_TOGGLE_SUCCESS_COPY);
			const listed = await this.refresh();
			if (this.isDisposed || this._store.isDisposed || this.rejectIntent(intent, true, false)) {
				return;
			}
			if (listed && (this.mode === 'ready' || this.mode === 'empty')) {
				this.showCatalogWriteStatus(ENGINE_MCP_TOGGLE_SUCCESS_COPY);
			}
		} catch (error) {
			if (this.isDisposed || this._store.isDisposed || this.rejectIntent(intent, true, false)) {
				return;
			}
			await this.refresh();
			if (this.isDisposed || this._store.isDisposed || !this.rejectIntent(intent, true, false)) {
				if (isCancellationError(error)) { this.showLinkNotice(engineWriteUnconfirmedCopy()); } else { this.showWriteFailed(error); }
			}
		}
	}
}
