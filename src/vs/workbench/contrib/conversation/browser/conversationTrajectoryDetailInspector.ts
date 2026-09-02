/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { ConversationTrajectoryRecord } from './conversationTrajectoryModel.js';

/** PRD-020: cap inspector DOM text volume (UTF-16 code units). */
export const TRAJECTORY_INSPECTOR_MAX_DOM_CHARS = 100_000;

export type TrajectoryDetailInspectorState = 'preview' | 'loading' | 'full' | 'unavailable' | 'failed';

export interface ITrajectoryDetailContext {
	readonly supportsDetailFetch: () => boolean;
	getDetailBody(detailRef: string): string | undefined;
	/** Optional: trigger upstream fetch when a DetailRef body is not cached yet. */
	requestDetail?(detailRef: string): void;
}

export interface TrajectoryDetailInspectorViewModel {
	readonly state: TrajectoryDetailInspectorState;
	readonly previewText: string;
	readonly fullText: string | undefined;
	/** Bounded body when the fetch is truncated — never labeled Full. */
	readonly boundedText?: string;
	readonly statusMessage: string | undefined;
	readonly truncated: boolean;
}

interface DetailCacheEntry {
	readonly state: TrajectoryDetailInspectorState;
	readonly body?: string;
}

export class TrajectoryDetailInspectorModel {

	private readonly cache = new Map<string, DetailCacheEntry>();
	private readonly pendingRefs = new Map<string, number>();
	private sessionEpoch = 0;

	clearSession(): void {
		this.sessionEpoch++;
		this.cache.clear();
		this.pendingRefs.clear();
	}

	resolve(
		record: ConversationTrajectoryRecord,
		context: ITrajectoryDetailContext | undefined,
	): TrajectoryDetailInspectorViewModel {
		const previewText = buildPreviewText(record);
		const detailRef = record.detailRef;

		if (!detailRef) {
			return {
				state: 'unavailable',
				previewText,
				fullText: undefined,
				statusMessage: conversationTrajectoryDetailUnavailable,
				truncated: false,
			};
		}

		const cached = this.cache.get(detailRef);
		if (cached?.state === 'failed') {
			return this.viewModelFromBody('failed', previewText, cached.body, conversationTrajectoryDetailFailed);
		}
		if (cached?.state === 'full' && cached.body !== undefined) {
			return this.viewModelFromBody('full', previewText, cached.body, undefined);
		}
		if (cached?.state === 'preview' && cached.body !== undefined) {
			return this.viewModelFromBody('preview', previewText, cached.body, conversationTrajectoryDetailTruncatedNotice);
		}

		const body = context?.getDetailBody(detailRef);
		if (body !== undefined) {
			const truncated = body.length > TRAJECTORY_INSPECTOR_MAX_DOM_CHARS;
			this.cache.set(detailRef, { state: truncated ? 'preview' : 'full', body });
			this.pendingRefs.delete(detailRef);
			return this.viewModelFromBody(truncated ? 'preview' : 'full', previewText, body, truncated ? conversationTrajectoryDetailTruncatedNotice : undefined);
		}

		if (context?.supportsDetailFetch()) {
			if (!this.pendingRefs.has(detailRef)) {
				this.pendingRefs.set(detailRef, this.sessionEpoch);
				context.requestDetail?.(detailRef);
			}
			return {
				state: 'loading',
				previewText,
				fullText: undefined,
				statusMessage: conversationTrajectoryDetailLoading,
				truncated: false,
			};
		}

		return {
			state: 'unavailable',
			previewText,
			fullText: undefined,
			statusMessage: conversationTrajectoryDetailUnavailable,
			truncated: false,
		};
	}

	markFailed(detailRef: string, epoch?: number): void {
		if (epoch !== undefined && epoch !== this.sessionEpoch) {
			return;
		}
		this.cache.set(detailRef, { state: 'failed' });
		this.pendingRefs.delete(detailRef);
	}

	private viewModelFromBody(
		state: TrajectoryDetailInspectorState,
		previewText: string,
		body: string | undefined,
		statusMessage: string | undefined,
	): TrajectoryDetailInspectorViewModel {
		if (!body) {
			return { state, previewText, fullText: undefined, statusMessage, truncated: false };
		}
		const truncated = body.length > TRAJECTORY_INSPECTOR_MAX_DOM_CHARS;
		const displayText = truncated
			? body.slice(0, TRAJECTORY_INSPECTOR_MAX_DOM_CHARS) + conversationTrajectoryDetailTruncatedSuffix
			: body;
		if (truncated) {
			return {
				state: 'preview',
				previewText,
				fullText: undefined,
				boundedText: displayText,
				statusMessage: statusMessage ?? conversationTrajectoryDetailTruncatedNotice,
				truncated: true,
			};
		}
		return {
			state,
			previewText,
			fullText: state === 'full' ? displayText : undefined,
			statusMessage,
			truncated: false,
		};
	}
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
