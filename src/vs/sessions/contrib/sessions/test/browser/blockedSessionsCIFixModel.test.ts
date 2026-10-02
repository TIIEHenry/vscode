/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { CancellationError } from '../../../../../base/common/errors.js';
import { constObservable } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { ChatSendResult, IChatService } from '../../../../../workbench/contrib/chat/common/chatService/chatService.js';
import { IGitHubService } from '../../../github/browser/githubService.js';
import { GitHubCheckConclusion, GitHubCheckStatus, GitHubPullRequestState, IGitHubCICheck } from '../../../github/common/types.js';
import { ISession } from '../../../../services/sessions/common/session.js';
import { BlockedSessionsCIFixModel } from '../../browser/blockedSessionsCIFixModel.js';

suite('BlockedSessionsCIFixModel', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const failedCheck: IGitHubCICheck = {
		id: 1,
		name: 'build',
		status: GitHubCheckStatus.Completed,
		conclusion: GitHubCheckConclusion.Failure,
		startedAt: undefined,
		completedAt: undefined,
		detailsUrl: undefined,
	};

	function session(pullRequest: { number: number } | undefined): ISession {
		return {
			sessionId: 's1',
			resource: URI.from({ scheme: 'agent-host', path: '/s1' }),
			workspace: constObservable(pullRequest ? {
				folders: [{
					gitRepository: {
						gitHubInfo: constObservable({
							owner: 'acme',
							repo: 'app',
							pullRequest,
						}),
					},
				}],
			} : { folders: [] }),
		} as unknown as ISession;
	}

	function createModel(options?: {
		readonly pullRequestLoaded?: boolean;
		readonly pullRequest?: { readonly isDraft: boolean; readonly state: GitHubPullRequestState };
		readonly checks?: readonly IGitHubCICheck[];
		readonly loadSession?: boolean;
		readonly send?: () => Promise<ChatSendResult>;
	}): {
		model: BlockedSessionsCIFixModel;
		notices: string[];
		sends: () => number;
		acquires: () => number;
		marked: () => number;
	} {
		const notices: string[] = [];
		let sends = 0;
		let acquires = 0;
		let marked = 0;
		const pullRequestLoaded = options?.pullRequestLoaded !== false;
		const pullRequest = options?.pullRequest ?? { isDraft: false, state: GitHubPullRequestState.Open };
		const checks = options?.checks ?? [failedCheck];
		const gitHub = {
			createPullRequestModelReference: () => ({
				object: { pullRequest: constObservable(pullRequestLoaded ? { headSha: 'abc', ...pullRequest } : undefined) },
				dispose() { },
			}),
			createPullRequestCIModelReference: () => ({
				object: {
					owner: 'acme',
					repo: 'app',
					prNumber: 7,
					checks: constObservable(checks),
					fixRequested: constObservable(false),
					getCheckRunAnnotations: async () => '',
					markFixRequested: () => { marked++; },
				},
				dispose() { },
			}),
		} as unknown as IGitHubService;
		const chat = {
			acquireOrLoadSession: async () => {
				acquires++;
				return options?.loadSession === false ? undefined : { dispose() { } };
			},
			sendRequest: async () => {
				sends++;
				return options?.send ? options.send() : { kind: 'sent', data: {} } as ChatSendResult;
			},
		} as unknown as IChatService;
		const notifications = {
			error(message: string) { notices.push(message); },
		} as unknown as INotificationService;
		const model = store.add(new BlockedSessionsCIFixModel(gitHub, chat, new NullLogService(), notifications));
		return {
			model,
			notices,
			sends: () => sends,
			acquires: () => acquires,
			marked: () => marked,
		};
	}

	async function settle(model: BlockedSessionsCIFixModel, sessionId: string): Promise<void> {
		for (let i = 0; i < 50 && model.hiddenSessions.get().has(sessionId); i++) {
			await timeout(0);
		}
		assert.strictEqual(model.hiddenSessions.get().has(sessionId), false);
	}

	test('notifies when the pull request is not loaded and does not send', async () => {
		const { model, notices, sends } = createModel();
		const target = session(undefined);
		model.fixCI(target);
		await settle(model, target.sessionId);
		assert.deepStrictEqual({
			notices,
			sends: sends(),
		}, {
			notices: ['Can\'t fix CI checks because this pull request isn\'t loaded.'],
			sends: 0,
		});
	});

	test('hides the fix row for a draft or closed pull request and counts only running or queued checks', () => {
		const checks: readonly IGitHubCICheck[] = [
			failedCheck,
			{ ...failedCheck, id: 2, name: 'lint', conclusion: GitHubCheckConclusion.Success },
			{ ...failedCheck, id: 3, name: 'test', status: GitHubCheckStatus.InProgress, conclusion: undefined },
			{ ...failedCheck, id: 4, name: 'package', status: GitHubCheckStatus.Queued, conclusion: undefined },
		];
		const draft = createModel({ pullRequest: { isDraft: true, state: GitHubPullRequestState.Open }, checks });
		const closed = createModel({ pullRequest: { isDraft: false, state: GitHubPullRequestState.Closed }, checks });
		const merged = createModel({ pullRequest: { isDraft: false, state: GitHubPullRequestState.Merged }, checks });
		const open = createModel({ checks });
		const target = session({ number: 7 });
		assert.deepStrictEqual({
			draft: draft.model.getCIFix(target).get(),
			closed: closed.model.getCIFix(target).get(),
			merged: merged.model.getCIFix(target).get(),
			open: open.model.getCIFix(target).get(),
		}, {
			draft: undefined,
			closed: undefined,
			merged: undefined,
			// The successful check is completed, so it is neither failed nor pending.
			open: { failed: 1, pending: 2 },
		});
	});

	test('notifies when the pull request is a draft and does not send', async () => {
		const { model, notices, sends } = createModel({ pullRequest: { isDraft: true, state: GitHubPullRequestState.Open } });
		const target = session({ number: 7 });
		model.fixCI(target);
		await settle(model, target.sessionId);
		assert.deepStrictEqual({ notices, sends: sends() }, {
			notices: ['Can\'t fix CI checks because this pull request is a draft.'],
			sends: 0,
		});
	});

	test('notifies when the pull request is not open and does not send', async () => {
		const { model, notices, sends } = createModel({ pullRequest: { isDraft: false, state: GitHubPullRequestState.Closed } });
		const target = session({ number: 7 });
		model.fixCI(target);
		await settle(model, target.sessionId);
		assert.deepStrictEqual({ notices, sends: sends() }, {
			notices: ['Can\'t fix CI checks because this pull request isn\'t open.'],
			sends: 0,
		});
	});

	test('notifies when the live pull request is missing', async () => {
		const { model, notices, sends } = createModel({ pullRequestLoaded: false });
		const target = session({ number: 7 });
		model.fixCI(target);
		await settle(model, target.sessionId);
		assert.deepStrictEqual({ notices, sends: sends() }, {
			notices: ['Can\'t fix CI checks because this pull request isn\'t loaded.'],
			sends: 0,
		});
	});

	test('notifies when there are no failing checks', async () => {
		const { model, notices, acquires } = createModel({ checks: [] });
		const target = session({ number: 7 });
		model.fixCI(target);
		await settle(model, target.sessionId);
		assert.deepStrictEqual({ notices, acquires: acquires() }, {
			notices: ['Can\'t fix CI checks because there are no failing checks.'],
			acquires: 0,
		});
	});

	test('notifies when the session chat cannot be loaded', async () => {
		const { model, notices, sends } = createModel({ loadSession: false });
		const target = session({ number: 7 });
		model.fixCI(target);
		await settle(model, target.sessionId);
		assert.deepStrictEqual({ notices, sends: sends() }, {
			notices: ['Can\'t fix CI checks because the chat for this session isn\'t available.'],
			sends: 0,
		});
	});

	test('notifies when the send is rejected and does not mark the fix requested', async () => {
		const { model, notices, marked } = createModel({
			send: async () => ({ kind: 'rejected', reason: 'provider offline' }),
		});
		const target = session({ number: 7 });
		model.fixCI(target);
		await settle(model, target.sessionId);
		assert.deepStrictEqual({ notices, marked: marked() }, {
			notices: ['Couldn\'t fix CI checks: provider offline'],
			marked: 0,
		});
	});

	test('notifies when a queued send is rejected', async () => {
		const { model, notices, marked } = createModel({
			send: async () => ({
				kind: 'queued',
				deferred: Promise.resolve({ kind: 'rejected', reason: 'later' } as ChatSendResult),
			}),
		});
		const target = session({ number: 7 });
		model.fixCI(target);
		await settle(model, target.sessionId);
		assert.deepStrictEqual({ notices, marked: marked() }, {
			notices: ['Couldn\'t fix CI checks: later'],
			marked: 0,
		});
	});

	test('notifies when a rejected reason is blank', async () => {
		const { model, notices } = createModel({
			send: async () => ({ kind: 'rejected', reason: '   ' }),
		});
		const target = session({ number: 7 });
		model.fixCI(target);
		await settle(model, target.sessionId);
		assert.deepStrictEqual(notices, ['Couldn\'t fix CI checks: the request was rejected']);
	});

	test('notifies when sending throws', async () => {
		const { model, notices, marked } = createModel({
			send: async () => { throw new Error('socket closed'); },
		});
		const target = session({ number: 7 });
		model.fixCI(target);
		await settle(model, target.sessionId);
		assert.deepStrictEqual({ notices, marked: marked() }, {
			notices: ['Couldn\'t fix CI checks: socket closed'],
			marked: 0,
		});
	});

	test('does not notify when sending is cancelled', async () => {
		const { model, notices, marked } = createModel({
			send: async () => { throw new CancellationError(); },
		});
		const target = session({ number: 7 });
		model.fixCI(target);
		await settle(model, target.sessionId);
		assert.deepStrictEqual({ notices, marked: marked() }, { notices: [], marked: 0 });
	});

	test('successful send does not notify and marks the fix requested', async () => {
		const { model, notices, marked } = createModel();
		const target = session({ number: 7 });
		model.fixCI(target);
		await settle(model, target.sessionId);
		assert.deepStrictEqual({ notices, marked: marked() }, { notices: [], marked: 1 });
	});

	test('a second click while a fix is in flight does not send again', async () => {
		let release: (() => void) | undefined;
		const gate = new Promise<void>(resolve => { release = resolve; });
		const { model, notices, sends, marked } = createModel({
			send: async () => {
				await gate;
				return { kind: 'sent', data: {} } as ChatSendResult;
			},
		});
		const target = session({ number: 7 });
		model.fixCI(target);
		for (let i = 0; i < 50 && sends() === 0; i++) {
			await timeout(0);
		}
		assert.strictEqual(sends(), 1);
		model.fixCI(target);
		await timeout(0);
		assert.strictEqual(sends(), 1);
		release!();
		await settle(model, target.sessionId);
		assert.deepStrictEqual({ notices, sends: sends(), marked: marked() }, {
			notices: [],
			sends: 1,
			marked: 1,
		});
	});
});
