/**
 * ADR-019 INV-LSC-WIRE-2 / COVER-1 / INV-LSC-COVER-SV-1 history + range arm —
 * pure localSeqCursor cover plan.
 *
 * Cover-set writers only: historyFill (historyResult.coveredThrough) and
 * rangeReplaced (meta.newHeadSeq → observed.coveredThrough) share this single
 * planner — do not invent a second cover predicate. Contiguous live stays in
 * l2-seq-cursor.ts (INV-LSC-WIRE-1); never route cover through that module.
 *
 * coveredThrough === 0 is legal (empty interval may set coveredThrough =
 * fromExclusive = 0). Do NOT reuse isL2SeqIndexable here: that predicate
 * requires >0 for contiguous/indexable live seqs and would reject a valid
 * empty-cover seed.
 *
 * Cover-arm sessionVersion domain (INV-LSC-COVER-SV-1): fail-closed before
 * cursor seed/reseed. Same lower bound as INV-HFVA page generation authority
 * (Number.isSafeInteger ∧ ≥1). MUST NOT merge with isCoverThroughIndexable:
 * coveredThrough ≥0 feeds seq watermark; sessionVersion ≥1 feeds executor
 * generation gate. INV-SSC-DOM-1 seed lastSessionVersion may be 0 (proto
 * default); this cover hello path rejects 0 — distinct domains.
 *
 * stale_cover includes equal coveredThrough (idempotent) → caller must 0× write.
 * Forbid bypass assignment: lastAppliedSeq = coveredThrough.
 * INV-LSC-COVER-1: historyFill and rangeReplaced coveredThrough share the same
 * numeric domain (finite integer ≥0); each arm keeps a distinct file-private
 * predicate below so coverage drift is visible even though the domain is equal.
 * INV-LSC-COVER-1 monotonic: same sessionVersion → coveredThrough must
 * strictly advance (> lastAppliedSeq); equal/below → stale_cover 0× write.
 */

import type { LocalSeqCursor } from './stream-hello-gap.js'

export type L2SeqCursorCoverObservation = Readonly<{
	coveredThrough: number
	sessionVersion: number | undefined
}>

export type L2SeqCursorCoverPlan =
	| { kind: 'cover'; next: Extract<LocalSeqCursor, { known: true }> }
	| {
			kind: 'skip'
			reason:
				'covered_through_invalid' | 'no_session_version' | 'session_version_invalid' | 'stale_cover'
		}

function isCoverThroughIndexable(value: number): boolean {
	return Number.isFinite(value) && Number.isInteger(value) && value >= 0
}

/**
 * HistoryFill arm coveredThrough domain (INV-LSC-COVER-1 history).
 * Finite integer ≥0; 0 is legal for empty intervals (fromExclusive=0).
 * MUST NOT reuse isL2SeqIndexable (>0) and MUST NOT clamp/trunc.
 * File-private; do not share across modules.
 */
function isHistoryFillCoveredThroughInDomain(value: number): boolean {
	return isCoverThroughIndexable(value)
}

/**
 * RangeReplaced arm coveredThrough domain (INV-LSC-COVER-1 range).
 * Same numeric domain as historyFill (finite integer ≥0, 0 legal for
 * pure-truncate with newHeadSeq=0). Kept as a distinct file-private
 * predicate so history/range coverage drift is explicit; do not merge
 * with isL2SeqIndexable or with the cover sessionVersion predicate.
 */
function isRangeReplacedCoveredThroughInDomain(value: number): boolean {
	return isCoverThroughIndexable(value)
}

/**
 * Shared history/range coveredThrough gate for the cover planner.
 * Both arms share the same domain; evaluate both private predicates to
 * keep drift visible (logical AND — domain identical today).
 */
function isCoverHistoryRangeCoveredThroughInDomain(value: number): boolean {
	return isHistoryFillCoveredThroughInDomain(value) && isRangeReplacedCoveredThroughInDomain(value)
}

/**
 * Cover-arm sessionVersion domain (INV-LSC-COVER-SV-1).
 * Same lower bound as INV-HFVA page generation authority:
 *   Number.isSafeInteger(v) && v >= 1
 * MUST NOT merge with isCoverThroughIndexable:
 *   coveredThrough >= 0 feeds seq watermark;
 *   sessionVersion >= 1 feeds executor generation gate.
 * INV-SSC-DOM-1 seed lastSessionVersion may be 0 (proto default);
 * this cover hello path rejects 0 — distinct domains, distinct predicates.
 */
function isCoverSessionVersionInDomain(value: number): boolean {
	return Number.isSafeInteger(value) && value >= 1
}

/**
 * INV-LSC-COVER-1 monotonic stale_cover gate (same sessionVersion).
 * Same-version coveredThrough must strictly advance (> lastAppliedSeq);
 * equal is idempotent stale (0× write), below is rewind (0× write).
 * File-private; do not export or share across modules. Distinct from
 * live's not_monotonic but same ≤ predicate shape — keep separate for
 * coverage drift visibility. MUST be evaluated only after sessionVersion
 * equality is confirmed; version change reseeds regardless of monotonic.
 */
function isCoverStaleMonotonic(
	observedCoveredThrough: number,
	cursorLastAppliedSeq: number,
): boolean {
	return observedCoveredThrough <= cursorLastAppliedSeq
}

/**
 * Fail-closed cover plan: observe coveredThrough under an injected sessionVersion.
 * Does not mutate inputs; always returns a fresh plan object.
 */
export function planLocalSeqCursorCover(
	cursor: LocalSeqCursor,
	observed: L2SeqCursorCoverObservation,
): L2SeqCursorCoverPlan {
	// INV-LSC-COVER-1: both historyFill (coveredThrough) and rangeReplaced
	// (newHeadSeq → coveredThrough) share the watermark domain; keep
	// distinct private predicates even though the check is identical today.
	if (!isCoverHistoryRangeCoveredThroughInDomain(observed.coveredThrough)) {
		return { kind: 'skip', reason: 'covered_through_invalid' }
	}

	if (observed.sessionVersion === undefined) {
		return { kind: 'skip', reason: 'no_session_version' }
	}

	if (!isCoverSessionVersionInDomain(observed.sessionVersion)) {
		return { kind: 'skip', reason: 'session_version_invalid' }
	}

	if (!cursor.known) {
		return {
			kind: 'cover',
			next: {
				known: true,
				lastAppliedSeq: observed.coveredThrough,
				lastSessionVersion: observed.sessionVersion,
				lastMutatedFromSeq: 0,
			},
		}
	}

	if (observed.sessionVersion !== cursor.lastSessionVersion) {
		return {
			kind: 'cover',
			next: {
				known: true,
				lastAppliedSeq: observed.coveredThrough,
				lastSessionVersion: observed.sessionVersion,
				lastMutatedFromSeq: cursor.lastMutatedFromSeq,
			},
		}
	}

	// INV-LSC-COVER-1 monotonic: same version → strictly advance, else stale_cover
	if (isCoverStaleMonotonic(observed.coveredThrough, cursor.lastAppliedSeq)) {
		return { kind: 'skip', reason: 'stale_cover' }
	}

	return {
		kind: 'cover',
		next: {
			known: true,
			lastAppliedSeq: observed.coveredThrough,
			lastSessionVersion: observed.sessionVersion,
			lastMutatedFromSeq: cursor.lastMutatedFromSeq,
		},
	}
}
