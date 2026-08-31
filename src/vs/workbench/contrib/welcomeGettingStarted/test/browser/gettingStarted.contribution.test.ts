/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';

import '../../browser/gettingStarted.contribution.js';
import '../../../welcomeWalkthrough/browser/walkThrough.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function getHelpMenuItem(commandId: string) {
	return MenuRegistry.getMenuItems(MenuId.MenubarHelpMenu)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

function getCommandPaletteItem(commandId: string) {
	return MenuRegistry.getMenuItems(MenuId.CommandPalette)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

suite('GettingStartedContribution - Help full-page entries', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const commandIds = [
		'workbench.action.openWalkthrough',
		'welcome.showAllWalkthroughs',
		'workbench.action.showInteractivePlayground',
	] as const;

	const defaultWindow = { [IsSessionsWindowContext.key]: false };
	const agentsWindow = { [IsSessionsWindowContext.key]: true };

	test('Help menubar entries are gated to Agents Window', () => {
		for (const commandId of commandIds) {
			const helpMenuItem = getHelpMenuItem(commandId);
			assert.ok(helpMenuItem, `${commandId} Help menubar item should remain registered`);
			assert.ok(helpMenuItem.when, `${commandId} Help menubar item should have a when clause`);

			assert.strictEqual(
				evalWhen(helpMenuItem.when, defaultWindow),
				false,
				`${commandId} must hide from default Code window Help menu`
			);
			assert.strictEqual(
				evalWhen(helpMenuItem.when, agentsWindow),
				true,
				`${commandId} may show in Agents Window Help menu`
			);
		}
	});

	test('Command Palette entries are gated to Agents Window', () => {
		for (const commandId of commandIds) {
			const paletteItem = getCommandPaletteItem(commandId);
			assert.ok(paletteItem, `${commandId} command palette item should remain registered`);
			assert.ok(paletteItem.when, `${commandId} command palette item should have a when clause`);

			assert.strictEqual(
				evalWhen(paletteItem.when, defaultWindow),
				false,
				`${commandId} must hide from default Code window Command Palette`
			);
			assert.strictEqual(
				evalWhen(paletteItem.when, agentsWindow),
				true,
				`${commandId} may show in Agents Window Command Palette`
			);
		}
	});
});
