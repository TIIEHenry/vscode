/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type {
	UniverseAgentWriteGitApplyHunksRequest,
	UniverseAgentWriteGitCommitRequest,
	UniverseAgentWriteGitStagePathsRequest,
	UniverseAgentWriteGitWriteResult,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import {
	canSendSourcesGitApplyHunks,
	canSendSourcesGitCommit,
	canSendSourcesGitStagePaths,
	sourcesGitApplyHunksRequest,
	sourcesGitCommitRequest,
	sourcesGitStagePathsRequest,
	sourcesGitWriteFailureDetail,
	tryWriteSourcesGitApplyHunks,
	tryWriteSourcesGitCommit,
	tryWriteSourcesGitStagePaths,
} from '../../common/sourcesChangesGitWrite.js';

suite('Sources - Changes git write', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const failedWrite: UniverseAgentWriteGitWriteResult = {
		supported: false,
		reason: '',
		success: false,
		errorMessage: '',
		exitCode: 0,
		stdout: '',
	};

	test('Stage / Commit / Accept gates are connected + hook', () => {
		assert.strictEqual(canSendSourcesGitStagePaths(false, true), false);
		assert.strictEqual(canSendSourcesGitStagePaths(true, false), false);
		assert.strictEqual(canSendSourcesGitStagePaths(true, true), true);
		assert.strictEqual(canSendSourcesGitCommit(false, true), false);
		assert.strictEqual(canSendSourcesGitCommit(true, false), false);
		assert.strictEqual(canSendSourcesGitCommit(true, true), true);
		assert.strictEqual(canSendSourcesGitApplyHunks(false, true), false);
		assert.strictEqual(canSendSourcesGitApplyHunks(true, false), false);
		assert.strictEqual(canSendSourcesGitApplyHunks(true, true), true);
	});

	test('Stage request sends empty sessionId and empty commands / argv as-is', () => {
		assert.deepStrictEqual(sourcesGitStagePathsRequest([]), {
			sessionId: '',
			commands: [],
		});
		assert.deepStrictEqual(sourcesGitStagePathsRequest(['']), {
			sessionId: '',
			commands: [{ argv: [''] }],
		});
		assert.deepStrictEqual(sourcesGitStagePathsRequest(['src/a.ts', '']), {
			sessionId: '',
			commands: [{ argv: ['src/a.ts'] }, { argv: [''] }],
		});
	});

	test('Commit request sends empty sessionId / message as-is and false flags', () => {
		assert.deepStrictEqual(sourcesGitCommitRequest(''), {
			sessionId: '',
			message: '',
			signOff: false,
			amend: false,
		});
		assert.deepStrictEqual(sourcesGitCommitRequest('  fix  '), {
			sessionId: '',
			message: '  fix  ',
			signOff: false,
			amend: false,
		});
	});

	test('Accept request sends empty sessionId / argv / patches as-is', () => {
		assert.deepStrictEqual(sourcesGitApplyHunksRequest(), {
			sessionId: '',
			argv: [],
			patches: [],
		});
		assert.deepStrictEqual(sourcesGitApplyHunksRequest([''], ['']), {
			sessionId: '',
			argv: [''],
			patches: [''],
		});
	});

	test('write failure detail keeps empty errorMessage', () => {
		assert.strictEqual(sourcesGitWriteFailureDetail(failedWrite), '');
		assert.strictEqual(sourcesGitWriteFailureDetail({ ...failedWrite, errorMessage: '  boom  ' }), '  boom  ');
	});

	test('tryWrite Stage / Commit / Accept skip when disconnected or hook missing', async () => {
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const commitCalls: UniverseAgentWriteGitCommitRequest[] = [];
		const applyCalls: UniverseAgentWriteGitApplyHunksRequest[] = [];

		assert.strictEqual(await tryWriteSourcesGitStagePaths(false, async request => {
			stageCalls.push(request);
			return failedWrite;
		}, ['src/a.ts']), undefined);
		assert.strictEqual(await tryWriteSourcesGitStagePaths(true, undefined, ['src/a.ts']), undefined);
		assert.strictEqual(await tryWriteSourcesGitCommit(false, async request => {
			commitCalls.push(request);
			return failedWrite;
		}, 'msg'), undefined);
		assert.strictEqual(await tryWriteSourcesGitCommit(true, undefined, 'msg'), undefined);
		assert.strictEqual(await tryWriteSourcesGitApplyHunks(false, async request => {
			applyCalls.push(request);
			return failedWrite;
		}), undefined);
		assert.strictEqual(await tryWriteSourcesGitApplyHunks(true, undefined), undefined);
		assert.deepStrictEqual(stageCalls, []);
		assert.deepStrictEqual(commitCalls, []);
		assert.deepStrictEqual(applyCalls, []);
	});

	test('tryWrite Stage / Commit / Accept send when connected + hook', async () => {
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const commitCalls: UniverseAgentWriteGitCommitRequest[] = [];
		const applyCalls: UniverseAgentWriteGitApplyHunksRequest[] = [];

		const staged = await tryWriteSourcesGitStagePaths(true, async request => {
			stageCalls.push(request);
			return { ...failedWrite, success: true };
		}, ['']);
		const committed = await tryWriteSourcesGitCommit(true, async request => {
			commitCalls.push(request);
			return { ...failedWrite, success: true };
		}, '');
		const applied = await tryWriteSourcesGitApplyHunks(true, async request => {
			applyCalls.push(request);
			return { ...failedWrite, success: true };
		});

		assert.deepStrictEqual(stageCalls, [{ sessionId: '', commands: [{ argv: [''] }] }]);
		assert.deepStrictEqual(commitCalls, [{ sessionId: '', message: '', signOff: false, amend: false }]);
		assert.deepStrictEqual(applyCalls, [{ sessionId: '', argv: [], patches: [] }]);
		assert.strictEqual(staged?.success, true);
		assert.strictEqual(committed?.success, true);
		assert.strictEqual(applied?.success, true);
	});

	const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');

	test('Changes Stage / Commit write; Unstage stays on git.unstage', () => {
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts'), 'utf8');
		assert.ok(source.includes('tryWriteSourcesGitStagePaths'));
		assert.ok(source.includes('tryWriteSourcesGitCommit'));
		assert.ok(source.includes('SOURCES_GIT_UNSTAGE_COMMAND'));
		assert.ok(!source.includes('tryWriteSourcesGitApplyHunks'));
		assert.ok(!source.includes('writeGitUnstage'));
	});

	test('Review Accept writes ApplyHunks; Revert stays on git.clean', () => {
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts'), 'utf8');
		assert.ok(source.includes('tryWriteSourcesGitApplyHunks'));
		assert.ok(source.includes('SOURCES_GIT_CLEAN_COMMAND'));
		assert.ok(source.includes('runGitAction(SOURCES_GIT_STAGE_COMMAND)'));
		assert.ok(!source.includes('writeGitUnstage'));
	});
});
