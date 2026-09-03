/**
 * Injected host ports for session-core.
 * Implementations live in the composition root / test harness; this package
 * never constructs production ports or calls Date.now / Math.random / setTimeout.
 */

export type TimerId = string & { readonly __brand: 'TimerId' }
export type TextChunkId = string & { readonly __brand: 'TextChunkId' }
export type EffectId = string & { readonly __brand: 'EffectId' }
export type AttemptId = string & { readonly __brand: 'AttemptId' }
/** Opaque Chat write id (ADR-017 Amendment 1) — not correlation / requestId. */
export type ChatWriteId = string & { readonly __brand: 'ChatWriteId' }

export interface SchedulerPort {
	now(): number
	startTimer(id: TimerId, delayMs: number): void
	cancelTimer(id: TimerId): void
}

export interface IdPort {
	nextChunkId(): TextChunkId
	nextEffectId(): EffectId
	nextAttemptId(): AttemptId
	nextWriteId(): ChatWriteId
}

export type DiagnosticMetric =
	| 'l2.duplicate'
	| 'l2.gap'
	| 'l3.stale_epoch'
	| 'l3.stale_terminal_anomaly'
	| 'l4.queue_full'
	| 'view.resync'
	| 'view.downgrade_baseline'
	| 'mailbox.overflow'
	| 'attempt.stale_callback'
	| 'event.unknown_arm'
	/** Domain timeline arm (`text`/`tool`) present but body failed shape checks. */
	| 'event.domain_malformed'
	/** StreamHello folded into Actor (head_seq recorded). */
	| 'stream.hello'
	/** `arm:'hello'` present but body failed StreamHello shape checks. */
	| 'stream.hello_malformed'
	/** Hello gap plan: local cursor already matches head_seq. */
	| 'stream.hello_aligned'
	/** Hello gap plan: unknown/mismatched cursor → bootstrap (no fill). */
	| 'stream.hello_bootstrap'
	/**
	 * Hello gap plan (R5): mutation watermark mismatch → rebuild window
	 * (drop seq ≥ fromSeq + refill). labels.fromSeq = hello watermark.
	 */
	| 'stream.hello_rewrite_window'
	/** Hello runtimeEpoch < lastRuntimeEpoch — skip write/clear (ADR-017 Am.4b). */
	| 'stream.hello_epoch_rollback_skip'
	/** Actor emitted fillHistoryGap CoreIntent. */
	| 'history.fill_requested'
	/** historyResult ok → fill succeeded (cursor may skip via cover planner). */
	| 'history.fill_ok'
	/**
	 * historyResult ok but localSeqCursor not written (INV-LSC-WIRE-2).
	 * labels.reason: covered_through_invalid | no_session_version | stale_cover
	 */
	| 'history.fill_cursor_skip'
	/** historyResult failed / mismatched requestId. */
	| 'history.fill_failed'
	/** Chat inputDelivery receipt folded (status in labels). */
	| 'chat.input_delivery'
	| 'chat.turn_interrupted'
	/** Overlay pending set-replace skipped (epoch gate). */
	| 'overlay_pending_epoch_skip'
	/** Overlay pending epoch ahead → knife-4 clear (0× adopt / 0× write anchor). */
	| 'overlay_pending_epoch_ahead_clear'
	/** Overlay pending set-replace refused — CAP atomic fail-closed. */
	| 'overlay_pending_set_replace_at_capacity'
	/**
	 * questionRespond blocked by planQuestionRespondAnswerKeys (INV-QKEY Actor choke).
	 * labels.reason: unknown_answer_key | answer_keys_invalid | pending_missing
	 */
	| 'question.respond_answer_keys_blocked'
	/**
	 * rangeReplaced rejected by planRangeReplacedApply (ADR-019 knife 3).
	 * labels.code: range_replaced_from_seq_invalid | range_replaced_under_truncate
	 */
	| 'stream.range_replaced_rejected'
	/**
	 * rangeReplaced apply ok but localSeqCursor not written (INV-LSC-COVER-1 range).
	 * labels.reason: new_head_seq_invalid | covered_through_invalid |
	 *   no_session_version | stale_cover
	 */
	| 'stream.range_replaced_cursor_skip'
	/** Host `handleIntent` default branch: intent not executed on this slice. */
	| 'intent.unhandled'

export interface DiagnosticsPort {
	count(metric: DiagnosticMetric, labels?: Readonly<Record<string, string>>): void
	warn(message: string, fields: Readonly<Record<string, unknown>>): void
}
