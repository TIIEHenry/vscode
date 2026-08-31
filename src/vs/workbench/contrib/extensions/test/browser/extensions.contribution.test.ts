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
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { VIEWLET_ID } from '../../common/extensions.js';

import '../../browser/extensions.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

suite('ExtensionsContribution - default window Activity', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Extensions sidebar views are gated to Agents Window', () => {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);

		const viewContainer = viewContainersRegistry.get(VIEWLET_ID);
		assert.ok(viewContainer, 'Extensions view container should remain registered');
		assert.strictEqual(viewContainer.hideIfEmpty, true, 'Extensions sidebar container should hide when empty');

		const installedView = viewsRegistry.getView('workbench.views.extensions.installed');
		const popularView = viewsRegistry.getView('workbench.views.extensions.popular');
		const recommendedView = viewsRegistry.getView('extensions.recommendedList');
		const marketplaceView = viewsRegistry.getView('workbench.views.extensions.marketplace');

		assert.ok(installedView, 'Installed view should remain registered');
		assert.ok(popularView, 'Popular view should remain registered');
		assert.ok(recommendedView, 'Recommended view should remain registered');
		assert.ok(marketplaceView, 'Marketplace view should remain registered');

		assert.ok(installedView.when, 'Installed view should have a when clause');
		assert.ok(popularView.when, 'Popular view should have a when clause');
		assert.ok(recommendedView.when, 'Recommended view should have a when clause');
		assert.ok(marketplaceView.when, 'Marketplace view should have a when clause');

		const defaultWindow = { [IsSessionsWindowContext.key]: false };
		const agentsWindow = { [IsSessionsWindowContext.key]: true };

		for (const view of [installedView, popularView, recommendedView, marketplaceView]) {
			assert.strictEqual(
				evalWhen(view.when, defaultWindow),
				false,
				`${view.id} must hide from default Code window Activity sidebar`
			);
		}

		assert.strictEqual(
			evalWhen(installedView.when, agentsWindow),
			true,
			'Installed view may show in Agents Window Activity sidebar'
		);
		assert.strictEqual(
			evalWhen(popularView.when, { [IsSessionsWindowContext.key]: true, hasInstalledExtensions: false, hasGallery: true }),
			true,
			'Popular view may show in Agents Window Activity sidebar'
		);
		assert.strictEqual(
			evalWhen(recommendedView.when, { [IsSessionsWindowContext.key]: true, hasGallery: true }),
			true,
			'Recommended view may show in Agents Window Activity sidebar'
		);
		assert.strictEqual(
			evalWhen(marketplaceView.when, { [IsSessionsWindowContext.key]: true, searchMarketplaceExtensions: true, hasGallery: true }),
			true,
			'Marketplace view may show in Agents Window Activity sidebar'
		);

		assert.ok(viewContainer.openCommandActionDescriptor?.keybindings?.when, 'Extensions open command keybinding should have a when clause');
		assert.strictEqual(
			evalWhen(viewContainer.openCommandActionDescriptor!.keybindings!.when, { [IsSessionsWindowContext.key]: false }),
			false,
			'default Code window must hide Extensions keybinding'
		);
		assert.strictEqual(
			evalWhen(viewContainer.openCommandActionDescriptor!.keybindings!.when, { [IsSessionsWindowContext.key]: true }),
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
