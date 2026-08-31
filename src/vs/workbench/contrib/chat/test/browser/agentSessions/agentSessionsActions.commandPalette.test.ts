/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../../platform/actions/common/actions.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from '../../../../../common/contextkeys.js';
import { AgentSessionsViewerOrientation } from '../../../browser/agentSessions/agentSessions.js';
import { HideAgentSessionsSidebar, ShowAgentSessionsSidebar, ToggleAgentSessionsSidebar, FocusAgentSessionsAction } from '../../../browser/agentSessions/agentSessionsActions.js';
import { ChatContextKeys } from '../../../common/actions/chatContextKeys.js';
import { ChatConfiguration } from '../../../common/constants.js';

import '../../../browser/agentSessions/agentSessions.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function getCommandPaletteWhen(commandId: string): ContextKeyExpression | undefined {
	const item = MenuRegistry.getMenuItems(MenuId.CommandPalette)
		.filter(isIMenuItem)
		.find(entry => entry.command.id === commandId);
	return item?.when;
}

const AGENT_SESSIONS_F1_COMMAND_IDS = [
	'workbench.action.chat.archiveAllAgentSessions',
	'workbench.action.chat.markAllAgentSessionsRead',
	'workbench.action.chat.clearHistory',
	ShowAgentSessionsSidebar.ID,
	HideAgentSessionsSidebar.ID,
	ToggleAgentSessionsSidebar.ID,
	FocusAgentSessionsAction.id,
] as const;

suite('AgentSessionsActions - default window Command Palette', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Agent Sessions management commands hide from default Code window Command Palette', () => {
		const defaultWindow = {
			[IsSessionsWindowContext.key]: false,
			[ChatContextKeys.enabled.key]: true,
			[`config.${ChatConfiguration.ChatViewSessionsEnabled}`]: true,
			[ChatContextKeys.agentSessionsViewerOrientation.key]: AgentSessionsViewerOrientation.Stacked,
		};
		const agentsWindow = {
			[IsSessionsWindowContext.key]: true,
			[ChatContextKeys.enabled.key]: true,
			[`config.${ChatConfiguration.ChatViewSessionsEnabled}`]: true,
			[ChatContextKeys.agentSessionsViewerOrientation.key]: AgentSessionsViewerOrientation.Stacked,
		};
		const agentsWindowSideBySide = {
			...agentsWindow,
			[ChatContextKeys.agentSessionsViewerOrientation.key]: AgentSessionsViewerOrientation.SideBySide,
		};

		for (const commandId of AGENT_SESSIONS_F1_COMMAND_IDS) {
			const when = getCommandPaletteWhen(commandId);
			assert.ok(when, `${commandId} should remain registered for Agents Window Command Palette`);

			assert.strictEqual(
				evalWhen(when, defaultWindow),
				false,
				`${commandId} must hide from default Code window Command Palette`
			);
		}

		assert.strictEqual(
			evalWhen(getCommandPaletteWhen('workbench.action.chat.archiveAllAgentSessions'), agentsWindow),
			true,
			'Agents Window may list Archive All in Command Palette'
		);
		assert.strictEqual(
			evalWhen(getCommandPaletteWhen('workbench.action.chat.markAllAgentSessionsRead'), agentsWindow),
			true,
			'Agents Window may list Mark All as Read in Command Palette'
		);
		assert.strictEqual(
			evalWhen(getCommandPaletteWhen('workbench.action.chat.clearHistory'), agentsWindow),
			true,
			'Agents Window may list Delete All Local Workspace Chat Sessions in Command Palette'
		);
		assert.strictEqual(
			evalWhen(getCommandPaletteWhen(ShowAgentSessionsSidebar.ID), agentsWindow),
			true,
			'Agents Window may list Show Agent Sessions Sidebar in Command Palette'
		);
		assert.strictEqual(
			evalWhen(getCommandPaletteWhen(HideAgentSessionsSidebar.ID), agentsWindowSideBySide),
			true,
			'Agents Window may list Hide Agent Sessions Sidebar in Command Palette'
		);
		assert.strictEqual(
			evalWhen(getCommandPaletteWhen(ToggleAgentSessionsSidebar.ID), agentsWindow),
			true,
			'Agents Window may list Toggle Agent Sessions Sidebar in Command Palette'
		);
		assert.strictEqual(
			evalWhen(getCommandPaletteWhen(FocusAgentSessionsAction.id), agentsWindow),
			true,
			'Agents Window may list Focus Agent Sessions in Command Palette'
		);
	});
});
