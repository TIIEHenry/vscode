/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry } from '../../../../common/views.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { VIEWLET_ID } from '../../common/files.js';
import { explorerSidebarViewsWhen } from '../../browser/explorerViewlet.js';
import { TimelineHasProviderContext } from '../../../timeline/common/timelineService.js';

import '../../browser/explorerViewlet.js';
import '../../../outline/browser/outline.contribution.js';
import '../../../timeline/browser/timeline.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

suite('ExplorerContribution - default window Activity', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Files sidebar views and open command are available in the default Code window', () => {
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);

		const viewContainer = viewContainersRegistry.get(VIEWLET_ID);
		assert.ok(viewContainer, 'Files view container should remain registered');
		assert.strictEqual(viewContainer.hideIfEmpty, true, 'Files sidebar container should hide when empty');

		assert.strictEqual(explorerSidebarViewsWhen, undefined, 'Explorer sidebar views should not be sessions-gated');

		const defaultWindow = { [IsSessionsWindowContext.key]: false };
		const defaultWindowWithTimelineProvider = { ...defaultWindow, [TimelineHasProviderContext.key]: true };

		assert.strictEqual(
			viewContainer.openCommandActionDescriptor?.keybindings?.when,
			undefined,
			'Files open command keybinding should not be sessions-only'
		);

		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const sidebarViews = viewsRegistry.getViews(viewContainer);
		assert.ok(sidebarViews.length > 0, 'Files container should expose registered sidebar occupants');

		for (const view of sidebarViews) {
			if (view.id.includes('timeline')) {
				assert.ok(view.when, `${view.id} should keep provider gating`);
				assert.strictEqual(
					evalWhen(view.when, defaultWindowWithTimelineProvider),
					true,
					'Timeline may show in default Code window when a provider exists'
				);
				assert.strictEqual(
					evalWhen(view.when, defaultWindow),
					false,
					'Timeline remains provider-gated in default Code window'
				);
			} else if (view.when) {
				assert.strictEqual(
					evalWhen(view.when, defaultWindow),
					true,
					`${view.id} may show in default Code window Activity sidebar`
				);
			}
		}
	});
});
