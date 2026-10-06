/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Dimension } from '../../../../../base/browser/dom.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { GettingStartedPage } from '../../browser/gettingStarted.js';

suite('GettingStartedPage - layout media preservation (r11-1)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('layout does not clear media/step disposables or rebuild media when step is selected', () => {
		let mediaDisposablesCleared = false;
		let stepDisposablesCleared = false;
		let buildMediaComponentCalled = false;
		let layoutMarkdownCalled = false;

		const container = document.createElement('div');

		const mockContext = {
			detailsScrollbar: { value: undefined },
			categoriesPageScrollbar: undefined,
			detailsPageScrollbar: undefined,
			startList: { value: undefined },
			gettingStartedList: { value: undefined },
			recentlyOpenedList: { value: undefined },
			layoutMarkdown: () => { layoutMarkdownCalled = true; },
			container,
			editorInput: { selectedStep: 'stepA' },
			currentMediaType: 'image',
			mediaDisposables: { clear: () => { mediaDisposablesCleared = true; } },
			stepDisposables: { clear: () => { stepDisposablesCleared = true; } },
			buildMediaComponent: () => { buildMediaComponentCalled = true; },
		};

		// eslint-disable-next-line local/code-no-any-casts
		GettingStartedPage.prototype.layout.call(mockContext as any, new Dimension(800, 500));

		assert.strictEqual(mediaDisposablesCleared, false, 'mediaDisposables should not be cleared during layout');
		assert.strictEqual(stepDisposablesCleared, false, 'stepDisposables should not be cleared during layout');
		assert.strictEqual(buildMediaComponentCalled, false, 'buildMediaComponent should not be called during layout');
		assert.strictEqual(layoutMarkdownCalled, true, 'layoutMarkdown should be called during layout');
		assert.strictEqual(container.classList.contains('height-constrained'), true);
		assert.strictEqual(container.classList.contains('width-constrained'), false);
		assert.strictEqual(container.classList.contains('width-semi-constrained'), true);
	});
});
