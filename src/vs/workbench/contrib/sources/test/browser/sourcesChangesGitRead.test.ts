/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type {
	UniverseAgentReadGitChangesRequest,
	UniverseAgentReadGitChangesResult,
	UniverseAgentReadGitFileDiffRequest,
	UniverseAgentReadGitFileDiffResult,
	UniverseAgentReadGitSummaryRequest,
	UniverseAgentReadGitSummaryResult,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { sourcesGitStagePathsRequest } from '../../common/sourcesChangesGitWrite.js';
import {
	canSendSourcesGitChanges,
	canSendSourcesGitFileDiff,
	canSendSourcesGitSummary,
	collectSourcesGitChangeEntries,
	needsSourcesGitFileDiff,
	parseSourcesGitUnifiedDiff,
	sourcesGitChangeGroupId,
	sourcesGitChangeResource,
	sourcesGitChangesRequest,
	sourcesGitFileDiffRequest,
	sourcesGitSummaryRequest,
	sourcesGitReadFailureMessage,
	tryLoadSourcesGitChangeEntries,
	tryReadSourcesGitChanges,
	tryReadSourcesGitFileDiff,
	tryReadSourcesGitSummary,
} from '../../common/sourcesChangesGitRead.js';
import { ISourcesChangeEntry } from '../../common/sourcesChangesModel.js';

suite('Sources - Changes git read', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const unsupportedChanges: UniverseAgentReadGitChangesResult = {
		supported: false,
		reason: '',
		branch: '',
		entries: [],
	};
	const unsupportedSummary: UniverseAgentReadGitSummaryResult = {
		supported: false,
		reason: '',
		branch: '',
		changeCount: 0,
	};
	const unsupportedDiff: UniverseAgentReadGitFileDiffResult = {
		supported: false,
		reason: '',
		path: '',
		unifiedDiff: '',
	};

	test('Changes / Summary / FileDiff gates are connected + hook', () => {
		assert.strictEqual(canSendSourcesGitChanges(false, true), false);
		assert.strictEqual(canSendSourcesGitChanges(true, false), false);
		assert.strictEqual(canSendSourcesGitChanges(true, true), true);
		assert.strictEqual(canSendSourcesGitSummary(false, true), false);
		assert.strictEqual(canSendSourcesGitSummary(true, false), false);
		assert.strictEqual(canSendSourcesGitSummary(true, true), true);
		assert.strictEqual(canSendSourcesGitFileDiff(false, true), false);
		assert.strictEqual(canSendSourcesGitFileDiff(true, false), false);
		assert.strictEqual(canSendSourcesGitFileDiff(true, true), true);
	});

	test('read requests share write empty sessionId and pass empty fields as-is', () => {
		const sessionId = sourcesGitStagePathsRequest([]).sessionId;
		assert.strictEqual(sessionId, '');
		assert.deepStrictEqual(sourcesGitChangesRequest(), { sessionId });
		assert.deepStrictEqual(sourcesGitSummaryRequest(), { sessionId });
		assert.deepStrictEqual(sourcesGitFileDiffRequest('', ''), {
			sessionId,
			path: '',
			indexState: '',
		});
		assert.deepStrictEqual(sourcesGitFileDiffRequest('  a.ts  ', '  INDEX  '), {
			sessionId,
			path: '  a.ts  ',
			indexState: '  INDEX  ',
		});
	});

	test('tryRead skips when disconnected or hook missing', async () => {
		const changeCalls: UniverseAgentReadGitChangesRequest[] = [];
		const summaryCalls: UniverseAgentReadGitSummaryRequest[] = [];
		const diffCalls: UniverseAgentReadGitFileDiffRequest[] = [];

		assert.strictEqual(await tryReadSourcesGitChanges(false, async request => {
			changeCalls.push(request);
			return unsupportedChanges;
		}), undefined);
		assert.strictEqual(await tryReadSourcesGitChanges(true, undefined), undefined);
		assert.strictEqual(await tryReadSourcesGitSummary(false, async request => {
			summaryCalls.push(request);
			return unsupportedSummary;
		}), undefined);
		assert.strictEqual(await tryReadSourcesGitSummary(true, undefined), undefined);
		assert.strictEqual(await tryReadSourcesGitFileDiff(false, async request => {
			diffCalls.push(request);
			return unsupportedDiff;
		}, 'src/a.ts', 'WORKTREE'), undefined);
		assert.strictEqual(await tryReadSourcesGitFileDiff(true, undefined, 'src/a.ts', 'WORKTREE'), undefined);
		assert.deepStrictEqual(changeCalls, []);
		assert.deepStrictEqual(summaryCalls, []);
		assert.deepStrictEqual(diffCalls, []);
	});

	test('tryRead sends when connected + hook', async () => {
		const changeCalls: UniverseAgentReadGitChangesRequest[] = [];
		const summaryCalls: UniverseAgentReadGitSummaryRequest[] = [];
		const diffCalls: UniverseAgentReadGitFileDiffRequest[] = [];

		const changes = await tryReadSourcesGitChanges(true, async request => {
			changeCalls.push(request);
			return { ...unsupportedChanges, supported: true, entries: [{ path: '', oldPath: '', kind: '', indexState: '' }] };
		});
		const summary = await tryReadSourcesGitSummary(true, async request => {
			summaryCalls.push(request);
			return { ...unsupportedSummary, supported: true, branch: '', changeCount: 0 };
		});
		const diff = await tryReadSourcesGitFileDiff(true, async request => {
			diffCalls.push(request);
			return { ...unsupportedDiff, supported: true };
		}, '', '');

		assert.deepStrictEqual(changeCalls, [{ sessionId: '' }]);
		assert.deepStrictEqual(summaryCalls, [{ sessionId: '' }]);
		assert.deepStrictEqual(diffCalls, [{ sessionId: '', path: '', indexState: '' }]);
		assert.strictEqual(changes?.supported, true);
		assert.strictEqual(summary?.supported, true);
		assert.strictEqual(diff?.supported, true);
	});

	test('tryLoad uses git entries when supported and falls back when unsupported', async () => {
		const changeCalls: UniverseAgentReadGitChangesRequest[] = [];
		const summaryCalls: UniverseAgentReadGitSummaryRequest[] = [];
		const root = URI.file('/project');

		const loaded = await tryLoadSourcesGitChangeEntries(true, async request => {
			changeCalls.push(request);
			return {
				supported: true,
				reason: '',
				branch: 'main',
				entries: [
					{ path: 'src/b.ts', oldPath: '', kind: 'MODIFIED', indexState: 'INDEX' },
					{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' },
					{ path: '', oldPath: '', kind: '', indexState: '' },
				],
			};
		}, async request => {
			summaryCalls.push(request);
			return { supported: true, reason: '', branch: 'main', changeCount: 3 };
		}, root);

		assert.deepStrictEqual(changeCalls, [{ sessionId: '' }]);
		assert.deepStrictEqual(summaryCalls, [{ sessionId: '' }]);
		assert.strictEqual(loaded?.summary?.branch, 'main');
		assert.strictEqual(loaded?.entries.length, 3);
		const byPath = new Map(loaded?.entries.map(entry => [entry.gitPath, entry]));
		assert.strictEqual(byPath.get('src/a.ts')?.name, 'a.ts');
		assert.strictEqual(byPath.get('src/a.ts')?.groupId, 'workingTree');
		assert.strictEqual(byPath.get('src/a.ts')?.indexState, 'WORKTREE');
		assert.strictEqual(byPath.get('src/b.ts')?.groupId, 'index');
		assert.strictEqual(byPath.get('')?.gitPath, '');
		assert.strictEqual(byPath.get('')?.indexState, '');
		assert.strictEqual(byPath.get('')?.groupId, '');
		assert.strictEqual(byPath.get('')?.name, '');

		const closed = await tryLoadSourcesGitChangeEntries(false, async () => unsupportedChanges, async () => unsupportedSummary, root);
		assert.strictEqual(closed, undefined);
		const unsupported = await tryLoadSourcesGitChangeEntries(true, async () => unsupportedChanges, async () => unsupportedSummary, root);
		assert.strictEqual(unsupported, undefined);
	});

	test('index_state maps to SCM group ids without inventing empty state', () => {
		assert.strictEqual(sourcesGitChangeGroupId('', 'MODIFIED'), '');
		assert.strictEqual(sourcesGitChangeGroupId('INDEX', 'MODIFIED'), 'index');
		assert.strictEqual(sourcesGitChangeGroupId('WORKTREE', 'MODIFIED'), 'workingTree');
		assert.strictEqual(sourcesGitChangeGroupId('STAGED_AND_WORKTREE', 'MODIFIED'), 'workingTree');
		assert.strictEqual(sourcesGitChangeGroupId('UNMERGED', 'CONFLICT'), 'merge');
		assert.strictEqual(sourcesGitChangeGroupId('WORKTREE', 'UNTRACKED'), 'untracked');
		assert.strictEqual(sourcesGitChangeGroupId('custom', 'MODIFIED'), 'custom');
	});

	test('relative git path joins root; empty path stays joinable', () => {
		const root = URI.file('/project');
		assert.strictEqual(sourcesGitChangeResource('src/a.ts', root).fsPath, URI.joinPath(root, 'src/a.ts').fsPath);
		assert.strictEqual(sourcesGitChangeResource('/abs/a.ts', root).fsPath, URI.file('/abs/a.ts').fsPath);
		assert.strictEqual(collectSourcesGitChangeEntries([], root).length, 0);
	});

	test('needsSourcesGitFileDiff only for git-sourced rows without local original / SCM', () => {
		const gitEntry: ISourcesChangeEntry = {
			resource: URI.file('/project/src/a.ts'),
			name: 'a.ts',
			description: 'Unstaged Changes',
			groupId: 'workingTree',
			gitPath: 'src/a.ts',
			indexState: 'WORKTREE',
		};
		assert.strictEqual(needsSourcesGitFileDiff(gitEntry, false), true);
		assert.strictEqual(needsSourcesGitFileDiff(gitEntry, true), false);
		assert.strictEqual(needsSourcesGitFileDiff({ ...gitEntry, scmResource: {} as ISourcesChangeEntry['scmResource'] }, false), false);
		assert.strictEqual(needsSourcesGitFileDiff({
			resource: URI.file('/project/src/a.ts'),
			name: 'a.ts',
			description: 'Changes',
			groupId: 'workingTree',
		}, false), false);
	});

	test('parseSourcesGitUnifiedDiff keeps empty and reconstructs hunks only', () => {
		assert.deepStrictEqual(parseSourcesGitUnifiedDiff(''), { original: '', modified: '' });
		const parsed = parseSourcesGitUnifiedDiff([
			'diff --git a/a.ts b/a.ts',
			'--- a/a.ts',
			'+++ b/a.ts',
			'@@ -1,2 +1,2 @@',
			' keep',
			'-old',
			'+new',
		].join('\n'));
		assert.deepStrictEqual(parsed, { original: 'keep\nold', modified: 'keep\nnew' });
	});

	const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');

	test('git read failure message is honest and keeps the error text', () => {
		const message = sourcesGitReadFailureMessage(new Error('boom'));
		assert.ok(message.includes('Unable to read git changes'));
		assert.ok(message.includes('boom'));
	});

	test('Changes and Review lists read Git when connected; FileDiff is open-time only', () => {
		const changes = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts'), 'utf8');
		const review = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts'), 'utf8');
		const open = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangeEntryOpen.ts'), 'utf8');

		assert.ok(changes.includes('tryLoadSourcesGitChangeEntries'));
		assert.ok(changes.includes('tryReadSourcesGitFileDiff'));
		assert.ok(changes.includes('collectSourcesChangeEntries'));
		assert.ok(review.includes('tryLoadSourcesGitChangeEntries'));
		assert.ok(review.includes('tryReadSourcesGitFileDiff'));
		assert.ok(review.includes('collectSourcesReviewEntries'));
		assert.ok(review.includes('sourcesGitReadFailureMessage'));
		assert.ok(review.includes('sources-review-status'));
		assert.ok(review.includes('gitReadError'));
		assert.ok(changes.includes('sourcesGitReadFailureMessage'));
		assert.ok(open.includes('needsSourcesGitFileDiff'));
		assert.ok(open.includes('readGitFileDiff'));

		const loadStart = changes.indexOf('private async tryLoadGitEntries');
		const loadEnd = changes.indexOf('private getGitResourceRoot', loadStart);
		assert.ok(loadStart >= 0 && loadEnd > loadStart);
		assert.ok(!changes.slice(loadStart, loadEnd).includes('tryReadSourcesGitFileDiff'));
	});
});
