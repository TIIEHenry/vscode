/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { DEFAULT_SOURCES_TAB, nextSourcesTab, SOURCES_TAB_ORDER, SourcesTabId } from '../../common/sourcesTabs.js';
import { readSourcesSelectedTab, sourcesSelectedTabStorageKey, sourcesTabForSessionChange } from '../../browser/sourcesTabsHost.js';

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

	test('switching sessions saves the tab you left and restores the tab that session last had', () => {
		const values = new Map<string, string>();
		const read = (key: string) => {
			assert.ok(key.startsWith('sources.selectedTab.session:'), key);
			return values.get(key);
		};

		assert.strictEqual(readSourcesSelectedTab(read, 'sess-a'), SourcesTabId.Files);
		assert.strictEqual(values.size, 0);

		values.set(sourcesSelectedTabStorageKey('sess-a'), SourcesTabId.Changes);
		const toB = sourcesTabForSessionChange({ sessionId: 'sess-a', tab: SourcesTabId.Changes }, 'sess-b', read);
		values.set(toB.saved.key, toB.saved.tab);
		assert.strictEqual(toB.saved.key, sourcesSelectedTabStorageKey('sess-a'));
		assert.strictEqual(toB.saved.tab, SourcesTabId.Changes);
		assert.strictEqual(toB.restored, SourcesTabId.Files);

		values.set(sourcesSelectedTabStorageKey('sess-b'), SourcesTabId.Review);
		const backToA = sourcesTabForSessionChange({ sessionId: 'sess-b', tab: SourcesTabId.Review }, 'sess-a', read);
		values.set(backToA.saved.key, backToA.saved.tab);
		assert.strictEqual(backToA.restored, SourcesTabId.Changes);
		assert.strictEqual(values.get(sourcesSelectedTabStorageKey('sess-b')), SourcesTabId.Review);
		assert.strictEqual(values.has('sources.selectedTab'), false);
	});
});
