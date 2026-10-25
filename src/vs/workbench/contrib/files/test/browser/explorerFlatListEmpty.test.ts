/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as dom from '../../../../../base/browser/dom.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { applyExplorerFlatListEmpty, explorerFlatListEmptyText } from '../../browser/explorerFlatListEmpty.js';

suite('Files - explorer flat list empty message', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('applyExplorerFlatListEmpty writes the sentence only for a reason and restores the tree', function () {
		const message = dom.$('.explorer-flat-list-empty');
		const tree = dom.$('.explorer-folders-view');
		message.setAttribute('role', 'status');

		applyExplorerFlatListEmpty(message, tree, undefined);
		assert.strictEqual(message.textContent, '');
		assert.strictEqual(message.style.display, 'none');
		assert.strictEqual(tree.style.display, '');

		applyExplorerFlatListEmpty(message, tree, 'emptyFolder');
		assert.strictEqual(message.textContent, explorerFlatListEmptyText('emptyFolder'));
		assert.strictEqual(message.textContent, 'This folder is empty.');
		assert.strictEqual(message.style.display, '');
		assert.strictEqual(tree.style.display, 'none');

		applyExplorerFlatListEmpty(message, tree, 'noMatching');
		assert.strictEqual(message.textContent, 'No matching files.');
		assert.strictEqual(tree.style.display, 'none');

		applyExplorerFlatListEmpty(message, tree, undefined);
		assert.strictEqual(message.textContent, '');
		assert.strictEqual(message.style.display, 'none');
		assert.strictEqual(tree.style.display, '');
	});
});
