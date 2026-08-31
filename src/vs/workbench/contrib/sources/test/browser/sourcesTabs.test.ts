/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { DEFAULT_SOURCES_TAB, nextSourcesTab, SOURCES_TAB_ORDER, SourcesTabId } from '../../common/sourcesTabs.js';

suite('Sources - tab model', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('default tab is Files', () => {
		assert.strictEqual(DEFAULT_SOURCES_TAB, SourcesTabId.Files);
	});

	test('tab order matches Desktop IA roster', () => {
		assert.deepStrictEqual(SOURCES_TAB_ORDER, [
			SourcesTabId.Files,
			SourcesTabId.Changes,
			SourcesTabId.Review,
		]);
	});

	test('nextSourcesTab wraps in both directions', () => {
		assert.strictEqual(nextSourcesTab(SourcesTabId.Files, 1), SourcesTabId.Changes);
		assert.strictEqual(nextSourcesTab(SourcesTabId.Changes, 1), SourcesTabId.Review);
		assert.strictEqual(nextSourcesTab(SourcesTabId.Review, 1), SourcesTabId.Files);

		assert.strictEqual(nextSourcesTab(SourcesTabId.Files, -1), SourcesTabId.Review);
		assert.strictEqual(nextSourcesTab(SourcesTabId.Review, -1), SourcesTabId.Changes);
	});
});
