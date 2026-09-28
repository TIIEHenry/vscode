/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProcessFoldSpan, projectProcessFoldSpans } from './conversationProcessFoldModel.js';
import { ConversationStubTurn } from './conversationStubModel.js';

export interface TimelineReconcileTurn {
	readonly id: string;
	readonly turn: object;
}

export interface TimelineReconcileRoot {
	readonly id: string;
	readonly kind: 'item' | 'process-fold';
	readonly turns: readonly TimelineReconcileTurn[];
}

export type TimelineReconcileMode = 'none' | 'content' | 'structure';

export interface TimelineReconcilePlan {
	readonly mode: TimelineReconcileMode;
	readonly removed: readonly string[];
	readonly changed: readonly string[];
	readonly order: readonly string[];
}

/**
 * Root-level identities after process-fold projection (plan §3.4 type B/C).
 */
export function buildTimelineRootIdentities(
	turns: readonly ConversationStubTurn[],
	spans: readonly ProcessFoldSpan[] = projectProcessFoldSpans(turns),
): readonly string[] {
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

export function buildTimelineReconcileRoots(
	turns: readonly ConversationStubTurn[],
	spans: readonly ProcessFoldSpan[] = projectProcessFoldSpans(turns),
): TimelineReconcileRoot[] {
	const spanByStartIndex = new Map(spans.map(span => [span.startIndex, span]));
	const covered = new Set<number>();
	for (const span of spans) {
		for (let index = span.startIndex + 1; index < span.endIndex; index++) {
			covered.add(index);
		}
	}

	const roots: TimelineReconcileRoot[] = [];
	for (let index = 0; index < turns.length; index++) {
		if (covered.has(index)) {
			continue;
		}
		const span = spanByStartIndex.get(index);
		if (span) {
			const spanTurns: { id: string; turn: ConversationStubTurn }[] = [];
			for (let cursor = span.startIndex; cursor < span.endIndex; cursor++) {
				const turn = turns[cursor];
				if (turn) {
					spanTurns.push({ id: turn.id, turn });
				}
			}
			roots.push({
				id: span.id,
				kind: 'process-fold',
				turns: spanTurns,
			});
			continue;
		}
		const turn = turns[index]!;
		roots.push({
			id: turn.id,
			kind: 'item',
			turns: [{ id: turn.id, turn }],
		});
	}
	return roots;
}

/**
 * Identity reconcile for timeline roots (plan §3.3).
 * `none` / `content` / `structure` match the A/B/C frame classes: same roots and
 * same turn identities, same root ids with changed turn identities, or a different
 * root id sequence. New ids are not listed in `changed`.
 */
export function computeTimelineReconcile(
	prevRoots: readonly TimelineReconcileRoot[],
	nextRoots: readonly TimelineReconcileRoot[],
): TimelineReconcilePlan {
	const order = nextRoots.map(root => root.id);
	const nextIds = new Set(order);
	const removed: string[] = [];
	for (const root of prevRoots) {
		if (!nextIds.has(root.id)) {
			removed.push(root.id);
		}
	}

	const prevById = new Map<string, TimelineReconcileRoot>();
	for (const root of prevRoots) {
		if (!prevById.has(root.id)) {
			prevById.set(root.id, root);
		}
	}

	const changed: string[] = [];
	const seenChanged = new Set<string>();
	for (const root of nextRoots) {
		const prev = prevById.get(root.id);
		if (!prev || seenChanged.has(root.id)) {
			continue;
		}
		if (!rootUnchanged(prev, root)) {
			seenChanged.add(root.id);
			changed.push(root.id);
		}
	}

	let mode: TimelineReconcileMode;
	if (!sameIdSequence(prevRoots, nextRoots)) {
		mode = 'structure';
	} else if (changed.length === 0) {
		mode = 'none';
	} else {
		mode = 'content';
	}
	return { mode, removed, changed, order };
}

function sameIdSequence(prevRoots: readonly TimelineReconcileRoot[], nextRoots: readonly TimelineReconcileRoot[]): boolean {
	if (prevRoots.length !== nextRoots.length) {
		return false;
	}
	for (let index = 0; index < prevRoots.length; index++) {
		if (prevRoots[index]?.id !== nextRoots[index]?.id) {
			return false;
		}
	}
	return true;
}

export function sameString(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}
	return a === b;
}

export function shallowMetadataEqual(a: unknown, b: unknown): boolean {
	if (a === b) {
		return true;
	}
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
		return false;
	}
	if (Array.isArray(a) || Array.isArray(b)) {
		return false;
	}
	const left = a as Record<string, unknown>;
	const right = b as Record<string, unknown>;
	const leftKeys = Object.keys(left);
	if (leftKeys.length !== Object.keys(right).length) {
		return false;
	}
	for (const key of leftKeys) {
		if (!Object.prototype.hasOwnProperty.call(right, key)) {
			return false;
		}
		const leftValue = left[key];
		const rightValue = right[key];
		if (leftValue === rightValue) {
			continue;
		}
		if (typeof leftValue === 'string' && typeof rightValue === 'string') {
			if (!sameString(leftValue, rightValue)) {
				return false;
			}
			continue;
		}
		return false;
	}
	return true;
}

/** Reference first, then value. Strings compare length first. `metadata` is a shallow key compare. */
export function structurallyEqual(a: unknown, b: unknown): boolean {
	if (a === b) {
		return true;
	}
	if (typeof a === 'string' && typeof b === 'string') {
		return sameString(a, b);
	}
	if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
		return false;
	}
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
			return false;
		}
		for (let index = 0; index < a.length; index++) {
			if (!structurallyEqual(a[index], b[index])) {
				return false;
			}
		}
		return true;
	}
	const left = a as Record<string, unknown>;
	const right = b as Record<string, unknown>;
	const leftKeys = Object.keys(left);
	if (leftKeys.length !== Object.keys(right).length) {
		return false;
	}
	for (const key of leftKeys) {
		if (!Object.prototype.hasOwnProperty.call(right, key)) {
			return false;
		}
		const leftValue = left[key];
		const rightValue = right[key];
		if (leftValue === rightValue) {
			continue;
		}
		if (key === 'metadata') {
			if (!shallowMetadataEqual(leftValue, rightValue)) {
				return false;
			}
			continue;
		}
		if (!structurallyEqual(leftValue, rightValue)) {
			return false;
		}
	}
	return true;
}

function rootUnchanged(prev: TimelineReconcileRoot, next: TimelineReconcileRoot): boolean {
	if (prev.kind !== next.kind) {
		return false;
	}
	if (next.kind === 'item') {
		const prevTurn = prev.turns[0];
		const nextTurn = next.turns[0];
		if (prev.turns.length !== 1 || next.turns.length !== 1 || !prevTurn || !nextTurn) {
			return false;
		}
		if (prevTurn.turn === nextTurn.turn) {
			return true;
		}
		if (structurallyEqual(prevTurn.turn, nextTurn.turn)) {
			(nextTurn as { turn: object }).turn = prevTurn.turn;
			if ((next as { item?: { turn?: object } }).item) {
				(next as { item?: { turn?: object } }).item!.turn = prevTurn.turn;
			}
			return true;
		}
		return false;
	}
	if (prev.turns.length !== next.turns.length) {
		return false;
	}
	for (let index = 0; index < prev.turns.length; index++) {
		const left = prev.turns[index];
		const right = next.turns[index];
		if (!left || !right || left.id !== right.id) {
			return false;
		}
		if (left.turn === right.turn) {
			continue;
		}
		if (structurallyEqual(left.turn, right.turn)) {
			(right as { turn: object }).turn = left.turn;
			continue;
		}
		return false;
	}
	return true;
}
