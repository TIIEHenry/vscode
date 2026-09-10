/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { sourcesFilesListEmptyMessage, sourcesFilesListReadFailureMessage } from '../../browser/sourcesFilesListStrings.js';

suite('Sources - Files list strings', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('empty chrome is a user-facing workspace empty, not an implementation note', () => {
		assert.ok(sourcesFilesListEmptyMessage.includes('No workspace files'));
		assert.ok(!sourcesFilesListEmptyMessage.match(/list projection/i));
		assert.ok(!sourcesFilesListEmptyMessage.match(/file tree/i));
		assert.ok(!sourcesFilesListEmptyMessage.includes('Chat'));
		assert.ok(!sourcesFilesListEmptyMessage.match(/copilot/i), 'must not mention Copilot');
	});

	test('read failure is not empty-workspace success copy', () => {
		const message = sourcesFilesListReadFailureMessage(new Error('boom'));
		assert.ok(message.includes('Unable to read workspace files:'));
		assert.ok(message.includes('boom'));
		assert.ok(!message.includes('No workspace files'));
	});
});
