/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../../platform/actions/common/actions.js';
import { AGENT_HOST_ENABLED_CONTEXT_KEY } from '../../../../../../platform/agentHost/common/agentHostEnablementService.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IsWebContext } from '../../../../../../platform/contextkey/common/contextkeys.js';
import { IsSessionsWindowContext } from '../../../../../common/contextkeys.js';
import { registerChatDeveloperActions } from '../../../browser/actions/chatDeveloperActions.js';
import { ExportAgentHostDebugLogsAction } from '../../../browser/actions/exportAgentHostDebugLogsAction.js';
import { registerChatOpenAgentDebugPanelAction } from '../../../browser/actions/chatOpenAgentDebugPanelAction.js';
import { CHAT_DEBUG_ACTIVE_SESSION_IS_AGENT_HOST, CHAT_DEBUG_HAS_ACTIVE_SESSION } from '../../../common/chatDebugService.js';
import { ChatContextKeys } from '../../../common/actions/chatContextKeys.js';
import { registerAction2 } from '../../../../../../platform/actions/common/actions.js';

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

const defaultWindow: Record<string, ContextKeyValue> = {
	[ChatContextKeys.enabled.key]: true,
	[IsSessionsWindowContext.key]: false,
	[IsWebContext.key]: false,
	[AGENT_HOST_ENABLED_CONTEXT_KEY.key]: true,
};

const agentsWindow: Record<string, ContextKeyValue> = {
	...defaultWindow,
	[IsSessionsWindowContext.key]: true,
};

const agentsWindowWithDebugSession: Record<string, ContextKeyValue> = {
	...agentsWindow,
	[CHAT_DEBUG_HAS_ACTIVE_SESSION.key]: true,
	[CHAT_DEBUG_ACTIVE_SESSION_IS_AGENT_HOST.key]: false,
};

const browserDeveloperCommandIds = [
	'workbench.action.chat.logInputHistory',
	'workbench.action.chat.logChatIndex',
	'workbench.action.chat.inspectChatModel',
	'workbench.action.chat.inspectChatModelReferences',
	'workbench.action.chat.inspectAgentHostSubscriptions',
	'workbench.action.chat.clearRecentlyUsedLanguageModels',
	'workbench.action.chat.resetPermissionWarningDialogs',
	'workbench.action.chat.openCopilotCliStateFile',
	'workbench.action.chat.openAgentDebugPanel',
	'workbench.action.chat.importAgentDebugLog',
	'workbench.action.chat.exportAgentHostDebugLogs',
];

suite('ChatDeveloperActions - default window Command Palette (INV-NO-COPILOT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	suiteSetup(() => {
		registerChatDeveloperActions();
		registerChatOpenAgentDebugPanelAction();
		registerAction2(ExportAgentHostDebugLogsAction);
	});

	test('default Code window hides Chat developer palette entries', () => {
		for (const commandId of browserDeveloperCommandIds) {
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

	test('Export Agent Debug Log stays in Command Palette for Agents Window only', () => {
		const commandId = 'workbench.action.chat.exportAgentDebugLog';
		const item = getCommandPaletteItem(commandId);
		assert.ok(item, `${commandId} should remain registered for Agents Window`);
		assert.ok(item.when, `${commandId} Command Palette item should have a when clause`);

		assert.strictEqual(
			evalWhen(item.when, defaultWindow),
			false,
			`default Code window must hide ${commandId} in Command Palette`
		);
		assert.strictEqual(
			evalWhen(item.when, agentsWindowWithDebugSession),
			true,
			`Agents Window may list ${commandId} in Command Palette when a debug session is active`
		);
	});
});
