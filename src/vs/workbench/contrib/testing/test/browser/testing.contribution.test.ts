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
import { Testing } from '../../common/constants.js';
import { TestingContextKeys } from '../../common/testingContextKeys.js';

import '../../browser/testing.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

suite('TestingContribution - default window Activity', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Testing sidebar views are gated to Agents Window', () => {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);

		const viewContainer = viewContainersRegistry.get(Testing.ViewletId);
		assert.ok(viewContainer, 'Testing view container should remain registered');
		assert.strictEqual(viewContainer.hideIfEmpty, true, 'Testing sidebar container should hide when empty');
		assert.strictEqual(viewContainer.order, 6, 'Testing sidebar container should keep viewlet order 6');

		const explorerView = viewsRegistry.getView(Testing.ExplorerViewId);
		const coverageView = viewsRegistry.getView(Testing.CoverageViewId);

		assert.ok(explorerView, 'Test Explorer view should remain registered');
		assert.ok(coverageView, 'Test Coverage view should remain registered');

		assert.ok(explorerView.when, 'Test Explorer view should have a when clause');
		assert.ok(coverageView.when, 'Test Coverage view should have a when clause');

		const defaultWindow = {
			[IsSessionsWindowContext.key]: false,
			[TestingContextKeys.providerCount.key]: 1,
			[TestingContextKeys.isTestCoverageOpen.key]: true,
		};
		const agentsWindowWithProviders = {
			[IsSessionsWindowContext.key]: true,
			[TestingContextKeys.providerCount.key]: 1,
			[TestingContextKeys.isTestCoverageOpen.key]: true,
		};
		const agentsWindowWithoutProviders = {
			[IsSessionsWindowContext.key]: true,
			[TestingContextKeys.providerCount.key]: 0,
			[TestingContextKeys.isTestCoverageOpen.key]: false,
		};

		assert.strictEqual(
			evalWhen(explorerView.when, defaultWindow),
			false,
			'default Code window must hide Test Explorer from Activity sidebar'
		);
		assert.strictEqual(
			evalWhen(explorerView.when, agentsWindowWithProviders),
			true,
			'Agents Window may show Test Explorer in Activity sidebar when providers exist'
		);
		assert.strictEqual(
			evalWhen(explorerView.when, agentsWindowWithoutProviders),
			false,
			'Test Explorer remains provider-gated even in Agents Window'
		);

		assert.strictEqual(
			evalWhen(coverageView.when, defaultWindow),
			false,
			'default Code window must hide Test Coverage from Activity sidebar'
		);
		assert.strictEqual(
			evalWhen(coverageView.when, agentsWindowWithProviders),
			true,
			'Agents Window may show Test Coverage in Activity sidebar when coverage is open'
		);
		assert.strictEqual(
			evalWhen(coverageView.when, agentsWindowWithoutProviders),
			false,
			'Test Coverage remains coverage-gated even in Agents Window'
		);

		assert.ok(viewContainer.openCommandActionDescriptor?.keybindings?.when, 'Testing open command keybinding should have a when clause');
		assert.strictEqual(
			evalWhen(viewContainer.openCommandActionDescriptor!.keybindings!.when, { [IsSessionsWindowContext.key]: false }),
			false,
			'default Code window must hide Testing keybinding'
		);
		assert.strictEqual(
			evalWhen(viewContainer.openCommandActionDescriptor!.keybindings!.when, { [IsSessionsWindowContext.key]: true }),
			true,
			'Agents Window may keep Testing keybinding'
		);
	});

	test('Test Results panel is gated to Agents Window', () => {
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);

		const panelContainer = viewContainersRegistry.get(Testing.ResultsPanelId);
		assert.ok(panelContainer, 'Test Results panel container should remain registered');
		assert.strictEqual(
			viewContainersRegistry.getViewContainerLocation(panelContainer),
			ViewContainerLocation.Panel,
			'Test Results should remain a Panel container'
		);
		assert.strictEqual(panelContainer.windowEnablement, WindowEnablement.Sessions, 'Test Results panel container should be Agents Window only');

		const resultsView = viewsRegistry.getView(Testing.ResultsViewId);
		assert.ok(resultsView, 'Test Results view should remain registered');
		assert.strictEqual(resultsView.windowEnablement, WindowEnablement.Sessions, 'Test Results view should be Agents Window only');
	});
});
