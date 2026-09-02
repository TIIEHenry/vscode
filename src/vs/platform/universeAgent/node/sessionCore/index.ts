/**
 * Host-side entrypoint — ports, SessionCore Actor API, test harness.
 * Renderer / packages/app must import `@universe-agent/session-core/view` instead.
 */

export type {
	TimerId,
	TextChunkId,
	EffectId,
	AttemptId,
	ChatWriteId,
	SchedulerPort,
	IdPort,
	DiagnosticMetric,
	DiagnosticsPort,
} from './ports.js'

export type { ChatCoreIntent, CoreIntent, HistoryFillCoreIntent } from './intents.js'
export {
	isChatCoreIntent,
	isHistoryFillCoreIntent,
	isOpenContinuationStreamIntent,
} from './intents.js'
export type {
	ApplyViewPatchesStreamEvent,
	HistoryFillEnvelopeRow,
	HistoryFillResultPayload,
	InputDeliveryStatus,
	NormalizedLocalFact,
	AgentTreeNodeBound,
	SessionSnapshotInfoBound,
	OverlayPendingSnapshotBody,
	OverlayPendingSnapshotEvent,
	OverlayPendingSnapshotItem,
	OverlayPendingSnapshotKind,
	StreamHelloAnchor,
	StreamHelloBody,
	StreamHelloEvent,
} from './local-fact.js'
export {
	hasViewPatchesArray,
	isApplyViewPatchesFact,
	isApplyViewPatchesStreamEvent,
	isChatLifecycleLocalFact,
	isChatStreamDownFact,
	isChatStreamUpFact,
	isHistoryFillResultPayload,
	isInputDeliveryFact,
	isOverlayPendingSnapshotArm,
	isOverlayPendingSnapshotEvent,
	isSeedSeqCursorFact,
	isStreamHelloArm,
	isStreamHelloEvent,
	isClientToolRespondFact,
	isPermissionRespondFact,
	isQuestionAskedFact,
	isQuestionRespondFact,
	isTurnInterruptedFact,
	isContinueGenerationFact,
	isRootAgentBoundFact,
	isAgentStatusBoundFact,
	isAgentTreeBoundFact,
	isAgentSnapshotsBoundFact,
	isSubmitInputFact,
	isRegenerateTurnFact,
	isCommandOutcomeFact,
	streamEventArmLabel,
} from './local-fact.js'
export { HOST_WRITE_RECEIPT_SOURCE, readHostWriteReceiptMarkers } from './host-write-receipt.js'
export type { HostWriteReceiptMarkers } from './host-write-receipt.js'
export type { HistoryFillEnvelopeFold, SeqItemNote } from './history-result-to-view-patch.js'
export {
	readPositiveSeq,
	seqItemNoteFromSafePatches,
	viewPatchesFromHistoryFillEnvelopes,
} from './history-result-to-view-patch.js'
export type {
	DomainClientToolCallStreamBody,
	DomainClientToolCallStreamEvent,
	DomainErrorStreamBody,
	DomainErrorStreamEvent,
	DomainPermissionStreamBody,
	DomainPermissionStreamEvent,
	DomainReasoningStreamBody,
	DomainReasoningStreamEvent,
	DomainTextStreamBody,
	DomainTextStreamEvent,
	DomainTimelineArm,
	DomainTimelineStreamEvent,
	DomainToolStreamBody,
	DomainToolStreamEvent,
	DomainUsageStreamBody,
	DomainUsageStreamEvent,
	DomainUnknownBlockStreamBody,
	DomainUnknownBlockStreamEvent,
	DomainStreamEventFold,
	ClientToolCallChromeInput,
} from './stream-event-to-view-patch.js'
export {
	CLIENT_TOOL_ARG_PREVIEW_MAX,
	DOMAIN_TIMELINE_ARMS,
	UNKNOWN_BLOCK_RAW_PREVIEW_MAX,
	boundUnknownBlockRawPreview,
	foldDomainStreamEvent,
	isDomainClientToolCallStreamArm,
	isDomainClientToolCallStreamEvent,
	isDomainErrorStreamArm,
	isDomainErrorStreamEvent,
	isDomainPermissionStreamArm,
	isDomainPermissionStreamEvent,
	isDomainReasoningStreamArm,
	isDomainReasoningStreamEvent,
	isDomainTextStreamArm,
	isDomainTextStreamEvent,
	isDomainToolStreamArm,
	isDomainToolStreamEvent,
	isDomainUnknownBlockStreamArm,
	isDomainUnknownBlockStreamEvent,
	isDomainUsageStreamArm,
	isDomainUsageStreamEvent,
	timelineItemFromClientToolCall,
	viewPatchesFromDomainStreamEvent,
} from './stream-event-to-view-patch.js'
export type {
	ConnectionDownReason,
	CoreMessage,
	CorrelationRef,
	PostOutcome,
	StreamCloseCause,
	ViewFrameAck,
	ViewFrameSink,
} from './messages.js'
export type { SessionId, ViewLeaseId } from './messages.js'

export { BOOTSTRAP_BACKFILL_WINDOW, planGapFromStreamHello } from './stream-hello-gap.js'
export type {
	LocalSeqCursor,
	StreamHelloGapAnchor,
	StreamHelloGapPlan,
} from './stream-hello-gap.js'

export { planQuestionRespondAnswerKeys } from './question-respond-answer-keys.js'
export type {
	QuestionRespondAnswerKeysPlan,
	QuestionRespondAnswerKeysSummary,
	QuestionRespondAnswersInput,
} from './question-respond-answer-keys.js'

export {
	L2_SEQ_INDEX_CAP,
	feedL2SeqIndex,
	isL2SeqIndexable,
	pruneL2SeqIndex,
	seqIndexEntriesFromPatches,
} from './l2-seq-index.js'
export type { L2SeqIndexEntry } from './l2-seq-index.js'
export {
	L2_SEQ_INDEX_FLOOR_NONE,
	createL2SeqIndexState,
	feedL2SeqIndexState,
	l2SeqIndexCoversFrom,
	pruneL2SeqIndexState,
} from './l2-seq-index.js'
export type { L2SeqIndexState } from './l2-seq-index.js'

export { planLocalSeqCursorAdvance } from './l2-seq-cursor.js'
export type { L2SeqCursorAdvancePlan, L2SeqCursorObservation } from './l2-seq-cursor.js'

export { planLocalSeqCursorCover } from './l2-seq-cursor-cover.js'
export type { L2SeqCursorCoverObservation, L2SeqCursorCoverPlan } from './l2-seq-cursor-cover.js'

export { pendingActionFromLocalPendingSend } from './pending-actions-bound.js'

export { createSessionCore } from './session-core.js'
export type { SessionCore, SessionCoreDeps } from './session-core.js'
