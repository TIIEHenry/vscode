/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Codicon } from '../../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../../base/common/themables.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { IActionViewItemService } from '../../../../../platform/actions/browser/actionViewItemService.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { ChatContextKeys } from '../../../../../workbench/contrib/chat/common/actions/chatContextKeys.js';
import { IsAuxiliaryWindowContext, IsSessionsWindowContext, RemoteNameContext } from '../../../../../workbench/common/contextkeys.js';
import { Menus } from '../../../../browser/menus.js';
import { SessionsTunnelHostTitlebarContribution } from '../../electron-browser/tunnelHost.contribution.js';

suite('Sessions - Tunnel Host Contribution', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('remote connections toggle is in Agents titlebar and non-Agents chat input', () => {
		const findToggle = (menu: MenuId) => MenuRegistry.getMenuItems(menu)
			.filter(isIMenuItem)
			.find(item => item.command.id === 'sessions.tunnelHost.toggleSharing');

		const summarize = (menu: MenuId) => {
			const item = findToggle(menu);
			return item && {
				group: item.group,
				order: item.order,
				icon: ThemeIcon.isThemeIcon(item.command.icon) ? item.command.icon.id : undefined,
			};
		};

		assert.deepStrictEqual({
			titlebar: summarize(Menus.TitleBarRightLayout),
			chatInput: summarize(MenuId.ChatInputSecondary),
		}, {
			titlebar: { group: 'navigation', order: 90, icon: Codicon.radioTower.id },
			chatInput: { group: 'navigation', order: 10, icon: Codicon.radioTower.id },
		});

		const titlebarToggle = findToggle(Menus.TitleBarRightLayout);
		const chatInputToggle = findToggle(MenuId.ChatInputSecondary);
		if (!titlebarToggle?.when || !chatInputToggle?.when) {
			assert.fail('remote connections menu items should have when clauses');
		}

		const evalWhen = (when: ContextKeyExpression, values: Record<string, ContextKeyValue>) => {
			return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
		};
		const agentHostChat = {
			[ChatContextKeys.enabled.key]: true,
			[ChatContextKeys.chatIsAgentHostSession.key]: true,
			[IsAuxiliaryWindowContext.key]: false,
			[RemoteNameContext.key]: '',
		};

		assert.deepStrictEqual({
			agentsTitlebar: evalWhen(titlebarToggle.when, { ...agentHostChat, [IsSessionsWindowContext.key]: true }),
			editorTitlebar: evalWhen(titlebarToggle.when, { ...agentHostChat, [IsSessionsWindowContext.key]: false }),
			agentsChatInput: evalWhen(chatInputToggle.when, { ...agentHostChat, [IsSessionsWindowContext.key]: true }),
			editorChatInput: evalWhen(chatInputToggle.when, { ...agentHostChat, [IsSessionsWindowContext.key]: false }),
			remoteEditorChatInput: evalWhen(chatInputToggle.when, { ...agentHostChat, [IsSessionsWindowContext.key]: false, [RemoteNameContext.key]: 'ssh-remote' }),
		}, {
			agentsTitlebar: true,
			editorTitlebar: false,
			agentsChatInput: false,
			editorChatInput: true,
			remoteEditorChatInput: false,
		});
	});

	test('sharing status does not rebuild the Agents titlebar', () => {
		const titlebarToggle = MenuRegistry.getMenuItems(Menus.TitleBarRightLayout)
			.filter(isIMenuItem)
			.find(item => item.command.id === 'sessions.tunnelHost.toggleSharing');
		// A toggled context key marks the menu dirty and the toolbar
		// replaces every right-side control, including this one.
		assert.strictEqual(titlebarToggle?.command.toggled, undefined);

		let refreshEvent: unknown = 'not-registered';
		const actionViewItemService = {
			register: (menu: MenuId, commandId: string, _provider: unknown, event?: unknown) => {
				assert.strictEqual(menu, Menus.TitleBarRightLayout);
				assert.strictEqual(commandId, 'sessions.tunnelHost.toggleSharing');
				refreshEvent = event;
				return { dispose() { } };
			},
		} as IActionViewItemService;
		disposables.add(new SessionsTunnelHostTitlebarContribution(actionViewItemService));

		assert.strictEqual(refreshEvent, undefined);
	});
});
