/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/navigatorStub.css';
import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainer, ViewContainerLocation } from '../../../common/views.js';
import {
	NAVIGATOR_AGENTS_VIEW_ID,
	NAVIGATOR_PROJECTS_VIEW_ID,
	NAVIGATOR_TEAM_VIEW_ID,
	NavigatorAgentsView,
	NavigatorProjectsView,
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

function registerNavigatorStubContainer(id: string, title: string, icon: typeof navigatorProjectsViewIcon, order: number): ViewContainer {
	return viewContainersRegistry.registerViewContainer({
		id,
		title,
		icon,
		ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [id, { mergeViewWithContainerWhenSingleView: true }]),
		storageId: id,
		hideIfEmpty: true,
		order,
		alwaysUseContainerInfo: true,
	}, ViewContainerLocation.Sidebar, { isDefault: false });
}

export const NAVIGATOR_PROJECTS_VIEW_CONTAINER = registerNavigatorStubContainer(
	NAVIGATOR_PROJECTS_CONTAINER_ID,
	localize2('navigatorProjects', "Projects"),
	navigatorProjectsViewIcon,
	11,
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
		canToggleVisibility: true,
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
		canToggleVisibility: true,
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
		canToggleVisibility: true,
		canMoveView: true,
		order: 1,
		weight: 100,
	},
], NAVIGATOR_TEAM_VIEW_CONTAINER);
