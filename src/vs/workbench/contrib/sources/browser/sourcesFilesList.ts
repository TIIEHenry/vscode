/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sourcesFilesList.css';
import * as dom from '../../../../base/browser/dom.js';
import { IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { ITreeNode, ITreeRenderer, ObjectTreeElementCollapseState } from '../../../../base/browser/ui/tree/tree.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
import { CancellationToken, CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { dirname, isEqualOrParent } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { EditorOpenSource, ITextEditorOptions } from '../../../../platform/editor/common/editor.js';
import { FileKind, IFileService } from '../../../../platform/files/common/files.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { WorkbenchObjectTree } from '../../../../platform/list/browser/listService.js';
import { sourcesFilesListHookPresent } from '../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ResourceLabels, IResourceLabel } from '../../../browser/labels.js';
import { EditorResourceAccessor, SideBySideEditor } from '../../../common/editor.js';
import { IAgentSessionContext } from '../../../services/agentSession/common/agentSessionContext.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { IEditorGroup, IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { openEditorInSlot } from '../../../services/editor/browser/editorOpenSlot.js';
import { EditorOpenSlot } from '../../../services/editor/common/editorOpenSlot.js';
import { runSuppressingExplorerAutoReveal } from '../../../services/editor/common/explorerAutoRevealGate.js';
import { sourcesAlternateOpenAction, sourcesEditorOpenSlot } from './sourcesEditorOpenMode.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { DEFAULT_MAX_SEARCH_RESULTS, getExcludes, ISearchConfiguration, ISearchService } from '../../../services/search/common/search.js';
import { filterSourcesEntries } from '../common/sourcesFilterModel.js';
import {
	buildSourcesEngineListFilesRequest,
	buildSourcesEngineReadFileRequest,
	ISourcesFilesEngineListSource,
	projectSourcesEngineFileEntries,
	provideSourcesEngineFileText,
	putSourcesEngineFileText,
	resolveSourcesFilesListSource,
	SOURCES_ENGINE_FILE_SCHEME,
	sourcesEngineFileResource,
	sourcesEngineFileText,
	sourcesEngineReadonlyTextInput,
} from '../common/sourcesFilesEngineRead.js';
import { collectSourcesFileEntries, ISourcesFileEntry, ISourcesFilesCollectOutcome, resolveSourcesFilesCollectResult } from '../common/sourcesFilesModel.js';
import { sourcesFilesListEmptyFolderMessage, sourcesFilesListEmptyMessage, sourcesFilesListNoOpenFileMessage, sourcesFilesListReadFailureMessage, sourcesFilesListTruncatedMessage } from './sourcesFilesListStrings.js';
import { buildSourcesEngineLevel, buildSourcesWorkspaceLevel, filterSourcesLevelNodes, sourcesDirectoryLabel, sourcesEngineParentKey, sourcesFileDescription } from './sourcesFilesLevel.js';
import { readSourcesFilesViewMode, SOURCES_FILES_VIEW_MODE_SETTING, SourcesFilesViewMode } from '../common/sourcesFilesViewMode.js';
import { buildSourcesFileTree, ISourcesFilesTreeNode } from './sourcesFilesTree.js';
import { SourcesListFilterBox } from './sourcesListFilterBox.js';
import { SourcesListViewport } from './sourcesListViewport.js';

const $ = dom.$;

class SourcesFilesDelegate implements IListVirtualDelegate<ISourcesFilesTreeNode> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return SourcesFilesRenderer.TEMPLATE_ID;
	}
}

interface ISourcesFileTemplateData {
	readonly label: IResourceLabel;
}

class SourcesFilesRenderer implements ITreeRenderer<ISourcesFilesTreeNode, void, ISourcesFileTemplateData> {
	static readonly TEMPLATE_ID = 'sourcesFile';

	readonly templateId = SourcesFilesRenderer.TEMPLATE_ID;

	constructor(private readonly labels: ResourceLabels) { }

	renderTemplate(container: HTMLElement): ISourcesFileTemplateData {
		container.classList.add('sources-file-row');
		const label = this.labels.create(container, { supportDescriptionHighlights: true });
		return { label };
	}

	renderElement(node: ITreeNode<ISourcesFilesTreeNode, void>, _index: number, templateData: ISourcesFileTemplateData): void {
		const element = node.element;
		const file = element.file;
		templateData.label.setResource({
			resource: file?.resource,
			name: element.name,
		}, {
			fileKind: file ? FileKind.FILE : FileKind.FOLDER,
			hideIcon: false,
			title: file?.description || element.name,
		});
	}

	disposeTemplate(templateData: ISourcesFileTemplateData): void {
		templateData.label.dispose();
	}
}

class SourcesFilesAccessibilityProvider implements IListAccessibilityProvider<ISourcesFilesTreeNode> {
	getWidgetAriaLabel(): string {
		return localize('sourcesFilesList.ariaLabel', "Sources Files");
	}

	getAriaLabel(element: ISourcesFilesTreeNode): string {
		return element.file?.description || element.name;
	}
}

export class SourcesFilesList extends Disposable {

	private readonly listContainer: HTMLElement;
	private readonly emptyMessage: HTMLElement;
	private readonly statusMessage: HTMLElement;
	private readonly location: HTMLElement;
	private readonly modeTree: HTMLButtonElement;
	private readonly modeList: HTMLButtonElement;
	private readonly filterBox: SourcesListFilterBox;
	private viewMode: SourcesFilesViewMode;
	private list: WorkbenchObjectTree<ISourcesFilesTreeNode, void> | undefined;
	private listViewport: SourcesListViewport | undefined;
	private labels: ResourceLabels | undefined;
	private lastGoodEntries: ISourcesFileEntry[] = [];
	private lastOutcome: ISourcesFilesCollectOutcome | undefined;
	private lastReadError: string | undefined;
	private filesSearchDirty = false;
	private filesTabActive = true;
	private readonly refreshScheduler: RunOnceScheduler;
	private folderCancellations: CancellationTokenSource[] = [];
	private engineCancellation: CancellationTokenSource | undefined;
	private _refreshSeq = 0;
	private levelSeq = 0;

	constructor(
		private readonly host: HTMLElement,
		@IEditorService private readonly editorService: IEditorService,
		@IFileService private readonly fileService: IFileService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@ISearchService private readonly searchService: ISearchService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IUniverseAgentConnection private readonly connection: IUniverseAgentConnection,
		@IAgentSessionContext private readonly session: IAgentSessionContext,
		@IModelService private readonly modelService: IModelService,
		@ITextModelService textModelService: ITextModelService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
	) {
		super();

		host.classList.add('show-file-icons');
		this.viewMode = readSourcesFilesViewMode(this.configurationService.getValue(SOURCES_FILES_VIEW_MODE_SETTING));

		const toolbar = dom.append(host, $('.sources-files-toolbar'));
		this.filterBox = this._register(new SourcesListFilterBox(
			toolbar,
			localize('sourcesFilesList.filterPlaceholder', "Filter files"),
			localize('sourcesFilesList.filterAriaLabel', "Filter files"),
		));
		this._register(this.filterBox.onDidChange(() => this.paintCollected()));
		const modes = dom.append(toolbar, $('.sources-files-modes'));
		modes.setAttribute('role', 'group');
		modes.setAttribute('aria-label', localize('sourcesFilesList.viewMode', "Files view"));
		this.modeTree = this.createModeButton(modes, 'tree', localize('sourcesFilesList.viewAsTree', "View as Tree"), Codicon.listTree);
		this.modeList = this.createModeButton(modes, 'list', localize('sourcesFilesList.viewAsList', "View as List"), Codicon.listFlat);
		this.syncModeButtons();

		this.location = dom.append(host, $('.sources-files-location'));
		this.location.style.display = 'none';
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
			if (e.affectsConfiguration(SOURCES_FILES_VIEW_MODE_SETTING)) {
				this.applyViewMode(readSourcesFilesViewMode(this.configurationService.getValue(SOURCES_FILES_VIEW_MODE_SETTING)), true);
			}
			if (e.affectsConfiguration('files.exclude')
				|| e.affectsConfiguration('search.exclude')
				|| e.affectsConfiguration('search.useIgnoreFiles')
				|| e.affectsConfiguration('search.useParentIgnoreFiles')
				|| e.affectsConfiguration('search.maxResults')) {
				this.onSearchTrigger();
			}
		}));
		this.bindPreviewTab();
		this._register(this.layoutService.onDidChangePartVisibility(() => this.onSearchVisibilityChanged()));
		this._register(this.session.onDidChangeActiveSession(() => this.onSearchTrigger()));
		this._register(this.session.onDidChangeSession(() => this.onSearchTrigger()));
		const connectionChanged = this.connection.onDidChangeConnection;
		if (typeof connectionChanged === 'function') {
			this._register(connectionChanged(() => this.onSearchTrigger()));
		}
		this._register(textModelService.registerTextModelContentProvider(SOURCES_ENGINE_FILE_SCHEME, {
			provideTextContent: resource => Promise.resolve(provideSourcesEngineFileText(resource, this.modelService)),
		}));
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
		this.engineCancellation?.dispose();
		this.engineCancellation = undefined;
		super.dispose();
	}

	private replaceEngineCancellation(): CancellationToken {
		this.engineCancellation?.cancel();
		this.engineCancellation?.dispose();
		const next = new CancellationTokenSource();
		this.engineCancellation = next;
		return next.token;
	}

	private ensureList(): WorkbenchObjectTree<ISourcesFilesTreeNode, void> {
		if (this.list) {
			return this.list;
		}

		this.labels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: Event.None }));
		const delegate = new SourcesFilesDelegate();
		const renderer = new SourcesFilesRenderer(this.labels);

		this.list = this._register(this.instantiationService.createInstance(
			WorkbenchObjectTree<ISourcesFilesTreeNode, void>,
			'SourcesFiles',
			this.listContainer,
			delegate,
			[renderer],
			{
				identityProvider: { getId: (element: ISourcesFilesTreeNode) => element.id },
				accessibilityProvider: new SourcesFilesAccessibilityProvider(),
				openOnSingleClick: true,
				hideTwistiesOfChildlessElements: true,
				findWidgetEnabled: false,
			}
		));

		this._register(this.list.onDidOpen(e => {
			const file = e.element?.file;
			if (!file) {
				return;
			}

			const slot = e.sideBySide ? undefined : sourcesEditorOpenSlot(this.configurationService);
			const preserveFocus = e.editorOptions.preserveFocus;
			if (file.engine) {
				void runSuppressingExplorerAutoReveal(() => this.openEngineFile(file, preserveFocus, slot, !!e.sideBySide)).catch(onUnexpectedError).catch(onUnexpectedError);
				return;
			}

			const open = runSuppressingExplorerAutoReveal(() => e.sideBySide
				? this.editorService.openEditor({
					resource: file.resource,
					options: { preserveFocus, pinned: true, source: EditorOpenSource.USER },
				}, SIDE_GROUP)
				: openEditorInSlot(this.editorService, this.editorGroupsService, { resource: file.resource }, slot ?? 'replace', {
					preserveFocus,
					source: EditorOpenSource.USER,
				}, ACTIVE_GROUP));
			void open.catch(onUnexpectedError).catch(onUnexpectedError);
		}));

		this._register(this.list.onContextMenu(e => {
			const file = e.element?.file;
			if (!file) {
				return;
			}
			const current = sourcesEditorOpenSlot(this.configurationService);
			this.contextMenuService.showContextMenu({
				getAnchor: () => e.anchor,
				getActions: () => [sourcesAlternateOpenAction(current, slot => {
					void this.openFileEntry(file, true, slot, false).catch(onUnexpectedError).catch(onUnexpectedError);
				})],
			});
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
		const engineToken = this.replaceEngineCancellation();
		if (!this.list || this.list.getNode(null).children.length === 0) {
			this.emptyMessage.textContent = localize('sourcesFilesList.loading', "Loading…");
			this.emptyMessage.classList.remove('is-error');
			this.emptyMessage.style.display = '';
			this.listContainer.style.display = 'none';
		}
		const folders = this.workspaceContextService.getWorkspace().folders.map(folder => folder.uri);
		const sessionId = this.session.getActiveSessionId();
		const listSource = resolveSourcesFilesListSource({
			workspaceFolders: folders,
			sessionId,
			workDir: this.session.getSessionWorkDir?.(sessionId),
			hasListFiles: sourcesFilesListHookPresent(this.connection.getConnectionSnapshot?.(), this.connection.listFiles),
		});
		const excludePattern = getExcludes(this.configurationService.getValue<ISearchConfiguration>());
		const maxResults = sourcesFilesMaxResults(this.configurationService.getValue<number | null>('search.maxResults'));
		let collected: ISourcesFilesCollectOutcome | undefined;
		let error: unknown | undefined;
		try {
			if (listSource.kind === 'engine') {
				collected = await this.collectFromEngine(listSource, maxResults);
			} else {
				collected = await collectSourcesFileEntries(
					folders,
					excludePattern,
					maxResults,
					this.searchService,
					sources.map(source => source.token),
				);
			}
		} catch (caught) {
			error = caught;
		}

		if (seq !== this._refreshSeq || engineToken.isCancellationRequested || sources.some(source => source.token.isCancellationRequested)) {
			return;
		}

		const resolved = resolveSourcesFilesCollectResult(this.lastGoodEntries, collected?.entries, error);
		const partialFailure = collected !== undefined && collected.failedFolders.length > 0;
		if (!resolved.failed && collected && !partialFailure) {
			this.lastGoodEntries = [...resolved.entries];
			this.lastOutcome = { ...collected, entries: resolved.entries };
			this.lastReadError = undefined;
		} else if (resolved.failed) {
			this.lastOutcome = undefined;
			this.lastReadError = sourcesFilesListReadFailureMessage(error);
		} else if (partialFailure && collected) {
			this.lastReadError = sourcesFilesListReadFailureMessage(collected.firstFolderFailure);
		}

		this.paintCollected();
	}

	private collectFromEngine(source: ISourcesFilesEngineListSource, maxResults: number): Promise<ISourcesFilesCollectOutcome> {
		const listFiles = this.connection.listFiles;
		if (typeof listFiles !== 'function') {
			return Promise.reject(new Error('listFiles is unavailable'));
		}
		return listFiles.call(this.connection, buildSourcesEngineListFilesRequest(source.sessionId, source.path, maxResults)).then(result => {
			return projectSourcesEngineFileEntries(source, result, maxResults);
		});
	}

	private openFileEntry(element: ISourcesFileEntry, preserveFocus: boolean | undefined, slot: EditorOpenSlot, sideBySide: boolean): Promise<unknown> {
		return runSuppressingExplorerAutoReveal(() => this.openFileEntryNow(element, preserveFocus, slot, sideBySide));
	}

	private openFileEntryNow(element: ISourcesFileEntry, preserveFocus: boolean | undefined, slot: EditorOpenSlot, sideBySide: boolean): Promise<unknown> {
		if (element.engine) {
			return this.openEngineFile(element, preserveFocus, slot, sideBySide);
		}
		if (sideBySide) {
			return this.editorService.openEditor({
				resource: element.resource,
				options: { preserveFocus, pinned: true, source: EditorOpenSource.USER },
			}, SIDE_GROUP);
		}
		return openEditorInSlot(this.editorService, this.editorGroupsService, { resource: element.resource }, slot, {
			preserveFocus,
			source: EditorOpenSource.USER,
		}, ACTIVE_GROUP);
	}

	private openEngineFile(element: ISourcesFileEntry, preserveFocus: boolean | undefined, slot: EditorOpenSlot | undefined, sideBySide: boolean): Promise<unknown> {
		const engine = element.engine;
		const readFile = this.connection.readFile;
		if (!engine || typeof readFile !== 'function') {
			return Promise.resolve(undefined);
		}
		const resource = element.resource.scheme === SOURCES_ENGINE_FILE_SCHEME
			? element.resource
			: sourcesEngineFileResource(engine.path);
		const options: ITextEditorOptions = {
			preserveFocus,
			pinned: true,
			source: EditorOpenSource.USER,
		};
		return readFile.call(this.connection, buildSourcesEngineReadFileRequest(engine.sessionId, engine.path)).then(result => {
			const text = sourcesEngineFileText(result.content);
			putSourcesEngineFileText(resource, text);
			const input = sourcesEngineReadonlyTextInput(resource, text, element.name, options);
			if (!input) {
				return undefined;
			}
			if (sideBySide || !slot) {
				return this.editorService.openEditor(input, sideBySide ? SIDE_GROUP : ACTIVE_GROUP);
			}
			return openEditorInSlot(this.editorService, this.editorGroupsService, input, slot, {
				preserveFocus,
				source: EditorOpenSource.USER,
			}, ACTIVE_GROUP);
		});
	}

	private paintCollected(): void {
		this.syncModeButtons();
		if (this.viewMode === 'list') {
			const seq = ++this.levelSeq;
			void this.paintCurrentLevel(seq).catch(onUnexpectedError).catch(onUnexpectedError);
			return;
		}
		this.levelSeq++;
		this.location.textContent = '';
		this.location.style.display = 'none';
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
		const filtering = this.filterBox.value.trim().length > 0;
		list.setChildren(null, buildSourcesFileTree(entries, filtering ? false : ObjectTreeElementCollapseState.PreserveOrExpanded), {
			diffIdentityProvider: { getId: (element: ISourcesFilesTreeNode) => element.id },
		});
		this.listViewport?.layout();
	}

	private createModeButton(parent: HTMLElement, mode: SourcesFilesViewMode, label: string, icon: typeof Codicon.listTree): HTMLButtonElement {
		const button = dom.append(parent, $('button.sources-files-mode')) as HTMLButtonElement;
		button.type = 'button';
		button.dataset.mode = mode;
		button.title = label;
		button.setAttribute('aria-label', label);
		button.appendChild(renderIcon(icon));
		this._register(dom.addStandardDisposableListener(button, 'click', event => {
			dom.EventHelper.stop(event, true);
			this.applyViewMode(mode, false);
		}));
		return button;
	}

	private syncModeButtons(): void {
		const tree = this.viewMode === 'tree';
		this.modeTree.setAttribute('aria-pressed', tree ? 'true' : 'false');
		this.modeList.setAttribute('aria-pressed', tree ? 'false' : 'true');
	}

	private applyViewMode(mode: SourcesFilesViewMode, fromConfiguration: boolean): void {
		if (this.viewMode === mode) {
			this.syncModeButtons();
			return;
		}
		this.viewMode = mode;
		this.syncModeButtons();
		this.paintCollected();
		if (!fromConfiguration) {
			void this.configurationService.updateValue(SOURCES_FILES_VIEW_MODE_SETTING, mode).catch(onUnexpectedError).catch(onUnexpectedError);
		}
	}

	private bindPreviewTab(): void {
		const part = this.editorGroupsService.mainPart;
		const paintIfList = () => {
			if (this.viewMode === 'list') {
				this.paintCollected();
			}
		};
		this._register(part.onDidChangeActiveGroup(() => paintIfList()));
		const seen = new Set<IEditorGroup>();
		const track = (group: IEditorGroup | undefined) => {
			if (!group || seen.has(group)) {
				return;
			}
			seen.add(group);
			this._register(group.onDidActiveEditorChange(() => paintIfList()));
		};
		for (const group of part.groups) {
			track(group);
		}
		this._register(part.onDidAddGroup(group => track(group)));
	}

	private async paintCurrentLevel(seq: number): Promise<void> {
		try {
			const target = this.currentLevelTarget();
			if (seq !== this.levelSeq || this.viewMode !== 'list') {
				return;
			}
			if (!target) {
				this.renderLevel([], undefined, sourcesFilesListNoOpenFileMessage, false, false);
				return;
			}
			const folders = this.workspaceContextService.getWorkspace().folders.map(folder => folder.uri);
			let nodes: ISourcesFilesTreeNode[];
			let label: string;
			if (target.kind === 'engine') {
				const entries = this.lastOutcome?.entries ?? this.lastGoodEntries;
				nodes = buildSourcesEngineLevel(entries, target.parentKey);
				label = target.parentKey || this.engineRootLabel();
			} else {
				const stat = await this.fileService.resolve(target.directory);
				if (seq !== this.levelSeq || this.viewMode !== 'list') {
					return;
				}
				nodes = buildSourcesWorkspaceLevel(stat.children ?? [], resource => sourcesFileDescription(resource, folders));
				label = sourcesDirectoryLabel(target.directory, folders);
			}
			const filtered = filterSourcesLevelNodes(nodes, this.filterBox.value);
			const emptyText = filtered.length > 0
				? ''
				: (this.filterBox.value.trim().length > 0
					? localize('sourcesFilesList.noMatching', "No matching files.")
					: sourcesFilesListEmptyFolderMessage);
			this.renderLevel(filtered, label, emptyText, false, true);
		} catch (error) {
			if (seq !== this.levelSeq || this.viewMode !== 'list') {
				return;
			}
			this.renderLevel([], undefined, sourcesFilesListReadFailureMessage(error), true, false);
		}
	}

	private currentLevelTarget(): { readonly kind: 'workspace'; readonly directory: URI } | { readonly kind: 'engine'; readonly parentKey: string } | undefined {
		const editor = this.editorGroupsService.mainPart.activeGroup?.activeEditor ?? undefined;
		const resource = EditorResourceAccessor.getCanonicalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY });
		if (!resource || resource.scheme === Schemas.untitled) {
			return undefined;
		}
		if (resource.scheme === SOURCES_ENGINE_FILE_SCHEME) {
			const entries = this.lastOutcome?.entries ?? this.lastGoodEntries;
			const found = entries.find(entry => entry.resource.toString() === resource.toString());
			if (!found) {
				return undefined;
			}
			return { kind: 'engine', parentKey: sourcesEngineParentKey(found.description) };
		}
		// Diff models and other virtual tabs are not a folder to list. A missing
		// provider must stay the open-a-file empty state, not a read failure.
		if (!this.fileService.hasProvider(resource)) {
			return undefined;
		}
		const workspaceFolders = this.workspaceContextService.getWorkspace().folders.map(folder => folder.uri);
		if (!workspaceFolders.some(folder => isEqualOrParent(resource, folder))) {
			return undefined;
		}
		return { kind: 'workspace', directory: dirname(resource) };
	}

	private engineRootLabel(): string {
		const sessionId = this.session.getActiveSessionId();
		const workDir = this.session.getSessionWorkDir?.(sessionId);
		if (workDir) {
			const name = workDir.replace(/\\/g, '/').replace(/\/+$/g, '').split('/').pop();
			if (name) {
				return name;
			}
		}
		return localize('sourcesFilesList.workspaceRoot', "Workspace");
	}

	private renderLevel(nodes: readonly ISourcesFilesTreeNode[], label: string | undefined, emptyText: string, isError: boolean, showFilter: boolean): void {
		if (label) {
			this.location.textContent = label;
			this.location.title = label;
			this.location.style.display = '';
		} else {
			this.location.textContent = '';
			this.location.removeAttribute('title');
			this.location.style.display = 'none';
		}
		this.setStatusMessage(undefined);
		this.emptyMessage.textContent = emptyText;
		this.emptyMessage.classList.toggle('is-error', isError);
		const visible = nodes.length > 0;
		this.emptyMessage.style.display = visible ? 'none' : '';
		this.listContainer.style.display = visible ? 'block' : 'none';
		this.filterBox.element.style.display = showFilter ? 'block' : 'none';
		if (!visible) {
			return;
		}
		const list = this.ensureList();
		list.setChildren(null, nodes.map(element => ({ element })), {
			diffIdentityProvider: { getId: (element: ISourcesFilesTreeNode) => element.id },
		});
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
