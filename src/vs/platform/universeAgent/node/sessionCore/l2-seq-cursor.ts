/**
 * ADR-019 §2.6 / INV-SSR-APPLY-13 follow-up — pure localSeqCursor advance plan.
 * Contiguous live only (append + batch left-fold). Actor wires later.
 *
 * INV-LSC-1..5: never seed unknown; only lastAppliedSeq+1 advances;
 * sessionVersion must be injected and match; reuse isL2SeqIndexable.
 * Range / historyResult cover-set → INV-LSC-COVER-1 (not this module).
 *
 * INV-LSC-ADV-SV-1: live-arm observed sessionVersion domain fail-closed
 * (Number.isSafeInteger ∧ ≥1) after no_session_version, before mismatch.
 * MUST NOT merge with isL2SeqIndexable.
 * MUST NOT share the cover-arm private predicate across files.
 * MUST NOT clamp / trunc.
 *
 * INV-LCC-GATE-1: cursor count domain fail-closed (Number.isSafeInteger ∧ ≥0)
 * for localSeqCursor.lastAppliedSeq / lastSessionVersion + sessionVersion gate
 * (MUST NOT merge isGapDomainCount ≥0 vs isAdvanceSessionVersionInDomain ≥1 vs
 * isL2SeqIndexable >0; MUST NOT share predicates across files).
 */

import { isL2SeqIndexable } from './l2-seq-index.js'
import type { LocalSeqCursor } from './stream-hello-gap.js'

export type L2SeqCursorObservation = Readonly<{
	seq: number
	sessionVersion: number | undefined
}>

export type L2SeqCursorAdvancePlan =
	| { kind: 'advance'; next: Extract<LocalSeqCursor, { known: true }> }
	| {
			kind: 'skip'
			reason:
				| 'unknown_cursor'
				| 'no_session_version'
				| 'session_version_invalid'
				| 'session_version_mismatch'
				| 'seq_invalid'
				| 'not_monotonic'
				| 'gap'
		}

/**
 * Live-arm observed sessionVersion domain (INV-LSC-ADV-SV-1).
 * Number.isSafeInteger(v) && v >= 1
 * MUST NOT merge with isL2SeqIndexable:
 *   seq > 0 feeds contiguous live index;
 *   sessionVersion >= 1 (safe integer) feeds executor generation gate.
 *   2**53 is indexable but not a safe sessionVersion.
 * MUST NOT share the cover-arm private predicate across files.
 * MUST NOT clamp / trunc. Helper MUST NOT use ??.
 */
function isAdvanceSessionVersionInDomain(value: number): boolean {
	return Number.isSafeInteger(value) && value >= 1
}

/**
 * INV-LCC-GATE-1: cursor count domain fail-closed (Number.isSafeInteger ∧ ≥0).
 * Validates localSeqCursor.lastAppliedSeq / lastSessionVersion before live advance.
 * MUST NOT merge with isAdvanceSessionVersionInDomain (≥0 vs ≥1).
 * MUST NOT merge with isL2SeqIndexable (>0).
 * MUST NOT share the cover-arm private predicate across files.
 * MUST NOT clamp / trunc. Helper MUST NOT use ??.
 */
function isGapDomainCount(value: number): boolean {
	return Number.isSafeInteger(value) && value >= 0
}

/**
 * Fail-closed plan: observe one seq under an injected sessionVersion.
 * Does not mutate inputs; always returns a fresh plan object.
 */
export function planLocalSeqCursorAdvance(
	cursor: LocalSeqCursor,
	observed: L2SeqCursorObservation,
): L2SeqCursorAdvancePlan {
	if (!isL2SeqIndexable(observed.seq)) {
		return { kind: 'skip', reason: 'seq_invalid' }
	}

	if (!cursor.known) {
		return { kind: 'skip', reason: 'unknown_cursor' }
	}

	if (!isGapDomainCount(cursor.lastAppliedSeq)) {
		return { kind: 'skip', reason: 'seq_invalid' }
	}

	if (!isGapDomainCount(cursor.lastSessionVersion)) {
		return { kind: 'skip', reason: 'session_version_invalid' }
	}

	if (!isAdvanceSessionVersionInDomain(cursor.lastSessionVersion)) {
		return { kind: 'skip', reason: 'session_version_invalid' }
	}

	if (observed.sessionVersion === undefined) {
		return { kind: 'skip', reason: 'no_session_version' }
	}

	if (!isAdvanceSessionVersionInDomain(observed.sessionVersion)) {
		return { kind: 'skip', reason: 'session_version_invalid' }
	}

	if (observed.sessionVersion !== cursor.lastSessionVersion) {
		return { kind: 'skip', reason: 'session_version_mismatch' }
	}

	if (observed.seq <= cursor.lastAppliedSeq) {
		return { kind: 'skip', reason: 'not_monotonic' }
	}

	if (observed.seq > cursor.lastAppliedSeq + 1) {
		return { kind: 'skip', reason: 'gap' }
	}

	return {
		kind: 'advance',
		next: {
			known: true,
			lastAppliedSeq: observed.seq,
			lastSessionVersion: cursor.lastSessionVersion,
			lastMutatedFromSeq: cursor.lastMutatedFromSeq,
		},
	}
}
