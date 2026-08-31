/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../platform/actions/common/actions.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from '../../common/contextkeys.js';

import '../../browser/actions/helpActions.js';

const ASK_VSCODE_ID = 'workbench.action.askVScode';

function evalWhen(when: ContextKeyExpression, values: Record<string, ContextKeyValue>): boolean {
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

suite('HelpActions - Ask @vscode Copilot chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('default window hides Ask @vscode from Command Palette and Help menu', () => {
		const helpMenuItem = MenuRegistry.getMenuItems(MenuId.MenubarHelpMenu)
			.filter(isIMenuItem)
			.find(item => item.command.id === ASK_VSCODE_ID);

		assert.ok(helpMenuItem, 'Ask @vscode should remain registered on Help menu for Agents Window');
		assert.ok(helpMenuItem.when, 'Help menu item should have a when clause');

		const commandPaletteIds = MenuRegistry.getMenuItems(MenuId.CommandPalette)
			.filter(isIMenuItem)
			.map(item => item.command.id);

		assert.strictEqual(
			commandPaletteIds.includes(ASK_VSCODE_ID),
			false,
			'Ask @vscode must not appear in Command Palette on any window'
		);

		const chatSetupVisible = {
			chatSetupHidden: false,
			chatSetupDisabledInWorkspace: false,
		};

		assert.strictEqual(
			evalWhen(helpMenuItem.when, { ...chatSetupVisible, [IsSessionsWindowContext.key]: false }),
			false,
			'default Code window must hide Ask @vscode in Help menu'
		);
		assert.strictEqual(
			evalWhen(helpMenuItem.when, { ...chatSetupVisible, [IsSessionsWindowContext.key]: true }),
			true,
			'Agents Window may show Ask @vscode in Help menu'
		);
	});
});
