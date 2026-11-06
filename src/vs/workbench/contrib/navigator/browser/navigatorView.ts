/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** View ids for the product-four Navigator segments. Production views live in dedicated modules. */

import {
	NAVIGATOR_AGENTS_VIEW_ID,
	NAVIGATOR_AGENTS_SHOW_ACTIVITY_COMMAND_ID,
	NAVIGATOR_AGENTS_SHOW_HIERARCHY_COMMAND_ID,
	NAVIGATOR_AGENTS_REFRESH_COMMAND_ID,
	NAVIGATOR_AGENTS_SUBVIEW_ACTIVITY_KEY,
	NAVIGATOR_AGENTS_SUBVIEW_HIERARCHY_KEY,
	NavigatorAgentsView,
} from './navigatorAgentsView.js';
export type { NavigatorAgentsSubview } from './navigatorAgentsView.js';

export {
	NAVIGATOR_AGENTS_VIEW_ID,
	NAVIGATOR_AGENTS_SHOW_ACTIVITY_COMMAND_ID,
	NAVIGATOR_AGENTS_SHOW_HIERARCHY_COMMAND_ID,
	NAVIGATOR_AGENTS_REFRESH_COMMAND_ID,
	NAVIGATOR_AGENTS_SUBVIEW_ACTIVITY_KEY,
	NAVIGATOR_AGENTS_SUBVIEW_HIERARCHY_KEY,
	NavigatorAgentsView,
};

export const NAVIGATOR_PROJECTS_VIEW_ID = 'workbench.view.navigatorProjects';
export const NAVIGATOR_TEAM_VIEW_ID = 'workbench.view.navigatorTeam';

export const NAVIGATOR_VIEW_IDS = [
	NAVIGATOR_PROJECTS_VIEW_ID,
	NAVIGATOR_AGENTS_VIEW_ID,
	NAVIGATOR_TEAM_VIEW_ID,
] as const;

export type NavigatorViewId = typeof NAVIGATOR_VIEW_IDS[number];
