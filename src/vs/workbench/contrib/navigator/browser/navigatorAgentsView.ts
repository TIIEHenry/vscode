/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../base/browser/dom.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { RenderIndentGuides } from '../../../../base/browser/ui/tree/abstractTree.js';
import { ITreeNode, ITreeRenderer } from '../../../../base/browser/ui/tree/tree.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr, IContextKey, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { WorkbenchList, WorkbenchObjectTree } from '../../../../platform/list/browser/listService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { ItemAttribution } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { SessionViewSnapshot } from '../../../../platform/universeAgent/common/sessionView/index.js';
import { IViewPaneOptions, ViewAction, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { CONVERSATION_REVEAL_ITEM_COMMAND_ID } from '../../conversation/browser/conversationRevealItem.contribution.js';
import { IConversationRosterService } from '../../conversation/browser/conversationStubService.js';
import { IAgentInspectService } from '../common/agentInspect.js';
import {
	collectNavigatorActivityItems,
	INavigatorAgentsActivityItem,
	navigatorActivityTruncated,
} from '../common/navigatorAgentsActivity.js';
import {
	formatAgentStatusLabel,
	formatAgentTypeShort,
	INavigatorAgentsHierarchyNode,
	collectLiveAgentTreeAgentIds,
	isRootOnlyAgentTree,
	liveAgentTreeToHierarchyNodes,
} from '../common/navigatorAgentHierarchy.js';
import { getNavigatorAgentTreePendingCopy } from '../common/navigatorAgentTreeEmptyState.js';
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

const AGENTS_FILTER_NO_MATCH = localize('navigatorAgents.noMatch', "无匹配");

export const NAVIGATOR_AGENTS_VIEW_ID = 'workbench.view.navigatorAgents';

export type NavigatorAgentsSubview = 'hierarchy' | 'activity';

export const NAVIGATOR_AGENTS_SHOW_HIERARCHY_COMMAND_ID = 'workbench.action.navigatorAgents.showHierarchy';
export const NAVIGATOR_AGENTS_SHOW_ACTIVITY_COMMAND_ID = 'workbench.action.navigatorAgents.showActivity';
export const NAVIGATOR_AGENTS_REFRESH_COMMAND_ID = 'workbench.action.navigatorAgents.refresh';

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
}

class AgentsHierarchyRenderer implements ITreeRenderer<INavigatorAgentsHierarchyNode, void, IAgentsHierarchyTemplateData> {
	static readonly TEMPLATE_ID = 'navigatorAgentsHierarchy';
	readonly templateId = AgentsHierarchyRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IAgentsHierarchyTemplateData {
		const row = dom.append(container, $('.navigator-agents-hierarchy-row'));
		const typeIcon = dom.append(row, $('.navigator-agents-type-icon'));
		const statusGlyph = dom.append(row, $('.navigator-agents-status-glyph'));
		const label = dom.append(row, $('.navigator-agents-hierarchy-label'));
		return { label, typeIcon, statusGlyph };
	}

	renderElement(node: ITreeNode<INavigatorAgentsHierarchyNode, void>, _index: number, templateData: IAgentsHierarchyTemplateData): void {
		const element = node.element;
		templateData.label.textContent = element.label;
		templateData.typeIcon.textContent = formatAgentTypeShort(element.type).slice(0, 1);
		templateData.typeIcon.title = element.type;
		templateData.statusGlyph.textContent = '●';
		templateData.statusGlyph.title = formatAgentStatusLabel(element.status);
		templateData.statusGlyph.setAttribute('aria-label', formatAgentStatusLabel(element.status));
	}

	disposeTemplate(): void {
		// noop
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
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this.hierarchyContextKey = NAVIGATOR_AGENTS_SUBVIEW_HIERARCHY_KEY.bindTo(this.scopedContextKeyService);
		this.activityContextKey = NAVIGATOR_AGENTS_SUBVIEW_ACTIVITY_KEY.bindTo(this.scopedContextKeyService);
		this.engineConnectedContextKey = UA_ENGINE_CONNECTED_KEY.bindTo(this.scopedContextKeyService);
		this.leaseHolder = this._register(new NavigatorSessionLeaseHolder(this.rosterService, () => this.refreshFromLease()));
		this._register(this.rosterService.onDidChangeEngineConnection(() => {
			this.updateEngineConnectedContextKey();
			this.refreshFromLease();
		}));
		this._register(this.rosterService.onDidChangeActiveSession(() => this.refreshFromLease()));
		this.updateSubviewContextKeys();
		this.updateEngineConnectedContextKey();
	}

	override setVisible(visible: boolean): void {
		super.setVisible(visible);
		this.leaseHolder.setVisible(visible);
		if (!visible) {
			this.inspectService.setLiveAgentIds('agents', undefined);
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
	}

	showActivity(): void {
		if (this.subview === 'activity') {
			return;
		}
		this.subview = 'activity';
		this.updateSubviewContextKeys();
		this.updateSubviewVisibility();
	}

	refreshAgentTree(): void {
		const sessionId = this.rosterService.getActiveSessionId();
		if (this.rosterService.isEngineConnected() && sessionId) {
			this.uaConnection.requestAgentTreeRefresh(sessionId);
		}
		this.refreshFromLease();
	}

	private updateEngineConnectedContextKey(): void {
		this.engineConnectedContextKey.set(this.rosterService.isEngineConnected());
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
		this.hierarchyNote = dom.append(this.hierarchyBody, $('.navigator-stub-note'));
		this.hierarchyNote.style.display = 'none';
		this.hierarchyTreeContainer = dom.append(this.hierarchyBody, $('.navigator-agents-hierarchy-tree'));
		this.ensureHierarchyTree();

		this.activityBody = dom.append(container, $('.navigator-agents-subview'));
		this.activityEmpty = dom.append(this.activityBody, $('.navigator-stub-empty'));
		this.activityNote = dom.append(this.activityBody, $('.navigator-stub-note'));
		this.activityNote.style.display = 'none';
		this.activityListContainer = dom.append(this.activityBody, $('.navigator-agents-activity-list'));
		this.ensureActivityList();

		this.refreshFromLease();
		this.updateSubviewVisibility();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		const contentHeight = height - NavigatorAgentsInlineFilterBox.HEIGHT;
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
		const renderer = new AgentsHierarchyRenderer();

		this.hierarchyTree = this._register(this.instantiationService.createInstance(
			WorkbenchObjectTree<INavigatorAgentsHierarchyNode, void>,
			'NavigatorAgentsHierarchy',
			this.hierarchyTreeContainer!,
			delegate,
			[renderer],
			{
				identityProvider: { getId: (node: INavigatorAgentsHierarchyNode) => node.id },
				horizontalScrolling: false,
				hideTwistiesOfChildlessElements: true,
				renderIndentGuides: RenderIndentGuides.None,
				accessibilityProvider: {
					getAriaLabel: (node: INavigatorAgentsHierarchyNode) => node.label,
					getWidgetAriaLabel: () => localize('navigatorAgentsHierarchy.ariaLabel', "Agents hierarchy"),
				},
			},
		));

		this._register(this.hierarchyTree.onDidOpen(e => {
			if (e.element) {
				this.inspectService.setTarget({ kind: 'agent', node: e.element.source });
				void this.instantiationService.invokeFunction(accessor => revealNavigatorAgentInConversation(accessor, e.element!.agentId, e.element!.label));
			}
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
			if (!e.element) {
				return;
			}
			this.inspectService.setTarget({ kind: 'activity', item: e.element });
			void this.commandService.executeCommand(CONVERSATION_REVEAL_ITEM_COMMAND_ID, { itemId: e.element.itemId });
		}));

		return this.activityList;
	}

	private refreshFromLease(): void {
		const engineConnected = this.rosterService.isEngineConnected();
		const lease = this.leaseHolder.getLease();
		const snapshot = lease?.snapshot;
		const liveTree = snapshot?.liveAgentTree;
		const treeChanged = liveTree !== this.lastLiveAgentTree;
		this.lastLiveAgentTree = liveTree;

		if (!engineConnected) {
			this.inspectService.setLiveAgentIds('agents', undefined);
			this.setHierarchyState([], localize('navigatorAgentsHierarchy.empty', "No agents — no engine."));
			this.setActivityState([], localize('navigatorAgentsActivity.empty', "No tool activity — no engine."));
			return;
		}

		if (!this.rosterService.getActiveSessionId()) {
			this.inspectService.setLiveAgentIds('agents', undefined);
			this.setHierarchyState([], localize('navigatorAgentsHierarchy.noSession', "当前没有会话"));
			this.setActivityState([], localize('navigatorAgentsActivity.emptyConnected', "No tool activity yet."));
			return;
		}

		const agentTreeCapability = getNavigatorCapability(this.uaConnection, 'agentTree');
		const transportFailed = this.uaConnection.getConnectionSnapshot().transport === 'failed';

		if (agentTreeCapability === 'UNSUPPORTED') {
			this.inspectService.setLiveAgentIds('agents', undefined);
			this.setHierarchyState([], localize('navigatorAgentsHierarchy.unsupported', "当前引擎不提供 Agent 树"));
			this.setActivityFromSnapshot(snapshot, lease?.attribution);
			return;
		}

		if (transportFailed && !liveTree) {
			this.inspectService.setLiveAgentIds('agents', undefined);
			this.setHierarchyState([], localize('navigatorAgentsHierarchy.transportFailed', "连接失败"));
			this.setActivityFromSnapshot(snapshot, lease?.attribution);
			return;
		}

		const pendingCopy = getNavigatorAgentTreePendingCopy(agentTreeCapability, liveTree);
		if (pendingCopy) {
			this.inspectService.setLiveAgentIds('agents', undefined);
			this.setHierarchyState([], pendingCopy);
			this.setActivityFromSnapshot(snapshot, lease?.attribution);
			return;
		}

		this.inspectService.setLiveAgentIds('agents', collectLiveAgentTreeAgentIds(liveTree!));

		if (transportFailed) {
			this.setHierarchyNote(localize('navigatorAgentsHierarchy.staleSnapshot', "显示为断开前快照"));
		} else {
			this.setHierarchyNote(undefined);
		}

		const rootNode = liveAgentTreeToHierarchyNodes(liveTree!);
		if (isRootOnlyAgentTree(liveTree)) {
			this.setHierarchyState([rootNode], undefined, localize('navigatorAgentsHierarchy.rootOnly', "只有根 Agent"));
		} else {
			this.setHierarchyState([rootNode], undefined);
		}

		this.setActivityFromSnapshot(snapshot, lease?.attribution);

		if (!treeChanged && liveTree) {
			// still refresh activity on every frame
		}
	}

	private setActivityFromSnapshot(
		snapshot: SessionViewSnapshot | undefined,
		attribution: ReadonlyMap<string, ItemAttribution> | undefined,
	): void {
		if (!this.rosterService.isEngineConnected() || !snapshot || !attribution) {
			this.setActivityState([], localize('navigatorAgentsActivity.empty', "No tool activity — no engine."));
			return;
		}
		const items = collectNavigatorActivityItems(snapshot, attribution);
		const truncated = navigatorActivityTruncated(snapshot);
		const note = truncated ? localize('navigatorAgentsActivity.truncated', "仅显示最近 200 条") : undefined;
		this.setActivityState(items, items.length === 0 ? localize('navigatorAgentsActivity.emptyConnected', "No tool activity yet.") : undefined, note);
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
		if (noteMessage) {
			this.activityNote!.textContent = noteMessage;
			this.activityNote!.style.display = 'block';
		} else {
			this.activityNote!.style.display = 'none';
		}
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
		} else {
			this.hierarchyNote.style.display = 'none';
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

	override runInView(accessor: ServicesAccessor): void {
		void accessor.get(IViewsService).openView(AGENT_INSPECT_VIEW_ID, true);
	}
});

registerAction2(class NavigatorAgentsRevealAction extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.navigatorAgents.revealInConversation',
			title: localize2('navigatorAgentsView.reveal', "Reveal in Conversation"),
			f1: false,
		});
	}

	override run(accessor: ServicesAccessor, agentId?: string, title?: string): Promise<void> {
		if (!agentId) {
			return Promise.resolve();
		}
		return revealNavigatorAgentInConversation(accessor, agentId, title);
	}
});
