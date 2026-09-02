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
import type { UniverseAgentAgentProfileSummary, UniverseAgentToolSummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultButtonStyles, defaultCheckboxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import {
	type EngineCatalogPaneMode,
	canPerformCatalogWrite,
	canShowCatalogRows,
	resolveEngineCatalogPaneMode,
} from './engineCatalog.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import {
	applyToolEnablementChange,
	applyToolEnablementChanges,
	groupToolsForCatalog,
	isToolEnabledInProfile,
	summaryToProfileDetail,
	toolEnablementPendingKey,
	type EngineToolCatalogGroup,
} from './engineToolProfile.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';

const $ = DOM.$;

const TOOLS_FEATURE = localize('ua.engineToolsFeatureLabel', "engine tools");

type EngineToolListEntry =
	| { readonly kind: 'group'; readonly group: EngineToolCatalogGroup; readonly label: string }
	| { readonly kind: 'tool'; readonly tool: UniverseAgentToolSummary };

class EngineToolListDelegate implements IListVirtualDelegate<EngineToolListEntry> {
	getHeight(entry: EngineToolListEntry): number {
		return entry.kind === 'group' ? 28 : 36;
	}

	getTemplateId(entry: EngineToolListEntry): string {
		return entry.kind === 'group' ? 'toolGroup' : 'toolRow';
	}
}

interface IToolGroupTemplateData {
	readonly label: HTMLElement;
}

class EngineToolGroupRenderer implements IListRenderer<EngineToolListEntry, IToolGroupTemplateData> {
	static readonly TEMPLATE_ID = 'toolGroup';
	readonly templateId = EngineToolGroupRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IToolGroupTemplateData {
		container.classList.add('engine-catalog-group');
		return { label: DOM.append(container, $('.engine-catalog-group-label')) };
	}

	renderElement(entry: EngineToolListEntry, _index: number, templateData: IToolGroupTemplateData): void {
		if (entry.kind !== 'group') {
			return;
		}
		templateData.label.textContent = entry.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

interface IToolRowTemplateData {
	readonly row: HTMLElement;
	readonly checkbox: Checkbox;
	readonly name: HTMLElement;
	readonly description: HTMLElement;
	tool: UniverseAgentToolSummary | undefined;
	readonly checkboxDisposable: { dispose(): void };
}

class EngineToolRowRenderer implements IListRenderer<EngineToolListEntry, IToolRowTemplateData> {
	static readonly TEMPLATE_ID = 'toolRow';
	readonly templateId = EngineToolRowRenderer.TEMPLATE_ID;

	constructor(
		private readonly canToggle: () => boolean,
		private readonly isEnabled: (toolName: string) => boolean,
		private readonly onToggle: (tool: UniverseAgentToolSummary, enabled: boolean) => void,
	) { }

	renderTemplate(container: HTMLElement): IToolRowTemplateData {
		const row = DOM.append(container, $('.engine-catalog-row'));
		const checkbox = new Checkbox('', false, defaultCheckboxStyles);
		const checkboxDisposable = checkbox.onChange(() => {
			const tool = (row as unknown as { __tool?: UniverseAgentToolSummary }).__tool;
			if (tool && this.canToggle()) {
				this.onToggle(tool, checkbox.checked);
			}
		});
		row.appendChild(checkbox.domNode);
		const text = DOM.append(row, $('.engine-catalog-text'));
		return {
			row,
			checkbox,
			name: DOM.append(text, $('.engine-catalog-name')),
			description: DOM.append(text, $('.engine-catalog-description')),
			tool: undefined,
			checkboxDisposable: { dispose: () => checkboxDisposable.dispose() },
		};
	}

	renderElement(entry: EngineToolListEntry, _index: number, templateData: IToolRowTemplateData): void {
		if (entry.kind !== 'tool') {
			return;
		}
		templateData.tool = entry.tool;
		(templateData.row as unknown as { __tool?: UniverseAgentToolSummary }).__tool = entry.tool;
		templateData.name.textContent = entry.tool.name;
		const parts: string[] = [];
		if (entry.tool.category) {
			parts.push(entry.tool.category);
		}
		if (entry.tool.description) {
			parts.push(entry.tool.description);
		}
		templateData.description.textContent = parts.join(' — ');
		templateData.checkbox.checked = this.isEnabled(entry.tool.name);
		templateData.checkbox.enable();
		if (!this.canToggle()) {
			templateData.checkbox.disable();
		}
	}

	disposeTemplate(templateData: IToolRowTemplateData): void {
		templateData.checkboxDisposable.dispose();
		templateData.checkbox.dispose();
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

	private readonly container: HTMLElement;
	private readonly heading: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly profileSelect: HTMLSelectElement;
	private readonly writeToolbar: HTMLElement;
	private readonly saveButton: Button;
	private readonly listContainer: HTMLElement;
	private readonly instantiationService: IInstantiationService;
	private list: WorkbenchList<EngineToolListEntry> | undefined;

	private mode: EngineCatalogPaneMode = 'disconnected';
	private listEntries: EngineToolListEntry[] = [];
	private profiles: UniverseAgentAgentProfileSummary[] = [];
	private activeProfile: UniverseAgentAgentProfileSummary | undefined;
	private readonly pendingEnablement = new Map<string, boolean>();
	private sectionActive = false;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IInstantiationService instantiationService: IInstantiationService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();
		this.instantiationService = instantiationService;

		this.container = DOM.append(parent, $('.engine-tools-section.engine-catalog-section'));
		this.container.style.display = 'none';

		this.heading = DOM.append(this.container, $('h3.engine-section-heading'));
		this.heading.textContent = localize('ua.engineToolsSectionTitle', "Tools");
		this.heading.style.display = 'none';

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		const profileRow = DOM.append(this.container, $('.engine-tools-profile-row'));
		DOM.append(profileRow, $('label')).textContent = localize('ua.engineToolsProfileLabel', "Profile:");
		this.profileSelect = DOM.append(profileRow, $('select.engine-tools-profile-select')) as HTMLSelectElement;
		this.profileSelect.style.display = 'none';
		this._register(DOM.addDisposableListener(this.profileSelect, 'change', () => {
			const profileId = this.profileSelect.value;
			this.activeProfile = this.profiles.find(profile => profile.id === profileId);
			this.updateSaveChrome();
			this.list?.rerender();
		}));

		this.writeToolbar = DOM.append(this.container, $('.engine-catalog-write-toolbar'));
		this.writeToolbar.style.display = 'none';
		this.saveButton = this._register(new Button(this.writeToolbar, defaultButtonStyles));
		this.saveButton.label = localize('ua.engineToolsSave', "Save");
		this._register(this.saveButton.onDidClick(() => void this.savePendingEnablement()));

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
		return this.listEntries.filter(entry => entry.kind === 'tool').length;
	}

	canWrite(): boolean {
		return canPerformCatalogWrite(this.mode)
			&& this.connection.isEngineConnected()
			&& !!this.activeProfile
			&& this.activeProfile.source !== 'built_in';
	}

	isProfileSelectorVisible(): boolean {
		return this.profileSelect.style.display !== 'none';
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

	async savePendingEnablement(): Promise<boolean> {
		if (!this.canWrite() || !this.activeProfile) {
			return false;
		}
		const profileId = this.activeProfile.id;
		const prefix = `${profileId}\u0000`;
		const changes: Array<{ readonly toolName: string; readonly enabled: boolean }> = [];
		for (const [key, enabled] of this.pendingEnablement) {
			if (key.startsWith(prefix)) {
				changes.push({ toolName: key.slice(prefix.length), enabled });
			}
		}
		if (changes.length === 0) {
			return true;
		}
		const profile = applyToolEnablementChanges(summaryToProfileDetail(this.activeProfile), changes);
		try {
			const result = await this.connection.saveAgentProfile({ profile });
			if (!result.profile.id) {
				return false;
			}
			this.activeProfile = {
				...this.activeProfile,
				disabledTools: result.profile.disabledTools,
				enabledTools: result.profile.enabledTools,
				whitelistMode: result.profile.whitelistMode,
			};
			const index = this.profiles.findIndex(entry => entry.id === profileId);
			if (index >= 0) {
				this.profiles[index] = this.activeProfile;
			}
			for (const key of [...this.pendingEnablement.keys()]) {
				if (key.startsWith(prefix)) {
					this.pendingEnablement.delete(key);
				}
			}
			this.updateSaveChrome();
			this.list?.rerender();
			return true;
		} catch {
			return false;
		}
	}

	async toggleTool(tool: UniverseAgentToolSummary, enabled: boolean): Promise<boolean> {
		if (!this.canWrite() || !this.activeProfile) {
			return false;
		}
		const profile = applyToolEnablementChange(
			summaryToProfileDetail(this.activeProfile),
			tool.name,
			enabled,
		);
		try {
			const result = await this.connection.saveAgentProfile({ profile });
			if (!result.profile.id) {
				return false;
			}
			this.activeProfile = {
				...this.activeProfile,
				disabledTools: result.profile.disabledTools,
				enabledTools: result.profile.enabledTools,
				whitelistMode: result.profile.whitelistMode,
			};
			const index = this.profiles.findIndex(entry => entry.id === this.activeProfile!.id);
			if (index >= 0) {
				this.profiles[index] = this.activeProfile;
			}
			this.pendingEnablement.delete(toolEnablementPendingKey(this.activeProfile.id, tool.name));
			this.updateSaveChrome();
			this.list?.rerender();
			return true;
		} catch {
			return false;
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

	private setPendingEnablement(tool: UniverseAgentToolSummary, enabled: boolean): void {
		if (!this.activeProfile || !this.canWrite()) {
			return;
		}
		this.pendingEnablement.set(toolEnablementPendingKey(this.activeProfile.id, tool.name), enabled);
		this.updateSaveChrome();
		this.list?.rerender();
	}

	private updateSaveChrome(): void {
		const visible = this.canWrite();
		this.writeToolbar.style.display = visible ? '' : 'none';
		this.saveButton.enabled = visible && this.isToolEnablementDirty();
	}

	private ensureList(): WorkbenchList<EngineToolListEntry> {
		if (!this.list) {
			this.list = this._register(this.instantiationService.createInstance(
				WorkbenchList,
				'EngineTools',
				this.listContainer,
				new EngineToolListDelegate(),
				[
					new EngineToolGroupRenderer(),
					new EngineToolRowRenderer(
						() => this.canWrite(),
						toolName => this.isToolEnabled(toolName),
						(tool, enabled) => this.setPendingEnablement(tool, enabled),
					),
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
		}
		return this.list;
	}

	private async refresh(): Promise<void> {
		const capabilities = this.connection.getCapabilitySnapshot();
		const connected = this.connection.isEngineConnected();
		const support = capabilities.tools.support;

		if (!connected) {
			this.clearCatalogPresentation();
			this.mode = resolveEngineCatalogPaneMode(false, support);
			this.renderStatus();
			return;
		}

		if (support === 'UNSUPPORTED') {
			this.clearCatalogPresentation();
			this.mode = resolveEngineCatalogPaneMode(true, support);
			this.renderStatus({ reason: capabilities.tools.reason });
			return;
		}

		if (support === 'UNKNOWN') {
			this.mode = resolveEngineCatalogPaneMode(true, support);
			this.updateSaveChrome();
			this.renderStatus({ loadingKind: 'capability' });
			return;
		}

		this.mode = resolveEngineCatalogPaneMode(true, support, { kind: 'inFlight' });
		this.updateSaveChrome();
		this.renderStatus({ loadingKind: 'list' });

		try {
			const [toolsResult, profilesResult] = await Promise.all([
				this.connection.listTools(),
				this.connection.listAgentProfiles(),
			]);
			if (!this.connection.isEngineConnected()) {
				this.clearCatalogPresentation();
				this.mode = resolveEngineCatalogPaneMode(false, support);
				this.renderStatus();
				return;
			}
			this.profiles = profilesResult.profiles.filter(profile => profile.source !== 'built_in');
			this.populateProfileSelect();
			this.setTools(toolsResult.tools);
			this.mode = resolveEngineCatalogPaneMode(true, support, {
				kind: 'success',
				itemCount: toolsResult.tools.length,
			});
			this.listContainer.style.display = canShowCatalogRows(this.mode) ? '' : 'none';
			this.updateSaveChrome();
			this.renderStatus();
		} catch (error) {
			this.updateSaveChrome();
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
			featureLabel: TOOLS_FEATURE,
			emptyCopy: localize('ua.engineToolsEmpty', "No engine tools yet."),
			reason: options?.reason,
			loadingKind: options?.loadingKind,
			onRetry: options?.onRetry,
			onOpenConnection: this.mode === 'disconnected'
				? () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID)
				: undefined,
		});
	}

	private populateProfileSelect(): void {
		const previousId = this.activeProfile?.id;
		this.profileSelect.textContent = '';
		if (this.profiles.length === 0) {
			this.profileSelect.style.display = 'none';
			this.activeProfile = undefined;
			this.updateSaveChrome();
			return;
		}
		this.profileSelect.style.display = '';
		for (const profile of this.profiles) {
			const option = document.createElement('option');
			option.value = profile.id;
			option.textContent = profile.name || profile.id;
			this.profileSelect.appendChild(option);
		}
		this.activeProfile = this.profiles.find(profile => profile.id === previousId) ?? this.profiles[0];
		this.profileSelect.value = this.activeProfile.id;
		this.updateSaveChrome();
	}

	private clearCatalogPresentation(): void {
		this.listEntries = [];
		this.list?.splice(0, this.list?.length ?? 0, []);
		this.activeProfile = undefined;
		this.profiles = [];
		this.pendingEnablement.clear();
		this.status.hide();
		this.listContainer.style.display = 'none';
		this.profileSelect.style.display = 'none';
		this.profileSelect.textContent = '';
		this.updateSaveChrome();
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
			});
			for (const tool of group.tools) {
				entries.push({ kind: 'tool', tool });
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
}
