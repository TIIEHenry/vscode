/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConversationTrajectoryKind, ConversationTrajectoryRecord } from './conversationTrajectoryModel.js';
import { ConversationStubTurn, ConversationTurnKind } from './conversationStubModel.js';

export interface ProcessFoldSpan {
	readonly id: string;
	readonly startIndex: number;
	readonly endIndex: number;
	readonly turnIds: readonly string[];
	readonly nodes: readonly ProcessFoldNode[];
}

export type ProcessFoldNode =
	| { readonly kind: 'thinking'; readonly turn: ConversationStubTurn; readonly tools: readonly ConversationStubTurn[] }
	| { readonly kind: 'tool'; readonly turn: ConversationStubTurn };

/** Only thinking/tool enter a conversation process-fold span; all other kinds break it. */
const PROCESS_FOLD_KINDS: ReadonlySet<ConversationTurnKind> = new Set(['thinking', 'tool']);

function isProcessFoldKind(kind: ConversationTurnKind): kind is 'thinking' | 'tool' {
	return PROCESS_FOLD_KINDS.has(kind);
}

/**
 * Nests tool turns under the most recent thinking turn within a single process-fold span.
 * Standalone tool turns (no preceding thinking in the span) remain top-level tool nodes.
 */
export function nestThinkingTools(turns: readonly ConversationStubTurn[]): ProcessFoldNode[] {
	const nodes: ProcessFoldNode[] = [];
	let currentThinking: { kind: 'thinking'; turn: ConversationStubTurn; tools: ConversationStubTurn[] } | undefined;

	for (const turn of turns) {
		if (turn.kind === 'thinking') {
			currentThinking = { kind: 'thinking', turn, tools: [] };
			nodes.push(currentThinking);
			continue;
		}

		if (turn.kind === 'tool') {
			if (currentThinking) {
				currentThinking.tools.push(turn);
			} else {
				nodes.push({ kind: 'tool', turn });
			}
		}
	}

	return nodes;
}

/**
 * Projects parallel process-fold spans over a turn timeline (ADR-046 span overlay).
 * Continuous thinking/tool runs form one span. user, assistant, confirmation,
 * question, error, unknown, system, visualization, and reviewNav break spans.
 */
export function projectProcessFoldSpans(turns: readonly ConversationStubTurn[]): ProcessFoldSpan[] {
	const spans: ProcessFoldSpan[] = [];
	let spanStart: number | undefined;

	const finalizeSpan = (endIndex: number): void => {
		if (spanStart === undefined) {
			return;
		}

		const startIndex = spanStart;
		const segment = turns.slice(startIndex, endIndex);
		spanStart = undefined;

		if (segment.length === 0) {
			return;
		}

		spans.push({
			id: processFoldSpanId(segment),
			startIndex,
			endIndex,
			turnIds: segment.map(turn => turn.id),
			nodes: nestThinkingTools(segment),
		});
	};

	for (let index = 0; index < turns.length; index++) {
		const turn = turns[index]!;
		if (isProcessFoldKind(turn.kind)) {
			if (spanStart === undefined) {
				spanStart = index;
			}
		} else {
			finalizeSpan(index);
		}
	}

	finalizeSpan(turns.length);
	return spans;
}

/** Overlay attribution keys share the L2 item id after the `overlay:` prefix (stream-timeline §3.3). */
export function stripOverlayAttributionPrefix(id: string): string {
	return id.startsWith('overlay:') ? id.slice('overlay:'.length) : id;
}

/** Stable process-fold span id: same admitted turn stays one span across overlay → L2. */
export function processFoldSpanId(segment: readonly ConversationStubTurn[]): string {
	const admittedTurnId = sharedAdmittedTurnId(segment);
	if (admittedTurnId) {
		return `fold:turn:${admittedTurnId}`;
	}
	const firstId = segment[0]?.id;
	return `fold:${firstId ? stripOverlayAttributionPrefix(firstId) : 'empty'}`;
}

function sharedAdmittedTurnId(segment: readonly ConversationStubTurn[]): string | undefined {
	const admitted = new Set<string>();
	for (const turn of segment) {
		if (turn.turnId) {
			admitted.add(turn.turnId);
		}
	}
	if (admitted.size !== 1) {
		return undefined;
	}
	return [...admitted][0];
}

/**
 * Trajectory process-fold whitelist is thinking|tool|subtool only.
 * Q5a kinds (permission / question / error / unknown) are not in this set, so
 * they interrupt a span the same way user / context / system / message / compacted do.
 */
const TRAJECTORY_PROCESS_FOLD_KINDS: ReadonlySet<ConversationTrajectoryKind> = new Set(['thinking', 'tool', 'subtool']);

function isTrajectoryProcessFoldKind(kind: ConversationTrajectoryKind): kind is 'thinking' | 'tool' | 'subtool' {
	return TRAJECTORY_PROCESS_FOLD_KINDS.has(kind);
}

export interface TrajectoryProcessFoldSpan {
	readonly id: string;
	readonly startIndex: number;
	readonly endIndex: number;
	readonly recordIds: readonly string[];
	readonly records: readonly ConversationTrajectoryRecord[];
}

/**
 * Projects parallel process-fold spans over trajectory records (thinking / tool / subtool).
 * user, context, system, message, compacted, permission, question, error, and unknown break spans.
 */
export function projectTrajectoryProcessFoldSpans(records: readonly ConversationTrajectoryRecord[]): TrajectoryProcessFoldSpan[] {
	const spans: TrajectoryProcessFoldSpan[] = [];
	let spanStart: number | undefined;

	const finalizeSpan = (endIndex: number): void => {
		if (spanStart === undefined) {
			return;
		}

		const startIndex = spanStart;
		const segment = records.slice(startIndex, endIndex);
		spanStart = undefined;

		if (segment.length === 0) {
			return;
		}

		spans.push({
			id: `fold:${segment[0]!.id}`,
			startIndex,
			endIndex,
			recordIds: segment.map(record => record.id),
			records: segment,
		});
	};

	for (let index = 0; index < records.length; index++) {
		const record = records[index]!;
		if (isTrajectoryProcessFoldKind(record.kind)) {
			if (spanStart === undefined) {
				spanStart = index;
			}
		} else {
			finalizeSpan(index);
		}
	}

	finalizeSpan(records.length);
	return spans;
}

const MAX_SUMMARY_STEP_NAMES = 4;

function formatStepNameCounts(names: readonly string[]): string {
	const counts = new Map<string, number>();
	for (const name of names) {
		counts.set(name, (counts.get(name) ?? 0) + 1);
	}

	const parts: string[] = [];
	let shown = 0;
	for (const [name, count] of counts) {
		if (shown >= MAX_SUMMARY_STEP_NAMES) {
			break;
		}
		parts.push(count > 1 ? `${name} ×${count}` : name);
		shown++;
	}
	return parts.join(', ');
}

function collectTurnStepNames(span: ProcessFoldSpan): string[] {
	const names: string[] = [];
	for (const node of span.nodes) {
		if (node.kind === 'thinking') {
			names.push('thinking');
			for (const tool of node.tools) {
				names.push(tool.toolName ?? 'tool');
			}
		} else {
			names.push(node.turn.toolName ?? 'tool');
		}
	}
	return names;
}

/** Outer process-fold header summary for conversation turns (must include Stub per PRD-013). */
export function summarizeProcessSteps(span: ProcessFoldSpan, options?: { readonly showLiveChrome?: boolean }): string {
	const stepCount = span.turnIds.length;
	const stepSummary = formatStepNameCounts(collectTurnStepNames(span));
	if (options?.showLiveChrome) {
		return stepSummary.length > 0
			? `${stepCount} steps · ${stepSummary}`
			: `${stepCount} steps`;
	}
	return stepSummary.length > 0
		? `Stub · ${stepCount} steps · ${stepSummary}`
		: `Stub · ${stepCount} steps`;
}

function collectTrajectoryStepNames(span: TrajectoryProcessFoldSpan): string[] {
	return span.records.map(record => {
		switch (record.kind) {
			case 'thinking':
				return 'thinking';
			case 'subtool':
				return 'subtool';
			case 'tool':
				return 'tool';
			default:
				return record.kind;
		}
	});
}

/** Outer process-fold header summary for trajectory records. Stub prefix only when no engine live chrome. */
export function summarizeTrajectoryProcessSteps(span: TrajectoryProcessFoldSpan, options?: { readonly showLiveChrome?: boolean }): string {
	const stepCount = span.records.length;
	const stepSummary = formatStepNameCounts(collectTrajectoryStepNames(span));
	if (options?.showLiveChrome) {
		return stepSummary.length > 0
			? `${stepCount} steps · ${stepSummary}`
			: `${stepCount} steps`;
	}
	return stepSummary.length > 0
		? `Stub · ${stepCount} steps · ${stepSummary}`
		: `Stub · ${stepCount} steps`;
}
