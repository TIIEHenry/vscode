/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { ISourcesChangeEntry, sourcesChangeEntryIdentity } from '../../common/sourcesChangesModel.js';
import {
	sourcesChangeGroupCounts,
	sourcesChangeGroupStartIdentities,
	sourcesChangeParentDirectory,
	sourcesChangeStatusMark,
} from '../../common/sourcesChangesPresentation.js';

suite('Sources - Changes presentation', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function entry(path: string, groupId: string): ISourcesChangeEntry {
		return {
			resource: URI.file(path),
			name: path.split('/').pop() ?? path,
			description: 'Changes',
			groupId,
			gitPath: path,
		};
	}

	test('parent directory comes from the git path, not the group label', () => {
		const root = URI.file('/repo');
		assert.strictEqual(sourcesChangeParentDirectory('screenshots/02-dock-before.png', URI.file('/repo/screenshots/02-dock-before.png'), root), 'screenshots');
		assert.strictEqual(sourcesChangeParentDirectory('README.md', URI.file('/repo/README.md'), root), '');
		assert.strictEqual(sourcesChangeParentDirectory(undefined, URI.file('/repo/screenshots/a.png'), root), 'screenshots');
		assert.strictEqual(sourcesChangeParentDirectory(undefined, URI.file('/repo/a.png'), undefined), '');
	});

	test('untracked files mixed into the working tree keep the U mark', () => {
		const mark = sourcesChangeStatusMark({
			groupId: 'workingTree',
			tooltip: 'Untracked',
		});
		assert.strictEqual(mark.letter, 'U');
		assert.strictEqual(mark.confident, true);
		assert.strictEqual(mark.color, 'var(--vscode-gitDecoration-untrackedResourceForeground)');
		assert.strictEqual(mark.strikethrough, false);
	});

	test('kind and icon path outrank the group fallback', () => {
		const added = sourcesChangeStatusMark({ groupId: 'index', kind: 'ADDED', indexState: 'INDEX' });
		assert.strictEqual(added.letter, 'A');
		assert.strictEqual(added.color, 'var(--vscode-gitDecoration-addedResourceForeground)');

		const intentToRename = sourcesChangeStatusMark({ groupId: 'workingTree', kind: 'INTENT_TO_RENAME' });
		assert.strictEqual(intentToRename.letter, 'R');
		assert.strictEqual(intentToRename.confident, true);
		assert.strictEqual(intentToRename.color, 'var(--vscode-gitDecoration-renamedResourceForeground)');

		const fromIcon = sourcesChangeStatusMark({
			groupId: 'workingTree',
			iconPath: '/icons/status-untracked.svg',
		});
		assert.strictEqual(fromIcon.letter, 'U');

		const fallback = sourcesChangeStatusMark({ groupId: 'workingTree' });
		assert.strictEqual(fallback.letter, 'M');
		assert.strictEqual(fallback.confident, false);
		assert.strictEqual(fallback.color, 'var(--vscode-gitDecoration-modifiedResourceForeground)');
	});

	test('group headers start a run and count files in that group', () => {
		const entries = [
			entry('screenshots/a.png', 'workingTree'),
			entry('screenshots/b.png', 'workingTree'),
			entry('src/c.ts', 'index'),
		];
		const starts = sourcesChangeGroupStartIdentities(entries);
		assert.deepStrictEqual([...starts], [
			sourcesChangeEntryIdentity(entries[0]),
			sourcesChangeEntryIdentity(entries[2]),
		]);
		assert.deepStrictEqual([...sourcesChangeGroupCounts(entries)], [['workingTree', 2], ['index', 1]]);
	});
});
