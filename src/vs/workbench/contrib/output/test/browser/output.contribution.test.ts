/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainerLocation, WindowEnablement } from '../../../../common/views.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { OUTPUT_VIEW_ID } from '../../../../services/output/common/output.js';

import '../../browser/output.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

suite('OutputContribution - default window chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Output panel view is gated to Agents Window', () => {
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

		const viewContainer = viewContainersRegistry.get(OUTPUT_VIEW_ID);
		assert.ok(viewContainer, 'Output panel container should remain registered');
		assert.strictEqual(viewContainer.hideIfEmpty, true, 'Output panel container should hide when empty');
		assert.strictEqual(
			viewContainersRegistry.getViewContainerLocation(viewContainer),
			ViewContainerLocation.Panel,
			'Output should remain a Panel container'
		);
		assert.strictEqual(viewContainer.windowEnablement, WindowEnablement.Sessions, 'Output panel container should be Agents Window only');

		const outputView = viewsRegistry.getView(OUTPUT_VIEW_ID);
		assert.ok(outputView, 'Output view should remain registered');
		assert.strictEqual(outputView.windowEnablement, WindowEnablement.Sessions, 'Output view should be Agents Window only');

		const defaultWindow = { [IsSessionsWindowContext.key]: false };
		const agentsWindow = { [IsSessionsWindowContext.key]: true };

		assert.ok(outputView.openCommandActionDescriptor?.keybindings?.when, 'Output toggle keybinding should have a when clause');
		assert.strictEqual(
			evalWhen(outputView.openCommandActionDescriptor!.keybindings!.when, defaultWindow),
			false,
			'default Code window must hide Output toggle keybinding'
		);
		assert.strictEqual(
			evalWhen(outputView.openCommandActionDescriptor!.keybindings!.when, agentsWindow),
			true,
			'Agents Window may keep Output toggle keybinding'
		);
	});
});
