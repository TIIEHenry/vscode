/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isISubmenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainerLocation, WindowEnablement } from '../../../../common/views.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { IContextKeyService } from '../../../../../platform/contextkey/common/contextkey.js';
import { Extensions as QuickAccessExtensions, IQuickAccessRegistry } from '../../../../../platform/quickinput/common/quickAccess.js';
import { BREAKPOINTS_VIEW_ID, CALLSTACK_VIEW_ID, CONTEXT_DEBUG_UX, DEBUG_PANEL_ID, REPL_VIEW_ID, VARIABLES_VIEW_ID, VIEWLET_ID, WATCH_VIEW_ID } from '../../common/debug.js';
import { DEBUG_QUICK_ACCESS_PREFIX } from '../../browser/debugCommands.js';
import { WelcomeView } from '../../browser/welcomeView.js';

import '../../browser/debug.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

suite('DebugContribution - default window Activity', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Run and Debug sidebar views are gated to Agents Window', () => {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);

		const viewContainer = viewContainersRegistry.get(VIEWLET_ID);
		assert.ok(viewContainer, 'Run and Debug view container should remain registered');
		assert.strictEqual(viewContainer.hideIfEmpty, true, 'Run and Debug sidebar container should hide when empty');

		const variablesView = viewsRegistry.getView(VARIABLES_VIEW_ID);
		const watchView = viewsRegistry.getView(WATCH_VIEW_ID);
		const callStackView = viewsRegistry.getView(CALLSTACK_VIEW_ID);
		const breakpointsView = viewsRegistry.getView(BREAKPOINTS_VIEW_ID);
		const welcomeView = viewsRegistry.getView(WelcomeView.ID);

		assert.ok(variablesView, 'Variables view should remain registered');
		assert.ok(watchView, 'Watch view should remain registered');
		assert.ok(callStackView, 'Call Stack view should remain registered');
		assert.ok(breakpointsView, 'Breakpoints view should remain registered');
		assert.ok(welcomeView, 'Welcome view should remain registered');

		assert.ok(variablesView.when, 'Variables view should have a when clause');
		assert.ok(watchView.when, 'Watch view should have a when clause');
		assert.ok(callStackView.when, 'Call Stack view should have a when clause');
		assert.ok(breakpointsView.when, 'Breakpoints view should have a when clause');
		assert.ok(welcomeView.when, 'Welcome view should have a when clause');

		const defaultWindow = { [IsSessionsWindowContext.key]: false, [CONTEXT_DEBUG_UX.key]: 'default' };
		const agentsWindow = { [IsSessionsWindowContext.key]: true, [CONTEXT_DEBUG_UX.key]: 'default' };
		const agentsWindowSimple = { [IsSessionsWindowContext.key]: true, [CONTEXT_DEBUG_UX.key]: 'simple' };

		for (const view of [variablesView, watchView, callStackView, breakpointsView]) {
			assert.strictEqual(
				evalWhen(view.when, defaultWindow),
				false,
				`${view.id} must hide from default Code window Activity sidebar`
			);
			assert.strictEqual(
				evalWhen(view.when, agentsWindow),
				true,
				`${view.id} may show in Agents Window Activity sidebar`
			);
		}

		assert.strictEqual(
			evalWhen(welcomeView.when, defaultWindow),
			false,
			'default Code window must hide Run and Debug welcome view from Activity sidebar'
		);
		assert.strictEqual(
			evalWhen(welcomeView.when, agentsWindowSimple),
			true,
			'Agents Window may show Run and Debug welcome view in Activity sidebar'
		);

		assert.ok(viewContainer.openCommandActionDescriptor?.keybindings?.when, 'Run and Debug open command keybinding should have a when clause');
		assert.strictEqual(
			evalWhen(viewContainer.openCommandActionDescriptor!.keybindings!.when, { [IsSessionsWindowContext.key]: false }),
			false,
			'default Code window must hide Run and Debug keybinding'
		);
		assert.strictEqual(
			evalWhen(viewContainer.openCommandActionDescriptor!.keybindings!.when, { [IsSessionsWindowContext.key]: true }),
			true,
			'Agents Window may keep Run and Debug keybinding'
		);
	});

	test('Run menubar and editor Run/Debug split button are gated to Agents Window', () => {
		const runMenubarItem = MenuRegistry.getMenuItems(MenuId.MenubarMainMenu)
			.filter(isISubmenuItem)
			.find(item => item.submenu === MenuId.MenubarDebugMenu);

		assert.ok(runMenubarItem, 'Run menubar submenu should remain registered');
		assert.ok(runMenubarItem.when, 'Run menubar submenu should have a when clause');

		const editorTitleRunItem = MenuRegistry.getMenuItems(MenuId.EditorTitle)
			.filter(isISubmenuItem)
			.find(item => item.submenu === MenuId.EditorTitleRun);

		assert.ok(editorTitleRunItem, 'Editor title Run or Debug split button should remain registered');
		assert.ok(editorTitleRunItem.when, 'Editor title Run or Debug split button should have a when clause');

		const defaultWindow = { [IsSessionsWindowContext.key]: false };
		const agentsWindow = { [IsSessionsWindowContext.key]: true };

		for (const item of [runMenubarItem, editorTitleRunItem]) {
			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`${item.submenu?.id ?? 'menu item'} must hide from default Code window`
			);
			assert.strictEqual(
				evalWhen(item.when, agentsWindow),
				true,
				`${item.submenu?.id ?? 'menu item'} may show in Agents Window`
			);
		}
	});

	test('Debug Console panel is gated to Agents Window', () => {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);

		const panelContainer = viewContainersRegistry.get(DEBUG_PANEL_ID);
		assert.ok(panelContainer, 'Debug Console panel container should remain registered');
		assert.strictEqual(
			viewContainersRegistry.getViewContainerLocation(panelContainer),
			ViewContainerLocation.Panel,
			'Debug Console should remain a Panel container'
		);
		assert.strictEqual(panelContainer.windowEnablement, WindowEnablement.Sessions, 'Debug Console panel container should be Agents Window only');

		const replView = viewsRegistry.getView(REPL_VIEW_ID);
		assert.ok(replView, 'Debug Console view should remain registered');
		assert.strictEqual(replView.windowEnablement, WindowEnablement.Sessions, 'Debug Console view should be Agents Window only');

		const defaultWindow = { [IsSessionsWindowContext.key]: false };
		const agentsWindow = { [IsSessionsWindowContext.key]: true };

		assert.ok(replView.openCommandActionDescriptor?.keybindings?.when, 'Debug Console toggle keybinding should have a when clause');
		assert.strictEqual(
			evalWhen(replView.openCommandActionDescriptor!.keybindings!.when, defaultWindow),
			false,
			'default Code window must hide Debug Console toggle keybinding'
		);
		assert.strictEqual(
			evalWhen(replView.openCommandActionDescriptor!.keybindings!.when, agentsWindow),
			true,
			'Agents Window may keep Debug Console toggle keybinding'
		);
	});

	test('Start Debugging command center quick access is gated to Agents Window', () => {
		const quickAccessRegistry = Registry.as<IQuickAccessRegistry>(QuickAccessExtensions.Quickaccess);
		const mockContextKeyService = { contextMatchesRules: () => true } as unknown as IContextKeyService;
		const startDebugProvider = quickAccessRegistry.getQuickAccessProvider(DEBUG_QUICK_ACCESS_PREFIX, mockContextKeyService);

		assert.ok(startDebugProvider, 'Start Debugging quick access provider should remain registered');
		assert.ok(startDebugProvider.when, 'Start Debugging quick access provider should have a when clause');

		const defaultWindow = { [IsSessionsWindowContext.key]: false };
		const agentsWindow = { [IsSessionsWindowContext.key]: true };

		assert.strictEqual(
			evalWhen(startDebugProvider.when, defaultWindow),
			false,
			'default Code window must hide Start Debugging from Command Center'
		);
		assert.strictEqual(
			evalWhen(startDebugProvider.when, agentsWindow),
			true,
			'Agents Window may keep Start Debugging in Command Center'
		);
	});
});
