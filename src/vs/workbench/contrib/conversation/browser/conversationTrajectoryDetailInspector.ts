/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { localize } from '../../../../nls.js';
import type { DetailFetchOutcome } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { ConversationTrajectoryRecord } from './conversationTrajectoryModel.js';

/** PRD-020: cap inspector DOM text volume (UTF-16 code units). */
export const TRAJECTORY_INSPECTOR_MAX_DOM_CHARS = 100_000;

export type TrajectoryDetailInspectorState = 'preview' | 'loading' | 'full' | 'partial' | 'unavailable' | 'failed';

export interface ITrajectoryDetailContext {
	/** True only when the current lease actually implements `requestDetail`. */
	readonly supportsDetailFetch: () => boolean;
	getDetailBody(detailRef: string): string | undefined;
	requestDetail?(detailRef: string): Promise<DetailFetchOutcome>;
}

export interface TrajectoryDetailInspectorViewModel {
	readonly state: TrajectoryDetailInspectorState;
	readonly previewText: string;
	readonly fullText: string | undefined;
	/** Bounded body when the fetch is truncated — never labeled Full. */
	readonly boundedText?: string;
	readonly statusMessage: string | undefined;
	readonly truncated: boolean;
	readonly fetchedBytes?: number;
	readonly totalBytes?: number;
	readonly canRetry: boolean;
}

interface DetailCacheEntry {
	readonly state: TrajectoryDetailInspectorState;
	readonly body?: string;
	readonly fetchedBytes?: number;
	readonly totalBytes?: number;
}

export class TrajectoryDetailInspectorModel {

	private readonly cache = new Map<string, DetailCacheEntry>();
	private readonly pendingRefs = new Map<string, number>();
	private sessionEpoch = 0;
	private disposed = false;
	private readonly _onDidChange = new Emitter<void>();
	readonly onDidChange = this._onDidChange.event;

	dispose(): void {
		this.disposed = true;
		this.sessionEpoch++;
		this.cache.clear();
		this.pendingRefs.clear();
		this._onDidChange.dispose();
	}

	clearSession(): void {
		this.sessionEpoch++;
		this.cache.clear();
		this.pendingRefs.clear();
	}

	retry(detailRef: string): void {
		this.cache.delete(detailRef);
		this.pendingRefs.delete(detailRef);
		this._onDidChange.fire();
	}

	resolve(
		record: ConversationTrajectoryRecord,
		context: ITrajectoryDetailContext | undefined,
	): TrajectoryDetailInspectorViewModel {
		const previewText = buildPreviewText(record);
		const detailRef = record.detailRef;

		if (!detailRef) {
			return unavailableView(previewText);
		}

		const cached = this.cache.get(detailRef);
		if (cached) {
			const body = context?.getDetailBody(detailRef) ?? cached.body;
			return this.viewModelFromCache(cached, previewText, body);
		}

		if (this.pendingRefs.has(detailRef)) {
			return loadingView(previewText);
		}

		const body = context?.getDetailBody(detailRef);
		if (body !== undefined) {
			return this.viewModelFromBody('full', previewText, body, undefined);
		}

		// Lease without requestDetail never enters loading (Q2 接通).
		if (context?.supportsDetailFetch() && context.requestDetail) {
			this.beginFetch(detailRef, context);
			return loadingView(previewText);
		}

		return unavailableView(previewText);
	}

	private beginFetch(detailRef: string, context: ITrajectoryDetailContext): void {
		const request = context.requestDetail;
		if (!request || this.pendingRefs.has(detailRef)) {
			return;
		}
		const epoch = this.sessionEpoch;
		this.pendingRefs.set(detailRef, epoch);
		void Promise.resolve(request(detailRef)).then(
			outcome => this.settle(detailRef, outcome, epoch),
			() => this.settle(detailRef, { ok: false, reason: 'failed' }, epoch),
		);
	}

	private settle(detailRef: string, outcome: DetailFetchOutcome, epoch: number): void {
		if (this.disposed || epoch !== this.sessionEpoch) {
			return;
		}
		this.pendingRefs.delete(detailRef);
		if (!outcome.ok) {
			this.cache.set(detailRef, { state: outcome.reason === 'unavailable' ? 'unavailable' : 'failed' });
		} else if (outcome.truncated) {
			this.cache.set(detailRef, {
				state: 'partial',
				body: outcome.content,
				fetchedBytes: utf8ByteLength(outcome.content),
				totalBytes: outcome.totalBytes,
			});
		} else {
			this.cache.set(detailRef, { state: 'full', body: outcome.content });
		}
		this._onDidChange.fire();
	}

	private viewModelFromCache(
		cached: DetailCacheEntry,
		previewText: string,
		body: string | undefined,
	): TrajectoryDetailInspectorViewModel {
		if (cached.state === 'failed') {
			return this.viewModelFromBody('failed', previewText, body, conversationTrajectoryDetailFailed);
		}
		if (cached.state === 'unavailable') {
			return unavailableView(previewText);
		}
		if (cached.state === 'partial') {
			const statusMessage = formatConversationTrajectoryDetailPartial(cached.fetchedBytes, cached.totalBytes);
			return this.viewModelFromBody('partial', previewText, body, statusMessage, cached.fetchedBytes, cached.totalBytes);
		}
		return this.viewModelFromBody('full', previewText, body, undefined);
	}

	private viewModelFromBody(
		state: TrajectoryDetailInspectorState,
		previewText: string,
		body: string | undefined,
		statusMessage: string | undefined,
		fetchedBytes?: number,
		totalBytes?: number,
	): TrajectoryDetailInspectorViewModel {
		const canRetry = state === 'failed';
		if (!body) {
			return { state, previewText, fullText: undefined, statusMessage, truncated: false, fetchedBytes, totalBytes, canRetry };
		}
		const overDomCap = body.length > TRAJECTORY_INSPECTOR_MAX_DOM_CHARS;
		const displayText = overDomCap
			? body.slice(0, TRAJECTORY_INSPECTOR_MAX_DOM_CHARS) + conversationTrajectoryDetailTruncatedSuffix
			: body;
		if (state === 'partial' || overDomCap) {
			return {
				state: state === 'full' && overDomCap ? 'full' : state,
				previewText,
				fullText: undefined,
				boundedText: displayText,
				statusMessage: statusMessage ?? (overDomCap ? conversationTrajectoryDetailTruncatedNotice : undefined),
				truncated: state === 'partial' || overDomCap,
				fetchedBytes,
				totalBytes,
				canRetry,
			};
		}
		return {
			state,
			previewText,
			fullText: state === 'full' ? displayText : undefined,
			statusMessage,
			truncated: false,
			fetchedBytes,
			totalBytes,
			canRetry,
		};
	}
}

function loadingView(previewText: string): TrajectoryDetailInspectorViewModel {
	return {
		state: 'loading',
		previewText,
		fullText: undefined,
		statusMessage: conversationTrajectoryDetailLoading,
		truncated: false,
		canRetry: false,
	};
}

function unavailableView(previewText: string): TrajectoryDetailInspectorViewModel {
	return {
		state: 'unavailable',
		previewText,
		fullText: undefined,
		statusMessage: conversationTrajectoryDetailUnavailable,
		truncated: false,
		canRetry: false,
	};
}

function utf8ByteLength(content: string | undefined): number | undefined {
	if (content === undefined) {
		return undefined;
	}
	return new TextEncoder().encode(content).byteLength;
}

export function formatConversationTrajectoryDetailPartial(fetchedBytes?: number, totalBytes?: number): string {
	if (totalBytes !== undefined && fetchedBytes !== undefined) {
		return localize(
			'conversationTrajectory.detailPartialKnown',
			"Partial content ({0} of {1} bytes).",
			fetchedBytes,
			totalBytes,
		);
	}
	if (fetchedBytes !== undefined) {
		return localize(
			'conversationTrajectory.detailPartialUnknownBytes',
			"Partial content ({0} bytes). Total length unknown.",
			fetchedBytes,
		);
	}
	return conversationTrajectoryDetailPartialUnknown;
}

export const conversationTrajectoryDetailUnavailable = localize(
	'conversationTrajectory.detailUnavailable',
	"Full content is not available. Showing the bounded preview only.",
);

export const conversationTrajectoryDetailLoading = localize(
	'conversationTrajectory.detailLoading',
	"Loading full content…",
);

export const conversationTrajectoryDetailFailed = localize(
	'conversationTrajectory.detailFailed',
	"Could not load full content. Showing the bounded preview only.",
);

export const conversationTrajectoryDetailPartialUnknown = localize(
	'conversationTrajectory.detailPartialUnknown',
	"Partial content. Total length unknown.",
);

export const conversationTrajectoryDetailRetry = localize(
	'conversationTrajectory.detailRetry',
	"Retry",
);

export const conversationTrajectoryDetailTruncatedSuffix = localize(
	'conversationTrajectory.detailTruncated',
	"\n\n… (content truncated for display)",
);

export const conversationTrajectoryDetailTruncatedNotice = localize(
	'conversationTrajectory.detailTruncatedNotice',
	"Showing a bounded preview. This is not the full content.",
);

export const conversationTrajectoryCompactedDiscardedNotice = localize(
	'conversationTrajectory.compactedDiscardedNotice',
	"Compacted content was discarded upstream. Metadata only — full text cannot be restored.",
);

function buildPreviewText(record: ConversationTrajectoryRecord): string {
	const parts: string[] = [record.text];
	if (record.inputDetail) {
		parts.push(record.inputDetail);
	}
	if (record.outputDetail) {
		parts.push(record.outputDetail);
	}
	return parts.join('\n');
}
