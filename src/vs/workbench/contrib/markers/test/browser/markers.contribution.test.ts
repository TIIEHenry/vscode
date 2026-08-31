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
import { Markers } from '../../common/markers.js';
import { shouldRegisterProblemsStatusBar } from '../../browser/markers.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

suite('MarkersContribution - default window chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Problems panel view is gated to Agents Window', () => {
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

		const viewContainer = viewContainersRegistry.get(Markers.MARKERS_CONTAINER_ID);
		assert.ok(viewContainer, 'Problems panel container should remain registered');
		assert.strictEqual(viewContainer.hideIfEmpty, true, 'Problems panel container should hide when empty');
		assert.strictEqual(
			viewContainersRegistry.getViewContainerLocation(viewContainer),
			ViewContainerLocation.Panel,
			'Problems should remain a Panel container'
		);
		assert.strictEqual(viewContainer.windowEnablement, WindowEnablement.Sessions, 'Problems panel container should be Agents Window only');

		const problemsView = viewsRegistry.getView(Markers.MARKERS_VIEW_ID);
		assert.ok(problemsView, 'Problems view should remain registered');
		assert.strictEqual(problemsView.windowEnablement, WindowEnablement.Sessions, 'Problems view should be Agents Window only');

		const defaultWindow = { [IsSessionsWindowContext.key]: false };
		const agentsWindow = { [IsSessionsWindowContext.key]: true };

		assert.ok(problemsView.openCommandActionDescriptor?.keybindings?.when, 'Problems toggle keybinding should have a when clause');
		assert.strictEqual(
			evalWhen(problemsView.openCommandActionDescriptor!.keybindings!.when, defaultWindow),
			false,
			'default Code window must hide Problems toggle keybinding'
		);
		assert.strictEqual(
			evalWhen(problemsView.openCommandActionDescriptor!.keybindings!.when, agentsWindow),
			true,
			'Agents Window may keep Problems toggle keybinding'
		);
	});

	test('Problems status bar is gated to Agents Window', () => {
		assert.strictEqual(shouldRegisterProblemsStatusBar(false), false, 'default Code window must not register status.problems');
		assert.strictEqual(shouldRegisterProblemsStatusBar(true), true, 'Agents Window may register status.problems');
	});
});
