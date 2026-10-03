/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { CHAT_SETUP_ACTION_ID } from '../../../../../workbench/contrib/chat/browser/actions/chatActions.js';
import { ChatPetAchievementIds } from '../../../../../workbench/contrib/chat/browser/chatPetAchievements.js';
import { Menus } from '../../../../browser/menus.js';
import { captureOpenCopilotAccountPanelState, hasCopilotAccountPanelIdentityChanged, shouldDismissOpenCopilotAccountPanel, shouldRestoreAccountTitleBarFocus, shouldShowAccountPanelSummary, syncAccountPanelAvatar } from '../../browser/account.contribution.js';
import { getSessionsChatPetAchievementBadges } from '../../browser/chatPetAchievementBadges.js';

suite('Sessions - Account Menu', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('labels the signed-out Copilot account action', () => {
		const signIn = MenuRegistry.getMenuItems(Menus.AccountMenu)
			.filter(isIMenuItem)
			.find(item => item.command.id === 'workbench.action.agenticSignIn');

		assert.ok(signIn);
		assert.strictEqual(typeof signIn.command.title === 'string' ? signIn.command.title : signIn.command.title.value, 'Sign in to use GitHub Copilot');
	});

	test('uses the shared Chat setup flow for Copilot sign-in', async () => {
		const executedCommands: string[] = [];
		const command = CommandsRegistry.getCommand('workbench.action.agenticSignIn');
		assert.ok(command);
		const accessor = {
			get: () => ({
				executeCommand: async (commandId: string) => {
					executedCommands.push(commandId);
				},
			}),
		} as ServicesAccessor;

		await command.handler(accessor);

		assert.deepStrictEqual(executedCommands, [CHAT_SETUP_ACTION_ID]);
	});

	test('restores title bar focus only while it is still in the account ui', () => {
		const accountButton = document.createElement('div');
		const hover = document.createElement('div');
		const hoverFrame = document.createElement('div');
		const panel = document.createElement('div');
		const panelButton = document.createElement('button');
		const sentinel = document.createElement('div');
		const editor = document.createElement('textarea');
		accountButton.tabIndex = 0;
		sentinel.tabIndex = 0;
		hover.className = 'workbench-hover-container';
		hoverFrame.className = 'monaco-hover';
		panel.className = 'sessions-account-titlebar-panel';
		panel.appendChild(panelButton);
		hoverFrame.appendChild(panel);
		hover.append(hoverFrame, sentinel);
		document.body.append(accountButton, hover, editor);

		try {
			panelButton.focus();
			const focusedPanel = shouldRestoreAccountTitleBarFocus(document.activeElement, accountButton, panel);
			sentinel.focus();
			const focusedHoverChrome = shouldRestoreAccountTitleBarFocus(document.activeElement, accountButton, panel);
			accountButton.focus();
			const focusedButton = shouldRestoreAccountTitleBarFocus(document.activeElement, accountButton, panel);
			editor.focus();
			const focusedEditor = shouldRestoreAccountTitleBarFocus(document.activeElement, accountButton, panel);

			assert.deepStrictEqual({
				focusedPanel,
				focusedHoverChrome,
				focusedButton,
				focusedEditor,
				missing: shouldRestoreAccountTitleBarFocus(null, accountButton, panel),
				buttonOnly: shouldRestoreAccountTitleBarFocus(accountButton, accountButton, undefined),
				outsideWithoutPanel: shouldRestoreAccountTitleBarFocus(editor, accountButton, undefined),
			}, {
				focusedPanel: true,
				focusedHoverChrome: true,
				focusedButton: true,
				focusedEditor: false,
				missing: false,
				buttonOnly: true,
				outsideWithoutPanel: false,
			});
		} finally {
			accountButton.remove();
			hover.remove();
			editor.remove();
		}
	});

	test('treats a different Copilot account as a panel identity change', () => {
		const alice = { accountName: 'alice', accountProviderId: 'github', accountIcon: 'https://example.com/alice.png' };
		assert.deepStrictEqual({
			same: hasCopilotAccountPanelIdentityChanged(alice, { ...alice }),
			otherPerson: hasCopilotAccountPanelIdentityChanged(alice, { ...alice, accountName: 'bob' }),
			otherIcon: hasCopilotAccountPanelIdentityChanged(alice, { ...alice, accountIcon: 'https://example.com/stale.png' }),
			otherProvider: hasCopilotAccountPanelIdentityChanged(alice, { ...alice, accountProviderId: 'github-enterprise' }),
			signedOut: hasCopilotAccountPanelIdentityChanged(alice, {}),
			stillSignedOut: hasCopilotAccountPanelIdentityChanged({}, {}),
		}, {
			same: false,
			otherPerson: true,
			otherIcon: true,
			otherProvider: true,
			signedOut: true,
			stillSignedOut: false,
		});
	});

	test('drops a resolved loading panel and a Sign Out action that no longer matches', () => {
		const unresolved = captureOpenCopilotAccountPanelState({ isAccountLoading: true, signOutInMenu: false });
		const signedIn = captureOpenCopilotAccountPanelState({ accountName: 'alice', isAccountLoading: false, signOutInMenu: true });
		const signedOut = captureOpenCopilotAccountPanelState({ isAccountLoading: false, signOutInMenu: false });
		const refreshingKnownAccount = captureOpenCopilotAccountPanelState({ accountName: 'alice', isAccountLoading: true, signOutInMenu: true });

		assert.deepStrictEqual({
			unresolved: { openedWhileUnresolved: unresolved.openedWhileUnresolved, showedSignOut: unresolved.showedSignOut },
			signedOut: { openedWhileUnresolved: signedOut.openedWhileUnresolved, showedSignOut: signedOut.showedSignOut },
			stillLoading: shouldDismissOpenCopilotAccountPanel(true, unresolved, { identityChanged: false, isAccountLoading: true, signOutAvailable: false }),
			resolvedSignedOut: shouldDismissOpenCopilotAccountPanel(true, unresolved, { identityChanged: false, isAccountLoading: false, signOutAvailable: false }),
			sameAccount: shouldDismissOpenCopilotAccountPanel(true, signedIn, { identityChanged: false, isAccountLoading: false, signOutAvailable: true }),
			refreshOfKnownAccount: shouldDismissOpenCopilotAccountPanel(true, refreshingKnownAccount, { identityChanged: false, isAccountLoading: false, signOutAvailable: true }),
			signOutAppeared: shouldDismissOpenCopilotAccountPanel(true, { openedWhileUnresolved: false, showedSignOut: false }, { identityChanged: false, isAccountLoading: false, signOutAvailable: true }),
			signOutGone: shouldDismissOpenCopilotAccountPanel(true, signedIn, { identityChanged: false, isAccountLoading: false, signOutAvailable: false }),
			otherPersonWhileClosed: shouldDismissOpenCopilotAccountPanel(false, signedIn, { identityChanged: true, isAccountLoading: false, signOutAvailable: true }),
		}, {
			unresolved: { openedWhileUnresolved: true, showedSignOut: false },
			signedOut: { openedWhileUnresolved: false, showedSignOut: false },
			stillLoading: false,
			resolvedSignedOut: true,
			sameAccount: false,
			refreshOfKnownAccount: false,
			signOutAppeared: true,
			signOutGone: true,
			otherPersonWhileClosed: false,
		});
	});

	test('updates the open panel avatar without blanking it for a later refresh', () => {
		const avatar = document.createElement('img');
		const icon = document.createElement('span');
		const first = 'https://example.com/alice.png';
		const second = 'https://example.com/alice-2.png';

		syncAccountPanelAvatar(avatar, icon, undefined, 'Account profile image');
		const hidden = { avatar: avatar.classList.contains('hidden'), icon: icon.classList.contains('hidden'), src: avatar.getAttribute('src') };
		syncAccountPanelAvatar(avatar, icon, first, 'GitHub profile image for alice');
		const shown = { avatar: avatar.classList.contains('hidden'), icon: icon.classList.contains('hidden'), alt: avatar.alt };
		syncAccountPanelAvatar(avatar, icon, first, 'GitHub profile image for alice');
		const sameSrc = avatar.src;
		syncAccountPanelAvatar(avatar, icon, second, 'GitHub profile image for alice');
		const replaced = avatar.src !== sameSrc;
		syncAccountPanelAvatar(avatar, icon, undefined, 'Account profile image');

		assert.deepStrictEqual({
			hidden,
			shown,
			replaced,
			cleared: { avatar: avatar.classList.contains('hidden'), icon: icon.classList.contains('hidden'), src: avatar.getAttribute('src'), alt: avatar.alt },
		}, {
			hidden: { avatar: true, icon: false, src: null },
			shown: { avatar: false, icon: true, alt: 'GitHub profile image for alice' },
			replaced: true,
			cleared: { avatar: true, icon: false, src: null, alt: 'Account profile image' },
		});
	});

	test('omits the redundant signed-out summary', () => {
		assert.deepStrictEqual({
			signedOut: shouldShowAccountPanelSummary({ source: 'copilot', kind: 'prominent' }, false, false),
			unavailable: shouldShowAccountPanelSummary({ source: 'copilot', kind: 'warning' }, false, false),
			loading: shouldShowAccountPanelSummary({ source: 'account', kind: 'default' }, false, true),
		}, {
			signedOut: false,
			unavailable: true,
			loading: false,
		});
	});

	test('shows unlocked badges first while the pet is enabled', () => {
		assert.deepStrictEqual({
			disabled: getSessionsChatPetAchievementBadges(false, [ChatPetAchievementIds.FirstChatMessage]),
			empty: getSessionsChatPetAchievementBadges(true, [])?.map(badge => ({ id: badge.achievement.id, unlocked: badge.unlocked })),
			partial: getSessionsChatPetAchievementBadges(true, [
				ChatPetAchievementIds.IntegratedBrowserShared,
				ChatPetAchievementIds.FirstChatMessage,
			])?.map(badge => ({ id: badge.achievement.id, unlocked: badge.unlocked })),
		}, {
			disabled: undefined,
			empty: [
				{ id: ChatPetAchievementIds.RequestRevision, unlocked: false },
				{ id: ChatPetAchievementIds.FirstChatMessage, unlocked: false },
				{ id: ChatPetAchievementIds.IntegratedBrowserShared, unlocked: false },
				{ id: ChatPetAchievementIds.ModelSwitch, unlocked: false },
				{ id: ChatPetAchievementIds.McpServerPresent, unlocked: false },
				{ id: ChatPetAchievementIds.CustomSkillPresent, unlocked: false },
				{ id: ChatPetAchievementIds.AgentsWindowOpened, unlocked: false },
				{ id: ChatPetAchievementIds.CreatePullRequest, unlocked: false },
				{ id: ChatPetAchievementIds.AgentEditKept, unlocked: false },
				{ id: ChatPetAchievementIds.AgentChangesReviewed, unlocked: false },
				{ id: ChatPetAchievementIds.ChatReferenceOpened, unlocked: false },
				{ id: ChatPetAchievementIds.UsefulOutputCopied, unlocked: false },
				{ id: ChatPetAchievementIds.AutopilotEnabled, unlocked: false },
			],
			partial: [
				{ id: ChatPetAchievementIds.FirstChatMessage, unlocked: true },
				{ id: ChatPetAchievementIds.IntegratedBrowserShared, unlocked: true },
				{ id: ChatPetAchievementIds.RequestRevision, unlocked: false },
				{ id: ChatPetAchievementIds.ModelSwitch, unlocked: false },
				{ id: ChatPetAchievementIds.McpServerPresent, unlocked: false },
				{ id: ChatPetAchievementIds.CustomSkillPresent, unlocked: false },
				{ id: ChatPetAchievementIds.AgentsWindowOpened, unlocked: false },
				{ id: ChatPetAchievementIds.CreatePullRequest, unlocked: false },
				{ id: ChatPetAchievementIds.AgentEditKept, unlocked: false },
				{ id: ChatPetAchievementIds.AgentChangesReviewed, unlocked: false },
				{ id: ChatPetAchievementIds.ChatReferenceOpened, unlocked: false },
				{ id: ChatPetAchievementIds.UsefulOutputCopied, unlocked: false },
				{ id: ChatPetAchievementIds.AutopilotEnabled, unlocked: false },
			],
		});
	});
});
