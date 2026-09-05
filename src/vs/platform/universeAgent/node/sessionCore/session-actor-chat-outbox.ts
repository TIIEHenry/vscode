/** Actor-side write gate before chatStreamUp (host outbox is separate). */
export const PENDING_CHAT_WRITE_CAP = 64

export const SEND_FAILED_EFFECT_KIND = 'send_failed' as const
export const SEND_FAILED_OUTBOX_OVERFLOW = 'chat_send_outbox_overflow' as const
export const SEND_FAILED_HOST_WRITE = 'chat_send_write_failed' as const
export const SEND_FAILED_STREAM_CLOSED = 'chat_send_stream_closed' as const
export const SEND_FAILED_EPOCH_CHANGED = 'chat_send_epoch_changed' as const
export const SEND_FAILED_FLUSH_TIMEOUT = 'chat_send_flush_timeout' as const

export const FLUSH_TIMEOUT_TIMER_PREFIX = 'chat-flush:'

export type PendingChatWrite = {
	readonly writeId: import('./ports.js').ChatWriteId
	readonly correlation: import('./messages.js').CorrelationRef
	readonly payload: unknown
	readonly cleanupPatches?: readonly import('./view/types.js').ViewPatch[]
}

export type ChatWriteDisposition = 'written' | 'queued' | 'dropped'

/**
 * GFS-4 SessionActor fold module.
 */

import {
	decideLocalPendingUpsert,
	pendingSendViewFromSubmit,
	patchesForLocalPendingSupersede,
	patchesForLocalPendingSupersedeAll,
} from './local-pending-sends.js'
import type { CorrelationRef } from './messages.js'
import type { AttemptId } from './ports.js'
import type { OperationId, ViewEffect, ViewPatch } from '../../common/sessionView/types.js'

import { SessionActor } from './session-actor.js'
import type { SessionActorFold } from './session-actor-fold-interface.js'

export function installSessionActorChatOutbox(): void {
	;(SessionActor.prototype as unknown as SessionActorFold).onChatStreamUp = function (this: SessionActorFold, chatAttemptId: AttemptId): void {
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

	;(SessionActor.prototype as unknown as SessionActorFold).onChatStreamDown = function (this: SessionActorFold, chatAttemptId: AttemptId): void {
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

	;(SessionActor.prototype as unknown as SessionActorFold).ensureChatStreamIfNeeded = function (this: SessionActorFold, ): void {
		if (!this.connectionUp || this.leases.size === 0) return
		if (this.currentChatAttemptId !== null) return
		const chatAttemptId = this.deps.ids.nextAttemptId()
		this.currentChatAttemptId = chatAttemptId
		this.chatStreamReady = false
		this.deps.emitIntent({ do: 'ensureChatStream', chatAttemptId })
	}

	;(SessionActor.prototype as unknown as SessionActorFold).closeChatStream = function (this: SessionActorFold, _reason: string): void {
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

	;(SessionActor.prototype as unknown as SessionActorFold).enqueueOrWriteChat = function (this: SessionActorFold, entry: PendingChatWrite): ChatWriteDisposition {
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

	;(SessionActor.prototype as unknown as SessionActorFold).flushPendingChatWrites = function (this: SessionActorFold, ): void {
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

	;(SessionActor.prototype as unknown as SessionActorFold).registerInflightCleanup = function (this: SessionActorFold, entry: PendingChatWrite): void {
		if (entry.cleanupPatches === undefined || entry.cleanupPatches.length === 0) {
			return
		}
		this.inflightCleanups.set(String(entry.writeId), entry.cleanupPatches)
	}

	;(SessionActor.prototype as unknown as SessionActorFold).applyCleanupPatches = function (this: SessionActorFold, patches: readonly ViewPatch[] | undefined): void {
		if (patches === undefined || patches.length === 0) return
		this.foldAndBroadcastPatches([...patches])
	}

	;(SessionActor.prototype as unknown as SessionActorFold).upsertLocalPendingSendFromSubmit = function (this: SessionActorFold, correlation: CorrelationRef, payload: unknown): boolean {
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

	;(SessionActor.prototype as unknown as SessionActorFold).supersedeLocalPendingSend = function (this: SessionActorFold, operationId: OperationId): void {
		const patches = patchesForLocalPendingSupersede(this.snapshot.localPendingSends, operationId)
		if (patches.length === 0) return
		this.cancelFlushTimeout(String(operationId))
		this.foldAndBroadcastPatches(patches)
	}

	;(SessionActor.prototype as unknown as SessionActorFold).removeLocalPendingSendsByIds = function (this: SessionActorFold, ids: readonly string[]): readonly OperationId[] {
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

	;(SessionActor.prototype as unknown as SessionActorFold).failLocalPendingSendByOperationId = function (this: SessionActorFold, operationId: string, code: string): void {
		this.removeLocalPendingSendsByIds([operationId])
		this.emitSendFailureEffect(code)
	}

	;(SessionActor.prototype as unknown as SessionActorFold).failAllLocalPendingSends = function (this: SessionActorFold, code: string): void {
		const removed = this.removeLocalPendingSendsByIds(
			this.snapshot.localPendingSends.map((s) => String(s.operationId)),
		)
		if (removed.length > 0) {
			this.emitSendFailureEffect(code)
		}
	}

	;(SessionActor.prototype as unknown as SessionActorFold).emitSendFailureEffect = function (this: SessionActorFold, code: string): void {
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
}
