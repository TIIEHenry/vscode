/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../base/browser/dom.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { RenderIndentGuides } from '../../../../base/browser/ui/tree/abstractTree.js';
import { ITreeNode, ITreeRenderer } from '../../../../base/browser/ui/tree/tree.js';
import { Action } from '../../../../base/common/actions.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { getErrorMessage, onUnexpectedError } from '../../../../base/common/errors.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr, IContextKey, RawContextKey, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { WorkbenchList, WorkbenchObjectTree } from '../../../../platform/list/browser/listService.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { ItemAttribution } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { SessionViewSnapshot } from '../../../../platform/universeAgent/common/sessionView/index.js';
import { IViewPaneOptions, ViewAction, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { CONVERSATION_REVEAL_ITEM_COMMAND_ID } from '../../conversation/browser/conversationRevealItem.contribution.js';
import { isConversationPairingHold } from '../../conversation/browser/conversationSessionStatus.js';
import { IConversationRosterService } from '../../conversation/browser/conversationStubService.js';
import { IAgentInspectService } from '../common/agentInspect.js';
import {
	collectNavigatorActivityItems,
	INavigatorAgentsActivityItem,
	navigatorActivityTruncated,
} from '../common/navigatorAgentsActivity.js';
import {
	agentStatusTone,
	formatAgentStatusLabel,
	formatAgentTypeShort,
	INavigatorAgentsHierarchyNode,
	collectLiveAgentTreeAgentIds,
	EMPTY_LIVE_AGENT_IDS,
	isRootOnlyAgentTree,
	liveAgentTreeToHierarchyNodes,
} from '../common/navigatorAgentHierarchy.js';
import { getNavigatorAgentTreePendingCopy, NAVIGATOR_ACTIVITY_FETCH_FAILED_COPY, NAVIGATOR_AGENT_TREE_FETCH_FAILED_COPY, NAVIGATOR_STALE_SNAPSHOT_COPY } from '../common/navigatorAgentTreeEmptyState.js';
import { getNavigatorCapability } from '../common/navigatorEngineBridge.js';
import { matchesNavigatorAgentsInlineFilter } from '../common/navigatorAgentsInlineFilter.js';
import {
	AGENT_INSPECT_VIEW_ID,
	OPEN_NAVIGATOR_AGENTS_INSPECT_COMMAND_ID,
} from './agentInspectIds.js';
import { NavigatorAgentsInlineFilterBox } from './navigatorAgentsInlineFilterBox.js';
import { NavigatorSessionLeaseHolder } from './navigatorSessionLeaseHolder.js';
import { revealNavigatorAgentInConversation } from './navigatorReveal.js';

const $ = dom.$;

const AGENTS_FILTER_NO_MATCH = localize('navigatorAgents.noMatch', "No matches");

export const NAVIGATOR_AGENTS_VIEW_ID = 'workbench.view.navigatorAgents';

export type NavigatorAgentsSubview = 'hierarchy' | 'activity';

export const NAVIGATOR_AGENTS_SHOW_HIERARCHY_COMMAND_ID = 'workbench.action.navigatorAgents.showHierarchy';
export const NAVIGATOR_AGENTS_SHOW_ACTIVITY_COMMAND_ID = 'workbench.action.navigatorAgents.showActivity';
export const NAVIGATOR_AGENTS_REFRESH_COMMAND_ID = 'workbench.action.navigatorAgents.refresh';
export const NAVIGATOR_AGENTS_INSPECT_ITEM_COMMAND_ID = 'workbench.action.navigatorAgents.inspectItem';
export const NAVIGATOR_AGENTS_REVEAL_COMMAND_ID = 'workbench.action.navigatorAgents.revealInConversation';

export const NAVIGATOR_AGENTS_SUBVIEW_HIERARCHY_KEY = new RawContextKey<boolean>('navigatorAgentsSubview.hierarchy', true);
export const NAVIGATOR_AGENTS_SUBVIEW_ACTIVITY_KEY = new RawContextKey<boolean>('navigatorAgentsSubview.activity', false);
export const UA_ENGINE_CONNECTED_KEY = new RawContextKey<boolean>('ua.engineConnected', false);

class AgentsHierarchyDelegate implements IListVirtualDelegate<INavigatorAgentsHierarchyNode> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return 'navigatorAgentsHierarchy';
	}
}

interface IAgentsHierarchyTemplateData {
	readonly label: HTMLElement;
	readonly typeIcon: HTMLElement;
	readonly statusGlyph: HTMLElement;
	readonly actionBar: ActionBar;
	inspectAction: Action;
	revealAction: Action;
	element: INavigatorAgentsHierarchyNode | undefined;
}

function iconForAgentType(type: string): ThemeIcon {
	const short = formatAgentTypeShort(type).toUpperCase();
	if (short === 'ROOT') {
		return Codicon.home;
	}
	if (short === 'SUB') {
		return Codicon.account;
	}
	return Codicon.robot;
}

class AgentsHierarchyRenderer implements ITreeRenderer<INavigatorAgentsHierarchyNode, void, IAgentsHierarchyTemplateData> {
	static readonly TEMPLATE_ID = 'navigatorAgentsHierarchy';
	readonly templateId = AgentsHierarchyRenderer.TEMPLATE_ID;

	constructor(
		private readonly onInspect: (node: INavigatorAgentsHierarchyNode) => void,
		private readonly onReveal: (node: INavigatorAgentsHierarchyNode) => void,
		private readonly areRowActionsLive: () => boolean,
	) { }

	private readonly templates = new Set<IAgentsHierarchyTemplateData>();

	renderTemplate(container: HTMLElement): IAgentsHierarchyTemplateData {
		const row = dom.append(container, $('.navigator-agents-hierarchy-row'));
		const typeIcon = dom.append(row, $('.navigator-agents-type-icon'));
		typeIcon.setAttribute('aria-hidden', 'true');
		const statusGlyph = dom.append(row, $('.navigator-agents-status-glyph'));
		const label = dom.append(row, $('.navigator-agents-hierarchy-label'));
		const actionsContainer = dom.append(row, $('.navigator-agents-row-actions'));
		actionsContainer.addEventListener('mousedown', e => e.stopPropagation());
		actionsContainer.addEventListener('click', e => e.stopPropagation());
		actionsContainer.addEventListener('dblclick', e => e.stopPropagation());

		const templateData: IAgentsHierarchyTemplateData = {
			label,
			typeIcon,
			statusGlyph,
			actionBar: new ActionBar(actionsContainer),
			element: undefined,
			inspectAction: undefined!,
			revealAction: undefined!,
		};
		templateData.inspectAction = new Action(
			NAVIGATOR_AGENTS_INSPECT_ITEM_COMMAND_ID,
			localize('navigatorAgents.rowInspect', "Inspect"),
			ThemeIcon.asClassName(Codicon.inspect),
			this.areRowActionsLive(),
			() => {
				if (!this.areRowActionsLive() || !templateData.element) {
					return;
				}
				this.onInspect(templateData.element);
			},
		);
		templateData.revealAction = new Action(
			NAVIGATOR_AGENTS_REVEAL_COMMAND_ID,
			localize('navigatorAgents.rowReveal', "Reveal in Conversation"),
			ThemeIcon.asClassName(Codicon.goToFile),
			this.areRowActionsLive(),
			() => {
				if (!this.areRowActionsLive() || !templateData.element) {
					return;
				}
				this.onReveal(templateData.element);
			},
		);
		templateData.inspectAction.tooltip = localize('navigatorAgents.rowInspect', "Inspect");
		templateData.revealAction.tooltip = localize('navigatorAgents.rowReveal', "Reveal in Conversation");
		templateData.actionBar.push([templateData.inspectAction, templateData.revealAction], { icon: true, label: false });
		templateData.actionBar.setFocusable(false);
		this.templates.add(templateData);
		return templateData;
	}

	renderElement(node: ITreeNode<INavigatorAgentsHierarchyNode, void>, _index: number, templateData: IAgentsHierarchyTemplateData): void {
		const element = node.element;
		templateData.element = element;
		templateData.label.textContent = element.label;
		templateData.label.title = element.label;
		templateData.typeIcon.textContent = '';
		templateData.typeIcon.className = `navigator-agents-type-icon ${ThemeIcon.asClassName(iconForAgentType(element.type))}`;
		templateData.typeIcon.title = formatAgentTypeShort(element.type);
		templateData.statusGlyph.textContent = '';
		templateData.statusGlyph.className = `navigator-agents-status-glyph is-${agentStatusTone(element.status)}`;
		templateData.statusGlyph.title = formatAgentStatusLabel(element.status);
		templateData.statusGlyph.setAttribute('aria-label', formatAgentStatusLabel(element.status));
		this.syncTemplateActions(templateData);
	}

	syncRowActionChrome(): void {
		for (const template of this.templates) {
			this.syncTemplateActions(template);
		}
	}

	private syncTemplateActions(templateData: IAgentsHierarchyTemplateData): void {
		const live = this.areRowActionsLive();
		templateData.inspectAction.enabled = live;
		templateData.revealAction.enabled = live;
	}

	disposeTemplate(templateData: IAgentsHierarchyTemplateData): void {
		this.templates.delete(templateData);
		templateData.actionBar.dispose();
		templateData.inspectAction.dispose();
		templateData.revealAction.dispose();
	}
}

class AgentsActivityDelegate implements IListVirtualDelegate<INavigatorAgentsActivityItem> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return 'navigatorAgentsActivity';
	}
}

interface IAgentsActivityTemplateData {
	readonly label: HTMLElement;
}

class AgentsActivityRenderer implements IListRenderer<INavigatorAgentsActivityItem, IAgentsActivityTemplateData> {
	static readonly TEMPLATE_ID = 'navigatorAgentsActivity';
	readonly templateId = AgentsActivityRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IAgentsActivityTemplateData {
		return { label: dom.append(container, $('.navigator-agents-activity-label')) };
	}

	renderElement(item: INavigatorAgentsActivityItem, _index: number, templateData: IAgentsActivityTemplateData): void {
		templateData.label.textContent = item.label;
		templateData.label.title = item.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

class AgentsActivityAccessibilityProvider implements IListAccessibilityProvider<INavigatorAgentsActivityItem> {
	getWidgetAriaLabel(): string {
		return localize('navigatorAgentsActivity.ariaLabel', "Agent tool activity");
	}

	getAriaLabel(item: INavigatorAgentsActivityItem): string {
		return item.label;
	}
}

export class NavigatorAgentsView extends ViewPane {

	static readonly ID = NAVIGATOR_AGENTS_VIEW_ID;

	private subview: NavigatorAgentsSubview = 'hierarchy';
	private readonly hierarchyContextKey: IContextKey<boolean>;
	private readonly activityContextKey: IContextKey<boolean>;
	private readonly engineConnectedContextKey: IContextKey<boolean>;
	private readonly leaseHolder: NavigatorSessionLeaseHolder;

	private filterBox: NavigatorAgentsInlineFilterBox | undefined;
	private filterQuery = '';

	private hierarchyBody: HTMLElement | undefined;
	private hierarchyEmpty: HTMLElement | undefined;
	private hierarchyHonestEmpty = localize('navigatorAgentsHierarchy.empty', "No agents — no engine.");
	private hierarchyNote: HTMLElement | undefined;
	private hierarchyTreeContainer: HTMLElement | undefined;
	private hierarchyTree: WorkbenchObjectTree<INavigatorAgentsHierarchyNode, void> | undefined;
	private hierarchyEntries: INavigatorAgentsHierarchyNode[] = [];

	private activityBody: HTMLElement | undefined;
	private activityEmpty: HTMLElement | undefined;
	private activityHonestEmpty = localize('navigatorAgentsActivity.empty', "No tool activity — no engine.");
	private activityNote: HTMLElement | undefined;
	private activityListContainer: HTMLElement | undefined;
	private activityList: WorkbenchList<INavigatorAgentsActivityItem> | undefined;
	private activityEntries: INavigatorAgentsActivityItem[] = [];

	private lastLiveAgentTree: unknown;
	private hadHierarchySnapshot = false;
	private hadActivitySnapshot = false;
	/** D445: leftover KEEP must close Inspect / Reveal / row-open without reselect. */
	private leftoverRowActionsClosed = false;
	private hierarchyRenderer: AgentsHierarchyRenderer | undefined;
	private lastBodyHeight = 0;
	private lastBodyWidth = 0;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IConversationRosterService private readonly rosterService: IConversationRosterService,
		@IUniverseAgentConnection private readonly uaConnection: IUniverseAgentConnection,
		@IAgentInspectService private readonly inspectService: IAgentInspectService,
		@ICommandService private readonly commandService: ICommandService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this.hierarchyContextKey = NAVIGATOR_AGENTS_SUBVIEW_HIERARCHY_KEY.bindTo(this.scopedContextKeyService);
		this.activityContextKey = NAVIGATOR_AGENTS_SUBVIEW_ACTIVITY_KEY.bindTo(this.scopedContextKeyService);
		this.engineConnectedContextKey = UA_ENGINE_CONNECTED_KEY.bindTo(this.scopedContextKeyService);
		this.leaseHolder = this._register(new NavigatorSessionLeaseHolder(
			this.rosterService,
			() => this.refreshFromLease(),
			error => this.notificationService.error(getErrorMessage(error)),
		));
		this._register(this.rosterService.onDidChangeEngineConnection(() => {
			this.updateEngineConnectedContextKey();
			this.refreshFromLease();
		}));
		this._register(this.rosterService.onDidChangeActiveSession(() => this.refreshFromLease()));
		// D457: KEEP leftover list-fail flips via roster session events, not connection.
		this._register(this.rosterService.onDidChangeSession(() => this.syncKeepLeftoverWriteChrome()));
		// Tree first-fetch fail/clear fires via connection snapshot (D21), not lease patches.
		this._register(this.uaConnection.onDidChangeConnection(() => {
			this.updateEngineConnectedContextKey();
			this.refreshFromLease();
		}));
		this.updateSubviewContextKeys();
		this.updateEngineConnectedContextKey();
	}

	override setVisible(visible: boolean): void {
		super.setVisible(visible);
		this.leaseHolder.setVisible(visible);
		if (!visible) {
			this.inspectService.setLiveAgentIds('agents', undefined);
			this.inspectService.setLiveActivityIds(undefined);
		}
	}

	getActiveSubview(): NavigatorAgentsSubview {
		return this.subview;
	}

	showHierarchy(): void {
		if (this.subview === 'hierarchy') {
			return;
		}
		this.subview = 'hierarchy';
		this.updateSubviewContextKeys();
		this.updateSubviewVisibility();
		this.relayoutCurrentSubview();
	}

	showActivity(): void {
		if (this.subview === 'activity') {
			return;
		}
		this.subview = 'activity';
		this.updateSubviewContextKeys();
		this.updateSubviewVisibility();
		this.relayoutCurrentSubview();
	}

	refreshAgentTree(): void {
		const sessionId = this.rosterService.getActiveSessionId();
		if (
			!isConversationPairingHold(this.uaConnection)
			&& !this.isKeepLeftoverListFailWrite()
			&& this.rosterService.isEngineConnected()
			&& sessionId
		) {
			this.uaConnection.requestAgentTreeRefresh(sessionId);
		}
		this.refreshFromLease();
	}

	/** KEEP leftover list-fail (D455 Refresh / D457 Inspect): connected but roster not ready is not a live write surface. */
	private isKeepLeftoverListFailWrite(): boolean {
		return this.rosterService.isEngineConnected()
			&& this.rosterService.isEngineSessionReady() === false;
	}

	private updateEngineConnectedContextKey(): void {
		this.engineConnectedContextKey.set(
			!isConversationPairingHold(this.uaConnection)
			&& this.rosterService.isEngineConnected()
			&& !this.isKeepLeftoverListFailWrite(),
		);
	}

	private syncKeepLeftoverWriteChrome(): void {
		this.updateEngineConnectedContextKey();
		this.hierarchyRenderer?.syncRowActionChrome();
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		container.classList.add('navigator-agents-view');

		const filterPlaceholder = localize('navigatorAgentsFilterPlaceholder', "Filter agents");
		this.filterBox = this._register(new NavigatorAgentsInlineFilterBox(
			container,
			filterPlaceholder,
			filterPlaceholder,
		));
		this._register(this.filterBox.onDidChange(query => {
			this.filterQuery = query;
			this.applyFilter();
		}));

		this.hierarchyBody = dom.append(container, $('.navigator-agents-subview'));
		this.hierarchyEmpty = dom.append(this.hierarchyBody, $('.navigator-stub-empty'));
		this.hierarchyEmpty.setAttribute('role', 'status');
		this.hierarchyNote = dom.append(this.hierarchyBody, $('.navigator-stub-note'));
		this.hierarchyNote.style.display = 'none';
		this.hierarchyTreeContainer = dom.append(this.hierarchyBody, $('.navigator-agents-hierarchy-tree'));
		this.ensureHierarchyTree();

		this.activityBody = dom.append(container, $('.navigator-agents-subview'));
		this.activityEmpty = dom.append(this.activityBody, $('.navigator-stub-empty'));
		this.activityEmpty.setAttribute('role', 'status');
		this.activityNote = dom.append(this.activityBody, $('.navigator-stub-note'));
		this.activityNote.style.display = 'none';
		this.activityListContainer = dom.append(this.activityBody, $('.navigator-agents-activity-list'));
		this.ensureActivityList();

		this.refreshFromLease();
		this.updateSubviewVisibility();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.lastBodyHeight = height;
		this.lastBodyWidth = width;
		this.element.classList.toggle('is-narrow', width > 0 && width < 600);
		this.element.classList.toggle('is-compact', width > 0 && width < 300);
		const note = this.subview === 'hierarchy' ? this.hierarchyNote : this.activityNote;
		const noteHeight = note && note.style.display !== 'none' ? note.offsetHeight : 0;
		const contentHeight = Math.max(0, height - NavigatorAgentsInlineFilterBox.HEIGHT - noteHeight);
		if (this.subview === 'hierarchy') {
			this.hierarchyTree?.layout(contentHeight, width);
		} else {
			this.activityList?.layout(contentHeight, width);
		}
	}

	private ensureHierarchyTree(): WorkbenchObjectTree<INavigatorAgentsHierarchyNode, void> {
		if (this.hierarchyTree) {
			return this.hierarchyTree;
		}

		const delegate = new AgentsHierarchyDelegate();
		this.hierarchyRenderer = new AgentsHierarchyRenderer(
			node => this.inspectHierarchyNode(node),
			node => this.revealHierarchyNode(node),
			() => this.isAgentsRowActionLive(),
		);

		this.hierarchyTree = this._register(this.instantiationService.createInstance(
			WorkbenchObjectTree<INavigatorAgentsHierarchyNode, void>,
			'NavigatorAgentsHierarchy',
			this.hierarchyTreeContainer!,
			delegate,
			[this.hierarchyRenderer],
			{
				identityProvider: { getId: (node: INavigatorAgentsHierarchyNode) => node.id },
				horizontalScrolling: false,
				hideTwistiesOfChildlessElements: true,
				renderIndentGuides: RenderIndentGuides.None,
				accessibilityProvider: {
					getAriaLabel: (node: INavigatorAgentsHierarchyNode) => localize('navigatorAgentsHierarchy.rowAria', "{0}, {1}, {2}", node.label, node.type, formatAgentStatusLabel(node.status)),
					getWidgetAriaLabel: () => localize('navigatorAgentsHierarchy.ariaLabel', "Agents hierarchy"),
				},
			},
		));

		this._register(this.hierarchyTree.onDidOpen(e => {
			if (!e.element || !this.isAgentsRowActionLive()) {
				return;
			}
			this.inspectService.setTarget({ kind: 'agent', node: e.element.source });
			void this.instantiationService.invokeFunction(accessor => revealNavigatorAgentInConversation(accessor, e.element!.agentId, e.element!.label)).catch(onUnexpectedError).catch(onUnexpectedError);
		}));

		return this.hierarchyTree;
	}

	private ensureActivityList(): WorkbenchList<INavigatorAgentsActivityItem> {
		if (this.activityList) {
			return this.activityList;
		}

		const delegate = new AgentsActivityDelegate();
		const renderer = new AgentsActivityRenderer();

		this.activityList = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'NavigatorAgentsActivity',
			this.activityListContainer!,
			delegate,
			[renderer],
			{
				identityProvider: { getId: (item: INavigatorAgentsActivityItem) => item.id },
				accessibilityProvider: new AgentsActivityAccessibilityProvider(),
				openOnSingleClick: true,
			},
		)) as WorkbenchList<INavigatorAgentsActivityItem>;

		this._register(this.activityList.onDidOpen(e => {
			if (!e.element || !this.isAgentsRowActionLive()) {
				return;
			}
			this.inspectService.setTarget({ kind: 'activity', item: e.element });
			this.openInspectPanel();
			if (e.element.itemId.startsWith('overlay:')) {
				return;
			}
			void this.commandService.executeCommand(CONVERSATION_REVEAL_ITEM_COMMAND_ID, { itemId: e.element.itemId }).catch(onUnexpectedError).catch(onUnexpectedError);
		}));

		return this.activityList;
	}

	private refreshFromLease(): void {
		const engineConnected = this.rosterService.isEngineConnected();
		const engineReady = engineConnected && this.uaConnection.getConnectionPhase().kind === 'connected';
		const lease = this.leaseHolder.getLease();
		const snapshot = lease?.snapshot;
		const liveTree = snapshot?.liveAgentTree;
		const treeChanged = liveTree !== this.lastLiveAgentTree;
		this.lastLiveAgentTree = liveTree;

		const pairingHold = isConversationPairingHold(this.uaConnection);
		if (pairingHold && this.hasAgentsLeftoverRows()) {
			this.showPairingHoldLeftover();
			return;
		}
		if (pairingHold || !engineReady) {
			this.showDisconnectedSnapshot();
			return;
		}

		if (!this.rosterService.getActiveSessionId()) {
			this.clearAgentsInspectLiveIds();
			this.setHierarchyState([], localize('navigatorAgentsHierarchy.noSession', "No session"));
			this.setActivityState([], localize('navigatorAgentsActivity.emptyConnected', "No tool activity yet."));
			return;
		}

		const agentTreeCapability = getNavigatorCapability(this.uaConnection, 'agentTree');
		const treeFetchFailed = this.uaConnection.isAgentTreeFetchFailed();
		const transportFailed = this.uaConnection.getConnectionSnapshot().transport === 'failed';

		if (agentTreeCapability === 'UNSUPPORTED') {
			const unsupportedCopy = localize('navigatorAgentsHierarchy.unsupported', "Current engine does not provide an agent tree");
			this.clearAgentsInspectLiveIds();
			if (this.hasAgentsLeftoverRows()) {
				this.markLeftoverRowActionsClosed();
			}
			this.setHierarchyAfterPending(unsupportedCopy);
			const keepActivityLeftover = this.hadActivitySnapshot || this.activityEntries.length > 0;
			if (keepActivityLeftover) {
				this.setActivityNote(unsupportedCopy);
			} else {
				this.setActivityState([], unsupportedCopy);
			}
			return;
		}

		const pendingCopy = getNavigatorAgentTreePendingCopy(agentTreeCapability, liveTree, treeFetchFailed);
		if (pendingCopy) {
			this.clearAgentsInspectLiveIds();
			if (this.hasAgentsLeftoverRows()) {
				this.markLeftoverRowActionsClosed();
			}
			if (treeFetchFailed) {
				this.setHierarchyAfterTreeFetchFail();
			} else {
				this.setHierarchyAfterPending(pendingCopy);
			}
			const keepActivityLeftover = !treeFetchFailed
				&& agentTreeCapability === 'UNKNOWN'
				&& (this.hadActivitySnapshot || this.activityEntries.length > 0);
			if (keepActivityLeftover) {
				this.setActivityNote(pendingCopy);
			} else {
				this.setActivityFromSnapshot(snapshot, lease?.attribution, undefined, treeFetchFailed);
			}
			return;
		}

		this.inspectService.setLiveAgentIds('agents', collectLiveAgentTreeAgentIds(liveTree!));
		this.hadHierarchySnapshot = true;
		this.markLiveRowActionsOpen();

		const rootNode = liveAgentTreeToHierarchyNodes(liveTree!);
		const staleNote = transportFailed ? NAVIGATOR_STALE_SNAPSHOT_COPY : undefined;
		if (isRootOnlyAgentTree(liveTree)) {
			this.setHierarchyState([rootNode], undefined, staleNote ?? localize('navigatorAgentsHierarchy.rootOnly', "Root agent only"));
		} else {
			this.setHierarchyState([rootNode], undefined, staleNote);
		}

		this.setActivityFromSnapshot(snapshot, lease?.attribution, staleNote);

		if (!treeChanged && liveTree) {
			// still refresh activity on every frame
		}
	}

	private hasAgentsLeftoverRows(): boolean {
		return this.hadHierarchySnapshot || this.hadActivitySnapshot
			|| this.hierarchyEntries.length > 0
			|| this.activityEntries.length > 0;
	}

	private isAgentsRowActionLive(): boolean {
		return !this.leftoverRowActionsClosed && !this.isKeepLeftoverListFailWrite();
	}

	private markLeftoverRowActionsClosed(): void {
		this.leftoverRowActionsClosed = true;
		this.hierarchyRenderer?.syncRowActionChrome();
	}

	private markLiveRowActionsOpen(): void {
		this.leftoverRowActionsClosed = false;
		this.hierarchyRenderer?.syncRowActionChrome();
	}

	private showPairingHoldLeftover(): void {
		this.clearAgentsInspectLiveIds();
		this.markLeftoverRowActionsClosed();
		if (this.hadHierarchySnapshot || this.hierarchyEntries.length > 0) {
			this.setHierarchyNote(NAVIGATOR_STALE_SNAPSHOT_COPY);
		}
		if (this.hadActivitySnapshot || this.activityEntries.length > 0) {
			this.setActivityNote(NAVIGATOR_STALE_SNAPSHOT_COPY);
		}
	}

	private showDisconnectedSnapshot(): void {
		const hierarchyEmpty = this.getDisconnectedAgentsEmptyCopy('hierarchy');
		const activityEmpty = this.getDisconnectedAgentsEmptyCopy('activity');
		if (!this.hadHierarchySnapshot && !this.hadActivitySnapshot && this.activityEntries.length === 0) {
			this.clearAgentsInspectLiveIds();
			this.setHierarchyState([], hierarchyEmpty);
			this.setActivityState([], activityEmpty);
			return;
		}
		this.markLeftoverRowActionsClosed();
		if (this.hadHierarchySnapshot) {
			this.inspectService.setLiveAgentIds('agents', EMPTY_LIVE_AGENT_IDS);
			this.setHierarchyNote(NAVIGATOR_STALE_SNAPSHOT_COPY);
		} else {
			this.clearAgentsInspectLiveIds();
			this.setHierarchyState([], hierarchyEmpty);
		}
		if (this.hadActivitySnapshot || this.activityEntries.length > 0) {
			this.inspectService.setLiveActivityIds(EMPTY_LIVE_AGENT_IDS);
			this.setActivityNote(NAVIGATOR_STALE_SNAPSHOT_COPY);
		} else {
			this.setActivityState([], activityEmpty);
		}
	}

	private getDisconnectedAgentsEmptyCopy(kind: 'hierarchy' | 'activity'): string {
		if (this.uaConnection.getConnectionPhase().kind === 'connecting') {
			return localize('navigatorAgents.connecting', "Connecting to engine…");
		}
		return kind === 'hierarchy'
			? localize('navigatorAgentsHierarchy.empty', "No agents — no engine.")
			: localize('navigatorAgentsActivity.empty', "No tool activity — no engine.");
	}

	private setHierarchyAfterTreeFetchFail(): void {
		if (this.hadHierarchySnapshot) {
			this.setHierarchyNote(NAVIGATOR_AGENT_TREE_FETCH_FAILED_COPY);
			return;
		}
		this.setHierarchyState([], NAVIGATOR_AGENT_TREE_FETCH_FAILED_COPY);
	}

	private setHierarchyAfterPending(pendingCopy: string): void {
		if (this.hadHierarchySnapshot) {
			this.setHierarchyNote(pendingCopy);
			return;
		}
		this.setHierarchyState([], pendingCopy);
	}

	private setActivityFromSnapshot(
		snapshot: SessionViewSnapshot | undefined,
		attribution: ReadonlyMap<string, ItemAttribution> | undefined,
		staleNote?: string,
		fetchFailed = false,
	): void {
		const leftoverNote = staleNote ?? (fetchFailed ? NAVIGATOR_ACTIVITY_FETCH_FAILED_COPY : undefined);
		if (!snapshot || !attribution) {
			if (this.hadActivitySnapshot) {
				if (leftoverNote) {
					this.setActivityNote(leftoverNote);
				}
				return;
			}
			this.setActivityState([], leftoverNote ?? localize('navigatorAgentsActivity.emptyConnected', "No tool activity yet."));
			return;
		}
		const items = collectNavigatorActivityItems(snapshot, attribution);
		if (fetchFailed && items.length === 0) {
			if (this.hadActivitySnapshot || this.activityEntries.length > 0) {
				this.setActivityNote(leftoverNote ?? NAVIGATOR_ACTIVITY_FETCH_FAILED_COPY);
				return;
			}
			this.hadActivitySnapshot = true;
			this.setActivityState([], leftoverNote ?? NAVIGATOR_ACTIVITY_FETCH_FAILED_COPY);
			return;
		}
		this.hadActivitySnapshot = true;
		const truncated = navigatorActivityTruncated(snapshot);
		const note = leftoverNote ?? (truncated ? localize('navigatorAgentsActivity.truncated', "Showing the latest 200 items") : undefined);
		this.setActivityState(
			items,
			items.length === 0
				? localize('navigatorAgentsActivity.emptyConnected', "No tool activity yet.")
				: undefined,
			note,
		);
		this.publishLiveActivityIds(items);
	}

	private clearAgentsInspectLiveIds(): void {
		this.inspectService.setLiveAgentIds('agents', undefined);
		this.inspectService.setLiveActivityIds(undefined);
	}

	private publishLiveActivityIds(items: readonly INavigatorAgentsActivityItem[]): void {
		if (this.inspectService.getLiveAgentIdsFor('agents') === undefined) {
			this.inspectService.setLiveActivityIds(undefined);
			return;
		}
		this.inspectService.setLiveActivityIds(new Set(items.map(item => item.id)));
	}

	private setHierarchyState(
		entries: INavigatorAgentsHierarchyNode[],
		emptyMessage?: string,
		noteMessage?: string,
	): void {
		this.hierarchyEntries = entries;
		if (emptyMessage !== undefined) {
			this.hierarchyHonestEmpty = emptyMessage;
			this.hierarchyEmpty!.textContent = emptyMessage;
		}
		this.setHierarchyNote(noteMessage);
		this.applyFilterToHierarchy();
		this.updateHierarchyDisplay();
	}

	private setActivityState(
		entries: INavigatorAgentsActivityItem[],
		emptyMessage?: string,
		noteMessage?: string,
	): void {
		this.activityEntries = entries;
		if (emptyMessage !== undefined) {
			this.activityHonestEmpty = emptyMessage;
			this.activityEmpty!.textContent = emptyMessage;
		}
		this.setActivityNote(noteMessage);
		this.applyFilterToActivity();
		this.updateActivityDisplay();
	}

	private setHierarchyNote(noteMessage: string | undefined): void {
		if (!this.hierarchyNote) {
			return;
		}
		if (noteMessage) {
			this.hierarchyNote.textContent = noteMessage;
			this.hierarchyNote.style.display = 'block';
			this.hierarchyNote.classList.toggle('is-error', noteMessage === NAVIGATOR_AGENT_TREE_FETCH_FAILED_COPY);
		} else {
			this.hierarchyNote.style.display = 'none';
			this.hierarchyNote.classList.remove('is-error');
		}
		this.relayoutCurrentSubview();
	}

	private setActivityNote(noteMessage: string | undefined): void {
		if (!this.activityNote) {
			return;
		}
		if (noteMessage) {
			this.activityNote.textContent = noteMessage;
			this.activityNote.style.display = 'block';
			this.activityNote.classList.toggle('is-error', noteMessage === NAVIGATOR_ACTIVITY_FETCH_FAILED_COPY);
		} else {
			this.activityNote.style.display = 'none';
			this.activityNote.classList.remove('is-error');
		}
		this.relayoutCurrentSubview();
	}

	inspectHierarchyNode(node: INavigatorAgentsHierarchyNode): void {
		if (!this.isAgentsRowActionLive()) {
			return;
		}
		this.inspectService.setTarget({ kind: 'agent', node: node.source });
		this.openInspectPanel();
	}

	inspectActivityItem(item: INavigatorAgentsActivityItem): void {
		if (!this.isAgentsRowActionLive()) {
			return;
		}
		this.inspectService.setTarget({ kind: 'activity', item });
		this.openInspectPanel();
	}

	revealHierarchyNode(node: INavigatorAgentsHierarchyNode): void {
		if (!this.isAgentsRowActionLive()) {
			return;
		}
		void this.instantiationService.invokeFunction(accessor => revealNavigatorAgentInConversation(accessor, node.agentId, node.label)).catch(onUnexpectedError).catch(onUnexpectedError);
	}

	inspectFocusedHierarchyNode(): void {
		const node = this.hierarchyTree?.getFocus()[0];
		if (node) {
			this.inspectHierarchyNode(node);
		}
	}

	inspectFocusedTitleAction(): void {
		if (!this.isAgentsRowActionLive()) {
			return;
		}
		if (this.subview === 'hierarchy') {
			const node = this.hierarchyTree?.getFocus()[0];
			if (node) {
				this.inspectHierarchyNode(node);
				return;
			}
		} else {
			const index = this.activityList?.getFocus()[0];
			const item = typeof index === 'number' && index >= 0 ? this.activityList?.element(index) : undefined;
			if (item) {
				this.inspectActivityItem(item);
				return;
			}
		}
		this.notificationService.info(localize('navigatorAgents.inspectNoFocus', "Select an agent or activity item to inspect"));
	}

	private openInspectPanel(): void {
		void this.instantiationService.invokeFunction(accessor => accessor.get(IViewsService).openView(AGENT_INSPECT_VIEW_ID, true)).catch(onUnexpectedError).catch(onUnexpectedError);
	}

	revealFocusedHierarchyNode(): void {
		const node = this.hierarchyTree?.getFocus()[0];
		if (node) {
			this.revealHierarchyNode(node);
		}
	}

	private updateSubviewContextKeys(): void {
		this.hierarchyContextKey.set(this.subview === 'hierarchy');
		this.activityContextKey.set(this.subview === 'activity');
	}

	private applyFilter(): void {
		this.applyFilterToHierarchy();
		this.applyFilterToActivity();
		this.updateHierarchyDisplay();
		this.updateActivityDisplay();
	}

	private hasActiveFilter(): boolean {
		return this.filterQuery.trim().length > 0;
	}

	private filteredHierarchyCount(): number {
		return this.hierarchyTree?.getNode(null)?.children.length ?? 0;
	}

	private applyFilterToHierarchy(): void {
		const tree = this.hierarchyTree;
		if (!tree) {
			return;
		}

		const filtered = this.filterHierarchyNodes(this.hierarchyEntries);
		tree.setChildren(null, filtered.map(element => ({
			element,
			collapsible: (element.children?.length ?? 0) > 0,
			children: this.mapHierarchyChildren(element, filtered),
		})));
	}

	private mapHierarchyChildren(
		parent: INavigatorAgentsHierarchyNode,
		roots: INavigatorAgentsHierarchyNode[],
	): { element: INavigatorAgentsHierarchyNode; collapsible: boolean; children: ReturnType<NavigatorAgentsView['mapHierarchyChildren']> }[] {
		const match = this.findHierarchyNode(roots, parent.id) ?? parent;
		return (match.children ?? []).map(child => ({
			element: child,
			collapsible: (child.children?.length ?? 0) > 0,
			children: this.mapHierarchyChildren(child, roots),
		}));
	}

	private findHierarchyNode(nodes: readonly INavigatorAgentsHierarchyNode[], id: string): INavigatorAgentsHierarchyNode | undefined {
		for (const node of nodes) {
			if (node.id === id) {
				return node;
			}
			if (node.children) {
				const nested = this.findHierarchyNode(node.children, id);
				if (nested) {
					return nested;
				}
			}
		}
		return undefined;
	}

	private filterHierarchyNodes(nodes: readonly INavigatorAgentsHierarchyNode[]): INavigatorAgentsHierarchyNode[] {
		const result: INavigatorAgentsHierarchyNode[] = [];
		for (const node of nodes) {
			const filteredChildren = node.children ? this.filterHierarchyNodes(node.children) : undefined;
			const matchesSelf = matchesNavigatorAgentsInlineFilter(node.label, this.filterQuery);
			if (matchesSelf || (filteredChildren && filteredChildren.length > 0)) {
				result.push({
					...node,
					children: filteredChildren && filteredChildren.length > 0 ? filteredChildren : (matchesSelf ? node.children : filteredChildren),
				});
			}
		}
		return result;
	}

	private applyFilterToActivity(): void {
		const list = this.activityList;
		if (!list) {
			return;
		}

		const filtered = this.activityEntries.filter(entry => matchesNavigatorAgentsInlineFilter(entry.label, this.filterQuery));
		list.splice(0, list.length, filtered);
	}

	private updateHierarchyDisplay(): void {
		if (!this.hierarchyEmpty || !this.hierarchyTreeContainer || !this.hierarchyBody) {
			return;
		}

		const unfilteredEmpty = this.hierarchyEntries.length === 0;
		const filterMiss = !unfilteredEmpty && this.hasActiveFilter() && this.filteredHierarchyCount() === 0;
		const isEmpty = unfilteredEmpty || filterMiss;
		this.hierarchyEmpty.textContent = filterMiss ? AGENTS_FILTER_NO_MATCH : this.hierarchyHonestEmpty;
		this.hierarchyBody.classList.toggle('is-empty', isEmpty);
		this.hierarchyEmpty.style.display = isEmpty ? 'block' : 'none';
		this.hierarchyTreeContainer.style.display = isEmpty ? 'none' : 'block';
	}

	private updateActivityDisplay(): void {
		if (!this.activityEmpty || !this.activityListContainer || !this.activityBody) {
			return;
		}

		const filteredCount = this.activityList?.length ?? 0;
		const unfilteredEmpty = this.activityEntries.length === 0;
		const filterMiss = !unfilteredEmpty && this.hasActiveFilter() && filteredCount === 0;
		const isEmpty = unfilteredEmpty || filterMiss;
		this.activityEmpty.textContent = filterMiss ? AGENTS_FILTER_NO_MATCH : this.activityHonestEmpty;
		this.activityBody.classList.toggle('is-empty', isEmpty);
		this.activityEmpty.style.display = isEmpty ? 'block' : 'none';
		this.activityListContainer.style.display = isEmpty ? 'none' : 'block';
	}

	private updateSubviewVisibility(): void {
		this.hierarchyBody?.classList.toggle('active', this.subview === 'hierarchy');
		this.activityBody?.classList.toggle('active', this.subview === 'activity');
	}

	private relayoutCurrentSubview(): void {
		if (this.lastBodyWidth <= 0 && this.lastBodyHeight <= 0) {
			return;
		}
		this.layoutBody(this.lastBodyHeight, this.lastBodyWidth);
	}

	/** @internal test helper */
	setHierarchyEntries(entries: INavigatorAgentsHierarchyNode[]): void {
		this.setHierarchyState(entries);
	}

	/** @internal test helper */
	setActivityEntries(entries: INavigatorAgentsActivityItem[]): void {
		this.setActivityState(entries);
	}
}

registerAction2(class NavigatorAgentsShowHierarchyAction extends ViewAction<NavigatorAgentsView> {
	constructor() {
		super({
			id: NAVIGATOR_AGENTS_SHOW_HIERARCHY_COMMAND_ID,
			viewId: NAVIGATOR_AGENTS_VIEW_ID,
			title: localize2('navigatorAgentsView.showHierarchy', "Hierarchy"),
			icon: Codicon.listTree,
			toggled: NAVIGATOR_AGENTS_SUBVIEW_HIERARCHY_KEY,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: -2,
				when: ContextKeyExpr.equals('view', NAVIGATOR_AGENTS_VIEW_ID),
			},
		});
	}

	override runInView(_accessor: ServicesAccessor, view: NavigatorAgentsView): void {
		view.showHierarchy();
	}
});

registerAction2(class NavigatorAgentsShowActivityAction extends ViewAction<NavigatorAgentsView> {
	constructor() {
		super({
			id: NAVIGATOR_AGENTS_SHOW_ACTIVITY_COMMAND_ID,
			viewId: NAVIGATOR_AGENTS_VIEW_ID,
			title: localize2('navigatorAgentsView.showActivity', "Activity"),
			icon: Codicon.pulse,
			toggled: NAVIGATOR_AGENTS_SUBVIEW_ACTIVITY_KEY,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: -1,
				when: ContextKeyExpr.equals('view', NAVIGATOR_AGENTS_VIEW_ID),
			},
		});
	}

	override runInView(_accessor: ServicesAccessor, view: NavigatorAgentsView): void {
		view.showActivity();
	}
});

registerAction2(class NavigatorAgentsRefreshAction extends ViewAction<NavigatorAgentsView> {
	constructor() {
		super({
			id: NAVIGATOR_AGENTS_REFRESH_COMMAND_ID,
			viewId: NAVIGATOR_AGENTS_VIEW_ID,
			title: localize2('navigatorAgentsView.refresh', "Refresh"),
			icon: Codicon.refresh,
			precondition: UA_ENGINE_CONNECTED_KEY,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: 0,
				when: ContextKeyExpr.equals('view', NAVIGATOR_AGENTS_VIEW_ID),
			},
		});
	}

	override runInView(_accessor: ServicesAccessor, view: NavigatorAgentsView): void {
		view.refreshAgentTree();
	}
});

registerAction2(class NavigatorAgentsOpenInspectAction extends ViewAction<NavigatorAgentsView> {
	constructor() {
		super({
			id: OPEN_NAVIGATOR_AGENTS_INSPECT_COMMAND_ID,
			viewId: NAVIGATOR_AGENTS_VIEW_ID,
			title: localize2('navigatorAgentsView.openInspect', "Inspect"),
			icon: Codicon.inspect,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: 1,
				when: ContextKeyExpr.equals('view', NAVIGATOR_AGENTS_VIEW_ID),
			},
		});
	}

	override runInView(_accessor: ServicesAccessor, view: NavigatorAgentsView): void {
		view.inspectFocusedTitleAction();
	}
});

registerAction2(class NavigatorAgentsInspectItemAction extends ViewAction<NavigatorAgentsView> {
	constructor() {
		super({
			id: NAVIGATOR_AGENTS_INSPECT_ITEM_COMMAND_ID,
			viewId: NAVIGATOR_AGENTS_VIEW_ID,
			title: localize2('navigatorAgentsView.inspectItem', "Inspect"),
			icon: Codicon.inspect,
			menu: {
				id: MenuId.ViewItemContext,
				group: 'inline',
				order: 1,
				when: ContextKeyExpr.equals('view', NAVIGATOR_AGENTS_VIEW_ID),
			},
		});
	}

	override runInView(_accessor: ServicesAccessor, view: NavigatorAgentsView): void {
		view.inspectFocusedHierarchyNode();
	}
});

registerAction2(class NavigatorAgentsRevealAction extends Action2 {
	constructor() {
		super({
			id: NAVIGATOR_AGENTS_REVEAL_COMMAND_ID,
			title: localize2('navigatorAgentsView.reveal', "Reveal in Conversation"),
			icon: Codicon.goToFile,
			f1: false,
			menu: {
				id: MenuId.ViewItemContext,
				group: 'inline',
				order: 2,
				when: ContextKeyExpr.equals('view', NAVIGATOR_AGENTS_VIEW_ID),
			},
		});
	}

	override run(accessor: ServicesAccessor, agentId?: string, title?: string): Promise<void> {
		if (agentId) {
			return revealNavigatorAgentInConversation(accessor, agentId, title);
		}
		const view = accessor.get(IViewsService).getActiveViewWithId<NavigatorAgentsView>(NAVIGATOR_AGENTS_VIEW_ID);
		view?.revealFocusedHierarchyNode();
		return Promise.resolve();
	}
});
