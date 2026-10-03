/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHubCheckConclusion, GitHubCheckStatus, GitHubCIOverallStatus, IGitHubCICheck } from '../../common/types.js';
import { GitHubApiClient, GitHubApiError, IGitHubApiResponse } from '../githubApiClient.js';

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

interface IGitHubCommitStatusResponse {
	readonly id: number;
	readonly context: string;
	readonly state: string;
	readonly target_url: string | null;
	readonly description: string | null;
}

interface IGitHubCombinedStatusResponse {
	readonly total_count: number;
	readonly statuses: readonly IGitHubCommitStatusResponse[];
}

/** One stored tag per URL. The model only round-trips a single string. */
interface IStoredCheckEtag {
	readonly checks?: string;
	readonly status?: string;
}

//#endregion

/** GitHub's check-run list defaults to 30. Ask for the maximum page and follow `total_count`. */
const CHECK_RUNS_PER_PAGE = 100;

/** A ref is capped at about 1000 check suites, so this is past the last useful page. */
const MAX_CHECK_RUN_PAGES = 20;

/** The annotations list also defaults to 30. Ask for the maximum page. */
const ANNOTATIONS_PER_PAGE = 100;

/** Stop if a check keeps returning full pages. Twenty pages is 2000 annotations. */
const MAX_ANNOTATION_PAGES = 20;

/** The combined status list defaults to 30. Ask for the maximum page. */
const STATUSES_PER_PAGE = 100;

/** Same cap as check runs. External CI rarely has more contexts than that. */
const MAX_STATUS_PAGES = 20;

/**
 * Fetcher for GitHub CI check data (check runs and commit statuses).
 * Check runs stay a pure mapping. Commit-status descriptions are remembered
 * so Fix CI can quote them without calling the check-run API.
 */
export class GitHubPRCIFetcher {

	/**
	 * Description of a commit status, keyed by owner, repo, and the negative id
	 * published on the check. The annotations API only accepts a check-run id.
	 */
	private readonly _statusOutput = new Map<string, string>();

	constructor(
		private readonly _apiClient: GitHubApiClient,
	) { }

	async getCheckRuns(owner: string, repo: string, ref: string, etag?: string): Promise<IGitHubApiResponse<readonly IGitHubCICheck[]>> {
		const stored = parseStoredEtag(etag);
		let checks = await this._readCheckRuns(owner, repo, ref, stored.checks);
		let statuses = await this._readStatuses(owner, repo, ref, stored.status);

		// No commit statuses is a 404. That still matches the previous picture
		// when we never had a status tag, so an unchanged check-run list can
		// stay 304. A 404 after a stored status tag means those statuses are gone.
		const statusesUnchanged = statuses.notModified || (statuses.absent && !stored.status);
		if (checks.notModified && statusesUnchanged) {
			return { data: undefined, statusCode: 304, etag };
		}

		// 304 only tells us one URL was unchanged. The other side changed, so
		// the unchanged side has to be read again or its rows would be dropped.
		if (checks.notModified) {
			checks = await this._readCheckRuns(owner, repo, ref, undefined);
		}
		if (statuses.notModified) {
			statuses = await this._readStatuses(owner, repo, ref, undefined);
		}

		const merged = mergeChecksAndStatuses(owner, repo, checks.data, statuses.data, this._statusOutput);
		const publishEtag = checks.etagCoversList && statuses.etagCoversList;
		return {
			data: merged,
			statusCode: 200,
			etag: publishEtag ? formatStoredEtag(checks.etag, statuses.etag) : undefined,
		};
	}

	private async _readCheckRuns(owner: string, repo: string, ref: string, etag: string | undefined): Promise<IPagedRead<IGitHubCICheck>> {
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
				return { data: [], notModified: true, absent: false, etag: response.etag ?? etag, etagCoversList: true };
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
		return { data: keepLatestCheckAttempt(checks), notModified: false, absent: false, etag: responseEtag, etagCoversList };
	}

	private async _readStatuses(owner: string, repo: string, ref: string, etag: string | undefined): Promise<IPagedRead<IGitHubCICheck>> {
		const statuses: IGitHubCICheck[] = [];
		const seenIds = new Set<number>();
		let responseEtag: string | undefined;
		let etagCoversList = true;

		for (let page = 1; page <= MAX_STATUS_PAGES; page++) {
			let response: IGitHubApiResponse<IGitHubCombinedStatusResponse>;
			try {
				response = await this._apiClient.request<IGitHubCombinedStatusResponse>(
					'GET',
					`/repos/${e(owner)}/${e(repo)}/commits/${e(ref)}/status?per_page=${STATUSES_PER_PAGE}&page=${page}`,
					'githubApi.getCommitStatuses',
					page === 1 ? { etag } : undefined,
				);
			} catch (error) {
				// The combined status endpoint 404s when the commit has none.
				if (error instanceof GitHubApiError && error.statusCode === 404) {
					return { data: [], notModified: false, absent: true, etag: undefined, etagCoversList: true };
				}
				throw error;
			}

			if (page === 1 && response.statusCode === 304) {
				return { data: [], notModified: true, absent: false, etag: response.etag ?? etag, etagCoversList: true };
			}
			if (response.statusCode === 404) {
				return { data: [], notModified: false, absent: true, etag: undefined, etagCoversList: true };
			}

			const pageItems = response.data?.statuses ?? [];
			if (page === 1) {
				responseEtag = response.etag;
			}

			let added = 0;
			for (const status of pageItems) {
				if (seenIds.has(status.id)) {
					continue;
				}
				seenIds.add(status.id);
				statuses.push(mapCommitStatus(owner, repo, status, this._statusOutput));
				added++;
			}

			const total = typeof response.data?.total_count === 'number' ? response.data.total_count : statuses.length;
			if (added === 0 || statuses.length >= total || pageItems.length < STATUSES_PER_PAGE) {
				break;
			}
			etagCoversList = false;
		}

		return { data: statuses, notModified: false, absent: false, etag: responseEtag, etagCoversList };
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
		// A negative id is a commit status. Asking the check-run API with it
		// would attach some other run's log, or report that the status had none.
		const statusOutput = this._statusOutput.get(statusOutputKey(owner, repo, checkRunId));
		if (statusOutput !== undefined) {
			return statusOutput;
		}

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

		// 2. Fetch annotations. The list defaults to 30, so a failure that sorts
		// onto a later page would otherwise never reach Fix CI.
		try {
			const annotations = await this._getAllAnnotations(owner, repo, checkRunId);
			if (annotations.length > 0) {
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

	private async _getAllAnnotations(owner: string, repo: string, checkRunId: number): Promise<readonly IGitHubCheckRunAnnotationResponse[]> {
		const annotations: IGitHubCheckRunAnnotationResponse[] = [];
		const seen = new Set<string>();
		for (let page = 1; page <= MAX_ANNOTATION_PAGES; page++) {
			const response = await this._apiClient.request<readonly IGitHubCheckRunAnnotationResponse[]>(
				'GET',
				`/repos/${e(owner)}/${e(repo)}/check-runs/${checkRunId}/annotations?per_page=${ANNOTATIONS_PER_PAGE}&page=${page}`,
				'githubApi.getCheckRunAnnotations.annotations'
			);
			const pageItems = response.data ?? [];
			let added = 0;
			for (const annotation of pageItems) {
				const key = `${annotation.path}\0${annotation.start_line}\0${annotation.end_line}\0${annotation.annotation_level}\0${annotation.title ?? ''}\0${annotation.message}`;
				if (seen.has(key)) {
					continue;
				}
				seen.add(key);
				annotations.push(annotation);
				added++;
			}
			// A full page of repeats means this page number was ignored. Stop
			// instead of appending the same annotations again.
			if (added === 0 || pageItems.length < ANNOTATIONS_PER_PAGE) {
				break;
			}
		}
		return annotations;
	}
}

//#region Helpers

interface IPagedRead<T> {
	readonly data: readonly T[];
	readonly notModified: boolean;
	readonly absent: boolean;
	readonly etag: string | undefined;
	readonly etagCoversList: boolean;
}

function e(value: string): string {
	return encodeURIComponent(value);
}

function parseStoredEtag(etag: string | undefined): IStoredCheckEtag {
	if (!etag) {
		return {};
	}
	if (etag.startsWith('{')) {
		try {
			const parsed = JSON.parse(etag) as { checks?: unknown; status?: unknown };
			if (parsed && typeof parsed === 'object' && ('checks' in parsed || 'status' in parsed)) {
				return {
					checks: typeof parsed.checks === 'string' ? parsed.checks : undefined,
					status: typeof parsed.status === 'string' ? parsed.status : undefined,
				};
			}
		} catch {
			// A tag from before commit statuses were read is the check-run tag.
		}
	}
	return { checks: etag };
}

function formatStoredEtag(checks: string | undefined, status: string | undefined): string | undefined {
	if (!checks && !status) {
		return undefined;
	}
	return JSON.stringify({ checks: checks ?? null, status: status ?? null });
}

function statusOutputKey(owner: string, repo: string, checkId: number): string {
	return `${owner}\0${repo}\0${checkId}`;
}

function mergeChecksAndStatuses(owner: string, repo: string, checks: readonly IGitHubCICheck[], statuses: readonly IGitHubCICheck[], statusOutput: Map<string, string>): IGitHubCICheck[] {
	const names = new Set(checks.map(check => check.name));
	const merged = [...checks];
	for (const status of statuses) {
		// The same context name is the check run's mirror. Keeping the status
		// would put a stale failure back after that check was rerun.
		if (names.has(status.name)) {
			continue;
		}
		names.add(status.name);
		merged.push(status);
		const output = statusOutput.get(statusOutputKey(owner, repo, status.id));
		if (output === undefined) {
			statusOutput.set(statusOutputKey(owner, repo, status.id), 'No output available for this check run.');
		}
	}
	return merged;
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

function mapCommitStatus(owner: string, repo: string, data: IGitHubCommitStatusResponse, statusOutput: Map<string, string>): IGitHubCICheck {
	// Status ids are not check-run ids. A positive id would make Fix CI read
	// a different check run's annotations.
	const id = data.id > 0 ? -data.id : -1;
	const description = data.description?.trim();
	statusOutput.set(statusOutputKey(owner, repo, id), description || 'No output available for this check run.');
	const failed = data.state === 'failure' || data.state === 'error';
	const succeeded = data.state === 'success';
	return {
		id,
		name: data.context,
		status: failed || succeeded ? GitHubCheckStatus.Completed : GitHubCheckStatus.Queued,
		conclusion: failed ? GitHubCheckConclusion.Failure : succeeded ? GitHubCheckConclusion.Success : undefined,
		startedAt: undefined,
		completedAt: undefined,
		detailsUrl: data.target_url ?? undefined,
	};
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
