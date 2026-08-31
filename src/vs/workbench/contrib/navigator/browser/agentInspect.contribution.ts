/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainer, ViewContainerLocation, ViewContentGroups } from '../../../common/views.js';
import { AGENT_INSPECT_CONTAINER_ID, AGENT_INSPECT_VIEW_ID, OPEN_AGENT_INSPECT_VIEW_COMMAND_ID } from './agentInspectIds.js';
import { AgentInspectView } from './agentInspectView.js';

const agentInspectViewIcon = registerIcon(
	'agent-inspect-view-icon',
	Codicon.inspect,
	localize('agentInspectViewIcon', 'View icon of the agent inspect view.'),
);

const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

export const AGENT_INSPECT_VIEW_CONTAINER: ViewContainer = viewContainersRegistry.registerViewContainer({
	id: AGENT_INSPECT_CONTAINER_ID,
	title: localize2('agentInspect', "Inspect"),
	icon: agentInspectViewIcon,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [AGENT_INSPECT_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
	storageId: AGENT_INSPECT_CONTAINER_ID,
	hideIfEmpty: true,
	order: 50,
	alwaysUseContainerInfo: true,
}, ViewContainerLocation.Panel, { doNotRegisterOpenCommand: true });

// v1 single leaf: Agents and Team share this view id and ctor.
// A second inspect leaf id is deferred until the EH matrix is nailed (see page-access-schemes §9.6).
viewsRegistry.registerViews([{
	id: AGENT_INSPECT_VIEW_ID,
	name: localize2('agentInspect', "Inspect"),
	containerIcon: agentInspectViewIcon,
	ctorDescriptor: new SyncDescriptor(AgentInspectView),
	canToggleVisibility: true,
	canMoveView: true,
	order: 1,
	weight: 100,
	openCommandActionDescriptor: {
		id: OPEN_AGENT_INSPECT_VIEW_COMMAND_ID,
		order: 50,
	},
}], AGENT_INSPECT_VIEW_CONTAINER);

viewsRegistry.registerViewWelcomeContent(AGENT_INSPECT_VIEW_ID, {
	content: localize('agentInspectWelcome', "No inspect target yet"),
	group: ViewContentGroups.Open,
	order: 1,
});
