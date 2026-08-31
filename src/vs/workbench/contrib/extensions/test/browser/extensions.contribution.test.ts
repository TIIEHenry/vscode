/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry } from '../../../../common/views.js';
import { ActivityBarVisibleViewlets } from '../../../../common/activityViewletEnablement.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { registerAgentPluginsViews } from '../../../chat/browser/agentPluginsView.js';
import { ChatContextKeys } from '../../../chat/common/actions/chatContextKeys.js';
import { registerMcpServersViews } from '../../../mcp/browser/mcpServersView.js';
import { VIEWLET_ID } from '../../common/extensions.js';

import '../../browser/extensions.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

registerAgentPluginsViews();
registerMcpServersViews();

suite('ExtensionsContribution - default window Activity', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Extensions sidebar views respect optional Activity setting', () => {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);

		const viewContainer = viewContainersRegistry.get(VIEWLET_ID);
		assert.ok(viewContainer, 'Extensions view container should remain registered');
		assert.strictEqual(viewContainer.hideIfEmpty, true, 'Extensions sidebar container should hide when empty');

		const sidebarViews = viewsRegistry.getViews(viewContainer);
		assert.ok(sidebarViews.length > 0, 'Extensions container should expose registered sidebar occupants');

		const defaultWindowHidden = {
			[IsSessionsWindowContext.key]: false,
			[`config.${ActivityBarVisibleViewlets.extensions}`]: false,
		};
		const defaultWindowShown = {
			[IsSessionsWindowContext.key]: false,
			[`config.${ActivityBarVisibleViewlets.extensions}`]: true,
		};
		const agentsWindow = {
			[IsSessionsWindowContext.key]: true,
			[`config.${ActivityBarVisibleViewlets.extensions}`]: false,
		};

		for (const view of sidebarViews) {
			assert.ok(view.when, `${view.id} should have a when clause`);
			assert.strictEqual(
				evalWhen(view.when, defaultWindowHidden),
				false,
				`${view.id} must hide from default Code window when setting is off`
			);
		}

		const installedView = viewsRegistry.getView('workbench.views.extensions.installed');
		const popularView = viewsRegistry.getView('workbench.views.extensions.popular');
		const recommendedView = viewsRegistry.getView('extensions.recommendedList');
		const marketplaceView = viewsRegistry.getView('workbench.views.extensions.marketplace');
		const agentPluginsInstalledView = viewsRegistry.getView('workbench.views.agentPlugins.installed');
		const mcpInstalledView = viewsRegistry.getView('workbench.views.mcp.installed');

		assert.ok(installedView, 'Installed view should remain registered');
		assert.ok(popularView, 'Popular view should remain registered');
		assert.ok(recommendedView, 'Recommended view should remain registered');
		assert.ok(marketplaceView, 'Marketplace view should remain registered');
		assert.ok(agentPluginsInstalledView, 'Agent Plugins installed view should remain registered');
		assert.ok(mcpInstalledView, 'MCP Servers installed view should remain registered');

		assert.strictEqual(
			evalWhen(installedView.when, defaultWindowShown),
			true,
			'Installed view may show in default Code window when setting is on'
		);
		assert.strictEqual(
			evalWhen(popularView.when, { ...defaultWindowShown, hasInstalledExtensions: false, hasGallery: true }),
			true,
			'Popular view may show in default Code window when setting is on'
		);
		assert.strictEqual(
			evalWhen(recommendedView.when, { ...defaultWindowShown, hasGallery: true }),
			true,
			'Recommended view may show in default Code window when setting is on'
		);
		assert.strictEqual(
			evalWhen(marketplaceView.when, { ...defaultWindowShown, searchMarketplaceExtensions: true, hasGallery: true }),
			true,
			'Marketplace view may show in default Code window when setting is on'
		);
		assert.strictEqual(
			evalWhen(agentPluginsInstalledView.when, {
				...defaultWindowShown,
				defaultExtensionViews: true,
				hasInstalledAgentPlugins: true,
				[ChatContextKeys.Setup.hidden.key]: false,
			}),
			true,
			'Agent Plugins installed view may show in default Code window when setting is on'
		);
		assert.strictEqual(
			evalWhen(mcpInstalledView.when, {
				...defaultWindowShown,
				defaultExtensionViews: true,
				hasInstalledMcpServers: true,
				[ChatContextKeys.Setup.hidden.key]: false,
				[ChatContextKeys.Setup.disabledInWorkspace.key]: false,
			}),
			true,
			'MCP Servers installed view may show in default Code window when setting is on'
		);

		assert.strictEqual(
			evalWhen(installedView.when, agentsWindow),
			true,
			'Installed view may show in Agents Window Activity sidebar'
		);

		assert.ok(viewContainer.openCommandActionDescriptor?.keybindings?.when, 'Extensions open command keybinding should have a when clause');
		assert.strictEqual(
			evalWhen(viewContainer.openCommandActionDescriptor!.keybindings!.when, defaultWindowHidden),
			false,
			'default Code window must hide Extensions keybinding when setting is off'
		);
		assert.strictEqual(
			evalWhen(viewContainer.openCommandActionDescriptor!.keybindings!.when, defaultWindowShown),
			true,
			'default Code window may keep Extensions keybinding when setting is on'
		);
		assert.strictEqual(
			evalWhen(viewContainer.openCommandActionDescriptor!.keybindings!.when, agentsWindow),
			true,
			'Agents Window may keep Extensions keybinding'
		);
	});

	test('Extensions gear and Preferences menu items are gated to Agents Window', () => {
		const globalActivityItem = MenuRegistry.getMenuItems(MenuId.GlobalActivity)
			.filter(isIMenuItem)
			.find(item => item.command.id === VIEWLET_ID);

		const preferencesMenuItem = MenuRegistry.getMenuItems(MenuId.MenubarPreferencesMenu)
			.filter(isIMenuItem)
			.find(item => item.command.id === VIEWLET_ID);

		assert.ok(globalActivityItem, 'Extensions gear menu item should remain registered');
		assert.ok(preferencesMenuItem, 'Extensions preferences menu item should remain registered');
		assert.ok(globalActivityItem.when, 'Extensions gear menu item should have a when clause');
		assert.ok(preferencesMenuItem.when, 'Extensions preferences menu item should have a when clause');

		const defaultWindow = { [IsSessionsWindowContext.key]: false };
		const agentsWindow = { [IsSessionsWindowContext.key]: true };

		for (const item of [globalActivityItem, preferencesMenuItem]) {
			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`${item.command.id} must hide from default Code window gear/preferences`
			);
			assert.strictEqual(
				evalWhen(item.when, agentsWindow),
				true,
				`${item.command.id} may show in Agents Window gear/preferences`
			);
		}
	});
});
