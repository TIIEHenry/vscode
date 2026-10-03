/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { DisposableStore, type IReference } from '../../../../../base/common/lifecycle.js';
import { autorun, ISettableObservable, observableValue, type IObservable } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { IGitHubService } from '../../../github/browser/githubService.js';
import { GitHubPullRequestCIModel } from '../../../github/browser/models/githubPullRequestCIModel.js';
import { GitHubPullRequestModel } from '../../../github/browser/models/githubPullRequestModel.js';
import { GitHubPullRequestReviewThreadsModel } from '../../../github/browser/models/githubPullRequestReviewThreadsModel.js';
import { GitHubCIOverallStatus, GitHubPullRequestState, IGitHubPullRequest, IGitHubPullRequestReviewThread } from '../../../github/common/types.js';
import { ISession, IGitHubInfo, SessionStatus } from '../../../../services/sessions/common/session.js';
import { ISessionsChangeEvent, ISessionsManagementService } from '../../../../services/sessions/common/sessionsManagement.js';
import { BlockedSessionReason, BlockedSessions } from '../../browser/blockedSessions.js';

suite('BlockedSessions', () => {

	const store = new DisposableStore();

	teardown(() => store.clear());

	ensureNoDisposablesAreLeakedInTestSuite();

	function createService(sessions: TestSession[], gitHubService: TestGitHubService): { service: BlockedSessions; management: TestSessionsManagementService } {
		const management = new TestSessionsManagementService(sessions as unknown as ISession[]);
		const service = store.add(new BlockedSessions(management as unknown as ISessionsManagementService, gitHubService as unknown as IGitHubService, new NullLogService()));
		// Keep the derived live so per-session model references are actually read.
		store.add(autorun(reader => { service.blockedSessions.read(reader); }));
		return { service, management };
	}

	function blockedIds(service: BlockedSessions): string[] {
		return service.blockedSessions.get().map(s => s.sessionId);
	}

	function blockedReasons(service: BlockedSessions): Array<[string, BlockedSessionReason]> {
		return service.blockedSessionsWithReasons.get().map((b): [string, BlockedSessionReason] => [b.session.sessionId, b.reason]);
	}

	function blockedOccurrences(service: BlockedSessions): string[] {
		return service.blockedSessionsWithReasons.get().map(blocked => blocked.occurrenceId);
	}

	test('session needing input is blocked', () => {
		const session = new TestSession('s1', SessionStatus.NeedsInput);
		const { service } = createService([session], new TestGitHubService());
		assert.deepStrictEqual(blockedIds(service), ['s1']);
	});

	test('in-progress, completed (no PR) and archived sessions are not blocked', () => {
		const inProgress = new TestSession('inprogress', SessionStatus.InProgress);
		const completed = new TestSession('completed', SessionStatus.Completed);
		const archived = new TestSession('archived', SessionStatus.NeedsInput, { archived: true });
		const { service } = createService([inProgress, completed, archived], new TestGitHubService());
		assert.deepStrictEqual(blockedIds(service), []);
	});

	test('completed session with failing CI checks is blocked', () => {
		const gitHub = new TestGitHubService();
		gitHub.setPullRequest('owner', 'repo', 7, openPullRequest(7, 'sha7'));
		gitHub.setCIStatus('owner', 'repo', 7, 'sha7', GitHubCIOverallStatus.Failure);
		const session = new TestSession('ci', SessionStatus.Completed, { pr: { owner: 'owner', repo: 'repo', number: 7 } });
		const { service } = createService([session], gitHub);
		assert.deepStrictEqual(blockedIds(service), ['ci']);
	});

	test('CI failure occurrence identifies the failing commit', () => {
		const gitHub = new TestGitHubService();
		gitHub.setPullRequest('owner', 'repo', 7, openPullRequest(7, 'sha7'));
		gitHub.setCIStatus('owner', 'repo', 7, 'sha7', GitHubCIOverallStatus.Failure);
		const session = new TestSession('ci', SessionStatus.Completed, { pr: { owner: 'owner', repo: 'repo', number: 7 } });
		const { service } = createService([session], gitHub);
		assert.deepStrictEqual(blockedOccurrences(service), [`${BlockedSessionReason.FailingCI}:sha7`]);
	});

	test('completed session with unresolved PR comments is not blocked', () => {
		const gitHub = new TestGitHubService();
		gitHub.setPullRequest('owner', 'repo', 8, openPullRequest(8, 'sha8'));
		gitHub.setReviewThreads('owner', 'repo', 8, [{ isResolved: false } as IGitHubPullRequestReviewThread]);
		const session = new TestSession('comments', SessionStatus.Completed, { pr: { owner: 'owner', repo: 'repo', number: 8 } });
		const { service } = createService([session], gitHub);
		assert.deepStrictEqual(blockedIds(service), []);
	});

	test('in-progress session with failing CI is not blocked', () => {
		const gitHub = new TestGitHubService();
		gitHub.setPullRequest('owner', 'repo', 9, openPullRequest(9, 'sha9'));
		gitHub.setCIStatus('owner', 'repo', 9, 'sha9', GitHubCIOverallStatus.Failure);
		const session = new TestSession('busy', SessionStatus.InProgress, { pr: { owner: 'owner', repo: 'repo', number: 9 } });
		const { service } = createService([session], gitHub);
		assert.deepStrictEqual(blockedIds(service), []);
	});

	test('completed session with passing CI and resolved comments is not blocked', () => {
		const gitHub = new TestGitHubService();
		gitHub.setPullRequest('owner', 'repo', 10, openPullRequest(10, 'sha10'));
		gitHub.setCIStatus('owner', 'repo', 10, 'sha10', GitHubCIOverallStatus.Success);
		gitHub.setReviewThreads('owner', 'repo', 10, [{ isResolved: true } as IGitHubPullRequestReviewThread]);
		const session = new TestSession('clean', SessionStatus.Completed, { pr: { owner: 'owner', repo: 'repo', number: 10 } });
		const { service } = createService([session], gitHub);
		assert.deepStrictEqual(blockedIds(service), []);
	});

	test('blocked sessions update reactively when status changes', () => {
		const session = new TestSession('reactive', SessionStatus.Completed);
		const { service } = createService([session], new TestGitHubService());
		assert.deepStrictEqual(blockedIds(service), []);
		session.setStatus(SessionStatus.NeedsInput);
		assert.deepStrictEqual(blockedIds(service), ['reactive']);
	});

	test('blocked sessions are sorted most-recently-updated first', () => {
		const older = new TestSession('older', SessionStatus.NeedsInput, { updatedAt: new Date(1000) });
		const newer = new TestSession('newer', SessionStatus.NeedsInput, { updatedAt: new Date(5000) });
		const { service } = createService([older, newer], new TestGitHubService());
		assert.deepStrictEqual(blockedIds(service), ['newer', 'older']);
	});

	test('reports the reason each session is blocked', () => {
		const gitHub = new TestGitHubService();
		gitHub.setPullRequest('owner', 'repo', 20, openPullRequest(20, 'sha20'));
		gitHub.setCIStatus('owner', 'repo', 20, 'sha20', GitHubCIOverallStatus.Failure);
		gitHub.setPullRequest('owner', 'repo', 21, openPullRequest(21, 'sha21'));
		gitHub.setReviewThreads('owner', 'repo', 21, [{ isResolved: false } as IGitHubPullRequestReviewThread]);
		const needsInput = new TestSession('needsinput', SessionStatus.NeedsInput, { updatedAt: new Date(3000) });
		const failingCI = new TestSession('failingci', SessionStatus.Completed, { pr: { owner: 'owner', repo: 'repo', number: 20 }, updatedAt: new Date(2000) });
		const comments = new TestSession('comments', SessionStatus.Completed, { pr: { owner: 'owner', repo: 'repo', number: 21 }, updatedAt: new Date(1000) });
		const { service } = createService([needsInput, failingCI, comments], gitHub);
		assert.deepStrictEqual(blockedReasons(service), [
			['needsinput', BlockedSessionReason.NeedsInput],
			['failingci', BlockedSessionReason.FailingCI],
		]);
	});

	test('a commit already sent for a CI fix does not keep the session blocked', () => {
		// Fix CI marks the head commit. The row then hides the failure and the
		// button, so the indicator must drop the session too. A later commit is
		// a new CI model and blocks again.
		const gitHub = new TestGitHubService();
		gitHub.setPullRequest('owner', 'repo', 7, openPullRequest(7, 'sha7'));
		gitHub.setCIStatus('owner', 'repo', 7, 'sha7', GitHubCIOverallStatus.Failure);
		const session = new TestSession('ci', SessionStatus.Completed, { pr: { owner: 'owner', repo: 'repo', number: 7 } });
		const { service } = createService([session], gitHub);
		assert.deepStrictEqual(blockedIds(service), ['ci']);

		gitHub.setFixRequested('owner', 'repo', 7, 'sha7', true);
		assert.deepStrictEqual(blockedIds(service), []);

		gitHub.setFixRequested('owner', 'repo', 7, 'sha7', false);
		assert.deepStrictEqual(blockedOccurrences(service), [`${BlockedSessionReason.FailingCI}:sha7`]);

		gitHub.setFixRequested('owner', 'repo', 7, 'sha7', true);
		gitHub.setPullRequest('owner', 'repo', 7, openPullRequest(7, 'sha8'));
		gitHub.setCIStatus('owner', 'repo', 7, 'sha8', GitHubCIOverallStatus.Failure);
		assert.deepStrictEqual(blockedOccurrences(service), [`${BlockedSessionReason.FailingCI}:sha8`]);
	});

	test('needs input still blocks when that commit already has a CI fix requested', () => {
		const gitHub = new TestGitHubService();
		gitHub.setPullRequest('owner', 'repo', 7, openPullRequest(7, 'sha7'));
		gitHub.setCIStatus('owner', 'repo', 7, 'sha7', GitHubCIOverallStatus.Failure);
		gitHub.setFixRequested('owner', 'repo', 7, 'sha7', true);
		const session = new TestSession('needs', SessionStatus.NeedsInput, { pr: { owner: 'owner', repo: 'repo', number: 7 } });
		const { service } = createService([session], gitHub);
		assert.deepStrictEqual(blockedReasons(service), [['needs', BlockedSessionReason.NeedsInput]]);
	});

	test('a fix requested on one pull request still leaves a later failing pull request blocked', () => {
		const gitHub = new TestGitHubService();
		gitHub.setPullRequest('owner', 'repo', 50, openPullRequest(50, 'sha50'));
		gitHub.setCIStatus('owner', 'repo', 50, 'sha50', GitHubCIOverallStatus.Failure);
		gitHub.setFixRequested('owner', 'repo', 50, 'sha50', true);
		gitHub.setPullRequest('owner', 'repo', 41, openPullRequest(41, 'sha41'));
		gitHub.setCIStatus('owner', 'repo', 41, 'sha41', GitHubCIOverallStatus.Failure);
		const session = new TestSession('later', SessionStatus.Completed, {
			pr: { owner: 'owner', repo: 'repo', number: 50 },
			pullRequests: [
				{ owner: 'owner', repo: 'repo', number: 50 },
				{ owner: 'owner', repo: 'repo', number: 41 },
			],
		});
		const { service } = createService([session], gitHub);
		assert.deepStrictEqual(blockedOccurrences(service), [`${BlockedSessionReason.FailingCI}:sha41`]);
	});

	test('failing CI still blocks sessions with unresolved comments', () => {
		const gitHub = new TestGitHubService();
		gitHub.setPullRequest('owner', 'repo', 22, openPullRequest(22, 'sha22'));
		gitHub.setCIStatus('owner', 'repo', 22, 'sha22', GitHubCIOverallStatus.Failure);
		gitHub.setReviewThreads('owner', 'repo', 22, [{ isResolved: false } as IGitHubPullRequestReviewThread]);
		const session = new TestSession('both', SessionStatus.Completed, { pr: { owner: 'owner', repo: 'repo', number: 22 } });
		const { service } = createService([session], gitHub);
		assert.deepStrictEqual(blockedReasons(service), [['both', BlockedSessionReason.FailingCI]]);
	});

	test('keeps the pull request and CI models referenced across recomputes', () => {
		// Sessions change constantly (opening a session, a status tick, ...) and each
		// change recomputes the blocked set. Releasing the shared, ref-counted GitHub
		// models while doing so would dispose them and report the session as
		// unblocked until the data was fetched again - which silently discards the
		// acknowledgement the user made for that very CI failure.
		const gitHub = new TestGitHubService();
		gitHub.setPullRequest('owner', 'repo', 30, openPullRequest(30, 'sha30'));
		gitHub.setCIStatus('owner', 'repo', 30, 'sha30', GitHubCIOverallStatus.Failure);
		const session = new TestSession('ci', SessionStatus.Completed, { pr: { owner: 'owner', repo: 'repo', number: 30 } });
		const { service, management } = createService([session], gitHub);
		assert.deepStrictEqual(blockedIds(service), ['ci']);

		management.fireDidChangeSessions();

		assert.deepStrictEqual({ blocked: blockedIds(service), released: gitHub.releasedModels }, { blocked: ['ci'], released: [] });
	});

	test('failing CI on a later pull request still blocks the session', () => {
		// The legacy `pullRequest` field is only the first. A session the agent
		// created plus one it discovered (or a draft/closed primary beside an open
		// one) must still surface when a later open pull request is failing.
		const gitHub = new TestGitHubService();
		gitHub.setPullRequest('owner', 'repo', 50, openPullRequest(50, 'sha50'));
		gitHub.setCIStatus('owner', 'repo', 50, 'sha50', GitHubCIOverallStatus.Success);
		gitHub.setPullRequest('owner', 'repo', 41, openPullRequest(41, 'sha41'));
		gitHub.setCIStatus('owner', 'repo', 41, 'sha41', GitHubCIOverallStatus.Failure);
		gitHub.setPullRequest('owner', 'repo', 30, draftPullRequest(30, 'sha30'));
		gitHub.setCIStatus('owner', 'repo', 30, 'sha30', GitHubCIOverallStatus.Failure);
		gitHub.setPullRequest('owner', 'repo', 31, openPullRequest(31, 'sha31'));
		gitHub.setCIStatus('owner', 'repo', 31, 'sha31', GitHubCIOverallStatus.Failure);
		gitHub.setPullRequest('owner', 'repo', 20, openPullRequest(20, 'sha20'));
		gitHub.setCIStatus('owner', 'repo', 20, 'sha20', GitHubCIOverallStatus.Failure);
		gitHub.setPullRequest('owner', 'repo', 21, openPullRequest(21, 'sha21'));
		gitHub.setCIStatus('owner', 'repo', 21, 'sha21', GitHubCIOverallStatus.Failure);
		gitHub.setPullRequest('other', 'project', 9, openPullRequest(9, 'sha9'));
		gitHub.setCIStatus('other', 'project', 9, 'sha9', GitHubCIOverallStatus.Failure);
		gitHub.setPullRequest('owner', 'repo', 11, openPullRequest(11, 'sha11'));
		gitHub.setCIStatus('owner', 'repo', 11, 'sha11', GitHubCIOverallStatus.Failure);
		gitHub.setPullRequest('owner', 'repo', 70, openPullRequest(70, 'sha70'));
		gitHub.setCIStatus('owner', 'repo', 70, 'sha70', GitHubCIOverallStatus.Success);
		gitHub.setPullRequest('owner', 'repo', 71, closedPullRequest(71, 'sha71'));
		gitHub.setCIStatus('owner', 'repo', 71, 'sha71', GitHubCIOverallStatus.Failure);

		const later = new TestSession('later', SessionStatus.Completed, {
			pr: { owner: 'owner', repo: 'repo', number: 50 },
			pullRequests: [
				{ owner: 'owner', repo: 'repo', number: 50 },
				{ owner: 'owner', repo: 'repo', number: 41 },
			],
			updatedAt: new Date(5000),
		});
		const draftPrimary = new TestSession('draft-primary', SessionStatus.Completed, {
			pr: { owner: 'owner', repo: 'repo', number: 30 },
			pullRequests: [
				{ owner: 'owner', repo: 'repo', number: 30 },
				{ owner: 'owner', repo: 'repo', number: 31 },
			],
			updatedAt: new Date(4000),
		});
		const firstWins = new TestSession('first-wins', SessionStatus.Completed, {
			pr: { owner: 'owner', repo: 'repo', number: 20 },
			pullRequests: [
				{ owner: 'owner', repo: 'repo', number: 20 },
				{ owner: 'owner', repo: 'repo', number: 21 },
			],
			updatedAt: new Date(3000),
		});
		const otherRepo = new TestSession('other-repo', SessionStatus.Completed, {
			// Legacy field names a different repository than the pull request list.
			// The list is the source of truth, and each entry carries its own coordinates.
			pr: { owner: 'owner', repo: 'repo', number: 1 },
			pullRequests: [{ owner: 'other', repo: 'project', number: 9 }],
			updatedAt: new Date(2000),
		});
		const unloadedPrimary = new TestSession('unloaded-primary', SessionStatus.Completed, {
			pr: { owner: 'owner', repo: 'repo', number: 10 },
			pullRequests: [
				{ owner: 'owner', repo: 'repo', number: 10 },
				{ owner: 'owner', repo: 'repo', number: 11 },
			],
			updatedAt: new Date(1000),
		});
		const closedLater = new TestSession('closed-later', SessionStatus.Completed, {
			pr: { owner: 'owner', repo: 'repo', number: 70 },
			pullRequests: [
				{ owner: 'owner', repo: 'repo', number: 70 },
				{ owner: 'owner', repo: 'repo', number: 71 },
			],
		});
		const { service, management } = createService([later, draftPrimary, firstWins, otherRepo, unloadedPrimary, closedLater], gitHub);
		assert.deepStrictEqual(blockedReasons(service), [
			['later', BlockedSessionReason.FailingCI],
			['draft-primary', BlockedSessionReason.FailingCI],
			['first-wins', BlockedSessionReason.FailingCI],
			['other-repo', BlockedSessionReason.FailingCI],
			['unloaded-primary', BlockedSessionReason.FailingCI],
		]);
		assert.deepStrictEqual(blockedOccurrences(service), [
			`${BlockedSessionReason.FailingCI}:sha41`,
			`${BlockedSessionReason.FailingCI}:sha31`,
			`${BlockedSessionReason.FailingCI}:sha20`,
			`${BlockedSessionReason.FailingCI}:sha9`,
			`${BlockedSessionReason.FailingCI}:sha11`,
		]);

		management.fireDidChangeSessions();
		assert.deepStrictEqual(gitHub.releasedModels, []);
		assert.deepStrictEqual(blockedOccurrences(service), [
			`${BlockedSessionReason.FailingCI}:sha41`,
			`${BlockedSessionReason.FailingCI}:sha31`,
			`${BlockedSessionReason.FailingCI}:sha20`,
			`${BlockedSessionReason.FailingCI}:sha9`,
			`${BlockedSessionReason.FailingCI}:sha11`,
		]);
	});
});

function openPullRequest(number: number, headSha: string): IGitHubPullRequest {
	return { number, headSha, isDraft: false, state: GitHubPullRequestState.Open } as unknown as IGitHubPullRequest;
}

function draftPullRequest(number: number, headSha: string): IGitHubPullRequest {
	return { number, headSha, isDraft: true, state: GitHubPullRequestState.Open } as unknown as IGitHubPullRequest;
}

function closedPullRequest(number: number, headSha: string): IGitHubPullRequest {
	return { number, headSha, isDraft: false, state: GitHubPullRequestState.Closed } as unknown as IGitHubPullRequest;
}

interface ITestPullRequestRef {
	readonly owner: string;
	readonly repo: string;
	readonly number: number;
}

interface ITestSessionOptions {
	readonly archived?: boolean;
	readonly pr?: ITestPullRequestRef;
	/** When set, this is the session's `pullRequests` list (most recent first). */
	readonly pullRequests?: readonly ITestPullRequestRef[];
	readonly updatedAt?: Date;
}

class TestSession {
	readonly sessionId: string;
	readonly resource: URI;
	readonly status: ISettableObservable<SessionStatus>;
	readonly isArchived: IObservable<boolean>;
	readonly updatedAt: IObservable<Date>;
	readonly workspace: IObservable<unknown>;

	private readonly _status: ISettableObservable<SessionStatus>;

	constructor(id: string, status: SessionStatus, options: ITestSessionOptions = {}) {
		this.sessionId = id;
		this.resource = URI.parse(`test-session:/${id}`);
		this._status = observableValue<SessionStatus>(`test.status.${id}`, status);
		this.status = this._status;
		this.isArchived = observableValue<boolean>(`test.archived.${id}`, options.archived ?? false);
		this.updatedAt = observableValue<Date>(`test.updatedAt.${id}`, options.updatedAt ?? new Date(0));

		const pullRequests = options.pullRequests?.map(pullRequest => ({
			owner: pullRequest.owner,
			repo: pullRequest.repo,
			number: pullRequest.number,
			uri: URI.parse(`https://github.com/${pullRequest.owner}/${pullRequest.repo}/pull/${pullRequest.number}`),
		}));
		const anchor = options.pr ?? pullRequests?.[0];
		const gitHubInfo: IGitHubInfo | undefined = anchor
			? {
				owner: anchor.owner,
				repo: anchor.repo,
				pullRequest: options.pr
					? { number: options.pr.number, uri: URI.parse(`https://github.com/${options.pr.owner}/${options.pr.repo}/pull/${options.pr.number}`) }
					: undefined,
				pullRequests,
			}
			: undefined;
		const gitHubInfoObs = observableValue<IGitHubInfo | undefined>(`test.gitHubInfo.${id}`, gitHubInfo);
		this.workspace = observableValue<unknown>(`test.workspace.${id}`, {
			folders: [{ gitRepository: { gitHubInfo: gitHubInfoObs } }],
		});
	}

	setStatus(status: SessionStatus): void {
		this._status.set(status, undefined);
	}
}

class TestSessionsManagementService extends mock<ISessionsManagementService>() {

	private readonly _onDidChangeSessions = new Emitter<ISessionsChangeEvent>();
	override readonly onDidChangeSessions = this._onDidChangeSessions.event;

	constructor(private readonly _sessions: ISession[]) {
		super();
	}

	override getSessions(): ISession[] {
		// A fresh array per call, like the real service: every change event
		// therefore invalidates the blocked-sessions computation.
		return [...this._sessions];
	}

	override getSession(resource: URI): ISession | undefined {
		return this._sessions.find(s => s.resource.toString() === resource.toString());
	}

	/** Simulate any session change (a session opened, updated, created, ...). */
	fireDidChangeSessions(): void {
		this._onDidChangeSessions.fire({} as ISessionsChangeEvent);
	}
}

class TestGitHubService extends mock<IGitHubService>() {

	private readonly _prModels = new Map<string, TestPullRequestModel>();
	private readonly _ciModels = new Map<string, TestCIModel>();
	private readonly _reviewThreadModels = new Map<string, TestReviewThreadsModel>();
	private readonly _refCounts = new Map<string, number>();

	/**
	 * Keys whose last reference was released. The real reference collections
	 * dispose the model at that point and re-create an empty one on the next
	 * acquire, losing everything that had been fetched - so consumers must keep
	 * these models referenced across recomputes.
	 */
	readonly releasedModels: string[] = [];

	override createPullRequestModelReference(owner: string, repo: string, prNumber: number): IReference<GitHubPullRequestModel> {
		const key = `${owner}/${repo}/${prNumber}`;
		return this._acquire(key, this._prModel(owner, repo, prNumber)) as unknown as IReference<GitHubPullRequestModel>;
	}

	override createPullRequestCIModelReference(owner: string, repo: string, prNumber: number, headSha: string): IReference<GitHubPullRequestCIModel> {
		const key = `${owner}/${repo}/${prNumber}/${headSha}`;
		return this._acquire(key, this._ciModel(owner, repo, prNumber, headSha)) as unknown as IReference<GitHubPullRequestCIModel>;
	}

	override createPullRequestReviewThreadsModelReference(owner: string, repo: string, prNumber: number): IReference<GitHubPullRequestReviewThreadsModel> {
		const key = `${owner}/${repo}/${prNumber}/reviewThreads`;
		return this._acquire(key, this._reviewThreadModel(owner, repo, prNumber)) as unknown as IReference<GitHubPullRequestReviewThreadsModel>;
	}

	setPullRequest(owner: string, repo: string, prNumber: number, pullRequest: IGitHubPullRequest): void {
		this._prModel(owner, repo, prNumber).set(pullRequest);
	}

	setCIStatus(owner: string, repo: string, prNumber: number, headSha: string, status: GitHubCIOverallStatus): void {
		this._ciModel(owner, repo, prNumber, headSha).set(status);
	}

	setFixRequested(owner: string, repo: string, prNumber: number, headSha: string, fixRequested: boolean): void {
		this._ciModel(owner, repo, prNumber, headSha).setFixRequested(fixRequested);
	}

	setReviewThreads(owner: string, repo: string, prNumber: number, threads: readonly IGitHubPullRequestReviewThread[]): void {
		this._reviewThreadModel(owner, repo, prNumber).set(threads);
	}

	private _acquire<T extends { reset(): void }>(key: string, object: T): IReference<T> {
		this._refCounts.set(key, (this._refCounts.get(key) ?? 0) + 1);
		let released = false;
		return {
			object,
			dispose: () => {
				if (released) {
					return;
				}
				released = true;
				const count = (this._refCounts.get(key) ?? 1) - 1;
				this._refCounts.set(key, count);
				if (count === 0) {
					this.releasedModels.push(key);
					// Stand in for the model being disposed and re-created empty.
					object.reset();
				}
			},
		};
	}

	private _prModel(owner: string, repo: string, prNumber: number): TestPullRequestModel {
		const key = `${owner}/${repo}/${prNumber}`;
		let model = this._prModels.get(key);
		if (!model) {
			model = new TestPullRequestModel();
			this._prModels.set(key, model);
		}
		return model;
	}

	private _ciModel(owner: string, repo: string, prNumber: number, headSha: string): TestCIModel {
		const key = `${owner}/${repo}/${prNumber}/${headSha}`;
		let model = this._ciModels.get(key);
		if (!model) {
			model = new TestCIModel();
			this._ciModels.set(key, model);
		}
		return model;
	}

	private _reviewThreadModel(owner: string, repo: string, prNumber: number): TestReviewThreadsModel {
		const key = `${owner}/${repo}/${prNumber}`;
		let model = this._reviewThreadModels.get(key);
		if (!model) {
			model = new TestReviewThreadsModel();
			this._reviewThreadModels.set(key, model);
		}
		return model;
	}
}

class TestPullRequestModel {
	private readonly _pullRequest = observableValue<IGitHubPullRequest | undefined>('test.pullRequest', undefined);
	readonly pullRequest: IObservable<IGitHubPullRequest | undefined> = this._pullRequest;
	set(pullRequest: IGitHubPullRequest): void { this._pullRequest.set(pullRequest, undefined); }
	reset(): void { this._pullRequest.set(undefined, undefined); }
}

class TestCIModel {
	private readonly _overallStatus = observableValue<GitHubCIOverallStatus>('test.ciStatus', GitHubCIOverallStatus.Neutral);
	readonly overallStatus: IObservable<GitHubCIOverallStatus> = this._overallStatus;
	private readonly _fixRequested = observableValue<boolean>('test.fixRequested', false);
	readonly fixRequested: IObservable<boolean> = this._fixRequested;
	set(status: GitHubCIOverallStatus): void { this._overallStatus.set(status, undefined); }
	setFixRequested(fixRequested: boolean): void { this._fixRequested.set(fixRequested, undefined); }
	reset(): void {
		this._overallStatus.set(GitHubCIOverallStatus.Neutral, undefined);
		this._fixRequested.set(false, undefined);
	}
}

class TestReviewThreadsModel {
	private readonly _reviewThreads = observableValue<readonly IGitHubPullRequestReviewThread[]>('test.reviewThreads', []);
	readonly reviewThreads: IObservable<readonly IGitHubPullRequestReviewThread[]> = this._reviewThreads;
	set(threads: readonly IGitHubPullRequestReviewThread[]): void { this._reviewThreads.set(threads, undefined); }
	reset(): void { this._reviewThreads.set([], undefined); }
}
