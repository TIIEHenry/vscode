/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type {
	UniverseAgentWriteGitApplyHunksRequest,
	UniverseAgentWriteGitCommitRequest,
	UniverseAgentWriteGitStagePathsRequest,
	UniverseAgentWriteGitWriteResult,
} from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import {
	attemptSourcesGitWrite,
	canSendSourcesGitApplyHunks,
	canSendSourcesGitCommit,
	canSendSourcesGitStagePaths,
	canShowSourcesReviewAccept,
	hasSourcesGitApplyHunksPayload,
	hasSourcesGitSessionId,
	isSourcesGitWriteAccepted,
	isSourcesGitWriteUnsupported,
	resolveSourcesChangesRowAction,
	resolveSourcesDiffWriteActions,
	sourcesGitApplyHunksRequest,
	sourcesGitCommitRequest,
	sourcesGitStagePathsRequest,
	sourcesGitUnstageUnavailableMessage,
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

	test('Stage / Commit / Accept gates are connected + hook; Stage/Commit also need sessionId', () => {
		assert.strictEqual(hasSourcesGitSessionId(''), false);
		assert.strictEqual(hasSourcesGitSessionId('sess-1'), true);
		assert.strictEqual(canSendSourcesGitStagePaths(false, true, 'sess-1'), false);
		assert.strictEqual(canSendSourcesGitStagePaths(true, false, 'sess-1'), false);
		assert.strictEqual(canSendSourcesGitStagePaths(true, true, ''), false);
		assert.strictEqual(canSendSourcesGitStagePaths(true, true, 'sess-1'), true);
		assert.strictEqual(canSendSourcesGitCommit(false, true, 'sess-1'), false);
		assert.strictEqual(canSendSourcesGitCommit(true, false, 'sess-1'), false);
		assert.strictEqual(canSendSourcesGitCommit(true, true, ''), false);
		assert.strictEqual(canSendSourcesGitCommit(true, true, 'sess-1'), true);
		assert.strictEqual(canSendSourcesGitApplyHunks(false, true), false);
		assert.strictEqual(canSendSourcesGitApplyHunks(true, false), false);
		assert.strictEqual(canSendSourcesGitApplyHunks(true, true), true);
	});

	test('Stage request passes sessionId and empty commands / argv as-is', () => {
		assert.deepStrictEqual(sourcesGitStagePathsRequest('sess-1', []), {
			sessionId: 'sess-1',
			commands: [],
		});
		assert.deepStrictEqual(sourcesGitStagePathsRequest('sess-1', ['']), {
			sessionId: 'sess-1',
			commands: [{ argv: [''] }],
		});
		assert.deepStrictEqual(sourcesGitStagePathsRequest('sess-1', ['src/a.ts', '']), {
			sessionId: 'sess-1',
			commands: [{ argv: ['src/a.ts'] }, { argv: [''] }],
		});
	});

	test('Commit request passes sessionId / message as-is and false flags', () => {
		assert.deepStrictEqual(sourcesGitCommitRequest('sess-1', ''), {
			sessionId: 'sess-1',
			message: '',
			signOff: false,
			amend: false,
		});
		assert.deepStrictEqual(sourcesGitCommitRequest('sess-1', '  fix  '), {
			sessionId: 'sess-1',
			message: '  fix  ',
			signOff: false,
			amend: false,
		});
	});

	test('Accept request passes through sessionId / argv / patches as-is', () => {
		assert.deepStrictEqual(sourcesGitApplyHunksRequest(), {
			sessionId: '',
			argv: [],
			patches: [],
		});
		assert.deepStrictEqual(sourcesGitApplyHunksRequest('', [''], ['']), {
			sessionId: '',
			argv: [''],
			patches: [''],
		});
		assert.deepStrictEqual(sourcesGitApplyHunksRequest('sess-1', ['a'], ['p']), {
			sessionId: 'sess-1',
			argv: ['a'],
			patches: ['p'],
		});
	});

	test('Accept payload requires both sessionId and a non-empty patch', () => {
		assert.strictEqual(hasSourcesGitApplyHunksPayload('', []), false);
		assert.strictEqual(hasSourcesGitApplyHunksPayload('sess-1', []), false);
		assert.strictEqual(hasSourcesGitApplyHunksPayload('', ['p']), false);
		assert.strictEqual(hasSourcesGitApplyHunksPayload('sess-1', ['']), false);
		assert.strictEqual(hasSourcesGitApplyHunksPayload('sess-1', ['  ']), false);
		assert.strictEqual(hasSourcesGitApplyHunksPayload('sess-1', ['', '  ']), false);
		assert.strictEqual(hasSourcesGitApplyHunksPayload('sess-1', ['p']), true);
	});

	test('write failure detail keeps empty errorMessage', () => {
		assert.strictEqual(sourcesGitWriteFailureDetail(failedWrite), '');
		assert.strictEqual(sourcesGitWriteFailureDetail({ ...failedWrite, errorMessage: '  boom  ' }), '  boom  ');
	});

	test('accepted write requires supported + success; success alone is fake', () => {
		assert.strictEqual(isSourcesGitWriteAccepted(undefined), false);
		assert.strictEqual(isSourcesGitWriteAccepted(failedWrite), false);
		assert.strictEqual(isSourcesGitWriteAccepted({ ...failedWrite, success: true }), false);
		assert.strictEqual(isSourcesGitWriteAccepted({ ...failedWrite, supported: true, success: false }), false);
		assert.strictEqual(isSourcesGitWriteAccepted({ ...failedWrite, supported: true, success: true }), true);
		assert.strictEqual(isSourcesGitWriteUnsupported(undefined), false);
		assert.strictEqual(isSourcesGitWriteUnsupported(failedWrite), true);
		assert.strictEqual(isSourcesGitWriteUnsupported({ ...failedWrite, success: true }), true);
		assert.strictEqual(isSourcesGitWriteUnsupported({ ...failedWrite, supported: true, success: false }), false);
	});

	test('Accept shows only with ApplyHunks payload; hook without payload is not Accept', () => {
		assert.strictEqual(canShowSourcesReviewAccept(true, false), false);
		assert.strictEqual(canShowSourcesReviewAccept(false, true), false);
		assert.strictEqual(canShowSourcesReviewAccept(false, false), false);
		assert.strictEqual(canShowSourcesReviewAccept(true, true), true);
	});

	test('attemptSourcesGitWrite accepts only supported && success', async () => {
		assert.deepStrictEqual(await attemptSourcesGitWrite(async () => undefined), { kind: 'fallback' });
		assert.deepStrictEqual(await attemptSourcesGitWrite(async () => failedWrite), { kind: 'fallback' });
		assert.deepStrictEqual(await attemptSourcesGitWrite(async () => ({ ...failedWrite, success: true })), { kind: 'fallback' });
		assert.deepStrictEqual(await attemptSourcesGitWrite(async () => ({ ...failedWrite, supported: true, success: false, errorMessage: 'nope' })), { kind: 'failed', detail: 'nope' });
		assert.deepStrictEqual(await attemptSourcesGitWrite(async () => ({ ...failedWrite, supported: true, success: true })), { kind: 'accepted' });
	});

	test('Panel / Review write visibility: Accept needs payload; SCM local action is Stage', () => {
		const hookOnlyNoPayload = resolveSourcesDiffWriteActions({
			groupId: 'workingTree',
			hasScmResource: false,
			canWriteStage: true,
			canWriteAccept: true,
			hasApplyHunksPayload: false,
			hasGitStageCommand: false,
			hasGitUnstageCommand: false,
			hasGitCleanCommand: false,
		});
		assert.strictEqual(hookOnlyNoPayload.showStage, true);
		assert.strictEqual(hookOnlyNoPayload.showAccept, false);
		assert.strictEqual(hookOnlyNoPayload.showRevert, false);
		assert.strictEqual(hookOnlyNoPayload.showUnstage, false);
		assert.strictEqual(hookOnlyNoPayload.unstageUnavailable, false);

		const hookWithPayload = resolveSourcesDiffWriteActions({
			groupId: 'workingTree',
			hasScmResource: false,
			canWriteStage: true,
			canWriteAccept: true,
			hasApplyHunksPayload: true,
			hasGitStageCommand: false,
			hasGitUnstageCommand: false,
			hasGitCleanCommand: false,
		});
		assert.strictEqual(hookWithPayload.showAccept, true);

		const localScmStage = resolveSourcesDiffWriteActions({
			groupId: 'workingTree',
			hasScmResource: true,
			canWriteStage: false,
			canWriteAccept: true,
			hasApplyHunksPayload: false,
			hasGitStageCommand: true,
			hasGitUnstageCommand: false,
			hasGitCleanCommand: false,
		});
		assert.strictEqual(localScmStage.showStage, true);
		assert.strictEqual(localScmStage.showAccept, false);

		const noScmNoPayload = resolveSourcesDiffWriteActions({
			groupId: 'workingTree',
			hasScmResource: false,
			canWriteStage: false,
			canWriteAccept: true,
			hasApplyHunksPayload: false,
			hasGitStageCommand: true,
			hasGitUnstageCommand: false,
			hasGitCleanCommand: false,
		});
		assert.strictEqual(noScmNoPayload.showStage, false);
		assert.strictEqual(noScmNoPayload.showAccept, false);

		const stagedGitOnly = resolveSourcesDiffWriteActions({
			groupId: 'index',
			hasScmResource: false,
			canWriteStage: false,
			canWriteAccept: true,
			hasApplyHunksPayload: false,
			hasGitStageCommand: true,
			hasGitUnstageCommand: true,
			hasGitCleanCommand: true,
		});
		assert.strictEqual(stagedGitOnly.showAccept, false);
		assert.strictEqual(stagedGitOnly.showUnstage, false);
		assert.strictEqual(stagedGitOnly.unstageUnavailable, true);
		assert.ok(sourcesGitUnstageUnavailableMessage().length > 0);

		const localUnstage = resolveSourcesDiffWriteActions({
			groupId: 'index',
			hasScmResource: true,
			canWriteStage: false,
			canWriteAccept: false,
			hasApplyHunksPayload: false,
			hasGitStageCommand: true,
			hasGitUnstageCommand: true,
			hasGitCleanCommand: true,
		});
		assert.strictEqual(localUnstage.showUnstage, true);
		assert.strictEqual(localUnstage.unstageUnavailable, false);
		assert.strictEqual(localUnstage.showAccept, false);
		assert.strictEqual(localUnstage.showRevert, false);
	});

	test('Changes row: staged git-source shows unavailable Unstage, not a hidden or working control', () => {
		assert.strictEqual(resolveSourcesChangesRowAction({
			groupId: 'index',
			hasScmResource: false,
			canWriteStage: false,
			hasGitStageCommand: true,
			hasGitUnstageCommand: true,
		}), 'unstageUnavailable');
		assert.strictEqual(resolveSourcesChangesRowAction({
			groupId: 'index',
			hasScmResource: false,
			canWriteStage: false,
			hasGitStageCommand: false,
			hasGitUnstageCommand: false,
		}), 'unstageUnavailable');
		assert.strictEqual(resolveSourcesChangesRowAction({
			groupId: 'index',
			hasScmResource: true,
			canWriteStage: false,
			hasGitStageCommand: false,
			hasGitUnstageCommand: true,
		}), 'unstage');
		assert.strictEqual(resolveSourcesChangesRowAction({
			groupId: 'workingTree',
			hasScmResource: false,
			canWriteStage: true,
			hasGitStageCommand: false,
			hasGitUnstageCommand: false,
		}), 'stage');
		assert.strictEqual(resolveSourcesChangesRowAction({
			groupId: 'workingTree',
			hasScmResource: false,
			canWriteStage: false,
			hasGitStageCommand: false,
			hasGitUnstageCommand: false,
		}), 'hidden');
		assert.ok(sourcesGitUnstageUnavailableMessage().includes('Unstage is not available'));
	});

	test('tryWrite Stage / Commit / Accept skip when disconnected or hook missing', async () => {
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const commitCalls: UniverseAgentWriteGitCommitRequest[] = [];
		const applyCalls: UniverseAgentWriteGitApplyHunksRequest[] = [];

		assert.strictEqual(await tryWriteSourcesGitStagePaths(false, async request => {
			stageCalls.push(request);
			return failedWrite;
		}, 'sess-1', ['src/a.ts']), undefined);
		assert.strictEqual(await tryWriteSourcesGitStagePaths(true, undefined, 'sess-1', ['src/a.ts']), undefined);
		assert.strictEqual(await tryWriteSourcesGitStagePaths(true, async request => {
			stageCalls.push(request);
			return failedWrite;
		}, '', ['src/a.ts']), undefined);
		assert.strictEqual(await tryWriteSourcesGitCommit(false, async request => {
			commitCalls.push(request);
			return failedWrite;
		}, 'sess-1', 'msg'), undefined);
		assert.strictEqual(await tryWriteSourcesGitCommit(true, undefined, 'sess-1', 'msg'), undefined);
		assert.strictEqual(await tryWriteSourcesGitCommit(true, async request => {
			commitCalls.push(request);
			return failedWrite;
		}, '', 'msg'), undefined);
		assert.strictEqual(await tryWriteSourcesGitApplyHunks(false, async request => {
			applyCalls.push(request);
			return failedWrite;
		}), undefined);
		assert.strictEqual(await tryWriteSourcesGitApplyHunks(true, undefined), undefined);
		assert.deepStrictEqual(stageCalls, []);
		assert.deepStrictEqual(commitCalls, []);
		assert.deepStrictEqual(applyCalls, []);
	});

	test('tryWrite Stage / Commit send roster sessionId; empty Accept does not', async () => {
		const stageCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
		const commitCalls: UniverseAgentWriteGitCommitRequest[] = [];
		const applyCalls: UniverseAgentWriteGitApplyHunksRequest[] = [];
		const acceptedWrite = { ...failedWrite, supported: true, success: true };

		const staged = await tryWriteSourcesGitStagePaths(true, async request => {
			stageCalls.push(request);
			return acceptedWrite;
		}, 'sess-1', ['']);
		const committed = await tryWriteSourcesGitCommit(true, async request => {
			commitCalls.push(request);
			return acceptedWrite;
		}, 'sess-1', '');
		const applied = await tryWriteSourcesGitApplyHunks(true, async request => {
			applyCalls.push(request);
			return acceptedWrite;
		});

		assert.deepStrictEqual(stageCalls, [{ sessionId: 'sess-1', commands: [{ argv: [''] }] }]);
		assert.deepStrictEqual(commitCalls, [{ sessionId: 'sess-1', message: '', signOff: false, amend: false }]);
		assert.deepStrictEqual(applyCalls, []);
		assert.strictEqual(applied, undefined);
		assert.strictEqual(isSourcesGitWriteAccepted(staged), true);
		assert.strictEqual(isSourcesGitWriteAccepted(committed), true);
		assert.strictEqual(isSourcesGitWriteAccepted(applied), false);
	});

	test('tryWrite Accept: empty either side skips hook; both sides send as-is', async () => {
		const applyCalls: UniverseAgentWriteGitApplyHunksRequest[] = [];
		const acceptedWrite = { ...failedWrite, supported: true, success: true };
		const hook = async (request: UniverseAgentWriteGitApplyHunksRequest) => {
			applyCalls.push(request);
			return acceptedWrite;
		};

		assert.strictEqual(await tryWriteSourcesGitApplyHunks(true, hook), undefined);
		assert.strictEqual(await tryWriteSourcesGitApplyHunks(true, hook, 'sess-1'), undefined);
		assert.strictEqual(await tryWriteSourcesGitApplyHunks(true, hook, '', ['a'], ['p']), undefined);
		assert.strictEqual(await tryWriteSourcesGitApplyHunks(true, hook, 'sess-1', [], ['']), undefined);
		assert.strictEqual(await tryWriteSourcesGitApplyHunks(true, hook, 'sess-1', [], ['  ']), undefined);
		assert.deepStrictEqual(applyCalls, []);

		const applied = await tryWriteSourcesGitApplyHunks(true, hook, 'sess-1', ['a'], ['p']);
		assert.deepStrictEqual(applyCalls, [{
			sessionId: 'sess-1',
			argv: ['a'],
			patches: ['p'],
		}]);
		assert.strictEqual(isSourcesGitWriteAccepted(applied), true);
		assert.deepStrictEqual(await attemptSourcesGitWrite(async () => tryWriteSourcesGitApplyHunks(true, hook)), { kind: 'fallback' });
		assert.deepStrictEqual(applyCalls, [{
			sessionId: 'sess-1',
			argv: ['a'],
			patches: ['p'],
		}]);
	});

	test('tryWrite still returns unsupported results so callers do not treat them as accepted', async () => {
		const unsupportedSuccess = { ...failedWrite, success: true };
		const staged = await tryWriteSourcesGitStagePaths(true, async () => unsupportedSuccess, 'sess-1', ['src/a.ts']);
		const committed = await tryWriteSourcesGitCommit(true, async () => unsupportedSuccess, 'sess-1', 'msg');
		const applied = await tryWriteSourcesGitApplyHunks(true, async () => unsupportedSuccess, 'sess-1', ['a'], ['p']);

		assert.strictEqual(isSourcesGitWriteUnsupported(staged), true);
		assert.strictEqual(isSourcesGitWriteAccepted(staged), false);
		assert.strictEqual(isSourcesGitWriteUnsupported(committed), true);
		assert.strictEqual(isSourcesGitWriteAccepted(committed), false);
		assert.strictEqual(isSourcesGitWriteUnsupported(applied), true);
		assert.strictEqual(isSourcesGitWriteAccepted(applied), false);
	});
});
