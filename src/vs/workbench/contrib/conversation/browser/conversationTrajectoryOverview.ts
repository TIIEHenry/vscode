/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { ConversationTrajectoryKind, ConversationTrajectoryRecord } from './conversationTrajectoryModel.js';

/** PRD-012 Overview: aggregate by turn when raw segments exceed this cap. */
export const TRAJECTORY_OVERVIEW_MAX_SEGMENTS = 200;

export type TrajectoryOverviewSegmentKind =
	| 'user'
	| 'assistant'
	| 'reasoning'
	| 'tool'
	| 'permission'
	| 'error'
	| 'compacted';

export interface TrajectoryOverviewSegment {
	readonly id: string;
	readonly recordIds: readonly string[];
	readonly kind: TrajectoryOverviewSegmentKind;
	/** Short text label (shape + text; not color-only). */
	readonly label: string;
}

export function getTrajectoryOverviewSegmentLabel(kind: TrajectoryOverviewSegmentKind): string {
	switch (kind) {
		case 'user':
			return localize('conversationTrajectory.overviewUser', "User");
		case 'assistant':
			return localize('conversationTrajectory.overviewAssistant', "Asst");
		case 'reasoning':
			return localize('conversationTrajectory.overviewReasoning', "Think");
		case 'tool':
			return localize('conversationTrajectory.overviewTool', "Tool");
		case 'permission':
			return localize('conversationTrajectory.overviewPermission', "Perm");
		case 'error':
			return localize('conversationTrajectory.overviewError', "Err");
		case 'compacted':
			return localize('conversationTrajectory.overviewCompacted', "Cmp");
	}
}

function recordToOverviewKind(record: ConversationTrajectoryRecord): TrajectoryOverviewSegmentKind | undefined {
	switch (record.kind) {
		case 'user':
			return 'user';
		case 'message':
			return 'assistant';
		case 'thinking':
			return 'reasoning';
		case 'tool':
		case 'subtool':
			return 'tool';
		case 'compacted':
			return 'compacted';
		case 'permission':
			return 'permission';
		case 'error':
			return 'error';
		default:
			return undefined;
	}
}

function segmentForRecord(record: ConversationTrajectoryRecord): TrajectoryOverviewSegment | undefined {
	const kind = recordToOverviewKind(record);
	if (!kind) {
		return undefined;
	}
	return {
		id: record.id,
		recordIds: [record.id],
		kind,
		label: getTrajectoryOverviewSegmentLabel(kind),
	};
}

function aggregateTurnLabel(recordIds: readonly string[], kinds: ReadonlySet<TrajectoryOverviewSegmentKind>, turnIndex: number): string {
	const kindList = [...kinds];
	const kindPart = kindList.length === 1
		? getTrajectoryOverviewSegmentLabel(kindList[0]!)
		: localize('conversationTrajectory.overviewTurnMixed', "Mix");
	return localize(
		'conversationTrajectory.overviewTurnAggregate',
		"T{0} · {1} · {2}",
		String(turnIndex),
		kindPart,
		String(recordIds.length),
	);
}

/**
 * Projects trajectory records into Overview bar segments (same record model; no second event fold).
 * When over {@link TRAJECTORY_OVERVIEW_MAX_SEGMENTS}, collapses each turn into one segment.
 */
export function buildTrajectoryOverviewSegments(records: readonly ConversationTrajectoryRecord[]): {
	readonly segments: readonly TrajectoryOverviewSegment[];
	readonly aggregatedByTurn: boolean;
} {
	const raw: TrajectoryOverviewSegment[] = [];
	for (const record of records) {
		const segment = segmentForRecord(record);
		if (segment) {
			raw.push(segment);
		}
	}

	if (raw.length <= TRAJECTORY_OVERVIEW_MAX_SEGMENTS) {
		return { segments: raw, aggregatedByTurn: false };
	}

	const aggregated: TrajectoryOverviewSegment[] = [];
	let turnIndex = 0;
	let turnRecordIds: string[] = [];
	let turnKinds = new Set<TrajectoryOverviewSegmentKind>();

	const flushTurn = (): void => {
		if (turnRecordIds.length === 0) {
			return;
		}
		turnIndex++;
		aggregated.push({
			id: `overview-turn:${turnIndex}`,
			recordIds: [...turnRecordIds],
			kind: turnKinds.size === 1 ? [...turnKinds][0]! : 'assistant',
			label: aggregateTurnLabel(turnRecordIds, turnKinds, turnIndex),
		});
		turnRecordIds = [];
		turnKinds = new Set();
	};

	for (const record of records) {
		if (record.opensTurn && turnRecordIds.length > 0) {
			flushTurn();
		}
		const kind = recordToOverviewKind(record);
		if (!kind) {
			continue;
		}
		turnRecordIds.push(record.id);
		turnKinds.add(kind);
	}
	flushTurn();

	return { segments: aggregated, aggregatedByTurn: true };
}

/** Maps trajectory record kind to Overview segment kind for styling. */
export function trajectoryKindToOverviewKind(kind: ConversationTrajectoryKind): TrajectoryOverviewSegmentKind | undefined {
	return recordToOverviewKind({ id: '', kind, text: '' });
}
