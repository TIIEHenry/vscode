/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConversationStubTurn, StubTurnKind } from './conversationStubModel.js';

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

const PROCESS_FOLD_KINDS: ReadonlySet<StubTurnKind> = new Set(['thinking', 'tool']);

function isProcessFoldKind(kind: StubTurnKind): kind is 'thinking' | 'tool' {
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
 * Continuous thinking/tool runs form one span; user, assistant, and confirmation break spans.
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
