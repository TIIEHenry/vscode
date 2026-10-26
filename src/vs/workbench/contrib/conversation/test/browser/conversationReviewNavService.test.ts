/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import type { IFileMutationRecord } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { sourcesGitUnrootedChangeResource } from '../../../sources/common/sourcesChangesGitRead.js';
import { ConversationReviewNavTestHarness } from './conversationReviewNavTestHarness.js';

suite('ConversationReviewNavService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const WORKSPACE_ROOT = URI.file('/home/test/project');
	const OTHER_ROOT = URI.file('/home/test/other');

	function makeRecord(overrides: Partial<IFileMutationRecord> & Pick<IFileMutationRecord, 'path' | 'toolCallId' | 'turnId'>): IFileMutationRecord {
		return {
			sessionId: 'session-1',
			agentId: 'coder',
			operation: 'modify',
			diffStats: { addedLines: 1, removedLines: 2, changedFiles: 1 },
			...overrides,
		};
	}

	function settleMutation(harness: ConversationReviewNavTestHarness, sessionId = 'session-1'): void {
		harness.mutation.fire(makeRecord({ sessionId, path: 'src/a.ts', toolCallId: 'tc-1', turnId: 'runtime-1' }));
		harness.settle.fire({ sessionId, runtimeTurnId: 'runtime-1', assistantTurnId: 'assistant-1' });
	}

	/** Match mounted lenses: the notification, rather than the test, requests the new projection. */
	function observePaths(harness: ConversationReviewNavTestHarness, sessionId = 'session-1'): string[][][] {
		const seen: string[][][] = [];
		store.add(harness.service.onDidChange(() => {
			seen.push(harness.service.getReviewNavForSession(sessionId).map(record => [...record.paths]));
		}));
		return seen;
	}

	test('late mutation after turn settle uses assistant turn id for review nav', () => {
		const harness = store.add(new ConversationReviewNavTestHarness({ roots: [WORKSPACE_ROOT], connectionWorkDir: WORKSPACE_ROOT.fsPath }));
		harness.settle.fire({ sessionId: 'session-1', runtimeTurnId: 'runtime-1', assistantTurnId: 'assistant-1' });
		harness.mutation.fire(makeRecord({ path: 'src/a.ts', toolCallId: 'tc-1', turnId: 'runtime-1' }));

		assert.deepStrictEqual(harness.service.getReviewNavForSession('session-1'), [{
			sessionId: 'session-1',
			turnId: 'assistant-1',
			paths: [URI.joinPath(WORKSPACE_ROOT, 'src/a.ts').toString()],
		}]);
	});

	test('resolves by the session root when it differs from the connection workDir', () => {
		const harness = store.add(new ConversationReviewNavTestHarness({
			roots: [OTHER_ROOT, WORKSPACE_ROOT],
			connectionWorkDir: WORKSPACE_ROOT.fsPath,
			sessionWorkDir: OTHER_ROOT.fsPath,
		}));
		settleMutation(harness);

		assert.deepStrictEqual(harness.service.getReviewNavForSession('session-1').map(record => record.paths), [
			[URI.joinPath(OTHER_ROOT, 'src/a.ts').toString()],
		]);
	});

	test('notifies bound non-active sessions when their workDir changes', () => {
		const harness = store.add(new ConversationReviewNavTestHarness({ roots: [WORKSPACE_ROOT, OTHER_ROOT], sessionWorkDir: WORKSPACE_ROOT.fsPath }));
		harness.addRepository(OTHER_ROOT);
		harness.sessions.push({ id: 'active-other', title: 'Other', turns: [], workDir: OTHER_ROOT.fsPath });
		harness.activeSessionId = 'active-other';
		harness.activeSessionChanged.fire('active-other');
		settleMutation(harness);
		const seen = observePaths(harness);

		harness.sessions[0].workDir = OTHER_ROOT.fsPath;
		harness.sessionChanged.fire('session-1');

		assert.deepStrictEqual({ active: harness.activeSessionId, seen }, {
			active: 'active-other',
			seen: [[[URI.joinPath(OTHER_ROOT, 'src/a.ts').toString()]]],
		});
	});

	for (const operation of ['add', 'remove'] as const) {
		test(`notifies bound sessions when workspace folders ${operation}`, () => {
			const harness = store.add(new ConversationReviewNavTestHarness({ roots: [WORKSPACE_ROOT], sessionWorkDir: WORKSPACE_ROOT.fsPath }));
			if (operation === 'add') {
				harness.setWorkspaceRoots([]);
			}
			settleMutation(harness);
			const before = harness.service.getReviewNavForSession('session-1').map(record => record.paths);
			const seen = observePaths(harness);

			harness.setWorkspaceRoots(operation === 'add' ? [WORKSPACE_ROOT] : []);

			const paths = [[URI.joinPath(WORKSPACE_ROOT, 'src/a.ts').toString()]];
			assert.deepStrictEqual({ before, seen }, operation === 'add'
				? { before: [], seen: [paths] }
				: { before: paths, seen: [[]] });
		});

		test(`notifies a non-active bound session when SCM repositories ${operation}`, () => {
			const harness = store.add(new ConversationReviewNavTestHarness({ roots: [WORKSPACE_ROOT, OTHER_ROOT], sessionWorkDir: WORKSPACE_ROOT.fsPath }));
			harness.sessions.push({ id: 'session-other', title: 'Other', turns: [], workDir: OTHER_ROOT.fsPath });
			const otherRepository = operation === 'remove' ? harness.addRepository(OTHER_ROOT) : undefined;
			settleMutation(harness, 'session-other');
			const before = harness.service.getReviewNavForSession('session-other').map(record => record.paths);
			const seen = observePaths(harness, 'session-other');

			if (otherRepository) {
				harness.removeRepository(otherRepository);
			} else {
				harness.addRepository(OTHER_ROOT);
			}

			const localPaths = [[URI.joinPath(OTHER_ROOT, 'src/a.ts').toString()]];
			const enginePaths = [[sourcesGitUnrootedChangeResource('src/a.ts').toString()]];
			assert.deepStrictEqual({ active: harness.activeSessionId, before, seen }, operation === 'add'
				? { active: 'session-1', before: enginePaths, seen: [localPaths] }
				: { active: 'session-1', before: localPaths, seen: [enginePaths] });
		});
	}

	for (const delayedContext of [false, true]) {
		for (const nonActive of [false, true]) {
			test(`connection notifications expose committed roots with ${delayedContext ? 'delayed DI' : 'direct Context'} and ${nonActive ? 'non-active' : 'active'} binding`, () => {
				const harness = store.add(new ConversationReviewNavTestHarness({ roots: [WORKSPACE_ROOT, OTHER_ROOT], connectionWorkDir: WORKSPACE_ROOT.fsPath, delayedContext }));
				harness.addRepository(OTHER_ROOT);
				const sessionId = nonActive ? 'session-other' : 'session-1';
				if (nonActive) {
					harness.sessions.push({ id: sessionId, title: 'Other', turns: [] });
				}
				settleMutation(harness, sessionId);
				const before = harness.service.getReviewNavForSession(sessionId).map(record => record.paths);
				const seen = observePaths(harness, sessionId);

				harness.snapshot = { ...harness.snapshot, linkId: 2, workDir: OTHER_ROOT.fsPath };
				harness.connectionChanged.fire(harness.snapshot);

				assert.deepStrictEqual({ before, seen }, {
					before: [[URI.joinPath(WORKSPACE_ROOT, 'src/a.ts').toString()]],
					seen: [[[URI.joinPath(OTHER_ROOT, 'src/a.ts').toString()]]],
				});
			});
		}
	}

	test('dispose releases session, workspace and SCM invalidation subscriptions', () => {
		const harness = store.add(new ConversationReviewNavTestHarness({ roots: [WORKSPACE_ROOT], connectionWorkDir: WORKSPACE_ROOT.fsPath, legacyContext: true }));
		settleMutation(harness);
		const seen = observePaths(harness);
		harness.service.dispose();

		harness.activeSessionChanged.fire('session-1');
		harness.sessionChanged.fire('session-1');
		harness.setWorkspaceRoots([]);
		const repository = harness.addRepository(OTHER_ROOT);
		harness.removeRepository(repository);
		harness.connectionChanged.fire(harness.snapshot);
		harness.mutation.fire(makeRecord({ path: 'src/b.ts', toolCallId: 'tc-2', turnId: 'runtime-2' }));
		harness.settle.fire({ sessionId: 'session-1', runtimeTurnId: 'runtime-2', assistantTurnId: 'assistant-2' });

		assert.deepStrictEqual({
			seen,
			active: harness.activeSessionChanged.hasListeners(),
			session: harness.sessionChanged.hasListeners(),
			folders: harness.foldersChanged.hasListeners(),
			add: harness.repositoryAdded.hasListeners(),
			remove: harness.repositoryRemoved.hasListeners(),
			connection: harness.connectionChanged.hasListeners(),
			mutation: harness.mutation.hasListeners(),
			settle: harness.settle.hasListeners(),
		}, {
			seen: [],
			active: false,
			session: false,
			folders: false,
			add: false,
			remove: false,
			connection: false,
			mutation: false,
			settle: false,
		});
	});
});
