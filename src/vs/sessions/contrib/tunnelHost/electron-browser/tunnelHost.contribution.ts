/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IActionViewItemService, type IActionViewItemFactory } from '../../../../platform/actions/browser/actionViewItemService.js';
import { MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../../workbench/common/contributions.js';
import { IsAuxiliaryWindowContext, IsSessionsWindowContext } from '../../../../workbench/common/contextkeys.js';
import { ChatContextKeys } from '../../../../workbench/contrib/chat/common/actions/chatContextKeys.js';
import { ToggleRemoteConnectionsActionViewItem } from '../../../../workbench/contrib/chat/electron-browser/toggleRemoteConnectionsActionViewItem.js';
import { TOGGLE_SHARING_ID } from '../../../../workbench/contrib/chat/electron-browser/tunnelHost.contribution.js';
import { Menus } from '../../../browser/menus.js';

// No `toggled` expression: it would subscribe this menu to tunnelHostSharing.
// A sharing change then rebuilds every TitleBarRightLayout item, which
// dismisses an open account menu and replaces this toggle before its
// "now enabled" toast or connecting pulse can stay on screen.
MenuRegistry.appendMenuItem(Menus.TitleBarRightLayout, {
	command: {
		id: TOGGLE_SHARING_ID,
		title: localize('toggleSharing', "Allow Remote Connections"),
		icon: Codicon.radioTower,
	},
	group: 'navigation',
	order: 90,
	when: ContextKeyExpr.and(ChatContextKeys.enabled, IsSessionsWindowContext, IsAuxiliaryWindowContext.toNegated())
});

export class SessionsTunnelHostTitlebarContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.sessionsTunnelHostTitlebar';

	constructor(
		@IActionViewItemService actionViewItemService: IActionViewItemService,
	) {
		super();

		const viewItemFactory: IActionViewItemFactory = (action, _options, instantiationService) => {
			return instantiationService.createInstance(ToggleRemoteConnectionsActionViewItem, action);
		};
		// The view item already listens to status. Passing that event here
		// refreshes the whole right toolbar and tears the toggle down.
		this._register(actionViewItemService.register(Menus.TitleBarRightLayout, TOGGLE_SHARING_ID, viewItemFactory));
	}
}

registerWorkbenchContribution2(SessionsTunnelHostTitlebarContribution.ID, SessionsTunnelHostTitlebarContribution, WorkbenchPhase.BlockRestore);
