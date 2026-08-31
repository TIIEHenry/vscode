/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../../platform/actions/common/actions.js';
import { AGENT_HOST_ENABLED_CONTEXT_KEY } from '../../../../../../platform/agentHost/common/agentHostEnablementService.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from '../../../../../common/contextkeys.js';
import { AICustomizationManagementCommands } from '../../../common/aiCustomizationWorkspaceService.js';
import { ChatContextKeys } from '../../../common/actions/chatContextKeys.js';
import { MANAGE_CHAT_COMMAND_ID } from '../../../common/constants.js';
import { ConfigureToolSets } from '../../../browser/tools/toolSetsContribution.js';

import '../../../browser/chat.shared.contribution.js';
import '../../../browser/agentSessions/agentHost/agentHostSettings.contribution.js';

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
	[AGENT_HOST_ENABLED_CONTEXT_KEY.key]: true,
};

const sessionsWindowOnlyCommandIds = [
	MANAGE_CHAT_COMMAND_ID,
	'workbench.action.openLanguageModelsJson',
	AICustomizationManagementCommands.OpenEditor,
	AICustomizationManagementCommands.GenerateDebugReport,
	'workbench.action.chat.export',
	'workbench.action.chat.import',
	'workbench.action.chat.manageLanguageModelAuthentication',
	ConfigureToolSets.ID,
	'workbench.action.chat.openAgentHostSettings',
	'workbench.action.chat.resetGrowthSession',
	'chat.pet.developer.resetSize',
];

suite('ChatManagementActions - default window Command Palette (INV-NO-COPILOT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('default Code window hides Chat management and setup palette entries', () => {
		for (const commandId of sessionsWindowOnlyCommandIds) {
			const item = findCommandPaletteItem(commandId);
			assert.ok(item, `${commandId} should remain registered for Agents Window`);
			assert.ok(item.when, `${commandId} Command Palette item should have a when clause`);
			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`default Code window must hide ${commandId} in Command Palette`
			);
		}
	});

	test('default Code window hides chatSessions New Session Editor palette entries', () => {
		const openNewSessionEditorItems = MenuRegistry.getMenuItems(MenuId.CommandPalette)
			.filter(isIMenuItem)
			.filter(item => item.command.id.startsWith('workbench.action.chat.openNewSessionEditor.'));

		assert.ok(openNewSessionEditorItems.length > 0, 'expected at least one openNewSessionEditor Command Palette entry');
		for (const item of openNewSessionEditorItems) {
			assert.ok(item.when, `${item.command.id} Command Palette item should have a when clause`);
			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`default Code window must hide ${item.command.id} in Command Palette`
			);
		}
	});
});
