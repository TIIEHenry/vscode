/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
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
import { isSourcesGitWriteLive, sourcesGitStagePathsRequest } from '../../common/sourcesChangesGitWrite.js';
import {
	canSendSourcesGitChanges,
	canSendSourcesGitFileDiff,
	canSendSourcesGitSummary,
	collectSourcesGitChangeEntries,
	hasSourcesGitReadEntries,
	needsSourcesGitFileDiff,
	parseSourcesGitUnifiedDiff,
	shouldKeepSourcesGitReadNoHookLeftover,
	shouldKeepSourcesGitReadPairingHoldLeftover,
	sourcesGitChangeGroupId,
	sourcesGitChangeResource,
	sourcesGitChangesRequest,
	sourcesGitFileDiffRequest,
	sourcesGitSummaryRequest,
	sourcesGitDiffOpenFailureMessage,
	sourcesGitEmptyFileDiffMessage,
	sourcesGitLocalOnlyMessage,
	sourcesGitReadFailureMessage,
	sourcesGitReadPairingHoldMessage,
	sourcesGitReadUnavailableNoHookMessage,
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

	test('Changes / Summary / FileDiff gates are connected + hook + sessionId', () => {
		assert.strictEqual(canSendSourcesGitChanges(false, true, 'sess-1'), false);
		assert.strictEqual(canSendSourcesGitChanges(true, false, 'sess-1'), false);
		assert.strictEqual(canSendSourcesGitChanges(true, true, ''), false);
		assert.strictEqual(canSendSourcesGitChanges(true, true, 'sess-1'), true);
		assert.strictEqual(canSendSourcesGitSummary(false, true, 'sess-1'), false);
		assert.strictEqual(canSendSourcesGitSummary(true, false, 'sess-1'), false);
		assert.strictEqual(canSendSourcesGitSummary(true, true, ''), false);
		assert.strictEqual(canSendSourcesGitSummary(true, true, 'sess-1'), true);
		assert.strictEqual(canSendSourcesGitFileDiff(false, true, 'sess-1'), false);
		assert.strictEqual(canSendSourcesGitFileDiff(true, false, 'sess-1'), false);
		assert.strictEqual(canSendSourcesGitFileDiff(true, true, ''), false);
		assert.strictEqual(canSendSourcesGitFileDiff(true, true, 'sess-1'), true);
	});

	test('pairing-hold leftover-looks-live refuses Changes / Summary reads', () => {
		assert.strictEqual(isSourcesGitWriteLive(true, false), true);
		assert.strictEqual(isSourcesGitWriteLive(true, true), false);
		assert.strictEqual(canSendSourcesGitChanges(true, true, 'sess-1', true), false);
		assert.strictEqual(canSendSourcesGitSummary(true, true, 'sess-1', true), false);
		assert.strictEqual(canSendSourcesGitChanges(true, true, 'sess-1', false), true);
		assert.strictEqual(canSendSourcesGitSummary(true, true, 'sess-1', false), true);
	});

	test('read requests share write sessionId and pass empty fields as-is', () => {
		const sessionId = sourcesGitStagePathsRequest('sess-1', []).sessionId;
		assert.strictEqual(sessionId, 'sess-1');
		assert.deepStrictEqual(sourcesGitChangesRequest(sessionId), { sessionId });
		assert.deepStrictEqual(sourcesGitSummaryRequest(sessionId), { sessionId });
		assert.deepStrictEqual(sourcesGitFileDiffRequest(sessionId, '', ''), {
			sessionId,
			path: '',
			indexState: '',
		});
		assert.deepStrictEqual(sourcesGitFileDiffRequest(sessionId, '  a.ts  ', '  INDEX  '), {
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
		}, 'sess-1'), undefined);
		assert.strictEqual(await tryReadSourcesGitChanges(true, undefined, 'sess-1'), undefined);
		assert.strictEqual(await tryReadSourcesGitChanges(true, async request => {
			changeCalls.push(request);
			return unsupportedChanges;
		}, ''), undefined);
		assert.strictEqual(await tryReadSourcesGitSummary(false, async request => {
			summaryCalls.push(request);
			return unsupportedSummary;
		}, 'sess-1'), undefined);
		assert.strictEqual(await tryReadSourcesGitSummary(true, undefined, 'sess-1'), undefined);
		assert.strictEqual(await tryReadSourcesGitSummary(true, async request => {
			summaryCalls.push(request);
			return unsupportedSummary;
		}, ''), undefined);
		assert.strictEqual(await tryReadSourcesGitFileDiff(false, async request => {
			diffCalls.push(request);
			return unsupportedDiff;
		}, 'sess-1', 'src/a.ts', 'WORKTREE'), undefined);
		assert.strictEqual(await tryReadSourcesGitFileDiff(true, undefined, 'sess-1', 'src/a.ts', 'WORKTREE'), undefined);
		assert.strictEqual(await tryReadSourcesGitFileDiff(true, async request => {
			diffCalls.push(request);
			return unsupportedDiff;
		}, '', 'src/a.ts', 'WORKTREE'), undefined);
		assert.strictEqual(await tryReadSourcesGitChanges(true, async request => {
			changeCalls.push(request);
			return unsupportedChanges;
		}, 'sess-1', true), undefined);
		assert.strictEqual(await tryReadSourcesGitSummary(true, async request => {
			summaryCalls.push(request);
			return unsupportedSummary;
		}, 'sess-1', true), undefined);
		assert.deepStrictEqual(changeCalls, []);
		assert.deepStrictEqual(summaryCalls, []);
		assert.deepStrictEqual(diffCalls, []);
	});

	test('tryRead sends roster sessionId when connected + hook', async () => {
		const changeCalls: UniverseAgentReadGitChangesRequest[] = [];
		const summaryCalls: UniverseAgentReadGitSummaryRequest[] = [];
		const diffCalls: UniverseAgentReadGitFileDiffRequest[] = [];

		const changes = await tryReadSourcesGitChanges(true, async request => {
			changeCalls.push(request);
			return { ...unsupportedChanges, supported: true, entries: [{ path: '', oldPath: '', kind: '', indexState: '' }] };
		}, 'sess-1');
		const summary = await tryReadSourcesGitSummary(true, async request => {
			summaryCalls.push(request);
			return { ...unsupportedSummary, supported: true, branch: '', changeCount: 0 };
		}, 'sess-1');
		const diff = await tryReadSourcesGitFileDiff(true, async request => {
			diffCalls.push(request);
			return { ...unsupportedDiff, supported: true };
		}, 'sess-1', '', '');

		assert.deepStrictEqual(changeCalls, [{ sessionId: 'sess-1' }]);
		assert.deepStrictEqual(summaryCalls, [{ sessionId: 'sess-1' }]);
		assert.deepStrictEqual(diffCalls, [{ sessionId: 'sess-1', path: '', indexState: '' }]);
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
		}, root, 'sess-1');

		assert.deepStrictEqual(changeCalls, [{ sessionId: 'sess-1' }]);
		assert.deepStrictEqual(summaryCalls, [{ sessionId: 'sess-1' }]);
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

		const closed = await tryLoadSourcesGitChangeEntries(false, async () => unsupportedChanges, async () => unsupportedSummary, root, 'sess-1');
		assert.strictEqual(closed, undefined);
		const unsupported = await tryLoadSourcesGitChangeEntries(true, async () => unsupportedChanges, async () => unsupportedSummary, root, 'sess-1');
		assert.strictEqual(unsupported, undefined);
		const emptySession = await tryLoadSourcesGitChangeEntries(true, async () => ({ ...unsupportedChanges, supported: true }), async () => unsupportedSummary, root, '');
		assert.strictEqual(emptySession, undefined);

		const emptySupportedCalls: UniverseAgentReadGitChangesRequest[] = [];
		let emptySupportedSummaryCalls = 0;
		const emptySupported = await tryLoadSourcesGitChangeEntries(true, async request => {
			emptySupportedCalls.push(request);
			return { supported: true, reason: '', branch: 'main', entries: [] };
		}, async () => {
			emptySupportedSummaryCalls += 1;
			return { supported: true, reason: '', branch: 'main', changeCount: 0 };
		}, root, 'sess-1');
		assert.deepStrictEqual(emptySupportedCalls, [{ sessionId: 'sess-1' }]);
		assert.strictEqual(emptySupportedSummaryCalls, 0);
		assert.strictEqual(emptySupported, undefined);

		const pairingHoldCalls: UniverseAgentReadGitChangesRequest[] = [];
		const pairingHold = await tryLoadSourcesGitChangeEntries(true, async request => {
			pairingHoldCalls.push(request);
			return { supported: true, reason: '', branch: 'main', entries: [{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }] };
		}, async () => {
			throw new Error('must not readGitSummary while pairing-hold');
		}, root, 'sess-1', true);
		assert.deepStrictEqual(pairingHoldCalls, []);
		assert.strictEqual(pairingHold, undefined);
	});

	test('empty supported engine list is not authoritative', () => {
		assert.strictEqual(hasSourcesGitReadEntries(undefined), false);
		assert.strictEqual(hasSourcesGitReadEntries([]), false);
		assert.strictEqual(hasSourcesGitReadEntries(collectSourcesGitChangeEntries([], URI.file('/project'))), false);
		assert.strictEqual(hasSourcesGitReadEntries(collectSourcesGitChangeEntries([
			{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' },
		], URI.file('/project'))), true);
	});

	test('tryLoad Summary throw is the same failure class as Changes throw', async () => {
		const root = URI.file('/project');
		const supportedChanges: UniverseAgentReadGitChangesResult = {
			supported: true,
			reason: '',
			branch: 'main',
			entries: [{ path: 'src/a.ts', oldPath: '', kind: 'MODIFIED', indexState: 'WORKTREE' }],
		};

		await assert.rejects(
			() => tryLoadSourcesGitChangeEntries(true, async () => {
				throw new Error('boom');
			}, async () => unsupportedSummary, root, 'sess-1'),
			(error: unknown) => error instanceof Error && error.message === 'boom',
		);

		let loaded: Awaited<ReturnType<typeof tryLoadSourcesGitChangeEntries>> | undefined;
		let summaryError: unknown;
		try {
			loaded = await tryLoadSourcesGitChangeEntries(true, async () => supportedChanges, async () => {
				throw new Error('boom');
			}, root, 'sess-1');
		} catch (error) {
			summaryError = error;
		}
		assert.ok(summaryError instanceof Error && summaryError.message === 'boom');
		assert.strictEqual(loaded, undefined);
		assert.ok(sourcesGitReadFailureMessage(summaryError).includes('Unable to read git changes'));
		assert.ok(sourcesGitReadFailureMessage(summaryError).includes('boom'));
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

	test('git read failure message is honest and keeps the error text', () => {
		const message = sourcesGitReadFailureMessage(new Error('boom'));
		assert.ok(message.includes('Unable to read git changes'));
		assert.ok(message.includes('boom'));
	});

	test('git diff open failure message is honest and keeps the error text', () => {
		const message = sourcesGitDiffOpenFailureMessage(new Error('boom'));
		assert.ok(message.includes('Unable to open diff'));
		assert.ok(message.includes('boom'));
	});

	test('empty file-diff and local-only messages stay explicit', () => {
		assert.ok(sourcesGitEmptyFileDiffMessage().includes('empty'));
		assert.ok(sourcesGitLocalOnlyMessage().includes('local source control'));
		assert.ok(sourcesGitReadUnavailableNoHookMessage().includes('no git changes API'));
		assert.ok(sourcesGitReadPairingHoldMessage().includes('not connected'));
		assert.ok(sourcesGitReadPairingHoldMessage().includes('pairing'));
	});

	test('no-hook leftover gate keeps only live git-read rows while connected', () => {
		assert.strictEqual(shouldKeepSourcesGitReadNoHookLeftover(true, false, 1), true);
		assert.strictEqual(shouldKeepSourcesGitReadNoHookLeftover(true, false, 0), false);
		assert.strictEqual(shouldKeepSourcesGitReadNoHookLeftover(false, false, 1), false);
		assert.strictEqual(shouldKeepSourcesGitReadNoHookLeftover(true, true, 1), false);
	});

	test('pairing-hold leftover gate keeps live git-read rows while phase is connected', () => {
		assert.strictEqual(shouldKeepSourcesGitReadPairingHoldLeftover(true, true, 1), true);
		assert.strictEqual(shouldKeepSourcesGitReadPairingHoldLeftover(true, true, 0), false);
		assert.strictEqual(shouldKeepSourcesGitReadPairingHoldLeftover(false, true, 1), false);
		assert.strictEqual(shouldKeepSourcesGitReadPairingHoldLeftover(true, false, 1), false);
		assert.strictEqual(shouldKeepSourcesGitReadPairingHoldLeftover(false, false, 1), false);
	});

});
