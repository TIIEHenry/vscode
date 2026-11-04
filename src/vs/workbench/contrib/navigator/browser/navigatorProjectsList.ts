/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/navigatorProjectsList.css';
import '../../../browser/media/uaRoundedIcons.css';
import '../../../browser/media/uaRoundedMenus.css';
import * as dom from '../../../../base/browser/dom.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { RenderIndentGuides } from '../../../../base/browser/ui/tree/abstractTree.js';
import { ITreeNode, ITreeRenderer } from '../../../../base/browser/ui/tree/tree.js';
import { IListContextMenuEvent, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { Action } from '../../../../base/common/actions.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { getErrorMessage, onUnexpectedError } from '../../../../base/common/errors.js';
import { splitRecentLabel } from '../../../../base/common/labels.js';
import { localize } from '../../../../nls.js';
import { isEqual } from '../../../../base/common/resources.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { Verbosity, ILabelService } from '../../../../platform/label/common/label.js';
import { WorkbenchObjectTree } from '../../../../platform/list/browser/listService.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { isRecentFolder, IWorkspacesService } from '../../../../platform/workspaces/common/workspaces.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ResourceLabels, IResourceLabel } from '../../../browser/labels.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IWorkspaceEditingService } from '../../../services/workspaces/common/workspaceEditing.js';
import { REVEAL_IN_EXPLORER_COMMAND_ID } from '../../files/browser/fileConstants.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { captureConversationDeleteOwner, confirmDeleteConversationSession, guardConversationDeleteConfirmation } from '../../conversation/browser/conversationDeleteSessionConfirm.js';
import { conversationSessionHoldReason, getConversationSessionReadiness, isConversationSessionNotReady } from '../../conversation/browser/conversationSessionAvailability.js';
import { conversationLensDockEngineNotConnected } from '../../conversation/browser/conversationLensDockStrings.js';
import { formatSessionRosterSubtitle, resolveSessionRosterTone, sessionRosterGlyph, type SessionRosterTone } from '../../conversation/browser/conversationSessionsViewStrings.js';
import { IConversationRosterService } from '../../conversation/browser/conversationStubService.js';
import { isConversationPairingHold } from '../../conversation/browser/conversationSessionStatus.js';
import { NAVIGATOR_STALE_SNAPSHOT_COPY } from '../common/navigatorAgentTreeEmptyState.js';
import { getNavigatorCapability } from '../common/navigatorEngineBridge.js';
import { filterNavigatorProjectsTreeNodes } from '../common/navigatorProjectsInlineFilter.js';
import { buildNavigatorProjectsTree, countLocalFolders, INavigatorLocalFolderEntry, INavigatorProjectsTreeNode, isNavigatorWorkDirCreateTarget, navigatorNewSessionInLabel, workDirGroupLabel } from './navigatorProjectsTree.js';
import { NavigatorProjectsInlineFilterBox } from './navigatorProjectsInlineFilterBox.js';
import { NAVIGATOR_PROJECTS_VIEW_ID } from './navigatorStubView.js';

const $ = dom.$;

export type { INavigatorLocalFolderEntry };

const RECENTS_FAILED_NOTE_ID = 'local:recents-failed';
const STALE_SNAPSHOT_NOTE_ID = 'engine:stale-snapshot';
const TRANSPORT_FAILED_NOTE_ID = 'engine:transport-failed';
const PROJECTS_FILTER_NO_MATCH = localize('navigatorProjects.noMatch', "No matches");
const PROJECTS_CONNECTING_COPY = localize('navigatorProjects.connecting', "Connecting to engine…");

export function navigatorProjectsRecentsFailureMessage(error: unknown): string {
	return localize('navigatorProjects.recentsFailed', "Unable to load recent folders: {0}", getErrorMessage(error));
}

/** Comfortable conversation navigation; group spacing is included in virtual geometry. */
export const NAVIGATOR_PROJECTS_ROW_HEIGHT = 30;

class ProjectsTreeDelegate implements IListVirtualDelegate<INavigatorProjectsTreeNode> {
	getHeight(element: INavigatorProjectsTreeNode): number {
		return NAVIGATOR_PROJECTS_ROW_HEIGHT + (element.kind === 'workdir' || element.kind === 'local-group' ? 12 : 0);
	}

	getTemplateId(element: INavigatorProjectsTreeNode): string {
		return element.kind === 'local-folder' ? 'navigatorProjectFolder' : 'navigatorProjectNode';
	}
}

interface IProjectFolderTemplateData {
	readonly label: IResourceLabel;
}

interface IProjectsMenuOwner {
	readonly engineIdentityId: string | undefined;
	readonly linkId: number | undefined;
	readonly revision: number;
}

export interface IProjectNodeTemplateData {
	readonly row: HTMLElement;
	readonly label: HTMLElement;
	readonly icon: HTMLElement;
	readonly name: HTMLElement;
	readonly description: HTMLElement;
	readonly detail: HTMLElement;
	readonly status: HTMLElement;
	readonly pendingCount: HTMLElement;
	readonly actions: HTMLElement;
	readonly actionBar: ActionBar;
	moreAction: Action;
	newSessionAction: Action;
	element: INavigatorProjectsTreeNode | undefined;
	readonly disposables: DisposableStore;
}

function navigatorProjectsNodeIcon(kind: INavigatorProjectsTreeNode['kind']): ThemeIcon | undefined {
	switch (kind) {
		case 'local-group': return Codicon.rootFolder;
		case 'workdir': return Codicon.folder;
		case 'session': return Codicon.commentDiscussion;
		default: return undefined;
	}
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
		const title = entry.description
			? `${entry.label} — ${entry.description}`
			: entry.label;
		templateData.label.setResource({
			resource: entry.resource!,
			name: entry.label,
			description: entry.description,
		}, { hideIcon: false, title });
	}

	disposeTemplate(templateData: IProjectFolderTemplateData): void {
		templateData.label.dispose();
	}
}

export class ProjectNodeRenderer implements ITreeRenderer<INavigatorProjectsTreeNode, void, IProjectNodeTemplateData> {
	static readonly TEMPLATE_ID = 'navigatorProjectNode';
	readonly templateId = ProjectNodeRenderer.TEMPLATE_ID;

	private readonly templates = new Set<IProjectNodeTemplateData>();

	constructor(
		private readonly contextMenuService: IContextMenuService,
		private readonly restoreFocus: () => void,
		private readonly getMenuOwner: () => IProjectsMenuOwner,
		private readonly getSessionStatus: (sessionId: string) => { tone: SessionRosterTone; pending: number },
		private readonly areRowActionsLive: () => boolean,
		private readonly onOpenSession: (sessionId: string) => void,
		private readonly onDeleteSession: (sessionId: string) => void,
		private readonly isWorkDirCreateTarget: (node: INavigatorProjectsTreeNode) => boolean,
		private readonly canCreateInWorkDir: (node: INavigatorProjectsTreeNode) => boolean,
		private readonly getRowActionUnavailableReason: () => string,
		private readonly onCreateSession: () => void,
	) { }

	syncRowActionChrome(): void {
		for (const template of this.templates) {
			this.syncTemplateActions(template);
		}
	}

	renderTemplate(container: HTMLElement): IProjectNodeTemplateData {
		const disposables = new DisposableStore();
		const row = dom.append(container, $('.navigator-projects-node-row'));
		const label = dom.append(row, $('.navigator-projects-node-label'));
		const icon = dom.append(label, $('span.navigator-projects-node-icon'));
		const name = dom.append(label, $('span.navigator-projects-node-name'));
		const description = dom.append(label, $('span.navigator-projects-node-description'));
		const detail = dom.append(label, $('span.navigator-projects-node-detail'));
		const status = dom.append(row, $('span.navigator-projects-session-status'));
		status.setAttribute('aria-hidden', 'true');
		const pendingCount = dom.append(row, $('span.navigator-projects-session-count'));
		pendingCount.setAttribute('aria-hidden', 'true');
		const actions = dom.append(row, $('.navigator-projects-row-actions'));
		disposables.add(dom.addDisposableListener(actions, 'mousedown', event => event.stopPropagation()));
		disposables.add(dom.addDisposableListener(actions, 'click', event => event.stopPropagation()));
		disposables.add(dom.addDisposableListener(actions, 'dblclick', event => event.stopPropagation()));

		const templateData: IProjectNodeTemplateData = {
			row,
			label,
			icon,
			name,
			description,
			detail,
			status,
			pendingCount,
			actions,
			actionBar: new ActionBar(actions),
			element: undefined,
			moreAction: undefined!,
			newSessionAction: undefined!,
			disposables,
		};
		templateData.newSessionAction = new Action(
			'navigator.projects.newSession',
			localize('navigatorProjects.newSession', "New session"),
			`${ThemeIcon.asClassName(Codicon.add)} navigator-projects-new-session`,
			false,
			() => {
				const element = templateData.element;
				if (!element || element.kind !== 'workdir' || !this.canCreateInWorkDir(element)) {
					return;
				}
				this.onCreateSession();
			},
		);
		templateData.newSessionAction.tooltip = localize('navigatorProjects.newSession', "New session");
		templateData.moreAction = new Action('navigator.projects.more', localize('navigatorProjects.more', "More"),
			`${ThemeIcon.asClassName(Codicon.ellipsis)} navigator-projects-more`, true,
			() => this.showContextMenu(templateData.element, actions));
		templateData.actionBar.push([templateData.moreAction, templateData.newSessionAction], { icon: true, label: false });
		templateData.actionBar.setFocusable(false);
		this.templates.add(templateData);
		return templateData;
	}

	renderElement(node: ITreeNode<INavigatorProjectsTreeNode, void>, _index: number, templateData: IProjectNodeTemplateData): void {
		const element = node.element;
		templateData.row.classList.toggle('is-group', element.kind === 'workdir' || element.kind === 'local-group');
		templateData.row.classList.toggle('is-session', element.kind === 'session');
		templateData.element = element;
		templateData.actions.classList.remove('is-menu-open');
		const icon = navigatorProjectsNodeIcon(element.kind);
		templateData.icon.className = 'navigator-projects-node-icon';
		if (icon) {
			templateData.icon.classList.add(...ThemeIcon.asClassNameArray(icon));
			templateData.icon.style.display = '';
		} else {
			templateData.icon.style.display = 'none';
		}
		templateData.name.textContent = element.kind === 'workdir' ? workDirGroupLabel(element.description, false) : element.label;
		const state = element.kind === 'session' && element.sessionId ? this.getSessionStatus(element.sessionId) : { tone: 'idle' as const, pending: 0 };
		templateData.row.dataset.tone = state.tone;
		templateData.status.className = `navigator-projects-session-status is-${state.tone}`;
		templateData.status.classList.add(...ThemeIcon.asClassNameArray(sessionRosterGlyph(state.tone)));
		templateData.status.classList.toggle('codicon-modifier-spin', state.tone === 'running');
		templateData.status.hidden = state.tone === 'idle';
		templateData.pendingCount.textContent = state.pending > 0 ? String(state.pending) : '';
		templateData.pendingCount.hidden = state.pending < 1;
		templateData.description.textContent = element.description ?? '';
		templateData.detail.textContent = element.detail ?? '';
		templateData.detail.style.display = element.detail ? '' : 'none';
		templateData.label.classList.toggle('is-active-session', !!element.active);
		const titleParts = [element.label];
		if (element.description) {
			titleParts.push(element.description);
		}
		if (element.detail) {
			titleParts.push(element.detail);
		}
		templateData.label.title = titleParts.join(' — ');
		templateData.description.style.display = element.description ? '' : 'none';
		this.syncTemplateActions(templateData);
	}

	disposeTemplate(templateData: IProjectNodeTemplateData): void {
		this.templates.delete(templateData);
		templateData.actionBar.dispose();
		templateData.moreAction.dispose();
		templateData.newSessionAction.dispose();
		templateData.disposables.dispose();
	}

	showContextMenu(element: INavigatorProjectsTreeNode | undefined, anchor: HTMLElement | IListContextMenuEvent<INavigatorProjectsTreeNode>['anchor']): void {
		const sessionId = element?.kind === 'session' ? element.sessionId : undefined;
		if (!sessionId) {
			return;
		}
		const menuActions = [...this.templates].find(template => template.element?.id === element?.id)?.actions;
		menuActions?.classList.add('is-menu-open');
		// Snapshot identity: a virtual row may be recycled while the menu is open.
		const owner = this.getMenuOwner();
		const isCurrent = () => {
			const current = this.getMenuOwner();
			return current.engineIdentityId === owner.engineIdentityId && current.linkId === owner.linkId && current.revision === owner.revision && this.areRowActionsLive();
		};
		const live = isCurrent();
		const reason = this.getRowActionUnavailableReason();
		const openLabel = localize('navigatorProjects.openSession', "Open");
		const deleteLabel = localize('navigatorProjects.deleteSession', "Delete");
		const actions = [
			new Action('navigator.projects.openSession', live ? openLabel : `${openLabel}. ${reason}`, undefined, live, () => {
				if (isCurrent()) {
					this.onOpenSession(sessionId);
				}
			}),
			new Action('navigator.projects.deleteSession', live ? deleteLabel : `${deleteLabel}. ${reason}`, undefined, live, () => {
				if (isCurrent()) {
					this.onDeleteSession(sessionId);
				}
			}),
		];
		this.contextMenuService.showContextMenu({
			getMenuClassName: () => 'ua-rounded-menu ua-project-session-menu',
			getAnchor: () => anchor,
			getActions: () => actions,
			onHide: didCancel => {
				menuActions?.classList.remove('is-menu-open');
				actions.forEach(action => action.dispose());
				if (didCancel) {
					this.restoreFocus();
				}
			},
		});
	}

	private sessionIdOf(templateData: IProjectNodeTemplateData): string | undefined {
		const element = templateData.element;
		return element?.kind === 'session' ? element.sessionId : undefined;
	}

	private syncTemplateActions(templateData: IProjectNodeTemplateData): void {
		const element = templateData.element;
		const session = !!this.sessionIdOf(templateData);
		const workdir = !!element && element.kind === 'workdir' && this.isWorkDirCreateTarget(element);
		templateData.actions.classList.toggle('is-available', session || workdir);
		templateData.actions.classList.toggle('is-session-actions', session);
		templateData.actions.classList.toggle('is-workdir-actions', workdir);
		templateData.newSessionAction.enabled = workdir && !!element && this.canCreateInWorkDir(element);
		const holdReason = this.getRowActionUnavailableReason();
		if (workdir && element) {
			const label = navigatorNewSessionInLabel(element.description);
			templateData.newSessionAction.label = label;
			templateData.newSessionAction.tooltip = templateData.newSessionAction.enabled || !holdReason
				? label
				: `${label}. ${holdReason}`;
		}
	}
}

export class NavigatorProjectsView extends ViewPane {

	static readonly ID = NAVIGATOR_PROJECTS_VIEW_ID;

	private tree: WorkbenchObjectTree<INavigatorProjectsTreeNode, void> | undefined;
	private nodeRenderer: ProjectNodeRenderer | undefined;
	private treeContainer: HTMLElement | undefined;
	private recentsStatus: HTMLElement | undefined;
	private filterEmpty: HTMLElement | undefined;
	private filterBox: NavigatorProjectsInlineFilterBox | undefined;
	private container: HTMLElement | undefined;
	private filterQuery = '';
	private treeNodes: INavigatorProjectsTreeNode[] = [];
	private localFolderEntries: INavigatorLocalFolderEntry[] = [];
	private wasEverConnected = false;
	/** D445: leftover KEEP must close leftover-as-live session switch without reselect. */
	private leftoverSessionSwitchClosed = false;
	/** Last connection workDir seen on a painted snapshot. Only used to keep the New session row after the snapshot loses it. */
	private lastConnectionWorkDir: string | undefined;
	private _rebuildSeq = 0;
	private menuConnectionRevision = 0;

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
		@INotificationService private readonly notificationService: INotificationService,
		@IWorkspaceEditingService private readonly workspaceEditingService: IWorkspaceEditingService,
		@ICommandService private readonly commandService: ICommandService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@IDialogService private readonly dialogService: IDialogService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this._register(this.contextService.onDidChangeWorkbenchState(() => {
			if (this._store.isDisposed) {
				return;
			}
			this.refresh();
		}));
		this._register(this.contextService.onDidChangeWorkspaceFolders(() => {
			if (this._store.isDisposed) {
				return;
			}
			this.refresh();
		}));
		this._register(this.workspacesService.onDidChangeRecentlyOpened(() => {
			if (this._store.isDisposed) {
				return;
			}
			this.refresh();
		}));
		this._register(this.labelService.onDidChangeFormatters(() => {
			if (this._store.isDisposed) {
				return;
			}
			this.refresh();
		}));
		this._register(this.rosterService.onDidChangeSession(() => {
			if (this._store.isDisposed) {
				return;
			}
			this.refresh();
		}));
		this._register(this.rosterService.onDidChangeSessionRosterDetail(() => {
			if (this._store.isDisposed) {
				return;
			}
			this.refresh();
		}));
		this._register(this.rosterService.onDidChangeActiveSession(() => {
			if (this._store.isDisposed) {
				return;
			}
			this.refresh();
		}));
		this._register(this.rosterService.onDidChangeEngineConnection(connected => {
			if (this._store.isDisposed) {
				return;
			}
			// D363 leftover-looks-live: pairing-hold-first for wasEverConnected.
			// onDidChangeEngineConnection(true) is leftover-looks-live when
			// pairingPending / isConversationPairingHold. First-pull must not
			// flip wasEverConnected (ever-connected / leftover-as-live chrome).
			// KEEP leftover with rows still early-returns in rebuildTree (D360).
			// True connect no pairing still sets it. True disconnect does not.
			if (connected && !isConversationPairingHold(this.uaConnection)) {
				this.wasEverConnected = true;
			}
			this.refresh();
		}));
		this._register(this.uaConnection.onDidChangeConnection(() => {
			if (this._store.isDisposed) {
				return;
			}
			this.menuConnectionRevision++;
			this.refresh();
		}));
	}

	override dispose(): void {
		this.tree?.dispose();
		this.tree = undefined;
		this.nodeRenderer = undefined;
		this.treeContainer?.remove();
		this.treeContainer = undefined;
		this.filterEmpty?.remove();
		this.filterEmpty = undefined;
		this.recentsStatus?.remove();
		this.recentsStatus = undefined;
		this.filterBox?.dispose();
		this.filterBox = undefined;
		if (this.container) {
			this.container.classList.remove('navigator-projects', 'navigator-projects-body', 'show-file-icons');
			dom.clearNode(this.container);
			this.container = undefined;
		}
		super.dispose();
	}

	override shouldShowWelcome(): boolean {
		if (this.hasRecentsFailure()) {
			return false;
		}
		if (isConversationPairingHold(this.uaConnection) && this.hasProjectsLeftoverRows()) {
			return false;
		}
		// D360 leftover-looks-live: pairing-hold-first. First-pull KEEP-chrome
		// is not only `!isEngineConnected()`.
		const engineConnected = !isConversationPairingHold(this.uaConnection) && this.rosterService.isEngineConnected();
		if (this.uaConnection.getConnectionPhase().kind === 'connecting') {
			return false;
		}
		return countLocalFolders(this.treeNodes) === 0 && !engineConnected && !this.wasEverConnected;
	}

	private hasProjectsLeftoverRows(): boolean {
		return this.treeNodes.length > 0 || this.localFolderEntries.length > 0;
	}

	private hasRecentsFailure(): boolean {
		return this.findNodeById(this.treeNodes, RECENTS_FAILED_NOTE_ID) !== undefined
			|| (!!this.recentsStatus && this.recentsStatus.style.display !== 'none');
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.container = container;
		container.classList.add('navigator-projects', 'show-file-icons', 'navigator-projects-body');

		const filterPlaceholder = localize('navigatorProjectsFilterPlaceholder', "Filter projects");
		this.filterBox = this._register(new NavigatorProjectsInlineFilterBox(
			container,
			filterPlaceholder,
			filterPlaceholder,
		));
		this.filterBox.setVisible(false);
		this._register(this.filterBox.onDidChange(query => {
			if (this._store.isDisposed) {
				return;
			}
			this.filterQuery = query;
			this.applyFilterToTree();
		}));

		this.recentsStatus = dom.append(container, $('.navigator-projects-recents-status'));
		this.recentsStatus.setAttribute('role', 'status');
		this.recentsStatus.style.display = 'none';
		this.filterEmpty = dom.append(container, $('.navigator-projects-filter-empty'));
		this.filterEmpty.setAttribute('role', 'status');
		this.filterEmpty.textContent = PROJECTS_FILTER_NO_MATCH;
		this.filterEmpty.style.display = 'none';
		this.treeContainer = dom.append(container, $('.navigator-projects-list'));
		this.ensureTree();
		this.refresh();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		if (this._store.isDisposed) {
			return;
		}
		const narrow = width > 0 && width < 600;
		this.element.classList.toggle('is-narrow', narrow);
		this.element.classList.toggle('is-compact', width > 0 && width < 300);
		const filterHeight = this.treeNodes.length > 0 ? NavigatorProjectsInlineFilterBox.HEIGHT : 0;
		const statusHeight = this.recentsStatus && this.recentsStatus.style.display !== 'none'
			? this.recentsStatus.offsetHeight
			: 0;
		const emptyHeight = this.filterEmpty && this.filterEmpty.style.display !== 'none'
			? this.filterEmpty.offsetHeight
			: 0;
		this.tree?.layout(height - filterHeight - statusHeight - emptyHeight, Math.max(0, width - 16));
	}

	private ensureTree(): WorkbenchObjectTree<INavigatorProjectsTreeNode, void> {
		if (this.tree) {
			return this.tree;
		}

		const labels = this._register(this.instantiationService.createInstance(ResourceLabels, { onDidChangeVisibility: this.onDidChangeBodyVisibility }));
		const delegate = new ProjectsTreeDelegate();
		this.nodeRenderer = new ProjectNodeRenderer(
			this.contextMenuService,
			() => { if (this.isBodyVisible()) { this.tree?.domFocus(); } },
			() => {
				const snapshot = this.uaConnection.getConnectionSnapshot();
				return { engineIdentityId: snapshot.engineIdentityId, linkId: snapshot.linkId, revision: this.menuConnectionRevision };
			},
			sessionId => {
				const pending = this.rosterService.countPendingConfirmations(sessionId);
				return { tone: resolveSessionRosterTone(this.rosterService.getTurns(sessionId), pending), pending };
			},
			() => this.isProjectsSessionSwitchLive(),
			sessionId => this.openSession(sessionId),
			sessionId => {
				if (this._store.isDisposed) {
					return;
				}
				void this.deleteSession(sessionId).catch(onUnexpectedError);
			},
			node => this.isWorkDirCreateTarget(node),
			node => this.canCreateInWorkDir(node),
			() => this.getRowActionUnavailableReason(),
			() => this.createSessionInCurrentWorkDir(),
		);

		this.tree = this._register(this.instantiationService.createInstance(
			WorkbenchObjectTree<INavigatorProjectsTreeNode, void>,
			'NavigatorProjects',
			this.treeContainer!,
			delegate,
			[
				new ProjectFolderRenderer(labels),
				this.nodeRenderer,
			],
			{
				identityProvider: { getId: (node: INavigatorProjectsTreeNode) => node.id },
				horizontalScrolling: false,
				indent: 12,
				hideTwistiesOfChildlessElements: true,
				renderIndentGuides: RenderIndentGuides.None,
				accessibilityProvider: {
					getAriaLabel: (node: INavigatorProjectsTreeNode) => {
						const parts = [node.label];
						if (node.description) {
							parts.push(node.description);
						}
						if (node.detail) {
							parts.push(node.detail);
						}
						if (node.active) {
							parts.push(localize('navigatorProjects.activeSession', "active session"));
						}
						return parts.join(', ');
					},
					getWidgetAriaLabel: () => localize('navigatorProjectsView.ariaLabel', "Projects"),
				},
			},
		));

		this._register(this.tree.onDidOpen(e => {
			if (this._store.isDisposed) {
				return;
			}
			this.openTreeNode(e.element, e.browserEvent);
		}));
		this._register(this.tree.onContextMenu(e => {
			if (this._store.isDisposed) {
				return;
			}
			this.nodeRenderer?.showContextMenu(e.element ?? undefined, e.anchor);
		}));

		return this.tree;
	}

	private openTreeNode(node: INavigatorProjectsTreeNode | undefined, browserEvent?: UIEvent): void {
		if (this._store.isDisposed || !node) {
			return;
		}
		if (node.kind === 'session' && node.sessionId) {
			this.openSession(node.sessionId);
			return;
		}
		if (node.kind === 'local-folder' && node.openable) {
			const mouseEvent = dom.isMouseEvent(browserEvent) ? browserEvent : undefined;
			const forceNewWindow = !!(mouseEvent && (mouseEvent.ctrlKey || mouseEvent.metaKey));
			const forceReuseWindow = !!(mouseEvent && mouseEvent.altKey);
			const resource = node.resource;
			// Without a modifier the window grows: a folder joins the workspace, it does not replace it.
			if (!forceNewWindow && !forceReuseWindow && resource) {
				if (this.contextService.getWorkspace().folders.some(folder => isEqual(folder.uri, resource))) {
					void this.commandService.executeCommand(REVEAL_IN_EXPLORER_COMMAND_ID, resource).catch(onUnexpectedError);
					return;
				}
				if ((node.remoteAuthority || undefined) === (this.environmentService.remoteAuthority || undefined)) {
					void this.workspaceEditingService.addFolders([{ uri: resource }]).catch(onUnexpectedError);
					return;
				}
			}
			void this.hostService.openWindow([node.openable], {
				forceNewWindow: forceNewWindow || (!forceReuseWindow && !!resource),
				forceReuseWindow,
				remoteAuthority: node.remoteAuthority ?? null,
			}).catch(onUnexpectedError);
		}
	}

	private openSession(sessionId: string): void {
		if (this._store.isDisposed || !this.isProjectsSessionSwitchLive()) {
			return;
		}
		this.rosterService.switchSession(sessionId);
		this.revealConversation();
	}

	/** Hover + on the current engine workDir. Create does not take a path; the engine stamps its current workDir. */
	private canCreateInWorkDir(node: INavigatorProjectsTreeNode): boolean {
		return this.isWorkDirCreateTarget(node) && this.canCreateSessionNow();
	}

	private isWorkDirCreateTarget(node: INavigatorProjectsTreeNode): boolean {
		if (node.kind !== 'workdir') {
			return false;
		}
		const liveWorkDir = this.uaConnection.getConnectionSnapshot().workDir;
		if (isNavigatorWorkDirCreateTarget(node.description, liveWorkDir)) {
			return true;
		}
		// A user disconnect or a profile takeover clears the snapshot's workDir while the rows stay. Keep the
		// row it grouped as the target so New session shows disabled with a reason. This can only widen what is
		// shown while writes are on hold; it never enables Create, which still needs a live workDir.
		return !liveWorkDir?.trim()
			&& !this.canCreateSessionNow()
			&& this.lastConnectionWorkDir !== undefined
			&& isNavigatorWorkDirCreateTarget(node.description, this.lastConnectionWorkDir);
	}

	private getRowActionUnavailableReason(): string {
		const pairingHold = isConversationPairingHold(this.uaConnection);
		if (pairingHold || !this.rosterService.isEngineConnected()) {
			return conversationSessionHoldReason(pairingHold, getConversationSessionReadiness(this.rosterService))
				?? conversationLensDockEngineNotConnected;
		}
		return conversationSessionHoldReason(false, getConversationSessionReadiness(this.rosterService))
			?? localize('navigatorProjects.sessionActionsUnavailable', "Session actions are unavailable right now.");
	}

	private canCreateSessionNow(): boolean {
		return this.isProjectsSessionSwitchLive();
	}

	private createSessionInCurrentWorkDir(): void {
		if (this._store.isDisposed || !this.canCreateSessionNow()) {
			return;
		}
		this.rosterService.createSession();
		this.revealConversation();
	}

	private revealConversation(): void {
		if (this._store.isDisposed) {
			return;
		}
		if (!this.layoutService.isVisible(Parts.CONVERSATION_PART)) {
			this.layoutService.setPartHidden(false, Parts.CONVERSATION_PART);
		}
		this.conversationPartService.focus();
	}

	/** PRD-002.6: same confirm and title lookup as the Sessions view. */
	private async deleteSession(sessionId: string): Promise<void> {
		if (this._store.isDisposed || !this.isProjectsSessionSwitchLive()) {
			return;
		}
		const title = this.rosterService.getSessions().find(session => session.id === sessionId)?.title ?? '';
		const owner = captureConversationDeleteOwner(this.rosterService, this.uaConnection);
		if (!owner || this._store.isDisposed) {
			return;
		}
		const guard = guardConversationDeleteConfirmation(owner, this.rosterService, this.uaConnection);
		try {
			const confirmed = await confirmDeleteConversationSession(this.dialogService, title);
			if (!confirmed || this._store.isDisposed || !guard.isCurrent()) {
				return;
			}
		} finally {
			guard.dispose();
		}
		if (this._store.isDisposed || !this.isProjectsSessionSwitchLive()) {
			return;
		}
		if (!this.rosterService.getSessions().some(session => session.id === sessionId)) {
			return;
		}
		if (this.rosterService.deleteSession(sessionId, owner)) {
			return;
		}
		this.notificationService.error(
			!this.rosterService.isEngineConnected() && this.rosterService.hasEngineConnectionHistory()
				? localize('navigatorProjects.deleteSessionDisconnected', "Could not delete session — engine disconnected.")
				: localize('navigatorProjects.deleteSessionFailed', "Could not delete session."),
		);
	}

	private refresh(): void {
		if (this._store.isDisposed) {
			return;
		}
		// The rebuild is async. Repaint the action state first so a pairing hold or disconnect disables the row actions at once.
		this.nodeRenderer?.syncRowActionChrome();
		void this.rebuildTree().catch(onUnexpectedError);
	}

	private async rebuildTree(): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}
		const rebuildSeq = ++this._rebuildSeq;
		try {
			const currentFolders = this.getCurrentFolderEntries();
			let recentFolders: INavigatorLocalFolderEntry[] = [];
			let recentsFailureCopy: string | undefined;
			try {
				recentFolders = await this.getRecentFolderEntries();
			} catch (error) {
				recentsFailureCopy = navigatorProjectsRecentsFailureMessage(error);
			}

			if (this._store.isDisposed || rebuildSeq !== this._rebuildSeq) {
				return;
			}

			let suppressRecentsFailureNote = false;
			if (recentsFailureCopy && (this.localFolderEntries.length > 0 || this.treeNodes.length > 0)) {
				// A recents failure must not paint a disconnect snapshot or freeze a still-live session list.
				// Keep the last local folders. Rebuild session rows only while that list can stay live.
				const engineStillConnected = !isConversationPairingHold(this.uaConnection) && this.rosterService.isEngineConnected();
				const sessionListCapabilityNow = getNavigatorCapability(this.uaConnection, 'sessionList');
				const sessionListCanStayLive = engineStillConnected
					&& sessionListCapabilityNow !== 'UNKNOWN'
					&& !isConversationSessionNotReady(this.rosterService);
				if (!sessionListCanStayLive) {
					this.markLeftoverSessionSwitchClosed();
					this.setRecentsStatus(recentsFailureCopy);
					return;
				}
				this.setRecentsStatus(recentsFailureCopy);
				suppressRecentsFailureNote = true;
			} else {
				this.setRecentsStatus(recentsFailureCopy);

				this.localFolderEntries = recentsFailureCopy
					? currentFolders
					: [...currentFolders, ...recentFolders];
			}

			if (isConversationPairingHold(this.uaConnection) && this.hasProjectsLeftoverRows()) {
				this.markLeftoverSessionSwitchClosed();
				this.filterBox?.setVisible(this.treeNodes.length > 0);
				this.applyFilterToTree();
				this._onDidChangeViewWelcomeState.fire();
				return;
			}

			// D360 leftover-looks-live: pairing-hold first. KEEP leftover WITH
			// leftover rows still early-returns above. leftover-looks-live
			// first-pull (`isEngineConnected()===true` + pairingPending, no
			// leftover) must not paint live engine projects chrome.
			const engineConnected = !isConversationPairingHold(this.uaConnection) && this.rosterService.isEngineConnected();
			if (engineConnected) {
				this.wasEverConnected = true;
			}

			const snapshot = this.uaConnection.getConnectionSnapshot();
			if (snapshot.workDir?.trim()) {
				this.lastConnectionWorkDir = snapshot.workDir;
			}
			const sessionListCapability = getNavigatorCapability(this.uaConnection, 'sessionList');
			this.treeNodes = this.withRecentsFailureNote(buildNavigatorProjectsTree({
				engineConnected,
				wasEverConnected: this.wasEverConnected,
				transportFailed: snapshot.transport === 'failed',
				sessionListCapability,
				workDir: snapshot.workDir,
				workspaceRoots: this.contextService.getWorkspace().folders.map(folder => folder.uri.fsPath),
				sessions: this.rosterService.getSessions(),
				localFolders: this.localFolderEntries,
				activeSessionId: this.rosterService.getActiveSessionId(),
				sessionDetail: session => {
					const turns = this.rosterService.getTurns(session.id);
					const pending = this.rosterService.countPendingConfirmations(session.id);
					return formatSessionRosterSubtitle(session, pending, turns.length, resolveSessionRosterTone(turns, pending));
				},
			}), suppressRecentsFailureNote ? undefined : recentsFailureCopy);
			this.leftoverSessionSwitchClosed = !engineConnected
				|| sessionListCapability === 'UNKNOWN'
				|| isConversationSessionNotReady(this.rosterService);

			this.filterBox?.setVisible(this.treeNodes.length > 0);
			this.applyFilterToTree();
			this.nodeRenderer?.syncRowActionChrome();
			if (
				!recentsFailureCopy
				&& this.uaConnection.getConnectionPhase().kind === 'connecting'
				&& countLocalFolders(this.treeNodes) === 0
				&& !this.wasEverConnected
			) {
				this.setRecentsStatus(PROJECTS_CONNECTING_COPY, 'neutral');
			}
			this._onDidChangeViewWelcomeState.fire();
		} catch {
			if (this._store.isDisposed || rebuildSeq !== this._rebuildSeq) {
				return;
			}
			try {
				this.surfaceLastGoodAsStale();
			} catch {
				// Keep last-good localFolderEntries / treeNodes.
			}
		}
	}

	/**
	 * Session actions are live only on a connected, paired, ready engine. Pairing and connection are read here,
	 * not taken from the flag the async rebuild sets, so a Delete confirmation that outlives a disconnect is refused.
	 */
	private isProjectsSessionSwitchLive(): boolean {
		return !this._store.isDisposed
			&& !this.leftoverSessionSwitchClosed
			&& !isConversationSessionNotReady(this.rosterService)
			&& !isConversationPairingHold(this.uaConnection)
			&& this.rosterService.isEngineConnected();
	}

	private markLeftoverSessionSwitchClosed(): void {
		if (this._store.isDisposed) {
			return;
		}
		this.leftoverSessionSwitchClosed = true;
		this.nodeRenderer?.syncRowActionChrome();
	}

	private surfaceLastGoodAsStale(): void {
		if (this._store.isDisposed) {
			return;
		}
		if (this.treeNodes.length === 0 && this.localFolderEntries.length === 0) {
			return;
		}
		this.markLeftoverSessionSwitchClosed();
		this.treeNodes = this.withStaleSnapshotNote(this.treeNodes);
		if (!this.hasVisibleRecentsStatus()) {
			this.setRecentsStatus(NAVIGATOR_STALE_SNAPSHOT_COPY, 'neutral');
		}
		this.filterBox?.setVisible(this.treeNodes.length > 0);
		try {
			this.applyFilterToTree();
		} catch {
			// Status / in-memory note already surface the failure.
		}
		this._onDidChangeViewWelcomeState.fire();
	}

	private hasVisibleRecentsStatus(): boolean {
		return !!this.recentsStatus
			&& this.recentsStatus.style.display !== 'none'
			&& !!this.recentsStatus.textContent;
	}

	private withStaleSnapshotNote(nodes: INavigatorProjectsTreeNode[]): INavigatorProjectsTreeNode[] {
		if (
			this.findNodeById(nodes, STALE_SNAPSHOT_NOTE_ID)
			|| this.findNodeById(nodes, TRANSPORT_FAILED_NOTE_ID)
		) {
			return nodes;
		}
		const staleNote: INavigatorProjectsTreeNode = {
			id: STALE_SNAPSHOT_NOTE_ID,
			kind: 'note',
			label: NAVIGATOR_STALE_SNAPSHOT_COPY,
		};
		return [staleNote, ...nodes];
	}

	private setRecentsStatus(copy: string | undefined, tone: 'error' | 'neutral' = 'error'): void {
		if (this._store.isDisposed || !this.recentsStatus) {
			return;
		}
		this.recentsStatus.classList.toggle('is-error', !!copy && tone === 'error');
		this.recentsStatus.classList.toggle('is-neutral', !!copy && tone === 'neutral');
		if (!copy) {
			this.recentsStatus.textContent = '';
			this.recentsStatus.style.display = 'none';
			return;
		}
		this.recentsStatus.textContent = copy;
		this.recentsStatus.style.display = '';
	}

	private withRecentsFailureNote(
		nodes: INavigatorProjectsTreeNode[],
		recentsFailureCopy: string | undefined,
	): INavigatorProjectsTreeNode[] {
		if (!recentsFailureCopy) {
			return nodes;
		}
		return [...nodes, {
			id: RECENTS_FAILED_NOTE_ID,
			kind: 'note',
			label: recentsFailureCopy,
		}];
	}

	private applyFilterToTree(): void {
		if (this._store.isDisposed) {
			return;
		}
		const tree = this.tree;
		if (!tree) {
			return;
		}
		const filtered = this.filterTreeNodes(this.treeNodes);
		const filterMiss = this.hasActiveFilter() && this.treeNodes.length > 0 && filtered.length === 0;
		if (this.filterEmpty) {
			this.filterEmpty.style.display = filterMiss ? 'flex' : 'none';
			this.filterEmpty.classList.toggle('is-shown', filterMiss);
		}
		tree.setChildren(null, filtered.map(element => ({
			element,
			collapsible: (element.children?.length ?? 0) > 0,
			children: this.mapFilteredChildren(element, filtered),
		})));
		this.syncActiveSessionSelection(filtered);
	}

	private syncActiveSessionSelection(nodes: readonly INavigatorProjectsTreeNode[]): void {
		if (this._store.isDisposed) {
			return;
		}
		const tree = this.tree;
		if (!tree) {
			return;
		}
		const active = this.findActiveSessionNode(nodes);
		try {
			if (active) {
				tree.expandTo(active);
			}
			tree.setSelection(active ? [active] : []);
		} catch {
			// Selection is chrome. A missing node must not drop the tree paint.
		}
	}

	private findActiveSessionNode(nodes: readonly INavigatorProjectsTreeNode[]): INavigatorProjectsTreeNode | undefined {
		for (const node of nodes) {
			if (node.active) {
				return node;
			}
			const nested = node.children ? this.findActiveSessionNode(node.children) : undefined;
			if (nested) {
				return nested;
			}
		}
		return undefined;
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

	private hasActiveFilter(): boolean {
		return this.filterQuery.trim() !== '';
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
		return filterNavigatorProjectsTreeNodes(nodes, this.filterQuery);
	}

	private getCurrentFolderEntries(): INavigatorLocalFolderEntry[] {
		if (this._store.isDisposed) {
			return [];
		}
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
		if (this._store.isDisposed) {
			return [];
		}
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
