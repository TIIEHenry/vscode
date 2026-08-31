/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { Extensions as ViewExtensions, IViewContainersRegistry } from '../../../../common/views.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { VIEWLET_ID } from '../../common/files.js';
import { explorerSidebarViewsWhen } from '../../browser/explorerViewlet.js';

import '../../browser/explorerViewlet.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

suite('ExplorerContribution - default window Activity', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Files sidebar views and open command are gated to Agents Window', () => {
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);

		const viewContainer = viewContainersRegistry.get(VIEWLET_ID);
		assert.ok(viewContainer, 'Files view container should remain registered');
		assert.strictEqual(viewContainer.hideIfEmpty, true, 'Files sidebar container should hide when empty');

		assert.ok(explorerSidebarViewsWhen, 'Explorer sidebar views should have a when clause');
		const defaultWindow = { [IsSessionsWindowContext.key]: false };
		const agentsWindow = { [IsSessionsWindowContext.key]: true };

		assert.strictEqual(
			evalWhen(explorerSidebarViewsWhen, defaultWindow),
			false,
			'default Code window must hide Files sidebar views from Activity sidebar'
		);
		assert.strictEqual(
			evalWhen(explorerSidebarViewsWhen, agentsWindow),
			true,
			'Agents Window may show Files sidebar views in Activity sidebar'
		);

		assert.ok(viewContainer.openCommandActionDescriptor?.keybindings?.when, 'Files open command keybinding should have a when clause');
		assert.strictEqual(
			evalWhen(viewContainer.openCommandActionDescriptor!.keybindings!.when, defaultWindow),
			false,
			'default Code window must hide Files keybinding'
		);
		assert.strictEqual(
			evalWhen(viewContainer.openCommandActionDescriptor!.keybindings!.when, agentsWindow),
			true,
			'Agents Window may keep Files keybinding'
		);
	});
});
