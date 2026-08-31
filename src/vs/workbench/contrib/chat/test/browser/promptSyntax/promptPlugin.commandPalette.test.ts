/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../../platform/actions/common/actions.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../../platform/contextkey/common/contextkey.js';
import { MockContextKeyService } from '../../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { IsSessionsWindowContext } from '../../../../../common/contextkeys.js';
import { AgentPluginCommandsContribution } from '../../../browser/agentPluginCommands.js';
import { ForceUpdateAgentPluginsCommandId, UpdateAgentPluginsCommandId, UpdatingAgentPluginsContext } from '../../../browser/chat.js';
import { CONFIGURE_PROMPTS_ACTION_ID } from '../../../browser/promptSyntax/runPromptAction.js';
import { ChatContextKeys } from '../../../common/actions/chatContextKeys.js';

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
	[UpdatingAgentPluginsContext.key]: false,
};

const agentsWindow: Record<string, ContextKeyValue> = {
	...defaultWindow,
	[IsSessionsWindowContext.key]: true,
};

const sessionsWindowOnlyCommandIds = [
	'workbench.action.chat.run.prompt',
	CONFIGURE_PROMPTS_ACTION_ID,
	'workbench.action.chat.configure.skills',
	'workbench.action.chat.configure.instructions',
	'workbench.command.new.untitled.prompt',
	'workbench.action.chat.configure.hooks',
	'workbench.action.chat.managePlugins',
	'workbench.action.chat.installPluginFromSource',
	'workbench.action.chat.managePluginMarketplaces',
	'workbench.action.chat.createPlugin',
	UpdateAgentPluginsCommandId,
	ForceUpdateAgentPluginsCommandId,
] as const;

suite('PromptPluginActions - default window Command Palette (INV-NO-COPILOT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	suiteSetup(() => {
		new AgentPluginCommandsContribution(new MockContextKeyService());
	});

	test('prompt, skill, hook, and plugin factory commands stay in Command Palette for Agents Window only', () => {
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
				evalWhen(item.when, agentsWindow),
				true,
				`Agents Window may list ${commandId} in Command Palette`
			);
		}
	});
});
