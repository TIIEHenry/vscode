/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import {
	collectStageTargetUris,
	collectUnstageTargetUris,
	isSourcesChangeStageable,
	isSourcesChangeUnstageable,
} from '../../common/sourcesChangesGit.js';
import { collectSourcesChangeEntries, ISourcesChangeRepositoryLike } from '../../common/sourcesChangesModel.js';
import { resolveSourcesChangeRef, pickQuickDiffOriginalResource } from '../../common/sourcesChangeRef.js';
import { IQuickDiffService } from '../../../scm/common/quickDiff.js';

suite('Sources - Changes list projection', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function createRepo(groups: { id: string; label: string; resources: URI[] }[]): ISourcesChangeRepositoryLike {
		return {
			provider: {
				groups: groups.map(group => ({
					id: group.id,
					label: group.label,
					resources: group.resources.map(sourceUri => ({ sourceUri })),
				})),
			},
		};
	}

	test('collectSourcesChangeEntries returns empty for no repositories', () => {
		const entries = collectSourcesChangeEntries([]);
		assert.deepStrictEqual(entries, []);
	});

	test('collectSourcesChangeEntries returns empty for repositories with no resources', () => {
		const entries = collectSourcesChangeEntries([
			createRepo([{ id: 'index', label: 'Staged Changes', resources: [] }]),
		]);
		assert.deepStrictEqual(entries, []);
	});

	test('collectSourcesChangeEntries projects group resources and sorts by group then path', function () {
		const stagedA = toResource.call(this, '/project/src/a.ts');
		const stagedB = toResource.call(this, '/project/src/b.ts');
		const unstaged = toResource.call(this, '/project/readme.md');

		const entries = collectSourcesChangeEntries([
			createRepo([
				{ id: 'workingTree', label: 'Unstaged Changes', resources: [unstaged] },
				{ id: 'index', label: 'Staged Changes', resources: [stagedB, stagedA] },
			]),
		]);

		assert.strictEqual(entries.length, 3);
		assert.strictEqual(entries[0].name, 'a.ts');
		assert.strictEqual(entries[0].description, 'Staged Changes');
		assert.strictEqual(entries[0].groupId, 'index');
		assert.strictEqual(entries[1].name, 'b.ts');
		assert.strictEqual(entries[1].description, 'Staged Changes');
		assert.strictEqual(entries[1].groupId, 'index');
		assert.strictEqual(entries[2].name, 'readme.md');
		assert.strictEqual(entries[2].description, 'Unstaged Changes');
		assert.strictEqual(entries[2].groupId, 'workingTree');
	});

	test('stage and unstage helpers classify git group ids', () => {
		assert.strictEqual(isSourcesChangeStageable('workingTree'), true);
		assert.strictEqual(isSourcesChangeStageable('untracked'), true);
		assert.strictEqual(isSourcesChangeStageable('merge'), true);
		assert.strictEqual(isSourcesChangeStageable('index'), false);

		assert.strictEqual(isSourcesChangeUnstageable('index'), true);
		assert.strictEqual(isSourcesChangeUnstageable('workingTree'), false);
	});

	test('collectStageTargetUris and collectUnstageTargetUris partition entries', function () {
		const staged = toResource.call(this, '/project/src/a.ts');
		const unstaged = toResource.call(this, '/project/readme.md');
		const untracked = toResource.call(this, '/project/new.txt');

		const entries = collectSourcesChangeEntries([
			createRepo([
				{ id: 'index', label: 'Staged Changes', resources: [staged] },
				{ id: 'workingTree', label: 'Changes', resources: [unstaged] },
				{ id: 'untracked', label: 'Untracked Changes', resources: [untracked] },
			]),
		]);

		assert.deepStrictEqual(collectStageTargetUris(entries).map(uri => uri.path), [unstaged.path, untracked.path]);
		assert.deepStrictEqual(collectUnstageTargetUris(entries).map(uri => uri.path), [staged.path]);
	});

	test('resolveSourcesChangeRef uses first quick diff original resource', async function () {
		const modified = toResource.call(this, '/project/src/a.ts');
		const original = toResource.call(this, '/project/.git/a.ts');
		const entry = collectSourcesChangeEntries([
			createRepo([{ id: 'workingTree', label: 'Changes', resources: [modified] }]),
		])[0];

		const ref = await resolveSourcesChangeRef(entry, {
			getQuickDiffs: async () => [{ originalResource: original, id: 'git', label: 'Git', kind: 'primary' }],
		} as unknown as IQuickDiffService);

		assert.strictEqual(ref.modified.toString(), modified.toString());
		assert.strictEqual(ref.original?.toString(), original.toString());
		assert.strictEqual(ref.groupId, 'workingTree');
	});

	test('resolveSourcesChangeRef leaves original undefined without quick diff', async function () {
		const modified = toResource.call(this, '/project/new.txt');
		const entry = collectSourcesChangeEntries([
			createRepo([{ id: 'untracked', label: 'Untracked Changes', resources: [modified] }]),
		])[0];

		const ref = await resolveSourcesChangeRef(entry, {
			getQuickDiffs: async () => [],
		} as unknown as IQuickDiffService);

		assert.strictEqual(ref.modified.toString(), modified.toString());
		assert.strictEqual(ref.original, undefined);
	});

	test('pickQuickDiffOriginalResource prefers git provider', function () {
		const gitOriginal = toResource.call(this, '/project/.git/a.ts');
		const otherOriginal = toResource.call(this, '/project/other/a.ts');

		const picked = pickQuickDiffOriginalResource([
			{ originalResource: otherOriginal, id: 'other', label: 'Other', kind: 'contributed' },
			{ originalResource: gitOriginal, id: 'git', label: 'Git', kind: 'primary' },
		]);

		assert.strictEqual(picked?.toString(), gitOriginal.toString());
	});
});
