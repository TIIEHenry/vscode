/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect, test } from '@playwright/test';
import { openFixture } from './utils.js';

// These fixtures drain virtual events using real animation frames. Renderer completion
// currently times out with tracing enabled; the cause is unresolved. Keep the real
// completion signal and DOM assertions below, and disable tracing only for this suite.
test.use({ trace: 'off' });

for (const modernUI of ['ModernUIOff', 'ModernUIOn']) {
	for (const [mode, tablists] of [
		['Default', 1],
		['ShowTabsSingle', 0],
		['ShowTabsNone', 0],
		['PinnedTabsOnSeparateRowAllPinned', 2],
		['PinnedTabsOnSeparateRowAllUnpinned', 2],
		['PinnedTabsOnSeparateRowMixed', 2],
	] as const) {
		test(`${modernUI} ${mode} renders its tab mode without fixture errors`, async ({ page }) => {
			await page.addInitScript(() => {
				window.addEventListener('message', event => {
					if (event.data?.type === 'component-explorer:ready' || event.data?.type === 'component-explorer:error') {
						document.documentElement.setAttribute('data-fixture-result', JSON.stringify({ ...event.data, error: event.data.error?.message }));
					}
				});
			});
			const errors: string[] = [];
			page.on('pageerror', error => errors.push(error.message));
			page.on('console', message => {
				if (message.type() === 'error' && message.text().includes('Editor tab bar must')) {
					errors.push(message.text());
				}
			});
			await openFixture(page, `editor/editorTabBar/editorTabBar/${modernUI}/${mode}/Dark`, '.editor-group-container');
			await expect(page.locator('html')).toHaveAttribute('data-fixture-result', /component-explorer:(ready|error)/);
			expect(errors).toEqual([]);
			await expect(page.locator('html')).toHaveAttribute('data-fixture-result', /component-explorer:ready/);
			const containers = page.locator('.tabs-container');
			await expect(containers).toHaveCount(tablists);
			for (const container of await containers.all()) {
				await expect(container).toHaveAttribute('aria-orientation', 'horizontal');
			}
			expect(errors).toEqual([]);
		});
	}
}
