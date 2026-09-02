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

/** Actor-side write gate before chatStreamUp (host outbox is separate). */
const PENDING_CHAT_WRITE_CAP = 64

/**
 * ADR-012 §6.3 one-shot send-failure effect (显式文案码; non silent success).
 * `message` carries the stable copy code, never free-form user content.
 */
const SEND_FAILED_EFFECT_KIND = 'send_failed' as const
const SEND_FAILED_OUTBOX_OVERFLOW = 'chat_send_outbox_overflow' as const
const SEND_FAILED_HOST_WRITE = 'chat_send_write_failed' as const
const SEND_FAILED_STREAM_CLOSED = 'chat_send_stream_closed' as const
const SEND_FAILED_EPOCH_CHANGED = 'chat_send_epoch_changed' as const
const SEND_FAILED_FLUSH_TIMEOUT = 'chat_send_flush_timeout' as const

/**
 * ADR-012 §4.1 flush-timeout timer id prefix. The session id is embedded raw
 * (same discipline as `linger:`) so the composition root can route `timerFired`
 * back to the owning session; the actor maps timer ids to operationIds via its
 * own membership table (no string parsing in core).
 */
const FLUSH_TIMEOUT_TIMER_PREFIX = 'chat-flush:'

const RESPOND_AGENT_ID_MAX = 128

const RESPOND_AGENT_ID_STRINGIFY_GARBAGE = new Set(['undefined', 'null', '[object Object]', 'NaN'])

/** INV-SC-CTRL-1: no-control-regex — C0/DEL via charCode instead of /[\u0000-\u001f\u007f]/ regex. */
function hasControlChar(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i)
		if (code <= 0x1f || code === 0x7f) return true
	}
	return false
}

/** ADR-021: reject-only; align admitReflexAckAgentId — never trim / sanitize. */
function admitRespondAgentId(value: unknown): value is string {
	if (typeof value !== 'string') return false
	if (value.length === 0 || value.length > RESPOND_AGENT_ID_MAX) return false
	if (value !== value.trim()) return false
	if (hasControlChar(value)) return false
	return !RESPOND_AGENT_ID_STRINGIFY_GARBAGE.has(value)
}

/**
 * INV-LCC-GATE-1: cursor count domain fail-closed (Number.isSafeInteger ∧ ≥0).
 * File-private; MUST NOT be exported or shared across modules.
 * MUST NOT merge with isAdvanceSessionVersionInDomain (≥1) or isL2SeqIndexable (>0).
 * MUST NOT clamp / trunc. Helper MUST NOT use ??.
 */
function isGapDomainCount(value: number): boolean {
	return Number.isSafeInteger(value) && value >= 0
}

/**
 * INV-LCC-GATE-1 / INV-LSC-ADV-SV-1: live-arm observed sessionVersion domain.
 * Number.isSafeInteger ∧ ≥1. File-private; MUST NOT be exported or shared.
 * MUST NOT merge with isGapDomainCount. MUST NOT clamp / trunc. Helper MUST NOT use ??.
 */
function isAdvanceSessionVersionInDomain(value: number): boolean {
	return Number.isSafeInteger(value) && value >= 1
}

/**
 * Actor-side Chat write entry (ADR-012 outbox + ADR-017 Amendment 1).
 * `cleanupPatches` register on emit; apply only on host-write-accepted receipt.
 */
type PendingChatWrite = {
	readonly writeId: ChatWriteId
	readonly correlation: CorrelationRef
	readonly payload: unknown
	/** L4 Respond close patches; omitted for submitInput / non-interactive writes. */
	readonly cleanupPatches?: readonly ViewPatch[]
}

/** Disposition of enqueueOrWriteChat (ADR-017 INV-PCA-6). `queued` must not clear rows. */
type ChatWriteDisposition = 'written' | 'queued' | 'dropped'

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

export class SessionActor {
	readonly sessionId: SessionId
	private readonly mailbox: BoundedMailbox<CoreMessage>
	private readonly deps: SessionActorDeps
	private draining = false

	private connectionUp = false
	private currentAttemptId: AttemptId | null = null
	private lingerTimerId: TimerId | null = null
	/**
	 * ADR-012 §4.1: armed flush-timeout timers for queued submit-family rows,
	 * keyed by operationId. Membership IS idempotency: an entry exists exactly
	 * while its row is optimistically pending AND not yet written; every removal
	 * path cancels through the same choke, and a late fire finds no entry (and no
	 * row) → zero side effects.
	 */
	private readonly flushTimeoutTimers = new Map<string, TimerId>()
	/**
	 * Set on mailbox overflow; cleared at end of next connectionUp (fail-closed).
	 * Open decision on that Up consults the pre-clear latch (Wave-10 Slice-A).
	 */
	private subscriptionFailed = false
	/**
	 * Set on admitted L1 sessionClosed / sessionPurged; blocks subscriptionHealth
	 * from re-opening live alone.
	 */
	private l1SessionClosed = false
	private readonly leases = new Map<ViewLeaseId, LeaseRecord>()
	/** Authoritative materialised view for baselines (no L1–L4 fold yet). */
	private snapshot: SessionViewSnapshot

	/**
	 * Chat bidi generation (ADR-012 §3) — same AttemptId type as subscription,
	 * never mixed with `currentAttemptId`.
	 */
	private currentChatAttemptId: AttemptId | null = null
	/** True only after matching `localFact{chatStreamUp}` (write gate). */
	private chatStreamReady = false
	private readonly pendingChatWrites: PendingChatWrite[] = []
	/**
	 * In-flight L4 cleanup ledger keyed by opaque writeId (ADR-017 Amendment 1).
	 * Registered at chatStreamWrite emit; applied only on host-write-accepted.
	 */
	private readonly inflightCleanups = new Map<string, readonly ViewPatch[]>()

	/**
	 * Last folded StreamHello anchor (demux `arm:'hello'`). Actor-internal only —
	 * never pushed to ViewPatch. Cleared on new attempt / connection loss.
	 */
	private lastStreamHello: StreamHelloAnchor | null = null
	/**
	 * Last observed runtimeEpoch (ADR-017 knife 4 / Am.4b). Survives clearStreamHelloAnchor /
	 * connectionDown / openAttempt — do not derive epoch clears from lastStreamHello.
	 * Sole write site: tryAdvanceLastRuntimeEpoch (monotonic; never rolls back).
	 */
	private lastRuntimeEpoch: number | null = null

	/** In-flight L3 activeTurn overlay blockId (blockId ≡ turnId); never invented. */
	private overlayActiveTurnBlockId: OverlayBlockId | null = null
	/**
	 * Local seq cursor for Hello gap plan (INV-HF-1). Survives attempt reset;
	 * seed via `seedSeqCursor`; contiguous live advances only via
	 * planLocalSeqCursorAdvance (INV-LSC-WIRE-1). Cover-set writes only via
	 * planLocalSeqCursorCover (INV-LSC-WIRE-2 history + INV-LSC-COVER-1 range).
	 */
	private localSeqCursor: LocalSeqCursor = { known: false }
	/** In-flight HistoryFill request id; cleared on result or attempt clear. */
	private pendingHistoryRequestId: string | null = null
	/**
	 * R5: hello lastMutatedFromSeq to commit after rewriteWindow rebuild succeeds.
	 * Cleared on failed fill or attempt reset. Never written before rebuild completes.
	 */
	private pendingRewriteHelloLastMutatedFromSeq: number | null = null
	private historyRequestSeq = 0
	/**
	 * ADR-019 private L2 seq→timeline index (INV-SSR-APPLY-4/12/15).
	 * Never pushed to ViewPatch / snapshot. Cleared with stream hello anchor.
	 * Sole mutation: commitSeqIndex ← feed/prune/clear (l2-seq-index algebra).
	 */
	private seqIndex = new Map<number, TimelineItemId>()
	/**
	 * ADR-019 INV-SSR-APPLY-15 watermark: monotonic eviction floor mirror.
	 * Mirrors seqIndex entries via L2SeqIndexState algebra; never pushed to view.
	 * Sole mutation: commitL2State ← feed/prune/clear (state algebra).
	 */
	private l2State: L2SeqIndexState = createL2SeqIndexState()

	/**
	 * Live session root agent for submitInput Chat write (ADR-021).
	 * Set by `rootAgentBound` localFact from create/resume/info projection.
	 */
	private liveRootAgentId: string | null = null

	/**
	 * Latest FetchAgentStatus fold (agent id + status label only).
	 * Set by `agentStatusBound` localFact; projected via `setLiveAgentStatus`.
	 */
	private liveAgentStatusBound: { readonly agentId: string; readonly status: string } | null = null

	/**
	 * Live team id from session/team projection.
	 * Set by `teamIdBound` localFact; projected via `setLiveTeamId`.
	 */
	private liveTeamIdBound: number | null = null

	/**
	 * Latest FetchAgentTree fold (root AgentInfo tree only).
	 * Set by `agentTreeBound` localFact; projected via `setLiveAgentTree`.
	 */
	private liveAgentTreeBound: AgentTreeNodeBound | null = null

	/**
	 * Latest FetchAgentSnapshots fold (bounded ListSnapshots rows only).
	 * Set by `agentSnapshotsBound` localFact; projected via `setLiveAgentSnapshots`.
	 */
	private liveAgentSnapshotsBound: readonly SessionSnapshotInfoBound[] | null = null

	/**
	 * ADR-029: in-flight regenerateTurn — edit outcome pending before submit write.
	 * Cleared on commandOutcome (success or fail) after stage B or abort.
	 */
	private pendingRegenerateTurn: {
		readonly correlation: CorrelationRef
		readonly preservedContent: string
		readonly agentId?: string
	} | null = null

	constructor(deps: SessionActorDeps) {
		this.deps = deps
		this.sessionId = deps.sessionId
		this.mailbox = new BoundedMailbox(deps.mailboxCapacity)
		this.snapshot = emptySessionViewSnapshot(deps.sessionId)
	}

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

	/**
	 * Ingress that needs a live connection. Lease/timer/connection messages
	 * always enqueue so replicas can attach while the subscription waits on
	 * `connectionUp` (ADR-009 §2). Chat lifecycle localFacts are auth-exempt so
	 * the coordinator can report up/down during teardown.
	 */
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

	/**
	 * Enqueue then drain synchronously. Returns false if mailbox was full
	 * (message not stored; subscription fail-closed already applied).
	 */
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

	private drain(): void {
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

	private handle(msg: CoreMessage): void {
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
				this.onStreamEvent(msg.event)
				return
			case 'streamClosed':
				if (this.rejectIfStaleAttempt(msg.attemptId)) return
				this.onStreamClosed(msg.cause)
				return
			case 'historyResult':
				if (this.rejectIfStaleAttempt(msg.attemptId)) return
				this.onHistoryResult(msg.requestId, msg.result)
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
				this.onLocalFact(msg.fact)
				return
			default: {
				const _exhaustive: never = msg
				this.deps.diagnostics.count('event.unknown_arm')
				void _exhaustive
			}
		}
	}

	/**
	 * Narrow connection-up fold (Wave-10 Slice-A): restore connection, set
	 * sync.live, push setSyncChrome(live) to live leases (dual of Wave-7-C
	 * connectionDown). If leases exist, attempt is null, and subscription is
	 * not fail-closed → openAttempt (exactly one new attempt). No SubscriptionFsm.
	 *
	 * `subscriptionFailed` is consulted **before** clear so a recovering Up
	 * after mailbox overflow does not auto-openStream; the latch is still
	 * cleared on this Up (subsequent acquireLease may open).
	 */
	private onConnectionUp(connectionGeneration: number): void {
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
		this.ensureChatStreamIfNeeded()
		this.subscriptionFailed = false
	}

	/**
	 * Narrow connection-down fold (Wave-7 Slice-C): drop connection, optional
	 * closeStream, set sync.closed, push setSyncChrome to live leases. No
	 * SubscriptionFsm; does not route through onStreamClosed.
	 *
	 * Reason mapping (Wave-10 Slice-C): `syncReasonFromConnectionDown` —
	 * transport/host → `connection_down`; unauthenticated → `unauthenticated`.
	 *
	 * Reason priority (Wave-8 Slice-B): always **overwrites** any prior
	 * `streamClosed` chrome (`remote`/`local`/error). After this fold,
	 * `connectionUp=false`, so a late `streamClosed` is rejected at post
	 * (`not_authenticated`) and never re-folds chrome.
	 */
	private onConnectionDown(reason: ConnectionDownReason): void {
		this.connectionUp = false
		this.clearStreamHelloAnchor()
		if (this.currentAttemptId !== null) {
			this.deps.emitIntent({ do: 'closeStream', attemptId: this.currentAttemptId })
			this.currentAttemptId = null
		}
		this.closeChatStream('connection_down')
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
		this.onOverlayActiveTurnClear()
	}

	private onTimerFired(timerId: TimerId): void {
		if (this.lingerTimerId !== null && timerId === this.lingerTimerId) {
			this.lingerTimerId = null
			if (this.leases.size === 0) {
				if (this.currentAttemptId !== null) {
					this.deps.emitIntent({ do: 'closeStream', attemptId: this.currentAttemptId })
					this.currentAttemptId = null
				}
				this.closeChatStream('linger_expired')
			}
			return
		}
		this.onFlushTimeoutFired(timerId)
	}

	/**
	 * ADR-012 §4 等待超时 (§4.1): a queued submit-family write that never reached
	 * the wire fails explicitly — remove its optimistic row and surface the
	 * stable `chat_send_flush_timeout` copy code. Idempotent: the timer entry is
	 * consumed first, so a late/duplicate fire with no matching row is a no-op
	 * (no patches, no effect, no cancel intent).
	 */
	private onFlushTimeoutFired(timerId: TimerId): void {
		for (const [operationId, armed] of this.flushTimeoutTimers) {
			if (armed !== timerId) continue
			this.flushTimeoutTimers.delete(operationId)
			const present = this.snapshot.localPendingSends.some(
				(s) => String(s.operationId) === operationId,
			)
			if (present) {
				this.failLocalPendingSendByOperationId(operationId, SEND_FAILED_FLUSH_TIMEOUT)
			}
			return
		}
	}

	private onAcquireLease(leaseId: ViewLeaseId, sink: ViewFrameSink): void {
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
		this.ensureChatStreamIfNeeded()
	}

	private onReleaseLease(leaseId: ViewLeaseId): void {
		if (!this.leases.has(leaseId)) {
			return
		}
		this.leases.delete(leaseId)
		if (this.leases.size === 0) {
			this.startLinger()
		}
	}

	private onRequestResync(leaseId: ViewLeaseId): void {
		const lease = this.leases.get(leaseId)
		if (!lease) return
		this.deps.diagnostics.count('view.resync', { leaseId: String(leaseId) })
		this.emitBaseline(lease)
	}

	/**
	 * Fold recognised NormalizedLocalFact kinds (ADR-012).
	 * `applyViewPatches` seeds snapshot without lease push (acquire baselines).
	 * `submitInput`: bounded localPendingSends upsert then queue/write.
	 * `permissionRespond`: L4 Chat write via enqueueOrWriteChat (no localPendingSends).
	 * `clientToolRespond` / `questionRespond` (ADR-325): unary already succeeded —
	 * immediate cleanup / optimistic-UI patches; 0× chatStreamWrite.
	 * `inputDelivery`: host-write-accepted → apply inflight cleanup; host-write
	 * failure with writeId → drop inflight keep CTA; unmarked failed/accepted →
	 * supersede localPendingSends; unmarked dispatched → diag only (L2 still owns echo).
	 * `questionAsked`: upsertPendingAction (kind:question; requestId≡questionId).
	 * `turnInterrupted`: upsertTimelineItem (kind:error; retryable≡canContinue); no Continue RPC.
	 * `continueGeneration`: emit openContinuationStream intent (ADR-028); 0× chatStreamWrite.
	 * `regenerateTurn`: stage A unaryCommand edit; stage B submit on matching commandOutcome.
	 * `commandOutcome`: regenerate stage B when correlation matches pending edit.
	 * `rootAgentBound`: retain live root agent id for submitInput attribution.
	 * `agentStatusBound`: retain FetchAgentStatus fold + `setLiveAgentStatus` view patch.
	 * `teamIdBound`: retain team id fold + `setLiveTeamId` view patch.
	 * `branchTopologyNotified`: append opaque topology notice (ADR-312); 0× timeline /
	 *   rangeReplaced / fromSeq.
	 * `agentTreeBound`: retain FetchAgentTree fold + `setLiveAgentTree` view patch.
	 * `agentSnapshotsBound`: retain FetchAgentSnapshots fold + `setLiveAgentSnapshots` patch.
	 * L4 Respond cleanup patches hang on PendingChatWrite / writeId ledger; apply
	 * only on host-write-accepted (ADR-017 Amendment 1 INV-PCA-2; queued does not clear).
	 * `engineCommand` / unknown: no-op.
	 */
	private onLocalFact(fact: unknown): void {
		if (isApplyViewPatchesFact(fact)) {
			this.snapshot = applyViewPatches(this.snapshot, fact.patches)
			return
		}
		if (isChatStreamUpFact(fact)) {
			this.onChatStreamUp(fact.chatAttemptId)
			return
		}
		if (isChatStreamDownFact(fact)) {
			this.onChatStreamDown(fact.chatAttemptId)
			return
		}
		if (isSubmitInputFact(fact)) {
			this.onSubmitInput(fact)
			return
		}
		if (isPermissionRespondFact(fact)) {
			this.onPermissionRespond(fact)
			return
		}
		if (isClientToolRespondFact(fact)) {
			this.onClientToolRespond(fact)
			return
		}
		if (isQuestionRespondFact(fact)) {
			this.onQuestionRespond(fact)
			return
		}
		if (isInputDeliveryFact(fact)) {
			this.onInputDelivery(fact)
			return
		}
		if (isQuestionAskedFact(fact)) {
			this.onQuestionAsked(fact)
			return
		}
		if (isTurnInterruptedFact(fact)) {
			this.onTurnInterrupted(fact)
			return
		}
		if (isContinueGenerationFact(fact)) {
			this.onContinueGeneration(fact)
			return
		}
		if (isRegenerateTurnFact(fact)) {
			this.onRegenerateTurn(fact)
			return
		}
		if (isCommandOutcomeFact(fact)) {
			this.onCommandOutcome(fact)
			return
		}
		if (isRootAgentBoundFact(fact)) {
			this.onRootAgentBound(fact)
			return
		}
		if (isAgentStatusBoundFact(fact)) {
			this.onAgentStatusBound(fact)
			return
		}
		if (isTeamIdBoundFact(fact)) {
			this.onTeamIdBound(fact)
			return
		}
		if (isBranchTopologyNotifiedFact(fact)) {
			this.onBranchTopologyNotified(fact)
			return
		}
		if (isAgentTreeBoundFact(fact)) {
			this.onAgentTreeBound(fact)
			return
		}
		if (isAgentSnapshotsBoundFact(fact)) {
			this.onAgentSnapshotsBound(fact)
			return
		}
		if (isSeedSeqCursorFact(fact)) {
			this.localSeqCursor = {
				known: true,
				lastAppliedSeq: fact.lastAppliedSeq,
				lastSessionVersion: fact.lastSessionVersion,
				lastMutatedFromSeq: 0,
			}
			return
		}
	}

	private onChatStreamUp(chatAttemptId: AttemptId): void {
		if (this.currentChatAttemptId === null || chatAttemptId !== this.currentChatAttemptId) {
			this.deps.diagnostics.count('attempt.stale_callback', {
				sessionId: String(this.sessionId),
				arm: 'chatStreamUp',
			})
			return
		}
		this.chatStreamReady = true
		this.flushPendingChatWrites()
	}

	private onChatStreamDown(chatAttemptId: AttemptId): void {
		if (this.currentChatAttemptId === null || chatAttemptId !== this.currentChatAttemptId) {
			this.deps.diagnostics.count('attempt.stale_callback', {
				sessionId: String(this.sessionId),
				arm: 'chatStreamDown',
			})
			return
		}
		this.chatStreamReady = false
		// Lease still held → re-ensure same generation (coordinator reopens handle).
		if (this.connectionUp && this.leases.size > 0) {
			this.deps.emitIntent({
				do: 'ensureChatStream',
				chatAttemptId: this.currentChatAttemptId,
			})
		}
	}

	private onSubmitInput(fact: Extract<NormalizedLocalFact, { kind: 'submitInput' }>): void {
		if (this.currentChatAttemptId === null) {
			this.deps.diagnostics.warn('submitInput without chat stream', {
				sessionId: this.sessionId,
				correlation: fact.correlation,
			})
			return
		}
		const agentId = this.resolveLiveRootAgentId()
		if (agentId === null) {
			this.blockSubmitMissingRootAgent(fact.correlation)
			return
		}
		// INV-SAO-SUB-OWN-1: payload own-data only; missing/accessor → 0× chat write.
		const payload = readSaoSubOwnDataValue(fact as object, 'payload')
		if (payload === undefined) {
			return
		}
		const admitted = this.upsertLocalPendingSendFromSubmit(fact.correlation, payload)
		const disposition = this.enqueueOrWriteChat({
			writeId: this.deps.ids.nextWriteId(),
			correlation: fact.correlation,
			payload: this.submitInputWritePayload(payload, agentId),
		})
		if (disposition === 'dropped') {
			// ADR-012 §4 fail-closed: the write never entered outbox/stream, so the
			// optimistic row can never be superseded — remove it and surface the
			// explicit failure effect (drop-site diagnostics stay in enqueueOrWriteChat).
			this.failLocalPendingSendByOperationId(String(fact.correlation), SEND_FAILED_OUTBOX_OVERFLOW)
			return
		}
		if (disposition === 'queued' && admitted) {
			// ADR-012 §4.1: queued writes must not strand the optimistic row forever.
			this.armFlushTimeout(String(fact.correlation))
		}
	}

	private submitInputWritePayload(payload: unknown, agentId: string): Record<string, unknown> {
		if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
			return { ...(payload as Record<string, unknown>), agentId }
		}
		return { agentId }
	}

	private onRootAgentBound(fact: Extract<NormalizedLocalFact, { kind: 'rootAgentBound' }>): void {
		if (!admitRespondAgentId(fact.agentId)) return
		this.liveRootAgentId = fact.agentId
	}

	private onAgentStatusBound(
		fact: Extract<NormalizedLocalFact, { kind: 'agentStatusBound' }>,
	): void {
		if (!admitRespondAgentId(fact.agentId)) return
		const liveAgentStatus = { agentId: fact.agentId, status: fact.status }
		this.liveAgentStatusBound = liveAgentStatus
		this.foldAndBroadcastPatches([{ op: 'setLiveAgentStatus', liveAgentStatus }])
	}

	private onTeamIdBound(fact: Extract<NormalizedLocalFact, { kind: 'teamIdBound' }>): void {
		this.liveTeamIdBound = fact.teamId
		this.foldAndBroadcastPatches([{ op: 'setLiveTeamId', liveTeamId: fact.teamId }])
	}

	private onBranchTopologyNotified(
		fact: Extract<NormalizedLocalFact, { kind: 'branchTopologyNotified' }>,
	): void {
		const notice = {
			reason: fact.reason,
			branchMetaJson: fact.branchMetaJson,
			affectedTurnIdsJson: fact.affectedTurnIdsJson,
			messagesJson: fact.messagesJson,
			divergedFromTurnId: fact.divergedFromTurnId,
			...(fact.operationId !== undefined ? { operationId: fact.operationId } : {}),
			...(fact.notice !== undefined ? { notice: fact.notice } : {}),
		}
		this.foldAndBroadcastPatches([{ op: 'appendBranchTopologyNotice', notice }])
	}

	private onAgentTreeBound(fact: Extract<NormalizedLocalFact, { kind: 'agentTreeBound' }>): void {
		if (!admitRespondAgentId(fact.agentId)) return
		const liveAgentTree = {
			agentId: fact.agentId,
			name: fact.name,
			type: fact.type,
			status: fact.status,
			model: fact.model,
			turnCount: fact.turnCount,
			createdAt: fact.createdAt,
			children: fact.children,
		}
		this.liveAgentTreeBound = liveAgentTree
		this.foldAndBroadcastPatches([{ op: 'setLiveAgentTree', liveAgentTree }])
	}

	private onAgentSnapshotsBound(
		fact: Extract<NormalizedLocalFact, { kind: 'agentSnapshotsBound' }>,
	): void {
		this.liveAgentSnapshotsBound = fact.snapshots
		this.foldAndBroadcastPatches([
			{ op: 'setLiveAgentSnapshots', liveAgentSnapshots: fact.snapshots },
		])
	}

	private resolveLiveRootAgentId(): string | null {
		const agentId = this.liveRootAgentId
		if (agentId === null || !admitRespondAgentId(agentId)) return null
		return agentId
	}

	private blockSubmitMissingRootAgent(correlation: CorrelationRef): void {
		this.deps.diagnostics.warn('submitInput missing live root agent attribution', {
			sessionId: this.sessionId,
			correlation,
		})
	}

	/**
	 * L4 permission decision → Chat write intent (ADR-012 · catalog Chat arm).
	 * correlation ≡ requestId; no localPendingSends (INV-PR-E4).
	 * Cleanup `removePendingAction` + timeline decision chrome hangs on writeId
	 * ledger; applied only on host-write-accepted (ADR-017 Amendment 1 / knife 3
	 * INV-PM3-5). Timeline record retained; on accept upsert `decision` when row
	 * exists. No attempt / queued / overflow / drop / host failure → keep pending.
	 */
	private onPermissionRespond(
		fact: Extract<NormalizedLocalFact, { kind: 'permissionRespond' }>,
	): void {
		if (this.currentChatAttemptId === null) {
			this.deps.diagnostics.warn('permissionRespond without chat stream', {
				sessionId: this.sessionId,
				requestId: fact.requestId,
				decision: fact.decision,
			})
			return
		}
		const agentId = this.resolvePendingRespondAgentId(fact.requestId)
		// Empty-string branch: missing agentId does not block write; payload shape
		// omits agentId when pending has no attribution (align demux INV-CDC empty branch).
		const cleanupPatches = this.permissionRespondCleanupPatches(fact)
		const disposition = this.enqueueOrWriteChat({
			writeId: this.deps.ids.nextWriteId(),
			correlation: fact.requestId as CorrelationRef,
			payload: {
				kind: 'permissionRespond',
				requestId: fact.requestId,
				decision: fact.decision,
				...(agentId !== null ? { agentId } : {}),
			},
			cleanupPatches,
		})
		if (disposition === 'dropped') {
			// L4 keep family (INV-PCA-4 revised): overflow drop retains the CTA row
			// for re-decision; cleanup patches were never registered. Deliberately
			// distinct from the submitInput family, which fails its optimistic row.
			return
		}
	}

	/** Knife 3 + respond chrome: pending clear + timeline decision when mint succeeds. */
	private permissionRespondCleanupPatches(
		fact: Extract<NormalizedLocalFact, { kind: 'permissionRespond' }>,
	): readonly ViewPatch[] {
		const patches: ViewPatch[] = []
		// INV-SA-CLN-ID-2: exact-canonical only; no padded→trimmed timeline alias.
		if (isExactRespondTimelineIdentity(fact.requestId)) {
			const existing = this.snapshot.timeline.find((item) => String(item.id) === fact.requestId)
			if (existing !== undefined) {
				const item = timelineItemFromPermissionRespond(fact, existing)
				if (item !== undefined) {
					patches.push({ op: 'upsertTimelineItem', item })
				}
			}
		}
		patches.push({
			op: 'removePendingAction',
			requestId: fact.requestId as ClientActionRequestId,
		})
		return patches
	}

	/**
	 * L4 client-tool result — ADR-325 unary success cleanup fold.
	 * The fact arrives only after SendClientToolResponse succeeded engine-side;
	 * Actor applies pending clear + timeline terminal chrome immediately
	 * (optimistic UI). 0× chatStreamWrite (no Chat double write), no
	 * localPendingSends, no writeId ledger hang.
	 */
	private onClientToolRespond(
		fact: Extract<NormalizedLocalFact, { kind: 'clientToolRespond' }>,
	): void {
		this.applyCleanupPatches(this.clientToolRespondCleanupPatches(fact))
	}

	/** Knife 2 + respond chrome: pending clear + timeline terminal row when mint succeeds. */
	private clientToolRespondCleanupPatches(
		fact: Extract<NormalizedLocalFact, { kind: 'clientToolRespond' }>,
	): readonly ViewPatch[] {
		const patches: ViewPatch[] = []
		// INV-SA-CLN-ID-2: exact-canonical only; no padded→trimmed timeline alias.
		if (isExactRespondTimelineIdentity(fact.callId)) {
			const existing = this.snapshot.timeline.find((item) => String(item.id) === fact.callId)
			if (existing !== undefined) {
				const item = timelineItemFromClientToolRespond(fact, existing)
				if (item !== undefined) {
					patches.push({ op: 'upsertTimelineItem', item })
				}
			}
		}
		patches.push({
			op: 'removePendingAction',
			requestId: fact.callId as ClientActionRequestId,
		})
		return patches
	}

	/**
	 * L4 question answer — ADR-325 unary success cleanup fold.
	 * The fact arrives only after RespondQuestion succeeded engine-side (the
	 * engine already validated pending / answer keys); Actor applies answered
	 * chrome + pending clear immediately (optimistic UI). 0× chatStreamWrite
	 * (no Chat double write), no localPendingSends, no writeId ledger hang.
	 */
	private onQuestionRespond(fact: Extract<NormalizedLocalFact, { kind: 'questionRespond' }>): void {
		this.applyCleanupPatches(this.questionRespondCleanupPatches(fact))
	}

	/** Respond chrome: timeline answered from pending (live) or existing row; then clear pending. */
	private questionRespondCleanupPatches(
		fact: Extract<NormalizedLocalFact, { kind: 'questionRespond' }>,
	): readonly ViewPatch[] {
		const patches: ViewPatch[] = []
		// INV-SA-CLN-ID-2: exact-canonical only; verbatim compare; 0× trim-write.
		if (isExactRespondTimelineIdentity(fact.questionId)) {
			const questionId = fact.questionId

			const existingTimeline = this.snapshot.timeline.find((item) => String(item.id) === questionId)
			if (existingTimeline !== undefined) {
				const item = timelineItemFromQuestionRespond(fact, existingTimeline)
				if (item !== undefined) {
					patches.push({ op: 'upsertTimelineItem', item })
				}
			} else {
				const pending = this.snapshot.pendingActions.find(
					(action) => String(action.requestId) === questionId,
				)
				if (pending !== undefined) {
					const item = timelineItemFromQuestionRespondPending(fact, pending)
					if (item !== undefined) {
						patches.push({ op: 'upsertTimelineItem', item })
					}
				}
			}
		}

		patches.push({
			op: 'removePendingAction',
			requestId: fact.questionId as ClientActionRequestId,
		})
		return patches
	}

	/**
	 * Chat inputDelivery receipt (ADR-012 §6.3 · INV-IDL-* + ADR-017 Amendment 1).
	 * Host-write success → apply inflight cleanup by writeId.
	 * Host-write failure with ledger entry → drop inflight, keep CTA (L4 family).
	 * Host-write failure without ledger entry (submitInput family) → remove
	 * localPendingSends row by message identity + explicit failure effect.
	 * Unmarked failed/accepted → removeLocalSend (messageId ≡ operationId); never error timeline.
	 * Unmarked dispatched → diagnostics only (L2 still owns success supersede).
	 * INV-SAO-IDL-ID-1: messageId exact-canonical before supersede/inflight cleanup
	 * (align INV-CLF-IDL-ID-1); padded/blank → no-op (no removeLocalSend); 0× trim-write.
	 */
	private onInputDelivery(fact: Extract<NormalizedLocalFact, { kind: 'inputDelivery' }>): void {
		this.deps.diagnostics.count('chat.input_delivery', {
			sessionId: String(this.sessionId),
			status: fact.status,
		})

		// INV-SAO-IDL-ID-1: exact-canonical only (align INV-CLF-IDL-ID-1); 0× trim-write.
		if (!isExactRespondTimelineIdentity(fact.messageId)) {
			return
		}

		const hostMarkers = readHostWriteReceiptMarkers(fact)
		if (hostMarkers !== null) {
			this.onHostWriteReceipt(fact.status, hostMarkers, fact.messageId)
			return
		}

		if (fact.status !== 'failed' && fact.status !== 'accepted') {
			return
		}
		this.supersedeLocalPendingSend(fact.messageId as OperationId)
	}

	/**
	 * ADR-017 Amendment 1: host Chat write outcome keyed by writeId.
	 * accepted = host-write-accepted → apply cleanup; failed → drop ledger keep CTA.
	 * ADR-012 §6.3 (submitInput family): a marked failed receipt with no ledger
	 * entry is a write that registered no cleanup patches (submitInput /
	 * regenerate stage B) and definitively failed host-side — its optimistic row
	 * is removed by message identity (messageId ≡ operationId) plus an explicit
	 * failure effect. Marked accepted receipts keep prior behaviour (warn only;
	 * the L2 echo still owns supersession).
	 */
	private onHostWriteReceipt(
		status: Extract<NormalizedLocalFact, { kind: 'inputDelivery' }>['status'],
		markers: { readonly writeId: string; readonly chatAttemptId: string },
		messageId: string,
	): void {
		if (
			this.currentChatAttemptId !== null &&
			markers.chatAttemptId !== String(this.currentChatAttemptId)
		) {
			this.deps.diagnostics.count('attempt.stale_callback', {
				sessionId: String(this.sessionId),
				arm: HOST_WRITE_RECEIPT_SOURCE,
			})
			// Still drop/apply only if writeId is present in ledger (idempotent miss otherwise).
		}

		const patches = this.inflightCleanups.get(markers.writeId)
		if (patches === undefined) {
			if (status === 'failed') {
				const removed = this.removeLocalPendingSendsByIds([messageId])
				if (removed.length > 0) {
					this.deps.diagnostics.warn('host write failed without inflight', {
						sessionId: this.sessionId,
						writeId: markers.writeId,
						messageId,
					})
					this.emitSendFailureEffect(SEND_FAILED_HOST_WRITE)
					return
				}
			}
			this.deps.diagnostics.warn('host write receipt without inflight', {
				sessionId: this.sessionId,
				writeId: markers.writeId,
				status,
			})
			return
		}
		this.inflightCleanups.delete(markers.writeId)

		if (status === 'accepted') {
			this.applyCleanupPatches(patches)
			return
		}
		// failed / other → ledger dropped; CTA retained (INV-PCA-4 revised).
		if (
			status === 'failed' &&
			this.isPermissionRespondInflightCleanup(patches, messageId)
		) {
			this.foldAndBroadcastPatches([
				{
					op: 'pendingRespondFailed',
					requestId: messageId as ClientActionRequestId,
					cause: 'hostWriteFailed',
					retryable: true,
					error: SEND_FAILED_HOST_WRITE,
				},
			])
		}
	}

	/** L4 permission respond cleanup always carries removePendingAction for correlation. */
	private isPermissionRespondInflightCleanup(
		patches: readonly ViewPatch[],
		messageId: string,
	): boolean {
		if (!isExactRespondTimelineIdentity(messageId)) return false
		return patches.some(
			(patch) =>
				patch.op === 'removePendingAction' && String(patch.requestId) === messageId,
		)
	}

	/**
	 * Chat ask-user side-effect (INV-QQ-*): pendingActions, not DOMAIN_TIMELINE.
	 * requestId ≡ questionId ≡ questionRespond correlation; chrome via mapper SSOT.
	 */
	private onQuestionAsked(fact: Extract<NormalizedLocalFact, { kind: 'questionAsked' }>): void {
		const item = timelineItemFromQuestionAsk({
			questionId: fact.questionId,
			questions: fact.questions,
		})
		// INV-QASK-SING-1: mint withhold (padded/blank) → skip upsert; 0× invent.
		if (item === undefined) return
		this.foldAndBroadcastPatches([
			{
				op: 'upsertPendingAction',
				action: {
					requestId: fact.questionId as ClientActionRequestId,
					summary: item.summary,
					...(fact.agentId !== undefined && admitRespondAgentId(fact.agentId)
						? { agentId: fact.agentId }
						: {}),
				},
			},
		])
	}

	/**
	 * Chat turn interrupt side-effect (INV-TI-*): timeline honesty for partial turn.
	 * Mirrors streamFailed→error fold; retryable stores canContinue for a later CTA slice.
	 */
	private onTurnInterrupted(fact: Extract<NormalizedLocalFact, { kind: 'turnInterrupted' }>): void {
		const id = fact.messageId.length > 0 ? fact.messageId : fact.turnId
		const title =
			fact.reason !== undefined && fact.reason.length > 0 ? fact.reason : 'Turn interrupted'
		this.deps.diagnostics.count('chat.turn_interrupted', {
			sessionId: String(this.sessionId),
			canContinue: String(fact.canContinue === true),
		})
		this.foldAndBroadcastPatches([
			{
				op: 'upsertTimelineItem',
				item: {
					id: id as TimelineItemId,
					orderKey: id,
					...(admitTimelineItemTurnId(fact.turnId) ? { turnId: fact.turnId } : {}),
					summary: {
						kind: 'error',
						title,
						retryable: fact.canContinue === true,
						...(fact.completionStatus !== undefined && fact.completionStatus.length > 0
							? { code: fact.completionStatus }
							: {}),
					},
				},
			},
		])
	}

	/**
	 * ContinueGeneration command fold (ADR-028 INV-CG-E2E-3): sole intent is
	 * openContinuationStream — 0× enqueueOrWriteChat / localPendingSends.
	 */
	private onContinueGeneration(
		fact: Extract<NormalizedLocalFact, { kind: 'continueGeneration' }>,
	): void {
		this.deps.emitIntent({
			do: 'openContinuationStream',
			correlation: fact.messageId as CorrelationRef,
			agentId: fact.agentId,
			turnId: fact.turnId,
			messageId: fact.messageId,
		})
	}

	/**
	 * ADR-029 stage A: emit unaryCommand edit only — 0× same-frame submit.
	 */
	private onRegenerateTurn(fact: Extract<NormalizedLocalFact, { kind: 'regenerateTurn' }>): void {
		if (this.pendingRegenerateTurn !== null) {
			this.deps.diagnostics.warn('regenerateTurn while in-flight', {
				sessionId: this.sessionId,
				correlation: fact.correlation,
			})
			return
		}
		this.pendingRegenerateTurn = {
			correlation: fact.correlation,
			preservedContent: fact.preservedContent,
			...(fact.agentId !== undefined && admitRespondAgentId(fact.agentId)
				? { agentId: fact.agentId }
				: {}),
		}
		const input: Record<string, unknown> = {
			sessionId: String(this.sessionId),
			turnId: fact.userTurnId,
			newContent: fact.preservedContent,
		}
		if (fact.agentId !== undefined && admitRespondAgentId(fact.agentId)) {
			input.agentId = fact.agentId
		}
		this.deps.emitIntent({
			do: 'unaryCommand',
			sessionId: String(this.sessionId),
			commandId: 'agent.editMessage',
			correlation: fact.correlation,
			input,
		})
	}

	/**
	 * ADR-029 stage B: matching edit success → submit write + localPendingSend.
	 */
	private onCommandOutcome(fact: Extract<NormalizedLocalFact, { kind: 'commandOutcome' }>): void {
		const pending = this.pendingRegenerateTurn
		if (pending === null || pending.correlation !== fact.correlation) {
			return
		}
		if (fact.commandId !== 'agent.editMessage') {
			return
		}
		if (!fact.succeeded) {
			this.pendingRegenerateTurn = null
			this.deps.diagnostics.warn('regenerateTurn edit failed', {
				sessionId: this.sessionId,
				correlation: fact.correlation,
				error: fact.error,
			})
			return
		}
		this.emitRegenerateSubmit(pending)
		this.pendingRegenerateTurn = null
	}

	private emitRegenerateSubmit(pending: {
		readonly correlation: CorrelationRef
		readonly preservedContent: string
		readonly agentId?: string
	}): void {
		if (this.currentChatAttemptId === null) {
			this.deps.diagnostics.warn('regenerateTurn submit without chat stream', {
				sessionId: this.sessionId,
				correlation: pending.correlation,
			})
			return
		}
		const agentId =
			pending.agentId !== undefined && admitRespondAgentId(pending.agentId)
				? pending.agentId
				: this.resolveLiveRootAgentId()
		if (agentId === null) {
			this.blockSubmitMissingRootAgent(pending.correlation)
			return
		}
		const payload = { text: pending.preservedContent }
		const admitted = this.upsertLocalPendingSendFromSubmit(pending.correlation, payload)
		const disposition = this.enqueueOrWriteChat({
			writeId: this.deps.ids.nextWriteId(),
			correlation: pending.correlation,
			payload: this.submitInputWritePayload(payload, agentId),
		})
		if (disposition === 'dropped') {
			// Same submitInput-family fail-closed as onSubmitInput (ADR-012 §4).
			this.failLocalPendingSendByOperationId(
				String(pending.correlation),
				SEND_FAILED_OUTBOX_OVERFLOW,
			)
			return
		}
		if (disposition === 'queued' && admitted) {
			this.armFlushTimeout(String(pending.correlation))
		}
	}

	private resolvePendingRespondAgentId(requestId: string): string | null {
		const pending = this.snapshot.pendingActions.find(
			(action) => String(action.requestId) === requestId,
		)
		if (pending === undefined) return null
		const agentId = pending.agentId
		if (!admitRespondAgentId(agentId)) return null
		return agentId
	}

	/**
	 * ADR-012 §6.2 producer: bounded upsertLocalSend before write/outbox.
	 * Returns true iff the optimistic row was admitted (callers arm the §4.1
	 * flush-timeout timer only for admitted queued rows).
	 */
	private upsertLocalPendingSendFromSubmit(correlation: CorrelationRef, payload: unknown): boolean {
		const send = pendingSendViewFromSubmit(correlation, payload)
		const decision = decideLocalPendingUpsert(this.snapshot.localPendingSends, send)
		if (decision.kind === 'skip_at_capacity') {
			this.deps.diagnostics.warn('localPendingSends at capacity', {
				sessionId: this.sessionId,
				correlation,
				operationId: send.operationId,
			})
			return false
		}
		this.foldAndBroadcastPatches([{ op: 'upsertLocalSend', send: decision.send }])
		return true
	}

	/**
	 * ADR-012 §6.2 supersession — single-id remove entry (e.g. future commandOutcome).
	 * Stream applyViewPatches uses the same patch algebra in one fold (see below).
	 */
	private supersedeLocalPendingSend(operationId: OperationId): void {
		const patches = patchesForLocalPendingSupersede(this.snapshot.localPendingSends, operationId)
		if (patches.length === 0) return
		this.cancelFlushTimeout(String(operationId))
		this.foldAndBroadcastPatches(patches)
	}

	/**
	 * Remove matching optimistic rows in one fold; returns ids actually removed
	 * (deduplicated, snapshot-presence gated). Empty result ⇒ 0× patches.
	 * Every removed row's §4.1 flush timer is cancelled here — this choke covers
	 * overflow drop, host-write failure, epoch change and stream close clears.
	 */
	private removeLocalPendingSendsByIds(ids: readonly string[]): readonly OperationId[] {
		const present = new Set(this.snapshot.localPendingSends.map((s) => String(s.operationId)))
		const matched: OperationId[] = []
		const seen = new Set<string>()
		for (const id of ids) {
			if (!present.has(id) || seen.has(id)) continue
			seen.add(id)
			matched.push(id as OperationId)
		}
		if (matched.length === 0) return []
		for (const operationId of matched) {
			this.cancelFlushTimeout(String(operationId))
		}
		this.foldAndBroadcastPatches(
			matched.map((operationId) => ({ op: 'removeLocalSend' as const, operationId })),
		)
		return matched
	}

	/**
	 * Submit-family fail-closed (ADR-012 §4): remove the optimistic row and
	 * surface a one-shot ViewEffect with the stable copy code. The effect fires
	 * even when no row was admitted (e.g. overlay at capacity) — the write loss
	 * itself is certain. Drop-site diagnostics stay with the caller.
	 */
	private failLocalPendingSendByOperationId(operationId: string, code: string): void {
		this.removeLocalPendingSendsByIds([operationId])
		this.emitSendFailureEffect(code)
	}

	/**
	 * Stream/epoch invalidation (ADR-012 §2/§3): every optimistic send rides the
	 * closed stream generation and can never complete — clear all rows and emit
	 * one failure effect when anything was actually cleared.
	 */
	private failAllLocalPendingSends(code: string): void {
		const removed = this.removeLocalPendingSendsByIds(
			this.snapshot.localPendingSends.map((s) => String(s.operationId)),
		)
		if (removed.length > 0) {
			this.emitSendFailureEffect(code)
		}
	}

	/** One-shot effects frame per live lease (ADR-009 §3 effect queue; never folded). */
	private emitSendFailureEffect(code: string): void {
		if (this.leases.size === 0) return
		const effect: ViewEffect = {
			effectId: this.deps.ids.nextEffectId(),
			kind: SEND_FAILED_EFFECT_KIND,
			message: code,
		}
		for (const lease of this.leases.values()) {
			lease.frameId += 1
			lease.version += 1
			lease.sink.enqueue({
				leaseId: lease.leaseId,
				generation: lease.generation,
				frameId: lease.frameId,
				version: lease.version,
				body: { kind: 'effects', effects: [effect] },
			})
		}
	}

	/**
	 * Stream-only L2 supersede: durable patches + matching removeLocalSend in one frame.
	 * localFact applyViewPatches must never call this (seed path stays silent).
	 */
	private foldStreamApplyViewPatches(patches: readonly ViewPatch[]): void {
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

	/**
	 * Narrow stream arms: `applyViewPatches` (Wave-4 + ADR-012 §6.2 supersede) + `hello`
	 * + `overlayPendingSnapshot` (ADR-017 INV-ROS-C* set-replace)
	 * + `overlayActiveTurn` (L3 streaming/thinking overlay block)
	 * + `overlayActiveTurnClear` (L3 turn end → remove overlay block) + `rangeReplaced`
	 * (ADR-019 INV-SSR-APPLY-* atomic truncate+apply) + demuxed domain timeline arms
	 * (`text`/`tool`/`reasoning`/`permission`/`error`/`usage`
	 * → ViewPatch → same supersede fold).
	 * Unknown arms are counted (`event.unknown_arm`) but never fail-close the stream.
	 * Hello / domain arms are never silently dropped — malformed bodies are counted.
	 */
	private onStreamEvent(event: unknown): void {
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

	/** INV-SSR-APPLY-15: aggregate commit for seqIndex + l2State mirror. */
	private commitL2State(next: L2SeqIndexState): void {
		this.l2State = next
		this.seqIndex = next.entries as Map<number, TimelineItemId>
	}

	private feedIndex(entries: readonly L2SeqIndexEntry[]): void {
		this.commitL2State(feedL2SeqIndexState(this.l2State, entries))
	}

	private pruneIndex(removedSeqs: readonly number[]): void {
		this.commitL2State(pruneL2SeqIndexState(this.l2State, removedSeqs))
	}

	private clearSeqIndex(): void {
		this.commitL2State(createL2SeqIndexState())
	}

	private entriesFromSeqItemNotes(notes: readonly SeqItemNote[]): readonly L2SeqIndexEntry[] {
		return notes.map((n) => [n.seq, n.itemId] as const)
	}

	/** Live transport: top-level seq? + upsert patches → feed algebra. */
	private feedIndexFromTransportEvent(event: unknown, patches: readonly ViewPatch[]): void {
		if (typeof event !== 'object' || event === null) return
		const seq = (event as { readonly seq?: unknown }).seq
		if (typeof seq !== 'number') return
		this.feedIndex(seqIndexEntriesFromPatches(seq, patches))
	}

	/**
	 * INV-LSC-WIRE-1: contiguous live (append/batch demuxed to one event) only.
	 * Depends on wire yielding batch envelopes one-by-one; multi-seq in one event
	 * would require ascending left-fold (not expanded here).
	 * sessionVersion SSOT = Hello anchor only (never cursor self-compare).
	 * skip ⇒ 0× write. Never call from rangeReplaced / historyResult.
	 */
	private maybeAdvanceLocalSeqCursorFromLive(event: unknown): void {
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

	/**
	 * ADR-019 Am.2: consume planRangeReplacedApply (delete-by-IDs).
	 * Reject / unresolvable → 0× fold / 0× patch / 0× cursor (unresolvable
	 * triggers degraded + resync). Apply → executeRangeReplacedApply.
	 */
	private onRangeReplaced(event: RangeReplacedEvent): void {
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

	/**
	 * Am.2: IDs empty + subtree root — local cannot resolve delete set.
	 * Degraded sync chrome + history fill from fromSeq (rebuild window entry).
	 */
	private escalateRangeReplacedUnresolvable(meta: RangeReplacedEvent['body']['meta']): void {
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

	/**
	 * Sole apply path: truncate removes → fold replacement → index update → one
	 * frame → planLocalSeqCursorCover (INV-LSC-COVER-1 range). Never fold
	 * body.events outside this method (MF-4). Index mutation order: prune
	 * removedSeqs, then feed replacement (INV-SSR-APPLY-2). Cover runs even when
	 * merged patches are empty (pure truncate may 0-remove). Hello-only SV.
	 */
	private executeRangeReplacedApply(
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

	/**
	 * ADR-017 INV-ROS-C*: set-replace migrated pendingActions from overlay pending
	 * snapshot when current-attempt Hello provenance matches (Am.4). Ahead epoch →
	 * knife-4 clear (0× adopt / 0× write anchor). CAP mismatch → atomic 0× patch.
	 * Does not mutate lastRuntimeEpoch.
	 */
	private onOverlayPendingSnapshot(body: OverlayPendingSnapshotBody): void {
		const planned = planOverlayPendingSetReplace(
			this.snapshot.pendingActions,
			body,
			this.lastRuntimeEpoch,
			this.lastStreamHello?.runtimeEpoch ?? null,
		)
		if (planned.kind === 'clear_epoch_ahead') {
			this.deps.diagnostics.count('overlay_pending_epoch_ahead_clear', {
				sessionId: String(this.sessionId),
				anchored: String(planned.anchored),
				actual: String(planned.actual),
			})
			this.deps.diagnostics.warn('overlay pending epoch ahead clear', {
				sessionId: this.sessionId,
				anchored: planned.anchored,
				actual: planned.actual,
			})
			this.clearPendingForRuntimeEpochChange()
			return
		}
		if (planned.kind !== 'apply') {
			this.deps.diagnostics.count('overlay_pending_epoch_skip', {
				sessionId: String(this.sessionId),
				reason: planned.kind,
			})
			this.deps.diagnostics.warn('overlay pending set-replace epoch skip', {
				sessionId: this.sessionId,
				reason: planned.kind,
				...(planned.kind === 'skip_epoch_stale'
					? { expected: planned.expected, actual: planned.actual }
					: {}),
			})
			return
		}

		const admitted = admitPendingActionUpserts(this.snapshot.pendingActions, planned.patches)
		if (admitted.skipped.length > 0) {
			this.deps.diagnostics.count('overlay_pending_set_replace_at_capacity', {
				sessionId: String(this.sessionId),
				skipped: String(admitted.skipped.length),
			})
			this.deps.diagnostics.warn('overlay pending set-replace at capacity', {
				sessionId: this.sessionId,
				code: OVERLAY_PENDING_SET_REPLACE_AT_CAPACITY,
				skipped: admitted.skipped.length,
			})
			return
		}

		this.dropCleanupLedgerForRemovedPending(planned.removedRequestIds)
		this.foldAndBroadcastPatches(admitted.patches)
	}

	/**
	 * L3 activeTurn streaming/thinking → overlay block (blockId ≡ turnId).
	 * 0× timeline upsert; not DOMAIN_TIMELINE_ARMS.
	 */
	private onOverlayActiveTurn(body: OverlayActiveTurnBody): void {
		const { turnId, streamingText, thinkingText, generatingToolName } = body
		const nextBlockId = turnId as OverlayBlockId
		const patches: ViewPatch[] = []
		if (this.overlayActiveTurnBlockId != null && this.overlayActiveTurnBlockId !== nextBlockId) {
			patches.push({
				op: 'removeOverlayBlock',
				blockId: this.overlayActiveTurnBlockId,
			})
		}
		this.overlayActiveTurnBlockId = nextBlockId

		const summary =
			generatingToolName !== undefined
				? {
						kind: 'tool' as const,
						title: generatingToolName,
						toolName: generatingToolName,
						status: 'running' as const,
					}
				: streamingText.length > 0
					? {
							kind: 'text' as const,
							title: streamingText,
							preview: streamingText,
						}
					: thinkingText.length > 0
						? {
								kind: 'reasoning' as const,
								title: thinkingText,
								collapsedPreview: thinkingText,
								streaming: true,
							}
						: { kind: 'text' as const, title: streamingText }

		const chunks: Array<{
			readonly chunkId: TextChunkId
			readonly orderKey: string
			readonly text: string
		}> = []
		let order = 0
		if (thinkingText.length > 0) {
			chunks.push({
				chunkId: `${turnId}:think:0` as TextChunkId,
				orderKey: String(order),
				text: thinkingText,
			})
			order += 1
		}
		if (streamingText.length > 0) {
			chunks.push({
				chunkId: `${turnId}:0` as TextChunkId,
				orderKey: String(order),
				text: streamingText,
			})
		}

		patches.push({
			op: 'upsertOverlayBlock',
			block: {
				blockId: nextBlockId,
				orderKey: turnId,
				summary,
				chunks,
			},
		})
		this.foldAndBroadcastPatches(patches)
	}

	/**
	 * Sole overlay-block removal path (INV-OVR-TR-2): L3 activeTurn absent arm
	 * and every terminal-state reclaim (D30 T set + epoch-advance backstop)
	 * reuse this method — 1× removeOverlayBlock when tracked, 0× otherwise.
	 * Never touches pendingActions / anchors (INV-OVR-TR-3/6). 0× timeline.
	 */
	private onOverlayActiveTurnClear(): void {
		const blockId = this.overlayActiveTurnBlockId
		if (blockId == null) return
		this.overlayActiveTurnBlockId = null
		this.foldAndBroadcastPatches([{ op: 'removeOverlayBlock', blockId }])
	}

	/**
	 * Drop outbox / writeId ledger entries whose cleanup targets removed pending
	 * ids (0× apply — INV-ROS-C* / knife-4 ledger spirit).
	 */
	private dropCleanupLedgerForRemovedPending(
		removedRequestIds: readonly ClientActionRequestId[],
	): void {
		if (removedRequestIds.length === 0) return
		const idSet = new Set(removedRequestIds.map(String))

		for (let i = this.pendingChatWrites.length - 1; i >= 0; i -= 1) {
			const entry = this.pendingChatWrites[i]!
			if (
				idSet.has(String(entry.correlation)) ||
				cleanupPatchesTargetIds(entry.cleanupPatches, idSet)
			) {
				this.pendingChatWrites.splice(i, 1)
			}
		}

		for (const [writeId, patches] of [...this.inflightCleanups.entries()]) {
			if (cleanupPatchesTargetIds(patches, idSet)) {
				this.inflightCleanups.delete(writeId)
			}
		}
	}

	/**
	 * Fold demux StreamHello: record anchor, plan gap, emit fillHistoryGap when needed.
	 * Does not push ViewPatch (INV-SPC-2). Host executes fill via coordinator.
	 * ADR-017 knife 4 / Am.4b: runtimeEpoch *strict advance* clears pending + outbox +
	 * inflight writeId ledger (0× apply); rollback hello is a no-op (INV-PAB-E6;
	 * ≠ L3 stale reseed). connectionDown must not clear pending.
	 */
	private onStreamHello(body: StreamHelloAnchor): void {
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

	/**
	 * R5 rebuild window: drop mirror from hello fromSeq, rewind cursor, refill.
	 * Hello watermark is committed only after history fill succeeds. Empty window
	 * (nothing to refill) commits immediately — no pending fill can complete.
	 * Fill not emitted (attempt gone) discards the pending watermark so a later
	 * hello re-plans instead of committing from an unrelated fill result.
	 */
	private consumeRewriteWindowFromHello(
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

	/**
	 * R5 rebuild window drop: remove timeline items indexed at seq >= dropFromSeq.
	 * Does not mutate SyncWatermark lastMutatedFromSeq (committed after refill).
	 */
	private dropMirrorFromSeq(dropFromSeq: number): ViewPatch[] {
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

	/**
	 * R5 live range path: record fromSeq on successful apply (write point 1).
	 */
	private writeSyncWatermarkAfterRangeReplaced(fromSeq: number): void {
		if (!this.localSeqCursor.known) return
		this.localSeqCursor = {
			...this.localSeqCursor,
			lastMutatedFromSeq: fromSeq,
		}
	}

	/**
	 * gap_too_large consume (INV-HGW-4): declare prefix hole then emit tail fill.
	 * Atomic pairing — never emit without declaring when a prefix is skippable,
	 * never declare without attempting emit. attemptId null → neither (no orphan chrome).
	 */
	private consumeGapTooLargeBootstrap(
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

	/**
	 * Sole write site for lastRuntimeEpoch (ADR-017 INV-PAB-E6 / Am.4b).
	 * Monotonic: never assigns a lower epoch.
	 */
	private tryAdvanceLastRuntimeEpoch(epoch: number): 'advanced' | 'same' | 'rollback' {
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

	/**
	 * ADR-017 INV-PAB-E*: drop stale L4 CTA + outbox + writeId ledger on epoch advance.
	 * 0× apply cleanup (ghost remove forbidden).
	 * ADR-012 §3: generation switch voids the whole old-generation send batch —
	 * optimistic sends ride the dead chatAttemptId and can never be superseded,
	 * so they are removed with one explicit failure effect (submit family; L4
	 * CTA rows keep the existing remove semantics).
	 */
	private clearPendingForRuntimeEpochChange(): void {
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

	/**
	 * Shared fillHistoryGap emit for historyFill and cold-start bootstrapResync.
	 * Empty window (toInclusive <= fromExclusive) is a no-op (INV-BR-3).
	 * Returns true iff a fill intent was emitted (caller pairs one-shot state).
	 */
	private maybeEmitHistoryFill(fromExclusive: number, toInclusive: number): boolean {
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

	/**
	 * historyResult ok: fold domain-arm envelopes → ViewPatch (INV-HR-1), then
	 * planLocalSeqCursorCover (INV-HR-2 / INV-LSC-WIRE-2). cover → write;
	 * skip ⇒ 0× cursor write + history.fill_cursor_skip. Seq-only rows are
	 * coverage-only (INV-HR-3). ADR-019 INV-SSR-APPLY-12: feed only
	 * folded.seqItemNotes (0× envelope rescan).
	 */
	private onHistoryResult(requestId: string, result: unknown): void {
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

	private clearStreamHelloAnchor(): void {
		this.lastStreamHello = null
		this.pendingHistoryRequestId = null
		this.pendingRewriteHelloLastMutatedFromSeq = null
		this.clearSeqIndex()
	}

	/**
	 * Narrow stream-closed fold (Wave-6 Slice-A): clear attempt, emit closeStream,
	 * set sync.closed, push setSyncChrome to live leases. No SubscriptionFsm reopen.
	 *
	 * Reason priority (Wave-8 Slice-B): may set `remote`/`local`/error chrome, but a
	 * later `connectionDown` overwrites via `syncReasonFromConnectionDown`. After
	 * connectionDown, a late `streamClosed` fails post auth (`not_authenticated`)
	 * — no re-fold.
	 */
	private onStreamClosed(cause: StreamCloseCause): void {
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

	/**
	 * L1 sessionClosed / sessionPurged / sessionVisibilityChanged / agentTimeout /
	 * subscriptionHealth. sessionClosed / sessionPurged / subscriptionHealth
	 * may `setSyncChrome`; sessionVisibilityChanged / agentTimeout are claim-only (0× chrome).
	 * Malformed arm claims count `event.domain_malformed`; admitted bodies
	 * never reach `foldDomainStreamEvent` / `event.unknown_arm`.
	 */
	private tryFoldL1SyncChromeStreamEvent(event: unknown): boolean {
		if (isSessionClosedStreamEvent(event)) {
			const body = (event as { readonly body: object }).body
			this.l1SessionClosed = true
			this.pushSyncChrome(syncChromeFromSessionClosedBody(body))
			// D30 INV-OVR-TR-1/2: terminal reclaim reuses the single removal path.
			this.onOverlayActiveTurnClear()
			return true
		}
		if (isSessionClosedArm(event)) {
			this.deps.diagnostics.count('event.domain_malformed', {
				sessionId: String(this.sessionId),
				arm: 'sessionClosed',
			})
			this.deps.diagnostics.warn('stream sessionClosed malformed', {
				sessionId: this.sessionId,
				arm: 'sessionClosed',
			})
			return true
		}
		if (isSessionPurgedStreamEvent(event)) {
			const body = (event as { readonly body: object }).body
			this.l1SessionClosed = true
			this.pushSyncChrome(syncChromeFromSessionPurgedBody(body))
			// D30 INV-OVR-TR-1/2: terminal reclaim reuses the single removal path.
			this.onOverlayActiveTurnClear()
			return true
		}
		if (isSessionPurgedArm(event)) {
			this.deps.diagnostics.count('event.domain_malformed', {
				sessionId: String(this.sessionId),
				arm: 'sessionPurged',
			})
			this.deps.diagnostics.warn('stream sessionPurged malformed', {
				sessionId: this.sessionId,
				arm: 'sessionPurged',
			})
			return true
		}
		if (isSessionVisibilityChangedStreamEvent(event)) {
			return true
		}
		if (isSessionVisibilityChangedArm(event)) {
			this.deps.diagnostics.count('event.domain_malformed', {
				sessionId: String(this.sessionId),
				arm: 'sessionVisibilityChanged',
			})
			this.deps.diagnostics.warn('stream sessionVisibilityChanged malformed', {
				sessionId: this.sessionId,
				arm: 'sessionVisibilityChanged',
			})
			return true
		}
		if (isAgentTimeoutStreamEvent(event)) {
			return true
		}
		if (isAgentTimeoutArm(event)) {
			this.deps.diagnostics.count('event.domain_malformed', {
				sessionId: String(this.sessionId),
				arm: 'agentTimeout',
			})
			this.deps.diagnostics.warn('stream agentTimeout malformed', {
				sessionId: this.sessionId,
				arm: 'agentTimeout',
			})
			return true
		}
		if (isSubscriptionHealthStreamEvent(event)) {
			const body = (event as { readonly body: object }).body
			const sync = syncChromeFromSubscriptionHealthBody(
				body,
				this.snapshot.sync,
				this.l1SessionClosed,
			)
			if (sync !== null) {
				this.pushSyncChrome(sync)
			}
			return true
		}
		if (isSubscriptionHealthArm(event)) {
			this.deps.diagnostics.count('event.domain_malformed', {
				sessionId: String(this.sessionId),
				arm: 'subscriptionHealth',
			})
			this.deps.diagnostics.warn('stream subscriptionHealth malformed', {
				sessionId: this.sessionId,
				arm: 'subscriptionHealth',
			})
			return true
		}
		return false
	}

	private pushSyncChrome(sync: SyncChrome): void {
		this.foldAndBroadcastPatches([{ op: 'setSyncChrome', sync }])
	}

	private foldAndBroadcastPatches(patches: readonly ViewPatch[]): void {
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

	private emitBaseline(lease: LeaseRecord): void {
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

	private emitPatches(lease: LeaseRecord, patches: readonly ViewPatch[]): void {
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

	private openAttempt(): void {
		if (this.subscriptionFailed) return
		this.clearStreamHelloAnchor()
		const attemptId = this.deps.ids.nextAttemptId()
		this.currentAttemptId = attemptId
		this.deps.emitIntent({ do: 'openStream', attemptId })
	}

	/**
	 * ADR-012 §2: non-empty lease set + connection → keep Chat open.
	 * Idempotent while `currentChatAttemptId` is set (linger re-acquire does not rebuild).
	 */
	private ensureChatStreamIfNeeded(): void {
		if (!this.connectionUp || this.leases.size === 0) return
		if (this.currentChatAttemptId !== null) return
		const chatAttemptId = this.deps.ids.nextAttemptId()
		this.currentChatAttemptId = chatAttemptId
		this.chatStreamReady = false
		this.deps.emitIntent({ do: 'ensureChatStream', chatAttemptId })
	}

	/**
	 * ADR-012 §2: stream close voids the per-session chat send state. Queued
	 * outbox entries can never flush (next ensure starts a new generation), and
	 * in-flight writes lose their completion path — every optimistic send row is
	 * removed with one explicit failure effect (ADR-012 §6.3; gated on rows).
	 */
	private closeChatStream(_reason: string): void {
		if (this.currentChatAttemptId !== null) {
			this.deps.emitIntent({ do: 'closeChatStream', chatAttemptId: this.currentChatAttemptId })
			this.currentChatAttemptId = null
		}
		this.chatStreamReady = false
		this.pendingChatWrites.length = 0
		// INV-PCA-4 revised: drop in-flight cleanups; keep CTA rows.
		this.inflightCleanups.clear()
		// Submit family only — pendingActions CTA rows are intentionally untouched here.
		this.failAllLocalPendingSends(SEND_FAILED_STREAM_CLOSED)
	}

	/**
	 * Emit or queue a Chat write (ADR-012). Cleanup patches (ADR-017 Amendment 1)
	 * register on emit and apply only on host-write-accepted — never on queue or
	 * intent emit alone. `dropped` = CAP overflow (fail-closed); callers MUST
	 * consume the disposition — submitInput family fails its optimistic row,
	 * L4 respond keeps the CTA (INV-PCA-4 revised).
	 */
	private enqueueOrWriteChat(entry: PendingChatWrite): ChatWriteDisposition {
		if (this.chatStreamReady && this.currentChatAttemptId !== null) {
			this.registerInflightCleanup(entry)
			this.deps.emitIntent({
				do: 'chatStreamWrite',
				correlation: entry.correlation,
				chatAttemptId: this.currentChatAttemptId,
				writeId: entry.writeId,
				payload: entry.payload,
			})
			return 'written'
		}
		if (this.pendingChatWrites.length >= PENDING_CHAT_WRITE_CAP) {
			this.deps.diagnostics.warn('pending chat write overflow', {
				sessionId: this.sessionId,
				correlation: entry.correlation,
			})
			return 'dropped'
		}
		this.pendingChatWrites.push(entry)
		return 'queued'
	}

	private flushPendingChatWrites(): void {
		if (!this.chatStreamReady || this.currentChatAttemptId === null) return
		const chatAttemptId = this.currentChatAttemptId
		const batch = this.pendingChatWrites.splice(0, this.pendingChatWrites.length)
		for (const entry of batch) {
			// ADR-012 §4.1: queued → written; the flush deadline no longer applies
			// (in-flight convergence owns the row via receipts / L2 supersede).
			this.cancelFlushTimeout(String(entry.correlation))
			this.registerInflightCleanup(entry)
			this.deps.emitIntent({
				do: 'chatStreamWrite',
				correlation: entry.correlation,
				chatAttemptId,
				writeId: entry.writeId,
				payload: entry.payload,
			})
		}
	}

	/** ADR-017 Amendment 1: register before emit; apply only on host receipt. */
	private registerInflightCleanup(entry: PendingChatWrite): void {
		if (entry.cleanupPatches === undefined || entry.cleanupPatches.length === 0) {
			return
		}
		this.inflightCleanups.set(String(entry.writeId), entry.cleanupPatches)
	}

	/** Apply Respond cleanup patches (host-write-accepted path). */
	private applyCleanupPatches(patches: readonly ViewPatch[] | undefined): void {
		if (patches === undefined || patches.length === 0) return
		this.foldAndBroadcastPatches([...patches])
	}

	private rejectIfStaleAttempt(attemptId: AttemptId): boolean {
		if (this.currentAttemptId === null || attemptId !== this.currentAttemptId) {
			this.deps.diagnostics.count('attempt.stale_callback', {
				sessionId: String(this.sessionId),
			})
			return true
		}
		return false
	}

	private failClosedOverflow(): void {
		this.subscriptionFailed = true
		this.clearStreamHelloAnchor()
		if (this.currentAttemptId !== null) {
			this.deps.emitIntent({ do: 'closeStream', attemptId: this.currentAttemptId })
			this.currentAttemptId = null
		}
		this.closeChatStream('mailbox_overflow')
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
		this.onOverlayActiveTurnClear()
	}

	private startLinger(): void {
		if (this.lingerTimerId !== null) return
		const timerId = `linger:${this.sessionId}` as TimerId
		this.lingerTimerId = timerId
		this.deps.emitIntent({
			do: 'startTimer',
			timerId,
			delayMs: this.deps.lingerMs,
		})
	}

	private cancelLinger(): void {
		if (this.lingerTimerId === null) return
		const timerId = this.lingerTimerId
		this.lingerTimerId = null
		this.deps.emitIntent({ do: 'cancelTimer', timerId })
	}

	/**
	 * ADR-012 §4.1: arm the flush deadline for one queued submit-family row.
	 * Re-arming an already-armed operationId replaces the entry (idempotent upsert
	 * semantics — the deadline restarts with the row's latest admission).
	 */
	private armFlushTimeout(operationId: string): void {
		const timerId =
			`${FLUSH_TIMEOUT_TIMER_PREFIX}${String(this.sessionId)}:${operationId}` as TimerId
		this.flushTimeoutTimers.set(operationId, timerId)
		this.deps.emitIntent({
			do: 'startTimer',
			timerId,
			delayMs: this.deps.chatFlushTimeoutMs,
		})
	}

	/** Idempotent: unknown operationId (never armed / already fired / re-removed) → 0× intents. */
	private cancelFlushTimeout(operationId: string): void {
		const timerId = this.flushTimeoutTimers.get(operationId)
		if (timerId === undefined) return
		this.flushTimeoutTimers.delete(operationId)
		this.deps.emitIntent({ do: 'cancelTimer', timerId })
	}
}

type PermissionRespondFact = Extract<NormalizedLocalFact, { kind: 'permissionRespond' }>

/** INV-SAO-SUB-OWN-1: own data property only; never invoke accessors. */
function readSaoSubOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (desc.get !== undefined || desc.set !== undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

/** INV-PR-OWN-1: own data property only; never invoke accessors. */
function readPermissionRespondOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (desc.get !== undefined || desc.set !== undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

function permissionDecisionFromOwnData(fact: PermissionRespondFact): 'allow' | 'deny' | undefined {
	const raw = readPermissionRespondOwnDataValue(fact as object, 'decision')
	if (raw === 'allow' || raw === 'deny') return raw
	return undefined
}

type QuestionRespondFact = Extract<NormalizedLocalFact, { kind: 'questionRespond' }>

/** INV-QR-OWN-1: own data property only; never invoke accessors. */
function readQuestionRespondOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (desc.get !== undefined || desc.set !== undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

function questionRespondAnsweredFromOwnData(fact: QuestionRespondFact): true | undefined {
	const answersRaw = readQuestionRespondOwnDataValue(fact as object, 'answers')
	if (answersRaw === undefined) return undefined
	if (typeof answersRaw !== 'object' || answersRaw === null) return undefined
	if (Array.isArray(answersRaw)) return undefined
	return true
}

/** INV-SA-QR-ID-2 / INV-SA-PR-ID-2 / INV-SA-CLN-ID-2 / INV-SAO-IDL-ID-1: exact-canonical only. */
function isExactRespondTimelineIdentity(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value === value.trim()
}

/**
 * Maps a host-write-accepted permissionRespond onto an existing timeline permission row.
 * `requestId` must match `existing.id` verbatim; no synthetic ids.
 * Fail-closed: missing own decision → undefined (no invented allow).
 */
function timelineItemFromPermissionRespond(
	fact: PermissionRespondFact,
	existing: TimelineItemView,
): TimelineItemView | undefined {
	const requestIdRaw = readPermissionRespondOwnDataValue(fact as object, 'requestId')
	if (!isExactRespondTimelineIdentity(requestIdRaw)) return undefined
	if (String(existing.id) !== requestIdRaw) return undefined
	if (existing.summary.kind !== 'permission') return undefined

	const decision = permissionDecisionFromOwnData(fact)
	if (decision === undefined) return undefined

	const prev = existing.summary
	return {
		...existing,
		summary: {
			kind: 'permission',
			title: prev.title,
			permissionKind: prev.permissionKind,
			...(prev.argPreview !== undefined ? { argPreview: prev.argPreview } : {}),
			...(prev.optionsPreview !== undefined ? { optionsPreview: prev.optionsPreview } : {}),
			decision,
		},
	}
}

/**
 * Maps a host-write-accepted questionRespond onto an existing timeline question row.
 * `questionId` must match `existing.id` / pending.requestId verbatim; no synthetic ids.
 * Fail-closed: missing own answers object → undefined (no invented answer content).
 */
function timelineItemFromQuestionRespondPending(
	fact: QuestionRespondFact,
	pending: PendingActionView,
): TimelineItemView | undefined {
	const questionIdRaw = readQuestionRespondOwnDataValue(fact as object, 'questionId')
	if (!isExactRespondTimelineIdentity(questionIdRaw)) return undefined
	if (String(pending.requestId) !== questionIdRaw) return undefined
	if (pending.summary.kind !== 'question') return undefined

	if (questionRespondAnsweredFromOwnData(fact) === undefined) return undefined

	const prev = pending.summary
	return {
		id: pending.requestId as unknown as TimelineItemId,
		orderKey: String(pending.requestId),
		summary: {
			kind: 'question',
			title: prev.title,
			items: prev.items,
			answerKeysValid: prev.answerKeysValid,
			...(prev.optionsPreview !== undefined ? { optionsPreview: prev.optionsPreview } : {}),
			...(prev.multiSelect !== undefined ? { multiSelect: prev.multiSelect } : {}),
			...(prev.allowCustom !== undefined ? { allowCustom: prev.allowCustom } : {}),
			answered: true,
		},
		...(pending.agentId !== undefined ? { agentId: pending.agentId } : {}),
	}
}

function timelineItemFromQuestionRespond(
	fact: QuestionRespondFact,
	existing: TimelineItemView,
): TimelineItemView | undefined {
	const questionIdRaw = readQuestionRespondOwnDataValue(fact as object, 'questionId')
	if (!isExactRespondTimelineIdentity(questionIdRaw)) return undefined
	if (String(existing.id) !== questionIdRaw) return undefined
	if (existing.summary.kind !== 'question') return undefined

	if (questionRespondAnsweredFromOwnData(fact) === undefined) return undefined

	const prev = existing.summary
	return {
		...existing,
		summary: {
			kind: 'question',
			title: prev.title,
			items: prev.items,
			answerKeysValid: prev.answerKeysValid,
			...(prev.optionsPreview !== undefined ? { optionsPreview: prev.optionsPreview } : {}),
			...(prev.multiSelect !== undefined ? { multiSelect: prev.multiSelect } : {}),
			...(prev.allowCustom !== undefined ? { allowCustom: prev.allowCustom } : {}),
			answered: true,
		},
	}
}
