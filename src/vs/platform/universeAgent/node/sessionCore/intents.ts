/**
 * Host-side intents emitted by the Actor (ADR-009 §2 · ADR-012).
 * Core never performs I/O; the host runner executes intents and may post results back.
 */

import type { CorrelationRef } from './messages.js'
import type { AttemptId, ChatWriteId, TimerId } from './ports.js'

export type CoreIntent =
	| { readonly do: 'openStream'; readonly attemptId: AttemptId }
	| { readonly do: 'closeStream'; readonly attemptId: AttemptId }
	| { readonly do: 'startTimer'; readonly timerId: TimerId; readonly delayMs: number }
	| { readonly do: 'cancelTimer'; readonly timerId: TimerId }
	/** ADR-012: open/hold Chat bidi — host ChatSideEffectCoordinator executes. */
	| { readonly do: 'ensureChatStream'; readonly chatAttemptId: AttemptId }
	/** ADR-012: close Chat bidi for this chatAttemptId generation. */
	| { readonly do: 'closeChatStream'; readonly chatAttemptId: AttemptId }
	/** ADR-012: write on established Chat stream (or host outbox while down). */
	| {
			readonly do: 'chatStreamWrite'
			readonly correlation: CorrelationRef
			readonly chatAttemptId: AttemptId
			/** ADR-017 Amendment 1: opaque write id for host-write receipts. */
			readonly writeId: ChatWriteId
			readonly payload: unknown
		}
	/**
	 * HistoryFill mount: Host HistoryFillCoordinator runs GetHistory pagination
	 * (fake/injectable) then posts `historyResult` (INV-HF-1/2).
	 */
	| {
			readonly do: 'fillHistoryGap'
			readonly attemptId: AttemptId
			readonly requestId: string
			readonly fromExclusive: number
			readonly toInclusive: number
		}
	/** ADR-028: ContinueGeneration serverStream — host ChatSideEffectCoordinator holds. */
	| {
			readonly do: 'openContinuationStream'
			readonly correlation: CorrelationRef
			readonly agentId: string
			readonly turnId: string
			readonly messageId: string
		}
	/**
	 * ADR-029: direct unary via host dispatcher (e.g. agent.editMessage for regenerate).
	 * Host posts commandOutcome localFact back to Actor on completion.
	 */
	| {
			readonly do: 'unaryCommand'
			readonly sessionId: string
			readonly commandId: string
			readonly correlation: CorrelationRef
			readonly input: unknown
		}

/** Narrow Chat arms for host coordinators (INV-CHAT-1 execution surface). */
export type ChatCoreIntent = Extract<
	CoreIntent,
	{ do: 'ensureChatStream' | 'closeChatStream' | 'chatStreamWrite' }
>

/** History fill arm for HistoryFillCoordinator (INV-HF-1 execution surface). */
export type HistoryFillCoreIntent = Extract<CoreIntent, { do: 'fillHistoryGap' }>

export function isChatCoreIntent(intent: CoreIntent): intent is ChatCoreIntent {
	switch (intent.do) {
		case 'ensureChatStream':
		case 'closeChatStream':
		case 'chatStreamWrite':
			return true
		default:
			return false
	}
}

export function isHistoryFillCoreIntent(intent: CoreIntent): intent is HistoryFillCoreIntent {
	return intent.do === 'fillHistoryGap'
}

export function isOpenContinuationStreamIntent(
	intent: CoreIntent,
): intent is Extract<CoreIntent, { do: 'openContinuationStream' }> {
	return intent.do === 'openContinuationStream'
}
