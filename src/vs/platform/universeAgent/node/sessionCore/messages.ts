/**
 * Mailbox ingress types (ADR-009 §2). Minimal set — no protocol event algebra yet.
 * Stream payloads stay opaque while this package keeps `dependencies: {}`.
 */

import type { AttemptId, EffectId, TimerId } from './ports.js'
import type { SessionId, ViewFrame, ViewLeaseId } from '../../common/sessionView/types.js'

export type CorrelationRef = string & { readonly __brand: 'CorrelationRef' }

/**
 * Stream-end cause folded by `streamClosed` into `sync.closed.reason`
 * (`remote` / `local` / error message). Terminal priority vs `connectionDown`:
 * a later `connectionDown` **overwrites** via the Wave-10 mapping
 * (`connection_down` / `unauthenticated`); after `connectionDown`, a late
 * `streamClosed` is rejected at post (`not_authenticated`) and must not fold
 * again (Wave-8 Slice-B).
 */
export type StreamCloseCause =
	| { readonly kind: 'remote' }
	| { readonly kind: 'local' }
	| { readonly kind: 'error'; readonly message: string }

/**
 * Host-reported disconnect detail. Actor maps to `sync.closed.reason`
 * (Wave-10 Slice-C, two tiers + host defer):
 * - `transport` → `connection_down`
 * - `unauthenticated` → `unauthenticated`
 * - `host` → still `connection_down` (third tier deferred)
 *
 * Priority: always wins over a prior `streamClosed` chrome (Wave-8 Slice-B).
 */
export type ConnectionDownReason =
	| { readonly kind: 'transport' }
	| { readonly kind: 'unauthenticated' }
	| { readonly kind: 'host'; readonly message: string }

/** Ack envelope mirrored from `frameAck` (delivery rhythm only; D7). */
export type ViewFrameAck = {
	readonly generation: number
	readonly frameId: number
	readonly appliedVersion: number
	readonly effectIds?: readonly EffectId[]
}

/**
 * Per-lease ordered frame sink; host owns the channel (INV-SPC-12).
 * `acknowledge` is the sole slot for delivery-rhythm feedback (Pump may gate later).
 */
export interface ViewFrameSink {
	enqueue(frame: ViewFrame): void
	acknowledge(ack: ViewFrameAck): void
}

/**
 * Messages accepted by `SessionCore.post` — sole write path into an Actor.
 * Types that require an authenticated connection are rejected with `not_authenticated`
 * before enqueue when the session is not connection-up.
 */
export type CoreMessage =
	| {
			readonly t: 'streamEvent'
			readonly attemptId: AttemptId
			/** Opaque until protocol types land; Actor recognises narrow arms only. */
			readonly event: unknown
		}
	| {
			readonly t: 'streamClosed'
			readonly attemptId: AttemptId
			readonly cause: StreamCloseCause
		}
	| {
			readonly t: 'historyResult'
			readonly attemptId: AttemptId
			readonly requestId: string
			readonly result: unknown
		}
	| { readonly t: 'connectionUp'; readonly connectionGeneration: number }
	| { readonly t: 'connectionDown'; readonly reason: ConnectionDownReason }
	| {
			readonly t: 'acquireLease'
			readonly leaseId: ViewLeaseId
			readonly sink: ViewFrameSink
		}
	| { readonly t: 'releaseLease'; readonly leaseId: ViewLeaseId }
	| {
			readonly t: 'frameAck'
			readonly leaseId: ViewLeaseId
			readonly generation: number
			readonly frameId: number
			readonly appliedVersion: number
			readonly effectIds?: readonly EffectId[]
		}
	| { readonly t: 'requestResync'; readonly leaseId: ViewLeaseId }
	| { readonly t: 'localFact'; readonly fact: unknown }
	| { readonly t: 'timerFired'; readonly timerId: TimerId }

export type PostOutcome =
	| { readonly accepted: true; readonly correlation: CorrelationRef }
	| {
			readonly accepted: false
			readonly reason: 'mailbox_full' | 'no_such_session' | 'not_authenticated'
		}

export type { SessionId, ViewLeaseId }
