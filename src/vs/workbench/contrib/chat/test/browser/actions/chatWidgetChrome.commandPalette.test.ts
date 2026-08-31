/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../../platform/actions/common/actions.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from '../../../../../common/contextkeys.js';
import { ChatContextKeys } from '../../../common/actions/chatContextKeys.js';
import { ChatAgentLocation } from '../../../common/constants.js';
import {
	ACTION_ID_FOCUS_CHAT_CONFIRMATION,
	ACTION_ID_TOGGLE_THINKING_CONTENT_ACCESSIBLE_VIEW,
	registerChatAccessibilityActions,
} from '../../../browser/actions/chatAccessibilityActions.js';
import { registerChatCodeBlockActions } from '../../../browser/actions/chatCodeblockActions.js';
import { registerChatContextActions } from '../../../browser/actions/chatContextActions.js';
import { registerChatFileTreeActions } from '../../../browser/actions/chatFileTreeActions.js';
import { registerChatFindActions } from '../../../browser/actions/chatFindActions.js';
import { registerChatPromptNavigationActions } from '../../../browser/actions/chatPromptNavigationActions.js';
import { ChatFindCommandId } from '../../../browser/widget/chatFind/chatFindCommandIds.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function getCommandPaletteItem(commandId: string) {
	return MenuRegistry.getMenuItems(MenuId.CommandPalette)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

const chatEnabled = { [ChatContextKeys.enabled.key]: true };

const defaultWindow: Record<string, ContextKeyValue> = {
	...chatEnabled,
	[IsSessionsWindowContext.key]: false,
	[ChatContextKeys.location.key]: ChatAgentLocation.Chat,
	[ChatContextKeys.findSupported.key]: true,
};

const agentsWindow: Record<string, ContextKeyValue> = {
	...defaultWindow,
	[IsSessionsWindowContext.key]: true,
};

const sessionsWindowOnlyCommandIds = [
	'workbench.action.chat.attachFile',
	'workbench.action.chat.attachPinnedEditors',
	'workbench.action.chat.attachSelection',
	'workbench.action.chat.insertCodeBlock',
	'workbench.action.chat.insertIntoNewFile',
	'workbench.action.chat.runInTerminal',
	'workbench.action.chat.nextCodeBlock',
	'workbench.action.chat.previousCodeBlock',
	ChatFindCommandId.Find,
	'workbench.action.chat.nextFileTree',
	'workbench.action.chat.previousFileTree',
	ACTION_ID_FOCUS_CHAT_CONFIRMATION,
	ACTION_ID_TOGGLE_THINKING_CONTENT_ACCESSIBLE_VIEW,
	'workbench.action.chat.nextUserPrompt',
	'workbench.action.chat.previousUserPrompt',
];

suite('ChatWidgetChromeActions - default window Command Palette (INV-NO-COPILOT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	suiteSetup(() => {
		registerChatContextActions();
		registerChatCodeBlockActions();
		registerChatFindActions();
		registerChatFileTreeActions();
		registerChatAccessibilityActions();
		registerChatPromptNavigationActions();
	});

	test('Chat widget chrome donor commands stay in Command Palette for Agents Window only', () => {
		for (const commandId of sessionsWindowOnlyCommandIds) {
			const item = getCommandPaletteItem(commandId);
			assert.ok(item, `${commandId} should remain registered for Agents Window`);
			assert.ok(item.when, `${commandId} Command Palette item should have a when clause`);

			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`default Code window must hide ${commandId} in Command Palette`
			);
			assert.strictEqual(
				evalWhen(item.when, agentsWindow),
				true,
				`Agents Window may list ${commandId} in Command Palette`
			);
		}
	});
});
