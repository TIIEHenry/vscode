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
import type { UniverseAgentAgentProfileDetail, UniverseAgentAgentProfileSource, UniverseAgentAgentProfileSummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import {
	type EngineCatalogPaneMode,
	canPerformCatalogWrite,
	canShowCatalogRows,
	resolveEngineCatalogPaneMode,
} from './engineCatalog.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { formatAgentsMarkdown, parseAgentsMarkdown } from './engineAgentAgentsMd.js';
import { summaryToProfileDetail } from './engineToolProfile.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';

const $ = DOM.$;

const AGENTS_FEATURE = localize('ua.engineAgentsFeatureLabel', "agent profiles");

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
	private readonly listContainer: HTMLElement;
	private readonly agentsEditorContainer: HTMLElement;
	private readonly agentsEditorLabel: HTMLElement;
	private readonly agentsEditorTextarea: HTMLTextAreaElement;
	private readonly agentsEditorToolbar: HTMLElement;
	private readonly agentsEditorSaveButton: Button;
	private readonly agentsEditorStatus: HTMLElement;
	private readonly list: WorkbenchList<EngineAgentListEntry>;

	private mode: EngineCatalogPaneMode = 'disconnected';
	private listEntries: EngineAgentListEntry[] = [];
	private selectedProfile: UniverseAgentAgentProfileSummary | undefined;
	private agentsEditorLoadGeneration = 0;
	private sectionActive = false;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IInstantiationService instantiationService: IInstantiationService,
		@ICommandService private readonly commandService: ICommandService,
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
		const deleteButton = this._register(new Button(this.writeToolbar, defaultButtonStyles));
		deleteButton.label = localize('ua.engineAgentsDelete', "Delete");
		this._register(deleteButton.onDidClick(() => void this.deleteSelectedProfile()));
		const resetButton = this._register(new Button(this.writeToolbar, defaultButtonStyles));
		resetButton.label = localize('ua.engineAgentsReset', "Reset");
		this._register(resetButton.onDidClick(() => void this.resetSelectedProfile()));

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

		this.agentsEditorContainer = DOM.append(this.container, $('.engine-agents-editor'));
		this.agentsEditorContainer.style.display = 'none';
		this.agentsEditorLabel = DOM.append(this.agentsEditorContainer, $('.engine-agents-editor-label'));
		this.agentsEditorLabel.textContent = localize('ua.engineAgentsMdEditorLabel', "AGENTS.md");
		this.agentsEditorTextarea = DOM.append(this.agentsEditorContainer, $('textarea.engine-agents-editor-textarea')) as HTMLTextAreaElement;
		this.agentsEditorTextarea.spellcheck = false;
		this.agentsEditorTextarea.setAttribute('aria-label', localize('ua.engineAgentsMdEditorAria', "AGENTS.md body for selected agent profile"));
		this.agentsEditorToolbar = DOM.append(this.agentsEditorContainer, $('.engine-agents-editor-toolbar'));
		this.agentsEditorSaveButton = this._register(new Button(this.agentsEditorToolbar, defaultButtonStyles));
		this.agentsEditorSaveButton.label = localize('ua.engineAgentsMdSave', "Save AGENTS.md");
		this._register(this.agentsEditorSaveButton.onDidClick(() => void this.saveAgentsMarkdown()));
		this.agentsEditorStatus = DOM.append(this.agentsEditorContainer, $('.engine-agents-editor-status'));
		this.agentsEditorStatus.style.display = 'none';

		this._register(this.list.onDidChangeSelection(e => {
			const entry = e.elements[0];
			this.selectedProfile = entry?.kind === 'profile' ? entry.profile : undefined;
			void this.loadAgentsEditorForSelection();
		}));

		this._register(this.connection.onDidChangeConnection(() => {
			void this.refresh();
		}));

		void this.refresh();
	}

	layout(width: number, listHeight: number): void {
		this.list.layout(Math.max(80, listHeight), width);
		this.agentsEditorTextarea.style.width = `${Math.max(0, width)}px`;
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
		return this.agentsEditorTextarea.value;
	}

	setAgentsMarkdownValue(value: string): void {
		this.agentsEditorTextarea.value = value;
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
				return false;
			}
			await this.refresh();
			return true;
		} catch {
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
		try {
			const result = await this.connection.deleteAgentProfile({ id: this.selectedProfile.id });
			if (!result.ok) {
				return false;
			}
			this.selectedProfile = undefined;
			await this.refresh();
			return true;
		} catch {
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
		try {
			const result = await this.connection.resetAgentProfile({ id: this.selectedProfile.id });
			if (!result.ok) {
				return false;
			}
			await this.refresh();
			if (this.selectedProfile) {
				await this.loadAgentsEditorForSelection();
			}
			return true;
		} catch {
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
		const profile: UniverseAgentAgentProfileDetail = {
			...summaryToProfileDetail(this.selectedProfile),
			...updates,
		};
		try {
			const result = await this.connection.saveAgentProfile({ profile });
			if (!result.profile.id) {
				return false;
			}
			await this.refresh();
			return true;
		} catch {
			return false;
		}
	}

	async saveAgentsMarkdown(): Promise<boolean> {
		if (!this.canWrite() || !this.selectedProfile || this.selectedProfile.source === 'built_in') {
			return false;
		}
		const profileId = this.selectedProfile.id;
		const parsed = parseAgentsMarkdown(this.agentsEditorTextarea.value);
		const ok = await this.saveSelectedProfile(parsed);
		if (ok) {
			await this.selectProfileByIdForTest(profileId);
		}
		return ok;
	}

	private async refresh(): Promise<void> {
		this.selectedProfile = undefined;
		const capabilities = this.connection.getCapabilitySnapshot();
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
			this.renderStatus({ loadingKind: 'capability' });
			return;
		}

		this.mode = resolveEngineCatalogPaneMode(true, support, { kind: 'inFlight' });
		this.writeToolbar.style.display = 'none';
		this.renderStatus({ loadingKind: 'list' });

		try {
			const result = await this.connection.listAgentProfiles();
			if (!this.connection.isEngineConnected()) {
				this.clearCatalogPresentation();
				this.mode = resolveEngineCatalogPaneMode(false, support);
				this.renderStatus();
				return;
			}
			this.setProfiles(result.profiles);
			this.mode = resolveEngineCatalogPaneMode(true, support, {
				kind: 'success',
				itemCount: result.profiles.length,
			});
			this.listContainer.style.display = canShowCatalogRows(this.mode) ? '' : 'none';
			this.writeToolbar.style.display = canPerformCatalogWrite(this.mode) ? '' : 'none';
			this.renderStatus();
		} catch (error) {
			this.clearCatalogPresentation();
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
		this.status.hide();
		this.listContainer.style.display = 'none';
		this.writeToolbar.style.display = 'none';
		this.clearAgentsEditor();
	}

	private clearAgentsEditor(): void {
		this.agentsEditorLoadGeneration++;
		this.agentsEditorContainer.style.display = 'none';
		this.agentsEditorTextarea.value = '';
		this.agentsEditorTextarea.readOnly = true;
		this.agentsEditorSaveButton.enabled = false;
		this.agentsEditorStatus.style.display = 'none';
		this.agentsEditorStatus.textContent = '';
	}

	private async loadAgentsEditorForSelection(): Promise<void> {
		const generation = ++this.agentsEditorLoadGeneration;
		this.agentsEditorStatus.style.display = 'none';
		this.agentsEditorStatus.textContent = '';

		if (!canShowCatalogRows(this.mode) || !this.connection.isEngineConnected() || !this.selectedProfile) {
			this.agentsEditorContainer.style.display = 'none';
			this.agentsEditorTextarea.value = '';
			this.agentsEditorTextarea.readOnly = true;
			this.agentsEditorSaveButton.enabled = false;
			return;
		}

		const selected = this.selectedProfile;
		this.agentsEditorContainer.style.display = '';
		this.agentsEditorTextarea.readOnly = selected.source === 'built_in';
		this.agentsEditorSaveButton.enabled = this.canWrite() && selected.source !== 'built_in';
		this.agentsEditorTextarea.value = formatAgentsMarkdown(summaryToProfileDetail(selected));

		try {
			const result = await this.connection.saveAgentProfile({
				profile: {
					id: selected.id,
					name: selected.name,
					source: selected.source,
				},
			});
			if (generation !== this.agentsEditorLoadGeneration || this.selectedProfile?.id !== selected.id) {
				return;
			}
			this.agentsEditorTextarea.value = formatAgentsMarkdown(result.profile);
		} catch {
			if (generation !== this.agentsEditorLoadGeneration || this.selectedProfile?.id !== selected.id) {
				return;
			}
			this.agentsEditorStatus.style.display = '';
			this.agentsEditorStatus.textContent = localize(
				'ua.engineAgentsMdLoadFailed',
				"Could not load AGENTS.md from the engine.",
			);
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
	}
}
