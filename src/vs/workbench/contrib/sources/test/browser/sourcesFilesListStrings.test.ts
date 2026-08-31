/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { sourcesFilesListEmptyMessage } from '../../browser/sourcesFilesListStrings.js';

suite('Sources - Files list strings', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('empty chrome is honest about Explorer list projection, not a tree or Chat', () => {
		assert.ok(sourcesFilesListEmptyMessage.includes('Explorer'));
		assert.ok(sourcesFilesListEmptyMessage.match(/list projection/i));
		assert.ok(sourcesFilesListEmptyMessage.match(/file tree/i), 'must clarify this is not a file tree');
		assert.ok(sourcesFilesListEmptyMessage.includes('Chat'), 'must clarify this is not Chat');
		assert.ok(!sourcesFilesListEmptyMessage.match(/copilot/i), 'must not mention Copilot');
	});
});
