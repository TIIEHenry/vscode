/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../base/browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	applyDockInputMaxHeight,
	applyLeafWidthClasses,
	CONVERSATION_DOCK_INPUT_MAX_HEIGHT,
	CONVERSATION_LEAF_TIGHT_WIDTH,
	conversationDockInputMaxHeight,
	conversationLeafWidthBucket,
	isConversationLeafCompact,
	isConversationLeafMedium,
	isConversationLeafNarrow,
	isConversationLeafTight,
} from '../../browser/conversationNarrowLayout.js';

suite('ConversationNarrowLayout', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('width buckets (w1000, w600, w599, w450, w449, w299) and .is-tight class below 600', () => {
		assert.strictEqual(CONVERSATION_LEAF_TIGHT_WIDTH, 600);

		// w1000: full, not tight
		assert.strictEqual(conversationLeafWidthBucket(1000), 'full');
		assert.strictEqual(isConversationLeafTight(1000), false);
		assert.strictEqual(isConversationLeafMedium(1000), false);
		assert.strictEqual(isConversationLeafNarrow(1000), false);
		assert.strictEqual(isConversationLeafCompact(1000), false);

		// w600: medium, not tight
		assert.strictEqual(conversationLeafWidthBucket(600), 'medium');
		assert.strictEqual(isConversationLeafTight(600), false);
		assert.strictEqual(isConversationLeafMedium(600), true);
		assert.strictEqual(isConversationLeafNarrow(600), false);
		assert.strictEqual(isConversationLeafCompact(600), false);

		// w599: medium, tight
		assert.strictEqual(conversationLeafWidthBucket(599), 'medium');
		assert.strictEqual(isConversationLeafTight(599), true);
		assert.strictEqual(isConversationLeafMedium(599), true);
		assert.strictEqual(isConversationLeafNarrow(599), false);
		assert.strictEqual(isConversationLeafCompact(599), false);

		// w450: medium, tight
		assert.strictEqual(conversationLeafWidthBucket(450), 'medium');
		assert.strictEqual(isConversationLeafTight(450), true);
		assert.strictEqual(isConversationLeafMedium(450), true);
		assert.strictEqual(isConversationLeafNarrow(450), false);
		assert.strictEqual(isConversationLeafCompact(450), false);

		// w449: narrow, tight
		assert.strictEqual(conversationLeafWidthBucket(449), 'narrow');
		assert.strictEqual(isConversationLeafTight(449), true);
		assert.strictEqual(isConversationLeafMedium(449), false);
		assert.strictEqual(isConversationLeafNarrow(449), true);
		assert.strictEqual(isConversationLeafCompact(449), false);

		// w299: min, tight
		assert.strictEqual(conversationLeafWidthBucket(299), 'min');
		assert.strictEqual(isConversationLeafTight(299), true);
		assert.strictEqual(isConversationLeafMedium(299), false);
		assert.strictEqual(isConversationLeafNarrow(299), true);
		assert.strictEqual(isConversationLeafCompact(299), true);

		// Verify applyLeafWidthClasses sets classes and dataset correctly
		const element = mainWindow.document.createElement('div');

		applyLeafWidthClasses(element, 1000);
		assert.strictEqual(element.dataset.conversationWidth, 'full');
		assert.strictEqual(element.classList.contains('is-medium'), false);
		assert.strictEqual(element.classList.contains('is-narrow'), false);
		assert.strictEqual(element.classList.contains('is-compact'), false);
		assert.strictEqual(element.classList.contains('is-tight'), false);

		applyLeafWidthClasses(element, 600);
		assert.strictEqual(element.dataset.conversationWidth, 'medium');
		assert.strictEqual(element.classList.contains('is-medium'), true);
		assert.strictEqual(element.classList.contains('is-narrow'), false);
		assert.strictEqual(element.classList.contains('is-compact'), false);
		assert.strictEqual(element.classList.contains('is-tight'), false);

		applyLeafWidthClasses(element, 599);
		assert.strictEqual(element.dataset.conversationWidth, 'medium');
		assert.strictEqual(element.classList.contains('is-medium'), true);
		assert.strictEqual(element.classList.contains('is-narrow'), false);
		assert.strictEqual(element.classList.contains('is-compact'), false);
		assert.strictEqual(element.classList.contains('is-tight'), true);

		applyLeafWidthClasses(element, 450);
		assert.strictEqual(element.dataset.conversationWidth, 'medium');
		assert.strictEqual(element.classList.contains('is-medium'), true);
		assert.strictEqual(element.classList.contains('is-narrow'), false);
		assert.strictEqual(element.classList.contains('is-compact'), false);
		assert.strictEqual(element.classList.contains('is-tight'), true);

		applyLeafWidthClasses(element, 449);
		assert.strictEqual(element.dataset.conversationWidth, 'narrow');
		assert.strictEqual(element.classList.contains('is-medium'), false);
		assert.strictEqual(element.classList.contains('is-narrow'), true);
		assert.strictEqual(element.classList.contains('is-compact'), false);
		assert.strictEqual(element.classList.contains('is-tight'), true);

		applyLeafWidthClasses(element, 299);
		assert.strictEqual(element.dataset.conversationWidth, 'min');
		assert.strictEqual(element.classList.contains('is-medium'), false);
		assert.strictEqual(element.classList.contains('is-narrow'), true);
		assert.strictEqual(element.classList.contains('is-compact'), true);
		assert.strictEqual(element.classList.contains('is-tight'), true);
	});

	test('zero/negative width keeps last bucket and does not set dataset/classes on fresh element', () => {
		const freshElement = mainWindow.document.createElement('div');
		applyLeafWidthClasses(freshElement, 0);
		assert.strictEqual(freshElement.dataset.conversationWidth, undefined);
		assert.strictEqual(freshElement.className, '');

		applyLeafWidthClasses(freshElement, -100);
		assert.strictEqual(freshElement.dataset.conversationWidth, undefined);
		assert.strictEqual(freshElement.className, '');

		const element = mainWindow.document.createElement('div');
		applyLeafWidthClasses(element, 600);
		assert.strictEqual(element.dataset.conversationWidth, 'medium');
		assert.strictEqual(element.classList.contains('is-medium'), true);
		assert.strictEqual(element.classList.contains('is-tight'), false);

		applyLeafWidthClasses(element, 0);
		assert.strictEqual(element.dataset.conversationWidth, 'medium');
		assert.strictEqual(element.classList.contains('is-medium'), true);
		assert.strictEqual(element.classList.contains('is-tight'), false);

		applyLeafWidthClasses(element, -50);
		assert.strictEqual(element.dataset.conversationWidth, 'medium');
		assert.strictEqual(element.classList.contains('is-medium'), true);
		assert.strictEqual(element.classList.contains('is-tight'), false);
	});

	test('draft input cap calculations (100, 274, 600, 840, 2000 -> 48, 109, 240, 336, 336) and applyDockInputMaxHeight behavior', () => {
		assert.strictEqual(CONVERSATION_DOCK_INPUT_MAX_HEIGHT, 336);

		assert.strictEqual(conversationDockInputMaxHeight(100), 48);
		assert.strictEqual(conversationDockInputMaxHeight(274), 109);
		assert.strictEqual(conversationDockInputMaxHeight(600), 240);
		assert.strictEqual(conversationDockInputMaxHeight(840), 336);
		assert.strictEqual(conversationDockInputMaxHeight(2000), 336);

		const dock = mainWindow.document.createElement('div');

		// Zero and negative leafHeight do not set the property on a fresh element
		applyDockInputMaxHeight(dock, 0);
		assert.strictEqual(dock.style.getPropertyValue('--conversation-dock-input-max-height'), '');

		applyDockInputMaxHeight(dock, -100);
		assert.strictEqual(dock.style.getPropertyValue('--conversation-dock-input-max-height'), '');

		// Valid positive height sets the custom property
		applyDockInputMaxHeight(dock, 600);
		assert.strictEqual(dock.style.getPropertyValue('--conversation-dock-input-max-height'), '240px');

		// Zero/negative height leaves existing property unchanged
		applyDockInputMaxHeight(dock, 0);
		assert.strictEqual(dock.style.getPropertyValue('--conversation-dock-input-max-height'), '240px');

		applyDockInputMaxHeight(dock, 840);
		assert.strictEqual(dock.style.getPropertyValue('--conversation-dock-input-max-height'), '336px');
	});
});
