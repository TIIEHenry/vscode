/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/navigatorProjectsList.css';
import * as dom from '../../../../base/browser/dom.js';
import { RenderIndentGuides } from '../../../../base/browser/ui/tree/abstractTree.js';
import { ITreeNode, ITreeRenderer } from '../../../../base/browser/ui/tree/tree.js';
import { IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { splitRecentLabel } from '../../../../base/common/labels.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { Verbosity, ILabelService } from '../../../../platform/label/common/label.js';
import { WorkbenchObjectTree } from '../../../../platform/list/browser/listService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { isRecentFolder, IWorkspacesService } from '../../../../platform/workspaces/common/workspaces.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ResourceLabels, IResourceLabel } from '../../../browser/labels.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { IConversationRosterService } from '../../conversation/browser/conversationStubService.js';
import { matchesNavigatorProjectsInlineFilter } from '../common/navigatorProjectsInlineFilter.js';
import { buildNavigatorProjectsTree, countLocalFolders, INavigatorLocalFolderEntry, INavigatorProjectsTreeNode } from '../common/navigatorProjectsTree.js';
import { getNavigatorCapability } from '../common/navigatorEngineBridge.js';
import { NavigatorProjectsInlineFilterBox } from './navigatorProjectsInlineFilterBox.js';
import { NAVIGATOR_PROJECTS_VIEW_ID } from './navigatorStubView.js';

const $ = dom.$;

export type { INavigatorLocalFolderEntry };

class ProjectsTreeDelegate implements IListVirtualDelegate<INavigatorProjectsTreeNode> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(element: INavigatorProjectsTreeNode): string {
		return element.kind === 'local-folder' ? 'navigatorProjectFolder' : 'navigatorProjectNode';
	}
}

interface IProjectFolderTemplateData {
	readonly label: IResourceLabel;
}

interface IProjectNodeTemplateData {
	readonly label: HTMLElement;
}

class ProjectFolderRenderer implements ITreeRenderer<INavigatorProjectsTreeNode, void, IProjectFolderTemplateData> {
	static readonly TEMPLATE_ID = 'navigatorProjectFolder';
	readonly templateId = ProjectFolderRenderer.TEMPLATE_ID;

	constructor(private readonly labels: ResourceLabels) { }

	renderTemplate(container: HTMLElement): IProjectFolderTemplateData {
		const label = this.labels.create(container, { supportDescriptionHighlights: true });
		return { label };
	}

	renderElement(node: ITreeNode<INavigatorProjectsTreeNode, void>, _index: number, templateData: IProjectFolderTemplateData): void {
		const entry = node.element;
		templateData.label.setResource({
			resource: entry.resource!,
			name: entry.label,
			description: entry.description,
		}, { hideIcon: false });
	}

	disposeTemplate(templateData: IProjectFolderTemplateData): void {
		templateData.label.dispose();
	}
}

class ProjectNodeRenderer implements ITreeRenderer<INavigatorProjectsTreeNode, void, IProjectNodeTemplateData> {
	static readonly TEMPLATE_ID = 'navigatorProjectNode';
	readonly templateId = ProjectNodeRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IProjectNodeTemplateData {
		return { label: dom.append(container, $('.navigator-projects-node-label')) };
	}

	renderElement(node: ITreeNode<INavigatorProjectsTreeNode, void>, _index: number, templateData: IProjectNodeTemplateData): void {
		templateData.label.textContent = node.element.description
			? `${node.element.label} — ${node.element.description}`
			: node.element.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

export class NavigatorProjectsView extends ViewPane {

	static readonly ID = NAVIGATOR_PROJECTS_VIEW_ID;

	private tree: WorkbenchObjectTree<INavigatorProjectsTreeNode, void> | undefined;
	private treeContainer: HTMLElement | undefined;
	private filterBox: NavigatorProjectsInlineFilterBox | undefined;
	private filterQuery = '';
	private treeNodes: INavigatorProjectsTreeNode[] = [];
	private localFolderEntries: INavigatorLocalFolderEntry[] = [];
	private wasEverConnected = false;

	constructor(
		options: IViewPaneOptions,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IWorkspacesService private readonly workspacesService: IWorkspacesService,
		@ILabelService private readonly labelService: ILabelService,
		@IHostService private readonly hostService: IHostService,
		@IConversationRosterService private readonly rosterService: IConversationRosterService,
		@IUniverseAgentConnection private readonly uaConnection: IUniverseAgentConnection,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IConversationPartService private readonly conversationPartService: IConversationPartService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this._register(this.contextService.onDidChangeWorkbenchState(() => this.refresh()));
		this._register(this.contextService.onDidChangeWorkspaceFolders(() => this.refresh()));
		this._register(this.workspacesService.onDidChangeRecentlyOpened(() => this.refresh()));
		this._register(this.labelService.onDidChangeFormatters(() => this.refresh()));
		this._register(this.rosterService.onDidChangeSession(() => this.refresh()));
		this._register(this.rosterService.onDidChangeActiveSession(() => this.refresh()));
		this._register(this.rosterService.onDidChangeEngineConnection(connected => {
			if (connected) {
				this.wasEverConnected = true;
			}
			this.refresh();
		}));
		this._register(this.uaConnection.onDidChangeConnection(() => this.refresh()));
	}

	override shouldShowWelcome(): boolean {
		return countLocalFolders(this.treeNodes) === 0 && !this.rosterService.isEngineConnected() && !this.wasEverConnected;
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		container.classList.add('show-file-icons', 'navigator-projects-body');

		const filterPlaceholder = localize('navigatorProjectsFilterPlaceholder', "Filter projects");
		this.filterBox = this._register(new NavigatorProjectsInlineFilterBox(
			container,
			filterPlaceholder,
			filterPlaceholder,
		));
		this.filterBox.setVisible(false);
		this._register(this.filterBox.onDidChange(query => {
			this.filterQuery = query;
			this.applyFilterToTree();
		}));

		this.treeContainer = dom.append(container, $('.navigator-projects-list'));
		this.ensureTree();
		this.refresh();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		const filterHeight = this.treeNodes.length > 0 ? NavigatorProjectsInlineFilterBox.HEIGHT : 0;
		this.tree?.layout(height - filterHeight, width);
	}

	private ensureTree(): WorkbenchObjectTree<INavigatorProjectsTreeNode, void> {
		if (this.tree) {
			return this.tree;
		}

		const labels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility }));
		const delegate = new ProjectsTreeDelegate();

		this.tree = this._register(this.instantiationService.createInstance(
			WorkbenchObjectTree<INavigatorProjectsTreeNode, void>,
			'NavigatorProjects',
			this.treeContainer!,
			delegate,
			[
				new ProjectFolderRenderer(labels),
				new ProjectNodeRenderer(),
			],
			{
				identityProvider: { getId: (node: INavigatorProjectsTreeNode) => node.id },
				horizontalScrolling: false,
				hideTwistiesOfChildlessElements: true,
				renderIndentGuides: RenderIndentGuides.None,
				accessibilityProvider: {
					getAriaLabel: (node: INavigatorProjectsTreeNode) => node.description ? `${node.label}, ${node.description}` : node.label,
					getWidgetAriaLabel: () => localize('navigatorProjectsView.ariaLabel', "Projects"),
				},
			},
		));

		this._register(this.tree.onDidOpen(e => this.openTreeNode(e.element, e.browserEvent)));

		return this.tree;
	}

	private openTreeNode(node: INavigatorProjectsTreeNode | undefined, browserEvent?: UIEvent): void {
		if (!node) {
			return;
		}
		if (node.kind === 'session' && node.sessionId) {
			this.rosterService.switchSession(node.sessionId);
			if (!this.layoutService.isVisible(Parts.CONVERSATION_PART)) {
				this.layoutService.setPartHidden(false, Parts.CONVERSATION_PART);
			}
			this.conversationPartService.focus();
			return;
		}
		if (node.kind === 'local-folder' && node.openable) {
			const mouseEvent = browserEvent instanceof MouseEvent ? browserEvent : undefined;
			void this.hostService.openWindow([node.openable], {
				forceNewWindow: !!(mouseEvent && (mouseEvent.ctrlKey || mouseEvent.metaKey)),
				forceReuseWindow: !!(mouseEvent && mouseEvent.altKey),
				remoteAuthority: node.remoteAuthority ?? null,
			});
		}
	}

	private refresh(): void {
		void this.rebuildTree();
	}

	private async rebuildTree(): Promise<void> {
		this.localFolderEntries = [
			...this.getCurrentFolderEntries(),
			...(await this.getRecentFolderEntries()),
		];

		const engineConnected = this.rosterService.isEngineConnected();
		if (engineConnected) {
			this.wasEverConnected = true;
		}

		const snapshot = this.uaConnection.getConnectionSnapshot();
		this.treeNodes = buildNavigatorProjectsTree({
			engineConnected,
			wasEverConnected: this.wasEverConnected,
			transportFailed: snapshot.transport === 'failed',
			sessionListCapability: getNavigatorCapability(this.uaConnection, 'sessionList'),
			workDir: snapshot.workDir,
			sessions: this.rosterService.getSessions(),
			localFolders: this.localFolderEntries,
		});

		this.filterBox?.setVisible(this.treeNodes.length > 0);
		this.applyFilterToTree();
		this._onDidChangeViewWelcomeState.fire();
	}

	private applyFilterToTree(): void {
		const tree = this.tree;
		if (!tree) {
			return;
		}
		const filtered = this.filterTreeNodes(this.treeNodes);
		tree.setChildren(null, filtered.map(element => ({
			element,
			collapsible: (element.children?.length ?? 0) > 0,
			children: this.mapFilteredChildren(element, filtered),
		})));
	}

	private mapFilteredChildren(
		parent: INavigatorProjectsTreeNode,
		filteredRoots: INavigatorProjectsTreeNode[],
	): { element: INavigatorProjectsTreeNode; collapsible: boolean; children: ReturnType<NavigatorProjectsView['mapFilteredChildren']> }[] {
		const parentInFiltered = this.findNodeById(filteredRoots, parent.id) ?? parent;
		return (parentInFiltered.children ?? []).map(child => ({
			element: child,
			collapsible: (child.children?.length ?? 0) > 0,
			children: this.mapFilteredChildren(child, filteredRoots),
		}));
	}

	private findNodeById(nodes: readonly INavigatorProjectsTreeNode[], id: string): INavigatorProjectsTreeNode | undefined {
		for (const node of nodes) {
			if (node.id === id) {
				return node;
			}
			const nested = node.children ? this.findNodeById(node.children, id) : undefined;
			if (nested) {
				return nested;
			}
		}
		return undefined;
	}

	private filterTreeNodes(nodes: readonly INavigatorProjectsTreeNode[]): INavigatorProjectsTreeNode[] {
		const result: INavigatorProjectsTreeNode[] = [];
		for (const node of nodes) {
			const filteredChildren = node.children ? this.filterTreeNodes(node.children) : undefined;
			const workDirTail = node.description?.split(/[/\\]/).pop();
			const matchesSelf = matchesNavigatorProjectsInlineFilter(node.label, workDirTail ?? node.description, this.filterQuery);
			if (matchesSelf || (filteredChildren && filteredChildren.length > 0)) {
				result.push({
					...node,
					children: filteredChildren && filteredChildren.length > 0 ? filteredChildren : (matchesSelf ? node.children : filteredChildren),
				});
			}
		}
		return result;
	}

	private getCurrentFolderEntries(): INavigatorLocalFolderEntry[] {
		return this.contextService.getWorkspace().folders.map(folder => {
			const fullLabel = this.labelService.getWorkspaceLabel(folder.uri, { verbose: Verbosity.LONG });
			const { name, parentPath } = splitRecentLabel(fullLabel);
			return {
				id: `current:${folder.uri.toString()}`,
				resource: folder.uri,
				name: folder.name || name,
				description: parentPath || undefined,
				openable: { folderUri: folder.uri },
				remoteAuthority: folder.uri.scheme === 'vscode-remote' ? folder.uri.authority : undefined,
			};
		});
	}

	private async getRecentFolderEntries(): Promise<INavigatorLocalFolderEntry[]> {
		const recentlyOpened = await this.workspacesService.getRecentlyOpened();
		const currentUris = new Set(this.contextService.getWorkspace().folders.map(folder => folder.uri.toString()));
		const entries: INavigatorLocalFolderEntry[] = [];

		for (const recent of recentlyOpened.workspaces) {
			if (!isRecentFolder(recent)) {
				continue;
			}

			const uriString = recent.folderUri.toString();
			if (currentUris.has(uriString)) {
				continue;
			}

			const fullLabel = recent.label || this.labelService.getWorkspaceLabel(recent.folderUri, { verbose: Verbosity.LONG });
			const { name, parentPath } = splitRecentLabel(fullLabel);
			entries.push({
				id: `recent:${uriString}`,
				resource: recent.folderUri,
				name,
				description: parentPath || undefined,
				openable: { folderUri: recent.folderUri },
				remoteAuthority: recent.remoteAuthority,
			});
		}

		return entries;
	}

	/** @internal test helper — flat local folder entries (HEAD-compatible). */
	getLocalFolderEntries(): INavigatorLocalFolderEntry[] {
		return this.localFolderEntries;
	}
}
