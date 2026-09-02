/**
 * ADR-019 knife 3 prep — pure L2 seq→TimelineItemId index algebra.
 * Actor wires later; this module never folds, warns, or mutates inputs.
 *
 * CAP magnitude class matches PENDING_ACTIONS_CAP / LOCAL_PENDING_SENDS_CAP (64),
 * but eviction is **lowest-seq** (keep recent highs) — not skip-at-capacity.
 *
 * INV-SSR-APPLY-4/6/12 (index half): positive seq only; seq never enters ViewPatch;
 * single feed/prune algebra for later Actor wiring.
 *
 * INV-SQI-ADDR-1: address half-domain — upsert/feed reject blank/non-string itemId.
 * INV-SQI-ADDR-2: exact-canonical only (length > 0 ∧ value === value.trim(); check-only).
 * Unaddressable feed raises floor; never write trimmed values.
 *
 * Eviction watermark (`evictedFloor`): cap-lossy drops **or** address-rejected
 * discard raise a monotonic floor; intentional prune does **not** move the floor
 * (remove ≠ silent eviction). Production may still hold a plain Map; state API is
 * prep-only until a wire slice.
 *
 * INV-SQI-SEED-1: seed door — createL2SeqIndexState admits key domain
 * (isL2SeqIndexable; reject does not raise floor) then address domain
 * (isL2SeqIndexAddress; reject joins seedRejectFloor); then evictLowestUntilCap;
 * evictedFloor = max(seedRejectFloor, highestEvicted). Never trim write-back.
 * Optional trailing cap (default L2_SEQ_INDEX_CAP). Pure half-knife; 0 callers.
 */

import type { TimelineItemId, ViewPatch } from '../../common/sessionView/types.js'

/**
 * Bound for private L2 seq→id index entries.
 * Same magnitude class as pending CAP (64); **not** symbol-aliased — eviction
 * policy differs (lowest-seq drop vs skip new parent).
 */
export const L2_SEQ_INDEX_CAP = 64

/** Sentinel: never lost an entry to cap eviction. */
export const L2_SEQ_INDEX_FLOOR_NONE = 0

export type L2SeqIndexEntry = readonly [seq: number, itemId: TimelineItemId]

/**
 * Index algebra with a monotonic eviction watermark.
 * `evictedFloor` is the highest seq ever dropped by cap-lossy eviction **or**
 * address-domain reject at feed (or {@link L2_SEQ_INDEX_FLOOR_NONE} if none).
 */
export type L2SeqIndexState = {
	readonly entries: ReadonlyMap<number, TimelineItemId>
	readonly evictedFloor: number
}

/** True iff finite integer seq > 0 (INV-SSR-APPLY-4 feed gate). */
export function isL2SeqIndexable(seq: unknown): seq is number {
	return typeof seq === 'number' && Number.isFinite(seq) && Number.isInteger(seq) && seq > 0
}

/**
 * True iff value is an exact-canonical string address (INV-SQI-ADDR-1/2).
 * Trim is check-only — never written back into patches or index entries.
 * Module export only; not re-exported from session-core barrel.
 */
export function isL2SeqIndexAddress(value: unknown): value is TimelineItemId {
	return typeof value === 'string' && value.length > 0 && value === value.trim()
}

/**
 * Source-agnostic extract: transport `seq` + any ViewPatch[] frame.
 * Only positive integer seq × addressable `upsertTimelineItem` → entries.
 * Unaddressable upsert → 0× entry (no throw, no patch mutation).
 * Other ops (remove, pending, overlay, sync) ignored.
 */
export function seqIndexEntriesFromPatches(
	seq: number,
	patches: readonly ViewPatch[],
): readonly L2SeqIndexEntry[] {
	if (!isL2SeqIndexable(seq)) return []
	const out: L2SeqIndexEntry[] = []
	for (const patch of patches) {
		if (patch.op === 'upsertTimelineItem') {
			if (!isL2SeqIndexAddress(patch.item.id)) continue
			out.push([seq, patch.item.id])
		}
	}
	return out
}

function normalizeCap(cap: number): number {
	if (!Number.isFinite(cap) || cap < 1) return 0
	return Math.floor(cap)
}

/**
 * Lowest-seq eviction SSOT. Mutates `map` in place (caller owns a fresh copy).
 * @returns highest seq deleted this call, or 0 if none.
 */
function evictLowestUntilCap(map: Map<number, TimelineItemId>, cap: number): number {
	const limit = normalizeCap(cap)
	let highestEvicted = 0
	while (map.size > limit) {
		let lowest: number | undefined
		for (const key of map.keys()) {
			if (lowest === undefined || key < lowest) lowest = key
		}
		if (lowest === undefined) break
		map.delete(lowest)
		if (lowest > highestEvicted) highestEvicted = lowest
	}
	return highestEvicted
}

/**
 * Fresh state; optional entries are domain-admitted then copied (never aliased).
 * INV-SQI-SEED-1: key domain then address domain then cap eviction.
 * Key reject does not raise floor; address reject joins seedRejectFloor.
 */
export function createL2SeqIndexState(
	entries?: ReadonlyMap<number, TimelineItemId>,
	cap: number = L2_SEQ_INDEX_CAP,
): L2SeqIndexState {
	const next = new Map<number, TimelineItemId>()
	let seedRejectFloor = L2_SEQ_INDEX_FLOOR_NONE
	if (entries !== undefined) {
		for (const [seq, itemId] of entries) {
			if (!isL2SeqIndexable(seq)) continue
			if (!isL2SeqIndexAddress(itemId)) {
				seedRejectFloor = Math.max(seedRejectFloor, seq)
				continue
			}
			next.set(seq, itemId)
		}
	}
	const highestEvicted = evictLowestUntilCap(next, cap)
	return {
		entries: next,
		evictedFloor: Math.max(seedRejectFloor, highestEvicted),
	}
}

/**
 * Immutable feed: copy → set indexable+addressable entries → lowest-seq eviction.
 * Seq ok ∧ address reject → no set (existing entry kept) and seq joins floor.
 * `evictedFloor` = max(prev, address-rejected seqs, cap-evicted seqs); never decreases.
 * Always returns a **new** state object.
 */
export function feedL2SeqIndexState(
	state: L2SeqIndexState,
	entries: readonly L2SeqIndexEntry[],
	cap: number = L2_SEQ_INDEX_CAP,
): L2SeqIndexState {
	const next = new Map(state.entries)
	let addressRejectFloor = L2_SEQ_INDEX_FLOOR_NONE
	for (const [seq, itemId] of entries) {
		if (!isL2SeqIndexable(seq)) continue
		if (!isL2SeqIndexAddress(itemId)) {
			addressRejectFloor = Math.max(addressRejectFloor, seq)
			continue
		}
		next.set(seq, itemId)
	}
	const highestEvicted = evictLowestUntilCap(next, cap)
	return {
		entries: next,
		evictedFloor: Math.max(state.evictedFloor, addressRejectFloor, highestEvicted),
	}
}

/**
 * Immutable prune: copy → delete listed keys (missing = no-op).
 * **Does not change `evictedFloor`** — intentional removal is not cap-lossy
 * eviction; the watermark must not retreat when size falls below cap.
 * Always returns a **new** state object.
 */
export function pruneL2SeqIndexState(
	state: L2SeqIndexState,
	removedSeqs: readonly number[],
): L2SeqIndexState {
	const next = new Map(state.entries)
	for (const seq of removedSeqs) {
		next.delete(seq)
	}
	return {
		entries: next,
		evictedFloor: state.evictedFloor,
	}
}

/**
 * Sound coverage vs eviction watermark (not key presence):
 * `fromSeq > evictedFloor`. Floor 0 (never evicted) ⇒ any positive fromSeq passes.
 */
export function l2SeqIndexCoversFrom(state: L2SeqIndexState, fromSeq: number): boolean {
	return fromSeq > state.evictedFloor
}

/**
 * Immutable feed: copy → set indexable entries → lowest-seq eviction to cap.
 * Always returns a **new** Map instance (MF-4). Input map is never mutated.
 * Delegates to {@link feedL2SeqIndexState} (single eviction SSOT).
 */
export function feedL2SeqIndex(
	index: ReadonlyMap<number, TimelineItemId>,
	entries: readonly L2SeqIndexEntry[],
	cap: number = L2_SEQ_INDEX_CAP,
): Map<number, TimelineItemId> {
	const state = feedL2SeqIndexState(
		{ entries: index, evictedFloor: L2_SEQ_INDEX_FLOOR_NONE },
		entries,
		cap,
	)
	return state.entries as Map<number, TimelineItemId>
}

/**
 * Immutable prune: copy → delete listed keys (missing = no-op).
 * Does **not** preserve negative seq by policy — that gate lives in
 * `planRangeReplacedApply` (MF-1). Always returns a **new** Map.
 * Delegates to {@link pruneL2SeqIndexState}.
 */
export function pruneL2SeqIndex(
	index: ReadonlyMap<number, TimelineItemId>,
	removedSeqs: readonly number[],
): Map<number, TimelineItemId> {
	const state = pruneL2SeqIndexState(
		{ entries: index, evictedFloor: L2_SEQ_INDEX_FLOOR_NONE },
		removedSeqs,
	)
	return state.entries as Map<number, TimelineItemId>
}
