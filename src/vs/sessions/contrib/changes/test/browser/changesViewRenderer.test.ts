/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ModifiedFileEntryState } from '../../../../../workbench/contrib/chat/common/editing/chatEditingService.js';
import { ISessionFileChange } from '../../../../services/sessions/common/session.js';
import { changesFileAriaLabel, changesWelcomeMessage, IChangesFileItem, isChangesFileResource } from '../../browser/changesViewRenderer.js';

suite('ChangesViewRenderer', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('matches original, modified, display, and deleted file resources', () => {
		const displayUri = URI.file('/workspace/file.ts');
		const originalUri = URI.parse('git:/workspace/file.ts?ref=base');
		const modifiedUri = URI.parse('git:/workspace/file.ts?ref=head');
		const change: ISessionFileChange = {
			uri: displayUri,
			originalUri,
			modifiedUri,
			insertions: 1,
			deletions: 1,
		};
		const deletedDisplayUri = URI.file('/workspace/deleted.ts');
		const deletedOriginalUri = URI.parse('git:/workspace/deleted.ts?ref=base');
		const deletedChange: ISessionFileChange = {
			uri: deletedDisplayUri,
			originalUri: deletedOriginalUri,
			insertions: 0,
			deletions: 1,
		};

		assert.deepStrictEqual({
			original: isChangesFileResource(change, originalUri),
			modified: isChangesFileResource(change, modifiedUri),
			display: isChangesFileResource(change, displayUri),
			unrelated: isChangesFileResource(change, URI.file('/workspace/other.ts')),
			deletedDisplay: isChangesFileResource(deletedChange, deletedDisplayUri),
			deletedOriginal: isChangesFileResource(deletedChange, deletedOriginalUri),
		}, {
			original: true,
			modified: true,
			display: true,
			unrelated: false,
			deletedDisplay: true,
			deletedOriginal: true,
		});
	});

	test('changes file aria label includes relative path and change type', () => {
		const file = (path: string): IChangesFileItem => ({
			type: 'file',
			uri: URI.file(path),
			state: ModifiedFileEntryState.Accepted,
			isDeletion: false,
			changeType: 'modified',
			linesAdded: 1,
			linesRemoved: 0,
		});
		const left = changesFileAriaLabel(file('/repo/src/left/index.ts'), 'src/left/index.ts');
		const right = changesFileAriaLabel(file('/repo/src/right/index.ts'), 'src/right/index.ts');
		assert.notStrictEqual(left, right);
		assert.ok(left.includes('src/left/index.ts'));
		assert.ok(left.includes('modified'));
		assert.notStrictEqual(left, 'index.ts');

		const deleted = changesFileAriaLabel({
			...file('/repo/src/gone.ts'),
			isDeletion: true,
			changeType: 'deleted',
		}, 'src/gone.ts');
		assert.ok(deleted.includes('src/gone.ts'));
		assert.ok(deleted.includes('deleted'));
	});

	test('failed change list welcome is not the empty success sentence', () => {
		const empty = changesWelcomeMessage(false);
		const failed = changesWelcomeMessage(true);
		assert.strictEqual(empty, 'Changed files and other session artifacts will appear here.');
		assert.notStrictEqual(failed, empty);
		assert.ok(!failed.includes('will appear here'));
	});
});
