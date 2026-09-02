/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../base/browser/dom.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';

import { NAVIGATOR_AGENTS_VIEW_ID } from './navigatorAgentsView.js';

export {
	NAVIGATOR_AGENTS_VIEW_ID,
	NAVIGATOR_AGENTS_SHOW_ACTIVITY_COMMAND_ID,
	NAVIGATOR_AGENTS_SHOW_HIERARCHY_COMMAND_ID,
	NAVIGATOR_AGENTS_SUBVIEW_ACTIVITY_KEY,
	NAVIGATOR_AGENTS_SUBVIEW_HIERARCHY_KEY,
	NavigatorAgentsView,
} from './navigatorAgentsView.js';
export type { NavigatorAgentsSubview } from './navigatorAgentsView.js';

const $ = dom.$;

export const NAVIGATOR_PROJECTS_VIEW_ID = 'workbench.view.navigatorProjects';
export const NAVIGATOR_TEAM_VIEW_ID = 'workbench.view.navigatorTeam';

export const NAVIGATOR_STUB_VIEW_IDS = [
	NAVIGATOR_PROJECTS_VIEW_ID,
	NAVIGATOR_AGENTS_VIEW_ID,
	NAVIGATOR_TEAM_VIEW_ID,
] as const;

export type NavigatorStubViewId = typeof NAVIGATOR_STUB_VIEW_IDS[number];

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

/** Stub class referenced only by navigatorStubViews.test.ts (N1 uses navigatorProjectsList.ts). */
export class NavigatorProjectsView extends NavigatorStubView {

	static readonly ID = NAVIGATOR_PROJECTS_VIEW_ID;

	protected override getProductLabel(): string {
		return localize('navigatorProjects', "Projects");
	}
}
