/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Parts } from '../../../../../workbench/services/layout/browser/layoutService.js';
import { LayoutController } from '../../browser/desktopSessionLayoutController.js';
import { createTestHarness, ITestLayoutHarness } from './layoutControllerTestUtils.js';

suite('LayoutController responsive sidebar [D7]', () => {

	const store = new DisposableStore();
	let harness: ITestLayoutHarness;

	function sidebarHiddenCalls(): boolean[] {
		return harness.setPartHiddenCalls.filter(call => call.part === Parts.SIDEBAR_PART).map(call => call.hidden);
	}

	teardown(() => store.clear());
	ensureNoDisposablesAreLeakedInTestSuite();

	test('[D7] hides the sidebar when the window is already small at startup with the editor and side pane open', () => {
		// Workbench layout has already measured a narrow window, and both the editor
		// and the auxiliary bar are open, before this controller is created.
		harness = createTestHarness(store, { mainContainerWidth: 800 });
		store.add(harness.instaService.createInstance(LayoutController));

		assert.deepStrictEqual(sidebarHiddenCalls(), [true]);
	});

	test('[D7] does not hide the sidebar at startup on a large window', () => {
		harness = createTestHarness(store, { mainContainerWidth: 2000 });
		store.add(harness.instaService.createInstance(LayoutController));

		assert.deepStrictEqual(sidebarHiddenCalls(), []);
	});

	test('[D7] does not auto-show a sidebar the user closed before a small window reloads', () => {
		harness = createTestHarness(store, {
			mainContainerWidth: 800,
			initialPartVisibility: new Map<Parts, boolean>([
				[Parts.SIDEBAR_PART, false],
				[Parts.EDITOR_PART, false],
				[Parts.AUXILIARYBAR_PART, false],
			]),
		});
		store.add(harness.instaService.createInstance(LayoutController));
		harness.setPartHiddenCalls = [];

		harness.layoutService.toggleSidePane();
		harness.layoutService.toggleSidePane();

		assert.ok(!sidebarHiddenCalls().includes(false), 'sidebar must not be auto-shown when it was closed before the reload');
	});
});
