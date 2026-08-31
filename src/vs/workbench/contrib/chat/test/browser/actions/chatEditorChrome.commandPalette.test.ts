/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { isIMenuItem, isISubmenuItem, MenuId, MenuRegistry } from '../../../../../../platform/actions/common/actions.js';
import { IsDevelopmentContext } from '../../../../../../platform/contextkey/common/contextkeys.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from '../../../../../common/contextkeys.js';
import { RefreshAgentPluginMarketplacesCommandId } from '../../../browser/chat.js';
import { ChatContextKeys } from '../../../common/actions/chatContextKeys.js';

import '../../../browser/chat.shared.contribution.js';
import '../../../browser/agentPluginsView.js';
import '../../../browser/widget/chatContentParts/chatTipContentPart.js';

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

function getEditorContextGenerateCodeSubmenu() {
	return MenuRegistry.getMenuItems(MenuId.EditorContext)
		.filter(isISubmenuItem)
		.find(item => item.submenu === MenuId.ChatTextEditorMenu);
}

const chatReady: Record<string, ContextKeyValue> = {
	[ChatContextKeys.enabled.key]: true,
	[ChatContextKeys.Setup.hidden.key]: false,
	[ChatContextKeys.Setup.disabledInWorkspace.key]: false,
};

const defaultWindow: Record<string, ContextKeyValue> = {
	...chatReady,
	[IsSessionsWindowContext.key]: false,
};

const agentsWindow: Record<string, ContextKeyValue> = {
	...defaultWindow,
	[IsSessionsWindowContext.key]: true,
};

const agentsWindowDev: Record<string, ContextKeyValue> = {
	...agentsWindow,
	[IsDevelopmentContext.key]: true,
};

const sessionsWindowOnlyCommandIds = [
	'workbench.action.chat.resetDismissedTips',
	RefreshAgentPluginMarketplacesCommandId,
	'workbench.action.chat.voiceInputMode.simulate.step',
	'workbench.action.chat.voiceInputMode.simulate.clear',
	'workbench.action.chat.voiceInputMode.simulate.off',
	'workbench.action.chat.voiceInputMode.simulate.connecting',
	'workbench.action.chat.voiceInputMode.simulate.idle',
	'workbench.action.chat.voiceInputMode.simulate.listening',
	'workbench.action.chat.voiceInputMode.simulate.speaking',
	'workbench.action.chat.voiceInputMode.simulate.dictating',
	'workbench.action.chat.voiceInputMode.simulate.walkthrough.handsFree',
	'workbench.action.chat.voiceInputMode.simulate.walkthrough.keyboardHold',
	'workbench.action.chat.voiceInputMode.simulate.walkthrough.buttonHold',
	'workbench.action.chat.voiceInputMode.simulate.walkthrough.clickToggle',
];

suite('ChatEditorChrome - default window editor/input chrome (INV-NO-COPILOT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('default Code window hides Generate Code editor context submenu', () => {
		const item = getEditorContextGenerateCodeSubmenu();
		assert.ok(item, 'Generate Code submenu should remain registered for Agents Window');
		assert.ok(item.when, 'Editor context Generate Code item should have a when clause');

		assert.strictEqual(
			evalWhen(item.when, defaultWindow),
			false,
			'default Code window must hide Generate Code in editor context menu'
		);
		assert.strictEqual(
			evalWhen(item.when, agentsWindow),
			true,
			'Agents Window may show Generate Code in editor context menu'
		);
	});

	test('Chat editor/input chrome commands stay in Command Palette for Agents Window only', () => {
		for (const commandId of sessionsWindowOnlyCommandIds) {
			const item = getCommandPaletteItem(commandId);
			assert.ok(item, `${commandId} should remain registered for Agents Window`);
			assert.ok(item.when, `${commandId} Command Palette item should have a when clause`);

			const agentsContext = commandId.startsWith('workbench.action.chat.voiceInputMode.simulate')
				? agentsWindowDev
				: agentsWindow;

			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`default Code window must hide ${commandId} in Command Palette`
			);
			assert.strictEqual(
				evalWhen(item.when, agentsContext),
				true,
				`Agents Window may list ${commandId} in Command Palette`
			);
		}
	});
});
