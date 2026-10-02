/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { Parts } from '../../../../../workbench/services/layout/browser/layoutService.js';
import { LayoutController } from '../../browser/desktopSessionLayoutController.js';
import { createTestHarness, ITestLayoutHarness, makeSession } from './layoutControllerTestUtils.js';

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

	test('[D7] shows the sidebar again when the side pane closes after the startup hide', () => {
		// The hide runs from the base constructor. Its memory has to outlive
		// subclass field initialization, or closing the aux bar never shows the list.
		harness = createTestHarness(store, { mainContainerWidth: 800 });
		store.add(harness.instaService.createInstance(LayoutController));
		assert.deepStrictEqual(sidebarHiddenCalls(), [true]);

		harness.partVisibility.set(Parts.AUXILIARYBAR_PART, false);
		harness.onDidChangePartVisibility.fire({ partId: Parts.AUXILIARYBAR_PART, visible: false });

		assert.deepStrictEqual(sidebarHiddenCalls(), [true, false]);
	});

	test('[D7] does not hide the sidebar at startup on a large window', () => {
		harness = createTestHarness(store, { mainContainerWidth: 2000 });
		store.add(harness.instaService.createInstance(LayoutController));

		assert.deepStrictEqual(sidebarHiddenCalls(), []);
	});

	test('[D7] retries the initial hide on the next layout when hiding the sidebar throws before the grid exists', () => {
		harness = createTestHarness(store, { mainContainerWidth: 800 });
		let gridReady = false;
		const originalSetPartHidden = harness.layoutService.setPartHidden.bind(harness.layoutService);
		harness.layoutService.setPartHidden = (hidden: boolean, part: Parts) => {
			if (!gridReady && part === Parts.SIDEBAR_PART) {
				throw new TypeError("Cannot read properties of undefined (reading 'setViewVisible')");
			}
			originalSetPartHidden(hidden, part);
		};
		store.add(harness.instaService.createInstance(LayoutController));

		assert.deepStrictEqual(sidebarHiddenCalls(), []);

		gridReady = true;
		harness.onDidLayoutMainContainer.fire({ width: harness.mainContainerWidth, height: 1000 });
		harness.onDidLayoutMainContainer.fire({ width: harness.mainContainerWidth, height: 1000 });

		assert.deepStrictEqual(sidebarHiddenCalls(), [true]);

		harness.partVisibility.set(Parts.AUXILIARYBAR_PART, false);
		harness.onDidChangePartVisibility.fire({ partId: Parts.AUXILIARYBAR_PART, visible: false });

		assert.deepStrictEqual(sidebarHiddenCalls(), [true, false]);
	});

	test('[D7] does not show an auto-hidden sidebar when a second session becomes visible', () => {
		// The list was hidden to make room. Opening another session suspends the
		// rule; it must not hand that room back. Closing the side pane still shows it.
		harness = createTestHarness(store, { mainContainerWidth: 800 });
		store.add(harness.instaService.createInstance(LayoutController));
		assert.deepStrictEqual(sidebarHiddenCalls(), [true]);
		harness.setPartHiddenCalls = [];

		harness.visibleSessionsObs.set([
			makeSession(URI.parse('session:1')),
			makeSession(URI.parse('session:2')),
		], undefined);

		assert.deepStrictEqual(sidebarHiddenCalls(), [], 'multi-session must not auto-show the sidebar');

		harness.visibleSessionsObs.set([makeSession(URI.parse('session:1'))], undefined);
		harness.partVisibility.set(Parts.AUXILIARYBAR_PART, false);
		harness.onDidChangePartVisibility.fire({ partId: Parts.AUXILIARYBAR_PART, visible: false });

		assert.deepStrictEqual(sidebarHiddenCalls(), [false], 'closing the side pane still shows the sidebar the controller hid');
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
