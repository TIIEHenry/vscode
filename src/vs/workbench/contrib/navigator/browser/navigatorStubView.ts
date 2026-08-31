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
import { MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr, IContextKey, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { WorkbenchList, WorkbenchObjectTree } from '../../../../platform/list/browser/listService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewPaneOptions, ViewAction, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { matchesNavigatorAgentsInlineFilter } from '../common/navigatorAgentsInlineFilter.js';
import {
	AGENT_INSPECT_VIEW_ID,
	OPEN_NAVIGATOR_AGENTS_INSPECT_COMMAND_ID,
} from './agentInspectIds.js';
import { NavigatorAgentsInlineFilterBox } from './navigatorAgentsInlineFilterBox.js';

const $ = dom.$;

export const NAVIGATOR_PROJECTS_VIEW_ID = 'workbench.view.navigatorProjects';
export const NAVIGATOR_AGENTS_VIEW_ID = 'workbench.view.navigatorAgents';
export const NAVIGATOR_TEAM_VIEW_ID = 'workbench.view.navigatorTeam';

export const NAVIGATOR_STUB_VIEW_IDS = [
	NAVIGATOR_PROJECTS_VIEW_ID,
	NAVIGATOR_AGENTS_VIEW_ID,
	NAVIGATOR_TEAM_VIEW_ID,
] as const;

export type NavigatorStubViewId = typeof NAVIGATOR_STUB_VIEW_IDS[number];

export type NavigatorAgentsSubview = 'hierarchy' | 'activity';

export const NAVIGATOR_AGENTS_SHOW_HIERARCHY_COMMAND_ID = 'workbench.action.navigatorAgents.showHierarchy';
export const NAVIGATOR_AGENTS_SHOW_ACTIVITY_COMMAND_ID = 'workbench.action.navigatorAgents.showActivity';

export const NAVIGATOR_AGENTS_SUBVIEW_HIERARCHY_KEY = new RawContextKey<boolean>('navigatorAgentsSubview.hierarchy', true);
export const NAVIGATOR_AGENTS_SUBVIEW_ACTIVITY_KEY = new RawContextKey<boolean>('navigatorAgentsSubview.activity', false);

interface INavigatorAgentsHierarchyNode {
	readonly id: string;
	readonly label: string;
}

interface INavigatorAgentsActivityItem {
	readonly id: string;
	readonly label: string;
}

abstract class NavigatorStubView extends ViewPane {

	protected abstract getProductLabel(): string;

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
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		const empty = dom.append(container, $('.navigator-stub-empty'));
		empty.textContent = localize('navigatorStub.notConnected', "{0} is not connected — no engine.", this.getProductLabel());
	}
}

export class NavigatorProjectsView extends NavigatorStubView {

	static readonly ID = NAVIGATOR_PROJECTS_VIEW_ID;

	protected override getProductLabel(): string {
		return localize('navigatorProjects', "Projects");
	}
}

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
}

class AgentsHierarchyRenderer implements ITreeRenderer<INavigatorAgentsHierarchyNode, void, IAgentsHierarchyTemplateData> {
	static readonly TEMPLATE_ID = 'navigatorAgentsHierarchy';

	readonly templateId = AgentsHierarchyRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): IAgentsHierarchyTemplateData {
		return { label: dom.append(container, $('.navigator-agents-hierarchy-label')) };
	}

	renderElement(node: ITreeNode<INavigatorAgentsHierarchyNode, void>, _index: number, templateData: IAgentsHierarchyTemplateData): void {
		templateData.label.textContent = node.element.label;
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

	private filterBox: NavigatorAgentsInlineFilterBox | undefined;
	private filterQuery = '';

	private hierarchyBody: HTMLElement | undefined;
	private hierarchyEmpty: HTMLElement | undefined;
	private hierarchyTreeContainer: HTMLElement | undefined;
	private hierarchyTree: WorkbenchObjectTree<INavigatorAgentsHierarchyNode, void> | undefined;
	private hierarchyEntries: INavigatorAgentsHierarchyNode[] = [];

	private activityBody: HTMLElement | undefined;
	private activityEmpty: HTMLElement | undefined;
	private activityListContainer: HTMLElement | undefined;
	private activityList: WorkbenchList<INavigatorAgentsActivityItem> | undefined;
	private activityEntries: INavigatorAgentsActivityItem[] = [];

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
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this.hierarchyContextKey = NAVIGATOR_AGENTS_SUBVIEW_HIERARCHY_KEY.bindTo(this.scopedContextKeyService);
		this.activityContextKey = NAVIGATOR_AGENTS_SUBVIEW_ACTIVITY_KEY.bindTo(this.scopedContextKeyService);
		this.updateSubviewContextKeys();
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
		this.hierarchyEmpty.textContent = localize('navigatorAgentsHierarchy.empty', "No agents — no engine.");
		this.hierarchyTreeContainer = dom.append(this.hierarchyBody, $('.navigator-agents-hierarchy-tree'));
		this.ensureHierarchyTree();

		this.activityBody = dom.append(container, $('.navigator-agents-subview'));
		this.activityEmpty = dom.append(this.activityBody, $('.navigator-stub-empty'));
		this.activityEmpty.textContent = localize('navigatorAgentsActivity.empty', "No tool activity — no engine.");
		this.activityListContainer = dom.append(this.activityBody, $('.navigator-agents-activity-list'));
		this.ensureActivityList();

		this.setHierarchyEntries([]);
		this.setActivityEntries([]);
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
			},
		)) as WorkbenchList<INavigatorAgentsActivityItem>;

		return this.activityList;
	}

	private updateSubviewContextKeys(): void {
		this.hierarchyContextKey.set(this.subview === 'hierarchy');
		this.activityContextKey.set(this.subview === 'activity');
	}

	private setHierarchyEntries(entries: INavigatorAgentsHierarchyNode[]): void {
		this.hierarchyEntries = entries;
		this.applyFilterToHierarchy();
		this.updateHierarchyDisplay();
	}

	private setActivityEntries(entries: INavigatorAgentsActivityItem[]): void {
		this.activityEntries = entries;
		this.applyFilterToActivity();
		this.updateActivityDisplay();
	}

	private applyFilter(): void {
		this.applyFilterToHierarchy();
		this.applyFilterToActivity();
	}

	private applyFilterToHierarchy(): void {
		const tree = this.hierarchyTree;
		if (!tree) {
			return;
		}

		const filtered = this.hierarchyEntries.filter(entry => matchesNavigatorAgentsInlineFilter(entry.label, this.filterQuery));
		tree.setChildren(null, filtered.map(element => ({ element })));
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
		if (!this.hierarchyEmpty || !this.hierarchyTreeContainer) {
			return;
		}

		const isEmpty = this.hierarchyEntries.length === 0;
		this.hierarchyEmpty.style.display = isEmpty ? 'block' : 'none';
		this.hierarchyTreeContainer.style.display = isEmpty ? 'none' : 'block';
	}

	private updateActivityDisplay(): void {
		if (!this.activityEmpty || !this.activityListContainer) {
			return;
		}

		const isEmpty = this.activityEntries.length === 0;
		this.activityEmpty.style.display = isEmpty ? 'block' : 'none';
		this.activityListContainer.style.display = isEmpty ? 'none' : 'block';
	}

	private updateSubviewVisibility(): void {
		this.hierarchyBody?.classList.toggle('active', this.subview === 'hierarchy');
		this.activityBody?.classList.toggle('active', this.subview === 'activity');
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

