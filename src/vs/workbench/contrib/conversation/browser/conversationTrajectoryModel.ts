/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConversationStubTurn } from './conversationStubModel.js';

export type ConversationTrajectoryKind = 'system' | 'user' | 'context' | 'compacted' | 'message' | 'tool' | 'subtool' | 'thinking';

export interface ConversationTrajectoryBlock {
	readonly type: string;
	readonly content: string;
	readonly toolName?: string;
}

export interface ConversationTrajectoryRecord {
	readonly id: string;
	readonly kind: ConversationTrajectoryKind;
	readonly text: string;
	readonly sourceBlocks?: readonly ConversationTrajectoryBlock[];
	readonly messageSource?: { readonly kind: string; readonly label?: string };
	readonly environment?: { readonly cwd?: string; readonly os?: string; readonly extra?: string };
	readonly promptDetail?: string;
	readonly inputDetail?: string;
	readonly outputDetail?: string;
	readonly result?: string;
	readonly opensTurn?: boolean;
	readonly callId?: string;
	readonly parentCallId?: string;
	readonly depth?: number;
}

/** Stub fixture copy surfaced only on the trajectory lens (PRD-012). */
export const CONVERSATION_TRAJECTORY_STUB_SYSTEM_TEXT = 'Stub environment';
export const CONVERSATION_TRAJECTORY_STUB_CONTEXT_TEXT = 'Stub: workspace context';
export const CONVERSATION_TRAJECTORY_STUB_SOURCE_BLOCK_CONTENT = 'Stub: README.md';
export const CONVERSATION_TRAJECTORY_STUB_SUBTOOL_TEXT = 'Stub: nested dispatch';

/**
 * Projects admitted stub turns into trajectory records. Confirmation turns are omitted.
 */
export function projectTurnsToTrajectory(turns: readonly ConversationStubTurn[]): ConversationTrajectoryRecord[] {
	const records: ConversationTrajectoryRecord[] = [];

	for (const turn of turns) {
		switch (turn.kind) {
			case 'user':
				records.push({
					id: turn.id,
					kind: 'user',
					text: turn.text,
					opensTurn: true,
				});
				break;
			case 'assistant':
				records.push({
					id: turn.id,
					kind: 'message',
					text: turn.text,
				});
				break;
			case 'confirmation':
				break;
			case 'thinking':
				records.push({
					id: turn.id,
					kind: 'thinking',
					text: turn.text,
				});
				break;
			case 'tool':
				records.push({
					id: turn.id,
					kind: 'tool',
					text: turn.text,
					callId: turn.id,
					depth: 0,
				});
				break;
		}
	}

	return records;
}

export function mergeTrajectoryFixtureExtras(
	sessionId: string,
	records: readonly ConversationTrajectoryRecord[],
): ConversationTrajectoryRecord[] {
	switch (sessionId) {
		case 'untitled':
			return mergeUntitledTrajectoryFixtures(records);
		default:
			return [...records];
	}
}

function mergeUntitledTrajectoryFixtures(records: readonly ConversationTrajectoryRecord[]): ConversationTrajectoryRecord[] {
	const systemRecord: ConversationTrajectoryRecord = {
		id: 'fixture:untitled:system',
		kind: 'system',
		text: CONVERSATION_TRAJECTORY_STUB_SYSTEM_TEXT,
		environment: {
			cwd: '/workspace/stub',
			os: 'linux',
			extra: 'Stub: trajectory environment fixture',
		},
		promptDetail: 'Stub: prompt snapshot for trajectory inspection',
	};

	const contextRecord: ConversationTrajectoryRecord = {
		id: 'fixture:untitled:context',
		kind: 'context',
		text: CONVERSATION_TRAJECTORY_STUB_CONTEXT_TEXT,
		messageSource: { kind: 'inject', label: 'Stub: workspace inject' },
	};

	const enrichedRecords = records.map(record => {
		if (record.kind !== 'user') {
			return record;
		}
		return {
			...record,
			sourceBlocks: [{
				type: 'text',
				content: CONVERSATION_TRAJECTORY_STUB_SOURCE_BLOCK_CONTENT,
				toolName: 'readme',
			}],
		};
	});

	const withFixtures = [systemRecord, contextRecord, ...enrichedRecords];
	const toolIndex = withFixtures.findIndex(record => record.kind === 'tool');
	if (toolIndex >= 0) {
		const parentTool = withFixtures[toolIndex]!;
		const subtoolRecord: ConversationTrajectoryRecord = {
			id: 'fixture:untitled:subtool',
			kind: 'subtool',
			text: CONVERSATION_TRAJECTORY_STUB_SUBTOOL_TEXT,
			parentCallId: parentTool.callId ?? parentTool.id,
			callId: 'fixture:untitled:subtool-call',
			depth: 1,
		};
		withFixtures.splice(toolIndex + 1, 0, subtoolRecord);
	}

	return withFixtures;
}
