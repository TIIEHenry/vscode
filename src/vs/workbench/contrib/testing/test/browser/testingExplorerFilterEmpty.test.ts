/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as dom from '../../../../../base/browser/dom.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { applyTestingExplorerFilterEmpty, testingExplorerFilterEmptyText } from '../../browser/testingExplorerFilterEmpty.js';

suite('Testing - explorer filter empty message', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('applyTestingExplorerFilterEmpty writes the sentence only for a miss and clears it', function () {
		const message = dom.$('.testing-explorer-filter-empty');
		message.setAttribute('role', 'status');

		applyTestingExplorerFilterEmpty(message, undefined);
		assert.strictEqual(message.textContent, '');
		assert.strictEqual(message.style.display, 'none');

		applyTestingExplorerFilterEmpty(message, 'noMatching');
		assert.strictEqual(message.textContent, testingExplorerFilterEmptyText('noMatching'));
		assert.strictEqual(message.textContent, 'No matching tests.');
		assert.strictEqual(message.style.display, '');

		applyTestingExplorerFilterEmpty(message, undefined);
		assert.strictEqual(message.textContent, '');
		assert.strictEqual(message.style.display, 'none');
	});
});
