/**
 * Host-facing SessionCore: ensureSession + post-only write path (ADR-009).
 */

import type { CoreIntent } from './intents.js'
import type {
	AgentTreeNodeBound,
	SessionSnapshotInfoBound,
	StreamHelloAnchor,
} from './local-fact.js'
import type { CoreMessage, CorrelationRef, PostOutcome } from './messages.js'
import type { AttemptId, DiagnosticsPort, IdPort, SchedulerPort } from './ports.js'
import { SessionActor } from './session-actor.js'
import type { LocalSeqCursor } from './stream-hello-gap.js'
import type { SessionId } from '../../common/sessionView/types.js'

export type SessionCoreDeps = {
	readonly scheduler: SchedulerPort
	readonly ids: IdPort
	readonly diagnostics: DiagnosticsPort
	/** Default 256 — implementation parameter, not ADR-fixed. */
	readonly mailboxCapacity?: number
	/** Default 30_000 — linger after last lease release. */
	readonly lingerMs?: number
	/**
	 * Default 30_000 — queued localPendingSends flush timeout (ADR-012 §4 等待超时).
	 * Injected SchedulerPort timer; armed per queued submit-family row, cancelled on
	 * written / supersede / epoch / close clears.
	 */
	readonly chatFlushTimeoutMs?: number
}

export interface SessionCore {
	ensureSession(sessionId: SessionId): void
	hasSession(sessionId: SessionId): boolean
	post(sessionId: SessionId, msg: CoreMessage): PostOutcome
	/** Intents produced since last take (host runner executes, then may post back). */
	takeIntents(): readonly CoreIntent[]
	/** Test/host helper: inspect lease set size without bypassing mailbox. */
	leaseCount(sessionId: SessionId): number
	attemptId(sessionId: SessionId): AttemptId | null
	/** Chat bidi generation (ADR-012); null when no ensure/close cycle active. */
	chatAttemptId(sessionId: SessionId): AttemptId | null
	/** Last folded StreamHello anchor; null before hello or after attempt reset. */
	streamHelloAnchor(sessionId: SessionId): StreamHelloAnchor | null
	/** Local seq cursor for Hello gap planning; null if session missing. */
	seqCursor(sessionId: SessionId): LocalSeqCursor | null
	/** Live root agent id when bound; null when absent or invalid (ADR-021). */
	getLiveRootAgentId(sessionId: SessionId): string | null
	/** True when Actor holds a live root agent id for submitInput attribution. */
	hasLiveRootAgentId(sessionId: SessionId): boolean
	/** Bound agent status from FetchAgentStatus fold; null when absent. */
	getLiveAgentStatusBound(
		sessionId: SessionId,
	): { readonly agentId: string; readonly status: string } | null
	/** True when Actor holds FetchAgentStatus fold (agent id + status). */
	hasLiveAgentStatusBound(sessionId: SessionId): boolean
	/** Bound agent tree from FetchAgentTree fold; null when absent. */
	getLiveAgentTreeBound(sessionId: SessionId): AgentTreeNodeBound | null
	/** True when Actor holds FetchAgentTree fold (admitted root tree). */
	hasLiveAgentTreeBound(sessionId: SessionId): boolean
	/** Bound snapshot list from FetchAgentSnapshots fold; null when absent. */
	getLiveAgentSnapshotsBound(sessionId: SessionId): readonly SessionSnapshotInfoBound[] | null
	/** True when Actor holds FetchAgentSnapshots fold (admitted snapshot list). */
	hasLiveAgentSnapshotsBound(sessionId: SessionId): boolean
	/** ADR-029: in-flight regenerateTurn (edit pending or submit not written). */
	hasInFlightRegenerateTurn(sessionId: SessionId): boolean
}

const DEFAULT_MAILBOX_CAPACITY = 256
const DEFAULT_LINGER_MS = 30_000
/** Same order of magnitude as linger (ADR-012 §7 implementation parameter). */
const DEFAULT_CHAT_FLUSH_TIMEOUT_MS = 30_000

export function createSessionCore(deps: SessionCoreDeps): SessionCore {
	// Timer port is host-executed via CoreIntent; required so composition roots
	// never construct core without a clock (ADR-009 §1).
	void deps.scheduler

	const mailboxCapacity = deps.mailboxCapacity ?? DEFAULT_MAILBOX_CAPACITY
	const lingerMs = deps.lingerMs ?? DEFAULT_LINGER_MS
	const chatFlushTimeoutMs = deps.chatFlushTimeoutMs ?? DEFAULT_CHAT_FLUSH_TIMEOUT_MS
	const actors = new Map<string, SessionActor>()
	const intentQueue: CoreIntent[] = []
	let correlationSeq = 0

	const nextCorrelation = (): CorrelationRef => {
		correlationSeq += 1
		return `c:${correlationSeq}` as CorrelationRef
	}

	const emitIntent = (intent: CoreIntent): void => {
		intentQueue.push(intent)
	}

	const getActor = (sessionId: SessionId): SessionActor | undefined => actors.get(String(sessionId))

	return {
		ensureSession(sessionId) {
			const key = String(sessionId)
			if (actors.has(key)) return
			actors.set(
				key,
				new SessionActor({
					sessionId,
					ids: deps.ids,
					diagnostics: deps.diagnostics,
					mailboxCapacity,
					lingerMs,
					chatFlushTimeoutMs,
					emitIntent,
				}),
			)
		},

		hasSession(sessionId) {
			return actors.has(String(sessionId))
		},

		post(sessionId, msg) {
			const actor = getActor(sessionId)
			if (!actor) {
				return { accepted: false, reason: 'no_such_session' }
			}
			if (actor.requiresAuth(msg) && !actor.isConnectionUp) {
				return { accepted: false, reason: 'not_authenticated' }
			}
			const enqueued = actor.enqueue(msg)
			if (!enqueued) {
				return { accepted: false, reason: 'mailbox_full' }
			}
			return { accepted: true, correlation: nextCorrelation() }
		},

		takeIntents() {
			if (intentQueue.length === 0) return []
			const batch = intentQueue.slice()
			intentQueue.length = 0
			return batch
		},

		leaseCount(sessionId) {
			return getActor(sessionId)?.leaseCount ?? 0
		},

		attemptId(sessionId) {
			return getActor(sessionId)?.attemptId ?? null
		},

		chatAttemptId(sessionId) {
			return getActor(sessionId)?.chatAttemptId ?? null
		},

		streamHelloAnchor(sessionId) {
			return getActor(sessionId)?.streamHelloAnchor ?? null
		},

		seqCursor(sessionId) {
			return getActor(sessionId)?.seqCursor ?? null
		},

		getLiveRootAgentId(sessionId) {
			return getActor(sessionId)?.getLiveRootAgentId() ?? null
		},

		hasLiveRootAgentId(sessionId) {
			return (getActor(sessionId)?.getLiveRootAgentId() ?? null) !== null
		},

		getLiveAgentStatusBound(sessionId) {
			return getActor(sessionId)?.getLiveAgentStatusBound() ?? null
		},

		hasLiveAgentStatusBound(sessionId) {
			return getActor(sessionId)?.hasLiveAgentStatusBound ?? false
		},

		getLiveAgentTreeBound(sessionId) {
			return getActor(sessionId)?.getLiveAgentTreeBound() ?? null
		},

		hasLiveAgentTreeBound(sessionId) {
			return getActor(sessionId)?.hasLiveAgentTreeBound ?? false
		},

		getLiveAgentSnapshotsBound(sessionId) {
			return getActor(sessionId)?.getLiveAgentSnapshotsBound() ?? null
		},

		hasLiveAgentSnapshotsBound(sessionId) {
			return getActor(sessionId)?.hasLiveAgentSnapshotsBound ?? false
		},

		hasInFlightRegenerateTurn(sessionId) {
			return getActor(sessionId)?.hasInFlightRegenerateTurn ?? false
		},
	}
}
