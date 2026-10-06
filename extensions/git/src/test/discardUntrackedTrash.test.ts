/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { getUntrackedCleanPathsAfterTrash, getUntrackedCleanPathsWhenTrashDisabled } from '../discardUntrackedTrash';

suite('discard untracked to trash', () => {
	const paths = ['/tmp/a', '/tmp/b', '/tmp/c'];

	test('partial trash failure and user confirms cleans only failed paths', () => {
		const failed = ['/tmp/b'];
		assert.deepStrictEqual(
			getUntrackedCleanPathsAfterTrash(failed, true),
			failed
		);
	});

	test('all trash failures and user confirms cleans all failed paths', () => {
		assert.deepStrictEqual(
			getUntrackedCleanPathsAfterTrash(paths, true),
			paths
		);
	});

	test('user does not confirm does not clean', () => {
		assert.strictEqual(getUntrackedCleanPathsAfterTrash(['/tmp/b'], false), undefined);
	});

	test('all trash succeeded does not clean', () => {
		assert.strictEqual(getUntrackedCleanPathsAfterTrash([], true), undefined);
	});

	test('trash disabled uses full resource list for clean', () => {
		assert.deepStrictEqual(getUntrackedCleanPathsWhenTrashDisabled(paths), paths);
	});
});
