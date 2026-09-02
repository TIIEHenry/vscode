/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/navigatorTeamList.css';
import * as dom from '../../../../base/browser/dom.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { RunOnceScheduler } from '../../../../base/common/async.js';
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
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IViewPaneOptions, ViewAction, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IConversationRosterService } from '../../conversation/browser/conversationStubService.js';
import { IAgentInspectService } from '../common/agentInspect.js';
import { getNavigatorCapability } from '../common/navigatorEngineBridge.js';
import { matchesNavigatorTeamInlineFilter } from '../common/navigatorTeamInlineFilter.js';
import {
	findManagerNodes,
	INavigatorTeamMemberEntry,
	INavigatorTeamTaskEntry,
} from '../common/navigatorTeamData.js';
import {
	AGENT_INSPECT_VIEW_ID,
	OPEN_NAVIGATOR_TEAM_INSPECT_COMMAND_ID,
} from './agentInspectIds.js';
import { NavigatorTeamInlineFilterBox } from './navigatorTeamInlineFilterBox.js';
import { NavigatorSessionLeaseHolder } from './navigatorSessionLeaseHolder.js';
import { revealNavigatorAgentInConversation } from './navigatorReveal.js';
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

class TeamMemberDelegate implements IListVirtualDelegate<INavigatorTeamMemberEntry> {
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

class TeamMemberRenderer implements IListRenderer<INavigatorTeamMemberEntry, ITeamMemberTemplateData> {
	static readonly TEMPLATE_ID = 'navigatorTeamMember';
	readonly templateId = TeamMemberRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): ITeamMemberTemplateData {
		return { label: dom.append(container, $('.navigator-team-member-label')) };
	}

	renderElement(member: INavigatorTeamMemberEntry, _index: number, templateData: ITeamMemberTemplateData): void {
		templateData.label.textContent = member.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

class TeamMemberAccessibilityProvider implements IListAccessibilityProvider<INavigatorTeamMemberEntry> {
	getWidgetAriaLabel(): string {
		return localize('navigatorTeamMembers.ariaLabel', "Team members");
	}

	getAriaLabel(member: INavigatorTeamMemberEntry): string {
		return member.label;
	}
}

class TeamTaskDelegate implements IListVirtualDelegate<INavigatorTeamTaskEntry> {
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

class TeamTaskRenderer implements IListRenderer<INavigatorTeamTaskEntry, ITeamTaskTemplateData> {
	static readonly TEMPLATE_ID = 'navigatorTeamTask';
	readonly templateId = TeamTaskRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): ITeamTaskTemplateData {
		return { label: dom.append(container, $('.navigator-team-task-label')) };
	}

	renderElement(task: INavigatorTeamTaskEntry, _index: number, templateData: ITeamTaskTemplateData): void {
		templateData.label.textContent = task.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

class TeamTaskAccessibilityProvider implements IListAccessibilityProvider<INavigatorTeamTaskEntry> {
	getWidgetAriaLabel(): string {
		return localize('navigatorTeamTasks.ariaLabel', "Team tasks");
	}

	getAriaLabel(task: INavigatorTeamTaskEntry): string {
		return task.label;
	}
}

export class NavigatorTeamView extends ViewPane {

	static readonly ID = NAVIGATOR_TEAM_VIEW_ID;

	private subview: NavigatorTeamSubview = 'members';
	private readonly membersContextKey: IContextKey<boolean>;
	private readonly tasksContextKey: IContextKey<boolean>;
	private readonly leaseHolder: NavigatorSessionLeaseHolder;
	private readonly refreshScheduler: RunOnceScheduler;

	private filterBox: NavigatorTeamInlineFilterBox | undefined;
	private filterQuery = '';

	private membersBody: HTMLElement | undefined;
	private membersEmpty: HTMLElement | undefined;
	private membersListContainer: HTMLElement | undefined;
	private membersList: WorkbenchList<INavigatorTeamMemberEntry> | undefined;
	private memberEntries: INavigatorTeamMemberEntry[] = [];

	private tasksBody: HTMLElement | undefined;
	private tasksEmpty: HTMLElement | undefined;
	private tasksListContainer: HTMLElement | undefined;
	private tasksList: WorkbenchList<INavigatorTeamTaskEntry> | undefined;
	private taskEntries: INavigatorTeamTaskEntry[] = [];

	private teamInfoCallCount = 0;

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
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this.membersContextKey = NAVIGATOR_TEAM_SUBVIEW_MEMBERS_KEY.bindTo(this.scopedContextKeyService);
		this.tasksContextKey = NAVIGATOR_TEAM_SUBVIEW_TASKS_KEY.bindTo(this.scopedContextKeyService);
		this.leaseHolder = this._register(new NavigatorSessionLeaseHolder(this.rosterService, () => this.scheduleRefresh()));
		this.refreshScheduler = this._register(new RunOnceScheduler(() => void this.refreshTeamData(), 250));
		this._register(this.rosterService.onDidChangeActiveSession(() => this.scheduleRefresh()));
		this._register(this.rosterService.onDidChangeEngineConnection(() => this.scheduleRefresh()));

		this._register(this.uaConnection.onDidChangeTeamRuntime(e => {
			if (e.sessionId === this.rosterService.getActiveSessionId()) {
				this.scheduleRefresh();
			}
		}));

		this.updateSubviewContextKeys();
	}

	override setVisible(visible: boolean): void {
		super.setVisible(visible);
		this.leaseHolder.setVisible(visible);
	}

	getActiveSubview(): NavigatorTeamSubview {
		return this.subview;
	}

	getTeamInfoCallCountForTest(): number {
		return this.teamInfoCallCount;
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

		this.tasksBody = dom.append(container, $('.navigator-team-subview'));
		this.tasksEmpty = dom.append(this.tasksBody, $('.navigator-stub-empty'));
		this.tasksEmpty.textContent = localize('navigatorTeamTasks.empty', "No tasks yet");
		this.tasksListContainer = dom.append(this.tasksBody, $('.navigator-team-tasks-list'));
		this.ensureTasksList();

		this.updateSubviewVisibility();
		this.scheduleRefresh();
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

	private scheduleRefresh(): void {
		this.refreshScheduler.schedule();
	}

	private ensureMembersList(): WorkbenchList<INavigatorTeamMemberEntry> {
		if (this.membersList) {
			return this.membersList;
		}

		this.membersList = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'NavigatorTeamMembers',
			this.membersListContainer!,
			new TeamMemberDelegate(),
			[new TeamMemberRenderer()],
			{
				identityProvider: { getId: (member: INavigatorTeamMemberEntry) => member.id },
				accessibilityProvider: new TeamMemberAccessibilityProvider(),
				openOnSingleClick: true,
			},
		)) as WorkbenchList<INavigatorTeamMemberEntry>;

		this._register(this.membersList.onDidOpen(e => {
			if (!e.element) {
				return;
			}
			this.inspectService.setTarget({ kind: 'member', info: e.element });
			void this.instantiationService.invokeFunction(accessor => revealNavigatorAgentInConversation(accessor, e.element!.memberAgentId, e.element!.memberName));
		}));

		return this.membersList;
	}

	private ensureTasksList(): WorkbenchList<INavigatorTeamTaskEntry> {
		if (this.tasksList) {
			return this.tasksList;
		}

		this.tasksList = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'NavigatorTeamTasks',
			this.tasksListContainer!,
			new TeamTaskDelegate(),
			[new TeamTaskRenderer()],
			{
				identityProvider: { getId: (task: INavigatorTeamTaskEntry) => task.id },
				accessibilityProvider: new TeamTaskAccessibilityProvider(),
			},
		)) as WorkbenchList<INavigatorTeamTaskEntry>;

		this._register(this.tasksList.onDidOpen(e => {
			if (e.element) {
				this.inspectService.setTarget({ kind: 'task', task: e.element });
			}
		}));

		return this.tasksList;
	}

	private async refreshTeamData(): Promise<void> {
		if (!this.rosterService.isEngineConnected()) {
			this.setMemberEntries([], localize('navigatorTeamMembers.empty', "No team members yet"));
			this.setTaskEntries([], localize('navigatorTeamTasks.empty', "No tasks yet"));
			return;
		}

		const lease = this.leaseHolder.getLease();
		const liveTree = lease?.snapshot.liveAgentTree;
		const agentTreeCapability = getNavigatorCapability(this.uaConnection, 'agentTree');

		if (agentTreeCapability === 'UNSUPPORTED') {
			const msg = localize('navigatorTeam.noAgentTree', "当前引擎不提供 Agent 树，无法列出团队");
			this.setMemberEntries([], msg);
			this.setTaskEntries([], msg);
			return;
		}

		const managers = findManagerNodes(liveTree);
		if (managers.length === 0) {
			this.setMemberEntries([], localize('navigatorTeam.noTeam', "当前会话没有团队"));
			this.setTaskEntries([], localize('navigatorTeam.noTeam', "当前会话没有团队"));
			return;
		}

		const teamCapability = getNavigatorCapability(this.uaConnection, 'team');
		if (teamCapability === 'UNSUPPORTED') {
			const msg = localize('navigatorTeam.unsupported', "当前引擎不提供 Team");
			this.setMemberEntries([], msg);
			this.setTaskEntries([], msg);
			return;
		}

		const teamApi = this.uaConnection.team;
		const sessionId = this.rosterService.getActiveSessionId();
		const liveTeamId = lease?.snapshot.liveTeamId;
		const members: INavigatorTeamMemberEntry[] = [];
		const tasks: INavigatorTeamTaskEntry[] = [];

		for (const manager of managers) {
			let managerLabel = manager.name || manager.agentId;
			if (liveTeamId !== undefined) {
				try {
					this.teamInfoCallCount++;
					const info = await teamApi.teamInfo(sessionId, manager.agentId, liveTeamId);
					if (info?.status) {
						managerLabel = `${managerLabel} (${info.status})`;
					}
				} catch {
					// keep manager name only
				}
			}

			const memberRows = await teamApi.memberStatus(sessionId, manager.agentId);
			for (const row of memberRows) {
				const prefix = managers.length > 1 ? `${managerLabel}: ` : '';
				members.push({
					...row,
					id: `member:${row.memberAgentId}`,
					label: `${prefix}${row.memberName} · ${row.status}`,
					managerAgentId: manager.agentId,
					managerName: manager.name || manager.agentId,
				});
			}

			const taskRows = await teamApi.taskList(sessionId, manager.agentId);
			for (const row of taskRows) {
				const blocked = row.status === 'BLOCKED' && row.blockedBy ? ` · ${row.blockedBy}` : '';
				const prefix = managers.length > 1 ? `${managerLabel}: ` : '';
				tasks.push({
					...row,
					id: `task:${row.taskId}`,
					label: `${prefix}${row.subject || row.taskId} · ${row.status}${blocked}`,
					managerAgentId: manager.agentId,
					managerName: manager.name || manager.agentId,
				});
			}
		}

		this.setMemberEntries(members, members.length === 0 ? localize('navigatorTeamMembers.emptyConnected', "No team members yet") : undefined);
		this.setTaskEntries(tasks, tasks.length === 0 ? localize('navigatorTeamTasks.emptyConnected', "No tasks yet") : undefined);
	}

	private setMemberEntries(entries: INavigatorTeamMemberEntry[], emptyMessage?: string): void {
		this.memberEntries = entries;
		if (emptyMessage !== undefined && this.membersEmpty) {
			this.membersEmpty.textContent = emptyMessage;
		}
		this.applyFilterToMembers();
		this.updateMembersDisplay();
	}

	private setTaskEntries(entries: INavigatorTeamTaskEntry[], emptyMessage?: string): void {
		this.taskEntries = entries;
		if (emptyMessage !== undefined && this.tasksEmpty) {
			this.tasksEmpty.textContent = emptyMessage;
		}
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
