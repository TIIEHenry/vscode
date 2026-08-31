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
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
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
import {
	AGENT_INSPECT_VIEW_ID,
	OPEN_NAVIGATOR_TEAM_INSPECT_COMMAND_ID,
} from './agentInspectIds.js';
import { NAVIGATOR_TEAM_VIEW_ID } from './navigatorStubView.js';

const $ = dom.$;

export interface INavigatorTeamMember {
	readonly id: string;
	readonly label: string;
}

class TeamDelegate implements IListVirtualDelegate<INavigatorTeamMember> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return 'navigatorTeamMember';
	}
}

interface ITeamTemplateData {
	readonly label: HTMLElement;
}

class TeamRenderer implements IListRenderer<INavigatorTeamMember, ITeamTemplateData> {
	static readonly TEMPLATE_ID = 'navigatorTeamMember';

	readonly templateId = TeamRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): ITeamTemplateData {
		return { label: dom.append(container, $('.navigator-team-member-label')) };
	}

	renderElement(member: INavigatorTeamMember, _index: number, templateData: ITeamTemplateData): void {
		templateData.label.textContent = member.label;
	}

	disposeTemplate(): void {
		// noop
	}
}

class TeamAccessibilityProvider implements IListAccessibilityProvider<INavigatorTeamMember> {
	getWidgetAriaLabel(): string {
		return localize('navigatorTeamView.ariaLabel', "Team");
	}

	getAriaLabel(member: INavigatorTeamMember): string {
		return member.label;
	}
}

export class NavigatorTeamView extends ViewPane {

	static readonly ID = NAVIGATOR_TEAM_VIEW_ID;

	private list: WorkbenchList<INavigatorTeamMember> | undefined;
	private listContainer: HTMLElement | undefined;
	private entries: INavigatorTeamMember[] = [];

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

	override shouldShowWelcome(): boolean {
		return this.entries.length === 0;
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.listContainer = dom.append(container, $('.navigator-team-list'));
		this.ensureList();
		this.setEntries([]);
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.list?.layout(height, width);
	}

	private ensureList(): WorkbenchList<INavigatorTeamMember> {
		if (this.list) {
			return this.list;
		}

		const delegate = new TeamDelegate();
		const renderer = new TeamRenderer();

		this.list = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'NavigatorTeam',
			this.listContainer!,
			delegate,
			[renderer],
			{
				identityProvider: { getId: (member: INavigatorTeamMember) => member.id },
				accessibilityProvider: new TeamAccessibilityProvider(),
			}
		)) as WorkbenchList<INavigatorTeamMember>;

		return this.list;
	}

	private setEntries(entries: INavigatorTeamMember[]): void {
		const hadEntries = this.entries.length > 0;
		this.entries = entries;

		if (this.list) {
			this.list.splice(0, this.list.length, entries);
		}

		if (hadEntries !== (entries.length > 0)) {
			this._onDidChangeViewWelcomeState.fire();
		}
	}
}

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
