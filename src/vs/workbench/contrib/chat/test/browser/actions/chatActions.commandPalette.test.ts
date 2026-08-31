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
import { ChatModeKind } from '../../../common/constants.js';
import {
	CHAT_OPEN_ACTION_ID,
	GENERATE_AGENT_COMMAND_ID,
	GENERATE_AGENT_INSTRUCTIONS_COMMAND_ID,
	GENERATE_HOOK_COMMAND_ID,
	GENERATE_ON_DEMAND_INSTRUCTIONS_COMMAND_ID,
	GENERATE_PROMPT_COMMAND_ID,
	GENERATE_SKILL_COMMAND_ID,
	INSERT_FORK_CONVERSATION_COMMAND_ID,
	INSERT_TROUBLESHOOT_COMMAND_ID,
} from '../../../browser/actions/chatActions.js';

import '../../../browser/chat.shared.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function findCommandPaletteItem(commandId: string) {
	return MenuRegistry.getMenuItems(MenuId.CommandPalette)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

const defaultWindow: Record<string, ContextKeyValue> = {
	[IsSessionsWindowContext.key]: false,
	[ChatContextKeys.enabled.key]: true,
	[ChatContextKeys.Setup.hidden.key]: false,
	[ChatContextKeys.Setup.disabledInWorkspace.key]: false,
};

const agentsWindowChatReady: Record<string, ContextKeyValue> = {
	...defaultWindow,
	[IsSessionsWindowContext.key]: true,
	[ChatContextKeys.chatModeKind.key]: ChatModeKind.Agent,
	[ChatContextKeys.inChatSession.key]: true,
	[ChatContextKeys.Editing.hasQuestionCarousel.key]: true,
	[ChatContextKeys.chatQuestionCarouselHasTerminal.key]: true,
};

const f1FalseCommandIds = [
	GENERATE_AGENT_INSTRUCTIONS_COMMAND_ID,
	GENERATE_ON_DEMAND_INSTRUCTIONS_COMMAND_ID,
	GENERATE_PROMPT_COMMAND_ID,
	GENERATE_SKILL_COMMAND_ID,
	GENERATE_AGENT_COMMAND_ID,
	GENERATE_HOOK_COMMAND_ID,
	INSERT_FORK_CONVERSATION_COMMAND_ID,
	INSERT_TROUBLESHOOT_COMMAND_ID,
	'workbench.action.chat.resetTrustedTools',
	'workbench.action.chat.editToolApproval',
	'workbench.action.chat.openFeatureSettings',
];

const sessionsWindowOnlyCommandIds = [
	CHAT_OPEN_ACTION_ID,
	'workbench.action.chat.openask',
	'workbench.action.chat.openedit',
	'workbench.action.chat.openagent',
	'workbench.action.chat.showContextUsage',
	'workbench.action.chat.clearInputHistory',
	'workbench.action.chat.focusTodosView',
	'workbench.action.chat.focusQuestionCarousel',
	'workbench.action.chat.previousQuestion',
	'workbench.action.chat.nextQuestion',
	'workbench.action.chat.focusQuestionCarouselTerminal',
	'workbench.action.chat.focusTip',
];

suite('ChatActions - default window Command Palette (INV-NO-COPILOT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Copilot factory and tool-approval commands are not registered in Command Palette', () => {
		for (const commandId of f1FalseCommandIds) {
			const item = findCommandPaletteItem(commandId);
			assert.strictEqual(item, undefined, `${commandId} must not appear in Command Palette (f1: false)`);
		}
	});

	test('Chat F1 commands stay in Command Palette for Agents Window only', () => {
		for (const commandId of sessionsWindowOnlyCommandIds) {
			const item = findCommandPaletteItem(commandId);
			assert.ok(item, `${commandId} should remain registered for Agents Window`);
			assert.ok(item.when, `${commandId} Command Palette item should have a when clause`);

			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`default Code window must hide ${commandId} in Command Palette`
			);
			assert.strictEqual(
				evalWhen(item.when, agentsWindowChatReady),
				true,
				`Agents Window may list ${commandId} in Command Palette`
			);
		}
	});
});
