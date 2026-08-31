/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, isISubmenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainerLocation, WindowEnablement } from '../../../../common/views.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { TERMINAL_VIEW_ID, TerminalCommandId } from '../../common/terminal.js';

import '../../browser/terminal.contribution.js';

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

suite('TerminalContribution - default window chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Terminal panel view is gated to Agents Window', () => {
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

		const viewContainer = viewContainersRegistry.get(TERMINAL_VIEW_ID);
		assert.ok(viewContainer, 'Terminal panel container should remain registered');
		assert.strictEqual(viewContainer.hideIfEmpty, true, 'Terminal panel container should hide when empty');
		assert.strictEqual(
			viewContainersRegistry.getViewContainerLocation(viewContainer),
			ViewContainerLocation.Panel,
			'Terminal should remain a Panel container'
		);
		assert.strictEqual(viewContainer.windowEnablement, WindowEnablement.Sessions, 'Terminal panel container should be Agents Window only');

		const terminalView = viewsRegistry.getView(TERMINAL_VIEW_ID);
		assert.ok(terminalView, 'Terminal view should remain registered');
		assert.strictEqual(terminalView.windowEnablement, WindowEnablement.Sessions, 'Terminal view should be Agents Window only');

		const defaultWindow = { [IsSessionsWindowContext.key]: false };
		const agentsWindow = { [IsSessionsWindowContext.key]: true };

		assert.ok(terminalView.openCommandActionDescriptor?.keybindings?.when, 'Terminal toggle keybinding should have a when clause');
		assert.strictEqual(
			evalWhen(terminalView.openCommandActionDescriptor!.keybindings!.when, defaultWindow),
			false,
			'default Code window must hide Terminal toggle keybinding'
		);
		assert.strictEqual(
			evalWhen(terminalView.openCommandActionDescriptor!.keybindings!.when, agentsWindow),
			true,
			'Agents Window may keep Terminal toggle keybinding'
		);
	});

	test('Terminal menubar and New Terminal command are gated to Agents Window', () => {
		const terminalMenubarItem = MenuRegistry.getMenuItems(MenuId.MenubarMainMenu)
			.filter(isISubmenuItem)
			.find(item => item.submenu === MenuId.MenubarTerminalMenu);

		assert.ok(terminalMenubarItem, 'Terminal menubar submenu should remain registered');
		assert.ok(terminalMenubarItem.when, 'Terminal menubar submenu should have a when clause');

		const newTerminalMenuItem = MenuRegistry.getMenuItems(MenuId.MenubarTerminalMenu)
			.filter(isIMenuItem)
			.find(item => item.command.id === TerminalCommandId.New);

		assert.ok(newTerminalMenuItem, 'New Terminal menubar item should remain registered');
		assert.ok(newTerminalMenuItem.when, 'New Terminal menubar item should have a when clause');

		const newTerminalPaletteItem = getCommandPaletteItem(TerminalCommandId.New);
		assert.ok(newTerminalPaletteItem, 'New Terminal command palette item should remain registered');
		assert.ok(newTerminalPaletteItem.when, 'New Terminal command palette item should have a when clause');

		const defaultWindow = { [IsSessionsWindowContext.key]: false, terminalProcessSupported: true };
		const agentsWindow = { [IsSessionsWindowContext.key]: true, terminalProcessSupported: true };

		for (const item of [terminalMenubarItem, newTerminalMenuItem, newTerminalPaletteItem]) {
			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`${item.command?.id ?? item.submenu?.id ?? 'menu item'} must hide from default Code window`
			);
			assert.strictEqual(
				evalWhen(item.when, agentsWindow),
				true,
				`${item.command?.id ?? item.submenu?.id ?? 'menu item'} may show in Agents Window`
			);
		}
	});
});
