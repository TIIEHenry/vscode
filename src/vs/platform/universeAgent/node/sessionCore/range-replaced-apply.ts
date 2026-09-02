/**
 * ADR-019 Am.2 — pure rangeReplaced delete-by-IDs + apply planner.
 * Actor wires later; this module never folds, mutates the Map, or warns.
 *
 * Precedent: {@link planOverlayPendingSetReplace} in pending-actions-bound.ts.
 *
 * Live delete key = non-empty replacedEnvelopeIds (itemId ≡ envelopeId).
 * fromSeq is consistency / resync window only — NOT a delete key.
 * INV-RRA-OWN-1: fromSeq / row seq own-data-key admit only own data properties.
 * INV-RRA-RNG-1 / INV-RRA-DUP-1 remain replacement-row constraints.
 *
 * supersede (Am.1 knife 3): seq >= fromSeq index-derived removes;
 * under-truncate / index floor as live delete gates.
 */

import { isL2SeqIndexable } from './l2-seq-index.js'
import type { TimelineItemId, ViewPatch } from '../../common/sessionView/types.js'

/** Stable diagnostic code when meta.fromSeq is missing/illegal. */
export const RANGE_REPLACED_FROM_SEQ_INVALID = 'range_replaced_from_seq_invalid' as const

/**
 * Stable diagnostic code when replacedEnvelopeIds is empty and no
 * subtree_root_turn_id is present (Am.2 fail-closed).
 */
export const RANGE_REPLACED_IDS_MISSING = 'range_replaced_ids_missing' as const

/**
 * Stable diagnostic code when replacedEnvelopeIds is empty but subtree root
 * is present — local turn graph is not projectable (Am.2 upgrade path).
 */
export const RANGE_REPLACED_SUBTREE_UNRESOLVABLE = 'range_replaced_subtree_unresolvable' as const

/**
 * Stable diagnostic code when a replacement row carries a defined `seq` that is
 * not indexable or lies below fromSeq (INV-RRA-RNG-1).
 */
export const RANGE_REPLACED_REPLACEMENT_SEQ_OUT_OF_RANGE =
	'range_replaced_replacement_seq_out_of_range' as const

/**
 * Stable diagnostic code when two replacement rows in one batch carry the same
 * defined `seq` (INV-RRA-DUP-1).
 */
export const RANGE_REPLACED_REPLACEMENT_SEQ_DUPLICATE =
	'range_replaced_replacement_seq_duplicate' as const

/** @deprecated Am.2 — no longer emitted by live delete planner. */
export const RANGE_REPLACED_UNDER_TRUNCATE = 'range_replaced_under_truncate' as const

/** @deprecated Am.2 — no longer emitted by live delete planner. */
export const RANGE_REPLACED_INDEX_FLOOR_UNCOVERED = 'range_replaced_index_floor_uncovered' as const

/**
 * Range meta fields this planner reads. Other transport meta (newHeadSeq,
 * sessionVersion, …) is opaque here.
 */
export type RangeReplacedMeta = {
	readonly fromSeq: number
	readonly replacedEnvelopeIds?: readonly string[]
	readonly subtreeRootTurnId?: string
}

/**
 * Replacement fold rows; planner does not fold.
 * Defined `seq` must satisfy isL2SeqIndexable ∧ seq >= fromSeq (INV-RRA-RNG-1);
 * omitted `seq` still passes through (non-indexable orphan residual).
 * Defined seqs in one batch must be unique (INV-RRA-DUP-1).
 */
export type RangeReplacedFoldEvent = {
	readonly arm: string
	readonly body?: unknown
	readonly seq?: number
}

export type RangeReplacedApplyPlan =
	| {
			readonly kind: 'reject'
			readonly code:
				| typeof RANGE_REPLACED_FROM_SEQ_INVALID
				| typeof RANGE_REPLACED_IDS_MISSING
				| typeof RANGE_REPLACED_REPLACEMENT_SEQ_OUT_OF_RANGE
				| typeof RANGE_REPLACED_REPLACEMENT_SEQ_DUPLICATE
		}
	| {
			readonly kind: 'unresolvable'
			readonly code: typeof RANGE_REPLACED_SUBTREE_UNRESOLVABLE
		}
	| {
			readonly kind: 'apply'
			readonly removeByIds: readonly TimelineItemId[]
			readonly removePatches: readonly ViewPatch[]
			readonly eventsToFold: readonly RangeReplacedFoldEvent[]
			readonly removedSeqs: readonly number[]
		}

function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (desc.get !== undefined || desc.set !== undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

function readReplacedEnvelopeIds(meta: object): readonly string[] {
	const raw = readOwnDataValue(meta, 'replacedEnvelopeIds')
	if (!Array.isArray(raw)) return []
	const ids: string[] = []
	for (const item of raw) {
		if (typeof item === 'string' && item.length > 0) {
			ids.push(item)
		}
	}
	return ids
}

function readSubtreeRootTurnId(meta: object): string | undefined {
	const raw = readOwnDataValue(meta, 'subtreeRootTurnId')
	if (typeof raw !== 'string' || raw.length === 0 || raw !== raw.trim()) {
		return undefined
	}
	return raw
}

function hasDuplicateDefinedReplacementSeq(rows: readonly RangeReplacedFoldEvent[]): boolean {
	const seen = new Set<number>()
	for (const row of rows) {
		const seq = readOwnDataValue(row, 'seq')
		if (seq === undefined) continue
		if (seen.has(seq as number)) return true
		seen.add(seq as number)
	}
	return false
}

function isValidFromSeq(fromSeq: unknown): fromSeq is number {
	return (
		typeof fromSeq === 'number' &&
		Number.isFinite(fromSeq) &&
		Number.isInteger(fromSeq) &&
		fromSeq > 0
	)
}

function removedSeqsForIds(
	seqIndex: ReadonlyMap<number, TimelineItemId>,
	removeByIds: ReadonlySet<TimelineItemId>,
): number[] {
	const removed: number[] = []
	for (const [seq, itemId] of seqIndex.entries()) {
		if (removeByIds.has(itemId)) {
			removed.push(seq)
		}
	}
	removed.sort((a, b) => a - b)
	return removed
}

/**
 * Pure planner for L2 envelopeRangeReplaced delete-by-IDs + apply (ADR-019 Am.2).
 *
 * - Non-empty replacedEnvelopeIds → removeTimelineItem per id (itemId ≡ envelopeId).
 * - Missing id in mirror = no-op (not reject); removedSeqs only for indexed hits.
 * - Empty IDs + subtreeRootTurnId → unresolvable (Actor degraded + resync).
 * - Empty IDs + no subtree root → reject ids_missing.
 * - Replacement seq range (INV-RRA-RNG-1) and uniqueness (INV-RRA-DUP-1) unchanged.
 * - Does not fold domain events; does not mutate `seqIndex`.
 */
export function planRangeReplacedApply(
	seqIndex: ReadonlyMap<number, TimelineItemId>,
	meta: RangeReplacedMeta,
	replacementEvents: readonly RangeReplacedFoldEvent[],
): RangeReplacedApplyPlan {
	const fromSeqRaw = readOwnDataValue(meta, 'fromSeq')
	if (!isValidFromSeq(fromSeqRaw)) {
		return { kind: 'reject', code: RANGE_REPLACED_FROM_SEQ_INVALID }
	}

	const fromSeq = fromSeqRaw
	const replacedEnvelopeIds = readReplacedEnvelopeIds(meta)

	if (replacedEnvelopeIds.length === 0) {
		if (readSubtreeRootTurnId(meta) !== undefined) {
			return { kind: 'unresolvable', code: RANGE_REPLACED_SUBTREE_UNRESOLVABLE }
		}
		return { kind: 'reject', code: RANGE_REPLACED_IDS_MISSING }
	}

	for (const row of replacementEvents) {
		const seq = readOwnDataValue(row, 'seq')
		if (seq === undefined) continue
		if (!isL2SeqIndexable(seq) || seq < fromSeq) {
			return {
				kind: 'reject',
				code: RANGE_REPLACED_REPLACEMENT_SEQ_OUT_OF_RANGE,
			}
		}
	}

	if (hasDuplicateDefinedReplacementSeq(replacementEvents)) {
		return { kind: 'reject', code: RANGE_REPLACED_REPLACEMENT_SEQ_DUPLICATE }
	}

	const removeByIds = replacedEnvelopeIds.map((id) => id as TimelineItemId)
	const removeByIdSet = new Set(removeByIds)
	const removedSeqs = removedSeqsForIds(seqIndex, removeByIdSet)
	const removePatches: ViewPatch[] = removeByIds.map((itemId) => ({
		op: 'removeTimelineItem' as const,
		itemId,
	}))

	return {
		kind: 'apply',
		removeByIds,
		removePatches,
		eventsToFold: replacementEvents,
		removedSeqs,
	}
}
