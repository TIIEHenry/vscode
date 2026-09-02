/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sourcesChangesList.css';
import * as dom from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable, DisposableMap, DisposableStore } from '../../../../base/common/lifecycle.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { localize } from '../../../../nls.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { ResourceLabels, IResourceLabel } from '../../../browser/labels.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IQuickDiffService } from '../../scm/common/quickDiff.js';
import { ISCMRepository, ISCMService } from '../../scm/common/scm.js';
import {
	SOURCES_GIT_COMMIT_COMMAND,
	SOURCES_GIT_STAGE_COMMAND,
	SOURCES_GIT_UNSTAGE_COMMAND,
	isSourcesChangeStageable,
	isSourcesChangeUnstageable,
} from '../common/sourcesChangesGit.js';
import { filterSourcesEntries } from '../common/sourcesFilterModel.js';
import { collectSourcesChangeEntries, ISourcesChangeEntry } from '../common/sourcesChangesModel.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';
import { openSourcesChangeEntry, ISourcesChangeEntryOpenOptions } from './sourcesChangeEntryOpen.js';
import { SourcesListFilterBox } from './sourcesListFilterBox.js';

const $ = dom.$;

export type { ISourcesChangeEntryOpenOptions };
export { openSourcesChangeEntry };

type SourcesChangeRowAction = 'stage' | 'unstage';

class SourcesChangesDelegate implements IListVirtualDelegate<ISourcesChangeEntry> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return 'sourcesChange';
	}
}

interface ISourcesChangeTemplateData {
	readonly container: HTMLElement;
	readonly labelContainer: HTMLElement;
	readonly label: IResourceLabel;
	readonly actionButton: Button;
	readonly templateDisposables: DisposableStore;
	readonly elementDisposables: DisposableStore;
}

interface ISourcesChangesRendererDelegate {
	isGitCommandAvailable(commandId: string): boolean;
	onRowAction(entry: ISourcesChangeEntry, action: SourcesChangeRowAction): void;
}

class SourcesChangesRenderer implements IListRenderer<ISourcesChangeEntry, ISourcesChangeTemplateData> {
	static readonly TEMPLATE_ID = 'sourcesChange';

	readonly templateId = SourcesChangesRenderer.TEMPLATE_ID;

	constructor(
		private readonly labels: ResourceLabels,
		private readonly delegate: ISourcesChangesRendererDelegate,
	) { }

	renderTemplate(container: HTMLElement): ISourcesChangeTemplateData {
		container.classList.add('sources-change-row');

		const templateDisposables = new DisposableStore();
		const elementDisposables = new DisposableStore();
		const labelContainer = dom.append(container, $('.sources-change-label'));
		const label = this.labels.create(labelContainer, { supportDescriptionHighlights: true });
		const actionButton = templateDisposables.add(new Button(container, {
			supportIcons: true,
			title: '',
			...defaultButtonStyles,
		}));
		actionButton.element.classList.add('sources-change-action');

		return { container, labelContainer, label, actionButton, templateDisposables, elementDisposables };
	}

	renderElement(element: ISourcesChangeEntry, _index: number, templateData: ISourcesChangeTemplateData): void {
		templateData.label.setResource({
			resource: element.resource,
			name: element.name,
			description: element.description,
		}, { hideIcon: false });

		templateData.elementDisposables.clear();

		const canStage = isSourcesChangeStageable(element.groupId)
			&& !!element.scmResource
			&& this.delegate.isGitCommandAvailable(SOURCES_GIT_STAGE_COMMAND);
		const canUnstage = isSourcesChangeUnstageable(element.groupId)
			&& !!element.scmResource
			&& this.delegate.isGitCommandAvailable(SOURCES_GIT_UNSTAGE_COMMAND);

		if (canStage) {
			templateData.actionButton.element.style.display = '';
			templateData.actionButton.icon = Codicon.add;
			templateData.actionButton.enabled = true;
			templateData.actionButton.element.setAttribute('aria-label', localize('sourcesChangesList.stage', "Stage"));
			templateData.elementDisposables.add(templateData.actionButton.onDidClick(e => {
				dom.EventHelper.stop(e, true);
				this.delegate.onRowAction(element, 'stage');
			}));
			return;
		}

		if (canUnstage) {
			templateData.actionButton.element.style.display = '';
			templateData.actionButton.icon = Codicon.remove;
			templateData.actionButton.enabled = true;
			templateData.actionButton.element.setAttribute('aria-label', localize('sourcesChangesList.unstage', "Unstage"));
			templateData.elementDisposables.add(templateData.actionButton.onDidClick(e => {
				dom.EventHelper.stop(e, true);
				this.delegate.onRowAction(element, 'unstage');
			}));
			return;
		}

		templateData.actionButton.element.style.display = 'none';
		templateData.actionButton.enabled = false;
	}

	disposeTemplate(templateData: ISourcesChangeTemplateData): void {
		templateData.elementDisposables.dispose();
		templateData.templateDisposables.dispose();
		templateData.label.dispose();
	}
}

class SourcesChangesAccessibilityProvider implements IListAccessibilityProvider<ISourcesChangeEntry> {
	getWidgetAriaLabel(): string {
		return localize('sourcesChangesList.ariaLabel', "Sources Changes");
	}

	getAriaLabel(element: ISourcesChangeEntry): string {
		return `${element.name}, ${element.description}`;
	}
}

export class SourcesChangesList extends Disposable implements ISourcesChangesRendererDelegate {

	private readonly contentContainer: HTMLElement;
	private readonly toolbar: HTMLElement;
	private readonly filterBox: SourcesListFilterBox;
	private readonly stageSelectedButton: Button;
	private readonly unstageSelectedButton: Button;
	private readonly listContainer: HTMLElement;
	private readonly emptyMessage: HTMLElement;
	private readonly commitRow: HTMLElement;
	private readonly commitInput: HTMLInputElement;
	private readonly commitButton: Button;
	private readonly statusMessage: HTMLElement;

	private list: WorkbenchList<ISourcesChangeEntry> | undefined;
	private labels: ResourceLabels | undefined;
	private readonly refreshScheduler: RunOnceScheduler;
	private readonly repositoryListeners = this._register(new DisposableMap<ISCMRepository>());
	private readonly inputListeners = this._register(new DisposableMap<ISCMRepository>());
	private activeRepository: ISCMRepository | undefined;
	private gitCommandsAvailable = false;

	constructor(
		host: HTMLElement,
		@ISCMService private readonly scmService: ISCMService,
		@IEditorService private readonly editorService: IEditorService,
		@ICommandService private readonly commandService: ICommandService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IQuickDiffService private readonly quickDiffService: IQuickDiffService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ISourcesDiffPanelService private readonly sourcesDiffPanelService: ISourcesDiffPanelService,
	) {
		super();

		host.classList.add('show-file-icons', 'sources-changes-host');

		this.filterBox = this._register(new SourcesListFilterBox(
			host,
			localize('sourcesChangesList.filterPlaceholder', "Filter changes"),
			localize('sourcesChangesList.filterAriaLabel', "Filter changes"),
		));
		this._register(this.filterBox.onDidChange(() => this.scheduleRefresh()));

		this.contentContainer = dom.append(host, $('.sources-changes-content'));
		this.toolbar = dom.append(host, $('.sources-changes-toolbar'));
		this.stageSelectedButton = this._register(new Button(this.toolbar, {
			supportIcons: true,
			title: localize('sourcesChangesList.stageSelected', "Stage Selected"),
			...defaultButtonStyles,
		}));
		this.stageSelectedButton.icon = Codicon.add;
		this.unstageSelectedButton = this._register(new Button(this.toolbar, {
			supportIcons: true,
			title: localize('sourcesChangesList.unstageSelected', "Unstage Selected"),
			...defaultButtonStyles,
		}));
		this.unstageSelectedButton.icon = Codicon.remove;

		this.listContainer = dom.append(this.contentContainer, $('.sources-changes-list'));
		this.emptyMessage = dom.append(this.contentContainer, $('.sources-changes-empty'));
		this.emptyMessage.style.display = 'none';

		this.commitRow = dom.append(host, $('.sources-changes-commit'));
		this.commitInput = dom.append(this.commitRow, $('input.sources-changes-commit-input')) as HTMLInputElement;
		this.commitInput.type = 'text';
		this.commitInput.placeholder = localize('sourcesChangesList.commitMessage', "Commit message");
		this.commitInput.setAttribute('aria-label', localize('sourcesChangesList.commitMessage', "Commit message"));
		this.commitButton = this._register(new Button(this.commitRow, defaultButtonStyles));
		this.commitButton.label = localize('sourcesChangesList.commit', "Commit");

		this.statusMessage = dom.append(host, $('.sources-changes-status'));
		this.statusMessage.style.display = 'none';

		this._register(this.stageSelectedButton.onDidClick(() => this.runOnSelected('stage')));
		this._register(this.unstageSelectedButton.onDidClick(() => this.runOnSelected('unstage')));
		this._register(this.commitButton.onDidClick(() => this.runCommit()));
		this._register(dom.addStandardDisposableListener(this.commitInput, 'input', () => {
			const repo = this.activeRepository;
			if (repo && this.commitInput.value !== repo.input.value) {
				repo.input.setValue(this.commitInput.value, true);
				repo.provider.inputBoxTextModel.setValue(this.commitInput.value);
			}
			this.updateCommitRow();
		}));
		this._register(dom.addDisposableListener(this.commitInput, 'keydown', (e: KeyboardEvent) => {
			const event = new StandardKeyboardEvent(e);
			if (event.keyCode === KeyCode.Enter && !this.commitButton.enabled) {
				return;
			}
			if (event.keyCode === KeyCode.Enter) {
				event.preventDefault();
				void this.runCommit();
			}
		}));

		this._register(CommandsRegistry.onDidRegisterCommand(commandId => {
			if (commandId === SOURCES_GIT_STAGE_COMMAND || commandId === SOURCES_GIT_UNSTAGE_COMMAND || commandId === SOURCES_GIT_COMMIT_COMMAND) {
				this.scheduleRefresh();
			}
		}));

		this.refreshScheduler = this._register(new RunOnceScheduler(() => this.refresh(), 250));
		this.scheduleRefresh();

		this._register(this.scmService.onDidAddRepository(repo => {
			this.registerRepository(repo);
			this.scheduleRefresh();
		}));
		this._register(this.scmService.onDidRemoveRepository(repo => {
			this.unregisterRepository(repo);
			this.scheduleRefresh();
		}));

		for (const repo of this.scmService.repositories) {
			this.registerRepository(repo);
		}
	}

	isGitCommandAvailable(commandId: string): boolean {
		return !!CommandsRegistry.getCommand(commandId);
	}

	onRowAction(entry: ISourcesChangeEntry, action: SourcesChangeRowAction): void {
		void this.runResourceAction(entry, action);
	}

	private registerRepository(repo: ISCMRepository): void {
		if (this.repositoryListeners.has(repo)) {
			return;
		}

		const store = new DisposableStore();
		store.add(repo.provider.onDidChangeResources(() => this.scheduleRefresh()));
		store.add(repo.provider.onDidChangeResourceGroups(() => this.scheduleRefresh()));
		this.repositoryListeners.set(repo, store);

		const inputStore = new DisposableStore();
		inputStore.add(repo.input.onDidChange(() => this.syncCommitInputFromRepository()));
		this.inputListeners.set(repo, inputStore);
	}

	private unregisterRepository(repo: ISCMRepository): void {
		this.repositoryListeners.deleteAndDispose(repo);
		this.inputListeners.deleteAndDispose(repo);
		if (this.activeRepository === repo) {
			this.activeRepository = undefined;
		}
	}

	private scheduleRefresh(): void {
		if (!this.refreshScheduler.isScheduled()) {
			this.refreshScheduler.schedule();
		}
	}

	private getPrimaryRepository(): ISCMRepository | undefined {
		for (const repo of this.scmService.repositories) {
			return repo;
		}
		return undefined;
	}

	private ensureList(): WorkbenchList<ISourcesChangeEntry> {
		if (this.list) {
			return this.list;
		}

		this.labels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: Event.None }));
		const delegate = new SourcesChangesDelegate();
		const renderer = new SourcesChangesRenderer(this.labels, this);

		this.list = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'SourcesChanges',
			this.listContainer,
			delegate,
			[renderer],
			{
				identityProvider: { getId: (element: ISourcesChangeEntry) => element.resource.toString() },
				accessibilityProvider: new SourcesChangesAccessibilityProvider(),
				openOnSingleClick: true,
			}
		)) as WorkbenchList<ISourcesChangeEntry>;

		this._register(this.list.onDidOpen(async e => {
			const element = e.element;
			if (!element) {
				return;
			}

			await openSourcesChangeEntry(element, {
				editorService: this.editorService,
				quickDiffService: this.quickDiffService,
				configurationService: this.configurationService,
				instantiationService: this.instantiationService,
				sourcesDiffPanelService: this.sourcesDiffPanelService,
			}, {
				preserveFocus: e.editorOptions.preserveFocus,
				pinned: e.editorOptions.pinned,
			});
		}));

		this._register(this.list.onDidChangeSelection(() => this.updateSelectionToolbar()));

		return this.list;
	}

	private refresh(): void {
		const hasRepository = this.scmService.repositoryCount > 0;
		this.activeRepository = this.getPrimaryRepository();
		const allEntries = collectSourcesChangeEntries(this.scmService.repositories);
		const entries = filterSourcesEntries(allEntries, this.filterBox.value);
		const hasAnyEntries = allEntries.length > 0;
		const hasVisibleEntries = entries.length > 0;

		this.gitCommandsAvailable = this.isGitCommandAvailable(SOURCES_GIT_STAGE_COMMAND)
			|| this.isGitCommandAvailable(SOURCES_GIT_UNSTAGE_COMMAND)
			|| this.isGitCommandAvailable(SOURCES_GIT_COMMIT_COMMAND);

		if (!hasRepository) {
			this.emptyMessage.textContent = localize('sourcesChangesList.noRepository', "No source control repository.");
		} else if (!hasAnyEntries) {
			this.emptyMessage.textContent = localize('sourcesChangesList.noChanges', "No changes.");
		} else if (!hasVisibleEntries) {
			this.emptyMessage.textContent = localize('sourcesChangesList.noMatching', "No matching changes.");
		}

		this.emptyMessage.style.display = hasVisibleEntries ? 'none' : 'block';
		this.listContainer.style.display = hasVisibleEntries ? 'block' : 'none';
		this.toolbar.style.display = hasVisibleEntries ? 'flex' : 'none';
		this.filterBox.element.style.display = hasAnyEntries ? 'block' : 'none';
		this.commitRow.style.display = hasRepository ? 'flex' : 'none';

		if (hasRepository && !this.gitCommandsAvailable) {
			this.statusMessage.textContent = localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available.");
			this.statusMessage.style.display = 'block';
		} else {
			this.statusMessage.style.display = 'none';
		}

		this.syncCommitInputFromRepository();
		this.updateCommitRow();

		if (hasVisibleEntries) {
			const list = this.ensureList();
			list.splice(0, list.length, entries);
			this.updateSelectionToolbar();
		} else {
			this.updateSelectionToolbar();
		}
	}

	private updateSelectionToolbar(): void {
		const selected = this.list?.getSelectedElements() ?? [];
		const canStage = selected.some(entry =>
			isSourcesChangeStageable(entry.groupId)
			&& !!entry.scmResource
			&& this.isGitCommandAvailable(SOURCES_GIT_STAGE_COMMAND));
		const canUnstage = selected.some(entry =>
			isSourcesChangeUnstageable(entry.groupId)
			&& !!entry.scmResource
			&& this.isGitCommandAvailable(SOURCES_GIT_UNSTAGE_COMMAND));

		this.stageSelectedButton.enabled = canStage;
		this.unstageSelectedButton.enabled = canUnstage;
	}

	private async runOnSelected(action: SourcesChangeRowAction): Promise<void> {
		const selected = this.list?.getSelectedElements() ?? [];
		for (const entry of selected) {
			await this.runResourceAction(entry, action);
		}
	}

	private async runResourceAction(entry: ISourcesChangeEntry, action: SourcesChangeRowAction): Promise<void> {
		const resource = entry.scmResource;
		if (!resource) {
			return;
		}

		const commandId = action === 'stage' ? SOURCES_GIT_STAGE_COMMAND : SOURCES_GIT_UNSTAGE_COMMAND;
		if (!this.isGitCommandAvailable(commandId)) {
			return;
		}

		if (action === 'stage' && !isSourcesChangeStageable(entry.groupId)) {
			return;
		}
		if (action === 'unstage' && !isSourcesChangeUnstageable(entry.groupId)) {
			return;
		}

		try {
			await this.commandService.executeCommand(commandId, resource);
		} catch {
			// Fail closed: git extension absent or command rejected.
		}
	}

	private syncCommitInputFromRepository(): void {
		const repo = this.activeRepository;
		if (!repo) {
			this.commitInput.value = '';
			return;
		}

		const value = repo.input.value;
		if (this.commitInput.value !== value) {
			this.commitInput.value = value;
		}
	}

	private updateCommitRow(): void {
		const repo = this.activeRepository;
		const hasMessage = this.commitInput.value.trim().length > 0;
		const acceptCommand = repo?.provider.acceptInputCommand;
		const commitAvailable = !!acceptCommand?.id && this.isGitCommandAvailable(acceptCommand.id)
			|| this.isGitCommandAvailable(SOURCES_GIT_COMMIT_COMMAND);

		this.commitInput.disabled = !repo;
		this.commitButton.enabled = !!repo && hasMessage && commitAvailable;
	}

	private async runCommit(): Promise<void> {
		const repo = this.activeRepository;
		if (!repo) {
			return;
		}

		const message = this.commitInput.value;
		if (!message.trim()) {
			return;
		}

		repo.input.setValue(message, false);
		repo.provider.inputBoxTextModel.setValue(message);

		const acceptCommand = repo.provider.acceptInputCommand;
		if (acceptCommand?.id && this.isGitCommandAvailable(acceptCommand.id)) {
			try {
				await this.commandService.executeCommand(acceptCommand.id, ...(acceptCommand.arguments ?? []));
			} catch {
				// Fail closed.
			}
			return;
		}

		if (this.isGitCommandAvailable(SOURCES_GIT_COMMIT_COMMAND)) {
			try {
				await this.commandService.executeCommand(SOURCES_GIT_COMMIT_COMMAND);
			} catch {
				// Fail closed.
			}
		}
	}
}
