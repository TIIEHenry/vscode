import type { AttemptId, ChatWriteId, TimerId } from './ports.js'
import type { CorrelationRef, StreamCloseCause, ViewFrameSink } from './messages.js'
import type { NormalizedLocalFact, OverlayActiveTurnBody, OverlayPendingSnapshotBody, RangeReplacedEvent, StreamHelloAnchor } from './local-fact.js'
import type { RangeReplacedApplyPlan } from './range-replaced-apply.js'
import type { SeqItemNote } from './history-result-to-view-patch.js'
import type { L2SeqIndexEntry, L2SeqIndexState } from './l2-seq-index.js'
import type { StreamHelloGapPlan } from './stream-hello-gap.js'
import type { AgentTreeNodeBound, SessionSnapshotInfoBound } from './local-fact.js'
import type {
	ClientActionRequestId,
	OperationId,
	OverlayBlockId,
	SessionId,
	SessionViewSnapshot,
	SyncChrome,
	TimelineItemId,
	ViewLeaseId,
	ViewPatch,
} from '../../common/sessionView/types.js'
import type { PendingChatWrite, ChatWriteDisposition } from './session-actor-chat-outbox.js'

type LeaseRecord = {
	readonly leaseId: ViewLeaseId
	sink: ViewFrameSink
	generation: number
	frameId: number
	version: number
}

/** Prototype-installed fold + facade helpers (GFS-4). */
export interface SessionActorFold {
	readonly sessionId: SessionId
	deps: import('./session-actor.js').SessionActorDeps
	mailbox: import('./mailbox.js').BoundedMailbox<import('./messages.js').CoreMessage>
	draining: boolean
	connectionUp: boolean
	currentAttemptId: AttemptId | null
	lingerTimerId: TimerId | null
	flushTimeoutTimers: Map<string, TimerId>
	subscriptionFailed: boolean
	l1SessionClosed: boolean
	leases: Map<ViewLeaseId, LeaseRecord>
	snapshot: SessionViewSnapshot
	currentChatAttemptId: AttemptId | null
	chatStreamReady: boolean
	pendingChatWrites: PendingChatWrite[]
	inflightCleanups: Map<string, readonly ViewPatch[]>
	lastStreamHello: StreamHelloAnchor | null
	lastRuntimeEpoch: number | null
	overlayActiveTurnBlockId: OverlayBlockId | null
	localSeqCursor: import('./stream-hello-gap.js').LocalSeqCursor
	pendingHistoryRequestId: string | null
	pendingRewriteHelloLastMutatedFromSeq: number | null
	historyRequestSeq: number
	seqIndex: Map<number, TimelineItemId>
	l2State: L2SeqIndexState
	liveRootAgentId: string | null
	liveAgentStatusBound: { readonly agentId: string; readonly status: string } | null
	liveTeamIdBound: number | null
	liveAgentTreeBound: AgentTreeNodeBound | null
	liveAgentSnapshotsBound: readonly SessionSnapshotInfoBound[] | null
	pendingRegenerateTurn: {
		readonly correlation: CorrelationRef
		readonly preservedContent: string
		readonly agentId?: string
	} | null
	armFlushTimeout(operationId: string): void
	cancelFlushTimeout(operationId: string): void
	emitPatches(lease: LeaseRecord, patches: readonly ViewPatch[]): void
	emitBaseline(lease: LeaseRecord): void
	onChatStreamUp(chatAttemptId: AttemptId): void
	onChatStreamDown(chatAttemptId: AttemptId): void
	ensureChatStreamIfNeeded(): void
	closeChatStream(_reason: string): void
	enqueueOrWriteChat(entry: PendingChatWrite): ChatWriteDisposition
	flushPendingChatWrites(): void
	registerInflightCleanup(entry: PendingChatWrite): void
	applyCleanupPatches(patches: readonly ViewPatch[] | undefined): void
	upsertLocalPendingSendFromSubmit(correlation: CorrelationRef, payload: unknown): boolean
	supersedeLocalPendingSend(operationId: OperationId): void
	removeLocalPendingSendsByIds(ids: readonly string[]): readonly OperationId[]
	failLocalPendingSendByOperationId(operationId: string, code: string): void
	failAllLocalPendingSends(code: string): void
	emitSendFailureEffect(code: string): void
	onLocalFact(fact: unknown): void
	onSubmitInput(fact: Extract<NormalizedLocalFact, { kind: 'submitInput' }>): void
	submitInputWritePayload(payload: unknown, agentId: string): Record<string, unknown>
	onRootAgentBound(fact: Extract<NormalizedLocalFact, { kind: 'rootAgentBound' }>): void
	onAgentStatusBound(
		fact: Extract<NormalizedLocalFact, { kind: 'agentStatusBound' }>,
	): void
	onTeamIdBound(fact: Extract<NormalizedLocalFact, { kind: 'teamIdBound' }>): void
	onBranchTopologyNotified(
		fact: Extract<NormalizedLocalFact, { kind: 'branchTopologyNotified' }>,
	): void
	onAgentTreeBound(fact: Extract<NormalizedLocalFact, { kind: 'agentTreeBound' }>): void
	onAgentSnapshotsBound(
		fact: Extract<NormalizedLocalFact, { kind: 'agentSnapshotsBound' }>,
	): void
	resolveLiveRootAgentId(): string | null
	blockSubmitMissingRootAgent(correlation: CorrelationRef): void
	onPermissionRespond(
		fact: Extract<NormalizedLocalFact, { kind: 'permissionRespond' }>,
	): void
	permissionRespondCleanupPatches(
		fact: Extract<NormalizedLocalFact, { kind: 'permissionRespond' }>,
	): readonly ViewPatch[]
	onClientToolRespond(
		fact: Extract<NormalizedLocalFact, { kind: 'clientToolRespond' }>,
	): void
	clientToolRespondCleanupPatches(
		fact: Extract<NormalizedLocalFact, { kind: 'clientToolRespond' }>,
	): readonly ViewPatch[]
	onQuestionRespond(fact: Extract<NormalizedLocalFact, { kind: 'questionRespond' }>): void
	questionRespondCleanupPatches(
		fact: Extract<NormalizedLocalFact, { kind: 'questionRespond' }>,
	): readonly ViewPatch[]
	onInputDelivery(fact: Extract<NormalizedLocalFact, { kind: 'inputDelivery' }>): void
	onHostWriteReceipt(
		status: Extract<NormalizedLocalFact, { kind: 'inputDelivery' }>['status'],
		markers: { readonly writeId: string; readonly chatAttemptId: string },
		messageId: string,
	): void
	isPermissionRespondInflightCleanup(
		patches: readonly ViewPatch[],
		messageId: string,
	): boolean
	onQuestionAsked(fact: Extract<NormalizedLocalFact, { kind: 'questionAsked' }>): void
	onTurnInterrupted(fact: Extract<NormalizedLocalFact, { kind: 'turnInterrupted' }>): void
	onContinueGeneration(
		fact: Extract<NormalizedLocalFact, { kind: 'continueGeneration' }>,
	): void
	onRegenerateTurn(fact: Extract<NormalizedLocalFact, { kind: 'regenerateTurn' }>): void
	onCommandOutcome(fact: Extract<NormalizedLocalFact, { kind: 'commandOutcome' }>): void
	emitRegenerateSubmit(pending: {
		readonly correlation: CorrelationRef
		readonly preservedContent: string
		readonly agentId?: string
	}): void
	resolvePendingRespondAgentId(requestId: string): string | null
	foldStreamApplyViewPatches(patches: readonly ViewPatch[]): void
	onStreamEvent(event: unknown): void
	commitL2State(next: L2SeqIndexState): void
	feedIndex(entries: readonly L2SeqIndexEntry[]): void
	pruneIndex(removedSeqs: readonly number[]): void
	clearSeqIndex(): void
	entriesFromSeqItemNotes(notes: readonly SeqItemNote[]): readonly L2SeqIndexEntry[]
	feedIndexFromTransportEvent(event: unknown, patches: readonly ViewPatch[]): void
	maybeAdvanceLocalSeqCursorFromLive(event: unknown): void
	onRangeReplaced(event: RangeReplacedEvent): void
	escalateRangeReplacedUnresolvable(meta: RangeReplacedEvent['body']['meta']): void
	executeRangeReplacedApply(
		plan: Extract<RangeReplacedApplyPlan, { kind: 'apply' }>,
		meta: RangeReplacedEvent['body']['meta'],
	): void
	onStreamHello(body: StreamHelloAnchor): void
	consumeRewriteWindowFromHello(
		plan: Extract<StreamHelloGapPlan, { kind: 'rewriteWindow' }>,
	): void
	dropMirrorFromSeq(dropFromSeq: number): ViewPatch[]
	writeSyncWatermarkAfterRangeReplaced(fromSeq: number): void
	consumeGapTooLargeBootstrap(
		plan: Extract<StreamHelloGapPlan, { kind: 'bootstrapResync'; reason: 'gap_too_large' }>,
	): void
	tryAdvanceLastRuntimeEpoch(epoch: number): 'advanced' | 'same' | 'rollback'
	clearPendingForRuntimeEpochChange(): void
	maybeEmitHistoryFill(fromExclusive: number, toInclusive: number): boolean
	onHistoryResult(requestId: string, result: unknown): void
	clearStreamHelloAnchor(): void
	onStreamClosed(cause: StreamCloseCause): void
	foldAndBroadcastPatches(patches: readonly ViewPatch[]): void
	onOverlayPendingSnapshot(body: OverlayPendingSnapshotBody): void
	onOverlayActiveTurn(body: OverlayActiveTurnBody): void
	onOverlayActiveTurnClear(): void
	dropCleanupLedgerForRemovedPending(
		removedRequestIds: readonly ClientActionRequestId[],
	): void
	tryFoldL1SyncChromeStreamEvent(event: unknown): boolean
	pushSyncChrome(sync: SyncChrome): void
}
