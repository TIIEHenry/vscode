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
 * Each thinking and tool turn in one span is its own row.
 * A following tool is not folded into the thinking turn ahead of it.
 */
export function nestThinkingTools(turns: readonly ConversationStubTurn[]): ProcessFoldNode[] {
	const nodes: ProcessFoldNode[] = [];

	for (const turn of turns) {
		if (turn.kind === 'thinking') {
			nodes.push({ kind: 'thinking', turn, tools: [] });
		} else if (turn.kind === 'tool') {
			nodes.push({ kind: 'tool', turn });
		}
	}

	return nodes;
}

/**
 * Projects parallel process-fold spans over a turn timeline (ADR-046 span overlay).
 * Continuous thinking/tool runs form one span (same-turn live reasoning/tool
 * stay together). user, assistant, confirmation, question, error, unknown,
 * system, visualization, and reviewNav break spans.
 * Span id is `fold:${firstId}` only. Overlay-first spans are `fold:overlay:…`;
 * that id change on L2 replace resets expand (Q4 — do not infer overlay↔L2).
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
			id: `fold:${segment[0]!.id}`,
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

/**
 * Trajectory process-fold whitelist is thinking|tool|subtool only.
 * Q3 compacted and Q5a kinds (permission / question / error / unknown) are not
 * in this set, so they interrupt a span the same way user / context / system / message do.
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
/** Collapsed header names stay one line; same bound as trajectory row previews. */
const THINKING_STEP_SUMMARY_MAX = 120;
/** Engine reasoning title when no usable preview was admitted. Not a sentence. */
const THINKING_TITLE_LITERAL = 'THINKING';
const THINKING_STEP_FALLBACK = 'thinking';

/**
 * One line of thinking prose for a collapsed process-fold title.
 * Blank and the literal THINKING title are not sentences.
 * The expanded reading line already shows the full text; this does not copy it there.
 */
function oneLineThinkingSummary(raw: string | undefined): string | undefined {
	if (typeof raw !== 'string') {
		return undefined;
	}
	const line = raw.replace(/\s+/g, ' ').trim();
	if (line.length === 0 || line === THINKING_TITLE_LITERAL) {
		return undefined;
	}
	if (line.length <= THINKING_STEP_SUMMARY_MAX) {
		return line;
	}
	return `${line.slice(0, THINKING_STEP_SUMMARY_MAX - 1)}…`;
}

/**
 * Prefer the reading-line body (`payload`) when it is prose, otherwise `text`.
 * Does not change the reading line itself.
 */
function thinkingTurnStepName(turn: ConversationStubTurn): string {
	return oneLineThinkingSummary(turn.payload)
		?? oneLineThinkingSummary(turn.text)
		?? THINKING_STEP_FALLBACK;
}

function thinkingRecordStepName(text: string): string {
	return oneLineThinkingSummary(text) ?? THINKING_STEP_FALLBACK;
}

/**
 * Appends tool names only when a thinking node actually carries tools.
 * Conversation rows do not: each tool is its own process-fold row.
 */
export function summarizeThinkingTools(thinkingText: string, tools: readonly { readonly toolName?: string }[]): string {
	const names = tools.map(tool => tool.toolName?.trim() || 'tool');
	const summary = formatStepNameCounts(names);
	return summary.length > 0 ? `${thinkingText} · ${summary}` : thinkingText;
}

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
			names.push(thinkingTurnStepName(node.turn));
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
				return thinkingRecordStepName(record.text);
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
