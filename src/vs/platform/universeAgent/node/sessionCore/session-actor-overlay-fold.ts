function cleanupPatchesTargetIds(
	patches: readonly import('./view/types.js').ViewPatch[] | undefined,
	ids: ReadonlySet<string>,
): boolean {
	if (patches === undefined || patches.length === 0) return false
	return patches.some((p) => p.op === 'removePendingAction' && ids.has(String(p.requestId)))
}

/**
 * GFS-4 SessionActor fold module.
 */

import {
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
import type { OverlayActiveTurnBody, OverlayPendingSnapshotBody } from './local-fact.js'
import {
	admitPendingActionUpserts,
	OVERLAY_PENDING_SET_REPLACE_AT_CAPACITY,
	planOverlayPendingSetReplace,
} from './pending-actions-bound.js'
import type { ClientActionRequestId, OverlayBlockId, SyncChrome, TextChunkId, ViewPatch } from '../../common/sessionView/types.js'
import { SessionActor } from './session-actor.js'
import type { SessionActorFold } from './session-actor-fold-interface.js'

export function installSessionActorOverlayFold(): void {
	;(SessionActor.prototype as unknown as SessionActorFold).onOverlayPendingSnapshot = function (this: SessionActorFold, body: OverlayPendingSnapshotBody): void {
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

	;(SessionActor.prototype as unknown as SessionActorFold).onOverlayActiveTurn = function (this: SessionActorFold, body: OverlayActiveTurnBody): void {
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

	;(SessionActor.prototype as unknown as SessionActorFold).onOverlayActiveTurnClear = function (this: SessionActorFold, ): void {
		const blockId = this.overlayActiveTurnBlockId
		if (blockId == null) return
		this.overlayActiveTurnBlockId = null
		this.foldAndBroadcastPatches([{ op: 'removeOverlayBlock', blockId }])
	}

	;(SessionActor.prototype as unknown as SessionActorFold).dropCleanupLedgerForRemovedPending = function (this: SessionActorFold,
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

	;(SessionActor.prototype as unknown as SessionActorFold).tryFoldL1SyncChromeStreamEvent = function (this: SessionActorFold, event: unknown): boolean {
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

	;(SessionActor.prototype as unknown as SessionActorFold).pushSyncChrome = function (this: SessionActorFold, sync: SyncChrome): void {
		this.foldAndBroadcastPatches([{ op: 'setSyncChrome', sync }])
	}
}
