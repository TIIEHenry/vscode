/**
 * Pure StreamHello → gap plan (E6a → session-core SSOT).
 *
 * Semantic ownership: SubscriptionFsm / HistoryFill (this package).
 * Main `engine/stream-hello-gap` re-exports this module — do not fork logic.
 * runtime_epoch is intentionally ignored (L3 freshness, not gap).
 * INV-SHG-ANCH-1: fail-closed gap anchor/cursor domain admit (0 production callers).
 * INV-SHG-OWN-1: own-data-key fail-closed for anchor/cursor field reads at admit predicates.
 */

/**
 * Bounded cold-start backfill window (INV-BR-2).
 * Must stay ≤ Main `GET_HISTORY_MAX_PAGE_SIZE` (500); core does not import Main.
 */
export const BOOTSTRAP_BACKFILL_WINDOW = 500

/**
 * Max known-cursor historyFill span (INV-HGW-1).
 * Conservative seq-span ceiling vs Main `HISTORY_FILL_MAX_PAGES` (64) × default
 * pageSize (100) ≈ 6400 under dense paging — not formally equivalent to page
 * budget (sparse pages can still exhaust budget on smaller gaps).
 * Must satisfy BOOTSTRAP_BACKFILL_WINDOW ≤ this ≤ 6400; core does not import Main.
 */
export const HISTORY_FILL_MAX_GAP = 5000

export type StreamHelloGapAnchor = Readonly<{
	readonly sessionVersion: number
	readonly headSeq: number
	readonly lastMutatedFromSeq: number
}>

/** Actor-internal sync watermark (INV-SPC-2; R5). */
export type SyncWatermark = Readonly<{
	readonly sessionVersion: number
	readonly lastAppliedSeq: number
	readonly lastMutatedFromSeq: number
}>

export type LocalSeqCursor =
	| { readonly known: false }
	| {
			readonly known: true
			readonly lastAppliedSeq: number
			readonly lastSessionVersion: number
			/** 0 = never range-replaced; aligned on that axis when hello also 0. */
			readonly lastMutatedFromSeq: number
		}

export type StreamHelloGapPlan =
	| { readonly kind: 'aligned' }
	| {
			readonly kind: 'historyFill'
			/** Exclusive lower bound (lastAppliedSeq); fill applies seq > fromExclusive. */
			readonly fromExclusive: number
			/** Inclusive upper bound from StreamHello.head_seq. */
			readonly toInclusive: number
		}
	| {
			/** Cold-start; Actor may emit fill (INV-BR-1). */
			readonly kind: 'bootstrapResync'
			readonly reason: 'unknown_cursor'
			readonly fromExclusive: number
			readonly toInclusive: number
		}
	| {
			/** Tail window; next-slice consume contract (INV-HGW-2). */
			readonly kind: 'bootstrapResync'
			readonly reason: 'gap_too_large'
			readonly fromExclusive: number
			readonly toInclusive: number
		}
	| {
			readonly kind: 'bootstrapResync'
			readonly reason: 'session_version' | 'local_ahead'
		}
	| {
			/** R5 rebuild window: hello lastMutatedFromSeq ≠ local watermark. */
			readonly kind: 'rewriteWindow'
			readonly fromExclusive: number
			readonly toInclusive: number
			readonly dropFromSeq: number
			readonly helloLastMutatedFromSeq: number
		}

function unknownCursorBackfill(
	headSeq: number,
): Extract<StreamHelloGapPlan, { kind: 'bootstrapResync'; reason: 'unknown_cursor' }> {
	return {
		kind: 'bootstrapResync',
		reason: 'unknown_cursor',
		fromExclusive: Math.max(0, headSeq - BOOTSTRAP_BACKFILL_WINDOW),
		toInclusive: headSeq,
	}
}

function gapTooLargeTailWindow(
	headSeq: number,
): Extract<StreamHelloGapPlan, { kind: 'bootstrapResync'; reason: 'gap_too_large' }> {
	return {
		kind: 'bootstrapResync',
		reason: 'gap_too_large',
		fromExclusive: Math.max(0, headSeq - HISTORY_FILL_MAX_GAP),
		toInclusive: headSeq,
	}
}

/**
 * Compare StreamHello head_seq / session_version with local cursor.
 * Does not read runtime_epoch.
 */
export function planGapFromStreamHello(
	hello: StreamHelloGapAnchor,
	local: LocalSeqCursor,
): StreamHelloGapPlan {
	const admitted = admitStreamHelloGapInputsWithRejects(hello as unknown, local as unknown)
	if (!admitted.ok) throw new Error(admitted.reason)
	hello = admitted.hello
	local = admitted.local
	if (!local.known) {
		return unknownCursorBackfill(hello.headSeq)
	}

	if (hello.sessionVersion < local.lastSessionVersion) {
		return { kind: 'bootstrapResync', reason: 'session_version' }
	}

	if (hello.sessionVersion > local.lastSessionVersion) {
		// Version advanced — fail-closed diagnostic; do not invent a fill window.
		return { kind: 'bootstrapResync', reason: 'session_version' }
	}

	// Same session_version: R5 mutation axis before head_seq gap planning.
	if (hello.lastMutatedFromSeq !== local.lastMutatedFromSeq) {
		const bounds = planRewriteWindowBounds(hello.lastMutatedFromSeq, hello.headSeq)
		return {
			kind: 'rewriteWindow',
			fromExclusive: bounds.fromExclusive,
			toInclusive: bounds.toInclusive,
			dropFromSeq: bounds.dropFromSeq,
			helloLastMutatedFromSeq: hello.lastMutatedFromSeq,
		}
	}

	// Same session_version + mutation axis aligned: reconcile on head_seq vs lastAppliedSeq.
	if (hello.headSeq < local.lastAppliedSeq) {
		// Local ahead of engine head — fail-closed, do not invent rewind.
		return { kind: 'bootstrapResync', reason: 'local_ahead' }
	}

	if (hello.headSeq === local.lastAppliedSeq) {
		return { kind: 'aligned' }
	}

	const gap = hello.headSeq - local.lastAppliedSeq
	if (gap > HISTORY_FILL_MAX_GAP) {
		return gapTooLargeTailWindow(hello.headSeq)
	}

	return {
		kind: 'historyFill',
		fromExclusive: local.lastAppliedSeq,
		toInclusive: hello.headSeq,
	}
}

/** Bounds for R5 drop+refill from hello.lastMutatedFromSeq (fromSeq may be 0). */
export function planRewriteWindowBounds(
	helloLastMutatedFromSeq: number,
	headSeq: number,
): Readonly<{
	readonly fromExclusive: number
	readonly toInclusive: number
	readonly dropFromSeq: number
}> {
	const fromSeq = helloLastMutatedFromSeq
	const fromExclusive = fromSeq > 0 ? fromSeq - 1 : 0
	const dropFromSeq = fromSeq > 0 ? fromSeq : 1
	return { fromExclusive, toInclusive: headSeq, dropFromSeq }
}

export function syncWatermarkFromKnownCursor(
	cursor: Extract<LocalSeqCursor, { known: true }>,
): SyncWatermark {
	return {
		sessionVersion: cursor.lastSessionVersion,
		lastAppliedSeq: cursor.lastAppliedSeq,
		lastMutatedFromSeq: cursor.lastMutatedFromSeq,
	}
}

export function isSyncWatermarkAligned(hello: StreamHelloGapAnchor, local: SyncWatermark): boolean {
	return (
		hello.sessionVersion === local.sessionVersion &&
		hello.headSeq === local.lastAppliedSeq &&
		hello.lastMutatedFromSeq === local.lastMutatedFromSeq
	)
}

export type StreamHelloGapAdmitRejectReason =
	| 'anchor_not_object'
	| 'anchor_session_version_out_of_domain'
	| 'anchor_head_seq_out_of_domain'
	| 'anchor_last_mutated_from_seq_out_of_domain'
	| 'cursor_not_object'
	| 'cursor_known_not_boolean'
	| 'cursor_last_applied_seq_out_of_domain'
	| 'cursor_last_session_version_out_of_domain'
	| 'cursor_last_mutated_from_seq_out_of_domain'

export type StreamHelloGapAdmitResult =
	| {
			readonly ok: true
			readonly hello: StreamHelloGapAnchor
			readonly local: LocalSeqCursor
		}
	| {
			readonly ok: false
			readonly reason: StreamHelloGapAdmitRejectReason
		}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (desc.get !== undefined || desc.set !== undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

/** True iff finite safe integer count ≥ 0 (INV-SHG-ANCH-1). */
export function isGapDomainCount(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export function isStreamHelloGapAnchorInDomain(value: unknown): value is StreamHelloGapAnchor {
	if (!isRecord(value)) return false
	const sessionVersion = readOwnDataValue(value, 'sessionVersion')
	const headSeq = readOwnDataValue(value, 'headSeq')
	const lastMutatedFromSeq = readOwnDataValue(value, 'lastMutatedFromSeq')
	return (
		isGapDomainCount(sessionVersion) &&
		isGapDomainCount(headSeq) &&
		isGapDomainCount(lastMutatedFromSeq)
	)
}

export function isLocalSeqCursorInDomain(value: unknown): value is LocalSeqCursor {
	if (!isRecord(value)) return false
	const known = readOwnDataValue(value, 'known')
	if (typeof known !== 'boolean') return false
	if (!known) return true
	return (
		isGapDomainCount(readOwnDataValue(value, 'lastAppliedSeq')) &&
		isGapDomainCount(readOwnDataValue(value, 'lastSessionVersion')) &&
		isGapDomainCount(readOwnDataValue(value, 'lastMutatedFromSeq'))
	)
}

/**
 * Fail-closed StreamHello gap planner input admit (INV-SHG-ANCH-1).
 * Reject-only: no Number() / clamp / `??`. Ok returns the same input refs.
 * Gate order: anchor object → sessionVersion → headSeq → lastMutatedFromSeq →
 * cursor object → known → lastAppliedSeq → lastSessionVersion → lastMutatedFromSeq.
 * INV-SHG-OWN-1: own-data field reads before domain checks.
 */
export function admitStreamHelloGapInputsWithRejects(
	hello: unknown,
	local: unknown,
): StreamHelloGapAdmitResult {
	if (!isRecord(hello)) {
		return { ok: false, reason: 'anchor_not_object' }
	}
	const sessionVersion = readOwnDataValue(hello, 'sessionVersion')
	if (!isGapDomainCount(sessionVersion)) {
		return { ok: false, reason: 'anchor_session_version_out_of_domain' }
	}
	const headSeq = readOwnDataValue(hello, 'headSeq')
	if (!isGapDomainCount(headSeq)) {
		return { ok: false, reason: 'anchor_head_seq_out_of_domain' }
	}
	const lastMutatedFromSeq = readOwnDataValue(hello, 'lastMutatedFromSeq')
	if (!isGapDomainCount(lastMutatedFromSeq)) {
		return { ok: false, reason: 'anchor_last_mutated_from_seq_out_of_domain' }
	}
	if (!isRecord(local)) {
		return { ok: false, reason: 'cursor_not_object' }
	}
	const known = readOwnDataValue(local, 'known')
	if (typeof known !== 'boolean') {
		return { ok: false, reason: 'cursor_known_not_boolean' }
	}
	if (known) {
		if (!isGapDomainCount(readOwnDataValue(local, 'lastAppliedSeq'))) {
			return { ok: false, reason: 'cursor_last_applied_seq_out_of_domain' }
		}
		if (!isGapDomainCount(readOwnDataValue(local, 'lastSessionVersion'))) {
			return { ok: false, reason: 'cursor_last_session_version_out_of_domain' }
		}
		if (!isGapDomainCount(readOwnDataValue(local, 'lastMutatedFromSeq'))) {
			return {
				ok: false,
				reason: 'cursor_last_mutated_from_seq_out_of_domain',
			}
		}
	}
	return {
		ok: true,
		hello: hello as StreamHelloGapAnchor,
		local: local as LocalSeqCursor,
	}
}
