/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/navigatorStub.css';
import './agentInspect.contribution.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2, ILocalizedString } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { OpenFolderAction } from '../../../browser/actions/workspaceActions.js';
import { OpenRecentAction } from '../../../browser/actions/windowActions.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainer, ViewContainerLocation, ViewContentGroups } from '../../../common/views.js';
import { NavigatorProjectsView } from './navigatorProjectsList.js';
import {
	NAVIGATOR_AGENTS_VIEW_ID,
	NAVIGATOR_PROJECTS_VIEW_ID,
	NAVIGATOR_TEAM_VIEW_ID,
	NavigatorAgentsView,
	NavigatorTeamView,
} from './navigatorStubView.js';

export const NAVIGATOR_PROJECTS_CONTAINER_ID = 'workbench.view.navigator.projects';
export const NAVIGATOR_AGENTS_CONTAINER_ID = 'workbench.view.navigator.agents';
export const NAVIGATOR_TEAM_CONTAINER_ID = 'workbench.view.navigator.team';

const navigatorProjectsViewIcon = registerIcon(
	'navigator-projects-view-icon',
	Codicon.project,
	localize('navigatorProjectsViewIcon', 'View icon of the navigator projects view.'),
);

const navigatorAgentsViewIcon = registerIcon(
	'navigator-agents-view-icon',
	Codicon.agent,
	localize('navigatorAgentsViewIcon', 'View icon of the navigator agents view.'),
);

const navigatorTeamViewIcon = registerIcon(
	'navigator-team-view-icon',
	Codicon.organization,
	localize('navigatorTeamViewIcon', 'View icon of the navigator team view.'),
);

const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

function registerNavigatorStubContainer(id: string, title: ILocalizedString, icon: typeof navigatorProjectsViewIcon, order: number, isDefault: boolean = false): ViewContainer {
	return viewContainersRegistry.registerViewContainer({
		id,
		title,
		icon,
		ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [id, { mergeViewWithContainerWhenSingleView: true }]),
		storageId: id,
		hideIfEmpty: false,
		order,
		alwaysUseContainerInfo: true,
	}, ViewContainerLocation.Sidebar, { isDefault });
}

export const NAVIGATOR_PROJECTS_VIEW_CONTAINER = registerNavigatorStubContainer(
	NAVIGATOR_PROJECTS_CONTAINER_ID,
	localize2('navigatorProjects', "Projects"),
	navigatorProjectsViewIcon,
	11,
	false,
);

export const NAVIGATOR_AGENTS_VIEW_CONTAINER = registerNavigatorStubContainer(
	NAVIGATOR_AGENTS_CONTAINER_ID,
	localize2('navigatorAgents', "Agents"),
	navigatorAgentsViewIcon,
	12,
);

export const NAVIGATOR_TEAM_VIEW_CONTAINER = registerNavigatorStubContainer(
	NAVIGATOR_TEAM_CONTAINER_ID,
	localize2('navigatorTeam', "Team"),
	navigatorTeamViewIcon,
	13,
);

viewsRegistry.registerViews([
	{
		id: NAVIGATOR_PROJECTS_VIEW_ID,
		name: localize2('navigatorProjects', "Projects"),
		containerIcon: navigatorProjectsViewIcon,
		ctorDescriptor: new SyncDescriptor(NavigatorProjectsView),
		canToggleVisibility: false,
		canMoveView: true,
		order: 1,
		weight: 100,
	},
], NAVIGATOR_PROJECTS_VIEW_CONTAINER);

viewsRegistry.registerViews([
	{
		id: NAVIGATOR_AGENTS_VIEW_ID,
		name: localize2('navigatorAgents', "Agents"),
		containerIcon: navigatorAgentsViewIcon,
		ctorDescriptor: new SyncDescriptor(NavigatorAgentsView),
		canToggleVisibility: false,
		canMoveView: true,
		order: 1,
		weight: 100,
	},
], NAVIGATOR_AGENTS_VIEW_CONTAINER);

viewsRegistry.registerViews([
	{
		id: NAVIGATOR_TEAM_VIEW_ID,
		name: localize2('navigatorTeam', "Team"),
		containerIcon: navigatorTeamViewIcon,
		ctorDescriptor: new SyncDescriptor(NavigatorTeamView),
		canToggleVisibility: false,
		canMoveView: true,
		order: 1,
		weight: 100,
	},
], NAVIGATOR_TEAM_VIEW_CONTAINER);

const openFolder = localize('openFolder', "Open Folder");
const openRecent = localize('openRecent', "Open Recent");
const openFolderButton = `[${openFolder}](command:${OpenFolderAction.ID})`;
const openRecentButton = `[${openRecent}](command:${OpenRecentAction.ID})`;

viewsRegistry.registerViewWelcomeContent(NAVIGATOR_PROJECTS_VIEW_ID, {
	content: localize({ key: 'navigatorProjectsWelcome', comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change'] },
		"No projects yet.\n{0}\n{1}", openFolderButton, openRecentButton),
	group: ViewContentGroups.Open,
	order: 1,
});
