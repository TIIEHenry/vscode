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
import { Extensions as ViewContainerExtensions, Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainerLocation } from '../../../common/views.js';
import { SourcesDiffPanelService } from './sourcesDiffPanelService.js';
import { SOURCES_DIFF_PANEL_CONTAINER_ID, SOURCES_DIFF_PANEL_VIEW_ID } from './sourcesDiffPanelIds.js';
import { SourcesDiffPanelView } from './sourcesDiffPanelView.js';

const sourcesDiffPanelViewIcon = registerIcon(
	'sources-diff-panel-view-icon',
	Codicon.diff,
	localize('sourcesDiffPanelViewIcon', 'View icon of the sources diff panel view.'),
);

const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

export const SOURCES_DIFF_PANEL_VIEW_CONTAINER = viewContainersRegistry.registerViewContainer({
	id: SOURCES_DIFF_PANEL_CONTAINER_ID,
	title: localize2('sourcesDiffPanel', "Diff"),
	icon: sourcesDiffPanelViewIcon,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [SOURCES_DIFF_PANEL_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
	storageId: SOURCES_DIFF_PANEL_CONTAINER_ID,
	hideIfEmpty: true,
	order: 45,
	alwaysUseContainerInfo: true,
}, ViewContainerLocation.Panel, { doNotRegisterOpenCommand: true });

viewsRegistry.registerViews([{
	id: SOURCES_DIFF_PANEL_VIEW_ID,
	name: localize2('sourcesDiffPanel', "Diff"),
	containerIcon: sourcesDiffPanelViewIcon,
	ctorDescriptor: new SyncDescriptor(SourcesDiffPanelView),
	canToggleVisibility: false,
	canMoveView: false,
	order: 1,
	weight: 100,
	when: SourcesDiffPanelService.ctxHasChange,
}], SOURCES_DIFF_PANEL_VIEW_CONTAINER);
