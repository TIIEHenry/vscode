/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getAgentProfileContentIssue } from '../../../../platform/universeAgent/common/universeAgentAgentProfileContent.js';
import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { Toggle } from '../../../../base/browser/ui/toggle/toggle.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { captureEnginePublishedLinkOwner, engineWriteUnconfirmedCopy } from './engineWriteGate.js';
import { normalizeAgentWorkDirKey } from '../../../services/agentSession/common/agentWorkRoot.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { ensureCapabilitySnapshot, readPublishedEngineIdentityId, readPublishedLinkId } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import type { UniverseAgentAgentProfileSummary, UniverseAgentCapabilitySupport, UniverseAgentToolInfoResult, UniverseAgentToolSummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultButtonStyles, defaultSelectBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { isConversationPairingHold, keepLeftoverCatalogForPairingHold } from './conversationSessionStatus.js';
import {
	type EngineCatalogPaneMode,
	canPerformCatalogWriteLive,
	canShowCatalogRows,
	resolveEngineCatalogPaneMode,
} from './engineCatalog.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { appendCatalogScopeNote, getEngineSectionApiUnavailableCopy, getEngineSectionDisconnectedCopy } from './engineSectionChrome.js';
import {
	applyToolEnablementChanges,
	groupToolsForCatalog,
	isToolEnabledInProfile,
	summaryToProfileDetail,
	toolEnablementPendingKey,
	type EngineToolCatalogGroup,
} from './engineToolProfile.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';
import { writeStatus } from './connectionPreferencesPane.js';

const $ = DOM.$;

const TOOLS_FEATURE = localize('ua.engineToolsFeatureLabel', "engine tools");
const TOOL_DETAIL_FEATURE = localize('ua.engineToolsInfoFeatureLabel', "tool details");

function toolsWriteRejectedReason(): string {
	return localize('ua.engineToolsWriteRejected', "The engine rejected the tool enablement write.");
}

function toolsWriteFailureReason(error: unknown): string {
	if (typeof error === 'string' && error) {
		return error;
	}
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return toolsWriteRejectedReason();
}

function toolsSaveFailedMessage(error: unknown): string {
	return localize('ua.engineToolsSaveFailed', "Unable to save: {0}", toolsWriteFailureReason(error));
}

type EngineToolListEntry =
	| { readonly kind: 'group'; readonly group: EngineToolCatalogGroup; readonly label: string; readonly count?: number }
	| { readonly kind: 'tool'; readonly tool: UniverseAgentToolSummary };

const TOOL_ROW_HEIGHT = 44;

interface IToolWriteOperation {
	readonly key: string;
	readonly engineIdentityId: string | undefined;
	readonly scope: string;
	invalidated: boolean;
	readonly profileId: string;
	readonly submitted: ReadonlyMap<string, boolean>;
}

const TOOL_CATEGORY_ACRONYMS = new Set([
	'AI', 'API', 'CLI', 'CPU', 'CSS', 'DB', 'GPU', 'HTML', 'HTTP', 'HTTPS',
	'ID', 'IO', 'JSON', 'LLM', 'MCP', 'OS', 'SQL', 'SSH', 'UI', 'URL', 'YAML',
]);

/** Engine categories arrive as all-caps tokens such as SYSTEM or DATA_PROCESSING. */
function formatToolCategory(category: string): string {
	return category
		.split(/[_\s]+/)
		.filter(Boolean)
		.map(word => {
			const upper = word.toUpperCase();
			if (TOOL_CATEGORY_ACRONYMS.has(upper)) {
				return upper;
			}
			if (word !== upper && word !== word.toLowerCase()) {
				return word;
			}
			return upper.charAt(0) + upper.slice(1).toLowerCase();
		})
		.join(' ');
}

/** Category and description share the second line. Blank parts are not a line. */
function toolSubtitle(tool: UniverseAgentToolSummary): string {
	const parts: string[] = [];
	const category = tool.category?.trim();
	const description = tool.description?.trim();
	if (category) {
		parts.push(formatToolCategory(category));
	}
	if (description) {
		parts.push(description);
	}
	return parts.join(' — ');
}

function toolEntryHeight(entry: EngineToolListEntry): number {
	return entry.kind === 'group' ? 28 : toolSubtitle(entry.tool) ? TOOL_ROW_HEIGHT : 32;
}

class EngineToolListDelegate implements IListVirtualDelegate<EngineToolListEntry> {
	getHeight(entry: EngineToolListEntry): number {
		return toolEntryHeight(entry);
	}

	getTemplateId(entry: EngineToolListEntry): string {
		return entry.kind === 'group' ? 'toolGroup' : 'toolRow';
	}
}

interface IToolGroupTemplateData {
	readonly label: HTMLElement;
	readonly count: HTMLElement;
}

class EngineToolGroupRenderer implements IListRenderer<EngineToolListEntry, IToolGroupTemplateData> {
	static readonly TEMPLATE_ID = 'toolGroup';
	readonly templateId = EngineToolGroupRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IToolGroupTemplateData {
		container.classList.add('engine-catalog-group');
		const label = DOM.append(container, $('.engine-catalog-group-label'));
		const count = DOM.append(container, $('.engine-catalog-group-count'));
		return { label, count };
	}

	renderElement(entry: EngineToolListEntry, _index: number, templateData: IToolGroupTemplateData): void {
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

interface IToolRowTemplateData {
	readonly row: HTMLElement;
	readonly checkbox: Toggle;
	readonly name: HTMLElement;
	readonly description: HTMLElement;
	tool: UniverseAgentToolSummary | undefined;
	readonly checkboxDisposable: { dispose(): void };
}

class EngineToolRowRenderer implements IListRenderer<EngineToolListEntry, IToolRowTemplateData> {
	static readonly TEMPLATE_ID = 'toolRow';
	readonly templateId = EngineToolRowRenderer.TEMPLATE_ID;
	private readonly templates = new Set<IToolRowTemplateData>();

	constructor(
		private readonly canToggle: () => boolean,
		private readonly isEnabled: (toolName: string) => boolean,
		private readonly onToggle: (tool: UniverseAgentToolSummary, enabled: boolean) => void,
	) { }

	renderTemplate(container: HTMLElement): IToolRowTemplateData {
		const row = DOM.append(container, $('.engine-catalog-row.tool-item'));
		const checkbox = new Toggle({
			title: '',
			isChecked: false,
			inputActiveOptionBackground: 'var(--ua-tool-switch-track)',
			inputActiveOptionForeground: 'var(--vscode-inputOption-activeForeground)',
			inputActiveOptionBorder: 'transparent',
		});
		checkbox.domNode.setAttribute('role', 'switch');
		const checkboxDisposable = checkbox.onChange(() => {
			const tool = (row as unknown as { __tool?: UniverseAgentToolSummary }).__tool;
			if (tool && this.canToggle()) {
				this.onToggle(tool, checkbox.checked);
			} else if (tool) {
				checkbox.checked = this.isEnabled(tool.name);
			}
		});
		const text = DOM.append(row, $('.engine-catalog-text'));
		row.appendChild(checkbox.domNode);
		const templateData: IToolRowTemplateData = {
			row,
			checkbox,
			name: DOM.append(text, $('.engine-catalog-name')),
			description: DOM.append(text, $('.engine-catalog-description')),
			tool: undefined,
			checkboxDisposable: { dispose: () => checkboxDisposable.dispose() },
		};
		this.templates.add(templateData);
		return templateData;
	}

	renderElement(entry: EngineToolListEntry, _index: number, templateData: IToolRowTemplateData): void {
		if (entry.kind !== 'tool') {
			return;
		}
		templateData.tool = entry.tool;
		(templateData.row as unknown as { __tool?: UniverseAgentToolSummary }).__tool = entry.tool;
		templateData.name.textContent = entry.tool.name;
		templateData.name.title = entry.tool.name;
		const subtitle = toolSubtitle(entry.tool);
		templateData.description.textContent = subtitle;
		templateData.description.title = subtitle;
		templateData.description.style.display = subtitle ? '' : 'none';
		templateData.checkbox.setTitle(localize('ua.engineToolsRowToggle', "Enable {0}", entry.tool.name));
		templateData.checkbox.domNode.dataset.toolName = entry.tool.name;
		templateData.checkbox.checked = this.isEnabled(entry.tool.name);
		this.updateTemplateChrome(templateData);
	}

	updateToggleChrome(): void {
		for (const template of this.templates) {
			if (template.tool) {
				template.checkbox.checked = this.isEnabled(template.tool.name);
			}
			this.updateTemplateChrome(template);
		}
	}

	updateTool(toolName: string): void {
		for (const template of this.templates) {
			if (template.tool?.name === toolName) {
				template.checkbox.checked = this.isEnabled(toolName);
				this.updateTemplateChrome(template);
			}
		}
	}

	private updateTemplateChrome(templateData: IToolRowTemplateData): void {
		templateData.checkbox.enable();
		if (!this.canToggle()) {
			templateData.checkbox.disable();
		}
	}

	disposeTemplate(templateData: IToolRowTemplateData): void {
		this.templates.delete(templateData);
		templateData.checkboxDisposable.dispose();
		templateData.checkbox.dispose();
	}

	focusTool(name: string): void {
		for (const template of this.templates) {
			if (template.tool?.name === name && template.checkbox.domNode.isConnected) {
				template.checkbox.focus();
				return;
			}
		}
	}
}

class EngineToolListAccessibilityProvider implements IListAccessibilityProvider<EngineToolListEntry> {
	getWidgetAriaLabel(): string {
		return localize('ua.engineToolsList', "Engine tools");
	}

	getAriaLabel(entry: EngineToolListEntry): string {
		return entry.kind === 'group' ? entry.label : entry.tool.name;
	}
}

export class EngineToolsSection extends Disposable {
	private _toolsCount = 0;
	private readonly _onDidChangeItemCount = this._register(new Emitter<void>());
	readonly onDidChangeItemCount: Event<void> = this._onDidChangeItemCount.event;

	getItemCount(): number | undefined { return this._toolsCount > 0 ? this._toolsCount : undefined; }

	private setToolsCount(count: number): void {
		if (this._toolsCount === count) {
			return;
		}
		this._toolsCount = count;
		this._onDidChangeItemCount.fire();
	}

	private readonly container: HTMLElement;
	private readonly heading: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly profileSelectHost: HTMLElement;
	private readonly profileSelect: SelectBox;
	private readonly writeToolbar: HTMLElement;
	private readonly saveButton: Button;
	private readonly catalogWriteStatus: HTMLElement;
	private readonly listContainer: HTMLElement;
	private readonly infoHost: HTMLElement;
	private infoTitle: HTMLElement | undefined;
	private infoStatus: HTMLElement | undefined;
	private readonly instantiationService: IInstantiationService;
	private list: WorkbenchList<EngineToolListEntry> | undefined;
	private rowRenderer: EngineToolRowRenderer | undefined;
	private lastLayout: { readonly width: number; readonly listHeight: number } | undefined;

	private mode: EngineCatalogPaneMode = 'disconnected';
	private listEntries: EngineToolListEntry[] = [];
	private profiles: UniverseAgentAgentProfileSummary[] = [];
	private activeProfile: UniverseAgentAgentProfileSummary | undefined;
	private profileSelectionMissing = false;
	private profileSelectOffset = 0;
	private readonly pendingEnablement = new Map<string, boolean>();
	private catalogScope: string | undefined;
	private readonly writeOperations = new Map<string, IToolWriteOperation>();
	private repaintingRows = false;
	private sectionActive = false;
	private selectedToolName: string | undefined;
	private refreshGeneration = 0;
	private infoLoadGeneration = 0;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IInstantiationService instantiationService: IInstantiationService,
		@ICommandService private readonly commandService: ICommandService,
		@IContextViewService contextViewService: IContextViewService,
		@IAgentSessionContext private readonly sessionContext: IAgentSessionContext,
	) {
		super();
		this.instantiationService = instantiationService;

		this.container = DOM.append(parent, $('.engine-tools-section.engine-catalog-section'));
		this.container.style.display = 'none';

		this.heading = DOM.append(this.container, $('h3.engine-section-heading'));
		this.heading.textContent = localize('ua.engineToolsSectionTitle', "Tools");
		this.heading.style.display = 'none';
		appendCatalogScopeNote(this.container, localize('ua.engineToolsScope', "Choose tools for this agent profile. Save to apply changes; the open session is unchanged."));

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		const profileCard = DOM.append(this.container, $('.engine-tools-profile-card'));
		const profileRow = DOM.append(profileCard, $('.engine-tools-profile-row'));
		const profileLabel = localize('ua.engineToolsProfileLabel', "Agent profile");
		DOM.append(profileRow, $('label')).textContent = profileLabel;
		this.profileSelectHost = DOM.append(profileRow, $('.engine-tools-profile-select'));
		this.profileSelectHost.style.display = 'none';
		this.profileSelect = this._register(new SelectBox([], 0, contextViewService, defaultSelectBoxStyles, {
			ariaLabel: profileLabel,
			useCustomDrawn: true,
		}));
		this.profileSelect.render(this.profileSelectHost);
		this._register(this.profileSelect.onDidSelect(event => {
			if (this._store.isDisposed) {
				return;
			}
			this.activeProfile = this.profiles[event.index - this.profileSelectOffset];
			this.profileSelectionMissing = !this.activeProfile;
			this.updateSaveChrome();
			this.repaintRows();
		}));

		this.writeToolbar = DOM.append(profileCard, $('.engine-catalog-write-toolbar'));
		this.writeToolbar.style.display = 'none';
		this.saveButton = this._register(new Button(this.writeToolbar, { ...defaultButtonStyles, secondary: true }));
		this.saveButton.label = localize('ua.engineToolsSave', "Save");
		this._register(this.saveButton.onDidClick(() => {
			if (this._store.isDisposed) {
				return;
			}
			void this.savePendingEnablement().catch(onUnexpectedError);
		}));
		this.catalogWriteStatus = DOM.append(this.container, $('.engine-catalog-write-status'));
		this.catalogWriteStatus.setAttribute('role', 'status');
		this.catalogWriteStatus.setAttribute('aria-live', 'polite');
		this.catalogWriteStatus.style.display = 'none';

		this.listContainer = DOM.append(this.container, $('.engine-catalog-list'));
		this.infoHost = DOM.append(this.container, $('.engine-tools-info'));
		this.infoHost.style.display = 'none';
		this.infoHost.setAttribute('role', 'status');
		this.infoHost.setAttribute('aria-live', 'polite');
		this.infoHost.setAttribute('aria-label', localize('ua.engineToolsInfoRegion', "Tool details"));
		const resizeObserver = this._register(new DOM.DisposableResizeObserver(
			'EngineToolsSection.list', () => this.layoutList(), DOM.getWindow(this.container),
		));
		this._register(resizeObserver.observe(this.listContainer));

		this._register(this.connection.onDidChangeConnection(() => {
			if (this._store.isDisposed) {
				return;
			}
			void this.refresh().catch(onUnexpectedError);
		}));

		if (this.sessionContext?.onDidChangeActiveSession) {
			this._register(this.sessionContext.onDidChangeActiveSession(() => {
				if (this._store.isDisposed) {
					return;
				}
				void this.refresh().catch(onUnexpectedError);
			}));
		}
		if (this.sessionContext?.onDidChangeActiveWorkRoot) {
			this._register(this.sessionContext.onDidChangeActiveWorkRoot(() => {
				if (this._store.isDisposed) {
					return;
				}
				void this.refresh().catch(onUnexpectedError);
			}));
		}

		void this.refresh().catch(onUnexpectedError);
	}

	layout(width: number, listHeight: number): void {
		this.lastLayout = { width, listHeight };
		this.container.classList.toggle('is-short', listHeight < 320);
		this.container.parentElement?.classList.toggle('has-short-tools', this.sectionActive && listHeight < 320);
		this.layoutList();
	}

	private layoutList(): void {
		if (!this.list || !this.lastLayout) {
			return;
		}
		const width = this.listContainer.clientWidth || this.lastLayout.width;
		const height = this.listContainer.clientHeight || Math.max(80, this.lastLayout.listHeight - 160);
		this.list.layout(height, width);
	}

	override dispose(): void {
		this.refreshGeneration++;
		this.infoLoadGeneration++;
		this.invalidateWriteResults();
		this.clearCatalogPresentation();
		DOM.clearNode(this.container);
		this.container.remove();
		super.dispose();
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	setSectionActive(active: boolean): void {
		if (this._store.isDisposed) {
			return;
		}
		this.sectionActive = active;
		this.container.parentElement?.classList.toggle('has-tools', active);
		this.container.parentElement?.classList.toggle('has-short-tools', active && (this.lastLayout?.listHeight ?? 480) < 320);
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
		return this.listEntries.filter(entry => entry.kind === 'tool').length;
	}

	canWrite(): boolean {
		return canPerformCatalogWriteLive(
			this.mode,
			this.connection.isEngineConnected(),
			isConversationPairingHold(this.connection),
		)
			&& this.catalogScope !== undefined
			&& this.catalogScope === this.currentCatalogScope()
			&& !!this.activeProfile
			&& this.activeProfile.source !== 'built_in';
	}

	isProfileSelectorVisible(): boolean {
		return this.profileSelectHost.style.display !== 'none';
	}

	getActiveProfileId(): string | undefined {
		return this.activeProfile?.id;
	}

	isToolEnablementDirty(): boolean {
		if (!this.activeProfile) {
			return false;
		}
		const prefix = `${this.activeProfile.id}\u0000`;
		for (const key of this.pendingEnablement.keys()) {
			if (key.startsWith(prefix)) {
				return true;
			}
		}
		return false;
	}

	isSaveToolbarVisible(): boolean {
		return this.writeToolbar.style.display !== 'none';
	}

	getSelectedToolName(): string | undefined {
		return this.selectedToolName;
	}

	isToolInfoVisible(): boolean {
		return this.infoHost.style.display !== 'none';
	}

	getToolInfoDetailText(): string | undefined {
		if (!this.isToolInfoVisible()) {
			return undefined;
		}
		return this.infoHost.textContent ?? undefined;
	}

	selectTool(toolName: string): boolean {
		if (this._store.isDisposed) {
			return false;
		}
		const name = toolName.trim();
		if (!name || !this.list) {
			return false;
		}
		const index = this.listEntries.findIndex(entry => entry.kind === 'tool' && entry.tool.name === name);
		if (index < 0) {
			return false;
		}
		this.list.setSelection([index]);
		return true;
	}

	async savePendingEnablement(): Promise<boolean> {
		if (this._store.isDisposed || !this.canWrite() || !this.activeProfile || this.isActiveProfileBusy()) {
			return false;
		}
		const prefix = `${this.activeProfile.id}\u0000`;
		const changes = [...this.pendingEnablement]
			.filter(([key]) => key.startsWith(prefix))
			.map(([key, enabled]) => ({ toolName: key.slice(prefix.length), enabled }));
		if (changes.length === 0) {
			return true;
		}
		return this.saveToolEnablement(changes);
	}

	async toggleTool(tool: UniverseAgentToolSummary, enabled: boolean): Promise<boolean> {
		if (this._store.isDisposed || !this.canWrite() || !this.activeProfile || this.isActiveProfileBusy()) {
			return false;
		}
		this.pendingEnablement.set(toolEnablementPendingKey(this.activeProfile.id, tool.name), enabled);
		this.repaintToolRow(tool.name);
		return this.saveToolEnablement([{ toolName: tool.name, enabled }]);
	}

	private async saveToolEnablement(changes: ReadonlyArray<{ readonly toolName: string; readonly enabled: boolean }>): Promise<boolean> {
		if (this._store.isDisposed) {
			return false;
		}
		const scope = this.currentCatalogScope();
		const activeProfile = this.activeProfile;
		const owner = captureEnginePublishedLinkOwner(this.connection);
		if (scope === undefined || !activeProfile || !owner) {
			return false;
		}
		const profile = applyToolEnablementChanges(summaryToProfileDetail(activeProfile), changes);
		const issue = getAgentProfileContentIssue(profile);
		if (issue) {
			this.showCatalogWriteFailed(issue);
			return false;
		}
		const engineIdentityId = owner.engineIdentityId;
		const operation: IToolWriteOperation = {
			key: JSON.stringify([engineIdentityId, activeProfile.id]),
			engineIdentityId,
			scope,
			invalidated: false,
			profileId: activeProfile.id,
			submitted: new Map(changes.map(change => [toolEnablementPendingKey(activeProfile.id, change.toolName), change.enabled])),
		};
		this.writeOperations.set(operation.key, operation);
		try {
			this.hideCatalogWriteStatus();
			this.updateSaveChrome();
			this.repaintRows();
			if (!this.isWriteCurrent(operation)) {
				return false;
			}
			const result = await this.connection.saveAgentProfile({ profile }, owner);
			if (this._store.isDisposed) {
				return false;
			}
			const currentProfile = this.activeProfile;
			if (!this.isWriteCurrent(operation) || !currentProfile) {
				return false;
			}
			if (result.profile.id !== operation.profileId) {
				this.showCatalogWriteFailed(toolsSaveFailedMessage(toolsWriteRejectedReason()));
				return false;
			}
			this.activeProfile = {
				...currentProfile,
				disabledTools: result.profile.disabledTools,
				enabledTools: result.profile.enabledTools,
				whitelistMode: result.profile.whitelistMode,
			};
			const index = this.profiles.findIndex(entry => entry.id === operation.profileId);
			if (index >= 0) {
				this.profiles[index] = this.activeProfile;
			}
			for (const [key, enabled] of operation.submitted) {
				if (this.pendingEnablement.get(key) === enabled) {
					this.pendingEnablement.delete(key);
				}
			}
			// The saved profile is newer than every List issued before this result.
			// Retire those Lists and their loading presentation together.
			this.refreshGeneration++;
			const support = ensureCapabilitySnapshot(this.connection.getCapabilitySnapshot()).tools.support;
			this.mode = resolveEngineCatalogPaneMode(true, support, { kind: 'success', itemCount: this.getListEntryCount() });
			this.listContainer.style.display = this.listEntries.length > 0 ? '' : 'none';
			this.hideCatalogWriteStatus();
			this.renderStatus();
			this.updateSaveChrome();
			this.repaintRows();
			return true;
		} catch (error) {
			if (this.isWriteCurrent(operation)) {
				this.showCatalogWriteFailed(isCancellationError(error) ? engineWriteUnconfirmedCopy() : toolsSaveFailedMessage(error));
			}
			return false;
		} finally {
			// A result received while another profile is selected only retires its
			// own token. It cannot paint that profile or release a successor write.
			if (this.writeOperations.get(operation.key) === operation) {
				this.writeOperations.delete(operation.key);
				if (!this._store.isDisposed) {
					// Busy chrome reflects actual reservations, independently of whether
					// the old result is authorized to update the current profile.
					this.updateSaveChrome();
				}
				if (this.isWriteContextCurrent(operation)) {
					this.repaintRows();
				}
			}
		}
	}

	private currentCatalogScope(): string | undefined {
		if (!this.connection.isEngineConnected() || isConversationPairingHold(this.connection)) {
			return undefined;
		}
		const snapshot = this.connection.getConnectionSnapshot();
		const root = this.sessionContext?.getActiveWorkRoot?.();
		return JSON.stringify([
			readPublishedEngineIdentityId(snapshot), readPublishedLinkId(snapshot),
			normalizeAgentWorkDirKey(root?.workDir), root?.source, root?.localRoot?.toString(), root?.access,
		]);
	}

	private syncCatalogScope(): void {
		const scope = this.currentCatalogScope();
		if (scope !== this.catalogScope) {
			this.catalogScope = scope;
			this.infoLoadGeneration++;
			this.invalidateWriteResults();
			this.pendingEnablement.clear();
			this.profileSelectionMissing = false;
		}
	}

	private isWriteContextCurrent(operation: IToolWriteOperation): boolean {
		return !this._store.isDisposed
			&& !operation.invalidated
			&& this.catalogScope === operation.scope
			&& this.currentCatalogScope() === operation.scope
			&& this.activeProfile?.id === operation.profileId
			&& this.profiles.some(profile => profile.id === operation.profileId);
	}

	private isWriteCurrent(operation: IToolWriteOperation): boolean {
		return this.writeOperations.get(operation.key) === operation && this.isWriteContextCurrent(operation);
	}

	private isActiveProfileBusy(): boolean {
		const engineIdentityId = readPublishedEngineIdentityId(this.connection.getConnectionSnapshot());
		return [...this.writeOperations.values()].some(operation => operation.profileId === this.activeProfile?.id
			&& (operation.engineIdentityId === undefined || engineIdentityId === undefined || operation.engineIdentityId === engineIdentityId));
	}

	private invalidateWriteResults(): void {
		for (const operation of this.writeOperations.values()) {
			operation.invalidated = true;
		}
	}

	private clearProfilePending(profileId: string): void {
		const prefix = `${profileId}\u0000`;
		for (const key of this.pendingEnablement.keys()) {
			if (key.startsWith(prefix)) {
				this.pendingEnablement.delete(key);
			}
		}
		for (const operation of this.writeOperations.values()) {
			if (operation.profileId === profileId) {
				operation.invalidated = true;
			}
		}
	}

	private rebasePendingEnablement(): void {
		const profiles = new Map(this.profiles.map(profile => [profile.id, profile]));
		for (const operation of this.writeOperations.values()) {
			if (!profiles.has(operation.profileId)) {
				this.clearProfilePending(operation.profileId);
			}
		}
		for (const [key, enabled] of this.pendingEnablement) {
			const separator = key.indexOf('\u0000');
			const profileId = key.slice(0, separator);
			const profile = profiles.get(profileId);
			const pendingWrite = [...this.writeOperations.values()].some(operation => !operation.invalidated && operation.profileId === profileId);
			if (!profile || (!pendingWrite && isToolEnabledInProfile(key.slice(separator + 1), profile) === enabled)) {
				this.pendingEnablement.delete(key);
			}
		}
	}

	private isToolEnabled(toolName: string): boolean {
		if (!this.activeProfile) {
			return true;
		}
		const pending = this.pendingEnablement.get(toolEnablementPendingKey(this.activeProfile.id, toolName));
		if (pending !== undefined) {
			return pending;
		}
		return isToolEnabledInProfile(toolName, this.activeProfile);
	}

	setPendingEnablement(tool: UniverseAgentToolSummary, enabled: boolean): void {
		if (this._store.isDisposed || !this.activeProfile || !this.canWrite()) {
			return;
		}
		this.pendingEnablement.set(toolEnablementPendingKey(this.activeProfile.id, tool.name), enabled);
		this.updateSaveChrome();
		this.repaintToolRow(tool.name);
	}

	/** Test hook: programmatically toggle a tool by name. */
	async toggleToolForTest(name: string, enabled: boolean): Promise<boolean> {
		if (this._store.isDisposed) {
			return false;
		}
		const entry = this.listEntries.find(item => item.kind === 'tool' && item.tool.name === name);
		if (entry?.kind === 'tool') {
			return this.toggleTool(entry.tool, enabled);
		}
		return false;
	}

	private hideCatalogWriteStatus(): void {
		this.catalogWriteStatus.style.display = 'none';
		writeStatus(this.catalogWriteStatus, '');
	}

	private showCatalogWriteFailed(message: string): void {
		this.catalogWriteStatus.style.display = '';
		writeStatus(this.catalogWriteStatus, message, 'error');
	}

	private updateSaveChrome(): void {
		const visible = this.canWrite();
		this.writeToolbar.style.display = visible ? '' : 'none';
		this.saveButton.enabled = visible && this.isToolEnablementDirty() && !this.isActiveProfileBusy();
		this.saveButton.element.setAttribute('aria-busy', String(this.isActiveProfileBusy()));
	}

	private ensureList(): WorkbenchList<EngineToolListEntry> {
		if (!this.list) {
			const rowRenderer = new EngineToolRowRenderer(
				() => this.canWrite(),
				toolName => this.isToolEnabled(toolName),
				(tool, enabled) => this.setPendingEnablement(tool, enabled),
			);
			this.rowRenderer = rowRenderer;
			this.list = this._register(this.instantiationService.createInstance(
				WorkbenchList,
				'EngineTools',
				this.listContainer,
				new EngineToolListDelegate(),
				[
					new EngineToolGroupRenderer(),
					rowRenderer,
				],
				{
					identityProvider: {
						getId: (entry: EngineToolListEntry) => entry.kind === 'group'
							? `group:${entry.group}`
							: `tool:${entry.tool.name}`,
					},
					accessibilityProvider: new EngineToolListAccessibilityProvider(),
				},
			)) as WorkbenchList<EngineToolListEntry>;
			this._register(this.list.onDidChangeSelection(e => {
				if (this._store.isDisposed || this.repaintingRows) {
					return;
				}
				const entry = e.elements[0];
				if (entry?.kind === 'tool') {
					this.selectedToolName = entry.tool.name;
					if (canShowCatalogRows(this.mode)) {
						void this.loadToolInfo(entry.tool.name).catch(onUnexpectedError);
					} else if ((this.mode === 'failed' || this.mode === 'loading') && this.hasLeftoverToolInfo()) {
						this.infoHost.style.display = '';
					} else if (keepLeftoverCatalogForPairingHold(this.hasLeftoverToolInfo(), this.connection)) {
						this.paintToolInfoHonesty(getEngineSectionDisconnectedCopy());
					} else {
						this.clearToolInfo();
					}
				} else {
					this.selectedToolName = undefined;
					this.clearToolInfo();
				}
			}));
			// The catalog may arrive after its parent has already laid out this section.
			this.relayoutLeftoverList();
		}
		return this.list;
	}

	private relayoutLeftoverList(): void {
		this.layoutList();
	}

	private repaintToolRow(toolName: string): void {
		this.rowRenderer?.updateTool(toolName);
	}

	/** Fixed-height Lists do not implement rerender; preserve scroll and the focused switch. */
	private repaintRows(): void {
		this.rowRenderer?.updateToggleChrome();
		if (!this.list) {
			return;
		}
		const scrollTop = this.list.scrollTop;
		const active = this.container.ownerDocument.activeElement;
		const focusedTool = DOM.isHTMLElement(active) && this.listContainer.contains(active) ? active.dataset.toolName : undefined;
		this.repaintingRows = true;
		try {
			this.list.splice(0, this.list.length, this.listEntries);
			this.list.scrollTop = scrollTop;
		} finally {
			this.repaintingRows = false;
		}
		if (focusedTool) {
			this.rowRenderer?.focusTool(focusedTool);
		}
	}

	private closeLeftoverRowToggleChrome(): void {
		// D426 / D429: leftover KEEP / UNKNOWN / list-fail must close leftover
		// row toggle chrome on refresh; do not wait for another selectTool.
		// Save hide / D415 honesty alone left leftover checkboxes looking live.
		// `list.rerender()` is a no-op unless supportDynamicHeights; splice
		// the leftover entries so renderElement can disable toggles via canWrite().
		this.relayoutLeftoverList();
		this.repaintRows();
	}

	private applyDisconnectedRefresh(support: UniverseAgentCapabilitySupport, hadLiveCatalog: boolean): void {
		if (keepLeftoverCatalogForPairingHold(hadLiveCatalog, this.connection)) {
			this.hideCatalogWriteStatus();
			this.listContainer.style.display = '';
			this.mode = resolveEngineCatalogPaneMode(false, support);
			this.updateSaveChrome();
			this.renderStatus();
			// D415: pairing-hold / leftover-looks-live KEEP must paint leftover
			// detail honesty on refresh; do not wait for another selectTool.
			if (this.hasLeftoverToolInfo()) {
				this.paintToolInfoHonesty(getEngineSectionDisconnectedCopy());
			}
			this.closeLeftoverRowToggleChrome();
			return;
		}
		this.clearCatalogPresentation();
		this.mode = resolveEngineCatalogPaneMode(false, support);
		this.renderStatus();
	}

	private listSessionTools(): ReturnType<IUniverseAgentConnection['listTools']> {
		const projectPath = this.sessionContext?.getActiveWorkRoot?.().workDir?.trim();
		if (!projectPath) {
			return this.connection.listTools();
		}
		const listTools = this.connection.listTools as (
			request?: { readonly projectPath?: string },
		) => ReturnType<IUniverseAgentConnection['listTools']>;
		return listTools.call(this.connection, { projectPath });
	}

	private listSessionAgentProfiles(): ReturnType<IUniverseAgentConnection['listAgentProfiles']> {
		const projectPath = this.sessionContext?.getActiveWorkRoot?.().workDir?.trim();
		if (!projectPath) {
			return this.connection.listAgentProfiles();
		}
		return this.connection.listAgentProfiles({ projectPath });
	}

	private async refresh(): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}
		this.syncCatalogScope();
		const scope = this.catalogScope;
		const generation = ++this.refreshGeneration;
		const capabilities = ensureCapabilitySnapshot(this.connection.getCapabilitySnapshot());
		const connected = this.connection.isEngineConnected();
		const support = capabilities.tools.support;

		const hadLiveCatalog = this.listEntries.some(entry => entry.kind === 'tool');
		// D349 leftover-looks-live: pairing-hold first. KEEP is not only `!connected`.
		if (isConversationPairingHold(this.connection) || !connected) {
			this.applyDisconnectedRefresh(support, hadLiveCatalog);
			return;
		}

		if (support === 'UNSUPPORTED') {
			this.clearCatalogPresentation();
			this.mode = resolveEngineCatalogPaneMode(true, support);
			this.renderStatus({ reason: capabilities.tools.reason });
			return;
		}

		if (support === 'UNKNOWN') {
			// Keep leftover tool rows after a live paint (D255; D253 / D250).
			const leftoverAfterUnknown = this.listEntries.some(entry => entry.kind === 'tool');
			if (!leftoverAfterUnknown) {
				this.clearCatalogPresentation();
			} else {
				this.hideCatalogWriteStatus();
			}
			this.mode = resolveEngineCatalogPaneMode(true, support);
			this.updateSaveChrome();
			this.renderStatus({ loadingKind: 'capability' });
			if (leftoverAfterUnknown) {
				this.closeLeftoverRowToggleChrome();
			}
			return;
		}

		this.mode = resolveEngineCatalogPaneMode(true, support, { kind: 'inFlight' });
		this.updateSaveChrome();
		this.renderStatus({ loadingKind: 'list' });
		this.repaintRows();

		try {
			const [toolsResult, profilesResult] = await Promise.all([
				this.listSessionTools(),
				this.listSessionAgentProfiles(),
			]);
			if (this._store.isDisposed || generation !== this.refreshGeneration || scope !== this.currentCatalogScope()) {
				return;
			}
			const leftoverAfterList = this.listEntries.some(entry => entry.kind === 'tool');
			if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
				this.applyDisconnectedRefresh(support, leftoverAfterList);
				return;
			}
			this.profiles = profilesResult.profiles.filter(profile => profile.source !== 'built_in');
			this.populateProfileSelect();
			this.rebasePendingEnablement();
			const selectedToolName = this.selectedToolName;
			this.hideCatalogWriteStatus();
			this.mode = resolveEngineCatalogPaneMode(true, support, {
				kind: 'success',
				itemCount: toolsResult.tools.length,
			});
			this.setToolsCount(toolsResult.tools.length);
			this.listContainer.style.display = canShowCatalogRows(this.mode) ? '' : 'none';
			this.updateSaveChrome();
			this.setTools(toolsResult.tools);
			this.renderStatus();
			if (selectedToolName && this.listEntries.some(entry => entry.kind === 'tool' && entry.tool.name === selectedToolName)) {
				this.selectedToolName = selectedToolName;
				// D275: keep leftover detail while the next getToolInfo is in-flight.
				void this.loadToolInfo(selectedToolName).catch(onUnexpectedError);
			}
		} catch (error) {
			if (this._store.isDisposed || generation !== this.refreshGeneration || scope !== this.currentCatalogScope()) {
				return;
			}
			const leftoverAfterList = this.listEntries.some(entry => entry.kind === 'tool');
			if (!leftoverAfterList) {
				this.clearCatalogPresentation();
			}
			this.mode = resolveEngineCatalogPaneMode(true, support, {
				kind: 'failed',
				error: error instanceof Error ? error.message : undefined,
			});
			this.updateSaveChrome();
			this.renderStatus({
				reason: error instanceof Error ? error.message : undefined,
				onRetry: () => {
					if (this._store.isDisposed) {
						return;
					}
					void this.refresh().catch(onUnexpectedError);
				},
			});
			if (leftoverAfterList) {
				this.closeLeftoverRowToggleChrome();
			}
		}
	}

	private renderStatus(options?: { reason?: string; loadingKind?: 'capability' | 'list'; onRetry?: () => void }): void {
		this.status.render({
			mode: this.mode,
			featureLabel: TOOLS_FEATURE,
			emptyCopy: localize('ua.engineToolsEmpty', "No engine tools yet."),
			reason: options?.reason,
			loadingKind: options?.loadingKind,
			onRetry: options?.onRetry,
			onOpenConnection: this.mode === 'disconnected'
				? () => {
					if (this._store.isDisposed) {
						return;
					}
					void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID).catch(onUnexpectedError);
				}
				: undefined,
		});
	}

	private populateProfileSelect(): void {
		const previousId = this.activeProfile?.id;
		if (this.profiles.length === 0) {
			this.profileSelect.setOptions([]);
			this.profileSelectHost.style.display = 'none';
			this.activeProfile = undefined;
			this.profileSelectionMissing ||= previousId !== undefined;
			this.updateSaveChrome();
			return;
		}
		this.profileSelectHost.style.display = '';
		const previousIndex = this.profiles.findIndex(profile => profile.id === previousId);
		this.profileSelectionMissing ||= previousId !== undefined && previousIndex < 0;
		this.profileSelectOffset = this.profileSelectionMissing ? 1 : 0;
		const options = this.profiles.map(profile => ({ text: profile.name || profile.id }));
		if (this.profileSelectionMissing) {
			options.unshift({ text: localize('ua.engineToolsSelectProfile', "Select an agent profile") });
		}
		const selectedIndex = this.profileSelectionMissing ? -1 : Math.max(0, previousIndex);
		this.profileSelect.setOptions(options);
		this.profileSelect.select(selectedIndex + this.profileSelectOffset);
		this.activeProfile = this.profiles[selectedIndex];
		this.updateSaveChrome();
	}

	private clearCatalogPresentation(): void {
		this.setToolsCount(0);
		this.listEntries = [];
		this.list?.splice(0, this.list?.length ?? 0, []);
		this.activeProfile = undefined;
		this.profileSelectionMissing = false;
		this.profileSelectOffset = 0;
		this.invalidateWriteResults();
		this.profiles = [];
		this.pendingEnablement.clear();
		this.selectedToolName = undefined;
		this.clearToolInfo();
		this.status.hide();
		this.hideCatalogWriteStatus();
		this.listContainer.style.display = 'none';
		this.profileSelectHost.style.display = 'none';
		this.profileSelect.setOptions([]);
		this.updateSaveChrome();
	}

	private clearToolInfo(): void {
		this.infoLoadGeneration++;
		this.infoHost.textContent = '';
		this.infoTitle = undefined;
		this.infoStatus = undefined;
		this.infoHost.style.display = 'none';
	}

	private hasLeftoverToolInfo(): boolean {
		return this.isToolInfoVisible() && this.infoTitle?.parentElement === this.infoHost;
	}

	private paintToolInfoHonesty(message: string): void {
		if (this.hasLeftoverToolInfo()) {
			let status = this.infoStatus;
			if (!status || status.parentElement !== this.infoHost) {
				status = DOM.append(this.infoHost, $('.engine-tools-info-status'));
				status.setAttribute('role', 'status');
				this.infoStatus = status;
			}
			writeStatus(status, message, 'error');
			this.infoHost.style.display = '';
			return;
		}
		this.infoHost.textContent = message;
		this.infoTitle = undefined;
		this.infoStatus = undefined;
		this.infoHost.style.display = '';
	}

	private keepLeftoverToolInfoDisconnected(): void {
		if (this.hasLeftoverToolInfo()) {
			this.paintToolInfoHonesty(getEngineSectionDisconnectedCopy());
			return;
		}
		this.clearToolInfo();
	}

	private async loadToolInfo(toolName: string): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}
		const name = toolName.trim();
		if (!name) {
			this.clearToolInfo();
			return;
		}
		// D377 leftover-looks-live: pairing-hold first. KEEP is not only `!connected`.
		if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
			this.keepLeftoverToolInfoDisconnected();
			return;
		}
		if (!canShowCatalogRows(this.mode)) {
			// Keep leftover tool info after a live paint (D270; D264 / D265).
			// failed/loading must not unload leftover detail; first-pull empty still clears.
			if ((this.mode === 'failed' || this.mode === 'loading') && this.hasLeftoverToolInfo()) {
				return;
			}
			this.clearToolInfo();
			return;
		}
		if (!this.connection.getToolInfo) {
			this.infoLoadGeneration++;
			this.paintToolInfoHonesty(getEngineSectionApiUnavailableCopy(TOOL_DETAIL_FEATURE));
			return;
		}
		const generation = ++this.infoLoadGeneration;
		const scope = this.currentCatalogScope();
		if (scope !== this.catalogScope) {
			return;
		}
		try {
			const info = await this.connection.getToolInfo({ toolName: name });
			if (!this.isToolInfoCurrent(generation, name, scope)) {
				return;
			}
			if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
				this.keepLeftoverToolInfoDisconnected();
				return;
			}
			this.renderToolInfo(info);
		} catch {
			if (!this.isToolInfoCurrent(generation, name, scope)) {
				return;
			}
			this.paintToolInfoHonesty(localize('ua.engineToolsInfoFailed', "Could not load tool details from the engine."));
		}
	}

	private isToolInfoCurrent(generation: number, toolName: string, scope: string | undefined): boolean {
		return !this._store.isDisposed
			&& generation === this.infoLoadGeneration
			&& this.selectedToolName === toolName
			&& scope === this.catalogScope
			&& scope === this.currentCatalogScope();
	}

	private renderToolInfo(info: UniverseAgentToolInfoResult): void {
		this.infoHost.textContent = '';
		this.infoStatus = undefined;
		this.infoTitle = DOM.append(this.infoHost, $('.engine-tools-info-name'));
		this.infoTitle.textContent = info.name || this.selectedToolName || '';
		if (info.description) {
			DOM.append(this.infoHost, $('.engine-tools-info-description')).textContent = info.description;
		}
		const meta: string[] = [];
		if (info.category) {
			meta.push(formatToolCategory(info.category.trim()));
		}
		if (info.aliases.length) {
			meta.push(localize('ua.engineToolsInfoAliases', "Aliases: {0}", info.aliases.join(', ')));
		}
		if (info.destructive) {
			meta.push(localize('ua.engineToolsInfoDestructive', "Destructive"));
		}
		if (info.requiresPermission) {
			meta.push(localize('ua.engineToolsInfoPermission', "Requires permission"));
		}
		if (info.inputSchemaJson?.trim()) {
			meta.push(localize('ua.engineToolsInfoHasSchema', "Has input schema"));
		}
		if (meta.length) {
			DOM.append(this.infoHost, $('.engine-tools-info-meta')).textContent = meta.join(' · ');
		}
		this.infoHost.style.display = '';
	}

	private setTools(tools: readonly UniverseAgentToolSummary[]): void {
		const entries: EngineToolListEntry[] = [];
		for (const group of groupToolsForCatalog(tools)) {
			entries.push({
				kind: 'group',
				group: group.group,
				label: group.group === 'client'
					? localize('ua.engineToolsClientGroup', "Client tools")
					: localize('ua.engineToolsEngineGroup', "Engine tools"),
				count: group.tools.length,
			});
			for (const tool of group.tools) {
				entries.push({ kind: 'tool', tool });
			}
		}
		this.listEntries = entries;
		if (entries.length > 0) {
			this.ensureList();
		}
		this.repaintRows();
		if (this.selectedToolName && !entries.some(entry => entry.kind === 'tool' && entry.tool.name === this.selectedToolName)) {
			this.selectedToolName = undefined;
			this.clearToolInfo();
		}
	}
}
