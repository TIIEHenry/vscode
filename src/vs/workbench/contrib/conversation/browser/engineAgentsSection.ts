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
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentAgentProfileDetail, UniverseAgentAgentProfileSource, UniverseAgentAgentProfileSummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import {
	type EngineCatalogPaneMode,
	canPerformCatalogWrite,
	getCatalogTransportFailedCopy,
	getCatalogUnsupportedCopy,
	getCatalogUnknownCopy,
	resolveEngineCatalogPaneMode,
	shouldHideCatalogRows,
} from './engineCatalog.js';
import { summaryToProfileDetail } from './engineToolProfile.js';

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
	private readonly statusMessage: HTMLElement;
	private readonly writeToolbar: HTMLElement;
	private readonly listContainer: HTMLElement;
	private readonly list: WorkbenchList<EngineAgentListEntry>;

	private mode: EngineCatalogPaneMode = 'disconnected';
	private listEntries: EngineAgentListEntry[] = [];
	private selectedProfile: UniverseAgentAgentProfileSummary | undefined;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-agents-section.engine-catalog-section'));
		this.container.style.display = 'none';

		const heading = DOM.append(this.container, $('h3'));
		heading.textContent = localize('ua.engineAgentsSectionTitle', "Agents");

		this.statusMessage = DOM.append(this.container, $('.engine-catalog-status'));
		this.statusMessage.style.display = 'none';

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

		this._register(this.list.onDidChangeSelection(e => {
			const entry = e.elements[0];
			this.selectedProfile = entry?.kind === 'profile' ? entry.profile : undefined;
		}));

		this._register(this.connection.onDidChangeConnection(() => {
			void this.refresh();
		}));

		void this.refresh();
	}

	layout(width: number, listHeight: number): void {
		this.list.layout(Math.max(80, listHeight), width);
	}

	getDomNode(): HTMLElement {
		return this.container;
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

	private async refresh(): Promise<void> {
		this.clearCatalogPresentation();
		this.selectedProfile = undefined;

		const capabilities = this.connection.getCapabilitySnapshot();
		this.mode = resolveEngineCatalogPaneMode(
			this.connection.isEngineConnected(),
			capabilities.agentProfiles.support,
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
				: getCatalogUnsupportedCopy(AGENTS_FEATURE, capabilities.agentProfiles.reason);
			return;
		}

		this.listContainer.style.display = '';
		this.writeToolbar.style.display = canPerformCatalogWrite(this.mode) ? '' : 'none';

		try {
			const result = await this.connection.listAgentProfiles();
			if (this.mode !== 'supported' || !this.connection.isEngineConnected()) {
				this.clearCatalogPresentation();
				return;
			}
			this.setProfiles(result.profiles);
		} catch {
			this.clearCatalogPresentation();
			this.statusMessage.style.display = '';
			this.statusMessage.textContent = getCatalogTransportFailedCopy(AGENTS_FEATURE);
		}
	}

	private clearCatalogPresentation(): void {
		this.listEntries = [];
		this.list.splice(0, this.list.length, []);
		this.statusMessage.style.display = 'none';
		this.statusMessage.textContent = '';
		this.listContainer.style.display = 'none';
		this.writeToolbar.style.display = 'none';
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
