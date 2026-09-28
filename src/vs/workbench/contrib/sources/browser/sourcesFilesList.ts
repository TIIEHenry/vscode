/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sourcesFilesList.css';
import * as dom from '../../../../base/browser/dom.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { EditorOpenSource } from '../../../../platform/editor/common/editor.js';
import { ResourceLabels, IResourceLabel } from '../../../browser/labels.js';
import { ACTIVE_GROUP, IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { DEFAULT_MAX_SEARCH_RESULTS, getExcludes, ISearchConfiguration, ISearchService } from '../../../services/search/common/search.js';
import { filterSourcesEntries } from '../common/sourcesFilterModel.js';
import { collectSourcesFileEntries, ISourcesFileEntry, ISourcesFilesCollectOutcome, resolveSourcesFilesCollectResult } from '../common/sourcesFilesModel.js';
import { sourcesFilesListEmptyMessage, sourcesFilesListReadFailureMessage, sourcesFilesListTruncatedMessage } from './sourcesFilesListStrings.js';
import { SourcesListFilterBox } from './sourcesListFilterBox.js';
import { SourcesListViewport, sourcesParentPathLabel } from './sourcesListViewport.js';

const $ = dom.$;

class SourcesFilesDelegate implements IListVirtualDelegate<ISourcesFileEntry> {
	getHeight(): number {
		return 28;
	}

	getTemplateId(): string {
		return 'sourcesFile';
	}
}

interface ISourcesFileTemplateData {
	readonly container: HTMLElement;
	readonly label: IResourceLabel;
}

class SourcesFilesRenderer implements IListRenderer<ISourcesFileEntry, ISourcesFileTemplateData> {
	static readonly TEMPLATE_ID = 'sourcesFile';

	readonly templateId = SourcesFilesRenderer.TEMPLATE_ID;

	constructor(private readonly labels: ResourceLabels) { }

	renderTemplate(container: HTMLElement): ISourcesFileTemplateData {
		container.classList.add('sources-file-row');
		const label = this.labels.create(container, { supportDescriptionHighlights: true });
		return { container, label };
	}

	renderElement(element: ISourcesFileEntry, _index: number, templateData: ISourcesFileTemplateData): void {
		const parentPath = sourcesParentPathLabel(element.description);
		templateData.label.setResource({
			resource: element.resource,
			name: element.name,
			description: parentPath || undefined,
		}, {
			hideIcon: false,
			title: element.description || element.name,
		});
	}

	disposeTemplate(templateData: ISourcesFileTemplateData): void {
		templateData.label.dispose();
	}
}

class SourcesFilesAccessibilityProvider implements IListAccessibilityProvider<ISourcesFileEntry> {
	getWidgetAriaLabel(): string {
		return localize('sourcesFilesList.ariaLabel', "Sources Files");
	}

	getAriaLabel(element: ISourcesFileEntry): string {
		return element.description;
	}
}

export class SourcesFilesList extends Disposable {

	private readonly listContainer: HTMLElement;
	private readonly emptyMessage: HTMLElement;
	private readonly statusMessage: HTMLElement;
	private readonly filterBox: SourcesListFilterBox;
	private list: WorkbenchList<ISourcesFileEntry> | undefined;
	private listViewport: SourcesListViewport | undefined;
	private labels: ResourceLabels | undefined;
	private lastGoodEntries: ISourcesFileEntry[] = [];
	private lastOutcome: ISourcesFilesCollectOutcome | undefined;
	private lastReadError: string | undefined;
	private filesSearchDirty = false;
	private filesTabActive = true;
	private readonly refreshScheduler: RunOnceScheduler;
	private folderCancellations: CancellationTokenSource[] = [];
	private _refreshSeq = 0;

	constructor(
		private readonly host: HTMLElement,
		@IEditorService private readonly editorService: IEditorService,
		@IFileService private readonly fileService: IFileService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ISearchService private readonly searchService: ISearchService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
	) {
		super();

		host.classList.add('show-file-icons');

		this.filterBox = this._register(new SourcesListFilterBox(
			host,
			localize('sourcesFilesList.filterPlaceholder', "Filter files"),
			localize('sourcesFilesList.filterAriaLabel', "Filter files"),
		));
		this._register(this.filterBox.onDidChange(() => this.paintCollected()));

		this.listContainer = dom.append(host, $('.sources-files-list'));
		this.statusMessage = dom.append(host, $('.sources-files-status'));
		this.statusMessage.setAttribute('role', 'status');
		this.statusMessage.style.display = 'none';
		this.emptyMessage = dom.append(host, $('.sources-files-empty'));
		this.emptyMessage.setAttribute('role', 'status');
		this.emptyMessage.style.display = 'none';

		this.refreshScheduler = this._register(new RunOnceScheduler(() => void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError), 250));
		this.scheduleRefresh();

		this._register(this.fileService.onDidFilesChange(() => this.onSearchTrigger()));
		this._register(this.workspaceContextService.onDidChangeWorkspaceFolders(() => this.onSearchTrigger()));
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('files.exclude')
				|| e.affectsConfiguration('search.exclude')
				|| e.affectsConfiguration('search.useIgnoreFiles')
				|| e.affectsConfiguration('search.useParentIgnoreFiles')
				|| e.affectsConfiguration('search.maxResults')) {
				this.onSearchTrigger();
			}
		}));
		this._register(this.layoutService.onDidChangePartVisibility(() => this.onSearchVisibilityChanged()));
	}

	/** Tabs host tells the list whether the Files panel is the selected tab. */
	setFilesTabActive(active: boolean): void {
		if (this.filesTabActive === active) {
			return;
		}
		this.filesTabActive = active;
		this.onSearchVisibilityChanged();
	}

	private isFilesSearchVisible(): boolean {
		if (!this.filesTabActive) {
			return false;
		}
		if (!this.layoutService.isVisible(Parts.SOURCES_PART)) {
			return false;
		}
		if (this.host.classList.contains('sources-tab-panel') && (!this.host.classList.contains('visible') || this.host.hasAttribute('hidden'))) {
			return false;
		}
		return true;
	}

	private onSearchTrigger(): void {
		if (!this.isFilesSearchVisible()) {
			this.filesSearchDirty = true;
			return;
		}
		this.scheduleRefresh();
	}

	private onSearchVisibilityChanged(): void {
		if (this.isFilesSearchVisible() && this.filesSearchDirty) {
			this.scheduleRefresh();
		}
	}

	private scheduleRefresh(): void {
		if (!this.isFilesSearchVisible()) {
			this.filesSearchDirty = true;
			return;
		}
		if (!this.refreshScheduler.isScheduled()) {
			this.refreshScheduler.schedule();
		}
	}

	private replaceFolderCancellations(): CancellationTokenSource[] {
		for (const source of this.folderCancellations) {
			source.cancel();
			source.dispose();
		}
		const next = this.workspaceContextService.getWorkspace().folders.map(() => new CancellationTokenSource());
		this.folderCancellations = next;
		return next;
	}

	override dispose(): void {
		for (const source of this.folderCancellations) {
			source.dispose();
		}
		this.folderCancellations = [];
		super.dispose();
	}

	private ensureList(): WorkbenchList<ISourcesFileEntry> {
		if (this.list) {
			return this.list;
		}

		this.labels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: Event.None }));
		const delegate = new SourcesFilesDelegate();
		const renderer = new SourcesFilesRenderer(this.labels);

		this.list = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'SourcesFiles',
			this.listContainer,
			delegate,
			[renderer],
			{
				identityProvider: { getId: (element: ISourcesFileEntry) => element.resource.toString() },
				accessibilityProvider: new SourcesFilesAccessibilityProvider(),
				openOnSingleClick: true,
			}
		)) as WorkbenchList<ISourcesFileEntry>;

		this._register(this.list.onDidOpen(e => {
			const element = e.element;
			if (!element) {
				return;
			}

			void this.editorService.openEditor({
				resource: element.resource,
				options: {
					preserveFocus: e.editorOptions.preserveFocus,
					pinned: e.editorOptions.pinned,
					source: EditorOpenSource.USER,
				},
			}, ACTIVE_GROUP).catch(onUnexpectedError).catch(onUnexpectedError);
		}));

		this.listViewport = this._register(new SourcesListViewport(this.listContainer, () => this.list));
		return this.list;
	}

	private async refresh(): Promise<void> {
		if (!this.isFilesSearchVisible()) {
			this.filesSearchDirty = true;
			return;
		}
		this.filesSearchDirty = false;
		const seq = ++this._refreshSeq;
		const sources = this.replaceFolderCancellations();
		if (!this.list || this.list.length === 0) {
			this.emptyMessage.textContent = localize('sourcesFilesList.loading', "Loading…");
			this.emptyMessage.classList.remove('is-error');
			this.emptyMessage.style.display = '';
			this.listContainer.style.display = 'none';
		}
		const folders = this.workspaceContextService.getWorkspace().folders.map(folder => folder.uri);
		const excludePattern = getExcludes(this.configurationService.getValue<ISearchConfiguration>());
		const maxResults = sourcesFilesMaxResults(this.configurationService.getValue<number | null>('search.maxResults'));
		let collected: ISourcesFilesCollectOutcome | undefined;
		let error: unknown | undefined;
		try {
			collected = await collectSourcesFileEntries(
				folders,
				excludePattern,
				maxResults,
				this.searchService,
				sources.map(source => source.token),
			);
		} catch (caught) {
			error = caught;
		}

		if (seq !== this._refreshSeq || sources.some(source => source.token.isCancellationRequested)) {
			return;
		}

		const resolved = resolveSourcesFilesCollectResult(this.lastGoodEntries, collected?.entries, error);
		if (!resolved.failed && collected) {
			this.lastGoodEntries = [...resolved.entries];
			this.lastOutcome = { ...collected, entries: resolved.entries };
			this.lastReadError = undefined;
		} else if (resolved.failed) {
			this.lastOutcome = undefined;
			this.lastReadError = sourcesFilesListReadFailureMessage(error);
		}

		this.paintCollected();
	}

	private paintCollected(): void {
		const readError = this.lastReadError;
		const allEntries = this.lastOutcome?.entries ?? this.lastGoodEntries;
		const entries = filterSourcesEntries(allEntries, this.filterBox.value);
		const truncated = !!this.lastOutcome?.truncated && !readError;
		const hasAnyEntries = allEntries.length > 0;
		const hasVisibleEntries = entries.length > 0;

		if (!hasAnyEntries) {
			this.emptyMessage.textContent = readError ?? sourcesFilesListEmptyMessage;
		} else if (!hasVisibleEntries) {
			this.emptyMessage.textContent = localize('sourcesFilesList.noMatching', "No matching files.");
		}

		this.setStatusMessage(readError ?? (truncated ? sourcesFilesListTruncatedMessage() : undefined), !!readError);
		this.emptyMessage.classList.toggle('is-error', !!readError && !hasAnyEntries);
		this.emptyMessage.style.display = hasVisibleEntries ? 'none' : '';
		this.listContainer.style.display = hasVisibleEntries ? 'block' : 'none';
		this.filterBox.element.style.display = hasAnyEntries ? 'block' : 'none';

		if (!hasVisibleEntries) {
			return;
		}

		const list = this.ensureList();
		list.splice(0, list.length, [...entries]);
		this.listViewport?.layout();
	}

	private setStatusMessage(message: string | undefined, isError = true): void {
		if (!message) {
			this.statusMessage.textContent = '';
			this.statusMessage.style.display = 'none';
			this.statusMessage.classList.remove('is-error');
			return;
		}
		this.statusMessage.textContent = message;
		this.statusMessage.style.display = 'block';
		if (isError) {
			this.statusMessage.classList.add('is-error');
		} else {
			this.statusMessage.classList.remove('is-error');
		}
	}
}

function sourcesFilesMaxResults(configured: number | null | undefined): number {
	if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
		return Math.floor(configured);
	}
	return DEFAULT_MAX_SEARCH_RESULTS;
}
