/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Checkbox } from '../../../../base/browser/ui/toggle/toggle.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentAgentProfileSummary, UniverseAgentToolSummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultCheckboxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import {
	type EngineCatalogPaneMode,
	canPerformCatalogWrite,
	getCatalogTransportFailedCopy,
	getCatalogUnsupportedCopy,
	getCatalogUnknownCopy,
	resolveEngineCatalogPaneMode,
	shouldHideCatalogRows,
} from './engineCatalog.js';
import { getEngineSectionDisconnectedCopy } from './engineSectionChrome.js';
import { applyToolEnablementChange, isToolEnabledInProfile, summaryToProfileDetail } from './engineToolProfile.js';

const $ = DOM.$;

const TOOLS_FEATURE = localize('ua.engineToolsFeatureLabel', "engine tools");

type EngineToolListEntry = { readonly kind: 'tool'; readonly tool: UniverseAgentToolSummary };

class EngineToolListDelegate implements IListVirtualDelegate<EngineToolListEntry> {
	getHeight(_entry: EngineToolListEntry): number {
		return 36;
	}

	getTemplateId(_entry: EngineToolListEntry): string {
		return 'toolRow';
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
		return entry.tool.name;
	}
}

export class EngineToolsSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly heading: HTMLElement;
	private readonly statusMessage: HTMLElement;
	private readonly profileSelect: HTMLSelectElement;
	private readonly listContainer: HTMLElement;
	private readonly instantiationService: IInstantiationService;
	private list: WorkbenchList<EngineToolListEntry> | undefined;

	private mode: EngineCatalogPaneMode = 'disconnected';
	private listEntries: EngineToolListEntry[] = [];
	private profiles: UniverseAgentAgentProfileSummary[] = [];
	private activeProfile: UniverseAgentAgentProfileSummary | undefined;
	private sectionActive = false;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();
		this.instantiationService = instantiationService;

		this.container = DOM.append(parent, $('.engine-tools-section.engine-catalog-section'));
		this.container.style.display = 'none';

		this.heading = DOM.append(this.container, $('h3.engine-section-heading'));
		this.heading.textContent = localize('ua.engineToolsSectionTitle', "Tools");
		this.heading.style.display = 'none';

		this.statusMessage = DOM.append(this.container, $('.engine-catalog-status'));
		this.statusMessage.style.display = 'none';

		const profileRow = DOM.append(this.container, $('.engine-tools-profile-row'));
		DOM.append(profileRow, $('label')).textContent = localize('ua.engineToolsProfileLabel', "Profile:");
		this.profileSelect = DOM.append(profileRow, $('select.engine-tools-profile-select')) as HTMLSelectElement;
		this.profileSelect.style.display = 'none';
		this._register(DOM.addDisposableListener(this.profileSelect, 'change', () => {
			const profileId = this.profileSelect.value;
			this.activeProfile = this.profiles.find(profile => profile.id === profileId);
			this.list?.rerender();
		}));

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
		return this.listEntries.length;
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
		return isToolEnabledInProfile(toolName, this.activeProfile);
	}

	private ensureList(): WorkbenchList<EngineToolListEntry> {
		if (!this.list) {
			this.list = this._register(this.instantiationService.createInstance(
				WorkbenchList,
				'EngineTools',
				this.listContainer,
				new EngineToolListDelegate(),
				[new EngineToolRowRenderer(
					() => this.canWrite(),
					toolName => this.isToolEnabled(toolName),
					(tool, enabled) => void this.toggleTool(tool, enabled),
				)],
				{
					identityProvider: {
						getId: (entry: EngineToolListEntry) => `tool:${entry.tool.name}`,
					},
					accessibilityProvider: new EngineToolListAccessibilityProvider(),
				},
			)) as WorkbenchList<EngineToolListEntry>;
		}
		return this.list;
	}

	private async refresh(): Promise<void> {
		this.clearCatalogPresentation();
		this.activeProfile = undefined;
		this.profiles = [];

		const capabilities = this.connection.getCapabilitySnapshot();
		this.mode = resolveEngineCatalogPaneMode(
			this.connection.isEngineConnected(),
			capabilities.tools.support,
		);

		if (this.mode === 'disconnected') {
			this.statusMessage.style.display = '';
			this.statusMessage.textContent = getEngineSectionDisconnectedCopy();
			return;
		}

		if (shouldHideCatalogRows(this.mode)) {
			this.statusMessage.style.display = '';
			this.statusMessage.textContent = this.mode === 'unknown'
				? getCatalogUnknownCopy()
				: getCatalogUnsupportedCopy(TOOLS_FEATURE, capabilities.tools.reason);
			return;
		}

		this.listContainer.style.display = '';

		try {
			const [toolsResult, profilesResult] = await Promise.all([
				this.connection.listTools(),
				this.connection.listAgentProfiles(),
			]);
			if (this.mode !== 'supported' || !this.connection.isEngineConnected()) {
				this.clearCatalogPresentation();
				return;
			}
			this.profiles = profilesResult.profiles.filter(profile => profile.source !== 'built_in');
			this.populateProfileSelect();
			this.setTools(toolsResult.tools);
		} catch {
			this.clearCatalogPresentation();
			this.statusMessage.style.display = '';
			this.statusMessage.textContent = getCatalogTransportFailedCopy(TOOLS_FEATURE);
		}
	}

	private populateProfileSelect(): void {
		this.profileSelect.textContent = '';
		if (this.profiles.length === 0) {
			this.profileSelect.style.display = 'none';
			this.activeProfile = undefined;
			return;
		}
		this.profileSelect.style.display = '';
		for (const profile of this.profiles) {
			const option = document.createElement('option');
			option.value = profile.id;
			option.textContent = profile.name || profile.id;
			this.profileSelect.appendChild(option);
		}
		this.activeProfile = this.profiles[0];
		this.profileSelect.value = this.activeProfile.id;
	}

	private clearCatalogPresentation(): void {
		this.listEntries = [];
		this.list?.splice(0, this.list?.length ?? 0, []);
		this.statusMessage.style.display = 'none';
		this.statusMessage.textContent = '';
		this.listContainer.style.display = 'none';
		this.profileSelect.style.display = 'none';
		this.profileSelect.textContent = '';
	}

	private setTools(tools: readonly UniverseAgentToolSummary[]): void {
		const entries: EngineToolListEntry[] = tools.map(tool => ({ kind: 'tool', tool }));
		this.listEntries = entries;
		if (entries.length === 0) {
			this.list?.splice(0, this.list?.length ?? 0, []);
			return;
		}
		const list = this.ensureList();
		list.splice(0, list.length, entries);
	}
}
