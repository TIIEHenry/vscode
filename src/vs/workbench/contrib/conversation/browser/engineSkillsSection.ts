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
import type { UniverseAgentSkillSource, UniverseAgentSkillSummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultButtonStyles, defaultCheckboxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { canPerformCatalogWrite, canShowCatalogRows } from './engineCatalog.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import {
	EngineSkillsPaneMode,
	canEditSkillBody,
	getDefaultNewSkillContent,
	getDefaultNewSkillName,
	getSkillSourceGroupLabel,
	getSkillToggleFreezeNotice,
	groupSkillsBySource,
	isSkillBodyDirty,
	resolveEngineSkillsPaneMode,
} from './engineSkillCatalog.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';

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
		templateData.checkbox.dispose();
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
	private readonly heading: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly freezeNotice: HTMLElement;
	private readonly writeToolbar: HTMLElement;
	private readonly listContainer: HTMLElement;
	private readonly bodyEditor: HTMLElement;
	private readonly bodyToolbar: HTMLElement;
	private readonly bodyTextarea: HTMLTextAreaElement;
	private readonly bodyStatus: HTMLElement;
	private readonly saveButton: Button;
	private readonly instantiationService: IInstantiationService;
	private list: WorkbenchList<EngineSkillListEntry> | undefined;

	private mode: EngineSkillsPaneMode = 'disconnected';
	private listEntries: EngineSkillListEntry[] = [];
	private selectedSkill: UniverseAgentSkillSummary | undefined;
	private loadedBodySource: UniverseAgentSkillSource | undefined;
	private loadedBodyText: string | undefined;
	private bodyDirty = false;
	private bodyLoadGeneration = 0;
	private sectionActive = false;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IInstantiationService instantiationService: IInstantiationService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super();
		this.instantiationService = instantiationService;

		this.container = DOM.append(parent, $('.engine-skills-section'));
		this.container.style.display = 'none';

		this.heading = DOM.append(this.container, $('h3.engine-section-heading'));
		this.heading.textContent = localize('ua.engineSkillsSectionTitle', "Skills");
		this.heading.style.display = 'none';

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		this.freezeNotice = DOM.append(this.container, $('.engine-skills-freeze-notice'));
		this.freezeNotice.textContent = getSkillToggleFreezeNotice();
		this.freezeNotice.style.display = 'none';

		this.writeToolbar = DOM.append(this.container, $('.engine-catalog-write-toolbar'));
		this.writeToolbar.style.display = 'none';
		const newButton = this._register(new Button(this.writeToolbar, defaultButtonStyles));
		newButton.label = localize('ua.engineSkillsNew', "New");
		this._register(newButton.onDidClick(() => void this.createSkill()));

		this.listContainer = DOM.append(this.container, $('.engine-skills-list'));

		this.bodyEditor = DOM.append(this.container, $('.engine-skill-body-editor'));
		this.bodyEditor.style.display = 'none';

		this.bodyToolbar = DOM.append(this.bodyEditor, $('.engine-skill-body-toolbar'));
		this.bodyToolbar.style.display = 'none';
		this.saveButton = this._register(new Button(this.bodyToolbar, defaultButtonStyles));
		this.saveButton.label = localize('ua.engineSkillBodySave', "Save");
		this._register(this.saveButton.onDidClick(() => void this.saveSelectedSkillBody()));

		this.bodyTextarea = DOM.append(this.bodyEditor, $('textarea.engine-skill-body-textarea')) as HTMLTextAreaElement;
		this.bodyTextarea.rows = 10;
		this.bodyTextarea.spellcheck = false;
		this.bodyTextarea.setAttribute('aria-label', localize('ua.engineSkillBodyEditor', "Skill body"));
		this._register(DOM.addDisposableListener(this.bodyTextarea, 'input', () => {
			this.bodyDirty = isSkillBodyDirty(this.bodyTextarea.value, this.loadedBodyText);
		}));

		this.bodyStatus = DOM.append(this.bodyEditor, $('.engine-skill-body-status'));
		this.bodyStatus.style.display = 'none';

		this._register(this.connection.onDidChangeConnection(() => {
			void this.refresh();
		}));

		void this.refresh();
	}

	layout(width: number, listHeight: number): void {
		this.list?.layout(Math.max(120, listHeight), width);
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

	getMode(): EngineSkillsPaneMode {
		return this.mode;
	}

	getListEntryCount(): number {
		return this.listEntries.filter(entry => entry.kind === 'skill').length;
	}

	canWrite(): boolean {
		return canPerformCatalogWrite(this.mode) && this.connection.isEngineConnected();
	}

	isBodyEditorVisible(): boolean {
		return this.bodyEditor.style.display !== 'none';
	}

	isSaveToolbarVisible(): boolean {
		return this.bodyToolbar.style.display !== 'none';
	}

	isWriteToolbarVisible(): boolean {
		return this.writeToolbar.style.display !== 'none';
	}

	getSelectedSkillBody(): string {
		return this.bodyTextarea.value;
	}

	getSelectedSkillName(): string | undefined {
		return this.selectedSkill?.name;
	}

	isSkillBodyDirty(): boolean {
		return this.bodyDirty;
	}

	/** Test hook: programmatically select a skill row by name. */
	selectSkillForTest(name: string): void {
		if (!this.list) {
			return;
		}
		const index = this.listEntries.findIndex(entry => entry.kind === 'skill' && entry.skill.name === name);
		if (index >= 0) {
			this.list.setSelection([index]);
		}
	}

	async createSkill(options?: { skillName?: string; content?: string }): Promise<boolean> {
		if (!this.canWrite() || !this.connection.saveSkillContent) {
			return false;
		}
		const skillName = options?.skillName ?? getDefaultNewSkillName();
		const content = options?.content ?? getDefaultNewSkillContent(skillName);
		try {
			const result = await this.connection.saveSkillContent({ skillName, content });
			if (!result.ok) {
				return false;
			}
			await this.refresh();
			if (!this.canWrite()) {
				return false;
			}
			this.selectSkillForTest(skillName);
			return true;
		} catch {
			return false;
		}
	}

	async saveSelectedSkillBody(content?: string): Promise<boolean> {
		if (!this.canWrite() || !this.selectedSkill || !this.connection.saveSkillContent) {
			return false;
		}
		if (!canEditSkillBody(this.loadedBodySource ?? this.selectedSkill.source)) {
			return false;
		}
		const payload = content ?? this.bodyTextarea.value;
		try {
			const result = await this.connection.saveSkillContent({
				skillName: this.selectedSkill.name,
				content: payload,
			});
			if (!result.ok) {
				this.showBodyStatus(localize(
					'ua.engineSkillBodySaveFailed',
					"Could not save skill content to the engine.",
				));
				return false;
			}
			this.hideBodyStatus();
			this.loadedBodyText = payload;
			this.bodyDirty = false;
			await this.loadSkillBody(this.selectedSkill);
			return true;
		} catch {
			this.showBodyStatus(localize(
				'ua.engineSkillBodySaveFailed',
				"Could not save skill content to the engine.",
			));
			return false;
		}
	}

	private async refresh(): Promise<void> {
		const capabilities = this.connection.getCapabilitySnapshot();
		const connected = this.connection.isEngineConnected();
		const support = capabilities.skills.support;

		if (!connected) {
			this.clearCatalogPresentation();
			this.mode = resolveEngineSkillsPaneMode(false, support);
			this.renderStatus();
			return;
		}

		if (support === 'UNSUPPORTED') {
			this.clearCatalogPresentation();
			this.mode = resolveEngineSkillsPaneMode(true, support);
			this.renderStatus({ reason: capabilities.skills.reason });
			return;
		}

		if (support === 'UNKNOWN') {
			this.mode = resolveEngineSkillsPaneMode(true, support, { kind: 'none' });
			this.writeToolbar.style.display = 'none';
			this.renderStatus({ loadingKind: 'capability' });
			return;
		}

		this.mode = resolveEngineSkillsPaneMode(true, support, { kind: 'inFlight' });
		this.writeToolbar.style.display = 'none';
		this.renderStatus({ loadingKind: 'list' });

		try {
			const result = await this.connection.listSkills();
			if (!this.connection.isEngineConnected()) {
				this.clearCatalogPresentation();
				this.mode = resolveEngineSkillsPaneMode(false, support);
				this.renderStatus();
				return;
			}
			this.setSkills(result.skills);
			this.mode = resolveEngineSkillsPaneMode(true, support, {
				kind: 'success',
				itemCount: result.skills.length,
			});
			this.freezeNotice.style.display = '';
			this.writeToolbar.style.display = this.canWrite() && !!this.connection.saveSkillContent ? '' : 'none';
			this.listContainer.style.display = canShowCatalogRows(this.mode) ? '' : 'none';
			this.bodyEditor.style.display = canShowCatalogRows(this.mode) ? '' : 'none';
			this.renderStatus();
		} catch (error) {
			this.writeToolbar.style.display = 'none';
			this.mode = resolveEngineSkillsPaneMode(true, support, {
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
			featureLabel: localize('ua.engineSkillsFeatureLabel', "a skills API"),
			emptyCopy: localize('ua.engineSkillsEmpty', "No skills yet."),
			reason: options?.reason,
			loadingKind: options?.loadingKind,
			onRetry: options?.onRetry,
			onOpenConnection: this.mode === 'disconnected'
				? () => void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID)
				: undefined,
		});
	}

	private ensureList(): WorkbenchList<EngineSkillListEntry> {
		if (!this.list) {
			this.list = this._register(this.instantiationService.createInstance(
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
					this.selectedSkill = entry.skill;
					void this.loadSkillBody(entry.skill);
				} else {
					this.selectedSkill = undefined;
					this.clearBodyEditor();
				}
			}));
		}
		return this.list;
	}

	private clearCatalogPresentation(): void {
		this.listEntries = [];
		this.list?.splice(0, this.list?.length ?? 0, []);
		this.selectedSkill = undefined;
		this.loadedBodySource = undefined;
		this.loadedBodyText = undefined;
		this.bodyDirty = false;
		this.bodyLoadGeneration++;
		this.status.hide();
		this.freezeNotice.style.display = 'none';
		this.writeToolbar.style.display = 'none';
		this.listContainer.style.display = 'none';
		this.bodyEditor.style.display = 'none';
		this.clearBodyEditor();
	}

	private clearBodyEditor(): void {
		this.bodyTextarea.value = '';
		this.bodyTextarea.readOnly = true;
		this.bodyToolbar.style.display = 'none';
		this.loadedBodyText = undefined;
		this.bodyDirty = false;
		this.hideBodyStatus();
	}

	private showBodyStatus(message: string): void {
		this.bodyStatus.style.display = '';
		this.bodyStatus.textContent = message;
	}

	private hideBodyStatus(): void {
		this.bodyStatus.style.display = 'none';
		this.bodyStatus.textContent = '';
	}

	private updateBodyEditorChrome(source: UniverseAgentSkillSource | undefined): void {
		const editable = this.canWrite()
			&& !!this.connection.saveSkillContent
			&& !!source
			&& canEditSkillBody(source);
		this.bodyTextarea.readOnly = !editable;
		this.bodyToolbar.style.display = editable ? '' : 'none';
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
		if (entries.length === 0) {
			this.list?.splice(0, this.list?.length ?? 0, []);
			if (!this.bodyDirty) {
				this.clearBodyEditor();
			}
			return;
		}
		const list = this.ensureList();
		list.splice(0, list.length, entries);
		this.restoreSkillSelection();
	}

	private restoreSkillSelection(): void {
		const name = this.selectedSkill?.name;
		if (!name || !this.list) {
			return;
		}
		const index = this.listEntries.findIndex(entry => entry.kind === 'skill' && entry.skill.name === name);
		if (index < 0) {
			this.selectedSkill = undefined;
			if (!this.bodyDirty) {
				this.clearBodyEditor();
			}
			return;
		}
		const entry = this.listEntries[index];
		if (entry?.kind === 'skill') {
			this.selectedSkill = entry.skill;
		}
		this.list.setSelection([index]);
	}

	private async toggleSkill(skill: UniverseAgentSkillSummary, enabled: boolean): Promise<void> {
		if (!canShowCatalogRows(this.mode) || !this.connection.isEngineConnected()) {
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
		if (!canShowCatalogRows(this.mode) || !this.connection.isEngineConnected()) {
			if (!this.bodyDirty) {
				this.clearBodyEditor();
			}
			return;
		}
		if (this.bodyDirty && this.selectedSkill?.name === skill.name) {
			this.updateBodyEditorChrome(this.loadedBodySource ?? skill.source);
			return;
		}
		const generation = ++this.bodyLoadGeneration;
		this.bodyTextarea.value = '';
		this.hideBodyStatus();
		try {
			const info = await this.connection.getSkillInfo({ skillName: skill.name });
			if (generation !== this.bodyLoadGeneration
				|| !canShowCatalogRows(this.mode)
				|| !this.connection.isEngineConnected()
				|| this.selectedSkill?.name !== skill.name) {
				return;
			}
			this.loadedBodySource = info.source;
			this.loadedBodyText = info.content;
			this.bodyTextarea.value = info.content;
			this.bodyDirty = false;
			this.updateBodyEditorChrome(info.source);
		} catch {
			if (generation !== this.bodyLoadGeneration || this.selectedSkill?.name !== skill.name) {
				return;
			}
			this.loadedBodySource = undefined;
			this.bodyTextarea.value = '';
			this.bodyTextarea.readOnly = true;
			this.bodyToolbar.style.display = 'none';
			this.showBodyStatus(localize('ua.engineSkillBodyLoadFailed', "Could not load skill content from the engine."));
		}
	}
}
