/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../base/common/event.js';
import type { IDisposable } from '../../../../../base/common/lifecycle.js';
import {
	overlayAttributionKey,
	type AttributionPatch,
	type ConversationViewFrame,
	type ConversationViewFrameApplied,
	type ConversationWriteMessage,
	type DetailFetchOutcome,
	type DetailPatch,
	type PostOutcome,
} from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import type {
	IUniverseAgentSessionView,
	IUniverseAgentSessionViewFrameEvent,
} from '../../../../../platform/universeAgent/common/universeAgentSessionView.js';
import { emptySessionViewSnapshot } from '../../../../../platform/universeAgent/common/sessionView/empty-snapshot.js';
import type {
	ClientActionRequestId,
	OverlayBlockId,
	QuestionSummaryItem,
	SessionId,
	SessionViewSnapshot,
	SyncChrome,
	TextChunkId,
	TimelineItemId,
	TimelineItemSummary,
	TimelineItemView,
	ToolSummaryStatus,
	ViewLeaseId,
	ViewPatch,
} from '../../../../../platform/universeAgent/common/sessionView/types.js';

/** Same-frame sidecars the host ships next to a session-core `ViewFrame`. */
export interface ScriptedFrameSidecars {
	readonly attribution?: readonly AttributionPatch[];
	readonly details?: readonly DetailPatch[];
}

/**
 * Test double for the electron-main `IUniverseAgentSessionView` host.
 *
 * Tests script the frame stream (baseline, patches, duplicates, gaps) and the real
 * `ConversationEngineFrameSource` → `projectSnapshotToEntries` → `ConversationTimelineHost`
 * chain does the rest. This keeps subscription / ordering / resync bugs reproducible without
 * an engine, and lets the test assert on DOM instead of internal state.
 *
 * Like the real host, frames enqueued before the first listener attaches are buffered and
 * flushed on attach, so a test can script a burst right after `acquire()`.
 */
export class ScriptedSessionView implements IUniverseAgentSessionView, IDisposable {
	declare readonly _serviceBrand: undefined;

	dispose(): void {
		this.emitter.dispose();
	}

	readonly releaseLeaseCalls: string[] = [];
	readonly requestResyncCalls: string[] = [];
	readonly acknowledgeCalls: Array<{ readonly leaseId: string; readonly generation: number; readonly frameId: number; readonly appliedVersion: number }> = [];
	readonly posted: ConversationWriteMessage[] = [];

	private readonly pending: IUniverseAgentSessionViewFrameEvent[] = [];
	private readonly emitter = new Emitter<IUniverseAgentSessionViewFrameEvent>({
		onDidAddFirstListener: () => queueMicrotask(() => this.flush()),
	});

	private nextFrameId = 1;
	private generation = 1;
	private leaseId = '';
	private sessionId = '';

	/** Lease id is allocated by `acquireLease`; frames pushed earlier throw (script bug). */
	get currentLeaseId(): string {
		return this.leaseId;
	}

	// ---- IUniverseAgentSessionView ------------------------------------------------------

	onDynamicDidApplyFrame(_leaseId: string): Event<IUniverseAgentSessionViewFrameEvent> {
		return this.emitter.event;
	}

	async acquireLease(sessionId: string): Promise<string> {
		this.sessionId = sessionId;
		this.leaseId = `lease:${sessionId}`;
		return this.leaseId;
	}

	async whenEngineSessionReady(sessionId: string): Promise<string> {
		return sessionId;
	}

	async releaseLease(leaseId: string): Promise<void> {
		this.releaseLeaseCalls.push(leaseId);
	}

	async post(_leaseId: string, msg: ConversationWriteMessage): Promise<PostOutcome> {
		this.posted.push(msg);
		return { accepted: true, correlation: { id: 'scripted' } };
	}

	async requestResync(leaseId: string): Promise<void> {
		this.requestResyncCalls.push(leaseId);
	}

	async acknowledge(leaseId: string, ack: { readonly generation: number; readonly frameId: number; readonly appliedVersion: number }): Promise<void> {
		this.acknowledgeCalls.push({ leaseId, ...ack });
	}

	async requestDetail(_leaseId: string, _ref: string): Promise<DetailFetchOutcome> {
		return { ok: false, reason: 'unavailable' };
	}

	// ---- script API ---------------------------------------------------------------------

	/** Full replace; `attribution` for a baseline is the full map. */
	baseline(snapshot: Partial<SessionViewSnapshot> = {}, sidecars: ScriptedFrameSidecars = {}): void {
		this.enqueue({
			frame: {
				leaseId: this.leaseId as ViewLeaseId,
				generation: this.generation,
				frameId: this.nextFrameId,
				version: this.nextFrameId,
				body: {
					kind: 'baseline',
					snapshot: { ...emptySessionViewSnapshot(this.sessionId as SessionId), ...snapshot },
				},
			},
			attribution: sidecars.attribution,
			details: sidecars.details,
		}, { kind: 'baseline' });
		this.nextFrameId++;
	}

	patches(patches: readonly ViewPatch[], sidecars: ScriptedFrameSidecars = {}): void {
		this.enqueue({
			frame: this.makePatchFrame(patches),
			attribution: sidecars.attribution,
			details: sidecars.details,
		}, { kind: 'patches', changedIds: changedIdsOf(patches) });
		this.nextFrameId++;
	}

	/** Re-deliver the exact previous frame (at-least-once transport). */
	duplicateLast(): void {
		const last = this.lastEvent;
		if (!last) {
			throw new Error('duplicateLast() before any frame');
		}
		this.enqueueEvent(last);
	}

	/** Skip `count` frame ids so the next frame is a gap and the replica must request a resync. */
	skipFrames(count: number): void {
		this.nextFrameId += count;
	}

	// ---- convenience builders -----------------------------------------------------------

	userItem(id: string, text: string, orderKey: string): ScriptedItem {
		return timelineItem(id, orderKey, textSummary('You', text), 'user');
	}

	assistantItem(id: string, text: string, orderKey: string): ScriptedItem {
		return timelineItem(id, orderKey, textSummary('Assistant', text), 'assistant');
	}

	/** Durable permission row (L2). `decision` is the local decision chrome; omit while undecided. */
	permissionItem(id: string, title: string, orderKey: string, decision?: 'allow' | 'deny'): ScriptedItem {
		return timelineItem(id, orderKey, { kind: 'permission', title, permissionKind: 'scripted', ...(decision ? { decision } : {}) }, 'assistant');
	}

	/** Durable ask-user row (L2). `answered` is the local answered chrome; omit while open. */
	questionItem(id: string, title: string, orderKey: string, ask: ScriptedQuestion): ScriptedItem {
		return timelineItem(id, orderKey, {
			kind: 'question',
			title,
			items: ask.items,
			answerKeysValid: ask.answerKeysValid,
			...(ask.answered ? { answered: true as const } : {}),
		}, 'assistant');
	}

	/** Durable tool row (L2). Upserting the same id again moves it through pending → running → completed. */
	toolItem(id: string, orderKey: string, tool: ScriptedTool): ScriptedItem {
		return timelineItem(id, orderKey, {
			kind: 'tool',
			title: tool.title,
			toolName: tool.toolName,
			status: tool.status,
			...(tool.argPreview !== undefined ? { argPreview: tool.argPreview } : {}),
			...(tool.resultPreview !== undefined ? { resultPreview: tool.resultPreview } : {}),
			...(tool.respondable ? { respondable: true as const } : {}),
		}, 'tool');
	}

	errorItem(id: string, title: string, orderKey: string, retryable: boolean, code?: string): ScriptedItem {
		return timelineItem(id, orderKey, { kind: 'error', title, retryable, ...(code !== undefined ? { code } : {}) }, 'assistant');
	}

	unknownItem(id: string, typeName: string, rawContent: string, orderKey: string): ScriptedItem {
		return timelineItem(id, orderKey, { kind: 'unknown', typeName, rawContent }, 'assistant');
	}

	/** Pending client action (permission or ask-user). Only its `requestId` reaches the row projection. */
	pendingAction(requestId: string, title: string, as: 'permission' | 'question' = 'permission'): ViewPatch {
		const summary: TimelineItemSummary = as === 'permission'
			? { kind: 'permission', title, permissionKind: 'scripted' }
			: { kind: 'question', title, items: [], answerKeysValid: false };
		return { op: 'upsertPendingAction', action: { requestId: requestId as ClientActionRequestId, summary } };
	}

	removePendingAction(requestId: string): ViewPatch {
		return { op: 'removePendingAction', requestId: requestId as ClientActionRequestId };
	}

	pendingRespondFailed(requestId: string, cause: 'hostWriteFailed' | 'commandFailed', retryable: boolean, error: string): ViewPatch {
		return { op: 'pendingRespondFailed', requestId: requestId as ClientActionRequestId, cause, retryable, error };
	}

	syncChrome(sync: SyncChrome): ViewPatch {
		return { op: 'setSyncChrome', sync };
	}

	/** Open a streaming assistant overlay block (L3). Attribution key is `overlay:<blockId>`. */
	openAssistantOverlay(blockId: string, orderKey: string): { patch: ViewPatch; attribution: AttributionPatch } {
		const summary: TimelineItemSummary = { kind: 'text', title: 'Assistant', streaming: true };
		return {
			patch: { op: 'upsertOverlayBlock', block: { blockId: blockId as OverlayBlockId, orderKey, summary, chunks: [] } },
			attribution: { op: 'upsertAttribution', itemId: overlayAttributionKey(blockId), attribution: { role: 'assistant' } },
		};
	}

	textChunk(blockId: string, chunkIndex: number, text: string): ViewPatch {
		return {
			op: 'upsertTextChunk',
			blockId: blockId as OverlayBlockId,
			chunk: {
				chunkId: `${blockId}:c${chunkIndex}` as TextChunkId,
				orderKey: String(chunkIndex).padStart(10, '0'),
				text,
			},
		};
	}

	// ---- internals ----------------------------------------------------------------------

	private lastEvent: IUniverseAgentSessionViewFrameEvent | undefined;

	private makePatchFrame(patches: readonly ViewPatch[]): ConversationViewFrame['frame'] {
		return {
			leaseId: this.leaseId as ViewLeaseId,
			generation: this.generation,
			frameId: this.nextFrameId,
			version: this.nextFrameId,
			body: { kind: 'patches', patches },
		};
	}

	private enqueue(frame: ConversationViewFrame, applied: ConversationViewFrameApplied): void {
		if (!this.leaseId) {
			throw new Error('push a frame only after acquire() (lease id not allocated yet)');
		}
		this.enqueueEvent({ leaseId: this.leaseId, sessionId: this.sessionId, frame, applied });
	}

	private enqueueEvent(event: IUniverseAgentSessionViewFrameEvent): void {
		this.lastEvent = event;
		if (this.emitter.hasListeners()) {
			this.emitter.fire(event);
		} else {
			this.pending.push(event);
		}
	}

	private flush(): void {
		for (const event of this.pending.splice(0)) {
			this.emitter.fire(event);
		}
	}
}

export interface ScriptedQuestion {
	readonly items: readonly QuestionSummaryItem[];
	readonly answerKeysValid: boolean;
	readonly answered?: boolean;
}

export interface ScriptedTool {
	readonly title: string;
	readonly toolName: string;
	readonly status: ToolSummaryStatus;
	readonly argPreview?: string;
	readonly resultPreview?: string;
	readonly respondable?: boolean;
}

/** One durable timeline row: the patch, the bare item (for baselines) and its attribution. */
export interface ScriptedItem {
	readonly patch: ViewPatch;
	readonly item: TimelineItemView;
	readonly attribution: AttributionPatch;
}

function timelineItem(id: string, orderKey: string, summary: TimelineItemSummary, role: 'user' | 'assistant' | 'tool'): ScriptedItem {
	const item: TimelineItemView = { id: id as TimelineItemId, orderKey, summary };
	return {
		patch: { op: 'upsertTimelineItem', item },
		item,
		attribution: { op: 'upsertAttribution', itemId: id, attribution: { role } },
	};
}

function textSummary(title: string, preview: string): TimelineItemSummary {
	return { kind: 'text', title, preview };
}

/** Mirrors the host: ids a patch batch touches, in the vocabulary of `ConversationViewFrameApplied`. */
function changedIdsOf(patches: readonly ViewPatch[]): ReadonlySet<string> {
	const ids = new Set<string>();
	for (const patch of patches) {
		switch (patch.op) {
			case 'upsertTimelineItem': ids.add(String(patch.item.id)); break;
			case 'removeTimelineItem': ids.add(String(patch.itemId)); break;
			case 'upsertOverlayBlock': ids.add(`overlay:${patch.block.blockId}`); break;
			case 'removeOverlayBlock': ids.add(`overlay:${patch.blockId}`); break;
			case 'upsertTextChunk': ids.add(`overlay:${patch.blockId}`); break;
			case 'upsertPendingAction': ids.add(`pending:${patch.action.requestId}`); break;
			case 'removePendingAction': ids.add(`pending:${patch.requestId}`); break;
			case 'upsertLocalSend': ids.add(`send:${patch.send.operationId}`); break;
			case 'removeLocalSend': ids.add(`send:${patch.operationId}`); break;
			case 'pendingRespondFailed': ids.add(`pending:${patch.requestId}`); break;
			case 'setSyncChrome': ids.add('sync'); break;
			default: ids.add(`chrome:${patch.op}`); break;
		}
	}
	return ids;
}