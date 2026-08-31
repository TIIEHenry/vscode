/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/navigatorTeamList.css';
import * as dom from '../../../../base/browser/dom.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
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
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewPaneOptions, ViewAction, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { matchesNavigatorTeamInlineFilter } from '../common/navigatorTeamInlineFilter.js';
import {
	AGENT_INSPECT_VIEW_ID,
	OPEN_NAVIGATOR_TEAM_INSPECT_COMMAND_ID,
} from './agentInspectIds.js';
import { NavigatorTeamInlineFilterBox } from './navigatorTeamInlineFilterBox.js';
import { NAVIGATOR_TEAM_VIEW_ID } from './navigatorStubView.js';

const $ = dom.$;

export type NavigatorTeamSubview = 'members' | 'tasks';

export const NAVIGATOR_TEAM_SHOW_MEMBERS_COMMAND_ID = 'workbench.action.navigatorTeam.showMembers';
export const NAVIGATOR_TEAM_SHOW_TASKS_COMMAND_ID = 'workbench.action.navigatorTeam.showTasks';

export const NAVIGATOR_TEAM_SUBVIEW_MEMBERS_KEY = new RawContextKey<boolean>('navigatorTeamSubview.members', true);
export const NAVIGATOR_TEAM_SUBVIEW_TASKS_KEY = new RawContextKey<boolean>('navigatorTeamSubview.tasks', false);

export interface INavigatorTeamMember {
	readonly id: string;
	readonly label: string;
}

interface INavigatorTeamTask {
	readonly id: string;
	readonly label: string;
}

class TeamMemberDelegate implements IListVirtualDelegate<INavigatorTeamMember> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return 'navigatorTeamMember';
	}
}

interface ITeamMemberTemplateData {
	readonly label: HTMLElement;
}

class TeamMemberRenderer implements IListRenderer<INavigatorTeamMember, ITeamMemberTemplateData> {
	static readonly TEMPLATE_ID = 'navigatorTeamMember';

	readonly templateId = TeamMemberRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): ITeamMemberTemplateData {
		return { label: dom.append(container, $('.navigator-team-member-label')) };
	}

	renderElement(member: INavigatorTeamMember, _index: number, templateData: ITeamMemberTemplateData): void {
		templateData.label.textContent = member.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

class TeamMemberAccessibilityProvider implements IListAccessibilityProvider<INavigatorTeamMember> {
	getWidgetAriaLabel(): string {
		return localize('navigatorTeamMembers.ariaLabel', "Team members");
	}

	getAriaLabel(member: INavigatorTeamMember): string {
		return member.label;
	}
}

class TeamTaskDelegate implements IListVirtualDelegate<INavigatorTeamTask> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return 'navigatorTeamTask';
	}
}

interface ITeamTaskTemplateData {
	readonly label: HTMLElement;
}

class TeamTaskRenderer implements IListRenderer<INavigatorTeamTask, ITeamTaskTemplateData> {
	static readonly TEMPLATE_ID = 'navigatorTeamTask';

	readonly templateId = TeamTaskRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): ITeamTaskTemplateData {
		return { label: dom.append(container, $('.navigator-team-task-label')) };
	}

	renderElement(task: INavigatorTeamTask, _index: number, templateData: ITeamTaskTemplateData): void {
		templateData.label.textContent = task.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

class TeamTaskAccessibilityProvider implements IListAccessibilityProvider<INavigatorTeamTask> {
	getWidgetAriaLabel(): string {
		return localize('navigatorTeamTasks.ariaLabel', "Team tasks");
	}

	getAriaLabel(task: INavigatorTeamTask): string {
		return task.label;
	}
}

export class NavigatorTeamView extends ViewPane {

	static readonly ID = NAVIGATOR_TEAM_VIEW_ID;

	private subview: NavigatorTeamSubview = 'members';
	private readonly membersContextKey: IContextKey<boolean>;
	private readonly tasksContextKey: IContextKey<boolean>;

	private filterBox: NavigatorTeamInlineFilterBox | undefined;
	private filterQuery = '';

	private membersBody: HTMLElement | undefined;
	private membersEmpty: HTMLElement | undefined;
	private membersListContainer: HTMLElement | undefined;
	private membersList: WorkbenchList<INavigatorTeamMember> | undefined;
	private memberEntries: INavigatorTeamMember[] = [];

	private tasksBody: HTMLElement | undefined;
	private tasksEmpty: HTMLElement | undefined;
	private tasksListContainer: HTMLElement | undefined;
	private tasksList: WorkbenchList<INavigatorTeamTask> | undefined;
	private taskEntries: INavigatorTeamTask[] = [];

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

		this.membersContextKey = NAVIGATOR_TEAM_SUBVIEW_MEMBERS_KEY.bindTo(this.scopedContextKeyService);
		this.tasksContextKey = NAVIGATOR_TEAM_SUBVIEW_TASKS_KEY.bindTo(this.scopedContextKeyService);
		this.updateSubviewContextKeys();
	}

	getActiveSubview(): NavigatorTeamSubview {
		return this.subview;
	}

	showMembers(): void {
		if (this.subview === 'members') {
			return;
		}
		this.subview = 'members';
		this.updateSubviewContextKeys();
		this.updateSubviewVisibility();
		this._onDidChangeViewWelcomeState.fire();
	}

	showTasks(): void {
		if (this.subview === 'tasks') {
			return;
		}
		this.subview = 'tasks';
		this.updateSubviewContextKeys();
		this.updateSubviewVisibility();
		this._onDidChangeViewWelcomeState.fire();
	}

	override shouldShowWelcome(): boolean {
		return false;
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		container.classList.add('navigator-team-view');

		const filterPlaceholder = localize('navigatorTeamFilterPlaceholder', "Filter team");
		this.filterBox = this._register(new NavigatorTeamInlineFilterBox(
			container,
			filterPlaceholder,
			filterPlaceholder,
		));
		this._register(this.filterBox.onDidChange(query => {
			this.filterQuery = query;
			this.applyFilter();
		}));

		this.membersBody = dom.append(container, $('.navigator-team-subview'));
		this.membersEmpty = dom.append(this.membersBody, $('.navigator-stub-empty'));
		this.membersEmpty.textContent = localize('navigatorTeamMembers.empty', "No team members yet");
		this.membersListContainer = dom.append(this.membersBody, $('.navigator-team-list'));
		this.ensureMembersList();
		this.setMemberEntries([]);

		this.tasksBody = dom.append(container, $('.navigator-team-subview'));
		this.tasksEmpty = dom.append(this.tasksBody, $('.navigator-stub-empty'));
		this.tasksEmpty.textContent = localize('navigatorTeamTasks.empty', "No tasks yet");
		this.tasksListContainer = dom.append(this.tasksBody, $('.navigator-team-tasks-list'));
		this.ensureTasksList();
		this.setTaskEntries([]);

		this.updateSubviewVisibility();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		const contentHeight = height - NavigatorTeamInlineFilterBox.HEIGHT;
		if (this.subview === 'members') {
			this.membersList?.layout(contentHeight, width);
		} else {
			this.tasksList?.layout(contentHeight, width);
		}
	}

	private ensureMembersList(): WorkbenchList<INavigatorTeamMember> {
		if (this.membersList) {
			return this.membersList;
		}

		const delegate = new TeamMemberDelegate();
		const renderer = new TeamMemberRenderer();

		this.membersList = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'NavigatorTeamMembers',
			this.membersListContainer!,
			delegate,
			[renderer],
			{
				identityProvider: { getId: (member: INavigatorTeamMember) => member.id },
				accessibilityProvider: new TeamMemberAccessibilityProvider(),
			}
		)) as WorkbenchList<INavigatorTeamMember>;

		return this.membersList;
	}

	private ensureTasksList(): WorkbenchList<INavigatorTeamTask> {
		if (this.tasksList) {
			return this.tasksList;
		}

		const delegate = new TeamTaskDelegate();
		const renderer = new TeamTaskRenderer();

		this.tasksList = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'NavigatorTeamTasks',
			this.tasksListContainer!,
			delegate,
			[renderer],
			{
				identityProvider: { getId: (task: INavigatorTeamTask) => task.id },
				accessibilityProvider: new TeamTaskAccessibilityProvider(),
			}
		)) as WorkbenchList<INavigatorTeamTask>;

		return this.tasksList;
	}

	private setMemberEntries(entries: INavigatorTeamMember[]): void {
		this.memberEntries = entries;
		this.applyFilterToMembers();
		this.updateMembersDisplay();
	}

	private setTaskEntries(entries: INavigatorTeamTask[]): void {
		this.taskEntries = entries;
		this.applyFilterToTasks();
		this.updateTasksDisplay();
	}

	private applyFilter(): void {
		this.applyFilterToMembers();
		this.applyFilterToTasks();
	}

	private applyFilterToMembers(): void {
		const list = this.membersList;
		if (!list) {
			return;
		}

		const filtered = this.memberEntries.filter(entry => matchesNavigatorTeamInlineFilter(entry.label, this.filterQuery));
		list.splice(0, list.length, filtered);
	}

	private applyFilterToTasks(): void {
		const list = this.tasksList;
		if (!list) {
			return;
		}

		const filtered = this.taskEntries.filter(entry => matchesNavigatorTeamInlineFilter(entry.label, this.filterQuery));
		list.splice(0, list.length, filtered);
	}

	private updateMembersDisplay(): void {
		if (!this.membersEmpty || !this.membersListContainer) {
			return;
		}

		const isEmpty = this.memberEntries.length === 0;
		this.membersEmpty.style.display = isEmpty ? 'block' : 'none';
		this.membersListContainer.style.display = isEmpty ? 'none' : 'block';
	}

	private updateTasksDisplay(): void {
		if (!this.tasksEmpty || !this.tasksListContainer) {
			return;
		}

		const isEmpty = this.taskEntries.length === 0;
		this.tasksEmpty.style.display = isEmpty ? 'block' : 'none';
		this.tasksListContainer.style.display = isEmpty ? 'none' : 'block';
	}

	private updateSubviewContextKeys(): void {
		this.membersContextKey.set(this.subview === 'members');
		this.tasksContextKey.set(this.subview === 'tasks');
	}

	private updateSubviewVisibility(): void {
		this.membersBody?.classList.toggle('active', this.subview === 'members');
		this.tasksBody?.classList.toggle('active', this.subview === 'tasks');
	}
}

registerAction2(class NavigatorTeamShowMembersAction extends ViewAction<NavigatorTeamView> {
	constructor() {
		super({
			id: NAVIGATOR_TEAM_SHOW_MEMBERS_COMMAND_ID,
			viewId: NAVIGATOR_TEAM_VIEW_ID,
			title: localize2('navigatorTeamView.showMembers', "Members"),
			icon: Codicon.person,
			toggled: NAVIGATOR_TEAM_SUBVIEW_MEMBERS_KEY,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: -2,
				when: ContextKeyExpr.equals('view', NAVIGATOR_TEAM_VIEW_ID),
			},
		});
	}

	override runInView(_accessor: ServicesAccessor, view: NavigatorTeamView): void {
		view.showMembers();
	}
});

registerAction2(class NavigatorTeamShowTasksAction extends ViewAction<NavigatorTeamView> {
	constructor() {
		super({
			id: NAVIGATOR_TEAM_SHOW_TASKS_COMMAND_ID,
			viewId: NAVIGATOR_TEAM_VIEW_ID,
			title: localize2('navigatorTeamView.showTasks', "Tasks"),
			icon: Codicon.tasklist,
			toggled: NAVIGATOR_TEAM_SUBVIEW_TASKS_KEY,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: -1,
				when: ContextKeyExpr.equals('view', NAVIGATOR_TEAM_VIEW_ID),
			},
		});
	}

	override runInView(_accessor: ServicesAccessor, view: NavigatorTeamView): void {
		view.showTasks();
	}
});

registerAction2(class NavigatorTeamOpenInspectAction extends ViewAction<NavigatorTeamView> {
	constructor() {
		super({
			id: OPEN_NAVIGATOR_TEAM_INSPECT_COMMAND_ID,
			viewId: NAVIGATOR_TEAM_VIEW_ID,
			title: localize2('navigatorTeamView.openInspect', "Inspect"),
			icon: Codicon.inspect,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: 1,
				when: ContextKeyExpr.equals('view', NAVIGATOR_TEAM_VIEW_ID),
			},
		});
	}

	override runInView(accessor: ServicesAccessor): void {
		void accessor.get(IViewsService).openView(AGENT_INSPECT_VIEW_ID, true);
	}
});
