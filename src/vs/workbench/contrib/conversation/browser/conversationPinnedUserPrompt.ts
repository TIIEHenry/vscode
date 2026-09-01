/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConversationStubTurn } from './conversationStubModel.js';
import { ProcessFoldSpan, projectProcessFoldSpans } from './conversationProcessFoldModel.js';

export type ConversationTimelineFlatItemVariant = 'turn' | 'process-fold';

export interface ConversationTimelineFlatItem {
	readonly turn: ConversationStubTurn;
	readonly variant: ConversationTimelineFlatItemVariant;
	readonly processFoldSpan?: ProcessFoldSpan;
}

export interface PinnedUserPromptState {
	readonly turnId: string;
	readonly fullText: string;
	readonly previewText: string;
}

const DEFAULT_PREVIEW_MAX_CHARS = 180;

/**
 * Flatten stub turns into the same row order as {@link ConversationTimelineTree}.
 */
export function flattenConversationTimelineItems(turns: readonly ConversationStubTurn[]): ConversationTimelineFlatItem[] {
	const spans = projectProcessFoldSpans(turns);
	const spanByStartIndex = new Map(spans.map(span => [span.startIndex, span]));
	const coveredIndices = new Set<number>();
	for (const span of spans) {
		for (let index = span.startIndex + 1; index < span.endIndex; index++) {
			coveredIndices.add(index);
		}
	}

	const items: ConversationTimelineFlatItem[] = [];
	for (let index = 0; index < turns.length; index++) {
		if (coveredIndices.has(index)) {
			continue;
		}

		const turn = turns[index]!;
		const span = spanByStartIndex.get(index);
		if (span) {
			items.push({
				turn: turns[span.startIndex]!,
				variant: 'process-fold',
				processFoldSpan: span,
			});
			continue;
		}

		items.push({ turn, variant: 'turn' });
	}
	return items;
}

export function normalizeUserPromptText(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

export function toPinnedUserPromptPreview(text: string, maxChars = DEFAULT_PREVIEW_MAX_CHARS): string {
	if (text.length <= maxChars) {
		return text;
	}
	return `${text.slice(0, maxChars).trimEnd()}...`;
}

/**
 * Pure derivation for the sticky user-prompt projection (Singularity PinnedUserPromptState parity).
 */
export function resolvePinnedUserPromptState(
	items: readonly ConversationTimelineFlatItem[],
	visibleIndices: readonly number[],
	isAtBottom: boolean,
	previewMaxChars = DEFAULT_PREVIEW_MAX_CHARS,
): PinnedUserPromptState | undefined {
	if (items.length === 0 || visibleIndices.length === 0 || isAtBottom) {
		return undefined;
	}

	const visibleSet = new Set(visibleIndices);
	const firstVisibleIndex = Math.min(...visibleIndices);
	const firstVisible = items[firstVisibleIndex];
	if (firstVisible?.turn.kind === 'user' && firstVisible.variant === 'turn') {
		return undefined;
	}

	let pinnedIndex: number | undefined;
	for (let index = firstVisibleIndex - 1; index >= 0; index--) {
		const item = items[index];
		if (item.turn.kind === 'user' && item.variant === 'turn') {
			pinnedIndex = index;
			break;
		}
	}

	if (pinnedIndex === undefined || visibleSet.has(pinnedIndex)) {
		return undefined;
	}

	const userTurn = items[pinnedIndex].turn;
	const fullText = normalizeUserPromptText(userTurn.text);
	if (!fullText) {
		return undefined;
	}

	return {
		turnId: userTurn.id,
		fullText,
		previewText: toPinnedUserPromptPreview(fullText, previewMaxChars),
	};
}

export function indexOfConversationTimelineFlatItem(
	items: readonly ConversationTimelineFlatItem[],
	target: ConversationTimelineFlatItem,
): number {
	for (let index = 0; index < items.length; index++) {
		const item = items[index];
		if (item.variant !== target.variant) {
			continue;
		}
		if (item.variant === 'process-fold') {
			if (item.processFoldSpan?.id === target.processFoldSpan?.id) {
				return index;
			}
			continue;
		}
		if (item.turn.id === target.turn.id) {
			return index;
		}
	}
	return -1;
}

export function rangeVisibleTimelineIndices(firstIndex: number, lastIndex: number): number[] {
	if (firstIndex < 0 || lastIndex < 0 || lastIndex < firstIndex) {
		return [];
	}
	const indices: number[] = [];
	for (let index = firstIndex; index <= lastIndex; index++) {
		indices.push(index);
	}
	return indices;
}
