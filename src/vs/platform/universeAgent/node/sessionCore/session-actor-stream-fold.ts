function isGapDomainCount(value: number): boolean {
	return Number.isSafeInteger(value) && value >= 0
}

function isAdvanceSessionVersionInDomain(value: number): boolean {
	return Number.isSafeInteger(value) && value >= 1
}

/**
 * GFS-4 SessionActor fold module.
 */

import {
	isApplyViewPatchesStreamEvent,
	isHistoryFillResultPayload,
	isOverlayActiveTurnArm,
	isOverlayActiveTurnClearArm,
	isOverlayActiveTurnClearEvent,
	isOverlayActiveTurnEvent,
	isOverlayPendingSnapshotArm,
	isOverlayPendingSnapshotEvent,
	isStreamHelloArm,
	isStreamHelloEvent,
	isRangeReplacedArm,
	isRangeReplacedEvent,
	streamEventArmLabel,
	type RangeReplacedEvent,
	type StreamHelloAnchor,
} from './local-fact.js'
import { planGapFromStreamHello, type StreamHelloGapPlan } from './stream-hello-gap.js'
import {
	operationIdsToSupersedeFromViewPatches,
	patchesForLocalPendingSupersedeAll,
} from './local-pending-sends.js'
import { planRangeReplacedApply, type RangeReplacedApplyPlan } from './range-replaced-apply.js'
import {
	viewPatchesFromHistoryFillEnvelopes,
	type SeqItemNote,
} from './history-result-to-view-patch.js'
import {
	createL2SeqIndexState,
	feedL2SeqIndexState,
	pruneL2SeqIndexState,
	seqIndexEntriesFromPatches,
	type L2SeqIndexEntry,
	type L2SeqIndexState,
} from './l2-seq-index.js'
import { planLocalSeqCursorAdvance } from './l2-seq-cursor.js'
import { planLocalSeqCursorCover } from './l2-seq-cursor-cover.js'
import { foldDomainStreamEvent } from './stream-event-to-view-patch.js'
import { admitPendingActionUpserts } from './pending-actions-bound.js'
import { applyViewPatches } from '../../common/sessionView/apply.js'
import type { DiagnosticMetric } from './ports.js'
import type { StreamCloseCause } from './messages.js'
import type { TimelineItemId, ViewPatch } from '../../common/sessionView/types.js'
import { SEND_FAILED_EPOCH_CHANGED, SEND_FAILED_STREAM_CLOSED } from './session-actor-chat-outbox.js'
import { SessionActor } from './session-actor.js'
import type { SessionActorFold } from './session-actor-fold-interface.js'

export function installSessionActorStreamFold(): void {
	;(SessionActor.prototype as unknown as SessionActorFold).foldStreamApplyViewPatches = function (this: SessionActorFold, patches: readonly ViewPatch[]): void {
		const pending = this.snapshot.localPendingSends
		const matched = operationIdsToSupersedeFromViewPatches(pending, patches)
		for (const operationId of matched) {
			this.cancelFlushTimeout(String(operationId))
		}
		const removePatches = patchesForLocalPendingSupersedeAll(pending, matched)
		this.foldAndBroadcastPatches(
			removePatches.length === 0 ? patches : [...patches, ...removePatches],
		)
	}

	;(SessionActor.prototype as unknown as SessionActorFold).onStreamEvent = function (this: SessionActorFold, event: unknown): void {
		if (isStreamHelloEvent(event)) {
			this.onStreamHello(event.body)
			return
		}
		if (isStreamHelloArm(event)) {
			this.deps.diagnostics.count('stream.hello_malformed', {
				sessionId: String(this.sessionId),
			})
			this.deps.diagnostics.warn('stream hello malformed', {
				sessionId: this.sessionId,
				arm: 'hello',
			})
			return
		}
		if (isOverlayPendingSnapshotEvent(event)) {
			this.onOverlayPendingSnapshot(event.body)
			return
		}
		if (isOverlayPendingSnapshotArm(event)) {
			this.deps.diagnostics.count('event.domain_malformed', {
				sessionId: String(this.sessionId),
				arm: 'overlayPendingSnapshot',
			})
			this.deps.diagnostics.warn('stream overlay pending snapshot malformed', {
				sessionId: this.sessionId,
				arm: 'overlayPendingSnapshot',
			})
			return
		}
		if (isOverlayActiveTurnEvent(event)) {
			this.onOverlayActiveTurn(event.body)
			return
		}
		if (isOverlayActiveTurnArm(event)) {
			this.deps.diagnostics.count('event.domain_malformed', {
				sessionId: String(this.sessionId),
				arm: 'overlayActiveTurn',
			})
			this.deps.diagnostics.warn('stream overlay active turn malformed', {
				sessionId: this.sessionId,
				arm: 'overlayActiveTurn',
			})
			return
		}
		if (isOverlayActiveTurnClearEvent(event)) {
			this.onOverlayActiveTurnClear()
			return
		}
		if (isOverlayActiveTurnClearArm(event)) {
			this.deps.diagnostics.count('event.domain_malformed', {
				sessionId: String(this.sessionId),
				arm: 'overlayActiveTurnClear',
			})
			this.deps.diagnostics.warn('stream overlay active turn clear malformed', {
				sessionId: this.sessionId,
				arm: 'overlayActiveTurnClear',
			})
			return
		}
		if (isRangeReplacedEvent(event)) {
			this.onRangeReplaced(event)
			return
		}
		if (isRangeReplacedArm(event)) {
			this.deps.diagnostics.count('event.domain_malformed', {
				sessionId: String(this.sessionId),
				arm: 'rangeReplaced',
			})
			this.deps.diagnostics.warn('stream rangeReplaced malformed', {
				sessionId: this.sessionId,
				arm: 'rangeReplaced',
			})
			return
		}
		if (isApplyViewPatchesStreamEvent(event)) {
			this.foldStreamApplyViewPatches(event.body.patches)
			return
		}
		if (this.tryFoldL1SyncChromeStreamEvent(event)) {
			return
		}
		const domain = foldDomainStreamEvent(event)
		if (domain.kind === 'patches') {
			this.foldStreamApplyViewPatches(domain.patches)
			this.feedIndexFromTransportEvent(event, domain.patches)
			this.maybeAdvanceLocalSeqCursorFromLive(event)
			return
		}
		if (domain.kind === 'malformed') {
			this.deps.diagnostics.count('event.domain_malformed', {
				sessionId: String(this.sessionId),
				arm: domain.arm,
			})
			this.deps.diagnostics.warn('stream domain event malformed', {
				sessionId: this.sessionId,
				arm: domain.arm,
			})
			return
		}
		this.deps.diagnostics.count('event.unknown_arm', {
			sessionId: String(this.sessionId),
			arm: streamEventArmLabel(event),
		})
	}

	;(SessionActor.prototype as unknown as SessionActorFold).commitL2State = function (this: SessionActorFold, next: L2SeqIndexState): void {
		this.l2State = next
		this.seqIndex = next.entries as Map<number, TimelineItemId>
	}

	;(SessionActor.prototype as unknown as SessionActorFold).feedIndex = function (this: SessionActorFold, entries: readonly L2SeqIndexEntry[]): void {
		this.commitL2State(feedL2SeqIndexState(this.l2State, entries))
	}

	;(SessionActor.prototype as unknown as SessionActorFold).pruneIndex = function (this: SessionActorFold, removedSeqs: readonly number[]): void {
		this.commitL2State(pruneL2SeqIndexState(this.l2State, removedSeqs))
	}

	;(SessionActor.prototype as unknown as SessionActorFold).clearSeqIndex = function (this: SessionActorFold, ): void {
		this.commitL2State(createL2SeqIndexState())
	}

	;(SessionActor.prototype as unknown as SessionActorFold).entriesFromSeqItemNotes = function (this: SessionActorFold, notes: readonly SeqItemNote[]): readonly L2SeqIndexEntry[] {
		return notes.map((n) => [n.seq, n.itemId] as const)
	}

	;(SessionActor.prototype as unknown as SessionActorFold).feedIndexFromTransportEvent = function (this: SessionActorFold, event: unknown, patches: readonly ViewPatch[]): void {
		if (typeof event !== 'object' || event === null) return
		const seq = (event as { readonly seq?: unknown }).seq
		if (typeof seq !== 'number') return
		this.feedIndex(seqIndexEntriesFromPatches(seq, patches))
	}

	;(SessionActor.prototype as unknown as SessionActorFold).maybeAdvanceLocalSeqCursorFromLive = function (this: SessionActorFold, event: unknown): void {
		if (typeof event !== 'object' || event === null) return
		const seq = (event as { readonly seq?: unknown }).seq
		if (typeof seq !== 'number') return
		if (!isGapDomainCount(seq)) return
		const sessionVersion = this.lastStreamHello?.sessionVersion
		if (sessionVersion === undefined) return
		if (!isGapDomainCount(sessionVersion)) return
		if (!isAdvanceSessionVersionInDomain(sessionVersion)) return
		if (this.localSeqCursor.known) {
			if (!isGapDomainCount(this.localSeqCursor.lastAppliedSeq)) return
			if (!isGapDomainCount(this.localSeqCursor.lastSessionVersion)) return
			if (!isAdvanceSessionVersionInDomain(this.localSeqCursor.lastSessionVersion)) return
		}
		const plan = planLocalSeqCursorAdvance(this.localSeqCursor, {
			seq,
			sessionVersion,
		})
		if (plan.kind !== 'advance') return
		this.localSeqCursor = plan.next
	}

	;(SessionActor.prototype as unknown as SessionActorFold).onRangeReplaced = function (this: SessionActorFold, event: RangeReplacedEvent): void {
		const plan = planRangeReplacedApply(this.seqIndex, event.body.meta, event.body.events)
		if (plan.kind === 'unresolvable') {
			this.deps.diagnostics.count('stream.range_replaced_rejected', {
				sessionId: String(this.sessionId),
				code: plan.code,
			})
			this.deps.diagnostics.warn('stream rangeReplaced unresolvable', {
				sessionId: this.sessionId,
				code: plan.code,
			})
			this.escalateRangeReplacedUnresolvable(event.body.meta)
			return
		}
		if (plan.kind === 'reject') {
			this.deps.diagnostics.count('stream.range_replaced_rejected', {
				sessionId: String(this.sessionId),
				code: plan.code,
			})
			this.deps.diagnostics.warn('stream rangeReplaced rejected', {
				sessionId: this.sessionId,
				code: plan.code,
			})
			return
		}
		this.executeRangeReplacedApply(plan, event.body.meta)
	}

	;(SessionActor.prototype as unknown as SessionActorFold).escalateRangeReplacedUnresolvable = function (this: SessionActorFold, meta: RangeReplacedEvent['body']['meta']): void {
		const sync = {
			kind: 'degraded' as const,
			reason: 'range_replaced_subtree_unresolvable',
		}
		this.snapshot = {
			...this.snapshot,
			sync,
		}
		this.foldAndBroadcastPatches([{ op: 'setSyncChrome', sync }])

		const fromSeq = meta.fromSeq
		if (
			typeof fromSeq !== 'number' ||
			!Number.isFinite(fromSeq) ||
			!Number.isInteger(fromSeq) ||
			fromSeq <= 0
		) {
			return
		}
		const fromExclusive = fromSeq - 1
		const newHeadSeq = meta.newHeadSeq
		const helloHead = this.lastStreamHello?.headSeq
		const toInclusive =
			typeof newHeadSeq === 'number' &&
			Number.isFinite(newHeadSeq) &&
			Number.isInteger(newHeadSeq) &&
			newHeadSeq >= fromExclusive
				? newHeadSeq
				: typeof helloHead === 'number' &&
						Number.isFinite(helloHead) &&
						Number.isInteger(helloHead) &&
						helloHead >= fromExclusive
					? helloHead
					: fromExclusive
		this.maybeEmitHistoryFill(fromExclusive, toInclusive)
	}

	;(SessionActor.prototype as unknown as SessionActorFold).executeRangeReplacedApply = function (this: SessionActorFold,
		plan: Extract<RangeReplacedApplyPlan, { kind: 'apply' }>,
		meta: RangeReplacedEvent['body']['meta'],
	): void {
		const foldedPatches: ViewPatch[] = []
		const pendingFeeds: Array<{
			readonly seq: number | undefined
			readonly patches: readonly ViewPatch[]
		}> = []
		for (const ev of plan.eventsToFold) {
			if (this.tryFoldL1SyncChromeStreamEvent(ev)) {
				continue
			}
			const domain = foldDomainStreamEvent(ev)
			if (domain.kind === 'patches') {
				foldedPatches.push(...domain.patches)
				pendingFeeds.push({ seq: ev.seq, patches: domain.patches })
			} else if (domain.kind === 'malformed') {
				this.deps.diagnostics.count('event.domain_malformed', {
					sessionId: String(this.sessionId),
					arm: domain.arm,
					source: 'rangeReplaced',
				})
			} else {
				this.deps.diagnostics.count('event.unknown_arm', {
					sessionId: String(this.sessionId),
					arm: ev.arm,
					source: 'rangeReplaced',
				})
			}
		}

		this.pruneIndex(plan.removedSeqs)
		for (const feed of pendingFeeds) {
			if (typeof feed.seq !== 'number') continue
			this.feedIndex(seqIndexEntriesFromPatches(feed.seq, feed.patches))
		}

		const merged =
			plan.removePatches.length === 0 && foldedPatches.length === 0
				? null
				: [...plan.removePatches, ...foldedPatches]
		if (merged !== null) {
			this.foldStreamApplyViewPatches(merged)
		}

		const newHeadSeq = meta.newHeadSeq
		if (typeof newHeadSeq !== 'number') {
			this.deps.diagnostics.count('stream.range_replaced_cursor_skip', {
				sessionId: String(this.sessionId),
				reason: 'new_head_seq_invalid',
			})
			return
		}
		const coverPlan = planLocalSeqCursorCover(this.localSeqCursor, {
			coveredThrough: newHeadSeq,
			sessionVersion: this.lastStreamHello?.sessionVersion,
		})
		if (coverPlan.kind === 'cover') {
			this.localSeqCursor = coverPlan.next
		} else {
			this.deps.diagnostics.count('stream.range_replaced_cursor_skip', {
				sessionId: String(this.sessionId),
				reason: coverPlan.reason,
			})
		}
		this.writeSyncWatermarkAfterRangeReplaced(meta.fromSeq)
	}

	;(SessionActor.prototype as unknown as SessionActorFold).onStreamHello = function (this: SessionActorFold, body: StreamHelloAnchor): void {
		const prevEpoch = this.lastRuntimeEpoch
		const advance = this.tryAdvanceLastRuntimeEpoch(body.runtimeEpoch)
		if (advance === 'rollback') {
			this.deps.diagnostics.count('stream.hello_epoch_rollback_skip', {
				sessionId: String(this.sessionId),
				anchored: String(prevEpoch),
				actual: String(body.runtimeEpoch),
			})
			this.deps.diagnostics.warn('stream hello epoch rollback skip', {
				sessionId: this.sessionId,
				anchored: prevEpoch,
				actual: body.runtimeEpoch,
			})
			return
		}
		if (advance === 'advanced' && prevEpoch !== null) {
			this.clearPendingForRuntimeEpochChange()
			// D30 INV-OVR-TR-5 backstop: overlay reclaim parallels the knife-4 clear
			// (never inside it — ADR-017 routine stays single-axis); 0× anchor write
			// (INV-OVR-TR-6), monotonic guard inherited from the strict advance.
			this.onOverlayActiveTurnClear()
		}

		this.lastStreamHello = {
			sessionVersion: body.sessionVersion,
			headSeq: body.headSeq,
			runtimeEpoch: body.runtimeEpoch,
			lastMutatedFromSeq: body.lastMutatedFromSeq,
		}
		this.deps.diagnostics.count('stream.hello', {
			sessionId: String(this.sessionId),
			headSeq: String(body.headSeq),
			sessionVersion: String(body.sessionVersion),
			runtimeEpoch: String(body.runtimeEpoch),
			lastMutatedFromSeq: String(body.lastMutatedFromSeq),
		})

		const plan = planGapFromStreamHello(
			{
				sessionVersion: body.sessionVersion,
				headSeq: body.headSeq,
				lastMutatedFromSeq: body.lastMutatedFromSeq,
			},
			this.localSeqCursor,
		)
		switch (plan.kind) {
			case 'aligned':
				this.deps.diagnostics.count('stream.hello_aligned', {
					sessionId: String(this.sessionId),
				})
				return
			case 'rewriteWindow':
				this.deps.diagnostics.count('stream.hello_rewrite_window', {
					sessionId: String(this.sessionId),
					fromSeq: String(plan.helloLastMutatedFromSeq),
				})
				this.consumeRewriteWindowFromHello(plan)
				return
			case 'bootstrapResync':
				this.deps.diagnostics.count('stream.hello_bootstrap', {
					sessionId: String(this.sessionId),
					reason: plan.reason,
				})
				if (plan.reason === 'gap_too_large') {
					this.consumeGapTooLargeBootstrap(plan)
					return
				}
				if (plan.reason === 'unknown_cursor') {
					this.maybeEmitHistoryFill(plan.fromExclusive, plan.toInclusive)
				}
				return
			case 'historyFill':
				this.maybeEmitHistoryFill(plan.fromExclusive, plan.toInclusive)
				return
			default: {
				const _exhaustive: never = plan
				void _exhaustive
			}
		}
	}

	;(SessionActor.prototype as unknown as SessionActorFold).consumeRewriteWindowFromHello = function (this: SessionActorFold,
		plan: Extract<StreamHelloGapPlan, { kind: 'rewriteWindow' }>,
	): void {
		const helloLastMutatedFromSeq = plan.helloLastMutatedFromSeq
		const dropPatches = this.dropMirrorFromSeq(plan.dropFromSeq)
		if (dropPatches.length > 0) {
			this.foldStreamApplyViewPatches(dropPatches)
		}
		if (this.localSeqCursor.known) {
			this.localSeqCursor = {
				...this.localSeqCursor,
				lastAppliedSeq: plan.fromExclusive,
			}
		}
		if (plan.toInclusive <= plan.fromExclusive) {
			this.pendingRewriteHelloLastMutatedFromSeq = null
			if (this.localSeqCursor.known) {
				this.localSeqCursor = {
					...this.localSeqCursor,
					lastMutatedFromSeq: helloLastMutatedFromSeq,
				}
			}
			return
		}
		this.pendingRewriteHelloLastMutatedFromSeq = helloLastMutatedFromSeq
		const emitted = this.maybeEmitHistoryFill(plan.fromExclusive, plan.toInclusive)
		if (!emitted) {
			this.pendingRewriteHelloLastMutatedFromSeq = null
		}
	}

	;(SessionActor.prototype as unknown as SessionActorFold).dropMirrorFromSeq = function (this: SessionActorFold, dropFromSeq: number): ViewPatch[] {
		const removedSeqs: number[] = []
		const patches: ViewPatch[] = []
		for (const [seq, itemId] of this.seqIndex.entries()) {
			if (seq >= dropFromSeq) {
				patches.push({ op: 'removeTimelineItem', itemId })
				removedSeqs.push(seq)
			}
		}
		if (removedSeqs.length > 0) {
			this.pruneIndex(removedSeqs)
		}
		return patches
	}

	;(SessionActor.prototype as unknown as SessionActorFold).writeSyncWatermarkAfterRangeReplaced = function (this: SessionActorFold, fromSeq: number): void {
		if (!this.localSeqCursor.known) return
		this.localSeqCursor = {
			...this.localSeqCursor,
			lastMutatedFromSeq: fromSeq,
		}
	}

	;(SessionActor.prototype as unknown as SessionActorFold).consumeGapTooLargeBootstrap = function (this: SessionActorFold,
		plan: Extract<StreamHelloGapPlan, { kind: 'bootstrapResync'; reason: 'gap_too_large' }>,
	): void {
		if (this.currentAttemptId === null) return

		if (this.localSeqCursor.known && plan.fromExclusive > this.localSeqCursor.lastAppliedSeq) {
			const fromExclusive = this.localSeqCursor.lastAppliedSeq
			const toExclusive = plan.fromExclusive
			// ports.ts DiagnosticMetric closed union hard-banned this slice — widen (MF-1).
			this.deps.diagnostics.count('history.prefix_hole_declared' as DiagnosticMetric, {
				sessionId: String(this.sessionId),
				from: String(fromExclusive),
				to: String(toExclusive),
			})
			const sync = {
				kind: 'degraded' as const,
				reason: 'history_prefix_hole',
			}
			this.snapshot = {
				...this.snapshot,
				sync,
			}
			const patches = [{ op: 'setSyncChrome' as const, sync }]
			for (const lease of this.leases.values()) {
				this.emitPatches(lease, patches)
			}
		}

		this.maybeEmitHistoryFill(plan.fromExclusive, plan.toInclusive)
	}

	;(SessionActor.prototype as unknown as SessionActorFold).tryAdvanceLastRuntimeEpoch = function (this: SessionActorFold, epoch: number): 'advanced' | 'same' | 'rollback' {
		const last = this.lastRuntimeEpoch
		if (last !== null && epoch < last) {
			return 'rollback'
		}
		if (last !== null && epoch === last) {
			return 'same'
		}
		this.lastRuntimeEpoch = epoch
		return 'advanced'
	}

	;(SessionActor.prototype as unknown as SessionActorFold).clearPendingForRuntimeEpochChange = function (this: SessionActorFold, ): void {
		this.pendingChatWrites.length = 0
		this.inflightCleanups.clear()
		const removes: ViewPatch[] = this.snapshot.pendingActions.map((a) => ({
			op: 'removePendingAction' as const,
			requestId: a.requestId,
		}))
		if (removes.length > 0) {
			this.foldAndBroadcastPatches(removes)
		}
		this.failAllLocalPendingSends(SEND_FAILED_EPOCH_CHANGED)
	}

	;(SessionActor.prototype as unknown as SessionActorFold).maybeEmitHistoryFill = function (this: SessionActorFold, fromExclusive: number, toInclusive: number): boolean {
		const attemptId = this.currentAttemptId
		if (attemptId === null) return false
		if (toInclusive <= fromExclusive) return false
		this.historyRequestSeq += 1
		const requestId = `hist:${this.historyRequestSeq}`
		this.pendingHistoryRequestId = requestId
		this.deps.diagnostics.count('history.fill_requested', {
			sessionId: String(this.sessionId),
			requestId,
			fromExclusive: String(fromExclusive),
			toInclusive: String(toInclusive),
		})
		this.deps.emitIntent({
			do: 'fillHistoryGap',
			attemptId,
			requestId,
			fromExclusive,
			toInclusive,
		})
		return true
	}

	;(SessionActor.prototype as unknown as SessionActorFold).onHistoryResult = function (this: SessionActorFold, requestId: string, result: unknown): void {
		if (this.pendingHistoryRequestId === null || requestId !== this.pendingHistoryRequestId) {
			// Stale/duplicate result: the real fill is still in flight — keep the
			// R5 pending rewrite watermark paired with its own requestId.
			this.deps.diagnostics.count('history.fill_failed', {
				sessionId: String(this.sessionId),
				reason: 'request_mismatch',
			})
			return
		}
		this.pendingHistoryRequestId = null

		if (!isHistoryFillResultPayload(result) || !result.ok) {
			// Failed rebuild fill discards the pending hello watermark — a later
			// hello re-plans instead of committing from an unrelated success.
			this.pendingRewriteHelloLastMutatedFromSeq = null
			this.deps.diagnostics.count('history.fill_failed', {
				sessionId: String(this.sessionId),
				reason: isHistoryFillResultPayload(result) && !result.ok ? result.code : 'malformed',
			})
			return
		}

		const sessionVersion =
			this.lastStreamHello?.sessionVersion ??
			(this.localSeqCursor.known ? this.localSeqCursor.lastSessionVersion : undefined)
		if (sessionVersion === undefined) {
			this.deps.diagnostics.count('history.fill_failed', {
				sessionId: String(this.sessionId),
				reason: 'missing_session_version',
			})
			return
		}

		const openPendingCallIds = new Set(
			this.snapshot.pendingActions
				.filter(
					(action) =>
						action.summary.kind === 'tool' &&
						action.summary.status === 'pending' &&
						action.summary.respondable === true,
				)
				.map((action) => String(action.requestId)),
		)

		const allPatches: ViewPatch[] = []
		for (const envelope of result.envelopes) {
			const folded = viewPatchesFromHistoryFillEnvelopes([envelope], openPendingCallIds)
			for (const arm of folded.malformedArms) {
				this.deps.diagnostics.count('event.domain_malformed', {
					sessionId: String(this.sessionId),
					arm,
					source: 'historyResult',
				})
			}
			for (const arm of folded.unknownArms) {
				this.deps.diagnostics.count('event.unknown_arm', {
					sessionId: String(this.sessionId),
					arm,
					source: 'historyResult',
				})
			}
			// Notes feed decoupled from patches.length (APPLY-12 consume / Grok MF-2).
			this.feedIndex(this.entriesFromSeqItemNotes(folded.seqItemNotes))
			if (folded.patches.length > 0) {
				allPatches.push(...folded.patches)
			}
		}
		if (allPatches.length > 0) {
			this.foldStreamApplyViewPatches(allPatches)
		}

		const coverPlan = planLocalSeqCursorCover(this.localSeqCursor, {
			coveredThrough: result.coveredThrough,
			sessionVersion,
		})
		if (coverPlan.kind === 'cover') {
			let next = coverPlan.next
			if (this.pendingRewriteHelloLastMutatedFromSeq !== null) {
				next = {
					...next,
					lastMutatedFromSeq: this.pendingRewriteHelloLastMutatedFromSeq,
				}
				this.pendingRewriteHelloLastMutatedFromSeq = null
			} else if (!this.localSeqCursor.known) {
				next = {
					...next,
					lastMutatedFromSeq: this.lastStreamHello?.lastMutatedFromSeq ?? 0,
				}
			} else {
				next = {
					...next,
					lastMutatedFromSeq: this.localSeqCursor.lastMutatedFromSeq,
				}
			}
			this.localSeqCursor = next
		} else {
			this.pendingRewriteHelloLastMutatedFromSeq = null
			this.deps.diagnostics.count('history.fill_cursor_skip', {
				sessionId: String(this.sessionId),
				reason: coverPlan.reason,
			})
		}
		this.deps.diagnostics.count('history.fill_ok', {
			sessionId: String(this.sessionId),
			coveredThrough: String(result.coveredThrough),
			pagesFetched: String(result.pagesFetched),
		})
	}

	;(SessionActor.prototype as unknown as SessionActorFold).clearStreamHelloAnchor = function (this: SessionActorFold, ): void {
		this.lastStreamHello = null
		this.pendingHistoryRequestId = null
		this.pendingRewriteHelloLastMutatedFromSeq = null
		this.clearSeqIndex()
	}

	;(SessionActor.prototype as unknown as SessionActorFold).onStreamClosed = function (this: SessionActorFold, cause: StreamCloseCause): void {
		const attemptId = this.currentAttemptId
		if (attemptId === null) return

		this.currentAttemptId = null
		this.clearStreamHelloAnchor()
		this.deps.emitIntent({ do: 'closeStream', attemptId })

		const reason =
			cause.kind === 'error' ? (cause.message.trim() !== '' ? cause.message : 'error') : cause.kind
		const sync = { kind: 'closed' as const, reason }
		this.snapshot = { ...this.snapshot, sync }

		const patches = [{ op: 'setSyncChrome' as const, sync }]
		for (const lease of this.leases.values()) {
			this.emitPatches(lease, patches)
		}
		// D30 INV-OVR-TR-1/2: terminal reclaim reuses the single removal path.
		this.onOverlayActiveTurnClear()
	}

	;(SessionActor.prototype as unknown as SessionActorFold).foldAndBroadcastPatches = function (this: SessionActorFold, patches: readonly ViewPatch[]): void {
		const admitted = admitPendingActionUpserts(this.snapshot.pendingActions, patches)
		for (const skip of admitted.skipped) {
			this.deps.diagnostics.warn('pendingActions at capacity', {
				sessionId: this.sessionId,
				code: skip.code,
				requestId: skip.action.requestId,
			})
		}
		const next = admitted.patches
		if (next.length === 0) return
		this.snapshot = applyViewPatches(this.snapshot, next)
		for (const lease of this.leases.values()) {
			this.emitPatches(lease, next)
		}
	}
}
