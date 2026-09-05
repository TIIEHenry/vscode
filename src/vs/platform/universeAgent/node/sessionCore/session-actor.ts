/**
 * Per-session serial Actor: single FIFO mailbox, sync drain, no re-entry (ADR-009 §2).
 * Side effects are intents only; host runner executes them.
 */

import type { CoreIntent } from './intents.js'
import {
	isApplyViewPatchesFact,
	isApplyViewPatchesStreamEvent,
	isChatLifecycleLocalFact,
	isChatStreamDownFact,
	isChatStreamUpFact,
	isHistoryFillResultPayload,
	isOverlayActiveTurnArm,
	isOverlayActiveTurnClearArm,
	isOverlayActiveTurnClearEvent,
	isOverlayActiveTurnEvent,
	isOverlayPendingSnapshotArm,
	isOverlayPendingSnapshotEvent,
	isSeedSeqCursorFact,
	isStreamHelloArm,
	isStreamHelloEvent,
	isClientToolRespondFact,
	isInputDeliveryFact,
	isPermissionRespondFact,
	isQuestionAskedFact,
	isQuestionRespondFact,
	isTurnInterruptedFact,
	isContinueGenerationFact,
	isRangeReplacedArm,
	isRangeReplacedEvent,
	isRootAgentBoundFact,
	isAgentStatusBoundFact,
	isTeamIdBoundFact,
	isBranchTopologyNotifiedFact,
	isAgentTreeBoundFact,
	isAgentSnapshotsBoundFact,
	isSubmitInputFact,
	isRegenerateTurnFact,
	isCommandOutcomeFact,
	streamEventArmLabel,
	type AgentTreeNodeBound,
	type NormalizedLocalFact,
	type SessionSnapshotInfoBound,
	type OverlayActiveTurnBody,
	type OverlayPendingSnapshotBody,
	type RangeReplacedEvent,
	type StreamHelloAnchor,
} from './local-fact.js'
import { BoundedMailbox } from './mailbox.js'
import type {
	ConnectionDownReason,
	CoreMessage,
	CorrelationRef,
	StreamCloseCause,
	ViewFrameSink,
} from './messages.js'
import type {
	AttemptId,
	ChatWriteId,
	DiagnosticMetric,
	DiagnosticsPort,
	IdPort,
	TimerId,
} from './ports.js'
import { HOST_WRITE_RECEIPT_SOURCE, readHostWriteReceiptMarkers } from './host-write-receipt.js'
import {
	planGapFromStreamHello,
	type LocalSeqCursor,
	type StreamHelloGapPlan,
} from './stream-hello-gap.js'
import {
	decideLocalPendingUpsert,
	operationIdsToSupersedeFromViewPatches,
	patchesForLocalPendingSupersede,
	patchesForLocalPendingSupersedeAll,
	pendingSendViewFromSubmit,
} from './local-pending-sends.js'
import {
	admitPendingActionUpserts,
	OVERLAY_PENDING_SET_REPLACE_AT_CAPACITY,
	planOverlayPendingSetReplace,
} from './pending-actions-bound.js'

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
import {
	admitTimelineItemTurnId,
	applyViewPatches,
	isSessionClosedArm,
	isSessionClosedStreamEvent,
	isSessionPurgedArm,
	isSessionPurgedStreamEvent,
	isAgentTimeoutArm,
	isAgentTimeoutStreamEvent,
	isSessionVisibilityChangedArm,
	isSessionVisibilityChangedStreamEvent,
	isSubscriptionHealthArm,
	isSubscriptionHealthStreamEvent,
	syncChromeFromSessionClosedBody,
	syncChromeFromSessionPurgedBody,
	syncChromeFromSubscriptionHealthBody,
} from '../../common/sessionView/apply.js'
import { emptySessionViewSnapshot } from '../../common/sessionView/empty-snapshot.js'
import { timelineItemFromClientToolRespond } from '../../common/sessionView/client-tool-call.js'
import type { PendingChatWrite } from './session-actor-chat-outbox.js'
import { FLUSH_TIMEOUT_TIMER_PREFIX, SEND_FAILED_FLUSH_TIMEOUT } from './session-actor-chat-outbox.js'
import { timelineItemFromQuestionAsk } from '../../common/sessionView/question-ask.js'
import type {
	ClientActionRequestId,
	OperationId,
	OverlayBlockId,
	PendingActionView,
	SessionId,
	SessionViewSnapshot,
	SyncChrome,
	TextChunkId,
	TimelineItemId,
	TimelineItemView,
	ViewEffect,
	ViewLeaseId,
	ViewPatch,
} from '../../common/sessionView/types.js'

export type SessionActorDeps = {
	readonly sessionId: SessionId
	readonly ids: IdPort
	readonly diagnostics: DiagnosticsPort
	readonly mailboxCapacity: number
	readonly lingerMs: number
	/** ADR-012 §4.1: queued submit-family rows fail explicitly after this delay. */
	readonly chatFlushTimeoutMs: number
	readonly emitIntent: (intent: CoreIntent) => void
}

type LeaseRecord = {
	readonly leaseId: ViewLeaseId
	sink: ViewFrameSink
	generation: number
	frameId: number
	version: number
}

/**
 * Wave-10 Slice-C: two-tier ConnectionDownReason → sync.closed.reason.
 * `host` stays `connection_down` until a later third-tier slice.
 */
export function syncReasonFromConnectionDown(reason: ConnectionDownReason): string {
	switch (reason.kind) {
		case 'unauthenticated':
			return 'unauthenticated'
		case 'transport':
		case 'host':
			return 'connection_down'
	}
}

function cleanupPatchesTargetIds(
	patches: readonly ViewPatch[] | undefined,
	ids: ReadonlySet<string>,
): boolean {
	if (patches === undefined || patches.length === 0) return false
	return patches.some((p) => p.op === 'removePendingAction' && ids.has(String(p.requestId)))
}

import type { SessionActorFold } from './session-actor-fold-interface.js'

export interface SessionActor extends SessionActorFold {}

export class SessionActor {
	readonly sessionId: SessionId
	readonly mailbox: BoundedMailbox<CoreMessage>
	readonly deps: SessionActorDeps
	draining = false

	connectionUp = false
	currentAttemptId: AttemptId | null = null
	lingerTimerId: TimerId | null = null
	/**
	 * ADR-012 §4.1: armed flush-timeout timers for queued submit-family rows,
	 * keyed by operationId. Membership IS idempotency: an entry exists exactly
	 * while its row is optimistically pending AND not yet written; every removal
	 * path cancels through the same choke, and a late fire finds no entry (and no
	 * row) → zero side effects.
	 */
	readonly flushTimeoutTimers = new Map<string, TimerId>()
	/**
	 * Set on mailbox overflow; cleared at end of next connectionUp (fail-closed).
	 * Open decision on that Up consults the pre-clear latch (Wave-10 Slice-A).
	 */
	subscriptionFailed = false
	/**
	 * Set on admitted L1 sessionClosed / sessionPurged; blocks subscriptionHealth
	 * from re-opening live alone.
	 */
	l1SessionClosed = false
	readonly leases = new Map<ViewLeaseId, LeaseRecord>()
	/** Authoritative materialised view for baselines (no L1–L4 fold yet). */
	snapshot: SessionViewSnapshot

	/**
	 * Chat bidi generation (ADR-012 §3) — same AttemptId type as subscription,
	 * never mixed with `currentAttemptId`.
	 */
	currentChatAttemptId: AttemptId | null = null
	/** True only after matching `localFact{chatStreamUp}` (write gate). */
	chatStreamReady = false
	readonly pendingChatWrites: PendingChatWrite[] = []
	/**
	 * In-flight L4 cleanup ledger keyed by opaque writeId (ADR-017 Amendment 1).
	 * Registered at chatStreamWrite emit; applied only on host-write-accepted.
	 */
	readonly inflightCleanups = new Map<string, readonly ViewPatch[]>()

	/**
	 * Last folded StreamHello anchor (demux `arm:'hello'`). Actor-internal only —
	 * never pushed to ViewPatch. Cleared on new attempt / connection loss.
	 */
	lastStreamHello: StreamHelloAnchor | null = null
	/**
	 * Last observed runtimeEpoch (ADR-017 knife 4 / Am.4b). Survives clearStreamHelloAnchor /
	 * connectionDown / openAttempt — do not derive epoch clears from lastStreamHello.
	 * Sole write site: tryAdvanceLastRuntimeEpoch (monotonic; never rolls back).
	 */
	lastRuntimeEpoch: number | null = null

	/** In-flight L3 activeTurn overlay blockId (blockId ≡ turnId); never invented. */
	overlayActiveTurnBlockId: OverlayBlockId | null = null
	/**
	 * Local seq cursor for Hello gap plan (INV-HF-1). Survives attempt reset;
	 * seed via `seedSeqCursor`; contiguous live advances only via
	 * planLocalSeqCursorAdvance (INV-LSC-WIRE-1). Cover-set writes only via
	 * planLocalSeqCursorCover (INV-LSC-WIRE-2 history + INV-LSC-COVER-1 range).
	 */
	localSeqCursor: LocalSeqCursor = { known: false }
	/** In-flight HistoryFill request id; cleared on result or attempt clear. */
	pendingHistoryRequestId: string | null = null
	/**
	 * R5: hello lastMutatedFromSeq to commit after rewriteWindow rebuild succeeds.
	 * Cleared on failed fill or attempt reset. Never written before rebuild completes.
	 */
	pendingRewriteHelloLastMutatedFromSeq: number | null = null
	historyRequestSeq = 0
	/**
	 * ADR-019 private L2 seq→timeline index (INV-SSR-APPLY-4/12/15).
	 * Never pushed to ViewPatch / snapshot. Cleared with stream hello anchor.
	 * Sole mutation: commitSeqIndex ← feed/prune/clear (l2-seq-index algebra).
	 */
	seqIndex = new Map<number, TimelineItemId>()
	/**
	 * ADR-019 INV-SSR-APPLY-15 watermark: monotonic eviction floor mirror.
	 * Mirrors seqIndex entries via L2SeqIndexState algebra; never pushed to view.
	 * Sole mutation: commitL2State ← feed/prune/clear (state algebra).
	 */
	l2State: L2SeqIndexState = createL2SeqIndexState()

	/**
	 * Live session root agent for submitInput Chat write (ADR-021).
	 * Set by `rootAgentBound` localFact from create/resume/info projection.
	 */
	liveRootAgentId: string | null = null

	/**
	 * Latest FetchAgentStatus fold (agent id + status label only).
	 * Set by `agentStatusBound` localFact; projected via `setLiveAgentStatus`.
	 */
	liveAgentStatusBound: { readonly agentId: string; readonly status: string } | null = null

	/**
	 * Live team id from session/team projection.
	 * Set by `teamIdBound` localFact; projected via `setLiveTeamId`.
	 */
	liveTeamIdBound: number | null = null

	/**
	 * Latest FetchAgentTree fold (root AgentInfo tree only).
	 * Set by `agentTreeBound` localFact; projected via `setLiveAgentTree`.
	 */
	liveAgentTreeBound: AgentTreeNodeBound | null = null

	/**
	 * Latest FetchAgentSnapshots fold (bounded ListSnapshots rows only).
	 * Set by `agentSnapshotsBound` localFact; projected via `setLiveAgentSnapshots`.
	 */
	liveAgentSnapshotsBound: readonly SessionSnapshotInfoBound[] | null = null

	/**
	 * ADR-029: in-flight regenerateTurn — edit outcome pending before submit write.
	 * Cleared on commandOutcome (success or fail) after stage B or abort.
	 */
	pendingRegenerateTurn: {
		readonly correlation: CorrelationRef
		readonly preservedContent: string
		readonly agentId?: string
	} | null = null


	get leaseCount(): number {
		return this.leases.size
	}

	get attemptId(): AttemptId | null {
		return this.currentAttemptId
	}

	get chatAttemptId(): AttemptId | null {
		return this.currentChatAttemptId
	}

	/** Live root agent id when create/resume/info projection bound attribution (ADR-021). */
	getLiveRootAgentId(): string | null {
		return this.resolveLiveRootAgentId()
	}

	/** True when create/resume/info projection bound a live root agent for submitInput. */
	get hasLiveRootAgentId(): boolean {
		return this.resolveLiveRootAgentId() !== null
	}

	/** Bound agent status from FetchAgentStatus fold; null when absent. */
	getLiveAgentStatusBound(): { readonly agentId: string; readonly status: string } | null {
		return this.liveAgentStatusBound
	}

	/** True when FetchAgentStatus fold stored agent id + status. */
	get hasLiveAgentStatusBound(): boolean {
		return this.liveAgentStatusBound !== null
	}

	/** Bound team id from teamIdBound fold; null when absent. */
	getLiveTeamIdBound(): number | null {
		return this.liveTeamIdBound
	}

	/** True when teamIdBound fold stored a live team id. */
	get hasLiveTeamIdBound(): boolean {
		return this.liveTeamIdBound !== null
	}

	/** Bound agent tree from FetchAgentTree fold; null when absent. */
	getLiveAgentTreeBound(): AgentTreeNodeBound | null {
		return this.liveAgentTreeBound
	}

	/** True when FetchAgentTree fold stored admitted root tree. */
	get hasLiveAgentTreeBound(): boolean {
		return this.liveAgentTreeBound !== null
	}

	/** Bound snapshot list from FetchAgentSnapshots fold; null when absent. */
	getLiveAgentSnapshotsBound(): readonly SessionSnapshotInfoBound[] | null {
		return this.liveAgentSnapshotsBound
	}

	/** True when FetchAgentSnapshots fold stored admitted snapshot list. */
	get hasLiveAgentSnapshotsBound(): boolean {
		return this.liveAgentSnapshotsBound !== null
	}

	/** ADR-029 INV-RG-CONT-2: regenerate edit pending or submit not yet written. */
	get hasInFlightRegenerateTurn(): boolean {
		return this.pendingRegenerateTurn !== null
	}

	get isConnectionUp(): boolean {
		return this.connectionUp
	}

	get isChatStreamReady(): boolean {
		return this.chatStreamReady
	}

	/** Last StreamHello fold (head_seq / version / epoch); null before first hello. */
	get streamHelloAnchor(): StreamHelloAnchor | null {
		return this.lastStreamHello
	}

	/** Local seq cursor used for Hello gap planning (test/host observable). */
	get seqCursor(): LocalSeqCursor {
		return this.localSeqCursor
	}

	constructor(deps: SessionActorDeps) {
		this.deps = deps
		this.sessionId = deps.sessionId
		this.mailbox = new BoundedMailbox(deps.mailboxCapacity)
		this.snapshot = emptySessionViewSnapshot(deps.sessionId)
	}

	requiresAuth(msg: CoreMessage): boolean {
		switch (msg.t) {
			case 'connectionUp':
			case 'connectionDown':
			case 'timerFired':
			case 'acquireLease':
			case 'releaseLease':
			case 'frameAck':
			case 'requestResync':
				return false
			case 'localFact':
				return !isChatLifecycleLocalFact(msg.fact)
			default:
				return true
		}
	}

	enqueue(msg: CoreMessage): boolean {
		if (!this.mailbox.offer(msg)) {
			this.deps.diagnostics.count('mailbox.overflow', {
				sessionId: String(this.sessionId),
			})
			this.failClosedOverflow()
			return false
		}
		this.drain()
		return true
	}

	drain(): void {
		if (this.draining) {
			// Re-entrant post during handle is a host bug; refuse to interleave.
			this.deps.diagnostics.warn('session-actor re-entrant drain ignored', {
				sessionId: this.sessionId,
			})
			return
		}
		this.draining = true
		try {
			for (;;) {
				const msg = this.mailbox.poll()
				if (msg === undefined) break
				this.handle(msg)
			}
		} finally {
			this.draining = false
		}
	}

	handle(msg: CoreMessage): void {
		switch (msg.t) {
			case 'connectionUp':
				this.onConnectionUp(msg.connectionGeneration)
				return
			case 'connectionDown':
				this.onConnectionDown(msg.reason)
				return
			case 'timerFired':
				this.onTimerFired(msg.timerId)
				return
			case 'streamEvent':
				if (this.rejectIfStaleAttempt(msg.attemptId)) return
;        (this as unknown as SessionActorFold).onStreamEvent(msg.event)
				return
			case 'streamClosed':
				if (this.rejectIfStaleAttempt(msg.attemptId)) return
;        (this as unknown as SessionActorFold).onStreamClosed(msg.cause)
				return
			case 'historyResult':
				if (this.rejectIfStaleAttempt(msg.attemptId)) return
;        (this as unknown as SessionActorFold).onHistoryResult(msg.requestId, msg.result)
				return
			case 'acquireLease':
				this.onAcquireLease(msg.leaseId, msg.sink)
				return
			case 'releaseLease':
				this.onReleaseLease(msg.leaseId)
				return
			case 'frameAck': {
				const lease = this.leases.get(msg.leaseId)
				if (!lease) return
				lease.sink.acknowledge({
					generation: msg.generation,
					frameId: msg.frameId,
					appliedVersion: msg.appliedVersion,
					effectIds: msg.effectIds,
				})
				return
			}
			case 'requestResync':
				this.onRequestResync(msg.leaseId)
				return
			case 'localFact':
;        (this as unknown as SessionActorFold).onLocalFact(msg.fact)
				return
			default: {
				const _exhaustive: never = msg
				this.deps.diagnostics.count('event.unknown_arm')
				void _exhaustive
			}
		}
	}

	onConnectionUp(connectionGeneration: number): void {
		this.connectionUp = true
		const allowOpen = !this.subscriptionFailed
		this.snapshot = {
			...this.snapshot,
			sync: { kind: 'live' },
		}
		const sync = { kind: 'live' as const }
		const patches = [{ op: 'setSyncChrome' as const, sync }]
		for (const lease of this.leases.values()) {
			this.emitPatches(lease, patches)
		}
		if (this.leases.size > 0 && this.currentAttemptId === null && allowOpen) {
			this.openAttempt()
		}
;    (this as unknown as SessionActorFold).ensureChatStreamIfNeeded()
		this.subscriptionFailed = false
	}

	onConnectionDown(reason: ConnectionDownReason): void {
		this.connectionUp = false
;    (this as unknown as SessionActorFold).clearStreamHelloAnchor()
		if (this.currentAttemptId !== null) {
			this.deps.emitIntent({ do: 'closeStream', attemptId: this.currentAttemptId })
			this.currentAttemptId = null
		}
;    (this as unknown as SessionActorFold).closeChatStream('connection_down')
		const sync = {
			kind: 'closed' as const,
			reason: syncReasonFromConnectionDown(reason),
		}
		this.snapshot = { ...this.snapshot, sync }
		const patches = [{ op: 'setSyncChrome' as const, sync }]
		for (const lease of this.leases.values()) {
			this.emitPatches(lease, patches)
		}
		this.cancelLinger()
		// D30 INV-OVR-TR-1/2: terminal reclaim reuses the single removal path.
;    (this as unknown as SessionActorFold).onOverlayActiveTurnClear()
	}

	onTimerFired(timerId: TimerId): void {
		if (this.lingerTimerId !== null && timerId === this.lingerTimerId) {
			this.lingerTimerId = null
			if (this.leases.size === 0) {
				if (this.currentAttemptId !== null) {
					this.deps.emitIntent({ do: 'closeStream', attemptId: this.currentAttemptId })
					this.currentAttemptId = null
				}
;        (this as unknown as SessionActorFold).closeChatStream('linger_expired')
			}
			return
		}
		this.onFlushTimeoutFired(timerId)
	}

	onFlushTimeoutFired(timerId: TimerId): void {
		for (const [operationId, armed] of this.flushTimeoutTimers) {
			if (armed !== timerId) continue
			this.flushTimeoutTimers.delete(operationId)
			const present = this.snapshot.localPendingSends.some(
				(s) => String(s.operationId) === operationId,
			)
			if (present) {
;        (this as unknown as SessionActorFold).failLocalPendingSendByOperationId(operationId, SEND_FAILED_FLUSH_TIMEOUT)
			}
			return
		}
	}

	onAcquireLease(leaseId: ViewLeaseId, sink: ViewFrameSink): void {
		this.cancelLinger()

		const existing = this.leases.get(leaseId)
		if (existing) {
			// Idempotent acquire: keep lease, refresh sink, re-baseline.
			existing.sink = sink
			this.emitBaseline(existing)
			return
		}

		const record: LeaseRecord = {
			leaseId,
			sink,
			generation: 0,
			frameId: 0,
			version: 0,
		}
		this.leases.set(leaseId, record)
		// Atomic attach: register → baseline as first frame (INV-SPC-12).
		this.emitBaseline(record)

		if (this.connectionUp && this.currentAttemptId === null && !this.subscriptionFailed) {
			this.openAttempt()
		}
;    (this as unknown as SessionActorFold).ensureChatStreamIfNeeded()
	}

	onReleaseLease(leaseId: ViewLeaseId): void {
		if (!this.leases.has(leaseId)) {
			return
		}
		this.leases.delete(leaseId)
		if (this.leases.size === 0) {
			this.startLinger()
		}
	}

	onRequestResync(leaseId: ViewLeaseId): void {
		const lease = this.leases.get(leaseId)
		if (!lease) return
		this.deps.diagnostics.count('view.resync', { leaseId: String(leaseId) })
		this.emitBaseline(lease)
	}

	openAttempt(): void {
		if (this.subscriptionFailed) return
;    (this as unknown as SessionActorFold).clearStreamHelloAnchor()
		const attemptId = this.deps.ids.nextAttemptId()
		this.currentAttemptId = attemptId
		this.deps.emitIntent({ do: 'openStream', attemptId })
	}

	rejectIfStaleAttempt(attemptId: AttemptId): boolean {
		if (this.currentAttemptId === null || attemptId !== this.currentAttemptId) {
			this.deps.diagnostics.count('attempt.stale_callback', {
				sessionId: String(this.sessionId),
			})
			return true
		}
		return false
	}

	failClosedOverflow(): void {
		this.subscriptionFailed = true
;    (this as unknown as SessionActorFold).clearStreamHelloAnchor()
		if (this.currentAttemptId !== null) {
			this.deps.emitIntent({ do: 'closeStream', attemptId: this.currentAttemptId })
			this.currentAttemptId = null
		}
;    (this as unknown as SessionActorFold).closeChatStream('mailbox_overflow')
		this.mailbox.clear()
		const sync = { kind: 'degraded' as const, reason: 'mailbox_overflow' }
		this.snapshot = {
			...this.snapshot,
			sync,
		}
		// INV-FCO-1: snapshot.sync and ∀lease chrome same lock (Wave-7-C dual).
		// May run nested under sink.enqueue during drain; only sink.enqueue — no post/drain.
		const patches = [{ op: 'setSyncChrome' as const, sync }]
		for (const lease of this.leases.values()) {
			this.emitPatches(lease, patches)
		}
		// D30 INV-OVR-TR-1/2: terminal reclaim reuses the single removal path
		// (sink.enqueue only, same nested-drain lock as the chrome broadcast above).
;    (this as unknown as SessionActorFold).onOverlayActiveTurnClear()
	}

	startLinger(): void {
		if (this.lingerTimerId !== null) return
		const timerId = `linger:${this.sessionId}` as TimerId
		this.lingerTimerId = timerId
		this.deps.emitIntent({
			do: 'startTimer',
			timerId,
			delayMs: this.deps.lingerMs,
		})
	}

	cancelLinger(): void {
		if (this.lingerTimerId === null) return
		const timerId = this.lingerTimerId
		this.lingerTimerId = null
		this.deps.emitIntent({ do: 'cancelTimer', timerId })
	}

	armFlushTimeout(operationId: string): void {
		const timerId =
			`${FLUSH_TIMEOUT_TIMER_PREFIX}${String(this.sessionId)}:${operationId}` as TimerId
		this.flushTimeoutTimers.set(operationId, timerId)
		this.deps.emitIntent({
			do: 'startTimer',
			timerId,
			delayMs: this.deps.chatFlushTimeoutMs,
		})
	}


	cancelFlushTimeout(operationId: string): void {
		const timerId = this.flushTimeoutTimers.get(operationId)
		if (timerId === undefined) return
		this.flushTimeoutTimers.delete(operationId)
		this.deps.emitIntent({ do: 'cancelTimer', timerId })
	}

	emitBaseline(lease: LeaseRecord): void {
		lease.generation += 1
		lease.frameId = 1
		lease.version += 1
		lease.sink.enqueue({
			leaseId: lease.leaseId,
			generation: lease.generation,
			frameId: lease.frameId,
			version: lease.version,
			body: { kind: 'baseline', snapshot: this.snapshot },
		})
	}

	emitPatches(lease: LeaseRecord, patches: readonly ViewPatch[]): void {
		lease.frameId += 1
		lease.version += 1
		lease.sink.enqueue({
			leaseId: lease.leaseId,
			generation: lease.generation,
			frameId: lease.frameId,
			version: lease.version,
			body: { kind: 'patches', patches },
		})
	}
}

import { installSessionActorChatOutbox } from './session-actor-chat-outbox.js'
import { installSessionActorLocalFact } from './session-actor-local-fact.js'
import { installSessionActorStreamFold } from './session-actor-stream-fold.js'
import { installSessionActorOverlayFold } from './session-actor-overlay-fold.js'

installSessionActorChatOutbox()
installSessionActorLocalFact()
installSessionActorStreamFold()
installSessionActorOverlayFold()
