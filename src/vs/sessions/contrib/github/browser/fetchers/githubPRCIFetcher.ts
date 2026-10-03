/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHubCheckConclusion, GitHubCheckStatus, GitHubCIOverallStatus, IGitHubCICheck } from '../../common/types.js';
import { GitHubApiClient, IGitHubApiResponse } from '../githubApiClient.js';

//#region GitHub API response types

interface IGitHubCheckRunResponse {
	readonly id: number;
	readonly name: string;
	readonly status: string;
	readonly conclusion: string | null;
	readonly started_at: string | null;
	readonly completed_at: string | null;
	readonly details_url: string | null;
}

interface IGitHubCheckRunsListResponse {
	readonly total_count: number;
	readonly check_runs: readonly IGitHubCheckRunResponse[];
}

interface IGitHubCheckRunAnnotationResponse {
	readonly path: string;
	readonly start_line: number;
	readonly end_line: number;
	readonly annotation_level: string;
	readonly message: string;
	readonly title: string | null;
}

interface IGitHubCheckRunDetailResponse {
	readonly id: number;
	readonly name: string;
	readonly details_url: string | null;
	readonly app: {
		readonly slug: string;
	} | null;
	readonly output: {
		readonly title: string | null;
		readonly summary: string | null;
		readonly text: string | null;
		readonly annotations_count: number;
	};
}

//#endregion

/** GitHub's check-run list defaults to 30. Ask for the maximum page and follow `total_count`. */
const CHECK_RUNS_PER_PAGE = 100;

/** A ref is capped at about 1000 check suites, so this is past the last useful page. */
const MAX_CHECK_RUN_PAGES = 20;

/**
 * Stateless fetcher for GitHub CI check data (check runs, check suites).
 * All methods return raw typed data with no caching or state.
 */
export class GitHubPRCIFetcher {

	constructor(
		private readonly _apiClient: GitHubApiClient,
	) { }

	async getCheckRuns(owner: string, repo: string, ref: string, etag?: string): Promise<IGitHubApiResponse<readonly IGitHubCICheck[]>> {
		const checks: IGitHubCICheck[] = [];
		const seenIds = new Set<number>();
		let responseEtag: string | undefined;
		// An ETag matches one URL. Publishing the first page's tag after a
		// multi-page read makes the next 304 skip a failure that only changed later.
		let etagCoversList = true;

		for (let page = 1; page <= MAX_CHECK_RUN_PAGES; page++) {
			const response = await this._apiClient.request<IGitHubCheckRunsListResponse>(
				'GET',
				`/repos/${e(owner)}/${e(repo)}/commits/${e(ref)}/check-runs?per_page=${CHECK_RUNS_PER_PAGE}&page=${page}`,
				'githubApi.getCheckRuns',
				page === 1 ? { etag } : undefined,
			);

			// Not Modified is only requested when the previous result fit on this page,
			// so the caller already has the full list. A later page must not be read
			// or the list cleared.
			if (page === 1 && response.statusCode === 304) {
				return { data: undefined, statusCode: 304, etag: response.etag };
			}

			const data = response.data;
			if (!data) {
				break;
			}
			if (page === 1) {
				responseEtag = response.etag;
			}

			let added = 0;
			for (const run of data.check_runs) {
				if (seenIds.has(run.id)) {
					continue;
				}
				seenIds.add(run.id);
				checks.push(mapCheckRun(run));
				added++;
			}

			const total = typeof data.total_count === 'number' ? data.total_count : checks.length;
			if (added === 0 || checks.length >= total) {
				break;
			}
			etagCoversList = false;
		}

		// A rerun or a reopened pull request leaves the older attempt in the list.
		// That stale failure would keep the check red after the newer attempt passed.
		return { data: keepLatestCheckAttempt(checks), statusCode: 200, etag: etagCoversList ? responseEtag : undefined };
	}

	/**
	 * Rerun failed jobs in a GitHub Actions workflow run.
	 */
	async rerunFailedJobs(owner: string, repo: string, runId: number): Promise<void> {
		await this._apiClient.request<void>(
			'POST',
			`/repos/${e(owner)}/${e(repo)}/actions/runs/${runId}/rerun-failed-jobs`,
			'githubApi.rerunFailedJobs'
		);
	}

	/**
	 * Get logs/output for a specific check run.
	 *
	 * Tries multiple sources in order:
	 * 1. The check run's own output fields (title, summary, text) — set by the
	 *    check run creator via the Checks API.
	 * 2. Annotations attached to the check run.
	 * 3. GitHub Actions job logs (only works for GitHub Actions workflows).
	 */
	async getCheckRunAnnotations(owner: string, repo: string, checkRunId: number): Promise<string> {
		const sections: string[] = [];

		// 1. Fetch check run detail for output fields
		try {
			const detailResponse = await this._apiClient.request<IGitHubCheckRunDetailResponse>(
				'GET',
				`/repos/${e(owner)}/${e(repo)}/check-runs/${checkRunId}`,
				'githubApi.getCheckRunAnnotations'
			);
			const output = detailResponse.data?.output;
			if (output?.title) {
				sections.push(`# ${output.title}`);
			}
			if (output?.summary) {
				sections.push(output.summary);
			}
			if (output?.text) {
				sections.push(output.text);
			}
		} catch {
			// Ignore — output may not be available
		}

		// 2. Fetch annotations
		try {
			const annotationsResponse = await this._apiClient.request<readonly IGitHubCheckRunAnnotationResponse[]>(
				'GET',
				`/repos/${e(owner)}/${e(repo)}/check-runs/${checkRunId}/annotations`,
				'githubApi.getCheckRunAnnotations.annotations'
			);
			const annotations = annotationsResponse.data;
			if (annotations && annotations.length > 0) {
				sections.push(
					annotations.map(a =>
						`[${a.annotation_level}] ${a.path}:${a.start_line}${a.end_line !== a.start_line ? `-${a.end_line}` : ''} ${a.title ? `(${a.title}) ` : ''}${a.message}`
					).join('\n')
				);
			}
		} catch {
			// Ignore — annotations may not be available
		}

		if (sections.length > 0) {
			return sections.join('\n\n');
		}

		return 'No output available for this check run.';
	}
}

//#region Helpers

function e(value: string): string {
	return encodeURIComponent(value);
}

function keepLatestCheckAttempt(checks: readonly IGitHubCICheck[]): IGitHubCICheck[] {
	const indexByName = new Map<string, number>();
	const latest: IGitHubCICheck[] = [];
	for (const check of checks) {
		const index = indexByName.get(check.name);
		if (index === undefined) {
			indexByName.set(check.name, latest.length);
			latest.push(check);
			continue;
		}
		// Check run ids increase with each attempt.
		if (check.id > latest[index].id) {
			latest[index] = check;
		}
	}
	return latest;
}

function mapCheckRun(data: IGitHubCheckRunResponse): IGitHubCICheck {
	return {
		id: data.id,
		name: data.name,
		status: mapCheckStatus(data.status),
		conclusion: data.conclusion ? mapCheckConclusion(data.conclusion) : undefined,
		startedAt: data.started_at ?? undefined,
		completedAt: data.completed_at ?? undefined,
		detailsUrl: data.details_url ?? undefined,
	};
}

function mapCheckStatus(status: string): GitHubCheckStatus {
	switch (status) {
		case 'queued': return GitHubCheckStatus.Queued;
		case 'in_progress': return GitHubCheckStatus.InProgress;
		case 'completed': return GitHubCheckStatus.Completed;
		default: return GitHubCheckStatus.Queued;
	}
}

function mapCheckConclusion(conclusion: string): GitHubCheckConclusion {
	switch (conclusion) {
		case 'success': return GitHubCheckConclusion.Success;
		// The runner died before the job started. GitHub still reports that as a
		// failed check; treating it as neutral keeps the icon green and hides it
		// from Fix CI.
		case 'failure':
		case 'startup_failure': return GitHubCheckConclusion.Failure;
		case 'neutral': return GitHubCheckConclusion.Neutral;
		case 'cancelled': return GitHubCheckConclusion.Cancelled;
		case 'skipped': return GitHubCheckConclusion.Skipped;
		case 'timed_out': return GitHubCheckConclusion.TimedOut;
		case 'action_required': return GitHubCheckConclusion.ActionRequired;
		case 'stale': return GitHubCheckConclusion.Stale;
		default: return GitHubCheckConclusion.Neutral;
	}
}

/**
 * Compute an overall CI status from a list of check runs.
 */
export function computeOverallCIStatus(checks: readonly IGitHubCICheck[]): GitHubCIOverallStatus {
	if (checks.length === 0) {
		return GitHubCIOverallStatus.Neutral;
	}

	let hasFailure = false;
	let hasPending = false;

	for (const check of checks) {
		if (check.status !== GitHubCheckStatus.Completed) {
			hasPending = true;
			continue;
		}
		if (check.conclusion === GitHubCheckConclusion.Failure ||
			check.conclusion === GitHubCheckConclusion.TimedOut ||
			check.conclusion === GitHubCheckConclusion.ActionRequired) {
			hasFailure = true;
		}
	}

	if (hasFailure) {
		return GitHubCIOverallStatus.Failure;
	}
	if (hasPending) {
		return GitHubCIOverallStatus.Pending;
	}
	return GitHubCIOverallStatus.Success;
}

//#endregion
