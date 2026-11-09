/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { InputBox } from '../../../../base/browser/ui/inputbox/inputBox.js';
import { Toggle } from '../../../../base/browser/ui/toggle/toggle.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentExpectedOwner } from '../../../../platform/universeAgent/common/universeAgentExpectedOwner.js';
import { ensureCapabilitySnapshot, readPublishedEngineIdentityId, readPublishedLinkId } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import { EngineRefreshGate, evaluateEngineWrite, isSameEngineWriteLink, type EngineWriteLink } from './engineWriteGate.js';
import type { UniverseAgentCapabilitySupport, UniverseAgentSkillSource, UniverseAgentSkillSummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { defaultButtonStyles, defaultInputBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { isConversationPairingHold, keepLeftoverCatalogForPairingHold } from './conversationSessionStatus.js';
import { canPerformCatalogWriteLive, canShowCatalogRows, getCatalogListLoadingCopy } from './engineCatalog.js';
import { createCatalogIconButton } from './engineCatalogIconButton.js';
import { EngineCatalogSectionController, paintEngineLinkNotice } from './engineCatalogSectionController.js';
import { EngineCatalogStatusWidget } from './engineCatalogStatus.js';
import { appendCatalogScopeNote, getEngineSectionApiUnavailableCopy, getEngineSectionDisconnectedCopy } from './engineSectionChrome.js';
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
import { writeStatus } from './connectionPreferencesPane.js';

const $ = DOM.$;

const SKILL_WRITE_FEATURE = localize('ua.engineSkillWriteFeatureLabel', "skill content write");
const SKILL_CREATE_SUCCESS_COPY = localize('ua.engineSkillCreateSuccess', "Created.");
const SKILL_TOGGLE_SUCCESS_COPY = localize('ua.engineSkillToggleSuccess', "Updated.");
const SKILL_SAVE_SUCCESS_COPY = localize('ua.engineSkillBodySaveSuccess', "Saved.");

type EngineSkillListEntry =
	| { readonly kind: 'group'; readonly source: UniverseAgentSkillSummary['source']; readonly label: string; readonly count?: number }
	| { readonly kind: 'skill'; readonly skill: UniverseAgentSkillSummary };

function getSkillToggleLabel(skillName: string, enabled: boolean): string {
	return enabled
		? localize('ua.engineSkillRowToggleDisable', "Disable {0}", skillName)
		: localize('ua.engineSkillRowToggleEnable', "Enable {0}", skillName);
}

function skillEntryHeight(entry: EngineSkillListEntry): number {
	return entry.kind === 'group' ? 28 : entry.skill.description?.trim() ? 44 : 32;
}

class EngineSkillListDelegate implements IListVirtualDelegate<EngineSkillListEntry> {
	getHeight(entry: EngineSkillListEntry): number {
		return skillEntryHeight(entry);
	}

	getTemplateId(entry: EngineSkillListEntry): string {
		return entry.kind === 'group' ? 'skillGroup' : 'skillRow';
	}
}

interface ISkillGroupTemplateData {
	readonly label: HTMLElement;
	readonly count: HTMLElement;
}

interface ISkillRowTemplateData {
	readonly row: HTMLElement;
	readonly checkbox: Toggle;
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
		const label = DOM.append(container, $('.engine-skill-group-label'));
		const count = DOM.append(container, $('.engine-skill-group-count'));
		return { label, count };
	}

	renderElement(entry: EngineSkillListEntry, _index: number, templateData: ISkillGroupTemplateData): void {
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

class EngineSkillRowRenderer implements IListRenderer<EngineSkillListEntry, ISkillRowTemplateData> {
	static readonly TEMPLATE_ID = 'skillRow';
	readonly templateId = EngineSkillRowRenderer.TEMPLATE_ID;
	private readonly templates = new Set<ISkillRowTemplateData>();

	constructor(
		private readonly canToggle: () => boolean,
		private readonly onToggle: (skill: UniverseAgentSkillSummary, enabled: boolean) => void,
	) { }

	renderTemplate(container: HTMLElement): ISkillRowTemplateData {
		const row = DOM.append(container, $('.engine-skill-row.skill-item'));
		const checkbox = new Toggle({
			title: '',
			isChecked: false,
			inputActiveOptionBackground: 'var(--ua-editor-setting-switch-track)',
			inputActiveOptionForeground: 'var(--vscode-inputOption-activeForeground)',
			inputActiveOptionBorder: 'transparent',
		});
		checkbox.domNode.setAttribute('role', 'switch');
		const checkboxDisposable = checkbox.onChange(() => {
			const skill = (row as unknown as { __skill?: UniverseAgentSkillSummary }).__skill;
			if (skill && this.canToggle()) {
				checkbox.setTitle(getSkillToggleLabel(skill.name, checkbox.checked));
				this.onToggle(skill, checkbox.checked);
			} else if (skill) {
				checkbox.checked = skill.enabled;
				checkbox.setTitle(getSkillToggleLabel(skill.name, skill.enabled));
			}
		});
		const text = DOM.append(row, $('.engine-skill-text'));
		row.appendChild(checkbox.domNode);
		const name = DOM.append(text, $('.engine-skill-name'));
		const description = DOM.append(text, $('.engine-skill-description'));
		const template = { row, checkbox, name, description, skill: undefined, checkboxDisposable: { dispose: () => checkboxDisposable.dispose() } };
		this.templates.add(template);
		return template;
	}

	renderElement(entry: EngineSkillListEntry, _index: number, templateData: ISkillRowTemplateData): void {
		if (entry.kind !== 'skill') {
			return;
		}
		templateData.skill = entry.skill;
		(templateData.row as unknown as { __skill?: UniverseAgentSkillSummary }).__skill = entry.skill;
		templateData.name.textContent = entry.skill.name;
		templateData.name.title = entry.skill.name;
		const description = entry.skill.description?.trim() ?? '';
		templateData.description.textContent = description;
		templateData.description.title = description;
		templateData.description.style.display = description ? '' : 'none';
		templateData.checkbox.setTitle(getSkillToggleLabel(entry.skill.name, entry.skill.enabled));
		templateData.checkbox.checked = entry.skill.enabled;
		this.updateTemplateChrome(templateData);
	}

	updateToggleChrome(): void {
		for (const template of this.templates) {
			if (template.skill) {
				template.checkbox.checked = template.skill.enabled;
				template.checkbox.setTitle(getSkillToggleLabel(template.skill.name, template.skill.enabled));
			}
			this.updateTemplateChrome(template);
		}
	}

	updateSkill(skillName: string, enabled: boolean): void {
		for (const template of this.templates) {
			if (template.skill?.name === skillName) {
				template.skill = { ...template.skill, enabled };
				(template.row as unknown as { __skill?: UniverseAgentSkillSummary }).__skill = template.skill;
				template.checkbox.checked = enabled;
				template.checkbox.setTitle(getSkillToggleLabel(skillName, enabled));
				this.updateTemplateChrome(template);
			}
		}
	}

	private updateTemplateChrome(templateData: ISkillRowTemplateData): void {
		templateData.checkbox.enable();
		if (!this.canToggle()) {
			templateData.checkbox.disable();
		}
	}

	disposeTemplate(templateData: ISkillRowTemplateData): void {
		this.templates.delete(templateData);
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

/**
 * Skills write success is restored after refresh only when ListSkills
 * listed (D201 sibling).
 */
export class EngineSkillsSection extends Disposable {
	private _skillsCount = 0;
	private readonly _onDidChangeItemCount = this._register(new Emitter<void>());
	readonly onDidChangeItemCount: Event<void> = this._onDidChangeItemCount.event;

	getItemCount(): number | undefined { return this._skillsCount > 0 ? this._skillsCount : undefined; }

	private setSkillsCount(count: number): void {
		if (this._skillsCount === count) {
			return;
		}
		this._skillsCount = count;
		this._onDidChangeItemCount.fire();
	}

	private readonly container: HTMLElement;
	private readonly heading: HTMLElement;
	private readonly status: EngineCatalogStatusWidget;
	private readonly freezeNotice: HTMLElement;
	private readonly writeToolbar: HTMLElement;
	private readonly writeStatus: HTMLElement;
	private readonly listContainer: HTMLElement;
	private readonly bodyEditor: HTMLElement;
	private readonly bodyToolbar: HTMLElement;
	private readonly bodyInput: InputBox;
	private readonly bodyStatus: HTMLElement;
	private readonly saveButton: Button;
	private readonly instantiationService: IInstantiationService;
	private list: WorkbenchList<EngineSkillListEntry> | undefined;
	private rowRenderer: EngineSkillRowRenderer | undefined;
	private lastLayout: { readonly width: number; readonly listHeight: number } | undefined;

	private mode: EngineSkillsPaneMode = 'disconnected';
	private listEntries: EngineSkillListEntry[] = [];
	private selectedSkill: UniverseAgentSkillSummary | undefined;
	private loadedBodySource: UniverseAgentSkillSource | undefined;
	private loadedBodyText: string | undefined;
	/** Skill name the loaded body belongs to. Not the row merely selected. */
	private loadedBodySkillName: string | undefined;
	private bodyDirty = false;
	private bodyLoadGeneration = 0;
	private bodyEditRevision = 0;
	/** Detached requests cannot release the current editor operation's lock. */
	private bodySaveOperation: object | undefined;
	private bodyDraftSuspended = false;
	private readonly draftPrompt: HTMLElement;
	private readonly draftPromptText: HTMLElement;
	private pendingSkillName: string | undefined;
	private bodyBaselineNeedsReload = false;
	private loadedBodyWriteLink: UniverseAgentExpectedOwner | undefined;
	private invalidatedOwner: UniverseAgentExpectedOwner | undefined;
	private catalogReadOwner: UniverseAgentExpectedOwner | undefined;
	private selectionReadOwner: UniverseAgentExpectedOwner | undefined;
	private catalogWriteOperation: object | undefined;
	private linkNotice: string | undefined;
	private readonly refreshGate: EngineRefreshGate;
	private readonly controller: EngineCatalogSectionController;
	private sectionActive = false;

	constructor(
		parent: HTMLElement,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IInstantiationService instantiationService: IInstantiationService,
		@ICommandService private readonly commandService: ICommandService,
		@IContextViewService contextViewService: IContextViewService,
		@IDialogService private readonly dialogService: IDialogService,
	) {
		super();
		this.instantiationService = instantiationService;
		this.refreshGate = new EngineRefreshGate(this.connection, this._store);
		this.controller = new EngineCatalogSectionController(this.connection);

		this.container = DOM.append(parent, $('.engine-skills-section'));
		this.container.style.display = 'none';

		this.heading = DOM.append(this.container, $('h3.engine-section-heading'));
		this.heading.textContent = localize('ua.engineSkillsSectionTitle', "Skills");
		this.heading.style.display = 'none';
		appendCatalogScopeNote(this.container, localize('ua.engineSkillsScope', "Project skills follow the open work root. User and bundled skills are engine-wide."));

		this.status = this._register(new EngineCatalogStatusWidget(this.container));

		this.freezeNotice = DOM.append(this.container, $('.engine-skills-freeze-notice'));
		this.freezeNotice.textContent = getSkillToggleFreezeNotice();
		this.freezeNotice.style.display = 'none';

		this.writeToolbar = DOM.append(this.container, $('.engine-catalog-write-toolbar.engine-catalog-icon-actions'));
		this.writeToolbar.style.display = 'none';
		const newButton = this._register(createCatalogIconButton(this.writeToolbar, localize('ua.engineSkillsNew', "New skill"), Codicon.add));
		this._register(newButton.onDidClick(() => {
			if (this._store.isDisposed) {
				return;
			}
			void this.promptNewSkill().catch(onUnexpectedError);
		}));
		const refreshButton = this._register(createCatalogIconButton(this.writeToolbar, localize('ua.engineSkillsRefresh', "Refresh skills"), Codicon.refresh));
		this._register(refreshButton.onDidClick(() => {
			if (this._store.isDisposed) {
				return;
			}
			void this.refresh(true).catch(onUnexpectedError);
		}));

		this.writeStatus = DOM.append(this.container, $('.engine-skill-write-status'));
		this.writeStatus.setAttribute('role', 'status');
		this.writeStatus.setAttribute('aria-live', 'polite');
		this.writeStatus.style.display = 'none';

		this.listContainer = DOM.append(this.container, $('.engine-skills-list'));

		this.bodyEditor = DOM.append(this.container, $('.engine-skill-body-editor'));
		this.bodyEditor.style.display = 'none';

		this.bodyToolbar = DOM.append(this.bodyEditor, $('.engine-skill-body-toolbar'));
		this.bodyToolbar.style.display = 'none';
		this.saveButton = this._register(new Button(this.bodyToolbar, { ...defaultButtonStyles, secondary: true }));
		this.saveButton.label = localize('ua.engineSkillBodySave', "Save");
		this._register(this.saveButton.onDidClick(() => {
			if (this._store.isDisposed) {
				return;
			}
			void this.saveSelectedSkillBody().catch(onUnexpectedError);
		}));

		this.draftPrompt = DOM.append(this.bodyEditor, $('.engine-skill-draft-prompt.engine-catalog-status-actions'));
		this.draftPrompt.setAttribute('role', 'status');
		this.draftPrompt.style.display = 'none';
		this.draftPromptText = DOM.append(this.draftPrompt, $('span.engine-skill-draft-prompt-text'));
		const draftSave = this._register(new Button(this.draftPrompt, { ...defaultButtonStyles, secondary: true }));
		draftSave.label = localize('ua.engineSkillDraftSave', "Save");
		this._register(draftSave.onDidClick(() => {
			if (this._store.isDisposed) {
				return;
			}
			void this.resolvePendingSkill('save').catch(onUnexpectedError);
		}));
		const draftDiscard = this._register(new Button(this.draftPrompt, { ...defaultButtonStyles, secondary: true }));
		draftDiscard.label = localize('ua.engineSkillDraftDiscard', "Discard");
		this._register(draftDiscard.onDidClick(() => {
			if (this._store.isDisposed) {
				return;
			}
			void this.resolvePendingSkill('discard').catch(onUnexpectedError);
		}));

		this.bodyInput = this._register(new InputBox(this.bodyEditor, contextViewService, {
			ariaLabel: localize('ua.engineSkillBodyEditor', "Skill body"),
			flexibleHeight: true,
			flexibleMaxHeight: 320,
			inputBoxStyles: defaultInputBoxStyles,
		}));
		this.bodyInput.element.classList.add('engine-skill-body-input');
		this._register(DOM.addDisposableListener(this.bodyInput.inputElement, 'input', () => {
			if (this._store.isDisposed) {
				return;
			}
			this.bodyEditRevision++;
			this.bodyDirty = isSkillBodyDirty(this.bodyInput.value, this.loadedBodyText);
		}));

		this.bodyStatus = DOM.append(this.bodyEditor, $('.engine-skill-body-status'));
		this.bodyStatus.setAttribute('role', 'status');
		this.bodyStatus.setAttribute('aria-live', 'polite');
		this.bodyStatus.style.display = 'none';

		const resizeObserver = this._register(new DOM.DisposableResizeObserver(
			'EngineSkillsSection.viewport', () => this.layoutListViewport(), DOM.getWindow(this.container),
		));
		this._register(resizeObserver.observe(this.container));

		this._register(this.connection.onDidChangeConnection(() => {
			if (this._store.isDisposed) {
				return;
			}
			void this.refresh().catch(onUnexpectedError);
		}));

		void this.refresh().catch(onUnexpectedError);
	}

	layout(width: number, listHeight: number): void {
		this.lastLayout = { width, listHeight };
		this.layoutListViewport();
	}

	private layoutListViewport(): void {
		if (!this.list || !this.lastLayout) {
			return;
		}
		const chrome = Math.max(0, DOM.getTotalHeight(this.container) - DOM.getTotalHeight(this.listContainer));
		const budget = Math.max(120, this.lastLayout.listHeight - chrome);
		const contentHeight = this.listEntries.reduce((height, entry) => height + skillEntryHeight(entry), 0);
		const height = Math.min(Math.max(80, contentHeight), budget);
		const width = DOM.getContentWidth(this.container) || this.lastLayout.width;
		this.listContainer.style.height = `${height}px`;
		this.list.layout(height, width);
	}

	override dispose(): void {
		this.refreshGate.invalidate();
		this.bodyLoadGeneration++;
		this.bodyEditRevision++;
		this.clearCatalogPresentation(false);
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
		const owner = this.catalogReadOwner;
		return !!owner && this.sameReadableOwner(owner) && canPerformCatalogWriteLive(
			this.mode,
			this.connection.isEngineConnected(),
			isConversationPairingHold(this.connection),
		);
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
		return this.bodyInput.value;
	}

	setSelectedSkillBody(value: string): void {
		this.bodyInput.value = value;
		this.bodyDirty = isSkillBodyDirty(value, this.loadedBodyText);
	}

	getSelectedSkillName(): string | undefined {
		return this.selectedSkill?.name;
	}

	isSkillBodyDirty(): boolean {
		return this.bodyDirty;
	}

	/** Test hook: programmatically select a skill row by name. */
	selectSkillForTest(name: string): void {
		this.selectSkill(name);
	}

	private selectSkill(name: string, owner?: UniverseAgentExpectedOwner): void {
		if (!this.list) {
			return;
		}
		const index = this.listEntries.findIndex(entry => entry.kind === 'skill' && entry.skill.name === name);
		if (index >= 0) {
			const previousOwner = this.selectionReadOwner;
			this.selectionReadOwner = owner;
			try { this.list.setSelection([index]); }
			finally { this.selectionReadOwner = previousOwner; }
		}
	}

	/** Test hook: programmatically select a source group header. */
	selectSkillGroupForTest(source: UniverseAgentSkillSource): void {
		if (!this.list) {
			return;
		}
		const index = this.listEntries.findIndex(entry => entry.kind === 'group' && entry.source === source);
		if (index >= 0) {
			this.list.setSelection([index]);
		}
	}

	/** Test hook: programmatically toggle a skill by name. */
	async toggleSkillForTest(name: string, enabled: boolean): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}
		const entry = this.listEntries.find(item => item.kind === 'skill' && item.skill.name === name);
		if (entry?.kind === 'skill') {
			await this.toggleSkill(entry.skill, enabled);
		}
	}

	private captureReadOwner(snapshot = this.connection.getConnectionSnapshot()): UniverseAgentExpectedOwner | undefined {
		const engineIdentityId = readPublishedEngineIdentityId(snapshot);
		const linkId = readPublishedLinkId(snapshot);
		if (!engineIdentityId || !linkId || !this.connection.isEngineConnected() || isConversationPairingHold(this.connection)
			|| (this.invalidatedOwner?.engineIdentityId === engineIdentityId && this.invalidatedOwner.linkId === linkId)) {
			return undefined;
		}
		return { engineIdentityId, linkId };
	}

	private sameReadOwner(owner: UniverseAgentExpectedOwner): boolean {
		const snapshot = this.connection.getConnectionSnapshot();
		return !this._store.isDisposed
			&& !(this.invalidatedOwner?.engineIdentityId === owner.engineIdentityId && this.invalidatedOwner.linkId === owner.linkId)
			&& readPublishedEngineIdentityId(snapshot) === owner.engineIdentityId && readPublishedLinkId(snapshot) === owner.linkId;
	}

	private sameReadableOwner(owner: UniverseAgentExpectedOwner): boolean {
		const current = this.captureReadOwner();
		return !this._store.isDisposed && current?.engineIdentityId === owner.engineIdentityId && current.linkId === owner.linkId;
	}

	private captureWriteLink(): UniverseAgentExpectedOwner | undefined {
		const owner = this.catalogReadOwner;
		return owner && this.canWrite() && this.catalogReadOwner === owner ? owner : undefined;
	}

	private sameWriteLink(link: UniverseAgentExpectedOwner): boolean {
		const owner = this.catalogReadOwner;
		return !this._store.isDisposed && !!owner
			&& owner.engineIdentityId === link.engineIdentityId && owner.linkId === link.linkId
			&& isSameEngineWriteLink(this.connection, link);
	}

	/** @returns true when the caller must stop. A disposed view stays silent. */
	private rejectWrite(link: EngineWriteLink, sent: boolean, skillName?: string, generation?: number): boolean {
		const result = evaluateEngineWrite(this._store, this.connection, {
			link,
			sent,
			targetId: skillName,
			currentTargetId: skillName === undefined ? undefined : this.selectedSkill?.name,
			generation,
			currentGeneration: generation === undefined ? undefined : this.bodyLoadGeneration,
		});
		if (result.kind === 'rejected') {
			this.showLinkNotice(result.message);
		}
		return result.kind !== 'current';
	}

	/** A rejected IPC owner revokes local authorization even before its snapshot arrives. */
	private closeInvalidOwnerChrome(owner?: UniverseAgentExpectedOwner): void {
		if (owner) { this.invalidatedOwner = owner; }
		this.refreshGate.invalidate();
		this.catalogWriteOperation = undefined;
		const keptDraft = this.suspendBodyDraft();
		if (!keptDraft) {
			this.bodyLoadGeneration++;
			this.bodySaveOperation = undefined;
			this.loadedBodyWriteLink = undefined;
			this.bodyBaselineNeedsReload = true;
			this.bodyInput.inputElement.readOnly = true;
			this.bodyToolbar.style.display = 'none';
		}
		this.mode = 'loading';
		this.status.hide();
		this.freezeNotice.style.display = 'none';
		this.writeToolbar.style.display = 'none';
		this.hideWriteStatus();
		this.closeLeftoverRowToggleChrome();
		if (keptDraft) {
			this.showSuspendedDraftStatus();
		} else {
			const copy = localize('ua.engineSkillsOwnerRecovery', "This connection is no longer current. Use Refresh skills on the original engine to reload it.");
			if (this.isBodyEditorVisible() && this.selectedSkill) { this.showBodyStatus(copy); }
			else {
				this.writeStatus.style.display = '';
				writeStatus(this.writeStatus, copy);
			}
		}
	}

	private async promptNewSkill(): Promise<void> {
		if (this._store.isDisposed || !this.canWrite() || !this.connection.saveSkillContent) {
			return;
		}
		const link = this.captureWriteLink();
		if (!link) { return; }
		this.linkNotice = undefined;
		const required = localize('ua.engineSkillNameRequired', "Skill name is required.");
		const result = await this.dialogService.input({
			type: 'question',
			message: localize('ua.engineSkillsNewTitle', "New skill"),
			detail: localize('ua.engineSkillsNewDetail', "Skill name. The body starts from the default template."),
			primaryButton: localize('ua.engineSkillsNewCreate', "Create"),
			inputs: [
				{
					type: 'text',
					label: localize('ua.engineSkillsNewName', "Skill name"),
					placeholder: localize('ua.engineSkillsNewName', "Skill name"),
				},
			],
			validate: values => (values[0] ?? '').trim() ? undefined : required,
		});
		if (this._store.isDisposed || !result.confirmed || !result.values || !this.connection.saveSkillContent) {
			return;
		}
		if (this.rejectWrite(link, false)) {
			return;
		}
		const skillName = (result.values[0] ?? '').trim();
		if (!skillName) {
			this.writeStatus.style.display = '';
			writeStatus(this.writeStatus, required, 'error');
			return;
		}
		await this.createSkill({ skillName }, link);
	}

	async createSkill(options?: { skillName?: string; content?: string }, expectedOwner?: UniverseAgentExpectedOwner): Promise<boolean> {
		if (this._store.isDisposed || !this.canWrite() || !this.connection.saveSkillContent) {
			return false;
		}
		const link = expectedOwner ?? this.captureWriteLink();
		if (!link || !this.sameWriteLink(link)) { return false; }
		const operation = {};
		this.catalogWriteOperation = operation;
		const stillCurrent = () => !this._store.isDisposed && this.catalogWriteOperation === operation && this.sameWriteLink(link);
		this.linkNotice = undefined;
		const skillName = options?.skillName ?? getDefaultNewSkillName();
		const content = options?.content ?? getDefaultNewSkillContent(skillName);
		try {
			const result = await this.connection.saveSkillContent({ skillName, content, create: true }, link);
			if (this._store.isDisposed || this.rejectWrite(link, true) || !stillCurrent()) { return false; }
			if (!result.ok) {
				this.paintSkillCreateFailed();
				this.closeWriteChromeWhenApiDisappears();
				return false;
			}
			await this.restoreWriteSuccessAfterRefresh(link, () => { if (stillCurrent()) { this.paintSkillCreateSucceeded(); } });
			if (!stillCurrent()) { return false; }
			this.selectSkill(skillName, link);
			return true;
		} catch (error) {
			if (!stillCurrent()) { return false; }
			if (isCancellationError(error)) { this.closeInvalidOwnerChrome(link); return false; }
			this.paintSkillCreateFailed();
			return false;
		} finally {
			if (this.catalogWriteOperation === operation) { this.catalogWriteOperation = undefined; }
		}
	}

	async saveSelectedSkillBody(content?: string): Promise<boolean> {
		if (this._store.isDisposed) { return false; }
		const link = this.captureWriteLink();
		if (!link || this.bodySaveOperation || !this.selectedSkill || !this.connection.saveSkillContent) { return false; }
		if (this.bodyDraftSuspended) {
			this.showSuspendedDraftStatus();
			return false;
		}
		const skillName = this.selectedSkill.name;
		const source = this.loadedBodySource;
		const expectedContent = this.loadedBodyText;
		if (this._store.isDisposed) { return false; }
		if (!this.loadedBodyWriteLink || !isSameEngineWriteLink(this.connection, this.loadedBodyWriteLink)) {
			this.showBodyStatus(localize('ua.engineSkillBodyOldConnection', "This draft belongs to a previous connection. Reconnect to the original engine and use Refresh skills to keep editing it."), 'error');
			return false;
		}
		if (this.bodyBaselineNeedsReload) { return false; }
		if (this.loadedBodySkillName !== skillName || expectedContent === undefined || (source !== 'user' && source !== 'project')) { return false; }
		const generation = this.bodyLoadGeneration;
		const revision = this.bodyEditRevision;
		const payload = content ?? this.bodyInput.value;
		const operation = {};
		const stillCurrent = () => !this._store.isDisposed && this.bodySaveOperation === operation && this.sameWriteLink(link) && generation === this.bodyLoadGeneration && this.selectedSkill?.name === skillName;
		this.catalogWriteOperation = undefined;
		this.bodySaveOperation = operation;
		this.bodyBaselineNeedsReload = true;
		try {
			const result = await this.connection.saveSkillContent({ skillName, content: payload, create: false, expectedSource: source, expectedContent }, link);
			if (this._store.isDisposed || !stillCurrent()) { return false; }
			if (!result.ok) {
				this.paintSkillSaveFailed();
				this.closeWriteChromeWhenApiDisappears();
				return false;
			}
			// Read the canonical raw content for the next CAS; never replace newer typing.
			const info = await this.connection.getSkillInfo({ skillName }, link);
			if (this._store.isDisposed || !stillCurrent()) { return false; }
			if (info.name !== skillName || info.source !== source) { throw new Error('Skill source changed'); }
			this.loadedBodyText = info.content;
			this.bodyBaselineNeedsReload = false;
			this.loadedBodySource = info.source;
			if (revision === this.bodyEditRevision) { this.bodyInput.value = info.content; }
			this.bodyDirty = isSkillBodyDirty(this.bodyInput.value, info.content);
			this.hideBodyStatus();
			this.paintSkillSaveSucceeded();
			return true;
		} catch (error) {
			if (stillCurrent()) {
				if (isCancellationError(error)) { this.closeInvalidOwnerChrome(link); return false; }
				this.paintSkillSaveFailed();
				this.showBodyStatus(localize('ua.engineSkillBodyReloadRequired', "Save could not be verified. Refresh to reload the saved version; your draft will be kept."), 'error');
			}
			return false;
		} finally {
			if (this.bodySaveOperation === operation) { this.bodySaveOperation = undefined; }
		}
	}

	private hasRetainableDraft(): boolean {
		return (this.bodyDirty || !!this.bodySaveOperation || this.bodyDraftSuspended)
			&& !!this.loadedBodySkillName && !!this.loadedBodyWriteLink
			&& (this.loadedBodySource === 'user' || this.loadedBodySource === 'project');
	}

	private isOriginalDraftSkill(skill: UniverseAgentSkillSummary): boolean {
		return this.loadedBodyWriteLink?.engineIdentityId === readPublishedEngineIdentityId(this.connection.getConnectionSnapshot())
			&& skill.name === this.loadedBodySkillName && skill.source === this.loadedBodySource;
	}

	private suspendBodyDraft(): boolean {
		if (!this.hasRetainableDraft()) { return false; }
		this.bodyDraftSuspended = true;
		this.bodyBaselineNeedsReload = true;
		this.bodyLoadGeneration++;
		this.bodySaveOperation = undefined;
		this.selectedSkill = undefined;
		this.bodyInput.inputElement.readOnly = true;
		this.bodyToolbar.style.display = 'none';
		this.bodyEditor.style.display = '';
		this.syncBodyFieldVisibility();
		this.showSuspendedDraftStatus();
		return true;
	}

	private showSuspendedDraftStatus(): void {
		this.showBodyStatus(localize('ua.engineSkillBodyDraftRecovery', "Draft kept. Use Refresh skills on the original engine to keep editing it."));
	}

	private hasLeftoverSkillBody(): boolean {
		return !!(this.loadedBodyText || this.bodyInput.value);
	}

	private closeLeftoverBodyEditorChrome(): void {
		// D431: UNKNOWN leftover / list-fail leftover must close leftover
		// user body Save chrome on refresh; do not wait for another selectSkill.
		// Toolbar hide alone left leftover textarea looking live.
		if (this.hasLeftoverSkillBody()) {
			this.updateBodyEditorChrome(this.loadedBodySource ?? this.selectedSkill?.source);
		}
	}

	private relayoutLeftoverList(): void {
		this.layoutListViewport();
	}

	private closeLeftoverRowToggleChrome(): void {
		// D432: leftover KEEP / UNKNOWN / list-fail must close leftover
		// row toggle chrome on refresh; do not wait for another selectSkill.
		// D421 / D431 Save chrome alone left leftover checkboxes looking live.
		// `list.rerender()` is a no-op unless supportDynamicHeights; splice
		// the leftover entries so renderElement can disable toggles via canWrite().
		this.relayoutLeftoverList();
		this.rowRenderer?.updateToggleChrome();
		if (this.list && this.listEntries.length > 0) {
			this.list.splice(0, this.list.length, this.listEntries);
			this.restoreSkillSelection();
		}
	}

	private applyDisconnectedRefresh(support: UniverseAgentCapabilitySupport, hadLiveCatalog: boolean): boolean {
		return this.controller.applyDisconnectedRefresh(hadLiveCatalog, () => {
			this.hideWriteStatus();
			this.writeToolbar.style.display = 'none';
			this.listContainer.style.display = '';
			this.mode = resolveEngineSkillsPaneMode(false, support);
			this.renderStatus();
			// D418/D421: pairing-hold / leftover-looks-live KEEP must paint leftover
			// body honesty and editor chrome on refresh; do not wait for another
			// selectSkill. Chrome first (D415 Tools KEEP `updateSaveChrome()`),
			// then disconnected copy so bundled leftover stays honesty-disconnected.
			if (this.hasLeftoverSkillBody()) {
				this.updateBodyEditorChrome(this.loadedBodySource ?? this.selectedSkill?.source);
				if (this.bodyDraftSuspended) { this.showSuspendedDraftStatus(); }
				else { this.showBodyStatus(getEngineSectionDisconnectedCopy()); }
			}
			this.closeLeftoverRowToggleChrome();
		}, () => {
			this.clearCatalogPresentation();
			this.mode = resolveEngineSkillsPaneMode(false, support);
			this.renderStatus();
		});
	}

	private async refresh(recoverDirtyBody = false, expectedOwner?: UniverseAgentExpectedOwner): Promise<boolean> {
		if (this._store.isDisposed) {
			return false;
		}
		try {
			return await this.refreshListed(recoverDirtyBody, expectedOwner);
		} finally {
			paintEngineLinkNotice(this._store.isDisposed, this.writeStatus, this.linkNotice);
		}
	}

	private async refreshListed(recoverDirtyBody = false, expectedOwner?: UniverseAgentExpectedOwner): Promise<boolean> {
		const generation = this.refreshGate.begin();
		const capabilities = ensureCapabilitySnapshot(this.connection.getCapabilitySnapshot());
		const connected = this.connection.isEngineConnected();
		const support = capabilities.skills.support;
		const snapshot = this.connection.getConnectionSnapshot();
		if (this.hasRetainableDraft() && (!connected || support !== 'SUPPORTED' || isConversationPairingHold(this.connection)
			|| this.loadedBodyWriteLink?.engineIdentityId !== readPublishedEngineIdentityId(snapshot)
			|| this.loadedBodyWriteLink?.linkId !== readPublishedLinkId(snapshot))) {
			this.suspendBodyDraft();
		}

		const hadLiveCatalog = this.listEntries.some(entry => entry.kind === 'skill');
		// D349 leftover-looks-live: pairing-hold first. KEEP is not only `!connected`.
		if (isConversationPairingHold(this.connection) || !connected) {
			return this.applyDisconnectedRefresh(support, hadLiveCatalog);
		}

		if (support === 'UNSUPPORTED') {
			this.clearCatalogPresentation();
			this.mode = resolveEngineSkillsPaneMode(true, support);
			this.renderStatus({ reason: capabilities.skills.reason });
			return false;
		}

		if (support === 'UNKNOWN') {
			const hadLiveCatalog = this.listEntries.some(entry => entry.kind === 'skill');
			if (!hadLiveCatalog) {
				this.clearCatalogPresentation();
			} else {
				this.hideWriteStatus();
			}
			this.mode = resolveEngineSkillsPaneMode(true, support, { kind: 'none' });
			this.writeToolbar.style.display = 'none';
			this.renderStatus({ loadingKind: 'capability' });
			if (hadLiveCatalog) {
				this.closeLeftoverBodyEditorChrome();
				this.closeLeftoverRowToggleChrome();
			}
			return false;
		}
		const owner = expectedOwner ?? this.captureReadOwner(snapshot);
		if (!owner) { this.closeInvalidOwnerChrome(); return false; }
		if (!this.sameReadOwner(owner)) { return false; }

		this.mode = resolveEngineSkillsPaneMode(true, support, { kind: 'inFlight' });
		this.writeToolbar.style.display = 'none';
		this.renderStatus({ loadingKind: 'list' });

		try {
			const result = await this.connection.listSkills(owner);
			if (!this.refreshGate.isCurrent(generation) || !this.sameReadOwner(owner)) {
				return false;
			}
			const leftoverAfterList = this.listEntries.some(entry => entry.kind === 'skill');
			if (isConversationPairingHold(this.connection) || !this.connection.isEngineConnected()) {
				return this.applyDisconnectedRefresh(support, leftoverAfterList);
			}
			if (!this.setSkills(result.skills, owner, generation)) { return false; }
			this.mode = resolveEngineSkillsPaneMode(true, support, {
				kind: 'success',
				itemCount: result.skills.length,
			});
			this.rowRenderer?.updateToggleChrome();
			if (!this.refreshGate.isCurrent(generation) || !this.sameReadableOwner(owner)) { return false; }
			this.freezeNotice.style.display = '';
			this.writeToolbar.style.display = this.canWrite() && !!this.connection.saveSkillContent ? '' : 'none';
			this.listContainer.style.display = canShowCatalogRows(this.mode) ? '' : 'none';
			this.bodyEditor.style.display = canShowCatalogRows(this.mode) || this.bodyDraftSuspended ? '' : 'none';
			this.syncBodyFieldVisibility();
			this.renderStatus();
			if (!this.refreshGate.isCurrent(generation) || !this.sameReadableOwner(owner)) { return false; }
			const sameEngine = this.loadedBodyWriteLink?.engineIdentityId === readPublishedEngineIdentityId(this.connection.getConnectionSnapshot());
			const recoverBaseline = recoverDirtyBody && sameEngine && !!this.loadedBodyWriteLink && (this.bodyBaselineNeedsReload || !this.sameWriteLink(this.loadedBodyWriteLink));
			if (this.selectedSkill && !this.bodySaveOperation && ((!this.bodyDirty && !this.bodyDraftSuspended) || recoverBaseline)) {
				void this.loadSkillBody(this.selectedSkill, recoverBaseline, owner).catch(onUnexpectedError);
			}
			return true;
		} catch (error) {
			if (!this.refreshGate.isCurrent(generation) || !this.sameReadOwner(owner)) {
				return false;
			}
			if (isCancellationError(error)) { this.closeInvalidOwnerChrome(owner); return false; }
			this.suspendBodyDraft();
			const hadLiveCatalog = this.listEntries.some(entry => entry.kind === 'skill');
			if (!hadLiveCatalog) {
				this.clearCatalogPresentation();
			} else {
				this.hideWriteStatus();
			}
			this.mode = resolveEngineSkillsPaneMode(true, support, {
				kind: 'failed',
				error: error instanceof Error ? error.message : undefined,
			});
			this.writeToolbar.style.display = 'none';
			this.renderStatus({
				reason: error instanceof Error ? error.message : undefined,
				onRetry: () => {
					if (this._store.isDisposed) {
						return;
					}
					void this.refresh().catch(onUnexpectedError);
				},
			});
			if (hadLiveCatalog) {
				this.closeLeftoverBodyEditorChrome();
				this.closeLeftoverRowToggleChrome();
			}
			return false;
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
				? () => {
					if (this._store.isDisposed) {
						return;
					}
					void this.commandService.executeCommand(OPEN_CONNECTION_PREFERENCES_COMMAND_ID).catch(onUnexpectedError);
				}
				: undefined,
		});
	}

	private ensureList(): WorkbenchList<EngineSkillListEntry> {
		if (!this.list) {
			this.rowRenderer = new EngineSkillRowRenderer(
				() => this.canWrite(),
				(skill, enabled) => {
					if (this._store.isDisposed) {
						return;
					}
					void this.toggleSkill(skill, enabled).catch(onUnexpectedError);
				},
			);
			this.list = this._register(this.instantiationService.createInstance(
				WorkbenchList,
				'EngineSkills',
				this.listContainer,
				new EngineSkillListDelegate(),
				[
					new EngineSkillGroupRenderer(),
					this.rowRenderer,
				],
				{
					identityProvider: {
						getId: (entry: EngineSkillListEntry) => entry.kind === 'group'
							? `group:${entry.source}`
							: `skill:${entry.skill.name}`,
					},
					accessibilityProvider: new EngineSkillListAccessibilityProvider(),
					setRowLineHeight: false,
				},
			)) as WorkbenchList<EngineSkillListEntry>;
			this._register(this.list.onDidChangeSelection(e => {
				if (this._store.isDisposed) {
					return;
				}
				const entry = e.elements[0];
				const next = entry?.kind === 'skill' ? entry.skill : undefined;
				if (this.bodyDraftSuspended && (!next || !this.isOriginalDraftSkill(next))) {
					this.restoreSkillSelection();
					return;
				}
				// Group headers are list rows. Leaving a dirty body for one drops the unsaved text.
				if (this.bodyDirty && next?.name !== this.selectedSkill?.name) {
					this.restoreSkillSelection();
					if (next) {
						this.showDraftPrompt(next.name);
					}
					return;
				}
				if (next?.name !== this.selectedSkill?.name) {
					this.hideDraftPrompt();
				}
				this.selectedSkill = next;
				if (!next) {
					this.clearBodyEditor();
					return;
				}
				this.syncBodyFieldVisibility();
				void this.loadSkillBody(next, false, this.selectionReadOwner ?? this.catalogReadOwner).catch(onUnexpectedError);
			}));
		}
		return this.list;
	}

	private clearCatalogPresentation(preserveDraft = true): void {
		const keptDraft = preserveDraft && this.suspendBodyDraft();
		this.catalogReadOwner = undefined;
		this.setSkillsCount(0);
		this.listEntries = [];
		this.list?.splice(0, this.list?.length ?? 0, []);
		this.selectedSkill = undefined;
		this.bodyLoadGeneration++;
		this.status.hide();
		this.freezeNotice.style.display = 'none';
		this.writeToolbar.style.display = 'none';
		this.hideWriteStatus();
		this.listContainer.style.display = 'none';
		this.bodyEditor.style.display = keptDraft ? '' : 'none';
		if (!keptDraft) { this.clearBodyEditor(); }
	}

	private showDraftPrompt(skillName: string): void {
		this.pendingSkillName = skillName;
		this.draftPromptText.textContent = localize('ua.engineSkillDraftPrompt', "Unsaved changes. Save or discard them to open {0}.", skillName);
		this.draftPrompt.style.display = '';
	}

	private hideDraftPrompt(): void {
		this.pendingSkillName = undefined;
		this.draftPromptText.textContent = '';
		this.draftPrompt.style.display = 'none';
	}

	private async resolvePendingSkill(action: 'save' | 'discard'): Promise<void> {
		const pending = this.pendingSkillName;
		if (!pending) {
			return;
		}
		if (action === 'save') {
			const saved = await this.saveSelectedSkillBody();
			if (!saved || this._store.isDisposed || this.bodyDirty || this.pendingSkillName !== pending) {
				return;
			}
		} else {
			if (this.bodySaveOperation) {
				return;
			}
			this.bodyEditRevision++;
			this.bodyInput.value = this.loadedBodyText ?? '';
			this.bodyDirty = false;
		}
		this.hideDraftPrompt();
		this.selectSkill(pending);
	}

	private clearBodyEditor(): void {
		this.hideDraftPrompt();
		this.bodyLoadGeneration++;
		this.bodySaveOperation = undefined;
		this.bodyDraftSuspended = false;
		this.bodyBaselineNeedsReload = false;
		this.bodyInput.value = '';
		this.bodyInput.inputElement.readOnly = true;
		this.bodyToolbar.style.display = 'none';
		this.loadedBodyText = undefined;
		this.loadedBodySource = undefined;
		this.loadedBodySkillName = undefined;
		this.loadedBodyWriteLink = undefined;
		this.bodyDirty = false;
		this.syncBodyFieldVisibility();
		this.showBodyStatus(localize('ua.engineSkillBodyNoSelection', "Select a skill to read its content."));
	}

	private syncBodyFieldVisibility(): void {
		const show = !!this.selectedSkill || this.hasLeftoverSkillBody() || this.bodyDraftSuspended;
		this.bodyFieldHost().style.display = show ? '' : 'none';
	}

	private bodyFieldHost(): HTMLElement {
		return this.bodyInput.element.closest('.monaco-scrollable-element') ?? this.bodyInput.element;
	}

	private showBodyStatus(message: string, tone: 'neutral' | 'error' = 'neutral'): void {
		this.bodyStatus.style.display = '';
		writeStatus(this.bodyStatus, message, tone);
	}

	private hideBodyStatus(): void {
		this.bodyStatus.style.display = 'none';
		writeStatus(this.bodyStatus, '');
	}

	private hideWriteStatus(): void {
		this.writeStatus.style.display = 'none';
		writeStatus(this.writeStatus, '');
	}

	private showLinkNotice(message: string): void {
		this.linkNotice = message;
		paintEngineLinkNotice(this._store.isDisposed, this.writeStatus, this.linkNotice);
	}

	private paintSkillCreateFailed(): void {
		this.paintSkillWriteFailed(localize(
			'ua.engineSkillCreateFailed',
			"Could not create skill content on the engine.",
		));
	}

	private paintSkillCreateSucceeded(): void {
		this.paintSkillWriteSucceeded(SKILL_CREATE_SUCCESS_COPY);
	}

	private paintSkillToggleSucceeded(): void {
		this.paintSkillWriteSucceeded(SKILL_TOGGLE_SUCCESS_COPY);
	}

	private paintSkillSaveSucceeded(): void {
		this.paintSkillWriteSucceeded(SKILL_SAVE_SUCCESS_COPY);
	}

	private paintSkillWriteSucceeded(copy: string): void {
		this.linkNotice = undefined;
		this.writeStatus.style.display = '';
		writeStatus(this.writeStatus, copy, 'success');
	}

	private async restoreWriteSuccessAfterRefresh(owner: UniverseAgentExpectedOwner, paintSucceeded: () => void): Promise<void> {
		if (this._store.isDisposed) { return; }
		paintSucceeded();
		const listed = await this.refresh(false, owner);
		if (this._store.isDisposed) { return; }
		if (listed) {
			paintSucceeded();
		}
	}

	private paintSkillToggleFailed(): void {
		this.paintSkillWriteFailed(localize(
			'ua.engineSkillToggleFailed',
			"Could not update skill enablement on the engine.",
		));
	}

	private paintSkillSaveFailed(): void {
		this.paintSkillWriteFailed(localize(
			'ua.engineSkillBodySaveFailed',
			"Could not save skill content to the engine.",
		));
	}

	private paintSkillWriteFailed(message: string): void {
		this.linkNotice = undefined;
		this.showBodyStatus(message, 'error');
		this.writeStatus.style.display = '';
		writeStatus(this.writeStatus, message, 'error');
	}

	private updateBodyEditorChrome(source: UniverseAgentSkillSource | undefined): void {
		const editable = this.canWrite()
			&& !this.bodyDraftSuspended
			&& !!this.loadedBodyWriteLink && this.sameWriteLink(this.loadedBodyWriteLink)
			&& !!this.connection.saveSkillContent
			&& !!source
			&& canEditSkillBody(source);
		this.bodyInput.inputElement.readOnly = !editable;
		this.bodyToolbar.style.display = editable ? '' : 'none';
		if (this.bodyDraftSuspended) {
			this.showSuspendedDraftStatus();
			return;
		}
		if (editable) {
			return;
		}
		if (!this.connection.saveSkillContent) {
			this.showBodyStatus(getEngineSectionApiUnavailableCopy(SKILL_WRITE_FEATURE));
		} else if (source && !canEditSkillBody(source)) {
			this.showBodyStatus(localize('ua.engineSkillBodyReadOnly', "This skill is read-only because the engine reports it as {0}.", getSkillSourceGroupLabel(source)));
		}
	}

	/** A runtime UNIMPLEMENTED response removes the dynamic write binding. */
	private closeWriteChromeWhenApiDisappears(): void {
		if (this.connection.saveSkillContent) {
			return;
		}
		this.writeToolbar.style.display = 'none';
		this.updateBodyEditorChrome(this.loadedBodySource ?? this.selectedSkill?.source);
	}

	private setSkills(skills: readonly UniverseAgentSkillSummary[], owner: UniverseAgentExpectedOwner, generation: number): boolean {
		const entries: EngineSkillListEntry[] = [];
		for (const [source, group] of groupSkillsBySource(skills)) {
			entries.push({ kind: 'group', source, label: getSkillSourceGroupLabel(source), count: group.length });
			for (const skill of group) {
				entries.push({ kind: 'skill', skill });
			}
		}
		// Neither old rows nor synchronous list/count observers may borrow the next owner.
		this.catalogReadOwner = undefined;
		if (this.hasRetainableDraft() && !skills.some(skill => this.isOriginalDraftSkill(skill))) {
			this.suspendBodyDraft();
		}
		this.listEntries = entries;
		const previousOwner = this.selectionReadOwner;
		this.selectionReadOwner = owner;
		try {
			if (entries.length === 0) {
				this.list?.splice(0, this.list?.length ?? 0, []);
				if (!this.bodyDirty && !this.bodyDraftSuspended) { this.clearBodyEditor(); }
			} else {
				const list = this.ensureList();
				list.splice(0, list.length, entries);
				this.restoreSkillSelection();
			}
		} finally {
			this.selectionReadOwner = previousOwner;
		}
		if (!this.refreshGate.isCurrent(generation) || !this.sameReadableOwner(owner)) { return false; }
		this.setSkillsCount(skills.length);
		if (!this.refreshGate.isCurrent(generation) || !this.sameReadableOwner(owner)) { return false; }
		this.catalogReadOwner = owner;
		this.layoutListViewport();
		return true;
	}

	private restoreSkillSelection(): void {
		const name = this.bodyDraftSuspended ? this.loadedBodySkillName : this.selectedSkill?.name;
		if (!name || !this.list) {
			return;
		}
		const index = this.listEntries.findIndex(entry => entry.kind === 'skill' && entry.skill.name === name
			&& (!this.bodyDraftSuspended || this.isOriginalDraftSkill(entry.skill)));
		if (index < 0) {
			this.selectedSkill = undefined;
			if (this.bodyDraftSuspended) {
				// List traits emit even when set to the same indexes. An already empty
				// selection must not re-enter this recovery from its own change event.
				if (this.list.getSelection().length > 0) { this.list.setSelection([]); }
			} else if (!this.bodyDirty) {
				this.clearBodyEditor();
			}
			return;
		}
		const entry = this.listEntries[index];
		if (entry?.kind === 'skill') {
			this.selectedSkill = entry.skill;
		}
		const selection = this.list.getSelection();
		if (selection.length !== 1 || selection[0] !== index) { this.list.setSelection([index]); }
	}

	private updateSkillEnablement(skillName: string, enabled: boolean): void {
		const index = this.listEntries.findIndex(entry => entry.kind === 'skill' && entry.skill.name === skillName);
		if (index >= 0) {
			const entry = this.listEntries[index];
			if (entry.kind === 'skill') {
				const updatedSkill: UniverseAgentSkillSummary = { ...entry.skill, enabled };
				const updatedEntry: EngineSkillListEntry = { kind: 'skill', skill: updatedSkill };
				this.listEntries[index] = updatedEntry;
				if (this.selectedSkill?.name === skillName) {
					this.selectedSkill = updatedSkill;
				}
			}
		}
		this.rowRenderer?.updateSkill(skillName, enabled);
	}

	private async toggleSkill(skill: UniverseAgentSkillSummary, enabled: boolean): Promise<void> {
		if (this._store.isDisposed) { return; }
		const link = this.captureWriteLink();
		if (!link) { return; }
		const operation = {};
		this.catalogWriteOperation = operation;
		const stillCurrent = () => this.catalogWriteOperation === operation && this.sameWriteLink(link);
		this.linkNotice = undefined;
		const previousEnabled = skill.enabled;
		this.updateSkillEnablement(skill.name, enabled);
		try {
			const result = await this.connection.setSkillEnabled({ skillName: skill.name, enabled }, link);
			if (!stillCurrent()) { return; }
			if (!result.ok) {
				this.updateSkillEnablement(skill.name, previousEnabled);
				this.paintSkillToggleFailed();
				await this.refresh(false, link);
				if (stillCurrent()) { this.paintSkillToggleFailed(); }
				return;
			}
			await this.restoreWriteSuccessAfterRefresh(link, () => { if (stillCurrent()) { this.paintSkillToggleSucceeded(); } });
		} catch (error) {
			if (!stillCurrent()) { return; }
			this.updateSkillEnablement(skill.name, previousEnabled);
			if (isCancellationError(error)) { this.closeInvalidOwnerChrome(link); return; }
			this.paintSkillToggleFailed();
			await this.refresh(false, link);
			if (stillCurrent()) { this.paintSkillToggleFailed(); }
		} finally {
			if (this.catalogWriteOperation === operation) { this.catalogWriteOperation = undefined; }
		}
	}

	private async loadSkillBody(skill: UniverseAgentSkillSummary, preserveDraft = false, expectedOwner?: UniverseAgentExpectedOwner): Promise<void> {
		if (this._store.isDisposed) { return; }
		if (this.bodyDraftSuspended && (!preserveDraft || !this.isOriginalDraftSkill(skill))) {
			this.updateBodyEditorChrome(this.loadedBodySource);
			return;
		}
		// D376 leftover-looks-live: pairing-hold first. KEEP is not only `!connected`.
		if (isConversationPairingHold(this.connection)) {
			const hasLeftoverBody = this.hasLeftoverSkillBody();
			if (hasLeftoverBody) {
				this.showBodyStatus(getEngineSectionDisconnectedCopy());
				return;
			}
			if (!this.bodyDirty) {
				this.clearBodyEditor();
			}
			return;
		}
		if (!canShowCatalogRows(this.mode) || !this.connection.isEngineConnected()) {
			// Keep leftover body after a live paint (D265; D263/D264).
			// failed/loading must not unload leftover text; first-pull empty still clears.
			const hasLeftoverBody = this.hasLeftoverSkillBody();
			if ((this.mode === 'failed' || this.mode === 'loading') && hasLeftoverBody) {
				return;
			}
			if (keepLeftoverCatalogForPairingHold(hasLeftoverBody, this.connection)) {
				this.showBodyStatus(getEngineSectionDisconnectedCopy());
				return;
			}
			if (!this.bodyDirty) {
				this.clearBodyEditor();
			}
			return;
		}
		if (this.bodyDirty && !preserveDraft && this.selectedSkill?.name === skill.name) {
			this.updateBodyEditorChrome(this.loadedBodySource ?? skill.source);
			return;
		}
		const owner = expectedOwner ?? this.captureReadOwner();
		if (!owner) { this.closeInvalidOwnerChrome(); return; }
		if (!this.sameReadOwner(owner)) {
			this.updateBodyEditorChrome(this.loadedBodySource ?? skill.source);
			return;
		}
		const generation = ++this.bodyLoadGeneration;
		const stillCurrent = () => generation === this.bodyLoadGeneration && this.selectedSkill?.name === skill.name && this.sameReadOwner(owner);
		const revision = this.bodyEditRevision;
		// Same-skill reload keeps the body already shown (D275). Another skill's
		// text is not leftover: Save would write it under the new name, and the
		// field would disagree with the loading status.
		const keepVisibleBody = this.loadedBodySkillName === skill.name;
		if (!keepVisibleBody) {
			this.bodySaveOperation = undefined;
			this.loadedBodyText = undefined;
			this.loadedBodySource = undefined;
			this.loadedBodySkillName = undefined;
			this.bodyInput.value = '';
			this.bodyDirty = false;
			this.bodyInput.inputElement.readOnly = true;
			this.bodyToolbar.style.display = 'none';
		}
		this.showBodyStatus(getCatalogListLoadingCopy());
		try {
			const info = await this.connection.getSkillInfo({ skillName: skill.name }, owner);
			if (!stillCurrent()) {
				return;
			}
			if (isConversationPairingHold(this.connection)
				|| !canShowCatalogRows(this.mode)
				|| !this.connection.isEngineConnected()) {
				if (isConversationPairingHold(this.connection) && keepVisibleBody) {
					this.showBodyStatus(getEngineSectionDisconnectedCopy());
				}
				return;
			}
			if (info.name !== skill.name || (preserveDraft && info.source !== this.loadedBodySource)) { throw new Error('Skill source changed'); }
			this.loadedBodyWriteLink = owner;
			this.loadedBodySource = info.source;
			this.loadedBodyText = info.content;
			this.loadedBodySkillName = skill.name;
			if (!preserveDraft && revision === this.bodyEditRevision) { this.bodyInput.value = info.content; }
			this.bodyBaselineNeedsReload = false;
			this.bodyDraftSuspended = false;
			this.bodyDirty = isSkillBodyDirty(this.bodyInput.value, info.content);
			this.hideBodyStatus();
			this.updateBodyEditorChrome(info.source);
		} catch (error) {
			if (!stillCurrent()) {
				return;
			}
			if (isCancellationError(error)) { this.closeInvalidOwnerChrome(owner); return; }
			if (!keepVisibleBody) {
				this.loadedBodySource = undefined;
				this.loadedBodySkillName = undefined;
				this.bodyInput.value = '';
				this.bodyInput.inputElement.readOnly = true;
				this.bodyToolbar.style.display = 'none';
			}
			this.showBodyStatus(localize('ua.engineSkillBodyLoadFailed', "Could not load skill content from the engine."), 'error');
		}
	}
}
