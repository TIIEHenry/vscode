/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	GitHubPullRequestState,
	IGitHubPRComment,
	IGitHubPullRequestReview,
	IGitHubPullRequest,
	IGitHubPullRequestMergeability,
	IGitHubUser,
	IMergeBlocker,
	MergeBlockerKind,
	IGitHubPullRequestReviewThread,
} from '../../common/types.js';
import { GitHubApiClient, IGitHubApiResponse } from '../githubApiClient.js';

//#region GitHub API response types

interface IGitHubPRResponse {
	readonly number: number;
	readonly title: string;
	readonly body: string | null;
	readonly state: 'open' | 'closed';
	readonly draft: boolean;
	/** `null` when the author deleted their account. */
	readonly user: { readonly login: string; readonly avatar_url: string } | null;
	readonly head: { readonly ref: string; readonly sha: string };
	readonly base: { readonly ref: string };
	readonly created_at: string;
	readonly updated_at: string;
	readonly merged_at: string | null;
	readonly mergeable: boolean | null;
	readonly mergeable_state: string;
	readonly merged: boolean;
}

interface IGitHubReviewResponse {
	readonly id: number;
	/** `null` when the reviewer deleted their account. */
	readonly user: { readonly login: string; readonly avatar_url: string } | null;
	readonly state: string;
	readonly submitted_at: string;
}

interface IGitHubReviewCommentResponse {
	readonly id: number;
	readonly body: string;
	/** `null` when the commenter deleted their account. */
	readonly user: { readonly login: string; readonly avatar_url: string } | null;
	readonly created_at: string;
	readonly updated_at: string;
	readonly path: string;
	readonly line: number | null;
	readonly original_line: number | null;
	readonly in_reply_to_id?: number;
}

interface IGitHubIssueCommentResponse {
	readonly id: number;
	readonly body: string | null;
	/** `null` when the commenter deleted their account. */
	readonly user: { readonly login: string; readonly avatar_url: string } | null;
	readonly created_at: string;
	readonly updated_at: string;
}

interface IGitHubGraphQLReviewThreadPageInfo {
	readonly endCursor?: string | null;
	readonly hasNextPage?: boolean;
}

interface IGitHubGraphQLReviewCommentConnection {
	readonly nodes: readonly (IGitHubGraphQLReviewCommentNode | null)[] | null;
	readonly pageInfo?: IGitHubGraphQLReviewThreadPageInfo;
}

interface IGitHubGraphQLPullRequestReviewThreadsResponse {
	readonly repository: {
		readonly pullRequest: {
			readonly reviewThreads: {
				readonly nodes: readonly (IGitHubGraphQLReviewThreadNode | null)[] | null;
				readonly pageInfo?: IGitHubGraphQLReviewThreadPageInfo;
			};
		} | null;
	} | null;
}

interface IGitHubGraphQLReviewThreadCommentsResponse {
	readonly node: {
		readonly comments?: IGitHubGraphQLReviewCommentConnection | null;
	} | null;
}

interface IGitHubGraphQLReviewThreadNode {
	readonly id: string;
	readonly isResolved: boolean;
	readonly path: string;
	readonly line: number | null;
	readonly comments: IGitHubGraphQLReviewCommentConnection;
}

interface IGitHubGraphQLReviewCommentNode {
	readonly databaseId: number | null;
	readonly body: string;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly path: string | null;
	readonly line: number | null;
	readonly originalLine: number | null;
	readonly replyTo: { readonly databaseId: number | null } | null;
	readonly author: { readonly login: string; readonly avatarUrl: string } | null;
}

interface IGitHubGraphQLResolveReviewThreadResponse {
	readonly resolveReviewThread: {
		readonly thread: {
			readonly isResolved: boolean;
		} | null;
	} | null;
}

//#endregion

/** `reviewThreads(first: 100)` and `comments(first: 100)` are each one page. Keep following the cursor past that. */
const MAX_REVIEW_THREAD_PAGES = 100;

const REVIEW_COMMENT_CONNECTION = [
	'nodes {',
	'  databaseId',
	'  body',
	'  createdAt',
	'  updatedAt',
	'  path',
	'  line',
	'  originalLine',
	'  replyTo {',
	'    databaseId',
	'  }',
	'  author {',
	'    login',
	'    avatarUrl',
	'  }',
	'}',
	'pageInfo { endCursor hasNextPage }',
].join('\n');

const GET_REVIEW_THREADS_QUERY = [
	'query GetReviewThreads($owner: String!, $repo: String!, $prNumber: Int!, $after: String) {',
	'  repository(owner: $owner, name: $repo) {',
	'    pullRequest(number: $prNumber) {',
	'      reviewThreads(first: 100, after: $after) {',
	'        nodes {',
	'          id',
	'          isResolved',
	'          path',
	'          line',
	'          comments(first: 100) {',
	REVIEW_COMMENT_CONNECTION,
	'          }',
	'        }',
	'        pageInfo { endCursor hasNextPage }',
	'      }',
	'    }',
	'  }',
	'}',
].join('\n');

const GET_REVIEW_THREAD_COMMENTS_QUERY = [
	'query GetReviewThreadComments($threadId: ID!, $after: String) {',
	'  node(id: $threadId) {',
	'    ... on PullRequestReviewThread {',
	'      comments(first: 100, after: $after) {',
	REVIEW_COMMENT_CONNECTION,
	'      }',
	'    }',
	'  }',
	'}',
].join('\n');

const RESOLVE_REVIEW_THREAD_MUTATION = [
	'mutation ResolveReviewThread($threadId: ID!) {',
	'  resolveReviewThread(input: { threadId: $threadId }) {',
	'    thread {',
	'      isResolved',
	'    }',
	'  }',
	'}',
].join('\n');

/**
 * Stateless fetcher for GitHub pull request data.
 * Handles all PR-related REST API calls including reviews, comments, and mergeability.
 */
export class GitHubPRFetcher {

	constructor(
		private readonly _apiClient: GitHubApiClient,
	) { }

	async getPullRequest(owner: string, repo: string, prNumber: number, etag?: string): Promise<IGitHubApiResponse<IGitHubPullRequest>> {
		const response = await this._apiClient.request<IGitHubPRResponse>(
			'GET',
			`/repos/${e(owner)}/${e(repo)}/pulls/${prNumber}`,
			'githubApi.getPullRequest',
			{ etag }
		);

		return {
			...response,
			data: response.data
				? mapPullRequest(response.data)
				: undefined
		};
	}

	async getReviews(owner: string, repo: string, prNumber: number, etag?: string): Promise<IGitHubApiResponse<readonly IGitHubPullRequestReview[]>> {
		const response = await this._apiClient.request<readonly IGitHubReviewResponse[]>(
			'GET',
			`/repos/${e(owner)}/${e(repo)}/pulls/${prNumber}/reviews`,
			'githubApi.getReviews',
			{ etag }
		);

		return {
			...response,
			data: response.data
				? response.data.map(mapReview)
				: undefined
		};
	}

	async getReviewThreads(owner: string, repo: string, prNumber: number): Promise<IGitHubPullRequestReviewThread[]> {
		const threads: IGitHubPullRequestReviewThread[] = [];
		const seenIds = new Set<string>();
		let after: string | undefined;
		for (let page = 0; page < MAX_REVIEW_THREAD_PAGES; page++) {
			const data = await this._apiClient.graphql<IGitHubGraphQLPullRequestReviewThreadsResponse>(
				GET_REVIEW_THREADS_QUERY,
				'githubApi.getReviewThreads',
				after ? { owner, repo, prNumber, after } : { owner, repo, prNumber },
			);

			const connection = data.repository?.pullRequest?.reviewThreads;
			if (!connection) {
				// A later page failing to resolve the pull request must not discard
				// threads already read. The first page still means the PR is gone.
				if (threads.length === 0) {
					throw new Error(`Pull request not found: ${owner}/${repo}#${prNumber}`);
				}
				return threads;
			}

			for (const node of connection.nodes ?? []) {
				if (!node || seenIds.has(node.id)) {
					continue;
				}
				seenIds.add(node.id);
				threads.push(await mapReviewThread(this._apiClient, node));
			}

			const next = connection.pageInfo?.hasNextPage ? connection.pageInfo.endCursor : undefined;
			if (!next || next === after) {
				return threads;
			}
			after = next;
		}

		return threads;
	}

	async postReviewComment(
		owner: string,
		repo: string,
		prNumber: number,
		body: string,
		inReplyTo: number,
	): Promise<IGitHubPRComment> {
		const response = await this._apiClient.request<IGitHubReviewCommentResponse>(
			'POST',
			`/repos/${e(owner)}/${e(repo)}/pulls/${prNumber}/comments`,
			'githubApi.postReviewComment',
			{ data: { body, in_reply_to: inReplyTo } }
		);
		if (!response.data) {
			throw new Error(`Failed to post review comment to ${owner}/${repo}#${prNumber}`);
		}
		return mapReviewComment(response.data);
	}

	async postIssueComment(
		owner: string,
		repo: string,
		prNumber: number,
		body: string,
	): Promise<IGitHubPRComment> {
		const response = await this._apiClient.request<IGitHubIssueCommentResponse>(
			'POST',
			`/repos/${e(owner)}/${e(repo)}/issues/${prNumber}/comments`,
			'githubApi.postIssueComment',
			{ data: { body } },
		);
		const data = response.data;
		if (!data) {
			throw new Error(`Failed to post issue comment to ${owner}/${repo}#${prNumber}`);
		}
		return {
			id: data.id,
			body: data.body ?? '',
			author: mapUser(data.user),
			createdAt: data.created_at,
			updatedAt: data.updated_at,
			path: undefined,
			line: undefined,
			threadId: String(data.id),
			inReplyToId: undefined,
		};
	}

	async resolveThread(_owner: string, _repo: string, threadId: string): Promise<void> {
		const data = await this._apiClient.graphql<IGitHubGraphQLResolveReviewThreadResponse>(
			RESOLVE_REVIEW_THREAD_MUTATION,
			'githubApi.resolveThread',
			{ threadId },
		);

		if (!data.resolveReviewThread?.thread?.isResolved) {
			throw new Error(`Failed to resolve review thread ${threadId}`);
		}
	}
}

/**
 * Compute pull request mergeability from a PR and its reviews. Pure function
 * so callers that already have the PR payload don't need to refetch it.
 */
export function computeMergeability(pr: IGitHubPullRequest, reviews: readonly IGitHubPullRequestReview[]): IGitHubPullRequestMergeability {
	const blockers: IMergeBlocker[] = [];

	// Draft
	if (pr.isDraft) {
		blockers.push({ kind: MergeBlockerKind.Draft, description: 'Pull request is a draft' });
	}

	// Merge conflicts
	if (pr.mergeable === false) {
		blockers.push({ kind: MergeBlockerKind.Conflicts, description: 'Pull request has merge conflicts' });
	}

	// Changes requested — check most recent review per reviewer
	const latestReviewByUser = new Map<string, string>();
	for (const review of reviews) {
		if (review.state === 'APPROVED' || review.state === 'CHANGES_REQUESTED' || review.state === 'DISMISSED') {
			latestReviewByUser.set(review.author.login, review.state);
		}
	}
	const hasChangesRequested = [...latestReviewByUser.values()].some(s => s === 'CHANGES_REQUESTED');
	if (hasChangesRequested) {
		blockers.push({ kind: MergeBlockerKind.ChangesRequested, description: 'Changes have been requested' });
	}

	// Approval needed — check mergeable_state
	if (pr.mergeableState === 'blocked') {
		const hasApproval = [...latestReviewByUser.values()].some(s => s === 'APPROVED');
		if (!hasApproval) {
			blockers.push({ kind: MergeBlockerKind.ApprovalNeeded, description: 'Approval is required' });
		}
	}

	// CI failures — mergeable_state 'unstable' indicates check failures
	if (pr.mergeableState === 'unstable') {
		blockers.push({ kind: MergeBlockerKind.CIFailed, description: 'CI checks have failed' });
	}

	return {
		canMerge: blockers.length === 0 && pr.mergeable !== false && pr.state === GitHubPullRequestState.Open,
		blockers,
	};
}

//#region Helpers

function e(value: string): string {
	return encodeURIComponent(value);
}

function mapUser(user: { readonly login: string; readonly avatar_url: string } | null): IGitHubUser {
	// A deleted account is `null`. Throwing drops the whole pull request, so the
	// title and open/merged state never load. The pull request list already uses ghost.
	return user ? { login: user.login, avatarUrl: user.avatar_url } : { login: 'ghost', avatarUrl: '' };
}

function mapPullRequest(data: IGitHubPRResponse): IGitHubPullRequest {
	let state: GitHubPullRequestState;
	if (data.merged) {
		state = GitHubPullRequestState.Merged;
	} else if (data.state === 'closed') {
		state = GitHubPullRequestState.Closed;
	} else {
		state = GitHubPullRequestState.Open;
	}

	return {
		number: data.number,
		title: data.title,
		body: data.body ?? '',
		state,
		author: mapUser(data.user),
		headRef: data.head.ref,
		headSha: data.head.sha,
		baseRef: data.base.ref,
		isDraft: data.draft,
		createdAt: data.created_at,
		updatedAt: data.updated_at,
		mergedAt: data.merged_at ?? undefined,
		mergeable: data.mergeable ?? undefined,
		mergeableState: data.mergeable_state,
	};
}

function mapReview(data: IGitHubReviewResponse): IGitHubPullRequestReview {
	return {
		id: data.id,
		author: mapUser(data.user),
		state: data.state,
		submittedAt: data.submitted_at,
	};
}

function mapReviewComment(data: IGitHubReviewCommentResponse): IGitHubPRComment {
	return {
		id: data.id,
		body: data.body,
		author: mapUser(data.user),
		createdAt: data.created_at,
		updatedAt: data.updated_at,
		path: data.path,
		line: data.line ?? data.original_line ?? undefined,
		threadId: String(data.in_reply_to_id ?? data.id),
		inReplyToId: data.in_reply_to_id,
	};
}

async function mapReviewThread(apiClient: GitHubApiClient, thread: IGitHubGraphQLReviewThreadNode): Promise<IGitHubPullRequestReviewThread> {
	const comments: IGitHubPRComment[] = [];
	const seenCommentIds = new Set<number>();
	let connection: IGitHubGraphQLReviewCommentConnection | null | undefined = thread.comments;
	let after: string | undefined;
	for (let page = 0; connection && page < MAX_REVIEW_THREAD_PAGES; page++) {
		appendReviewComments(comments, seenCommentIds, thread, connection.nodes);
		const next: string | undefined = connection.pageInfo?.hasNextPage ? connection.pageInfo.endCursor ?? undefined : undefined;
		// This page is already counted. Do not request another one the cap would ignore.
		if (!next || next === after || page + 1 >= MAX_REVIEW_THREAD_PAGES) {
			break;
		}
		after = next;
		const data: IGitHubGraphQLReviewThreadCommentsResponse = await apiClient.graphql<IGitHubGraphQLReviewThreadCommentsResponse>(
			GET_REVIEW_THREAD_COMMENTS_QUERY,
			'githubApi.getReviewThreadComments',
			{ threadId: thread.id, after },
		);
		// A later page failing to resolve the thread must not discard comments already read.
		connection = data.node?.comments;
	}

	return {
		id: thread.id,
		isResolved: thread.isResolved,
		path: thread.path,
		line: thread.line ?? undefined,
		comments,
	};
}

function appendReviewComments(comments: IGitHubPRComment[], seenCommentIds: Set<number>, thread: IGitHubGraphQLReviewThreadNode, nodes: readonly (IGitHubGraphQLReviewCommentNode | null)[] | null): void {
	for (const comment of nodes ?? []) {
		if (!comment || comment.databaseId === null || seenCommentIds.has(comment.databaseId)) {
			continue;
		}
		const mapped = mapGraphQLReviewComment(comment, thread);
		if (mapped.length === 0) {
			continue;
		}
		seenCommentIds.add(comment.databaseId);
		comments.push(...mapped);
	}
}

function mapGraphQLReviewComment(comment: IGitHubGraphQLReviewCommentNode, thread: IGitHubGraphQLReviewThreadNode): readonly IGitHubPRComment[] {
	// No database id means the comment cannot be addressed. A deleted author still
	// has a body; dropping it hides that review text.
	if (comment.databaseId === null) {
		return [];
	}

	return [{
		id: comment.databaseId,
		body: comment.body,
		author: comment.author
			? { login: comment.author.login, avatarUrl: comment.author.avatarUrl }
			: { login: 'ghost', avatarUrl: '' },
		createdAt: comment.createdAt,
		updatedAt: comment.updatedAt,
		path: comment.path ?? thread.path,
		line: comment.line ?? comment.originalLine ?? thread.line ?? undefined,
		threadId: thread.id,
		inReplyToId: comment.replyTo?.databaseId ?? undefined,
	}];
}

//#endregion
