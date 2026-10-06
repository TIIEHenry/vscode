/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { UNKNOWN_EMPTY_WINDOW_WORKSPACE } from '../../../../../platform/workspace/common/workspace.js';
import { walkthroughRestoreFolderMatches } from '../../common/walkthroughRestoreFolder.js';

suite('walkthroughRestoreFolderMatches', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const folderUri = URI.file('/tmp/walkthrough-restore-test');
	const otherFolderUri = URI.file('/tmp/other-folder');

	test('empty folders and empty-window restore id matches without reading folder uri', () => {
		let threw = false;
		let result: boolean | undefined;
		try {
			result = walkthroughRestoreFolderMatches(UNKNOWN_EMPTY_WINDOW_WORKSPACE.id, []);
		} catch {
			threw = true;
		}
		assert.strictEqual(threw, false);
		assert.strictEqual(result, true);
		assert.strictEqual(UNKNOWN_EMPTY_WINDOW_WORKSPACE.id, 'empty-window');
	});

	test('empty folders and stored folder uri does not match without throwing', () => {
		let threw = false;
		let result: boolean | undefined;
		try {
			result = walkthroughRestoreFolderMatches(folderUri.toString(), []);
		} catch {
			threw = true;
		}
		assert.strictEqual(threw, false);
		assert.strictEqual(result, false);
		assert.strictEqual(walkthroughRestoreFolderMatches('empty-window', []), true);
	});

	test('first workspace folder uri string matches restore folder', () => {
		const folders = [{ uri: folderUri }];
		const result = walkthroughRestoreFolderMatches(folderUri.toString(), folders);
		assert.strictEqual(result, true);
		assert.notStrictEqual(folderUri.toString(), UNKNOWN_EMPTY_WINDOW_WORKSPACE.id);
		assert.strictEqual(folders[0].uri.toString(), folderUri.toString());
	});

	test('first workspace folder uri string differs from restore folder', () => {
		const folders = [{ uri: folderUri }];
		const result = walkthroughRestoreFolderMatches(otherFolderUri.toString(), folders);
		assert.strictEqual(result, false);
		assert.notStrictEqual(folderUri.toString(), otherFolderUri.toString());
		assert.strictEqual(folders.length, 1);
	});
});
