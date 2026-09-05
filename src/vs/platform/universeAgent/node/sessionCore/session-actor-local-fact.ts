const RESPOND_AGENT_ID_MAX = 128
const RESPOND_AGENT_ID_STRINGIFY_GARBAGE = new Set(['undefined', 'null', '[object Object]', 'NaN'])

/** INV-SC-CTRL-1 */
function hasControlChar(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i)
		if (code <= 0x1f || code === 0x7f) return true
	}
	return false
}

function admitRespondAgentId(value: unknown): value is string {
	if (typeof value !== 'string') return false
	if (value.length === 0 || value.length > RESPOND_AGENT_ID_MAX) return false
	if (value !== value.trim()) return false
	if (hasControlChar(value)) return false
	return !RESPOND_AGENT_ID_STRINGIFY_GARBAGE.has(value)
}

function readSaoSubOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (desc.get !== undefined || desc.set !== undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

/**
 * GFS-4 SessionActor fold module.
 */

import {
	isApplyViewPatchesFact,
	isChatLifecycleLocalFact,
	isChatStreamDownFact,
	isChatStreamUpFact,
	isClientToolRespondFact,
	isCommandOutcomeFact,
	isContinueGenerationFact,
	isInputDeliveryFact,
	isPermissionRespondFact,
	isQuestionAskedFact,
	isQuestionRespondFact,
	isRegenerateTurnFact,
	isRootAgentBoundFact,
	isAgentStatusBoundFact,
	isTeamIdBoundFact,
	isBranchTopologyNotifiedFact,
	isAgentTreeBoundFact,
	isAgentSnapshotsBoundFact,
	isSeedSeqCursorFact,
	isSubmitInputFact,
	isTurnInterruptedFact,
	type NormalizedLocalFact,
} from './local-fact.js'
import { HOST_WRITE_RECEIPT_SOURCE, readHostWriteReceiptMarkers } from './host-write-receipt.js'
import { admitTimelineItemTurnId, applyViewPatches } from '../../common/sessionView/apply.js'
import { timelineItemFromClientToolRespond } from '../../common/sessionView/client-tool-call.js'
import { timelineItemFromQuestionAsk } from '../../common/sessionView/question-ask.js'
import type { CorrelationRef } from './messages.js'
import type { ClientActionRequestId, OperationId, TimelineItemId, ViewPatch } from '../../common/sessionView/types.js'
import {
	isExactRespondTimelineIdentity,
	timelineItemFromPermissionRespond,
	timelineItemFromQuestionRespond,
	timelineItemFromQuestionRespondPending,
} from './session-actor-timeline-items.js'
import {
	SEND_FAILED_EFFECT_KIND,
	SEND_FAILED_HOST_WRITE,
	SEND_FAILED_OUTBOX_OVERFLOW,
} from './session-actor-chat-outbox.js'
import { SessionActor } from './session-actor.js'
import type { SessionActorFold } from './session-actor-fold-interface.js'

export function installSessionActorLocalFact(): void {
	;(SessionActor.prototype as unknown as SessionActorFold).onLocalFact = function (this: SessionActorFold, fact: unknown): void {
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

	;(SessionActor.prototype as unknown as SessionActorFold).onSubmitInput = function (this: SessionActorFold, fact: Extract<NormalizedLocalFact, { kind: 'submitInput' }>): void {
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

	;(SessionActor.prototype as unknown as SessionActorFold).submitInputWritePayload = function (this: SessionActorFold, payload: unknown, agentId: string): Record<string, unknown> {
		if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
			return { ...(payload as Record<string, unknown>), agentId }
		}
		return { agentId }
	}

	;(SessionActor.prototype as unknown as SessionActorFold).onRootAgentBound = function (this: SessionActorFold, fact: Extract<NormalizedLocalFact, { kind: 'rootAgentBound' }>): void {
		if (!admitRespondAgentId(fact.agentId)) return
		this.liveRootAgentId = fact.agentId
	}

	;(SessionActor.prototype as unknown as SessionActorFold).onAgentStatusBound = function (this: SessionActorFold,
		fact: Extract<NormalizedLocalFact, { kind: 'agentStatusBound' }>,
	): void {
		if (!admitRespondAgentId(fact.agentId)) return
		const liveAgentStatus = { agentId: fact.agentId, status: fact.status }
		this.liveAgentStatusBound = liveAgentStatus
		this.foldAndBroadcastPatches([{ op: 'setLiveAgentStatus', liveAgentStatus }])
	}

	;(SessionActor.prototype as unknown as SessionActorFold).onTeamIdBound = function (this: SessionActorFold, fact: Extract<NormalizedLocalFact, { kind: 'teamIdBound' }>): void {
		this.liveTeamIdBound = fact.teamId
		this.foldAndBroadcastPatches([{ op: 'setLiveTeamId', liveTeamId: fact.teamId }])
	}

	;(SessionActor.prototype as unknown as SessionActorFold).onBranchTopologyNotified = function (this: SessionActorFold,
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

	;(SessionActor.prototype as unknown as SessionActorFold).onAgentTreeBound = function (this: SessionActorFold, fact: Extract<NormalizedLocalFact, { kind: 'agentTreeBound' }>): void {
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

	;(SessionActor.prototype as unknown as SessionActorFold).onAgentSnapshotsBound = function (this: SessionActorFold,
		fact: Extract<NormalizedLocalFact, { kind: 'agentSnapshotsBound' }>,
	): void {
		this.liveAgentSnapshotsBound = fact.snapshots
		this.foldAndBroadcastPatches([
			{ op: 'setLiveAgentSnapshots', liveAgentSnapshots: fact.snapshots },
		])
	}

	;(SessionActor.prototype as unknown as SessionActorFold).resolveLiveRootAgentId = function (this: SessionActorFold, ): string | null {
		const agentId = this.liveRootAgentId
		if (agentId === null || !admitRespondAgentId(agentId)) return null
		return agentId
	}

	;(SessionActor.prototype as unknown as SessionActorFold).blockSubmitMissingRootAgent = function (this: SessionActorFold, correlation: CorrelationRef): void {
		this.deps.diagnostics.warn('submitInput missing live root agent attribution', {
			sessionId: this.sessionId,
			correlation,
		})
	}

	;(SessionActor.prototype as unknown as SessionActorFold).onPermissionRespond = function (this: SessionActorFold,
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

	;(SessionActor.prototype as unknown as SessionActorFold).permissionRespondCleanupPatches = function (this: SessionActorFold,
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

	;(SessionActor.prototype as unknown as SessionActorFold).onClientToolRespond = function (this: SessionActorFold,
		fact: Extract<NormalizedLocalFact, { kind: 'clientToolRespond' }>,
	): void {
		this.applyCleanupPatches(this.clientToolRespondCleanupPatches(fact))
	}

	;(SessionActor.prototype as unknown as SessionActorFold).clientToolRespondCleanupPatches = function (this: SessionActorFold,
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

	;(SessionActor.prototype as unknown as SessionActorFold).onQuestionRespond = function (this: SessionActorFold, fact: Extract<NormalizedLocalFact, { kind: 'questionRespond' }>): void {
		this.applyCleanupPatches(this.questionRespondCleanupPatches(fact))
	}

	;(SessionActor.prototype as unknown as SessionActorFold).questionRespondCleanupPatches = function (this: SessionActorFold,
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

	;(SessionActor.prototype as unknown as SessionActorFold).onInputDelivery = function (this: SessionActorFold, fact: Extract<NormalizedLocalFact, { kind: 'inputDelivery' }>): void {
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

	;(SessionActor.prototype as unknown as SessionActorFold).onHostWriteReceipt = function (this: SessionActorFold,
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

	;(SessionActor.prototype as unknown as SessionActorFold).isPermissionRespondInflightCleanup = function (this: SessionActorFold,
		patches: readonly ViewPatch[],
		messageId: string,
	): boolean {
		if (!isExactRespondTimelineIdentity(messageId)) return false
		return patches.some(
			(patch) =>
				patch.op === 'removePendingAction' && String(patch.requestId) === messageId,
		)
	}

	;(SessionActor.prototype as unknown as SessionActorFold).onQuestionAsked = function (this: SessionActorFold, fact: Extract<NormalizedLocalFact, { kind: 'questionAsked' }>): void {
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

	;(SessionActor.prototype as unknown as SessionActorFold).onTurnInterrupted = function (this: SessionActorFold, fact: Extract<NormalizedLocalFact, { kind: 'turnInterrupted' }>): void {
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

	;(SessionActor.prototype as unknown as SessionActorFold).onContinueGeneration = function (this: SessionActorFold,
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

	;(SessionActor.prototype as unknown as SessionActorFold).onRegenerateTurn = function (this: SessionActorFold, fact: Extract<NormalizedLocalFact, { kind: 'regenerateTurn' }>): void {
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

	;(SessionActor.prototype as unknown as SessionActorFold).onCommandOutcome = function (this: SessionActorFold, fact: Extract<NormalizedLocalFact, { kind: 'commandOutcome' }>): void {
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

	;(SessionActor.prototype as unknown as SessionActorFold).emitRegenerateSubmit = function (this: SessionActorFold, pending: {
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

	;(SessionActor.prototype as unknown as SessionActorFold).resolvePendingRespondAgentId = function (this: SessionActorFold, requestId: string): string | null {
		const pending = this.snapshot.pendingActions.find(
			(action) => String(action.requestId) === requestId,
		)
		if (pending === undefined) return null
		const agentId = pending.agentId
		if (!admitRespondAgentId(agentId)) return null
		return agentId
	}
}
