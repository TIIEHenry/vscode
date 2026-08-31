/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../base/browser/dom.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewPaneOptions, ViewAction, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import {
	AGENT_INSPECT_VIEW_ID,
	OPEN_NAVIGATOR_AGENTS_INSPECT_COMMAND_ID,
	OPEN_NAVIGATOR_TEAM_INSPECT_COMMAND_ID,
} from './agentInspectIds.js';

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

export class NavigatorAgentsView extends NavigatorStubView {

	static readonly ID = NAVIGATOR_AGENTS_VIEW_ID;

	protected override getProductLabel(): string {
		return localize('navigatorAgents', "Agents");
	}
}

export class NavigatorTeamView extends NavigatorStubView {

	static readonly ID = NAVIGATOR_TEAM_VIEW_ID;

	protected override getProductLabel(): string {
		return localize('navigatorTeam', "Team");
	}
}

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
