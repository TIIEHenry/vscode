/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { CancellationToken } from '../../../../../base/common/cancellation.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { GitHubPRFetcher, computeMergeability } from '../../browser/fetchers/githubPRFetcher.js';
import { GitHubIssueFetcher } from '../../browser/fetchers/githubIssueFetcher.js';
import { GitHubPullRequestContextFetcher } from '../../browser/fetchers/githubPullRequestContextFetcher.js';
import { GitHubPullRequestsFetcher } from '../../browser/fetchers/githubPullRequestsFetcher.js';
import { GitHubPRCIFetcher, computeOverallCIStatus } from '../../browser/fetchers/githubPRCIFetcher.js';
import { GitHubRecentUserWorkFetcher } from '../../browser/fetchers/githubRecentUserWorkFetcher.js';
import { GitHubRepositoryFetcher } from '../../browser/fetchers/githubRepositoryFetcher.js';
import { GitHubApiClient, GitHubApiError, IGitHubApiRequestOptions } from '../../browser/githubApiClient.js';
import { GitHubCheckConclusion, GitHubCheckStatus, GitHubCIOverallStatus, GitHubIssueState, GitHubPullRequestState, IGitHubPullRequestReview, IGitHubPullRequest, MergeBlockerKind } from '../../common/types.js';

class MockApiClient {

	private _nextResponse: unknown;
	private _responses: unknown[] = [];
	private _statusCodes: number[] = [];
	private _etags: (string | undefined)[] = [];
	private _errors: (Error | undefined)[] = [];
	private _nextError: Error | undefined;
	readonly requestCalls: { method: string; path: string; body?: unknown }[] = [];
	readonly graphqlCalls: { query: string; variables?: Record<string, unknown>; options?: Pick<IGitHubApiRequestOptions, 'token' | 'createAuthenticationSession'> }[] = [];

	setNextResponse(data: unknown): void {
		this._nextResponse = data;
		this._responses = [];
		this._nextError = undefined;
	}

	setResponses(...data: unknown[]): void {
		this._responses = [...data];
		this._nextResponse = undefined;
		this._nextError = undefined;
	}

	setStatusCodes(...codes: number[]): void {
		this._statusCodes = [...codes];
	}

	setEtags(...etags: (string | undefined)[]): void {
		this._etags = [...etags];
	}

	setNextError(error: Error): void {
		this._nextError = error;
		this._nextResponse = undefined;
	}

	/** Per-request errors. `undefined` lets that request succeed. */
	setRequestErrors(...errors: (Error | undefined)[]): void {
		this._errors = [...errors];
		this._nextError = undefined;
	}

	async request<T>(_method: string, _path: string, _callSite: string, _options?: IGitHubApiRequestOptions): Promise<{ data: T | undefined; statusCode: number; etag?: string }> {
		this.requestCalls.push({ method: _method, path: _path, body: _options?.data });
		const queuedError = this._errors.length > 0 ? this._errors.shift() : undefined;
		if (queuedError) {
			throw queuedError;
		}
		if (this._nextError) {
			throw this._nextError;
		}
		const statusCode = this._statusCodes.length > 0 ? this._statusCodes.shift()! : 200;
		const etag = this._etags.length > 0 ? this._etags.shift() : undefined;
		return { data: (this._responses.length > 0 ? this._responses.shift() : this._nextResponse) as T, statusCode, etag };
	}

	async graphql<T>(query: string, _callSite: string, variables?: Record<string, unknown>, options?: Pick<IGitHubApiRequestOptions, 'token' | 'createAuthenticationSession'>): Promise<T> {
		this.graphqlCalls.push({ query, variables, options });
		if (this._nextError) {
			throw this._nextError;
		}
		return (this._responses.length > 0 ? this._responses.shift() : this._nextResponse) as T;
	}
}

suite('GitHubRecentUserWorkFetcher', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('queries assigned issue summaries independently', async () => {
		const mockApi = new MockApiClient();
		mockApi.setNextResponse({
			search: {
				nodes: [
					null,
					{ __typename: 'Issue', number: 1, title: 'First issue', url: 'https://github.com/o/r/issues/1', updatedAt: '2026-08-07T10:00:00Z' },
					{ __typename: 'Issue', number: 2, title: 'Second issue', url: 'https://github.com/o/r/issues/2', updatedAt: '2026-08-07T11:00:00Z' },
				],
			}
		});
		const fetcher = new GitHubRecentUserWorkFetcher(mockApi as unknown as GitHubApiClient);

		assert.deepStrictEqual({
			issues: await fetcher.getRecentAssignedIssues('o', 'r', CancellationToken.None),
			variables: mockApi.graphqlCalls[0].variables,
			createAuthenticationSession: mockApi.graphqlCalls[0].options?.createAuthenticationSession,
		}, {
			issues: [
				{ number: 1, title: 'First issue', url: 'https://github.com/o/r/issues/1', updatedAt: '2026-08-07T10:00:00Z' },
				{ number: 2, title: 'Second issue', url: 'https://github.com/o/r/issues/2', updatedAt: '2026-08-07T11:00:00Z' },
			],
			variables: { query: 'repo:o/r is:issue is:open assignee:@me sort:updated-desc' },
			createAuthenticationSession: false,
		});
	});

	test('queries pull request summaries without review threads', async () => {
		const mockApi = new MockApiClient();
		mockApi.setNextResponse({
			search: {
				nodes: [{
					__typename: 'PullRequest',
					number: 3,
					title: 'Fix CI',
					url: 'https://github.com/o/r/pull/3',
					updatedAt: '2026-08-07T12:00:00Z',
					mergeable: 'CONFLICTING',
					commits: { nodes: [{ commit: { committedDate: '2026-08-07T09:00:00Z', statusCheckRollup: { state: 'FAILURE' } } }] },
				}],
			},
		});
		const fetcher = new GitHubRecentUserWorkFetcher(mockApi as unknown as GitHubApiClient);

		assert.deepStrictEqual({
			pullRequests: await fetcher.getRecentAuthoredPullRequests('o', 'r', CancellationToken.None),
			variables: mockApi.graphqlCalls[0].variables,
		}, {
			pullRequests: [{
				number: 3,
				title: 'Fix CI',
				url: 'https://github.com/o/r/pull/3',
				updatedAt: '2026-08-07T12:00:00Z',
				hasMergeConflicts: true,
				statusCheckRollupState: 'FAILURE',
				latestCommitAt: '2026-08-07T09:00:00Z',
			}],
			variables: { query: 'repo:o/r is:pr is:open author:@me sort:updated-desc' },
		});
	});

	test('queries review threads for one pull request independently', async () => {
		const mockApi = new MockApiClient();
		mockApi.setNextResponse({
			repository: {
				pullRequest: {
					reviewThreads: {
						nodes: [{
							isResolved: false,
							comments: { nodes: [{ createdAt: '2026-08-07T10:00:00Z' }] },
						}],
						pageInfo: { hasNextPage: false, endCursor: null },
					},
				},
			},
		});
		const fetcher = new GitHubRecentUserWorkFetcher(mockApi as unknown as GitHubApiClient);

		assert.deepStrictEqual({
			reviewThreads: await fetcher.getPullRequestReviewThreads('o', 'r', 3, CancellationToken.None),
			variables: mockApi.graphqlCalls[0].variables,
		}, {
			reviewThreads: [{ isResolved: false, latestCommentAt: '2026-08-07T10:00:00Z' }],
			variables: { owner: 'o', repo: 'r', pullRequestNumber: 3 },
		});
	});

	test('includes an unresolved review thread that is only on a later page', async () => {
		const mockApi = new MockApiClient();
		mockApi.setResponses(
			{
				repository: {
					pullRequest: {
						reviewThreads: {
							nodes: [{
								isResolved: true,
								comments: { nodes: [{ createdAt: '2026-08-01T00:00:00Z' }] },
							}],
							pageInfo: { hasNextPage: true, endCursor: 'threads-1' },
						},
					},
				},
			},
			{
				repository: {
					pullRequest: {
						reviewThreads: {
							nodes: [{
								isResolved: false,
								comments: { nodes: [{ createdAt: '2026-08-07T10:00:00Z' }] },
							}],
							pageInfo: { hasNextPage: false, endCursor: null },
						},
					},
				},
			},
		);
		const fetcher = new GitHubRecentUserWorkFetcher(mockApi as unknown as GitHubApiClient);

		assert.deepStrictEqual({
			reviewThreads: await fetcher.getPullRequestReviewThreads('o', 'r', 3, CancellationToken.None),
			cursors: mockApi.graphqlCalls.map(call => call.variables?.after ?? null),
		}, {
			reviewThreads: [
				{ isResolved: true, latestCommentAt: '2026-08-01T00:00:00Z' },
				{ isResolved: false, latestCommentAt: '2026-08-07T10:00:00Z' },
			],
			cursors: [null, 'threads-1'],
		});
	});

	test('checks pull request linkage for issue summaries in one request', async () => {
		const mockApi = new MockApiClient();
		mockApi.setNextResponse({
			repository: {
				issue0: { closedByPullRequestsReferences: { totalCount: 1 } },
				issue1: { closedByPullRequestsReferences: { totalCount: 0 } },
			},
		});
		const fetcher = new GitHubRecentUserWorkFetcher(mockApi as unknown as GitHubApiClient);

		assert.deepStrictEqual({
			linkedIssues: [...await fetcher.getIssuesWithLinkedPullRequests('o', 'r', [1, 2], CancellationToken.None)],
			variables: mockApi.graphqlCalls[0].variables,
		}, {
			linkedIssues: [1],
			variables: { owner: 'o', repo: 'r', issue0: 1, issue1: 2 },
		});
	});
});

suite('GitHubRepositoryFetcher', () => {

	const store = new DisposableStore();
	let mockApi: MockApiClient;
	let fetcher: GitHubRepositoryFetcher;

	setup(() => {
		mockApi = new MockApiClient();
		fetcher = new GitHubRepositoryFetcher(mockApi as unknown as GitHubApiClient);
	});

	teardown(() => store.clear());

	ensureNoDisposablesAreLeakedInTestSuite();

	test('getRepository returns mapped data', async () => {
		mockApi.setNextResponse({
			name: 'vscode',
			full_name: 'microsoft/vscode',
			owner: { login: 'microsoft' },
			default_branch: 'main',
			private: false,
			description: 'Visual Studio Code',
		});

		const repo = await fetcher.getRepository('microsoft', 'vscode');
		assert.deepStrictEqual(repo.data, {
			owner: 'microsoft',
			name: 'vscode',
			fullName: 'microsoft/vscode',
			defaultBranch: 'main',
			isPrivate: false,
			description: 'Visual Studio Code',
		});
		assert.strictEqual(mockApi.requestCalls[0].path, '/repos/microsoft/vscode');
	});

	test('getRepository handles null description', async () => {
		mockApi.setNextResponse({
			name: 'test',
			full_name: 'owner/test',
			owner: { login: 'owner' },
			default_branch: 'main',
			private: true,
			description: null,
		});

		const repo = await fetcher.getRepository('owner', 'test');
		assert.strictEqual(repo.data?.description, '');
	});

	test('getRepository propagates API errors', async () => {
		mockApi.setNextError(new GitHubApiError('Not found', 404, undefined));
		await assert.rejects(
			() => fetcher.getRepository('owner', 'nonexistent'),
			(err: Error) => err instanceof GitHubApiError && (err as GitHubApiError).statusCode === 404,
		);
	});
});

suite('GitHubPullRequestContextFetcher', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('returns details, patch, and issue/review comments as one snapshot', async () => {
		const mockApi = new MockApiClient();
		mockApi.setResponses(
			{
				number: 42,
				html_url: 'https://github.com/owner/repo/pull/42',
				title: 'Improve sessions',
				body: 'Description',
				user: { login: 'author' },
				draft: false,
				base: { ref: 'main' },
				head: { ref: 'feature' },
				updated_at: '2026-01-01T00:00:00Z',
			},
			[{ filename: 'src/a.ts', status: 'modified', additions: 2, deletions: 1, patch: '@@ -1 +1 @@' }],
			[{ body: 'General comment', user: { login: 'commenter' }, created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' }],
			[{ body: 'Inline comment', user: { login: 'reviewer' }, created_at: '2026-01-03T00:00:00Z', updated_at: '2026-01-03T00:00:00Z', path: 'src/a.ts', line: 7, original_line: null }],
		);
		const fetcher = new GitHubPullRequestContextFetcher(mockApi as unknown as GitHubApiClient);

		const context = await fetcher.getPullRequestContext('owner', 'repo', 42);

		assert.deepStrictEqual({
			context,
			paths: mockApi.requestCalls.map(call => call.path),
		}, {
			context: {
				owner: 'owner',
				repo: 'repo',
				number: 42,
				url: 'https://github.com/owner/repo/pull/42',
				title: 'Improve sessions',
				description: 'Description',
				author: 'author',
				isDraft: false,
				baseRef: 'main',
				branchName: 'feature',
				headRef: 'feature',
				updatedAt: '2026-01-01T00:00:00Z',
				patch: 'diff --git a/src/a.ts b/src/a.ts\n@@ -1 +1 @@',
				comments: [{
					kind: 'issue',
					author: 'commenter',
					body: 'General comment',
					createdAt: '2026-01-02T00:00:00Z',
					updatedAt: '2026-01-02T00:00:00Z',
				}, {
					kind: 'review',
					author: 'reviewer',
					body: 'Inline comment',
					createdAt: '2026-01-03T00:00:00Z',
					updatedAt: '2026-01-03T00:00:00Z',
					path: 'src/a.ts',
					line: 7,
				}],
			},
			paths: [
				'/repos/owner/repo/pulls/42',
				'/repos/owner/repo/pulls/42/files?per_page=100&page=1',
				'/repos/owner/repo/issues/42/comments?per_page=100&page=1',
				'/repos/owner/repo/pulls/42/comments?per_page=100&page=1',
			],
		});
	});

	test('keeps the snapshot when the author or a commenter deleted their account', async () => {
		const mockApi = new MockApiClient();
		mockApi.setResponses(
			{
				number: 42,
				html_url: 'https://github.com/owner/repo/pull/42',
				title: 'Improve sessions',
				body: null,
				user: null,
				draft: false,
				base: { ref: 'main' },
				head: { ref: 'feature' },
				updated_at: '2026-01-01T00:00:00Z',
			},
			[],
			[{ body: 'From a deleted account', user: null, created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' }],
			[],
		);
		const fetcher = new GitHubPullRequestContextFetcher(mockApi as unknown as GitHubApiClient);

		const context = await fetcher.getPullRequestContext('owner', 'repo', 42);
		assert.deepStrictEqual({
			author: context.author,
			title: context.title,
			comments: context.comments.map(comment => ({ author: comment.author, body: comment.body })),
		}, {
			author: 'ghost',
			title: 'Improve sessions',
			comments: [{ author: 'ghost', body: 'From a deleted account' }],
		});
	});
});

suite('GitHubIssueFetcher', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('keeps an issue whose author deleted their account', async () => {
		const mockApi = new MockApiClient();
		mockApi.setNextResponse({
			number: 7,
			title: 'Still open',
			body: 'Details',
			state: 'open',
			state_reason: null,
			user: null,
			created_at: '2024-01-01T00:00:00Z',
			updated_at: '2024-01-02T00:00:00Z',
			closed_at: null,
		});
		const fetcher = new GitHubIssueFetcher(mockApi as unknown as GitHubApiClient);

		const issue = await fetcher.getIssue('owner', 'repo', 7);
		assert.deepStrictEqual({
			title: issue.data?.title,
			state: issue.data?.state,
			author: issue.data?.author,
		}, {
			title: 'Still open',
			state: GitHubIssueState.Open,
			author: { login: 'ghost', avatarUrl: '' },
		});
	});
});

suite('GitHubPRFetcher', () => {

	const store = new DisposableStore();
	let mockApi: MockApiClient;
	let fetcher: GitHubPRFetcher;

	setup(() => {
		mockApi = new MockApiClient();
		fetcher = new GitHubPRFetcher(mockApi as unknown as GitHubApiClient);
	});

	teardown(() => store.clear());

	ensureNoDisposablesAreLeakedInTestSuite();

	test('getPullRequest keeps a pull request whose author deleted their account', async () => {
		mockApi.setNextResponse({
			...(makePRResponse({ state: 'open', merged: false, draft: false }) as object),
			user: null,
		});

		const pr = await fetcher.getPullRequest('owner', 'repo', 1);
		assert.deepStrictEqual({
			title: pr.data?.title,
			state: pr.data?.state,
			author: pr.data?.author,
		}, {
			title: 'Test PR',
			state: GitHubPullRequestState.Open,
			author: { login: 'ghost', avatarUrl: '' },
		});
	});

	test('getPullRequest maps open PR', async () => {
		mockApi.setNextResponse(makePRResponse({ state: 'open', merged: false, draft: false }));

		const pr = await fetcher.getPullRequest('owner', 'repo', 1);
		assert.strictEqual(pr.data?.state, GitHubPullRequestState.Open);
		assert.strictEqual(pr.data?.isDraft, false);
		assert.strictEqual(pr.data?.number, 1);
		assert.strictEqual(pr.data?.title, 'Test PR');
	});

	test('getPullRequest maps merged PR', async () => {
		mockApi.setNextResponse(makePRResponse({ state: 'closed', merged: true, draft: false }));

		const pr = await fetcher.getPullRequest('owner', 'repo', 1);
		assert.strictEqual(pr.data?.state, GitHubPullRequestState.Merged);
		assert.ok(pr.data?.mergedAt);
	});

	test('getPullRequest maps closed PR', async () => {
		mockApi.setNextResponse(makePRResponse({ state: 'closed', merged: false, draft: false }));

		const pr = await fetcher.getPullRequest('owner', 'repo', 1);
		assert.strictEqual(pr.data?.state, GitHubPullRequestState.Closed);
	});

	test('getReviewThreads returns GraphQL thread metadata', async () => {
		mockApi.setNextResponse(makeGraphQLReviewThreadsResponse([
			makeGraphQLReviewThread({
				id: 'thread-a',
				path: 'src/a.ts',
				line: 10,
				isResolved: false,
				comments: [
					makeGraphQLReviewComment({ databaseId: 100, path: 'src/a.ts', line: 10 }),
					makeGraphQLReviewComment({ databaseId: 101, path: 'src/a.ts', line: 10, replyToDatabaseId: 100 }),
				],
			}),
			makeGraphQLReviewThread({
				id: 'thread-b',
				path: 'src/b.ts',
				line: 20,
				isResolved: true,
				comments: [makeGraphQLReviewComment({ databaseId: 200, path: 'src/b.ts', line: 20 })],
			}),
		]));

		const threads = await fetcher.getReviewThreads('owner', 'repo', 1);
		assert.strictEqual(threads.length, 2);

		const thread1 = threads.find(t => t.id === 'thread-a')!;
		assert.ok(thread1);
		assert.strictEqual(thread1.comments.length, 2);
		assert.strictEqual(thread1.path, 'src/a.ts');
		assert.strictEqual(thread1.line, 10);
		assert.strictEqual(thread1.comments[0].threadId, 'thread-a');

		const thread2 = threads.find(t => t.id === 'thread-b')!;
		assert.ok(thread2);
		assert.strictEqual(thread2.comments.length, 1);
		assert.strictEqual(thread2.path, 'src/b.ts');
		assert.strictEqual(thread2.isResolved, true);
	});

	test('includes an unresolved review thread that is only on a later page', async () => {
		mockApi.setResponses(
			makeGraphQLReviewThreadsResponse([
				makeGraphQLReviewThread({ id: 'thread-old', path: 'src/old.ts', isResolved: true }),
			], { hasNextPage: true, endCursor: 'threads-1' }),
			makeGraphQLReviewThreadsResponse([
				makeGraphQLReviewThread({ id: 'thread-new', path: 'src/new.ts', isResolved: false }),
			], { hasNextPage: false, endCursor: null }),
		);

		const threads = await fetcher.getReviewThreads('owner', 'repo', 1);
		assert.deepStrictEqual({
			ids: threads.map(thread => thread.id),
			unresolved: threads.filter(thread => !thread.isResolved).map(thread => thread.path),
			cursors: mockApi.graphqlCalls.map(call => call.variables?.after ?? null),
		}, {
			ids: ['thread-old', 'thread-new'],
			unresolved: ['src/new.ts'],
			cursors: [null, 'threads-1'],
		});
	});

	test('includes a reply that is only on a later page of review comments', async () => {
		mockApi.setResponses(
			makeGraphQLReviewThreadsResponse([
				makeGraphQLReviewThread({
					id: 'thread-a',
					path: 'src/a.ts',
					comments: [makeGraphQLReviewComment({ databaseId: 1, body: 'first' })],
					commentPageInfo: { hasNextPage: true, endCursor: 'comments-1' },
				}),
			]),
			{
				node: {
					comments: {
						nodes: [makeGraphQLReviewComment({ databaseId: 2, body: 'later reply', replyToDatabaseId: 1 })],
						pageInfo: { hasNextPage: false, endCursor: null },
					},
				},
			},
		);

		const threads = await fetcher.getReviewThreads('owner', 'repo', 1);
		assert.deepStrictEqual({
			comments: threads.map(thread => ({
				id: thread.id,
				comments: thread.comments.map(comment => ({
					id: comment.id,
					body: comment.body,
					inReplyToId: comment.inReplyToId ?? null,
					threadId: comment.threadId,
				})),
			})),
			requestsCommentPage: commentConnectionRequestsPageInfo(mockApi.graphqlCalls[0]?.query ?? ''),
			calls: mockApi.graphqlCalls.map(call => ({
				comments: call.query.includes('node(id: $threadId)'),
				after: call.variables?.after ?? null,
				threadId: call.variables?.threadId ?? null,
			})),
		}, {
			comments: [{
				id: 'thread-a',
				comments: [
					{ id: 1, body: 'first', inReplyToId: null, threadId: 'thread-a' },
					{ id: 2, body: 'later reply', inReplyToId: 1, threadId: 'thread-a' },
				],
			}],
			requestsCommentPage: true,
			calls: [
				{ comments: false, after: null, threadId: null },
				{ comments: true, after: 'comments-1', threadId: 'thread-a' },
			],
		});
	});

	test('resolveThread uses GraphQL mutation', async () => {
		mockApi.setNextResponse({
			resolveReviewThread: {
				thread: {
					isResolved: true,
				},
			},
		});

		await fetcher.resolveThread('owner', 'repo', 'thread-a');
		assert.strictEqual(mockApi.graphqlCalls.length, 1);
		assert.deepStrictEqual(mockApi.graphqlCalls[0].variables, { threadId: 'thread-a' });
	});

	test('getReviews maps API response', async () => {
		mockApi.setNextResponse([
			{ id: 1, user: { login: 'reviewer', avatar_url: '' }, state: 'APPROVED', submitted_at: '2024-01-01T00:00:00Z' },
			{ id: 2, user: { login: 'other', avatar_url: '' }, state: 'CHANGES_REQUESTED', submitted_at: '2024-01-02T00:00:00Z' },
		]);

		const reviews = await fetcher.getReviews('owner', 'repo', 1);
		assert.deepStrictEqual(reviews.data, [
			{ id: 1, author: { login: 'reviewer', avatarUrl: '' }, state: 'APPROVED', submittedAt: '2024-01-01T00:00:00Z' },
			{ id: 2, author: { login: 'other', avatarUrl: '' }, state: 'CHANGES_REQUESTED', submittedAt: '2024-01-02T00:00:00Z' },
		]);
		assert.strictEqual(mockApi.requestCalls.length, 1);
		assert.strictEqual(mockApi.requestCalls[0].path, '/repos/owner/repo/pulls/1/reviews');
	});

	test('getReviews keeps a review from a deleted account', async () => {
		mockApi.setNextResponse([
			{ id: 1, user: null, state: 'CHANGES_REQUESTED', submitted_at: '2024-01-01T00:00:00Z' },
			{ id: 2, user: { login: 'reviewer', avatar_url: '' }, state: 'APPROVED', submitted_at: '2024-01-02T00:00:00Z' },
		]);

		const reviews = await fetcher.getReviews('owner', 'repo', 1);
		const mergeability = computeMergeability(makePR({ state: GitHubPullRequestState.Open, isDraft: false, mergeable: true, mergeableState: 'clean' }), reviews.data ?? []);
		assert.deepStrictEqual({
			authors: reviews.data?.map(review => review.author.login),
			changesRequested: mergeability.blockers.some(blocker => blocker.kind === MergeBlockerKind.ChangesRequested),
		}, {
			authors: ['ghost', 'reviewer'],
			changesRequested: true,
		});
	});

	test('keeps a review comment whose author deleted their account', async () => {
		mockApi.setNextResponse(makeGraphQLReviewThreadsResponse([
			makeGraphQLReviewThread({
				id: 'thread-a',
				path: 'src/a.ts',
				comments: [makeGraphQLReviewComment({ databaseId: 5, body: 'please rename this', author: null })],
			}),
		]));

		const threads = await fetcher.getReviewThreads('owner', 'repo', 1);
		assert.deepStrictEqual(threads.map(thread => thread.comments.map(comment => ({
			body: comment.body,
			author: comment.author.login,
		}))), [[{ body: 'please rename this', author: 'ghost' }]]);
	});

	test('computeMergeability detects draft blocker', () => {
		const pr = makePR({ state: GitHubPullRequestState.Open, isDraft: true, mergeable: true, mergeableState: 'clean' });
		const result = computeMergeability(pr, []);
		assert.strictEqual(result.canMerge, false);
		assert.ok(result.blockers.some(b => b.kind === MergeBlockerKind.Draft));
	});

	test('computeMergeability detects conflicts blocker', () => {
		const pr = makePR({ state: GitHubPullRequestState.Open, isDraft: false, mergeable: false, mergeableState: 'dirty' });
		const result = computeMergeability(pr, []);
		assert.strictEqual(result.canMerge, false);
		assert.ok(result.blockers.some(b => b.kind === MergeBlockerKind.Conflicts));
	});

	test('computeMergeability detects changes requested blocker', () => {
		const pr = makePR({ state: GitHubPullRequestState.Open, isDraft: false, mergeable: true, mergeableState: 'clean' });
		const reviews: IGitHubPullRequestReview[] = [
			{ id: 1, author: { login: 'reviewer', avatarUrl: '' }, state: 'CHANGES_REQUESTED', submittedAt: '2024-01-01T00:00:00Z' },
		];
		const result = computeMergeability(pr, reviews);
		assert.strictEqual(result.canMerge, false);
		assert.ok(result.blockers.some(b => b.kind === MergeBlockerKind.ChangesRequested));
	});

	test('computeMergeability returns canMerge for clean open PR', () => {
		const pr = makePR({ state: GitHubPullRequestState.Open, isDraft: false, mergeable: true, mergeableState: 'clean' });
		const result = computeMergeability(pr, []);
		assert.strictEqual(result.canMerge, true);
		assert.strictEqual(result.blockers.length, 0);
	});
});

suite('GitHubPullRequestsFetcher', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('maps a lightweight page with pagination and diff stats', async () => {
		const mockApi = new MockApiClient();
		mockApi.setNextResponse({
			repository: {
				pullRequests: {
					nodes: [{
						number: 7,
						title: 'Improve sessions',
						author: { login: 'author', avatarUrl: 'avatar' },
						headRefName: 'feature',
						isCrossRepository: false,
						isDraft: true,
						updatedAt: '2026-07-30T12:00:00Z',
						additions: 12,
						deletions: 3,
					}],
					pageInfo: { endCursor: 'cursor-1', hasNextPage: true },
				},
			},
		});
		const fetcher = new GitHubPullRequestsFetcher(mockApi as unknown as GitHubApiClient);

		const page = await fetcher.getPullRequests('microsoft', 'vscode');

		assert.deepStrictEqual(page, {
			pullRequests: [{
				number: 7,
				title: 'Improve sessions',
				author: { login: 'author', avatarUrl: 'avatar' },
				headRef: 'feature',
				checkoutRef: 'refs/pull/7/head',
				isCrossRepository: false,
				isDraft: true,
				updatedAt: '2026-07-30T12:00:00Z',
				additions: 12,
				deletions: 3,
				reviewRequestedFromViewer: false,
				assignedToViewer: false,
			}],
			cursor: 'cursor-1',
			hasNextPage: true,
		});
		assert.deepStrictEqual(mockApi.graphqlCalls[0].variables, { owner: 'microsoft', repo: 'vscode', cursor: null });
	});

	test('loads viewer review and assignment membership with independent small queries', async () => {
		const mockApi = new MockApiClient();
		mockApi.setNextResponse({
			search: { nodes: [makePullRequestSearchNode(7), null, makePullRequestSearchNode(9)] },
		});
		const fetcher = new GitHubPullRequestsFetcher(mockApi as unknown as GitHubApiClient);

		const reviewRequested = await fetcher.getPullRequestsWaitingForReview('microsoft', 'vscode');
		mockApi.setNextResponse({
			search: { nodes: [makePullRequestSearchNode(8), makePullRequestSearchNode(9)] },
		});
		const assigned = await fetcher.getPullRequestsAssignedToViewer('microsoft', 'vscode');

		assert.deepStrictEqual({
			reviewRequested: reviewRequested.map(pullRequest => ({ number: pullRequest.number, reviewRequestedFromViewer: pullRequest.reviewRequestedFromViewer, assignedToViewer: pullRequest.assignedToViewer })),
			assigned: assigned.map(pullRequest => ({ number: pullRequest.number, reviewRequestedFromViewer: pullRequest.reviewRequestedFromViewer, assignedToViewer: pullRequest.assignedToViewer })),
			variables: mockApi.graphqlCalls.map(call => call.variables),
			usesNestedFields: mockApi.graphqlCalls.some(call => call.query.includes('reviewRequests(') || call.query.includes('assignees(')),
		}, {
			reviewRequested: [
				{ number: 7, reviewRequestedFromViewer: true, assignedToViewer: false },
				{ number: 9, reviewRequestedFromViewer: true, assignedToViewer: false },
			],
			assigned: [
				{ number: 8, reviewRequestedFromViewer: false, assignedToViewer: true },
				{ number: 9, reviewRequestedFromViewer: false, assignedToViewer: true },
			],
			variables: [
				{ query: 'repo:microsoft/vscode is:pr is:open review-requested:@me sort:updated-desc' },
				{ query: 'repo:microsoft/vscode is:pr is:open assignee:@me sort:updated-desc' },
			],
			usesNestedFields: false,
		});
	});
});

suite('GitHubPRCIFetcher', () => {

	const store = new DisposableStore();
	let mockApi: MockApiClient;
	let fetcher: GitHubPRCIFetcher;

	setup(() => {
		mockApi = new MockApiClient();
		fetcher = new GitHubPRCIFetcher(mockApi as unknown as GitHubApiClient);
	});

	teardown(() => store.clear());

	ensureNoDisposablesAreLeakedInTestSuite();

	test('getCheckRuns maps check runs', async () => {
		mockApi.setNextResponse({
			total_count: 2,
			check_runs: [
				{ id: 1, name: 'build', status: 'completed', conclusion: 'success', started_at: '2024-01-01T00:00:00Z', completed_at: '2024-01-01T00:10:00Z', details_url: 'https://example.com/1' },
				{ id: 2, name: 'test', status: 'in_progress', conclusion: null, started_at: '2024-01-01T00:00:00Z', completed_at: null, details_url: null },
			],
		});

		const checks = await fetcher.getCheckRuns('owner', 'repo', 'abc123');
		assert.strictEqual(checks.data?.length, 2);
		assert.deepStrictEqual(mockApi.requestCalls.map(call => call.path), [
			'/repos/owner/repo/commits/abc123/check-runs?per_page=100&page=1',
			'/repos/owner/repo/commits/abc123/status?per_page=100&page=1',
		]);
		assert.deepStrictEqual(checks.data?.[0], {
			id: 1,
			name: 'build',
			status: GitHubCheckStatus.Completed,
			conclusion: GitHubCheckConclusion.Success,
			startedAt: '2024-01-01T00:00:00Z',
			completedAt: '2024-01-01T00:10:00Z',
			detailsUrl: 'https://example.com/1',
		});
		assert.strictEqual(checks.data?.[1].conclusion, undefined);
	});

	test('includes a failing check that is only on a later page', async () => {
		mockApi.setResponses(
			{
				total_count: 2,
				check_runs: [
					{ id: 1, name: 'build', status: 'completed', conclusion: 'success', started_at: null, completed_at: null, details_url: null },
				],
			},
			{
				total_count: 2,
				check_runs: [
					{ id: 2, name: 'lint', status: 'completed', conclusion: 'failure', started_at: null, completed_at: null, details_url: 'https://github.com/owner/repo/actions/runs/9/job/1' },
				],
			},
		);

		const checks = await fetcher.getCheckRuns('owner', 'repo', 'sha');
		assert.deepStrictEqual({
			names: checks.data?.map(check => check.name),
			overall: checks.data && computeOverallCIStatus(checks.data),
			paths: mockApi.requestCalls.map(call => call.path),
		}, {
			names: ['build', 'lint'],
			overall: GitHubCIOverallStatus.Failure,
			paths: [
				'/repos/owner/repo/commits/sha/check-runs?per_page=100&page=1',
				'/repos/owner/repo/commits/sha/check-runs?per_page=100&page=2',
				'/repos/owner/repo/commits/sha/status?per_page=100&page=1',
			],
		});
	});

	test('keeps the previous list when the first check-run page is not modified', async () => {
		mockApi.setStatusCodes(304, 404);
		mockApi.setResponses(undefined, undefined);

		const checks = await fetcher.getCheckRuns('owner', 'repo', 'sha', '"etag"');
		assert.deepStrictEqual({
			statusCode: checks.statusCode,
			data: checks.data,
			calls: mockApi.requestCalls.length,
		}, {
			statusCode: 304,
			data: undefined,
			calls: 2,
		});
	});

	test('does not publish the first-page etag when a later page has checks', async () => {
		mockApi.setEtags('"page-1"');
		mockApi.setResponses(
			{
				total_count: 2,
				check_runs: [
					{ id: 1, name: 'build', status: 'completed', conclusion: 'success', started_at: null, completed_at: null, details_url: null },
				],
			},
			{
				total_count: 2,
				check_runs: [
					{ id: 2, name: 'lint', status: 'completed', conclusion: 'failure', started_at: null, completed_at: null, details_url: null },
				],
			},
		);

		const checks = await fetcher.getCheckRuns('owner', 'repo', 'sha');
		assert.deepStrictEqual({
			etag: checks.etag,
			overall: checks.data && computeOverallCIStatus(checks.data),
			calls: mockApi.requestCalls.length,
		}, {
			etag: undefined,
			overall: GitHubCIOverallStatus.Failure,
			calls: 3,
		});
	});

	test('publishes the etag when every check is on the first page', async () => {
		mockApi.setEtags('"only-page"');
		mockApi.setNextResponse({
			total_count: 1,
			check_runs: [
				{ id: 1, name: 'build', status: 'completed', conclusion: 'success', started_at: null, completed_at: null, details_url: null },
			],
		});

		const checks = await fetcher.getCheckRuns('owner', 'repo', 'sha');
		assert.deepStrictEqual({
			etag: checks.etag,
			calls: mockApi.requestCalls.length,
		}, {
			etag: JSON.stringify({ checks: '"only-page"', status: null }),
			calls: 2,
		});
	});

	test('a newer attempt on a later page replaces an older failure of the same check', async () => {
		mockApi.setResponses(
			{
				total_count: 2,
				check_runs: [
					{ id: 10, name: 'build', status: 'completed', conclusion: 'failure', started_at: null, completed_at: null, details_url: null },
				],
			},
			{
				total_count: 2,
				check_runs: [
					{ id: 11, name: 'build', status: 'completed', conclusion: 'success', started_at: null, completed_at: null, details_url: null },
				],
			},
		);

		const checks = await fetcher.getCheckRuns('owner', 'repo', 'sha');
		assert.deepStrictEqual({
			ids: checks.data?.map(check => check.id),
			overall: checks.data && computeOverallCIStatus(checks.data),
			calls: mockApi.requestCalls.length,
		}, {
			ids: [11],
			overall: GitHubCIOverallStatus.Success,
			calls: 3,
		});
	});

	test('includes a failing commit status that is not a check run', async () => {
		mockApi.setResponses(
			{
				total_count: 1,
				check_runs: [
					{ id: 1, name: 'build', status: 'completed', conclusion: 'success', started_at: null, completed_at: null, details_url: null },
				],
			},
			{
				total_count: 2,
				statuses: [
					{ id: 9, context: 'ci/jenkins', state: 'failure', target_url: 'https://ci.example/job/9', description: 'tests failed' },
					{ id: 10, context: 'ci/jenkins', state: 'success', target_url: null, description: null },
					{ id: 11, context: 'deploy', state: 'error', target_url: null, description: '  runner died  ' },
				],
			},
		);

		const checks = await fetcher.getCheckRuns('owner', 'repo', 'sha');
		assert.deepStrictEqual({
			rows: checks.data?.map(check => ({ id: check.id, name: check.name, conclusion: check.conclusion, detailsUrl: check.detailsUrl ?? null })),
			overall: checks.data && computeOverallCIStatus(checks.data),
			jenkins: await fetcher.getCheckRunAnnotations('owner', 'repo', -9),
			deploy: await fetcher.getCheckRunAnnotations('owner', 'repo', -11),
			paths: mockApi.requestCalls.map(call => call.path),
		}, {
			rows: [
				{ id: 1, name: 'build', conclusion: GitHubCheckConclusion.Success, detailsUrl: null },
				{ id: -9, name: 'ci/jenkins', conclusion: GitHubCheckConclusion.Failure, detailsUrl: 'https://ci.example/job/9' },
				{ id: -11, name: 'deploy', conclusion: GitHubCheckConclusion.Failure, detailsUrl: null },
			],
			overall: GitHubCIOverallStatus.Failure,
			jenkins: 'tests failed',
			deploy: 'runner died',
			paths: [
				'/repos/owner/repo/commits/sha/check-runs?per_page=100&page=1',
				'/repos/owner/repo/commits/sha/status?per_page=100&page=1',
			],
		});
	});

	test('does not let a mirrored commit status bring back a rerun that passed', async () => {
		mockApi.setResponses(
			{
				total_count: 1,
				check_runs: [
					{ id: 3, name: 'ci/jenkins', status: 'completed', conclusion: 'success', started_at: null, completed_at: null, details_url: null },
				],
			},
			{
				total_count: 1,
				statuses: [
					{ id: 8, context: 'ci/jenkins', state: 'failure', target_url: 'https://ci.example/old', description: 'old failure' },
				],
			},
		);

		const checks = await fetcher.getCheckRuns('owner', 'repo', 'sha');
		assert.deepStrictEqual({
			ids: checks.data?.map(check => check.id),
			overall: checks.data && computeOverallCIStatus(checks.data),
		}, {
			ids: [3],
			overall: GitHubCIOverallStatus.Success,
		});
	});

	test('includes a failing commit status that is only on a later page', async () => {
		const firstPage = Array.from({ length: 100 }, (_, index) => ({
			id: index + 1,
			context: `lint-${index}`,
			state: 'success',
			target_url: null,
			description: null,
		}));
		mockApi.setResponses(
			{ total_count: 0, check_runs: [] },
			{ total_count: 101, statuses: firstPage },
			{
				total_count: 101,
				statuses: [
					{ id: 101, context: 'ci/jenkins', state: 'failure', target_url: null, description: 'later failure' },
				],
			},
		);

		const checks = await fetcher.getCheckRuns('owner', 'repo', 'sha');
		assert.deepStrictEqual({
			failed: checks.data?.filter(check => check.conclusion === GitHubCheckConclusion.Failure).map(check => check.name),
			overall: checks.data && computeOverallCIStatus(checks.data),
			etag: checks.etag ?? null,
			paths: mockApi.requestCalls.map(call => call.path),
		}, {
			failed: ['ci/jenkins'],
			overall: GitHubCIOverallStatus.Failure,
			etag: null,
			paths: [
				'/repos/owner/repo/commits/sha/check-runs?per_page=100&page=1',
				'/repos/owner/repo/commits/sha/status?per_page=100&page=1',
				'/repos/owner/repo/commits/sha/status?per_page=100&page=2',
			],
		});
	});

	test('keeps check runs when the commit status request is not found', async () => {
		mockApi.setRequestErrors(undefined, new GitHubApiError('Not Found', 404, undefined));
		mockApi.setResponses({
			total_count: 1,
			check_runs: [
				{ id: 1, name: 'build', status: 'completed', conclusion: 'failure', started_at: null, completed_at: null, details_url: null },
			],
		});

		const checks = await fetcher.getCheckRuns('owner', 'repo', 'sha');
		assert.deepStrictEqual({
			names: checks.data?.map(check => check.name),
			overall: checks.data && computeOverallCIStatus(checks.data),
			calls: mockApi.requestCalls.length,
		}, {
			names: ['build'],
			overall: GitHubCIOverallStatus.Failure,
			calls: 2,
		});
	});

	test('reads check runs again when only the commit status changed', async () => {
		mockApi.setStatusCodes(304, 200, 200);
		mockApi.setResponses(
			undefined,
			{
				total_count: 1,
				statuses: [
					{ id: 4, context: 'ci/jenkins', state: 'failure', target_url: null, description: null },
				],
			},
			{
				total_count: 1,
				check_runs: [
					{ id: 1, name: 'build', status: 'completed', conclusion: 'success', started_at: null, completed_at: null, details_url: null },
				],
			},
		);

		const checks = await fetcher.getCheckRuns('owner', 'repo', 'sha', JSON.stringify({ checks: '"checks"', status: '"status"' }));
		assert.deepStrictEqual({
			names: checks.data?.map(check => check.name),
			overall: checks.data && computeOverallCIStatus(checks.data),
			statusCode: checks.statusCode,
			calls: mockApi.requestCalls.length,
		}, {
			names: ['build', 'ci/jenkins'],
			overall: GitHubCIOverallStatus.Failure,
			statusCode: 200,
			calls: 3,
		});
	});

	test('counts a startup_failure conclusion as a failed check', async () => {
		mockApi.setNextResponse({
			total_count: 2,
			check_runs: [
				{ id: 1, name: 'build', status: 'completed', conclusion: 'startup_failure', started_at: null, completed_at: null, details_url: null },
				{ id: 2, name: 'lint', status: 'completed', conclusion: 'success', started_at: null, completed_at: null, details_url: null },
			],
		});

		const checks = await fetcher.getCheckRuns('owner', 'repo', 'sha');
		assert.deepStrictEqual({
			conclusions: checks.data?.map(check => check.conclusion),
			overall: checks.data && computeOverallCIStatus(checks.data),
		}, {
			conclusions: [GitHubCheckConclusion.Failure, GitHubCheckConclusion.Success],
			overall: GitHubCIOverallStatus.Failure,
		});
	});

	test('a newer failure of the same check is not hidden by an older success', async () => {
		mockApi.setNextResponse({
			total_count: 2,
			check_runs: [
				{ id: 21, name: 'build', status: 'in_progress', conclusion: null, started_at: null, completed_at: null, details_url: null },
				{ id: 20, name: 'build', status: 'completed', conclusion: 'success', started_at: null, completed_at: null, details_url: null },
				{ id: 31, name: 'lint', status: 'completed', conclusion: 'failure', started_at: null, completed_at: null, details_url: null },
				{ id: 30, name: 'lint', status: 'completed', conclusion: 'success', started_at: null, completed_at: null, details_url: null },
			],
		});

		const checks = await fetcher.getCheckRuns('owner', 'repo', 'sha');
		assert.deepStrictEqual({
			ids: checks.data?.map(check => check.id),
			overall: checks.data && computeOverallCIStatus(checks.data),
		}, {
			ids: [21, 31],
			overall: GitHubCIOverallStatus.Failure,
		});
	});

	test('getCheckRunAnnotations returns formatted annotations', async () => {
		mockApi.setNextResponse([
			{ path: 'src/a.ts', start_line: 10, end_line: 10, annotation_level: 'failure', message: 'type error', title: 'TS2345' },
			{ path: 'src/b.ts', start_line: 5, end_line: 8, annotation_level: 'warning', message: 'unused var', title: null },
		]);

		const result = await fetcher.getCheckRunAnnotations('owner', 'repo', 1);
		assert.ok(result.includes('[failure] src/a.ts:10'));
		assert.ok(result.includes('(TS2345)'));
		assert.ok(result.includes('[warning] src/b.ts:5-8'));
		assert.deepStrictEqual(mockApi.requestCalls.map(call => call.path).filter(path => path.includes('/annotations')), [
			'/repos/owner/repo/check-runs/1/annotations?per_page=100&page=1',
		]);
	});

	test('includes an annotation that is only on a later page', async () => {
		const firstPage = Array.from({ length: 100 }, (_, index) => ({
			path: 'src/a.ts',
			start_line: index + 1,
			end_line: index + 1,
			annotation_level: 'warning',
			message: `warning ${index}`,
			title: null,
		}));
		mockApi.setResponses(
			{ output: { title: null, summary: null, text: null, annotations_count: 101 } },
			firstPage,
			[{ path: 'src/b.ts', start_line: 4, end_line: 4, annotation_level: 'failure', message: 'later failure', title: null }],
		);

		const result = await fetcher.getCheckRunAnnotations('owner', 'repo', 1);
		assert.ok(result.includes('[warning] src/a.ts:1 warning 0'));
		assert.ok(result.includes('[warning] src/a.ts:100 warning 99'));
		assert.ok(result.includes('[failure] src/b.ts:4 later failure'));
		assert.deepStrictEqual(mockApi.requestCalls.map(call => call.path), [
			'/repos/owner/repo/check-runs/1',
			'/repos/owner/repo/check-runs/1/annotations?per_page=100&page=1',
			'/repos/owner/repo/check-runs/1/annotations?per_page=100&page=2',
		]);
	});

	test('rerunFailedJobs sends POST to correct endpoint', async () => {
		mockApi.setNextResponse(undefined);

		await fetcher.rerunFailedJobs('myOwner', 'myRepo', 12345);

		assert.strictEqual(mockApi.requestCalls.length, 1);
		assert.deepStrictEqual(mockApi.requestCalls[0], {
			method: 'POST',
			path: '/repos/myOwner/myRepo/actions/runs/12345/rerun-failed-jobs',
			body: undefined,
		});
	});
});

suite('computeOverallCIStatus', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('returns neutral for empty checks', () => {
		assert.strictEqual(computeOverallCIStatus([]), GitHubCIOverallStatus.Neutral);
	});

	test('returns success when all completed successfully', () => {
		const checks = [
			makeCheck({ status: GitHubCheckStatus.Completed, conclusion: GitHubCheckConclusion.Success }),
			makeCheck({ status: GitHubCheckStatus.Completed, conclusion: GitHubCheckConclusion.Neutral }),
		];
		assert.strictEqual(computeOverallCIStatus(checks), GitHubCIOverallStatus.Success);
	});

	test('returns failure when any check failed', () => {
		const checks = [
			makeCheck({ status: GitHubCheckStatus.Completed, conclusion: GitHubCheckConclusion.Success }),
			makeCheck({ status: GitHubCheckStatus.Completed, conclusion: GitHubCheckConclusion.Failure }),
		];
		assert.strictEqual(computeOverallCIStatus(checks), GitHubCIOverallStatus.Failure);
	});

	test('returns pending when any check is in progress', () => {
		const checks = [
			makeCheck({ status: GitHubCheckStatus.Completed, conclusion: GitHubCheckConclusion.Success }),
			makeCheck({ status: GitHubCheckStatus.InProgress, conclusion: undefined }),
		];
		assert.strictEqual(computeOverallCIStatus(checks), GitHubCIOverallStatus.Pending);
	});

	test('failure takes precedence over pending', () => {
		const checks = [
			makeCheck({ status: GitHubCheckStatus.Completed, conclusion: GitHubCheckConclusion.Failure }),
			makeCheck({ status: GitHubCheckStatus.InProgress, conclusion: undefined }),
		];
		assert.strictEqual(computeOverallCIStatus(checks), GitHubCIOverallStatus.Failure);
	});
});


//#region Test Helpers

function makePR(overrides: {
	state: GitHubPullRequestState;
	isDraft: boolean;
	mergeable: boolean | undefined;
	mergeableState: string;
}): IGitHubPullRequest {
	return {
		number: 1,
		title: 'Test PR',
		body: 'Test body',
		state: overrides.state,
		author: { login: 'author', avatarUrl: '' },
		headRef: 'feature',
		headSha: 'abc123',
		baseRef: 'main',
		isDraft: overrides.isDraft,
		createdAt: '2024-01-01T00:00:00Z',
		updatedAt: '2024-01-02T00:00:00Z',
		mergedAt: undefined,
		mergeable: overrides.mergeable,
		mergeableState: overrides.mergeableState,
	};
}

function makePullRequestSearchNode(number: number): unknown {
	return {
		number,
		title: `Pull request ${number}`,
		author: { login: 'author', avatarUrl: '' },
		headRefName: `feature-${number}`,
		isCrossRepository: false,
		isDraft: false,
		updatedAt: '2026-07-30T12:00:00Z',
		additions: number,
		deletions: 1,
	};
}

function makePRResponse(overrides: {
	state: 'open' | 'closed';
	merged: boolean;
	draft: boolean;
	mergeable?: boolean | null;
	mergeable_state?: string;
}): unknown {
	return {
		number: 1,
		title: 'Test PR',
		body: 'Test body',
		state: overrides.state,
		draft: overrides.draft,
		user: { login: 'author', avatar_url: 'https://example.com/avatar' },
		head: { ref: 'feature-branch' },
		base: { ref: 'main' },
		created_at: '2024-01-01T00:00:00Z',
		updated_at: '2024-01-02T00:00:00Z',
		merged_at: overrides.merged ? '2024-01-02T00:00:00Z' : null,
		mergeable: overrides.mergeable ?? true,
		mergeable_state: overrides.mergeable_state ?? 'clean',
		merged: overrides.merged,
	};
}

/** True when the comment connection asks for its own pageInfo ahead of the thread connection's. */
function commentConnectionRequestsPageInfo(query: string): boolean {
	const afterComments = query.slice(query.indexOf('comments(first: 100)'));
	const commentPageInfoAt = afterComments.indexOf('pageInfo { endCursor hasNextPage }');
	if (commentPageInfoAt < 0) {
		return false;
	}
	return afterComments.indexOf('pageInfo { endCursor hasNextPage }', commentPageInfoAt + 1) > commentPageInfoAt;
}

function makeGraphQLReviewThreadsResponse(threads: readonly ReturnType<typeof makeGraphQLReviewThread>[], pageInfo?: { hasNextPage: boolean; endCursor: string | null }): unknown {
	return {
		repository: {
			pullRequest: {
				reviewThreads: {
					nodes: threads,
					pageInfo: pageInfo ?? { hasNextPage: false, endCursor: null },
				},
			},
		},
	};
}

function makeGraphQLReviewThread(overrides: Partial<{
	id: string;
	isResolved: boolean;
	path: string;
	line: number;
	comments: readonly ReturnType<typeof makeGraphQLReviewComment>[];
	commentPageInfo: { hasNextPage: boolean; endCursor: string | null };
}> = {}): unknown {
	return {
		id: overrides.id ?? 'thread-1',
		isResolved: overrides.isResolved ?? false,
		path: overrides.path ?? 'src/a.ts',
		line: overrides.line ?? 10,
		comments: {
			nodes: overrides.comments ?? [makeGraphQLReviewComment()],
			...(overrides.commentPageInfo ? { pageInfo: overrides.commentPageInfo } : {}),
		},
	};
}

function makeGraphQLReviewComment(overrides: Partial<{
	databaseId: number;
	body: string;
	path: string;
	line: number;
	replyToDatabaseId: number;
	author: { readonly login: string; readonly avatarUrl: string } | null;
}> = {}): unknown {
	return {
		databaseId: overrides.databaseId ?? 100,
		body: overrides.body ?? 'Test comment',
		createdAt: '2024-01-01T00:00:00Z',
		updatedAt: '2024-01-01T00:00:00Z',
		path: overrides.path ?? 'src/a.ts',
		line: overrides.line ?? 10,
		originalLine: overrides.line ?? 10,
		replyTo: overrides.replyToDatabaseId !== undefined ? { databaseId: overrides.replyToDatabaseId } : null,
		author: overrides.author === undefined ? {
			login: 'reviewer',
			avatarUrl: 'https://example.com/avatar',
		} : overrides.author,
	};
}

function makeCheck(overrides: {
	status: GitHubCheckStatus;
	conclusion: GitHubCheckConclusion | undefined;
}): { id: number; name: string; status: GitHubCheckStatus; conclusion: GitHubCheckConclusion | undefined; startedAt: string | undefined; completedAt: string | undefined; detailsUrl: string | undefined } {
	return {
		id: 1,
		name: 'test-check',
		status: overrides.status,
		conclusion: overrides.conclusion,
		startedAt: undefined,
		completedAt: undefined,
		detailsUrl: undefined,
	};
}

//#endregion
