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
import { Extensions as ViewExtensions, IViewsRegistry } from '../../../common/views.js';
import { VIEW_CONTAINER } from '../../files/browser/explorerViewlet.js';
import {
	NAVIGATOR_AGENTS_VIEW_ID,
	NAVIGATOR_PROJECTS_VIEW_ID,
	NAVIGATOR_TEAM_VIEW_ID,
	NavigatorAgentsView,
	NavigatorProjectsView,
	NavigatorTeamView,
} from './navigatorStubView.js';

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

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([
	{
		id: NAVIGATOR_PROJECTS_VIEW_ID,
		name: localize2('navigatorProjects', "Projects"),
		containerIcon: navigatorProjectsViewIcon,
		ctorDescriptor: new SyncDescriptor(NavigatorProjectsView),
		canToggleVisibility: true,
		canMoveView: true,
		hideByDefault: true,
		collapsed: true,
		order: 4,
		weight: 10,
	},
	{
		id: NAVIGATOR_AGENTS_VIEW_ID,
		name: localize2('navigatorAgents', "Agents"),
		containerIcon: navigatorAgentsViewIcon,
		ctorDescriptor: new SyncDescriptor(NavigatorAgentsView),
		canToggleVisibility: true,
		canMoveView: true,
		hideByDefault: true,
		collapsed: true,
		order: 5,
		weight: 10,
	},
	{
		id: NAVIGATOR_TEAM_VIEW_ID,
		name: localize2('navigatorTeam', "Team"),
		containerIcon: navigatorTeamViewIcon,
		ctorDescriptor: new SyncDescriptor(NavigatorTeamView),
		canToggleVisibility: true,
		canMoveView: true,
		hideByDefault: true,
		collapsed: true,
		order: 6,
		weight: 10,
	},
], VIEW_CONTAINER);
