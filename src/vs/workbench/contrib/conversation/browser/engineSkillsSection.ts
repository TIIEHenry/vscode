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
import type { UniverseAgentSkillSummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultCheckboxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import {
	EngineSkillsPaneMode,
	getSkillSourceGroupLabel,
	getSkillsUnknownCopy,
	getSkillsUnsupportedCopy,
	getSkillToggleFreezeNotice,
	groupSkillsBySource,
	resolveEngineSkillsPaneMode,
	shouldHideSkillCatalogRows,
} from './engineSkillCatalog.js';

const $ = DOM.$;

type EngineSkillListEntry =
	| { readonly kind: 'group'; readonly source: UniverseAgentSkillSummary['source']; readonly label: string }
	| { readonly kind: 'skill'; readonly skill: UniverseAgentSkillSummary };

class EngineSkillListDelegate implements IListVirtualDelegate<EngineSkillListEntry> {
	getHeight(entry: EngineSkillListEntry): number {
		return entry.kind === 'group' ? 28 : 36;
	}

	getTemplateId(entry: EngineSkillListEntry): string {
		return entry.kind === 'group' ? 'skillGroup' : 'skillRow';
	}
}

interface ISkillGroupTemplateData {
	readonly label: HTMLElement;
}

interface ISkillRowTemplateData {
	readonly row: HTMLElement;
	readonly checkbox: Checkbox;
	readonly name: HTMLElement;
	readonly description: HTMLElement;
	skill: UniverseAgentSkillSummary | undefined;
	readonly checkboxDisposable: { dispose(): void };
}

class EngineSkillGroupRenderer implements IListRenderer<EngineSkillListEntry, ISkillGroupTemplateData> {
	static readonly TEMPLATE_ID = 'skillGroup';
	readonly templateId = EngineSkillGroupRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): ISkillGroupTemplateData {
		container.classList.add('engine-skill-group');
		return { label: DOM.append(container, $('.engine-skill-group-label')) };
	}

	renderElement(entry: EngineSkillListEntry, _index: number, templateData: ISkillGroupTemplateData): void {
		if (entry.kind !== 'group') {
			return;
		}
		templateData.label.textContent = entry.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

class EngineSkillRowRenderer implements IListRenderer<EngineSkillListEntry, ISkillRowTemplateData> {
	static readonly TEMPLATE_ID = 'skillRow';
	readonly templateId = EngineSkillRowRenderer.TEMPLATE_ID;

	constructor(
		private readonly onToggle: (skill: UniverseAgentSkillSummary, enabled: boolean) => void,
	) { }

	renderTemplate(container: HTMLElement): ISkillRowTemplateData {
		const row = DOM.append(container, $('.engine-skill-row'));
		const checkbox = new Checkbox('', false, defaultCheckboxStyles);
		const checkboxDisposable = checkbox.onChange(() => {
			const skill = (row as unknown as { __skill?: UniverseAgentSkillSummary }).__skill;
			if (skill) {
				this.onToggle(skill, checkbox.checked);
			}
		});
		row.appendChild(checkbox.domNode);
		const text = DOM.append(row, $('.engine-skill-text'));
		const name = DOM.append(text, $('.engine-skill-name'));
		const description = DOM.append(text, $('.engine-skill-description'));
		return { row, checkbox, name, description, skill: undefined, checkboxDisposable: { dispose: () => checkboxDisposable.dispose() } };
	}

	renderElement(entry: EngineSkillListEntry, _index: number, templateData: ISkillRowTemplateData): void {
		if (entry.kind !== 'skill') {
			return;
		}
		templateData.skill = entry.skill;
		(templateData.row as unknown as { __skill?: UniverseAgentSkillSummary }).__skill = entry.skill;
		templateData.name.textContent = entry.skill.name;
		templateData.description.textContent = entry.skill.description ?? '';
		templateData.checkbox.checked = entry.skill.enabled;
	}

	disposeTemplate(templateData: ISkillRowTemplateData): void {
		templateData.checkboxDisposable.dispose();
	}
}

class EngineSkillListAccessibilityProvider implements IListAccessibilityProvider<EngineSkillListEntry> {
	getWidgetAriaLabel(): string {
		return localize('ua.engineSkillsList', "Engine skills");
	}

	getAriaLabel(entry: EngineSkillListEntry): string {
		if (entry.kind === 'group') {
			return entry.label;
		}
		return entry.skill.name;
	}
}

export class EngineSkillsSection extends Disposable {

	private readonly container: HTMLElement;
	private readonly statusMessage: HTMLElement;
	private readonly freezeNotice: HTMLElement;
	private readonly listContainer: HTMLElement;
	private readonly bodyPreview: HTMLElement;
	private readonly list: WorkbenchList<EngineSkillListEntry>;

	private mode: EngineSkillsPaneMode = 'disconnected';
	private listEntries: EngineSkillListEntry[] = [];

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();

		this.container = DOM.append(parent, $('.engine-skills-section'));
		this.container.style.display = 'none';

		const heading = DOM.append(this.container, $('h3'));
		heading.textContent = localize('ua.engineSkillsSectionTitle', "Skills");

		this.statusMessage = DOM.append(this.container, $('.engine-skills-status'));
		this.statusMessage.style.display = 'none';

		this.freezeNotice = DOM.append(this.container, $('.engine-skills-freeze-notice'));
		this.freezeNotice.textContent = getSkillToggleFreezeNotice();
		this.freezeNotice.style.display = 'none';

		this.listContainer = DOM.append(this.container, $('.engine-skills-list'));
		this.list = this._register(instantiationService.createInstance(
			WorkbenchList,
			'EngineSkills',
			this.listContainer,
			new EngineSkillListDelegate(),
			[
				new EngineSkillGroupRenderer(),
				new EngineSkillRowRenderer((skill, enabled) => this.toggleSkill(skill, enabled)),
			],
			{
				identityProvider: {
					getId: (entry: EngineSkillListEntry) => entry.kind === 'group'
						? `group:${entry.source}`
						: `skill:${entry.skill.name}`,
				},
				accessibilityProvider: new EngineSkillListAccessibilityProvider(),
			},
		)) as WorkbenchList<EngineSkillListEntry>;

		this._register(this.list.onDidChangeSelection(e => {
			const entry = e.elements[0];
			if (entry?.kind === 'skill') {
				void this.loadSkillBody(entry.skill);
			}
		}));

		this.bodyPreview = DOM.append(this.container, $('.engine-skill-body-preview'));
		this.bodyPreview.style.display = 'none';

		this._register(this.connection.onDidChangeConnection(() => {
			void this.refresh();
		}));

		void this.refresh();
	}

	layout(width: number, listHeight: number): void {
		this.list.layout(Math.max(120, listHeight), width);
	}

	getDomNode(): HTMLElement {
		return this.container;
	}

	getMode(): EngineSkillsPaneMode {
		return this.mode;
	}

	getListEntryCount(): number {
		return this.listEntries.filter(entry => entry.kind === 'skill').length;
	}

	private async refresh(): Promise<void> {
		this.clearCatalogPresentation();

		const capabilities = this.connection.getCapabilitySnapshot();
		this.mode = resolveEngineSkillsPaneMode(
			this.connection.isEngineConnected(),
			capabilities.skills.support,
		);

		if (this.mode === 'disconnected') {
			this.container.style.display = 'none';
			return;
		}

		this.container.style.display = '';

		if (shouldHideSkillCatalogRows(this.mode)) {
			this.statusMessage.style.display = '';
			this.statusMessage.textContent = this.mode === 'unknown'
				? getSkillsUnknownCopy()
				: getSkillsUnsupportedCopy(capabilities.skills.reason);
			return;
		}

		this.freezeNotice.style.display = '';
		this.listContainer.style.display = '';
		this.bodyPreview.style.display = '';

		try {
			const result = await this.connection.listSkills();
			if (this.mode !== 'supported' || !this.connection.isEngineConnected()) {
				this.clearCatalogPresentation();
				return;
			}
			this.setSkills(result.skills);
		} catch {
			this.clearCatalogPresentation();
			this.statusMessage.style.display = '';
			this.statusMessage.textContent = localize(
				'ua.engineSkillsTransportFailed',
				"Could not load skills from the engine.",
			);
		}
	}

	private clearCatalogPresentation(): void {
		this.listEntries = [];
		this.list.splice(0, this.list.length, []);
		this.statusMessage.style.display = 'none';
		this.statusMessage.textContent = '';
		this.freezeNotice.style.display = 'none';
		this.listContainer.style.display = 'none';
		this.bodyPreview.style.display = 'none';
		this.bodyPreview.textContent = '';
	}

	private setSkills(skills: readonly UniverseAgentSkillSummary[]): void {
		const entries: EngineSkillListEntry[] = [];
		for (const [source, group] of groupSkillsBySource(skills)) {
			entries.push({ kind: 'group', source, label: getSkillSourceGroupLabel(source) });
			for (const skill of group) {
				entries.push({ kind: 'skill', skill });
			}
		}
		this.listEntries = entries;
		this.list.splice(0, this.list.length, entries);
	}

	private async toggleSkill(skill: UniverseAgentSkillSummary, enabled: boolean): Promise<void> {
		if (this.mode !== 'supported' || !this.connection.isEngineConnected()) {
			return;
		}
		try {
			const result = await this.connection.setSkillEnabled({ skillName: skill.name, enabled });
			if (!result.ok) {
				await this.refresh();
				return;
			}
			await this.refresh();
		} catch {
			await this.refresh();
		}
	}

	private async loadSkillBody(skill: UniverseAgentSkillSummary): Promise<void> {
		if (this.mode !== 'supported' || !this.connection.isEngineConnected()) {
			this.bodyPreview.textContent = '';
			return;
		}
		try {
			const info = await this.connection.getSkillInfo({ skillName: skill.name });
			if (this.mode !== 'supported' || !this.connection.isEngineConnected()) {
				this.bodyPreview.textContent = '';
				return;
			}
			this.bodyPreview.textContent = info.content;
		} catch {
			this.bodyPreview.textContent = localize('ua.engineSkillBodyLoadFailed', "Could not load skill content from the engine.");
		}
	}
}
