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
import { ACTION_ID_NEW_CHAT } from '../../../browser/actions/chatActions.js';
import { registerChatExecuteActions, ToggleAgentModeActionId } from '../../../browser/actions/chatExecuteActions.js';
import { registerNewChatActions } from '../../../browser/actions/chatNewActions.js';
import { registerQuickChatActions } from '../../../browser/actions/chatQuickInputActions.js';

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
	[ChatContextKeys.chatEditingCanUndo.key]: true,
	[ChatContextKeys.chatEditingCanRedo.key]: true,
	[ChatContextKeys.requestInProgress.key]: false,
};

const agentsWindow: Record<string, ContextKeyValue> = {
	...defaultWindow,
	[IsSessionsWindowContext.key]: true,
};

const sessionsWindowOnlyCommandIds = [
	ACTION_ID_NEW_CHAT,
	'workbench.action.openQuickChat',
	'workbench.action.chat.undoEdit',
	'workbench.action.chat.redoEdit',
	'workbench.action.chat.redoEdit2',
	ToggleAgentModeActionId,
	'workbench.action.chat.switchToNextModel',
	'workbench.action.chat.switchToNextPinnedModel',
];

const f1FalseCommandIds = [
	'workbench.action.quickchat.toggle',
];

suite('ChatNewExecuteActions - default window Command Palette (INV-NO-COPILOT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	suiteSetup(() => {
		registerNewChatActions();
		registerQuickChatActions();
		registerChatExecuteActions();
	});

	test('Quick Chat toggle stays off Command Palette', () => {
		for (const commandId of f1FalseCommandIds) {
			const item = getCommandPaletteItem(commandId);
			assert.strictEqual(item, undefined, `${commandId} must not appear in Command Palette (f1: false)`);
		}
	});

	test('New Chat / Quick Chat / Execute donor commands stay in Command Palette for Agents Window only', () => {
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
