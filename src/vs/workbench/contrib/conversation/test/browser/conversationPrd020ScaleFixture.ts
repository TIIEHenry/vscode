/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConversationStubSession, ConversationStubTurn } from '../../browser/conversationStubModel.js';
import { ConversationTrajectoryRecord } from '../../browser/conversationTrajectoryModel.js';

/** PRD-020 conversation-turn scale (literal). */
export const PRD020_CONVERSATION_TURN_COUNT = 1000;

/** PRD-020 trajectory-record scale (literal). */
export const PRD020_TRAJECTORY_RECORD_COUNT = 5000;

function formatPrd020Id(prefix: 'prd020-t-' | 'prd020-r-', index1: number): string {
	return `${prefix}${String(index1).padStart(4, '0')}`;
}

/**
 * Even index `user`, odd `assistant` (`stubEcho: true`). Short copy contains `Stub:`.
 * Stable ids `prd020-t-0001` …
 */
export function createPrd020ConversationTurns(count: number): ConversationStubTurn[] {
	const turns: ConversationStubTurn[] = [];
	for (let i = 0; i < count; i++) {
		const id = formatPrd020Id('prd020-t-', i + 1);
		if (i % 2 === 0) {
			turns.push({ id, kind: 'user', text: `Stub: ${id}` });
		} else {
			turns.push({ id, kind: 'assistant', text: `Stub: ${id}`, stubEcho: true });
		}
	}
	return turns;
}

/**
 * Pure `kind:'message'` records. Ids `prd020-r-0001` …
 * Does not go through untitled trajectory extras.
 */
export function createPrd020TrajectoryRecords(count: number): ConversationTrajectoryRecord[] {
	const records: ConversationTrajectoryRecord[] = [];
	for (let i = 0; i < count; i++) {
		const id = formatPrd020Id('prd020-r-', i + 1);
		records.push({ id, kind: 'message', text: `Stub: ${id}` });
	}
	return records;
}

export function createPrd020ScaleSession(turnCount: number): ConversationStubSession {
	return {
		id: 'prd020-scale',
		title: 'PRD-020 scale (Stub)',
		turns: createPrd020ConversationTurns(turnCount),
		source: 'local',
	};
}
