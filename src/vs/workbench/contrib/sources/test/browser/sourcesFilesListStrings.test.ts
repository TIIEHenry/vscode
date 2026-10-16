/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { sourcesFilesListEmptyMessage, sourcesFilesListReadFailureDetail, sourcesFilesListReadFailureSummaryFor } from '../../browser/sourcesFilesListStrings.js';

suite('Sources - Files list strings', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('empty chrome is a user-facing workspace empty, not an implementation note', () => {
		assert.ok(sourcesFilesListEmptyMessage.includes('No workspace files'));
		assert.ok(!sourcesFilesListEmptyMessage.match(/list projection/i));
		assert.ok(!sourcesFilesListEmptyMessage.match(/file tree/i));
		assert.ok(!sourcesFilesListEmptyMessage.includes('Chat'));
		assert.ok(!sourcesFilesListEmptyMessage.match(/copilot/i), 'must not mention Copilot');
	});

	test('read failure summary is not the raw error or empty-workspace success copy', () => {
		const error = new Error('boom');
		const summary = sourcesFilesListReadFailureSummaryFor(error);
		assert.strictEqual(summary, 'Unable to read workspace files.');
		assert.ok(!summary.includes('boom'));
		assert.ok(!summary.includes('No workspace files'));
		assert.strictEqual(sourcesFilesListReadFailureDetail(error), 'boom');
	});

	test('a known status code gets its own sentence and the raw text stays in the detail', () => {
		const denied = new Error('7 PERMISSION_DENIED: Path traversal detected: /secret');
		const summary = sourcesFilesListReadFailureSummaryFor(denied);
		assert.strictEqual(summary, 'Workspace files cannot be read from this path.');
		assert.ok(!summary.includes('PERMISSION_DENIED'));
		assert.ok(!summary.includes('Path traversal'));
		assert.ok(sourcesFilesListReadFailureDetail(denied).includes('PERMISSION_DENIED'));
		assert.ok(sourcesFilesListReadFailureDetail(denied).includes('/secret'));

		const coded = Object.assign(new Error('disk'), { code: 5 });
		assert.strictEqual(sourcesFilesListReadFailureSummaryFor(coded), 'The workspace folder was not found.');
		assert.strictEqual(sourcesFilesListReadFailureDetail(coded), 'disk');

		const internal = new Error('13 INTERNAL: disk on fire');
		assert.strictEqual(sourcesFilesListReadFailureSummaryFor(internal), 'Unable to read workspace files.');
		assert.ok(!sourcesFilesListReadFailureSummaryFor(internal).includes('INTERNAL'));
		assert.ok(sourcesFilesListReadFailureDetail(internal).includes('disk on fire'));
	});
});
