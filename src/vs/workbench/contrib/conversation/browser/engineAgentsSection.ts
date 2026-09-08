/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { InputBox } from '../../../../base/browser/ui/inputbox/inputBox.js';
import { Checkbox } from '../../../../base/browser/ui/toggle/toggle.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { ensureCapabilitySnapshot } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import type {
	UniverseAgentAgentProfileDetail,
	UniverseAgentAgentProfileSource,
	UniverseAgentAgentProfileSummary,
	UniverseAgentToolSummary,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultButtonStyles, defaultCheckboxStyles, defaultInputBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import {
	type EngineCatalogPaneMode,
	canPerformCatalogWrite,
	canShowCatalogRows,
	resolveEngineCatalogPaneMode,
} from './engineCatalog.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import {
	formatAgentsMarkdown,
	getAgentProfileModelUnsupportedReason,
	isAgentsMarkdownDirty,
	parseAgentsMarkdown,
} from './engineAgentAgentsMd.js';
import {
	applyToolEnablementChanges,
	groupToolsForCatalog,
	isToolEnabledInProfile,
	summaryToProfileDetail,
	toolEnablementPendingKey,
} from './engineToolProfile.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';

const $ = DOM.$;

const AGENTS_FEATURE = localize('ua.engineAgentsFeatureLabel', "agent profiles");
const AGENT_MODEL_FEATURE = localize('ua.engineAgentModelFeatureLabel', "agent profile model.json");
const AGENT_TOOLS_FEATURE = localize('ua.engineAgentToolsFeatureLabel', "agent profile tools");

type EngineAgentDetailTab = 'instructions' | 'tools' | 'model';

type EngineAgentListEntry =
	| { readonly kind: 'group'; readonly source: UniverseAgentAgentProfileSource; readonly label: string }
	| { readonly kind: 'profile'; readonly profile: UniverseAgentAgentProfileSummary };

class EngineAgentListDelegate implements IListVirtualDelegate<EngineAgentListEntry> {
	getHeight(entry: EngineAgentListEntry): number {
		return entry.kind === 'group' ? 28 : 40;
	}

	getTemplateId(entry: EngineAgentListEntry): string {
		return entry.kind === 'group' ? 'agentGroup' : 'agentRow';
	}
}

interface IAgentGroupTemplateData {
	readonly label: HTMLElement;
}

interface IAgentRowTemplateData {
	readonly name: HTMLElement;
	readonly summary: HTMLElement;
}

class EngineAgentGroupRenderer implements IListRenderer<EngineAgentListEntry, IAgentGroupTemplateData> {
	static readonly TEMPLATE_ID = 'agentGroup';
	readonly templateId = EngineAgentGroupRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IAgentGroupTemplateData {
		container.classList.add('engine-catalog-group');
		return { label: DOM.append(container, $('.engine-catalog-group-label')) };
	}

	renderElement(entry: EngineAgentListEntry, _index: number, templateData: IAgentGroupTemplateData): void {
		if (entry.kind !== 'group') {
			return;
		}
		templateData.label.textContent = entry.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

class EngineAgentRowRenderer implements IListRenderer<EngineAgentListEntry, IAgentRowTemplateData> {
	static readonly TEMPLATE_ID = 'agentRow';
	readonly templateId = EngineAgentRowRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IAgentRowTemplateData {
		const row = DOM.append(container, $('.engine-catalog-row'));
		const text = DOM.append(row, $('.engine-catalog-text'));
		return {
			name: DOM.append(text, $('.engine-catalog-name')),
			summary: DOM.append(text, $('.engine-catalog-description')),
		};
	}

	renderElement(entry: EngineAgentListEntry, _index: number, templateData: IAgentRowTemplateData): void {
		if (entry.kind !== 'profile') {
			return;
		}
		templateData.name.textContent = entry.profile.name || entry.profile.id;
		templateData.summary.textContent = entry.profile.summary ?? '';
	}

	disposeTemplate(): void {
		// noop
	}
}

class EngineAgentListAccessibilityProvider implements IListAccessibilityProvider<EngineAgentListEntry> {
	getWidgetAriaLabel(): string {
		return localize('ua.engineAgentsList', "Engine agent profiles");
	}

	getAriaLabel(entry: EngineAgentListEntry): string {
		return entry.kind === 'group' ? entry.label : (entry.profile.name || entry.profile.id);
	}
}

function agentsWriteRejectedReason(): string {
	return localize('ua.engineAgentsWriteRejected', "The engine rejected the agent profile write.");
}

function agentsWriteFailureReason(error: unknown): string {
	if (typeof error === 'string' && error) {
		return error;
	}
	if (error instanceof Error && error.message) {
		return error.message;
	}
	return agentsWriteRejectedReason();
}

function getAgentSourceGroupLabel(source: UniverseAgentAgentProfileSource): string {
	switch (source) {
		case 'built_in':
			return localize('ua.engineAgentSourceBuiltIn', "Built-in");
		case 'user':
			return localize('ua.engineAgentSourceUser', "User");
		case 'project':
			return localize('ua.engineAgentSourceProject', "Project");
		default:
			return localize('ua.engineAgentSourceUnknown', "Unknown");
	}
}

function groupProfilesBySource(profiles: readonly UniverseAgentAgentProfileSummary[]): Map<UniverseAgentAgentProfileSource, UniverseAgentAgentProfileSummary[]> {
	const order: UniverseAgentAgentProfileSource[] = ['project', 'user', 'built_in', 'unknown'];
	const groups = new Map<UniverseAgentAgentProfileSource, UniverseAgentAgentProfileSummary[]>();
	for (const source of order) {
		groups.set(source, []);
	}
	for (const profile of profiles) {
		const bucket = groups.get(profile.source) ?? groups.get('unknown')!;
		bucket.push(profile);
	}
	for (const [source, entries] of groups) {
		if (entries.length === 0) {
			groups.delete(source);
		}
	}
	return groups;
}

export class EngineAgentsSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly heading: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly writeToolbar: HTMLElement;
	private readonly catalogWriteStatus: HTMLElement;
	private readonly deleteButton: Button;
	private readonly resetButton: Button;
	private readonly listContainer: HTMLElement;
	private readonly detailHost: HTMLElement;
	private readonly tabBar: HTMLElement;
	private readonly instructionsTab: Button;
	private readonly toolsTab: Button;
	private readonly modelTab: Button;
	private readonly agentsEditorContainer: HTMLElement;
	private readonly agentsEditorLabel: HTMLElement;
	private readonly agentsEditorInput: InputBox;
	private readonly agentsEditorToolbar: HTMLElement;
	private readonly agentsEditorSaveButton: Button;
	private readonly agentsEditorStatus: HTMLElement;
	private readonly toolsPanel: HTMLElement;
	private readonly toolsStatus: EngineCatalogStatusWidget;
	private readonly toolsListHost: HTMLElement;
	private readonly toolsToolbar: HTMLElement;
	private readonly toolsSaveButton: Button;
	private readonly modelPanel: HTMLElement;
	private readonly modelStatus: EngineCatalogStatusWidget;
	private readonly list: WorkbenchList<EngineAgentListEntry>;
	private readonly toolCheckboxStore = this._register(new DisposableStore());

	private mode: EngineCatalogPaneMode = 'disconnected';
	private listEntries: EngineAgentListEntry[] = [];
	private selectedProfile: UniverseAgentAgentProfileSummary | undefined;
	private agentsEditorLoadGeneration = 0;
	private loadedAgentsMarkdown: string | undefined;
	private agentsMarkdownDirty = false;
	private activeDetailTab: EngineAgentDetailTab = 'instructions';
	private agentTools: UniverseAgentToolSummary[] = [];
	private agentToolsLoadFailed: string | undefined;
	private readonly agentToolPending = new Map<string, boolean>();
	private sectionActive = false;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IInstantiationService instantiationService: IInstantiationService,
		@ICommandService private readonly commandService: ICommandService,
		@IContextViewService contextViewService: IContextViewService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-agents-section.engine-catalog-section'));
		this.container.style.display = 'none';

		this.heading = DOM.append(this.container, $('h3.engine-section-heading'));
		this.heading.textContent = localize('ua.engineAgentsSectionTitle', "Agents");
		this.heading.style.display = 'none';

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		this.writeToolbar = DOM.append(this.container, $('.engine-catalog-write-toolbar'));
		this.writeToolbar.style.display = 'none';
		const newButton = this._register(new Button(this.writeToolbar, defaultButtonStyles));
		newButton.label = localize('ua.engineAgentsNew', "New");
		this._register(newButton.onDidClick(() => void this.createProfile()));
		this.resetButton = this._register(new Button(this.writeToolbar, { ...defaultButtonStyles, secondary: true }));
		this.resetButton.label = localize('ua.engineAgentsReset', "Reset");
		this._register(this.resetButton.onDidClick(() => void this.resetSelectedProfile()));
		this.deleteButton = this._register(new Button(this.writeToolbar, { ...defaultButtonStyles, secondary: true }));
		this.deleteButton.label = localize('ua.engineAgentsDelete', "Delete");
		this._register(this.deleteButton.onDidClick(() => void this.deleteSelectedProfile()));
		this.catalogWriteStatus = DOM.append(this.container, $('.engine-catalog-write-status'));
		this.catalogWriteStatus.setAttribute('role', 'status');
		this.catalogWriteStatus.setAttribute('aria-live', 'polite');
		this.catalogWriteStatus.style.display = 'none';
		this.updateWriteActions();

		this.listContainer = DOM.append(this.container, $('.engine-catalog-list'));
		this.list = this._register(instantiationService.createInstance(
			WorkbenchList,
			'EngineAgents',
			this.listContainer,
			new EngineAgentListDelegate(),
			[
				new EngineAgentGroupRenderer(),
				new EngineAgentRowRenderer(),
			],
			{
				identityProvider: {
					getId: (entry: EngineAgentListEntry) => entry.kind === 'group'
						? `group:${entry.source}`
						: `profile:${entry.profile.id}`,
				},
				accessibilityProvider: new EngineAgentListAccessibilityProvider(),
			},
		)) as WorkbenchList<EngineAgentListEntry>;

		this.detailHost = DOM.append(this.container, $('.engine-agents-detail'));
		this.detailHost.style.display = 'none';

		this.tabBar = DOM.append(this.detailHost, $('.engine-mcp-tab-bar'));
		this.tabBar.setAttribute('role', 'tablist');
		this.instructionsTab = this._register(new Button(this.tabBar, { ...defaultButtonStyles, secondary: true }));
		this.instructionsTab.label = localize('ua.engineAgentsTabInstructions', "Instructions");
		this.instructionsTab.element.setAttribute('role', 'tab');
		this.toolsTab = this._register(new Button(this.tabBar, { ...defaultButtonStyles, secondary: true }));
		this.toolsTab.label = localize('ua.engineAgentsTabTools', "Tools");
		this.toolsTab.element.setAttribute('role', 'tab');
		this.modelTab = this._register(new Button(this.tabBar, { ...defaultButtonStyles, secondary: true }));
		this.modelTab.label = localize('ua.engineAgentsTabModel', "Model");
		this.modelTab.element.setAttribute('role', 'tab');
		this._register(this.instructionsTab.onDidClick(() => this.setActiveDetailTab('instructions')));
		this._register(this.toolsTab.onDidClick(() => this.setActiveDetailTab('tools')));
		this._register(this.modelTab.onDidClick(() => this.setActiveDetailTab('model')));

		this.agentsEditorContainer = DOM.append(this.detailHost, $('.engine-agents-editor'));
		this.agentsEditorContainer.style.display = 'none';
		this.agentsEditorLabel = DOM.append(this.agentsEditorContainer, $('.engine-agents-editor-label'));
		this.agentsEditorLabel.textContent = localize('ua.engineAgentsMdEditorLabel', "AGENTS.md");
		this.agentsEditorInput = this._register(new InputBox(this.agentsEditorContainer, contextViewService, {
			ariaLabel: localize('ua.engineAgentsMdEditorAria', "AGENTS.md body for selected agent profile"),
			flexibleHeight: true,
			flexibleMaxHeight: 320,
			inputBoxStyles: defaultInputBoxStyles,
		}));
		this.agentsEditorInput.element.classList.add('engine-agents-editor-input');
		this._register(DOM.addDisposableListener(this.agentsEditorInput.inputElement, 'input', () => {
			this.agentsMarkdownDirty = isAgentsMarkdownDirty(this.agentsEditorInput.value, this.loadedAgentsMarkdown);
		}));
		this.agentsEditorToolbar = DOM.append(this.agentsEditorContainer, $('.engine-agents-editor-toolbar'));
		this.agentsEditorSaveButton = this._register(new Button(this.agentsEditorToolbar, defaultButtonStyles));
		this.agentsEditorSaveButton.label = localize('ua.engineAgentsMdSave', "Save AGENTS.md");
		this._register(this.agentsEditorSaveButton.onDidClick(() => void this.saveAgentsMarkdown()));
		this.agentsEditorStatus = DOM.append(this.agentsEditorContainer, $('.engine-agents-editor-status'));
		this.agentsEditorStatus.setAttribute('role', 'status');
		this.agentsEditorStatus.setAttribute('aria-live', 'polite');
		this.agentsEditorStatus.style.display = 'none';

		this.toolsPanel = DOM.append(this.detailHost, $('.engine-agents-tools-panel'));
		this.toolsPanel.style.display = 'none';
		this.toolsStatus = this._register(new EngineCatalogStatusWidget(this.toolsPanel));
		this.toolsListHost = DOM.append(this.toolsPanel, $('.engine-catalog-list'));
		this.toolsListHost.setAttribute('role', 'list');
		this.toolsListHost.setAttribute('aria-label', localize('ua.engineAgentsToolsList', "Tools enabled for this agent profile"));
		this.toolsToolbar = DOM.append(this.toolsPanel, $('.engine-catalog-write-toolbar'));
		this.toolsSaveButton = this._register(new Button(this.toolsToolbar, defaultButtonStyles));
		this.toolsSaveButton.label = localize('ua.engineAgentsToolsSave', "Save");
		this._register(this.toolsSaveButton.onDidClick(() => void this.saveAgentToolEnablement()));

		this.modelPanel = DOM.append(this.detailHost, $('.engine-agents-model-panel'));
		this.modelPanel.style.display = 'none';
		this.modelStatus = this._register(new EngineCatalogStatusWidget(this.modelPanel));

		this._register(this.list.onDidChangeSelection(e => {
			const entry = e.elements[0];
			this.selectedProfile = entry?.kind === 'profile' ? entry.profile : undefined;
			this.updateWriteActions();
			void this.loadAgentsEditorForSelection();
			this.renderAgentTools();
			this.renderModelTab();
			this.syncDetailHost();
		}));

		this._register(this.connection.onDidChangeConnection(() => {
			void this.refresh();
		}));

		this.renderModelTab();
		this.setActiveDetailTab('instructions');
		void this.refresh();
	}

	layout(width: number, listHeight: number): void {
		this.list.layout(Math.max(80, listHeight), width);
		this.agentsEditorInput.layout();
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
		return this.listEntries.filter(entry => entry.kind === 'profile').length;
	}

	canWrite(): boolean {
		return canPerformCatalogWrite(this.mode) && this.connection.isEngineConnected();
	}

	isWriteToolbarVisible(): boolean {
		return this.writeToolbar.style.display !== 'none';
	}

	isAgentsEditorVisible(): boolean {
		return this.agentsEditorContainer.style.display !== 'none';
	}

	getAgentsMarkdownValue(): string {
		return this.agentsEditorInput.value;
	}

	setAgentsMarkdownValue(value: string): void {
		this.agentsEditorInput.value = value;
		this.agentsMarkdownDirty = isAgentsMarkdownDirty(value, this.loadedAgentsMarkdown);
	}

	getSelectedProfileId(): string | undefined {
		return this.selectedProfile?.id;
	}

	isAgentsMarkdownDirty(): boolean {
		return this.agentsMarkdownDirty;
	}

	getActiveAgentDetailTab(): EngineAgentDetailTab {
		return this.activeDetailTab;
	}

	setActiveAgentDetailTabForTest(tab: EngineAgentDetailTab): void {
		this.setActiveDetailTab(tab);
	}

	hasModelTabEditableControls(): boolean {
		return !!this.modelPanel.querySelector('textarea, input, select, [contenteditable="true"], button, .monaco-button, .monaco-custom-toggle');
	}

	isAgentToolEnablementDirty(): boolean {
		if (!this.selectedProfile) {
			return false;
		}
		const prefix = `${this.selectedProfile.id}\u0000`;
		for (const key of this.agentToolPending.keys()) {
			if (key.startsWith(prefix)) {
				return true;
			}
		}
		return false;
	}

	isDeleteActionVisible(): boolean {
		return this.deleteButton.element.style.display !== 'none';
	}

	isResetActionVisible(): boolean {
		return this.resetButton.element.style.display !== 'none';
	}

	async selectProfileByIdForTest(id: string): Promise<void> {
		const index = this.listEntries.findIndex(entry => entry.kind === 'profile' && entry.profile.id === id);
		if (index < 0) {
			this.selectedProfile = undefined;
			this.clearAgentsEditor();
			return;
		}
		this.list.setSelection([index]);
		await this.loadAgentsEditorForSelection();
	}

	async createProfile(profile?: UniverseAgentAgentProfileDetail): Promise<boolean> {
		if (!this.canWrite()) {
			return false;
		}
		this.hideCatalogWriteStatus();
		const payload = profile ?? {
			id: `agent-${Date.now()}`,
			name: localize('ua.engineAgentsNewDefaultName', "New Agent"),
			source: 'user' as const,
			summary: '',
			enabled: true,
		};
		try {
			const result = await this.connection.saveAgentProfile({ profile: payload });
			if (!this.canWrite()) {
				return false;
			}
			if (!result.profile.id) {
				this.showCatalogWriteFailed(localize('ua.engineAgentsCreateFailed', "Unable to create: {0}", agentsWriteRejectedReason()));
				return false;
			}
			await this.refresh();
			return true;
		} catch (error) {
			this.showCatalogWriteFailed(localize('ua.engineAgentsCreateFailed', "Unable to create: {0}", agentsWriteFailureReason(error)));
			return false;
		}
	}

	async deleteSelectedProfile(): Promise<boolean> {
		if (!this.canWrite() || !this.selectedProfile) {
			return false;
		}
		if (this.selectedProfile.source === 'built_in') {
			return false;
		}
		this.hideCatalogWriteStatus();
		try {
			const result = await this.connection.deleteAgentProfile({ id: this.selectedProfile.id });
			if (!result.ok) {
				this.showCatalogWriteFailed(localize('ua.engineAgentsDeleteFailed', "Unable to delete: {0}", agentsWriteFailureReason(result.reason)));
				return false;
			}
			this.selectedProfile = undefined;
			await this.refresh();
			return true;
		} catch (error) {
			this.showCatalogWriteFailed(localize('ua.engineAgentsDeleteFailed', "Unable to delete: {0}", agentsWriteFailureReason(error)));
			return false;
		}
	}

	async resetSelectedProfile(): Promise<boolean> {
		if (!this.canWrite() || !this.selectedProfile) {
			return false;
		}
		if (this.selectedProfile.source !== 'built_in') {
			return false;
		}
		this.hideCatalogWriteStatus();
		try {
			const result = await this.connection.resetAgentProfile({ id: this.selectedProfile.id });
			if (!result.ok) {
				this.showCatalogWriteFailed(localize('ua.engineAgentsResetFailed', "Unable to reset: {0}", agentsWriteFailureReason(result.reason)));
				return false;
			}
			await this.refresh();
			if (this.selectedProfile) {
				await this.loadAgentsEditorForSelection();
			}
			return true;
		} catch (error) {
			this.showCatalogWriteFailed(localize('ua.engineAgentsResetFailed', "Unable to reset: {0}", agentsWriteFailureReason(error)));
			return false;
		}
	}

	async saveSelectedProfile(updates: Partial<UniverseAgentAgentProfileDetail> = {}): Promise<boolean> {
		if (!this.canWrite() || !this.selectedProfile) {
			return false;
		}
		if (this.selectedProfile.source === 'built_in') {
			return false;
		}
		this.hideCatalogWriteStatus();
		const profile: UniverseAgentAgentProfileDetail = {
			...summaryToProfileDetail(this.selectedProfile),
			...updates,
		};
		try {
			const result = await this.connection.saveAgentProfile({ profile });
			if (!result.profile.id) {
				this.showCatalogWriteFailed(localize('ua.engineAgentsSaveFailed', "Unable to save: {0}", agentsWriteRejectedReason()));
				return false;
			}
			await this.refresh();
			return true;
		} catch (error) {
			this.showCatalogWriteFailed(localize('ua.engineAgentsSaveFailed', "Unable to save: {0}", agentsWriteFailureReason(error)));
			return false;
		}
	}

	async saveAgentsMarkdown(): Promise<boolean> {
		if (!this.canWrite() || !this.selectedProfile || this.selectedProfile.source === 'built_in') {
			return false;
		}
		const profileId = this.selectedProfile.id;
		const parsed = parseAgentsMarkdown(this.agentsEditorInput.value);
		const ok = await this.saveSelectedProfile(parsed);
		if (ok) {
			this.hideAgentsEditorStatus();
			this.loadedAgentsMarkdown = this.agentsEditorInput.value;
			this.agentsMarkdownDirty = false;
			await this.selectProfileByIdForTest(profileId);
		} else {
			this.showAgentsEditorStatus(localize(
				'ua.engineAgentsMdSaveFailed',
				"Could not save AGENTS.md to the engine.",
			));
		}
		return ok;
	}

	private setActiveDetailTab(tab: EngineAgentDetailTab): void {
		this.activeDetailTab = tab;
		this.instructionsTab.secondary = tab !== 'instructions';
		this.toolsTab.secondary = tab !== 'tools';
		this.modelTab.secondary = tab !== 'model';
		this.instructionsTab.element.setAttribute('aria-selected', String(tab === 'instructions'));
		this.toolsTab.element.setAttribute('aria-selected', String(tab === 'tools'));
		this.modelTab.element.setAttribute('aria-selected', String(tab === 'model'));
		this.agentsEditorContainer.style.display = tab === 'instructions' && this.selectedProfile ? '' : 'none';
		this.toolsPanel.style.display = tab === 'tools' && this.selectedProfile ? '' : 'none';
		this.modelPanel.style.display = tab === 'model' && this.selectedProfile ? '' : 'none';
		if (tab === 'tools') {
			void this.ensureAgentToolsLoaded().then(() => this.renderAgentTools());
		}
		if (tab === 'model') {
			this.renderModelTab();
		}
	}

	private syncDetailHost(): void {
		const show = canShowCatalogRows(this.mode) && !!this.selectedProfile;
		this.detailHost.style.display = show ? '' : 'none';
		if (show) {
			this.setActiveDetailTab(this.activeDetailTab);
		}
	}

	private updateWriteActions(): void {
		const canWrite = this.canWrite();
		const selected = this.selectedProfile;
		this.deleteButton.element.style.display = canWrite && selected && selected.source !== 'built_in' ? '' : 'none';
		this.resetButton.element.style.display = canWrite && selected && selected.source === 'built_in' ? '' : 'none';
	}

	private hideCatalogWriteStatus(): void {
		this.catalogWriteStatus.style.display = 'none';
		this.catalogWriteStatus.textContent = '';
	}

	private showCatalogWriteFailed(message: string): void {
		this.catalogWriteStatus.style.display = '';
		this.catalogWriteStatus.textContent = message;
	}

	private hideAgentsEditorStatus(): void {
		this.agentsEditorStatus.style.display = 'none';
		this.agentsEditorStatus.textContent = '';
	}

	private showAgentsEditorStatus(message: string): void {
		this.agentsEditorStatus.style.display = '';
		this.agentsEditorStatus.textContent = message;
	}

	private renderModelTab(): void {
		this.modelStatus.render({
			mode: 'unsupported',
			featureLabel: AGENT_MODEL_FEATURE,
			reason: getAgentProfileModelUnsupportedReason(),
		});
	}

	private canEditAgentTools(): boolean {
		return this.canWrite() && !!this.selectedProfile && this.selectedProfile.source !== 'built_in';
	}

	private isAgentToolEnabled(toolName: string): boolean {
		if (!this.selectedProfile) {
			return true;
		}
		const pending = this.agentToolPending.get(toolEnablementPendingKey(this.selectedProfile.id, toolName));
		if (pending !== undefined) {
			return pending;
		}
		return isToolEnabledInProfile(toolName, this.selectedProfile);
	}

	private async ensureAgentToolsLoaded(): Promise<void> {
		if (this.agentTools.length > 0 || !this.connection.isEngineConnected()) {
			return;
		}
		try {
			const result = await this.connection.listTools();
			this.agentTools = [...result.tools];
			this.agentToolsLoadFailed = undefined;
		} catch (error) {
			this.agentTools = [];
			this.agentToolsLoadFailed = error instanceof Error && error.message
				? error.message
				: '';
		}
	}

	private renderAgentTools(): void {
		this.toolCheckboxStore.clear();
		DOM.clearNode(this.toolsListHost);
		this.toolsToolbar.style.display = this.canEditAgentTools() ? '' : 'none';
		this.toolsSaveButton.enabled = this.canEditAgentTools() && this.isAgentToolEnablementDirty();
		if (!this.selectedProfile) {
			this.toolsStatus.hide();
			return;
		}
		if (this.agentToolsLoadFailed !== undefined) {
			this.toolsStatus.render({
				mode: 'failed',
				featureLabel: AGENT_TOOLS_FEATURE,
				reason: this.agentToolsLoadFailed || undefined,
				onRetry: () => void this.ensureAgentToolsLoaded().then(() => this.renderAgentTools()),
			});
			return;
		}
		if (this.agentTools.length === 0) {
			this.toolsStatus.render({
				mode: this.connection.isEngineConnected() ? 'empty' : 'disconnected',
				featureLabel: AGENT_TOOLS_FEATURE,
				emptyCopy: localize('ua.engineAgentsToolsEmpty', "No engine tools to enable for this profile."),
				onOpenConnection: this.connection.isEngineConnected()
					? undefined
					: () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID),
			});
			return;
		}
		this.toolsStatus.hide();
		for (const group of groupToolsForCatalog(this.agentTools)) {
			const heading = DOM.append(this.toolsListHost, $('.engine-catalog-group-label'));
			heading.textContent = group.group === 'client'
				? localize('ua.engineAgentsToolsClientGroup', "Client tools")
				: localize('ua.engineAgentsToolsEngineGroup', "Engine tools");
			for (const tool of group.tools) {
				const row = DOM.append(this.toolsListHost, $('.engine-catalog-row'));
				row.setAttribute('role', 'listitem');
				const checkbox = this.toolCheckboxStore.add(new Checkbox(
					localize('ua.engineAgentsToolToggle', "Enable {0}", tool.name),
					this.isAgentToolEnabled(tool.name),
					defaultCheckboxStyles,
				));
				if (!this.canEditAgentTools()) {
					checkbox.disable();
				}
				this.toolCheckboxStore.add(checkbox.onChange(() => {
					if (!this.selectedProfile || !this.canEditAgentTools()) {
						return;
					}
					this.agentToolPending.set(
						toolEnablementPendingKey(this.selectedProfile.id, tool.name),
						checkbox.checked,
					);
					this.toolsSaveButton.enabled = this.isAgentToolEnablementDirty();
				}));
				row.appendChild(checkbox.domNode);
				const text = DOM.append(row, $('.engine-catalog-text'));
				DOM.append(text, $('.engine-catalog-name')).textContent = tool.name;
				if (tool.description) {
					DOM.append(text, $('.engine-catalog-description')).textContent = tool.description;
				}
			}
		}
	}

	private async saveAgentToolEnablement(): Promise<boolean> {
		if (!this.canEditAgentTools() || !this.selectedProfile) {
			return false;
		}
		const profileId = this.selectedProfile.id;
		const prefix = `${profileId}\u0000`;
		const changes: Array<{ readonly toolName: string; readonly enabled: boolean }> = [];
		for (const [key, enabled] of this.agentToolPending) {
			if (key.startsWith(prefix)) {
				changes.push({ toolName: key.slice(prefix.length), enabled });
			}
		}
		if (changes.length === 0) {
			return true;
		}
		const profile = applyToolEnablementChanges(summaryToProfileDetail(this.selectedProfile), changes);
		const ok = await this.saveSelectedProfile(profile);
		if (ok) {
			for (const key of [...this.agentToolPending.keys()]) {
				if (key.startsWith(prefix)) {
					this.agentToolPending.delete(key);
				}
			}
			await this.selectProfileByIdForTest(profileId);
		}
		return ok;
	}

	private async refresh(): Promise<void> {
		const capabilities = ensureCapabilitySnapshot(this.connection.getCapabilitySnapshot());
		const connected = this.connection.isEngineConnected();
		const support = capabilities.agentProfiles.support;

		if (!connected) {
			this.clearCatalogPresentation();
			this.mode = resolveEngineCatalogPaneMode(false, support);
			this.renderStatus();
			return;
		}

		if (support === 'UNSUPPORTED') {
			this.clearCatalogPresentation();
			this.mode = resolveEngineCatalogPaneMode(true, support);
			this.renderStatus({ reason: capabilities.agentProfiles.reason });
			return;
		}

		if (support === 'UNKNOWN') {
			this.mode = resolveEngineCatalogPaneMode(true, support);
			this.writeToolbar.style.display = 'none';
			this.updateWriteActions();
			this.renderStatus({ loadingKind: 'capability' });
			return;
		}

		this.mode = resolveEngineCatalogPaneMode(true, support, { kind: 'inFlight' });
		this.writeToolbar.style.display = 'none';
		this.updateWriteActions();
		this.renderStatus({ loadingKind: 'list' });

		try {
			const result = await this.connection.listAgentProfiles();
			if (!this.connection.isEngineConnected()) {
				this.clearCatalogPresentation();
				this.mode = resolveEngineCatalogPaneMode(false, support);
				this.renderStatus();
				return;
			}
			this.agentTools = [];
			this.agentToolsLoadFailed = undefined;
			this.setProfiles(result.profiles);
			this.hideCatalogWriteStatus();
			this.mode = resolveEngineCatalogPaneMode(true, support, {
				kind: 'success',
				itemCount: result.profiles.length,
			});
			this.listContainer.style.display = canShowCatalogRows(this.mode) ? '' : 'none';
			this.writeToolbar.style.display = canPerformCatalogWrite(this.mode) ? '' : 'none';
			this.updateWriteActions();
			this.syncDetailHost();
			this.renderStatus();
		} catch (error) {
			this.clearCatalogPresentation();
			this.mode = resolveEngineCatalogPaneMode(true, support, {
				kind: 'failed',
				error: error instanceof Error ? error.message : undefined,
			});
			this.writeToolbar.style.display = 'none';
			this.updateWriteActions();
			this.renderStatus({
				reason: error instanceof Error ? error.message : undefined,
				onRetry: () => void this.refresh(),
			});
		}
	}

	private renderStatus(options?: { reason?: string; loadingKind?: 'capability' | 'list'; onRetry?: () => void }): void {
		this.status.render({
			mode: this.mode,
			featureLabel: AGENTS_FEATURE,
			emptyCopy: localize('ua.engineAgentsEmpty', "No agent profiles yet."),
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
		this.list.splice(0, this.list.length, []);
		this.selectedProfile = undefined;
		this.agentTools = [];
		this.agentToolsLoadFailed = undefined;
		this.agentToolPending.clear();
		this.status.hide();
		this.hideCatalogWriteStatus();
		this.listContainer.style.display = 'none';
		this.writeToolbar.style.display = 'none';
		this.updateWriteActions();
		this.clearAgentsEditor();
		this.syncDetailHost();
	}

	private clearAgentsEditor(): void {
		this.agentsEditorLoadGeneration++;
		this.agentsEditorContainer.style.display = 'none';
		this.agentsEditorInput.value = '';
		this.agentsEditorInput.inputElement.readOnly = true;
		this.agentsEditorSaveButton.enabled = false;
		this.hideAgentsEditorStatus();
		this.loadedAgentsMarkdown = undefined;
		this.agentsMarkdownDirty = false;
	}

	private async loadAgentsEditorForSelection(): Promise<void> {
		this.hideAgentsEditorStatus();

		if (!canShowCatalogRows(this.mode) || !this.connection.isEngineConnected() || !this.selectedProfile) {
			if (!this.agentsMarkdownDirty) {
				this.agentsEditorContainer.style.display = 'none';
				this.agentsEditorInput.value = '';
				this.agentsEditorInput.inputElement.readOnly = true;
				this.agentsEditorSaveButton.enabled = false;
			}
			this.syncDetailHost();
			return;
		}

		const selected = this.selectedProfile;
		this.syncDetailHost();
		this.agentsEditorInput.inputElement.readOnly = selected.source === 'built_in';
		this.agentsEditorSaveButton.enabled = this.canWrite() && selected.source !== 'built_in';
		if (this.agentsMarkdownDirty) {
			return;
		}

		const generation = ++this.agentsEditorLoadGeneration;
		this.agentsEditorInput.value = formatAgentsMarkdown(summaryToProfileDetail(selected));

		try {
			const result = await this.connection.saveAgentProfile({
				profile: {
					id: selected.id,
					name: selected.name,
					source: selected.source,
				},
			});
			if (generation !== this.agentsEditorLoadGeneration || this.selectedProfile?.id !== selected.id || this.agentsMarkdownDirty) {
				return;
			}
			const text = formatAgentsMarkdown(result.profile);
			this.loadedAgentsMarkdown = text;
			this.agentsEditorInput.value = text;
			this.agentsMarkdownDirty = false;
		} catch {
			if (generation !== this.agentsEditorLoadGeneration || this.selectedProfile?.id !== selected.id) {
				return;
			}
			this.showAgentsEditorStatus(localize(
				'ua.engineAgentsMdLoadFailed',
				"Could not load AGENTS.md from the engine.",
			));
		}
	}

	private setProfiles(profiles: readonly UniverseAgentAgentProfileSummary[]): void {
		const entries: EngineAgentListEntry[] = [];
		for (const [source, group] of groupProfilesBySource(profiles)) {
			entries.push({ kind: 'group', source, label: getAgentSourceGroupLabel(source) });
			for (const profile of group) {
				entries.push({ kind: 'profile', profile });
			}
		}
		this.listEntries = entries;
		this.list.splice(0, this.list.length, entries);
		this.restoreProfileSelection();
	}

	private restoreProfileSelection(): void {
		const id = this.selectedProfile?.id;
		if (!id) {
			this.updateWriteActions();
			this.syncDetailHost();
			return;
		}
		const index = this.listEntries.findIndex(entry => entry.kind === 'profile' && entry.profile.id === id);
		if (index < 0) {
			this.selectedProfile = undefined;
			if (!this.agentsMarkdownDirty) {
				this.clearAgentsEditor();
			}
			this.updateWriteActions();
			this.syncDetailHost();
			return;
		}
		const entry = this.listEntries[index];
		if (entry?.kind === 'profile') {
			this.selectedProfile = entry.profile;
		}
		this.list.setSelection([index]);
		this.updateWriteActions();
		this.syncDetailHost();
	}
}
