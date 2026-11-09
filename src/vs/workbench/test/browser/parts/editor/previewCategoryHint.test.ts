/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { PreviewCategorySwitcher } from '../../../../browser/parts/editor/previewCategorySwitcher.js';
import { PreviewCategoryService } from '../../../../services/editor/browser/previewCategoryService.js';
import { PreviewCategory } from '../../../../services/editor/common/previewCategoryService.js';
import { TestStorageService } from '../../../common/workbenchTestServices.js';

suite('PreviewCategorySwitcher hint', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('the unread hint is named in the tooltip and accessible name, not only by colour', () => {
		const disposables = store.add(new DisposableStore());
		const previewCategoryService = disposables.add(new PreviewCategoryService(disposables.add(new TestStorageService())));
		const parent = document.createElement('div');
		const switcher = disposables.add(new PreviewCategorySwitcher(parent, undefined, previewCategoryService));
		const terminalTab = switcher.domNode.querySelector(`[data-category="${PreviewCategory.Terminal}"]`) as HTMLElement;
		const read = () => ({ title: terminalTab.title, ariaLabel: terminalTab.getAttribute('aria-label') });

		previewCategoryService.setCategoryHint(PreviewCategory.Terminal, true);
		const hinted = read();
		previewCategoryService.setActiveCategory(PreviewCategory.Terminal);
		const active = read();

		assert.deepStrictEqual({ hinted, active }, {
			hinted: { title: 'Terminal, unread updates', ariaLabel: 'Terminal, unread updates' },
			active: { title: 'Terminal', ariaLabel: 'Terminal' },
		});
	});
});
