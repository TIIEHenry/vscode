/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/sourcesFilesExplorer.css';
import * as dom from '../../../../base/browser/dom.js';
import { PaneView } from '../../../../base/browser/ui/splitview/paneview.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService, IContextKey, ContextKeyExpr, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ServiceCollection } from '../../../../platform/instantiation/common/serviceCollection.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { asCssVariable } from '../../../../platform/theme/common/colorRegistry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IWorkbenchThemeService } from '../../../services/themes/common/workbenchThemeService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { SIDE_BAR_DRAG_AND_DROP_BACKGROUND, SIDE_BAR_SECTION_HEADER_BACKGROUND, SIDE_BAR_SECTION_HEADER_BORDER, SIDE_BAR_SECTION_HEADER_FOREGROUND } from '../../../common/theme.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { ViewPaneShowActions } from '../../../browser/parts/views/viewPane.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { runSuppressingExplorerAutoReveal } from '../../../services/editor/common/explorerAutoRevealGate.js';
import { EditorOpenSlot } from '../../../services/editor/common/editorOpenSlot.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { ExplorerFindProviderActive } from '../../files/common/files.js';
import { ExplorerItem } from '../../files/common/explorerModel.js';
import { IAsyncDataTreeViewState } from '../../../../base/browser/ui/tree/asyncDataTree.js';
import { NEW_FILE_COMMAND_ID, NEW_FOLDER_COMMAND_ID } from '../../files/browser/fileActions.js';
import { IExplorerService } from '../../files/browser/files.js';
import { CanCreateContext, ExplorerView, IExplorerViewPaneOptions } from '../../files/browser/views/explorerView.js';
import { IOpenEvent } from '../../../../platform/list/browser/listService.js';
import { isKeyboardEvent } from '../../../../base/browser/dom.js';
import { IAccessibilityService } from '../../../../platform/accessibility/common/accessibility.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ILabelService } from '../../../../platform/label/common/label.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IUriIdentityService } from '../../../../platform/uriIdentity/common/uriIdentity.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { IProgressService } from '../../../../platform/progress/common/progress.js';
import { IEditorResolverService } from '../../../services/editor/common/editorResolverService.js';
import { sourcesEditorOpenSlot } from './sourcesEditorOpenMode.js';
import { SourcesListViewport } from './sourcesListViewport.js';
import { SOURCES_FILES_LIST_MODE_STORAGE_KEY, sourcesListDirectoryTarget } from '../common/sourcesFilesListMode.js';

const SourcesFilesListModeContext = new RawContextKey<boolean>('sourcesFilesListMode', false);

const $ = dom.$;

export const SOURCES_FILES_EXPLORER_ID = 'sources.files.explorer';

const SOURCES_FILES_TREE_STATE_KEY = 'sources.files.explorer.treeViewState';

/**
 * Workspace explorer hosted in the Sources Files tab. It is not a view-container
 * entry, so it does not add an activity-bar icon or replace the sidebar explorer.
 */
export class SourcesFilesExplorer extends ExplorerView {

	private listMode = false;
	private listDirectory: URI | undefined;
	private listRootItem: ExplorerItem | undefined;
	private savedTreeViewState: IAsyncDataTreeViewState | undefined;
	private readonly listModeContext: IContextKey<boolean> = SourcesFilesListModeContext.bindTo(this.scopedContextKeyService);

	constructor(
		options: IExplorerViewPaneOptions,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IProgressService progressService: IProgressService,
		@IEditorService editorService: IEditorService,
		@IEditorResolverService editorResolverService: IEditorResolverService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IConfigurationService configurationService: IConfigurationService,
		@ILabelService labelService: ILabelService,
		@IThemeService themeService: IWorkbenchThemeService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IHoverService hoverService: IHoverService,
		@IExplorerService explorerService: IExplorerService,
		@IStorageService storageService: IStorageService,
		@IClipboardService clipboardService: IClipboardService,
		@IFileService fileService: IFileService,
		@IUriIdentityService uriIdentityService: IUriIdentityService,
		@ICommandService commandService: ICommandService,
		@IOpenerService openerService: IOpenerService,
		@IAccessibilityService accessibilityService: IAccessibilityService,
		@IEnvironmentService environmentService: IEnvironmentService,
		@IEditorGroupsService editorGroupsService: IEditorGroupsService,
	) {
		super(options, contextMenuService, viewDescriptorService, instantiationService, contextService, progressService, editorService, editorResolverService, layoutService, keybindingService, contextKeyService, configurationService, labelService, themeService, telemetryService, hoverService, explorerService, storageService, clipboardService, fileService, uriIdentityService, commandService, openerService, accessibilityService, environmentService, editorGroupsService);
	}

	override get suppressesSiblingAutoReveal(): boolean {
		return true;
	}

	override editorOpenSlot(): EditorOpenSlot {
		return sourcesEditorOpenSlot(this.configurationService);
	}

	protected override get treeUser(): string {
		return 'SourcesFilesExplorer';
	}

	protected override get treeViewStateStorageKey(): string {
		return SOURCES_FILES_TREE_STATE_KEY;
	}

	protected override openExplorerElement(e: IOpenEvent<ExplorerItem | undefined>): Promise<void> {
		const element = e.element;
		const shiftDown = isKeyboardEvent(e.browserEvent) && e.browserEvent.shiftKey;
		if (this.listMode && element?.isDirectory && !shiftDown && !e.sideBySide) {
			return this.showListDirectory(element.resource);
		}
		return runSuppressingExplorerAutoReveal(() => super.openExplorerElement(e));
	}

	protected override renderBody(container: HTMLElement): void {
		this.listMode = this.storageService.get(SOURCES_FILES_LIST_MODE_STORAGE_KEY, StorageScope.WORKSPACE) === 'list';
		this.listModeContext.set(this.listMode);
		super.renderBody(container);
		this.element.classList.toggle('is-list', this.listMode);
		this._register(this.contextService.onDidChangeWorkspaceFolders(() => {
			this.listDirectory = undefined;
			this.listRootItem = undefined;
			this.updateLocationBreadcrumb();
			if (this.listMode) {
				void this.setTreeInput().then(() => this.updateLocationBreadcrumb()).catch(onUnexpectedError).catch(onUnexpectedError);
			}
		}));
	}

	setListMode(list: boolean): void {
		if (this.listMode === list) {
			this.listModeContext.set(list);
			return;
		}
		if (list) {
			const state = this.captureTreeViewState();
			this.savedTreeViewState = state;
			this.persistTreeViewState(state);
			this.listDirectory = undefined;
			this.listRootItem = undefined;
		} else {
			this.restoreTreeViewState(this.savedTreeViewState ?? this.readStoredTreeViewState());
			this.savedTreeViewState = undefined;
			this.listRootItem = undefined;
		}
		this.listMode = list;
		this.listModeContext.set(list);
		this.element?.classList.toggle('is-list', list);
		this.storageService.store(SOURCES_FILES_LIST_MODE_STORAGE_KEY, list ? 'list' : 'tree', StorageScope.WORKSPACE, StorageTarget.USER);
		this.updateLocationBreadcrumb();
		void this.setTreeInput().then(() => this.updateLocationBreadcrumb()).catch(onUnexpectedError).catch(onUnexpectedError);
	}

	override collapseAll(): void {
		if (!this.listMode) {
			super.collapseAll();
			return;
		}
		const root = this.listRootItem?.root.resource;
		if (root && this.listDirectory && !this.uriIdentityService.extUri.isEqual(this.listDirectory, root)) {
			void this.showListDirectory(root).catch(onUnexpectedError).catch(onUnexpectedError);
		}
	}

	createParent(): ExplorerItem | undefined {
		return this.listMode ? this.listRootItem : undefined;
	}

	protected override isFlatFileList(): boolean {
		return this.listMode;
	}

	protected override breadcrumbFolderUri(): URI | undefined {
		return this.listMode && this.listDirectory ? this.listDirectory : super.breadcrumbFolderUri();
	}

	protected override onLocationBreadcrumbPick(resource: URI): Promise<void> {
		if (this.listMode) {
			return this.showListDirectory(resource);
		}
		return super.onLocationBreadcrumbPick(resource);
	}

	protected override shouldPersistTreeViewState(): boolean {
		return !this.listMode;
	}

	protected override async resolveFlatListRoot(): Promise<ExplorerItem | undefined> {
		if (!this.listMode) {
			return undefined;
		}
		const folders = this.contextService.getWorkspace().folders.map(folder => folder.uri);
		const target = sourcesListDirectoryTarget(this.listDirectory, folders, (resource, parent) => this.uriIdentityService.extUri.isEqualOrParent(resource, parent));
		if (!target) {
			this.listRootItem = undefined;
			return undefined;
		}
		const item = await this.findExplorerDirectory(target) ?? this.explorerService.findClosestRoot(target) ?? undefined;
		if (!item) {
			this.listDirectory = target;
			this.listRootItem = undefined;
			return undefined;
		}
		this.listDirectory = item.resource;
		this.listRootItem = item;
		return item;
	}

	private showListDirectory(resource: URI): Promise<void> {
		const folders = this.contextService.getWorkspace().folders.map(folder => folder.uri);
		this.listDirectory = sourcesListDirectoryTarget(resource, folders, (candidate, parent) => this.uriIdentityService.extUri.isEqualOrParent(candidate, parent)) ?? resource;
		this.updateLocationBreadcrumb();
		return this.setTreeInput().then(() => {
			this.updateLocationBreadcrumb();
		});
	}

	private async findExplorerDirectory(resource: URI): Promise<ExplorerItem | undefined> {
		const root = this.explorerService.findClosestRoot(resource);
		if (!root) {
			return undefined;
		}
		if (this.uriIdentityService.extUri.isEqual(root.resource, resource)) {
			return root;
		}
		let item = root;
		const sortOrder = this.explorerService.sortOrderConfiguration.sortOrder;
		while (!this.uriIdentityService.extUri.isEqual(item.resource, resource)) {
			const children = await Promise.resolve(item.fetchChildren(sortOrder));
			const next = children.find(child => this.uriIdentityService.extUri.isEqualOrParent(resource, child.resource));
			if (!next || this.uriIdentityService.extUri.isEqual(next.resource, item.resource)) {
				return undefined;
			}
			item = next;
		}
		return item.isDirectory ? item : undefined;
	}
}

export class SourcesFilesExplorerHost extends Disposable {

	private readonly root: HTMLElement;
	private readonly empty: HTMLElement;
	private readonly scopedInstantiation: IInstantiationService;
	private explorer: SourcesFilesExplorer | undefined;
	private paneView: PaneView | undefined;
	private filesTabActive = false;
	private filterDock: HTMLElement | undefined;

	constructor(
		container: HTMLElement,
		@IInstantiationService instantiationService: IInstantiationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
	) {
		super();
		this.root = dom.append(container, $('.sources-files-explorer'));
		this.empty = dom.append(this.root, $('.sources-files-explorer-empty'));
		this.empty.textContent = localize('sourcesFilesExplorer.noFolder', "You have not yet opened a folder.");

		const scopedContextKeyService = this._register(contextKeyService.createScoped(this.root));
		this.scopedInstantiation = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, scopedContextKeyService])));
		this._register(new SourcesListViewport(container, () => this));
		this._register(this.contextService.onDidChangeWorkspaceFolders(() => this.syncExplorer()));
		this._register(this.contextService.onDidChangeWorkbenchState(() => this.syncExplorer()));
		this.syncExplorer();
	}

	setFilterDock(dock: HTMLElement | undefined): void {
		this.filterDock = dock;
		this.explorer?.dockInlineFilter(dock);
	}

	setFilesTabActive(active: boolean): void {
		this.filesTabActive = active;
		this.explorer?.setVisible(active);
		if (active) {
			this.layoutFromViewport();
		}
	}

	layout(height: number, width: number): void {
		this.paneView?.layout(height, width);
	}

	private layoutFromViewport(): void {
		const viewport = this.root.parentElement ?? this.root;
		const width = viewport.clientWidth;
		const height = viewport.clientHeight;
		if (width > 0 && height > 0) {
			this.layout(height, width);
		}
	}

	private syncExplorer(): void {
		if (this.contextService.getWorkspace().folders.length === 0) {
			this.disposeExplorer();
			this.empty.style.display = '';
			return;
		}

		this.empty.style.display = 'none';
		if (!this.explorer) {
			this.createExplorer();
		}
		if (this.filesTabActive) {
			this.explorer?.setVisible(true);
			this.layoutFromViewport();
		}
	}

	private createExplorer(): void {
		const paneView = new PaneView(this.root);
		const explorer = this.scopedInstantiation.createInstance(SourcesFilesExplorer, {
			id: SOURCES_FILES_EXPLORER_ID,
			title: localize('sourcesFilesExplorer', "Files"),
			showActions: ViewPaneShowActions.Always,
			delegate: {
				willOpenElement() { },
				didOpenElement() { },
			},
		});
		// PaneView lays the pane out as soon as it is added. ViewPaneContainer
		// renders first so the body exists; skipping render leaves body unset
		// and layout throws on classList.
		explorer.style({
			headerForeground: asCssVariable(SIDE_BAR_SECTION_HEADER_FOREGROUND),
			headerBackground: asCssVariable(SIDE_BAR_SECTION_HEADER_BACKGROUND),
			headerBorder: asCssVariable(SIDE_BAR_SECTION_HEADER_BORDER),
			leftBorder: undefined,
			dropBackground: asCssVariable(SIDE_BAR_DRAG_AND_DROP_BACKGROUND),
		});
		try {
			explorer.render();
		} catch (error) {
			explorer.dispose();
			paneView.element.remove();
			paneView.dispose();
			onUnexpectedError(error);
			return;
		}
		paneView.addPane(explorer, 200);
		explorer.collapsible = false;
		this.paneView = paneView;
		this.explorer = explorer;
		explorer.dockInlineFilter(this.filterDock);
	}

	private disposeExplorer(): void {
		const element = this.paneView?.element;
		this.explorer?.dispose();
		this.explorer = undefined;
		this.paneView?.dispose();
		this.paneView = undefined;
		element?.remove();
	}

	override dispose(): void {
		this.disposeExplorer();
		super.dispose();
	}
}

async function runPinnedSourcesFilesCommand(accessor: ServicesAccessor, commandId: string): Promise<void> {
	const explorerService = accessor.get(IExplorerService);
	const commandService = accessor.get(ICommandService);
	explorerService.pinView(SOURCES_FILES_EXPLORER_ID);
	try {
		await commandService.executeCommand(commandId);
	} finally {
		explorerService.pinView(undefined);
	}
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'sources.files.action.createFile',
			title: localize2('sourcesFilesCreateFile', "New File..."),
			icon: Codicon.newFile,
			precondition: CanCreateContext,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				when: ContextKeyExpr.equals('view', SOURCES_FILES_EXPLORER_ID),
				order: 10,
			},
		});
	}

	run(accessor: ServicesAccessor): Promise<void> {
		return runPinnedSourcesFilesCommand(accessor, NEW_FILE_COMMAND_ID);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'sources.files.action.createFolder',
			title: localize2('sourcesFilesCreateFolder', "New Folder..."),
			icon: Codicon.newFolder,
			precondition: CanCreateContext,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				when: ContextKeyExpr.equals('view', SOURCES_FILES_EXPLORER_ID),
				order: 20,
			},
		});
	}

	run(accessor: ServicesAccessor): Promise<void> {
		return runPinnedSourcesFilesCommand(accessor, NEW_FOLDER_COMMAND_ID);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'sources.files.action.refresh',
			title: localize2('sourcesFilesRefresh', "Refresh Explorer"),
			icon: Codicon.refresh,
			precondition: ExplorerFindProviderActive.negate(),
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				when: ContextKeyExpr.equals('view', SOURCES_FILES_EXPLORER_ID),
				order: 30,
			},
		});
	}

	run(accessor: ServicesAccessor): Promise<void> {
		return accessor.get(IExplorerService).refresh();
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'sources.files.action.collapse',
			title: localize2('sourcesFilesCollapse', "Collapse Folders in Explorer"),
			icon: Codicon.collapseAll,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				when: ContextKeyExpr.equals('view', SOURCES_FILES_EXPLORER_ID),
				order: 40,
			},
		});
	}

	run(accessor: ServicesAccessor): void {
		const view = accessor.get(IExplorerService).getView(SOURCES_FILES_EXPLORER_ID);
		if (view instanceof ExplorerView) {
			view.collapseAll();
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'sources.files.action.viewAsTree',
			title: localize2('sourcesFilesViewAsTree', "View as Tree"),
			icon: Codicon.listTree,
			toggled: SourcesFilesListModeContext.negate(),
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				when: ContextKeyExpr.equals('view', SOURCES_FILES_EXPLORER_ID),
				order: 50,
			},
		});
	}

	run(accessor: ServicesAccessor): void {
		const view = accessor.get(IExplorerService).getView(SOURCES_FILES_EXPLORER_ID);
		if (view instanceof SourcesFilesExplorer) {
			view.setListMode(false);
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'sources.files.action.viewAsList',
			title: localize2('sourcesFilesViewAsList', "View as List"),
			icon: Codicon.listFlat,
			toggled: SourcesFilesListModeContext,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				when: ContextKeyExpr.equals('view', SOURCES_FILES_EXPLORER_ID),
				order: 60,
			},
		});
	}

	run(accessor: ServicesAccessor): void {
		const view = accessor.get(IExplorerService).getView(SOURCES_FILES_EXPLORER_ID);
		if (view instanceof SourcesFilesExplorer) {
			view.setListMode(true);
		}
	}
});
