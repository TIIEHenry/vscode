/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sourcesReviewList.css';
import * as dom from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { Event } from '../../../../base/common/event.js';
import { Action } from '../../../../base/common/actions.js';
import { Disposable, DisposableMap, DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { ResourceLabels, IResourceLabel } from '../../../browser/labels.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IQuickDiffService } from '../../scm/common/quickDiff.js';
import { ISCMRepository, ISCMService } from '../../scm/common/scm.js';
import { collectSourcesReviewEntries, ISourcesReviewEntry } from '../common/sourcesReviewModel.js';
import {
	collectActiveReviewProgressKeys,
	countReviewProgress,
	filterReviewEntries,
	markReviewedAfterSuccessfulOpen,
} from '../common/sourcesReviewListModel.js';
import {
	ISourcesReviewProgressKey,
	ISourcesReviewProgressService,
} from '../common/sourcesReviewProgress.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';
import { openSourcesChangeEntry } from './sourcesChangesList.js';
import { SourcesListFilterBox } from './sourcesListFilterBox.js';
import { sourcesReviewListHeaderHint } from './sourcesReviewListStrings.js';

const $ = dom.$;

const REVIEW_ROW_HEIGHT = 44;

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
	readonly reviewState: HTMLElement;
}

interface ISourcesReviewRendererDelegate {
	isReviewed(entry: ISourcesReviewEntry): boolean;
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
		const reviewState = dom.append(container, $('.sources-review-state'));
		reviewState.setAttribute('aria-hidden', 'true');
		return { container, label, reviewState };
	}

	renderElement(element: ISourcesReviewEntry, _index: number, templateData: ISourcesReviewTemplateData): void {
		templateData.label.setResource({
			resource: element.resource,
			name: element.name,
			description: element.description,
		}, { hideIcon: false });

		const reviewed = this.delegate.isReviewed(element);
		templateData.reviewState.textContent = reviewed ? '○' : '●';
		templateData.reviewState.classList.toggle('reviewed', reviewed);
		templateData.reviewState.classList.toggle('unreviewed', !reviewed);
	}

	disposeTemplate(templateData: ISourcesReviewTemplateData): void {
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
		return `${element.name}, ${element.description}, ${reviewState}`;
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
	private list: WorkbenchList<ISourcesReviewEntry> | undefined;
	private labels: ResourceLabels | undefined;
	private readonly refreshScheduler: RunOnceScheduler;
	private readonly repositoryListeners = this._register(new DisposableMap<ISCMRepository>());
	private readonly entryKeys = new Map<string, ISourcesReviewProgressKey>();
	private pathFilter: URI[] | undefined;
	private unreviewedOnly = false;
	private visibleEntries: ISourcesReviewEntry[] = [];
	private allEntries: ISourcesReviewEntry[] = [];

	private readonly rendererDelegate: ISourcesReviewRendererDelegate = {
		isReviewed: (entry) => this.isEntryReviewed(entry),
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
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
	) {
		super();

		host.classList.add('show-file-icons');

		this.filterRow = dom.append(host, $('.sources-review-filter-row'));
		this.filterBox = this._register(new SourcesListFilterBox(
			this.filterRow,
			localize('sourcesReviewList.filterPlaceholder', "Filter changes"),
			localize('sourcesReviewList.filterAriaLabel', "Filter changes"),
		));
		this._register(this.filterBox.onDidChange(() => this.scheduleRefresh()));

		const toggleLabel = dom.append(this.filterRow, $('label.sources-review-unreviewed-toggle'));
		this.unreviewedToggle = dom.append(toggleLabel, $('input')) as HTMLInputElement;
		this.unreviewedToggle.type = 'checkbox';
		this.unreviewedToggle.setAttribute('aria-label', localize('sourcesReviewList.unreviewedOnly', "Unreviewed only"));
		dom.append(toggleLabel, $('span')).textContent = localize('sourcesReviewList.unreviewedOnly', "Unreviewed only");
		this._register(dom.addStandardDisposableListener(this.unreviewedToggle, 'change', () => {
			this.unreviewedOnly = this.unreviewedToggle.checked;
			this.scheduleRefresh();
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
		}));
		this.markAllButton.label = localize('sourcesReviewList.markAllReviewed', "Mark all as reviewed");
		this._register(this.markAllButton.onDidClick(() => this.markAllVisibleReviewed()));

		this.listContainer = dom.append(host, $('.sources-review-list'));
		this.emptyMessage = dom.append(host, $('.sources-review-empty'));
		this.emptyMessage.style.display = 'none';

		this.refreshScheduler = this._register(new RunOnceScheduler(() => void this.refresh(), 250));
		this._register(this.reviewProgressService.onDidChange(() => this.scheduleRefresh()));
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

	setPathFilter(paths: URI[] | undefined): void {
		this.pathFilter = paths && paths.length > 0 ? paths : undefined;
		this.scheduleRefresh();
	}

	private registerRepository(repo: ISCMRepository): void {
		if (this.repositoryListeners.has(repo)) {
			return;
		}

		const store = new DisposableStore();
		store.add(repo.provider.onDidChangeResources(() => this.scheduleRefresh()));
		store.add(repo.provider.onDidChangeResourceGroups(() => this.scheduleRefresh()));
		this.repositoryListeners.set(repo, store);
	}

	private unregisterRepository(repo: ISCMRepository): void {
		this.repositoryListeners.deleteAndDispose(repo);
	}

	private scheduleRefresh(): void {
		if (!this.refreshScheduler.isScheduled()) {
			this.refreshScheduler.schedule();
		}
	}

	private isEntryReviewed(entry: ISourcesReviewEntry): boolean {
		const key = this.entryKeys.get(entry.resource.toString());
		return key ? this.reviewProgressService.isReviewed(key) : false;
	}

	private async ensureEntryKeys(entries: readonly ISourcesReviewEntry[]): Promise<void> {
		this.entryKeys.clear();
		await Promise.all(entries.map(async entry => {
			const key = await this.reviewProgressService.resolveKey(entry.resource);
			this.entryKeys.set(entry.resource.toString(), key);
		}));
		this.reviewProgressService.pruneMissingKeys(collectActiveReviewProgressKeys(this.entryKeys));
	}

	private markAllVisibleReviewed(): void {
		const countEntries = filterReviewEntries(
			this.allEntries,
			this.filterBox.value,
			this.pathFilter,
			false,
			entry => this.isEntryReviewed(entry),
		);
		const keys = countEntries
			.map(entry => this.entryKeys.get(entry.resource.toString()))
			.filter((key): key is ISourcesReviewProgressKey => !!key);
		this.reviewProgressService.markAllReviewed(keys);
	}

	private markEntryReviewed(entry: ISourcesReviewEntry): void {
		const key = this.entryKeys.get(entry.resource.toString());
		if (key) {
			this.reviewProgressService.markReviewed(key);
		}
	}

	private markEntryUnreviewed(entry: ISourcesReviewEntry): void {
		const key = this.entryKeys.get(entry.resource.toString());
		if (key) {
			this.reviewProgressService.markUnreviewed(key);
		}
	}

	private updatePathFilterBanner(): void {
		if (!this.pathFilter || this.pathFilter.length === 0) {
			this.pathFilterBanner.style.display = 'none';
			return;
		}

		this.pathFilterBanner.style.display = 'block';
		while (this.pathFilterBanner.firstChild) {
			this.pathFilterBanner.removeChild(this.pathFilterBanner.firstChild);
		}
		const text = dom.append(this.pathFilterBanner, $('span.sources-review-path-filter-count'));
		text.textContent = localize('sourcesReviewList.pathFilterCount', "Showing {0} files from this turn", this.pathFilter.length);
		this.pathFilterBanner.appendChild(document.createTextNode(' · '));
		this.pathFilterBanner.appendChild(this.pathFilterClear);
	}

	private updateProgressHeader(entries: readonly ISourcesReviewEntry[]): void {
		const { reviewed, total } = countReviewProgress(entries, entry => this.isEntryReviewed(entry));
		this.progressCount.textContent = localize('sourcesReviewList.reviewProgress', "Reviewed {0} / {1}", reviewed, total);
		this.markAllButton.enabled = total > 0 && reviewed < total;
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
				identityProvider: { getId: (element: ISourcesReviewEntry) => element.resource.toString() },
				accessibilityProvider: new SourcesReviewAccessibilityProvider(this.rendererDelegate),
				openOnSingleClick: true,
			}
		)) as WorkbenchList<ISourcesReviewEntry>;

		this._register(this.list.onDidOpen(async e => {
			const element = e.element;
			if (!element) {
				return;
			}

			try {
				await markReviewedAfterSuccessfulOpen(
					() => openSourcesChangeEntry(element, {
						editorService: this.editorService,
						quickDiffService: this.quickDiffService,
						configurationService: this.configurationService,
						instantiationService: this.instantiationService,
						sourcesDiffPanelService: this.sourcesDiffPanelService,
					}, {
						preserveFocus: e.editorOptions.preserveFocus,
						pinned: false,
					}),
					resource => this.reviewProgressService.resolveKey(resource),
					key => this.reviewProgressService.markReviewed(key),
					element.resource,
				);
			} catch {
				// open failed — do not mark reviewed
			}
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
					return [
						new Action(
							'sources.review.markReviewed',
							localize('sourcesReviewList.markReviewed', "Mark as reviewed"),
							undefined,
							!reviewed,
							() => this.markEntryReviewed(element),
						),
						new Action(
							'sources.review.markUnreviewed',
							localize('sourcesReviewList.markUnreviewed', "Mark as unreviewed"),
							undefined,
							reviewed,
							() => this.markEntryUnreviewed(element),
						),
					];
				},
			});
		}));

		return this.list;
	}

	private async refresh(): Promise<void> {
		const hasRepository = this.scmService.repositoryCount > 0;
		this.allEntries = collectSourcesReviewEntries(this.scmService.repositories);
		await this.ensureEntryKeys(this.allEntries);

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

		const hasAnyEntries = this.allEntries.length > 0;
		const hasVisibleEntries = this.visibleEntries.length > 0;

		if (!hasRepository) {
			this.emptyMessage.textContent = localize('sourcesReviewList.noRepository', "No source control repository.");
		} else if (!hasAnyEntries) {
			this.emptyMessage.textContent = localize('sourcesReviewList.noChanges', "No changes to review.");
		} else if (!hasVisibleEntries) {
			this.emptyMessage.textContent = localize('sourcesReviewList.noMatching', "No matching changes.");
		}

		this.emptyMessage.style.display = hasVisibleEntries ? 'none' : 'block';
		this.listContainer.style.display = hasVisibleEntries ? 'block' : 'none';
		this.filterRow.style.display = hasAnyEntries ? 'flex' : 'none';
		this.progressHeader.style.display = hasAnyEntries ? 'flex' : 'none';

		if (!hasVisibleEntries) {
			return;
		}

		const list = this.ensureList();
		list.splice(0, list.length, this.visibleEntries);
	}
}
