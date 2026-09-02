/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ConversationViewFrameApplied } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { projectProcessFoldSpans } from './conversationProcessFoldModel.js';
import { ConversationStubTurn } from './conversationStubModel.js';

export type TimelineApplyMode = 'baseline' | 'structure' | 'content' | 'none';

export interface TimelineApplyPlan {
	readonly mode: TimelineApplyMode;
	readonly rerenderIds: ReadonlySet<string>;
	readonly removedTreeIds: ReadonlySet<string>;
}

/**
 * Root-level tree identities after process-fold projection (plan §3.4 type B/C).
 */
export function buildTimelineRootIdentities(turns: readonly ConversationStubTurn[]): readonly string[] {
	const spans = projectProcessFoldSpans(turns);
	const spanByStartIndex = new Map(spans.map(span => [span.startIndex, span]));
	const coveredIndices = new Set<number>();
	for (const span of spans) {
		for (let index = span.startIndex + 1; index < span.endIndex; index++) {
			coveredIndices.add(index);
		}
	}

	const ids: string[] = [];
	for (let index = 0; index < turns.length; index++) {
		if (coveredIndices.has(index)) {
			continue;
		}
		const span = spanByStartIndex.get(index);
		if (span) {
			ids.push(span.id);
			continue;
		}
		ids.push(turns[index]!.id);
	}
	return ids;
}

function buildTurnToRootIdMap(turns: readonly ConversationStubTurn[]): Map<string, string> {
	const map = new Map<string, string>();
	const spans = projectProcessFoldSpans(turns);
	for (const span of spans) {
		for (const turnId of span.turnIds) {
			map.set(turnId, span.id);
		}
	}
	for (const turn of turns) {
		if (!map.has(turn.id)) {
			map.set(turn.id, turn.id);
		}
	}
	return map;
}

function sameRootSequence(a: readonly string[], b: readonly string[]): boolean {
	if (a.length !== b.length) {
		return false;
	}
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) {
			return false;
		}
	}
	return true;
}

function collectRemovedTreeIds(prevTurns: readonly ConversationStubTurn[], nextTurns: readonly ConversationStubTurn[]): Set<string> {
	const prevRoots = new Set(buildTimelineRootIdentities(prevTurns));
	const nextRoots = new Set(buildTimelineRootIdentities(nextTurns));
	const removed = new Set<string>();
	for (const id of prevRoots) {
		if (!nextRoots.has(id)) {
			removed.add(id);
		}
	}
	return removed;
}

function mapChangedIdsToTreeIds(
	turns: readonly ConversationStubTurn[],
	changedIds: ReadonlySet<string>,
): Set<string> {
	const turnToRoot = buildTurnToRootIdMap(turns);
	const rerenderIds = new Set<string>();
	for (const rawId of changedIds) {
		if (rawId === 'sync' || rawId.startsWith('pending:')) {
			continue;
		}
		if (rawId.startsWith('send:')) {
			rerenderIds.add(rawId);
			continue;
		}
		const treeId = turnToRoot.get(rawId) ?? rawId;
		rerenderIds.add(treeId);
	}
	return rerenderIds;
}

/**
 * Classifies an incremental timeline apply into baseline / structure / content / none
 * (dev/plans/conversation-stream-timeline.md §3.4).
 */
export function computeTimelineApplyPlan(
	prevTurns: readonly ConversationStubTurn[],
	nextTurns: readonly ConversationStubTurn[],
	applied: ConversationViewFrameApplied,
): TimelineApplyPlan {
	if (applied.kind === 'effects') {
		return { mode: 'none', rerenderIds: new Set(), removedTreeIds: new Set() };
	}

	if (applied.kind === 'baseline') {
		return {
			mode: 'baseline',
			rerenderIds: new Set(),
			removedTreeIds: collectRemovedTreeIds(prevTurns, nextTurns),
		};
	}

	const prevRoots = buildTimelineRootIdentities(prevTurns);
	const nextRoots = buildTimelineRootIdentities(nextTurns);
	const removedTreeIds = collectRemovedTreeIds(prevTurns, nextTurns);

	if (!sameRootSequence(prevRoots, nextRoots)) {
		return {
			mode: 'structure',
			rerenderIds: mapChangedIdsToTreeIds(nextTurns, applied.changedIds),
			removedTreeIds,
		};
	}

	return {
		mode: 'content',
		rerenderIds: mapChangedIdsToTreeIds(nextTurns, applied.changedIds),
		removedTreeIds,
	};
}
