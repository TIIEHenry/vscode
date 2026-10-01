/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sourcesReviewList.css';
import * as dom from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Event } from '../../../../base/common/event.js';
import { Action } from '../../../../base/common/actions.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ResourceLabels, IResourceLabel } from '../../../browser/labels.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { IQuickDiffService } from '../../scm/common/quickDiff.js';
import { ISCMService } from '../../scm/common/scm.js';
import { tryReadSourcesGitFileDiff, sourcesGitDiffOpenFailureMessage, sourcesGitLocalOnlyMessage, sourcesGitReadPairingHoldMessage, sourcesGitReadUnavailableNoHookMessage } from '../common/sourcesChangesGitRead.js';
import { isSourcesKeepLeftoverWrite } from '../common/sourcesChangesGitWrite.js';
import { ISourcesChangesModel, ISourcesChangesSnapshot, isSourcesChangesReadFailed, sourcesChangeEntryIdentity, sourcesChangesWriteSessionId } from '../common/sourcesChangesModel.js';
import { ISourcesReviewEntry } from '../common/sourcesReviewModel.js';
import { SourcesListViewport, sourcesParentPathLabel } from './sourcesListViewport.js';
import {
	collectActiveReviewProgressKeys,
	countReviewProgress,
	filterReviewEntries,
	markReviewedAfterSuccessfulOpen,
	reviewListEmptyReason,
} from '../common/sourcesReviewListModel.js';
import {
	ISourcesReviewProgressKey,
	ISourcesReviewProgressService,
	sourcesReviewProgressBucket,
	sourcesReviewProgressTarget,
} from '../common/sourcesReviewProgress.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';
import {
	CONVERSATION_REVEAL_ITEM_COMMAND,
	IReviewAttributionChipDisplay,
	ISourcesReviewAttributionService,
} from '../common/sourcesReviewAttribution.js';
import { conversationDiffComparisonLoadFailedMessage } from './conversationDiffReviewPane.js';
import { openSourcesChangeEntry } from './sourcesChangesList.js';
import { sourcesAlternateOpenAction, sourcesEditorOpenSlot } from './sourcesEditorOpenMode.js';
import { beginSourcesReviewOpenStatus, isCurrentSourcesReviewOpenStatus, settleSourcesOpenStatus } from './sourcesOpenStatus.js';
import { SourcesListFilterBox } from './sourcesListFilterBox.js';
import { sourcesReviewListEmptyMessage, sourcesReviewListHeaderHint, sourcesReviewRevealMissHint } from './sourcesReviewListStrings.js';

const $ = dom.$;

const REVIEW_ROW_HEIGHT = 28;

function isSourcesReviewErrorStatus(message: string): boolean {
	return message !== sourcesGitReadPairingHoldMessage()
		&& message !== sourcesGitReadUnavailableNoHookMessage()
		&& message !== sourcesGitLocalOnlyMessage();
}

class SourcesReviewDelegate implements IListVirtualDelegate<ISourcesReviewEntry> {
	getHeight(): number {
		return REVIEW_ROW_HEIGHT;
	}

	getTemplateId(): string {
		return 'sourcesReview';
	}
}

interface ISourcesReviewTemplateData {
	readonly container: HTMLElement;
	readonly label: IResourceLabel;
	readonly attribution: HTMLElement;
	readonly reviewState: HTMLButtonElement;
	readonly elementDisposables: DisposableStore;
}

interface ISourcesReviewRendererDelegate {
	isReviewed(entry: ISourcesReviewEntry): boolean;
	isSourcesGitWriteListFailed(): boolean;
	isSourcesKeepLeftoverWrite(): boolean;
	getChips(entry: ISourcesReviewEntry): readonly IReviewAttributionChipDisplay[];
	getChipTitle(chip: IReviewAttributionChipDisplay): string;
	onChipClick(toolCallId: string): void;
	onReviewToggle(entry: ISourcesReviewEntry): void;
}

class SourcesReviewRenderer implements IListRenderer<ISourcesReviewEntry, ISourcesReviewTemplateData> {
	static readonly TEMPLATE_ID = 'sourcesReview';

	readonly templateId = SourcesReviewRenderer.TEMPLATE_ID;

	constructor(
		private readonly labels: ResourceLabels,
		private readonly delegate: ISourcesReviewRendererDelegate,
	) { }

	renderTemplate(container: HTMLElement): ISourcesReviewTemplateData {
		container.classList.add('sources-review-row');
		const label = this.labels.create(container, { supportDescriptionHighlights: true });
		const attribution = dom.append(container, $('.sources-review-attribution'));
		const reviewState = dom.append(container, $('button.sources-review-state')) as HTMLButtonElement;
		reviewState.type = 'button';
		return { container, label, attribution, reviewState, elementDisposables: new DisposableStore() };
	}

	renderElement(element: ISourcesReviewEntry, _index: number, templateData: ISourcesReviewTemplateData): void {
		templateData.elementDisposables.clear();
		const parentPath = element.gitPath ? sourcesParentPathLabel(element.gitPath) : sourcesParentPathLabel(element.description);
		templateData.label.setResource({
			resource: element.resource,
			name: element.name,
			description: parentPath || element.description,
		}, { hideIcon: false });

		const reviewed = this.delegate.isReviewed(element);
		templateData.reviewState.textContent = reviewed ? '○' : '●';
		templateData.reviewState.dataset.reviewLabel = reviewed
			? localize('sourcesReviewList.reviewedShort', "Reviewed")
			: localize('sourcesReviewList.unreviewedShort', "Unreviewed");
		templateData.reviewState.classList.toggle('reviewed', reviewed);
		templateData.reviewState.classList.toggle('unreviewed', !reviewed);
		const reviewLabel = reviewed
			? localize('sourcesReviewList.markUnreviewed', "Mark as unreviewed")
			: localize('sourcesReviewList.markReviewed', "Mark as reviewed");
		const writeHold = this.delegate.isSourcesGitWriteListFailed() || this.delegate.isSourcesKeepLeftoverWrite();
		templateData.reviewState.disabled = writeHold;
		templateData.reviewState.setAttribute('aria-pressed', String(reviewed));
		templateData.reviewState.setAttribute('aria-label', reviewLabel);
		templateData.reviewState.setAttribute('aria-disabled', String(writeHold));
		templateData.reviewState.title = reviewLabel;
		if (!writeHold) {
			templateData.elementDisposables.add(dom.addDisposableListener(templateData.reviewState, 'click', event => {
				event.preventDefault();
				event.stopPropagation();
				this.delegate.onReviewToggle(element);
			}));
			templateData.elementDisposables.add(dom.addDisposableListener(templateData.reviewState, 'keydown', event => {
				if (event.key === ' ' || event.key === 'Enter') {
					event.stopPropagation();
				}
			}));
		}

		dom.clearNode(templateData.attribution);
		const chips = this.delegate.getChips(element);
		for (const chip of chips) {
			if (chip.overflow) {
				const overflow = dom.append(templateData.attribution, $('span.sources-review-attribution-chip.overflow'));
				overflow.textContent = chip.label;
				continue;
			}

			const button = dom.append(templateData.attribution, $('button.sources-review-attribution-chip')) as HTMLButtonElement;
			button.type = 'button';
			button.textContent = chip.label;
			button.title = this.delegate.getChipTitle(chip);
			button.setAttribute('aria-label', this.delegate.getChipTitle(chip));
			button.addEventListener('click', event => {
				event.preventDefault();
				event.stopPropagation();
				this.delegate.onChipClick(chip.toolCallId);
			});
			button.addEventListener('keydown', event => {
				if (event.key === ' ' || event.key === 'Enter') {
					event.stopPropagation();
				}
			});
		}
	}

	disposeElement(_element: ISourcesReviewEntry, _index: number, templateData: ISourcesReviewTemplateData): void {
		templateData.elementDisposables.clear();
	}

	disposeTemplate(templateData: ISourcesReviewTemplateData): void {
		templateData.elementDisposables.dispose();
		templateData.label.dispose();
	}
}

class SourcesReviewAccessibilityProvider implements IListAccessibilityProvider<ISourcesReviewEntry> {

	constructor(private readonly delegate: ISourcesReviewRendererDelegate) { }

	getWidgetAriaLabel(): string {
		return localize('sourcesReviewList.ariaLabel', "Sources Review");
	}

	getAriaLabel(element: ISourcesReviewEntry): string {
		const reviewState = this.delegate.isReviewed(element)
			? localize('sourcesReviewList.reviewed', "reviewed")
			: localize('sourcesReviewList.unreviewed', "unreviewed");
		const chips = this.delegate.getChips(element);
		const attribution = chips.length > 0
			? `, ${chips.map(chip => chip.label).join(', ')}`
			: '';
		return `${element.name}, ${element.description}, ${reviewState}${attribution}`;
	}
}

export class SourcesReviewList extends Disposable {

	private readonly filterBox: SourcesListFilterBox;
	private readonly filterRow: HTMLElement;
	private readonly unreviewedToggle: HTMLInputElement;
	private readonly pathFilterBanner: HTMLElement;
	private readonly pathFilterClear: HTMLButtonElement;
	private readonly headerHint: HTMLElement;
	private readonly progressHeader: HTMLElement;
	private readonly progressCount: HTMLElement;
	private readonly markAllButton: Button;
	private readonly listContainer: HTMLElement;
	private readonly emptyMessage: HTMLElement;
	private readonly statusMessage: HTMLElement;
	private list: WorkbenchList<ISourcesReviewEntry> | undefined;
	private listViewport: SourcesListViewport | undefined;
	private labels: ResourceLabels | undefined;
	private readonly refreshScheduler = { flush: () => this.changesModel.flushScheduledRefresh() };
	private pathFilter: URI[] | undefined;
	private unreviewedOnly = false;
	private visibleEntries: ISourcesReviewEntry[] = [];
	private allEntries: ISourcesReviewEntry[] = [];
	private chipMap = new Map<string, readonly IReviewAttributionChipDisplay[]>();
	private lastRevealMissToolCallId: string | undefined;
	private _revealGeneration = 0;

	private readonly rendererDelegate: ISourcesReviewRendererDelegate = {
		isReviewed: (entry) => this.isEntryReviewed(entry),
		isSourcesGitWriteListFailed: () => this.changesModel.isWriteClosed(),
		isSourcesKeepLeftoverWrite: () => false,
		getChips: (entry) => this.chipMap.get(entry.resource.toString()) ?? [],
		getChipTitle: (chip) => !chip.overflow && this.lastRevealMissToolCallId === chip.toolCallId
			? sourcesReviewRevealMissHint
			: chip.label,
		onChipClick: (toolCallId) => void this.revealAttributionItem(toolCallId).catch(onUnexpectedError).catch(onUnexpectedError),
		onReviewToggle: (entry) => this.toggleEntryReview(entry),
	};

	constructor(
		host: HTMLElement,
		@ISCMService private readonly scmService: ISCMService,
		@IEditorService private readonly editorService: IEditorService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IQuickDiffService private readonly quickDiffService: IQuickDiffService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ISourcesDiffPanelService private readonly sourcesDiffPanelService: ISourcesDiffPanelService,
		@ISourcesReviewProgressService private readonly reviewProgressService: ISourcesReviewProgressService,
		@ISourcesReviewAttributionService private readonly attributionService: ISourcesReviewAttributionService,
		@ICommandService private readonly commandService: ICommandService,
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
		@IUniverseAgentConnection private readonly uaConnection: IUniverseAgentConnection,
		@IModelService private readonly modelService: IModelService,
		@IAgentSessionContext private readonly session: IAgentSessionContext,
		@ISourcesChangesModel private readonly changesModel: ISourcesChangesModel,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
	) {
		super();

		host.classList.add('show-file-icons');

		this.filterRow = dom.append(host, $('.sources-review-filter-row'));
		this.filterBox = this._register(new SourcesListFilterBox(
			this.filterRow,
			localize('sourcesReviewList.filterPlaceholder', "Filter changes"),
			localize('sourcesReviewList.filterAriaLabel', "Filter changes"),
		));
		this._register(this.filterBox.onDidChange(() => this.repaint()));

		const toggleLabel = dom.append(this.filterRow, $('label.sources-review-unreviewed-toggle'));
		this.unreviewedToggle = dom.append(toggleLabel, $('input')) as HTMLInputElement;
		this.unreviewedToggle.type = 'checkbox';
		this.unreviewedToggle.setAttribute('aria-label', localize('sourcesReviewList.unreviewedOnly', "Unreviewed only"));
		dom.append(toggleLabel, $('span')).textContent = localize('sourcesReviewList.unreviewedOnly', "Unreviewed only");
		this._register(dom.addStandardDisposableListener(this.unreviewedToggle, 'change', () => {
			this.unreviewedOnly = this.unreviewedToggle.checked;
			this.repaint();
		}));

		this.pathFilterBanner = dom.append(host, $('.sources-review-path-filter'));
		this.pathFilterBanner.style.display = 'none';
		this.pathFilterClear = dom.append(this.pathFilterBanner, $('button.sources-review-path-filter-clear')) as HTMLButtonElement;
		this.pathFilterClear.type = 'button';
		this.pathFilterClear.textContent = localize('sourcesReviewList.clearPathFilter', "Clear");
		this._register(dom.addDisposableListener(this.pathFilterClear, dom.EventType.CLICK, () => {
			this.setPathFilter(undefined);
		}));

		this.headerHint = dom.append(host, $('.sources-review-header-hint'));
		this.headerHint.setAttribute('role', 'note');
		this.headerHint.textContent = sourcesReviewListHeaderHint;

		this.progressHeader = dom.append(host, $('.sources-review-progress-header'));
		this.progressCount = dom.append(this.progressHeader, $('.sources-review-progress-count'));
		this.markAllButton = this._register(new Button(this.progressHeader, {
			supportIcons: false,
			title: localize('sourcesReviewList.markAllReviewed', "Mark all as reviewed"),
			...defaultButtonStyles,
			secondary: true,
		}));
		this.markAllButton.label = localize('sourcesReviewList.markAllReviewed', "Mark all as reviewed");
		this._register(this.markAllButton.onDidClick(() => this.markAllVisibleReviewed()));

		this.listContainer = dom.append(host, $('.sources-review-list'));
		this.emptyMessage = dom.append(host, $('.sources-review-empty'));
		this.emptyMessage.setAttribute('role', 'status');
		this.emptyMessage.style.display = 'none';
		this.statusMessage = dom.append(host, $('.sources-review-status'));
		this.statusMessage.style.display = 'none';
		this.statusMessage.setAttribute('role', 'status');

		this._register(this.reviewProgressService.onDidChange(() => this.repaint()));
		this._register(this.attributionService.onDidChange(() => this.repaint()));
		this._register(this.changesModel.onDidChange(() => this.onModelChange()));
		this.onModelChange();
		// Leak tests flush this proxy and call scheduleRefresh. The model owns the timer.
		void this.refreshScheduler;
		void this.scheduleRefresh;
	}

	override dispose(): void {
		++this._revealGeneration;
		super.dispose();
	}

	setPathFilter(paths: URI[] | undefined): void {
		this.pathFilter = paths && paths.length > 0 ? paths : undefined;
		this.repaint();
	}

	getSelectedEntry(): ISourcesReviewEntry | undefined {
		return this.list?.getSelectedElements()[0];
	}

	/** List-fail leftover or KEEP pairing-hold leftover is not a live FileDiff / preview surface (D444 / D446). */
	isSourcesGitFileDiffOpenSkipped(): boolean {
		return this.changesModel.isFileDiffOpenSkipped();
	}

	readGitFileDiffForOpen(entry: ISourcesReviewEntry) {
		return this.readGitFileDiff(entry);
	}

	/** D449 / D459 KEEP leftover list-fail: connected + !pairingPending + session not ready. */
	isSourcesKeepLeftoverWrite(): boolean {
		return isSourcesKeepLeftoverWrite(
			this.uaConnection.isEngineConnected(),
			!!this.uaConnection.getConnectionSnapshot?.().pairingPending,
			this.session.isEngineSessionReady(),
		);
	}

	isSourcesGitWriteClosed(): boolean {
		return this.changesModel.isWriteClosed();
	}

	toggleReviewedSelected(): void {
		if (this.isSourcesGitWriteClosed()) {
			return;
		}
		const entry = this.getSelectedEntry();
		if (!entry) {
			return;
		}
		this.toggleEntryReview(entry);
	}

	markAllReviewed(): void {
		this.markAllVisibleReviewed();
	}

	setStatusMessage(message: string | undefined, isError?: boolean): void {
		if (!message) {
			this.statusMessage.textContent = '';
			this.statusMessage.style.display = 'none';
			this.statusMessage.classList.remove('is-error');
			return;
		}
		this.statusMessage.textContent = message;
		this.statusMessage.style.display = 'block';
		this.statusMessage.classList.toggle('is-error', isError ?? isSourcesReviewErrorStatus(message));
	}

	private onModelChange(): void {
		void this.paintFromModel().catch(onUnexpectedError).catch(onUnexpectedError);
	}

	private scheduleRefresh(): void {
		this.changesModel.scheduleRefresh();
	}

	private showLoadingIfEmpty(): void {
		if (!this.list || this.list.length === 0) {
			this.emptyMessage.textContent = localize('sourcesReviewList.loading', "Loading…");
			this.emptyMessage.style.display = '';
			this.listContainer.style.display = 'none';
		}
	}

	private async paintFromModel(): Promise<void> {
		const snapshot = this.changesModel.getSnapshot();
		const generation = snapshot.generation;
		if (!snapshot.settled) {
			if (this.changesModel.getSnapshot().generation !== generation) {
				return;
			}
			this.showLoadingIfEmpty();
			return;
		}
		await this.ensureEntryKeys(snapshot.entries, generation);
		if (this.changesModel.getSnapshot().generation !== generation || this._store.isDisposed) {
			return;
		}
		this.renderSnapshot(snapshot);
	}

	/** Filter, progress, and attribution repaint the current snapshot and do not start a git read. */
	private repaint(): void {
		const snapshot = this.changesModel.getSnapshot();
		if (!snapshot.settled) {
			this.showLoadingIfEmpty();
			return;
		}
		this.renderSnapshot(snapshot);
	}

	private isEntryReviewed(entry: ISourcesReviewEntry): boolean {
		return this.reviewProgressService.isEntryReviewed(sourcesReviewProgressTarget(entry));
	}

	/**
	 * Recompute hashes only for entries that are already reviewed.
	 * A newer P2 generation must not clear or prune. Prune is limited to this snapshot's bucket.
	 */
	private async ensureEntryKeys(entries: readonly ISourcesReviewEntry[], generation = this.changesModel.getSnapshot().generation): Promise<void> {
		if (this.changesModel.getSnapshot().generation !== generation) {
			return;
		}
		if (!this.reviewProgressService.hasReviewed()) {
			return;
		}

		const targets = entries.filter(entry => this.reviewProgressService.isEntryReviewed(sourcesReviewProgressTarget(entry)));
		const resolved: ISourcesReviewProgressKey[] = [];
		if (targets.length > 0) {
			const keys = await Promise.all(targets.map(entry => this.reviewProgressService.resolveKey(sourcesReviewProgressTarget(entry))));
			if (this.changesModel.getSnapshot().generation !== generation) {
				return;
			}
			resolved.push(...keys);
		}

		if (this.changesModel.getSnapshot().generation !== generation) {
			return;
		}
		for (const key of resolved) {
			this.reviewProgressService.noteRefreshedKey(key);
		}
		if (this.changesModel.getSnapshot().generation !== generation) {
			return;
		}

		const bucket = sourcesReviewProgressBucket(this.changesModel.getSnapshot());
		if (!bucket) {
			return;
		}
		const active = new Map<string, ISourcesReviewProgressKey>();
		for (const entry of entries) {
			const key = this.reviewProgressService.getReviewedKey(sourcesReviewProgressTarget(entry));
			if (!key || key.origin !== bucket.origin || key.sessionId !== bucket.sessionId) {
				continue;
			}
			active.set(entry.resource.toString(), key);
		}
		this.reviewProgressService.pruneMissingKeys(bucket, collectActiveReviewProgressKeys(active));
	}

	private markAllVisibleReviewed(): void {
		if (this.isSourcesGitWriteClosed()) {
			return;
		}
		const countEntries = filterReviewEntries(
			this.allEntries,
			this.filterBox.value,
			this.pathFilter,
			false,
			entry => this.isEntryReviewed(entry),
		);
		void this.markEntriesReviewed(countEntries, true).catch(onUnexpectedError).catch(onUnexpectedError);
	}

	private markEntryReviewed(entry: ISourcesReviewEntry): void {
		if (this.isSourcesGitWriteClosed()) {
			return;
		}
		void this.markEntriesReviewed([entry], false).catch(onUnexpectedError).catch(onUnexpectedError);
	}

	private async markEntriesReviewed(entries: readonly ISourcesReviewEntry[], all: boolean): Promise<void> {
		if (this.isSourcesGitWriteClosed() || this._store.isDisposed) {
			return;
		}
		const keys: ISourcesReviewProgressKey[] = [];
		for (const entry of entries) {
			keys.push(await this.reviewProgressService.resolveKey(sourcesReviewProgressTarget(entry)));
			if (this.isSourcesGitWriteClosed() || this._store.isDisposed) {
				return;
			}
		}
		if (all) {
			this.reviewProgressService.markAllReviewed(keys);
		} else if (keys[0]) {
			this.reviewProgressService.markReviewed(keys[0]);
		}
		for (const key of keys) {
			this.reviewProgressService.noteRefreshedKey(key);
		}
	}

	private markEntryUnreviewed(entry: ISourcesReviewEntry): void {
		if (this.isSourcesGitWriteClosed()) {
			return;
		}
		const key = this.reviewProgressService.getReviewedKey(sourcesReviewProgressTarget(entry));
		if (key) {
			this.reviewProgressService.markUnreviewed(key);
		}
	}

	private toggleEntryReview(entry: ISourcesReviewEntry): void {
		if (this.isSourcesGitWriteClosed()) {
			return;
		}
		if (this.isEntryReviewed(entry)) {
			this.markEntryUnreviewed(entry);
		} else {
			this.markEntryReviewed(entry);
		}
	}

	private updateHeaderHint(): void {
		const parts = [sourcesReviewListHeaderHint];
		const attributionSuffix = this.attributionService.getAttributionHeaderSuffix();
		if (attributionSuffix) {
			parts.push(attributionSuffix);
		}
		const workDirNote = this.attributionService.getWorkDirMismatchNote();
		if (workDirNote) {
			parts.push(workDirNote);
		}
		if (this.lastRevealMissToolCallId) {
			parts.push(sourcesReviewRevealMissHint);
		}
		const hint = parts.join(' ');
		this.headerHint.textContent = hint;
		this.headerHint.title = hint;
		this.headerHint.classList.toggle('is-critical', !!(workDirNote || this.lastRevealMissToolCallId));
	}

	private async revealAttributionItem(toolCallId: string): Promise<void> {
		const generation = ++this._revealGeneration;
		const itemId = this.attributionService.resolveRevealItemId(toolCallId);
		try {
			await this.commandService.executeCommand(CONVERSATION_REVEAL_ITEM_COMMAND, { toolCallId });
			if (generation !== this._revealGeneration || this._store.isDisposed) {
				return;
			}
			this.lastRevealMissToolCallId = itemId ? undefined : toolCallId;
		} catch {
			if (generation !== this._revealGeneration || this._store.isDisposed) {
				return;
			}
			this.lastRevealMissToolCallId = toolCallId;
		}
		this.updateHeaderHint();
		this.repaint();
	}

	private updatePathFilterBanner(): void {
		if (!this.pathFilter || this.pathFilter.length === 0) {
			this.pathFilterBanner.style.display = 'none';
			return;
		}

		const visibleCount = filterReviewEntries(
			this.allEntries,
			this.filterBox.value,
			this.pathFilter,
			false,
			entry => this.isEntryReviewed(entry),
		).length;
		this.pathFilterBanner.style.display = 'block';
		while (this.pathFilterBanner.firstChild) {
			this.pathFilterBanner.removeChild(this.pathFilterBanner.firstChild);
		}
		const text = dom.append(this.pathFilterBanner, $('span.sources-review-path-filter-count'));
		text.textContent = localize('sourcesReviewList.pathFilterCount', "Showing {0} files from this turn", visibleCount);
		this.pathFilterBanner.appendChild(document.createTextNode(' · '));
		this.pathFilterBanner.appendChild(this.pathFilterClear);
	}

	private updateProgressHeader(entries: readonly ISourcesReviewEntry[]): void {
		const { reviewed, total } = countReviewProgress(entries, entry => this.isEntryReviewed(entry));
		this.progressCount.textContent = localize('sourcesReviewList.reviewProgress', "Reviewed {0} / {1}", reviewed, total);
		this.markAllButton.enabled = total > 0 && reviewed < total && !this.isSourcesGitWriteClosed();
	}

	private ensureList(): WorkbenchList<ISourcesReviewEntry> {
		if (this.list) {
			return this.list;
		}

		this.labels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: Event.None }));
		const delegate = new SourcesReviewDelegate();
		const renderer = new SourcesReviewRenderer(this.labels, this.rendererDelegate);

		this.list = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'SourcesReview',
			this.listContainer,
			delegate,
			[renderer],
			{
				identityProvider: { getId: (element: ISourcesReviewEntry) => sourcesChangeEntryIdentity(element) },
				accessibilityProvider: new SourcesReviewAccessibilityProvider(this.rendererDelegate),
				openOnSingleClick: true,
			}
		)) as WorkbenchList<ISourcesReviewEntry>;

		this._register(this.list.onDidOpen(e => {
			void (async () => {
				const element = e.element;
				if (!element) {
					return;
				}
				// List-fail leftover and KEEP pairing-hold leftover are not live FileDiff / preview surfaces (D444 / D446).
				if (this.isSourcesGitFileDiffOpenSkipped()) {
					return;
				}

				const generation = beginSourcesReviewOpenStatus();
				let opened: boolean | 'stale' | undefined;
				try {
					await markReviewedAfterSuccessfulOpen(
						async () => {
							opened = await openSourcesChangeEntry(element, {
								editorService: this.editorService,
								quickDiffService: this.quickDiffService,
								configurationService: this.configurationService,
								instantiationService: this.instantiationService,
								sourcesDiffPanelService: this.sourcesDiffPanelService,
								modelService: this.modelService,
								readGitFileDiff: entry => this.readGitFileDiff(entry),
								editorGroupsService: this.editorGroupsService,
								session: this.session,
							}, {
								preserveFocus: e.editorOptions.preserveFocus,
								pinned: false,
								slot: e.sideBySide ? undefined : sourcesEditorOpenSlot(this.configurationService),
							});
							return opened;
						},
						async () => this.reviewProgressService.resolveKey(sourcesReviewProgressTarget(element)),
						key => {
							// KEEP leftover list-fail is not a live Mark surface (D459).
							// FileDiff open stays leftoverListFailed / pairing-hold only (D444 / D446).
							if (this.isSourcesGitWriteClosed()) {
								return;
							}
							this.reviewProgressService.markReviewed(key);
						},
						element.resource,
					);
					if (opened !== undefined) {
						settleSourcesOpenStatus(generation, isCurrentSourcesReviewOpenStatus, opened, {
							onFalse: () => this.setStatusMessage(sourcesGitDiffOpenFailureMessage(new Error(conversationDiffComparisonLoadFailedMessage())), true),
						});
					}
				} catch (error) {
					if (isCurrentSourcesReviewOpenStatus(generation)) {
						this.setStatusMessage(sourcesGitDiffOpenFailureMessage(error), true);
					}
				}
			})().catch(onUnexpectedError).catch(onUnexpectedError);
		}));

		this._register(this.list.onContextMenu(e => {
			const element = e.element;
			if (!element) {
				return;
			}

			this.contextMenuService.showContextMenu({
				getAnchor: () => e.anchor,
				getActions: () => {
					const reviewed = this.isEntryReviewed(element);
					const canMark = !this.isSourcesGitWriteClosed();
					const openAction = this.isSourcesGitFileDiffOpenSkipped()
						? []
						: [sourcesAlternateOpenAction(sourcesEditorOpenSlot(this.configurationService), slot => {
							void openSourcesChangeEntry(element, {
								editorService: this.editorService,
								quickDiffService: this.quickDiffService,
								configurationService: this.configurationService,
								instantiationService: this.instantiationService,
								sourcesDiffPanelService: this.sourcesDiffPanelService,
								modelService: this.modelService,
								readGitFileDiff: entry => this.readGitFileDiff(entry),
								editorGroupsService: this.editorGroupsService,
								session: this.session,
							}, { preserveFocus: true, slot }).catch(onUnexpectedError).catch(onUnexpectedError);
						})];
					return [
						...openAction,
						new Action(
							'sources.review.markReviewed',
							localize('sourcesReviewList.markReviewed', "Mark as reviewed"),
							undefined,
							canMark && !reviewed,
							() => this.markEntryReviewed(element),
						),
						new Action(
							'sources.review.markUnreviewed',
							localize('sourcesReviewList.markUnreviewed', "Mark as unreviewed"),
							undefined,
							canMark && reviewed,
							() => this.markEntryUnreviewed(element),
						),
					];
				},
			});
		}));

		this.listViewport = this._register(new SourcesListViewport(this.listContainer, () => this.list));
		return this.list;
	}

	private writeSessionId(entries?: readonly { sessionId?: string }[]): string {
		return sourcesChangesWriteSessionId(this.changesModel.getSnapshot(), entries, this.session.getActiveSessionId());
	}

	private async readGitFileDiff(entry: ISourcesReviewEntry) {
		const hook = this.uaConnection.readGitFileDiff;
		const snapshot = this.changesModel.getSnapshot();
		return tryReadSourcesGitFileDiff(
			this.uaConnection.isEngineConnected(),
			hook ? request => hook.call(this.uaConnection, request) : undefined,
			this.writeSessionId([entry]),
			entry.gitPath ?? '',
			entry.indexState ?? '',
			this.session.isPairingHold(),
			isSourcesChangesReadFailed(snapshot.state),
		);
	}

	private renderSnapshot(snapshot: ISourcesChangesSnapshot): void {
		const gitReadError = snapshot.failureMessage;
		const gitReadPairingHold = snapshot.state.kind === 'engine-leftover' && snapshot.state.reason === 'pairing-hold';
		const gitReadNoHook = snapshot.state.kind === 'engine-leftover' && snapshot.state.reason === 'no-hook';
		const localOnly = snapshot.state.kind === 'scm' && snapshot.entries.length > 0 && !gitReadError;
		this.allEntries = [...snapshot.entries];
		const hasRepository = snapshot.state.kind !== 'scm' || this.scmService.repositoryCount > 0;

		this.updatePathFilterBanner();

		const countEntries = filterReviewEntries(
			this.allEntries,
			this.filterBox.value,
			this.pathFilter,
			false,
			entry => this.isEntryReviewed(entry),
		);
		this.updateProgressHeader(countEntries);

		this.visibleEntries = filterReviewEntries(
			this.allEntries,
			this.filterBox.value,
			this.pathFilter,
			this.unreviewedOnly,
			entry => this.isEntryReviewed(entry),
		);

		this.chipMap = new Map(this.attributionService.buildChipMapForEntries(this.allEntries));
		this.updateHeaderHint();

		const hasAnyEntries = this.allEntries.length > 0;
		const hasVisibleEntries = this.visibleEntries.length > 0;
		const emptyReason = reviewListEmptyReason(
			hasRepository,
			this.allEntries,
			this.filterBox.value,
			this.pathFilter,
			this.unreviewedOnly,
			entry => this.isEntryReviewed(entry),
		);
		this.emptyMessage.classList.toggle('is-error', !!gitReadError && !hasAnyEntries);
		if (gitReadError && !hasAnyEntries) {
			this.emptyMessage.textContent = gitReadError;
		} else if (emptyReason) {
			this.emptyMessage.textContent = sourcesReviewListEmptyMessage(emptyReason);
		}

		this.emptyMessage.style.display = hasVisibleEntries ? 'none' : '';
		this.listContainer.style.display = hasVisibleEntries ? 'block' : 'none';
		this.filterRow.style.display = hasAnyEntries ? 'flex' : 'none';
		this.progressHeader.style.display = hasAnyEntries ? 'flex' : 'none';
		this.headerHint.style.display = hasAnyEntries ? '' : 'none';
		if (gitReadError) {
			this.setStatusMessage(gitReadError, true);
		} else if (gitReadPairingHold) {
			this.setStatusMessage(sourcesGitReadPairingHoldMessage());
		} else if (gitReadNoHook) {
			this.setStatusMessage(sourcesGitReadUnavailableNoHookMessage());
		} else if (localOnly) {
			this.setStatusMessage(sourcesGitLocalOnlyMessage());
		} else {
			this.setStatusMessage(undefined);
		}

		if (this.list) {
			this.list.splice(0, this.list.length, this.visibleEntries);
		} else if (hasVisibleEntries) {
			this.ensureList().splice(0, 0, this.visibleEntries);
		}
		this.listViewport?.layout();
	}
}
