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
import { getErrorMessage } from '../../../../base/common/errors.js';
import { Disposable, DisposableMap, DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { StandardKeyboardEvent } from '../../../../base/browser/keyboardEvent.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { localize } from '../../../../nls.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ResourceLabels, IResourceLabel } from '../../../browser/labels.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { isConversationPairingHold } from '../../conversation/browser/conversationSessionStatus.js';
import { IConversationRosterService } from '../../conversation/browser/conversationStubService.js';
import { IQuickDiffService } from '../../scm/common/quickDiff.js';
import { ISCMRepository, ISCMService } from '../../scm/common/scm.js';
import {
	SOURCES_GIT_COMMIT_COMMAND,
	SOURCES_GIT_STAGE_COMMAND,
	SOURCES_GIT_UNSTAGE_COMMAND,
	isSourcesChangeStageable,
	isSourcesChangeUnstageable,
} from '../common/sourcesChangesGit.js';
import {
	hasSourcesGitReadEntries,
	shouldKeepSourcesGitReadNoHookLeftover,
	shouldKeepSourcesGitReadPairingHoldLeftover,
	sourcesGitDiffOpenFailureMessage,
	sourcesGitLocalOnlyMessage,
	sourcesGitReadFailureMessage,
	sourcesGitReadPairingHoldMessage,
	sourcesGitReadUnavailableNoHookMessage,
	tryLoadSourcesGitChangeEntries,
	tryReadSourcesGitFileDiff,
} from '../common/sourcesChangesGitRead.js';
import {
	canSendSourcesGitCommit,
	canSendSourcesGitStagePaths,
	isSourcesGitWriteAccepted,
	isSourcesGitWriteUnsupported,
	resolveSourcesChangesRowAction,
	sourcesGitUnstageUnavailableMessage,
	sourcesGitWriteFailureDetail,
	tryWriteSourcesGitCommit,
	tryWriteSourcesGitStagePaths,
} from '../common/sourcesChangesGitWrite.js';
import { filterSourcesEntries } from '../common/sourcesFilterModel.js';
import { collectSourcesChangeEntries, ISourcesChangeEntry, sourcesChangeEntryIdentity } from '../common/sourcesChangesModel.js';
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
	canWriteStage(): boolean;
	isSourcesGitWritePairingHold(): boolean;
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

		const rowAction = resolveSourcesChangesRowAction({
			groupId: element.groupId,
			hasScmResource: !!element.scmResource,
			canWriteStage: this.delegate.canWriteStage(),
			hasGitStageCommand: this.delegate.isGitCommandAvailable(SOURCES_GIT_STAGE_COMMAND),
			hasGitUnstageCommand: this.delegate.isGitCommandAvailable(SOURCES_GIT_UNSTAGE_COMMAND),
		});

		if (rowAction === 'stage') {
			const label = localize('sourcesChangesList.stage', "Stage");
			templateData.actionButton.element.style.display = '';
			templateData.actionButton.icon = Codicon.add;
			templateData.actionButton.enabled = true;
			templateData.actionButton.setAriaLabel(label);
			templateData.actionButton.setTitle(label);
			templateData.elementDisposables.add(templateData.actionButton.onDidClick(e => {
				dom.EventHelper.stop(e, true);
				this.delegate.onRowAction(element, 'stage');
			}));
			return;
		}

		if (rowAction === 'unstage') {
			const pairingHold = this.delegate.isSourcesGitWritePairingHold();
			const label = localize('sourcesChangesList.unstage', "Unstage");
			templateData.actionButton.element.style.display = pairingHold ? 'none' : '';
			templateData.actionButton.icon = Codicon.remove;
			templateData.actionButton.enabled = !pairingHold;
			templateData.actionButton.setAriaLabel(label);
			templateData.actionButton.setTitle(label);
			if (pairingHold) {
				return;
			}
			templateData.elementDisposables.add(templateData.actionButton.onDidClick(e => {
				dom.EventHelper.stop(e, true);
				this.delegate.onRowAction(element, 'unstage');
			}));
			return;
		}

		if (rowAction === 'unstageUnavailable') {
			const message = sourcesGitUnstageUnavailableMessage();
			templateData.actionButton.element.style.display = '';
			templateData.actionButton.icon = Codicon.remove;
			templateData.actionButton.enabled = false;
			templateData.actionButton.setAriaLabel(message);
			templateData.actionButton.setTitle(message);
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
	private usingGitRead = false;
	private refreshSeq = 0;
	private writeStatusMessage: string | undefined;
	private lastGoodEntries: ISourcesChangeEntry[] = [];

	constructor(
		host: HTMLElement,
		@ISCMService private readonly scmService: ISCMService,
		@IEditorService private readonly editorService: IEditorService,
		@ICommandService private readonly commandService: ICommandService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IQuickDiffService private readonly quickDiffService: IQuickDiffService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ISourcesDiffPanelService private readonly sourcesDiffPanelService: ISourcesDiffPanelService,
		@IUniverseAgentConnection private readonly uaConnection: IUniverseAgentConnection,
		@IWorkspaceContextService private readonly workspaceContext: IWorkspaceContextService,
		@IModelService private readonly modelService: IModelService,
		@IConversationRosterService private readonly roster: IConversationRosterService,
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
		this._register(this.uaConnection.onDidChangeConnection(() => this.scheduleRefresh()));
		this._register(this.roster.onDidChangeActiveSession(() => this.scheduleRefresh()));

		this.refreshScheduler = this._register(new RunOnceScheduler(() => void this.refresh(), 250));
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

	/** Phase connected + pairingPending — leftover-looks-live still refuses writes. */
	isSourcesGitWritePairingHold(): boolean {
		return this.uaConnection.getConnectionPhase().kind === 'connected'
			&& !!this.uaConnection.getConnectionSnapshot().pairingPending;
	}

	canWriteStage(): boolean {
		return canSendSourcesGitStagePaths(
			this.uaConnection.isEngineConnected(),
			typeof this.uaConnection.writeGitStagePaths === 'function',
			this.getGitSessionId(),
			this.isSourcesGitWritePairingHold(),
		);
	}

	canWriteCommit(): boolean {
		return canSendSourcesGitCommit(
			this.uaConnection.isEngineConnected(),
			typeof this.uaConnection.writeGitCommit === 'function',
			this.getGitSessionId(),
			this.isSourcesGitWritePairingHold(),
		);
	}

	private getGitSessionId(): string {
		return this.roster.getActiveSessionId();
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
				identityProvider: { getId: (element: ISourcesChangeEntry) => sourcesChangeEntryIdentity(element) },
				accessibilityProvider: new SourcesChangesAccessibilityProvider(),
				openOnSingleClick: true,
			}
		)) as WorkbenchList<ISourcesChangeEntry>;

		this._register(this.list.onDidOpen(async e => {
			const element = e.element;
			if (!element) {
				return;
			}

			try {
				await openSourcesChangeEntry(element, {
					editorService: this.editorService,
					quickDiffService: this.quickDiffService,
					configurationService: this.configurationService,
					instantiationService: this.instantiationService,
					sourcesDiffPanelService: this.sourcesDiffPanelService,
					modelService: this.modelService,
					readGitFileDiff: entry => this.readGitFileDiff(entry),
				}, {
					preserveFocus: e.editorOptions.preserveFocus,
					pinned: e.editorOptions.pinned,
				});
				this.setStatusMessage(undefined);
			} catch (error) {
				this.writeStatusMessage = undefined;
				this.setStatusMessage(sourcesGitDiffOpenFailureMessage(error));
			}
		}));

		this._register(this.list.onDidChangeSelection(() => this.updateSelectionToolbar()));

		return this.list;
	}

	private async refresh(): Promise<void> {
		const seq = ++this.refreshSeq;
		this.activeRepository = this.getPrimaryRepository();
		let allEntries: ISourcesChangeEntry[];
		let gitReadError: string | undefined;
		let localOnly = false;
		let gitReadNoHook = false;
		let gitReadPairingHold = false;
		// D342 leftover-looks-live: pairing-hold first. KEEP is not only `!connected`.
		if (isConversationPairingHold(this.uaConnection)) {
			const leftoverCount = this.usingGitRead ? this.lastGoodEntries.length : 0;
			if (shouldKeepSourcesGitReadPairingHoldLeftover(
				this.uaConnection.getConnectionPhase().kind === 'connected',
				this.uaConnection.getConnectionSnapshot().pairingPending,
				leftoverCount,
			)) {
				allEntries = this.lastGoodEntries;
				gitReadPairingHold = true;
			} else {
				this.usingGitRead = false;
				allEntries = collectSourcesChangeEntries(this.scmService.repositories);
				localOnly = allEntries.length > 0;
			}
			this.lastGoodEntries = [...allEntries];
			this.applyRefreshPresentation(allEntries, { localOnly, gitReadPairingHold });
			return;
		}
		try {
			const loaded = await this.tryLoadGitEntries();
			if (seq !== this.refreshSeq) {
				return;
			}
			if (hasSourcesGitReadEntries(loaded)) {
				this.usingGitRead = true;
				allEntries = loaded;
			} else {
				// Pairing-hold leftover wins over SCM (D283); no-hook keep-last stays (D273).
				const leftoverCount = this.usingGitRead ? this.lastGoodEntries.length : 0;
				if (shouldKeepSourcesGitReadPairingHoldLeftover(
					this.uaConnection.getConnectionPhase().kind === 'connected',
					this.uaConnection.getConnectionSnapshot().pairingPending,
					leftoverCount,
				)) {
					allEntries = this.lastGoodEntries;
					gitReadPairingHold = true;
				} else if (shouldKeepSourcesGitReadNoHookLeftover(
					this.uaConnection.isEngineConnected(),
					typeof this.uaConnection.readGitChanges === 'function',
					leftoverCount,
				)) {
					allEntries = this.lastGoodEntries;
					gitReadNoHook = true;
				} else {
					this.usingGitRead = false;
					allEntries = collectSourcesChangeEntries(this.scmService.repositories);
					localOnly = allEntries.length > 0;
				}
			}
		} catch (error) {
			if (seq !== this.refreshSeq) {
				return;
			}
			// Honest git-read failure; leftover rows stay, this is not an empty-workspace success.
			if (this.lastGoodEntries.length === 0) {
				this.usingGitRead = false;
			}
			this.writeStatusMessage = undefined;
			gitReadError = sourcesGitReadFailureMessage(error);
			this.applyRefreshPresentation(this.lastGoodEntries, { gitReadError });
			return;
		}

		this.lastGoodEntries = [...allEntries];
		this.applyRefreshPresentation(allEntries, { localOnly, gitReadNoHook, gitReadPairingHold });
	}

	private applyRefreshPresentation(allEntries: ISourcesChangeEntry[], options?: {
		readonly gitReadError?: string;
		readonly localOnly?: boolean;
		readonly gitReadNoHook?: boolean;
		readonly gitReadPairingHold?: boolean;
	}): void {
		const hasRepository = this.usingGitRead || this.scmService.repositoryCount > 0;
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

		if (options?.gitReadError) {
			this.setStatusMessage(options.gitReadError);
		} else if (this.writeStatusMessage) {
			this.setStatusMessage(this.writeStatusMessage);
		} else if (options?.gitReadPairingHold) {
			this.setStatusMessage(sourcesGitReadPairingHoldMessage());
		} else if (options?.gitReadNoHook) {
			this.setStatusMessage(sourcesGitReadUnavailableNoHookMessage());
		} else if (options?.localOnly) {
			this.setStatusMessage(sourcesGitLocalOnlyMessage());
		} else if (hasRepository && !this.gitCommandsAvailable && !this.canWriteStage() && !this.canWriteCommit()) {
			this.setStatusMessage(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
		} else {
			this.setStatusMessage(undefined);
		}

		this.syncCommitInputFromRepository();
		this.updateCommitRow();

		if (this.list) {
			this.list.splice(0, this.list.length, entries);
		} else if (hasVisibleEntries) {
			this.ensureList().splice(0, 0, entries);
		}
		this.updateSelectionToolbar();
	}

	private async tryLoadGitEntries(): Promise<ISourcesChangeEntry[] | undefined> {
		const changesHook = this.uaConnection.readGitChanges;
		const summaryHook = this.uaConnection.readGitSummary;
		const loaded = await tryLoadSourcesGitChangeEntries(
			this.uaConnection.isEngineConnected(),
			changesHook ? request => changesHook.call(this.uaConnection, request) : undefined,
			summaryHook ? request => summaryHook.call(this.uaConnection, request) : undefined,
			this.getGitResourceRoot(),
			this.getGitSessionId(),
			isConversationPairingHold(this.uaConnection),
		);
		const entries = loaded?.entries;
		return hasSourcesGitReadEntries(entries) ? entries : undefined;
	}

	private getGitResourceRoot(): URI | undefined {
		const repoRoot = this.getPrimaryRepository()?.provider.rootUri;
		if (repoRoot) {
			return repoRoot;
		}
		return this.workspaceContext.getWorkspace().folders[0]?.uri;
	}

	private async readGitFileDiff(entry: ISourcesChangeEntry) {
		const hook = this.uaConnection.readGitFileDiff;
		return tryReadSourcesGitFileDiff(
			this.uaConnection.isEngineConnected(),
			hook ? request => hook.call(this.uaConnection, request) : undefined,
			this.getGitSessionId(),
			entry.gitPath ?? '',
			entry.indexState ?? '',
		);
	}

	private updateSelectionToolbar(): void {
		const selected = this.list?.getSelectedElements() ?? [];
		const canStage = selected.some(entry =>
			isSourcesChangeStageable(entry.groupId)
			&& (this.canWriteStage()
				|| (!!entry.scmResource && this.isGitCommandAvailable(SOURCES_GIT_STAGE_COMMAND))));
		const canUnstage = selected.some(entry =>
			isSourcesChangeUnstageable(entry.groupId)
			&& !!entry.scmResource
			&& this.isGitCommandAvailable(SOURCES_GIT_UNSTAGE_COMMAND));

		this.stageSelectedButton.enabled = canStage && !this.isSourcesGitWritePairingHold();
		this.unstageSelectedButton.enabled = canUnstage && !this.isSourcesGitWritePairingHold();
	}

	private async runOnSelected(action: SourcesChangeRowAction): Promise<void> {
		const selected = this.list?.getSelectedElements() ?? [];
		if (action === 'stage') {
			const stageable = selected.filter(entry => isSourcesChangeStageable(entry.groupId));
			if (stageable.length === 0) {
				return;
			}
			if (await this.tryStagePaths(stageable.map(entry => entry.gitPath ?? entry.resource.fsPath))) {
				return;
			}
		}
		for (const entry of selected) {
			await this.runResourceAction(entry, action);
		}
	}

	private async runResourceAction(entry: ISourcesChangeEntry, action: SourcesChangeRowAction): Promise<void> {
		if (action === 'stage' && !isSourcesChangeStageable(entry.groupId)) {
			return;
		}
		if (action === 'unstage' && !isSourcesChangeUnstageable(entry.groupId)) {
			return;
		}
		if (action === 'unstage' && this.isSourcesGitWritePairingHold()) {
			return;
		}

		if (action === 'stage' && await this.tryStagePaths([entry.gitPath ?? entry.resource.fsPath])) {
			return;
		}

		const resource = entry.scmResource;
		if (!resource) {
			if (action === 'stage' && this.canWriteStage()) {
				this.setWriteStatusMessage(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
			}
			return;
		}

		const commandId = action === 'stage' ? SOURCES_GIT_STAGE_COMMAND : SOURCES_GIT_UNSTAGE_COMMAND;
		if (!this.isGitCommandAvailable(commandId)) {
			this.setWriteStatusMessage(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
			return;
		}

		try {
			await this.commandService.executeCommand(commandId, resource);
			this.setWriteStatusMessage(undefined);
		} catch (error) {
			this.setWriteStatusMessage(action === 'stage'
				? localize('sourcesChangesList.stageFailed', "Unable to stage: {0}", getErrorMessage(error))
				: localize('sourcesChangesList.unstageFailed', "Unable to unstage: {0}", getErrorMessage(error)));
		}
	}

	private async tryStagePaths(paths: readonly string[]): Promise<boolean> {
		if (this.isSourcesGitWritePairingHold()) {
			return true;
		}
		const hook = this.uaConnection.writeGitStagePaths;
		try {
			const result = await tryWriteSourcesGitStagePaths(
				this.uaConnection.isEngineConnected(),
				hook ? request => hook.call(this.uaConnection, request) : undefined,
				this.getGitSessionId(),
				paths,
				this.isSourcesGitWritePairingHold(),
			);
			if (!result || isSourcesGitWriteUnsupported(result)) {
				return false;
			}
			if (!isSourcesGitWriteAccepted(result)) {
				this.setWriteStatusMessage(localize('sourcesChangesList.stageFailed', "Unable to stage: {0}", sourcesGitWriteFailureDetail(result)));
				return true;
			}
			this.setWriteStatusMessage(undefined);
			this.scheduleRefresh();
			return true;
		} catch (error) {
			this.setWriteStatusMessage(localize('sourcesChangesList.stageFailed', "Unable to stage: {0}", getErrorMessage(error)));
			return true;
		}
	}

	private setWriteStatusMessage(message: string | undefined): void {
		this.writeStatusMessage = message;
		this.setStatusMessage(message);
	}

	private setStatusMessage(message: string | undefined): void {
		if (!message) {
			this.statusMessage.textContent = '';
			this.statusMessage.style.display = 'none';
			return;
		}
		this.statusMessage.textContent = message;
		this.statusMessage.style.display = 'block';
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
		const commitAvailable = this.canWriteCommit()
			|| (!!acceptCommand?.id && this.isGitCommandAvailable(acceptCommand.id))
			|| this.isGitCommandAvailable(SOURCES_GIT_COMMIT_COMMAND);

		this.commitInput.disabled = !repo && !this.canWriteCommit();
		this.commitButton.enabled = !this.isSourcesGitWritePairingHold()
			&& (!!repo || this.canWriteCommit())
			&& hasMessage
			&& commitAvailable;
	}

	private async runCommit(): Promise<void> {
		if (this.isSourcesGitWritePairingHold()) {
			return;
		}
		const repo = this.activeRepository;
		const message = this.commitInput.value;
		if (!message.trim()) {
			return;
		}
		if (!repo && !this.canWriteCommit()) {
			return;
		}

		if (repo) {
			repo.input.setValue(message, false);
			repo.provider.inputBoxTextModel.setValue(message);
		}

		const writeHook = this.uaConnection.writeGitCommit;
		try {
			const written = await tryWriteSourcesGitCommit(
				this.uaConnection.isEngineConnected(),
				writeHook ? request => writeHook.call(this.uaConnection, request) : undefined,
				this.getGitSessionId(),
				message,
				this.isSourcesGitWritePairingHold(),
			);
			if (isSourcesGitWriteAccepted(written)) {
				this.setWriteStatusMessage(undefined);
				this.scheduleRefresh();
				return;
			}
			if (written && !isSourcesGitWriteUnsupported(written)) {
				this.setWriteStatusMessage(localize('sourcesChangesList.commitFailed', "Unable to commit: {0}", sourcesGitWriteFailureDetail(written)));
				return;
			}
		} catch (error) {
			this.setWriteStatusMessage(localize('sourcesChangesList.commitFailed', "Unable to commit: {0}", getErrorMessage(error)));
			return;
		}

		if (!repo) {
			this.setWriteStatusMessage(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
			return;
		}

		const acceptCommand = repo.provider.acceptInputCommand;
		if (acceptCommand?.id && this.isGitCommandAvailable(acceptCommand.id)) {
			try {
				await this.commandService.executeCommand(acceptCommand.id, ...(acceptCommand.arguments ?? []));
				this.setWriteStatusMessage(undefined);
			} catch (error) {
				this.setWriteStatusMessage(localize('sourcesChangesList.commitFailed', "Unable to commit: {0}", getErrorMessage(error)));
			}
			return;
		}

		if (this.isGitCommandAvailable(SOURCES_GIT_COMMIT_COMMAND)) {
			try {
				await this.commandService.executeCommand(SOURCES_GIT_COMMIT_COMMAND);
				this.setWriteStatusMessage(undefined);
			} catch (error) {
				this.setWriteStatusMessage(localize('sourcesChangesList.commitFailed', "Unable to commit: {0}", getErrorMessage(error)));
			}
			return;
		}

		this.setWriteStatusMessage(localize('sourcesChangesList.gitUnavailable', "Git stage/commit commands are not available."));
	}
}
