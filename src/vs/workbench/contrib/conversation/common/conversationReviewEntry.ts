/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import type { ConversationTimelineEntry } from '../browser/conversationSessionView.js';
import { computeTimelineApplyPlan } from '../browser/conversationTimelineApply.js';
import { entriesToRenderableTurns } from '../browser/conversationSessionView.js';
import { projectProcessFoldSpans } from '../browser/conversationProcessFoldModel.js';
import { localize } from '../../../../nls.js';
import type { ConversationViewFrameApplied } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { SessionViewSnapshot } from '../../../../platform/universeAgent/common/sessionView/index.js';
import {
	IFileMutationRecord,
	isWorkDirCompatible,
	resolveMutationResource,
} from '../../sources/common/sourcesReviewAttribution.js';

export const IConversationReviewNavService = createDecorator<IConversationReviewNavService>('conversationReviewNavService');

export interface IConversationReviewNavService {
	readonly _serviceBrand: undefined;

	readonly onDidChange: Event<void>;

	getReviewNavForSession(sessionId: string): readonly IReviewNavRecord[];
}

/** Own-data review navigation row materialized after turn settle (PRD-023 §2.4). */
export interface IReviewNavRecord {
	readonly sessionId: string;
	readonly turnId: string;
	readonly paths: readonly string[];
}

/** Turn settle signal from M6-A2 host (TurnCompletedChange.assistant_turn_id). */
export type { ITurnSettleSignal } from '../../../../platform/universeAgent/common/universeAgentTypes.js';

export function reviewNavEntryId(turnId: string): string {
	return `reviewNav:${turnId}`;
}

export function formatReviewNavLabel(fileCount: number): string {
	return localize('conversationReviewEntry.label', "View changes ({0} files)", fileCount);
}

export function entryTurnIdFromSnapshot(
	entry: ConversationTimelineEntry,
	snapshot: SessionViewSnapshot,
): string | undefined {
	const item = snapshot.timeline.find(timelineItem => String(timelineItem.id) === entry.id);
	const turnId = item?.turnId;
	return turnId !== undefined ? String(turnId) : undefined;
}

/**
 * Inserts `reviewNav` rows after the last L2 timeline entry for each settled turn (PRD-023 §2.4).
 */
export function attachReviewEntries(
	entries: readonly ConversationTimelineEntry[],
	snapshot: SessionViewSnapshot,
	reviewNav: readonly IReviewNavRecord[],
): ConversationTimelineEntry[] {
	if (reviewNav.length === 0) {
		return entries.slice();
	}

	const turnIdToLastIndex = new Map<string, number>();
	for (let index = 0; index < entries.length; index++) {
		const turnId = entryTurnIdFromSnapshot(entries[index]!, snapshot);
		if (turnId !== undefined) {
			turnIdToLastIndex.set(turnId, index);
		}
	}

	const result = entries.slice();
	const insertions = reviewNav
		.map(record => ({ record, insertAfter: turnIdToLastIndex.get(record.turnId) }))
		.filter((item): item is { record: IReviewNavRecord; insertAfter: number } => item.insertAfter !== undefined)
		.sort((a, b) => b.insertAfter - a.insertAfter);

	for (const { record, insertAfter } of insertions) {
		const navEntry: ConversationTimelineEntry = {
			id: reviewNavEntryId(record.turnId),
			kind: 'reviewNav',
			text: formatReviewNavLabel(record.paths.length),
			reviewNavPaths: record.paths.slice(),
		};
		result.splice(insertAfter + 1, 0, navEntry);
	}

	return result;
}

export function materializeReviewNavRecords(options: {
	readonly sessionId: string;
	readonly mutations: readonly IFileMutationRecord[];
	readonly settledTurnIds: ReadonlySet<string>;
	readonly workDir: string | undefined;
	readonly workspaceRoots: readonly URI[];
	readonly hasScmProvider: boolean;
}): IReviewNavRecord[] {
	if (!options.hasScmProvider || !options.workDir || !isWorkDirCompatible(options.workDir, options.workspaceRoots)) {
		return [];
	}

	const pathsByTurn = new Map<string, Set<string>>();
	for (const record of options.mutations) {
		if (!options.settledTurnIds.has(record.turnId)) {
			continue;
		}
		const resource = resolveMutationResource(options.workDir, record.path, options.workspaceRoots);
		if (!resource) {
			continue;
		}
		const paths = pathsByTurn.get(record.turnId) ?? new Set<string>();
		paths.add(resource.toString());
		pathsByTurn.set(record.turnId, paths);
	}

	const results: IReviewNavRecord[] = [];
	for (const [turnId, paths] of pathsByTurn) {
		if (paths.size === 0) {
			continue;
		}
		results.push({
			sessionId: options.sessionId,
			turnId,
			paths: [...paths],
		});
	}
	return results;
}

function collectReviewNavEntries(entries: readonly ConversationTimelineEntry[]): Map<string, ConversationTimelineEntry> {
	const map = new Map<string, ConversationTimelineEntry>();
	for (const entry of entries) {
		if (entry.kind === 'reviewNav') {
			map.set(entry.id, entry);
		}
	}
	return map;
}

/** Sidecar-only apply: reviewNav add/remove → changedIds for §3.4 frame class A/B. */
export function computeReviewNavSidecarApplied(
	prevEntries: readonly ConversationTimelineEntry[],
	nextEntries: readonly ConversationTimelineEntry[],
): ConversationViewFrameApplied {
	const prevNav = collectReviewNavEntries(prevEntries);
	const nextNav = collectReviewNavEntries(nextEntries);
	const changedIds = new Set<string>();

	for (const [id, entry] of nextNav) {
		const before = prevNav.get(id);
		if (!before || before.text !== entry.text || !samePathList(before.reviewNavPaths, entry.reviewNavPaths)) {
			changedIds.add(id);
		}
	}
	for (const id of prevNav.keys()) {
		if (!nextNav.has(id)) {
			changedIds.add(id);
		}
	}

	return { kind: 'patches', changedIds };
}

function samePathList(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
	const left = a ?? [];
	const right = b ?? [];
	if (left.length !== right.length) {
		return false;
	}
	for (let index = 0; index < left.length; index++) {
		if (left[index] !== right[index]) {
			return false;
		}
	}
	return true;
}

/** Test helper: classify reviewNav-only delta as timeline apply frame class A or B. */
export function classifyReviewNavApplyMode(
	prevEntries: readonly ConversationTimelineEntry[],
	nextEntries: readonly ConversationTimelineEntry[],
): 'structure' | 'content' | 'none' {
	const prevTurns = entriesToRenderableTurns(prevEntries);
	const nextTurns = entriesToRenderableTurns(nextEntries);
	const applied = computeReviewNavSidecarApplied(prevEntries, nextEntries);
	if (applied.kind !== 'patches' || applied.changedIds.size === 0) {
		return 'none';
	}
	return computeTimelineApplyPlan(prevTurns, nextTurns, applied).mode === 'structure' ? 'structure' : 'content';
}

/** Test helper: reviewNav rows must sit outside process-fold spans. */
export function reviewNavIndicesOutsideProcessFold(entries: readonly ConversationTimelineEntry[]): boolean {
	const turns = entriesToRenderableTurns(entries);
	const covered = new Set<number>();
	for (const span of projectProcessFoldSpans(turns)) {
		for (let index = span.startIndex + 1; index < span.endIndex; index++) {
			covered.add(index);
		}
	}
	for (let index = 0; index < turns.length; index++) {
		if (turns[index]!.kind === 'reviewNav' && covered.has(index)) {
			return false;
		}
	}
	return true;
}
