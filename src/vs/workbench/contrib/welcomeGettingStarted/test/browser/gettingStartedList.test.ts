/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { $ } from '../../../../../base/browser/dom.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { MockContextKeyService } from '../../../../../platform/keybinding/test/common/mockKeybindingService.js';
import { GettingStartedIndexList } from '../../browser/gettingStartedList.js';

suite('GettingStartedIndexList', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	interface ITestEntry {
		id: string;
		title: string;
	}

	function createList(limit: number = 5) {
		const contextService = store.add(new MockContextKeyService());
		const list = store.add(new GettingStartedIndexList<ITestEntry>({
			title: 'Test List',
			klass: 'test-list',
			limit,
			renderElement: (item: ITestEntry) => $('li', {}, item.title),
			contextService,
		}));
		return list;
	}

	test('itemCount is preserved on early return when entries and rendered ids do not change', () => {
		const list = createList(5);
		const entries: ITestEntry[] = [
			{ id: 'item1', title: 'Item 1' },
			{ id: 'item2', title: 'Item 2' },
			{ id: 'item3', title: 'Item 3' },
		];

		list.setEntries(entries);
		assert.strictEqual(list.itemCount, 3);

		// Call setEntries with the exact same entries array
		list.setEntries(entries);
		assert.strictEqual(list.itemCount, 3);

		// Call rerender
		list.rerender();
		assert.strictEqual(list.itemCount, 3);
	});

	test('itemCount updates when rendered ids change', () => {
		const list = createList(5);
		const initialEntries: ITestEntry[] = [
			{ id: 'item1', title: 'Item 1' },
			{ id: 'item2', title: 'Item 2' },
		];

		list.setEntries(initialEntries);
		assert.strictEqual(list.itemCount, 2);

		const updatedEntries: ITestEntry[] = [
			{ id: 'item1', title: 'Item 1' },
			{ id: 'item2', title: 'Item 2' },
			{ id: 'item3', title: 'Item 3' },
			{ id: 'item4', title: 'Item 4' },
		];

		list.setEntries(updatedEntries);
		assert.strictEqual(list.itemCount, 4);
	});

	test('setLimit preserves itemCount when rendered ids do not change', () => {
		const list = createList(5);
		const entries: ITestEntry[] = [
			{ id: 'item1', title: 'Item 1' },
			{ id: 'item2', title: 'Item 2' },
		];

		list.setEntries(entries);
		assert.strictEqual(list.itemCount, 2);

		// Limit changed from 5 to 10, but there are only 2 entries so rendered ids do not change
		list.setLimit(10);
		assert.strictEqual(list.itemCount, 2);
	});
});
